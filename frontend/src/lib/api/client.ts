import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
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

// Request interceptor: attach access token
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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
