import { createContext, useContext } from 'react';
import type { Task, TaskStatus } from '@/lib/types';

export interface BoardDnd {
  dragging: Task | null;
  startDrag: (task: Task) => void;
  endDrag: () => void;
  canDrop: (status: TaskStatus) => boolean;
}

export const BoardDndCtx = createContext<BoardDnd | null>(null);

export function useBoardDnd(): BoardDnd {
  const ctx = useContext(BoardDndCtx);
  if (!ctx) throw new Error('useBoardDnd must be used within a BoardDndProvider');
  return ctx;
}
