/**
 * LLM 호출 trace 기록의 canonical 도메인 타입 — AI Agent · Information Extractor ·
 * 기타 LLM 노드가 공유한다. 동일 JSONB 도메인(`meta.turnDebug[]` / `_resumeState
 * .turnDebugHistory[]`)을 노드별로 이름만 다르게 중복 정의하던 것을 단일 진실로
 * 통일한다 (shared/conversation-thread 선례). 행위·DB 직렬화 shape 무변.
 *
 * SoT: spec/5-system/6-websocket-protocol.md §4.4.
 */

/**
 * LLM 호출 1건의 trace 기록 (request / response / latency) — 한 turn 안에서
 * 호출 1건당 1 엔트리. tool 루프가 돌면 한 turn 에 여러 엔트리가 쌓인다.
 *
 * 모든 필드 optional — 핸들러가 채울 수 있는 만큼만 채운다. Information Extractor 는
 * payload / duration 까지, AI Agent 멀티턴 경로는 startedAt / finishedAt 까지 set
 * 한다. all-optional superset 이라 더 좁은(필수 필드를 갖는) 생성 객체도 호환된다.
 */
export interface LlmCallRecord {
  requestPayload?: unknown;
  responsePayload?: unknown;
  durationMs?: number;
  /** ISO8601 — LLM 호출 시작/종료 절대 시각. 디버깅 타임라인의 어시스턴트
   *  발생 시각 표시 출처. AI Agent 멀티턴 경로만 set. */
  startedAt?: string;
  finishedAt?: string;
}

/**
 * `_resumeState.turnDebugHistory` 의 한 turn 엔트리. `totalDurationMs` 는 그 turn
 * 안의 모든 LLM 호출 + tool 호출의 wall-clock 합; `llmCalls[]` 각 항목의
 * `durationMs` 는 호출별 latency.
 */
export interface TurnDebugEntry {
  turnIndex: number;
  llmCalls?: LlmCallRecord[];
  totalDurationMs?: number;
}
