// 자매 leaf util — `sanitize-error-message.ts` 는 import 0줄이라 이 import 가 어떤 순환에도
// 참여하지 않는다(#1175 가 해소한 ES-module 순환에 재유입하지 않는다 — 실측 확인).
import { deepRedactSecrets } from './sanitize-error-message';

/**
 * `execution.failed` 의 `error` 를 **EIA §6.4 wire 형태**로 정규화하고 **secret 을 마스킹**한다.
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
/**
 * `message`·`details` 의 값-embedded secret 을 마스킹한다.
 *
 * ## 왜 여기인가 — **egress 초크포인트**
 *
 * `message` 의 출처는 `err instanceof Error ? err.message : String(err)` 로, **임의 내부 예외
 * 메시지 원문**이다. 이 payload 는 WS 뿐 아니라 SSE 스트림과 EIA outbound webhook 으로
 * **외부 제3자**에게 나간다. WS 경로의 `sanitizePayloadForWs` 는 **키 이름** 기반이라 자유
 * 텍스트 *안에* 박힌 토큰(`Bearer …`, 연결 문자열)을 못 잡는다 —
 * `sanitize-error-message.ts` 가 스스로 적어 둔 사실이다.
 *
 * 마스킹을 **DB write 시점에 걸지 않는 이유**는 EIA §R17 의 egress-only masking 원칙이고,
 * `spec-sync-external-interaction-api-gaps.md` 의 등재 항목(`22_55_51` security W2)이 이미
 * *"`toTerminalErrorPayload` 내부 또는 fanout 경계"* 를 처방했다. DB 원본은 서버 로그·디버깅용
 * 으로 보존된다.
 *
 * 이 함수가 자리로 옳은 이유는 **호출부 5곳이 전부 emit 쪽**이라는 것이다(DB write 0). 새 종결
 * emit 경로가 생겨도 형태를 얻으려면 여기를 거치므로 마스킹이 **구조적으로** 빠질 수 없다 —
 * "한 곳만 빠뜨린다" 가 이 저장소의 반복 실패 형태다.
 *
 * `code`(enum 문자열)·`nodeId`(uuid)는 대상이 아니다 — 자유 텍스트가 아니라 값 공간이 닫혀 있다.
 *
 * **여기엔 copy-on-change 조기 반환을 두지 않는다.** 처음엔 "바뀐 게 없으면 같은 객체를
 * 돌려준다" 를 넣었는데, 호출부가 이미 매번 새 payload 를 만들어 넘기므로 그 분기가 아끼는
 * 것은 spread 한 번뿐이고 **바깥에서 관측할 방법이 없다** — 실제로 그 분기를 무력화한
 * 뮤턴트가 23/23 GREEN 으로 살아남았다. 관측 불가능한 분기는 영원히 검증되지 않으므로
 * 지웠다. (`details` 의 참조 보존은 {@link deepRedactSecrets} 자신의 copy-on-change 가
 * 담당하고, 그건 관측 가능해서 테스트가 있다.)
 */
function redactTerminalError(p: TerminalErrorPayload): TerminalErrorPayload {
  return {
    ...p,
    message: deepRedactSecrets(p.message) as string,
    ...(p.details === undefined
      ? {}
      : { details: deepRedactSecrets(p.details) }),
  };
}

export function toTerminalErrorPayload(
  err: unknown,
): TerminalErrorPayload | null {
  if (err === null || err === undefined) return null;

  // 레거시 방어 — 이 PR 이전의 emit 은 문자열이었다. DB 에 남은 row 나 아직 못 찾은
  // 경로가 있어도 wire 형태가 깨지지 않게 흡수한다.
  if (typeof err === 'string') {
    return redactTerminalError({ code: null, message: err, nodeId: null });
  }
  // jsonb 컬럼이라 숫자·불리언이 들어올 수 있다. (마스킹은 no-op 이지만 **모든 반환을 같은
  // 문을 통과시켜** 새 분기가 생겼을 때 한 갈래만 빠지는 일을 막는다.)
  if (
    typeof err === 'number' ||
    typeof err === 'boolean' ||
    typeof err === 'bigint'
  ) {
    return redactTerminalError({
      code: null,
      message: String(err),
      nodeId: null,
    });
  }
  // symbol·function 은 JSON 에 존재할 수 없으므로 여기 도달하지 않는다. 도달하더라도
  // 표현할 message 가 없다 — `String()` 으로 `[object Object]` 류를 만들지 않는다.
  if (typeof err !== 'object') {
    return redactTerminalError({ code: null, message: '', nodeId: null });
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
  return redactTerminalError(out);
}
