# 보안(Security) 리뷰

## 관측된 이상 상태 — 내가 만들지 않은 워킹트리 뮤테이션

리뷰 도중 `git status --short` 로 확인한 결과, 아래 파일에 **내가 만들지 않은** 미커밋
변경이 있었다:

```
 M codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts
```

```diff
@@ hasEagerDecorator 함수 시작부 @@
+  return false; // MUTATION: always false
```

이 리뷰는 해당 파일을 **`Read` 로만** 열었고(뮤테이션 검증을 이 파일에 대해 수행하지
않았다), 다른 병렬 reviewer 가 뮤테이션 검증 중에 남긴 것으로 보인다. 프롬프트 규약에 따라
**직접 원복을 시도하지 않았다** — 다른 reviewer 의 진행 중인 뮤테이션 테스트를 되돌리면
그쪽 판정을 오염시킬 수 있기 때문이다(같은 세션 교훈: 리뷰어가 `git restore` 로 남의
미커밋 작업을 지운 전례가 있다). 이 상태 그대로 관측을 보고한다 — orchestrator 또는 해당
reviewer 가 자신의 원복 절차를 마무리해야 한다.

이 이상 상태는 이 리포트의 아래 분석(코드 정독 기반)에 영향을 주지 않는다 — 나는 `Read`
로 확보한 정본 내용을 근거로 분석했다.

## 검증 방법

저장소를 뮤테이션하지 않고 읽기 전용으로 확인했다 (프롬프트에 diff 가 생략된 파일은 `Read`
로 원본을 직접 열어 확인):

- `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` /
  `user-entity-exposure.spec.ts` / `fixtures/user-relation-load.fixture.ts` 전문을 직접 열람.
- `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` 전문을 열어
  이전 라운드(Critical 1, `review/code/2026/09/06/10_13_22`)에서 지적된 `findOne` 의 무투영
  `relations: ['creator']` 가 실제로 `select: { …, creator: CREATOR_PROJECTION }` 로 닫혔는지
  확인 — **닫혀 있다.**
- `WorkflowVersionCreatorDto` 선언(`id`/`name`/`email`)과 `CREATOR_PROJECTION` 키 집합이
  일치함을 대조.
- `user.entity.ts` 를 열어 `USER_SECRET_KEYS` 7개(`passwordHash`·`twoFactorSecret`·
  `totpRecoveryCodes`·`webauthnRecoveryCodes`·`emailVerifyToken`·`passwordResetToken`·
  `emailChangeToken`)가 엔티티의 실제 컬럼과 정확히 일치함을 확인.
- `grep` 으로 저장소 전체에서 `owner`/`executor` 관계 로드 지점을 찾아, 현재 코드베이스에
  가드의 화이트리스트(`EXPECTED_USER_RELATION_LOADS`) 밖에 무투영 로드가 없음을 확인
  (`dashboard.service.ts`/`executions.service.ts` 는 `leftJoin`+`addSelect` 준수 형태만 사용).
- `WorkflowVersionsService.createVersion`/`restoreVersion` 의 호출부(`workflows.service.ts`)를
  추적해 `creator` 미투영 반환값이 응답 바디로 새지 않음을 확인(둘 다 소비하지 않음).
- `audit-logs.service.ts` 가 이전 라운드에서 이미 `leftJoin`+`addSelect` 준수 형태로 고쳐져
  있음을 재확인.

## 발견사항

- **[INFO]** 신규 검출 가드(`hasProjectionFor`)가 `select` 값이 **불리언 리터럴인지**만 보고,
  식별자(변수)가 실제로 무엇으로 평가되는지는 보지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` —
    `hasProjectionFor` 함수 (게이트 277~306, 특히 296~302줄의
    `value.kind !== ts.SyntaxKind.TrueKeyword && value.kind !== ts.SyntaxKind.FalseKeyword`)
  - 상세: 이 판정은 `select: { creator: true }` (겉은 투영, 실은 전체 노출)를 막기 위해
    이번 PR 이 새로 넣은 것이다(직전 라운드 W2 수정, 게이트 271~275의 자체 주석이 그 트레이드
    오프를 명시한다). 그런데 판정 기준이 "AST 노드가 `True`/`False` 키워드 토큰인가"뿐이라,
    `select: { creator: SOME_FLAG }` 처럼 **불리언 값을 가리키는 식별자**를 쓰면 그 식별자가
    실제로 `true` 로 평가되더라도(예: `const SOME_FLAG = true;`) `ts.SyntaxKind.Identifier` 로
    판정돼 "투영됨(안전)" 으로 통과한다. 즉 `select: { creator: true }` 라는 정확히 같은
    런타임 결과를, 리터럴 대신 불리언 변수를 한 겹 씌우는 것만으로 검출망 밖에 둘 수 있다.
    이 저장소가 실제로 이름 있는 상수 투영(`CREATOR_PROJECTION`)을 쓰는 관례이기 때문에
    발생한 필연적 트레이드오프이며, 가드 파일 자신이 "타입 체커가 필요한데 단일 파일 AST 만
    본다" 고 이미 밝히고 있어 새로 발견한 결함이라기보다 **의도적으로 남긴 사각지대**다.
    실제 악용 가능성은 낮다 — 이 프로젝트 코드에서 `true` 를 가리키는 이름 있는 상수를 만들어
    `select` 에 끼워 넣는 패턴이 나타날 유인이 없고, 나타나더라도 이번 PR 이 추가한 **두
    번째 축**(`user-secret-absence.ts` 의 `expectNoUserSecrets`, 값 기반·선언 무관 검증)이
    그 엔드포인트에 e2e 로 배선돼 있다면 응답 바디에서 여전히 잡는다.
  - 제안: 지금 당장 구조를 바꿀 필요는 없다(구조 축의 한계는 이름 축이 보완한다는 것이
    설계 의도이자 이 PR 의 명시적 근거다). 다만 이 사각지대를 가드 자신의 JSDoc 에 한 줄
    남겨(이미 있는 "왜 불리언인가" 설명에 "식별자 우회는 노린다면 가능하나 실사용 유인이
    없다" 정도) 다음 사람이 "이 가드가 완전하다" 고 오인하지 않게 하면 충분하다.

- **[INFO]** 이 PR 의 방어 전략 전체가 실행 시점 차단이 아니라 **CI 테스트 시점 검출**이다
  - 위치: `CHANGELOG.md`(§"택한 것 — 원인은 구조로, 결과는 이름으로") /
    `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts`(파일 헤더 주석)
  - 상세: 문서 자신이 "이것은 방어가 아니라 검출이다. 실행 시점에 막지 않는다" 고 명시적으로
    밝히고 있다. `select: false`·전역 `ClassSerializerInterceptor` 를 기각한 근거(19곳 공유
    깔때기의 fail-silent 인증 붕괴 위험, 298개 e2e 표면 전체 변경)는 실측에 기반해 타당하고,
    두 축(구조 AST 스캔 + 값 기반 깊이 훑기)이 서로 다른 결함 형태(선언 vs 무선언, 이름 vs
    타입)를 잡도록 설계돼 있어 회귀 방지 그물로서는 견고하다. 다만 이 그물은 **CI/테스트
    실행 경로에만** 존재한다 — 프로덕션 런타임에는 어떤 컬럼 수준 방어도 없으므로, 신규
    `User` 관계 로드 지점이 이 두 가드 어느 것에도 걸리지 않는 방식(예: 완전히 새로운
    ORM 접근 패턴, 또는 테스트가 실행되지 않는 핫픽스 배포)으로 도입되면 무방비로 유출된다.
    이는 이번 diff 가 만든 새로운 리스크가 아니라 **선택한 아키텍처의 고유한 성격**이고,
    plan 문서(`spec-draft-nullable-notation-followups.md`)에도 "확인 후 닫는다" 는 조건부로
    이미 등재돼 있다.
  - 제안: 조치 불요 — 설계 의도대로다. 장기적으로 `select: false` 또는 직렬화 인터셉터
    도입이 재검토될 때를 대비해, 이번에 전수 열거한 "19곳 공유 깔때기 · 46개 호출 지점"
    수치를 그 재검토의 출발점으로 남겨 둔 것(plan 문서에 이미 있음)으로 충분하다.

## 이번 diff 가 실제로 닫은 것 (확인됨)

- **`GET /api/workflows/:wfId/versions/:versionId`** 가 `WorkflowVersion.creator`
  (`@ManyToOne(() => User)`)를 `relations: ['creator']` 로 투영 없이 로드하고 컨트롤러가
  가공 없이 반환하던 실제 유출(이전 라운드 Critical 1)이, `select: { …, creator:
  CREATOR_PROJECTION }` 투영 추가로 닫혔다. `CREATOR_PROJECTION`(`id`/`name`/`email`)이
  `WorkflowVersionCreatorDto` 광고 필드와 정확히 일치하고, 이 일치를 OpenAPI 스키마 대조
  테스트(`workflow-versions.service.spec.ts`)가 코드로 강제한다.
- 관계 **이름**(`user`) 대신 **타입**(`User`)으로 매칭 축을 바꿔 `creator`/`owner`/`executor`
  까지 자동 파생되도록 넓혔고, 손으로 적은 목록보다 파생이 실제로 더 넓다는 것을 실측으로
  확인했다(재검증: `owner` 관계는 저장소 전체에서 현재 로드하는 곳이 없다).
- `relations: { creator: true }` (TypeORM 0.3 객체 형태)와 `select: { creator: true }`
  (겉은 투영, 실은 미narrow) 두 사각지대를 각각 fixture 양성/음성 대조군으로 뮤테이션
  검증했다.
- 새 e2e(`workflow-crud.e2e-spec.ts` H, `workspace-rbac.e2e-spec.ts` J)가 이름 축을
  선언-대조 축보다 먼저 실행하도록 순서를 잡아, "선언 대조가 먼저 던져 이름 축이 실행조차
  안 된다" 는 자체 관측(뮤테이션)에 따라 두 축이 독립적으로 관측 가능함을 확인했다.
- 하드코딩된 시크릿, SQL/커맨드 인젝션, 인증 우회, 안전하지 않은 암호화 알고리즘은 이번
  diff 범위(가드 2종·e2e·DTO 필드 1개 추가) 어디에도 없다. `WorkspaceMemberDto.joinedAt`
  추가는 이미 wire 에 실리던 값을 문서화한 것뿐이라 동작 변경이 아니다.

## 요약

이번 변경은 감사 로그 유출을 계기로 `User` 엔티티에 회귀 방지용 2축 검출 가드(구조 AST
스캔 + 응답 값 깊이 훑기)를 신설하는 작업으로, 그 과정에서 스스로 발견한 실제 Critical
유출(`GET /workflows/:wfId/versions/:versionId` 이 버전 작성자의 `passwordHash`·2FA
시크릿·복구 코드·계정 탈취 토큰을 전부 노출)을 이 diff 안에서 올바르게 닫았다 — 투영
상수가 DTO 선언과 정확히 일치함을 OpenAPI 스키마 대조 테스트로 코드 레벨에서 강제하고,
컨트롤러가 결과를 가공 없이 반환하는 경로임을 직접 확인했다. 가드 자체도 세 라운드에
걸쳐 이름 기반→타입 기반 매칭, 배열/객체 두 `relations` 형태, "불리언 select" 위장 형태를
차례로 닫아 현재 상태는 견고하다. 남은 두 항목은 모두 INFO 수준으로, (1) `select` 값이
불리언 리터럴인지만 보고 식별자 평가는 보지 않는 좁은 사각지대(저위험, 두 번째 축이
백업)와 (2) 이 전략 전체가 런타임 차단이 아니라 CI 검출이라는, 문서 자신이 이미 밝히고
plan 에 조건부로 등재된 설계상의 성격이다. 둘 다 이번 diff 가 새로 만든 취약점이 아니다.
별도로, 리뷰 중 내가 만들지 않은 워킹트리 뮤테이션(`user-entity-exposure-guard.ts` 의
`hasEagerDecorator` 에 삽입된 `return false;`)을 관측했다 — 다른 병렬 reviewer 의 잔여물로
보이며, 이 리포트는 그 상태를 원복하지 않고 그대로 보고한다.

## 위험도
LOW
