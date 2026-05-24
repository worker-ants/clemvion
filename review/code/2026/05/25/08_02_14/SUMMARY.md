# Code Review 통합 보고서

## 전체 위험도

**MEDIUM** — C1~C4, C6 의 spec 관련 critical 발견은 false positive (reviewer 가 worktree 의 갱신된 spec 을 보지 못한 것으로 추정 — Phase 0 commit 에서 이미 BullMQ §7.4/§7.5 및 WS §4.2 `queued` 필드 추가됨). C5 (`ContinuationExecutionProcessor` 단위 테스트 누락) 만 진짜 Critical.

## False Positive 분석 (수정 불필요)

| # | 카테고리 | reviewer 보고 | 실제 상태 |
|---|----------|----------------|-----------|
| C1 | requirement | spec §7.4 가 구 Redis pub/sub 기술, BullMQ 미반영 | spec line 740-784 가 BullMQ `execution-continuation` 큐 기반으로 완전 재작성됨 (Phase 0) |
| C2 | requirement | spec §7.5 부재 | spec line 786-845 에 §7.5 신설 (rehydration 본문 + RESUME_* 에러 코드 표) |
| C3 | requirement | `nodeExecutionId` 필드 미등재 | spec §7.4 메시지 스키마 행에 명시 (line 749-750) |
| C4 | requirement | `resumeFromCheckpoint` 내 잘린 주석 | 실제 line 990-991: "nodeExecutionCount — 재시작 후 budget 은 fresh. 본 waiting node 의 첫 진입은 이미 1회 소비된 것으로 계산 (체크포인트 도달까지의 한 번)." — 완전한 주석 |
| C6 | documentation | WS ack `queued`/`resumed` 필드 미반영 | spec/5-system/6-websocket-protocol.md line 230-235 에 `queued: boolean` 명시 및 `false=fast path / true=BullMQ` 의미론 정의 |

위 5건은 spec 보강이 이미 완료된 상태 — `BLOCK: NO`. reviewer 가 `git diff` 만 보고 spec 의 누적 상태를 놓쳤을 가능성.

## Critical 발견 (진짜)

| # | 카테고리 | 발견 | 위치 | 제안 |
|---|----------|------|------|------|
| C5 | testing | `ContinuationExecutionProcessor` 단위 테스트 전무. 5개 타입 dispatch (`continue` / `cancel` / `button_click` / `ai_message` / `ai_end_conversation`) + ack-and-discard 멱등성 가드 + default exhaustiveness 모두 미검증 | `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts` (대응 spec 부재) | `continuation-execution.processor.spec.ts` 신규 작성. `ExecutionEngineService` mock 으로 5개 분기 + `isNodeExecutionWaiting=false` (이미 처리된 케이스) 분기 커버 |

## 경고 (WARNING) — 본 PR 처리 대상

처리 우선순위 상위 (즉시 fix):

| # | 카테고리 | 발견 | 위치 | 제안 |
|---|----------|------|------|------|
| W1 | side_effect / concurrency | `applyCancellation` await 제거 — sync void 메서드라 현재는 안전하지만 향후 async 전환 시 silent failure 위험 | `continuation-execution.processor.ts` line 81-82 | `void this.engine.applyCancellation(executionId)` 로 fire-and-forget 의도 명시 + TODO async 전환 시 await 복원 코멘트 |
| W4 | architecture | gateway 가 `jobId === null` 로 enqueue 실패 판별 — 이미 존재하는 `result.queued` 미사용 (추상화 누수) | `websocket.gateway.ts` 4개 핸들러 | `if (!result.queued)` 로 통일 |
| W19 | security | `RehydrationError` 메시지에 internal `executionId` / `nodeExecutionId` / status 노출 — 현재는 logger.warn 만이지만 향후 BullMQ DLQ Board 노출 가능 | `execution-engine.service.ts` `rehydrateAndResume` | structured logger param 사용, error.message 는 코드 분류만 |
| W20 | security | WS ack 의 `'Continuation enqueue failed (Redis unavailable)'` 가 인프라 컴포넌트 노출 | `websocket.gateway.ts` 4개 핸들러 | `'Continuation could not be queued. Please try again.'` 로 변경, Redis 장애 여부는 서버 로그 |

처리 우선순위 중위 (후속 PR 권장):

| # | 카테고리 | 발견 | 비고 |
|---|----------|------|------|
| W2 | architecture | `resumeFromCheckpoint` 의 graph build 코드가 `runExecution` 과 중복 | private helper 추출 (~30 LoC 절감) |
| W3 | architecture | `forwardRef` 순환 의존성 (Processor ↔ EngineService) | `IContinuationDispatcher` 인터페이스 추출 — Phase 2 라이프사이클 race 해소 효과도 있음 |
| W12-W15 | testing | rehydration / WS gateway 추가 분기 테스트 | curl-test 수준은 e2e 가 커버. unit 추가는 follow-up |
| W16-W18 | maintainability | 핸들러 4개 중복, `resumeFromCheckpoint` 단일 메서드 책임 과다, 통합 테스트 setup 분리 | 별 refactor PR |
| W21 | architecture | `on()` no-op stub 잔존 — ISP 위반 | 다음 phase 에서 `registerContinuationHandlers()` 와 함께 완전 제거 |
| W22-W23 | documentation | `ContinuationPublishResult` 불변 조건 / `resumeFromCheckpoint` JSDoc `setImmediate` 표현 | 짧은 JSDoc 갱신 — 본 PR 에서 묶어 처리 가능 |

처리 우선순위 낮음 (follow-up plan):

| # | 카테고리 | 발견 | 비고 |
|---|----------|------|------|
| W5 | requirement | WS gateway `queued` ack 필드 spec §4.2 추가 보강 (이미 들어있으나 `executionId`/`success: false` 케이스 미명시) | spec-update plan 에 추가 |
| W6 | requirement | `isNodeExecutionWaiting` 의 `__no_node_exec__` 처리 의미 spec 미기술 | spec-update plan 에 추가 |
| W7 | requirement | `cancelWaitingExecution` 반환 타입 일관성 | 후속 |
| W8 | side_effect | `setImmediate` polling 의 at-least-once race | BullMQ idempotency + `isNodeExecutionWaiting` 가드가 이미 보호. 추가 보강은 follow-up |
| W9-W11, W24 | side_effect / concurrency | `_executedNodes` 직접 교체 / `on()` 잔존 호출자 / `continueX` 반환 타입 변경 호출자 / `getLockClient` race | 코드 search 로 확인 후 처리 |

## 참고 (INFO)

I1 (`NO_NODE_EXEC_SENTINEL` 상수화), I2 (`rehydrateContext` N+1), I3-I17 — 모두 follow-up.

## 자동 후속 처리

`resolution-applier` 가 Critical 1건 (C5) + 즉시 fix WARNING 4건 (W1 / W4 / W19 / W20) + JSDoc 보강 2건 (W22 / W23) 을 묶어 처리한다.

나머지는 follow-up plan 으로 이관 추적.

## Reviewer 별 위험도 요약

| Reviewer | 위험도 | 메인 발견 |
|----------|--------|-----------|
| requirement | (false positive 빼면) MEDIUM | spec 갱신은 이미 완료 — 보고된 4건 false positive |
| testing | HIGH | C5 (processor 테스트 누락 진짜) |
| side_effect | MEDIUM | W1 (await 제거) |
| security | LOW | W19 / W20 (info leak) |
| architecture | MEDIUM | W2 / W3 / W4 |
| documentation | MEDIUM | W22 / W23 |
| maintainability | MEDIUM | follow-up |
| scope | LOW | follow-up |
| concurrency | LOW | follow-up |
| dependency | NONE | 신규 의존성 없음 |

## Router skip 4건

- performance, database, api_contract, user_guide_sync — 모두 router 가 변경 성격 (내부 모듈 리팩토링 / DB·API·문서 무관) 으로 적절히 skip.

**BLOCK: NO** — Critical 1건은 본 자동 후속 처리에서 해소 예정.
