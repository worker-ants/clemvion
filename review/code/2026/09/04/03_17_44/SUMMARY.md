# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 기능 결함은 CRITICAL/WARNING 급 없음(6 suites/117 tests, 8 suites/142 tests 전부 PASS, 뮤테이션 재현으로 판정 로직 유효성 재확인). 유일한 WARNING 급은 **직전 라운드(3R→4R, 커밋 `59a229943`/`f6358ec0a`)가 "검증 안 되는 숫자 제거"를 하다 남긴 순수 프로세 결함**(단어 중복 2건 + 날짜 없는 실측 주장의 자매 파일 미반영 1건)이며, documentation reviewer 가 이를 근거로 MEDIUM 을 매겼다. forced reviewer 7명(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation, maintainability | 4R 커밋(`59a229943`)이 "실측 20건" 하드코딩을 지우다 앞 줄의 `그 근거와`를 정리하지 않아 `"그 근거와 근거는 그쪽 docstring 에 있다"`(단어 중복·문법 붕괴)가 됨 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:221-222` (`findStaleSpecCasts` JSDoc) | `"그 근거는 그쪽 docstring 에 있다."`로 중복 어절(`근거`) 정리 |
| 2 | documentation, maintainability | 같은 커밋이 plan 문서에서 `135 → 115`를 날짜 박힌 서술로 바꾸며 앞 줄 끝의 `판정 대상`을 지우지 않아 `"판정 대상 판정 대상이 그만큼 줄어든다"`(단어 중복)가 됨. 이 plan 문서 자신이 "한 자리만 고치는 버릇"을 4회 자인한 바로 그 문서에서 5번째 사례가 재발 | `plan/in-progress/entity-nullable-column-type-mismatch.md:277-278` | `"…최소 픽스처로 재현). 판정 대상이 그만큼 줄어든다(**2026-09-04 실측 135 → 115**)."`로 중복 어절 제거 |
| 3 | documentation | 후속 커밋(`f6358ec0a`)이 "날짜 없는 '실측' 주장"을 훑어 고쳤다고 자평했지만, `isNullableType` docstring 과 동일한 주장을 담은 **자매 spec 파일 사본**(`오늘 저장소는 전부 T \| null`)을 놓침 — 스윕 범위가 "grep 전수"가 아니라 방금 편집한 파일로 좁혀졌을 가능성 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:238-241` | `오늘` 제거하고 `(**2026-09-04 실측**, 리뷰 3R INFO#4)` 형태로 날짜 박기. 재발 방지로 커밋 메시지에 실제 grep 명령·매치 수 기록 권장 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 4 | requirement | `stripComments`→`stripLiterals` 합성 순서상, URL 등 `//`를 포함한 문자열 리터럴이 캐스트보다 앞줄에 오면 `stripComments`가 먼저 그 줄을 잘라 캐스트를 놓친다(위음성, 재현 스크립트로 실측). 현재 저장소 실사례 0건 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:237` | 순서를 `stripComments(stripLiterals(x))`로 뒤집으면 원천 차단(부작용 없음 확인) — 선택적 fix, 문서화만으로도 충분 |
| 5 | requirement | `SPEC_CAST` 정규식이 `field: null as unknown as X` 형태만 매치하고 `obj.field = null as unknown as X` 대입문 형태는 구조적으로 못 봄(위음성). 현재 실사례는 가드 자신의 픽스처 문자열 3건뿐 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:203` | 정규식 확장 또는 "대입문 형태는 안 본다"를 docstring 에 명시 |
| 6 | architecture | `stripLiterals` 적용이 `findStaleSpecCasts`(신규)에만 있고 자매 함수 `countNullAsUnknownAsCasts`/`findCastOffenders`(프로덕션 소스 대상)에는 없음 — 이 모듈 자신의 "한쪽만 하드닝 금지" 원칙과 어긋나는 비대칭. 스캔 대상이 `.spec.ts`를 구조적으로 제외해 오늘은 무해 | `codebase/backend/src/common/__test-utils__/source-scan.ts:192-197` vs `nullable-type-lie-cast-guard.ts:237` | docstring 에 "왜 이 함수는 stripLiterals 를 안 쓰는가" 한 줄 추가 |
| 7 | architecture | `source-scan.ts`가 "세는 축의 단일 출처"에서 네 가지 관심사(전처리/범용 카운팅/가드 전용 카운팅/파일시스템 순회)를 담은 공유 커널로 확장 중 — 향후 God Module 화 위험(현재 272줄은 문제 아님) | `codebase/backend/src/common/__test-utils__/source-scan.ts:1-22` | 지금 조치 불요. 다음 프리미티브 추가 시 "범용 축 vs 가드 전용" 구분해 분리 검토 |
| 8 | scope | plan 문서에 완료 마킹 범위를 넘는 두 회고 섹션("한 자리만 고치는 버릇"·숫자 규약)이 함께 커밋됨 — 이 plan 자신의 사건만 다뤄 저장소 관례상 무관하지 않음 | `plan/in-progress/entity-nullable-column-type-mismatch.md:289-313` | 조치 불요. 필요시 커밋 메시지에 회고 반영 사실 한 줄 |
| 9 | scope, side_effect | `collectTsFiles` 통합 중 `masked-reject-callers-guard.ts` 등 3개 가드의 파일 필터가 조용히 넓어짐(`.d.ts`/vendor 배제·정렬이 원래 없었음) — 파일 집합 완전 동일함을 실측·문서화로 이미 확인(무해) | `masked-reject-callers-guard.ts:47-52`, `audit-action-binding-guard.ts:47-48`, `engine-error-code-anchor-guard.ts` | 조치 불요(기 문서화). `src/` 밑에 `.d.ts` 신설 시 재검토 |
| 10 | performance | 신규 `describe('저장소 전수', ...)` 블록이 같은 spec 파일 안에서 `collectTsFiles(SRC_ROOT)` 전체 재귀 스캔을 기존 `collectScanTargets()`와 중복 포함해 3회 수행(그중 2회 완전 중복). 실측 3회 합산 ≈16ms — 절대 비용은 작지만 `collectTsFiles` 도입 목적("중복 스캔 제거")과 배치됨 | `nullable-type-lie-cast.spec.ts:394-399` (vs 기존 `:81`) | 상단에서 1회(`includeSpec:true`)만 스캔하고 `.filter()`로 세 뷰 파생 |
| 11 | performance | `widenedEntityFields(entities)`가 같은 describe 블록의 두 `it`에서 각각 재계산됨(순수 함수, 캐시 없음). 41개 파일 기준 1회 ≈1~2ms | `nullable-type-lie-cast.spec.ts:407-408`, `:411-414` | `describe` 상단에서 1회 계산해 두 `it`이 공유 |
| 12 | side_effect | 5개 walker 사본이 `collectTsFiles` 하나로 수렴돼 결함 표면(blast radius)이 한 곳에 집중 — 전용 테스트로 하드닝돼 있어 실질 위험 낮음 | `source-scan.ts:249`(`collectTsFiles`) 및 5개 소비 가드 | 조치 불요. 이후 `collectTsFiles` 변경 시 5개 소비처 동시 인지 |
| 13 | testing, maintainability | `WIDENED_DECL`의 "추가 데코레이터 최대 1개" 한계에 pinning 테스트 없음 — 3라운드 연속 검토 끝에 "저장소 전수에 그 형태 없음"으로 의도적 유예된 결정, 재개 트리거 명시돼 있음 | `nullable-type-lie-cast-guard.ts:168-169` | 조치 불요(기 처분). 참고 기록만 |
| 14 | maintainability | `collectTsFiles` 위임 1줄 래퍼 4개(`collectSourceFiles`/`listSourceFiles`/`collectScanTargets`/`listProductionSources`)의 이름이 서로 다름 — 2R·3R·4R 에서 "5개 가드 공개 표면을 동시에 바꾸는 별건"으로 이미 유예 확정, 이번 라운드 코드 변경 없음 | 4개 repo-guard 파일 | 조치 불요(기 유예). 5개 가드 중 하나를 다시 만질 기회에 통일 고려 |
| 15 | security | `stripComments`/`stripLiterals`/`countRawUpdateReturning`/`WIDENED_DECL` 정규식에 이론적 ReDoS 표면(백트래킹 가능 패턴) 존재하나, 입력이 항상 저장소 자신의 신뢰된 소스 트리이고 외부 공격자 입력 경로가 없어 실질 위험 없음 | `source-scan.ts:53,77,157`, `nullable-type-lie-cast-guard.ts:169` | 조치 불요. 사용자 제공 소스 재사용 계획 생기면 재평가 |
| 16 | security | `masked-reject-callers-guard.ts`의 AST 기반 `importsBaseFn`은 `collectTsFiles(includeSpec:true)`로의 전환에 의존하는데, `source-scan.spec.ts`의 전용 단위테스트가 그 정합성을 직접 단언해 탐지 범위 축소(회귀) 없음을 확인 | `masked-reject-callers-guard.ts` (`importsBaseFn`) | 조치 불요 |
| 17 | security | 이전 리뷰 세션 상태 파일(`_retry_state.json`/`meta.json`)에 API 키·토큰 등 하드코딩된 시크릿 없음 | `review/code/2026/09/04/01_48_39/{_retry_state.json,meta.json}` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | ReDoS 는 이론적(공격 경로 없음), 시크릿 없음, AST 전환 하드닝 확인 |
| performance | LOW | describe 블록 내 `collectTsFiles`/`widenedEntityFields` 중복 계산(순수 리팩터로 해소 가능, 절대 비용 작음) |
| architecture | LOW | `stripLiterals` 적용 비대칭(문서화 갭), `source-scan.ts` God Module 화 잠재 위험 |
| requirement | LOW | 두 가지 미문서화 위음성 경로(주석-리터럴 합성 순서, 대입문 형태 미탐지) — 실사례 0건 |
| scope | NONE | 변경 파일 9개 전부 plan 등재 항목에 직결, 관례 부합 |
| side_effect | LOW | 5 walker 통합으로 blast radius 집중(실측 무해), 3개 가드 필터 조용히 확대(기 문서화) |
| maintainability | LOW | 4R 편집이 남긴 단어 중복 2건(코드 1·plan 1) — documentation 과 중복 지적 |
| testing | LOW | 새 갭 없음. 6/117·8/142 전부 PASS, 뮤테이션으로 판정 로직 실증. `WIDENED_DECL` 한계는 기 유예 |
| documentation | MEDIUM | 4R→후속 커밋의 "검증 안 되는 숫자 제거" 작업이 단어 중복 2건 + 날짜 없는 실측 주장 자매 파일 누락 1건을 새로 남김 |

## 발견 없는 에이전트

없음 — 9명 전원 최소 INFO 이상 보고.

## 권장 조치사항

1. `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:221-222` 의 `"그 근거와 근거는"` 중복 어절 정리 (WARNING #1)
2. `plan/in-progress/entity-nullable-column-type-mismatch.md:277-278` 의 `"판정 대상 판정 대상이"` 중복 어절 정리 (WARNING #2)
3. `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:238-241` 의 `오늘 저장소는 전부 T | null` 문구에 날짜 박기(자매 파일 스윕 누락 보완) (WARNING #3)
4. (선택) requirement INFO #4·#5 — 위음성 경로 2건: `stripComments`/`stripLiterals` 합성 순서 뒤집기, `SPEC_CAST` 대입문 형태 대응 — 현재 실사례 없어 필수는 아니나 간단한 fix 로 원천 차단 가능
5. (선택) performance INFO #10·#11 — `nullable-type-lie-cast.spec.ts` 의 `describe('저장소 전수', ...)` 블록 스캔 1회로 통합, `widenedEntityFields` 결과 공유
6. 그 외 INFO(architecture #6·#7, scope #8·#9, side_effect #12, testing/maintainability #13·#14, security #15~#17)는 전부 이미 처분됐거나 실질 위험이 없어 조치 불필요 — 참고만

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation` (9명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨, 화이트리스트 미이행 없음
  - **제외**: 아래 표 (5명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터 판단(이번 diff 는 신규 의존성 추가 없음 — security/side_effect 리뷰가 별도로 재확인) |
  | database | 라우터 판단(이번 diff 는 DB 마이그레이션/쿼리 로직 변경 없음 — 정적 test-tooling 리팩터) |
  | concurrency | 라우터 판단(런타임 동시성 표면 변경 없음 — 빌드/CI 타임 정적 가드) |
  | api_contract | 라우터 판단(API/DTO 계약 변경 없음 — scope 리뷰가 재확인) |
  | user_guide_sync | 라우터 판단(사용자 대면 문서·가이드 변경 없음 — 내부 test-tooling 전용) |