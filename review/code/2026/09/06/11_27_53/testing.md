# 테스트(Testing) 리뷰

## 범위 메모

프롬프트에 실린 54개 "파일" 중 대다수(파일 14~54, `review/code/**`·`review/consistency/**` 하위)는
이번 브랜치 이전 라운드의 리뷰·컨시스턴시 산출물이 커밋된 것이며, 이미 처리(RESOLUTION)까지 끝난
과거 이력이다. 이 리뷰는 실질적인 신규 코드·테스트 표면인 파일 1~13
(`CHANGELOG.md`, `workflow-versions.service.{ts,spec.ts}`, `workspace-response.dto.ts`,
`user-relation-load.fixture.ts`, `user-entity-exposure-guard.ts`, `user-entity-exposure.spec.ts`,
`user-secret-absence.{ts,spec.ts}`, `audit-logs.e2e-spec.ts`, `workflow-crud.e2e-spec.ts`,
`workspace-rbac.e2e-spec.ts`, `plan/in-progress/...md`)에 집중했다. 프롬프트에서 diff 가 생략된
파일 5·6·7(fixture·guard·spec)은 `Read` 로 워킹트리 원본을 직접 열어 확인했다 — 그 파일들에 대한
위치 인용은 그 Read 결과의 실제 줄 번호다(diff 게이트가 아님).

이전 라운드가 지적했던 e2e 라벨 중복(`F.`↔`F.`)·`.toLowerCase()` 비관측 분기·`line` 미사용
필드는 현재 워킹트리에서 전부 실제로 해소돼 있음을 직접 확인했다(`workspace-rbac.e2e-spec.ts`
는 `A,S,B,C,D,E,F,G,H,I,J` 유일 라벨, `workflow-crud.e2e-spec.ts` 는 `A~H` 유일 라벨,
fixture 는 `violationUppercaseRelation` 을 보유, `UserRelationLoad` 에 `line` 필드 없음). 이
리뷰는 그 위에서 **새로 남아 있는** 갭만 다룬다.

## 발견사항

- **[WARNING]** `hasProjectionFor` 가 `select` 값이 실제로 컬럼을 좁히는 객체인지 확인하지 않고, 같은 이름의 키가 존재하는지만 본다 — 이 술어가 막으려는 것과 같은 등급의 누락 경로를 자신이 갖고 있고, 어떤 fixture 도 그 경로를 관측하지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` 함수 `hasProjectionFor` (198~220행, `Read` 로 확인한 실제 줄 번호) — 판정 지점은 `for (const sel of prop.initializer.properties) { ... if (key.toLowerCase() === relation.toLowerCase()) return true; }`
  - 상세: 이 함수는 `select` 객체 안에 관계 이름과 같은 키가 "존재하기만" 하면 `true`(= 컬럼이 좁혀졌으니 위반 아님)를 반환한다. `sel` 의 **값**(`ts.isObjectLiteralExpression(sel.initializer)`인지, 즉 `{ id: true, name: true, ... }` 처럼 실제로 컬럼을 나열하는지, 아니면 `select: { creator: true }` 처럼 불리언 `true` 하나만 있는지)은 전혀 검사하지 않는다. TypeORM 의 `FindOptionsSelect` 는 관계 값에 `boolean | FindOptionsSelect<Relation>` 을 허용하므로, `select: { creator: true }` 는 컬럼을 좁히지 않고(관계 전체를 선택하라는 뜻과 동일한 효과) `relations: { creator: true }` 단독과 사실상 같은 결과를 낼 수 있다 — 그런데 이 함수는 "존재하니 통과"로 판정해 위반을 놓친다. 이 가드 자신이 이 PR 전체가 겪은 결함 클래스(외형은 "투영했다"인데 실제로는 전 컬럼이 나가는 자리)를 재현할 수 있는 자리인데, `fixtures/user-relation-load.fixture.ts` 에는 `select: { creator: true }`(불리언, 미좁힘) 형태의 fixture 가 없어 이 분기가 어느 방향으로도 관측되지 않는다 — 뮤테이션(예: `ts.isObjectLiteralExpression(sel.initializer)` 조건을 지금처럼 아예 검사하지 않는 상태)을 걸어도 현재 스위트로는 잡히지 않는다.
  - 제안: `hasProjectionFor` 에 `sel.initializer` 가 `ts.isObjectLiteralExpression` 인지(=실제로 하위 필드를 나열하는지) 조건을 추가하고, fixture 에 `select: { creator: true }`(불리언, 미좁힘)를 위반으로 거는 케이스 하나, `select: { creator: { id: true } }`(객체, 좁힘)를 준수로 거는 케이스 하나를 추가해 이 분기를 양쪽에서 관측 가능하게 만든다.

- **[INFO]** 가드 spec 의 테스트 제목이 "위반 10형태"라고 적지만 fixture 는 실제로 11개 위반 함수를 정의한다 — 이 저장소가 반복해서 겪은 "숫자가 낡는다" 패턴
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts:135` (`it('위반 10형태를 전부 잡는다 (한 함수 안 두 번은 두 건으로)', () => {`)
  - 상세: `fixtures/user-relation-load.fixture.ts` 를 전수로 세면 `violationRelationsUser`부터 `violationSatisfiesRelations`까지 **위반 1~11**, 11개 함수가 있다(`grep`으로 재확인: `violationRelationsUser`·`violationNestedRelationPath`·`violationCreatorRelation`·`violationObjectRelations`·`violationUppercaseRelation`·`violationLeftJoinAndSelect`·`violationInnerJoinAndSelect`·`violationTwiceInOneFunction`·`violationNestedObjectRelations`·`violationViaIntermediateVariable`·`violationSatisfiesRelations`). 단언 자체(`found.map(...).sort()).toEqual([...].sort())`)는 실제 메서드 이름 배열과 정확히 대조하므로 **기능적으로는 옳다** — 문제는 테스트 **제목**의 "10"이라는 숫자가 실측(11)과 어긋난다는 것뿐이다. `violationSatisfiesRelations`(캐스트 unwrap 대응, `10_53_48` W2)가 나중에 추가되면서 그 앞서 정해진 "10형태" 문구를 갱신하지 않은 것으로 보인다.
  - 제안: 제목을 "위반 11형태를 전부 잡는다"로 갱신한다. 혹은 하드코딩된 숫자를 아예 빼고 "fixture 의 위반 함수 전부를 잡는다"처럼 개수에 의존하지 않는 문구로 바꾸면, 다음에 fixture 가 늘어도 제목이 다시 낡지 않는다.

- **[INFO]** 중첩 관계(`relations: { a: { creator: true } }`)에 대해 같은 깊이로 중첩된 `select`(`select: { a: { creator: {...} } }`)로 투영해도 `hasProjectionFor` 는 최상위 `select` 만 보므로 준수 형태를 위반으로 오판할 수 있다 — 이 경로도 fixture 가 없다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` — `hasProjectionFor`(198~220행)는 `relationsProp.parent`(= `relations`와 같은 깊이의 옵션 객체) 하나만 보는데, `userRelationInInitializer`(152~189행)는 `relations` 값 자체는 임의 깊이로 재귀한다. 즉 관계가 중첩(`workflow.creator`)이고 `select`도 같은 깊이로 중첩 투영된 경우, 매칭 관계 이름은 재귀로 찾아내면서 그 투영 여부는 최상위 한 겹만 확인한다.
  - 상세: 현재 프로덕션 코드(`workflow-versions.service.ts`)와 fixture 어디에도 이런 형태(중첩 relations + 같은 깊이로 중첩된 select 투영)가 없어 지금 당장 오탐을 일으키지는 않는다. 다만 `violationNestedObjectRelations`(`relations: { workflow: { creator: true } }`)를 누군가 나중에 `select: { workflow: { creator: {...} } }`로 좁혀 "고쳤다"고 믿으면, 이 가드는 여전히 위반으로 지목해 거짓 실패를 낼 잠재적 지점이다(방향은 false-positive라 안전 쪽으로 치우치지만, 다음 사람이 원인을 못 찾고 가드를 무르게 고치는 유혹을 만들 수 있다).
  - 제안: 우선순위 낮음. 실제로 중첩 select 투영 형태가 코드베이스에 등장하면 그때 fixture 로 관측 가능하게 만들고 `hasProjectionFor` 를 재귀로 확장한다.

- **[INFO]** `unwrap()`이 처리하는 4가지 캐스트 형태 중 구식 타입 단언(`<T>expr`, `ts.isTypeAssertionExpression`)은 fixture 로 관측되지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` 함수 `unwrap`(139~150행) — `ts.isAsExpression`·`ts.isSatisfiesExpression`·`ts.isParenthesizedExpression`·`ts.isTypeAssertionExpression` 네 갈래 중 fixture(`violationSatisfiesRelations`)는 `satisfies` 한 갈래만 문다.
  - 상세: 저장소 lint(`@typescript-eslint/no-unnecessary-type-assertion`) 때문에 프로덕션 코드에 `<T>expr` 구식 문법이 남을 가능성은 낮고, 이 저장소는 대체로 `as` 스타일을 쓰므로 실질 위험은 낮다. 다만 코드가 명시적으로 이 분기를 처리하고 있는데 어떤 테스트도 그것을 실행하지 않는다는 점은 "죽은 분기인데 아무도 모른다" 상태로 남을 수 있다.
  - 제안: 선택적. 급하지 않음 — 실제로 이 문법이 코드베이스에 등장하면 그때 fixture 추가.

## 좋았던 점 (참고용)

- Critical 1(`WorkflowVersionsService.findOne` 유출)에 대한 회귀 방지가 **세 층**(unit — 옵션 전체 비교 + `creator` 투영 단독 양성 단언, e2e — 이름 부재·계약 대조·`creator` 3필드 양성)으로 겹쳐 걸려 있고, 각 층이 서로 다른 실패 사유를 잡도록 설계돼 있다.
- `CREATOR_PROJECTION` ↔ `WorkflowVersionCreatorDto` 일치를 손으로 두 목록을 대조하는 대신 **실제 생성된 OpenAPI 스키마**에서 뽑아 비교해, "두 목록이 같이 틀리는" 실패 모드를 원천 차단했다(`workflow-versions.service.spec.ts:38-50`). `declared.length` 를 먼저 단언해 vacuous 비교(빈 배열끼리 통과)도 막았다.
- `findUserSecretLeaks`/`expectNoUserSecrets` 는 통과 경로뿐 아니라 실패해야 하는 경로(7개 키 각각, 중첩·배열, snake_case, null 값, 유사 이름 오탐 방지, 원시값 안전성)를 개별적으로 걸어, "헬퍼가 무르게 바뀌면 모든 e2e 가 동시에 조용히 통과한다"는 위험을 정면으로 다룬다.
- `workspace-rbac.e2e-spec.ts` J·`workflow-crud.e2e-spec.ts` H 모두 이름 기반 부재 단언을 계약 대조보다 **먼저** 호출하도록 순서를 실측(뮤테이션으로 확인)에 근거해 고정했다 — 두 축이 서로 가리지 않게 설계한 점이 견고하다.
- 가드(`findUserRelationLoads`)의 관계 이름 집합을 손으로 나열하지 않고 엔티티 타입 주석에서 파생하도록 만든 것과, 그 파생 결과(`creator`·`executor`·`owner`·`user`)를 스냅샷처럼 고정한 테스트(`user-entity-exposure.spec.ts:84-98`)가 있어 다음에 새 `User` 관계가 생기면 이름을 몰라도 자동으로 스캔 대상이 된다.
- 이전 라운드가 지적한 항목(라벨 중복, `.toLowerCase()` 비관측, `line` 미사용, 중첩 객체 미검출, 캐스트 미검출)이 모두 실제로 fixture 화되어 회귀 가드로 남았음을 직접 코드를 열어 확인했다 — "지적 → 문서만 정정" 이 아니라 "지적 → 관측 가능한 테스트로 고정" 패턴이 반복되고 있다.

## 요약

핵심 보안 회귀(`WorkflowVersionsService.findOne` 의 `User` 전 컬럼 유출)는 unit 3건 + e2e 3축으로
튼튼하게 고정됐고, 새로 신설된 두 검출 가드(`user-entity-exposure-guard`/`user-secret-absence`)도
자기 자신의 회귀 스위트를 갖추고 있으며 이전 라운드가 찾은 사각지대(라벨 중복·대소문자 비관측·
중첩 객체 미검출·캐스트 미검출·`line` 미사용)는 실제로 코드에서 해소돼 있음을 확인했다. 다만 이번
라운드에서 새로 발견한 것은, 그 가드 자신의 "투영 여부" 판정 함수(`hasProjectionFor`)가 `select`
값이 실제로 컬럼을 좁히는지(객체)와 그냥 존재하는지(불리언 `true`)를 구분하지 않아, 정확히 이
PR 이 막으려는 종류의 "외형은 투영인데 실은 전체 노출" 형태를 놓칠 수 있는 자리인데 어떤
fixture 도 그 분기를 관측하지 않는다는 점이다(WARNING). 나머지는 가독성 수준의 stale 카운트
1건과, 지금 당장 도달 불가능한 두 분기(중첩 select·구식 타입 단언)의 미관측(INFO 3건)으로,
기능 결함이나 런타임 위험은 아니다.

## 위험도

LOW
