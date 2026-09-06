# 테스트(Testing) 리뷰

## 검증 방법

저장소를 뮤테이션하지 않고 확인했다. 대상 정규식·로직은 스크래치 디렉터리에 복사해
node 로 직접 실행했다(저장소 파일 미변경, `git status --short` 로 실행 전후 무변화 확인).

- `npx jest --config jest.config.ts user-entity-exposure user-secret-absence dto-jsdoc-citation workflow-versions.service.spec` — 4 스위트, **38개 테스트 전부 통과**.
- `dto-jsdoc-citation-guard.ts` 의 `CITATION_PATTERNS` 3개를 스크래치에 복사해 직접 실행 — 아래 발견사항의 근거.
- `codebase/backend/test/{workflow-crud,workspace-rbac}.e2e-spec.ts` 의 `it()` 라벨 전수 확인 — 중복·순서 이탈 없음(이전 라운드가 지적한 `F.` 중복은 `H.`/`J.` 로 이미 해소된 상태를 재확인).
- `WorkflowVersionCreatorDto` 를 직접 열어 `CREATOR_PROJECTION`·`WorkflowVersionsService.findOne`/`findByWorkflow` 의 select 리터럴과 3필드 집합이 일치함을 확인.

## 발견사항

- **[WARNING]** JSDoc 인용 가드가 "세 형태" 라고 선언한 것 중 **하나**(날짜+시각 형태)는 어떤 fixture 로도 양성 검증되지 않는다 — 그 정규식이 깨져도 스위트가 초록이다
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts` — `CITATION_PATTERNS` 배열의 두 번째 원소(`/\d{4}-\d{2}-\d{2}\s+\d{2}_\d{2}_\d{2}/`). 소비 spec `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation.spec.ts` 의 `'[대조군] 위반 3형태를 잡고 준수 3형태는 놓아 준다'` 테스트. fixture `codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/jsdoc-citation.fixture.ts`.
  - 상세: 가드 파일 JSDoc 은 "`review-citations.md §2` 가 정한 세 형태를 그대로 옮긴다 — 전체 경로 · 날짜+시각 · bare 시각" 이라고 명시하고, `review-citations.md §2` 실제로 세 형태(전체 경로=권장, 날짜+시각=허용, bare 시각=금지)를 표로 정의한다. 그런데 fixture 의 위반 3건은 전부 **전체 경로**(위반 1·2) 또는 **bare 시각**(위반 3)만 쓰고, "날짜+시각"(예: `2026-09-05 23_30_01`, review-citations.md 자신이 "허용" 등급으로 표에 올린 형태) 은 어느 fixture 에도 없다. 직접 검증: `CITATION_PATTERNS` 배열에서 두 번째 정규식을 **완전히 제거**한 뮤턴트로 기존 세 fixture 위반 문자열(`review/code/2026/09/06/12_28_02`, `review/consistency/2026/09/06/11_55_37`, `` `12_28_02` ``)을 재실행하면 **전부 그대로 잡힌다** — 즉 이 브랜치 뮤턴트가 어떤 기존 테스트도 깨뜨리지 않는다(스크래치에서 node 로 직접 실행해 확인, 저장소 미변경). 이 가드가 지키려는 계약은 "DTO JSDoc 안에는 세 형태 중 무엇이 와도 잡는다" 인데, 그중 하나는 회귀 방지망 밖에 있다.
  - 제안: `jsdoc-citation.fixture.ts` 에 "날짜+시각" 형태(예: `(2026-09-05 23_30_01 W1)`)를 쓰는 위반 케이스 하나를 추가하고 `dto-jsdoc-citation.spec.ts` 의 `owners` 기대값에 반영한다. 세 정규식이 각각 최소 한 fixture 로 양성 관측되게 한다.

- **[INFO]** `hasProjectionFor` 의 `select` 값에 대한 `unwrap` 분기가 fixture 로 관측되지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` — `hasProjectionFor` 함수의 `const value = unwrap(sel.initializer);` 줄. 대조군 `codebase/backend/src/repo-guards/__tests__/fixtures/user-relation-load.fixture.ts` 의 `violationSelectBooleanNotObject`(`select: { id: true, creator: true }`, 캐스트 없음)만 이 경로를 지난다.
  - 상세: `relations` 초기자 쪽은 `as`/`satisfies` 캐스트를 벗기는 두 형태(`violationSatisfiesRelations`/`violationAsCastRelations`)를 각각 fixture 로 문다고 명시적으로 강조하는데(파일 자체 주석: "한쪽만 태우면 반쪽이다"), 같은 `unwrap` 을 재사용하는 `select` 값 쪽(예: `select: { creator: true satisfies boolean }` 또는 `select: { creator: true as boolean }`)은 어느 fixture 에도 없다. `unwrap` 을 호출하는 두 자리 중 한쪽만 캐스트-포함 형태로 검증된 상태다. 실질 위험은 낮다(현재 형태를 제거해도 `violationSelectBooleanNotObject` 자체는 여전히 캐스트 없이 잡히므로 이 특정 분기 삭제가 즉시 회귀로 드러나지는 않지만, "관측 불가능한 분기는 지워도 아무도 모른다" 는 이 파일 자신의 원칙(`unwrap` JSDoc)이 정확히 이 자리에도 적용된다).
  - 제안: 시간 여유가 있다면 `select` 값에 캐스트를 씌운 위반 케이스 하나를 추가한다. 비용 대비 낮은 우선순위라 즉시 조치 불요로 봐도 무방하다.

- **[INFO]** `enclosingName` 의 `'<module>'` 폴백 분기가 어떤 fixture 로도 실행되지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` — `enclosingName` 함수의 `return fallback ?? '<module>';` 줄.
  - 상세: fixture 의 위반 14건은 전부 `export async function ...() { ... }` 내부이거나(메서드 분기로 잡힘) 변수 대입 경유(`violationViaIntermediateVariable`, 변수 폴백 분기로 잡힘)다. 메서드도 변수 선언도 없는 모듈 최상위 호출(`repo.findOne({ relations: [...] })` 을 함수/변수 없이 바로 실행하는 형태)은 fixture에 없어 `'<module>'` 리터럴이 실제로 반환되는 경로가 테스트되지 않는다. 프로덕션에서 이런 모듈 최상위 side-effect 호출은 드물어 실질 위험은 낮다.
  - 제안: 조치 불요로 판단해도 무방하나, 다음에 이 가드를 만질 때 함께 채우면 완전한 분기 커버리지가 된다.

## 회귀 테스트 확인

`WorkflowVersionsService.findOne`/`findByWorkflow` 의 투영 리터럴이 `CREATOR_PROJECTION` 단일 상수로 통합됐고, `workflow-versions.service.spec.ts` 상단에 `CREATOR_PROJECTION` 의 키를 `WorkflowVersionCreatorDto` 의 OpenAPI 스키마와 대조하는 별도 테스트가 신설돼 두 자리가 다시 갈리는 것을 잡는다. `findOne` 단위 테스트는 옵션 전체 비교(`toHaveBeenCalledWith`)와 `creator` 투영만 별도로 보는 좁은 단언을 의도적으로 중복시켜 "무엇이 양보하면 안 되는 성질인지" 를 이름에 남긴다는 설계 근거가 코드 주석에 있고, 실행 결과(38/38 통과)로 뒷받침된다. e2e 신규 케이스(`workflow-crud.e2e-spec.ts` "H.", `workspace-rbac.e2e-spec.ts` "J.")는 각각 버전 0개·멤버 1명일 때 단언이 vacuous 해지는 것을 막는 사전 조건(`toBeGreaterThanOrEqual(1)`, `toHaveLength(2)`)을 갖추고 있고, 이름 축(`expectNoUserSecrets`)을 계약 축(`assertMatchesContract`)보다 먼저 실행해 "계약 위반이 먼저 던져 이름 축이 실행조차 안 되는" 순서 함정을 실측으로 피했다는 근거가 주석에 남아 있다 — 코드를 직접 대조한 결과 서술과 일치한다.

## 요약

`User` 엔티티 컬럼 노출을 잡는 구조 축(`user-entity-exposure-guard`)·이름 축(`user-secret-absence`)·JSDoc 인용 축(`dto-jsdoc-citation-guard`) 세 가드 모두 순수 로직/소비 spec 분리, fixture 로 양성·음성 대조군을 갖추는 저장소 관례를 따르고, 이전 다섯 라운드 리뷰가 지적한 검출력 결함(eager 관계 원리적 미검출, 겉 투영 실은 전체 노출, 중첩 객체 relations, 캐스트로 인한 술어 무력화, 라벨 순서)은 코드·fixture·회귀 테스트로 실제 닫혀 있음을 직접 실행해 재확인했다(38/38 통과). 유일하게 새로 찾은 갭은 JSDoc 인용 가드가 스스로 "세 형태" 라고 선언했음에도 그중 하나(날짜+시각)를 양성 검증하는 fixture 가 없어, 그 정규식만 깨져도 회귀 방지망이 조용히 통과한다는 점이다 — 뮤테이션으로 직접 확인했고 위험은 낮지만(그 형태로 작성된 실제 DTO JSDoc 위반 이력은 없음) 가드 자신의 완결성 주장과 실제 커버리지 사이에 간극이 있어 WARNING 으로 올린다. 나머지 두 건(INFO)은 같은 `unwrap`/`enclosingName` 헬퍼의 부분 분기 미검증으로, 실질 위험은 낮다.

## 위험도

LOW
