# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** JSDoc 주석이 원래 대상 함수를 벗어나 엉뚱한 함수 위에 얹혀 있고, 원래 대상 함수는 무주석 상태다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` — 46~63번째 줄(고아 JSDoc 블록, 내용은 `collectUserRelationNames` 를 설명) 바로 아래 64~78번째 줄에 `findEagerUserRelations` 전용 JSDoc 이 이어지고 79번째 줄에 `export function findEagerUserRelations(...)` 가 온다. 실제 `collectUserRelationNames` 선언은 132번째 줄인데 그 위에는 주석이 전혀 없다(131번째 줄은 빈 줄).
  - 상세: 46~63번째 줄 블록은 `"*.entity.ts` 에서 **타입이 `User` 인 관계 속성 이름**을 전부 모은다"·"판정 축은 **속성의 타입 주석**이다" 등 `collectUserRelationNames` 의 동작을 정확히 설명하는 문장으로 구성돼 있다. `git log --follow -p` 로 확인한 결과 이 블록은 최초 커밋(`96d3856a9`)에서 `collectUserRelationNames` 바로 위에 있었는데, 이후 커밋에서 `findEagerUserRelations` 가 그 사이에 삽입되면서 원 주석이 새 함수 위로 밀려나고 새 함수 자신의 주석(64~78번째 줄)이 그 아래 붙어, 결과적으로 두 개의 JSDoc 블록이 연달아 있으면서 첫 번째 블록은 그다음 그다음 함수(`collectUserRelationNames`, 132번째 줄)를 설명하고 두 번째 블록만 바로 아래 함수(`findEagerUserRelations`)를 설명하는 상태가 됐다. 코드를 위에서 아래로 읽는 사람은 46~63번째 줄 설명을 79번째 줄 `findEagerUserRelations` 의 계약으로 오독하기 쉽고(예: "이름을 모은다" 는 설명과 실제로 `<파일>#<속성명>` 키 배열을 반환하는 함수의 동작이 불일치), 정작 `collectUserRelationNames` 는 132번째 줄에서 어떤 설명도 없이 등장한다.
  - 제안: 46~63번째 줄 블록을 132번째 줄 `collectUserRelationNames` 선언 바로 위로 옮긴다.

- **[WARNING]** 엔티티 파일을 스캔해 `User` 타입 속성을 찾는 AST 순회 로직이 두 함수에 그대로 복제돼 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` — `findEagerUserRelations`(79~106번째 줄)와 `collectUserRelationNames`(132~156번째 줄)
  - 상세: 두 함수 모두 (1) `entityFiles` 를 순회하며 (2) 동일한 인자로 `ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)` 를 호출하고 (3) `ts.forEachChild` 기반 재귀 `visit` 로 `ts.isPropertyDeclaration(node) && node.type && referencesUserType(node.type)` 를 검사하는, 사실상 동일한 골격을 각자 손으로 다시 짰다. 차이는 `findEagerUserRelations` 가 조건에 `hasEagerDecorator` 를 추가하고 결과를 `${rel}#${node.name.getText(sf)}` 문자열 배열로 만드는 것, `collectUserRelationNames` 가 이름만 `Set` 에 모으는 것뿐이다. 이 파일 자신이 "관계 이름 목록을 손으로 늘리지 말고 출처를 바꿔라" 는 원칙을 여러 차례 강조하는데(주석 49~58번째 줄, 56~58번째 줄 등), 정작 "엔티티 파일 순회 + 프로퍼티 타입 검사" 라는 골격 자체는 손으로 두 번 복제했다. 지금은 두 함수가 같은 `referencesUserType` 을 호출해 판정 기준은 갈리지 않지만, 향후 순회 대상을 넓히거나(예: getter/setter 도 보게 하거나) 파일 읽기 방식을 바꿀 일이 생기면 한쪽만 고치고 다른 쪽을 놓칠 위험이 구조적으로 남는다.
  - 제안: `entityFiles` 를 순회하며 `referencesUserType` 을 만족하는 `PropertyDeclaration` 을 콜백으로 넘기는 공통 헬퍼(예: `walkUserTypedProperties(entityFiles, cb)`)로 추출하고, 두 함수는 그 헬퍼에 `hasEagerDecorator` 필터/출력 포맷 차이만 실어 호출하게 한다.

- **[INFO]** 대조군(fixture) 위반 개수를 나눠 세는 단언이 매직 넘버(2·11)로 fixture 항목 수와 수동 동기해야 한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts` — `'두 종류를 각각 잡는다 — 한 축만 물면 다른 축으로 샌다'` 테스트(`kinds.filter((k) => k === 'joinAndSelect')).toHaveLength(2)` / `kinds.filter((k) => k === 'relations')).toHaveLength(11)`)
  - 상세: 바로 위 테스트(`'fixture 의 위반 함수를 하나도 빠짐없이 잡는다'`)가 이미 13개 위반 메서드 이름을 전부 나열해 개수·구성을 고정하는데, 이 테스트는 같은 정보를 `kind` 축으로 다시 쪼개 하드코딩된 2/11 로 재확인한다. 이 파일은 정확히 같은 문제(제목에 개수를 적으면 fixture 가 늘 때 낡는다, `review/code/2026/09/06/11_27_53` W3)를 이미 한 번 겪고 "제목에 개수를 적지 않는다" 는 교훈을 남겼는데(140~147번째 줄), 정작 단언 본문의 `toHaveLength(2)`/`toHaveLength(11)` 은 fixture 에 위반이 추가될 때마다 손으로 갱신해야 하는 숫자로 남아 있다. 기능적으로 틀린 것은 아니고 위 테스트와 조합하면 회귀는 여전히 잡히지만, 두 숫자의 근거(어떤 fixture 함수가 어느 kind 인지)가 코드 어디에도 명시돼 있지 않아 실패 시 왜 2/11 이어야 하는지 추적하려면 fixture 를 다시 세어야 한다.
  - 제안: 조치 시급성은 낮음 — 굳이 손댈 경우 `found.filter(f => f.kind === 'joinAndSelect').map(f => f.method)` 처럼 이름까지 단언해 숫자 대신 "무엇이 그 kind 인가" 를 코드에 남기거나, 위 테스트와 통합해 `{method, kind}` 쌍 전체를 한 번에 비교한다.

## 요약

이번 변경은 `User` 엔티티 컬럼 노출을 잡는 구조 축(`user-entity-exposure-guard.ts`)·이름 축(`user-secret-absence.ts`) 가드와 그 소비 지점(e2e·unit·`CREATOR_PROJECTION` 상수화)으로 구성되며, 전반적인 가독성·네이밍·일관성은 높다 — 각 파일이 "왜 이 방식을 택했는가" 를 실측치·이전 라운드 참조와 함께 촘촘히 남기고, `CREATOR_PROJECTION` 단일 상수화로 이전 라운드가 지적한 값 중복(4곳 손 복제)을 실제로 해소했으며, 보안 경계 리터럴은 DTO OpenAPI 스키마 대조 테스트로 드리프트를 코드로 묶었다. 다만 `user-entity-exposure-guard.ts` 내부에서 두 가지 국소 결함을 새로 확인했다: (1) 커밋 히스토리 도중 함수가 삽입되면서 JSDoc 주석이 원래 대상(`collectUserRelationNames`)을 벗어나 다른 함수(`findEagerUserRelations`) 위에 얹힌 채 남아 있고 원래 대상은 무주석이 됐고, (2) 엔티티 파일을 스캔하는 AST 순회 골격이 `findEagerUserRelations`/`collectUserRelationNames` 두 곳에 거의 그대로 복제돼 있어, 이 PR 자신이 강조한 "목록을 늘리지 말고 출처를 바꿔라" 원칙이 정작 이 순회 로직에는 적용되지 않았다. 둘 다 동작 결함은 아니며 국소적으로 고치기 쉽다. 부가적으로 fixture 위반 개수를 나누어 세는 테스트에 매직 넘버(2/11)가 남아 있는 점은 INFO 수준으로만 지적한다.

## 위험도
LOW
