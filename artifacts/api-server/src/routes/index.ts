import { Router, type IRouter } from "express";
import healthRouter from "./health";
import waitlistRouter from "./waitlist";
import explainRouter from "./explain";
import ocrRouter from "./ocr";

const router: IRouter = Router();

router.use(healthRouter);
router.use(waitlistRouter);
router.use(explainRouter);
router.use(ocrRouter);

export default router;
