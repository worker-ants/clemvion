# Cross-Spec 일관성 검토 — spec-draft-auth-webauthn-list-format

## 대상

`plan/in-progress/spec-draft-auth-webauthn-list-format.md` (변경 1~5):

1. `spec/5-system/2-api-convention.md` §5.2 뒤 "비-페이징 고정 컬렉션" note 추가
2. `spec/5-system/1-auth.md` line 469 WebAuthn credentials 목록 응답 포맷 정정 (`[{...}]` → `{data:{items:[...]}}`)
3. `spec/5-system/2-api-convention.md` Rationale subsection 추가
4. `spec/conventions/swagger.md` "유일한 예외" 문구 정정(§2-5, §5 Rationale) + §6 구분 각주
5. `spec/2-navigation/9-user-profile.md` line 329 sessions 응답 shape 동기화

## 검증 방법

target 문서가 인용하는 모든 근거를 실제 코드/현재 spec 텍스트와 대조 검증했다:

- `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts:281-285` — `webauthnList` 가 `{ data: { items: credentials.map(...) } }` 를 직접 반환. 확인됨.
- `codebase/backend/src/modules/auth/sessions.controller.ts:74,120,164` — `listSessions`/`revokeSession`/`revokeOthers` 모두 `{ data: { items: sessions } }` 반환. 확인됨.
- `codebase/backend/src/common/interceptors/transform.interceptor.ts` — `'data' in data` 분기로 이미 top-level `data` 키를 가진 객체는 pass-through. 확인됨(코드 그대로).
- `codebase/frontend/src/lib/api/sessions.ts:54/67/77`, `codebase/frontend/src/app/(main)/profile/security/passkey-card.tsx:53` — 모두 `res.data.data.items` 소비. 확인됨.
- `spec/5-system/1-auth.md:469` (수정 전) — 현재 `[{id, deviceName, transports, lastUsedAt, createdAt}]` (bare array) 로 기재. target 이 지적한 불일치가 실재함.
- `spec/2-navigation/9-user-profile.md:329` — 현재 응답 shape 미기재. target 변경 5 는 신규 정보 추가로 기존 문구와 충돌 없음.
- `spec/conventions/swagger.md:205`(§2-5), `:305`(§6 레거시 패턴), `:317`(§5 Rationale) — target 이 인용한 정확한 라인·문구와 실제 파일이 완전히 일치 (`"유일한 예외"` 문구 316~317행 확인됨).
- `spec/5-system/2-api-convention.md:122-139` (§5.2) — 페이지네이션 목록만 규율, 비-페이징 컬렉션은 명시 없음. target 의 "규정 공백" 주장과 일치.
- `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts:277`, `sessions.controller.ts:63` — 두 컨트롤러 모두 `@ApiOkWrappedResponse(WebAuthnCredentialListDto)` / `@ApiOkWrappedResponse(SessionListDto)` 를 사용 중이며, 이 DTO 들이 `{items}` 형태이므로 스웨거 헬퍼 표준 `{data:<Dto>}` 스키마와 실제로 모순 없이 부합한다(런타임 wire shape 와 swagger 문서화 모두 일관).

이 검증들에 의해 target 문서의 사실관계(코드 근거)는 신뢰할 수 있는 것으로 확인됐다.

## 발견사항

### 이전 CRITICAL 은 draft 자체 조치로 해소됨 (기록용)

target 문서가 자인하는 대로, 초기 2-doc 버전은 `swagger.md` Rationale §5 의 "`PaginatedResponseDto` 가 pass-through 의 **유일한 예외**" 단정과 정면 충돌하는 CRITICAL 이었다. 현재 draft(변경 4a/4b/4c)는 그 단정 문구 자체를 수정 대상에 포함시켜, "유일한 예외" → "주요 pass-through 사례(두 번째 사례 추가)"로 정정한다. 실제 파일의 316~317행이 target 인용과 정확히 일치함을 확인했고, 변경 4의 대체 문구도 §2-5/§5.2/§6 사이에서 상호 참조가 순환·모순 없이 정합적이다. 이 CRITICAL 은 재확인 결과 **본 개정판에서 해소됐다**.

### [INFO] `ApiOkWrappedArrayResponse` 헬퍼와의 관계 미언급

- target 위치: 변경 1 (api-convention §5.2 note), 변경 4 (swagger.md §2-5/§5/§6)
- 충돌 대상: `spec/conventions/swagger.md` §5-2 공용 래퍼 헬퍼 표 (line 255-266) — `ApiOkWrappedArrayResponse(Dto)` → `{ data: <Dto>[] }` (bare-array, `pagination` 도 `items` 래퍼도 없는 **세 번째** 배열 반환 형태)
- 상세: 현재 swagger.md §5-2 는 이미 3가지 배열류 반환 헬퍼를 나열한다 — (a) `ApiOkWrappedArrayResponse` = `{data:<Dto>[]}` (bare-array), (b) `ApiOkPaginatedResponse` = `{data:<Dto>[], pagination}` (페이징), (c) 이번 draft 가 추가하는 `{data:{items:[...]}}` (비-페이징 고정 컬렉션, 전용 헬퍼 없이 `ApiOkWrappedResponse(ItemsDto)` 로 표현). draft 는 (c)를 (b)와는 구분하지만 (a)와의 관계는 언급하지 않는다. 실무자가 "비-페이징 배열이면 §5-2 의 `ApiOkWrappedArrayResponse` 를 써야 하는가, 아니면 이번에 추가된 `{items}` 패턴을 써야 하는가"를 스스로 판단해야 하는 모호성이 남는다. 코드 확인 결과 webauthn/sessions 컨트롤러는 이미 `ApiOkWrappedResponse(XxxListDto)`(XxxListDto 내부가 `{items}`)로 (c)를 구현하고 있어 헬퍼 자체와의 모순은 없으나, 문서상 (a)와 (c)의 선택 기준이 spec 에 명문화돼 있지 않다.
- 제안: 필수는 아님(coding 규약 관점 INFO). 여유가 있다면 변경 4b 또는 변경 1 note 에 "언제 bare-array(§5-2 `ApiOkWrappedArrayResponse`) 대신 `{items}` 래퍼를 쓰는가"를 한 문장 추가하면 향후 신규 비-페이징 목록 엔드포인트 설계 시 헬퍼 선택 혼선을 예방할 수 있다. 이번 draft 의 blast radius(spec 문서만, Option A)를 넘는 별도 후속으로 처리해도 무방.

### [INFO] `webauthn-response.dto.ts` stale 주석은 draft 가 이미 범위 밖으로 명시

- target 위치: "범위 밖 (follow-up, developer 트랙)" 섹션
- 충돌 대상: `codebase/backend/src/modules/auth/webauthn/dto/webauthn-response.dto.ts:77` 주석 ("SessionListDto 의 이중 중첩 패턴은 피한다")
- 상세: 코드 주석이 이제 stale 임(SessionListDto 도 현재 동일 `{items}` 단일 패턴)을 draft 가 이미 인지하고 developer 트랙 follow-up 으로 명시적으로 위임했다. cross-spec 관점에서 추가 조치 불필요 — 이 문서 자체를 target 이 변경하지 않으므로 spec 충돌은 아니고, 코드-주석 정합성 이슈일 뿐이다. 별도 조치 불요, 기록만 남김.

### 진행 중인 다른 plan 과의 스코프 충돌 없음 (확인)

`plan/in-progress/` 내 `webhook-spec-pointer-cleanup.md` 가 `spec/5-system/2-api-convention.md §5.3`(에러 응답)을 건드리지만 본 draft 가 다루는 §5.2/§5.2 뒤 note 와는 무관한 섹션이다. `spec-sync-auth-gaps.md`, `spec-sync-user-profile-gaps.md` 등 다른 in-progress 문서에서 `webauthn`/`credentials`/`sessions` 키워드 매칭 없음. 동시 진행 중인 draft 간 충돌 없음.

## 요약

target 문서가 인용하는 모든 코드·spec 사실관계(webauthn/sessions 컨트롤러의 `{data:{items}}` 직접 반환, `TransformInterceptor` 의 `'data' in data` pass-through, 프런트 `res.data.data.items` 소비, `swagger.md` 의 정확한 라인·문구)를 소스에서 직접 재검증했고 전부 일치했다. 이전 세션(10_31_14)에서 발견된 CRITICAL — "PaginatedResponseDto 가 pass-through 의 유일한 예외"라는 `swagger.md` 단정과의 정면 충돌 — 은 본 draft 의 변경 4(a/b/c)가 그 단정 문구 자체를 "주요 사례(두 사례 중 하나)"로 정정하는 방식으로 직접 해소했으며, 변경 1(api-convention §5.2 note)·변경 3(Rationale)·변경 4·변경 5(9-user-profile.md) 사이에 상호 참조가 순환 모순 없이 일관된다. Non-breaking(spec 문서만 정정, 코드·프런트 무변경) 이라는 Option A 의 blast radius 주장도 코드 확인 결과 타당하다. 발견된 잔여 사항은 모두 INFO 등급(§5-2 헬퍼 표의 3-way 구분 모호성, 이미 draft 가 범위 밖으로 명시한 stale 코드 주석)이며 즉시 조치 없이도 push 가능한 수준이다.

## 위험도

NONE
