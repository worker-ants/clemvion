# Node Cancellation Infrastructure (AbortSignal 전파 기반)

> 작성일: 2026-05-30
> 분리 출처: [`parallel-p2.md`](./parallel-p2.md) 결정 H (cancellation 인프라를 별 plan 으로 분리)
> 후속 plan: `parallel-p2.md` §5 (Parallel `cancel-others-on-fail` errorPolicy 활용)

## 배경

`parallel-p2.md` 의 결정 A (`errorPolicy: 'cancel-others-on-fail'` — 첫 분기 실패 시 다른 분기 abort) 는 노드 단계 cancellation 인프라를 요구한다. 현재 `NodeHandler.execute(input, config, context)` 는 `AbortSignal` 인자가 없고, `ExecutionContext` 에도 abort 표면이 없어 장기 외부 I/O (HTTP/DB/AI) 가 시작되면 워크플로우 단위 cancel 이 불가능.

본 인프라는 Parallel `cancel-others-on-fail` 외에도 다음 향후 기능에 재사용된다:
- **Workflow 단위 timeout** — 실행 시간 한도 초과 시 진행 중 노드 abort
- **사용자 cancel 버튼** — 실행 중 워크플로우를 UI 에서 중단
- **WorkflowExecution graceful shutdown** — 서버 종료 시 진행 중 노드 abort

## 관련 문서

- [`codebase/backend/src/nodes/core/node-handler.interface.ts`](../../codebase/backend/src/nodes/core/node-handler.interface.ts) — `NodeHandler` 인터페이스 / `ExecutionContext`
- [`codebase/backend/src/modules/execution-engine/execution-engine.service.ts`](../../codebase/backend/src/modules/execution-engine/execution-engine.service.ts) — 노드 dispatch / handler.execute 호출
- [`codebase/backend/src/modules/execution-engine/shutdown/`](../../codebase/backend/src/modules/execution-engine/shutdown/) — graceful shutdown (향후 통합 지점)
- 외부 I/O 노드:
  - HTTP: `codebase/backend/src/nodes/integration/http/`
  - Database: `codebase/backend/src/nodes/integration/database/`
  - AI Agent / Text Classifier / Information Extractor: `codebase/backend/src/nodes/ai/`
  - Send Email: `codebase/backend/src/nodes/integration/email/`

## 작업 단위

### 1. `ExecutionContext.abortSignal?: AbortSignal` 신규 필드

- [x] `node-handler.interface.ts` 의 `ExecutionContext` 에 `abortSignal?: AbortSignal` 추가 + JSDoc (생산자/소비자 컨트랙트 명시) — `_executedNodes` 다음에 배치
- [x] JSDoc 본문: 장기 외부 I/O 전파 의무 / best-effort 의미 / 본 PR 범위 (HTTP 만 — DB / AI / Email / chat-channel 은 후속) 명시
- [x] spec convention `spec/conventions/node-cancellation.md` 가 SoT — JSDoc 에서 링크

### 2. ExecutionEngineService 단의 signal 전파

> **후속 PR**. 본 PR 은 ExecutionContext 필드만 — 엔진은 이미 context 를 dispatch 직전 핸들러에 전달하므로 자동 전파. 사전 abort 체크 / cancelled status 분류 / 통합 테스트는 별 PR.

- [ ] `executeNode` 류에서 dispatch 직전 `context.abortSignal?.aborted` 사전 체크
- [ ] `NodeExecution.status = 'cancelled'` 추가 또는 `failed + error.name === 'AbortError'` 분류 결정
- [ ] 통합 테스트

### 3. HTTP 노드 signal 전파 (최우선)

- [x] `http-request.handler.ts` 의 fetch controller 와 `context.abortSignal` cascade — upstream abort 시 controller.abort() 호출, controller 가 abort 됐을 때 upstream listener 해제 (메모리 누수 방지)
- [x] 기존 fetch 의 timeout AbortController 와 결합 — 두 신호 모두에서 fetch 가 즉시 throw
- [x] 단위 테스트 3건: 이미 abort 된 upstream / 실행 중 upstream abort cascade / upstream 미설정 시 regression 0

### 4. Database 노드 signal 전파

- [ ] `codebase/backend/src/nodes/integration/database/` 에서 사용 중인 driver 의 cancel 지원 확인 (PostgreSQL `pg`: `client.cancel()`, MySQL `mysql2`: connection destroy, MongoDB: `signal` option 직접 지원 등)
- [ ] driver 별 signal 전파 구현
- [ ] 단위 테스트 — signal abort 시 쿼리가 중단되는지

### 5. AI 노드 signal 전파

- [ ] AI Agent / Text Classifier / Information Extractor — Anthropic SDK / OpenAI SDK 의 `signal` 옵션 사용 가능 여부 확인
- [ ] Anthropic SDK: `client.messages.create({ ..., signal })` — 지원 확인 후 전파
- [ ] OpenAI SDK: 동일 패턴 확인 후 전파
- [ ] 멀티턴 AI Agent 의 경우 — 진행 중 turn 만 abort, conversation state 는 보존
- [ ] 단위 테스트 — signal abort 시 AI 호출이 즉시 중단되는지

### 6. 그 외 외부 I/O 노드

- [ ] Send Email (SMTP) — nodemailer 의 connection close 검토
- [ ] chat-channel 노드 (Slack/Telegram/Discord) — webhook fetch 의 signal 전파
- [ ] 기타 noted: 본 plan 의 범위는 "signal 미지원 노드는 best-effort (abort 후에도 자기 작업 완료까지 계속)" — 모든 노드 지원이 목적 아님

### 7. 통합 시나리오 / spec

- [x] 신규 [`spec/conventions/node-cancellation.md`](../../spec/conventions/node-cancellation.md) 작성 — 컨트랙트, 생산자/소비자, signal 전파 흐름, fetch timeout 과의 cascade 패턴, AbortError 분류, 본 PR 범위 / 후속, § Rationale
- [ ] e2e 테스트 — 다단계 워크플로우에서 외부 cancel signal 이 전파되는지 (후속 PR)

## 수용 기준

- `ExecutionContext.abortSignal?` 신규 필드 + JSDoc 명시
- 최소 HTTP 노드 + AI 노드 (2개 이상) 가 signal 전파
- abort 후 노드가 `cancelled` 상태로 기록 (또는 `failed` + `AbortError` 분류)
- cancellation convention spec 작성
- 단위/통합 테스트가 signal 전파를 잠금
- 본 plan 완료 후 [`parallel-p2.md`](./parallel-p2.md) §5 가 진행 가능 상태

## 의존성·리스크

- **의존**: 없음. 인프라 작업
- **리스크**:
  - DB driver / SDK 의 signal 지원 부재 — driver 별 best-effort
  - signal 전파를 빠뜨린 노드가 cancellation 시 hanging — spec 으로 best-effort 명시 + 통합 테스트 추가 시 발견
  - 멀티턴 AI Agent 의 conversation state 보존과 abort 의 정합성 — 진행 중 turn 만 abort, state 손상 없음 보장 필요

## 향후 활용 (본 plan scope 밖)

- Workflow 단위 timeout (실행 시간 한도)
- 사용자 cancel 버튼 (실행 중 워크플로우 중단)
- WorkflowExecution graceful shutdown 의 노드 단계 abort
- BullMQ job cancel 과 노드 단계 abort 의 정합
