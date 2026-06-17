import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import botRouter from "./bot";
import rulesRouter from "./rules";
import logsRouter from "./logs";
import settingsRouter from "./settings";
import aiProvidersRouter from "./ai-providers";
import databaseRouter from "./database";
import setupRouter from "./setup";

const router: IRouter = Router();

router.use(healthRouter);
router.use(setupRouter);
router.use(authRouter);
router.use(botRouter);
router.use(rulesRouter);
router.use(logsRouter);
router.use(settingsRouter);
router.use(aiProvidersRouter);
router.use(databaseRouter);

export default router;
