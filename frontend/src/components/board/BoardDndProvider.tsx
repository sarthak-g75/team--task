import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { TRANSITIONS } from '@/lib/types';
import type { Task } from '@/lib/types';
import { BoardDndCtx } from './dndContext';
import type { BoardDnd } from './dndContext';

export function BoardDndProvider({ children }: { children: ReactNode }) {
  const [dragging, setDragging] = useState<Task | null>(null);

  const value = useMemo<BoardDnd>(
    () => ({
      dragging,
      startDrag: setDragging,
      endDrag: () => setDragging(null),
      canDrop: (status) => !!dragging && TRANSITIONS[dragging.status].includes(status),
    }),
    [dragging],
  );

  return <BoardDndCtx.Provider value={value}>{children}</BoardDndCtx.Provider>;
}
