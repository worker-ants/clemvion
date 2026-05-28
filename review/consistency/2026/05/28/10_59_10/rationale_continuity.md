# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-auth-config-webhook-wiring.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-05-28

---

## 발견사항

### 발견사항 1

- **[CRITICAL]** `authConfigId` 를 v1.1 후속으로 명시적으로 유보한 결정을 신규 Rationale 없이 v1 으로 격상
  - **target 위치**: §5.1 — "기존 v1.1 후속 표기였던 `Auth Config | authConfigId | edit (v1.1 후속)` 행을 **v1 활성화** 로 격상 (본 PR)."
  - **과거 결정 출처**: `spec/2-navigation/2-trigger-list.md §2.3.1` 행 98 — `authConfigId | edit (v1.1 후속)` + 비고 "v1 은 Webhook Configuration 의 인라인 `authType` 으로 충분. 외부 `auth_config` 엔티티와의 매핑은 Authentication 메뉴에서. v1 표시 전용"; 같은 문서 Rationale §R-2 의 TBD — "v1.1 rotate 의 응답 shape·grace 기간·경로 세그먼트는 본 spec PR 에서 확정하지 않는다"
  - **상세**: 기존 spec 은 v1 에서 인라인 `authType` 을 SoT 로, `authConfigId` 를 v1.1 후속으로 명시적으로 유보했다. draft 는 이 결정을 뒤집어 `authConfigId` 를 v1 SoT 로 격상하고 인라인 필드를 제거한다. 그러나 §5.1 에는 이 번복에 대한 새 Rationale 본문이 없다. `R-A "inline auth path 폐지"` 는 §2.8 (webhook spec 의 Rationale 신규 항목) 에 작성되어 있으나, trigger-list spec 의 v1.1 유보 결정을 명시적으로 언급하거나 번복 사유로 참조하지 않는다. 결정 번복은 있으나 해당 spec(2-trigger-list.md) 의 Rationale 갱신이 draft 에 포함되지 않았다.
  - **제안**: `spec/2-navigation/2-trigger-list.md` 의 Rationale 에 신규 항목 (예: "R-14. authConfigId v1 격상 — 인라인 auth path 폐지 (2026-05-28)") 을 추가하고, R-2 TBD 항목과 "v1 은 인라인으로 충분" 결정을 명시적으로 번복하는 문장을 포함할 것. §5.1 에서 `2-trigger-list.md` Rationale 를 상호 참조.

---

### 발견사항 2

- **[CRITICAL]** 기각된 대안(`authConfigId` inline 병행 유지)의 방향을 뒤집으면서 webhook spec 의 처리 흐름 단계 6 이 현재 spec 과 직접 충돌 — 새 Rationale 가 대안 기각 사유를 포함하지만 출처 spec 의 Rationale 에 업데이트가 없음
  - **target 위치**: §2.7 — 처리 흐름 step 6 재작성; §2.3 — WH-SC-01~08 표
  - **과거 결정 출처**: `spec/5-system/12-webhook.md §7` 처리 흐름 단계 6 (a~d: `config.authType` 분기); 같은 문서 §3.2 요구사항 (인증 행: "트리거의 authType 에 따라 다름 (공개/HMAC/Bearer)")
  - **상세**: `spec/5-system/12-webhook.md` 의 현행 처리 흐름은 `config.authType`('none'/'hmac'/'bearer') 을 명시적 분기 기준으로 사용한다. draft §2.7 의 재작성은 이 분기를 `trigger.auth_config_id IS NULL` 과 `AuthConfig.type` 분기로 교체한다. 이는 기능적으로 올바른 방향이나, 12-webhook.md 의 기존 Rationale 에는 이 처리 흐름의 설계 원칙이 기록되어 있지 않아(webhook Rationale 은 EIA 분리·ChatChannel 분리만 기록) 충돌 기록 자체는 경미하다. 그러나 §2.3 의 WH-SC-04(`api_key`)·WH-SC-05(`basic_auth`) 신규 요구사항이 기존 spec 이 명시한 인증 유형 목록(none/hmac/bearer 3종) 을 무근거로 확장한다.
  - **제안**: `spec/5-system/12-webhook.md` 의 Rationale 에 "R-A. inline auth path 폐지" 항목을 직접 추가하거나, draft §2.8 의 내용을 실제 spec 파일의 Rationale 에 미러링하도록 명시. draft §2.7 재작성을 확정할 때 이전 분기(`config.authType`) 가 왜 기각됐는지를 12-webhook.md Rationale 에 남길 것.

---

### 발견사항 3

- **[WARNING]** `POST /api/triggers/:id/auth/rotate-secret` 를 410 GONE 으로 deprecate 처리하나, 이 endpoint 는 v1.1 TBD 로 설계된 미래 endpoint — 실체가 없는 endpoint 에 대한 deprecation
  - **target 위치**: §5.2 — `/auth/rotate-secret` 행 deprecate 명시, "본 endpoint 는 본 PR 머지 이후 호출 시 410 GONE"
  - **과거 결정 출처**: `spec/2-navigation/2-trigger-list.md §3 API 표` 행 135 — "v1.1 예약 (실제 endpoint 신설은 별 spec PR)"; 같은 문서 Rationale R-2 TBD — "경로명·grace 기간·응답 shape 는 TBD"
  - **상세**: 기존 spec 은 `/auth/rotate-secret` 을 "v1.1 예약, 실제 endpoint 신설은 별 spec PR" 로 기록했다 — 즉 아직 신설되지 않은, 미래 endpoint 다. draft §5.2 는 이 endpoint 를 "Deprecated — rotation 은 `/api/auth-configs/:id/regenerate` 로 흡수. 본 endpoint 는 본 PR 머지 이후 호출 시 410 GONE" 으로 처리한다. 실제로 신설된 적 없는 endpoint 에 deprecation 을 기록하는 것은 spec 의 논리적 모순이다. 올바른 처리는 "v1.1 예약 행 자체를 제거 + 흡수 사유 기록" 이다. 또한 rotation 을 `/api/auth-configs/:id/regenerate` 로 흡수하는 것은 R-2 의 "EIA outbound notification secret 합의 후 동일 패턴 차용" 원칙과 다른 경로를 채택하는 것이므로 R-2 TBD 를 번복하는 새 결정이 필요하다.
  - **제안**: §5.2 에서 "Deprecated 처리" 대신 "v1.1 예약 행 자체를 제거하고 흡수 사유를 trigger-list Rationale 에 기록" 으로 변경. trigger-list Rationale 에 "rotation 은 `auth_config/regenerate` 로 일원화" 결정 및 R-2 TBD 의 폐기 사유를 추가.

---

### 발견사항 4

- **[WARNING]** 인라인 `authType` 의 `none` 값을 제거하나, 기존 webhook spec `config.authType: "none"` 은 "인증 없음" 상태의 명시적 표현으로 사용됨 — `IS NULL` 로 대체하는 의미론적 변경이 trigger-list spec 에서 참조 가능한 곳에 남아 있음
  - **target 위치**: §1 (AuthConfig.type 에서 `none` 제거), §2.7 step 6-a (`trigger.auth_config_id IS NULL → 통과 (none)`)
  - **과거 결정 출처**: `spec/5-system/12-webhook.md §2.2 config 필드 구조` — `"authType": "none" | "hmac" | "bearer"` 명시; `spec/2-navigation/2-trigger-list.md §2.2` — 동일 config JSON 예시; `spec/2-navigation/2-trigger-list.md §2.3.1` 행 87 — `authType | edit | none / hmac / bearer 전환 가능`
  - **상세**: draft §1 의 "none 제거 이유" Rationale 는 AuthConfig 테이블 관점에서만 작성됐다 ("Trigger.authConfigId IS NULL 로 표현되므로 row 자체가 type='none' 인 의미가 없음"). 그러나 기존 spec 들이 `config.authType: "none"` 이라는 인라인 필드를 "인증 없음" 의 표현으로 사용하고 있으며, 이 필드 자체의 제거에 대한 Rationale 는 draft §2.5 (webhook spec 재서술) 에서 언급하나 `2-trigger-list.md` §2.2·§2.3.1 의 갱신 Rationale 는 없다. none 제거가 외부 API 호환성에 영향이 없다는 근거는 draft §미해결 항목에만 기술.
  - **제안**: `spec/2-navigation/2-trigger-list.md` Rationale 에 "authType 인라인 필드 제거 및 none 값 제거" 사유를 명시. §2.2 config JSON 예시에서 인라인 인증 키 제거 시 호환성 설명을 Rationale 에 포함.

---

### 발견사항 5

- **[WARNING]** AuthConfig `reveal` 엔드포인트 권한을 "Admin+" 로 정의하나, 기존 RBAC 매트릭스에서 Auth Config 는 Owner/Admin = CRUD, Editor/Viewer = R 으로 정의됨 — Reveal 을 별도 액션으로 분리할 경우 "R 권한이 reveal 포함인지 아닌지" 가 ambiguous
  - **target 위치**: §3.1 — Auth Config Reveal 행 신규 추가 (`Owner ✅, Admin ✅, Editor —, Viewer —`); §4.3 Reveal 흐름 권한 — "Owner / Admin → Reveal 버튼 노출 + 호출 가능. Editor / Viewer → Reveal 버튼 미노출."
  - **과거 결정 출처**: `spec/5-system/1-auth.md §3.2 리소스별 권한 매트릭스` — Auth Config 행: `Owner CRUD | Admin CRUD | Editor R | Viewer R`; 1-auth.md Rationale 에 Auth Config RBAC 분리 결정 없음 (현재 Rationale 는 WebAuthn 관련 항목만)
  - **상세**: 기존 매트릭스에서 Editor 의 `R` 은 "Auth Config 를 조회한다" 는 의미다. 그러나 현재 spec 이 Editor/Viewer 에게 Auth Config 응답을 마스킹으로 노출하는지 여부가 명시되어 있지 않다. draft 가 Reveal 을 별도 행으로 분리하는 것은 타당하나, "Editor 가 R 권한으로 조회할 때 마스킹된 응답을 받는다는 것이 기존 R 의 의미와 일치하는가" 에 대한 Rationale 가 없다. 기존 결정에서 `R` 이 "마스킹 포함 조회" 를 암묵적으로 포함하는지 명시된 바 없다.
  - **제안**: `spec/5-system/1-auth.md §3.2` Rationale 에 "Auth Config Reveal 액션 분리 근거" 를 추가하고, 기존 `R` 권한이 마스킹 응답을 받는 조회를 포함한다는 것을 명시. 또는 기존 Auth Config 행의 Editor `R` 에 "(마스킹 응답)" 주석 추가.

---

### 발견사항 6

- **[WARNING]** `spec/conventions/secret-store.md` 에 신규 단락을 추가하나 ("4.A 관련 컨벤션 — 응답 마스킹"), 기존 secret-store 의 Rationale 에서 "응답 마스킹은 해당 secret-store 범주 밖" 임을 명시했는지 확인 필요 — 단락 추가가 scope 확장인지 참고 안내인지 불명확
  - **target 위치**: §7.2 — `spec/conventions/secret-store.md §4.A 관련 컨벤션 — 응답 마스킹` 신규 단락
  - **과거 결정 출처**: `spec/conventions/secret-store.md` 의 Rationale (본 payload 에 발췌 없음)
  - **상세**: draft §7.1 에서 "§변경 없음. AuthConfig 의 config JSONB 는 `auth-configs` 모듈 자체의 AES-256-GCM transformer (Integration 과 공유) 가 처리 — 본 secret-store URI scheme 의 통합 대상 아님 (별 도메인 + 별 transformer)" 이라고 명시하면서도, §7.2 에서는 같은 파일에 관련 컨벤션 단락을 추가한다. 이는 "별 도메인이지만 동일 보안 원칙을 공유" 라는 참고 목적으로 해석되나, secret-store.md 의 기존 Rationale 에서 이 파일의 scope 를 어떻게 정의하고 있는지에 따라 scope 확장 여부가 달라진다. 해당 Rationale 발췌가 payload 에 없어 판단에 한계가 있음.
  - **제안**: `spec/conventions/secret-store.md` 의 Rationale 를 확인해 해당 파일의 scope 가 "URI scheme 기반 참조 저장" 으로 한정되어 있다면, 4.A 단락 추가 시 Rationale 에 "scope 확장이 아닌 참고 안내 단락" 임을 명시. 없다면 §4.A 를 별 문서 (예: `spec/conventions/api-response-masking.md`) 로 분리 검토.

---

### 발견사항 7

- **[INFO]** draft R-A 에서 "IP whitelist 우회" 를 inline path 폐지 근거 중 하나로 기록하나, 기존 `spec/1-data-model.md §2.17 AuthConfig` 의 `ip_whitelist` 필드 및 적용 정책이 webhook 처리 흐름에 어떻게 통합되는지 draft 에 명시되지 않음
  - **target 위치**: §2.8 R-A 근거 4 ("IP whitelist 우회: AuthConfig 가 보유한 `ip_whitelist` 가 inline path 에서 시행되지 않음"), §2.3 WH-SC-02~WH-SC-05 표 (ip_whitelist 언급 없음)
  - **과거 결정 출처**: `spec/1-data-model.md §2.17 AuthConfig` `ip_whitelist` 필드; `spec/5-system/12-webhook.md` 기존 처리 흐름 (ip_whitelist 시행 alt 블록)
  - **상세**: 기존 `spec/data-flow/10-triggers.md §1.2` 처리 흐름 (현재 spec) 에 `alt auth_config_id 설정 OR ip_whitelist` 분기가 있어 ip_whitelist 도 인증 경로에서 처리된다. draft §6.1 의 변경에서 `+ ip_whitelist` 가 포함되어 있으나, §2.3 WH-SC 표에서 ip_whitelist 를 요구사항으로 명시하지 않아 추적 가능성이 낮다. R-A 에서 근거로 언급했으나 실제 spec 에서 ip_whitelist 시행을 명시하는 요구사항 항목이 없다.
  - **제안**: §2.3 WH-SC 표에 ip_whitelist 관련 요구사항(예: WH-SC-09) 을 추가하거나, §2.7 step 6-d 에 "ip_whitelist 검증 포함" 을 명시. ip_whitelist 가 AuthConfig.type 분기와 직교하는지(공통 검증인지) 아니면 type 별 분기인지 명확화.

---

### 발견사항 8

- **[INFO]** `bearer_token` type 자동 발급 스키마가 "토큰 자동 발급 또는 사용자 입력" 에서 자동 발급으로 단일화됨 — 기존 spec 의 Bearer Token 섹션 "자동 생성 또는 사용자 입력" 과 차이
  - **target 위치**: §1 AuthConfig.config JSONB 스키마 표 — `bearer_token: { token: string }`, 자동 발급 `token = wft_<hex32>`
  - **과거 결정 출처**: `spec/2-navigation/6-config.md §A.2 Bearer Token` — "Token: 자동 생성 또는 사용자 입력"
  - **상세**: 기존 spec 은 Bearer Token 의 token 을 "자동 생성 또는 사용자 입력" 으로 정의한다. draft 는 자동 발급(`wft_<hex32>`) 만 기술하고 사용자 입력 옵션을 제거한다. Rationale 에 이 변경 이유가 없다. 보안상 사용자 입력 token 이 weak 할 수 있어 자동 발급으로 강제하는 것은 타당하지만 명시 기각 사유가 없다.
  - **제안**: §1 또는 `spec/2-navigation/6-config.md §A.2` Rationale 에 "bearer_token 사용자 입력 옵션 제거 — 자동 발급 강제" 사유 추가 (예: 약한 토큰 방지, Stripe/GitHub PAT 패턴과 일관성).

---

## 요약

draft 는 `authConfigId` 를 v1 SoT 로 격상하고 inline auth path 를 폐지하는 방향 자체는 충분한 기술적 근거를 담고 있다(R-A 6개 근거). 그러나 `spec/2-navigation/2-trigger-list.md` 의 Rationale R-2 TBD 및 `authConfigId = v1.1 후속` 결정을 명시적으로 번복하는 Rationale 를 해당 spec 파일에 포함하지 않은 것이 가장 큰 연속성 결함이다 (CRITICAL 1건). `/api/triggers/:id/auth/rotate-secret` 를 "아직 신설되지 않은 endpoint" 에 대한 deprecation 으로 처리하는 것도 spec 논리 모순으로 번복 기록이 필요하다 (CRITICAL 1건). 나머지는 Warning 3건(RBAC Reveal 분리, authType none 제거 기록, secret-store scope), Info 2건(ip_whitelist 요구사항 누락, bearer_token 자동발급 강제 미기록)이다. 신규 Rationale(R-A)는 잘 작성되어 있으나 이것이 변경되는 각 spec 파일의 Rationale 섹션으로 분산 배치되지 않고 draft 한 곳에만 집중된 구조가 전반적 연속성 위험의 원인이다.

---

## 위험도

HIGH
