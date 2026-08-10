// 새로고침 세션 지속 (N1=복원). SoT: spec/7-channel-web-chat/1-widget-app §3.1, 3-auth-session §3·§R6.
// executionId + 단명 토큰을 iframe-origin sessionStorage 에 저장 → 재로드 시 GET /:id + SSE 재연결로 복원.
// sessionStorage = 탭 단위(같은 탭 reload 는 유지, 탭 종료 시 자동 소거 → defense-in-depth, 3-auth-session §R6).
// 토큰 만료/410 이면 자연 종료([ended]).

import { stripTrailingSlash } from "./api-base";
import type { InteractionEndpoints } from "./eia-types";

export interface PersistedSession {
  executionId: string;
  token: string;
  expiresAt: string;
  endpoints: InteractionEndpoints;
  /**
   * 이 세션(과 토큰)이 **발급된 apiBase**. 복원 시 현재 apiBase 와 대조해 불일치면 폐기한다.
   *
   * 없으면 안 되는 이유: `applyConfig` 재전송이 apiBase 를 바꾸면 `clientRef` 는 새 apiBase
   * 로 교체되는데 저장 세션은 옛 origin 의 것이다. 이 바인딩이 없으면 **옛 세션의 단명
   * 토큰이 새 origin 으로 전송**될 수 있다(세션과 엔드포인트의 축 분리).
   */
  apiBase: string;
}

const KEY_PREFIX = "clemvion-web-chat:session:";

function key(triggerEndpointPath: string): string {
  return KEY_PREFIX + triggerEndpointPath;
}


function getStorage(storage?: Storage): Storage | null {
  if (storage) return storage;
  try {
    // sessionStorage: 탭 종료 시 자동 소거(단명 토큰 잔존 최소화). 같은 탭 reload 는 유지돼 N1 복원 보존(§R6).
    return typeof sessionStorage !== "undefined" ? sessionStorage : null;
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

/**
 * @param expectedApiBase - **현재** apiBase. 저장 세션의 발급 apiBase 와 다르면 폐기한다.
 *   필수 인자인 것이 의도다 — optional 이면 호출부가 조용히 검사를 건너뛸 수 있고, 그게
 *   바로 이 함수가 막으려는 결함이다.
 */
export function loadSession(
  triggerEndpointPath: string,
  expectedApiBase: string,
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
    // 발급 origin 바인딩. 비교는 **후행 슬래시만** 정규화하고 **경로는 보존**한다 —
    // `apiBase` 는 `/api` 등 경로 포함이 정상이라, 경로까지 지우면 `…/api` 와 `…` 를 같다고
    // 보게 되고 그것이 곧 토큰 오전송이다.
    // ⚠ `app/demo/demo-config.ts` 에 **동명** `normalizeApiBase` 가 있으나 그쪽은 후행 `/api`
    //   **까지 제거**하는 정반대 계약이다(데모 입력 편의용). 두 함수를 "같은 것" 으로 통합하면
    //   이 가드가 무력화된다 — 그래서 여기서는 공용 `stripTrailingSlash` 를 직접 쓴다
    //   (consistency-check 22_35_51 naming_collision CRITICAL).
    // 불일치는 물론, **미기록(본 필드 도입 이전 세션)도 폐기**한다 —
    // 발급 origin 을 증명할 수 없는 세션을 "아마 같겠지" 로 통과시키면 정확히 이 결함이
    // 남는다. 최악의 비용은 새 대화 1회이고, 반대편 비용은 다른 origin 으로의 토큰 유출이다.
    if (
      !parsed.apiBase ||
      stripTrailingSlash(parsed.apiBase) !== stripTrailingSlash(expectedApiBase)
    ) {
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

/**
 * 새 토큰을 세션에 반영하고 storage 에 영속화한다 — **갱신 경로가 둘이라 여기 한 곳에 둔다.**
 *
 * 주기 갱신(`use-token-refresh`)과 `401` 낙관적 복구(`use-widget` 의 `seedWaitingFromStatus`)가
 * 각자 이 4줄을 복제하고 있었다. 오케스트레이션은 합치면 안 된다 — 전자는 `setTimeout` 기반
 * fire-and-forget 이고 성공 시 재귀 재예약까지 하며, 후자는 `catch` 안에서 `await` 로 진행하고
 * 실패하면 세션 종료를 확정한다. 실패 동작이 정반대라 옵션 파라미터로 합치면 결합도만 는다.
 *
 * **그러나 "무엇을 저장하는가" 는 하나여야 한다.** `PersistedSession` 에 필드가 늘거나
 * `saveSession` 시그니처가 바뀌면 두 곳을 각각 고쳐야 했고, 한쪽만 갱신되고 다른 쪽이 stale 로
 * 남는 것이 이 저장소가 반복해 겪은 "자매 함수 미적용" 형태다
 * (ai-review `16_09_40` maintainability).
 *
 * 세대 검사는 **호출부 책임**이다 — 이 함수는 "언제 써도 되는가" 를 모른다.
 */
export function applyRefreshedToken(
  session: PersistedSession,
  refreshed: { token: string; expiresAt: string },
  triggerEndpointPath: string,
): PersistedSession {
  const updated = { ...session, ...refreshed };
  saveSession(triggerEndpointPath, updated);
  return updated;
}
