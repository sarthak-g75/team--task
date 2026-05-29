import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuth } from '@/stores/auth';
import type { ApiErrorBody } from '@/lib/types';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = useAuth.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refreshToken(): Promise<string | null> {
  try {
    const res = await axios.post<{ data: { accessToken: string } }>(
      `${API_URL}/auth/refresh`,
      {},
      { withCredentials: true },
    );
    const token = res.data.data.accessToken;
    useAuth.getState().setToken(token);
    return token;
  } catch {
    useAuth.getState().clear();
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
    const isAuthCall = original?.url?.includes('/auth/');

    if (error.response?.status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true;
      refreshing = refreshing ?? refreshToken();
      const token = await refreshing;
      refreshing = null;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ApiErrorBody | undefined;
    return body?.message ?? error.message ?? fallback;
  }
  return fallback;
}
