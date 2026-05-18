# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/2fa-webauthn.md`
검토 모드: spec draft (--spec)
참조 Rationale: `spec/5-system/1-auth.md`, `spec/1-data-model.md`, `spec/2-navigation/10-auth-flow.md`, `spec/2-navigation/4-integration.md`, `spec/data-flow/2-auth.md`

---

### 발견사항

- **[INFO]** counter 역행(regression) 시 credential 삭제 결정 — Rationale 에 근거 없음
  - target 위치: `plan/in-progress/2fa-webauthn.md` §4 백엔드 구현, `verifyAuthentication` 설명
  - 과거 결정 출처: `spec/5-system/1-auth.md ## Rationale §1.4.A — WebAuthn 라이브러리`
  - 상세: Rationale 1.4.A 는 `@simplewebauthn/server` 가 counter 역행을 감지한다고 기술하지만, 감지 이후의 처리 방침(credential row 삭제 여부, 응답 코드 등)에 대해 아무 결정도 남기지 않았다. target 은 "counter 역행 시 row 삭제 + `webauthn_failed`(`WEBAUTHN_COUNTER_REGRESSION`) + 400" 이라는 구체적 정책을 도입하는데, 이 정책을 정당화하는 Rationale 항목이 없다. 이 결정은 credential 을 영구 제거하는 단방향·비가역 동작이므로 "왜 삭제인가 vs suspend/flag 인가" 를 명문화해 두지 않으면 후속 구현·보안 리뷰에서 동일 논쟁이 반복될 수 있다.
  - 제안: `spec/5-system/1-auth.md ## Rationale` 에 `1.4.E — counter 역행 시 credential 강제 삭제` 항목을 추가한다. 핵심 근거: (a) counter 역행은 credential 이 클론·재생공격에 노출됐음을 강하게 시사하므로 즉시 신뢰 철회가 원칙, (b) suspend/flag 는 자동 복구 경로가 없어 UX 개선 없이 운영 복잡도만 늘어남. 기각된 대안(suspend, manual review) 도 명시할 것.

- **[INFO]** `requiresTotp` deprecated 필드의 제거 타임라인 — 구체적 spec 미정
  - target 위치: `plan/in-progress/2fa-webauthn.md` §4 백엔드 구현, `auth.service.ts` 항목 및 §8 Follow-up
  - 과거 결정 출처: `spec/5-system/1-auth.md ##Rationale §1.4.D`, `spec/2-navigation/10-auth-flow.md` R-1·R-2
  - 상세: target 은 `requiresTotp` 를 "두 마이너 버전 후 제거 (W-1 follow-up)" 으로 기술하나, "두 마이너 버전" 이 무엇을 기준으로 계산되는지, deprecated marker 를 spec/API 어디에 표기하는지 정책이 없다. Rationale 에 이 필드의 도입 이유(하위 호환)와 제거 기준(마이너 버전 N)이 기록되어 있지 않아, follow-up PR 에서 제거 시점 판단의 근거가 사라진다.
  - 제안: `spec/5-system/1-auth.md ## Rationale` 에 `1.4.E` 또는 `1.4.F` 로 "`requiresTotp` deprecated 필드 수명 정책" 항을 추가한다. 도입 이유(기존 클라이언트 하위 호환), 제거 조건(Swagger `@deprecated` 표기 + 클라이언트 두 마이너 릴리즈 후), 제거 시 삭제 대상 범위를 명시한다.

---

### 요약

target 문서(`plan/in-progress/2fa-webauthn.md`)는 `spec/5-system/1-auth.md` 의 WebAuthn Rationale(1.4.A·B·C·D)에 전반적으로 부합한다. 라이브러리 선택, 복구 코드 풀 분리, stateless JWT challenge, TOTP 자동 fallback 금지 원칙 모두 기존 결정과 일치하며, `tempToken → challengeToken`, `verify-2fa → login/totp` 정정도 spec 과 대응된다. 단, counter 역행 시 credential 삭제 정책과 `requiresTotp` 제거 타임라인이 Rationale 에 근거 없이 도입되었다. 두 항목 모두 후속 구현·보안 리뷰에서 동일 논쟁이 재발할 수 있는 결정이므로 spec Rationale 에 명문화하는 것이 권장된다. 명시적으로 기각된 대안의 재도입이나 합의된 invariant 위반은 발견되지 않았다.

### 위험도

LOW
