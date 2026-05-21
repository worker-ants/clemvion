# Consistency Check Summary — impl-prep, PR2 (External Interaction API 구현)

> 2026-05-22 / worktree: `impl-external-interaction-api-31801c` / base: `worktree-spec-external-interaction-api` (PR1, #228)
> 검토 시점: PR2 구현 착수 직전 의무 (`consistency-check --impl-prep`)

## BLOCK: YES

**Critical 발견 2건** — 구현 착수 차단. 해소 후 재검토 또는 정정 사항을 plan 에 반영하고 진행.

## 결과 매트릭스

| Checker | STATUS | Critical | Warning | Info | 결과 |
|---------|--------|----------|---------|------|------|
| cross-spec-checker | **BLOCK** | **2** | 3 | 0 | `cross-spec.md` |
| rationale-continuity-checker | WARN | 0 | 5 | 0 | `rationale.md` |
| convention-compliance-checker | WARN | 0 | 8 | 3 | `convention.md` |
| plan-coherence-checker | WARN | 1 (V059 합의 필요) | 1 | 1 | `plan-coherence.md` |
| naming-collision-checker | PASS | 0 | 1 | 9 | `naming.md` |

## Critical 항목 (BLOCK)

### C1. NestJS 컨트롤러 경로 — global prefix 이중 적용

- **위치**: PR1 spec `spec/5-system/14-external-interaction-api.md` §10 의 `# 모듈 prefix: @Controller('api/external/executions') — 기존 /api/executions/* 컨트롤러와 분리`
- **실태**: `codebase/backend/src/main.ts` 가 `app.setGlobalPrefix('api')` 이미 적용 중. 컨트롤러 데코레이터를 `@Controller('api/external/executions')` 로 쓰면 실 등록 경로가 `/api/api/external/executions/...` 가 됨.
- **해소 방법**: 컨트롤러 데코레이터를 `@Controller('external/executions')` 로 수정. PR1 spec §10 의 코멘트도 함께 정정 필요.

### C2. WebSocket `seq` monotonic counter 미구현

- **위치**: PR1 spec R7 (`spec/5-system/14-external-interaction-api.md`) + EIA-NX-08, EIA-IN-07; WS §2.2 (`spec/5-system/6-websocket-protocol.md`)
- **실태**: `WebsocketService.emitExecutionEvent`, `WebsocketGateway.broadcastToChannel`, `Execution` entity 어디에도 `seq` 필드/카운터가 없다. WS spec §2.2 가 정의했지만 미구현 상태였음.
- **PR2 영향**: R7 "WS §2.2 의 seq 와 동일 값 공유" 라는 SSE/Notification 의 sequencing 전제가 깨짐. P5 SSE adapter / P3 NotificationDispatcher 가 `seq` 를 사용하지 못함.
- **해소 방법**: seq 카운터 구현을 PR2 의 새 phase **P0** (또는 P1 에 합류) 로 추가. 구현 위치:
  - `Execution` entity 에 `seq_counter INTEGER NOT NULL DEFAULT 0` 컬럼 추가 (V059 마이그레이션과 동일 build)
  - `WebsocketService.emitExecutionEvent` 가 execution 별 atomic INCR (Redis `INCR exec:seq:<id>` 또는 DB row-level lock) 으로 seq 발급
  - 이벤트 envelope 의 `seq` 필드에 동봉
  - SSE `id:` 와 Notification `seq` 가 그대로 같은 값 사용

## Critical/주요 항목 — plan-coherence

### C3. Migration V059 슬롯 경합 (관련 plan: `replay-rerun.md`)

- 두 plan 모두 V059 를 요구. 머지 순서로 충돌.
- **해소**: 본 PR2 의 V059 는 (a) Trigger 4컬럼 + (b) Execution.seq_counter 컬럼 (C2 해소) 으로 묶고, replay-rerun 의 V059 가 V060 으로 자동 후행되도록 plan-coherence 결과를 replay-rerun.md 에 명시. 또는 본 PR2 가 V060 으로 양보. **권장: PR2 가 V059 점유** (구현 phase 가 본 PR2 가 먼저 진행됨).

## Warning (다수, 해소 항목)

### Cross-spec
- **W-1**: R10 단일 sink — after-commit hook 메커니즘 plan 에 미명시. ExecutionEngine 에 NotificationDispatcher 를 직접 inject 위험. **해소**: P6 에 "WebsocketService.emit 의 wrapper / Redis pub/sub 구독 / outbox table 폴러 중 하나 선택" 명시.
- **W-2**: EIA-RL-04 commit 후 emit — P6 의 hook 시점이 트랜잭션 commit 이후 보장 명시 필요.
- **W-3**: Swagger `WebhookAcceptedDto` 갱신 누락 — P6 에 DTO 갱신 체크박스 추가.

### Convention
- **W-4**: V059 SQL 에 `CHECK (notification_health IN ('unknown','healthy','degraded'))` 추가. spec §7.1 SQL 예시에는 누락되어 있으나 plan §2.1 에는 명시. plan 기준으로 작성.
- **W-5**: `@ApiTags('External Interaction')` 명시 (P4).
- **W-6**: Swagger 응답 DTO 래퍼 (`ApiAcceptedWrappedResponse`) 사용 — P4 체크박스 추가.
- **W-7**: HooksController 의 `@Public()` 유지 + `@ApiBearerAuth` 미추가 (P6 체크박스).
- **W-8**: 에러 응답 `details` shape — `2-api-convention §5.3` 의 `details: Array<{field, message}>` vs PR1 spec §5.1 의 `details: { fieldErrors: [...] }` 객체 형태 불일치 → **P4 에서 `details: Array<{field, code, ...}>` 형태로 통일** (GlobalExceptionFilter 와 정합).
- **W-9**: i18n dict 섹션은 `triggers.ts` (이미 존재) — P7 체크박스에 명시.
- **W-10**: 신규 errorCode → ko 매핑 누락 시 PR 본문 명시 (P4·P6 끝나면 점검).
- **W-11**: SSE adapter / Notification dispatcher 가 `conversationThread.turns[].source` 마커 변형 없이 passthrough.

### Rationale (5건 모두 plan 보강으로 해소)
- R1/R2/R3/R4/R5/R6/R7/R8/R9/R10/R11/R12 결정의 구현 phase 매핑 — plan 의 phase 표에 R 번호 cross-link 추가.

### Naming
- **W-12**: `WebhookAcceptedDto.interaction` 필드명이 노드 output `interaction` (form_submitted/button_click 등) 과 의미 충돌 가능. JSDoc 으로 맥락 명확화 필요. (rename 은 PR1 spec 변경이 필요하므로 보류, 주석으로 처리)

### Plan
- **W-13**: Follow-up 4건이 target plan 에 미반영 (replay-rerun / ai-agent-tool-connection-rewrite / merge-p2-async-fanin / self-hosting-deployment). PR2 머지 직전 cross-plan 갱신 commit 추가.

## Info (참고)

- SDK 패키지 scope 결정 필요: `@workflow/sdk` (기존 scope) vs `@clemvion/sdk` (브랜드). **권장: `@workflow/sdk`** (기존 `expression-engine`, `node-summary` 와 일관).
- BullMQ 큐 이름 컨벤션 — 기존은 케밥-케이스. `notification:webhook` 의 콜론은 spec 표기. 큐 이름 자체는 `notification-webhook` 으로 케밥 통일 권장 (spec §3.1 의 표기는 식별자 의미만, 실제 큐 이름은 코드 결정).

## 결론

- **BLOCK: YES** — C1 (prefix 이중), C2 (seq 미구현) 두 건 해소 필수.
- 해소 방법:
  1. **C1**: PR1 spec §10 의 `@Controller('api/external/executions')` → `@Controller('external/executions')` 정정. PR1 head 가 본 worktree base 이므로 same-stack 안에서 spec 정정 가능 (developer 가 spec 직접 수정은 원칙적 금지이나, PR1 의 명백한 오류이고 본 worktree 가 PR1 위에 있으므로 사용자 확인 후 정정).
  2. **C2**: PR2 의 phase 분할안에 새 phase P0 (또는 P1 에 합류) 추가 — Execution 엔티티 `seq_counter` 컬럼 + WebsocketService.emit 가 seq 발급 + WS event envelope 에 seq 포함. V059 가 (Trigger 4컬럼 + Execution seq_counter) 둘 다 처리.

## 다음 단계

사용자에게 보고 후 다음 중 하나 선택:
- **A (권장)**: C1·C2 모두 본 PR2 안에서 해소. C1 은 PR1 spec 정정 commit (same-stack), C2 는 P0 phase 추가.
- **B**: PR1 review 머지 후 C1 정정만 추가 PR 로 분리, PR2 는 C2 만 해소하고 진행.

권장은 A — PR1 머지 전이므로 stack 안에서 정정이 깔끔.
