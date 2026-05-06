# AI Review Deferred Items — 후속 PR 백로그

## 배경

ai-review 2026-05-06_17-27-43 에서 발견된 51건 중 본 PR (Phase 1 quality + 후속 조치) 에서 처리하지 못한 23건의 후속 처리 백로그. 자세한 내용은 `review/2026-05-06_17-27-43/SUMMARY.md` + `RESOLUTION.md`.

## 우선순위 분류

### P0 — Security / Correctness (즉시 별도 PR)

- **CRIT #5 (timeout 경로 테스트)** — executeSync 의 timeout 분기 테스트. graph traversal hang 셋업 필요.
- **WARN #4** — RUNNING ↔ WAITING_FOR_INPUT 상태 전이 트랜잭션. `DataSource` 주입 + 영향 범위 전수 검토.
- **WARN #2** — `executionPathChain` 분산 환경 대응. 별도 테이블 / 낙관적 잠금 / Redis pub-sub. 인프라 결정 + DB 스키마 변경.

### P1 — Architecture (큰 리팩토링, 별도 PR 단위)

- **CRIT #2** — `runExecution` / `executeInline` ~200줄 중복 추출. 안전한 추출은 며칠 작업급.
- **CRIT #3** — OCP 위반 node type 문자열 분기 → Strategy 패턴 / NodeHandler 메타데이터. 26개 핸들러 영향.
- **WARN #25** — `waitForAiConversation` 280줄 분해 (`emitWaitingForInput` / `handleAiMessage` / `handleAiEndConversation` / `finalizeAiNode`).
- **WARN #15** — `pendingContinuations` Map → Redis pub/sub. 수평 확장 인프라.
- **WARN #16** — `forwardRef(WebsocketService)` → `IExecutionEventEmitter` 추상화.
- **WARN #17 (Arch)** — `executeInline` 의 `manual_trigger` 외 트리거 타입 처리. spec 결정 필요.
- **WARN #26** — 매직 스트링 → enum/상수. 광범위 변경.

### P2 — Performance / Testing 모더레이트

- **WARN #12** — `planContainerBody` filter 결과 캐시. ForEach/Loop/Map 컨테이너 한정.
- **WARN #21** — `endAiConversation` 종료 흐름 전체 테스트 (큰 fixture).
- **WARN #22** — `buildConversationConfigFromOutput` 단위 테스트.
- **WARN #24** — container runtime `setTimeout(r, 200)` → `flushPromises()` 통일.

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

## PR 분할 권장

- **PR-A (P0 Security)**: CRIT #5 timeout + WARN #4 트랜잭션 (~1일)
- **PR-B (P0 분산)**: WARN #2 + WARN #15 (인프라 결정 후 ~3일)
- **PR-C (P1 Engine 리팩토링)**: CRIT #2 + WARN #25 (~5일)
- **PR-D (P1 OCP)**: CRIT #3 (~3일)
- **PR-E (P1 Event 추상화)**: WARN #16 + WARN #26 (~2일)
- **PR-F (P2 Testing 보강)**: WARN #21, #22, #24 + INFO #14~16 (~2일)
- **PR-G (P3 일괄 정리)**: INFO 항목들 일괄 (~1일)

## 클로저

각 PR 완료 시 본 문서의 해당 섹션을 체크 후 `plan/complete/` 로 git mv. 모든 PR 완료 시 본 문서 자체도 완료 이동.
