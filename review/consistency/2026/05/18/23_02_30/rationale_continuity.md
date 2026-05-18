### 발견사항

- **[WARNING]** counter 역행 시 HTTP 응답 코드 — plan 내부 불일치 + spec 정의와 충돌
  - target 위치: `plan/in-progress/2fa-webauthn.md` §4 백엔드 구현 91번 줄 (`+ 400 응답`) vs. 동일 plan §4 e2e 시나리오 116번 줄 (`counter 역행 시 401·credential 삭제`)
  - 과거 결정 출처: `spec/5-system/1-auth.md §5` API 엔드포인트 표 (`authenticate/verify` 행) — "counter 역행 시 401 + 해당 credential row 삭제"; Rationale 1.4.E — counter 역행 처리의 행동(즉시 삭제 + LoginHistory 기록)을 확정한 결정이며 응답 코드는 `§5` 표가 SoT
  - 상세: plan 91번 줄의 `WebAuthnService.verifyAuthentication` 구현 설명이 `400 응답`을 명시하나, spec `§5` API 표 및 동일 plan 116번 줄의 e2e 시나리오 기술(`counter 역행 시 401`)은 모두 `401`을 따른다. 코드 구현 시 `400` 기준으로 작성될 위험이 있으며, spec Rationale 1.4.E 의 "즉시 신뢰 철회" 의도는 인증 실패(401)와 부합하고, 400은 클라이언트 요청 오류(Bad Request)의 HTTP 시맨틱이라 counter 역행 맥락과 어울리지 않는다.
  - 제안: plan 91번 줄의 `400 응답`을 `401 응답`으로 정정. spec `1-auth.md §5`의 `401` 정의가 SoT이므로 plan을 맞춘다. e2e 시나리오(116번 줄)의 `401` 기술은 이미 올바르다.

- **[INFO]** `requiresTotp` deprecated 필드 제거 조건 — plan이 spec 대비 한 조건 누락
  - target 위치: `plan/in-progress/2fa-webauthn.md` §4 백엔드 구현 105번 줄 (`두 마이너 버전 후 제거 (W-1 follow-up)`)
  - 과거 결정 출처: `spec/5-system/1-auth.md` §1.4.2 (72번 줄) — 제거 조건: "(1) 두 마이너 버전 후, (2) `methods`만 보는 새 프론트엔드가 동일 PR에서 함께 배포되어 backward-only 사용처가 사라진 것이 확인된 후 — 둘 중 늦은 시점"
  - 상세: plan은 (1) 버전 조건만 언급하고 (2) 프론트엔드 배포 확인 조건을 생략했다. spec의 두 조건은 "둘 중 늦은 시점"으로 AND 관계이므로, (2)가 누락되면 W-1 follow-up plan 작성 시 (1)만 기준으로 필드를 제거할 위험이 있다.
  - 제안: plan 105번 줄을 "두 마이너 버전 후 AND `methods`만 보는 신규 프론트엔드 동일 배포 확인 후 제거 (W-1 follow-up — `spec/5-system/1-auth.md §1.4.2` 두 조건 모두 충족 시점)"로 보완.

- **[INFO]** frontend e2e — Playwright Virtual Authenticator 사용이 PROJECT.md 기본 패턴(mock-based)과 대비됨
  - target 위치: `plan/in-progress/2fa-webauthn.md` §5 프론트엔드 구현 132번 줄 (`e2e (Playwright Virtual Authenticator) — Chrome 기준`)
  - 과거 결정 출처: `PROJECT.md §e2e 테스트 작성 가이드 §Frontend e2e 패턴` — "backend 와 분리 — `page.route('**/api/...', ...)` 로 mock. 실 backend 호출은 backend e2e 가 책임"
  - 상세: PROJECT.md의 frontend e2e 기본 패턴은 mock-based이나, WebAuthn은 `navigator.credentials` API가 실제 브라우저 API이므로 mock이 아닌 Virtual Authenticator (CDP 세션 기반)를 사용해야 한다. 이는 기각된 대안의 재도입이 아니라 기존 패턴이 커버하지 못하는 특수 케이스에 해당하며, PROJECT.md의 Rationale이 WebAuthn을 명시적으로 제외한 바 없다. 단, 해당 선택의 근거(navigator.credentials API 특성)를 plan에 명시하지 않아 향후 리뷰어가 패턴 위반으로 오독할 수 있다.
  - 제안: plan 132번 줄에 "(`navigator.credentials` API 는 mock 불가 — CDP `Page.addVirtualAuthenticator` 사용; PROJECT.md frontend e2e 패턴의 특수 케이스)" 형태의 근거 주석 추가.

### 요약

`plan/in-progress/2fa-webauthn.md`는 전반적으로 `spec/5-system/1-auth.md`의 Rationale(1.4.A~E)에서 합의된 결정(라이브러리 선택, 복구 코드 풀 분리, stateless JWT challenge, counter 역행 시 삭제, TOTP 자동 fallback 금지)을 올바르게 반영하고 있다. 기각된 대안(suspend 옵션, webauthn_challenge 테이블, 공통 복구 코드 풀, TOTP 자동 fallback)을 재도입하는 사례는 발견되지 않았다. 다만 plan §4 백엔드 구현 설명에서 counter 역행 시 HTTP 응답 코드를 `400`으로 기술한 부분이 spec `§5` API 표(401)와 동일 plan e2e 시나리오(401) 모두와 충돌하는 WARNING이 존재하며, 구현 코드 작성 시 오류 발생 위험이 있다. 나머지 두 항목은 Rationale 정합 보완 수준의 INFO 사안이다.

### 위험도

LOW
