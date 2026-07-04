---
worktree: refactor-06-c3-context-drift
started: 2026-07-04
owner: project-planner
---

# Spec draft — C-3 실행 컨텍스트 in-memory 정직화 (Redis context store 드리프트 제거)

> 대상: `spec/5-system/4-execution-engine.md` §6.2 / §7.5 / §9.1 / §9.2 + Rationale.
> 근거: `plan/complete/refactor/06-concurrency.md` C-3(마지막 미착수 항목). 2-agent 코드 조사로 §9.2 Redis 키 6종(`:context`/`:status`/`:output`/`:heartbeat`/`:lock`/`queue:priority`) **전부 코드 사용 0건** 확인 — Redis context store 코드 부재. 실기능 결함 없음, 순수 spec 정직화 + 소량 코드 주석.
> 사용자 결정(2026-07-04): 지금 구현 + **드리프트 행 제거 + Rationale 근거 보존**.

## 변경 핵심 (한 줄)
spec 이 서술하던 **Redis 기반 실행상태 모델**(Phase-1, 미구현)을, 실제 모델 **in-memory segment-local ExecutionContext + PostgreSQL durable + §7.5 rehydration** 으로 정정한다. Redis context store 는 미채택(park-release 이중화 위험) — 근거를 §Rationale 에 보존.

## Δ1 — §6.2 저장 전략 표
- "실행 중 | Redis | 실행 컨텍스트를 Redis에 저장" → "in-memory (`ExecutionContextService` segment-local Map) | ... park/완료 시 소멸, 재개는 §7.5 rehydration 이 DB 에서 재구성".
- "노드 완료 시 | Redis + PostgreSQL | nodeOutputCache(Redis)" → "in-memory + PostgreSQL | nodeOutputCache(in-memory) + NodeExecution + execution_node_log(PG)".
- "노드 hook 시 | Redis (`ExecutionContext.conversationThread` 일부)" → "in-memory (...)".
- "waiting_for_input 진입 시 | PostgreSQL(...) + Redis (`ExecutionContext`)" → Redis 절 제거 + "in-memory context 는 park 시 소멸" 명시.
- "실행 완료 시 | ... Redis에서 삭제" → "in-memory ExecutionContext 소멸(`finalizeRehydrationCleanup`/세그먼트 종료)".

## Δ2 — §7.5 rehydration 절차
- "ExecutionContext 재구성 (Redis context 가 살아있으면 그것 우선, 없으면 DB)" → "항상 DB 에서 복원(park=세그먼트 종료로 in-memory 소멸; Redis store 없음). 같은 인스턴스가 우연히 context 를 들고 있으면 재사용하나 최적화일 뿐 정합성 전제 아님(`rehydrateContext` 의 `getContext` hit)".

## Δ3 — §9.2 Redis 키 표 + §9.1 sub 예시
- 제거(코드 0건, 미구현): `exec:{ws}:execution:{id}:context`·`:status`·`node:{id}:output`·`worker:{id}:heartbeat`·`lock:{id}`·`queue:priority`.
- 유지(실사용): `exec:recover:lock`·`exec:cont:seq:`·`exec:seq:`·`exec:run:seq:`(PR4)·`core:rate`·`ws:session`.
- §9.1 `sub` 예시 `context/output/heartbeat`(제거된 키) → `seq/lock/session`.
- 표 아래 "실행 상태는 Redis 키가 아니다 (Phase-1 대체)" 1-블록 note + §Rationale cross-ref.

## Δ4 — §Rationale 신규 "실행 컨텍스트 in-memory + DB durable — Redis context store 미채택"
- Phase-1 Redis 설계 미구현 경위 + 실제 수렴 모델(in-memory context / PG status·output / BullMQ stalled = heartbeat / DB 원자 claim = lock / BullMQ priority).
- Redis context store 미채택 3근거: (a) park-release 이중화(진실 갈림), (b) cross-instance 이미 §4.2 dedup + §7.4/§7.5 rehydration + PR3 case B 로 해소, (c) 성능·복잡도.
- segmentStartMs in-memory 성은 수용된 trade-off(Graceful Shutdown under-count) — 세그먼트-start 영속은 **PR4** 이연(PR3 미해소, 2026-07-04 정정). 전면 Redis store 미채택.

## Δ5 — 코드 (developer, 소량)
- `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts:55` 클래스 주석 "In-memory ... In production, this would be backed by Redis." → 실제 모델(세그먼트-로컬 in-memory + park 시 PostgreSQL durable + §7.5 rehydration; Redis store 미채택)로 정정.

## 무결성/side-effect
- cross-file: 조사 결과 드리프트는 `4-execution-engine.md` 에 집중, `data-flow/3-execution.md`·`execution-context.md`·`9-observability.md`·`16-system-status-api.md` 무드리프트(재확인 대상).
- 실기능 변경 0(문서 + 주석). 신규 마이그레이션/인프라/큐 변경 없음.
- 06-concurrency C-3 = 마지막 항목 → plan 전체 complete 이동.

## Rationale

- **신규 설계 결정이 아니라 spec 정직화**: 본 draft 는 새 아키텍처를 도입하지 않는다. 실제 구현(in-memory segment-local ExecutionContext + PostgreSQL durable + §7.5 rehydration)은 park-release(Phase B)·Durable Continuation·§7.1 heartbeat→stalled 결정의 **논리적 귀결로 이미 존재**하며, spec 본문(§6.2/§9.2)만 Phase-1 Redis 모델을 서술하는 드리프트였다. 이를 실제 모델로 정정한다.
- **Redis context store 미채택 근거**: (a) park-release 이중화(park 시 durable 진실=PostgreSQL, Redis 사본은 rehydration 소스 이원화로 진실 갈림), (b) cross-instance 는 §4.2 jobId dedup + §7.4/§7.5 rehydration + PR3 case B re-drive 로 이미 해소, (c) 성능·복잡도(매 노드 output Redis 왕복 회피). → §Rationale "실행 컨텍스트 in-memory + DB durable — Redis context store 미채택" 신규 항목으로 보존(사용자 결정: 제거 + Rationale 근거).
- **segmentStartMs 영속 = 미확정 후속(under-count 는 수용된 trade-off)**: spec Rationale·코드 주석은 세그먼트-start 영속을 "PR4 stalled 재배달과 함께 검토할 후속 candidate" 로 표기한다(하드 커밋 아님). 옛 06-concurrency C-3 plan 의 "PR3 에서 자연 해소" 는 stale — PR3(#795)는 세그먼트-start 를 영속하지 않는다(2026-07-04 spec Rationale 정정). plan hygiene 으로 06-concurrency C-3 + exec-intake PR4 candidate note 를 함께 갱신한다(plan_coherence WARNING 해소).
- **적용 순서 주의**: 본 draft 의 Δ1–Δ5 는 이미 spec/코드에 적용된 상태다(직접 편집 후 draft 작성 — drift cleanup 이라 저위험). `/consistency-check --spec`(`review/consistency/2026/07/04/09_27_49`) 실행: cross_spec/rationale/naming **NONE**, convention 은 본 draft frontmatter/Rationale 누락 CRITICAL(→ 본 수정으로 해소), plan_coherence WARNING(segmentStartMs stale)은 위 plan hygiene 으로 해소.
