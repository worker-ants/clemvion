# Review Resolution — 06-concurrency M-2 (shutdown 추적 드리프트)

리뷰 SUMMARY: `review/code/2026/06/24/23_15_30/SUMMARY.md`
**위험도 LOW · Critical 0 · Warning 5.** 9 reviewer 전원 success, unfinished 없음.

## 반영 (Addressed)

| # | 카테고리 | 조치 |
| --- | --- | --- |
| W-1 | Testing | shutdown 중 register 된 노드가 grace 내 정상 완료(unregister)→**마킹 미호출** happy-path 테스트 추가. `ne-early` 를 shutdown 전 등록해 drain 루프 진입 보장(inFlightCount=0 이면 즉시 반환하므로), `ne-late` 를 drain 중 등록, 둘 다 unregister → `nodeExecutionUpdateMock`/`executionUpdateMock` not.toHaveBeenCalled. (13 tests pass) |
| W-2 | Testing | 신규 마킹 테스트의 mock chain 직접 순회에 `expect(neChain).toBeDefined()` + `expect(whereCall.where).toHaveBeenCalled()` 가드 추가 — 단계 단절 시 undefined 오탐 대신 명시 실패. |
| INFO-6 | Documentation | 클래스 JSDoc 항목2 에 "shutdown 진입 후 동일 세그먼트가 시작하는 추가 노드도 등록 대상(§11.2 세그먼트 완료 보장, M-2)" 보충. |

## 보류 (Deferred — 근거 명시)

| # | 카테고리 | 사유 |
| --- | --- | --- |
| W-3 | Maintainability | mock chain 순회 패턴의 `extractNeWhereArgs` 헬퍼 추출 — **선재 2개 테스트(SQL WHERE·marking)** + 신규 1개에 걸친 broader test refactor. M-2 의 early-return 제거 범위 밖이라 defer(scope-reviewer NONE 유지). 향후 shutdown 테스트 grooming 백로그. |
| W-4 | Maintainability | `pollMs ?? 200` 인라인 매직넘버 → `DEFAULT_POLL_MS` 상수화 — **M-2 가 건드리지 않은 선재 코드**(생성자). `graceMs`/`DEFAULT_GRACE_MS` 와의 비대칭은 사실이나 early-return 드리프트 수정과 무관해 defer. |
| W-5 | Requirement | W-2 와 동일(mock chain undefined 오탐) — 신규 테스트는 W-2 로 가드 적용, 선재 테스트는 W-3 와 함께 defer. |
| INFO-1 | Architecture | `fromConfig` static factory dead-API 의심 — 본 변경 무관, 별도 확인 필요(defer). |
| INFO-2/5/7 | Doc | lock-free 근거 주석·`@param` 태그·`waitForDrain` 반환 시맨틱 — optional 폴리시, defer. |
| INFO-3/4/12 | Arch/Concurrency | WorkerControlPort 추상화·event-driven drain·스냅샷 race window — 모두 "현재 문제 없음/중장기" INFO, defer. |
| INFO-8 | Doc | `spec §11 Rationale` + plan M-2 옵션표 갱신 — plan 옵션표 권장 B→A 는 본 PR 의 plan 갱신에서 처리(impl-prep consistency W-1 동일). spec §11 Rationale "신규 consume 중단=WorkerHost close, queue.pause 금지" 보충은 **optional planner 후속**(M-2 spec 변경 불요 판정이라 비차단). |
| INFO-9/10/11 | Testing | unregister 단위·Map 중복등록 count·타이밍 flakiness — 선택적 보강, defer(신규 happy-path 가 핵심 경로 커버). |

## 재검증

review-fix 후: prettier clean, lint·unit(신규 happy-path 포함, full green) PASS. production 변경은 JSDoc-comment-only 라 build·e2e(직전 214 PASS) 무영향.
