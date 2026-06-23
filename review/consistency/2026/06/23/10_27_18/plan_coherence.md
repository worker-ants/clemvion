# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 (--impl-done, scope=spec/2-navigation, diff-base=origin/main)
Target 문서: `spec/2-navigation`
검토 기준 plan: `plan/in-progress/refactor/02-architecture.md` (M-8)

---

## 발견사항

### 발견사항 1

- **[INFO]** `--impl-prep` W-1 "6카드 vs 5카드" 결정 — plan 에 명시 완료, 충돌 없음
  - target 위치: `spec/2-navigation/2-trigger-list.md §2.3.1 필드 권한 매트릭스`
  - 관련 plan: `plan/in-progress/refactor/02-architecture.md` M-8 2단계 — "유의(유지): 현행 5카드(auth 가 WebhookConfigCard 병합) behavior-preserving 유지 — plan 의 6카드(`AuthConfigCard` 분리)는 UI 구조 변경이라 별도 결정(planner/UX, impl-prep W-1)."
  - 상세: `--impl-prep` 단계에서 WARNING 으로 제기됐던 "5카드 vs 6카드 미결 상태에서 2단계 착수" 우려는 plan 이 2단계 완료 기록 안에 "현행 5카드 behavior-preserving 유지" 를 명시함으로써 해소됐다. spec §2.3.1 의 Auth Config 독립 카드 행은 여전히 spec drift 상태로 잔존하나, 이는 plan 이 "별도 결정(planner/UX)" 으로 이관한 사항이라 M-8 2단계 구현 자체가 미해결 결정을 우회하지 않는다. 현재 구현과 spec 의 5/6카드 gap 은 별도 spec 갱신 또는 후속 PR 대기 상태임.
  - 제안: 추적 메모 수준 — spec `2-trigger-list.md §2.3.1` 의 Auth Config 독립 카드 행이 현 구현(5카드, auth-in-webhook 병합)과 일치하는지 여부를 project-planner 가 명시적으로 확정 후 spec 에 반영하면 깔끔하다. 비차단.

### 발견사항 2

- **[INFO]** spec `2-trigger-list.md` Rationale R-2 "TBD(v1.1 rotate-secret)" 잔존 — M-8 2단계는 이 항목을 건드리지 않음
  - target 위치: `spec/2-navigation/2-trigger-list.md` Rationale R-2 (line 234) — "TBD(미결정): v1.1 rotate 의 응답 shape, grace 기간, 경로 세그먼트 확정하지 않는다"
  - 관련 plan: `plan/in-progress/refactor/02-architecture.md` M-8 2단계 "유의(유지): `hmacSecret` rotate UI 추가 금지(R-2 폐기, R-14 단일경로)"
  - 상세: plan 이 R-2 를 "폐기"로 처리하고 R-14(AuthConfig 단일경로)를 채택했으나, spec Rationale R-2 는 여전히 TBD 텍스트를 유지하고 있다. `spec/2-navigation/2-trigger-list.md §3 API 표` 각주는 "과거 v1.1 예약 행 `POST /api/triggers/:id/auth/rotate-secret` 은 신설되지 않은 채 본 PR 에서 폐기됐다 (Rationale R-14)" 로 R-14 채택을 이미 서술하고 있어 §3 수준에서는 정합하다. 단 Rationale R-2 본문의 TBD 구절이 spec-cleanup 되지 않아 추후 작업자가 혼동할 여지가 있다.
  - 제안: spec Rationale R-2 에 "R-14 채택으로 v1.1 예약 폐기됨 — TBD 항목 소멸" 주석 추가를 planner 에게 INFO 로 전달. 비차단.

---

## 요약

M-8 2단계 구현 완료 후 `spec/2-navigation` 과 `plan/in-progress/refactor/02-architecture.md` 의 정합성을 검토한 결과, CRITICAL 및 WARNING 항목이 없다. `--impl-prep` 에서 WARNING 으로 제기됐던 "5카드 vs 6카드 미결 상태" 우려는 plan 에 "현행 5카드 behavior-preserving 유지 — AuthConfigCard 분리는 별도 결정(planner/UX)" 이 명시됨으로써 해소됐다. 미해결 결정 우회나 선행 plan 미해소는 발견되지 않았다. 잔여는 spec Rationale R-2 TBD 구절 cleanup(INFO)과 Auth Config 5/6카드 gap 의 spec 명시(INFO) 두 건으로, 모두 비차단이다.

## 위험도

NONE
