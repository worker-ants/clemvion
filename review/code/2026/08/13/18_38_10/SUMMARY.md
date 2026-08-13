# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL/WARNING 급 코드 결함 없음. 유일한 WARNING 은 3라운드째 살아 있는 문서-추적성 결함(오배치 JSDoc 이 plan 백로그 등재에서 빠짐)이며, 실질 코드 변경(`assertRowArray` 4곳 하드닝)은 9개 reviewer 전원이 NONE~LOW 로 판정했다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | `chat-channel.dispatcher.spec.ts` 의 오배치 JSDoc(703-714행, 실제 대상은 66줄 뒤 `describe`)이 3라운드째(`17_15_21`→`18_00_11`→`18_19_33`) 유예됐고, `18_19_33` 라운드가 바로 그 `describe` 블록에 신규 테스트를 추가하는 "실질 변경"이었음에도 이 항목이 언급되지 않았다. 이후 `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 후속 백로그 절에도 캐스트 리터럴 1건만 등재되고 이 JSDoc 항목·pass-through 래퍼·네이밍 불일치 3건은 등재되지 않아, "무조치로 넘긴다"는 결정 자체가 SoT 에서 추적 불가능해졌다. | `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts:703-714` (대상: `:769`) | JSDoc 블록을 `:769` `describe(...)` 선언 바로 위로 이동. `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 `.query() 반환 shape 하드닝 — 남은 후속` 절에 이 3건(오배치 JSDoc·pass-through 래퍼·네이밍 불일치)을 명시적으로 등재해 무조치 결정을 추적 가능하게 남길 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | 회귀 가드 테스트가 두 서비스 모듈의 raw-query 호출 지점 개수를 하드코딩된 `FILES` 목록으로 결합(공용 유틸 테스트가 상위 모듈 내부를 역참조) | `codebase/backend/src/common/utils/assert-row-array.spec.ts:54-58` | 조치 불요(이미 문서화된 트레이드오프). 후속 raw-query 전역 감사 시 AST 기반 전역 스캔으로 대체 고려 |
| 2 | 아키텍처 | `SNAPSHOT_CACHE_MAX_ENTRIES` export 전환으로 캡슐화 경계가 테스트 접근 목적으로 소폭 확대 | `codebase/backend/src/modules/executions/executions.service.ts:64` | 조치 불요. 외부 소비자 등장 시 재검토 |
| 3 | 요구사항 | `asserts` 타입 프레디킷은 Jest(ts-jest 타입 strip)로 컴파일 타임 좁힘이 검증되지 않음 — 헬퍼 spec 자신이 이미 정확히 문서화(typecheck ratchet 스크립트 몫) | `codebase/backend/src/common/utils/assert-row-array.spec.ts:10-13` | 조치 불요 — 이미 정확히 문서화됨 |
| 4 | 부작용 | `admitExecutionOrDefer` throw 시 `releaseExecutionRouting` 무조건 호출 추가 — 호출부 단일성·기존 `deferred` 분기와의 대칭 확인, 새 결함 아님 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3681-3684` | 조치 불요 |
| 5 | 부작용 | `computeChainDepth` 가 non-array 응답에 "조용한 fail-open"에서 "throw"로 인터페이스 변경 — `reRun` API 가 해당(희박한) 조건에서 500 반환하게 됨. 호출 전 DB 쓰기 없어 부분 상태 위험 없음, 의도된 정확성 수정 | `codebase/backend/src/modules/executions/executions.service.ts:325-329`, 호출부 `:395` | 조치 불요. 더 진단 가능한 응답 코드로 노출할지는 별도 백로그로 검토 가치 있음 |
| 6 | 부작용 | 4개 호출부 예외 메시지 문구가 헬퍼 추출로 재구성 — 문자열 매칭 기반 외부 모니터링이 있다면 매칭 끊길 수 있음(이전 라운드 재확인) | `codebase/backend/src/common/utils/assert-row-array.ts:20-24` 외 4개 소비부 | 조치 불요 |
| 7 | 유지보수성 | `buildDispatcherForNull()` 이 인자 없이 `makeDispatcherHarness()` 를 그대로 호출하는 1줄 pass-through 래퍼(재발, 유예됨) | `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts:765-767` | `buildDispatcherForNull` 제거, 호출부에서 `makeDispatcherHarness()` 직접 사용(선택) |
| 8 | 유지보수성 | fixture 빌더 네이밍 컨벤션 혼재 — `make*` 1개 vs `build*` 3개(재발, 유예됨) | `chat-channel.dispatcher.spec.ts:723,765,770,843` | `makeDispatcherHarness` → `buildDispatcherHarness` 리네임(선택) |
| 9 | 유지보수성 | `dispatcher as unknown as {...}` 인라인 타입 캐스트가 2→4곳으로 확대(재발, 유예됨) | `chat-channel.dispatcher.spec.ts:795,823` (신규), `:889,907` (기존) | 로컬 타입 별칭으로 4곳 통합(선택, 심각도 낮음) |
| 10 | 테스트 | `assertRowArray` 엣지케이스가 array-like 비-`Array` 값(`{length:0}` 등)을 커버하지 않음 — 실제 pg 드라이버가 이런 shape 반환할 가능성 사실상 0 | `codebase/backend/src/common/utils/assert-row-array.spec.ts` `it.each` 블록 | 조치 불요, 기록만 |
| 11 | 문서화 | `SNAPSHOT_CACHE_MAX_ENTRIES` export 이유 주석이 자매 상수 `MAX_EXECUTION_PATH_ROWS` 와 달리 없음(재확인, 유예됨) | `executions.service.ts:64` | 조치 불요 |
| 12 | 데이터베이스 | `updateExecutionStatus` 가드는 트랜잭션 밖 단일 UPDATE 라 throw 해도 이미 커밋된 UPDATE 를 되돌리지 못함 — 목적은 데이터 정합성 보호가 아니라 진단(관측 불가 유실을 관측 가능한 실패로 전환)이며 이는 코드 주석에 이미 정확히 기록됨 | `execution-engine.service.ts` `updateExecutionStatus` (~8490-8528행) | 조치 불요. 향후 이 UPDATE 결과에 파생 쓰기가 추가되면 명시적 트랜잭션 승격 검토 |
| 13 | 스코프 | 워크트리명("eia-r8-cache-scope")과 실제 작업("backlog-final-three")이 불일치 — 누적형 plan tracker 가 이전 턴 worktree 이름을 재사용한 흔적, 코드 스코프 위반 아님 | `plan/in-progress/backend-lint-gate-broken-on-main.md` frontmatter | 조치 불요. 향후 신규 백로그는 `ensure-worktree.sh` 로 새 worktree 생성 권장 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 결함 없음. 오히려 `computeChainDepth` fail-open(RR-PL-05 우회) 결함을 닫는 방어적 강화로 평가 |
| architecture | NONE | `assertRowArray` 추출은 SRP/OCP 만족하는 적절한 추상화, 레이어 경계·의존 방향 안전. INFO 2건(테스트 결합, export 확대)만 |
| requirement | NONE | 4개 호출부 판정 로직 불변 확인, spec(RR-PL-05, fail-closed 원칙)과 line-level 정합. TODO/FIXME 없음 |
| scope | NONE | 실질 코드 변경 3파일로 국한, 전부 plan/선행 리뷰가 요구한 후속 조치에 1:1 대응. 요청 이상 확장 없음 |
| side_effect | NONE | 신규 부작용 2건(routing release 대칭화, computeChainDepth throw 전환) 모두 의도된 방향, 신규 회귀 없음 |
| maintainability | LOW | 실질 코드는 양호. `chat-channel.dispatcher.spec.ts` 스타일성 INFO 4건은 전부 재발(이미 유예됨) |
| testing | NONE | 4라운드 선행 리뷰 핵심 주장(사각지대 정규식 수치, LRU 방향, 로그 레벨 분기, 격리) 전부 독립 재검증하여 일치 확인 |
| documentation | LOW | TSDoc/인라인 주석 품질 우수. 유일한 WARNING(오배치 JSDoc 이 plan 백로그 등재 누락)은 신규가 아니라 3라운드째 재발 |
| database | NONE | 트랜잭션 경계와 가드 목적(정합성 보호 vs 진단) 정확히 일치. 인젝션 표면·인덱스 영향 없음 |

## 발견 없는 에이전트

security, architecture, requirement, scope, side_effect, testing, database — CRITICAL/WARNING 없음(NONE 위험도, INFO 는 참고표 반영).

## 권장 조치사항

1. `chat-channel.dispatcher.spec.ts:703-714` 의 JSDoc 블록을 실제 대상인 `:769` `describe(...)` 선언 바로 위로 이동한다.
2. `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 `.query() 반환 shape 하드닝 — 남은 후속` 절에 오배치 JSDoc·`buildDispatcherForNull` pass-through 래퍼·fixture 네이밍 불일치 3건을 명시적으로 등재해 "무조치로 넘긴다"는 결정을 추적 가능하게 남긴다(현재 캐스트 리터럴 1건만 등재돼 있음).
3. (선택, 낮은 우선순위) `buildDispatcherForNull` 제거하고 호출부에서 `makeDispatcherHarness()` 직접 사용, fixture 빌더 네이밍(`make*`/`build*`) 통일, 인라인 타입 캐스트 4곳을 로컬 타입 별칭으로 통합.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced 전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 해당 diff 범위에서 저관련 |
  | dependency | router 판단상 해당 diff 범위에서 저관련 (신규/변경 의존성 없음) |
  | concurrency | router 판단상 해당 diff 범위에서 저관련 |
  | api_contract | router 판단상 해당 diff 범위에서 저관련 (신규 API/엔드포인트 없음) |
  | user_guide_sync | router 판단상 해당 diff 범위에서 저관련 (사용자 가이드 영향 없음) |
