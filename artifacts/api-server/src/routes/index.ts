import { Router, type IRouter } from "express";
import healthRouter from "./health";
import hadithRouter from "./hadith";
import authRouter from "./auth";
import contactRouter from "./contact";
import referralRouter from "./referral";

const router: IRouter = Router();

router.use(healthRouter);
router.use(hadithRouter);
router.use(authRouter);
router.use(contactRouter);
router.use(referralRouter);

export default router;
