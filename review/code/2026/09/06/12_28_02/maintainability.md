# 유지보수성(Maintainability) 리뷰

## 개요

이 diff(`origin/main...HEAD`, `codebase/**` 기준 14개 파일)는 `User` 엔티티 민감 컬럼 노출을
검출하는 2축 가드(`user-entity-exposure-guard.ts` 구조 축, `user-secret-absence.ts` 이름 축)와
그 소비 e2e, 그리고 이미 4차례의 `/ai-review` 라운드(`review/code/2026/09/06/{10_13_22,
10_53_48,11_27_53,11_55_36}`)를 거치며 처분된 Critical 1 + WARNING 다수의 최종 반영 상태다.

직접 소스를 열어 이전 라운드가 지적한 항목들이 실제로 해소돼 있는지 재확인했다:

- `WorkflowVersionsService` 의 `creator` 투영 리터럴 4곳 손 복제 → `CREATOR_PROJECTION` 단일
  상수로 통합되고, `workflow-versions.service.spec.ts` 가 그 상수를
  `WorkflowVersionCreatorDto` 의 OpenAPI 스키마와 대조하는 테스트로 묶여 있음을 확인.
- `user-entity-exposure-guard.ts` 의 JSDoc 블록 위치 어긋남(`collectUserRelationNames` 가
  무주석, 엉뚱한 함수 위에 설명이 얹힘) → 현재 파일에서 `collectUserRelationNames`(140행)와
  `findEagerUserRelations`(83행) 각각 자신의 JSDoc 을 갖고 있음을 확인.
- 두 함수의 AST 순회 로직 복제 → `forEachUserTypedProperty` 공유 헬퍼로 통합돼 있음을 확인.
- e2e 라벨 중복(`workspace-rbac.e2e-spec.ts` 의 `F.` 두 개)·순서 역전(`J.` 가 `D.`/`E.` 사이에
  물리적으로 남음) → `grep`으로 전수 확인한 결과 `A, S, B, C, D, E, F, G, H, I, J` 순서로
  라벨이 유일하고 등장 순서와 일치.
- `workflow-crud.e2e-spec.ts` 신규 케이스의 레터 누락 → `H.` 로 정상 부여돼 있음.
- 가드 테스트 설명 문자열의 "위반 N형태" 카운트 드리프트 → 숫자를 아예 빼고 "fixture 의 위반
  함수를 하나도 빠짐없이 잡는다"로 바꿔 재발 구조 자체를 제거했음을 확인.
- `expectNoUserSecrets` 의 암묵적 전역 `expect` 의존 → 직접 `throw` 하는 형태로 이미 바뀜.

새로 발견한 것은 아래 낮은 우선순위 중복 두 건이다 — 둘 다 순수 스캔 로직 내부의 사소한
반복이고 기능 결함은 아니다.

## 발견사항

- **[INFO]** 프로퍼티 이름에서 따옴표를 벗기는 동일 표현식이 두 함수에 각각 인라인으로
  반복돼 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` —
    `userRelationInInitializer` 내부(게이트 254) `prop.name.getText(sf).replace(/['"]/g, '')`,
    `hasProjectionFor` 내부(게이트 304) `sel.name.getText(sf).replace(/['"]/g, '')`
  - 상세: 두 자리 모두 "AST 프로퍼티 이름에서 따옴표를 벗겨 원시 키 문자열을 얻는다"는 완전히
    동일한 연산이고, 이 파일에 이미 존재하는 `lastPathSegment` 류 3중 인라인 중복(같은 파일
    169·241·392행, `RESOLUTION.md` 의 "3곳 인라인, 폴백이 달라 통합 시 오히려 분기가 는다"는
    근거로 의도적으로 defer된 사례)과 같은 성격이다. 다만 이번 두 자리는 폴백값 차이가 없어
    (둘 다 그냥 `replace(...)` 결과를 그대로 쓴다), 헬퍼로 뽑아도 defer 사례처럼 분기가 늘어날
    이유가 없다.
  - 제안: `propKeyText(node: ts.PropertyName, sf: ts.SourceFile): string` 같은 1줄짜리 헬퍼로
    통합한다. 급하지 않음 — 지금 당장 버그를 만들지 않는다.

- **[INFO]** 관계 이름 대소문자 비교 로직이 헬퍼(`isUserRelationPath`)를 쓰는 자리와 인라인으로
  직접 `toLowerCase()` 를 두 번 부르는 자리가 섞여 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` —
    `isUserRelationPath`(게이트 169-175, 헬퍼로 캡슐화됨) vs `hasProjectionFor` 내부(게이트 305)
    `key.toLowerCase() !== relation.toLowerCase()` (인라인 비교)
  - 상세: `findUserRelationLoads`/`userRelationInInitializer` 계열은 "이름이 `User` 관계
    집합에 속하는가"를 판정할 때 대소문자 무시 비교를 `isUserRelationPath` 헬퍼로 감싸 쓰는데,
    `hasProjectionFor` 는 (이미 알고 있는 `relation` 문자열과 `select` 키 하나를 비교하는
    다른 목적이긴 하지만) 같은 대소문자 무시 동등 비교를 헬퍼 없이 직접 쓴다. 지금은 두 값
    다 이미 소문자 정규화를 거친 상태라 실질적 위험은 낮지만, 다음에 이 비교 규칙(예: 유니코드
    정규화 추가 등)이 바뀌면 이 자리만 놓칠 수 있다.
  - 제안: 급하지 않음. 관계 이름 동등 비교를 손댈 일이 생기면 공용 `sameRelationName(a, b)`
    헬퍼로 묶는 것을 고려.

## 요약

이 PR 은 이미 네 차례의 `/ai-review` 라운드를 거치며 실질적 유지보수성 결함(보안 경계
리터럴의 4곳 손 복제, JSDoc 오배치, AST 순회 로직 복제, e2e 라벨 중복·순서 역전, 테스트
설명의 카운트 드리프트, 암묵적 전역 의존)을 전부 해소했고, 이번 라운드에서 코드를 직접 열어
그 수정들이 실제로 반영돼 있음을 재확인했다. 새로 찾은 것은 순수 스캔 로직 내부의 사소한
반복 두 건(따옴표 벗기기, 대소문자 비교)뿐이며 둘 다 INFO 수준으로 기능·보안에 영향이 없다.
전반적으로 가독성·네이밍·문서화가 높은 수준으로 유지되고 있고, 함수 길이·중첩 깊이·순환
복잡도도 AST 스캔 코드로서 통상적인 범위 안에 있다. 형제 가드(`swagger-dto-contract-guard.ts`,
`nullable-type-lie-cast-guard.ts`)와 "순수 스캔 로직 / 소비 spec 분리" 관례도 일관되게
따른다.

## 위험도

LOW
