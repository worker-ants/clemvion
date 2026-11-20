import type { ConversationItem } from "../stores/execution-store";
import type { ExecutionData } from "../api/executions";

/**
 * 실행 WS 이벤트 payload 를 읽는 순수 헬퍼. `useExecutionEvents` 가 이벤트를 store 에 넣기 전에
 * 값을 거르고 꺼내는 데 쓴다.
 */

/**
 * 스냅샷이 이 실행의 것인지. 같은 소켓으로 앞 실행 채널의 늦은 스냅샷이 올 수 있어서 서버가
 * 싣는 `executionId`(없으면 `execution.id`)로 거른다.
 */
export function isSnapshotFor(
  payload: { executionId?: unknown; execution?: ExecutionData } | null,
  executionId: string,
): boolean {
  return (payload?.executionId ?? payload?.execution?.id) === executionId;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Accept only well-formed UUIDs. Timeline IDs (`nodeExecutionId`,
 * `parentNodeExecutionId`) flow directly into React keys and selection
 * state; a malformed/over-long value from an upstream bug or a malicious
 * payload would otherwise be persisted verbatim.
 */
export function sanitizeUuid(v: unknown): string | undefined {
  return typeof v === "string" && UUID_REGEX.test(v) ? v : undefined;
}

/** 객체(배열 아님)면 레코드로, 아니면 `null`. 아래 중첩 접근을 읽을 만하게 만든다. */
export function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/**
 * 노드 라이프사이클 이벤트의 **구조화 에러**(`{code, message, details?}`)를 꺼낸다.
 * 없으면 `null`.
 *
 * ## 어디에 있나 — 래퍼 한 겹 아래다
 *
 * 이벤트의 `output` 은 `NodeHandlerOutput` **래퍼**(`nodeExec.outputData`)이고 도메인
 * 값은 그 아래 `output` 이다 (CLE-NODE-OUTPUT Principle 0). 그래서 구조화 에러의 자리는
 * **`output.output.error`** 다.
 *
 * top-level `error` 는 **문자열**(message only)이다 — emit 4곳 전수 실측
 * (CLE-API-WS-EVENTS 「`execution.node.failed` 의 `error` 와 `output`」,
 * 2026-08-24 정정). 그래서 이 함수는 `error` 를
 * **보지 않는다**.
 *
 * > **종전 서술이 결함을 낳았다**: ~~*"`error` 또는 `output.error` 중 어디로 오든"*~~ 이라
 * > 적혀 있었고 코드도 그렇게 (a) `error` 를 객체로 파싱하고 (b) `output.error` 를 한 겹
 * > 얕게 봤다. 실제로는 (a) 문자열이라 못 잡고 (b) 래퍼를 못 뚫어 **항상 `null`** 이었다 —
 * > `system_error` 배너가 라이브 WS 에서 한 번도 뜨지 않았다.
 * >
 * > 객체 `error` 를 받던 분기는 **지웠다**. 도달하지 않을 뿐 아니라(호출부 2곳 모두
 * > 문자열/`undefined`), 그 분기가 **이 버그를 낳은 계약을 그대로 인코딩**하고 있었다.
 * > 남겨 두면 다음 사람이 "객체로 보내면 되겠네" 로 읽는다.
 *
 * SoT: CLE-API-WS-EVENTS 「`execution.node.failed` 의 `error` 와 `output`」 ·
 * CLE-NODE-OUTPUT Principle 0
 */
export function extractNodeErrorPayload(rawOutput: unknown): {
  code: string;
  message: string;
  details?: { retryable?: boolean; retryAfterSec?: number; [k: string]: unknown };
} | null {
  const domain = asRecord(rawOutput)?.output;
  const source = asRecord(asRecord(domain)?.error);
  if (!source) return null;
  const code = typeof source.code === "string" ? source.code : null;
  const message = typeof source.message === "string" ? source.message : null;
  if (!code || !message) return null;
  const details =
    source.details && typeof source.details === "object"
      ? (source.details as Record<string, unknown>)
      : undefined;
  return { code, message, details };
}

/**
 * Build a `system_error` ConversationItem from a node lifecycle event's
 * error payload. Applied to the conversation thread when the host node is a
 * multi-turn AI Agent that already accumulated turns (live conversation
 * context — CLE-EXEC-PREVIEW-STORE 「이벤트별 store 변환」).
 *
 * `retryable` defaults to `false` when the LLM provider adapter hasn't
 * classified the error yet — the UI then suppresses the `[다시 시도]`
 * button (CT-S10) so users don't trigger a hopeless retry.
 */
export function makeSystemErrorItem(args: {
  code: string;
  message: string;
  retryable?: boolean;
  retryAfterSec?: number;
  nodeId: string;
  nodeLabel: string;
  nodeExecutionId?: string;
  timestamp?: string;
}): ConversationItem {
  return {
    type: "system_error",
    content: args.message,
    turnIndex: 0,
    systemError: {
      code: args.code,
      message: args.message,
      retryable: args.retryable ?? false,
      retryAfterSec: args.retryAfterSec,
      nodeId: args.nodeId,
      nodeLabel: args.nodeLabel,
      nodeExecutionId: args.nodeExecutionId,
    },
    timestamp: args.timestamp,
  };
}
