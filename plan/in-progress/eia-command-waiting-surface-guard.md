---
worktree: .claude/worktrees/elegant-driscoll-eebdd6
started: 2026-07-10
owner: developer
---

# EIA/WS continuation 명령 ↔ 대기 표면 가드

> 발견: 2026-07-10 consistency-check `review/consistency/2026/07/10/22_27_01/cross-spec.md`
> (spec-only PR 범위 밖이라 분리)

## 배경 — 재현된 결함

EIA `POST /api/external/executions/:id/interact` 와 WS `execution.*` 명령은 **대기 노드의
interaction 표면과 명령이 맞는지 검사하지 않는다**. `assertWaiting()` 은 `execution.status ===
'waiting_for_input'` 만 보고, `resolveWaitingNodeExecutionId()` 는 "현재 대기 중인 아무 노드" 를
반환한다. 재개 라우팅(`dispatchResumeTurn`)은 도착 payload 의 `type` 이 아니라 **대기 노드의
표면**으로 핸들러를 고른다.

**재현 (unit, 2026-07-10)** — `FormInteractionService.processFormResumeTurn` 에
`{type:'ai_end_conversation'}` 를 전달:

- sentinel 불일치 → `logger.warn` 한 줄만 남기고 payload 를 그대로 `formData` 로 취급
- 필드 화이트리스트 필터 후 `interaction = {type:'form_submitted', data:{}, receivedAt}`
- nodeExec `COMPLETED` + `execution.node.completed` emit + ConversationThread 에 가짜
  `form_submitted` append

즉 **Form 이 "빈 데이터로 제출된 것" 처럼 조용히 재개**된다. 409 로 거부되는 경로가 없다.

같은 클래스: Form 대기 중 `submit_message`(`{message}`) · `click_button`(`{buttonId}`) 도
동일하게 폴백 → 빈 폼 제출. Buttons 대기 중 비-button 명령은 `INVALID_BUTTON_ID` 로 노드를
FAILED 시킨다(침묵은 아니나 execution 을 죽인다).

AI 대기 노드의 `processAiResumeTurn` 은 방어적이다 — `ai_message`/`form_submitted`(render_form
응답)/`ai_end_conversation` 을 처리하고, `button_click`(stale telegram inline_keyboard) 은
상태 변경 없이 graceful re-park 한다.

## 결정 (사용자, 2026-07-10)

**전체 명령 매트릭스** 를 publisher chokepoint 에서 강제한다. AI 대기 표면의 기존 defensive
관용은 보존 (stale inline_keyboard graceful re-park 회귀 방지).

| 대기 표면 | 허용 명령 |
| --- | --- |
| `form` (정적 blocking metadata) | `submit_form` 만 |
| `buttons` (persisted `meta.interactionType`) | `click_button` 만 |
| `ai_conversation` / `ai_form_render` | 4종 모두 (기존 핸들러 관용 유지) |
| 판정 불가 | **fail-closed** (거부) |

**fail-open → fail-closed 정정** (impl-prep cross-spec/rationale WARNING 반영): 자매 게이트
`dispatchResumeTurn` 이 이미 fail-closed(`RESUME_CHECKPOINT_MISSING`)이고, 이 프로젝트의
fail-open 선례는 인프라 가용성 시나리오 전용이다. 게다가 표면 판정 불가 행은 **오늘도**
`dispatchResumeTurn` 이 매칭 처리기를 못 찾아 worker 에서 실행이 죽는다 (`form` 은 정적
metadata 로 항상 판정되므로 여기 도달하지 않는다). 따라서 publish 전 동기 거부는 회귀가
아니라 **비동기 실행 사망 → 동기 409 + waiting 보존**으로의 개선이다.

거부는 `InvalidExecutionStateError` → 진입점별 기존 매핑 자동 파생:
EIA REST 409 `STATE_MISMATCH` · WS ack `INVALID_EXECUTION_STATE` · REST `/continue` 422 `INVALID_STATE`.
신규 에러 코드 없음 (error-codes-catalog SoT 동기 불필요).

Spec 근거 — 이미 약속된 계약의 구현:
- EIA-IN-13 (필수): "현재 노드 상태와 명령이 맞지 않으면 409 Conflict"
- EIA §5.1 에러 표: `409 STATE_MISMATCH` = "현재 노드/실행 상태와 명령 불일치"
- EIA §5.1 body 표 "적용 노드" 컬럼

## 체크리스트

- [x] 재현 (unit 레벨, `processFormResumeTurn` 침묵 오처리 확인)
- [x] `/consistency-check --impl-prep` — `review/consistency/2026/07/10/23_19_34/` BLOCK: NO
      (WARNING 반영: fail-open→fail-closed, hooks catch 는 warn 필수, buttons 표면 회귀 테스트 추가)
- [x] 테스트 선작성 (unit + e2e)
- [x] 구현 — `resolveWaitingNodeExecutionId(executionId, expectedCommand)` + `waiting-surface-guard.ts`
- [x] e2e 비-vacuity 실증 — 가드 비활성 시 `end_conversation` 이 **202** 반환(재현), 가드 복원 시 409
- [x] TEST WORKFLOW (lint / unit / build / e2e 모두 PASS)
- [ ] `/ai-review` + Critical/Warning 0
- [ ] `/consistency-check --impl-done spec/5-system`
- [ ] spec 동기 (project-planner 위임 — 아래 S-1)

## spec 동기 (project-planner 위임 대상)

에러 코드·요구사항 ID 신설은 없다 (EIA-IN-13 필수 + §5.1 `STATE_MISMATCH` 행이 이미 본 동작을
약속). 남은 것은 **문서가 코드보다 좁아진 열거 갭**:

- `spec/5-system/4-execution-engine.md` §7.5.1 표에 3번째 행("표면(interactionType) 불일치") +
  `## Rationale` 항목 신설 (왜 form/buttons 는 엄격하고 ai 는 관대한가 / 왜 신규 코드 미도입 /
  왜 fail-closed).
- `spec/5-system/14-external-interaction-api.md` §5.1 `STATE_MISMATCH` 행 예시 보강,
  §6.2 `expectedCommands` 가 서버 수용 범위보다 좁다는 각주 (`expectedCommands` 는 미구현 문서 필드).
- `spec/4-nodes/6-presentation/0-common.md` §10.9 — buttons 대기 중 비-`button_click` 은 이제
  publisher 단계에서 거부됨을 명시 (기존 (d) `continue` 폴백은 도달 불가).
- `spec/3-workflow-editor/3-execution.md` §9 — `POST /continue` 의 422 조건 확장 서술.
- `spec/conventions/interaction-type-registry.md` — 표면 매트릭스 cross-ref (권장).

## 후속 항목 (본 PR 범위 밖)

### F-1. `assertNodeId` 가 실제 대기 nodeId 와 일치 검사를 안 함 — 같은 클래스, **선행 작업 필요**

`interaction.service.ts` 의 `assertNodeId(dto)` 는 `dto.nodeId` 의 **존재 여부만** 본다.
spec `4-execution-engine.md §7.5.1` 은 publisher lookup 키를 `execution_id + node_id +
status='waiting_for_input'` 로 규정하고 "매칭 row 0건 … 또는 nodeId 미일치" 를 명시하므로,
현재 구현은 spec 미이행이다. EIA §5.1 도 `STATE_MISMATCH` 조건에 "또는 다른 nodeId" 를 든다.

**그러나 지금 고칠 수 없다** — `hooks.service.ts:724` / `:735` 가 채팅 채널 인바운드를
`nodeId: 'chat-channel'` 이라는 **리터럴 placeholder** 로 EIA 에 넣는다. nodeId 일치 검사를
추가하면 텔레그램/슬랙/디스코드 인바운드가 전부 409 가 된다.

선행 작업: `forwardToInteractionService` 가 실제 대기 nodeId 를 조회해 전달하도록 교체
(또는 `scope: 'in_process_trusted'` 에 대한 명시적 면제를 spec 에 등재). 그 뒤에야 nodeId
일치 검사를 넣을 수 있다.

### F-2. 채팅 채널 native form modal 대기 중 텍스트 입력의 graceful 안내

본 PR 이후 `hooks.service.forwardToInteractionService` 의 `submit_message` 가 form 대기 중
`InvalidExecutionStateError` 로 거부된다 (종전: 빈 폼 조용히 제출 — 이것이 버그였다).
사용자에게 "폼을 열어 제출해 주세요" 안내를 보내는 graceful 경로가 필요하다.
