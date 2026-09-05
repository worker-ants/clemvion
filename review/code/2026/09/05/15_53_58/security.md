# 보안(Security) 코드 리뷰

## 검토 범위

이번 diff(`origin/main..HEAD`)의 실질 코드 변경은 다음으로 구성된다.

- `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` — `GET /api/audit-logs` 의
  `user` 조인을 `leftJoinAndSelect('al.user','user')`(User 엔티티 전 컬럼, 26키) →
  `leftJoin('al.user','user')` + `addSelect(['user.id','user.name','user.email'])` 로 좁힘.
  이 커밋 이전에는 `passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·
  `webauthnRecoveryCodes`(자격증명) 및 `passwordResetToken`·`emailVerifyToken`·
  `emailChangeToken`(계정 탈취 토큰)이 워크스페이스 Admin+ 응답에 그대로 실려 나갔다.
  본 review round 시점에는 **이미 수정된 상태**로 diff 에 포함되어 있다.
- `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts` — 위 수정에 대한 unit 캐너리
  (`leftJoinAndSelect` 미호출을 `not.toHaveProperty` 로 고정).
- `codebase/backend/src/shared/testing/response-contract.ts` / `.spec.ts` — §5.4(응답의
  `null` vs 키 생략) 준수를 실 HTTP 응답 vs 생성된 OpenAPI 스키마로 대조하는 신규 테스트 전용
  헬퍼. 프로덕션 코드 아님.
- `codebase/backend/test/{audit-logs,session-revocation,workflow-crud,workflow-execution}.e2e-spec.ts`
  — 위 헬퍼 배선 + `audit-logs` 쪽엔 `Object.keys(user)` 를 직접 단언하는 독립 캐너리 추가
  (검증자 자신이 이 유출을 놓쳤던 이력 때문에 검증자에 기대지 않는 카나리를 별도로 둠).
- `CHANGELOG.md`, `plan/in-progress/*.md`, `review/**` — 문서/추적 산출물. 실행 코드 아님.

`Read` 로 현재 소스(`audit-logs.service.ts`, `user.entity.ts`, `response-contract.ts`,
`tsconfig.build.json`)를 직접 열어 대조했고, `git diff origin/main..HEAD -- codebase/` 전체를
시크릿 패턴으로 grep 했다. 저장소에 어떤 뮤테이션도 가하지 않았다(`git status --short` 로
확인 — 이 세션의 산출물 디렉터리 외 변경 없음).

## 발견사항

- **[INFO]** (사전 존재 — 이번 diff 가 만든 결함 아님) `User` 엔티티에는 여전히 구조적 방어
  레이어(`select: false` / `@Exclude()` / 전역 `ClassSerializerInterceptor`)가 없다 — 이번
  수정은 **이 호출 지점 하나**만 좁혔을 뿐이다
  - 위치: `codebase/backend/src/modules/users/entities/user.entity.ts` 전체
    (`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·
    `passwordResetToken`·`emailVerifyToken`·`emailChangeToken` 컬럼 선언부, 21-27/44-50/
    56-62/69-75/95-101/80-86/127-133행) / `codebase/backend/src/modules/audit-logs/audit-logs.service.ts`
    (이번에 고친 자리, 65-66행)
  - 상세: 직접 열어 확인한 결과 `user.entity.ts` 에 `select: false`/`@Exclude()` 가 0건이고,
    저장소 전체에 전역 `ClassSerializerInterceptor` 도 없다. 즉 "컨트롤러가 엔티티를 그대로
    반환하는 관행"(이 PR 이 만든 패턴이 아니라 기존 관행) 위에서, **다음에 `User` 를 조인하는
    코드**가 습관적으로 `leftJoinAndSelect` 를 쓰면 오늘 고친 것과 동일한 클래스의 유출이
    다른 엔드포인트에서 재발할 수 있다. 지금 이를 잡을 안전망은 신설된
    `response-contract.ts` 기반 e2e 대조뿐인데, 이번 PR 은 그것을 4개 DTO 에만 배선했다(전체
    응답 DTO 대비 일부). 이 gap 자체는 이미 이전 라운드(`review/code/2026/09/05/14_39_31/architecture.md`
    WARNING)에서 지적되고 후속 항목으로 plan 에 등재가 권고된 사안이라 본 라운드에서 새로
    발견한 것은 아니며, 이번 diff 범위(`audit-logs.service.ts` 콜사이트 수정)를 벗어나는
    엔티티 레벨 변경이라 이 PR 의 블로킹 사유로 잡지 않는다.
  - 제안: 조치 불요(이번 PR 범위 밖). 후속 항목으로 `User` 엔티티의 인증 비밀 컬럼에
    TypeORM `select: false` 를 걸어 "명시적으로 `addSelect` 하지 않는 한 어떤 조인도 이
    컬럼을 싣지 못한다"는 안전 기본값을 두는 것을 별도 트래킹에 유지할 것을 권장한다(이미
    plan 트래킹 존재 여부는 developer 트랙 확인 필요).

- **[INFO]** (확인 완료, 결함 아님) 신설된 테스트 헬퍼 `response-contract.ts` 는 프로덕션
  빌드에서 안전하게 격리되어 있고, 인젝션·시크릿 노출 표면이 없다
  - 위치: `codebase/backend/tsconfig.build.json` (`exclude: ["src/shared/testing/**"]`)
  - 상세: 직접 확인 결과 `src/shared/testing/**` 가 `tsconfig.build.json` exclude 목록에
    이미 있어 devDependency(`@nestjs/testing`, `@nestjs/swagger`)를 import 하는 이 코드가
    `dist` 로 새지 않는다. `findContractViolations`/`formatViolations`(`response-contract.ts:314-353`)
    가 던지는 에러 메시지에는 필드 경로(`property`)와 위반 종류(`kind`)만 담기고 **실제
    payload 값 자체는 포함하지 않는다** — 테스트 실패 로그에 실 응답의 비밀번호 해시·토큰
    값이 그대로 찍힐 위험이 없다. HTTP 요청 조립이나 쉘 명령·문자열 결합 SQL 을 다루지
    않으므로 인젝션 표면도 없다.

- **[INFO]** (확인 완료, 결함 아님) 수정된 `AuditLogsService.findAll` 쿼리는 파라미터
  바인딩과 컬럼명 allowlist 를 그대로 유지한다
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` (`where`/`andWhere`
    절 67-84행, `getSortColumn` 151-158행)
  - 상세: `workspaceId`/`action`/`resourceType`/`userId`/`startDate`/`endDate` 전부 named
    parameter(`:workspaceId` 등)로 바인딩되고, 정렬 컬럼은 `getSortColumn` 의 고정
    allowlist(`created_at`/`action`/`resource_type`)를 거쳐 문자열 결합(`al.${sortColumn}`)
    되므로 사용자 입력이 직접 SQL 조각으로 들어가지 않는다. 이번 diff 는 이 로직을 바꾸지
    않았다 — 회귀 없음.

- **[INFO]** 하드코딩된 시크릿 없음 — `git diff origin/main..HEAD -- codebase/` 전체를
  API 키/시크릿/토큰/PEM 헤더 패턴으로 grep 한 결과, 매치는 전부 필드명 리터럴
  (`passwordHash`, `passwordResetToken` 등 컬럼/DTO 이름) 또는 기존 테스트 상수
  `TEST_PASSWORD` 참조뿐이며 실제 자격증명 값은 없다.

## 요약

핵심 변경은 `GET /api/audit-logs` 가 `User` 엔티티 26개 컬럼(자격증명 4종 + 계정 탈취 토큰
3종 포함)을 그대로 응답에 실어 보내던 민감정보 과다 노출을 `leftJoin`+`addSelect` 로 필요한
3필드(`id`/`name`/`email`)만 조회하도록 좁힌 수정이며, 직접 소스를 열어 파라미터 바인딩·
정렬 컬럼 allowlist 가 그대로 유지됨을 확인했다. 함께 신설된 §5.4 응답-계약 대조 테스트
헬퍼(`response-contract.ts`)는 프로덕션 빌드에서 격리되어 있고 실 payload 값을 에러 메시지에
노출하지 않으며, 4개 e2e 스펙에 배선된 대조 단언과 감사 로그 쪽의 독립 `Object.keys` 카나리는
같은 유출 클래스의 재발을 다른 채널로도 잡도록 설계되어 있다. diff 안에 하드코딩된 시크릿·
인젝션 취약점·인증 우회는 없다. 유일한 잔여 관찰은 `User` 엔티티 자체에 `select: false`/
`@Exclude()`/전역 직렬화 인터셉터 같은 구조적 방어가 없어 이번에 고친 호출 지점 외의 다른
조인에서 같은 결함 클래스가 재발할 여지가 있다는 것인데, 이는 이번 diff 가 만든 결함이 아니고
이전 라운드에서 이미 식별·후속 항목으로 지목된 사안이라 이번 PR 을 블로킹하지 않는다.

## 위험도

NONE
