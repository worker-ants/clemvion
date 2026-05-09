# AI Review Deferred Items — 후속 PR 백로그

## 배경

ai-review 2026-05-06_17-27-43 에서 발견된 51건 중 본 PR (Phase 1 quality + 후속 조치) 에서 처리하지 못한 23건의 후속 처리 백로그. 자세한 내용은 `review/2026-05-06_17-27-43/SUMMARY.md` + `RESOLUTION.md`.

## 현재 상태 (2026-05-09 갱신)

### 완료 (PR-B)

**WARN #2 + WARN #15** 두 건 — `execution_node_log` append-only 테이블 + Redis pub/sub continuation bus 도입으로 **모두 처리 완료**. 관련 commit:

- `954dc9c4 refactor(engine): execution_node_log append-only 테이블로 executionPath 이행 (PR-B Part A)`
- `ebf934e1 feat(engine): Redis pub/sub continuation bus + recovery 분산 lock (PR-B Part B)`
- `cd235002 fix(migrations): V035a/V035b → V035/V036 — Flyway 정수 prefix 컨벤션 위반 silent skip 해소`

PR-B 자체 ai-review (2026-05-09_00-05-34) 후속 25/35건도 `e360ca0a refactor(engine): PR-B ai-review 조치 — Critical 4 + Warning 16 + Info 5 (25/35)` 로 처리. 본 plan 의 23건 백로그와는 별개 흐름.

### 남은 백로그

원본 review (`2026-05-06_17-27-43`) 의 23건 중 위 2건을 차감한 21건 미진행. 아래 §"남은 작업" 참조.

본 PR 의 PR-B 상세 계획은 더 이상 의미가 없으므로 본 문서에서 archive 의미로 한 줄 요약만 남기고, 상세 설계 기록은 commit `954dc9c4` / `ebf934e1` 의 diff 와 `spec/5-system/4-execution-engine.md §9` 로 대체한다.

각 PR 완료 시 본 문서의 해당 항목을 제거하고, 모든 항목 처리 완료 시 본 문서 자체를 `plan/complete/` 로 `git mv`.

---

## 남은 작업

진행되지 않은 21건. 우선순위 분류와 권장 PR 분할을 함께 정리한다. (~~취소선~~ = PR-B 로 처리 완료)

### P0 — Security / Correctness (즉시 별도 PR)

- **CRIT #5 (timeout 경로 테스트)** — `executeSync` 의 timeout 분기 테스트. graph traversal hang 셋업 필요.
- **WARN #4** — RUNNING ↔ WAITING_FOR_INPUT 상태 전이 트랜잭션. `DataSource` 주입 + 영향 범위 전수 검토.
- ~~**WARN #2** — `executionPathChain` 분산 환경 대응~~ (PR-B 완료)

### P1 — Architecture (큰 리팩토링, 별도 PR 단위)

- **CRIT #2** — `runExecution` / `executeInline` ~200줄 중복 추출. 안전한 추출은 며칠 작업급.
- **CRIT #3** — OCP 위반 node type 문자열 분기 → Strategy 패턴 / NodeHandler 메타데이터. 26개 핸들러 영향.
- **WARN #25** — `waitForAiConversation` 280줄 분해 (`emitWaitingForInput` / `handleAiMessage` / `handleAiEndConversation` / `finalizeAiNode`). 현재 위치 `execution-engine.service.ts` L1804-2090 부근, 약 280줄로 plan 진술 그대로.
- ~~**WARN #15** — `pendingContinuations` Map → Redis pub/sub~~ (PR-B 완료. Map 자체는 resolver 보관용으로 유지, 이벤트만 분산)
- **WARN #16** — `forwardRef(WebsocketService)` → `IExecutionEventEmitter` 추상화. **2026-05-09 확인: `execution-engine.service.ts:361` 에 `forwardRef(() => WebsocketService)` 그대로 잔존**.
- **WARN #17 (Arch)** — `executeInline` 의 `manual_trigger` 외 트리거 타입 처리. spec 결정 필요.
- **WARN #26** — 매직 스트링 → enum/상수. 광범위 변경.

### P2 — Performance / Testing 모더레이트

- **WARN #12** — `planContainerBody` filter 결과 캐시. ForEach/Loop/Map 컨테이너 한정.
- **WARN #21** — `endAiConversation` 종료 흐름 전체 테스트 (큰 fixture).
- **WARN #22** — `buildConversationConfigFromOutput` 단위 테스트.
- **WARN #24** — container runtime `setTimeout(r, 200)` → `flushPromises()` 통일. **2026-05-09 확인: `execution-engine.service.spec.ts` 등에 5 곳 잔존** (별도 commit `d0910d5f` 의 W4 는 동일 기호의 *다른 review* 항목으로, 본 항목과 별개).

### P3 — INFO 일괄 정리

- **INFO #1, #2** — NodeHandler return 타입 단일화. 광범위 영향.
- **INFO #4** — `EngineRuntimeContext` 분리. 인터페이스 큰 변경.
- **INFO #5** — `adaptHandlerReturn` credential runtime 마스킹.
- **INFO #6, #7, #8** (Performance) — 작은 최적화. 일괄 PR.
- **INFO #2, #3, #4** (Performance — `indexOf` / `[...messages]` / `turnDebugHistory` 스프레드) — 메모리 최적화 일괄.
- **INFO #6, #7** (Side Effect — `ragThreshold` 범위 / `getSources` 참조 노출) — 작은 정리.
- **INFO #9, #10, #11** (Concurrency) — 작은 정리.
- **INFO #12** — JSDoc 보강 (`executeNode`, `NodeHandler`, `ExecutionEngineService`).
- **INFO #14, #15, #16** (Testing) — mockHandler shape, `(service as any)` 패턴, `Partial<Node>` factory.
- **INFO #17** — executeInline trigger pass-through 정리.
- **INFO #19** — executeSync findOneBy 인메모리 활용.

> **주의**: 본 plan 작성 후 `d0910d5f` (review `2026-05-08_19-44-00`, W1~W9 + I1~I9, I11~I13) / `e360ca0a` (review `2026-05-09_00-05-34`, 25/35) 두 commit 이 ai-review 항목들을 처리했지만, **두 commit 모두 PR-1~4 / PR-B 자체에 대한 신규 review** 처리이며 본 plan 의 원본 `2026-05-06_17-27-43` 와는 별개의 review 다. 따라서 위 21건 list 에서 차감되지 않는다.

---

## PR 분할 권장

- ~~**PR-B (P0 분산)**: WARN #2 + WARN #15~~ — 완료 (commits `954dc9c4` + `ebf934e1` + `cd235002`).
- **PR-A (P0 Security)**: CRIT #5 timeout + WARN #4 트랜잭션 (~1일).
- **PR-C (P1 Engine 리팩토링)**: CRIT #2 + WARN #25 (~5일).
- **PR-D (P1 OCP)**: CRIT #3 (~3일).
- **PR-E (P1 Event 추상화)**: WARN #16 + WARN #26 (~2일).
- **PR-F (P2 Testing 보강)**: WARN #21, #22, #24 + INFO #14~16 (~2일).
- **PR-G (P3 일괄 정리)**: INFO 항목들 일괄 (~1일).


## PR-B 상세 계획 — 완료 (archive)

본 plan 의 원본에는 PR-B (`execution_node_log` + Redis pub/sub continuation bus) 의 구현 설계가 ~200 줄에 걸쳐 포함돼 있었으나, 현재 **모두 구현 완료**되어 활성 plan 으로서의 가치가 없다. 설계 의사결정 기록은 다음 출처로 대체:

- 코드 변경: `git log --oneline 1ebdc8a4..HEAD -- backend/src/modules/execution-engine/continuation backend/src/modules/execution-engine/entities/execution-node-log.entity.ts backend/migrations/V03[56]__execution*.sql`
- 분산 실행 / continuation bus / recovery lock 정책: `spec/5-system/4-execution-engine.md` §9 (Redis 키 / 채널 / pub-sub 시퀀스)
- PR-B 자체에 대한 후속 ai-review (35건) 의 처리 내역: `review/2026-05-09_00-05-34/RESOLUTION.md` + commit `e360ca0a` (25/35 처리)

PR-B 후속 미처리 9건은 본 문서에 통합하지 않고 commit `e360ca0a` body 에 명시된 follow-up 분류 (formData 크기 / list executionPath 정책 / SRP 분리 등) 로 별도 트래킹하거나 본 plan 의 위 우선순위 표에 흡수.
