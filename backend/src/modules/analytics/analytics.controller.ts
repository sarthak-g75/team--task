import type { Request, Response } from 'express';
import { getAnalyticsOverview } from './analytics.service.js';

export class AnalyticsController {
  overview = async (_req: Request, res: Response): Promise<void> => {
    const data = await getAnalyticsOverview();
    res.status(200).json({ status: 200, data });
  };
}
