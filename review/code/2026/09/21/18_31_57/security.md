# 보안(Security) 리뷰 — WebAuthn credential 동시 삭제 (아홉 번째/마지막 자리) + WARNING 후속 조치

## 스코프

- `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` — `deleteCredential()` (`affected` 판정 도입 + DELETE 조건절에 `userId` 추가), `renameCredential()`/`deleteCredential()` 의 404 throw 4곳을 `throwCredentialNotFound()` 헬퍼로 추출 + JSDoc `@throws` 보강
- `codebase/backend/src/modules/auth/webauthn/webauthn.service.spec.ts` — 회귀 유닛 테스트 3건(소유권 스코프 단언, 패자 404+부수쓰기 스킵, `null`/`undefined` 대조군)
- `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts` — 신규 e2e 2건(동일 credential 동시 DELETE, 이종 credential 동시 DELETE — WARNING #4 반증)
- `CHANGELOG.md`, `plan/in-progress/*.md`, `review/code/2026/09/21/18_03_54/**`, `review/consistency/2026/09/21/17_39_06/**` — 문서·이전 리뷰 라운드 산출물(코드 아님, 시크릿/인젝션 관점만 훑음)

`webauthn.service.ts` 실제 파일을 `Read` 로 직접 열어 diff 게이트 번호가 원본 줄 번호와 일치함을 확인했다(497·517·533·561·565 등). 저장소에 뮤테이션은 가하지 않았다 — `git status --short` 결과 이 리뷰 세션 자신의 출력 디렉터리(`review/code/2026/09/21/18_31_57/`)만 untracked 로 남아 있고 그 외 워킹트리는 clean 하다.

## 발견사항

- **[INFO]** 동시 삭제 시 감사 로그(`user.2fa_disabled`) 중복 기록 결함 해소 — 보안(포렌식 무결성) 관점에서 개선
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:561-567` (`deleteCredential`)
  - 상세: 종전엔 `credentialRepo.delete({ id: credentialUuid })` 의 반환값(`affected`)을 버려서, 무락 `findOne`(:538-540)을 둘 다 통과한 동시 DELETE 두 건이 모두 204로 끝나고 `WebAuthnController` 가 `user.2fa_disabled` 감사 행을 두 번 남겼다(실측: 감사 2건, 둘 다 `remainingCredentials: 1`). 이번 변경은 `affected === 0` 을 **명시 비교**로 판정에 사용해 진 쪽에서 `NotFoundException` 을 던지므로, 컨트롤러의 감사 기록 호출에 도달하지 않는다. 감사 로그 중복은 침해 대응 시 사건을 두 건으로 오인시킬 수 있는 무결성 문제였으므로 유효한 보안 개선이다.
  - 제안: 조치 불요(이미 반영됨).

- **[INFO]** DELETE 조건절에 `userId` 추가 — 소유권 검증이 애플리케이션 레벨(JS 비교)에서 DB WHERE 절로 강화(defense-in-depth)
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:561-564`
  - 상세: 종전 `delete({ id: credentialUuid })` 는 소유권 확인을 그 앞 무락 `findOne` 뒤의 `credential.userId !== userId` JS 비교(:541)에만 의존했다. 이제 DELETE 문 자체가 `userId` 로도 스코프되어 IDOR 방어 계층이 하나 더 생겼다 — 형제 PR들(auth-configs/model-config 등)의 워크스페이스/소유자 스코프 강화와 같은 패턴이다. `findOne`→`delete` 사이의 TOCTOU 창이 남아 있어도 최종 게이트가 원자적 조건부 SQL 이라 교차 사용자 삭제로 이어지지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `affected === 0` 명시 비교로 드라이버 미보고(`null`/`undefined`)와 실제 미삭제(`0`)를 정확히 구분
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:565-567`; 대조군 테스트 `codebase/backend/src/modules/auth/webauthn/webauthn.service.spec.ts:544-561` (`it.each([[undefined],[null]])`)
  - 상세: `!affected` 로 판정했다면 드라이버가 `affected` 를 보고하지 않는 정상 삭제 케이스까지 404로 잘못 되돌리는 회귀가 생겼을 것이다(가용성 저하 — 정당한 삭제 요청이 실패로 보고됨). 명시 비교와 대조군 테스트가 이를 막는다. PR 자체가 인용하듯 형제 PR(#1371)에서 이 대조군 부재로 `!affected` 뮤턴트 32건이 통과한 전례가 있어, 이번 대조군 도입은 타당한 재발 방지다.
  - 제안: 조치 불요.

- **[INFO]** 인젝션 벡터 없음 — 전 경로 파라미터 바인딩 확인
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:561-564`(TypeORM `delete({ id, userId })`, 파라미터화 변환); `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts:56-62, 78-81, 110-116, 146-151, 158-161, 163-165`(모두 `$1`/`$2`/`$3` bind 변수 사용, 문자열 결합 없음)
  - 상세: 신규 e2e 의 raw SQL(INSERT/SELECT FOR UPDATE/감사 조회/복구 코드 조회·시딩)이 전부 `pg` `Client.query` 의 파라미터 배열을 사용한다. 서비스 코드의 TypeORM 호출도 criteria 객체 기반이라 문자열 삽입 경로가 없다.
  - 제안: 조치 불요.

- **[INFO]** (사전 존재, 이번 diff 가 만든 결함 아님) `WEBAUTHN_CREDENTIAL_NOT_FOUND` 코드가 401과 404 두 status 에 혼용됨
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:403`(`UnauthorizedException`, `verifyAuthentication` — 이번 diff 밖) vs `:497`·`:500`·`:542`·`:566`(`NotFoundException`, `renameCredential`/`deleteCredential` — 이번 diff 가 헬퍼로 통합)
  - 상세: 401 자리는 로그인 2FA 검증 단계에서 미인증 호출자에게 credential 존재 여부를 노출하지 않으려는 의도적 설계로 보이고, 404 자리는 이미 인증된 본인 계정 스코프 내 리소스 조회라 enumeration 우려가 낮다. 보안 영향은 제한적이며(클라이언트가 코드만으로 상태 분기 못 하는 API 계약 문제에 더 가까움), 같은 세션의 `/consistency-check --impl-prep`(`review/consistency/2026/09/21/17_39_06`, WARNING 1)이 이미 적발해 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 후속 항목으로 등재해 뒀다.
  - 제안: 이번 PR에서 처리할 필요 없음 — 이미 별도 planner 트랙에 등재됨. 재-flag 불필요.

- **[INFO]** 하드코딩된 시크릿·자격증명 없음
  - 위치: 스코프 내 전 파일 — `password|secret|api[_-]?key|token=...|BEGIN (RSA|PRIVATE)|AKIA...` 패턴 grep 확인
  - 상세: 매치되는 항목은 감사 액션 상수(`user.2fa_disabled` 등), 테스트용 placeholder 문자열(`'seed-hash-1'`, `'seed-hash-2'` — 실제 해시가 아닌 임의 테스트 값), JWT 토큰 변수명(`accessToken`, `otherToken`)뿐이며 실제 비밀값이 코드에 내장된 사례는 없다.
  - 제안: 조치 불요.

- **[INFO]** 에러 메시지에 민감 정보 노출 없음
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:517-522` (`throwCredentialNotFound`)
  - 상세: 404 메시지가 "인증기를 찾을 수 없어요."로 일반화되어 있어 "존재하지 않음" 과 "본인 소유 아님" 을 구분하지 않는다(enumeration 방지 관례 유지). 이번 diff 가 이 지점을 헬퍼로 추출했을 뿐 메시지 내용·구분 여부는 변경하지 않았다.
  - 제안: 조치 불요.

## 요약

이번 변경은 `WebAuthnService.deleteCredential()` 이 이미 쓰고 있던 원자적 `credentialRepo.delete()` 의 반환값(`affected`)을 버리지 않고 판정에 사용해, 동시 DELETE 두 건이 감사 로그(`user.2fa_disabled`)를 중복 기록하던 결함을 닫은 보안 강화 커밋이다. 같은 statement 의 조건절에 `userId` 를 추가해 소유권 검증을 애플리케이션 레벨에서 DB WHERE 절로 한 겹 더 강화했고(IDOR 방어 심화), `affected === 0` 명시 비교 + 대조군 테스트로 드라이버 미보고 값(`null`/`undefined`)을 오판하는 회귀도 막았다. 인젝션 벡터(서비스 코드의 TypeORM criteria, e2e 의 raw SQL 전부 파라미터 바인딩), 하드코딩 시크릿, 에러 메시지 정보 노출 어느 항목에서도 새로 도입된 취약점은 없다. 유일하게 언급할 사전 존재 이슈(`WEBAUTHN_CREDENTIAL_NOT_FOUND` 코드의 401/404 혼용)는 이번 diff 가 만든 것이 아니며 이미 이전 리뷰 라운드와 `/consistency-check --impl-prep` 이 적발해 planner 트랙에 등재해 두었으므로 이번 PR 의 병합을 막을 사유가 아니다. WARNING 후속 조치(CHANGELOG 추가, JSDoc `@throws` 보강, 404 헬퍼 추출)는 문서화·유지보수성 개선일 뿐 새로운 보안 표면을 만들지 않는다.

## 위험도

NONE
