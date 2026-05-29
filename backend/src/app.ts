import express from 'express';
import type { RequestHandler } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { rateLimit } from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { requestId } from './middleware/requestId.middleware.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { apiRouter } from './routes/index.js';
import { openapiSpec } from './docs/openapi.js';

const mw = (fn: unknown) => fn as RequestHandler;

const app = express();

app.get('/api/openapi.json', (_req, res) => res.json(openapiSpec));
app.use('/api/docs', mw(swaggerUi.serve), mw(swaggerUi.setup(openapiSpec, { customSiteTitle: 'Team Task Tracker API' })));

app.use(mw(helmet()));
app.use(
  mw(
    cors({
      origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
      credentials: true,
    }),
  ),
);
app.use(mw(cookieParser()));
app.use(mw(express.json()));
app.use(mw(express.urlencoded({ extended: true })));
app.use(requestId);
app.use(mw(pinoHttp({ logger, quietReqLogger: true })));

app.use(
  '/api/auth',
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 429, code: 'RATE_LIMITED', message: 'Too many requests' },
  }),
);

app.use('/api', apiRouter);

app.use(errorMiddleware);

export { app };
