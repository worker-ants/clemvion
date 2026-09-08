# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[WARNING]** 주석 재배치로 "vacuous 방지" JSDoc 이 자신이 설명하던 테스트에서 떨어져 나갔다(orphaned comment)
  - 위치: `codebase/backend/src/repo-guards/__tests__/production-build-devdep.spec.ts:35-46`
  - 상세: 원래는 `/** **먼저 vacuous 방지.** ... */` 블록(35~39행)이 바로 아래 `it('[캐너리] 빌드 대상 파일 목록이 비어 있지 않다', ...)` 를 직접 설명하고 있었다(그 안에서 `resolveBuildFileNames` 를 호출했었다). 이번 diff 가 `buildFiles` 를 `describe` 최상단으로 끌어올리면서, 그 사이에 새 JSDoc(`빌드 대상 목록은 **한 번만 해석한다**...`, 40~43행)과 `const buildFiles = resolveBuildFileNames(backendDir);`(44행)를 끼워 넣었다. 그 결과 35~39행의 "vacuous 방지" 설명은 이제 코드가 아니라 **다른 주석 블록** 바로 위에 떠 있고, 정작 46행의 `it(...)` 은 자신을 설명하던 주석 없이 시작한다. 두 인접 JSDoc 블록이 나란히 있으면 다음 편집자가 "이 두 블록이 함께 `const buildFiles` 를 설명한다"거나 "35행 블록은 죽은 주석이다"로 오독하기 쉽다. 기능에는 영향이 없지만, 이 저장소가 반복 겪은 "내 수정이 다음 결함이 된다"(orphaned JSDoc) 패턴과 정확히 같은 형태다.
  - 제안: 35~39행 블록을 46행 `it(...)` 바로 위로 옮겨 원래의 1:1 대응을 복원한다. 40~43행 블록만 44행 `const buildFiles` 위에 남긴다.

- **[INFO]** cafe24/makeshop 두 spec 파일에 `raceErrorSurfaces` 배열(주석 포함 26줄)이 문자 그대로 중복된다
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts:602-632`, `codebase/backend/src/modules/integrations/integration-oauth.service.makeshop.spec.ts:508-538`
  - 상세: 두 파일 모두 동일한 `// **두 표면을 모두 건다.**...` 주석과 동일한 `raceErrorSurfaces: ReadonlyArray<[string, () => Error]>` 리터럴(flat/wrapped 두 케이스, 같은 제약 이름·같은 메시지)을 각자 선언한다. 이 저장소에는 `cafe24-api.client.ts`/`makeshop-api.client.ts` 의 구조적 미러 중복을 의도로 확정하고 추상화를 철회한 선례가 있지만, 그 결정의 근거(3번째 provider 가 인증·rate-limit·envelope 에서 어떻게 발산할지 예측 불가)는 provider 고유 로직에 대한 것이다. 여기서 중복되는 것은 provider 와 무관한 **Postgres 에러 모양(raw/wrapped 두 표면)**을 흉내 내는 순수 테스트 픽스처라서 같은 근거가 그대로 적용되는지는 분명치 않다 — 이미 이 파일들 옆에 그런 목적의 공유 fixture 패턴(`endpoint-path-save.fixture.ts`)이 존재한다.
  - 제안: 지금 당장 조치가 필요한 크기는 아니다(26줄, 두 자리). 다음에 이 배열을 만질 일이 생기면 `codebase/backend/src/common/db/__tests__/pg-race-error-surfaces.fixture.ts` 류의 공유 fixture 로 뽑아 두 spec 이 import 하는 것을 고려할 만하다 — provider 미러 중복 정책과는 별개 축이므로 오탐으로 취급하지 않는 게 맞다.

- **[INFO]** `WorkflowVersionDetailProjection` 개명 배경 JSDoc 이 실제 타입 선언(4줄)의 약 5배 분량이다
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:46-69`(JSDoc), `:70-73`(타입 본문)
  - 상세: 직전 라운드(`review/code/2026/09/08/12_53_08/maintainability.md`)에서 이미 지적되고 "조치 불요(기존 관례 일치)"로 처분된 항목과 같은 자리다. 이번 diff 는 그 JSDoc 을 다시 손봐 분량이 오히려 소폭 늘었다. 이 저장소는 결정 근거를 코드 옆에 남기는 관례가 확고하고 동일 패턴이 `workspaces.service.ts`·`user-entity-exposure.spec.ts`·프런트엔드 `workflows.ts` 에도 일관되게 반복되므로 새로운 결함은 아니다.
  - 제안: 조치 불요(재확인). 다음에 이 타입을 다시 열 때 이력 부분을 링크 한 줄로 축약할 여지만 남겨 둔다.

## 요약

이번 배치는 대부분 직전 라운드(`review/code/2026/09/08/12_53_08`)의 INFO 지적을 실제로 반영한 후속 diff다 — `production-build-devdep.spec.ts` 의 반복 `it()` 를 `it.each` 로 접고 `resolveBuildFileNames` 호출을 1회로 줄였으며, cafe24/makeshop callsite 가 flat 표면만 태우던 갭을 `it.each(raceErrorSurfaces)` 로 메웠고, `isWrappedByConflictCatch` 의 fail-open 술어를 호출식 요구로 좁혔다. 신규 AST 가드(`endpoint-path-conflict-wrap-guard.ts`)는 형제 가드와 동일한 구조·네이밍·문서화 규율을 따르고, `pg-error.ts` SoT 로의 통합(`http-exception.filter.ts`, `integration-oauth.service.ts`)은 중복 로직을 실제로 줄이는 방향이다. 다만 그 리팩터 과정에서 `production-build-devdep.spec.ts` 에 주석-코드 대응이 깨지는 작은 결함(orphaned JSDoc)이 새로 생겼고, cafe24/makeshop 두 spec 에 걸쳐 테스트 전용 에러 픽스처 배열이 문자 그대로 중복되는 자리가 남았다 — 둘 다 기능에는 영향이 없는 낮은 위험도의 지적이다. 함수 길이·중첩 깊이·순환 복잡도는 전반적으로 양호하고, 매직 넘버는 이름 있는 상수(`CONFLICT_WRAPPER`, `TRIGGER_REPOSITORY`, `STORE_IDENTIFIER_UNIQUE_CONSTRAINT`)로 이미 방어돼 있다.

## 위험도

LOW
