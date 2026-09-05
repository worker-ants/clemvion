# 보안(Security) 리뷰

## 검증 방법

- `codebase/backend/src/modules/audit-logs/audit-logs.service.ts`(수정본) 과
  `codebase/backend/src/modules/audit-logs/audit-logs.controller.ts`(변경 없음)를 직접 열어
  인가(Admin+ `@Roles('admin')`)·쿼리 파라미터 처리(SQL 파라미터 바인딩·`sort` 화이트리스트)를
  확인했다.
- `codebase/backend/src/modules/users/entities/user.entity.ts` 를 grep 해 CHANGELOG 가 지목한
  7개 자격증명/토큰 컬럼(`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·
  `webauthnRecoveryCodes`·`passwordResetToken`·`emailVerifyToken`·`emailChangeToken`)이 실제로
  존재함을 확인했다.
- `grep -rn "JoinAndSelect(.*\.user'" src` / `relations:.*\['user'\]` 로 같은 클래스의 다른
  유출 지점이 남아 있는지 전수 확인 — `auth.service.ts` 2곳(내부 refresh/logout 경로, HTTP
  응답으로 나가지 않음), `workspaces.service.ts` 1곳(명시 필드 매핑으로 이미 안전)만 남아 있고
  모두 안전함을 직접 코드로 재확인했다.
- `codebase/backend/src/shared/testing/response-contract.ts`(신규 §5.4 검증 헬�퍼) 전문을 읽고
  중첩 `$ref`/`allOf`/`oneOf`/`anyOf` 하강 로직, 자기참조 순환 가드(payload 객체 동일성 기준),
  `undeclared`/`missing`/`null`/`invalid-payload` 판정 분기를 추적했다.
- `response-contract.spec.ts` 의 테스트 목록을 확인해 중첩 하강·자기참조·union 사각지대에 대한
  회귀 테스트가 실제로 존재함을 확인했다.
- 저장소에 이미 커밋된 이전 3개 리뷰 라운드 산출물(`review/code/2026/09/05/{13_49_54,14_39_31,
  15_12_02}/`)을 읽고, 그 라운드들이 지적한 Critical/WARNING(엔티티 패스스루 유출, 자기참조
  거짓 통과, 미검증 예외 분기)이 각각 이번 diff 의 최종 상태에 실제로 반영돼 해소됐는지
  코드로 직접 재대조했다(문서 주장만으로 받아들이지 않음).
- 저장소 뮤테이션 없이 진행(`git status --short` 로 최종 확인, clean).

## 발견사항

- **[INFO]** `User` 엔티티에 컬럼 수준 방어(`select: false`)가 없어, 이번 수정이 유일한
  차단선이다
  - 위치: `codebase/backend/src/modules/users/entities/user.entity.ts` (전체 — 자격증명/토큰
    7개 컬럼 어디에도 `select: false` 없음), 대비되는 수정 지점은
    `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:60-61`
  - 상세: 이번 diff 는 `audit-logs.service.ts` 의 호출부(`leftJoin` + `addSelect`)를 좁혀
    문제를 해결했다. 그러나 `User` 엔티티 자체에는 여전히 컬럼 수준 안전장치가 없어, 앞으로
    또 다른 코드가 `leftJoinAndSelect('*.user', 'user')` 형태로 조인하면 같은 클래스의 유출이
    재발할 수 있다(방어가 call-site 단위라 엔티티를 만지는 사람 수만큼 반복 위험이 있다).
    이 항목은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 후속
    항목으로 등재돼 있고 앞선 3개 리뷰 라운드(`13_49_54`→`15_12_02`)에서도 반복 확인 후
    "이번 PR 범위 밖, 별도 PR 유예"로 처분된 사안이라 새로운 지적은 아니다 — 근거가 되는
    유예 판단이 여전히 유효한지만 기록해 둔다(엔티티에 `select: false` 를 걸면 이런 call-site
    수정 없이도 원천 차단됐을 것이라는 사실은 변하지 않는다).
  - 제안: (이미 트래커에 있음) `User.passwordHash`/`twoFactorSecret`/`totpRecoveryCodes`/
    `webauthnRecoveryCodes`/`passwordResetToken`/`emailVerifyToken`/`emailChangeToken` 에
    `select: false` 를 적용하는 별도 PR을 후속으로 진행할 것을 권장.

## 확인 결과 (문제 없음 — 오탐 방지 기록)

- **핵심 수정(`audit-logs.service.ts`)은 실제 정보노출(CWE-200) 취약점을 올바르게 제거한다.**
  종전 `leftJoinAndSelect('al.user', 'user')` 는 `User` 엔티티 전 컬럼(비밀번호 해시·2FA
  시크릿·TOTP/WebAuthn 복구 코드·비밀번호 재설정/이메일 변경 토큰 포함 26키)을 그대로
  HTTP 응답에 실었다. 수정본은 `leftJoin` + `addSelect(['user.id','user.name','user.email'])`
  로 필요한 3필드만 DB 에서 끌어오도록 바꿔 **데이터가 애초에 DB 밖으로 나가지 않는다** — 애플리케이션 레이어의 필터링이 아니라 쿼리 레벨 차단이라 직렬화 누락(`@Exclude`
  깜빡함 등) 클래스의 우회에도 안전하다.
- **SQL 인젝션 없음.** 모든 필터(`action`/`resourceType`/`userId`/`startDate`/`endDate`/
  `workspaceId`)는 TypeORM `QueryBuilder` 파라미터 바인딩(`:paramName`)을 쓴다. `sort` 값은
  `getSortColumn()` 의 고정 allowlist(`created_at`/`action`/`resource_type`)를 거쳐 컬럼명으로
  문자열 보간되므로, 컨트롤 되지 않는 사용자 입력이 SQL 문자열에 직접 삽입되지 않는다.
- **인가 로직 변경 없음.** 컨트롤러의 `@Roles('admin')` 가드와 `WorkspaceId` 데코레이터는
  이번 diff 에서 손대지 않았다 — Admin+ 한정 접근 통제가 그대로 유지된다.
- **하드코딩된 시크릿 없음.** diff 전체를 시크릿 리터럴 패턴(비밀번호/토큰/API 키 값
  대입)으로 확인 — 실제 자격증명 값은 없고, 전부 컬럼/필드 **이름**에 대한 언급이다.
- **회귀 방어가 3중으로 배선됨.** (1) `audit-logs.spec.ts` 단위 테스트가 `leftJoin`/
  `addSelect` 호출과 `leftJoinAndSelect` 부재를 직접 단언, (2) `response-contract.ts`가
  `$ref`/`allOf`를 따라 중첩 DTO 로 내려가 `user.passwordHash` 형태의 위반 경로까지 잡도록
  구현돼 있고 자체 스펙(`response-contract.spec.ts`)이 중첩 하강·자기참조·union 사각지대를
  독립적으로 검증, (3) `audit-logs.e2e-spec.ts` 가 실 HTTP 응답의 `user` 키 집합을
  `['email','id','name']` 으로 고정 단언하는 독립 캐너리를 별도로 둔다 — 검증자 자체가
  이 유출을 놓쳤던 이력이 있어 검증자의 정확성에만 기대지 않는 이중 안전장치를 둔 설계는
  타당하다.
- **앞선 리뷰 라운드가 지적한 취약점은 이번 최종 코드에서 실제로 해소돼 있음을 직접
  재확인했다.** `14_39_31` 라운드의 "자기참조 스키마 순회가 스키마 이름을 방문 집합으로 써서
  거짓 통과를 냈다"는 지적은 현재 `descend()` 가 payload **객체 동일성**(`onPath: ReadonlySet<object>`)을 방문 기준으로 쓰도록 수정돼 있어 반영 확인됨. `15_12_02` 라운드의
  "`visitUnion` 의 `allowUndeclared` 면제 분기가 어떤 테스트에도 안 걸린다"는 지적도 현재
  `response-contract.spec.ts:369`("allowUndeclared 는 union 아래에서도 먹는다")로 캐너리가
  추가돼 있음을 확인했다.
- 다른 파일(`plan/*.md`, `review/**` 하위 과거 라운드 산출물)은 문서/보고서이며 프로덕션
  코드·인프라·시크릿을 포함하지 않는다.

## 요약

이번 diff 의 핵심은 `GET /api/audit-logs` 가 `leftJoinAndSelect` 로 `User` 엔티티 전체
컬럼(비밀번호 해시·2FA 시크릿·복구 코드·계정 탈취용 토큰류 포함 26키)을 그대로 응답에
실어 온 실제 정보노출(CWE-200/OWASP API3:2023 Broken Object Property Level Authorization
유사 패턴) 취약점을 원천에서(쿼리 레벨 select 제한) 제거한 보안 수정이다. 인가 로직·SQL
파라미터 바인딩에는 변형이 없고, 하드코딩된 시크릿도 없다. 재발 방지를 위해 신설한 §5.4
응답-대-DTO 계약 검증기(`response-contract.ts`)는 중첩 DTO·자기참조·판별자 없는
oneOf/anyOf 까지 하강하도록 설계돼 있고, 이 검증기 자체의 사각지대(자기참조 거짓 통과,
union 면제 미검증)도 앞선 리뷰 라운드에서 지적된 뒤 코드로 직접 수정된 것을 재확인했다.
남은 항목은 `User` 엔티티에 컬럼 수준 방어(`select: false`)가 없어 방어선이 call-site
단위라는 구조적 한계뿐이며, 이는 이미 트래커에 등재된 후속 항목이다. 이번 PR 자체에는
차단할 만한 보안 결함이 없다.

## 위험도

NONE
