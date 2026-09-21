# API 계약(API Contract) 리뷰

## 대상 요약

이번 diff 의 핵심은 `WebAuthnService.deleteCredential()` 이 이미 원자적으로 쓰던
`credentialRepo.delete()` 의 반환값(`affected`)을 판정에 사용하도록 좁게 고친 것이다
(`codebase/backend/src/modules/auth/webauthn/webauthn.service.ts`). 같은 커밋 계열에서
`WEBAUTHN_CREDENTIAL_NOT_FOUND` 404 throw 4곳을 `private throwCredentialNotFound(): never`
헬퍼로 추출하고 JSDoc `@throws` 를 보강했다. 라우트(`DELETE /api/auth/2fa/webauthn/credentials/:id`),
컨트롤러, DTO, `{ remaining: number }` 반환 계약, 에러 응답 포맷(`{ error: { code, message } }`)은
모두 그대로다. 나머지 변경 파일(unit spec, 신규 e2e 2건, `CHANGELOG.md`, plan 문서, 이전 라운드
(`review/code/2026/09/21/18_03_54`, `18_31_57`)의 리뷰 산출물)은 이 서비스 메서드 변경의
테스트·근거·회귀 대응 기록이며 API 계약 자체를 바꾸지 않는다.

이 세션은 이미 두 차례(`18_03_54`, `18_31_57`) 전량 api_contract 리뷰를 거쳤고, 그 사이
반영된 변경(`throwCredentialNotFound()` 추출, JSDoc `@throws` 추가, `CHANGELOG.md` 섹션 추가,
e2e 두 번째 `it` — 서로 다른 credential 동시삭제 반증)은 모두 **외부 관측 가능한 API 표면을
바꾸지 않는** 내부 리팩터·문서·테스트 보강이다. 실제 소스(`webauthn.service.ts:494-570`,
`webauthn.controller.ts:316-349`)를 직접 열어 대조했다.

## 발견사항

- **[INFO]** `WEBAUTHN_CREDENTIAL_NOT_FOUND` 코드가 401(`verifyAuthentication`)과
  404(`renameCredential`/`deleteCredential`) 두 status 에 걸쳐 재사용되고, 에러 코드 카탈로그
  (`spec/5-system/3-error-handling.md`)에도 미등재다 — 이 diff 이전부터 존재하던 상태다.
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:403-404`
    (`UnauthorizedException`, 변경 없음) vs `:497`·`:500`(`renameCredential`)·`:542`·`:566`
    (`deleteCredential`, 이번 diff 가 `throwCredentialNotFound()` 헬퍼 호출로 형태만 바꾼 지점).
  - 상세: 새 404 throw 지점(`:566`, 동시 삭제 진 쪽 판정)은 **기존에 이미 있던 코드 문자열**을
    재사용할 뿐 새로 만들지 않는다. 즉 한 코드가 401/404 를 오가는 계약 모호성은 이번 PR
    이전부터 존재했고, 이번 diff 는 그 404 쪽 사용처를 하나(추가 401 지점 아님) 늘렸을 뿐이다.
    클라이언트가 `code` 값만으로 HTTP status 를 예측할 수 없다는 점에서 API 계약상 바람직하지
    않지만, 이번 변경이 새로 만든 결함은 아니다. `grep -n WEBAUTHN_CREDENTIAL_NOT_FOUND
    spec/5-system/3-error-handling.md` 는 여전히 0건 — 등재 안 됨을 재확인했다.
  - 이미 같은 세션의 `/consistency-check --impl-prep`(`review/consistency/2026/09/21/17_39_06`,
    BLOCK: NO)이 정확히 이 문제를 WARNING 으로 잡아 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    (라인 4978-4988 부근)에 planner 후속 항목으로 등재해 뒀다. developer 는 spec 쓰기 권한이
    없으므로 이번 PR 이 직접 고칠 대상이 아니다.
  - 제안: 추가 조치 불요 — 이미 planner 트래커에 등재됨. 재차 등재하지 말 것.

- **[INFO]** DELETE 조건절에 `userId` 를 추가해 소유권 검증을 애플리케이션(JS 비교) 레이어에서
  DB 쿼리 레이어로 내렸다 — 계약을 바꾸지 않는 방어 강화.
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:559-563`
    (`const { affected } = await this.credentialRepo.delete({ id: credentialUuid, userId })`).
  - 상세: 종전엔 `{ id }` 만으로 `delete()` 를 호출하고 소유권은 그 앞 무락 `findOne` 뒤 JS 비교
    (`credential.userId !== userId`, `:541`)로만 확인했다. 이제 DELETE 문 자체가 `userId` 로도
    스코프되어, 형제 PR들(`auth-configs`·`model-config` 등)이 조건절에 소유자 조건을 넣은 것과
    같은 방어 심도를 갖춘다. 클라이언트가 관측하는 응답(상태 코드·바디·에러 코드)은 동일해
    하위 호환성 문제는 없다.
  - 제안: 없음 — 긍정적 강화로 기록만 남김.

- **[INFO]** DELETE 라우트의 Swagger 문서(`webauthn.controller.ts` `@Delete('credentials/:id')`)에
  `@ApiNotFoundResponse` 가 없어 404(`WEBAUTHN_CREDENTIAL_NOT_FOUND`) 케이스가 문서화되어 있지
  않다 — 이 diff 이전부터 있던 갭.
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts:316-327`
    (`webauthnDelete`, `@ApiUnauthorizedResponse` 만 있고 `@ApiNotFoundResponse` 없음. 이번
    diff 의 변경 대상 아님 — 참고용).
  - 상세: 소유권 불일치 시 404 는 종전 코드에도 이미 존재했다. 이번 변경은 동시 삭제
    시나리오에서 404 를 더 자주 관측 가능하게 만들 뿐, 새 엔드포인트나 새 상태 코드를
    도입하지 않는다. 비차단.
  - 제안: 필수 아님. 다음에 이 컨트롤러를 만질 때
    `@ApiNotFoundResponse({ description: '인증기를 찾을 수 없음' })` 추가를 고려.

- **[INFO]** 신규 e2e 두 건 모두 에러 응답 형태(`res.body?.error?.code`)와 감사 로그 쿼리가
  실제 전역 예외 필터(`http-exception.filter.ts`)의 `{ error: { code, message } }` 봉투 및
  컨트롤러의 감사 필드(`resourceType: 'user'`, `details.credentialId`)와 정확히 일치함을
  직접 대조 확인했다 — 계약 위반 없음.
  - 위치: `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts:66-70`,
    `:96-98`(첫 번째 `it`), `:186-195`, `:222-227`(두 번째 `it`, WARNING #4 반증 테스트).
  - 상세: `fireDelete()` 의 `.then((res) => ({ status: res.status, code: res.body?.error?.code }))`
    는 이 저장소의 표준 에러 봉투(`http-exception.filter.ts:92` 의 `error: { ... }`)와
    합치한다. 두 번째 `it`(서로 다른 credential 동시삭제)은 상태쌍 `[204, 204]` 만 확인하고
    별도 에러 코드 검증이 필요 없어 계약 관점에서 추가로 짚을 점이 없다.
  - 제안: 없음.

## 관점별 점검 결과 (요약)

1. **하위 호환성**: Breaking change 없음. 단일 클라이언트(레이스 없음) 관점에서 요청-응답
   흐름은 기존과 동일(성공 204, 소유권 불일치 404). 유일한 행동 변화는 **동시 DELETE 레이스**
   상황에서 패자 쪽이 종전 204 대신 404 를 받는 것 — REST 의 표준적인 "이미 삭제된 리소스에
   대한 DELETE" 관용과 부합하고, 형제 8건(#1369~#1375)이 이미 확립한 저장소 전역 패턴이다.
2. **버전 관리**: 해당 없음 — URL/버저닝 변경 없음, 내부 서비스 로직·private 헬퍼만 수정.
3. **응답 형식**: `deleteCredential()` 의 `{ remaining: number }` 반환 계약은 명시적으로
   보존됐다(패자는 그 지점에 도달하지 않고 throw). 컨트롤러의 204 No-Content 응답 형태도 불변.
4. **에러 응답**: 새 404 는 기존 `NotFoundException({ code: 'WEBAUTHN_CREDENTIAL_NOT_FOUND', message })`
   포맷을 그대로 재사용(헬퍼로 추출됐을 뿐 payload 불변)해 이 엔드포인트의 기존 에러 응답
   형식과 일관된다. `affected` 판정은 `=== 0` 명시 비교라 드라이버가 `affected` 를 보고하지
   않는 경우(`null`/`undefined`)를 오판하지 않는다(단위 테스트 대조군으로 검증됨, 실제 소스
   `webauthn.service.spec.ts:550-561` 확인). 코드 재사용의 계약 모호성(401/404 겸용)은 위
   INFO 참고 — pre-existing, 이미 트래킹됨.
5. **요청 검증**: 변경 없음 — `ParseUUIDPipe` 로 경로 파라미터 검증은 컨트롤러 레벨에서
   그대로 유지(`webauthn.controller.ts:326`).
6. **URL/경로 설계**: 변경 없음. 기존 RESTful 네이밍(`DELETE /api/auth/2fa/webauthn/credentials/:id`)
   유지.
7. **페이지네이션**: 해당 없음 — 단일 리소스 삭제, 목록 API 아님.
8. **인증/인가**: `JwtAuthGuard` 는 컨트롤러 레벨에서 불변. 서비스 레이어에서 DELETE 쿼리
   자체에 `userId` 조건을 추가해 소유권 검증을 DB 쿼리 경계까지 끌어올린 것은 인가 강화(위
   INFO 참고).

## 요약

이번 변경은 `WebAuthnService.deleteCredential()` 내부에서 이미 원자적이던 `delete()` 호출의
반환값을 판정에 사용하도록 좁게 수정하고, 그 404 throw 를 `throwCredentialNotFound()` 헬퍼로
추출한 것이다. 외부에 노출되는 API 계약(라우트, 상태 코드 집합, 응답 바디 스키마, `{ remaining }`
반환 형태, 에러 봉투 `{ error: { code, message } }`)은 그대로 유지된다. 유일한 관측 가능 변화는
동시 삭제 레이스에서 패자가 204 대신 404 를 받는 것인데, 이는 표준적인 REST 관용이자 저장소 내
형제 8건과 동일한 확립 패턴이라 breaking change 로 보기 어렵다. 두 번째 e2e(서로 다른 credential
동시삭제 반증)는 상태쌍 `[204, 204]` 만 확인하며 계약을 바꾸지 않는다. `WEBAUTHN_CREDENTIAL_NOT_FOUND`
코드가 401/404 를 겸용하고 카탈로그에 미등재라는 계약상 모호성이 남아 있지만, 이는 이 diff 가
만든 것이 아니라 이전부터 존재했고 이미 같은 세션의 `/consistency-check --impl-prep` 이 WARNING 으로
잡아 planner 트래커에 등재해 뒀으므로 이 리뷰에서 다시 차단 사유로 세우지 않는다. DELETE 조건절에
`userId` 를 추가한 것은 인가를 애플리케이션 레이어에서 DB 쿼리 레이어로 끌어올린 순수 강화이며
계약을 바꾸지 않는다.

## 위험도

LOW
