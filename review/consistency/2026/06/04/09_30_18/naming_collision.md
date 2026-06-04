# 신규 식별자 충돌 검토 결과

검토 범위: `spec/5-system/` 변경 6개 파일 (`spec/0-overview.md`, `spec/1-data-model.md`, `spec/5-system/3-error-handling.md`, `spec/5-system/4-execution-engine.md`, `spec/5-system/7-llm-client.md`, `spec/5-system/9-rag-search.md`)

---

## 발견사항

### **[WARNING]** `EXECUTION_TIMEOUT` 의미 재정의로 기존 참조처와 어의 불일치

- **target 신규 식별자**: `spec/5-system/3-error-handling.md` 가 `EXECUTION_TIMEOUT` 의 설명을 "Code 노드 스크립트 실행 타임아웃 (`nodes/data/code/code.handler.ts`). 엔진 레벨 누적 실행시간 초과는 `EXECUTION_TIME_LIMIT_EXCEEDED` 를 쓴다" 로 좁혔고, 엔진 레벨 타임아웃은 신규 코드 `EXECUTION_TIME_LIMIT_EXCEEDED` 로 분리.
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-impl/spec/conventions/chat-channel-adapter.md:387` — `EXECUTION_TIMEOUT` 에 `(engine)` 주석이 달려 있어 엔진 레벨 코드로 분류. `EXECUTION_TIME_LIMIT_EXCEEDED` 는 이 표에 없음.
  - `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-impl/spec/5-system/14-external-interaction-api.md:532` — `"code": "EXECUTION_TIMEOUT" | ...` 예시에 `// 엔진 수준 에러코드` 주석 포함. `EXECUTION_TIME_LIMIT_EXCEEDED` 미등재.
  - `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-impl/codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts:38` — `TIMEOUT_CODES` set 에 `'EXECUTION_TIMEOUT'` 등록, `EXECUTION_TIME_LIMIT_EXCEEDED` 없음.
  - `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-impl/codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx:156`, `run-results.en.mdx:145` — 사용자 노출 문서에서 `EXECUTION_TIMEOUT` 을 "전체 워크플로우 실행 시간이 초과됐어요" (엔진 레벨 의미)로 기술.
- **상세**: target 이 `EXECUTION_TIMEOUT` 을 "Code 노드 스크립트 전용"으로 범위를 좁히고 엔진 레벨 타임아웃을 `EXECUTION_TIME_LIMIT_EXCEEDED` 로 분리했으나, chat-channel-adapter spec, external-interaction-api spec, frontend docs 는 아직 `EXECUTION_TIMEOUT` 을 엔진 레벨 코드로 기술한다. 구현 시 `execution-failure-classifier.ts` 가 `EXECUTION_TIME_LIMIT_EXCEEDED` 를 `executionFailedTimeout` 으로 분류하지 않으면 채팅 채널에서 엔진 타임아웃 실패가 `executionFailedInternal` fallback 으로 잘못 라우팅된다.
- **제안**: 구현 착수 전 또는 이번 spec PR 에서 함께 갱신 —
  1. `spec/conventions/chat-channel-adapter.md:387` — `EXECUTION_TIMEOUT` 의 `(engine)` 주석 제거, `EXECUTION_TIME_LIMIT_EXCEEDED` 행 추가 (`executionFailedTimeout` 매핑).
  2. `spec/5-system/14-external-interaction-api.md:532` — 예시 코드에 `EXECUTION_TIME_LIMIT_EXCEEDED` 추가.
  3. Frontend docs `run-results.mdx` 양국어 파일 — `EXECUTION_TIMEOUT` 설명을 "Code 노드 스크립트 타임아웃"으로, `EXECUTION_TIME_LIMIT_EXCEEDED` 행을 "엔진 레벨 누적 실행 시간 초과"로 추가.

---

### **[WARNING]** `execution-run` BullMQ 큐가 카탈로그·레지스트리·프론트엔드 docs 에 미등재

- **target 신규 식별자**: `spec/5-system/4-execution-engine.md §4` 에서 새 BullMQ 큐 `execution-run` (execution intake queue) 을 정의.
- **기존 사용처 (SoT 큐 카탈로그)**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-impl/spec/data-flow/0-overview.md:93` — 현재 등록된 큐 목록에 `execution-run` 없음. 단 `spec/data-flow/0-overview.md:988` 에 Redis 키 테이블에는 `exec:run:seq:<executionId>` 가 `(target — §4)` 주석으로 등재되어 있음.
  - `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-impl/spec/5-system/16-system-status-api.md:22` — 큐 레지스트리 표에 `background-execution` / `execution-continuation` 만 있고 `execution-run` 없음.
  - `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-impl/codebase/frontend/src/content/docs/07-workspace-and-team/system-status.mdx:40` (양국어) — UI 화면 문서에 `background-execution, execution-continuation` 만 나열.
  - `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-impl/codebase/backend/test/system-status.e2e-spec.ts:26-27` — e2e 기대값에 `execution-run` 없음.
- **상세**: 큐가 신규 정의됐으나 SoT 큐 카탈로그(`spec/data-flow/0-overview.md §4`)의 등록 목록(`현재 등록된 큐:` 텍스트)에 반영되지 않았고, 시스템 상태 API spec 레지스트리 표에도 누락되었다. target 이 "Planned" 임을 명시하고 있으므로 현 구현 미등재는 의도적이지만, spec 내 카탈로그 SoT 와 불일치가 발생한다. 구현 착수 시 카탈로그 미갱신 상태로 진행하면 `SystemStatusModule` QueueRegistry 와 e2e가 큐를 인식하지 못한다.
- **제안**: `execution-run` 큐는 target(Planned) 이므로 지금 당장 코드에 추가할 필요는 없다. 단, spec 문서 정합성을 위해 `spec/data-flow/0-overview.md` 의 "현재 등록된 큐" 텍스트 및 §4 BullMQ 큐 카탈로그 표에 `(target — §4)` 주석으로 등재하는 것을 권장한다. 구현 착수 시점에 `spec/5-system/16-system-status-api.md` 레지스트리 표와 frontend docs, e2e 를 함께 갱신한다.

---

### **[INFO]** `exec:run:seq:<executionId>` Redis 키 이름이 `exec:seq:<executionId>` 기존 접두어와 유사

- **target 신규 식별자**: `spec/data-flow/0-overview.md:988` 에서 `exec:run:seq:<executionId>` 를 정의.
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-impl/codebase/backend/src/modules/websocket/execution-seq-allocator.service.ts:42` — `exec:seq:<executionId>` (WebSocket emit-event seq)
  - `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-impl/codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts:79` — `exec:cont:seq:<executionId>` (continuation publish seq)
- **상세**: 세 키가 모두 `exec:` prefix를 공유하며 목적이 다르다. `exec:seq:` / `exec:cont:seq:` / `exec:run:seq:` — 이름이 유사하지만 실제 충돌(같은 키가 다른 용도)은 없다. spec 에서 "continuation seq 와 namespace 분리(`run` vs `cont`)" 를 명시적으로 기술하고 있어 설계자가 인식하고 있음. 단, `exec:seq:` (WebSocket emit-event) 와 `exec:run:seq:` 가 두 글자 차이라 혼동 가능성이 낮지 않다.
- **제안**: 구현 시 세 키의 접두어 상수를 별도 파일(예: `redis-keys.constants.ts`)에 모아 정의하고, 각 상수에 목적 주석을 달아 혼동을 방지한다. 현재는 충돌 아님.

---

### **[INFO]** `builtin` RerankConfig.provider 값이 LLMConfig.provider 의 `local` 과 의미적으로 겹칠 수 있음

- **target 신규 식별자**: `spec/1-data-model.md §2.16.1 RerankConfig` 와 `spec/5-system/7-llm-client.md` 에서 Planned 리랭커 provider 로 `builtin` (Transformers.js 인프로세스) 정의.
- **기존 사용처**: `spec/1-data-model.md §2.16 LLMConfig` — provider 예시 `openai, anthropic, local 등`; `spec/5-system/7-llm-client.md §3.6` — `local` provider 는 OpenAI-compatible `/rerank` (vLLM 등)로 HTTP 래퍼. `builtin` 은 완전히 다른 인프라(인프로세스 onnxruntime-node, HTTP 없음).
- **상세**: `builtin` 은 LLMConfig.provider 도메인에는 존재하지 않고 RerankConfig.provider 전용으로 도입되므로 직접 충돌은 아니다. 그러나 RerankConfig 내에서 `local` (HTTP 래퍼)과 `builtin` (인프로세스)이 둘 다 Planned 로 정의되어 있어, 자가호스팅 사용자가 "로컬 추론" 을 원할 때 어떤 provider 를 써야 하는지 혼동 가능성이 있다.
- **제안**: 향후 `builtin` 구현 착수 시 API 문서 및 UI에서 `local` (외부 HTTP 엔드포인트 필요)과 `builtin` (인프로세스, 추가 컨테이너 불필요)의 차이를 명시적으로 표시한다. 현 시점 Planned 이므로 구현 차단 없음.

---

### **[INFO]** `EXECUTION_RUN_WORKER_CONCURRENCY` 환경변수 미등재

- **target 신규 식별자**: `spec/5-system/4-execution-engine.md §4.3` 에서 환경변수 `EXECUTION_RUN_WORKER_CONCURRENCY` 정의 (intake worker 인스턴스당 병렬 처리 수).
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/rag-rerank-impl/codebase/backend/.env.example` — `CONTINUATION_WORKER_CONCURRENCY=1` 은 등재; `EXECUTION_RUN_WORKER_CONCURRENCY` 는 없음.
- **상세**: spec 에서 "(target — §4)" 표기로 Planned 임을 명시하고 있어 `.env.example` 미등재는 의도적. 충돌 없음.
- **제안**: `execution-run` 큐 구현 착수 시 `.env.example` 에 `EXECUTION_RUN_WORKER_CONCURRENCY` 와 적절한 기본값·주석을 `CONTINUATION_WORKER_CONCURRENCY` 인근에 추가한다.

---

## 요약

target(rag-rerank-impl) 이 도입한 신규 식별자 중 직접적인 이름 충돌은 발견되지 않는다. 주요 위험은 두 가지다. 첫째, `EXECUTION_TIMEOUT` 의 의미 범위를 좁히고 `EXECUTION_TIME_LIMIT_EXCEEDED` 를 신설했으나, `spec/conventions/chat-channel-adapter.md`, `spec/5-system/14-external-interaction-api.md`, frontend docs, `execution-failure-classifier.ts` 가 여전히 `EXECUTION_TIMEOUT` 을 엔진 레벨 코드로 분류하고 있어 `EXECUTION_TIME_LIMIT_EXCEEDED` 가 `executionFailedInternal` 로 잘못 라우팅될 런타임 회귀 위험이 있다. 둘째, 신규 `execution-run` BullMQ 큐가 SoT 인 `spec/data-flow/0-overview.md` 큐 카탈로그와 시스템 상태 spec 레지스트리에 미반영되어 있다(Planned 의도이나 카탈로그 SoT 불일치). 두 항목 모두 구현 전 해소가 권장된다.

## 위험도

MEDIUM
