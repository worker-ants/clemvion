# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/12-webhook.md`
검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/5-system/12-webhook.md)
검토 일시: 2026-05-29

---

## 발견사항

### [INFO] I-1 — `spec/5-system/12-webhook.md` 에 `base_url` 환경변수 정책 미반영

- **target 위치**: `spec/5-system/12-webhook.md §3.1 WH-EP-02`, `§6 구현 파일 구조`
- **과거 결정 출처**: `spec/2-navigation/2-trigger-list.md §2.4 Webhook URL 형식` — "`base_url`: SaaS의 경우 서비스 도메인, 셀프 호스팅의 경우 설정된 도메인"
- **상세**: 현재 구현 plan (`plan/in-progress/webhook-url-env.md`) 이 `NEXT_PUBLIC_WEBHOOK_BASE_URL` / `NEXT_PUBLIC_API_BASE_URL` 환경변수 도입을 작업 범위로 명시하고 있다. `trigger-list.md §2.4` 는 `base_url` 정책을 "SaaS = 서비스 도메인, 셀프호스팅 = 설정된 도메인" 으로 선언해 이미 환경별 분기 의도를 담고 있다. 그러나 `spec/5-system/12-webhook.md` 본문 (WH-EP-02, §6, §7 처리 흐름) 과 Rationale 에는 환경변수 이름, fallback 정책, getWebhookUrl 로직 위치(`lib/utils/`)에 대한 구현 가이드가 전혀 없다. 이는 기각된 대안 재도입이나 합의된 원칙 위반은 아니지만, 향후 구현자가 `trigger-list.md §2.4` 와 `12-webhook.md` 사이에서 SoT 를 잃을 수 있다.
- **제안**: `spec/5-system/12-webhook.md §3.1 WH-EP-02` 비고에 "`base_url` 결정 — SaaS: 서비스 도메인, 셀프호스팅: `NEXT_PUBLIC_WEBHOOK_BASE_URL` 환경변수 (단일 진실: `trigger-list.md §2.4`)" 를 cross-link 로 추가. 또는 Rationale 에 환경변수 채택 결정을 한 항으로 기재. 현 상태 자체로는 구현 차단 요소 없음.

---

### [INFO] I-2 — R-2 번복(R-14) 이 `spec/5-system/12-webhook.md` Rationale 에 미반영

- **target 위치**: `spec/5-system/12-webhook.md §3.2 WH-SC-02 / §4.2 HMAC` + Rationale "inline auth path 폐지"
- **과거 결정 출처**: `spec/2-navigation/2-trigger-list.md Rationale R-2` — "Webhook HMAC secret 입력 vs. rotate 분리 (v1 = inline 입력, v1.1 = rotate endpoint `/auth/rotate-secret`)" / `R-14` — "R-2 TBD 번복: inline 경로 폐기, rotate 는 `POST /api/auth-configs/:id/regenerate` 로 일원화"
- **상세**: `trigger-list.md R-14` 가 R-2 를 명시적으로 번복하고 그 이유를 상세히 기술하고 있다. `12-webhook.md` 의 Rationale "inline auth path 폐지 (2026-05-28)" 항은 inline path 제거의 근거 6가지를 열거하고 있어 실질적으로 같은 결정을 다루나, `trigger-list.md R-2 / R-14` 와의 명시적 연결이 없다. 구현자가 두 문서를 독립적으로 읽으면 "rotate-secret endpoint 는 v1.1 에서 신설되지 않고 폐기됐다" 는 사실을 `12-webhook.md` 의 Rationale 만으로는 파악하기 어렵다.
- **제안**: `12-webhook.md Rationale "inline auth path 폐지"` 항 마지막에 "`trigger-list.md R-2 (Webhook HMAC rotate 분리)` 의 v1.1 예약 endpoint 는 본 PR 에서 폐기됐다 (trigger-list.md R-14 참조)" 문장을 추가해 두 Rationale 항의 연결을 명시. 차단 요소 없음.

---

## Rationale 연속성 관점의 전체 평가

`spec/5-system/12-webhook.md` 는 과거 Rationale 에서 기각된 대안을 재도입하거나 합의된 invariant 를 위반하지 않는다. 핵심 변경인 "inline auth path 폐지 → `auth_config_id` AuthConfig 단일 진입" 은 `trigger-list.md R-14` 의 결정과 정확히 일치하며, 이를 뒷받침하는 6가지 근거가 `12-webhook.md Rationale` 에 독립적으로 기술되어 있다. 기각된 대안 (`trigger.config.authType` inline 경로, `/api/triggers/:id/auth/rotate-secret` v1.1 예약 행) 은 본 spec 본문과 `trigger-list.md §3 API` 에서 모두 제거된 상태다. WH-SC-01 의 "무인증 공개 옵션 유지 + endpointPath UUID 가 capability token 역할" invariant 도 변경되지 않았다. 발견된 두 항목은 모두 INFO 수준의 cross-reference 보완 제안으로, 구현을 차단하는 Rationale 충돌이나 번복 미서술은 없다.

---

## 위험도

NONE
