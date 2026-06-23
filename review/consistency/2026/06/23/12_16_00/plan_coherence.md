## 발견사항

- **[INFO]** spec/2-navigation/1-workflow-list.md 의 미구현 항목이 target spec 에 명확히 표기됨
  - target 위치: `spec/2-navigation/1-workflow-list.md` §2.3 (태그 필터 UI, 폴더 필터 UI) / §2.7 (빈 상태 마켓플레이스 링크)
  - 관련 plan: `plan/in-progress/spec-sync-workflow-list-gaps.md` 라인 20~22 — 3개 미완료 `[ ]` 항목
  - 상세: target spec 이 "미구현 (Planned)" 으로 명시한 3건(태그 필터 UI / 폴더 필터 UI / 마켓플레이스 빈 상태 링크)은 plan 에도 미완료로 열려있다. target 이 이 결정을 일방적으로 뒤집거나 완료 처리하지 않았으므로 충돌 없음. 단, 현재 impl-prep 착수 시 이 3건이 여전히 미구현임을 인지해야 한다.
  - 제안: 현 검토 scope(impl-prep) 에서 조치 불필요. 추적 목적의 메모.

- **[INFO]** `spec/2-navigation/2-trigger-list.md` 관련 M-8 plan 이 완료됐으나 planner 후속 항목이 열려있음
  - target 위치: `spec/2-navigation/2-trigger-list.md` 전반 (trigger-detail-drawer 와 연관)
  - 관련 plan: `plan/in-progress/refactor/02-architecture.md` §M-8 2단계 내 `**후속(별건, M-8 외)**` 항목 — `useCreateTriggerForm`+Create Dialog 추출 / 뷰모델 매핑 `lib/mappers` / `TriggerDetail`→`TriggerDetailView` 개칭 / `delete-dialog onDeleted?` 콜백 등 4건 미완료. 또한 §m-1 planner 후속: `INTEGRATION_INVALID_SERVICE(400)` 를 `spec/2-navigation/4-integration.md §9.4`·`spec/conventions/error-codes.md` 에 등재 미완료.
  - 상세: M-8 구현(1·2단계)은 완료됐고 target spec 에 직접 충돌하는 미해결 결정은 없다. 후속 항목은 planner 트랙(spec 편집)이거나 별건 refactor 로, 현 impl-prep 가 착수하는 구현 범위와 직교한다.
  - 제안: 조치 불필요. M-8 후속 및 planner 후속은 별도 PR/플래너 위임으로 처리한다.

- **[INFO]** `plan/in-progress/spec-sync-structural-followups.md` 의 `spec/2-navigation` cross-ref 항목이 미착수 상태
  - target 위치: `spec/2-navigation/` 전반 (data-flow/9-observability → `spec/2-navigation/15-system-status` 참조, `/docs` 단일언어 cross-ref 점검)
  - 관련 plan: `plan/in-progress/spec-sync-structural-followups.md` 라인 26~27 — `data-flow/9-observability` 정리 미완 / `/docs` 단일언어 cross-ref 점검 미완
  - 상세: 이 두 항목은 현재 target(`spec/2-navigation` 전체 스펙 열람)과 **직접 충돌하지 않는다** — 단 관련 spec 이 수정될 경우 해당 cross-ref 가 유효한지 후속 확인이 필요할 수 있다. 현 impl-prep 가 target spec 을 수정하는 작업이 아니라 읽기/검토 범위라면 무관하다.
  - 제안: 현 impl-prep 에서 조치 불필요. target 범위가 spec 수정을 포함하면 structural-followups 의 cross-ref 항목도 점검한다.

- **[INFO]** `trigger-review-deferred-fixes.md` W1 (endpoint_path 서버 강제 발급)이 미착수
  - target 위치: `spec/2-navigation/2-trigger-list.md` §3 (webhook endpoint API / endpoint_path 생성 계약)
  - 관련 plan: `plan/in-progress/trigger-review-deferred-fixes.md` 라인 12 — W1: `endpoint_path` 클라이언트 생성 vs 서버 강제 발급 결정 미완
  - 상세: target spec(`2-trigger-list.md`)이 `endpoint_path` 생성 주체(클라이언트/서버)를 명시적으로 결정한 상태인지 확인 필요. plan 은 아직 "서버 강제 발급 또는 DTO `@IsUUID(4)` 검증" 중 하나를 결정하지 않은 상태다. target spec 이 현재 어느 한 쪽을 기정사실로 기술한다면 plan 의 미해결 결정을 우회하는 셈이 된다.
  - 제안: target spec(`2-trigger-list.md`)의 `endpoint_path` 생성 계약 서술을 확인하고, plan W1 의 결정 방향과 일치하는지 대조한다. 불일치 시 spec 을 `결정 필요` 로 표기하거나 plan W1 을 해소한 뒤 spec 을 갱신해야 한다.

## 요약

`spec/2-navigation` 대상 impl-prep 검토에서 plan 과의 CRITICAL 충돌(미해결 결정 우회)은 발견되지 않았다. 주요 미완료 항목은 모두 spec 에 "미구현 (Planned)" 또는 "별도 PR" 로 명시되어 있어 target 이 이를 일방적으로 완료 처리하거나 우회하지 않는다. 단 `trigger-review-deferred-fixes.md` W1(`endpoint_path` 클라이언트 생성 vs 서버 강제 발급 결정 미완)이 `spec/2-navigation/2-trigger-list.md` 의 관련 서술과 불일치할 가능성이 있으므로, 해당 spec 의 계약 기술 방식을 착수 전 교차 확인할 것을 권장한다.

## 위험도
LOW

STATUS: OK
