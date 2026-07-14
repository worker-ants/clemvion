---
worktree: .claude/worktrees/elegant-driscoll-eebdd6
started: 2026-07-10
completed: 2026-07-14
owner: developer
spec_impact:
  - spec/5-system/4-execution-engine.md
  - spec/5-system/15-chat-channel.md
  - spec/5-system/6-websocket-protocol.md
  - spec/5-system/14-external-interaction-api.md
  - spec/4-nodes/7-trigger/providers/telegram.md
  - spec/conventions/chat-channel-adapter.md
  - spec/data-flow/15-external-interaction.md
---

> **완료 (2026-07-14)**: 메인 표면 가드 + 후속 F-1~F-6 전부 구현·리뷰·consistency 종결.
> 미채택 백로그(별도 작업): ChatChannelInboundService 분리, defaults per-provider escape 이관,
> `expectedNodeId` options 객체화, REST `/continue` nodeId 계약, `TELEGRAM_RAW_SEND_HINT_KEYS`
> 컴파일타임 연동, i18n-userguide chat-channel KO/EN 예외 codify, maybeNotifyIgnored 정확 문구 단언.

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

### F-1. `assertNodeId` 가 실제 대기 nodeId 와 일치 검사를 안 함 — **완료 (2026-07-14, Approach B)**

`assertNodeId(dto)` 는 `dto.nodeId` 존재만 보고, `resolveWaitingNodeExecutionId` 는 `exec+status`
로만 조회해 nodeId 를 무시했다 — spec §7.5.1(lookup 키 `execution_id + node_id + status`, "nodeId
미일치 → INVALID")·EIA §5.1("다른 nodeId")·`InteractDto.nodeId` JSDoc 미이행. 그 결과 stale/오지정
nodeId 제출이 현재 대기 노드로 조용히 오적용됐다.

**결정 (사용자, 2026-07-14): Approach B** — 외부 caller 만 검사 + `in_process_trusted` 면제.

- [x] `resolveWaitingNodeExecutionId(executionId, expectedCommand, expectedNodeId?)` — expectedNodeId
  제공 시 대기 `row.nodeId` 와 대조, 불일치면 `InvalidExecutionStateError`(→ EIA 409 `STATE_MISMATCH`).
- [x] 4종 continue* 에 `expectedNodeId?` 스레딩(기본 undefined → WS/`/continue` 무영향).
- [x] `interaction.service`: 외부 scope 는 `dto.nodeId` 전달(+ assertNodeId 존재 요구 유지),
  `in_process_trusted`(`isInternalCtx`)는 면제(undefined + 요구 skip). class JSDoc dispatch 표 갱신.
- [x] `hooks.service`: fake `nodeId: 'chat-channel'` placeholder 제거.
- [x] spec §7.5.1 — "nodeId 불일치" 행 + **진입점별 커버리지 표**(EIA 적용 / trusted 면제 / WS·`/continue` 미적용).
- [x] TEST WORKFLOW (lint/unit/build/e2e 전부 PASS — e2e G-2: wrong nodeId → 409 실증).
- [x] `/ai-review` (`review/code/2026/07/14/01_09_10/`) — 초회 CRITICAL 1(spec overclaim "WS 도 지정")
  → spec 커버리지 표로 정정. WARNING fix + backlog(F-6). CHANGELOG 등재.
- [x] `/consistency-check --impl-done` (`review/consistency/2026/07/14/...`) BLOCK: NO.

**스코프 밖 (검토 중 명시)**: chat-channel `form_submission`(handleFormStep)은 실제 nodeId
(`pendingFormModal.nodeId`)를 알지만 `in_process_trusted` 라 scope-단위로 면제된다 — 정책상 의도
(진입점이 아니라 scope 로 판정). WS/`/continue` 는 아래 F-6.

### F-6. WS continuation·REST `/continue` 의 nodeId 검사 확장 — **완료 (2026-07-14)**

F-1 은 nodeId 검사를 외부 EIA `/interact` 에만 배선했다. 조사 결과 **frontend 는 이미 WS
`submit_message`/`end_conversation` 에 대기 노드 `nodeId`(`result.nodeId`)를 싣는데 서버가 무시**하고
있었다(§6 이 "server lookup" 만 서술). F-1 과 대칭으로 검증을 켠다.

- [x] WS gateway 3개 handler — `handleSubmitMessage`/`handleEndConversation`/`handleClickButton` 이
  `data.nodeId` 를 continue* 의 `expectedNodeId` 로 forward. 제공 시 대기 노드와 대조(불일치 →
  `INVALID_EXECUTION_STATE` ack), 미제공(`submit_form`, frontend 미전송 click_button)이면 skip(하위호환).
- [x] `/continue` 는 body 에 nodeId 파라미터 부재 → 미적용 유지(§7.5.1 커버리지 표 명시).
- [x] spec — §6-websocket-protocol §4.2 명령 표·ack 노트·Rationale + 실행 엔진 §7.5.1 커버리지 표(WS
  "적용 (nodeId 제공 시)") 갱신. CHANGELOG 등재.
- [x] 회귀 검증 — frontend 가 정확한 대기 nodeId 를 싣으므로 core editor multi-turn 정상 흐름 무변경;
  WS gateway 단위 테스트(forwarding) + 전체 e2e 통과로 확인.

**미채택(비차단 백로그)**: `expectedNodeId` optional-positional → options 객체/context 파생 견고화는
순수 스타일 개선(architecture WARNING, 비차단)이라 보류 — 실 caller(interaction.service·WS gateway)가
모두 명시 전달하므로 fail-open 실효 위험이 낮다. `/continue` nodeId 파라미터 신설도 계약 확장이라 보류.

### F-2. 채팅 채널 표면 불일치 입력의 graceful 안내 (form **및 buttons**) — **완료 (2026-07-14)**

`hooks.service.forwardToInteractionService` 의 고정 매핑이 대기 표면과 어긋나 `STATE_MISMATCH`
로 거부되면 종전엔 warn 로그만 남기고 삼켜 사용자에게 아무 피드백이 없었다(빈 폼 조용히
제출/엉뚱한 `continue` 포트 분기는 표면 가드로 이미 차단됨). CCH-ERR-04("silently swallow
금지") 관례에 맞춰 best-effort 안내를 발송하도록 구현.

- [x] `languageHints.surfaceMismatch`(KO/EN) 신규 키 — `SURFACE_MISMATCH_DEFAULTS` +
  `resolveSurfaceMismatchMessage`(`sessionExpired` resolver 패턴). control-plane 직접 발송이라
  default 는 MarkdownV2-safe(특수문자 배제, 단위테스트가 canonical `escapeMarkdownV2` 로 강제).
- [x] `sendSurfaceMismatchNotice` — STATE_MISMATCH 삼킬 때 best-effort 발송(실패는 swallow).
- [x] spec 등재 — chat-channel §4.1 예제 + §4.1.1 표, providers/telegram.md §5.8(non-escape 예외),
  chat-channel-adapter.md §2.3 stale "12 문구" 카운트 정정.
- [x] 유저 가이드 telegram.mdx/.en.mdx §7.4 + 트리거 drawer `languageHintsHelp` dict(ko/en) 백필.
- [x] TEST WORKFLOW (lint/unit/build/e2e 전부 PASS).
- [x] `/ai-review` (`review/code/2026/07/14/00_09_28/`) — Critical 0, Warning 8→5 fix + 3 backlog(F-4/F-5).
- [x] `/consistency-check --impl-done` (`review/consistency/2026/07/14/00_31_59/`) **BLOCK: NO**
  (Critical 0/5 checker. WARNING 2건=본 plan 갱신 + convention 숫자 정정으로 해소).

### F-3. 외부 EIA 클라이언트 대상 breaking behavior 공지 여부 결정 — **완료 (사용자 결정, 2026-07-14)**

**breaking 범위 (2건 누적)** — 둘 다 종전 202 → 409 `STATE_MISMATCH`, 둘 다 EIA-IN-13 + §5.1 이
이미 약속한 계약의 구현("버그 수정")이라 코드 되돌림 대상은 아님:

1. **표면 불일치** (대기 표면 매트릭스, 2026-07-10 메인 PR) — form/buttons 대기 중 이종 명령.
2. **nodeId 불일치** (F-1, 2026-07-14) — 명령의 `nodeId` 가 실제 대기 노드와 다름.

**결정: 공지 불필요 + spec 메모.** EIA §5.1 은 처음부터 이 두 조합에 `409 STATE_MISMATCH` 를
공표된 계약으로 명시했다 — 종전 `202` 는 계약 위반 결함이었고, 이번 변경은 **published 계약으로의
정합**이라 문서화된 동작은 바뀌지 않았다. 종전 `202` 에 의존한 클라이언트는 문서화되지 않은 결함에
의존한 것이므로 별도 외부 breaking-change 공지는 발행하지 않는다.

- [x] CHANGELOG 에 두 변경 모두 기록 (F-2/F-1 항목).
- [x] EIA `14-external-interaction-api.md §5.1` 에 "`STATE_MISMATCH` 강제 정합 (2026-07)" 메모 추가
  (구현이 계약으로 정합, 종전 202 는 결함, 외부 공지 미발행 근거).

### F-4. control-plane 안내 발송 구조 정리 — **완료 (2026-07-14)**

`review/code/2026/07/14/00_09_28/` architecture reviewer 발견 (F-2 범위 밖 pre-existing 패턴).

- [x] 3-level lookup resolver 3중 복제(`resolveFormOpenLabel`/`resolveSessionExpiredMessage`/
  `resolveSurfaceMismatchMessage`)를 `makeLocaleResolver` factory 로 통합. 동작 보존(기존 resolver
  테스트) + factory 직접 테스트.
- [x] `HooksService` 안내 발송 3종(`sendExecutionStillRunningNotice`/`sendSurfaceMismatchNotice`/
  `maybeNotifyIgnored`)의 try/catch/warn 골격을 `sendBestEffortNotice` 로 추출.

**미채택(백로그)**: chat-channel inbound 처리를 `ChatChannelInboundService` 로 분리하고
`HooksService.handleWebhook` 을 얇은 위임만 남기는 것은 중장기 구조 이동이라 별도 작업으로 유지.

### F-5. control-plane raw 발송 키의 MarkdownV2-safe 불변식 DTO 강제 — **완료 (2026-07-14)**

hooks.service 가 렌더러 escape 없이 직접 발송하는 control-plane 키의 operator override 가 telegram
MarkdownV2 특수문자를 포함하면 raw 전송이 거부돼 안내가 유실된다(default 는 단위테스트로만 강제,
override 미검증 갭).

- [x] `LanguageHintsRawSendValidator` — `provider === 'telegram'` 한정으로 raw-send 키
  (`help`/`groupChatRefusal`/`unsupportedMessageKind`/`executionStillRunning`/`surfaceMismatch`/
  `formValidationFailed`/`formNextField`)의 override 를 등록 시점 검증. unescaped 특수문자 발견 시
  `400 VALIDATION_ERROR`(`UNSAFE_TELEGRAM_MARKDOWN`). escaped(`\.`)·slack/discord·비-raw-send 키
  (`sessionExpired`=렌더러 escape / `formOpenLabel`=버튼 라벨)·CCH-ERR-* 은 제외.
- [x] spec chat-channel §4.1.1 등재 + DTO ApiPropertyOptional 서술.
- [x] DTO validation 단위 테스트 5.

**미채택(백로그)**: defaults 의 telegram escape baked-in(`\\.`)이 slack/discord 에서 literal 로
노출되는 잔여 갭 — 근본 해결은 발송 경로의 per-provider escape 이관(hooks 직접 발송 대신 어댑터 escape).
별도 작업.
