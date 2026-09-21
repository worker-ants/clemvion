# 요구사항(Requirement) 리뷰 — webauthn-dup-delete

## 발견사항

- **[INFO]** spec 본문(`spec/5-system/1-auth.md:498`)의 WebAuthn credential DELETE 엔드포인트 행이 "동시 삭제 시 진 쪽 404" 의미론과 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 에러 코드를 명시하지 않는다.
  - 위치: `spec/5-system/1-auth.md:498` (DELETE `/api/auth/2fa/webauthn/credentials/:id` 행)
  - 상세: 코드는 `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` 의 `deleteCredential()` 에서 `affected === 0` 이면 `WEBAUTHN_CREDENTIAL_NOT_FOUND`(404) 를 던지도록 구현했지만, spec 행에는 이 코드도 동시 삭제 의미론도 적혀 있지 않다. 다만 이는 이번 diff 가 새로 만든 갭이 아니라 형제 8건(auth-configs·integrations·model-config·workspaces·schedules 등)에도 동일하게 존재하는 기존 문서화 공백이며, 이 세션이 이미 생성한 `review/consistency/2026/09/21/17_39_06/SUMMARY.md` 가 같은 사실을 WARNING/INFO 로 적발해 두었다(§1.11 "`_NOT_FOUND`≠404 유일 예외" 불변식이 이미 깨져 있다는 지적 포함, `WEBAUTHN_CREDENTIAL_NOT_FOUND` 자체가 에러 코드 카탈로그 미등재).
  - 제안: planner 턴에서 (1) `1-auth.md` §5 DELETE 행에 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 명시, (2) `3-error-handling.md` §1.2.1(또는 신설 행)에 코드 등재, (3) `spec/plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 등재된 후속 항목을 실행. 코드 되돌리기 대상 아님 — 문서 반영 누락(grey-zone, 이미 트래커에 등재됨)이므로 SPEC-DRIFT 태그는 붙이지 않음(회색지대 INFO).

- **[INFO]** 이번 diff 에 포함된 리뷰 산출물(`review/consistency/2026/09/21/17_39_06/SUMMARY.md`)이 "`_NOT_FOUND`≠404 유일한 예외" 문구의 소재를 §1.3 으로 인용했으나, 실제 문구는 `spec/5-system/3-error-handling.md:254`(§1.11 "트리거 AuthConfig binding 에러 코드")에 있다. 같은 세션에서 병행 생성된 `plan/in-progress/webauthn-dup-delete.md`·`spec-draft-nullable-notation-followups.md` 는 §1.11 로 올바르게 인용한다.
  - 위치: `review/consistency/2026/09/21/17_39_06/SUMMARY.md` (경고 표 1행, "§1.3" 인용부)
  - 상세: 애플리케이션 코드에는 영향 없는, 같은 PR 이 함께 커밋한 리뷰 산출물 내부의 절 번호 오기재다. 다음 사람이 SUMMARY.md 만 보고 §1.3 을 찾으면 잘못된 위치를 보게 된다.
  - 제안: 사소하며 기능에 영향 없음 — 필요 시 해당 SUMMARY.md 의 인용을 §1.11 로 정정(단, 이 reviewer 는 review 산출물을 직접 고치지 않음. 후속 세션에서 참고만 하면 충분).

## 검증한 사항 (문제 없음 확인)

- `webauthn.service.ts` `deleteCredential()`: 무락 `findOne` → 소유권 확인 → `delete({ id, userId })` → `affected === 0` 명시 비교로 404 → `countCredentials` → `remaining===0` 시 복구 코드 NULL 화 → `{ remaining }` 반환. 형제 8건(auth-configs/integrations/model-config/workspaces/schedules)과 동일한 `affected === 0` 명시 비교 관용구를 정확히 재현했음을 실제 소스 대조로 확인(`grep -rn "affected === 0"`).
- `userId` 를 DELETE 조건절에 추가한 것은 기존에 없던 강화이며, WebAuthnCredential 엔티티의 `userId` 컬럼(`user_id`)과 타입 정합(entity 확인 완료).
- 컨트롤러(`webauthn.controller.ts:webauthnDelete`)는 서비스가 던지면 그 아래 `auditLogsService.record()` 호출에 도달하지 않는 구조이며, 이는 사전 존재하는 컨트롤러 테스트("does not record an audit log when deleteCredential throws", `webauthn.controller.spec.ts:258`)로 이미 고정되어 있음을 확인 — 새 로직이 그 계약을 깨지 않는다.
- 신규 단위 테스트 3종(`webauthn.service.spec.ts`): (1) `userId` 를 포함한 조건절로 `delete` 호출됨을 단언, (2) `affected: 0` → 404 + `countCredentials`/`usersService.update` 미호출 단언(진 쪽 부수 쓰기 스킵 확인), (3) `affected: undefined|null` → 정상 삭제로 취급하는 대조군(`it.each`) — `!affected` 로의 뮤테이션 회귀를 잠그는 목적이 코드와 일치함을 확인.
- e2e(`webauthn-credential-delete-concurrency.e2e-spec.ts`): 행 락(`SELECT … FOR UPDATE`) + 공허성 가드(1.5s Promise.race) + 상태쌍 `[204, 404]` + 감사 로그 1건(정확한 `resource_type='user'`, `action='user.2fa_disabled'`, `details->>'credentialId'` 필터) 검증. 감사 액션 상수(`AUDIT_ACTIONS.USER_2FA_DISABLED = 'user.2fa_disabled'`)와 컨트롤러의 `resourceType: 'user'`/`resourceId: user.sub` 실제 구현과 대조 확인 — 쿼리가 실제 스키마·값과 일치.
- 반환값: 정상/실패 모든 경로에서 `{ remaining: number }` 반환 또는 `NotFoundException` throw 로 귀결되어 반환값 누락 경로 없음.
- TODO/FIXME/HACK/XXX 주석 없음(diff 전체 grep 확인).
- 커밋된 plan 문서(`plan/in-progress/webauthn-dup-delete.md`)의 실측 주장(형제 e2e 8개·1.5초 공허성 가드·`affected===0` 판별자 사용처 5곳)을 `grep`/`ls` 로 교차 검증 — 모두 일치.
- 작업 트리는 리뷰 시작·종료 시 `git status --short` 로 clean 함을 확인(뮤테이션 없음, 원복 불요).

## 요약

핵심 변경(`webauthn.service.ts` `deleteCredential()` 의 `affected===0` 명시 비교 + `userId` 스코프 추가)은 형제 8건(#1369~#1375)과 완전히 동일한 검증된 패턴을 정확히 재현했으며, 실제 소스 대조로 반환 계약·컨트롤러 감사-스킵 계약·엔티티 필드 정합을 모두 확인했다. 신규 단위 테스트(승자 스코프 단언·패자 404+부수쓰기 스킵·`null`/`undefined` 대조군)와 e2e(행 락+공허성 가드+상태쌍+감사 1건)가 결함 클래스를 정확히 겨냥하며 vacuous 함정(공허성 가드 부재)도 피했다. TODO/FIXME 없음, 모든 경로에서 반환값 정의됨, 에러 코드·HTTP 상태·비즈니스 규칙(마지막 credential 삭제 시 복구 코드 NULL 화, 진 쪽 부수 쓰기 스킵) 전부 spec/plan 서술과 일치한다. 유일한 이슈는 spec 본문의 사전 존재 문서화 공백(이번 diff 가 만든 것이 아니며 이미 트래커에 등재·계획됨)과, 함께 커밋된 리뷰 산출물 내부의 사소한 절 번호 오기재(§1.3 vs §1.11, 코드 무관) — 둘 다 기능적 결함이 아닌 INFO 수준이다.

## 위험도

NONE
