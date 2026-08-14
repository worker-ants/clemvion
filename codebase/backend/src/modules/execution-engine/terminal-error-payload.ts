/**
 * `execution.failed` 의 `error` 를 **EIA §6.4 wire 형태**로 정규화한다.
 *
 * **현재 호출부는 `EXECUTION_FAILED` 4곳뿐이다.** 시스템 `execution.cancelled`
 * (`emitCancellationEvent` + 호출 5곳)은 아직 `{code, message}` 를 손으로 만들고
 * `nodeId`/`details` 가 없다 — spec §6 표는 둘을 같은 목표 형태로 규정하므로 통일이
 * 맞지만, 취소 경로는 DB write 5곳을 함께 손봐야 해 `durationMs` 와 같은 비용 그룹이다
 * (`eia-terminal-payload.md` 재판정 ③-c). **여기서 "cancelled 도 커버한다" 고 쓰면
 * 문서한 보장이 구현보다 넓어진다** (`22_55_51` architecture W3).
 *
 * SoT: `spec/5-system/14-external-interaction-api.md` §6.4
 * (`{ code: "…"|null, message, nodeId: "uuid"|null, details? }`).
 *
 * ## 왜 헬퍼인가 — 부재 표현이 DB 와 wire 에서 다르다
 *
 * `Execution.error`(DB, `Record<string, unknown>`)는 값이 없으면 **키를 생략**한다:
 *
 * - `failFirstSegmentSetup` → `{ message }`
 * - `finalizeStalledExhausted` → `{ code, message }`
 * - `finalizeFailedExecution` → `{ message, ...(sentinel ? { code } : {}) }`
 * - `failRetryExecution` → `{ message }`
 *
 * 그런데 §6.4 는 **명시적 `null`** 을 요구한다(형제 필드 `nodeId` 와 표현을 통일하기 위해
 * [API 규약 §5.4](../../../../../spec/5-system/2-api-convention.md) 아래 근거와 함께 택일된 결정).
 * 그 변환을 emit 지점마다 손으로 하면 **한 곳씩 빠진다** — 이 저장소의 반복 형태이고,
 * 직전 PR(#1169)이 `llmCalls` strip 을 세 출구에서 하나씩 발견한 것과 같은 클래스다.
 * 그래서 네 emit 지점이 전부 이 함수를 부른다.
 *
 * ## `nodeId` 는 현재 전 경로 `null` 이다
 *
 * 어느 경로도 `Execution.error` 에 `nodeId` 를 쓰지 않는다(리터럴 전수 확인).
 * `spec/1-data-model.md` §2.14 의 *"최초 failed NodeExecution 의 에러 정보를 복사"* 는
 * `nodeId` 에 한해 구현이 없다. §6.4 가 `null` 을 합법으로 선언하므로 계약 위반은 아니고,
 * 채우는 것은 별건이다. 여기서는 **있으면 보존하고 없으면 `null`** 로 둔다.
 */
export interface TerminalErrorPayload {
  code: string | null;
  message: string;
  nodeId: string | null;
  details?: unknown;
}

/**
 * @param err DB 의 `Execution.error` 값. 레거시 문자열·`null`·키 생략 객체를 전부 받는다.
 * @returns §6.4 형태. 입력이 없으면 `null` — **빈 객체를 돌려주지 않는다**(수신자가
 *   "에러가 있는데 내용이 없다" 로 읽는다).
 */
export function toTerminalErrorPayload(
  err: unknown,
): TerminalErrorPayload | null {
  if (err === null || err === undefined) return null;

  // 레거시 방어 — 이 PR 이전의 emit 은 문자열이었다. DB 에 남은 row 나 아직 못 찾은
  // 경로가 있어도 wire 형태가 깨지지 않게 흡수한다.
  if (typeof err === 'string') {
    return { code: null, message: err, nodeId: null };
  }
  // jsonb 컬럼이라 숫자·불리언이 들어올 수 있다.
  if (
    typeof err === 'number' ||
    typeof err === 'boolean' ||
    typeof err === 'bigint'
  ) {
    return { code: null, message: String(err), nodeId: null };
  }
  // symbol·function 은 JSON 에 존재할 수 없으므로 여기 도달하지 않는다. 도달하더라도
  // 표현할 message 가 없다 — `String()` 으로 `[object Object]` 류를 만들지 않는다.
  if (typeof err !== 'object') {
    return { code: null, message: '', nodeId: null };
  }

  const src = err as Record<string, unknown>;
  const out: TerminalErrorPayload = {
    code: typeof src.code === 'string' ? src.code : null,
    message: typeof src.message === 'string' ? src.message : '',
    nodeId: typeof src.nodeId === 'string' ? src.nodeId : null,
  };
  // `details` 는 §6.4 가 optional 로 선언한다 — 없을 때 `undefined` 키를 만들면
  // JSON 직렬화에서 사라지긴 하지만, 객체 비교·스냅샷에서 형태가 갈린다.
  if (src.details !== undefined) out.details = src.details;
  return out;
}
