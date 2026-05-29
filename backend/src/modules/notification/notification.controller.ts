import type { Request, Response } from 'express';
import { addClient } from '../../realtime/taskEvents.js';

const HEARTBEAT_MS = 25_000;

export class NotificationController {
  stream = (req: Request, res: Response): void => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const userId = req.user!.sub;
    res.write(`event: connected\ndata: ${JSON.stringify({ userId })}\n\n`);

    const remove = addClient(userId, res);
    const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);

    req.on('close', () => {
      clearInterval(heartbeat);
      remove();
    });
  };
}
