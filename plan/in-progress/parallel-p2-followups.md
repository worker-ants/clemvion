# Parallel P2 — 후속 작업 (parallel-p2.md 잔여)

> 작성일: 2026-05-30
> 분리 출처: `plan/complete/parallel-p2.md` — 본 plan 의 잔여 후속 항목을 별 plan 으로 분리 (parallel-p2 본체는 in-progress → complete 이동)

## 배경

`parallel-p2.md` 의 7개 PR (#363 / #364 / #366 / #367 / #368 / #369 / #370 + finalize PR) 로 핵심 동작은 모두 완료됨. 본 plan 은 그 위에 점진적으로 강화해야 할 항목을 모은다 — backend 외 영역 (frontend canvas, 추가 노드 signal 전파, 통합 테스트, ai-review) 이 주.

## 작업 단위

### 1. signal-aware 노드 확장 (node-cancellation-infrastructure.md §4~§6)

PR #369 가 HTTP 노드 1개의 fetch signal cascade 만 구현 — cancel-others-on-fail 의 효과가 노드별로 점진 강화되어야 함. 다음 노드의 `context.abortSignal` 전파:

- [ ] Database 노드 — driver 별 cancel (PostgreSQL `pg.client.cancel()`, MongoDB driver `signal` 옵션, MySQL `mysql2` connection destroy)
- [ ] AI Agent / Text Classifier / Information Extractor — Anthropic / OpenAI SDK 의 `signal` 옵션
- [ ] Send Email (SMTP) — nodemailer connection close
- [ ] chat-channel 노드 (Slack/Telegram/Discord) — webhook fetch signal 전파
- [ ] 각 노드별 단위 테스트
- [ ] `NodeExecution.status='cancelled'` 추가 (엔티티 + migration) — **별 plan 권고** (DB migration 작업)

### 2. cross-node-warning-rules frontend canvas 통합

PR #368 가 backend 인프라 + `GET /workflows/:id/graph-warnings` endpoint 까지 — frontend 가 호출 + 배지 표시 + 저장 버튼 제어가 후속.

- [ ] frontend canvas 가 graph 변경 시점 (노드 추가/삭제/edge 변경/config 변경) debounced 으로 endpoint 호출
- [ ] severity 별 UI 표현:
  - `error` → 빨간 배지 + 저장 버튼 disabled
  - `warning` → 노란 배지 + 저장은 가능
- [ ] backend ↔ frontend SSOT 보장:
  - shared package (`codebase/packages/node-graph-rules/`) 신설 권고 (spec convention 의 옵션 A)
  - 또는 endpoint 호출만으로 처리 (rule 정의는 backend 만, frontend 는 결과 표시) — 더 단순
- [ ] e2e 테스트 — 3층 중첩 Parallel 워크플로우의 canvas → save → runtime 3중 reject

### 3. workflow save endpoint 자동 reject hook

현재 `GET /workflows/:id/graph-warnings` 는 frontend 가 명시적으로 호출 — 우회 시 reject 안 됨. Node/Edge save 시점에 자동 평가 + severity `error` reject 가 진정한 3중 가드의 backend 단.

- [x] `WorkflowsService.saveCanvas` (이미 transaction 안에서 nodes/edges sync 후 일괄 처리) 안에 `evaluateGraphWarnings(savedNodes, savedEdges)` 추가 — severity `error` 시 `BadRequestException { code: 'GRAPH_VALIDATION_FAILED', message, details: { errors } }` → transaction rollback
- [x] 일관성 보장 — `dataSource.transaction` 안에서 syncNodes → syncEdges → evaluate → throw 시 rollback. 별 endpoint 추가 없이 `POST /workflows/:id/save` 가 단일 진입점
- [x] 단위 테스트 — error rule 발화 시 GRAPH_VALIDATION_FAILED reject + warning rule 만 발화 시 저장 통과 (2건 신규)
- [ ] 통합 테스트 (e2e) — 실제 HTTP API 통해 3층 중첩 Parallel 워크플로우 저장 시도 시 400 reject 확인 — **후속** (parallel-p2-followups §4 와 함께)

### 4. parallel-p2 §5 통합 테스트

- [ ] `execution-engine.service.spec.ts` 에 통합 테스트 — HTTP 노드 분기에서 첫 실패 시 다른 분기의 HTTP 가 abort 되는지 (기존 spec 의 mock 셋업 무거움 — 별 spec 파일 권고)
- [ ] `execution-engine.service.spec.ts` 에 3층 중첩 시나리오 통합 테스트 (PR #367 가 단위 테스트로 잠금했으나 dispatch chain 검증 부족)

### 5. ai-review

- [ ] parallel-p2 의 7+ PR (`#363 #364 #366 #367 #368 #369 #370 + finalize`) 누적 변경에 대한 `ai-review` — Concurrency / Performance 중심. Critical / Warning 해소
- [ ] 결과 RESOLUTION.md 작성 및 후속 fix

## 수용 기준

- 최소 HTTP 외 1개 노드 (DB 또는 AI) 의 signal 전파
- frontend canvas 가 endpoint 응답으로 배지 표시
- 통합 테스트로 cancel-others-on-fail + 3층 중첩 reject 잠금
- ai-review Critical/Warning 0

## 의존성·리스크

- DB driver / SDK 의 signal 지원 부재 가능성 — best-effort 컨벤션 (spec/conventions/node-cancellation.md) 으로 명시. driver 별 cancel 메커니즘 조사 필요
- frontend canvas 평가의 성능 — 모든 graph 변경마다 endpoint 호출. debounce + 캐싱 필요할 수 있음
- 멀티턴 AI Agent 의 conversation state 보존과 abort 정합 — 진행 중 turn 만 abort, state 손상 없음 보장 필요
