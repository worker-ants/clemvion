# Cross-Spec 일관성 검토 — 알림 dismiss 도입 (B안 spec 단계)

대상 draft: `plan/in-progress/spec-draft-notification-dismiss.md`
검토 일시: 2026-05-17

---

### 발견사항

- **[WARNING]** `spec/1-data-model.md` §2.19 Notification 필드 표 — `dismissed_at` 미등록 상태와 draft 간 불일치
  - target 위치: 변경안 #2-A (§2.19 필드 표 갱신)
  - 충돌 대상: `spec/1-data-model.md` §2.19 Notification (코퍼스 내 현재 본문)
  - 상세: 코퍼스에 포함된 `spec/1-data-model.md` §2.19 Notification 필드 표는 `email_sent_at`, `created_at` 까지만 정의되어 있으며 `dismissed_at` 컬럼이 없다. draft 변경안 #2-A 는 `dismissed_at Timestamp?` 행을 `email_sent_at` 다음에 추가한다고 명시하고 있어 spec 반영 전까지 현행 데이터 모델 spec 과 draft 간 불일치가 존재한다. spec 반영 단계에서 정확한 삽입 위치를 확인해야 한다 — `email_sent_at` 바로 다음, `created_at` 바로 앞이 의도.
  - 제안: spec 반영 시 변경안 #2-A 를 그대로 적용하되 삽입 행 위치를 재확인한다. 이 자체는 draft 의 목적(spec 반영 전 draft) 이므로 설계 모순은 아니나, spec 반영 후 §2.19 가 최신 상태임을 확인 필요.

- **[WARNING]** `spec/1-data-model.md` §3 인덱스 전략 — Notification 인덱스 2행이 partial index 미반영
  - target 위치: 변경안 #2-B (§3 인덱스 갱신)
  - 충돌 대상: `spec/1-data-model.md` §3 인덱스 전략 표 (코퍼스 내 현재 본문)
  - 상세: 현재 §3 의 Notification 인덱스는 두 개다 — `(user_id, is_read, created_at DESC)` 와 `(workspace_id, created_at DESC)`. draft 변경안 #2-B 는 첫 번째 인덱스를 `(user_id, is_read, created_at DESC) WHERE dismissed_at IS NULL` 로 갱신한다. 두 번째 인덱스 `(workspace_id, created_at DESC)` 에 대한 갱신 여부는 draft 에서 명시하지 않는다. spec/data-flow/8-notifications.md 의 변경안 #1-B 에서는 `(workspace_id, created_at DESC)` 를 그대로 유지한다고 서술하므로 `dismissed_at IS NULL` 필터 적용 없이 두 인덱스 정책이 달라진다. 이는 의도된 설계(워크스페이스 단위 조회는 dismissed 포함)인지 명시적 확인이 필요하다.
  - 제안: §3 인덱스 표 갱신 시 `(workspace_id, created_at DESC)` 는 dismissed 포함 전체 조회 용도임을 설명 컬럼에 명시해 두 인덱스의 필터 정책 차이를 명확히 기술한다.

- **[WARNING]** 상태 전이 다이어그램 — `Dismissed → [*]` 종결 표기의 해석 차이 가능성
  - target 위치: 변경안 #1-C §3 stateDiagram-v2
  - 충돌 대상: `spec/1-data-model.md` §2.19 `is_read` 정의 / draft §4.1 차원 분리 표
  - 상세: 신규 다이어그램은 `Dismissed → [*]` 로 표기해 Dismissed 를 최종 종결 상태로 나타낸다. 그러나 draft §4.1 의 차원 분리 표에서 `(unread, dismissed)` 조합이 존재함을 인정하고 있다 — "안 읽었지만 닫기". 이 경우 `is_read=false && dismissed_at IS NOT NULL` 인 row 는 다이어그램의 `Unread → Dismissed` 경로를 통해 도달하는 올바른 상태다. 다이어그램 자체는 동작상 오류가 없으나, `Dismissed` 상태가 내부적으로 `is_read` 값과 무관하게 두 변형(`(unread, dismissed)`, `(read, dismissed)`)을 포함한다는 점이 다이어그램만으로는 드러나지 않는다. "읽음과 닫기는 별개 차원"이라는 핵심 설계 의도가 단일 차원 상태머신으로만 표현되면 추후 오해의 소지가 있다.
  - 제안: 다이어그램 바로 아래 또는 §4.1 차원 분리 표와 교차 참조 문장을 추가해, 다이어그램이 `dismissed_at` 차원만 추적하며 `is_read` 는 별개 차원임을 명시한다.

- **[INFO]** `spec/2-navigation/_layout.md` §3.1 — `visible` 어휘 일관성
  - target 위치: 변경안 #3 (§3.1 벨 아이콘 설명 갱신)
  - 충돌 대상: `spec/0-overview.md` §3.4 상태 표시 패턴 (Badge/Tag: Active/Inactive)
  - 상세: draft 는 dismiss 차원의 활성 상태를 `visible` 로 일관 표기하고 `active` 어휘를 회피하는 결정을 명시했다 (`Workflow.is_active`, `Trigger.is_active`, `Schedule.is_active` 등과 충돌 방지). 변경안 #3 의 _layout.md 갱신 문구는 `visible 미읽은 알림 수 뱃지 표시` 로 이 규칙을 따르고 있어 충돌은 없다. 다만 `spec/0-overview.md` §3.4 의 "Active(초록) / Inactive(회색)" 뱃지 패턴 용어는 UI 상태 표시 패턴 문서이며 Notification 의 `visible`/`dismissed` 와는 다른 레이어의 어휘임을 혼동하지 않도록 알림 관련 문서들이 일관되게 `visible`/`dismissed` 를 사용하면 된다.
  - 제안: 별도 조치 불필요. 단, 향후 알림 관련 UI 구현 시 "Active/Inactive" 뱃지 어휘를 Notification 상태 표시에 사용하지 않도록 developer 단계에서 주의 필요.

- **[INFO]** `spec/2-navigation/4-integration.md` §11.2 — `hasRecentByResource` dismissed 포함 정책의 단방향 기술
  - target 위치: 변경안 #4 (§11.2 단락 추가)
  - 충돌 대상: `spec/data-flow/8-notifications.md` §4.4 (draft 신규 추가 절)
  - 상세: 변경안 #4 는 `4-integration.md` §11.2 에 "dismissed row 도 카운트에 포함된다" 를 한 줄로 추가한다. draft §4.4 와 §1-E Rationale 이 동일 내용을 더 상세히 설명하므로 두 문서 간 내용의 깊이 차이가 있다. 충돌은 아니지만 §11.2 의 한 줄이 §4.4 를 `[link]` 로 참조하고 있어 교차 참조가 올바르게 연결되면 일관성은 유지된다.
  - 제안: 변경안 #4 의 링크 앵커(`#44-중복-방지-hasrecentbyresource-와의-관계`)가 spec 반영 후 실제 헤더와 정확히 일치하는지 확인한다. 마크다운 헤더 `### 4.4 중복 방지 (` 는 앵커 생성 규칙에 따라 공백과 괄호 처리가 상이할 수 있다.

- **[INFO]** `spec/5-system/6-websocket-protocol.md` §4.4 — follow-up 이벤트 이름 선점 충돌 가능성 예방
  - target 위치: 변경안 #1-D §4.6 "WebSocket 동기화 (follow-up)"
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md` §4.4 (코퍼스 미포함, draft §4.6 에서 언급)
  - 상세: draft 는 follow-up phase 에서 `notification.read` / `notification.dismissed` 이벤트를 `6-websocket-protocol.md §4.4` 에 신설할 것을 §4.6 에 명시했다. 현재 phase 에서 해당 spec 을 수정하지 않으므로 직접 충돌은 없다. 그러나 follow-up 전에 WebSocket protocol 영역에서 §4.4 에 다른 이벤트가 추가될 경우 이름이 중복될 수 있다.
  - 제안: follow-up plan 항목에 `6-websocket-protocol.md §4.4` 의 기존 이벤트 이름 목록을 확인하고 `notification.dismissed` 이벤트 이름이 충돌하지 않는지 점검하는 단계를 추가한다. 현재 phase 의 차단 요인은 아님.

---

### 요약

Target draft(알림 dismiss B안)는 수정 대상 4개 spec 파일 간의 내부 일관성이 전반적으로 잘 유지된다. `dismissed_at` soft delete 채택, `visible`/`dismissed` 어휘 통일, `POST` 액션 endpoint 패턴 적용, `hasRecentByResource` dismissed row 포함 정책 등 핵심 의사결정이 draft 전 영역에 걸쳐 일관되게 적용되어 있다. 다른 spec 영역(`spec/0-overview.md`, `spec/2-navigation/1-workflow-list.md`, 인증 관련 spec 등)과의 직접적인 데이터 모델 또는 API 계약 충돌은 발견되지 않았다. 발견된 WARNING 2건은 spec 반영 시 인덱스 정책 설명의 명확화와 상태 다이어그램의 보조 설명 추가로 해소 가능하다. 설계 모순으로 인해 두 영역 중 하나가 작동 불가해지는 CRITICAL 수준의 충돌은 없다.

---

### 위험도

LOW
