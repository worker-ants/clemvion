# Cross-Spec 일관성 검토 결과

검토 대상: `codebase/backend/src/modules/auth` (구현 착수 전 —impl-prep)
참조 spec: `spec/5-system/1-auth.md` (worktree 개정본), `spec/1-data-model.md`, `spec/2-navigation/10-auth-flow.md`, `spec/2-navigation/9-user-profile.md`, `spec/5-system/_product-overview.md`

---

### 발견사항

- **[WARNING]** `spec/1-data-model.md §2.21` WebAuthnCredential counter 설명과 `spec/5-system/1-auth.md §1.4.4` 처리 방식 간 용어 불일치
  - target 위치: `spec/1-data-model.md §2.21` — counter 필드 설명 "역행 시 fatal — 해당 credential **강제 비활성** + LoginHistory 기록"
  - 충돌 대상: `spec/5-system/1-auth.md §1.4.4` 마지막 단락 — "해당 credential 을 **강제 비활성** (별도 컬럼 추가 없이 **row 삭제**)"
  - 상세: 데이터 모델은 "강제 비활성"이라는 용어를 쓰고, 인증 spec 은 괄호 안에 "row 삭제"임을 부연한다. 두 문서를 동시에 읽지 않으면 `is_active` 같은 별도 컬럼이 있다고 오해할 수 있다. WebAuthnCredential 스키마에 `is_active` 필드가 없으므로 "비활성"은 곧 "삭제"다. 구현자가 잘못 읽을 경우 disabled_at 컬럼을 추가하거나 row를 남겨두는 방향으로 잘못 구현할 가능성이 있다.
  - 제안: `spec/1-data-model.md §2.21` counter 설명을 "역행 시 fatal — 해당 credential **row 즉시 삭제** + LoginHistory `webauthn_failed`(`WEBAUTHN_COUNTER_REGRESSION`) 기록"으로 통일. "강제 비활성" 문구 제거.

- **[WARNING]** `spec/2-navigation/9-user-profile.md §6.1` API 표의 `/api/users/me/enable-2fa`·`/api/users/me/confirm-2fa` 와 `spec/5-system/1-auth.md §5` canonical 정의 간 endpoint 이중화
  - target 위치: `spec/2-navigation/9-user-profile.md §6.1` 사용자 API 표
  - 충돌 대상: `spec/5-system/1-auth.md §5` API 엔드포인트 테이블
  - 상세: 사용자 프로필 spec 은 `POST /api/users/me/enable-2fa`·`POST /api/users/me/confirm-2fa` 를 여전히 나열하면서 괄호로 `canonical: POST /api/auth/2fa/setup` 등을 표기한다. 인증 spec §5 의 canonical 목록은 `/api/auth/2fa/setup`·`/api/auth/2fa/verify` 만 정의한다. `/api/users/me/enable-2fa` 와 `/api/users/me/confirm-2fa` 가 실제로 존재하는 별개 라우트인지, 아니면 역사적 별칭(alias)인지, 또는 이미 제거된 구 endpoint 인지가 명확하지 않다. 구현 시 이 두 경로를 추가로 구현해야 한다고 오해할 수 있다.
  - 제안: 사용자 프로필 spec의 해당 행을 "구 경로 — canonical은 `/api/auth/2fa/setup`·`/api/auth/2fa/verify`" 형태로 명확히 deprecated 표기하거나, 실제로 alias 라우트가 필요하지 않다면 행을 제거한다.

- **[WARNING]** `spec/5-system/1-auth.md §4.1` 감사 로그 대상 액션 목록이 WebAuthn 등록·삭제 이벤트를 누락
  - target 위치: `spec/5-system/1-auth.md §4.1` — "인증 (워크스페이스 컨텍스트)" 행에 `password_change, 2fa_enable/disable` 만 기재
  - 충돌 대상: 동일 파일 §1.4.4 — WebAuthn credential 등록·삭제가 명시적 보안 행위로 정의됨
  - 상세: TOTP 의 `2fa_enable/disable` 은 AuditLog 대상으로 기재되어 있으나, WebAuthn credential 의 등록·삭제(`webauthn_credential_register`, `webauthn_credential_delete`) 는 언급이 없다. WebAuthn credential 은 TOTP 와 마찬가지로 로그인 2FA 경로에 영향을 주는 보안-critical 변경이므로 AuditLog 대상이어야 하는지 결정이 필요하다. LoginHistory 에는 `webauthn_failed` 이벤트만 있고, credential 추가/삭제 감사는 누락이다.
  - 제안: `spec/5-system/1-auth.md §4.1` 의 인증 카테고리 행에 `webauthn_credential_register`, `webauthn_credential_delete` 포함 여부를 명시한다. 워크스페이스 컨텍스트가 없는 user-level 보안 행위이므로 AuditLog 가 아닌 LoginHistory 확장으로 대신할 수도 있으나, 그 결정도 spec 에 명시가 필요하다.

- **[WARNING]** `spec/5-system/1-auth.md §1.4.2` 응답 필드 `requiresTotp` deprecated 타임라인이 `spec/2-navigation/10-auth-flow.md §3.2` 와 단편적으로만 언급
  - target 위치: `spec/5-system/1-auth.md §1.4.2` — `requiresTotp` 제거 조건 명시
  - 충돌 대상: `spec/2-navigation/10-auth-flow.md §3.2` — "응답의 `requiresTotp` 는 deprecated 호환 필드이며 두 필드 충돌 시 `requires2fa` 가 우선한다"
  - 상세: 인증 spec은 제거 조건(두 마이너 버전 후, 새 프론트엔드 동시 배포 확인)을 상세히 기술하지만, auth-flow spec은 단순히 "deprecated"라고만 표기하고 제거 조건은 auth spec에 위임한다. 두 문서를 함께 읽지 않으면 프론트엔드 구현자가 `requiresTotp` 를 언제까지 지원해야 하는지 불명확하다. 충돌은 아니나, 프론트엔드 구현 시 오래된 필드를 영속적으로 지원하거나, 반대로 너무 이르게 제거하는 실수가 생길 수 있다.
  - 제안: `spec/2-navigation/10-auth-flow.md §3.2`에 `requiresTotp` deprecated 타임라인의 canonical 참조를 명시적으로 추가 ("제거 조건은 [auth spec §1.4.2] 의 제거 조건을 따름").

- **[INFO]** `spec/1-data-model.md §2.18.2` LoginHistory `event` Enum 갱신 마이그레이션 표기(V058)가 spec 의 V 번호 계보와 정합성 확인 필요
  - target 위치: `spec/1-data-model.md §2.18.2` — "WebAuthn 추가는 V058 에서 DROP CONSTRAINT + ADD CONSTRAINT 패턴으로 갱신"
  - 충돌 대상: 실제 마이그레이션 파일 계보 (`codebase/backend/migrations/V049__*.sql` 이후의 다음 번호)
  - 상세: spec 에 V058 이라는 구체적 마이그레이션 번호가 박혀 있다. 구현 시 실제 다음 마이그레이션 번호가 V058 이 아닐 수 있으며, 충돌 시 spec 과 코드가 어긋나게 된다. spec 에 미래 마이그레이션 번호를 고정하는 방식은 위험하다.
  - 제안: V058 표기를 "다음 가용 마이그레이션 번호에서 수행"으로 교체하고, 실제 번호는 구현 완료 후 spec을 사후 갱신하거나 주석으로만 명기한다.

- **[INFO]** `spec/5-system/1-auth.md §4.1` AuditLog 카테고리 명 "인증 (워크스페이스 컨텍스트)"와 main 브랜치 `spec/5-system/1-auth.md §4.1` 의 동일 행 내용이 일치함 — WebAuthn 관련 변경 없음
  - target 위치: worktree `spec/5-system/1-auth.md §4.1`
  - 충돌 대상: main 브랜치 동일 섹션
  - 상세: worktree spec 에서 §4.1 AuditLog 목록은 TOTP 관련 항목 이외의 변경 없이 그대로다. WebAuthn 관련 AuditLog 액션 추가 여부가 TODO 상태임을 plan 에서 확인했으나 spec 에는 반영되지 않았다.
  - 제안: 상위 WARNING 항목(WebAuthn AuditLog 누락)과 함께 처리.

- **[INFO]** `spec/5-system/_product-overview.md` NF-SC-10 상태가 worktree에서 ✅ TOTP + WebAuthn으로 갱신되었으나 main 브랜치에서는 "WebAuthn은 후속"으로 남아 있음
  - target 위치: worktree `spec/5-system/_product-overview.md` §2 NF-SC-10
  - 충돌 대상: main 브랜치 `spec/5-system/_product-overview.md` §2 NF-SC-10
  - 상세: worktree에서는 NF-SC-10이 구현 완료 상태로 갱신되었다. 이 변경이 구현 완료 후 main에 merge될 예정이므로 사전 충돌이지만, PR 검토 시점에 함께 반영되어야 한다. main의 값이 오래된 채로 merge되면 두 브랜치 간 문서 역전이 생긴다.
  - 제안: 구현 완료 PR 에서 이 문서 변경을 반드시 포함한다. plan `2fa-webauthn.md §5`의 체크리스트 항목에 이미 포함되어 있으므로 누락 위험은 낮다.

---

### 요약

Worktree(`2fa-webauthn-impl`) 의 WebAuthn 관련 spec 개정본(`spec/5-system/1-auth.md`, `spec/1-data-model.md`, `spec/2-navigation/10-auth-flow.md`, `spec/2-navigation/9-user-profile.md`)은 대체로 내부 일관성이 유지되어 있다. 주요 API 계약, 데이터 모델, 상태 분기 로직(WebAuthn 우선·TOTP fallback 자동 금지)이 세 문서에 걸쳐 서로 모순 없이 기술되어 있다. 다만 counter 역행 처리에서 "강제 비활성"과 "row 삭제"의 용어 혼재, TOTP 2FA 활성화 API의 구 endpoint(`/api/users/me/enable-2fa`)가 deprecated 표기만 된 채 계속 나열되어 있는 점, WebAuthn credential 등록·삭제 이벤트의 AuditLog 포함 여부 미결, 그리고 spec에 미래 마이그레이션 번호가 고정된 점이 구현자 혼선 요인으로 식별된다. CRITICAL 수준의 직접 모순은 없으며, 식별된 항목은 모두 WARNING 이하다.

---

### 위험도

MEDIUM
