# 아키텍처(Architecture) 리뷰 결과

## 발견사항

- **[INFO] AuthConfig 도메인 경계 명확화 — 설계 의도의 명시적 표현**
  - 위치: `spec/5-system/1-auth.md` §3.2 (Auth Config Reveal 행 추가), `spec/conventions/secret-store.md` §1 (비대상 주석)
  - 상세: Auth Config 의 `R` (읽기)과 평문 노출(Reveal)을 별도 행으로 분리하여 권한 매트릭스를 명확히 구분했다. Reveal 은 Admin+ 전용 민감 액션으로 분리된 행동이라는 것을 권한 테이블 수준에서 명시. `secret-store.md` 에서 `AuthConfig.config` 가 `SecretResolver` URI scheme 의 외부라는 점을 명시적 "비대상" 블록으로 명문화한 것은 두 자격증명 저장 경로(SecretStore vs 모듈 transformer 직접 처리)의 혼동을 선제 차단하는 긍정적 설계다.
  - 제안: 현재 수준으로 충분. 단일 책임 원칙(SRP)에 따라 자격증명 vault 의 책임 소재를 두 문서 모두에서 명확히 했다.

- **[INFO] inline auth 폐지 → AuthConfig 단일 진입 전환 — 응집도 향상**
  - 위치: `spec/5-system/12-webhook.md` §2.1, §4, §Rationale "inline auth path 폐지", `spec/data-flow/10-triggers.md` §1.2, §2.1
  - 상세: `trigger.config.authType` / `secret` / `bearerToken` 등 inline 인증 필드를 제거하고 `trigger.auth_config_id` FK 를 단일 진입(SoT)으로 격상했다. 이 변경은 SOLID 의 단일 책임 원칙 준수를 명확히 한다 — 자격증명 생명주기(발행·갱신·폐기·마스킹·RBAC·last_used_at)는 AuthConfig 도메인이 단독으로 책임지고, Trigger/Webhook 도메인은 인증 실행(검증)만 위임받는다. Trigger 가 자격증명을 직접 보유하던 이전 설계는 도메인 책임 혼재(High Cohesion 위반)였으며, 이번 변경이 이를 해소한다.
  - 제안: 설계 개선. 결합도 감소, 응집도 향상 모두 확인.

- **[WARNING] HooksService 의 AuthConfig 조회 의존 — 레이어 경계 주의**
  - 위치: `spec/5-system/12-webhook.md` §7 처리 흐름 6단계: `authConfigsService.findById(trigger.auth_config_id, trigger.workspace_id)`
  - 상세: Webhook 처리 흐름(`HooksService`)이 `AuthConfigsService.findById()` 를 직접 호출한다. 이는 Hooks 모듈이 AuthConfigs 모듈에 직접 의존함을 의미한다. Spec 상으로는 단방향 의존(`HooksModule → AuthConfigsModule`)이지만, 향후 AuthConfig 의 변경(예: 다단계 인증, 인증 체인 등)이 HooksService 구현에 영향을 미칠 수 있다. 현재로서는 안티패턴 수준이 아니지만, 인증 검증 로직을 `WebhookAuthGuard` 또는 별도 `WebhookAuthService` 로 추출하면 Hooks 도메인의 단일 책임이 더 명확해질 것이다 (인증 검증이 서비스 레이어 중간에 내장된 형태).
  - 제안: 구현 단계에서 `WebhookAuthService` 또는 전략 패턴(Strategy Pattern)으로 `bearer_token / api_key / basic_auth / hmac` 검증 분기를 캡슐화하는 것을 권장. Spec 수준에서는 현재 명시가 충분하나, 구현 명세에 "인증 전략 분리" 를 명시하면 구현자 혼선을 줄일 수 있다.

- **[INFO] ip_whitelist + last_used_at 의 AuthConfig 귀속 — 적절한 응집**
  - 위치: `spec/5-system/12-webhook.md` WH-SC-08, WH-SC-09; `spec/data-flow/10-triggers.md` §2.1
  - 상세: IP allowlist 검증과 `last_used_at` 갱신이 모두 AuthConfig 종속으로 귀결된다. `auth_config_id IS NULL` 인 경우 두 기능 모두 평가 대상이 아니라는 명시가 일관성 있게 여러 문서에 반복되어 있다.
  - 제안: 현재 수준으로 충분. Spec 명시가 구현자에게 혼동 없이 전달될 수준의 명확도.

- **[WARNING] fire-and-forget UPDATE 의 실패 처리 정책 — 아키텍처 명시 부족**
  - 위치: `spec/5-system/12-webhook.md` WH-SC-08, §7 6f단계; `spec/data-flow/10-triggers.md` §2.1
  - 상세: `last_used_at = NOW()` 갱신이 "트랜잭션 외, 실패 시 미갱신"으로 명시되었다. fire-and-forget 패턴 자체는 성능 측면에서 타당하지만, 이 갱신이 실패할 경우 어디서도 에러 로깅이 이루어지는지 Spec 에 명시가 없다. 디버깅·운영 가시성 측면에서 "실패 시 warn-level 로그" 정책이 빠져 있다. 또한 race condition 에서 "last-write-wins" 로 동작함이 명시되어 있으나, `auth_config_id` 하나를 여러 트리거가 공유하는 경우 동시성 부하가 의도치 않게 집중될 수 있는 아키텍처적 위험이 있다.
  - 제안: 구현 명세 혹은 Spec 보안/운영 섹션에 "fire-and-forget 실패 시 warn 로그" 정책을 한 줄 추가 권장. 여러 트리거가 동일 AuthConfig 를 공유할 수 있는지 여부도 Spec 에서 명확히 하는 것이 바람직하다.

- **[INFO] Auth Config Reveal 엔드포인트 위치 — Spec 에 미포함**
  - 위치: `spec/5-system/1-auth.md` §3.2, §3.3 권한 근거 블록
  - 상세: Reveal 권한 분리 근거(`POST /api/auth-configs/:id/reveal`)가 auth spec 의 §3.2 권한 매트릭스에 추가되었다. 그런데 §5 API 엔드포인트 목록에는 `/api/auth-configs/:id/reveal` 이 포함되어 있지 않다 — 이 엔드포인트가 auth spec 이 아닌 별도 auth-config 도메인 spec 에 정의되는 구조라면 cross-link 가 필요하다. 권한 행은 추가되었으나 해당 API 엔드포인트의 명세 위치를 참조할 수 없어 구현자가 혼란을 겪을 수 있다.
  - 제안: auth spec §3.2 의 Reveal 행에 해당 API Spec 문서 링크를 추가하거나, §5 엔드포인트 목록에 "(auth-config spec 참조)" 항목을 한 줄 추가 권장.

- **[INFO] audit log 액션 목록 구체화 — auth_config.regenerate, auth_config.reveal 추가**
  - 위치: `spec/5-system/1-auth.md` §4.1 감사 로그 기록 대상
  - 상세: `auth_config.*` 와일드카드가 구체적 액션 목록으로 대체됐다. 이는 감사 이벤트 계약이 명확해진 것으로, 구현자가 어떤 이벤트를 발생시켜야 하는지 명시적으로 알 수 있다. `auth_config.reveal` 이 audit 대상으로 포함된 것은 민감 동작의 추적가능성(traceability) 측면에서 올바르다. 개방-폐쇄 원칙 측면에서도, 와일드카드보다 구체적 열거가 신규 액션 추가 시 의도치 않은 포함을 방지한다.
  - 제안: 현재 수준으로 충분.

- **[INFO] WebAuthn 모듈 분리 결정(Spec §1.4.H) — 설계 일관성**
  - 위치: `spec/5-system/1-auth.md` Rationale §1.4.H
  - 상세: `WebAuthnModule` 신설, `AuthModule → WebAuthnModule` 단방향 의존성, `WebAuthnController` 파일은 `webauthn/` 폴더에 위치하지만 module 등록은 `AuthModule.controllers` 에 한다는 결정이 Spec 에 명문화되었다. 이 결정은 의존성 역전 원칙(DIP) 준수를 위한 합리적 트레이드오프 — 컨트롤러를 WebAuthnModule 에 두면 `WebAuthnModule → AuthModule` 역방향 의존이 발생하므로 host 를 AuthModule 로 유지한다는 근거가 명확하다. `setRefreshTokenCookie` / `clearRefreshTokenCookie` 를 stateless helper 함수로 추출한 것도 중복 제거(DRY) 측면에서 올바르다.
  - 제안: 현재 수준으로 충분. Spec 의 아키텍처 결정 근거가 충분히 문서화되어 있어 구현자가 순환 의존을 피할 수 있다.

- **[INFO] `requiresTotp` deprecated 필드 제거(Spec §1.4.I) — 인터페이스 정리**
  - 위치: `spec/5-system/1-auth.md` Rationale §1.4.I
  - 상세: 호환 브리지 역할을 마친 `requiresTotp` 필드를 backend DTO, AuthService, frontend 타입에서 동시 제거한다. 인터페이스 분리 원칙(ISP) 측면에서 불필요한 필드가 제거되어 API 계약이 단순해진다. 두 마이너 버전 경과 및 신규 프론트엔드 배포라는 두 조건 모두 충족한 시점에 제거하는 것은 호환성을 고려한 점진적 폐기 원칙에 부합한다.
  - 제안: 현재 수준으로 충분.

---

## 요약

이번 변경은 Webhook 인증 경로를 `trigger.config` 의 inline 인증 필드에서 `AuthConfig` 도메인으로 단일화하고, Auth Config 의 평문 노출(Reveal)을 별도 권한 액션으로 분리하며, WebAuthn 을 독립 서브모듈로 분리하는 세 가지 아키텍처적 개선을 담고 있다. 전반적으로 SOLID 원칙 — 특히 단일 책임(SRP), 인터페이스 분리(ISP) — 에 부합하는 방향이며, 자격증명 vault 의 응집도가 높아지고 Trigger 도메인의 인증 책임이 제거되어 결합도가 낮아진다. 지적할 수 있는 주요 약점은 두 가지다: (1) `HooksService` 가 `AuthConfigsService` 를 직접 호출하는 구조에서 인증 검증 전략을 별도 컴포넌트(예: `WebhookAuthService`)로 추출하지 않으면 타입별 분기 로직이 서비스 레이어에 내장되어 향후 인증 방식 추가 시 OCP 위반 위험이 있다; (2) `last_used_at` fire-and-forget 실패 처리 정책이 Spec 에 명시되지 않아 운영 가시성 공백이 있다. Spec 의 아키텍처 결정 근거(Rationale 섹션)가 풍부하게 작성되어 있어 구현자가 설계 의도를 추적하기 좋은 상태다.

---

## 위험도

LOW
