### 발견사항

- **[WARNING]** `notification-websocket-name-sync.md` plan 이 target 변경을 반영하지 않아 추적 불일치 발생
  - target 위치: `spec/data-flow/8-notifications.md` Rationale 섹션 "WebSocket emit 표기 정정 — `notification.new` + `notifications:<userId>`" (파일 끝부분, 워크트리 기준 라인 318–329)
  - 관련 plan: `plan/in-progress/notification-websocket-name-sync.md` — 전체 체크리스트 (작업 범위 § 체크박스 6개 모두 `[ ]`)
  - 상세: target 문서(워크트리 내 `spec/data-flow/8-notifications.md`)는 이미 콜론 표기(`notification:new`, `user:<userId>`) → 점 표기(`notification.new`, `notifications:<userId>`) 정정을 적용하고, Rationale 에 "관련 일관성 검토 C-1·C-2 가 본 개정으로 해소" 라고 명시한다. 그러나 `notification-websocket-name-sync.md` plan 은 (a) `worktree: TBD` — 실제로는 `notification-websocket-name-sync-1a2b3c` 워크트리가 존재, (b) "새 worktree 생성" 포함 작업 범위 체크박스 6개가 모두 미완(`[ ]`), (c) "`spec/data-flow/8-notifications.md` 와 `spec/5-system/6-websocket-protocol.md §4.4` 를 코드 진실 기준으로 일치시킨다" 항목 역시 미체크 상태다. 결과적으로 plan 은 아직 "시작 전" 을 가리키지만 실제 spec 변경은 워크트리 안에서 이미 완료된 상태여서, plan 과 현실 사이에 추적 불일치가 생겼다.
  - 제안: `notification-websocket-name-sync.md` plan 을 다음과 같이 갱신한다. ① frontmatter `worktree: notification-websocket-name-sync-1a2b3c` 로 정정. ② "새 worktree 생성" 체크박스를 `[x]` 로 체크. ③ "`spec/data-flow/8-notifications.md` … 일치시킨다" 체크박스를 `[x]` 로 체크하고, "두 spec 모두 같은 구분자로 통일" 항목도 마찬가지로 체크. ④ `spec/5-system/6-websocket-protocol.md §4.4` 확인 체크박스는 실제 완료 여부에 따라 처리. ⑤ `notification.read` / `notification.dismissed` 신설 결정을 spec 에 명시했다면 해당 체크박스도 체크. ⑥ `consistency-check --spec 후 PR` 체크박스는 현 세션(본 consistency-check) 통과 후 PR 시 처리.

- **[INFO]** plan 의 선행 조건(`notification-actions-8806b6` PR merge 이후 시작 권장)이 이미 해소됐는지 확인 필요
  - target 위치: target 문서 Rationale "WebSocket emit 표기 정정" 절 — 2026-05-18 날짜로 개정 기록됨
  - 관련 plan: `plan/in-progress/notification-websocket-name-sync.md` §의존성 — "`notification-actions-8806b6` (dismiss endpoint 구현) 의 PR merge 이후 시작 권장"
  - 상세: target 문서 자체가 dismiss 관련 내용(§4 전체)을 포함하고 있고, 워크트리 diff 를 보면 §1·§2.2 의 WebSocket 표기 정정이 이미 적용된 상태다. 즉 선행 조건이 충족된 상태에서 본 작업이 착수된 것으로 보이지만, plan 문서에는 이 사실이 기록되지 않아 선행 조건 해소 시점이 불분명하다.
  - 제안: plan §의존성 절에 "`notification-actions-8806b6` PR merge 완료 (2026-05-18 기준 확인)" 라는 짧은 주석을 추가해 사전 조건 해소를 명시적으로 기록한다.

- **[INFO]** `notification-websocket-name-sync.md` plan 의 `notification.read` / `notification.dismissed` 결정 항목이 target 에서 "follow-up phase 에서 검토" 로 남겨진 것과의 관계 확인 필요
  - target 위치: `spec/data-flow/8-notifications.md §4.6` — "같은 사용자의 다른 device 간 read/dismiss 동기화 … follow-up phase 에서 검토하며, 이벤트 이름은 §4.4 기존 `notification.new` prefix 와 일관성을 유지한다"
  - 관련 plan: `plan/in-progress/notification-websocket-name-sync.md` 작업 범위 마지막 항목 — "follow-up 으로 `notification.read` / `notification.dismissed` (또는 콜론 표기) 신설 검토를 본 작업 안에서 함께 결정해 spec 에 명시"
  - 상세: target 문서 §4.6 은 multi-device 동기화 이벤트를 "follow-up phase 에서 검토" 수준으로 남겨 두었고, 이벤트 이름 규약(`notification.read`, `notification.dismissed`)만 선명시했다. plan 은 이 결정을 "본 작업 안에서 함께 결정해 spec 에 명시" 하도록 요구했으므로, 이벤트 이름 규약 명시가 이미 이루어진 것이라면 해당 체크박스를 완료로 표시해야 한다. 이것이 단순 INFO 인 이유는 실제 해소 여부가 불확실할 뿐 충돌이나 우회는 아니기 때문이다.
  - 제안: plan 체크박스를 검토할 때 §4.6 의 이벤트명 규약 명시를 "결정 완료" 로 볼 수 있으면 체크하고, `notification.read` / `notification.dismissed` 의 실제 WebSocket 프로토콜 spec 개정(신설)은 별도 후속 항목으로 남겨 추적한다.

---

### 요약

target 문서(`spec/data-flow/8-notifications.md`) 의 WebSocket emit 표기 정정(콜론→점, `user:<userId>`→`notifications:<userId>`)은 `plan/in-progress/notification-websocket-name-sync.md` 가 정확히 이 목적을 위해 생성된 plan 의 진행 결과물이다. spec 변경 내용 자체는 프로토콜 권위 문서(`6-websocket-protocol.md §4.4`)·코드 실제 등록 prefix(`notifications:`)와 일치하며, 다른 in-progress plan 과 동일 파일을 동시 수정하는 worktree 충돌은 없다. 다만 plan 추적이 현실과 어긋나 있다 — `worktree: TBD`, 체크박스 6개 미체크, 선행 조건 해소 기록 없음. 이는 구현 우회나 미해결 결정 충돌이 아닌 plan 문서 갱신 누락이므로 WARNING 1건으로 분류했다. plan 을 현재 작업 상태에 맞게 갱신(worktree 명, 체크박스 체크, 선행 조건 해소 주석)하면 정합성이 회복된다.

### 위험도

LOW
