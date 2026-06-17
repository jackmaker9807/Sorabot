import { Client, GatewayIntentBits, Events, Message, Sticker } from "discord.js";
import { db, rulesTable, messageLogsTable, botSettingsTable, aiProvidersTable, userProfilesTable, type AiProviderRow } from "./db";
import type { BotSettings, Rule } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";
import { broadcast } from "./ws";
import { generateAIReply, extractProfileUpdate, generateGifQuery } from "./ai-responder";
import type { AiProviderConfig } from "./ai-responder";

let client: Client | null = null;
let isRunning = false;

const conversationHistories = new Map<string, Array<{ role: "user" | "model"; parts: string }>>();
const MAX_HISTORY = 20;

const lastGifSentAt = new Map<string, number>();
// Channels currently processing a GIF (prevents race-condition double-GIF)
const gifInFlight = new Set<string>();
// Last time the bot sent any reply per channel (anti-spam)
const lastRepliedAt = new Map<string, number>();

let settingsCache: { data: BotSettings; expiresAt: number } | null = null;
let rulesCache: { data: Rule[]; expiresAt: number } | null = null;
let aiProvidersCache: { data: AiProviderConfig[]; expiresAt: number } | null = null;
const CACHE_TTL = 10_000;

type UserProfileRow = typeof userProfilesTable.$inferSelect;
const userProfileCache = new Map<string, UserProfileRow>();
const userRecentMessages = new Map<string, string[]>();
const PROFILE_UPDATE_EVERY = 5;

async function getCachedSettings() {
  const now = Date.now();
  if (settingsCache && now < settingsCache.expiresAt) return settingsCache.data;
  const [s] = await db.select().from(botSettingsTable).limit(1);
  settingsCache = { data: s, expiresAt: now + CACHE_TTL };
  return s;
}

async function getCachedRules() {
  const now = Date.now();
  if (rulesCache && now < rulesCache.expiresAt) return rulesCache.data;
  const rows = await db.select().from(rulesTable).where(eq(rulesTable.enabled, true));
  rulesCache = { data: rows, expiresAt: now + CACHE_TTL };
  return rows;
}

async function getCachedAiProviders(): Promise<AiProviderConfig[]> {
  const now = Date.now();
  if (aiProvidersCache && now < aiProvidersCache.expiresAt) return aiProvidersCache.data;
  const rows = await db
    .select()
    .from(aiProvidersTable)
    .where(eq(aiProvidersTable.enabled, true))
    .orderBy(aiProvidersTable.priority, aiProvidersTable.createdAt);
  const providers: AiProviderConfig[] = rows.map((r: AiProviderRow) => ({
    id: r.id,
    provider: r.provider,
    keyValue: r.keyValue,
    baseUrl: r.baseUrl,
    model: r.model,
    label: r.label,
  }));
  if (providers.length === 0 && process.env.GEMINI_API_KEY) {
    providers.push({
      id: 0,
      provider: "gemini",
      keyValue: process.env.GEMINI_API_KEY,
      baseUrl: null,
      model: "gemini-2.5-flash",
      label: "env fallback",
    });
  }
  aiProvidersCache = { data: providers, expiresAt: now + CACHE_TTL };
  return providers;
}

export function invalidateCache() {
  settingsCache = null;
  rulesCache = null;
  aiProvidersCache = null;
}

async function getOrCreateUserProfile(userId: string, username: string): Promise<UserProfileRow> {
  const cached = userProfileCache.get(userId);
  if (cached) return cached;

  const [existing] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.discordUserId, userId)).limit(1);
  if (existing) {
    userProfileCache.set(userId, existing);
    return existing;
  }

  const [created] = await db.insert(userProfilesTable).values({ discordUserId: userId, username }).returning();
  userProfileCache.set(userId, created!);
  return created!;
}

function trackUserMessage(userId: string, message: string) {
  const msgs = userRecentMessages.get(userId) ?? [];
  msgs.push(message.slice(0, 200));
  if (msgs.length > 20) msgs.shift();
  userRecentMessages.set(userId, msgs);
}

function scheduleProfileUpdate(userId: string, username: string, messageCount: number, providers: AiProviderConfig[]) {
  if (messageCount % PROFILE_UPDATE_EVERY !== 0) return;
  const messages = userRecentMessages.get(userId) ?? [];
  if (messages.length < 3) return;

  extractProfileUpdate(messages, username, providers).then(async (update) => {
    if (!update) return;
    const toSet: Partial<UserProfileRow> = { lastSeenAt: new Date() };
    if (update.nickname) toSet.nickname = update.nickname;
    if (update.interests) toSet.interests = update.interests;
    if (update.communicationStyle) toSet.communicationStyle = update.communicationStyle;
    if (update.summary) toSet.summary = update.summary;

    const [updated] = await db.update(userProfilesTable).set(toSet).where(eq(userProfilesTable.discordUserId, userId)).returning();
    if (updated) userProfileCache.set(userId, updated);
    logger.info({ userId, nickname: toSet.nickname }, "User profile updated");
  }).catch((err) => logger.warn({ err, userId }, "Failed to update user profile"));
}

function addToHistory(channelId: string, role: "user" | "model", text: string) {
  const history = conversationHistories.get(channelId) ?? [];
  history.push({ role, parts: text });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
  conversationHistories.set(channelId, history);
}

const ID_TO_EN: [RegExp, string][] = [
  // Sapaan
  [/\bselamat\s+datang\b/i, "welcome"],
  [/\bhalo|hai|hei\b/i, "hello"],
  [/\bbye|sampai\s+jumpa|dadah|selamat\s+tinggal\b/i, "goodbye"],
  [/\bterima\s+kasih|makasih|thx\b/i, "thank you"],
  [/\bmaaf|sorry|sori\b/i, "sorry"],

  // Emosi positif
  [/\bsenang|bahagia|gembira|girang\b/i, "happy"],
  [/\bsemangat|antusias|excited\b/i, "excited"],
  [/\bkocak|lucu|ngakak|receh\b/i, "funny laughing"],
  [/\bhaha|wkwk|hehe|xixi|kwkw\b/i, "laughing"],
  [/\bbagus|keren|mantap|oke\s+banget|luar\s+biasa|kece\b/i, "awesome"],
  [/\bsetuju|sepakat\b/i, "nodding agree"],
  [/\bcinta|sayang|rindu\b/i, "love"],
  [/\bmenang|juara|sukses|berhasil|yes\b/i, "winning"],
  [/\bsyukur|alhamdulillah|legaan|lega\b/i, "relieved"],
  [/\bkejutan|surprise\b/i, "surprise"],
  [/\bkagum|wow|waah\b/i, "amazed"],
  [/\bselamat|congrats|congrat\b/i, "congratulations"],

  // Emosi negatif
  [/\bsedih|nangis|menangis\b/i, "sad crying"],
  [/\bmarah|kesal|bete|emosi|jengkel\b/i, "angry"],
  [/\bkecewa|kecewakan\b/i, "disappointed"],
  [/\btakut|takut-takut|ngeri|horror\b/i, "scared"],
  [/\bmalu|memalukan\b/i, "embarrassed"],
  [/\bstres|stress|panik\b/i, "stressed"],
  [/\bkapok|jera\b/i, "done done"],
  [/\bkalah|gagal|fail\b/i, "fail"],

  // Kebingungan & ragu
  [/\btidak\s+tahu|gatau|gak\s+tau|ga\s+tau|bingung|bingung\s+banget\b/i, "confused"],
  [/\bkaget|terkejut|syok|shock\b/i, "shocked"],
  [/\bserius|masa|masa\s+iya|beneran\b/i, "seriously"],

  // Kondisi fisik
  [/\bcapek|lelah|exhausted|ngantuk\b/i, "tired"],
  [/\btidur|bobok|ngantuk\s+banget\b/i, "sleepy"],
  [/\bmakan|lapar|mau\s+makan\b/i, "eating"],
  [/\bbosing|bosan|boring\b/i, "bored"],

  // Lainnya
  [/\bsabar\b/i, "patience"],
  [/\btolong|minta\s+tolong|help\b/i, "help"],
  [/\bepik\b/i, "epic"],
  [/\bsemangat\b/i, "motivated"],
  [/\bfikir|mikir|hmm\b/i, "thinking"],
  [/\boke|siap|oke\s+siap\b/i, "thumbs up"],
  [/\bgood\s+morning|selamat\s+pagi\b/i, "good morning"],
  [/\bgood\s+night|selamat\s+malam|selamat\s+tidur\b/i, "good night"],
  [/\bjaga\s+diri|stay\s+safe|hati-hati\b/i, "take care"],
];

const POSITIVE_SIGNALS = [
  /\bbagus\b/i, /\bbagus\s+sekali\b/i, /\bbetul\b/i, /\bbenar\b/i, /\bbisa\b/i,
  /\bboleh\b/i, /\bbrilliant\b/i, /[!]{2,}/, /\byay\b/i, /\bwow\b/i,
  /\bsip\b/i, /\boke\b/i, /\bgood\b/i, /\bgreat\b/i, /\bnice\b/i,
  /\bpasti\b/i, /\btentu\b/i, /\bjelas\b/i, /\btentunya\b/i, /\bsangat\b/i,
  /\basyik\b/i, /\bseru\b/i, /\bkeren\b/i, /\bcool\b/i, /\bperfect\b/i,
  /\bspesial\b/i, /\byuk\b/i, /\bayo\b/i, /\byeah\b/i,
];

const NEGATIVE_SIGNALS = [
  /\btidak\b/i, /\bgak\b/i, /\bnga\b/i, /\bga\b/i, /\bbukan\b/i,
  /\bjangan\b/i, /\bsayangnya\b/i, /\bmaaf\b/i, /\bmasalah\b/i,
  /\bsulit\b/i, /\bsusah\b/i, /\brepot\b/i, /\bberat\b/i,
  /\bburuk\b/i, /\bjelek\b/i, /\bparah\b/i, /\bgawat\b/i,
  /\bkeliru\b/i, /\bsalah\b/i, /\bkurang\b/i, /\btidak\s+bisa\b/i,
  /\bbelum\b/i, /\bterlambat\b/i, /\bgagal\b/i, /\brusak\b/i,
];

const POSITIVE_MOODS = ["happy", "excited", "thumbs up", "nodding", "cheerful"];
const NEGATIVE_MOODS = ["sad", "disappointed", "worried", "sigh"];
const NEUTRAL_MOODS  = ["thinking", "shrug", "okay"];

function detectMood(text: string): string {
  let pos = 0;
  let neg = 0;
  for (const p of POSITIVE_SIGNALS) if (p.test(text)) pos++;
  for (const p of NEGATIVE_SIGNALS) if (p.test(text)) neg++;

  if (pos > neg + 1) return POSITIVE_MOODS[Math.floor(Math.random() * POSITIVE_MOODS.length)]!;
  if (neg > pos + 1) return NEGATIVE_MOODS[Math.floor(Math.random() * NEGATIVE_MOODS.length)]!;
  return NEUTRAL_MOODS[Math.floor(Math.random() * NEUTRAL_MOODS.length)]!;
}

function buildGifQuery(response: string): string {
  const text = response
    .replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]/gu, "")
    .replace(/https?:\/\/\S+/g, "")
    .trim();

  for (const [pattern, en] of ID_TO_EN) {
    if (pattern.test(text)) return en;
  }

  return detectMood(text);
}

async function fetchGif(query: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(query);
    const url = `https://api.tenor.com/v1/search?q=${q}&limit=8&contentfilter=low&media_filter=minimal&key=LIVDSRZULELA`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json() as { results?: Array<{ media?: Array<{ gif?: { url?: string } }> }> };
    const items = data.results ?? [];
    if (items.length === 0) return null;
    const topItems = items.slice(0, 3);
    const pick = topItems[Math.floor(Math.random() * topItems.length)];
    return pick?.media?.[0]?.gif?.url ?? null;
  } catch {
    return null;
  }
}

function pickRandomSticker(message: Message): Sticker | null {
  if (!message.guild) return null;
  const stickers = [...message.guild.stickers.cache.values()];
  if (stickers.length === 0) return null;
  return stickers[Math.floor(Math.random() * stickers.length)] ?? null;
}

function isGifOnCooldown(channelId: string, cooldownSeconds: number): boolean {
  const last = lastGifSentAt.get(channelId);
  if (!last) return false;
  return Date.now() - last < cooldownSeconds * 1000;
}

export function getClient(): Client | null {
  return client;
}

export function getBotStatus() {
  if (!client || !isRunning) {
    return { running: false, username: null, guildCount: 0, ping: null };
  }
  return {
    running: true,
    username: client.user?.tag ?? null,
    guildCount: client.guilds.cache.size,
    ping: client.ws.ping,
  };
}

export function getGuilds() {
  if (!client || !isRunning) return [];
  return client.guilds.cache.map((guild) => ({
    id: guild.id,
    name: guild.name,
    memberCount: guild.memberCount,
    iconUrl: guild.iconURL({ size: 128 }) ?? null,
  }));
}

async function handleMessage(message: Message) {
  if (message.author.bot) return;

  try {
    const settings = await getCachedSettings();
    const aiEnabled = settings?.aiEnabled ?? true;
    const respondToAll = settings?.respondToAll ?? false;
    const mentionOnly = settings?.mentionOnly ?? false;
    const personality = settings?.personality ?? "";
    const gifEnabled = settings?.gifEnabled ?? false;
    const gifCooldownSeconds = settings?.gifCooldownSeconds ?? 60;
    const stickerEnabled = settings?.stickerEnabled ?? false;
    const aiProviders = await getCachedAiProviders();
    const rules = await getCachedRules();

    let matchedRule: typeof rules[0] | null = null;
    for (const rule of rules) {
      const content = rule.caseSensitive ? message.content : message.content.toLowerCase();
      const keyword = rule.caseSensitive ? rule.keyword : rule.keyword.toLowerCase();

      let matched = false;
      if (rule.matchType === "exact") matched = content === keyword;
      else if (rule.matchType === "contains") matched = content.includes(keyword);
      else if (rule.matchType === "startsWith") matched = content.startsWith(keyword);
      else if (rule.matchType === "endsWith") matched = content.endsWith(keyword);
      else if (rule.matchType === "regex") {
        try { matched = new RegExp(keyword).test(content); } catch { matched = false; }
      }

      if (matched) { matchedRule = rule; break; }
    }

    const isMentioned = client?.user ? message.mentions.has(client.user) : false;
    if (mentionOnly && !isMentioned) return;
    if (!matchedRule && !respondToAll) return;

    const channelId = message.channelId;

    // Anti-spam: ignore if bot replied to this channel too recently (1.5s window)
    const MIN_REPLY_INTERVAL_MS = 1_500;
    const lastReply = lastRepliedAt.get(channelId);
    if (lastReply && Date.now() - lastReply < MIN_REPLY_INTERVAL_MS) {
      logger.debug({ channelId }, "Reply skipped — anti-spam cooldown");
      return;
    }
    lastRepliedAt.set(channelId, Date.now());
    const userId = message.author.id;
    const username = message.author.username;
    const cleanContent = message.content.replace(/<@!?\d+>/g, "").trim();
    const history = conversationHistories.get(channelId) ?? [];
    addToHistory(channelId, "user", cleanContent || message.content);

    const userProfile = await getOrCreateUserProfile(userId, username);
    trackUserMessage(userId, cleanContent || message.content);

    const newCount = (userProfile.messageCount ?? 0) + 1;
    await db.update(userProfilesTable)
      .set({ messageCount: newCount, lastSeenAt: new Date(), username })
      .where(eq(userProfilesTable.discordUserId, userId));
    userProfileCache.set(userId, { ...userProfile, messageCount: newCount, lastSeenAt: new Date(), username });

    let response: string;
    if (aiEnabled) {
      response = await generateAIReply(
        cleanContent || message.content,
        matchedRule ? { keyword: matchedRule.keyword, response: matchedRule.response, matchType: matchedRule.matchType } : null,
        history,
        personality,
        aiProviders,
        { nickname: userProfile.nickname, interests: userProfile.interests, communicationStyle: userProfile.communicationStyle, summary: userProfile.summary, messageCount: newCount },
      );
    } else {
      if (!matchedRule) return;
      response = matchedRule.response;
    }

    addToHistory(channelId, "model", response);
    scheduleProfileUpdate(userId, username, newCount, aiProviders);

    const canSendGif = gifEnabled && !isGifOnCooldown(channelId, gifCooldownSeconds);
    const sticker = stickerEnabled ? pickRandomSticker(message) : null;

    if (canSendGif && !gifInFlight.has(channelId)) {
      // Lock channel slot immediately — prevents concurrent messages from both
      // passing the cooldown check before lastGifSentAt is set.
      gifInFlight.add(channelId);
      lastGifSentAt.set(channelId, Date.now());
      try {
        // AI-generated query understands topic + mood; regex is the fallback.
        const aiQuery = await generateGifQuery(cleanContent || message.content, response, aiProviders);
        const gifQuery = aiQuery ?? buildGifQuery(response);
        const gifUrl = await fetchGif(gifQuery);
        logger.debug({ gifQuery, source: aiQuery ? "ai" : "regex" }, "GIF query used");
        if (gifUrl) {
          const replyOpts = {
            content: response,
            embeds: [{ image: { url: gifUrl } }],
            ...(sticker ? { stickers: [sticker] } : {}),
          };
          await message.reply(replyOpts).catch(() => message.reply({ content: response, embeds: [{ image: { url: gifUrl } }] }));
        } else {
          if (sticker) {
            await message.reply({ content: response, stickers: [sticker] }).catch(() => message.reply(response));
          } else {
            await message.reply(response);
          }
        }
      } finally {
        gifInFlight.delete(channelId);
      }
    } else {
      if (sticker) {
        await message.reply({ content: response, stickers: [sticker] }).catch(() => message.reply(response));
      } else {
        await message.reply(response);
      }
    }

    if (matchedRule) {
      await db.update(rulesTable).set({ triggerCount: sql`${rulesTable.triggerCount} + 1` }).where(eq(rulesTable.id, matchedRule.id));
    }

    const channelName = message.channel.isDMBased() ? "DM" : (message.channel as { name?: string }).name ?? "unknown";
    const guildName = message.guild?.name ?? null;
    const triggerMessage = message.content.slice(0, 500);
    const botResponse = response.slice(0, 500);

    const [inserted] = await db.insert(messageLogsTable).values({
      guildName,
      channelName,
      authorUsername: message.author.tag,
      triggerMessage,
      botResponse,
      ruleId: matchedRule?.id ?? null,
    }).returning();

    if (inserted) {
      broadcast({
        type: "new_log",
        data: {
          id: inserted.id,
          authorUsername: message.author.tag,
          channelName,
          guildName,
          triggerMessage,
          botResponse,
          createdAt: new Date().toISOString(),
        },
      });
    }

    logger.info({ ruleId: matchedRule?.id ?? null, aiEnabled, gifEnabled: canSendGif, stickerSent: !!sticker, author: message.author.tag }, "Auto-replied to message");
  } catch (err) {
    logger.error({ err }, "Error handling message");
  }
}

export async function startBot(): Promise<void> {
  if (isRunning && client) { logger.info("Bot is already running"); return; }

  const [settings] = await db.select().from(botSettingsTable).limit(1);
  const token = settings?.discordToken || process.env.DISCORD_BOT_TOKEN;

  if (!token) throw new Error("Discord Bot Token belum dikonfigurasi. Atur di dashboard → Pengaturan.");

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.GuildEmojisAndStickers,
    ],
  });

  client.once(Events.ClientReady, (c) => { isRunning = true; logger.info({ tag: c.user.tag }, "Discord bot is ready"); });
  client.on(Events.Warn, (info) => { logger.warn({ info }, "Discord client warning"); });
  client.on(Events.MessageCreate, handleMessage);
  client.on(Events.Error, (err) => { logger.error({ err }, "Discord client error"); });

  await client.login(token);
}

export async function stopBot(): Promise<void> {
  if (!client) return;
  isRunning = false;
  conversationHistories.clear();
  lastGifSentAt.clear();
  gifInFlight.clear();
  lastRepliedAt.clear();
  await client.destroy();
  client = null;
  logger.info("Discord bot stopped");
}
