/**
 * Typed error 계층 — sub-workflow handler (`workflow.handler.ts`) 가 분기에
 * 사용한다. 본 클래스들이 도입되기 전에는 handler 가 executor 의 throw
 * 메시지를 부분문자열 매칭으로 분류했고, executor 메시지를 무심코 손대면
 * silent regression 으로 모든 NOT_FOUND/TIMEOUT 케이스가 fallback
 * `SUB_WORKFLOW_FAILED` 로 떨어지는 위험이 있었다 (W-17).
 *
 * 이제 핸들러는 `err instanceof WorkflowNotFoundError` 처럼 typed 분기를
 * 1차로 사용하고, 옛 메시지 매칭은 외부 throw 호환을 위한 defensive
 * backstop 으로 보조한다.
 *
 * **메시지 포맷 보존**: 옛 코드를 grep 으로 추적하는 호출자·테스트 (예:
 * `execution-engine.service.spec.ts` 의 `.rejects.toThrow('Workflow not
 * found: ...')`) 가 깨지지 않도록 클래스 `message` 는 옛 throw 와 동일
 * 패턴을 유지한다.
 */

/**
 * Client-safe typed error 기반 — execution-engine 의 client 경계(continuation ack /
 * publisher 동기 응답)에 도달하는 에러의 공통 계약 (spec/5-system/4-execution-engine.md
 * §7.5.2).
 *
 * 계약: `code` 는 안정 client-safe 코드(중앙 `ErrorCode` enum 값 또는 prefix 없는 시스템
 * 레벨 코드), `message`(표준 `Error.message`)는 **고정 client-safe 문자열**(내부 식별자
 * 미포함), `serverDetail` 은 **서버 로그 전용** 진단 상세로 **client 에 절대 노출하지
 * 않는다**.
 *
 * continuation ack 빌더(`websocket.gateway.ts#buildContinuationErrorAck`)는
 * `ExecutionError` 를 `{ error: message, errorCode: code }` 로 surface 하고, 그 외 임의
 * (non-`ExecutionError`) throw 는 고정 generic fallback + `EXECUTION_INTERNAL_ERROR` 로
 * 축약하면서 내부 message 는 서버 로그에만 기록한다 (누출 차단 보안 게이트).
 */
export abstract class ExecutionError extends Error {
  /** 안정 client-safe 코드. */
  abstract readonly code: string;
  /** 서버 로그 전용 진단 상세 — client 응답에 절대 포함하지 않는다. */
  readonly serverDetail?: string;

  protected constructor(message: string, serverDetail?: string) {
    super(message);
    this.serverDetail = serverDetail;
  }
}

/**
 * 대상 워크플로우 정의가 존재하지 않음. `executeInline` / `executeAsync` /
 * `executeSync` / `execute` 의 진입 검증에서 발생.
 */
export class WorkflowNotFoundError extends Error {
  readonly workflowId: string;
  constructor(workflowId: string) {
    super(`Workflow not found: ${workflowId}`);
    this.name = 'WorkflowNotFoundError';
    this.workflowId = workflowId;
  }
}

/**
 * sync 모드 sub-workflow 의 wall-clock timeout 초과. `executeSync` 의
 * `Promise.race` 가 timeout branch 에서 reject 할 때 발생.
 */
export class SubWorkflowTimeoutError extends Error {
  readonly timeoutMs: number;
  constructor(timeoutMs: number) {
    super(`Sub-workflow execution timed out after ${timeoutMs}ms`);
    this.name = 'SubWorkflowTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Phase 2.3 (변경 2.3) — publisher 측 사전 검증 실패 에러.
 *
 * spec/5-system/4-execution-engine.md §7.5.1 — 입력 receiver (controller / WS
 * gateway / EIA) 가 `nodeId → nodeExecutionId` DB lookup 단계에서 다음을 만나면
 * BullMQ enqueue 를 **시도하지 않고** 즉시 client 에 동기 에러를 반환한다.
 *
 * - 매칭 row 0건 — Execution 이 `waiting_for_input` 이 아니거나 nodeId 미일치.
 * - 매칭 row 2건 이상 — invariant 위반 (race / 데이터 손상). logger.warn 후 거부.
 *
 * ack 동기 응답 전용 — worker 측 비동기 실패인 `RESUME_*` (`RehydrationError`)
 * 와 직교한다. surface: WS gateway = ack `errorCode`, REST = 422 `INVALID_STATE`,
 * EIA = 409 `STATE_MISMATCH`.
 *
 * **보안 (review W-5)**: `message` 는 client 에 그대로 노출되므로 내부 식별자
 * (executionId, row 수) 를 담지 않는 고정 문자열이다. 진단용 상세는 `detail`
 * 필드에 담아 throw 측에서 서버 로그로만 기록한다.
 */
export class InvalidExecutionStateError extends ExecutionError {
  readonly code = 'INVALID_EXECUTION_STATE' as const;

  constructor(detail?: string) {
    super('Execution is not waiting for input.', detail);
    this.name = 'InvalidExecutionStateError';
  }

  /** @deprecated since refactor-04-a1 — use {@link serverDetail}; remove after callers migrated (spec §7.5.1). */
  get detail(): string | undefined {
    return this.serverDetail;
  }
}

/**
 * AI Agent multi-turn `execution.retry_last_turn` (spec/5-system/
 * 6-websocket-protocol.md §4.2 / spec/5-system/4-execution-engine.md §1.3) 의
 * retry 진입 검증 실패 에러 계층. `RetryLastTurnError` 의 `code` 가 WS ack 의
 * nested `error: { code, message }` 로 surface 된다 (continuation 명령의 평면
 * `errorCode` 와 다른 계층 — 의도된 분리).
 *
 * **보안**: `message` 는 client 에 노출되므로 내부 식별자를 담지 않는 고정
 * 문자열이다. `InvalidExecutionStateError` 와 동일한 정책.
 *
 * W8: 문자열 이중 정의 제거 — `RetryLastTurnErrorCode` 를 `ErrorCode` 의 retry
 * 코드 3종에서 derive 해 단일 SoT 유지. 런타임 동작 변경 없음.
 */
import { ErrorCode } from '../../nodes/core/error-codes';

export type RetryLastTurnErrorCode =
  | typeof ErrorCode.RETRY_STATE_NOT_FOUND
  | typeof ErrorCode.NODE_NOT_RETRYABLE
  | typeof ErrorCode.RETRY_TOO_EARLY;

export class RetryLastTurnError extends ExecutionError {
  readonly code: RetryLastTurnErrorCode;

  constructor(code: RetryLastTurnErrorCode, message: string, detail?: string) {
    super(message, detail);
    this.code = code;
    this.name = 'RetryLastTurnError';
  }

  /** @deprecated since refactor-04-a1 — use {@link serverDetail}; remove after callers migrated. */
  get detail(): string | undefined {
    return this.serverDetail;
  }

  /** `_retryState` 부재 / 만료 / 이미 소비됨. */
  static notFound(detail?: string): RetryLastTurnError {
    return new RetryLastTurnError(
      ErrorCode.RETRY_STATE_NOT_FOUND,
      'Retry state not found or expired.',
      detail,
    );
  }

  /** 노드가 retryable error 로 종결되지 않음 (`retryable !== true`). */
  static notRetryable(detail?: string): RetryLastTurnError {
    return new RetryLastTurnError(
      ErrorCode.NODE_NOT_RETRYABLE,
      'This node cannot be retried.',
      detail,
    );
  }

  /** `retryAfterSec` 카운트다운 종료 전 호출. */
  static tooEarly(detail?: string): RetryLastTurnError {
    return new RetryLastTurnError(
      ErrorCode.RETRY_TOO_EARLY,
      'Retry requested before the retry-after window elapsed.',
      detail,
    );
  }
}

/**
 * PR2a — 엔진 레벨 active-running 누적 타임아웃 초과 (spec §8).
 *
 * 단일 Execution 의 누적 active 세그먼트 시간이 한도(기본 30분)를 초과하면 dispatch
 * loop 가 본 에러를 throw 한다. run 실패 빌더(`runExecution` / resume)가 본 sentinel
 * 타입을 인지해 `Execution.error.code = EXECUTION_TIME_LIMIT_EXCEEDED` 로 보존한다
 * (임의 Error 의 우발적 `.code` 누수를 막는 `ErrorPortFallbackError` 와 동일 패턴).
 * Code 노드 스크립트 타임아웃 `EXECUTION_TIMEOUT` 과는 별개 — spec §3-error-handling §1.4.
 *
 * W3(ai-review SECURITY) — `.message` 는 고정 문자열만. 누적 ms / 한도 ms 수치는
 * REST API 응답·WS 이벤트에 노출되므로 `activeRunningMs` / `limitMs` 프로퍼티로 분리해
 * 서버 로그 전용으로 기록한다 (`assertActiveTimeWithinLimit` 호출 지점에서 logger.warn).
 */
/**
 * **설계 경계 (I-3, ai-review)**: `ExecutionTimeLimitError` 는 `ExecutionError` 계층
 * 밖(`extends Error`)에 의도적으로 남겨져 있다 — dispatch loop 가 execution 레벨에서
 * throw 하는 sentinel 로, continuation ack (submit_form / submit_message 등) 의 동기
 * 경로에 도달하지 않는다. 해당 경로에 도달하면 `buildContinuationErrorAck` 가 비-typed
 * generic fallback + `EXECUTION_INTERNAL_ERROR` 로 축약하는 보안 게이트를 거친다
 * (누출 없음). `ExecutionError` 로 승격하면 code/message 가 continuation ack 에 직접
 * surface 되므로 현재 구조를 의도적으로 유지한다 (spec §7.5.2).
 */
export class ExecutionTimeLimitError extends Error {
  readonly code = ErrorCode.EXECUTION_TIME_LIMIT_EXCEEDED;
  /** 서버 로그 전용. REST/WS 에 노출하지 않는다. */
  readonly activeRunningMs: number;
  /** 서버 로그 전용. REST/WS 에 노출하지 않는다. */
  readonly limitMs: number;

  /**
   * @param activeRunningMs 누적 active-running 시간(ms). waiting_for_input 제외.
   * @param limitMs 설정된 한도(ms). `resolveMaxActiveRunningMs()` 반환값.
   */
  constructor(activeRunningMs: number, limitMs: number) {
    super(`Execution active-running time limit exceeded.`);
    this.name = 'ExecutionTimeLimitError';
    this.activeRunningMs = activeRunningMs;
    this.limitMs = limitMs;
  }
}

/**
 * `execution.submit_message` 의 사용자 메시지가 최대 길이를 초과 (publisher 측 동기
 * 검증, spec/5-system/4-execution-engine.md §7.5.2). continuation ack 에
 * `errorCode='EXECUTION_MESSAGE_TOO_LONG'` 로 surface 된다.
 *
 * 보안: `message` 는 고정 client-safe 문자열 — 한도/실제 길이 수치는 `serverDetail`(서버
 * 로그 전용)에만 담는다 (`ExecutionTimeLimitError` 의 수치 분리 정책과 동일).
 */
export class MessageTooLongError extends ExecutionError {
  readonly code = ErrorCode.EXECUTION_MESSAGE_TOO_LONG;

  constructor(maxLength: number, actualLength?: number) {
    super(
      'Message exceeds the maximum allowed length.',
      actualLength !== undefined
        ? `length=${actualLength} max=${maxLength}`
        : `max=${maxLength}`,
    );
    this.name = 'MessageTooLongError';
  }
}

/**
 * field-level 검증 에러 응답 body 의 detail item (`details[]`). 두 진입점
 * (executions.controller / interaction.service) 과 `FormValidationError.toHttpDetails()`
 * 가 공유하는 **단일 SoT** — 한쪽만 변경 시 타입 불일치 위험을 제거한다 (W-3).
 * `code` 는 현재 단계 `'INVALID_FIELD'` 단일 값 (`ErrorCode.INVALID_FIELD`).
 */
export interface ValidationDetail {
  field: string;
  message: string;
  /** 현재 단계 단일 값 `'INVALID_FIELD'` (`ErrorCode.INVALID_FIELD`) — 타입 레벨 계약 고정. */
  code: 'INVALID_FIELD';
}

/**
 * `execution.submit_form` 의 제출 데이터가 폼 노드 field 검증(필수 / type / length / 범위 / pattern /
 * 선택지 / file MIME·크기·개수)을 통과하지 못함 (publisher 측 동기 검증 —
 * spec/4-nodes/6-presentation/4-form.md §4·§6.2, spec/5-system/14-external-interaction-api.md §5.1).
 * `assertFormSubmissionValid` 가 `validateScalarField`/`validateFileField` 로
 * **FIRST 오류**만 surface 한다. EIA REST 는 `400 VALIDATION_ERROR` + `details[{field,
 * message, code:'INVALID_FIELD'}]`, WS ack 는 평면 `errorCode='VALIDATION_ERROR'` 로 매핑.
 * publish 전에 throw 되므로 execution 은 `waiting_for_input` 유지(재제출 가능).
 *
 * 보안: `message` 는 검증 규칙 기반 client-safe 문자열(필드 값 자체는 미포함).
 */
export class FormValidationError extends ExecutionError {
  readonly code = ErrorCode.VALIDATION_ERROR;
  /** 오류가 발생한 field 명 — EIA `details[].field`. */
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.field = field;
    this.name = 'FormValidationError';
  }

  /**
   * HTTP 응답 body 형태의 details 배열을 반환 (W-6). 두 진입점(executions.controller /
   * interaction.service) 의 `FormValidationError → BadRequestException` 변환 로직을
   * 단일 SoT 로 일원화해 하나 수정 시 다른 쪽 누락 위험을 제거한다.
   *
   * 반환 타입은 `ReadonlyArray<ValidationDetail>` — 현재 단계 FIRST 오류만 포함
   * (details 배열 길이 항상 1).
   */
  toHttpDetails(): ReadonlyArray<ValidationDetail> {
    return [
      {
        field: this.field,
        message: this.message,
        code: ErrorCode.INVALID_FIELD,
      },
    ];
  }
}
