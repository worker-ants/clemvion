# Plan 정합성 검토 결과

검토 모드: 구현 착수 전 (--impl-prep)
Target 문서: `spec/2-navigation`
검토 기준 plan: `plan/in-progress/refactor/02-architecture.md` (M-8)

---

## 발견사항

### 발견사항 1

- **[WARNING]** M-8 2단계 "6카드 vs 5카드" UI 구조 결정 미해소 — spec 과 구현 현실 사이 gap 이 plan 에 "behavior-preserving 추출과 별개 결정" 으로 기술되어 있으나, 이 결정이 spec 에도 plan 에도 명시적으로 확정되지 않은 채 2단계 착수 전 상태
  - target 위치: `spec/2-navigation/2-trigger-list.md §2.3.1 필드 권한 매트릭스` — Auth Config 카드가 독립 행으로 정의되어 있어 spec 은 사실상 6카드(Overview / Webhook Configuration / Schedule Configuration / External Interaction / Auth Config / Chat Channel)를 암묵적으로 전제
  - 관련 plan: `plan/in-progress/refactor/02-architecture.md` M-8 2단계 항목 — "현행은 5카드(auth 가 WebhookConfigCard 에 병합) — plan 의 6카드(`AuthConfigCard` 분리)는 UI 구조 변경이라 behavior-preserving 추출과 별개 결정(필요 시 planner/UX)"
  - 상세: spec §2.3.1 매트릭스는 Auth Config 를 독립 카드 행으로 정의하나, 현재 구현은 auth 를 WebhookConfigCard 에 병합(5카드). 2단계는 각 카드를 파일로 추출하는 리팩토링인데, "AuthConfigCard 를 분리할지" 여부가 결정되지 않은 상태로 2단계에 진입하면 추출 후 다시 카드를 병합/분리해야 하는 재작업 가능성이 있다.
  - 제안: plan 에 "2단계는 현행 5카드 구조 유지(behavior-preserving) — `AuthConfigCard` 분리는 spec 갱신/UX 결정 이후 별도 PR" 를 명시하거나, planner 에게 spec §2.3.1 의 Auth Config 카드 독립 의도를 확인해 현행 5카드가 spec drift 인지 여부를 판정 요청

### 발견사항 2

- **[INFO]** spec §3 API 표 내 TBD — `POST /api/triggers/:id/auth/rotate-secret` v1.1 항목의 응답 shape·grace 기간·경로 세그먼트가 여전히 미확정(TBD) 상태이나, M-8 2단계는 이 API 를 건드리지 않으므로 직접 충돌은 없음
  - target 위치: `spec/2-navigation/2-trigger-list.md` Rationale R-2 (line 234 근방) — "TBD (미결정): v1.1 rotate 의 응답 shape (신규 secret 평문 반환 vs masked digest), grace 기간 (24h 표준 vs 가변), 경로 세그먼트 (`/auth/` vs `/webhook-auth/`) 는 아직 확정하지 않는다."
  - 관련 plan: `plan/in-progress/refactor/02-architecture.md` M-8 2단계 — "W-1/I-7(impl-prep): `WebhookConfigCard` 에 `hmacSecret` rotate UI 추가 금지(R-2 폐기, R-14 단일경로)"
  - 상세: 2단계 plan 이 R-2 를 "폐기"로 간주하고 hmacSecret rotate UI 추가를 명시 금지하고 있어 TBD 항목과 충돌하지 않는다. 단 spec Rationale R-2 는 v1.1 TBD 로 여전히 살아있어, 추후 `WebhookConfigCard` 관련 작업자가 R-2 를 따르려 할 때 오인할 수 있음.
  - 제안: plan 에 이미 "R-2 폐기, R-14 단일경로"가 명시됐으므로 spec R-2 Rationale 에 "R-14 채택으로 본 v1.1 예약 폐기됨" 주석 추가를 planner 에게 INFO 로 전달 (비차단)

---

## 요약

`spec/2-navigation` 문서군과 `plan/in-progress/refactor/02-architecture.md` M-8 의 정합성을 검토한 결과, 미해결 결정 우회에 해당하는 CRITICAL 항목은 없다. 주된 발견은 M-8 2단계 카드 파일 분리 시 "5카드(현행 구현) vs 6카드(spec §2.3.1 암묵 전제)" 구조 결정이 plan 에 "별개 결정"으로 유보된 채 2단계 착수를 앞두고 있다는 것이다. 이는 2단계 scope 가 behavior-preserving 추출이면 충돌이 없지만, spec 의 Auth Config 카드 분리 의도가 현행 구현과 일치하는지 여부가 불명확하므로 plan 에 명확히 기술해 두는 것이 안전하다(WARNING 수준). R-2 TBD 는 plan 이 이미 폐기 처리한 사항이지만 spec 에 cleanup 이 미반영된 INFO 수준 사안이다.

## 위험도

LOW
