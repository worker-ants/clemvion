// 자매 leaf util — `terminal-error-payload.ts` 와 같은 층이다. 둘 다
// `sanitize-error-message` 하나만 import 하므로 #1175 가 해소한 ES-module 순환
// (ws.service↔gateway↔event-emitter)에 재유입하지 않는다.
import { deepRedactSecrets } from './sanitize-error-message';

/**
 * DB `Execution.error` **컬럼 값**을 응답으로 내보내기 직전에 마스킹한다. 형태는 보존한다.
 *
 * > **`ExecutionError` 예외 클래스와 무관하다** (`execution-engine/workflow-errors.ts`).
 * > 그쪽은 제어흐름(`instanceof` 로 분기하는 typed 예외 계층)이고 이쪽은 데이터(JSONB 컬럼
 * > 값)다. 이름이 겹치지 않게 고른 이유가 그것이다 — 초안의 `redactExecutionErrorValue` 는
 * > 클래스명을 온전한 부분 문자열로 포함했다(`16_03_57` naming W1).
 *
 * ## 왜 필요한가 — 같은 컬럼을 표면마다 다르게 말하고 있었다
 *
 * #1177 이 종결 emit 경로(`execution.failed` → WS/SSE/outbound webhook)에
 * `toTerminalErrorPayload` → `deepRedactSecrets` 를 넣었다. 그런데 **읽기 경로**는 그대로
 * 원문이었다 — 내부 REST 4표면과 WS `execution.snapshot` 이다. 즉 같은 소켓에서
 * `execution.failed` 는 마스킹된 값을, `execution.snapshot` 은 원문을 보냈다.
 *
 * 노출 대상이 좁지도 않다 — `GET /api/executions/:id` 에는 `@Roles` 게이트가 없어
 * **viewer 를 포함한 워크스페이스 멤버 전원**이 조회하고, 프런트는 실패 배너에
 * `error.message` 를 그대로 렌더한다.
 *
 * 근거는 [실행 내역 R-5](../../../../../spec/2-navigation/14-execution-history.md) 의 원칙
 * *"안전성은 롤 게이팅이 아니라 서버 boundary masking parity 에 의존"* 이다.
 * **다만 R-5 의 직접 대상은 Config 탭**(write 시점 `maskSensitiveFields`)이라 이 필드를 이미
 * 규정하고 있지는 않다 — 원칙을 원용한 것이지 기존 판정을 인용한 것이 아니다.
 *
 * ## 왜 `toTerminalErrorPayload` 를 쓰지 않나
 *
 * 그 함수는 EIA §6.4 **wire 형태**(`{code, message, nodeId, details?}`)로 **정규화**한다.
 * 내부 응답에 쓰면 값 마스킹이 아니라 **응답 계약 변경**이 되고 프런트가 읽는 형태가 바뀐다.
 * 이번 결정은 *"값을 마스킹"* 이지 *"형태 통일"* 이 아니므로 입력 형태를 그대로 보존한다.
 *
 * ## 보장의 경계 (넓게 쓰지 않는다)
 *
 * `deepRedactSecrets` 의 `SECRET_LEAK_PATTERNS` 는 **자격증명**을 겨냥한다. 무수정 프로브 실측:
 *
 * | 입력 `message` | 결과 |
 * |---|---|
 * | `postgres://u:pw@db.internal/prod` | `postgres://***@db.internal/prod` |
 * | `auth failed: Bearer sk-live-…` | `auth failed: ***` |
 * | `postgres://db.internal:5432/prod` (자격증명 없음) | **무변화** |
 * | `Node "Send Email" failed` | **무변화** |
 *
 * 마지막 두 행이 이 함수의 성격이다 — 자격증명 **없는** 연결 문자열·내부 호스트명·스택
 * 프래그먼트는 통과하고(별건: shared SoT 승격), 평범한 에러 메시지는 손상되지 않는다.
 *
 * **DB 는 원문을 보존한다** (§R17 egress-only 원칙). 서버 로그·사후 디버깅의 진실은 그대로다.
 *
 * @param err DB 의 `Execution.error` 값. jsonb 라 레거시 문자열·숫자가 들어와도 `deepRedactSecrets`
 *   가 타입을 보존하며 통과시킨다.
 * @returns 마스킹된 **복사본**. 바뀐 것이 없으면 `deepRedactSecrets` 의 copy-on-change 가
 *   같은 참조를 돌려주므로 입력은 변이되지 않는다. 입력이 없으면 `null`.
 */
export function redactStoredErrorForResponse(
  err: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (err === null || err === undefined) return null;
  // `deepRedactSecrets` 는 `unknown` 을 돌려주지만 형태를 보존하므로 입력 타입 그대로다.
  // 단언을 **이 한 자리**에 모은다 — 호출부 4곳에 흩으면 한 곳이 다른 캐스트를 쓴다.
  return deepRedactSecrets(err) as Record<string, unknown>;
}
