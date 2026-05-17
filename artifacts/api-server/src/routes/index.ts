import { Router, type IRouter } from "express";
import healthRouter from "./health";
import waitlistRouter from "./waitlist";
import explainRouter from "./explain";

const router: IRouter = Router();

router.use(healthRouter);
router.use(waitlistRouter);
router.use(explainRouter);

export default router;
