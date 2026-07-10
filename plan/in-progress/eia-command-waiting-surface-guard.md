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
- [x] TEST WORKFLOW (lint / unit / build / e2e 모두 PASS — buttons 표면 회귀 e2e 추가)
- [x] `/ai-review` 다회 수렴 — `00_03_25`(W12→코드 8건 fix)·`00_49_34`(SoT 통합)·
      `01_17_12`(rehydration SoT 재사용)·`01_34_58`(0/0 clean). Critical 0.
- [x] `/consistency-check --impl-done` (`review/consistency/2026/07/11/01_35_17/`) **BLOCK: NO**
      (Critical 0/5 checker. 반복 WARNING=spec 본문 열거 lag → S-1 로 해소)
- [x] spec 동기 (project-planner, `review/consistency/2026/07/11/01_47_51/` `--spec` BLOCK:NO) — S-1 완료 (아래)

## spec 동기 (S-1) — **완료** (project-planner, 2026-07-11)

`--spec` 검토 `review/consistency/2026/07/11/01_47_51/` **BLOCK: NO** 후 5개 위치 반영. 신규
에러 코드·요구사항 ID 없음(EIA-IN-13 + §5.1 `STATE_MISMATCH` 이 이미 약속한 동작의 열거 정정).

- [x] `spec/5-system/4-execution-engine.md` §7.5.1 표 3번째 행("표면(interactionType) 불일치") +
  `## Rationale` "대기 표면 ↔ 명령 매트릭스" 항목 신설.
- [x] `spec/5-system/14-external-interaction-api.md` §5.1 `STATE_MISMATCH` 예시 보강 +
  §6.2 `expectedCommands` 각주(권장 광고 필드·서버 4종 수용, 미구현 문서 필드).
- [x] `spec/4-nodes/6-presentation/0-common.md` §10.9 buttons 대기 비-`button_click` publisher 거부 대칭 서술.
- [x] `spec/3-workflow-editor/3-execution.md` §9 `POST /continue` 422 조건 확장(Form 표면 아니면 거부).
- [x] `spec/conventions/interaction-type-registry.md` §1.1 표면 가드 소비처 cross-ref + `code:` frontmatter.

착수 예정 시 계획했던 §7.5.1 L1041 receiver 서술 변경은 **미채택** — 그 문단의 "nodeId 미일치"
서술은 F-1(assertNodeId nodeId 일치 미검사)의 pre-existing 갭 영역이라, 표면 케이스만 추가하고
lookup-key 서술은 F-1 트랙에서 다룬다(consistency plan_coherence 지적 반영).

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

### F-2. 채팅 채널 표면 불일치 입력의 graceful 안내 (form **및 buttons**)

본 PR 이후 `hooks.service.forwardToInteractionService` 의 고정 매핑(`text_message → submit_message`,
`button_callback → click_button`)이 대기 표면과 어긋나면 `STATE_MISMATCH` 로 거부되고, 현재는
warn 로그만 남기고 삼킨다. 두 케이스 모두 사용자에게 아무 피드백이 없다:

- **form 대기 + 자유 텍스트** (native modal 미개봉) — 종전: 빈 폼 조용히 제출(버그)
- **buttons 대기 + 자유 텍스트** — 종전: 엉뚱한 `continue` 포트 분기(버그)

`languageHints` 신규 키(예: `surfaceMismatch`)를 `spec/5-system/15-chat-channel.md` §4.1 표에
등재하고 best-effort 안내를 발송해야 한다. chat-channel spec 의 CCH-ERR-04("silently swallow
금지") 관례상 필요.

### F-3. 외부 EIA 클라이언트 대상 breaking behavior 공지 여부 결정 (project-planner)

본 PR 은 종전 202 를 반환하던 명령 조합을 409 로 바꾼다. "버그 수정"(EIA-IN-13 이 이미 이 거부를
약속) 이므로 코드 되돌림 대상은 아니나, 이 프로젝트는 URL 비버저닝 단일 버전 운영이고 EIA 문서에
breaking-change 공지 절차가 없다. 공지 필요 여부·채널을 planner 가 명시적으로 결정할 것.
