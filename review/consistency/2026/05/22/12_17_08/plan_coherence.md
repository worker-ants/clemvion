# Plan 정합성 검토 결과

> 검토 모드: 구현 착수 전 검토 (--impl-prep)
> 대상 scope: `spec/2-navigation/`
> 실제 변경 파일 (main 대비): `spec/2-navigation/2-trigger-list.md`, `spec/2-navigation/_product-overview.md`
> 신규 plan 파일: `plan/in-progress/trigger-list-row-actions.md` (Plan A), `plan/in-progress/trigger-detail-edit-meta.md` (Plan B)

---

## 발견사항

### [WARNING] eia-trigger-edit-ui 와 동일 Drawer 컴포넌트 접점 — 직렬화 필요

- **target 위치**: `plan/in-progress/trigger-detail-edit-meta.md` §의존 항목 + `spec/2-navigation/2-trigger-list.md` §2.3.1 External Interaction 행
- **관련 plan**: `plan/in-progress/eia-trigger-edit-ui.md` (worktree: `eia-trigger-edit-ui-<slug>`, 미할당)
- **상세**: `spec/2-navigation/2-trigger-list.md §2.3.1` 의 "External Interaction (Notification)" 및 "External Interaction (Interaction)" 카드 행은 `별 plan eia-trigger-edit-ui 가 구현`이라고 명시한다. `eia-trigger-edit-ui.md` 는 동일한 `trigger-detail-drawer.tsx` 컴포넌트를 대상으로 EIA 카드 edit UI 를 구현하는 plan 이다. 이와 별도로 본 worktree 의 Plan B (`trigger-detail-edit-meta.md`) 도 `trigger-detail-drawer.tsx` 의 OverviewCard / WebhookConfigCard 에 edit 토글을 추가한다. Plan B 의 frontmatter 에서는 "eia-trigger-edit-ui 가 먼저 머지 후" 직렬화 순서를 명시하고 있어 충돌 인지는 되어 있으나, `eia-trigger-edit-ui` plan 의 실제 worktree 슬러그가 미할당(`eia-trigger-edit-ui-<slug>` 로 placeholder) 상태이므로 어느 worktree 에서 작업 중인지 추적이 불가능하다.
- **제안**: `plan/in-progress/eia-trigger-edit-ui.md` 의 frontmatter `worktree` 필드에 실제 슬러그를 기입하거나, 아직 worktree 가 없다면 착수 전까지 본 Plan B 의 작업을 보류해야 한다. Plan A (page.tsx 만 수정) 는 Drawer 컴포넌트에 접점이 없으므로 병행 진행 가능.

---

### [WARNING] eia-secret-rotation-revoke-api 미해결 결정 — 본 spec 이 TBD 로 명시하나, 구현 plan 이 선행 착수 중

- **target 위치**: `spec/2-navigation/2-trigger-list.md` §3 API 표 (`POST /api/triggers/:id/auth/rotate-secret` 행) + Rationale R-2 TBD 항목
- **관련 plan**: `plan/in-progress/eia-secret-rotation-revoke-api.md` §결정 사항 (rotation grace 기간, 응답 shape, itk revoke 후 grace — 세 항목 모두 `[ ]` 미결)
- **상세**: 본 spec 변경은 `POST /api/triggers/:id/auth/rotate-secret` endpoint 를 "v1.1 예약" 으로 표기하고, 경로명·grace 기간·응답 shape 를 TBD 로 남겼다. R-2 에서도 이를 의식적 미결정으로 선언하며 `eia-secret-rotation-revoke-api.md` 합의 후 확정한다고 명시했다. 이는 spec 기술이 올바른 패턴이다. 다만 `eia-secret-rotation-revoke-api.md` 의 §결정 사항 세 항목이 모두 `[ ]` 로 미결인 상태에서 Plan B (`trigger-detail-edit-meta.md`) 가 이미 착수 계획을 수립했다는 것은, Plan B 의 v1.1 항목이 의존 plan 합의 없이 구현 scope 에 포함될 위험이 있다. Plan B 본문에서는 이를 "v1.1 webhook secret rotate 항목은 그 합의 후 별 plan 으로 분리" 로 명확히 선언하고 있으므로 현재로서는 문제가 없지만, 개발 착수 시 v1.1 scope 가 본 plan 으로 유입되지 않도록 별도 체크포인트가 필요하다.
- **제안**: Plan B 수용 기준에 "v1.1 webhook secret rotate 는 `eia-secret-rotation-revoke-api.md` 합의 전 구현하지 않는다" 항목을 명시적으로 추가. 이미 본문에서 언급하고 있으나 수용 기준 체크리스트로 격상하면 PR 리뷰 시 강제력이 생긴다.

---

### [INFO] 삭제 confirmation 이름 입력 패턴 — layout.md / convention 정비 후속 Plan 이 반영 안 됨

- **target 위치**: `spec/2-navigation/2-trigger-list.md` §4.2 오삭제 방지 항목
- **관련 plan**: 현재 어떤 in-progress plan 에도 "layout.md 또는 별 convention 으로 끌어올린다" 작업이 추적되지 않음
- **상세**: §4.2 에서 "사용자가 트리거 이름을 정확히 타이핑해야 삭제 버튼이 활성화된다" 패턴을 최초 도입하면서, "후속 spec 정비 PR 에서 `spec/2-navigation/_layout.md` 또는 별 convention 으로 끌어올린다"고 명시했다. 그러나 이 후속 작업이 어느 plan 에도 등록되지 않아 트래킹 누락 상태다.
- **제안**: `plan/in-progress/0-unimplemented-overview.md` 또는 신규 spec-polish plan 에 "삭제 confirmation 이름 입력 패턴을 `_layout.md` 또는 `spec/conventions/` 로 격상" 항목을 추가한다.

---

### [INFO] spec/2-navigation/ 파일들을 다수 worktree 가 동시 수정 중 — 2-trigger-list.md 는 단독이나 4-integration.md 와 10-auth-flow.md 는 다중 경합

- **target 위치**: `spec/2-navigation/2-trigger-list.md` (본 target), `spec/2-navigation/_product-overview.md`
- **관련 plan**: 아래 워크트리들이 `spec/2-navigation/4-integration.md` 또는 `spec/2-navigation/10-auth-flow.md` 를 main 대비 변경 중: `ai-agent-turn-fail-finalize-a22724`, `cafe24-backlog-residual-batch`, `cafe24-bg-refresh-tuning-fb72d5`, `cafe24-token-lifecycle-logs-196308`, `chat-channel-telegram-0c106c`, `collapse-empty-toolcall-bubble`, `fix-toolcall-bubble-render`, `integration-action-required-ui`, `llm-retry-after-5a7d63`, `preserve-live-tool-items`, `redis-bullmq-env-hardening-7a47dc`, `spec-conversation-ui-contract`, `spec-followup-cron-7d-statemachine-868886`, `test-stages-frontend-bb9037`, `toolcall-tree-rendering`, `user-guide-reviewer-and-impl-done-800d6e`
- **상세**: 본 target 이 직접 수정하는 `2-trigger-list.md` 는 현재 어느 다른 worktree 도 건드리지 않아 직접 경합 없음. `_product-overview.md` 도 동일. 단, `4-integration.md` 와 `10-auth-flow.md` 는 다수 worktree 가 경합 중이므로, Plan B (`trigger-detail-edit-meta.md`) 가 `4-integration.md` 를 참조하는 cross-link 나 EIA 카드 UX 패턴을 채용할 때 해당 파일의 내용이 merge 순서에 따라 달라질 수 있다. Plan B 자체는 `4-integration.md` 를 수정하지 않으므로 충돌 위험은 낮으나, EIA spec 의 최신 상태를 확인하고 착수할 것.
- **제안**: 착수 전 `spec/2-navigation/4-integration.md` 및 `spec/5-system/14-external-interaction-api.md` 의 최신 HEAD 상태(경합 중인 worktree 중 가장 앞선 것) 를 확인하고, EIA 카드 edit 패턴이 이미 확정된 형태로 존재하는지 점검.

---

## 요약

본 `spec/2-navigation/` 구현 착수 전 검토에서 CRITICAL 발견사항은 없다. 주요 관심 지점은 두 가지다. 첫째, Plan B (`trigger-detail-edit-meta.md`) 가 `eia-trigger-edit-ui.md` 의 머지를 선행 조건으로 명시하고 있으나 해당 plan 의 worktree 슬러그가 미할당 상태이므로, Plan B 착수 전 `eia-trigger-edit-ui` 의 실제 진행 worktree 를 확인하여 직렬화 순서를 보장해야 한다 (WARNING). 둘째, `eia-secret-rotation-revoke-api.md` 의 세 결정 항목이 미결인 상태에서 본 spec 이 TBD 로 명시한 것은 올바른 패턴이나, Plan B 수용 기준에 v1.1 scope 차단 항목을 체크리스트 형태로 격상하는 것이 권장된다 (WARNING). `2-trigger-list.md` 를 직접 수정하는 다른 worktree 는 없어 파일 경합 위험은 없다.

## 위험도

LOW
