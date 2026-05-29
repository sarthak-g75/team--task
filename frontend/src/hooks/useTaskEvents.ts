import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/lib/api';
import { useAuth } from '@/stores/auth';

export interface TaskStatusEvent {
  taskId: string;
  title: string;
  from: string;
  to: string;
  projectId: string;
}

export function useTaskEvents() {
  const token = useAuth((s) => s.accessToken);
  const qc = useQueryClient();
  const [lastEvent, setLastEvent] = useState<TaskStatusEvent | null>(null);

  useEffect(() => {
    if (!token) return;

    const source = new EventSource(
      `${API_URL}/notifications/stream?access_token=${encodeURIComponent(token)}`,
    );

    source.addEventListener('task.status', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as TaskStatusEvent;
        setLastEvent(data);
        void qc.invalidateQueries({ queryKey: ['tasks'] });
      } catch {
        setLastEvent(null);
      }
    });

    return () => source.close();
  }, [token, qc]);

  return lastEvent;
}
