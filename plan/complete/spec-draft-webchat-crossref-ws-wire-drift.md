---
worktree: funny-mahavira-50d003
started: 2026-07-14
owner: planner
spec_impact:
  - spec/3-workflow-editor/4-ai-assistant.md
  - spec/5-system/6-websocket-protocol.md
  - spec/5-system/14-external-interaction-api.md
  - spec/7-channel-web-chat/0-architecture.md
---

# Draft: 웹챗 보안 cross-ref 역참조 + SSE/WS `waiting_for_input` wire 필드 drift caveat

> 출처: PR #945 `/consistency-check --impl-done spec/7-channel-web-chat` (2026-07-13,
> `review/consistency/2026/07/13/23_45_46/SUMMARY.md`) 의 WARNING #1·#2 (BLOCK: NO, 기존 문서 gap,
> PR #945 코드 변경과 무관). spec 영역이라 developer 범위 밖 → 별도 planner 작업.
> 두 건 서로 독립. 원 PR: https://github.com/worker-ants/clemvion/pull/945

## 배경 — 검증한 사실

### WARNING #1 (Cross-Spec) — 보안 정책 단방향 참조
- `spec/7-channel-web-chat/4-security.md` (frontmatter `code:` + §1.1 sanitize 정책 매트릭스) 가 메인 앱
  렌더러 `codebase/frontend/src/components/editor/assistant-panel/markdown-renderer.tsx` 의 XSS sanitize
  정책(react-markdown + `rehype-raw` 미사용)을 **보안 동등성 비교 대상**으로 참조.
- 이 렌더러의 기능 소유 영역 `spec/3-workflow-editor/4-ai-assistant.md` 에는 web-chat 보안 문서로의 **역참조 없음**(단방향).
  (grep 확인: `spec/3-workflow-editor/**` 에 `7-channel-web-chat/4-security` / "보안 동등성" 참조 0건.)
  - 4-ai-assistant.md §3.2 "메시지 리스트" 행(line 145)은 `sanitizeAssistantText`(harmony 제어토큰 필터)만 언급 —
    **markdown XSS sanitize 와는 별개 관심사**. markdown-renderer.tsx 의 sanitize 정책 전용 서술은 부재.
- **위험**: 소유 영역에서 markdown 렌더러 sanitize 정책을 바꿀 때 `4-security §1.1` 보안 동등성 매트릭스 검토 누락 가능.

### WARNING #2 (Convention Compliance) — SSE/WS `waiting_for_input` wire 필드명 drift
- **코드로 drift 확정** (planner read-only 검증): 서버 fanout emit
  (`form-interaction.service.ts:120` / `button-interaction.service.ts:407` / `ai-turn-orchestrator.service.ts:451`
  의 `eventEmitter.emitExecution(EXECUTION_WAITING_FOR_INPUT, …)`) 는 실제로
  **`waitingNodeId`(= `node.id`)** + `waitingNodeType` + `waitingNodeLabel` + `nodeExecutionId` + top-level
  `interactionType` + `nodeOutput` + top-level `conversationThread` 를 평면 병합해 보낸다.
  이 fanout envelope 은 **내부 WS store 와 EIA SSE 스트림이 공유하는 단일 wire** (위젯 파서 SoT
  `codebase/channel-web-chat/src/lib/eia-events.ts` `parseWaitingForInput`).
- 그런데:
  - `spec/5-system/6-websocket-protocol.md §4.4` JSON 예시는 `nodeId`(payload 내) + top-level
    `formConfig`/`buttonConfig`/`conversationConfig` 로 표기 → 실제 wire 와 **drift**.
    (§2.1/§2.2 가 "논리 구조 + 평면 병합"은 이미 caveat 하나, `nodeId`→`waitingNodeId` 필드 rename·
    form/ai 설정이 `nodeOutput` 에 nest 되는 점은 미반영.)
  - `spec/5-system/14-external-interaction-api.md §6.2` 는 **이미 "SSE 스트림 wire 형태 주의" caveat
    blockquote 보유**(line 585–593, `node.id`→`waitingNodeId` 전체 매핑 포함). ✅ 해소 완료 상태.
- **"별도 backlog" 미등재 확인**: architecture §3(line 82) 와 EIA §6.2(line 593) 가 모두
  "(… wire 와 drift — 별도 backlog.)" 로 dangling 참조하나, `plan/in-progress/**` 어디에도 **미등재**.
  유일 언급처는 `plan/complete/fix-webchat-sse-field-map.md`(**완료** plan) — 명시적으로 이월만 하고
  ("WS §4.4 / EIA §6.2 drift 는 더 광범위 — 본 PR 에선 web-chat note + 플래그만") 파일화되지 않음.
  - 그 완료 plan 이 backlog 을 미룬 사유는 당시 PR 이 **web-chat 코드 범위**였기 때문. 지금은 순수 spec-doc
    caveat 작업이라 그 제약 없음.

## 처분 결정

### WARNING #1 → 제안 (a) 채택
`spec/3-workflow-editor/4-ai-assistant.md` §3.2 "메시지 리스트" 행(line 145)에 markdown 렌더러 언급 +
web-chat 보안 동등성 매트릭스 역참조 한 줄 추가.
- 제안 (b)(4-security frontmatter 주석 명확화) 대비: 소유 영역에 역참조를 두는 것이 "정책 변경 시 매트릭스
  검토" trigger 를 소유 영역 편집자 눈앞에 두므로 위험(누락) 을 직접 겨냥. 단방향 → 양방향 전환.

### WARNING #2 → **지금 spec caveat 로 해소** (미등재 → 신규 backlog 파일 대신 즉시 처리)
잔여 작업이 순수 spec-doc caveat 1건(WS §4.4) + dangling "별도 backlog" 문구 2곳 정정으로 **작고 low-risk,
planner scope 완결**. backlog 파일 후 later 처리 대비 즉시 해소가 엄격히 우월(같은 소량 작업을 미룰 이유 없음).
EIA §6.2 가 이미 full 매핑 SoT 를 보유하므로, **WS §4.4 caveat 는 매핑을 복제하지 않고 EIA §6.2 blockquote 를
가리킨다**(3중 복제 = 새 drift 표면 회피, 단일 SoT 유지).

- **미채택 — path A (JSON 예시 전체를 실 wire 로 재작성)**: §2.1/§2.2·EIA §6.2 가 모두 "논리/추상 표기 +
  구현현실 caveat" 패턴을 채택한 것과 불일치하고, 논리 nested 구조가 가독성상 유리해 재작성은 명료성을 되레 낮춤.
- **미채택 — 신규 backlog plan 파일**: 잔여가 caveat 1문단이라 파일화는 process overhead + dangling 참조를
  실체 없는 backlog 로 남김. "미등재면 신규로 처리" = (신규 backlog 생성이 아니라) 미해결 항목을 신규로 **해소**.

## 적용할 편집 (spec)

### 편집 1 — WARNING #1: `spec/3-workflow-editor/4-ai-assistant.md` line 145 "메시지 리스트" 행 말미에 추가
> …사용자에게는 제어 토큰·원시 JSON 이 노출되지 않는다. **어시스턴트/툴 메시지 본문은 `markdown-renderer.tsx`
> (react-markdown + `remark-gfm`, `rehype-raw` 미사용으로 raw HTML escape) 로 마크다운 렌더된다 — 이 XSS
> sanitize 정책을 바꾸면 웹챗 위젯 렌더러(`safe-html.ts`)와의 보안 동등성이 깨질 수 있으므로
> [7-channel-web-chat §보안 §1.1 sanitize 정책 매트릭스](../7-channel-web-chat/4-security.md#11-마크다운html-sanitize-정책-매트릭스)
> 도 함께 검토한다.**

(주의: `sanitizeAssistantText`(제어토큰) 와 markdown XSS sanitize 는 서로 다른 관심사임이 문장에서 구분되도록.)

### 편집 2 — WARNING #2: `spec/5-system/6-websocket-protocol.md §4.4` intro(line 380) 뒤에 caveat blockquote 삽입
> **(consistency-check WARNING 반영)** — 초안의 "전체 필드 매핑 SoT" 격상은 과대 서술(EIA §6.2 blockquote 는
> 외부소비 6필드만 매핑, `waitingNodeType`/`waitingNodeLabel`/`nodeExecutionId`/`startedAt` 4필드 미포함)이라
> **오너십 분리**로 정정: EIA §6.2 = 외부 클라이언트 소비 매핑 SoT, WS §4.4 = WS 내부 부가 식별자 소유.
> 또 인용 링크 경로를 `../5-system/…`(broken) → `./14-…`(WS 가 이미 `5-system/` 내부) 로 정정.

> **실제 wire 필드명 주의 (fanout envelope)**: 아래 JSON 은 §2.1 논리 구조 표기다. 서버발신
> `execution.waiting_for_input` 의 실제 평면 wire(§2.2)는 id 를 **`nodeId` 가 아니라 `waitingNodeId`** 로 싣고,
> 여기에 `waitingNodeType`·`waitingNodeLabel`·`nodeExecutionId`·`startedAt`(에디터 타임라인 관측용)을 평면
> 병합한다. form·ai 노드 설정은 top-level `formConfig`/`conversationConfig` 가 아니라 **`nodeOutput`**
> (예: `nodeOutput.conversationConfig`)에 nest 되고, `buttons` 는 top-level `buttonConfig` 를 유지한다. 이
> fanout envelope 은 내부 WS store 와 EIA SSE 스트림이 공유한다. **외부 클라이언트가 소비하는 필드 매핑의
> SoT 는 [EIA §6.2 "SSE 스트림 wire 형태 주의" blockquote](./14-external-interaction-api.md#62-페이로드--executionwaiting_for_input)**
> (+위젯 파서 `codebase/channel-web-chat/src/lib/eia-events.ts` `parseWaitingForInput`)**이며, WS 내부 부가
> 식별자(`waitingNodeType`/`waitingNodeLabel`/`nodeExecutionId`/`startedAt`)는 본 §4.4 가 소유한다.** emit SoT:
> `form-interaction`/`button-interaction`/`ai-turn-orchestrator` 서비스의 `emitExecution(EXECUTION_WAITING_FOR_INPUT, …)`.

### 편집 5 (선택, rationale_continuity INFO #1) — WS `## Rationale` 에 caveat 결정 근거 1항 추가
기존 `### §4.4 buttonConfig 예시 정정 …` 항목 뒤에 sibling 로 "§4.4 wire 필드 caveat — 직접 재작성 대신
caveat + 오너십 분리 채택" 짧은 항목 추가 (§2.1/§2.2·EIA §6.2 패턴 연장, 3중 복제·재-drift 회피).

### 편집 3 — WARNING #2: `spec/5-system/14-external-interaction-api.md §6.2` line 593 dangling 정정
- 기존: `… parseWaitingForInput`. (WS §4.4 도 `nodeId` 로 표기돼 wire 와 drift — 별도 backlog.)
- 변경: `… parseWaitingForInput`. ([WS §4.4](./6-websocket-protocol.md#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input)
  의 논리 표기도 동일 wire 를 가리키며, 그 문서에 실제 wire 필드 caveat 를 명시함.)

### 편집 4 — WARNING #2: `spec/7-channel-web-chat/0-architecture.md §3` line 82 dangling 정정
- 기존: (EIA §6.2 / WS §4.4 는 `nodeId`/`node.id` 로 표기돼 wire 와 drift — 별도 backlog.)
- 변경: (EIA §6.2 는 notification 추상 표기, WS §4.4 는 논리 구조 표기이며, 두 문서 모두 실제 wire 필드
  caveat 를 명시한다.)

## 체크리스트
- [x] `/consistency-check --spec` (본 draft) — `review/consistency/2026/07/14/00_22_04/` **BLOCK: NO** (Critical 0). WARNING 2건(편집2 "전체 SoT" 과대·인용경로 오류) → 편집안 보정. INFO 2건 중 #1 반영(편집5), #2 미반영(선택). ※ 3 checker FS-write flakiness → 직접 Agent 재실행 전수 확보
- [x] 편집 1 적용 (4-ai-assistant.md §3.2 메시지 리스트 행 — markdown-renderer 역참조)
- [x] 편집 2 적용 (WS §4.4 intro — wire 필드 caveat, 오너십 분리·경로 정정 반영)
- [x] 편집 3 적용 (EIA §6.2 line 593 — dangling 정정 + 외부소비 SoT 명시)
- [x] 편집 4 적용 (architecture §3 line 82 — dangling 정정)
- [x] 편집 5 적용 (WS `## Rationale` — caveat 결정 근거, rationale_continuity INFO #1)
- [x] side-effect 점검 — dangling "별도 backlog" 잔존 0 ✓ / 앵커 heading 3건 실존 ✓ / 편집 5건 반영 ✓
- [x] commit `docs(spec): 웹챗 보안 cross-ref 역참조 + waiting_for_input wire 필드 drift caveat` (9960cbfc4)

## 완료 (2026-07-14)
두 WARNING 모두 spec 반영 완료. WARNING #2 는 미등재 dangling backlog 을 신규 backlog 파일 대신
순수 spec-doc caveat 로 **즉시 종결**(잔여 코드 작업 0 — 코드가 이미 SoT, 문서만 정합화). 후속 없음.
