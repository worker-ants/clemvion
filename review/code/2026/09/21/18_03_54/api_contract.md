# API 계약(API Contract) 리뷰

## 대상 요약

`WebAuthnService.deleteCredential()` 이 이미 원자적 `credentialRepo.delete()` 를 쓰고 있었지만 그
반환값(`affected`)을 버려서, 동시 DELETE 두 건이 둘 다 204 로 끝나고 컨트롤러(`webauthn.controller.ts`)가
`user.2fa_disabled` 감사 행을 두 번 남기던 결함을 고친다. 변경은 `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts`
의 `deleteCredential()` 한 메서드 내부(삭제 조건절에 `userId` 추가 + `affected === 0` 명시 비교로 404 throw)로
한정되며, 라우트(`DELETE /api/auth/2fa/webauthn/credentials/:id`)·컨트롤러·DTO·`{ remaining: number }`
반환 계약은 건드리지 않는다. 나머지 변경 파일(unit spec, 신규 e2e, plan 문서, 이미 실행된
`--impl-prep` consistency-check 산출물)은 이 서비스 메서드 변경의 테스트·근거 문서다.

## 발견사항

- **[INFO]** `WEBAUTHN_CREDENTIAL_NOT_FOUND` 코드가 401(`verifyAuthentication`)과 404(`renameCredential`/
  `deleteCredential`) 두 status 에 걸쳐 재사용되고, 에러 코드 카탈로그(`spec/conventions/error-codes.md` /
  `spec/5-system/3-error-handling.md` §1.2.1)에도 미등재다.
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:555` (이번 diff 가 추가한
    404 throw 지점) — 같은 코드를 던지는 다른 지점은 401 분기인 `webauthn.service.ts:403`
    (`verifyAuthentication`, 변경 없음)과 404 분기인 `:497`·`:504`(`renameCredential`, 변경 없음)이다.
  - 상세: 이 diff 는 **기존에 이미 있던 값(코드 문자열)을 재사용**할 뿐 새로 만들지 않는다 — 즉
    `WEBAUTHN_CREDENTIAL_NOT_FOUND` 가 한 코드로 401/404 를 오가는 계약 모호성은 이번 PR 이전부터
    존재했고, 이번 diff 는 그 404 쪽 사용처를 하나(추가 401 지점 아님) 늘렸을 뿐이다. 클라이언트가
    `code` 값만으로 HTTP status 를 예측할 수 없다는 점에서 여전히 API 계약상 바람직하지 않지만, 이번
    변경이 새로 만든 결함은 아니다.
  - 이미 같은 세션의 `/consistency-check --impl-prep`(`review/consistency/2026/09/21/17_39_06`,
    BLOCK: NO, Critical 0 · Warning 1)이 정확히 이 문제를 WARNING 으로 잡아 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    트래커에 planner 후속 항목(카탈로그 등재 + §1.3 "유일한 예외" 문장 정정)으로 등재해 뒀다. developer 는
    spec 쓰기 권한이 없으므로 이번 PR 이 직접 고칠 대상이 아니고, 착수를 막을 사유도 아니라는 그
    판단에 동의한다.
  - 제안: 추가 조치 불요 — 이미 planner 트래커에 등재됨. 재차 등재하지 말 것.

- **[INFO]** DELETE 조건절에 `userId` 를 추가해 소유권 검증을 애플리케이션(JS 비교) 레이어에서
  DB 쿼리 레이어로 내렸다 — 계약을 바꾸지 않는 방어 강화.
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:549-552`
    (`const { affected } = await this.credentialRepo.delete({ id: credentialUuid, userId })`).
  - 상세: 종전엔 `{ id }` 만으로 `delete()` 를 호출하고 소유권은 그 앞 무락 `findOne` 뒤 JS 비교
    (`credential.userId !== userId`, 여전히 `:526`에 남아 있음)로만 확인했다. 이제 DELETE 문 자체가
    `userId` 로도 스코프되어, 형제 PR들(`auth-configs`·`model-config` 등)이 워크스페이스/소유자 조건을
    조건절에 넣은 것과 같은 방어 심도를 갖춘다. 클라이언트가 관측하는 응답(상태 코드·바디·에러 코드)은
    동일해 하위 호환성 문제는 없다.
  - 제안: 없음 — 긍정적 강화로 기록만 남김.

- **[INFO]** DELETE 라우트의 Swagger 문서(`webauthn.controller.ts` `@Delete('credentials/:id')`)에
  `@ApiNotFoundResponse` 가 없어 404(`WEBAUTHN_CREDENTIAL_NOT_FOUND`) 케이스가 문서화되어 있지 않다.
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts:316` 부근(이번 diff 의
    변경 대상 아님 — 참고용).
  - 상세: 이 갭은 이번 PR 이전부터 있었다(소유권 불일치 시 404 는 종전 코드에도 이미 존재). 이번 변경이
    동시 삭제 시나리오에서 404 를 더 자주 관측 가능하게 만들 뿐, 새 엔드포인트나 새 상태 코드를
    도입하지 않는다. 비차단.
  - 제안: 필수 아님. 다음에 이 컨트롤러를 만질 때 `@ApiNotFoundResponse({ description: '인증기를 찾을 수 없음' })`
    추가를 고려.

## 관점별 점검 결과 (요약)

1. **하위 호환성**: Breaking change 없음. 단일 클라이언트(레이스 없음) 관점에서 요청-응답 흐름은
   기존과 동일(성공 204, 소유권 불일치 404). 유일한 행동 변화는 **동시 DELETE 레이스** 상황에서
   패자 쪽이 종전 204 대신 404 를 받는 것 — 이는 REST 의 표준적인 "이미 삭제된 리소스에 대한 DELETE"
   관용(idempotent-but-404-on-second-call)과 부합하고, 형제 8건(#1369~#1375)이 이미 확립한 저장소
   전역 패턴이다.
2. **버전 관리**: 해당 없음 — URL/버저닝 변경 없음, 내부 서비스 로직만 수정.
3. **응답 형식**: `deleteCredential()` 의 `{ remaining: number }` 반환 계약은 명시적으로 보존됐다(패자는
   그 지점에 도달하지 않고 throw). 컨트롤러의 204 No-Content 응답 형태도 불변.
4. **에러 응답**: 새 404 는 기존 `NotFoundException({ code: 'WEBAUTHN_CREDENTIAL_NOT_FOUND', message })`
   포맷을 그대로 재사용해 이 엔드포인트의 기존 에러 응답 형식과 일관된다. `affected` 판정은
   `=== 0` 명시 비교라 드라이버가 `affected` 를 보고하지 않는 경우(`null`/`undefined`)를 오판하지
   않는다(단위 테스트로 대조군 검증됨). 코드 재사용의 계약 모호성(401/404 겸용)은 위 INFO 참고 —
   pre-existing, 이미 트래킹됨.
5. **요청 검증**: 변경 없음 — `ParseUUIDPipe` 로 경로 파라미터 검증은 컨트롤러 레벨에서 그대로 유지.
6. **URL/경로 설계**: 변경 없음. 기존 RESTful 네이밍(`DELETE /api/auth/2fa/webauthn/credentials/:id`) 유지.
7. **페이지네이션**: 해당 없음 — 단일 리소스 삭제, 목록 API 아님.
8. **인증/인가**: `JwtAuthGuard` 는 컨트롤러 레벨에서 불변. 서비스 레이어에서 DELETE 쿼리 자체에
   `userId` 조건을 추가해 소유권 검증을 DB 트랜잭션 경계까지 끌어올린 것은 인가 강화(위 INFO 참고).

## 요약

이번 변경은 `WebAuthnService.deleteCredential()` 내부에서 이미 원자적이던 `delete()` 호출의 반환값을
판정에 사용하도록 좁게 수정한 것으로, 외부에 노출되는 API 계약(라우트, 상태 코드 집합, 응답 바디 스키마,
`{ remaining }` 반환 형태)은 그대로 유지된다. 유일한 관측 가능 변화는 동시 삭제 레이스에서 패자가
204 대신 404 를 받는 것인데, 이는 표준적인 REST 관용이자 저장소 내 형제 8건과 동일한 확립 패턴이라
breaking change 로 보기 어렵다. `WEBAUTHN_CREDENTIAL_NOT_FOUND` 코드가 401/404 를 겸용하고 카탈로그에
미등재라는 계약상 모호성이 남아 있지만, 이는 이 diff 가 만든 것이 아니라 이전부터 존재했고 이미
같은 세션의 `/consistency-check --impl-prep` 이 WARNING 으로 잡아 planner 트래커에 등재해 뒀으므로
이 리뷰에서 다시 차단 사유로 세우지 않는다. DELETE 조건절에 `userId` 를 추가한 것은 인가를 애플리케이션
레이어에서 DB 쿼리 레이어로 끌어올린 순수 강화이며 계약을 바꾸지 않는다.

## 위험도

LOW
