# RESOLUTION — C-1 후속 ① (EngineDriver @internal 대칭 + graph/dispatch 타입 leaf 이동)

ai-review: `review/code/2026/06/19/01_41_04` (RISK=LOW · Critical 0 · Warning 4)
impl-done consistency: `review/consistency/2026/06/19/01_58_07` (**BLOCK: NO** · 5 checker NONE)
대상 커밋: `29e38a38`(impl) + `8a9d8a06`(review INFO 주석 반영)

## 조치 항목

| SUMMARY # | 카테고리 | 분류 | 조치 / 근거 | commit |
|---|---|---|---|---|
| W-1 | Architecture | 이연 | god-class 미완 분해는 pre-existing. C-1 후속 ④(forwardRef 제거) + PR-H/I 점진 분해 백로그. 본 PR 범위 외 | — |
| W-2 | Architecture | 이연 | forwardRef 4개 순환 DI = **C-1 후속 ④ (양방향 forwardRef 순환 DI 제거)** 백로그 항목 그 자체. 본 변경의 타입순환 해소 방향은 reviewer 도 "올바름" 평가 | — |
| W-3 | SideEffect | 검증·해소 | export 경로 변경 컴파일 브레이킹 우려 → 소비자 전수 grep: `engine-driver.interface.ts` + `execution-engine.service.ts` 2곳뿐(둘 다 새 leaf 로 갱신), 외부 소비자 0. backend `npm run build`(tsc) clean 통과로 실증 | 29e38a38 |
| W-4 | Documentation | 미도입·오탐 | reviewer 줄번호 환각(import 을 L264 주장, 실제 L122; tombstone "2곳" 주장, 실제 L395 1곳). 클래스 JSDoc(L367–390) 분리는 사이의 `isAbortError`(L410)로 인한 **pre-existing** — 본 변경은 70줄 인터페이스를 3줄 tombstone 으로 줄여 오히려 분리구간 축소. 클래스 JSDoc 이동은 scope 외(scope reviewer NONE) | — |
| INFO #3 | Maintainability | 조치 | EngineDriver 클래스 JSDoc 에 "모든 멤버는 ENGINE_DRIVER 전용 / step4 5멤버만 impl 대칭 @internal 명시" 추가 → 5-vs-7 비대칭 설명 (초기 7멤버는 impl 도 @internal 미보유라 멤버별 대칭상 제외) | 8a9d8a06 |
| INFO #6 | Documentation | 조치 | `execution-engine.service.ts` 신규 import 에 C-1 step 주석 추가 | 8a9d8a06 |
| INFO #7 | Documentation | 조치 | `engine-driver.interface.ts` import 경로 변경 이유 주석 추가 | 8a9d8a06 |
| INFO #9 | Documentation | 조치 | `NodeDispatchLoopParams.executionId` 필드 JSDoc 추가 | 8a9d8a06 |
| INFO #1 | SPEC-DRIFT | 이관(planner) | spec §Rationale C-1 EngineDriver 멤버 목록이 3개 예시(실제 12개). pre-existing spec staleness(본 변경이 멤버 수 변경 안 함). developer 는 spec read-only → **planner 후속**으로 `c1-engine-split.md` 에 기록 | — |
| INFO #2 | Architecture | 수용 | `@internal` vs `public` 충돌 → facade 도입은 C-1 후속 ④ 영역. 현 단계 문서화 정책으로 수용(reviewer 도 동의) | — |
| INFO #4 | Architecture | 수용 | `dispatchMeta` 인라인 타입 = **verbatim 이동된 기존 shape**(본 변경 미도입). `DispatchMeta` 추출은 별도 grooming | — |
| INFO #5 | Maintainability | 오탐 | tombstone "이중화" → 실제 1곳(L395)뿐. reviewer 줄번호 환각 | — |
| INFO #8 | Documentation | 수용 | `@module` 태그 부재 → 기존 leaf 파일(`engine-driver.interface.ts`·`workflow-errors.ts` 등) 동일하게 floating docstring. **모듈 관행 일치** | — |
| INFO #10 | Security | 이연 | `failFirstSegmentSetup` 에러 노출 = pre-existing, diff 외. 보안 grooming 백로그 | — |
| INFO #11 | Security | 이연 | `assertSameWorkspace` fail-open = pre-existing, diff 외. **C-1 후속 ★(assertSameWorkspace fail-closed)** 백로그 항목 (reviewer 독립 재확인) | — |
| INFO #12 | Testing | 수용·선택 | `ExecutionCancelledError` sentinel 테스트 = "필수 아님"(testing reviewer NONE). 기존 suite 가 `instanceof` 경로 커버. 별도 grooming 가능 | — |

**신규 Critical/Warning: 0.** Warning 4건은 전부 pre-existing 백로그/검증완료/오탐. INFO 중 본 변경 귀속 4건(#3/6/7/9) 조치, 나머지는 수용/이연/이관.

## TEST 결과

- **lint**: 통과 — backend `eslint --fix`, 변경 외 파일 무수정 (git status 확인)
- **unit**: 통과 — backend execution-engine scoped, **33 suites / 805 tests**
- **build**: 통과 — backend `npm run build`(tsc) clean (타입 이동·import 정합 실증)
- **e2e**: 통과 — dockerized `make e2e-test`, **34 suites / 202 tests** ("Ran all test suites"; "Jest did not exit" 는 open-handle teardown 경고로 양성, C-1 PR1–4 동일)

> backend-scoped lint/unit/build 근거: 본 변경은 backend-internal(타입 이동 + JSDoc 주석)로 frontend import 경로와 무관(`ExecutionGraphState`/`NodeDispatchLoopParams` 는 module-internal). C-1 PR2–4 선례와 동일(execution-engine scoped + dockerized e2e full). 주석-only 인 `8a9d8a06` 은 컴파일 산출물 동일이라 e2e 무영향(lint·build 재통과로 확인).

## 보류·후속 항목

- **SPEC-DRIFT INFO #1** (Rationale EngineDriver 멤버목록 3→12 stale) → **planner 후속**. `c1-engine-split.md` 후속 단락에 기록.
- **W-1 / W-2 / INFO #2** → **C-1 후속 ④ (양방향 forwardRef 순환 DI 제거)** 백로그.
- **INFO #11** → **C-1 후속 ★ (assertSameWorkspace fail-open → fail-closed)** 백로그.
- **INFO #10** → 보안 grooming 백로그 (failFirstSegmentSetup serverDetail 분리).
- **INFO #4 / #12** → 선택적 grooming (DispatchMeta 타입 추출 · ExecutionCancelledError sentinel 테스트).
