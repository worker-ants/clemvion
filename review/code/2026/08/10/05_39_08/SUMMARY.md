# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. Gate C(spec_impact 강제) + plan lifecycle 가드 리팩터는 spec SoT 와 line-level 로 정확히 일치하고(989/989 테스트 통과 실측), WARNING 3건 모두 구조적 채무(재사용 위치·네이밍·중복 헬퍼) 수준으로 실질 동작 결함은 없다. 5개 reviewer 전원 결과 확보 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability | Gate C 정책 함수(`isGateCEnforced`/`hasMalformedStarted`/`hasValidSpecImpact`/`danglingSpecImpact`/`makeSpecExists`/`GATE_C_CUTOFF`/`NONE_VALUES`)가 `.test.ts` 파일 안에 상주 — 같은 PR 이 `plan-scan.ts` 로 판정 로직 분리 원칙을 세웠는데 이 함수들만 예외. 외부 소비처는 현재 없음(grep 확인) | `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:30-31, 57-134` | `plan-scan.ts` 로 이동. 단 `plan/in-progress/docs-guard-walker-dedup.md` 에 이미 등재된 기존 추적 항목(ai-review 3회 관측)이므로 이번 PR 범위에서 새로 처리 불요 |
| 2 | maintainability | `danglingSpecImpact` 네이밍이 모듈 컨벤션(`find*` 접두 = 필터링된 위반 배열 반환: `findUnparseablePlans`/`findNonTerminalCompletedPlans`/`findFrontmatterViolations`/`findBrokenPlanLinks`)과 불일치. boolean predicate 처럼 읽히지만 실제로는 배열 반환 | `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:96-101` | `findDanglingSpecImpact` 로 개명 |
| 3 | maintainability | frontmatter 블록 생성 헬퍼가 `fm`/`frontmatter` 두 개로 중복 — 파일 서두 주석이 "walker 넉 벌 중복" 을 경계하면서 정작 자신의 fixture 빌더가 두 벌 | `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts:31-32(fm), :217-218(frontmatter)` | `fm` 제거하고 `frontmatter` 로 통일 |
| 4 | testing | `hasValidSpecImpact` 의 `NONE_VALUES` 정규화(trim/toLowerCase)와 `"n/a"`/`"na"` 어휘가 어떤 테스트로도 검증되지 않음 — 이 값들을 빼거나 `.toLowerCase()` 를 제거하는 뮤턴트가 들어와도 스위트 GREEN 유지(직접 검증). 같은 파일의 다른 함수들은 이 원칙을 지키는데 이 부분만 예외 | `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:31(정의), :73·238(정규화 로직), :284-291(불충분한 테스트)` | `it` 에 `hasValidSpecImpact("n/a", exists)`, `("NA", exists)`, `("NONE", exists)`, `("  none  ", exists)` 등 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | "완료 plan 은 파싱 가능해야" 캐너리(전체 `plan/complete/**` 대상)가 `spec-impl-evidence.md §4.2` Gate C 행에 별도 명시 안 됨(코드 JSDoc 은 교차 근거 명확) | `spec-plan-completion.test.ts:175` | §4.2 Gate C 행 비고에 "파싱 실패 완료 plan 은 별도 캐너리" 한 줄 추가(코드 변경 불요) |
| 2 | scope | 한 커밋에 독립적 두 결함 수정(W1: spec/ traversal 정규화, W2: rawScalar 정규식 이스케이프)이 함께 포함 — 커밋 메시지가 명확히 구분 서술, PR 확립된 패턴과 일치 | `spec-plan-completion.test.ts` makeSpecExists / `plan-scan.ts` rawScalar | 조치 불요 |
| 3 | scope / testing | `rawScalar` 의 정규식 메타문자 이스케이프(13종)가 테스트에서는 `.` 한 글자만 검증. 현재 유일 호출부(`"started"` 리터럴)엔 즉시 위험 없는 방어적 하드닝 | `plan-scan.ts:219-221`, 테스트: `plan-scan.test.ts:259-265` | 필수 아님. 여유 있으면 `*`, `(` 등 대표 메타문자 1~2개 추가 |
| 4 | side_effect | `.test.ts` 에서 판정 로직 export → 비공식 공개 인터페이스화. 현재 외부 import 없음(grep 확인). 기결정 사항(`docs-guard-walker-dedup.md`) | `spec-plan-completion.test.ts:57,63,68,96,112` | 현 상태 유지 무방. 재사용 시점에 선행 이동 |
| 5 | side_effect | `makeSpecExists` 는 `fs.statSync`(symlink 추종) 사용 — traversal 가드는 경로 문자열의 `spec/` 하위 여부만 보장, symlink 가 저장소 밖을 가리키면 우회 가능 | `spec-plan-completion.test.ts:112-133` | 저장소에 `spec/` 하위 symlink 관행 없으면 수정 불요. 우려 시 `lstatSync`/realpath 비교 추가 |
| 6 | side_effect | gray-matter `matter(raw, {})` 가 모듈 전역 캐시(`matter.cache`)를 실제로 우회함을 라이브러리 소스 직접 대조로 검증 완료 — 의도된 방어, 결함 없음 | `plan-scan.ts:121-128` | 없음 |
| 7 | maintainability | `toBeGreaterThan(10)` 임계값 선택 근거 미설명(자매 파일 `plan-frontmatter.test.ts` 는 근거 주석 보유) | `spec-plan-completion.test.ts:172` | 근거 한 줄 추가 또는 상수 추출 |
| 8 | maintainability | `startedDate`/`hasMalformedStarted` 가 `rawScalar(block, "started")` 호출을 부분 중복 | `spec-plan-completion.test.ts:47-51, 63-66` | 공유 헬퍼 `rawStarted(block)` 로 통합(낮은 우선순위) |
| 9 | maintainability | 필터 이후 non-null assertion(`!`) 반복 사용 — TS 가 클로저 너머로 좁혀주지 못함 | `spec-plan-completion.test.ts:208, 238` | type predicate 로 `enforced` 필터링(낮은 우선순위) |
| 10 | maintainability | `collectCompletePlans`(private) vs `collectCompletePlanMarkdown`(exported) 이름이 한 단어 차이 — 기존 추적 항목 재확인 | `spec-plan-completion.test.ts:139-141` | `docs-guard-walker-dedup.md` 후속 과제로 이미 등재, 신규 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | LOW | `NONE_VALUES` 정규화/`n-a`·`na` 어휘 미검증(WARNING); `rawScalar` 이스케이프 커버리지 부족(INFO). 전반적으로 순수 함수 추출+합성 fixture+뮤테이션 실측 방법론 우수, 989 테스트 GREEN 확인 |
| requirement | NONE | spec SoT 두 문서와 line-level 완전 일치, spec-drift 없음(동일 체인지셋에서 동기화됨), §4.2 각주 제안 INFO 1건만 |
| scope | NONE | 스코프 이탈 없음, 무관 파일/리팩토링/포맷팅 혼입 없음. walker 통합처럼 스코프 확장 가능했던 지점을 의도적으로 별도 plan 으로 분리(긍정적) |
| side_effect | LOW | 프로덕션 코드/런타임 영향 없음. 실 저장소는 읽기 전용 접근만, fixture 쓰기는 tmpdir 격리+cleanup. symlink 우회 여지·비공식 export 는 INFO |
| maintainability | LOW | Gate C 정책 함수의 `.test.ts` 상주(기존 추적 WARNING), `danglingSpecImpact` 네이밍, `fm`/`frontmatter` 중복 헬퍼(신규 WARNING 2건) |

## 발견 없는 에이전트

없음 — 5개 reviewer 전원이 발견사항(WARNING 또는 INFO)을 보고함.

## 권장 조치사항
1. `hasValidSpecImpact` 의 `NONE_VALUES` 정규화(trim/toLowerCase)와 `"n/a"`/`"na"` 어휘를 겨냥한 합성 fixture 테스트 추가 — 현재 뮤턴트가 생존 가능한 유일한 실질 커버리지 갭.
2. `danglingSpecImpact` → `findDanglingSpecImpact` 로 개명해 모듈 네이밍 컨벤션과 정렬.
3. `plan-scan.test.ts` 의 `fm`/`frontmatter` 중복 헬퍼를 하나로 통합.
4. (낮은 우선순위, 이미 추적 중) Gate C 정책 함수의 `plan-scan.ts` 이동은 `plan/in-progress/docs-guard-walker-dedup.md` 로 계속 forwarding — 이번 PR 범위 밖.
5. (선택) `spec/conventions/spec-impl-evidence.md §4.2` 에 완료 plan 파싱 가능성 캐너리 관련 각주 한 줄 추가.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 5개 reviewer(testing, requirement, scope, side_effect, maintainability) 전원 강제 실행(router_safety forced). 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.