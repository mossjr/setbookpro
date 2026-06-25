import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import songsRouter from "./songs";
import tagsRouter from "./tags";
import setsRouter from "./sets";
import ugRouter from "./ug";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(songsRouter);
router.use(tagsRouter);
router.use(setsRouter);
router.use(ugRouter);
router.use(storageRouter);

export default router;
