import { Router as ExpressRouter } from 'express';
import { healthRouter } from './health.js';
import { AuthRouter } from '../modules/auth/auth.router.js';

const apiRouter = ExpressRouter();

apiRouter.use('/health', healthRouter);
apiRouter.use(new AuthRouter().router);

export { apiRouter };
