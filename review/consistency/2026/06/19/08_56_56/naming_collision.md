# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-done` (구현 완료 후, scope=`spec/4-nodes/3-ai/`, diff-base=`origin/main`)

target 변경: `codebase/backend/src/shared/llm-tracing/llm-call-record.ts` 신설 — `LlmCallRecord` (interface) · `TurnDebugEntry` (interface) · 모듈 경로 `shared/llm-tracing/llm-call-record`.

---

## 발견사항

### [WARNING] `TurnDebugEntry` 식별자가 프론트엔드 두 모듈에서 서로 다른 형태로 독립 정의됨

- **target 신규 식별자**: `TurnDebugEntry` — backend `codebase/backend/src/shared/llm-tracing/llm-call-record.ts:33`
  - 필드: `turnIndex: number`, `llmCalls?: LlmCallRecord[]`, `totalDurationMs?: number`
- **기존 사용처 1**: `codebase/frontend/src/components/editor/run-results/output-shape.ts:308`
  - `export interface TurnDebugEntry { turnIndex: number; ragSources: RagSource[]; ragDiagnostics: RagDiagnostics | null; }`
  - 용도: KB 툴 delta + RAG 진단 (turn 단위). `ragSources`/`ragDiagnostics` 가 주 내용.
- **기존 사용처 2**: `codebase/frontend/src/lib/conversation/conversation-utils.ts:360`
  - `interface TurnDebugEntry { turnIndex: number; llmCalls?: LlmCallEntry[]; toolCalls?: TurnToolCallEntry[]; totalDurationMs?: number; requestPayload?: unknown; responsePayload?: unknown; durationMs?: number; }`
  - 용도: 멀티턴 대화 디버그 히스토리 (LLM 호출 + tool 호출 메타).
- **상세**: 세 선언이 각기 다른 모듈에 독립 정의되어 있으며 필드 집합이 모두 다르다. backend 신규 정의는 `llmCalls?: LlmCallRecord[]`를 갖지만 frontend output-shape 정의는 `ragSources`/`ragDiagnostics`를 갖고, frontend conversation-utils 정의는 `toolCalls`, `llmCalls?: LlmCallEntry[]`(LlmCallEntry ≠ LlmCallRecord)를 갖는다. 현재는 TS 컴파일 경계가 backend/frontend 로 분리되어 있어 런타임 충돌은 없지만, 동일 이름이 세 곳에서 다른 형상으로 쓰이는 것은 독자 혼동 및 향후 타입 공유 시도 시 충돌 원인이 될 수 있다. 이 분기 상태는 본 PR 이전부터 존재했다.
- **제안**: (a) 단기: 이미 backend 는 별도 네임스페이스(`shared/llm-tracing`) 안에 있어 직접 충돌은 없으므로 현행 유지 가능. (b) 중기: frontend 두 모듈의 `TurnDebugEntry` 를 용도별로 이름을 구분하거나(`RagTurnDebugEntry` / `LlmTurnDebugEntry`) backend shared 정의와 점진적으로 통합하는 것을 권장.

---

### [INFO] frontend `LlmCallTrace` 와 backend 신규 `LlmCallRecord` 는 유사 역할의 이름 분기

- **target 신규 식별자**: `LlmCallRecord` — `codebase/backend/src/shared/llm-tracing/llm-call-record.ts:18`
  - 필드: `requestPayload?`, `responsePayload?`, `durationMs?`, `startedAt?`, `finishedAt?` (all-optional superset)
- **기존 사용처**: `codebase/frontend/src/components/editor/run-results/llm-call-trace.ts:12`
  - `export interface LlmCallTrace { turnIndex: number; callIndexInTurn: number; requestPayload: unknown; responsePayload: unknown; durationMs?: number; }`
  - 용도: 프론트엔드 UI(Response/Request/LLM Usage 탭)에서 LLM 호출 1건을 표현하는 뷰 타입.
- **상세**: backend `LlmCallRecord` 는 raw 저장형(payload 선택), frontend `LlmCallTrace` 는 UI 소비형(`turnIndex`/`callIndexInTurn` 필수). 역할이 다르고 모듈 경계도 분리되어 있어 실제 충돌은 없다.
- **제안**: 현행 분리 유지 가능. 향후 공유 패키지로 통합 시 이름 통일 방향을 미리 설계하는 것을 권장.

---

### [INFO] 파일 경로 `shared/llm-tracing/` 신설 — 기존 `shared/` 명명 컨벤션에 부합

- **target 신규 경로**: `codebase/backend/src/shared/llm-tracing/llm-call-record.ts`
- **기존 사용처**: `shared/conversation-thread/`, `shared/execution-resume/`, `shared/utils/` — 모두 `shared/<도메인>/` 패턴.
- **상세**: 신규 디렉터리가 기존 패턴과 일치하며 경로 충돌 없음.
- **제안**: 없음. 컨벤션 정합.

---

## 요약

본 PR이 신설하는 식별자는 `LlmCallRecord`, `TurnDebugEntry`, 모듈 경로 `shared/llm-tracing/llm-call-record` 세 가지다. 기존 spec 파일에는 이 이름들의 사용처가 없으며, backend 내부에서도 이전 정의들이 module-private 상태였다가 동일 의미로 통합된 것이므로 의미 충돌은 없다. 주목할 사항은 `TurnDebugEntry` 이름이 frontend 두 모듈(`output-shape.ts`, `conversation-utils.ts`)에서 이미 서로 다른 형상으로 독립 정의되어 있다는 점이나, TS 컴파일 경계가 backend/frontend 로 분리되어 있고 이 분기 상태는 본 PR 이전부터 존재했으므로 즉각 차단 수준이 아니다. `LlmCallRecord`도 frontend `LlmCallTrace`와 유사 역할이지만 경계가 달라 허용 범위다. CRITICAL 이슈는 없으며 WARNING 1건(TurnDebugEntry 다중 정의), INFO 2건이 발견됐다.

## 위험도

LOW
