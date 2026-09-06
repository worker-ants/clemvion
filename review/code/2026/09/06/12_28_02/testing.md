# 테스트(Testing) 리뷰

## 개요

대상은 `User` 엔티티 컬럼 노출 방어(검출) 2축 가드 신설(`96d3856a9`)과 그 뒤 4개 fix 커밋
(`4d49aa575`·`9a186fa31`·`01b078379`·`72c0bcc13`)이 누적된 최종 상태다. 과거 세 라운드의 코드
리뷰(`review/code/2026/09/06/10_13_22`, `10_53_48`, `11_27_5x`, `11_55_36` 계열)가 이미
Critical 1건(이름 기반 매칭이 `creator` 유출을 놓침)과 다수의 WARNING(가드 검출력 0 상태로도
그린이던 문제·객체 형태 `relations` 누락·`select: true` 오탐 통과 등)을 뮤테이션으로 확인하며
닫았다. 이번 리뷰에서는 그 이력을 실제 소스(`workflow-versions.service.ts`/`.spec.ts`,
`user-entity-exposure-guard.ts`/`.spec.ts`, fixture 2종, e2e 3벌)를 직접 열어 대조했고, 이미
보고된 결함들은 실제로 코드에 반영되어 닫혀 있음을 확인했다(예: `workspace-rbac.e2e-spec.ts`
라벨이 `A~I, J` 로 유일·순서대로 정리됨, `workflow-crud.e2e-spec.ts` 신규 케이스가 `H.` 라벨을
받음, `CREATOR_PROJECTION` 이 4곳 손복제 대신 단일 상수+DTO 스키마 대조 테스트로 묶임).

아래는 그 이후에도 남아 있는, 아직 어떤 라운드에서도 지적되지 않은 갭이다.

## 발견사항

- **[WARNING]** 가드 자신이 "캐스트 한 겹이 술어를 눈멀게 한다"고 명시한 위협 모델인데, `unwrap()`
  이 처리하는 4가지 캐스트 형태 중 3가지가 실제로는 어떤 fixture 로도 검증되지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` 함수
    `unwrap` (약 217~228행) — `ts.isAsExpression` · `ts.isSatisfiesExpression` ·
    `ts.isParenthesizedExpression` · `ts.isTypeAssertionExpression` 4개 분기.
    소비 fixture: `codebase/backend/src/repo-guards/__tests__/fixtures/user-relation-load.fixture.ts`
    의 `violationSatisfiesRelations` (`relations: { creator: true } satisfies Record<string, unknown>`)
  - 상세: 이 가드의 JSDoc 은 "캐스트가 한 겹만 있어도 `ts.isObjectLiteralExpression` 이 거짓이
    되어 술어가 통째로 눈을 감는다 — fixture 에 `as unknown as Record<…>` 를 쓰자마자 중첩 객체
    위반이 검출되지 않는 것을 실측으로 확인했다"고 스스로 적어 두고 있다(정확히 이 함수의
    docstring). 그런데 fixture 전체(`user-relation-load.fixture.ts`, `user-eager-relation.fixture.ts`)
    를 `grep -n " as \| satisfies "` 로 확인한 결과 `satisfies` 형태(`violationSatisfiesRelations`)
    하나만 실제로 존재하고, `as X`(AsExpression) · `<X>expr`(TypeAssertionExpression,
    이 저장소는 `.ts` 이므로 문법적으로 허용되고 `no-unnecessary-type-assertion` 외에 이를 막는
    lint 규칙도 없음을 `eslint.config.mjs` 로 확인) · 괄호(`(...)`, ParenthesizedExpression) 세
    형태는 `hasEagerDecorator`(eager 축)·`userRelationInInitializer`(relations 축) 어느
    소비처에서도 한 번도 실행되지 않는다. 즉 이 함수의 4개 분기 중 3개는 "지웠을 때 어떤
    테스트도 실패하지 않는" 상태다 — 이 PR 자신이 eager 축에서 겪은 "0건이라는 사실과 이 함수가
    실제로 잡는다는 사실은 다른 주장이다"(`user-entity-exposure-guard.ts` 96행 인근)라는 교훈이
    `unwrap()` 자신에게는 아직 반쪽만 적용된 상태다. 부수적으로 `hasProjectionFor`(287~316행)의
    `!ts.isPropertyAssignment(sel)` 분기(스프레드 등 비-단순 프로퍼티를 투영으로 간주)도 같은
    이유로 어떤 fixture 에도 없다.
  - 제안: `user-relation-load.fixture.ts` 에 `as`(예:
    `relations: { creator: true } as Record<string, unknown>`)와 괄호로 감싼 형태
    (`relations: ({ creator: true })`) 위반 케이스를 최소 1개씩 추가해 4개 분기 중 남은 것들을
    관측 가능하게 만든다. `<X>expr` 형태는 실사용 가능성이 낮으면 분기 자체를 제거하는 것도
    대안이다(안 쓰이는 분기를 유지하며 테스트만 없는 상태보다 낫다).

- **[WARNING]** JSDoc → 공개 OpenAPI `description` 유출은 이번이 세 번째 발생인데도 회귀를 막는
  자동 가드가 없다 — 이번에도 수작업 회피(`//`)로만 처리됐다
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`
    (`WorkspaceMemberDto.joinedAt` 필드 주석, `/** */` 대신 `//` 로 옮긴 부분) — 코드 자체 주석이
    "이 브랜치가 같은 위반을 세 번째 했다"고 명시
  - 상세: `grep -rn "introspectComments"` 로 확인한 결과 이 저장소에는 이미
    `schedule-response.dto.ts` 에서 같은 위반이 두 차례 나온 전례가 있고(파일 내 두 곳의 `//`
    회피 주석), 이번이 `workspace-response.dto.ts` 로 세 번째다. 그런데 세 자리 모두 "내부
    서사는 `//` 에 둔다"는 **수작업 관례**로만 처리됐고, `/** ... */` JSDoc 이 실제로
    `introspectComments` 를 통해 OpenAPI `description` 으로 새는지(또는 새지 않는지) 확인하는
    자동 테스트/가드는 저장소 어디에도 없다(`user-entity-exposure*.ts`·`swagger-dto-contract-guard.ts`
    등 기존 가드 파일 어디에도 `introspectComments`/JSDoc-누출 검사 없음). 즉 다음 사람이 같은
    필드에 실수로 `/** 내부 메모 */` 를 쓰면 4번째로 똑같이 새어 나가고, 그것을 잡을 수 있는
    유일한 방법이 지금은 "사람이 기억하고 있다가 리뷰에서 지적한다"뿐이다.
  - 제안: `swagger-probe.ts` 기반으로 "DTO 필드의 `/** */` JSDoc 첫 줄이 곧 그 필드의 OpenAPI
    `description` 과 동일하면 안 되는 내부 전용 마커(`@internal` 등)를 감지" 하거나, 반대로 DTO
    필드에 다중 `//` 주석이 있는 자리는 `description` 이 비어 있는지 스냅샷으로 고정하는 가드를
    하나 신설해 spec `code:` 에 등재한다(같은 세션이 이미 `user-secret-absence.ts` 로 검출-only
    전략을 두 번 성공시켰으므로 같은 패턴을 재사용 가능).

- **[INFO]** `workspace-rbac.e2e-spec.ts` 의 신규 `J.` 테스트가 예전 라벨(`F.`)의 흔적을 식별자에
  그대로 남기고 있다
  - 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts` — `it('J. GET /:id/members …')` 블록
    내부의 `uniqueEmail('rbac-f-own')`·`uniqueName('F')`·`uniqueEmail('rbac-f-mem')` (기존 `F.`
    테스트인 `it('F. sole owner 는 leave 불가 …')` 블록도 동일한 `rbac-f-own`/`uniqueName('F')`
    를 쓰고 있어 문자열이 두 테스트에 중복됨)
  - 상세: 이 테스트는 이전 라운드에서 `F.`(중복 라벨)로 추가됐다가 리뷰 지적으로 `J.` 로 개명되고
    파일 끝으로 이동했는데, 그 과정에서 테스트 *제목*만 바뀌고 내부에서 쓰는 `uniqueEmail`/
    `uniqueName` prefix 문자열은 옛 라벨(`f`/`F`) 그대로 남았다. `uniqueEmail`/`uniqueName`
    이 `Date.now()`+난수를 덧붙이므로(`test/helpers/db.ts`) 실제 충돌·격리 실패는 없지만, 사람이
    실패 로그에서 이메일/워크스페이스 이름으로 "어느 테스트인지" 추정할 때 `f` 접두어가 `F.`
    테스트를 가리키는 것으로 오인하게 만든다 — 이 파일이 라벨을 상호 참조 식별자로 쓰는 관례
    (다른 문서·자매 e2e JSDoc 이 `workspace-rbac J`로 이 테스트를 가리킴)와 어긋난다.
  - 제안: `J.` 테스트 안의 prefix 를 `rbac-j-own`/`rbac-j-mem`/`uniqueName('J')` 로 바꿔 라벨과
    식별자를 다시 맞춘다.

## 요약

핵심 방어 로직(구조 축 `user-entity-exposure-guard.ts` + 이름 축 `user-secret-absence.ts`)과 그
소비 e2e·unit 은 네 라운드의 뮤테이션 검증을 거치며 눈에 띄는 회귀 위험 없이 정교해졌다 —
`CREATOR_PROJECTION` 은 손복제 대신 DTO OpenAPI 스키마 대조로 SoT 를 강제하고, `EXPECTED_USER_RELATION_LOADS`
래칫과 두 fixture(양성 4형태/음성 다수, eager 축 대조군)가 "0건이라는 사실"과 "함수가 실제로
잡는다는 사실"을 분리해 검증하는 이 저장소의 반복된 교훈을 잘 반영한다. 다만 그 교훈이 가드
자신의 핵심 헬퍼인 `unwrap()`(캐스트 벗기기)에는 아직 4분의 3만 적용돼 있다 — `as`/괄호/
`<T>expr` 세 형태가 여전히 "지워도 통과하는" 상태이고, 이는 이 PR 이 스스로 지목한 정확히 그
위협 클래스(캐스트로 눈먼 술어)다. 또한 JSDoc→OpenAPI 유출은 3회째 반복되는데도 자동 회귀
가드가 없어 4번째 재발을 막을 장치가 사람의 기억뿐이다. 두 WARNING 모두 런타임 동작을 바꾸지
않고 국소 수정(fixture 추가 1~2건, 신규 검출 가드 1건)으로 닫을 수 있다.

## 위험도
LOW
