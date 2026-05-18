# 변경 범위(Scope) Review

리뷰 대상: 2fa-webauthn-impl worktree 변경사항
리뷰 일시: 2026-05-18

---

### 발견사항

- **[INFO]** consistency review 산출물 파일들 (파일 1~13) — 범위 내 정상 변경
  - 위치: `review/consistency/2026/05/18/23_02_30/` 및 `review/consistency/2026/05/18/23_11_17/` 하위 파일 전체
  - 상세: `--spec` 모드 및 `--impl-prep` 모드의 consistency-check 세션 산출물이다. 각 세션의 checker 별 `.md` 파일, `meta.json`, `_retry_state.json` 모두 코드 리뷰 산출물 경로 규약(`review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)에 맞게 생성되어 있으며 2fa-webauthn 구현 착수 선행 절차로 인과적으로 직결된다. 범위 일탈 없음.
  - 제안: 없음.

- **[WARNING]** `spec/3-workflow-editor/4-ai-assistant.md` 파일 변경 (파일 17) — 범위와 무관한 파일 수정
  - 위치: `spec/3-workflow-editor/4-ai-assistant.md` 첫 번째 `>` 관련 문서 링크 줄
  - 상세: 변경 내용은 문서 상단의 관련 문서 링크에서 `§2.20~2.21` 를 `§2.20·§2.22` 로 수정한 것이다. 이는 `spec/1-data-model.md` 에서 §2.21 이 `WebAuthnCredential` 로 대체되면서 기존 `AssistantMessage` 가 §2.22 로 시프트된 것에 맞춘 파급 수정이다. 2FA/WebAuthn 구현의 직접 의도는 아니지만, §2.21 섹션 번호 변경의 연쇄 영향으로 발생한 참조 갱신이므로 완전히 무관하다고는 볼 수 없다. 그러나 파일 자체는 AI 어시스턴트 spec 이며, 이 번호 수정이 없었어도 WebAuthn 기능은 동작한다. 의도된 범위 바깥의 파일이 수정된 사례에 해당한다.
  - 제안: 이 수정은 데이터 모델 섹션 번호 시프트의 불가피한 연쇄 갱신이므로 포함하는 것이 타당하다. 단, 리뷰어는 이 파일이 2FA 변경과 직접 연관이 없으며 §2.22 링크 정합성 유지 목적임을 인지해야 한다. 커밋 메시지나 PR 설명에 "§2.21 시프트로 인한 참조 갱신" 임을 명시하는 것을 권장한다.

- **[INFO]** `spec/1-data-model.md` 변경 (파일 14) — 범위 내 핵심 변경
  - 위치: `spec/1-data-model.md` §2.1 User 필드 추가, §2.18.2 LoginHistory `webauthn_failed` 추가, §2.21 WebAuthnCredential 신설(기존 §2.21 AssistantMessage → §2.22 시프트), §3 인덱스 표 추가
  - 상세: 2FA WebAuthn 구현의 직접적인 데이터 모델 spec 갱신이다. 추가된 내용이 모두 WebAuthn 기능 범위 내이며, 불필요한 리팩토링이나 기존 항목 수정이 없다. §2.21 → §2.22 번호 시프트는 삽입으로 인한 불가피한 변경이다.
  - 제안: 없음.

- **[INFO]** `spec/2-navigation/10-auth-flow.md` 변경 (파일 15) — 범위 내 핵심 변경
  - 위치: §3.2 처리 플로우, §3.4 2FA 입력 화면(§3.4.1/§3.4.2 분리), §5 API 표
  - 상세: WebAuthn 2FA 로그인 흐름 추가에 필요한 auth-flow spec 갱신이다. `verify-2fa` / `tempToken` deprecation 처리, WebAuthn 화면 spec(§3.4.2) 추가 모두 의도 범위 내다. 기존 TOTP 흐름(§3.4.1)에 대한 내용 변경은 엔드포인트 명칭 정정(`verify-2fa` → `login/totp`)에 국한되며 기능 변경이 아닌 표기 정합이다.
  - 제안: 없음.

- **[INFO]** `spec/2-navigation/9-user-profile.md` 변경 (파일 16) — 범위 내 변경
  - 위치: §2.2 보안 설정 항목, §6.1 API 표
  - 상세: security 페이지에 Passkey 카드 추가, API 표에 `/api/auth/2fa/webauthn/*` 참조 추가. 기존 `enable-2fa` / `confirm-2fa` deprecated 표기는 spec 정합 목적의 필요한 수정이다. 범위 내.
  - 제안: 없음.

- **[INFO]** `spec/5-system/1-auth.md` 변경 (파일 18) — 범위 내 핵심 변경
  - 위치: §1.4 전체 재구성(WebAuthn 방식 추가, §1.4.1~§1.4.4), §2.3 강제 종료 재인증 행, §4.3 LoginHistory 이벤트 목록, §5 API 엔드포인트 표, Rationale §1.4.A~§1.4.E 추가
  - 상세: WebAuthn 2FA 기능 전체의 핵심 spec 문서 갱신이다. 모든 추가 내용이 WebAuthn 구현 의도에 직결된다. 기존 §1.4 단순 테이블이 WebAuthn 추가로 구조적으로 확장된 것이며 "불필요한 리팩토링"이 아닌 기능 확장에 따른 spec 재구성이다.
  - 제안: 없음.

- **[INFO]** `spec/5-system/_product-overview.md` 변경 (파일 19) — 범위 내 변경
  - 위치: NF-SC-10 행 상태 갱신
  - 상세: "WebAuthn은 후속" → "✅ TOTP + WebAuthn" 상태 갱신이다. 구현 완료 후 product overview 반영으로, 의도 범위 내이며 단 한 행의 수정이다.
  - 제안: 없음.

- **[INFO]** `spec/data-flow/2-auth.md` 변경 (파일 20) — 범위 내 변경
  - 위치: System role 설명, §1.2 로그인 시퀀스 다이어그램, §3 데이터 변경 표
  - 상세: 인증 데이터 흐름 spec 에 WebAuthn 분기를 추가한 것이다. `totpToken` → `challengeToken` 전환, WebAuthn 분기 추가, `webauthn_credential` 데이터 변경 행 추가 모두 의도 범위 내다.
  - 제안: 없음.

---

### 요약

20개 파일 변경 중 변경 범위(Scope) 관점에서 주목할 사항은 하나다. `spec/3-workflow-editor/4-ai-assistant.md` (파일 17)의 수정은 WebAuthn 기능과 직접 관련 없는 파일이지만, `spec/1-data-model.md` 에서 §2.21 을 `WebAuthnCredential` 로 교체하면서 기존 `AssistantMessage` 가 §2.22 로 번호 시프트된 것에 따른 불가피한 참조 갱신이다. 이는 "무관한 파일 수정"의 외형을 띠지만 섹션 번호 시프트의 연쇄 갱신이라는 맥락에서 포함이 정당하다. 나머지 19개 파일 변경은 모두 2FA WebAuthn 구현 의도에 직결된 consistency review 산출물, spec 갱신(데이터 모델, 인증 흐름, 보안 설정 UI, 데이터 흐름, API 계약, product overview)으로 구성되어 있으며 불필요한 리팩토링, 기능 확장, 포맷팅 변경, 의미 없는 임포트 변경 등이 발견되지 않는다.

---

### 위험도

LOW
