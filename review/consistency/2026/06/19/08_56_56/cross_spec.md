# Cross-Spec 일관성 검토 결과

**Target**: `spec/4-nodes/3-ai/` (0-common.md, 1-ai-agent.md, 3-information-extractor.md)
**범위**: `--impl-done`, diff-base=origin/main
**검토 일시**: 2026-06-19

---

## 발견사항

- **[WARNING]** `LlmCallRecord.startedAt`/`finishedAt` 필드가 AI 노드 spec 에 미반영
  - target 위치: `spec/4-nodes/3-ai/0-common.md §6 (토큰 회계 meta)` 및 `spec/4-nodes/3-ai/1-ai-agent.md §8 (디버그 데이터 meta.turnDebug)`
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md §4.4` (`llmCalls[].startedAt`, `llmCalls[].finishedAt` ISO8601 필드 정의 + Rationale "요소별 절대 발생 시각 노출") + `codebase/backend/src/shared/llm-tracing/llm-call-record.ts` (구현 실제 shape)
  - 상세: `0-common.md §6` 의 `meta.turnDebug` 열 설명은 `[{ turnIndex, llmCalls, totalDurationMs, toolCalls?, ragSources?, ragDiagnostics? }, ...]` 로 기술하는데, 신설된 canonical `LlmCallRecord` 인터페이스는 `startedAt?`/`finishedAt?` 를 포함한다. WS spec §4.4 는 이 두 필드를 명시적으로 정의하고 Rationale 에서 결정을 기록했으나, AI 노드 spec 의 turnDebug 필드 목록에는 반영되지 않았다. `1-ai-agent.md §8` 의 JSON 예시도 `llmCalls[].startedAt`/`finishedAt` 를 포함하지 않아 spec-to-spec 동기화가 지연된 상태다.
  - 제안: `0-common.md §6` 의 `meta.turnDebug` 설명에 `llmCalls[i].{startedAt?: string, finishedAt?: string}` 추가 명시. `1-ai-agent.md §8` JSON 예시에도 `startedAt`/`finishedAt` 를 optional 필드로 추가. `spec/5-system/6-websocket-protocol.md §4.4` 는 이미 정확하므로 변경 불필요.

- **[WARNING]** `TurnDebugEntry` 인터페이스의 turn-level 진단 필드(`toolCalls?`/`ragSources?`/`ragDiagnostics?`/`mcpDiagnostics?`) 미포함 — spec vs 공유 타입 drift
  - target 위치: `spec/4-nodes/3-ai/0-common.md §6` (`meta.turnDebug` 설명에 `toolCalls?` 포함), `spec/4-nodes/3-ai/1-ai-agent.md §8` (JSON 예시에 `toolCalls[]`/`ragSources`/`ragDiagnostics` 포함)
  - 충돌 대상: `codebase/backend/src/shared/llm-tracing/llm-call-record.ts` — `TurnDebugEntry` 인터페이스가 `turnIndex`, `llmCalls?`, `totalDurationMs?` 세 필드만 정의하며 `toolCalls?`/`ragSources?`/`ragDiagnostics?`/`mcpDiagnostics?` 를 포함하지 않음
  - 상세: spec 의 `meta.turnDebug[i]` shape 는 진단 필드들을 포함하는 확장 형태인데, canonical `TurnDebugEntry` 는 이를 정의하지 않는다. 실제 런타임 생성 코드(`ai-agent.handler.ts`, `ai-conversation-helpers.ts`)는 이 필드들을 포함한 객체를 생성하므로 동작은 정상이나, 공유 canonical 타입이 spec 의 전체 shape 를 표현하지 않는 불완전 상태다. `TurnDebugEntry` 는 "all-optional superset" 을 표방하나 spec 이 정의한 turn-level 진단 필드들이 누락되어 있다.
  - 제안: `codebase/backend/src/shared/llm-tracing/llm-call-record.ts` 의 `TurnDebugEntry` 에 `toolCalls?: ToolCallTrace[]`, `ragSources?: unknown[]`, `ragDiagnostics?: unknown`, `mcpDiagnostics?: unknown` 을 optional 로 추가. 이는 spec 변경 없이 코드 측 수정으로 해결 가능하며, `ToolCallTrace` 는 `ai-agent.handler.ts` 의 exported interface 를 shared 로 이동하거나 공용 참조로 전환.

- **[INFO]** `llm-call-record.ts` 의 SoT 주석이 WS spec 만 참조 — AI 노드 spec 영속 경로 SoT 연결 누락
  - target 위치: `codebase/backend/src/shared/llm-tracing/llm-call-record.ts` 파일 헤더 (`SoT: spec/5-system/6-websocket-protocol.md §4.4`)
  - 충돌 대상: `spec/4-nodes/3-ai/0-common.md §6`, `spec/4-nodes/3-ai/1-ai-agent.md §8` — 두 spec 도 동일 shape 의 JSONB 영속 경로 SoT 임
  - 상세: WS spec §4.4 는 wire format SoT 이고, AI 노드 spec §6/§8 은 `meta.turnDebug` JSONB 영속 shape 의 SoT 다. 현 헤더는 WS spec 만 참조하여 영속 경로 SoT 가 암시적으로 누락된다. 런타임 동작에 영향 없는 문서 불완전 문제.
  - 제안: `llm-call-record.ts` 헤더 주석에 `spec/4-nodes/3-ai/0-common.md §6` 및 `spec/4-nodes/3-ai/1-ai-agent.md §8` 을 병기.

- **[INFO]** `ai-agent.handler.ts` inline llmCalls 타입과 `LlmCallRecord` 의 의도적 분리 — 유지보수 note 부재
  - target 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` L1489-1493 (inline 타입: `requestPayload: unknown; responsePayload: unknown; durationMs: number; startedAt?: string; finishedAt?: string;`)
  - 충돌 대상: `codebase/backend/src/shared/llm-tracing/llm-call-record.ts` (`LlmCallRecord` — 동일 필드이나 전부 optional)
  - 상세: 커밋 메시지가 "의도적" 분리임을 명시했으나 코드에 그 근거가 주석으로 남아 있지 않다. 향후 `LlmCallRecord` 확장 시 `ai-agent.handler.ts` 의 inline 타입을 별도로 갱신해야 하는 drift 위험이 잠재한다.
  - 제안: `ai-agent.handler.ts` 의 inline 타입 위 주석에 "intentional stricter local subtype of `LlmCallRecord`; keep in sync with `shared/llm-tracing/llm-call-record.ts`" 를 추가.

---

## 요약

`spec/4-nodes/3-ai/` target 문서는 다른 spec 영역과 직접적인 CRITICAL 모순을 가지지 않는다. 주요 cross-spec 발견은 두 가지 WARNING 이다: (1) WS spec §4.4 에 이미 정의된 `llmCalls[].startedAt`/`finishedAt` 필드가 AI 노드 spec (`0-common.md §6`, `1-ai-agent.md §8`) 에 아직 미반영되어 spec-to-spec 동기화가 지연된 상태이며, (2) 신설된 canonical `TurnDebugEntry` 가 spec 이 정의한 turn-level 진단 필드(`toolCalls?`, `ragSources?`, `ragDiagnostics?`, `mcpDiagnostics?`)를 포함하지 않아 타입 정의가 실제 런타임 shape 보다 좁다. 두 WARNING 모두 런타임 동작 및 DB 직렬화에 영향 없는 spec 문서/타입 정의 동기화 문제로, 기존 spec 영역이 작동 불가해지는 CRITICAL 수준 모순은 없다.

---

## 위험도

LOW
