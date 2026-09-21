# 보안(Security) 리뷰 — webauthn-dup-delete (열 번째 자리 리뷰 후속)

## 스코프

`origin/main...HEAD` 실제 diff(`git diff origin/main...HEAD --stat`)로 대조한 결과, 코드/테스트 변경은 다음 4개 파일뿐이고 나머지 40개 파일은 `plan/`·`review/` 문서·산출물이다.

- `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` — `deleteCredential()` `affected===0` 판정 + DELETE 조건절 `userId` 추가, `throwCredentialNotFound()` 헬퍼 추출(중복 리터럴 4곳 통합)
- `codebase/backend/src/modules/auth/webauthn/webauthn.service.spec.ts` — 회귀 유닛 테스트 3건(소유권 스코프 DELETE 호출 단언, 진 쪽 404 시 count/update 미호출 단언, `affected` `undefined`/`null` 대조군)
- `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts` — 신규 e2e 2건(동일 credential 동시 DELETE, 이종 credential 동시 DELETE 반증 캐너리)
- `CHANGELOG.md`, `plan/in-progress/*.md`, `review/**` — 문서/산출물 (시크릿·인젝션 관점만 훑음)

이번 라운드(18_58_48)는 직전 라운드(18_31_57)의 WARNING 3건(테스트 공허성 가드·plan stale 줄 번호·CHANGELOG 취소선 절반 적용) 조치 커밋만 추가됐으며, 전부 문서/테스트 보강이고 서비스 로직(`webauthn.service.ts`)은 이번 라운드에서 재변경되지 않았다. 대상 파일은 직접 `Read`로 열어 게이트 줄 번호와 대조했다. 저장소에 뮤테이션은 가하지 않았다(`git status --short` 결과 `review/code/2026/09/21/18_58_48/` untracked 산출물 외 변경 없음).

## 발견사항

- **[INFO]** 동시 삭제 시 감사 로그(`user.2fa_disabled`) 중복 기록이 이번 diff로 해소됨 — 무결성 개선
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` `deleteCredential()` (`this.credentialRepo.delete({ id: credentialUuid, userId })` 및 뒤이은 `if (affected === 0) { this.throwCredentialNotFound(); }`), 대조 확인용 `webauthn.controller.ts` `webauthnDelete()` (`await this.webauthnService.deleteCredential(...)` 뒤 `auditLogsService.record(...)`)
  - 상세: 종전엔 `delete({ id: credentialUuid })`의 `affected`를 버려 동시 DELETE 두 건이 무락 `findOne`을 모두 통과하면 둘 다 204를 받고 컨트롤러가 `user.2fa_disabled` 감사 행을 두 번 남겼다(제출자 실측: 감사 2건, 둘 다 `remainingCredentials: 1`). 이번 diff는 `affected===0`을 판정에 써서 진 쪽이 `NotFoundException`을 던지게 하고, 컨트롤러의 감사 기록 코드는 서비스 호출 성공 후에만 실행되므로 예외 전파로 도달하지 않는다 — `webauthn.controller.spec.ts`의 `does not record an audit log when deleteCredential throws` 테스트로 직접 확인했다. 감사 로그 중복은 침해 대응/포렌식 시 사건 수를 오판시킬 수 있는 무결성 문제였으므로 이 수정은 보안상 유효한 개선이다.
  - 제안: 조치 불요.

- **[INFO]** DELETE 조건절에 `userId`를 추가해 소유권 검증을 애플리케이션(JS 비교)에서 DB WHERE 절로 강화 — defense-in-depth, IDOR 방어 심화
  - 위치: `webauthn.service.ts` `deleteCredential()` (`const { affected } = await this.credentialRepo.delete({ id: credentialUuid, userId })`)
  - 상세: 종전 `delete({ id: credentialUuid })`는 소유권 검증을 앞선 무락 `findOne` + `credential.userId !== userId` JS 비교에만 의존했다. 이제 DELETE 문 자체가 `userId`로도 스코프되어, 두 검증 사이에 소유권이 바뀌는 극단적 시나리오에서도 DB 계층이 한 번 더 스코프를 강제한다. 형제 PR(`auth-configs`, `model-config` 등)들의 워크스페이스/소유자 스코프 조건절 추가와 동일 패턴이다. 클라이언트가 관측하는 응답 형태는 동일해 계약 변경은 없다.
  - 제안: 없음 — 긍정적 강화.

- **[INFO]** `findOne`→`delete` 사이 소유권 재검증 없이 진행되나, 최종 게이트가 원자적 DB WHERE 절이라 TOCTOU로 인한 교차 사용자 삭제는 발생하지 않음
  - 위치: `webauthn.service.ts` `deleteCredential()` 전체(무락 `findOne` → 원자적 `delete({ id, userId })`)
  - 상세: `findOne({ where: { id: credentialUuid } })`는 잠그지 않는다(코드 주석에도 명시). 그러나 실제 삭제는 `delete({ id: credentialUuid, userId })`라는 단일 원자적 SQL로 수행되므로, 경합 상황에서도 각 요청은 결국 "자신이 인증한 `userId`에 속한 `id`"만 지울 수 있다 — 레이스는 감사 로그 중복(이번 diff로 수정됨)만 유발했지 권한 상승/타 사용자 자원 삭제로 이어지지 않는다. 신규 e2e(`webauthn-credential-delete-concurrency.e2e-spec.ts`)도 동일 소유자의 동시 요청 경합만 검증하므로 이 결론과 일치한다.
  - 제안: 조치 불요 — 교차 사용자 IDOR 벡터는 설계·실측상 닫혀 있음.

- **[INFO]** 인젝션 벡터 없음 — 입력 검증(`ParseUUIDPipe`) 및 전 쿼리 파라미터 바인딩 확인
  - 위치: `webauthn.controller.ts` `@Delete('credentials/:id')` (`@Param('id', new ParseUUIDPipe())`); `webauthn-credential-delete-concurrency.e2e-spec.ts`의 raw SQL(`INSERT INTO webauthn_credential ...`, `SELECT ... FOR UPDATE`, `SELECT COUNT(*) FROM audit_log ...`, `UPDATE "user" SET webauthn_recovery_codes ...`)이 모두 `$1`/`$2`/`$3` 플레이스홀더 사용; `webauthn.service.ts`의 `credentialRepo.delete({ id, userId })`도 TypeORM 파라미터 바인딩.
  - 상세: 문자열 접합으로 구성된 쿼리는 없다. e2e 신규 파일을 포함해 전 SQL 문 검토 완료.
  - 제안: 조치 불요.

- **[INFO]** (사전 존재, 이번 diff 신규 아님) `WEBAUTHN_CREDENTIAL_NOT_FOUND` 코드가 401(`verifyAuthentication`)과 404(`renameCredential`/`deleteCredential`, 이제 `throwCredentialNotFound()` 헬퍼로 통합)를 겸용
  - 위치: `webauthn.service.ts` `verifyAuthentication()`의 `UnauthorizedException` 던지는 자리(코드 상단, `outcome.kind === 'not_found'` 분기) vs `renameCredential()`/`deleteCredential()`이 공유하는 `throwCredentialNotFound()` 헬퍼(`NotFoundException`)
  - 상세: 이번 diff가 만든 문제가 아니라 기존부터 있던 상태이며, 같은 세션의 `/consistency-check --impl-prep`(`review/consistency/2026/09/21/17_39_06`, WARNING 1)이 이미 실측해 `plan/in-progress/spec-draft-nullable-notation-followups.md` planner 트래커(spec `3-error-handling.md` §1.11 정정 대상)에 등재했다. 보안 영향은 제한적 — 401 자리(미인증 로그인 2FA 검증)는 존재 노출을 막으려는 의도된 설계이고, 404 자리는 이미 인증된 본인 스코프 리소스라 enumeration 우려가 낮다. API 계약상 코드-status 매핑 모호성 문제에 가깝다.
  - 제안: 이번 PR 조치 대상 아님 — 이미 planner 트랙에 등재됨. 재-flag 불필요.

- **[INFO]** 하드코딩된 시크릿·API 키·자격증명 없음
  - 위치: 스코프 내 전 변경 파일 — grep(`password|secret|api[_-]?key|token=`) 확인. e2e의 `'seed-hash-1'`/`'seed-hash-2'`는 실제 비밀값이 아니라 복구 코드 컬럼에 대한 테스트 fixture 플레이스홀더 문자열이다.
  - 제안: 조치 불요.

## 요약

이번 라운드(열 번째)는 직전 라운드의 문서·테스트 보강 WARNING 3건(공허성 가드 추가, plan 인용 방식 정정, CHANGELOG 취소선 정정)만 반영했고 `webauthn.service.ts` 서비스 로직 자체는 이전 라운드에서 이미 완료된 상태 그대로다. 핵심 변경(동일 credential 동시 DELETE 시 `affected===0` 명시 비교로 진 쪽을 404 처리 + DELETE 조건절에 `userId` 추가)은 감사 로그 무결성 결함을 닫고 소유권 검증을 DB 계층까지 강화하는 순수 보안 개선이다. 인젝션 벡터(파라미터 바인딩 전수 확인), 하드코딩 시크릿, 신규 인증/인가 우회, 안전하지 않은 암호화·평문 전송, 민감정보 노출 에러 메시지 어느 항목에서도 새로 도입된 취약점은 없다. 유일한 잔여 관찰은 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 코드의 401/404 겸용인데, 이는 이 diff가 만든 것이 아니라 사전에 존재했고 이미 별도 planner 트랙에 등재·추적 중이라 이번 PR의 병합을 막을 사유가 아니다.

## 위험도

NONE
