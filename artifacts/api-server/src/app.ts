import express, { type ErrorRequestHandler, type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import collectorRouter from "./routes/collector";
import { logger } from "./lib/logger";
import type { RuntimeConfig } from "./lib/runtime-config";

export function createApp(config: RuntimeConfig): Express {
  const app: Express = express();
  app.set("trust proxy", config.trustProxy);

  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url?.split("?")[0],
          };
        },
        res(res) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, origin !== undefined && config.corsAllowedOrigins.includes(origin));
      },
    }),
  );
  app.use("/api/collector/v1", express.json({ limit: "16kb" }), collectorRouter);
  app.use(express.json({ limit: config.jsonBodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: config.urlencodedBodyLimit }));

  app.use("/api", router);
  const payloadTooLargeHandler: ErrorRequestHandler = (error, _req, res, next) => {
    if (typeof error === "object" && error !== null && "status" in error && error.status === 413) {
      res.status(413).json({ error: "Payload too large." });
      return;
    }
    next(error);
  };
  app.use(payloadTooLargeHandler);
  return app;
}
