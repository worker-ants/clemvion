# Security Review — `User` 엔티티 컬럼 노출 방어 (2축 검출) + 이전 Critical 수정 확인

## 개요

이번 diff 는 이전 리뷰 라운드(`review/code/2026/09/06/10_13_22`)가 발견한 **살아있는 `User` 전체
컬럼 유출**(`GET /api/workflows/:wfId/versions/:versionId` 가 `WorkflowVersion.creator` 를
투영 없이 반환)에 대한 실제 수정과, 그 유출 클래스를 다시 놓치지 않도록 만든 검출 인프라 2종
(`user-entity-exposure-guard.ts` 구조 축, `user-secret-absence.ts` 이름 축)으로 구성된다.
diff 에는 그 두 이전 리뷰 라운드(코드 리뷰·consistency 체크)의 산출물(SUMMARY/RESOLUTION 등)도
그대로 포함돼 있어, 이번 라운드는 사실상 "Critical 이 실제로 닫혔는가"를 재검증하는 성격이 강하다.

## 검증 방법

저장소를 뮤테이션하지 않고 현재 `HEAD` 상태를 직접 읽어 확인했다(쓰기 없음, `git status` 변화 없음):

- `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` — `findOne` 에
  `select: { …, creator: { id, name, email } }` 투영이 실제로 존재함을 확인.
- `codebase/backend/src/modules/workflow-versions/workflow-versions.controller.ts` — `findOne` 이
  서비스 반환값을 그대로 pass-through 하므로, 투영이 서비스 계층에서 막히지 않으면 그대로
  wire 로 나가는 구조는 여전하지만 지금은 투영이 걸려 있음을 확인.
- `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` — 관계 이름 판정이
  `*.entity.ts` 의 **타입 주석**에서 파생(`collectUserRelationNames`)하고, `relations` 배열
  리터럴·객체 리터럴(TypeORM 0.3)·`leftJoinAndSelect`/`innerJoinAndSelect` 세 형태를 모두
  스캔하며, `.toLowerCase()` 대소문자 무시 분기가 있음을 확인.
- `grep` 으로 저장소 전체에서 `creator`/`owner`/`executor` 관계의 실사용처를 재대조 —
  `Workflow.creator`/`Integration.creator`/`Workspace.owner` 는 어디서도 relations/join 으로
  로드되지 않고, `Execution.executor` 는 `leftJoin`(AndSelect 없음)+`addSelect(['executor.id',
  'executor.name'])` 형태로만 쓰여 준수 형태임을 확인. `WorkflowVersion.creator` 두 자리
  (`findByWorkflow`/`findOne`)는 모두 `select` 투영이 걸려 있음을 확인.
- `codebase/backend/src/modules/users/entities/user.entity.ts` 를 직접 열어 `USER_SECRET_KEYS`
  7개(`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·
  `emailVerifyToken`·`passwordResetToken`·`emailChangeToken`)가 엔티티의 실제 컬럼과 정확히
  1:1 일치함을 확인.
- `auth.service.ts` 의 `logout`/`refresh` — 로드된 `stored.user` 에서 `id`/`email` 만 꺼내
  이력 기록에 쓰고, 엔티티 자체나 응답 바디로는 내보내지 않음을 확인.

## 발견사항

- **[INFO]** 이전 Critical(살아있는 `User` 전체 컬럼 유출)이 실제로 닫혀 있음을 확인
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (`findOne`,
    `select.creator` 투영), `codebase/backend/src/modules/workflow-versions/workflow-versions.controller.ts`
    (`findOne`, pass-through)
  - 상세: `relations: { creator: true }` 옆에 `select: { …, creator: { id: true, name: true,
    email: true } }` 가 실제로 존재한다. 컨트롤러는 여전히 서비스 반환값을 가공 없이 그대로
    돌려주므로 "이 메서드의 select 투영이 곧 보안 경계"라는 구조는 그대로이지만, 지금은 그
    경계가 올바로 세워져 있다. e2e(`workflow-crud.e2e-spec.ts` 신규 테스트)가 `creator` 키
    집합을 `['email','id','name']` 으로 양성 고정하고, `expectNoUserSecrets`+`assertMatchesContract`
    두 축을 함께 배선해 회귀를 잡는다. findings 아님 — 수정 완료 확인.
  - 제안: 없음.

- **[INFO]** 신규 검출 가드(`user-entity-exposure-guard.ts`)가 앞서 지적된 두 사각지대(이름 기반
  매칭·배열 리터럴 전용 파싱)를 실제로 넓혀 닫음
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`
    (`collectUserRelationNames`, `userRelationInInitializer` 의 객체 리터럴 분기)
  - 상세: 관계 이름 집합을 손으로 적지 않고 `*.entity.ts` 의 타입 주석(`@ManyToOne(() => User)` 등
    데코레이터 인자가 아니라 property 타입)에서 파생시켜 `creator`/`executor`/`owner`/`user`
    4종을 전부 잡는다. `relations: { creator: true }`(TypeORM 0.3 객체 형태)도 별도 분기로
    스캔한다. 대소문자 무시(`.toLowerCase()`) 분기는 `violationUppercaseRelation` fixture 로
    관측 가능해졌다(이전 라운드가 뮤테이션으로 관측 불가를 지적했던 부분). 저장소 전체
    grep 대조 결과 이 가드가 놓칠 만한 `User` 전체 로드 자리는 현재 발견되지 않았다.
  - 제안: 없음. 다만 이 가드는 **문자열 리터럴만** 인식한다(`relations: [SOME_CONST]` 처럼
    식별자 간접 참조는 대상 밖) — 이전 라운드 testing 리뷰가 이미 INFO 로 기록해 둔 알려진
    한계이고, 자매 가드들과 같은 트레이드오프라 이번 라운드에서 새로 지적하지 않는다.

- **[INFO]** `user-secret-absence.ts` 는 이름 기반 부재 단언으로 선언-무관 유출을 잡지만, 응답
  바디에 대해서만 유효하고 요청 방향 검증은 아니다 — 설계 의도와 일치, 결함 아님
  - 위치: `codebase/backend/src/shared/testing/user-secret-absence.ts`
  - 상세: `findUserSecretLeaks` 가 깊이 훑는 재귀 walker 는 응답 파싱 결과(`supertest`/`JSON.parse`
    산출물)만 소비하므로 순환 참조로 인한 스택 오버플로 위험은 현재 소비 범위에서는 발생하지
    않는다(이전 라운드 INFO 로 이미 기록됨, 재확인 결과 그대로 유효). `USER_SECRET_KEYS` 7개는
    엔티티 실제 컬럼과 정확히 일치하고, `oauthProviderId` 는 자격증명이 아닌 외부 계정
    식별자라 스코프 밖으로 보는 판단도 타당하다.
  - 제안: 없음(이미 이전 라운드에서 다뤄진 설계 트레이드오프).

- **[INFO]** `select: false`/전역 `ClassSerializerInterceptor` 를 채택하지 않은 근거(19곳 공유
  깔때기, fail-silent 인증 실패 위험)가 실측에 기반해 타당함
  - 위치: `CHANGELOG.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`
  - 상세: `select: false` 를 컬럼에 걸면 `UsersService.findById`/`findByEmail` 공유 로더를
    지나는 46개 호출부가 전부 영향을 받고, 그중 인증 경로(`comparePassword`)가 `undefined` 를
    받아 **예외 없이 조용히 실패**할 위험이 있다는 서술은 합리적이다. 지금 채택한 "검출만 하고
    실행 시점에 막지 않는다"는 방식은 인증 경로를 전혀 건드리지 않아 이 위험 자체를 회피한다.
    이 PR 이 스스로 "이것은 방어가 아니라 검출"이라고 명시한 점도 정확하다 — 즉 이 검출망을
    우회하는 새로운 코드가 추가돼도 CI 는 잡지만 런타임에서 실제로 값이 나가는 것을 막지는
    않는다. 이 한계는 문서에 이미 명확히 disclose 돼 있다.
  - 제안: 없음(설계 트레이드오프, 이미 두 차례 리뷰에서 검증됨). 다음 단계로 defer 된 항목
    (spec `code:` 등재, `secret-store.md`/`1-data-model.md` 규약화)은 이미 `plan/in-progress/
    spec-draft-nullable-notation-followups.md` 에 후속 체크박스로 등재돼 있으므로 이번 라운드
    security 관점에서 추가할 것 없음.

- **[INFO]** CHANGELOG 에 과거 유출 사고의 구체 세부사항(노출 컬럼명·엔드포인트·도달 권한)이
  평문으로 기록됨 — 이미 패치됐고 사내 변경 이력 관례상 통상적이나 참고로 기록
  - 위치: `CHANGELOG.md` "Unreleased — `User` 엔티티에 마지막 방어선을 세운다" 절
  - 상세: 수정이 이미 이 diff 안에 함께 들어 있어 실제 위험 기간(vulnerability window)은 이미
    닫혔고, 사고 원인·영향·수정 내역을 투명하게 남기는 것은 이 저장소의 확립된 관례(감사 로그
    유출 건도 동일하게 기록됨)다. 다만 이 저장소가 향후 공개되거나 CHANGELOG 가 외부에 노출될
    가능성이 있다면, "어떤 컬럼이 어떤 엔드포인트로 어떤 권한 수준에 나갔었는가"를 구체적으로
    적시하는 것이 재구성 가능한 공격 정보를 제공할 수 있음을 인지해 둘 필요는 있다 — 지금은
    이미 수정 완료 상태이므로 이번 PR 의 결함으로 잡지 않는다.
  - 제안: 조치 불요(현재 상태에서). 저장소 공개 정책이 바뀌는 시점에 과거 CHANGELOG 항목의
    민감도를 재검토하는 것을 권장(이번 diff 범위 밖).

- **[INFO]** `WorkspaceMemberDto.joinedAt` 필드 추가는 wire 동작을 바꾸지 않는 순수 선언
  보강이며 보안 영향 없음
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`
  - 상세: `WorkspacesService.listMembers` 가 이미 무조건 `joinedAt: m.joinedAt` 을 싣고
    있었음을 실측(4개 생성 경로 확인)으로 뒷받침했고, 이번 DTO 선언은 그 사실을 뒤늦게
    문서화한 것뿐이다. 새로운 정보 노출이 아니다.
  - 제안: 없음.

## 요약

이번 diff 는 직전 라운드에서 발견된 **실제로 살아있던 Critical**(워크플로 버전 상세 조회가
`User` 엔티티 전체를 투영 없이 반환)을 `select` 투영으로 닫았고, 그 재발을 막기 위해 구조
기반(AST, 타입 주석에서 파생한 관계 이름 집합) + 값 기반(응답 본문 깊이 훑는 이름 기반 부재
단언) 두 축의 검출 인프라를 신설했다. 직접 코드를 열어 (1) 수정된 `select` 투영이 실제로
존재하는지, (2) 새 가드의 판정 축이 실제로 넓어졌는지(이름→타입, 배열 전용→객체 형태 포함),
(3) 저장소 전체의 `creator`/`owner`/`executor` 관계 실사용처가 전부 준수 형태이거나 로드
자체가 없는지, (4) `USER_SECRET_KEYS` 7개가 엔티티 실제 컬럼과 일치하는지를 재확인했고 모두
일치했다. 이 방어는 스스로 명시하듯 런타임 방어가 아니라 컴파일/테스트 타임 검출이라는
한계가 있으나, 그 한계는 실측 근거(19곳 공유 로더, fail-silent 인증 실패 위험, 298개 e2e
전체 wire 변경 비용)와 함께 투명하게 문서화돼 있고 인증 경로를 전혀 건드리지 않는다. 새로운
인젝션·하드코딩 시크릿·인가 우회·안전하지 않은 암호화 문제는 발견되지 않았다. 남은 사각지대
(신규 가드의 spec `code:` 미등재, `User` 노출 금지 규약의 spec 미선언)는 developer 권한 밖의
planner 후속 사항으로 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에
등재돼 있어 이번 라운드에서 새로 지적할 보안 결함은 없다.

## 위험도

NONE
