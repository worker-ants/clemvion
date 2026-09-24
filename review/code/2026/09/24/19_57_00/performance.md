# 성능(Performance) 리뷰 — `pending-plan-is-plan`

## 검토 범위

실질 코드 변경은 파일 1~3 (`spec-frontmatter-parse.ts` 의 `isPendingPlanPath` 신설 + 두 테스트
파일)이다. 파일 4~5 는 plan 문서, 파일 6~13 은 `review/consistency/...` 아래의 정적 마크다운/JSON
리포트 산출물로, 실행 경로가 없는 문서이므로 성능 관점 분석 대상에서 제외한다.

## 발견사항

### INFO — 신설 술어는 상수 시간, 별도 조치 불요

- 위치: `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts` — `isPendingPlanPath` 함수, `PENDING_PLAN_DIRS` 상수 (게이트 95~101줄)
- 상세: `path.posix.normalize` 1회 + `endsWith(".md")` + 길이 2인 배열에 대한 `some(startsWith)`. 입력은 `pending_plans:` 항목 하나(짧은 상대경로 문자열)이고, 호출 총량은 현재 코퍼스 기준 27개 spec × 항목 수(문서상 27건, 1+27×2=55 테스트)로 상한이 뚜렷하다. 시간/공간 모두 O(1)에 가깝고 정규식·Set 등 과한 자료구조 없이 필요한 만큼만 썼다(선례 `isApplicable` 과 동일 패턴). `PENDING_PLAN_DIRS` 를 모듈 스코프 상수로 뽑아 호출마다 재생성하지 않는 점도 적절하다.
- 제안: 없음. 이 규모·호출 빈도에서는 최적화 여지가 사실상 없다.

### INFO — 테스트 가드의 동기 `fs.existsSync` 이중 호출은 이번 diff 로 인한 변화가 아님

- 위치: `codebase/frontend/src/lib/docs/__tests__/spec-pending-plan-existence.test.ts` — `it(\`pending_plan path resolves`, ...)` 블록 (게이트 56~65줄)
- 상세: `pending_plans` 항목마다 `fs.existsSync` 를 최대 2회(동기) 호출하는 기존 로직은 이번 변경이 건드리지 않았다. 이번 diff 는 그 앞에 `isPendingPlanPath` 검사를 이용한 `it` 블록 하나를 추가했을 뿐이며, 둘 다 순수 CPU 계산(정규화/문자열 비교)이라 블로킹 I/O 부담이 늘지 않았다. Vitest 테스트 하니스에서 동기 `fs` 호출은 일반적인 패턴이고 27건 규모에서 무시할 수준이다.
- 제안: 없음(관찰만 — 회귀 아님).

### INFO — `collectApplicableSpecs` 트리 워크는 테스트 스위트당 반복 실행되나 스코프 밖

- 위치: `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts` — `collectApplicableSpecs`/`parseSpecFile` (게이트 103~136줄, 이번 diff 로 신규 도입되지 않음)
- 상세: 각 테스트 파일(`spec-frontmatter-parse.test.ts`, `spec-pending-plan-existence.test.ts` 등 4개 가드)이 독립적으로 `collectApplicableSpecs(root)` 를 호출해 spec 트리 전체를 재순회·재파싱한다. 캐시가 없어 프로세스당 N회(가드 개수) 중복 I/O 가 발생하지만, 이 구조는 이번 diff 이전부터 존재했고 이번 변경 범위(`isPendingPlanPath` 추가)와 무관하다.
- 제안: 이번 PR 범위 밖 — 필요하다면 별도 항목으로 트래커에 등재할 사안(테스트 실행 시간 단축이 목적일 때만 유의미).

## 요약

이번 변경의 실질 코드는 순수 술어 함수 `isPendingPlanPath` 하나이며, 문자열 정규화 1회 + 길이 2 배열에 대한 prefix 비교로 시간·공간 모두 상수급이다. N+1 호출, 불필요한 객체 생성, 캐싱 누락, 블로킹 I/O 병목, O(n²) 문자열 누적 등 점검 관점에 해당하는 패턴이 전혀 없다. 테스트 가드의 동기 `fs.existsSync` 이중 호출과 가드별 spec 트리 재순회는 모두 이번 diff 이전부터 있던 기존 구조로, 이번 변경으로 인한 새로운 성능 부담은 없다.

## 위험도
NONE
