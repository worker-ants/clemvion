# 보안(Security) 코드 리뷰

## 검토 범위 및 방법론

`git log origin/main..HEAD` 기준 이 브랜치는 9개 커밋이며, 마지막 커밋(`ee755efbe`, "docs(review):
14_39_31 라운드 산출물 + RESOLUTION")은 `review/code/2026/09/05/14_39_31/**` 문서 14개만 추가하고
**애플리케이션 코드를 전혀 건드리지 않는다** (`git show --stat HEAD` 로 확인). 즉 이번 라운드
(`15_12_02`)가 보는 실행 코드 상태는 직전 라운드(`14_39_31`)가 이미 보안 관점에서 검토한 상태와
**동일**하다. 이를 근거로 아래 순서로 확인했다.

1. `codebase/backend/src/modules/audit-logs/audit-logs.service.ts`, `audit-logs.controller.ts`,
   `dto/query-audit-log.dto.ts`, `common/dto/pagination.dto.ts` 를 직접 `Read` 로 열어 이전
   라운드가 지적한 Critical(감사 로그 `user` 객체 26개 컬럼 노출)의 수정이 실제로 남아 있는지,
   그리고 그 수정이 `AuditLogUserDto` 선언과 정확히 일치하는지 확인.
2. `codebase/backend/src/shared/testing/response-contract.ts` / `.spec.ts` 전문을 직접 열어
   §5.4 검증 로직 자체에 새로 도입된 보안 표면(인젝션·시크릿·인증 우회)이 없는지 확인. 이전
   라운드가 고친 자기참조 순환 가드(payload 객체 동일성 기반)도 재확인.
3. `git diff origin/main..HEAD -- codebase/` 를 시크릿 리터럴 패턴(`password=`, `secret=`,
   `token=`, `api_key=`)으로 grep — 매치 없음.
4. `review/code/2026/09/05/14_39_31/security.md`(직전 보안 리뷰 산출물)를 대조해 이번 라운드가
   중복 지적을 내지 않게 했다.
5. 저장소에는 어떤 뮤테이션도 가하지 않았다 — 이 리뷰는 `Read`/`Bash(git log, git show, grep)`
   만 사용했다. `git status --short` 확인 결과 본 세션이 만든 변경 없음.

## 발견사항

없음. 이번 라운드에서 새로 지적할 CRITICAL/WARNING 급 보안 결함을 찾지 못했다.

아래는 참고용 확인 기록이다 (조치 불요).

- **[INFO]** (직전 라운드부터 이어지는 관찰, 재지적 아님) `User` 엔티티 자체에는 여전히 컬럼
  수준 방어(`select: false`/`@Exclude()`/전역 `ClassSerializerInterceptor`)가 없다
  - 위치: `codebase/backend/src/modules/users/entities/user.entity.ts` (이번 diff 의 변경
    대상 아님, 참고 열람) — `passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·
    `webauthnRecoveryCodes`·`passwordResetToken`·`emailVerifyToken`·`emailChangeToken`
    컬럼에 `select: false`/`@Exclude()` 없음. 저장소 전체에 `ClassSerializerInterceptor` 0건.
  - 상세: 이번 PR 계열이 실제로 고친 것은 `audit-logs.service.ts` 의 호출부 하나
    (`leftJoinAndSelect` → `leftJoin`+`addSelect(['user.id','user.name','user.email'])`)다.
    `review/code/2026/09/05/14_39_31/RESOLUTION.md` §보류(W2)가 이 gap 을 이미 실측·기록하고
    "인증 경로를 fail-silent 로 깨뜨릴 위험이 있어 이번 PR 범위에 넣지 않는다"는 근거로 유예를
    결정했으며, `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에 후속
    항목으로 등재돼 있다. 같은 유예가 `14_39_31/security.md` 에도 INFO 로 이미 기록됐다.
    새로운 근거나 새로운 위험이 발견되지 않았으므로 이번 라운드에서 등급을 올리지 않는다.
  - 제안: 조치 불요 — 이미 등재된 plan 항목을 후속 PR 에서 집행할 것.

## 관점별 확인 결과

1. **인젝션** — `audit-logs.service.ts` 의 모든 `WHERE`/`ORDER BY` 절은 `:workspaceId` 등
   파라미터 바인딩을 쓰고, `sort`/`order` 는 각각 `getSortColumn` 화이트리스트(`created_at`/
   `action`/`resource_type`)와 `PaginationQueryDto` 의 `@Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)`/
   `@IsIn(['asc','desc'])` 로 이중 방어된다(이번 diff 대상 아님, 기존 상태 유지 확인). 신규
   `response-contract.ts` 는 메모리 안의 `payload`/스키마 객체만 대조하는 순수 로직으로
   HTTP·쉘·DB 를 다루지 않아 인젝션 표면이 없다.
2. **하드코딩된 시크릿** — diff 전체 grep 결과 없음.
3. **인증/인가** — `AuditLogsController.findAll` 은 `@Roles('admin')` 가드를 그대로 유지한다.
   이번 diff 는 인증/인가 로직을 바꾸지 않았다.
4. **입력 검증** — 이번 diff 의 신규 로직(`findContractViolations`)은 `isPlainObject` 가드로
   payload 형태 오류를 `invalid-payload` kind 로 안전하게 처리한다. 테스트 전용 코드이며 외부
   신뢰 경계를 넘는 사용자 입력을 다루지 않는다.
5. **OWASP Top 10** — 해당 없음. 프로덕션 API 표면·인증·세션 로직에 변경 없음(테스트 인프라
   + DB select 축소만).
6. **암호화** — 해시/암호화 알고리즘을 다루는 변경 없음.
7. **에러 처리** — `formatViolations`/`assertMatchesContract` 가 던지는 에러 메시지는 필드명·
   위반 종류(`kind`)·정적 설명 문자열만 담고, 응답 payload 의 **실제 값**(예: 유출됐던
   `passwordHash` 값 자체)은 담지 않는다. 프로덕션에 배포되지 않는 코드라 사용자에게 노출될
   경로도 없다.
8. **의존성 보안** — 신규 의존성 추가 없음. `response-contract.ts` 가 쓰는 `@nestjs/testing`/
   `@nestjs/swagger` devDependency 는 `tsconfig.build.json` 의 `exclude: ["src/shared/testing/**"]`
   로 프로덕션 `dist` 에서 제외된다(기존 선례 유지, 이번 diff 로 변경되지 않음).

## 요약

이번 라운드(`15_12_02`)의 diff 는 직전 보안 리뷰(`14_39_31`)가 검토한 것과 **동일한 애플리케이션
코드 상태**다 — 마지막 커밋은 그 라운드의 리뷰 산출물(md/json)만 신규 추가했을 뿐 `codebase/`
를 건드리지 않았다. 핵심 보안 수정(`GET /api/audit-logs` 의 `User` 전 컬럼 노출을 `leftJoin`+
`addSelect` 로 3필드 select 로 좁힘)은 여전히 유효하고 `AuditLogUserDto` 선언과 정확히 일치하며,
unit(`audit-logs.spec.ts`)·e2e(`audit-logs.e2e-spec.ts`) 양쪽에 독립 회귀 캐너리가 붙어 있다.
신규 §5.4 계약 검증 헬퍼(`response-contract.ts`)는 테스트 전용이며 프로덕션 빌드에서 제외되고,
자체적으로 인젝션·시크릿 노출 표면을 만들지 않는다. 인젝션·하드코딩된 시크릿·인증 우회·입력
검증·암호화·에러 처리·의존성 보안 8개 관점 모두에서 새 위반을 찾지 못했다. 유일한 잔여 관찰(엔티티
컬럼 수준 방어 부재)은 이미 두 차례 전 라운드에서 실측·유예·등재가 끝난 항목이라 재지적하지
않는다.

## 위험도

NONE
