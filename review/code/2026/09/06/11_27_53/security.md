# 보안(Security) 리뷰

## 검증 방법

저장소를 뮤테이션하지 않고 확인했다 (`git status --short` 시작·종료 모두 clean — 이번 리뷰
세션 자신의 출력 디렉터리 외 변경 없음):

- `workflow-versions.service.ts`/`.controller.ts` 를 직접 열어 이전 라운드가 지적한 Critical
  (`findOne` 이 `User` 전 컬럼을 투영 없이 pass-through)이 `CREATOR_PROJECTION`
  (`{id,name,email}`)로 실제로 닫혀 있음을 확인.
- `WorkflowVersionCreatorDto` 선언(`id`·`name`·`email`)과 `CREATOR_PROJECTION` 이 일치함을
  직접 대조. 연동 테스트(`workflow-versions.service.spec.ts` 의 OpenAPI 스키마 대조)도 같은
  것을 코드로 강제하고 있음을 확인.
- `npx jest src/repo-guards/__tests__/user-entity-exposure.spec.ts
  src/shared/testing/user-secret-absence.spec.ts
  src/modules/workflow-versions/workflow-versions.service.spec.ts` → **31/31 통과**.
- `user.entity.ts` 전문을 읽어 `USER_SECRET_KEYS` 7개(`passwordHash`·`twoFactorSecret`·
  `totpRecoveryCodes`·`webauthnRecoveryCodes`·`emailVerifyToken`·`passwordResetToken`·
  `emailChangeToken`)가 실제 컬럼과 1:1 일치함을 확인. `select: false`/`@Exclude`/`@Expose`/
  `ClassSerializerInterceptor` 가 저장소 전체에 0건이라는 CHANGELOG·JSDoc 의 주장을
  `grep` 으로 재검증 — 사실과 일치.
- `grep "eager"` 로 `User` 관계를 포함한 모든 엔티티에 `eager: true` 가 없음을 확인(아래
  WARNING 참고 — 있었다면 이번 가드가 못 잡는 형태였다).
- 신규 AST 가드(`user-entity-exposure-guard.ts`)와 fixture(`user-relation-load.fixture.ts`)를
  읽고 위반 11형태/준수 4형태가 실제 술어와 대응하는지 확인. `unwrap`(as/satisfies/괄호 벗기기),
  `hasProjectionFor`(같은 옵션의 select 투영 인식), 대소문자 무시, 중첩 객체 재귀 처리 모두
  코드로 확인.
- 가드의 스캔 범위(`src/modules`)가 `User` 관계 로드 지점을 실제로 전부 덮는지, `nodes/`·
  `scripts/`·`shared/`·`bootstrap/`·`database/` 에 `relations` 사용이 있는지 `grep` 으로
  교차 확인 — 0건.
- `Execution.executor`/`Workspace.owner` 관계의 실제 사용처를 전수 확인 — 둘 다 `leftJoin`
  (AndSelect 없음) 또는 미사용이라 위반 형태가 아님을 확인.
- 감사 로그 유출(#1288, `GET /api/audit-logs`)의 기존 수정이 이번 diff 로 회귀하지 않았음을
  `audit-logs.service.ts` 를 열어 재확인 (`leftJoin` + `addSelect` 3필드, `leftJoinAndSelect`
  아님).

## 발견사항

- **[WARNING]** 신규 "마지막 방어선" 가드가 TypeORM `eager` 관계 로딩 경로를 검출하지 못한다
  — 이름이 아니라 **호출 부재**가 문제
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` 의
    `findUserRelationLoads`/`collectUserRelationNames` (파일 전체) — 이 가드가 스스로를
    "구조가 생기는 순간 잡는 마지막 방어선"이라고 규정하는 자리(`user-entity-exposure.spec.ts`
    헤더 JSDoc)
  - 상세: 이 가드는 호출부의 `relations: […]`/`relations: {…}` 프로퍼티나
    `leftJoinAndSelect`/`innerJoinAndSelect` 호출을 **텍스트로** 찾아서 판정한다. 그런데
    TypeORM 의 `@ManyToOne(() => User, { eager: true })` 로 관계를 선언하면, 그 관계는
    `find`/`findOne` 호출부에 `relations` 옵션을 **전혀 쓰지 않아도** 자동으로 로드된다 —
    즉 이 가드가 텍스트로 매칭할 대상 자체가 호출부에 존재하지 않는다. `collectUserRelationNames`
    도 속성의 **타입 주석**만 보고 데코레이터의 `eager` 옵션은 읽지 않으므로, 관계 선언
    시점에서도 이 위험을 잡지 못한다. 현재 저장소를 실측한 결과(`grep -rn "eager"
    src/modules --include="*.entity.ts"` → 0건) 이 벡터는 **아직 실제로 존재하지 않는
    이론적 위험**이지만, 이 가드가 "감사 로그 유출을 놓친 선언 기반 검증자를 보완하는 마지막
    방어선"이라는 강한 주장을 하는 만큼, 다음 사람이 성능 최적화 목적으로 `User` 관계에
    `eager: true` 를 붙이는 순간(TypeORM 에서 N+1 회피를 위해 흔히 쓰는 옵션이다) 이 가드는
    그 자리를 영구히 조용히 놓친다 — 정확히 이 PR 이 감사 로그 사건에서 배운 교훈("검출망이
    한 형태를 놓치면 그 자리가 산다")이 재발할 수 있는 새 형태다.
  - 제안: `collectUserRelationNames`(또는 별도 함수)에서 `@ManyToOne`/`@OneToOne` 등 관계
    데코레이터의 `eager: true` 옵션을 파싱해, `User` 관계에 `eager: true` 가 설정된 자리
    자체를 위반(또는 최소 경고)으로 잡는 fixture 를 하나 추가한다. 우선순위는 낮음(현재 0건이고
    프로덕션에 이 패턴이 없음이 확인됨) — 다만 CHANGELOG/JSDoc 의 "이 가드가 놓치는 형태"
    목록에 최소한 한 줄로 명시해 두면, 다음에 `eager` 옵션을 쓰려는 사람이 이 가드가 못 본다는
    것을 미리 안다.

- **[INFO]** 검출은 됐지만 방어는 되지 않는다는 설계 트레이드오프는 정확히 인지·문서화되어 있고,
  대안 기각 근거(select:false 의 fail-silent 위험 · 전역 인터셉터의 wire 전체 변경 비용)도
  실측(19곳 공유 깔때기·46개 호출 지점·0건 실측)에 근거해 타당하다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts:11-38`,
    `CHANGELOG.md` "Unreleased — `User` 엔티티에 마지막 방어선을 세운다" 절
  - 상세: `select: false` 를 공유 로더(`UsersService.findById`/`findByEmail`)에 적용하면
    `comparePassword(x, undefined)` 로 인증이 **예외 없이 조용히 실패**할 수 있다는 위험
    평가는 실측(19곳/46곳)과 논리 모두 타당하다. 이번 두 가드(구조 AST + 이름 기반 런타임
    스캔)는 실행 시점 방어가 아니라 CI/테스트 시점 검출이므로, **아직 배선되지 않은
    엔드포인트**나 **테스트를 거치지 않는 운영 경로**(예: 배치 스크립트가 직접 조회 후 외부
    시스템으로 export, 혹은 로그에 직접 dump)에서는 여전히 무방비다. 이는 이 PR 이 스스로
    명시한 한계이며 findings 로 새로 지적할 결함이 아니라, 다음 감사 시점에 "검출기가 있으니
    안전하다"고 오판하지 않도록 재확인해 두는 기록이다.
  - 제안: 조치 불요 — 참고 기록.

- **[INFO]** `WorkflowVersionsService.findOne` 의 신규 `select` 가 `User` 노출을 정확히
  차단함을 실제 컨트롤러 pass-through 경로로 재확인
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.controller.ts:81`
    (`return this.workflowVersionsService.findOne(...)`, 가공 없음) →
    `workflow-versions.service.ts` 의 `findOne`(`CREATOR_PROJECTION` 사용)
  - 상세: 컨트롤러가 서비스 반환값을 그대로 돌려주는 구조이므로 서비스 계층의 투영이 곧
    wire 계약이다. `CREATOR_PROJECTION` 이 `WorkflowVersionCreatorDto` 스키마와 테스트로
    강제 대조되고(`workflow-versions.service.spec.ts` OpenAPI 스키마 비교), unit 31/31 ·
    관련 e2e 가 이번 diff 에 신설되어 있음을 확인했다. 이전 라운드의 Critical(버전 작성자의
    `passwordHash`·2FA 시크릿·복구 코드·토큰 전량 유출)은 현재 코드 상태에서 재현되지 않는다.
  - 제안: 없음 — 정상 처분 확인.

- **[INFO]** 신규 가드 2쌍이 어떤 spec `code:` 에도 등재되지 않아 향후 이 파일들이 약화돼도
  spec 재검토 게이트가 걸리지 않는다 — 이미 동일 세션의 documentation/maintainability
  reviewer 와 두 차례의 consistency-check 가 독립적으로 지적했고 `plan/in-progress/
  spec-draft-nullable-notation-followups.md` 에 planner 후속으로 등재되어 있음(권한 밖,
  developer 가 `spec/` 을 못 쓰므로 정당한 처분)
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` /
    `user-entity-exposure.spec.ts` / `codebase/backend/src/shared/testing/user-secret-absence.ts`
    / `user-secret-absence.spec.ts`
  - 상세: 보안 관점에서 이 갭 자체가 지금 당장 취약점을 만들지는 않지만, "검출기가 검출 능력을
    잃어도 아무도 모른다"는 2차 리스크다. 이미 등재·인지된 사항이라 새로 지적하지 않고 확인만
    한다.
  - 제안: 없음 — planner 턴에서 처리 예정인 것을 재확인.

## 요약

이번 diff 의 핵심은 감사 로그 26키 유출(#1288) 이후 열려 있던 "`User` 엔티티 컬럼 수준
방어" 결정을 매듭짓는 것이며, 실제 취약점 하나(`GET /api/workflows/:wfId/versions/:versionId`
가 `WorkflowVersion.creator` 관계를 투영 없이 로드해 `passwordHash`·2FA 시크릿·복구 코드·
탈취용 토큰을 전량 노출)를 이전 리뷰 라운드에서 발견해 `CREATOR_PROJECTION` 상수 + 테스트
강제(3중 축: 이름 부재·계약 대조·`creator` 3필드 양성)로 실제로 닫았음을 현재 코드 상태에서
직접 재현·검증했다. 신규 검출 인프라(AST 기반 구조 가드 + 이름 기반 런타임 스캔)는 스스로
"방어가 아니라 검출"이라고 명시하고 있고 그 경계 설정(`select:false`/전역 인터셉터 기각 근거)도
실측에 기반해 타당하다. 다만 그 가드에도 자체 사각지대가 하나 있다 — TypeORM `eager` 관계
로딩은 호출부에 `relations` 텍스트가 없어 AST 매칭 대상 자체가 사라지므로 검출망 밖에 있다.
현재 저장소에는 이 패턴이 없어(실측 0건) 즉시 위험은 아니지만, 이 가드가 "마지막 방어선"을
자처하는 만큼 한계로 명시해 둘 가치가 있다. 그 외 인젝션·하드코딩 시크릿·인증 우회·평문 전송·
에러 메시지 정보 노출 관점에서는 이번 diff 에 해당 사항이 없다(신규 요청 검증 경로도 없음).
Critical 급 결함은 발견되지 않았다.

## 위험도

LOW
