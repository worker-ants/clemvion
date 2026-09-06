# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 새 spec 파일이 같은 디렉터리의 확립된 관례(fixture 경로 상수화)를 따르지 않고 같은 경로를 3곳에 인라인으로 중복
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation.spec.ts:66-72`(`it('[대조군] fixture 의 위반을 전부...')`), `:100-106`(`it('세 인용 형태가 각각...')`), `:118-124`(`it('[전제] fixture 스캔이...')`)
  - 상세: 세 `it()` 블록이 각각 `path.join(__dirname, 'fixtures', 'dto', 'responses', 'jsdoc-citation.fixture.ts')` 를 5줄짜리 리터럴로 반복 정의한다. 같은 디렉터리의 형제 가드 `swagger-dto-contract.spec.ts` 는 정확히 같은 상황(같은 fixture 를 여러 `it()` 이 참조)에서 `const RATCHET_FIXTURE = path.join(__dirname, 'fixtures', 'dto', 'responses', 'optional-nullable.fixture.ts');` 로 모듈 최상위에 한 번만 선언해 재사용한다(`swagger-dto-contract.spec.ts:347-353`). 이번에 새로 작성된 파일이 그 관례를 따르지 않아, fixture 파일을 옮기거나 이름을 바꾸면 3곳을 각각 고쳐야 한다.
  - 제안: `describe` 블록 상단(또는 모듈 최상위)에 `const CITATION_FIXTURE = path.join(__dirname, 'fixtures', 'dto', 'responses', 'jsdoc-citation.fixture.ts');` 로 한 번만 선언하고 세 `it()` 이 참조하도록 통합 — 형제 파일 `swagger-dto-contract.spec.ts` 의 `RATCHET_FIXTURE` 패턴을 그대로 따른다.

- **[INFO]** (검증 완료, 조치 불요) 이전 라운드에서 지적된 두 항목이 이번 라운드에서 이미 해소됨
  - `codebase/backend/test/workspace-rbac.e2e-spec.ts` 의 신규 케이스는 이제 `J.` 로 유일하게 명명되어 있고(602행), `codebase/backend/test/workflow-crud.e2e-spec.ts` 의 신규 케이스도 `H.` 로 기존 `A.`~`G.` 뒤에 순서대로 붙어 있다(513행) — `review/code/2026/09/06/10_13_22` 가 지적한 라벨 충돌은 재발하지 않았다.
  - `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` 의 `UserRelationLoad` 인터페이스에서 미사용이던 `line` 필드가 이번 판에는 아예 존재하지 않는다(`file`/`method`/`kind`/`relation`/`key` 만 있음) — 형제 가드와의 관례 불일치 지적도 해소됐다.

## 요약

이번 diff(`User` 엔티티 컬럼 노출 방어 3축: 구조 기반 `user-entity-exposure-guard`, JSDoc 인용 가드 `dto-jsdoc-citation-guard`, 값 기반 `user-secret-absence`, 그리고 `WorkflowVersionsService` 의 `creator` 투영 수정)는 여러 리뷰 라운드를 거치며 가독성·네이밍·중첩 깊이·매직 넘버·복잡도 면에서 이미 상당히 다듬어진 상태다. 각 함수는 단일 책임을 유지하고(`referencesUserType`/`forEachUserTypedProperty`/`hasEagerDecorator`/`hasProjectionFor` 등), fixture 는 위반/준수 형태를 이름으로 명확히 구분하며(`violationX`/`compliantX`), JSDoc 은 "왜 이 형태인가"·"왜 대안을 안 썼는가"를 실측과 함께 남겨 후속 독자가 근거를 추적할 수 있게 한다. `WorkflowVersionsService` 의 `CREATOR_PROJECTION` 상수화 + DTO 스키마 대조 테스트는 "같은 리터럴이 두 곳에 복제돼 한쪽만 옳았다"는 실제 결함을 코드로 재발 방지하는 좋은 패턴이다. 유일하게 남은 실질적 지적은 새로 작성된 `dto-jsdoc-citation.spec.ts` 가 같은 디렉터리에 이미 있는 "fixture 경로 상수화" 관례(`swagger-dto-contract.spec.ts`)를 따르지 않고 동일 경로를 3곳에 인라인 중복한 것으로, 기능적 결함은 아니며 수정 비용도 낮다. 과거 라운드가 지적한 e2e 라벨 충돌·미사용 필드는 이번 판에서 확인 결과 이미 해소되어 있었다.

## 위험도

LOW
