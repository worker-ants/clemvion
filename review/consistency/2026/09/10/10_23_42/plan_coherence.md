# Plan 정합성 검토 — `spec-draft-doc-precision-batch-c.md`

## 발견사항

- **[WARNING]** C-2 가 완료하는 후속 항목이 다른 in-progress plan 에 별도로 살아있어, 그 plan 이 stale 해진다
  - target 위치: `plan/in-progress/spec-draft-doc-precision-batch-c.md` C-2 (`1-data-model.md §2.8` 저장 형태 명시)
  - 관련 plan: `plan/in-progress/spec-draft-notification-secret-storage.md` (status: in-progress, priority: P1) §「후속 (이 PR 밖)」의 마지막 bullet — *"`1-data-model.md §2.8` 의 `notification_secret_v2` 행에 저장 형태 한 줄 (INFO#2)."*
  - 상세: C-2 가 집행하는 실제 SoT 항목은 `plan/in-progress/spec-draft-nullable-notation-followups.md:1301-1305` (`- [ ]` 미해결)이고, target 은 이 파일의 체크박스만 플립할 계획이다(체크리스트: *"자매 트래커 체크박스 5건 플립"*). 그런데 **같은 날짜(2026-09-05)·같은 INFO#2 근거로 등재된 동일 항목이 `spec-draft-notification-secret-storage.md` 자신의 후속 목록에도 별도로 남아 있다.** 두 plan 을 직접 열어 대조한 결과, 두 파일의 서술은 실제로 같은 작업(같은 필드·같은 절·같은 저장 형태 사실)을 가리킨다 — 우발적 중복이 아니라 같은 planner 턴이 한쪽에는 실행 항목으로, 다른 쪽에는 로컬 메모로 남긴 것으로 보인다. target 이 `spec-draft-nullable-notation-followups.md` 만 갱신하고 `spec-draft-notification-secret-storage.md` 를 손대지 않으면, 후자는 이미 끝난 일을 "아직 안 됨"으로 계속 주장하게 된다 — 이 저장소가 반복해서 비용을 치른 "stale plan claim" 형태 그대로다. 부수: `spec-draft-notification-secret-storage.md` 의 나머지 미해결 항목은 `4-integration.md §9.1` 포인터(브랜치 머지 대기, `spec-draft-nullable-notation-followups.md:1294`에도 동일 항목 존재) 하나뿐이라, C-2 가 반영되면 이 plan 은 **자체 소유 작업이 0건**이 되어 `plan/complete/` 이관 후보가 된다 — target 은 이 lifecycle 신호도 다루지 않는다.
  - 제안: C-2 실행 시(또는 이 draft 의 체크리스트에) `spec-draft-notification-secret-storage.md` 의 해당 bullet 도 취소선/완료 표시로 동기화하는 항목을 추가한다. 두 plan 이 같은 항목을 서로 다른 이름으로 들고 있는 구조 자체가 재발 소지이므로, 완료 후 `spec-draft-notification-secret-storage.md` 를 `plan/complete/` 로 옮길지도 그 자리에서 판정한다.

## 요약

target 의 C-1·C-3·C-4·C-5 는 각각 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 미해결 체크박스(각각 758·774·1307·788 행)와 정확히 대응하며, 실측(파일 존재·anchor 텍스트·frontmatter `code:` 목록·spec 본문 인용) 을 직접 대조한 결과 전제·인용·범위 확장 근거 모두 현재 저장소 상태와 합치했다 — 특히 C-4 의 "1개 → 6개" 확장은 정본 게이트(`review_guard._spec_linked_changes()`) 를 다시 물어 확인 가능한 형태로 남겨 뒀고, `production-build-devdep*` 를 억지로 소유시키지 않고 별도 트래커 항목으로 미루는 판단도 `spec-impl-evidence.md §2.1` 의 실제 적용 범위(정반대 축 미포함)와 부합한다. 미해결 결정을 일방적으로 뒤집는 CRITICAL 급 충돌은 발견되지 않았다. 다만 C-2 는 `spec-draft-nullable-notation-followups.md` 뿐 아니라 그 항목을 독자적으로도 들고 있는 `spec-draft-notification-secret-storage.md` 를 갱신하지 않아, 후자가 완료된 작업을 계속 미완으로 주장하는 stale plan 을 만든다 — WARNING 하나로 plan 갱신이 필요하다.

## 위험도

LOW
