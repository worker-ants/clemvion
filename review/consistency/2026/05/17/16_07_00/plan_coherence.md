### 발견사항

- **[WARNING]** `spec/2-navigation/4-integration.md` 동시 수정 — worktree 경합 가능
  - target 위치: 변경안 #4 (`spec/2-navigation/4-integration.md §11.2` 에 한 줄 추가)
  - 관련 plan: `cafe24-token-expiry-fix-a3b8f1` worktree (branch `worktree-cafe24-token-expiry-fix-a3b8f1`) 가 현재 `spec/2-navigation/4-integration.md` 를 unstaged 상태로 수정 중 (Rationale 절 — `### Cafe24 token 응답의 expires_at 처리 (2026-05-17)` + §6.1 설명 한 줄). 해당 worktree 는 backend 구현 파일(`integration-oauth.service.ts`, `cafe24-api.client.ts`)도 함께 수정 중이며 PR 미제출 상태.
  - 상세: target draft 의 변경안 #4 는 §11.2 (`integration_action_required` 24h 중복 방지) 에 한 줄 추가다. `cafe24-token-expiry-fix-a3b8f1` 의 변경은 §6.1 과 Rationale 절로 행 위치가 다르므로 내용 의미상 충돌은 없지만, 두 worktree 가 동일 파일을 동시에 수정 중이므로 후발 merge 시 conflict 가 발생할 수 있다. target draft 의 영향 점검 표에서 이 worktree 는 인식되지 않았다.
  - 제안: target plan (`spec-draft-notification-dismiss.md`) 의 영향 점검 표에 `cafe24-token-expiry-fix-a3b8f1` worktree 항목을 추가하고, 해당 worktree 의 PR 이 먼저 merge 된 뒤 rebase 로 충돌을 흡수한다는 직렬화 방침을 명시한다. 또는 해당 worktree 가 먼저 PR 을 올리도록 조율한다.

- **[WARNING]** W-48 ("PATCH 패턴 미결") 이 미해결 의사결정 항목인데, target 이 POST 채택을 단방향으로 결정
  - target 위치: §"HTTP 동사 정책" + 변경안 #1-E Rationale `"Dismiss endpoint 의 HTTP 동사 — POST /:id/dismiss 채택 (2026-05-17)"`
  - 관련 plan: `plan/in-progress/20260516-full-review/RESOLUTION.md` 의 "의사결정 보류" 표 `W-44 / W-47 / W-48` — `"API 계약 변경 (controller 단 IDOR 보강, throttle, PATCH 패턴) — 호환성·spec 동시 갱신 필요"` 로 보류 중
  - 상세: W-48 은 `PATCH /notifications/:id/read` 의 패턴 결정이 "호환성·spec 동시 갱신 필요" 상태로 명시적으로 보류된 미해결 결정이다. target draft 는 그 보류 사실을 인지하고 "W-48 의 향후 PATCH 결정이 확정되기 전 더 보수적" 이라는 논거로 POST 를 채택했으나, 이는 W-48 결정 자체를 합의 없이 우회한 셈이다. POST 액션 endpoint 채택 자체가 틀린 것은 아니지만, W-48 의 "PATCH 패턴 결정 필요" 라는 미결 항목이 dismiss endpoint 도 포함하는 범위인지 아닌지를 먼저 합의하지 않은 채 별도 endpoint 를 확정하면 향후 W-48 이 PATCH 방향으로 결정됐을 때 dismiss spec 과 어긋날 수 있다. 또한 기존 `PATCH /notifications/:id/read` 자체도 보류 항목인데, 새 dismiss 가 POST 로 굳어지면 read endpoint 와 동사 불일치가 고착된다.
  - 제안: target plan 또는 `RESOLUTION.md` 에 "dismiss endpoint 는 W-48 범위에서 제외" 또는 "W-48 의 결정과 무관하게 POST 액션 endpoint 로 확정" 이라는 합의 항목을 명시한다. 필요하면 사용자에게 W-48 의 적용 범위를 confirm 받은 뒤 진행한다.

- **[WARNING]** `spec-overview-ui-patterns-followup-2026-05-16.md` worktree 미생성 상태에서 `_layout.md` 선점
  - target 위치: 변경안 #3 (`spec/2-navigation/_layout.md §3.1` 갱신)
  - 관련 plan: `plan/in-progress/spec-overview-ui-patterns-followup-2026-05-16.md` — `worktree: TBD` 이며 `_layout.md` 를 수정 대상으로 포함. 아직 worktree 가 생성되지 않음.
  - 상세: target draft 의 영향 점검 표에서 이 plan 을 인식하고 "본 작업이 먼저 진행되고 그쪽이 rebase 흡수" 라고 명시했다. `_layout.md` 는 수정 내용이 전혀 다르기 때문에(dismiss UX vs Inline Alert 패턴 정의) 의미 충돌은 없다. 그러나 해당 plan 이 worktree 를 생성하면 동일 파일을 동시 수정하는 상황이 되며, 두 변경이 같은 §3.1 영역을 건드릴 수 있다(벨 아이콘 동작 설명 추가 vs Inline Alert 패턴 섹션 신설). 경합 발생 시 target 의 dismiss UX 변경이 rebase 과정에서 손실될 위험이 있다.
  - 제안: target spec 반영 커밋 후 `spec-overview-ui-patterns-followup-2026-05-16.md` plan 에 "_layout.md §3.1 의 dismiss UX 내용이 선행 머지됐으므로 rebase 필수" 를 명시한다. 현재 영향 점검 표 설명("rebase 흡수")은 충분하므로 추가 조치는 선택적.

- **[INFO]** WebSocket 동기화 follow-up 이 plan 에 미등록
  - target 위치: 변경안 §4.6 `"WebSocket 동기화 (follow-up)"`, §"의사결정 요약" `"WebSocket emit 확장 — 본 phase 미포함. follow-up."`, §"영향 점검" `"WebSocket multi-device 동기화 — follow-up"`
  - 관련 plan: `plan/in-progress/` 에 WebSocket 동기화 follow-up 을 추적하는 별도 plan 문서 없음
  - 상세: `spec/5-system/6-websocket-protocol.md §4.4` 에 `notification.dismissed` 이벤트 신설이 필요하다고 명시됐으나 별도 plan 으로 분리됐다는 언급만 있을 뿐 아직 plan 문서가 생성되지 않았다. 이 follow-up 이 등록되지 않으면 WebSocket spec 과 구현 간 격차가 추적되지 않을 수 있다.
  - 제안: spec 반영 완료 후 `plan/in-progress/spec-draft-notification-dismiss.md` 의 후속 조치 항목으로 "WebSocket multi-device 동기화 plan 생성" 을 체크박스로 추가하거나, 별도 plan 을 미리 생성해 follow-up 을 명시적으로 추적한다.

- **[INFO]** dismissed row 정기 청소 plan 미등록
  - target 위치: 변경안 §4.5 `"보존 정책"`, §"의사결정 요약" `"dismissed row 정기 청소 — 본 phase 미포함. 누적이 운영 부담될 때 별도 plan."`
  - 관련 plan: 해당 내용을 추적하는 plan 문서 없음
  - 상세: dismissed row 누적이 운영 부담이 될 때 별도 plan 을 추진한다고 언급됐으나 plan 등록 자체는 이번 draft 범위 외다. 현 시점에서는 단순 메모 수준.
  - 제안: `0-unimplemented-overview.md` 또는 `spec-draft-notification-dismiss.md` 의 후속 항목으로 간단히 기록해 추후 검색 가능하게 하면 충분.

### 요약

target `spec-draft-notification-dismiss.md` 는 일반적으로 잘 구성된 draft 로, consistency-check r1 결과를 반영해 HTTP 동사를 DELETE → POST 로 변경한 경위도 명확히 기록됐다. Plan 정합성 관점에서의 주요 위험은 두 가지다. 첫째, `cafe24-token-expiry-fix-a3b8f1` worktree 가 `spec/2-navigation/4-integration.md` 를 unstaged 상태로 동시 수정 중인데 영향 점검 표에 반영되지 않았다(WARNING). 둘째, 미결 의사결정 W-48("PATCH 패턴") 의 범위 정의 없이 dismiss endpoint 를 POST 로 단방향 확정했는데, 이 결정이 W-48 합의 범위와 충돌할 경우 나중에 spec 정합 재작업이 필요해진다(WARNING). `_layout.md` 의 `spec-overview-ui-patterns-followup` 경합은 인식됐으나 직렬화 근거가 명시돼 있어 낮은 위험이다. WebSocket follow-up 및 dismissed row 청소 계획은 plan 미등록 상태지만 현 spec draft 진행 자체를 차단할 Critical 수준은 아니다.

### 위험도

MEDIUM
