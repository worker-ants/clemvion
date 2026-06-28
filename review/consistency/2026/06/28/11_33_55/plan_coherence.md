# Plan 정합성 검토 결과

검토 대상: `spec/5-system/12-webhook.md`
참조 plan: `plan/in-progress/spec-sync-webhook-gaps.md`
검토 일시: 2026-06-28

---

## 발견사항

- **[WARNING]** §3.1 표의 "1MB" 약속이 미해결 결정과 불일치 상태를 유지하고 있음
  - target 위치: `spec/5-system/12-webhook.md` §3.1 표 "요청 본문 최대 크기 | 1MB" (line 182)
  - 관련 plan: `plan/in-progress/spec-sync-webhook-gaps.md` 항목 2 ("1MB 본문 크기 통일 임계", `[ ]` 미완료) + §"결정 옵션 (2026-06-13)" — 옵션 A/B/C 중 최종 결정이 아직 사용자에게 위임된 상태
  - 상세: plan §결정 옵션 은 A(전역 1MB), B(현행 32KB/express 기본 정본화), C(공개 32KB / 인증 1MB 분리) 세 가지를 열거하고 "권장안 C" 를 제안하지만 사용자 확정 기록이 없다. 그럼에도 target §3.1 표는 "1MB" 단일값을 그대로 유지 중이고 WH-NF-02·§8 은 "(Planned)" 로 솔직히 기술 중이다. 이 내부 불일치(§3.1 표 vs WH-NF-02/§8) 자체가 plan 이 아직 해소하지 못한 결정의 흔적이며, §3.1 표가 결정 A/B/C 중 어느 것을 사전 채택한 것처럼 읽힐 수 있다.
  - 제안: plan §결정 옵션을 사용자와 확정(A/B/C 중 하나)한 뒤 target §3.1 표·WH-NF-02·§8 을 단일 진실로 동기화한다. 결정 전까지 §3.1 표의 "1MB" 를 "결정 전 Planned — plan/in-progress/spec-sync-webhook-gaps.md §결정 옵션" 으로 명시 보정하거나, plan 에 "§3.1 표는 결정 A 방향의 초안" 임을 명기하면 혼란이 줄어든다.

- **[INFO]** §5.2 "목표(Planned)" 필드별 사유 노출 구현 항목이 plan 미완료 상태이며 target 에 이중 기술(현행 / 목표)로 처리됨
  - target 위치: `spec/5-system/12-webhook.md` §5.2 "현행(implemented)" 및 "목표(Planned)" 블록
  - 관련 plan: `plan/in-progress/spec-sync-webhook-gaps.md` 항목 1 ("400 검증 실패 필드 목록 surface", `[ ]` 미완료)
  - 상세: target 은 현행 봉투(`error.details[]` 미포함)와 목표 봉투(`error.details[]` 포함)를 모두 기술하며 plan 을 cross-link 해 정직하게 Planned 표시 중이다. 충돌은 없고, plan 과 spec 이 일치하게 관리되고 있다. 단, 구현이 완료되면 target §5.2 의 현행/목표 이중 구조를 단일 기술로 정리하고 plan 체크박스를 닫아야 한다.
  - 제안: 구현 완료 시 target §5.2 "현행" 블록을 제거하고 plan 항목 1을 닫는다(후속 조치 메모 수준).

---

## 요약

`spec/5-system/12-webhook.md` 와 `plan/in-progress/spec-sync-webhook-gaps.md` 의 정합성은 전반적으로 양호하다. target 은 미구현 항목(WH-NF-02 본문 크기·WH-EP-05-2 details 노출)을 모두 "(Planned)" 로 명시하고 plan 을 cross-link 하여 의도적으로 불완전 상태를 투명하게 표기하고 있다. 다만 §3.1 API 표의 "요청 본문 최대 크기 | 1MB" 셀이 plan 에서 아직 사용자 확정이 나지 않은 A/B/C 결정 중 특정 방향을 사전 채택한 것처럼 읽힌다는 점이 WARNING 수준의 정합 문제다. 미해결 결정이 일방적으로 내려진 것은 아니나(WH-NF-02·§8 에서 "(Planned)" 로 유보 중), §3.1 표와 WH-NF-02/§8 간 내부 불일치가 결정 전에 존재하므로 plan 결정 확정 후 단일화가 필요하다.

---

## 위험도

LOW
