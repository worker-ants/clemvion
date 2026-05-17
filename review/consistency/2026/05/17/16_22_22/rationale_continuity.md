# Rationale 연속성 검토 결과

검토 범위: `spec/data-flow/` 전체 (0-overview, 1-audit, 2-auth, 3-execution, 4-file-storage, 5-integration, 6-knowledge-base, 10-triggers, 11-workflow, 12-workspace)
검토 모드: --impl-prep (구현 착수 전)

---

### 발견사항

- **[INFO]** `spec/data-flow/3-execution.md` 의 `Noti` 참조가 Background 실패 알림 경로를 암묵적으로 정의함
  - target 위치: `spec/data-flow/3-execution.md` §1.2 시퀀스 다이어그램 (`alt 본문 실패 AND config.notifyOnFailure → Eng→Noti: notify background_failed`)
  - 과거 결정 출처: `spec/data-flow/5-integration.md` Rationale "refresh 실패 시 status_reason 통일" — `error(*)` 전이는 "별도 알림 없이 UI 배지로만 통지. 향후 별도 알림 타입 필요 시 `integration_action_required` 등 신설 검토"
  - 상세: execution 도메인의 `background_failed` 알림은 Notifications 도메인 연동을 전제하는 다이어그램 표현이다. 5-integration Rationale 이 `error(*)` 상태 전이 시 알림을 명시적으로 미발사로 정책화한 것과 구조적으로 다른 도메인이라 직접 충돌은 아니지만, `NotificationsService` 호출의 알림 발사 정책이 데이터-플로우 문서에서 다이어그램 한 줄로 표기되고 Rationale 설명이 없다.
  - 제안: `spec/data-flow/3-execution.md` Rationale 에 "`background_failed` 알림 발사 조건 (`config.notifyOnFailure = true`)" 을 짧게 명문화해, Integration 도메인의 알림 정책(미발사)과의 의도적 차이임을 기록한다.

- **[INFO]** `spec/data-flow/5-integration.md` 의 `cafe24-token-refresh` 큐가 BullMQ 큐 카탈로그(`spec/data-flow/0-overview.md §4`)에 미등록
  - target 위치: `spec/data-flow/5-integration.md` §2.2 Redis 표 (`cafe24-token-refresh (2026-05-16 신규)`)
  - 과거 결정 출처: `spec/data-flow/0-overview.md §4 BullMQ 큐 카탈로그` — "큐가 늘어나면 본 표와 해당 도메인 spec 의 `외부 의존` 섹션 모두 갱신한다."
  - 상세: 0-overview §4 의 큐 카탈로그는 `background-execution`, `document-embedding`, `graph-extraction`, `schedule-execution`, `alerts-evaluator`, `integration-expiry` 6개만 등록되어 있고, 2026-05-16 에 신설된 `cafe24-token-refresh` 큐가 빠져 있다. Rationale 에 "큐 카탈로그 동기화" 의무를 명시했음에도 해당 의무를 이행하지 않은 상태다.
  - 제안: `spec/data-flow/0-overview.md §4` 표에 `cafe24-token-refresh | Cafe24Module | Cafe24ApiClient (proactive) + cafe24-background-refresh-daily | Cafe24TokenRefreshProcessor | cafe24 통합 1건 refresh (jobId dedup)` 행을 추가한다.

- **[INFO]** `spec/data-flow/5-integration.md` §1.4 다이어그램에 `connected-expiry` job 의 notify 경로 누락
  - target 위치: `spec/data-flow/5-integration.md` §1.4 시퀀스 다이어그램 내 `connected-expiry` 분기
  - 과거 결정 출처: `spec/data-flow/5-integration.md` Rationale "refresh 실패 시 status_reason 통일" — "알림 정책: `integration_expired` 알림은 `expired` 전이 중에서도 `token_expired` 경로에만 발사"
  - 상세: 다이어그램에서 `refresh_token 없음` → `expired(token_expired)` 경로에 `Scan→Noti: notify integration_expired` 가 표기되어 있으나, `refresh 성공`, `invalid_grant → error(auth_failed)`, `transport fail → error(network)` 경로에는 Noti 호출이 없다. 이는 Rationale "알림 정책" 기술과 일치한다. 다만 다이어그램만 보면 `error(*)` 전이 시 알림이 없는 이유가 불분명하다.
  - 제안: 다이어그램 노트 또는 Rationale 의 "refresh 실패 시 status_reason 통일" 항에 "error(*) 전이 시 알림 미발사 — UI 배지 통지만" 한 줄을 추가해 다이어그램 상에서도 의도가 명확히 보이도록 한다.

- **[INFO]** `spec/data-flow/5-integration.md` Rationale "Cafe24 별도 승인 scope 의 식별·안내 (2026-05-17)" 항목이 파일 말미에 잘려 미완성
  - target 위치: `spec/data-flow/5-integration.md` (혹은 prompt 파일 내 발췌본) 마지막 섹션
  - 과거 결정 출처: 해당 섹션 자체가 본 검토의 대상
  - 상세: 발췌 파일의 2435행에서 "UI 4 화면 (위저드 §3.2 / 통합 상세 §4" 까지만 기재되어 Rationale 본문이 끊겼다. prompt 파일의 size limit 절단 때문이지만, spec 문서 자체가 해당 결정을 완전히 기술하지 않았을 가능성도 있다.
  - 제안: `spec/data-flow/5-integration.md` 의 해당 Rationale 항목이 실제 파일에서도 절단되어 있는지 확인하고, 미완 상태라면 "Cafe24 restrictedApproval 필드 노출·UI 4화면 안내 정책" 결론을 Rationale 에 완성한다.

---

### 요약

`spec/data-flow/` 전체를 기존 Rationale 에 비추어 검토한 결과, 명시적으로 기각된 대안을 재도입하거나 합의된 설계 원칙을 직접 위반하는 항목은 발견되지 않았다. target 문서는 각 도메인의 과거 결정(execution_path DROP, BullMQ vs Redis pub/sub 분리, integration status machine 갱신, install_token persistent 격상, mall_id 평문 컬럼 분리, HMAC raw-value 보존 재정정 등)을 일관되게 반영하고 있으며, 번복이 있는 경우에도 Rationale 에 갱신 이유가 기술되어 있다. 다만 세 가지 Rationale 정합 보완 사항이 있다: (1) 2026-05-16 신설된 `cafe24-token-refresh` 큐가 0-overview 의 BullMQ 카탈로그에 미등록되어 "큐가 늘어나면 반드시 갱신" 의무 위반 상태, (2) execution 도메인의 `background_failed` 알림 발사 조건이 Rationale 에 설명 없이 다이어그램에만 표기, (3) integration §1.4 다이어그램에서 `error(*)` 전이 시 알림 미발사 이유가 코드·다이어그램 연결 없이 Rationale 텍스트에만 존재한다. 이 세 항목은 구현 착수 전에 정비하면 오해 없이 구현이 진행될 수 있다.

### 위험도

LOW
