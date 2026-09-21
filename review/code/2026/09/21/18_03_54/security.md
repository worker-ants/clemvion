# 보안(Security) 리뷰 — webauthn-dup-delete (9번째/마지막 자리)

## 스코프

- `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` — `deleteCredential()` (`affected` 판정 추가 + DELETE 조건절에 `userId` 추가)
- `codebase/backend/src/modules/auth/webauthn/webauthn.service.spec.ts` — 회귀 유닛 테스트 3건
- `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts` — 신규 e2e (동시 DELETE)
- `plan/in-progress/*.md`, `review/consistency/**` — plan/리뷰 산출물 (코드 아님, 시크릿/인젝션 관점만 훑음)

컨텍스트 확인을 위해 diff 대상 파일 원본(`webauthn.service.ts`, `webauthn.controller.ts`)을 직접 `Read`/`grep` 으로 열어 대조했다. 저장소에 뮤테이션은 가하지 않았다(`git status --short` 무변경 확인 불필요 — 파일 쓰기 없음).

## 발견사항

- **[INFO]** 동시 삭제 시 감사 로그(`user.2fa_disabled`) 중복 기록 결함이 이번 diff로 해소됨 — 보안 관점에서는 개선
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` (게이트 549~558, `deleteCredential`) / `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts:331-348` (diff 밖, 대조 확인용)
  - 상세: 종전에는 `delete({ id: credentialUuid })` 의 반환값(`affected`)을 버려서, 두 동시 DELETE 요청이 무락 `findOne` 을 모두 통과하면 둘 다 204를 받고 컨트롤러가 `user.2fa_disabled` 감사 행을 두 번 기록했다. 이번 diff는 `affected === 0` 을 명시 비교해 진 쪽에서 `NotFoundException` 을 던지므로, 컨트롤러의 `auditLogsService.record(...)` 호출(예외 전파로 인해 도달 불가)이 진 쪽에서 실행되지 않는다 — 실제로 `webauthn.controller.ts:331` 의 `await this.webauthnService.deleteCredential(...)` 뒤에 감사 기록 코드가 있어, 서비스가 던지면 그 지점에서 함수 전체가 reject 된다. 감사 로그 중복은 침해 대응/포렌식 시 오탐(두 사건으로 오인)을 유발할 수 있는 무결성 문제였으므로 이 수정은 보안상 유효하다.
  - 제안: 조치 불요 (이미 반영됨).

- **[INFO]** DELETE 소유권 검증이 애플리케이션 레벨(JS 비교)에서 DB WHERE 절로 강화됨 — defense-in-depth
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` 게이트 549~552 (`this.credentialRepo.delete({ id: credentialUuid, userId })`)
  - 상세: 종전 `delete({ id: credentialUuid })` 는 소유권 검증을 이전 줄의 무락 `findOne` + `credential.userId !== userId` JS 비교에만 의존했다. 이번 diff는 `userId` 를 DELETE 조건절에 직접 포함시켜, 만약 두 검증 사이에 소유권이 바뀌는 극단적 시나리오가 있더라도 DB 계층에서 한 번 더 스코프를 강제한다. 형제 PR들(#1369~#1375)의 워크스페이스/소유자 스코프 강화와 동일한 패턴이며 IDOR 방어를 한 겹 더한다.
  - 제안: 조치 불요.

- **[INFO]** `findOne` → `delete` 사이 소유권 재검증 없이 진행되나, 최종 게이트가 DB WHERE 절이라 TOCTOU 로 인한 크로스유저 삭제는 발생하지 않음
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` 게이트 523~552
  - 상세: `findOne({ where: { id: credentialUuid } })` 자체는 잠그지 않는다(주석에도 명시). 하지만 실제 삭제 행위는 `delete({ id: credentialUuid, userId })` 라는 원자적 단일 SQL 로 수행되므로, 경합 상황에서도 각 요청은 결국 "자신이 인증한 `userId` 에 속한 `id`" 만 지울 수 있다 — race 는 감사 로그 중복(이미 수정됨)만 유발했지 권한 상승/타 사용자 자원 삭제로는 이어지지 않는다. 새로 추가된 e2e(`webauthn-credential-delete-concurrency.e2e-spec.ts`)도 같은 소유자의 두 요청 경합만 검증하므로 이 결론과 일치한다.
  - 제안: 조치 불요 — 교차사용자 IDOR 벡터는 실측·설계상 닫혀 있음.

- **[INFO]** 컨트롤러 입력은 `ParseUUIDPipe` 로 형식 검증되고, 서비스/e2e 쿼리는 모두 파라미터 바인딩을 사용 — SQL 인젝션 벡터 없음
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts:305`(rename), `:326`(delete) — `@Param('id', new ParseUUIDPipe())`. `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts` 게이트 56~62, 78~81, 110~116 — 모두 `$1`/`$2`/`$3` 파라미터 바인딩(`pg` `Client.query`)이며 문자열 결합 없음.
  - 상세: TypeORM `delete({ id, userId })` 도 파라미터화된 쿼리로 변환되며, 신규 e2e 의 raw SQL(`INSERT ... VALUES ($1,$2,'\\x00'::bytea, ...)`, `SELECT ... FOR UPDATE`, 감사 조회 `SELECT COUNT(*) ...`)도 전부 바인드 변수를 사용해 인젝션 여지가 없다.
  - 제안: 조치 불요.

- **[INFO]** (이번 diff 로 발생한 문제 아님 — 사전 존재) `WEBAUTHN_CREDENTIAL_NOT_FOUND` 코드가 401(`verifyAuthentication`)과 404(`renameCredential`/`deleteCredential`) 두 status 로 혼용됨
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:403`(`UnauthorizedException`, 인증 단계) vs `:497`·`:504`·`:527`(`NotFoundException`, 관리 API)
  - 상세: 이 diff가 만든 결함이 아니라 기존 코드 상태이며, 이미 `plan/in-progress/webauthn-dup-delete.md` §0 체크리스트와 해당 세션의 `/consistency-check --impl-prep` (`review/consistency/2026/09/21/17_39_06`, WARNING 1) 에서 실측·등재되어 planner 항목으로 넘겨졌다(`spec/5-system/3-error-handling.md` §1.11 정정 대상). 보안 영향은 제한적이다 — 401 자리(로그인 2FA 검증 중)는 미인증 호출자에게 credential 존재 여부를 노출하지 않으려는 의도적 설계로 보이고, 404 자리는 이미 인증된 본인 계정 스코프 내 리소스 조회라 enumeration 우려가 낮다. 클라이언트가 동일 코드로 401/404 를 구분해야 하는 API 계약 일관성 문제에 가깝다.
  - 제안: 이번 PR에서 처리할 필요 없음 — 이미 별도 planner 트랙으로 등재됨. 재-flag 불필요.

- **[INFO]** 신규/변경 파일 전체(plan·consistency 리뷰 산출물 포함)에 하드코딩된 시크릿·API 키·자격증명 없음
  - 위치: 스코프 내 전 파일 — grep 패턴(`password|secret|api[_-]?key|token=...`) 확인, 매치된 항목은 전부 감사 액션명(`user.password_changed` 등 spec 상수)이나 JWT/옵션 토큰 변수명일 뿐 실제 비밀값 아님.
  - 제안: 조치 불요.

## 요약

이번 변경은 `WebAuthnService.deleteCredential()` 의 동시 삭제 경합에서 감사 로그(`user.2fa_disabled`)가 두 번 기록되던 결함을, 종전부터 쓰던 원자적 `delete()` 의 `affected` 반환값을 판정에 사용하고 DELETE 조건절에 `userId` 를 추가하는 방식으로 고친 보안 강화 커밋이다. 인젝션 벡터(파라미터 바인딩 전수 확인), 하드코딩 시크릿, 신규 인증/인가 우회, 안전하지 않은 암호화·평문 전송, 민감정보 노출 에러 메시지 어느 항목에서도 새로 도입된 취약점은 발견되지 않았다. 소유권 검증이 애플리케이션 레벨(JS 비교)에서 DB WHERE 절로 한 겹 더 강화되어 IDOR 방어가 개선되었고, 감사 로그 중복 제거는 침해 대응 무결성 측면에서도 유효하다. 유일하게 언급할 점은 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 코드가 401/404 두 status 로 혼용되는 사전 존재 문제인데, 이는 이번 diff가 만든 것이 아니며 이미 별도 트랙(`spec/5-system/3-error-handling.md` 정정)으로 실측·등재되어 있어 이번 PR의 착수/병합을 막을 사유가 아니다.

## 위험도

NONE
