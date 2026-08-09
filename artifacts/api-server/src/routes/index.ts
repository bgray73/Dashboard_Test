import { Router, type IRouter } from "express";
import healthRouter from "./health";
import labopsRouter from "./labops";

const router: IRouter = Router();

router.use(healthRouter);
router.use(labopsRouter);

export default router;
