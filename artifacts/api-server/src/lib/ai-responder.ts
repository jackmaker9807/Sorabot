import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { logger } from "./logger";

const REQUEST_TIMEOUT_MS = 10_000;

export type AiProviderConfig = {
  id: number;
  provider: string;
  keyValue: string;
  baseUrl: string | null;
  model: string;
  label: string | null;
};

const circuitBreaker = new Map<number, number>();

function isBlocked(id: number): boolean {
  const until = circuitBreaker.get(id);
  if (!until) return false;
  if (Date.now() >= until) { circuitBreaker.delete(id); return false; }
  return true;
}

function blockProvider(id: number, retryAfterMs: number) {
  circuitBreaker.set(id, Date.now() + retryAfterMs);
}

export function getCircuitBreakerStatus() {
  const now = Date.now();
  const result: Array<{ id: number; blockedUntil: number; secsLeft: number }> = [];
  for (const [id, until] of circuitBreaker.entries()) {
    if (until > now) result.push({ id, blockedUntil: until, secsLeft: Math.ceil((until - now) / 1000) });
    else circuitBreaker.delete(id);
  }
  return result;
}

function extractRetryMs(err: unknown): number {
  const msg = (err as { message?: string }).message ?? String(err);
  const geminiMatch = msg.match(/retry in (\d+(?:\.\d+)?)s/i);
  if (geminiMatch) return Math.ceil(parseFloat(geminiMatch[1])) * 1000 + 2_000;
  const headers = (err as { headers?: Record<string, string> }).headers;
  if (headers?.["retry-after"]) return parseInt(headers["retry-after"]) * 1000 + 2_000;
  return 60_000;
}

export type Rule = { keyword: string; response: string; matchType: string };

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms))]);
}

const geminiClientCache = new Map<string, GoogleGenerativeAI>();
function getGeminiClient(apiKey: string): GoogleGenerativeAI {
  if (!geminiClientCache.has(apiKey)) geminiClientCache.set(apiKey, new GoogleGenerativeAI(apiKey));
  return geminiClientCache.get(apiKey)!;
}

async function generateWithGemini(cfg: AiProviderConfig, userMessage: string, history: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>, systemPrompt: string): Promise<string> {
  const client = getGeminiClient(cfg.keyValue);
  const model = client.getGenerativeModel({ model: cfg.model || "gemini-2.5-flash", systemInstruction: { text: systemPrompt } });
  const chat = model.startChat({ history, generationConfig: { maxOutputTokens: 300, temperature: 0.85 } });
  const result = await withTimeout(chat.sendMessage(userMessage), REQUEST_TIMEOUT_MS);
  return result.response.text().trim();
}

const openaiClientCache = new Map<string, OpenAI>();
function getOpenAIClient(apiKey: string, baseUrl: string | null): OpenAI {
  const cacheKey = `${baseUrl ?? "default"}::${apiKey}`;
  if (!openaiClientCache.has(cacheKey)) openaiClientCache.set(cacheKey, new OpenAI({ apiKey, baseURL: baseUrl ?? undefined, timeout: REQUEST_TIMEOUT_MS }));
  return openaiClientCache.get(cacheKey)!;
}

async function generateWithOpenAI(cfg: AiProviderConfig, userMessage: string, history: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>, systemPrompt: string): Promise<string> {
  const client = getOpenAIClient(cfg.keyValue, cfg.baseUrl);
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.map((h) => ({ role: (h.role === "model" ? "assistant" : "user") as "user" | "assistant", content: h.parts.map((p) => p.text).join("") })),
    { role: "user", content: userMessage },
  ];
  const completion = await withTimeout(client.chat.completions.create({ model: cfg.model, messages, max_tokens: 300, temperature: 0.85 }), REQUEST_TIMEOUT_MS);
  return completion.choices[0]?.message?.content?.trim() ?? "";
}

export type UserProfileContext = {
  nickname?: string | null;
  interests?: string | null;
  communicationStyle?: string | null;
  summary?: string | null;
  messageCount?: number;
};

export async function extractProfileUpdate(
  messages: string[],
  username: string,
  providers: AiProviderConfig[],
): Promise<{ nickname?: string; interests?: string; communicationStyle?: string; summary?: string } | null> {
  const active = providers.filter((p) => p.keyValue);
  if (active.length === 0) return null;

  const prompt = `Analisis pesan-pesan berikut dari pengguna bernama "${username}" dan ekstrak informasi singkat tentang mereka.

Pesan:
${messages.map((m, i) => `${i + 1}. ${m}`).join("\n")}

Balas HANYA dengan JSON (tanpa markdown/kode), contoh:
{"nickname":"Andi","interests":"gaming, anime","communicationStyle":"santai, gaul","summary":"Suka gaming dan anime, gaya bicara santai dan sering pakai slang"}

Isi hanya jika ada data yang jelas. Kosongkan field yang tidak ada infonya.`;

  try {
    const cfg = active[0]!;
    let text = "";
    if (cfg.provider === "gemini") {
      const client = getGeminiClient(cfg.keyValue);
      const model = client.getGenerativeModel({ model: cfg.model || "gemini-2.5-flash" });
      const result = await withTimeout(model.generateContent(prompt), 8_000);
      text = result.response.text().trim();
    } else {
      const client = getOpenAIClient(cfg.keyValue, cfg.baseUrl);
      const completion = await withTimeout(
        client.chat.completions.create({ model: cfg.model, messages: [{ role: "user", content: prompt }], max_tokens: 150, temperature: 0.3 }),
        8_000,
      );
      text = completion.choices[0]?.message?.content?.trim() ?? "";
    }
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

/**
 * Ask the AI to pick a 2-4 word English GIF search query that matches
 * the topic and mood of the conversation.  Falls back to null so the
 * caller can use the existing regex fallback.
 */
export async function generateGifQuery(
  userMessage: string,
  botResponse: string,
  providers: AiProviderConfig[],
): Promise<string | null> {
  const active = providers.filter((p) => p.keyValue && !isBlocked(p.id));
  if (active.length === 0) return null;

  const prompt =
    `User message: "${userMessage.slice(0, 200)}"\n` +
    `Bot reply: "${botResponse.slice(0, 200)}"\n\n` +
    `Reply with ONLY 2-4 English words for a GIF search query that best captures the topic and mood of this exchange. No punctuation, no explanation.`;

  const GIF_TIMEOUT_MS = 4_000;

  for (const cfg of active) {
    try {
      let text = "";
      if (cfg.provider === "gemini") {
        const client = getGeminiClient(cfg.keyValue);
        const model = client.getGenerativeModel({ model: cfg.model || "gemini-2.5-flash" });
        const result = await withTimeout(
          model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 20, temperature: 0.4 },
          }),
          GIF_TIMEOUT_MS,
        );
        text = result.response.text().trim();
      } else {
        const client = getOpenAIClient(cfg.keyValue, cfg.baseUrl);
        const completion = await withTimeout(
          client.chat.completions.create({
            model: cfg.model,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 20,
            temperature: 0.4,
          }),
          GIF_TIMEOUT_MS,
        );
        text = completion.choices[0]?.message?.content?.trim() ?? "";
      }

      // Sanitise: keep only the first line, strip quotes and punctuation
      const cleaned = text.split("\n")[0]!.replace(/['".,!?]/g, "").trim();
      if (cleaned.length > 0 && cleaned.length < 80) {
        logger.debug({ query: cleaned, provider: cfg.provider }, "GIF query generated by AI");
        return cleaned;
      }
    } catch {
      // Ignore errors — caller will fall back to regex approach
    }
  }
  return null;
}

export async function generateAIReply(userMessage: string, matchedRule: Rule | null, conversationHistory: Array<{ role: "user" | "model"; parts: string }>, botPersonality: string, providers: AiProviderConfig[], userProfile?: UserProfileContext): Promise<string> {
  const active = providers.filter((p) => p.keyValue);
  if (active.length === 0) {
    if (matchedRule) return matchedRule.response;
    return "AI provider belum dikonfigurasi. Atur di dashboard → Kredensial.";
  }

  const now = new Date();
  const dateTimeInfo = `Waktu sekarang: ${now.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })} WIB (UTC+7).`;

  let systemPrompt = botPersonality || `Kamu adalah asisten bot Discord yang ramah dan helpful. Balas pesan dengan natural, singkat, dan santai seperti orang sungguhan. Gunakan bahasa yang sama dengan pengguna (Indonesia atau Inggris). Jangan terlalu formal.`;
  systemPrompt += `\n\n${dateTimeInfo}`;

  if (userProfile) {
    const parts: string[] = [];
    if (userProfile.nickname) parts.push(`Panggil mereka "${userProfile.nickname}"`);
    if (userProfile.interests) parts.push(`Minat: ${userProfile.interests}`);
    if (userProfile.communicationStyle) parts.push(`Gaya bicara mereka: ${userProfile.communicationStyle} — sesuaikan gayamu`);
    if (userProfile.summary) parts.push(`Catatan: ${userProfile.summary}`);
    if (userProfile.messageCount && userProfile.messageCount > 1) parts.push(`Ini pesan ke-${userProfile.messageCount} mereka — anggap sudah kenal`);
    if (parts.length > 0) systemPrompt += `\n\nProfil pengguna ini:\n${parts.join("\n")}`;
  }

  if (matchedRule) systemPrompt += `\n\nPanduan respons untuk topik ini: "${matchedRule.response}"\nGunakan panduan sebagai dasar, ekspresikan dengan kata-katamu sendiri.`;

  const rawHistory = conversationHistory.slice(-10).map((h) => ({ role: h.role, parts: [{ text: h.parts }] }));
  let startIdx = 0;
  while (startIdx < rawHistory.length && rawHistory[startIdx].role !== "user") startIdx++;
  const history: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];
  let expectedRole: "user" | "model" = "user";
  for (let i = startIdx; i < rawHistory.length; i++) {
    if (rawHistory[i].role === expectedRole) {
      history.push(rawHistory[i] as { role: "user" | "model"; parts: Array<{ text: string }> });
      expectedRole = expectedRole === "user" ? "model" : "user";
    }
  }

  let allRateLimited = true;
  let anyTried = false;

  for (const cfg of active) {
    if (isBlocked(cfg.id)) {
      const until = circuitBreaker.get(cfg.id)!;
      const secsLeft = Math.ceil((until - Date.now()) / 1000);
      logger.debug({ provider: cfg.provider, model: cfg.model, id: cfg.id, secsLeft }, "AI provider skipped (circuit breaker)");
      continue;
    }

    anyTried = true;
    try {
      let text: string;
      if (cfg.provider === "gemini") text = await generateWithGemini(cfg, userMessage, history, systemPrompt);
      else text = await generateWithOpenAI(cfg, userMessage, history, systemPrompt);

      if (text) {
        allRateLimited = false;
        logger.info({ provider: cfg.provider, model: cfg.model, id: cfg.id }, "AI reply generated");
        return text;
      }
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      const message = (err as { message?: string }).message ?? String(err);
      const isRateLimit = status === 429;

      if (isRateLimit) {
        const retryMs = extractRetryMs(err);
        blockProvider(cfg.id, retryMs);
        logger.warn({ provider: cfg.provider, model: cfg.model, id: cfg.id, status, retryInSecs: Math.ceil(retryMs / 1000) }, "AI provider rate-limited");
      } else {
        allRateLimited = false;
        logger.warn({ provider: cfg.provider, model: cfg.model, id: cfg.id, status, message }, "AI provider failed");
      }
    }
  }

  if (matchedRule) return matchedRule.response;
  if (!anyTried && active.length > 0) {
    const soonestUntil = Math.min(...active.map((p) => circuitBreaker.get(p.id) ?? 0));
    const secsLeft = Math.max(0, Math.ceil((soonestUntil - Date.now()) / 1000));
    return `⏳ API sedang kena rate limit. Coba lagi dalam ~${secsLeft} detik.`;
  }
  if (allRateLimited) return "⏳ Semua API key sedang kena rate limit. Tambahkan provider lain di dashboard → Kredensial.";
  return "Maaf, AI sedang tidak tersedia. Coba lagi nanti.";
}
