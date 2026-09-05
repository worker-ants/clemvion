# 보안(Security) 코드 리뷰

## 검토 범위

- `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` — `GET /api/audit-logs` 의
  `user` 조인을 `leftJoinAndSelect` → `leftJoin` + `addSelect(['user.id','user.name','user.email'])`
  로 좁힘 (**직전 리뷰 라운드 `13_49_54` 에서 지적된 Critical 정보 노출의 수정**)
- `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts` — 위 수정에 대한 unit 캐너리
- `codebase/backend/src/shared/testing/response-contract.ts` / `.spec.ts` — 응답 1건 vs DTO
  선언(§5.4)을 대조하는 신규 테스트 전용 헬퍼 (프로덕션 미배포)
- `codebase/backend/test/{audit-logs,session-revocation,workflow-crud,workflow-execution}.e2e-spec.ts`
  — 위 헬퍼 배선 + `audit-logs` 쪽엔 `Object.keys(user)` 직접 단언 추가
- `plan/in-progress/*.md`, `review/code/2026/09/05/13_49_54/**`, `review/consistency/2026/09/05/12_48_13/**`
  — 문서/이전 라운드 산출물 (비실행 코드)

## 검증 방법

- `audit-logs.service.ts` 전체 파일을 직접 읽어 쿼리 구성을 확인 — 모든 필터가
  `:workspaceId`/`:action`/`:userId` 등 파라미터 바인딩을 쓰고, 문자열 결합 SQL 없음을 확인.
- `dto/responses/audit-log-response.dto.ts`, `audit-logs.controller.ts` 를 열어 `@Roles('admin')`
  가드·`AuditLogUserDto`(id/name/email 3필드) 선언과 수정된 select 목록이 정확히 일치함을 대조.
- `user.entity.ts` 를 grep 하여 `passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·
  `webauthnRecoveryCodes`·`passwordResetToken`·`emailVerifyToken`·`emailChangeToken` 컬럼에
  `select: false` 나 `@Exclude()` 가 **여전히 0건**임을 실측 확인 (RESOLUTION.md 의 주장과 일치).
- `response-contract.ts` 가 `@nestjs/testing` 을 통해 in-process Nest 앱을 띄우는 순수
  메모리 대조 로직이고 HTTP/DB/쉘을 다루지 않음을 확인. `tsconfig.build.json` 의
  `exclude: ["src/shared/testing/**"]` 로 프로덕션 dist 제외를 재확인.
- diff 전체를 시크릿 패턴(`password=`, `api_key=`, `token=` 등 리터럴)으로 grep — 매치 없음.
- `review/**` 신규 md/json 파일에 실제 시크릿·개인정보 값이 아니라 노출됐던 **필드명 목록**만
  기록돼 있음을 확인.

## 발견사항

- **[INFO]** 이번 fix 는 이 호출부 한 곳의 증상만 좁혔고, `User` 엔티티 자체에는 여전히
  컬럼 수준 보호가 없다
  - 위치: `codebase/backend/src/modules/users/entities/user.entity.ts` (이번 diff 대상 아님,
    참고용으로 열람) — `passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·
    `webauthnRecoveryCodes`·`passwordResetToken`·`emailVerifyToken`·`emailChangeToken` 컬럼에
    `select: false`/`@Exclude()` 없음. 전역 `ClassSerializerInterceptor` 도 없음(RESOLUTION.md
    자체 실측과 일치).
  - 상세: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` 의 이번 수정(`leftJoin`
    + `addSelect(['user.id','user.name','user.email'])`)은 **이 호출부 하나**에서 과다 select 를
    막는 올바른 방식이지만, 방어가 "이 쿼리를 짤 때 개발자가 select 를 좁혀야 한다"는 규율에만
    의존한다. 엔티티 자체에는 여전히 안전장치가 없으므로, 다음에 `User` 를 조인하는 새 쿼리가
    (예: 다른 모듈에서) `leftJoinAndSelect`/`relations: ['user']` 를 무심코 쓰고 그 결과를
    엔티티 그대로 반환하면 같은 클래스의 유출이 재발할 수 있다. 이번 PR 이 전수 열거한 결과
    (`RESOLUTION.md` §같은 형태가 더 있는지)로는 현재 다른 위험 지점은 없다고 확인됐으므로
    지금 당장의 취약점은 아니고, 이번 fix 를 낮게 평가하는 것도 아니다 — 다만 이 fix 가
    "이 호출부의 재발 방지"는 보장해도 "새 호출부의 예방"은 보장하지 않는다는 점을 follow-up
    으로 남길 가치가 있다.
  - 제안: (a) 위 7개 컬럼에 TypeORM `select: false` 를 추가해 명시적 `addSelect` 없이는 절대
    로드되지 않게 하거나, (b) 전역 `ClassSerializerInterceptor` + `@Exclude()` 를 얹어
    "엔티티를 그대로 반환"하는 다른 모든 경로에도 마지막 방어선을 둔다. 어느 쪽이든 이번 PR
    범위 밖의 별도 작업으로 plan 에 등재하는 것을 권장(이미 이 diff 의 `spec-draft-nullable-notation-followups.md`
    에 §5.4 검증자 스윕 항목은 있으나, 엔티티 자체의 컬럼 보호는 별도 항목으로 안 보임).

## 참고 — 이번 fix 자체의 정확성 확인

Critical 은 아니지만 위 INFO 의 맥락을 위해 기록: 수정된 select 목록(`user.id`, `user.name`,
`user.email`)은 `AuditLogUserDto`(`id`/`name`/`email` 3필드)와 정확히 일치하고, 신규 unit
테스트(`audit-logs.spec.ts`)가 `leftJoinAndSelect` 키 자체의 부재까지 단언하며, e2e
(`audit-logs.e2e-spec.ts`)가 `Object.keys(user)` 를 `['email','id','name']` 로 직접 고정한다 —
검증자(§5.4 대조기)의 정확성에만 기대지 않는 독립 캐너리가 이미 마련돼 있다. `getSortColumn`
화이트리스트(`created_at`/`action`/`resource_type`)와 모든 `WHERE`/`ORDER BY` 파라미터 바인딩은
이번 diff 대상은 아니지만 그대로 유지되어 SQL 인젝션 표면을 열지 않는다.

## 요약

이번 변경 셋의 핵심은 직전 라운드에서 발견된 **살아있는 Critical 정보 노출**(`GET /api/audit-logs`
가 `User` 엔티티 26개 컬럼 — bcrypt 해시·2FA 시크릿·복구 코드·비밀번호 재설정/이메일 변경
토큰을 포함 — 을 그대로 반환)을 select 축소로 막은 것이다. 직접 코드를 읽어 수정이
`AuditLogUserDto` 선언과 정확히 일치함을 확인했고, unit+e2e 양쪽에 독립적인 회귀 캐너리가
붙어 있다. 새로 추가된 `response-contract.ts`(§5.4 응답-DTO 대조 헬퍼)는 테스트 전용이며
프로덕션 dist 에서 명시적으로 제외되어 있어 자체 보안 표면이 없고, 인젝션·하드코딩된 시크릿·
인증 우회·안전하지 않은 암호화 등 다른 7개 관점에서도 위반을 찾지 못했다. 유일한 잔여
관찰은 이번 fix 가 호출부 단위 방어라 `User` 엔티티 자체의 컬럼 수준 보호(`select: false`/
`@Exclude()`) 부재라는 구조적 gap 은 남아 있다는 것 — 재발 방지를 위한 follow-up 으로 권장하되
이번 diff 를 막을 사유는 아니다.

## 위험도

NONE
