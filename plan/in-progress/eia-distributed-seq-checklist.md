---
worktree: eia-distributed-seq-1319a0
started: 2026-06-02
owner: developer
parent: eia-distributed-seq-counter.md
---

# 체크리스트 — 분산 seq counter 강화 (emit signature 변경 신중 진행)

> 본 파일은 [`eia-distributed-seq-counter.md`](./eia-distributed-seq-counter.md) 의 **실행 체크리스트**.
> 사용자 지시: "emit signature 변경 영향 — 실수하지 않도록 체크리스트를 파일로 만들어 체크하면서 신중하게 진행".
> 각 항목은 **실제 통과 시에만** `[x]`. forward-looking 금지 (developer SKILL §plan 체크박스 = 실제 상태).

## 0. 사용자 결정 (locked)

| 항목 | 결정 |
| --- | --- |
| 운영 환경 | **multi-instance 운영** → 본 plan 진행 필요 |
| 저장소 | **Redis-only** (2026-06-02 사용자 재확인 — 초기 "하이브리드"에서 수정). Redis `INCR exec:seq:<id>`. **DB fallback 미사용**. Redis 장애 시 in-memory per-instance degraded fallback |
| emit signature | 신중 진행 (체크리스트 기반). 아래 §1 D1 = async 전환 |

> **결정 변경 이력**: 초기 plan 은 "하이브리드(c)" 였으나, 2026-06-02 사용자가 두 후속 질문(DB 컬럼+spec §7.2 갱신 / Redis↔DB 전환 정합)에 모두 **"redis만 사용"** 으로 답해 **Redis-only** 로 확정. → DB 컬럼·V069 마이그레이션·spec §7.2 갱신 **모두 불필요**, R-3 전환 정합 이슈 소멸.

## 1. 설계 결정 (개발자 판단 + 근거)

### D1. emit signature: **sync → async 전환** (batch pre-allocate 기각)

- **채택**: `emitExecutionEvent` / `emitNodeEvent` (+ facade `emitExecution`/`emitNode`) 를 `async` 로 전환,
  내부에서 `await seqAllocator.next(executionId)`. 모든 호출처에 `await` 추가.
- **batch pre-allocate (INCRBY N) 기각 근거**: 인스턴스별 block 예약은 execution 이 인스턴스 간
  migration (continuation-bus 가 BullMQ job 으로 다른 worker 에 continuation 분배) 할 때
  **monotonic 역전**을 재유발한다. 예: A가 block[1..10]에서 1,2,3 emit → 실행이 B로 migration,
  B가 block[11..20]에서 11,12 emit → 제어가 A로 복귀해 stale block 의 4 emit → `...,11,12,4` 역전.
  block 을 per-execution 으로 폐기하려면 migration 감지가 필요해 fragile. **본 plan 의 목적(race 제거)을
  batch 가 재도입**하므로 기각. spec R7 "execution 별 atomic INCR" 전제와도 정합.
- **latency**: per-emit Redis INCR ~1-3ms. 수용 기준 "single-instance latency 회귀 < 5ms" 충족 (per-emit).
  EXPIRE 는 INCR 성공과 분리(swallow)해 발급 지연 최소화.

### D2. 저장소 추상화: `ExecutionSeqAllocator` 신규 서비스 (Redis-only)

- Redis: `INCR exec:seq:<id>` + sliding TTL `EXPIRE` (continuation-bus `exec:cont:seq:` 패턴 재사용).
- **DB fallback 없음** (사용자 Redis-only 결정). Redis 예외 시: in-memory per-execution 카운터로
  degrade — 마지막 발급 값 이상으로 best-effort monotonic 유지, `logger.warn` 로 degraded mode 기록.
  분산 monotonic 은 Redis 정상 시에만 보장 (degraded 는 single-instance baseline 과 동등).
- 위치: `codebase/backend/src/modules/websocket/`. WebsocketService 가 주입받아 사용 (또는 WebsocketService 내부 통합).

### D3. **spec 변경 불필요 (Redis-only 결과)**

- Redis-only → execution 엔티티 컬럼 추가 없음 → spec §7.2 "신규 컬럼 없음" **유지·정합**.
- spec R7 "구현 전제": "atomic INCR (Redis `INCR exec:seq:<id>` **또는** DB row-level lock)" — Redis INCR 단독으로 충족.
- → **project-planner 위임·spec write 불필요**. consistency-check 로 정합 재확인만.

## 2. 사전 게이트

- [x] `/consistency-check --impl-prep` — **BLOCK: NO** (Critical 0, Warning 3 모두 범위 외 spec 문서/별도 plan). `review/consistency/2026/06/02/07_45_09/SUMMARY.md`
- [x] spec 변경 불필요 확정 (Redis-only → §7.2 정합, §1 D3). I-4/I-5 본 plan 으로 해소 확인

## 3. 구현 (TDD)

### 3.1 저장소 계층 (Redis-only)
- [x] `ExecutionSeqAllocator` 서비스 — Redis `INCR exec:seq:<id>` + sliding TTL EXPIRE + in-memory degraded fallback. `execution-seq-allocator.service.ts`
- [x] 단위 테스트 선작성: Redis 정상 monotonic / Redis 장애 → in-memory degrade / 복구 후 mirror 이어받기 / release. `execution-seq-allocator.service.spec.ts` (통과)
- [x] WebsocketModule 에 provider 등록 (ConfigModule global 확인)
- [x] ~~V069 migration / seq_counter 컬럼~~ — Redis-only 로 불필요

### 3.2 WebsocketService 전환
- [x] `seqCounters` Map / `nextSeq` / `releaseSeqCounter` 제거 → `seqAllocator` 주입
- [x] `emitExecutionEvent` → `async`, `await seqAllocator.next()`
- [x] `emitNodeEvent` → `async`, `await seqAllocator.next()`
- [x] terminal event 시 `seqAllocator.release(executionId)` 위임
- [x] `emitBackgroundRunEvent` / `emitKbEvent` 는 seq 미사용 → **변경 없음** (확인됨)
- [x] websocket.service.spec.ts 갱신 (fake allocator 주입 + async/await, 통과)

### 3.3 facade 전환
- [x] `ExecutionEventEmitter.emitExecution` → `async` + await 위임
- [x] `ExecutionEventEmitter.emitNode` → `async` + await 위임
- [x] execution-event-emitter.service.spec.ts 갱신 (async/await, 통과)

### 3.4 호출처 await 마이그레이션 — **37곳, 하나도 누락 금지**

#### A. execution-engine.service.ts — emitExecution (21) — [x] 전부 await 적용 (perl 일괄 + 검증 21/21)
#### B. execution-engine.service.ts — emitNode (14) — [x] 전부 await 적용 (14/14)
#### C. ai-agent.handler.ts — 직접 emitExecutionEvent (2) — [x] await 적용 (792/856, optional chaining 안전)
- [x] 잔여 sync emit 호출 0건 재-grep 확인

> **⚠️ 비-async enclosing 발견 (R-1 적중)**: `tsc build` 가 `execution-engine.service.ts`
> `emitUserMessageLiveSignal(): void` (USER_MESSAGE emit) 1곳이 **non-async** 임을 TS1308 로 검출.
> → `async ... Promise<void>` 로 전환 + 단일 호출처(4823)에 `await` 추가 (호출처는 이미 async, cascade 없음).
> Explore 의 "전부 async context" 가정이 **1곳 틀렸고**, build 가 그 1곳을 잡아낸 것이 체크리스트 가드의 효과.

### 3.5 await 누락/오류 가드 (실측 결과)
- [x] **lint(`no-floating-promises`)는 warn 이라 누락을 막지 못함** — 확인됨 (`--max-warnings 0` 아님)
- [x] **`tsc build` 가 await-in-non-async(TS1308)를 잡는 유일한 hard 가드** — 1곳 검출·수정
- [x] 재-grep 으로 await 미부착 emit 0건 — 완전성 보강 가드

## 4. 회귀·부하 테스트
- [x] 분산 race regression — 100개 동시 `next()` → 1..100 유일(중복·gap 0). allocator spec (atomic INCR 계약 고정)
- [ ] (보류) 2-instance docker-compose 실 race repro / 1000 events/s 부하 — Redis INCR 원자성으로 설계상 보장 + unit 커버. 실 multi-instance 부하 repro 는 follow-up (plan §1 PoC 수준, 별도)

## 5. TEST WORKFLOW
- [x] lint — PASS (33s)
- [x] unit — **backend 280 suites · 5398 tests PASS** (신규 allocator spec + 갱신 spec 포함). frontend 1건 실패는 아래 §기존 breakage (제 작업 무관)
- [x] build — PASS (47s, backend+frontend)
- [x] e2e — PASS (140 tests, 53s)

> **인프라 노트**: 워크트리에 node_modules 미설치 → main 의 node_modules 를 symlink (backend/frontend). 동일 의존성·동일 머신이라 안전.

> **기존 breakage (제 작업과 독립)**: frontend `spec-pending-plan-existence.test.ts` 가
> `spec/5-system/13-replay-rerun.md` 의 `pending_plans: [plan/in-progress/replay-rerun.md]` 를
> 검증하는데 그 plan 이 커밋 `21f6864f` (replay-rerun 완료 closure, plan git rm) 에서 삭제됐고
> spec frontmatter 가 동반 갱신 안 됨 → `fs.existsSync=false`. **seq counter 와 무관, replay-rerun
> 영역 spec frontmatter 문제**. 변경 파일에 frontend/spec/replay 0건 (재확인). → **project-planner
> 가 `13-replay-rerun.md` frontmatter 의 stale `pending_plans` 정리** (본 PR scope 외, 별도 처리 권고).

## 6. REVIEW WORKFLOW
- [ ] `/ai-review` + SUMMARY 기록
- [ ] Critical/Warning fix (resolution-applier) + RESOLUTION.md
- [ ] (spec 영역 변경) `/consistency-check --impl-done`
- [ ] TEST WORKFLOW 재통과

## 7. 완료
- [ ] 본체 plan 체크박스 갱신
- [ ] follow-up 0건 시 plan `git mv` complete

## 위험 등록부 (Risk register)

| # | 위험 | 완화 |
| --- | --- | --- |
| R-1 | await 호출처 1곳 누락 → seq 역전·floating promise | §3.4 재-grep 가드 + lint no-floating-promises |
| R-2 | emit 순서 보장 — async 전환 후 동일 함수 내 순차 await 유지 | 호출처가 모두 순차 await (병렬 emit 없음) 확인 |
| R-3 | Redis 장애 시 degraded(in-memory) — 분산 monotonic 미보장 | 사용자 수용된 degraded mode. `logger.warn` 기록 + Redis 복구 시 INCR 가 기존 키 이어받음(키 잔존 시) |
| R-4 | ~~spec §7.2 위반~~ | Redis-only 로 해소 (컬럼 없음) |
| R-5 | 성능 회귀 (per-emit Redis RTT) | INCR/EXPIRE 분리, 수용 기준 < 5ms 측정 |
