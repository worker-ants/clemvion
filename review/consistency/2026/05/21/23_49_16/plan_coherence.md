# Plan 정합성 검토 결과

검토 모드: `--impl-prep`
Target 문서: `spec/5-system/15-chat-channel.md`, `spec/conventions/chat-channel-adapter.md`, `spec/4-nodes/7-trigger/providers/telegram.md`
검토 기준 plan: `plan/in-progress/**` (2026-05-21 기준)
담당 worktree: `chat-channel-telegram-0c106c`

---

## 발견사항

### [WARNING] V062 마이그레이션 슬롯 — eia-jti-tracking 잠재 경합

- **target 위치**: `plan/in-progress/chat-channel-impl.md` §1.1 "Migration" → `migrations/V062__trigger_chat_channel_columns.sql`
- **관련 plan**: `plan/in-progress/eia-jti-tracking.md` §"2. Migration" — "V0XX (V059 다음 슬롯) — `execution_token` 테이블 신설"
- **상세**: `chat-channel-impl.md` 는 V062 를 trigger 컬럼 마이그레이션으로 명시했다. `eia-jti-tracking.md` 는 V 번호를 "V0XX (V059 다음 슬롯)" 으로 열어 두었고, 현재 main 의 max V 번호는 V061 이다. 두 plan 이 모두 착수하면 V062 를 동시에 사용하려는 경합이 발생한다. `eia-jti-tracking` 에는 아직 미결 사용자 합의(`결정 사항 합의 필요` 체크박스 미완)가 있어 즉시 착수 가능 상태는 아니지만, 착수 시점이 겹칠 경우 V번호 충돌이 발생한다 (`spec/conventions/migrations.md §2` 의 "단조 증가, gap 금지" 규칙 위반).
- **제안**: `chat-channel-impl.md` Phase 1 착수 직전 `spec/conventions/migrations.md` 에서 V062 를 정식 예약(PR 본문에 슬롯 선점 명시)하거나, `eia-jti-tracking.md` 의 V번호 란을 V063+ 로 사전 조정. 두 plan 의 PR 담당자 간 슬롯 조율 권장.

---

### [WARNING] Trigger 드로어 spec 동시 편집 충돌 위험 — eia-trigger-edit-ui 와의 겹침

- **target 위치**: `plan/in-progress/chat-channel-impl.md` §2 "Phase 6 — PR-E" 프론트엔드 스코프 — `app/(main)/triggers/[id]/_components/trigger-drawer.tsx` 에 `chatChannel` 설정 패널 추가
- **관련 plan**: `plan/in-progress/eia-trigger-edit-ui.md` §"1. UI 컴포넌트" — 동일 Trigger 상세 드로어에 Notification/Interaction 수정 UI 추가 (worktree: `eia-trigger-edit-ui-<slug>`)
- **상세**: 두 plan 이 모두 `trigger-drawer.tsx` (또는 동등 경로) 를 편집한다. `chat-channel-impl` 의 chatChannel 설정 패널과 `eia-trigger-edit-ui` 의 Notification/Interaction 수정 모드가 같은 컴포넌트 파일에 동시 추가되면 merge conflict 위험이 높다. `chat-channel-impl.md` 의 §4 "consistency-check --impl-prep 호출 계획" 항목이 이를 "W-9" 로 이미 인식하고 있으나 plan 자체에 직렬화 결정이 명시되지 않았다. `eia-trigger-edit-ui` plan 에는 worktree slug 가 `<slug>` 로 미확정 상태이므로 아직 착수하지 않은 것으로 보이지만, 두 작업이 동시에 진행될 경우 conflict 가 불가피하다.
- **제안**: `chat-channel-impl.md` §Phase 6 에 "eia-trigger-edit-ui 가 머지된 후 trigger-drawer 편집 진행" 또는 역순의 직렬화 결정을 명시. 또는 두 plan 이 드로어 내부에서 각자의 섹션을 독립된 sub-component 로 완전 분리해 conflict 표면을 줄이는 설계 결정을 plan 에 선기록.

---

### [WARNING] eia-secret-rotation-revoke-api 와의 TriggersController 동시 편집

- **target 위치**: `plan/in-progress/chat-channel-impl.md` §1.1 "개정 모듈" — `modules/chat-channel/chat-channel.controller.ts` 는 별도 컨트롤러이나, `modules/triggers/triggers.service.ts` 의 `setupChannel` / `teardownChannel` 연결 코드를 편집
- **관련 plan**: `plan/in-progress/eia-secret-rotation-revoke-api.md` §"2. 백엔드 API" — `TriggersController` 에 `POST /api/triggers/:id/notification/rotate-secret` 및 `POST /api/triggers/:id/interaction/revoke-token` 신규 endpoint 추가 (worktree: `eia-secret-rotation-<slug>`)
- **상세**: 두 plan 모두 `triggers.service.ts` 및 `TriggersController` 를 수정한다. `chat-channel-impl` 은 trigger create/update/delete 훅에 chatChannel 분기를 추가하고, `eia-secret-rotation-revoke-api` 는 같은 서비스에 rotation/revoke 비즈니스 로직을 추가한다. 각각 별도 메서드를 추가하는 형태라 conflict 가능성은 낮지만, PR merge 순서에 따라 한쪽이 적용된 파일 위에 다른 쪽이 누락 없이 rebase 되는지 확인이 필요하다. `eia-secret-rotation-revoke-api` plan 에는 미결 결정 사항 (`rotation grace 기간`, `rotate 응답 shape`, `itk revoke 후 grace`) 이 3건 있어 착수 시점이 확정되지 않았다.
- **제안**: 두 plan 의 PR 병렬 진행 시 `triggers.service.ts` 에 변경 충돌 여부를 PR 제출 전 rebase 로 검증. `eia-secret-rotation-revoke-api` 의 미결 결정 합의가 끝난 시점에 착수 순서 조율 권장.

---

### [WARNING] ai-agent-tool-connection-rewrite TBD 결정과 무관하나 EIA §R10 참조 정합 확인 필요

- **target 위치**: `spec/5-system/15-chat-channel.md` §3.2 — NotificationDispatcher EventEmitter 를 "단일 sink 원칙의 확장" 으로 EIA §R10 을 참조
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §3 — `spec/4-nodes/3-ai/1-ai-agent.md` tool area 재작성 시 EIA cross-ref (§W-1) 가 열려 있음. 도구 이름 namespace (`tool_*` 접두사 부활 여부) 결정 후 EIA SSE payload spec 동기화 예정
- **상세**: target spec 이 참조하는 EIA §R10 은 이미 `spec/5-system/14-external-interaction-api.md` 에 확정 기록되어 있음을 코드 확인으로 검증했다 (line 844~866). `ai-agent-tool-connection-rewrite` 의 미결 결정이 EIA SSE payload `name` 필드 namespace 를 바꿀 수 있으나, 이는 Chat Channel 어댑터가 소비하는 `EiaEvent` union 의 핵심 필드와 직접 충돌하지 않는다 (`EiaEvent` 는 event type / executionId / payload 를 참조하며 tool 이름 namespace 는 별도 필드). 실질적 충돌 없음이지만 연결고리를 주시할 필요가 있다.
- **제안**: `chat-channel-impl.md` 의 §5 후속 plan 목록 또는 §4 점검 포인트에 "ai-agent-tool-connection-rewrite 의 EIA SSE payload 결정이 ChatChannelDispatcher 의 `EiaEvent` union 해석에 영향을 미치지 않음을 confirm" 한 줄 추가.

---

### [INFO] spec/5-system/15-chat-channel.md §4.1 botTokenRef — v1 구현 형식 ambiguity

- **target 위치**: `spec/5-system/15-chat-channel.md` §4.1 — `botTokenRef: "secret://triggers/:id/bot-token"` 를 "JSONB 평문 금지 + secret reference 만 보관" 으로 명세하나, `plan/in-progress/chat-channel-impl.md` §3.4 결정에서 v1 구현은 `Trigger.config.chatChannel.botToken` 평문 보관을 선택(notification.signing.secret stub 과 동일)하면서 "post-impl spec 갱신 권고" 로 남겼다.
- **관련 plan**: `plan/in-progress/chat-channel-impl.md` §3.4 — spec 갱신이 별도 plan `spec-update-chat-channel-bot-token-stub.md` 로 분리될 예정이나 plan 파일은 아직 존재하지 않음
- **상세**: 구현이 완료된 후 spec 과 코드 사이에 "JSONB 평문 금지" 원칙과 "botToken plaintext" 구현 사이의 일시적 불일치가 발생한다. spec 갱신 plan 을 명시적으로 생성하지 않으면 후속 추적이 누락될 위험이 있다.
- **제안**: `chat-channel-impl.md` 의 Phase 9 (plan complete) 직전 또는 Phase 6 완료 시 `plan/in-progress/spec-update-chat-channel-bot-token-stub.md` 를 생성해 추적. 본 PR 자체는 차단하지 않음 (spec §4.1 의 "동일 보안 정책" 표현이 stub 허용 의도 포함, plan 에도 명시됨).

---

### [INFO] worktree 단독 운영 확인 — 충돌 worktree 없음

- **target 위치**: `plan/in-progress/chat-channel-impl.md` frontmatter `worktree: chat-channel-telegram-0c106c`
- **상세**: 현재 `.claude/worktrees/` 디렉토리에 `chat-channel-telegram-0c106c` 단 하나만 존재한다. 다른 활성 worktree 가 `spec/5-system/15-chat-channel.md`, `spec/conventions/chat-channel-adapter.md`, `spec/4-nodes/7-trigger/providers/telegram.md` 를 동시에 편집하고 있지 않음을 확인했다. worktree 충돌 없음.

---

## 요약

target spec 3개 (`spec/5-system/15-chat-channel.md`, `spec/conventions/chat-channel-adapter.md`, `spec/4-nodes/7-trigger/providers/telegram.md`) 는 전용 worktree `chat-channel-telegram-0c106c` 에서 단독 편집 중이며 worktree 레벨 직접 충돌은 없다. 그러나 구현 plan (`chat-channel-impl.md`) 이 편집하는 **코드 파일** 에서 `eia-trigger-edit-ui`, `eia-secret-rotation-revoke-api`, `eia-jti-tracking` 세 plan 과 잠재 경합 영역이 존재한다. 특히 (1) V062 마이그레이션 슬롯을 `eia-jti-tracking` 과 공유 위험, (2) Trigger 드로어 컴포넌트를 `eia-trigger-edit-ui` 와 동시 편집 위험이 WARNING 수준이며, 직렬화 결정 또는 슬롯 사전 조율이 필요하다. `ai-agent-tool-connection-rewrite` 의 TBD 결정 항목은 EIA SSE payload 에 영향을 미칠 수 있으나 ChatChannelAdapter 의 `EiaEvent` union 과 직접 충돌하지 않아 INFO 수준에 그친다. spec 자체가 진행 중인 다른 plan 의 미결 결정을 일방적으로 우회하거나 무효화하는 항목은 발견되지 않았다.

## 위험도

MEDIUM
