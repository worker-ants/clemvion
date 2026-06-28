# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/webhook-public-ip-failopen-hardening.md`
검토 모드: `--spec` (spec draft)
검토 일시: 2026-06-28

---

## 발견사항

### 1. [INFO] S-1/S-2 — `4-security.md §4` 에 추가될 "IP 미식별 공유 버킷" 설명이 기존 `12-webhook.md §6` 서술과 중복 관리 위험

- **target 위치**: plan Phase A, S-1 · S-2 (`spec/7-channel-web-chat/4-security.md §4` + Rationale R3)
- **충돌 대상**: `spec/5-system/12-webhook.md §6` (Rate Limiting 공개 webhook 전용 추가 — line 330)
- **상세**: `12-webhook.md §6` 는 `PublicWebhookThrottleGuard` 의 동작을 세부적으로 기술하며, 수치·에러코드 적용 SoT 가 해당 절임을 명시한다. `4-security.md` 는 정책 수치(분당 10·시간당 20) 의 출처(SoT)로 `12-webhook.md §6` 에서 역참조된다. 공유 버킷 동작을 `4-security.md §4` 에 기재하면 정책 SoT 분산이 생길 수 있다. 단, 현재 plan 은 `4-security.md §4` 를 정책 SoT, `12-webhook.md §6·§8·WH-SC-05` 를 impl/error-code SoT 로 역할을 분리하고 있어 의도된 분업이라면 모순 아님.
- **제안**: S-1 에 "공유 버킷 정책(IP 미식별 시 처리)의 규범 서술은 `4-security.md §4` 이고, 에러코드·guard 동작은 `12-webhook.md §6`" 임을 명시하거나, `12-webhook.md §6` 에 "IP 미식별 공유 버킷" 단 한 줄의 forward-ref 를 함께 달아 단방향 참조 체인을 완성할 것.

---

### 2. [INFO] S-4 — `1-auth.md Rationale 2.3.B m-3` 보강 범위가 현행 서술과 자연스럽게 연결되는지 확인 필요

- **target 위치**: plan Phase A, S-4 (`spec/5-system/1-auth.md Rationale 2.3.B m-3`)
- **충돌 대상**: `spec/5-system/1-auth.md` line 662 (Rationale 2.3.B 클라이언트 IP 신뢰 m-3 단락)
- **상세**: 현행 2.3.B m-3 은 이미 "`req.ip`/socket 폴백이 webhook/rate-limit 경로에서 의도적으로 기각됨"을 명시하고 있다. target plan 은 여기에 "rate-limit null-IP 에도 동일 기각 원칙 적용됨 + 단일 공유 버킷 완화 한도 cross-ref" 를 보강한다고 한다. 내용 자체는 모순이 없으나, 2.3.B m-3 이 이미 언급한 "기각" 근거(CF Tunnel 배포 오염)를 중복 서술할 경우 가독성이 저하된다. 모순은 없다.
- **제안**: 기존 2.3.B m-3 의 마지막 문장("코드 리뷰가 `req.ip` 폴백 부재를 지적하더라도 본 항이 정한 의도된 설계다") 뒤에 짧은 1문장 cross-ref ("null-IP 케이스의 공유 버킷 완화 처리는 [Spec 웹채팅 보안 §4 R3] 참조") 를 추가하는 방식으로 보강하면 기존 서술과 자연스럽게 이어진다.

---

### 3. [INFO] `4-security.md §4` "IP 단위" 불릿이 현재 "/IP" 전제로 작성됨 — 공유 버킷 추가 시 문구 비일관성 가능

- **target 위치**: plan Phase A, S-1 수정 대상 (`4-security.md §4` line 128: "IP 단위 대화 시작 rate-limit(예: 분당 10/IP)")
- **충돌 대상**: `spec/7-channel-web-chat/4-security.md §4` line 128–129
- **상세**: 현재 §4 는 "IP 단위" rate-limit 을 서술하고 시간당 상한도 "≤20/IP" 로 표기한다. 공유 버킷 설명을 추가할 때 "IP 미식별 시 전체가 단일 공유 버킷으로 묶인다" 는 문구가 이 "/IP" 표기와 나란히 놓이면, 독자가 "공유 버킷도 per-IP 상한인가?" 혼동할 수 있다. 기술적 모순은 아니지만 표기 일관성이 필요하다.
- **제안**: S-1 문구 초안 작성 시 "IP 식별 가능 시 per-IP 한도, 미식별 시 단일 공유 버킷(동일 fixed-window 한도)" 로 명확히 구분해 기재.

---

### 4. [INFO] `12-webhook.md §6` 의 Rate Limiting 서술이 공유 버킷 동작을 아직 언급하지 않아, S-3 갱신 전까지 impl spec 불완전

- **target 위치**: plan Phase A, S-3 (`spec/5-system/12-webhook.md §6·§8·WH-SC-05`)
- **충돌 대상**: `spec/5-system/12-webhook.md` line 330 (Rate Limiting 공개 webhook 전용)
- **상세**: 현재 `12-webhook.md §6` 는 "IP 단위 시작 한도" 라고만 기술하고 "IP 미식별 시 공유 버킷으로 누적" 동작을 언급하지 않는다. plan 의 S-3 이 이를 보완 예정이므로 미래 기술 갭이며 현재 spec 간 모순은 아니다. S-3 갱신 전 구현이 선행되면 spec 이 현실보다 늦어지는 일시적 불일치가 생긴다.
- **제안**: plan Phase 순서(A spec 먼저, B 구현 뒤)가 이미 SDD 원칙을 따르므로 현 plan 대로 진행하면 자연히 해소된다. 별도 조치 불요.

---

### 5. [INFO] WH-SC-09 fail-closed 와 공유 버킷 fail-open 간 대비 명확화 권장

- **target 위치**: plan 전체(결정 3 및 S-1~S-3)
- **충돌 대상**: `spec/5-system/12-webhook.md` line 73 (WH-SC-09 — ip_whitelist 미식별 시 **거부**)
- **상세**: `WH-SC-09` 는 AuthConfig 종속 ip_whitelist 에서 "클라이언트 IP 를 알 수 없으면 거부(fail-closed)" 를 규정한다. 반면 target plan 의 결정 3 은 공개 webhook rate-limit 의 IP 미식별을 fail-open(공유 버킷 완화) 로 처리한다. 두 규칙이 적용 조건이 다름(인증 webhook의 ip_whitelist vs 공개 webhook rate-limit)을 혼동하지 않도록 S-1 또는 S-3 추가 서술 시 이 대비를 명시할 것이 권장된다.
- **제안**: S-3 의 WH-SC-05 갱신 시 "공개 webhook 의 IP 미식별 → 공유 버킷(rate-limit), 인증 webhook 의 ip_whitelist IP 미식별 → 거부(WH-SC-09)는 별개 규칙" 임을 한 줄로 명시.

---

## 요약

target plan(`webhook-public-ip-failopen-hardening.md`) 은 기존 spec 과 **직접 모순되는 항목이 없다**. 결정 3(공유 버킷 완화)·결정 2(socket 폴백 기각)는 각각 `4-security.md §4 R3`(best-effort fail-open 철학), `1-auth.md Rationale 2.3.B m-3`(헤더 기반 IP 추출 의도적 기각)의 기존 결정과 일치한다. 또한 WH-SC-09 의 인증 webhook ip_whitelist fail-closed 와 공개 webhook rate-limit fail-open 은 적용 조건이 분리되어 충돌이 없다. 발견사항은 전부 INFO 수준 — spec 갱신 시 문구 명확화·cross-ref 추가 권장이다.

## 위험도

LOW
