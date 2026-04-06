import { Router, type IRouter } from "express";
import healthRouter from "./health";
import hadithRouter from "./hadith";
import authRouter from "./auth";
import contactRouter from "./contact";
import referralRouter from "./referral";
import redeemRouter from "./redeem";
import adminRouter from "./admin";
import contentRouter from "./content";

const router: IRouter = Router();

router.use(healthRouter);
router.use(hadithRouter);
router.use(authRouter);
router.use(contactRouter);
router.use(referralRouter);
router.use(redeemRouter);
router.use(adminRouter);
router.use(contentRouter);

export default router;
