# 보안(Security) 리뷰 — WebAuthn credential 동시 삭제 감사 중복 수정 (라운드 3)

## 스코프

이번 diff 는 이전 두 라운드(`review/code/2026/09/21/18_03_54`, `18_31_57`)가 이미 상세히 검토한
동일 코드에 대한 세 번째 라운드다. 실제 프로덕션/테스트 코드 변경은 다음 3개 파일뿐이고, 나머지는
CHANGELOG·plan 문서·이전 리뷰 라운드가 생성한 산출물(md/json, 코드 아님)이다.

- `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` — `deleteCredential()` 에
  `affected === 0` 명시 비교 + DELETE 조건절에 `userId` 추가, `throwCredentialNotFound()` 헬퍼 추출
- `codebase/backend/src/modules/auth/webauthn/webauthn.service.spec.ts` — 회귀 unit 3건
  (소유자 스코프 단언·진 쪽 404+부수쓰기 스킵·`undefined`/`null` 대조군)
- `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts` — 신규 e2e 2건
  (동일 credential 동시 삭제·이종 credential 동시 삭제 반증 캐너리)

`webauthn.service.ts`(전체 637줄), `webauthn.controller.ts`, e2e-spec 파일을 직접 `Read` 해
diff 컨텍스트를 실제 소스와 대조했다. 저장소에 어떤 파일도 쓰지 않았다(`git status --short` 결과
이 세션의 산출물(`review/code/2026/09/21/19_18_43/`) 외 변경 없음, 뮤테이션 없음 — 원복 불요).

## 발견사항

- **[INFO]** 동시 삭제 시 `user.2fa_disabled` 감사 로그 중복 기록 결함이 이번 diff로 해소됨 — 보안 무결성 개선
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` (`deleteCredential`, 게이트 561~567) / `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts` (`webauthnDelete`, 감사 기록 호출부)
  - 상세: 실제 소스를 직접 열어 확인한 결과, `deleteCredential()` 이 `affected === 0` 이면 `throwCredentialNotFound()` 로 `NotFoundException` 을 던지고, 컨트롤러의 `await this.webauthnService.deleteCredential(...)` 다음에 위치한 `auditLogsService.record(...)` 호출은 예외 전파로 인해 도달하지 않는다. 감사 로그 중복은 침해 대응/포렌식 조사 시 사건 건수를 실제보다 부풀리는 무결성 문제였으므로 이 수정은 보안상 유효한 개선이다.
  - 제안: 없음 — 이미 반영됨.

- **[INFO]** DELETE 조건절에 `userId` 를 추가해 소유권 검증이 애플리케이션 레벨(JS 비교)에서 DB WHERE 절로 강화됨 — defense-in-depth
  - 위치: `webauthn.service.ts` `deleteCredential` (게이트 561~564, `this.credentialRepo.delete({ id: credentialUuid, userId })`)
  - 상세: 종전 `delete({ id: credentialUuid })` 는 소유권 검증을 직전 무락 `findOne` + `credential.userId !== userId` JS 비교에만 의존했다. 이번 diff는 `userId` 를 DELETE 조건절 자체에 포함시켜, TOCTOU 창(조회~삭제 사이)에서 무슨 일이 벌어지든 최종 뮤테이션이 SQL 레벨에서 한 번 더 소유자로 스코프된다. IDOR 방어를 한 겹 더한 것으로, 형제 PR들(#1369~#1375)의 워크스페이스/소유자 스코프 강화와 같은 패턴이다.
  - 제안: 없음.

- **[INFO]** enumeration 방지 일관성 — 존재하지 않는 credential 과 타인 소유 credential 이 동일한 404 응답으로 통일됨
  - 위치: `webauthn.service.ts` `renameCredential`/`deleteCredential` (`this.throwCredentialNotFound()` 4개 호출부), 헬퍼 `throwCredentialNotFound()` 정의부
  - 상세: `!credential`, `credential.userId !== userId`, 동시 삭제 진 쪽(`affected === 0`) 세 경로 전부 동일한 코드(`WEBAUTHN_CREDENTIAL_NOT_FOUND`)·동일 메시지·동일 상태코드(404)로 수렴한다. 응답만으로는 "credential 이 아예 없다"와 "다른 사람 소유라 못 본다"를 구분할 수 없어 credential ID enumeration 공격면이 없다. `verifyAuthentication()` 의 401(로그인 2FA 단계) 자리는 헬퍼 대상에서 의도적으로 제외돼 있고 이는 예외 타입·상태코드가 다른 별개의 관심사(로그인 전 미인증 호출자에게 존재 여부를 노출하지 않으려는 설계)로, 이번 변경이 이 구분을 흐리지 않았음을 직접 소스 대조로 확인했다.
  - 제안: 없음.

- **[INFO]** 인젝션 벡터 없음 — 전 경로 파라미터 바인딩 확인
  - 위치: `webauthn.service.ts` `credentialRepo.delete({ id, userId })`(TypeORM, 바인드 변환) / `webauthn.controller.ts` `@Param('id', new ParseUUIDPipe())`(rename·delete 라우트 모두) / `webauthn-credential-delete-concurrency.e2e-spec.ts` 전체 raw SQL(`INSERT`, `SELECT ... FOR UPDATE`, `UPDATE`, 감사 조회) — `$1`/`$2`/`$3` 플레이스홀더 + 파라미터 배열
  - 상세: e2e 테스트를 직접 읽고 문자열 접합 쿼리가 없음을 확인했다(`db.query(sql, [userId, ...])` 형태만 존재). 서비스 계층 입력은 `ParseUUIDPipe` 로 UUID 형식이 아니면 컨트롤러 단계에서 400 으로 차단되어 `credentialUuid` 가 서비스에 도달하기 전에 형식 검증을 거친다.
  - 제안: 없음.

- **[INFO]** 하드코딩된 시크릿 없음
  - 위치: 스코프 내 전 파일 — 신규 e2e 의 `'seed-hash-1'`/`'seed-hash-2'` 는 복구 코드 NULL화 검증용 테스트 픽스처 더미 문자열이며 실제 자격증명·해시가 아니다. 그 외 매치되는 문자열은 감사 액션 상수(`user.2fa_disabled`)·에러 코드 리터럴뿐이다.
  - 제안: 없음.

- **[INFO]** 에러 메시지에 민감 정보 노출 없음
  - 위치: `throwCredentialNotFound()` 및 전 호출부 — 메시지 `'인증기를 찾을 수 없어요.'` 고정 문자열
  - 상세: 스택트레이스·내부 쿼리·다른 사용자의 credential 존재 여부 등 어떤 정보도 응답에 실리지 않는다. 코드(`WEBAUTHN_CREDENTIAL_NOT_FOUND`)는 클라이언트 분기용 안정 식별자일 뿐 민감정보가 아니다.
  - 제안: 없음.

- **[INFO]** (이번 diff 로 발생한 결함 아님 — 사전 존재, 재-flag 불필요) `WEBAUTHN_CREDENTIAL_NOT_FOUND` 코드가 401(`verifyAuthentication`, 게이트 402~406)과 404(`renameCredential`/`deleteCredential`) 두 status 로 혼용
  - 위치: `webauthn.service.ts` — `verifyAuthentication()` 의 `UnauthorizedException` 분기 vs `renameCredential`/`deleteCredential` 의 `NotFoundException` 분기
  - 상세: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 및 `review/consistency/2026/09/21/17_39_06/SUMMARY.md`(§1.11 정정 대상)에 planner 트랙 항목으로 등재돼 있고, developer 권한 밖(spec 쓰기)이다. 보안 영향은 제한적 — 401 자리는 미인증 호출자 대상 enumeration 방지 설계, 404 자리는 이미 인증된 본인 스코프 내 조회라 노출 우려가 낮다. API 계약 일관성 문제에 가깝다.
  - 제안: 이번 PR에서 처리 불요 — 이미 별도 트랙으로 등재됨.

- **[INFO]** 의존성 변경 없음
  - 상세: 이번 diff 는 `package.json`/lockfile 을 건드리지 않으며, 사용된 라이브러리(TypeORM, `pg`, `supertest`, Node `crypto`)는 모두 기존 의존성 재사용이다. 신규 알려진 취약점 벡터 없음.
  - 제안: 없음.

## 요약

이번 변경은 `WebAuthnService.deleteCredential()` 이 무락 `findOne` 뒤 동시 DELETE 두 건을 모두 통과시켜 `user.2fa_disabled` 감사 로그를 두 번 남기던 결함을, 원자적 `delete()` 의 `affected` 반환값을 `=== 0` 명시 비교로 판정에 사용하고 DELETE 조건절에 `userId` 를 추가하는 방식으로 닫는 보안 강화 수정이다. 실제 소스(`webauthn.service.ts` 637줄 전체, `webauthn.controller.ts` 감사 기록 경로, 신규 e2e 파일)를 직접 열어 대조한 결과 인젝션 벡터(전 경로 파라미터 바인딩), 하드코딩 시크릿, 인증/인가 우회, enumeration, 민감정보 노출 에러 메시지, 신규 의존성 위험 어느 항목에서도 새로 도입된 취약점을 발견하지 못했다. 소유권 검증이 애플리케이션 레벨(JS 비교)에서 DB WHERE 절로 한 겹 더 강화되어 IDOR 방어가 개선됐고, 감사 로그 중복 제거는 포렌식 무결성 측면에서도 유효하다. 유일하게 언급할 사전 존재 사항(`WEBAUTHN_CREDENTIAL_NOT_FOUND` 코드의 401/404 혼용)은 이번 diff 가 만든 것이 아니며 이미 별도 planner 트랙으로 실측·등재돼 있어 이번 PR 의 병합을 막을 사유가 아니다. 이전 두 라운드(`18_03_54`, `18_31_57`)의 security 리뷰 결론(NONE)과 독립적으로 재확인한 결과도 동일하다.

## 위험도

NONE
