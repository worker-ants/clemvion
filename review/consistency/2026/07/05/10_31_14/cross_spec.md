# Cross-Spec 일관성 검토 — WebAuthn credentials 목록 응답 포맷 정정 draft

## 대상

- Target: `plan/in-progress/spec-draft-auth-webauthn-list-format.md`
- 변경 대상 spec: `spec/5-system/1-auth.md` (line 469), `spec/5-system/2-api-convention.md` (§5.2 뒤 + Rationale)

## 검증한 사실관계 (모두 확인됨)

- `spec/5-system/1-auth.md:469` 현재 텍스트는 실제로 `[{id, deviceName, transports, lastUsedAt, createdAt}]` (bare array) — draft 의 "실제 계약과 어긋난 스펙 텍스트" 진단은 정확하다.
- `codebase/backend/src/modules/auth/webauthn/webauthn.controller.ts` `webauthnList()` 는 `return { data: { items: credentials.map(...) } }` — draft 주장과 일치.
- `codebase/backend/src/modules/auth/sessions.controller.ts` `listSessions`/`revokeSession`/`revokeOtherSessions` 모두 `return { data: { items: sessions } }` (`SessionListDto`) — draft 주장과 일치.
- `codebase/frontend/src/lib/api/sessions.ts:54/67/77` 는 `res.data.data.items` 로 소비 — draft 주장과 일치.
- `TransformInterceptor`(`codebase/backend/src/common/interceptors/transform.interceptor.ts:25`)는 `'data' in data` 분기로 이미 `data` 키를 가진 객체를 pass-through — draft 의 메커니즘 설명(§5.2 페이징과 동일 pass-through 경로)은 기술적으로 정확하다.

## 발견사항

- **[CRITICAL]** `swagger.md` Rationale §5 가 페이지네이션 pass-through 를 "**유일한 예외**"로 명문화 — draft 의 두 번째 pass-through 패턴 도입과 정면 충돌
  - target 위치: 변경 1 (신규 삽입 문단, `2-api-convention.md` §5.2 뒤) — "핸들러가 `{ data: { items } }` 를 직접 반환하면 이미 `data` 키를 가지므로 `TransformInterceptor` 가 추가 래핑 없이 pass-through 한다"
  - 충돌 대상: `spec/conventions/swagger.md` line 317 (Rationale "§5 ApiOkPaginatedResponse single-wrap (pass-through 예외)") — "§2-5 의 '성공 응답을 `{ data }` 로 감싼다'는 보편 규칙의 **유일한 예외**가 된다"
  - 상세: `swagger.md` 는 `TransformInterceptor` 의 `'data' in data` pass-through 분기가 오직 `PaginatedResponseDto`(`{data, pagination}`) 케이스에만 적용되는 것처럼 "유일한 예외"라고 못박고 있다. 그러나 실제 런타임에는 webauthn·sessions 목록도 동일한 pass-through 분기를 이미 타고 있었고(코드 검증 완료), draft 가 이를 두 번째 공식 예외로 spec 문서화하려 한다. draft 를 그대로 반영하면 `swagger.md` 의 "유일한" 이라는 단정 문구가 즉시 거짓이 되어 두 문서가 서로 모순된 상태로 남는다. `swagger.md` 의 "유일한 예외" 서술을 갱신하지 않으면 이후 독자가 두 spec 을 나란히 읽을 때 "정말 유일한가?" 라는 직접적 모순에 부딪힌다.
  - 제안: draft 의 변경 1·3 범위에 `swagger.md` line 317 갱신을 포함시켜 "유일한 예외" → "예외 중 하나(비-페이징 고정 컬렉션 `{data:{items}}` 도 동일 pass-through 경로 — `api-convention §5.2` note 참조)" 식으로 정정. 그렇지 않으면 두 spec 문서가 상호 참조 없이 모순된 채로 남는다.

- **[WARNING]** `swagger.md §6) 레거시 패턴 제거` 가 `{data:{items,...}}` 형태를 "버그"로 지칭 — draft 신설 패턴과 문면상 대조 시 혼동 소지
  - target 위치: 변경 1 (신규 문단)
  - 충돌 대상: `spec/conventions/swagger.md` line 305 — "`{ data: { items, totalItems, page, limit } }` 처럼 서비스 실제 반환 형태(`{ data, pagination }`) 와 다른 스키마는 버그입니다 — `ApiOkPaginatedResponse` 로 교체."
  - 상세: 이 문장은 페이지네이션 메타(`totalItems`/`page`/`limit`)까지 포함해 `data.items` 안에 쑤셔넣는 **페이지네이션 오용** 케이스를 겨냥한 것으로 보이며, draft 가 정의하려는 "페이지네이션이 아예 없는 고정 컬렉션 `{data:{items}}}`" 와는 의도가 다르다. 그러나 두 패턴 모두 표층 문자열이 `data: { items` 로 시작해 육안으로 구분하기 어렵다. 향후 리뷰어/개발자가 이 문장만 보고 draft 가 도입하는 비-페이징 `{data:{items}}` 도 "버그" 로 오인해 되돌리는(reflatten) 회귀를 유발할 수 있다.
  - 제안: 변경 1 문단에 "이는 §6 레거시 패턴 제거가 지목하는 '페이지네이션 메타 없이 `items`+`totalItems`/`page`/`limit` 를 뒤섞은 버그 패턴'과는 다르다 — 본 비-페이징 컬렉션은 애초에 `pagination` 필드 자체가 없다" 정도의 구분 문구를 추가하거나, `swagger.md §6` 에 "단, 순수 `{items}`(페이지네이션 필드 없음)는 §2-5 비-페이징 고정 컬렉션 예외로 허용" 각주 추가.

- **[INFO]** `spec/2-navigation/9-user-profile.md` §6.1 `GET /api/users/me/sessions` 행에 응답 shape 미기재 — draft 가 다루는 sessions 예시와 관련 있으나 target 범위 밖
  - target 위치: draft 본문 근거 표 (44행) — sessions.controller.ts 를 `{data:{items}}` 근거로 인용
  - 충돌 대상: `spec/2-navigation/9-user-profile.md` line 329 (`GET /api/users/me/sessions` — "활성 세션 목록 (family 단위, isCurrent 플래그 포함)"만 기술, 응답 wire shape 언급 없음)
  - 상세: 모순은 아니지만, draft 가 "sessions·webauthn 양쪽 이미 의존" 을 근거로 `1-auth.md`/`api-convention.md` 만 갱신하면 sessions 의 실제 canonical spec 위치(`9-user-profile.md §6.1`)는 여전히 shape 미기재 상태로 남는다. `1-auth.md` 는 sessions 엔드포인트에 대해 "정의는 9-user-profile.md 참조"로 위임하고 있으므로(line 483), 신설되는 `api-convention §5.2` note 가 향후 sessions shape 의 SoT 근거가 될 텐데 `9-user-profile.md` 자체에는 그 사실이 반영되지 않아 두 문서 사이 완전성 격차가 생긴다.
  - 제안: 필수는 아니나, 여유가 있다면 `9-user-profile.md:329` 행에도 "응답 `{ data: { items: [...] } }` — 비-페이징 고정 컬렉션(api-convention §5.2)" 를 짧게 덧붙여 sessions 의 실제 canonical 위치에도 동일 사실을 동기화. draft 체크리스트의 "spec 반영" 항목에 옵션으로 추가 가능.

- **[INFO]** `webauthn-response.dto.ts` 코드 주석이 stale — spec 변경과 직접 관련 없으나 참고
  - target 위치: (코드 참고 사항, spec 변경 범위 아님)
  - 충돌 대상: `codebase/backend/src/modules/auth/webauthn/dto/responses/webauthn-response.dto.ts:77` 주석 "SessionListDto 의 이중 중첩 패턴은 피한다" — 그러나 현재 `SessionListDto` 자체도 동일한 단일 `{items}` 패턴(`session.dto.ts:60` 주석: "옛 필드명 `data` → `items` 로 개명... webauthn credential 목록·login history 와 일관된 `items` key 사용")으로 이미 정리되어 있어, 주석이 가리키는 "이중 중첩" 이 더는 사실이 아니다.
  - 상세: 이는 `spec/` 파일이 아니라 코드 주석의 stale 서술이라 본 draft(spec-only) 범위 밖이며 developer 트랙에서 처리할 사안. cross-spec 충돌은 아니지만, 이번 조사 중 발견되어 참고용으로 기록.
  - 제안: 조치 불필요(범위 밖). 향후 developer 가 해당 파일을 편집할 기회가 있으면 주석 정정 권고.

## 요약

Target draft 의 핵심 결정(§5.2 페이징과 별개로 비-페이징 고정 컬렉션은 `{data:{items}}` 를 유지하고 spec 텍스트를 실제 계약에 맞춘다)은 코드베이스 사실관계와 완전히 일치하며, `1-auth.md` line 469 자체의 수정은 다른 영역과 충돌하지 않는다. 그러나 draft 가 새로 도입하는 "비-페이징 고정 컬렉션은 `TransformInterceptor` pass-through 를 이용한다"는 문언은 `spec/conventions/swagger.md` 가 이미 "페이지네이션 pass-through 가 §2-5 규칙의 **유일한** 예외"라고 명문화한 것과 직접 모순되므로(CRITICAL), swagger.md 도 함께 갱신하지 않으면 draft 반영 즉시 두 spec 문서가 서로 어긋난 상태가 된다. 추가로 swagger.md §6 의 "버그" 지칭 문구와의 표면적 유사성으로 인한 오인 가능성(WARNING), 그리고 sessions 의 canonical spec 위치(`9-user-profile.md`)가 이번 갱신 범위에서 빠져 완전성 격차가 남는 점(INFO)이 있다. 이 CRITICAL 1건을 해소(swagger.md 동시 갱신)하면 나머지는 채택 가능한 수준이다.

## 위험도

HIGH (CRITICAL 1건 — 다만 swagger.md 문구 한 곳 추가 수정으로 해소 가능한 낮은 blast-radius 성격의 CRITICAL)
