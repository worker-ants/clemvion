// 새로고침 세션 지속 (N1=복원). SoT: spec/7-channel-web-chat/1-widget-app §3.1, 3-auth-session §3.
// executionId + 단명 토큰을 iframe-origin storage 에 저장 → 재로드 시 GET /:id + SSE 재연결로 복원.
// 토큰 만료/410 이면 자연 종료([ended]).

import type { InteractionEndpoints } from "./eia-types";

export interface PersistedSession {
  executionId: string;
  token: string;
  expiresAt: string;
  endpoints: InteractionEndpoints;
}

const KEY_PREFIX = "clemvion-web-chat:session:";

function key(triggerEndpointPath: string): string {
  return KEY_PREFIX + triggerEndpointPath;
}

function getStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null; // sandbox/3rd-party storage 차단 시 graceful.
  }
}

export function saveSession(
  triggerEndpointPath: string,
  session: PersistedSession,
  storage?: Storage,
): void {
  const s = getStorage(storage);
  if (!s) return;
  try {
    s.setItem(key(triggerEndpointPath), JSON.stringify(session));
  } catch {
    /* quota/차단 무시 */
  }
}

export function loadSession(
  triggerEndpointPath: string,
  storage?: Storage,
): PersistedSession | null {
  const s = getStorage(storage);
  if (!s) return null;
  const raw = s.getItem(key(triggerEndpointPath));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedSession;
    if (!parsed?.executionId || !parsed?.token) return null;
    // 만료 토큰은 복원 불가 → 폐기.
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() <= Date.now()) {
      clearSession(triggerEndpointPath, storage);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession(triggerEndpointPath: string, storage?: Storage): void {
  const s = getStorage(storage);
  if (!s) return;
  try {
    s.removeItem(key(triggerEndpointPath));
  } catch {
    /* 무시 */
  }
}
