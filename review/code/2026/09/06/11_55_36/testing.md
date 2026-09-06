# 테스트(Testing) 리뷰

## 검증 방법 메모

저장소를 뮤테이션하지 않고 확인하는 것을 기본으로 했고, 딱 한 곳은 가설 검증을 위해
`cp` 백업 → 수정 → `cp` 원복 절차로 직접 실행 검증했다(아래 CRITICAL 항목 참조). 절차:

1. `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` 를
   저장소 밖 scratch 디렉터리(`mktemp` 대신 세션 scratchpad)에 `cp` 로 백업.
2. `hasEagerDecorator` 함수 본문 최상단에 `return false;` 를 삽입해 그 함수를 완전히
   무력화(이후 코드는 도달 불가).
3. `npx jest --config jest.config.ts user-entity-exposure` 실행.
4. `cp` 로 원본을 되돌리고 `git status --short` / `git diff` 로 트리가 깨끗함을 확인.

원복 확인: `git status --short codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`
빈 출력, `git diff` 도 빈 출력 — 정상 원복.

## 발견사항

- **[WARNING]** `findEagerUserRelations`/`hasEagerDecorator` — 이번 라운드(직전 리뷰
  `review/code/2026/09/06/11_27_53` W1 대응)에 신설된 eager-관계 검출 축에 **양성
  fixture 가 하나도 없다.** `hasEagerDecorator` 를 완전히 무력화(`return false` 로
  본문 전체를 죽임)해도 가드 spec **15/15 전부 GREEN** 임을 직접 실행으로 확인했다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` —
    함수 `findEagerUserRelations`(79행 부근)·`hasEagerDecorator`(109행 부근). 유일한
    소비 테스트는 `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts`
    의 `it('\`User\` 관계에 \`eager: true\` 를 붙인 자리는 하나도 없다', ...)`
    (106행 부근) 하나뿐이고, 이 단언은 `expect(findEagerUserRelations(entityFiles, SRC_ROOT)).toEqual([])`
    — 즉 실제 엔티티 파일을 스캔해 **빈 배열**을 기대한다.
  - 상세: 이 가드가 검출하려는 것은 "`@ManyToOne(() => User, { eager: true })` 처럼
    호출부에 텍스트를 남기지 않는 `User` 전체 로드" 다(가드 자신의 JSDoc, 68~77행).
    그런데 이 함수가 실제로 **양성 사례를 잡아내는지** 확인하는 fixture 가 없다 —
    `fixtures/user-relation-load.fixture.ts` 에도, 다른 어디에도 `eager: true` 를 쓴
    엔티티 형태가 없다(`grep -rn eager codebase/backend/src/repo-guards/__tests__/fixtures/`
    0건, 실제 엔티티에도 0건이라 진짜 자연 발생 양성도 없다). 결과적으로 현재 단언은
    "지금 코드베이스에 eager `User` 관계가 없다" 는 사실과 "`findEagerUserRelations`
    가 그것을 실제로 검출할 수 있다" 는 주장을 **구분하지 못한다** — 후자가 거짓이어도
    (`hasEagerDecorator` 를 통째로 지워도) 전자가 참인 한 spec 은 계속 초록이다.
    이것은 이 PR 자신이 여러 번 명시한 원칙(형제 fixture 파일 헤더: *"fixture 없는
    래칫은 술어가 죽어도 그린이다(같은 저장소에서 실제로 한 라운드 그랬다)"*, 그리고
    `findUserRelationLoads` 축에는 정확히 이 원칙에 따라 12개 위반/5개 준수 fixture 가
    있다)가 **eager 축에만 적용되지 않은** 사례다. 이 축은 정확히 "호출부에 아무 텍스트도
    남기지 않아 다른 스캔이 원리적으로 못 보는" 위험을 막으려고 신설됐는데, 그 축 자체를
    지키는 유일한 신호가 사라져도 아무도 모른다.
  - 제안: `EagerUserFixture` 같은 최소 fixture(엔티티 형태를 흉내 낸 `@ManyToOne`+
    `eager: true` 데코레이터가 붙은 더미 클래스, 그리고 `eager` 가 없거나 `false` 인
    대조군)를 별도 파일로 두고, `findEagerUserRelations` 를 그 fixture 경로에 대해
    직접 호출해 "양성은 잡고 음성은 놓아 준다"를 단언한다. 실제 엔티티에 대한 `toEqual([])`
    단언은 그대로 남겨도 되지만, 그것만으로는 검출력을 증명하지 못한다는 점을
    분리해서 봐야 한다.

- **[INFO]** 신규 계약 테스트가 저장소 자신의 `schemaOf` 헬퍼(정확히 이 실패를 막으려고
  만들어진 것)를 쓰지 않고 같은 실패 형태를 재도입했다
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.spec.ts`
    — `describe('CREATOR_PROJECTION ↔ WorkflowVersionCreatorDto', ...)` 안
    `const schema = schemasOf(doc).WorkflowVersionCreatorDto;` (게이트 43)
  - 상세: `codebase/backend/src/shared/testing/swagger-probe.ts` 는 `schemaOf(doc, dtoName)`
    라는 헬퍼를 이미 제공하고, 그 헬퍼의 JSDoc 은 정확히 이 패턴을 지목해 만들어졌다 —
    *"원래 네 스펙은 `doc.components?.schemas as Record<…>` 로 캐스팅한 뒤 인덱싱했다.
    DTO 이름을 오타 내거나 프로브가 그 DTO 를 참조하지 않으면 `undefined` 가 나오고,
    다음 줄의 `.properties` 접근이 설명 없는 `TypeError` 로 죽는다."* 그런데 이번에
    새로 추가된 테스트는 `schemasOf(doc)`(복수형, 전체 레코드 반환)을 직접 인덱싱해서
    `schema.properties` 에 접근한다 — `WorkflowVersionCreatorDto` 라는 이름을 오타
    내거나 프로브 컨트롤러가 그 DTO 를 참조하지 않게 되면(예: `@ApiOkResponse` 를
    지우는 리팩터링), `schema` 는 `undefined` 가 되고 `schema.properties` 가 이름 없는
    `TypeError: Cannot read properties of undefined (reading 'properties')` 로 죽는다
    — 정확히 `schemaOf` 가 막으려던 그 실패다. `47`행의 `expect(declared.length).toBeGreaterThan(0)`
    가 스키마가 완전히 빈 경우(`{}`)는 잡아 주지만, "그 DTO 이름 자체가 없음"(`undefined`)
    은 그 단언보다 먼저 터진다.
  - 제안: `const schema = schemaOf(doc, 'WorkflowVersionCreatorDto');` 로 바꾼다.
    기능적으로 테스트가 틀린 결과를 내지는 않는다(실패는 여전히 실패한다) — 다만
    실패 시 원인 진단 비용이 이 저장소가 이미 한 번 없앤 수준으로 되돌아간다.

## 회귀 테스트 검증

- 라벨 재사용(`F.` 중복)·엔티티 관계 이름 파생(`executor` 누락)·`.toLowerCase()` 미관측
  분기·`enclosingName` 우선순위·중첩 객체 미검출·`select` 값 boolean 오탐과 같은 이전
  3 라운드 WARNING 들을 코드에서 직접 재확인했다 — 전부 대응하는 fixture/e2e 케이스가
  실제로 존재하고(`user-relation-load.fixture.ts` 위반 1~12, `workspace-rbac.e2e-spec.ts`
  라벨 `A→S→B→C→D→E→F→G→H→I→J` 유일성·순서, `workflow-crud.e2e-spec.ts` 라벨 `A→H`),
  퇴행 없음을 확인했다. 가드 spec 15/15, 서비스 spec 전부 그린(직접 실행 확인).
- `findUserRelationLoads`/`hasProjectionFor` 축은 위반 12형태·준수 5형태 fixture 로
  두텁게 덮여 있고, "제목에 숫자를 적지 않는다"는 이번 라운드 결정(이전 라운드가 숫자
  드리프트를 세 번 겪은 뒤 내린 것)도 실제로 반영돼 있다(`it('fixture 의 위반 함수를
  하나도 빠짐없이 잡는다', ...)` — 숫자 없이 전체 목록 비교).

## 요약

핵심 검출 축(`findUserRelationLoads`/`hasProjectionFor`, `findUserSecretLeaks`)은
양방향 fixture(위반/준수)와 e2e 3축(이름 부재·계약 대조·양성 필드 확인)으로 두텁게
덮여 있고, 이전 3 라운드가 뮤테이션으로 찾아낸 결함들(중첩 객체 미검출·캐스트 우회·
boolean 오탐 등)이 전부 실제 fixture 로 고정돼 회귀 걱정이 낮다. 다만 이번 라운드에
새로 추가된 `findEagerUserRelations` 축은 그 반대다 — 직접 실행한 뮤테이션 테스트로
확인한 결과, 검출 로직 전체를 지워도 스위트가 15/15 그린을 낸다. 이 축이 막으려는
위험(호출부에 텍스트를 안 남기는 `eager: true`)이 현재 0건이라는 사실과 그 함수가
실제로 검출 능력이 있다는 사실은 서로 다른 주장인데, 지금 테스트는 전자만 확인하고
후자는 확인하지 않는다. 이 PR 이 다른 모든 축에서 정확히 이 원칙("fixture 없는
래칫은 술어가 죽어도 그린이다")을 스스로 여러 차례 인용했다는 점에서, 이 축만 예외로
남은 것이 눈에 띈다. 부수적으로 신규 스키마 대조 테스트가 저장소 자신의 `schemaOf`
헬퍼를 쓰지 않고 그 헬퍼가 막으려던 실패 형태(무명 `TypeError`)를 재도입한 점은
낮은 비용으로 고칠 수 있는 가독성 이슈다.

## 위험도

MEDIUM
