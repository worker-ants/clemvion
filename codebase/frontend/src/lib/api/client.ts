import axios from "axios";
import { getCurrentWorkspaceId } from "@/lib/stores/workspace-store";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
  // Serialize array params as repeated keys (`?foo=a&foo=b`) instead of axios
  // v1's default bracket form (`?foo[]=a&foo[]=b`). Express's default query
  // parser ("simple" / Node `querystring`) only recognizes the repeated form,
  // and our global ValidationPipe runs with `forbidNonWhitelisted: true`,
  // which would reject the bracketed key name.
  paramsSerializer: {
    serialize: (params) => {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          for (const entry of value) {
            if (entry !== undefined && entry !== null) {
              search.append(key, String(entry));
            }
          }
        } else {
          search.append(key, String(value));
        }
      }
      return search.toString();
    },
  },
});

// Access token stored in memory (not localStorage/sessionStorage for security)
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// Request interceptor: attach access token + current workspace id
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const workspaceId = getCurrentWorkspaceId();
  if (workspaceId && !config.headers["X-Workspace-Id"]) {
    config.headers["X-Workspace-Id"] = workspaceId;
  }
  return config;
});

// Shared refresh promise to prevent concurrent refresh calls
let refreshPromise: Promise<string | null> | null = null;

// Flag to suppress interceptor refresh/redirect during session restore
let sessionRestoreInProgress = false;

export function setSessionRestoreInProgress(value: boolean) {
  sessionRestoreInProgress = value;
}

async function doRefresh(): Promise<string | null> {
  const { data } = await apiClient.post("/auth/refresh");
  const newToken = data.data?.accessToken;
  if (newToken) {
    setAccessToken(newToken);
    return newToken;
  }
  return null;
}

// Shared refresh entry point — deduplicates concurrent calls from AuthProvider and interceptor
export function refreshAccessToken(): Promise<string | null> {
  // DEBUG: Remove after verifying
  console.log("[DEBUG refreshAccessToken]", {
    hasExistingPromise: !!refreshPromise,
    caller: new Error().stack?.split("\n")[2]?.trim(),
  });
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * Carousel disabled stuck 버그 fix — WS auth race 차단.
 *
 * `getAccessToken()` 은 **현재 메모리의 token 을 즉시 반환** 하지만, AuthProvider
 * 가 session restore 중이거나 401 interceptor 가 refresh 중인 시점에는 stale
 * token 일 수 있다. WS `client.connect(token)` 직전 본 함수를 호출하면:
 *   - pending refresh 가 있으면 await 후 fresh token 반환
 *   - 없으면 즉시 현재 token 반환 (overhead 0)
 *
 * 이로써 WS 가 stale token 으로 connect → backend 401 reject → 영구 실패하는
 * race window 를 차단한다. 일반 axios 호출은 401 interceptor 로 자동 retry
 * 되지만 WS 는 그 메커니즘이 없으므로 connect 직전 보호 필요.
 */
export async function ensureFreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    // refresh 진행 중 — 그 결과를 await. doRefresh 가 setAccessToken 으로
    // 메모리에 새 token 저장하므로 await 후 getAccessToken 이 fresh 반환.
    await refreshPromise;
  }
  return getAccessToken();
}

// Response interceptor: handle 401 and auto-refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/") &&
      !sessionRestoreInProgress
    ) {
      originalRequest._retry = true;

      try {
        const newToken = await refreshAccessToken();
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
      } catch {
        // Error already handled in doRefresh catch chain
      }
    }

    return Promise.reject(error);
  },
);
