---
worktree: widget-presentation-restore-357c22
started: 2026-07-10
owner: planner
---

# 웹채팅 위젯 — 복원 thread presentation 재현 (spec 정정 + truncation parity)

> 발단: "새로고침 복원 thread 의 presentation 이 렌더되지 않는다(shape 매핑 필요)" 는 과제 제기.
> **점검 결과 해당 기능은 이미 동작하며, spec 문구가 사실과 달랐다.** 아래 §1 참조.
> 관련 spec: `spec/7-channel-web-chat/1-widget-app.md` §2, `spec/4-nodes/6-presentation/0-common.md` §10.4,
> `spec/4-nodes/3-ai/1-ai-agent.md` §7.10.

## 1. 실증 결과 — 제기된 갭은 이미 닫혀 있음

| 체인 링크 | 상태 | 도입 |
| --- | --- | --- |
| `threadToMessages` 의 `presentations` passthrough + `DisplayMessage.presentations` | 구현됨 | #414 |
| `classifyPresentation`/`asEnvelope` 의 `PresentationPayload{type,toolCallId,renderedAt,payload}` 수용 | 구현됨 | **#707** |
| `panel.tsx` 의 `PresentationList` 렌더 | 구현됨 | #414 |
| `getStatus` → `context.conversationThread` 복원 시드 | 구현됨 | #874 |

`asEnvelope`([presentation.ts:115](../../codebase/channel-web-chat/src/lib/presentation.ts)) 가 `payload` 를
`config`·`output` 양쪽으로 펼치고, `classifyPresentation` 은 명시 `type` 을 fast-path 로 사용한다.
기존 단위 테스트도 이 shape 을 이미 덮는다(`presentation.test.ts:106-198`).

무수정 상태의 프로브 테스트로 복원 thread turn 의 carousel/table/chart/template 4종이 모두 렌더됨을 실측 확인.

**문구 출처**: `1-widget-app.md` §2 의 "알려진 제약(Planned)" 은 **#874 자신이 추가**했다(`git log -S` 확인).
#707 이 이미 해소한 상태에서 실측 없이 기록된 부정확한 서술이다.

## 2. 실제로 남아 있는 제약 (원인이 다름)

durable `conversation_thread` 의 `turn.presentations` 는 **AI `render_*` 툴 경로에서만** 채워진다 —
`appendAiAssistantMessage` 단일 경로(`conversation-thread.service.ts:107`, 호출자 `ai-turn-executor.ts:665`).

standalone presentation 노드(carousel/table/chart/template)는 `{config,output}` envelope 을
**SSE `execution.message` 로만** 발행하고(`execution-engine.service.ts:5459`) durable thread 에 쓰지 않는다.
`appendPresentationInteraction` 은 `data`(interaction 스냅샷)만 남기고 `presentations` 를 설정하지 않는다.

→ 따라서 "새로고침하면 standalone presentation 노드의 표시물은 복원되지 않는다" 는 **여전히 참**이지만,
원인은 위젯의 shape 매핑이 아니라 **thread 영속 모델**이다. spec 은 이를 위젯 렌더러 결함으로 오귀속하고 있었다.

## 3. 진짜 결함 — `PresentationPayload.truncation` 유실 (widget 한정)

`truncation` 은 `payload` **바깥** 최상위 필드다(`conversation-thread.types.ts:94`, ai-agent §7.10 type block).
`asEnvelope` 는 `payload` 만 펼치므로 이 필드를 구조적으로 볼 수 없다 → `toTable` 의 `output.rowsTruncated`
판정이 항상 `false` → "일부 행만 표시됩니다" 배너가 뜨지 않는다.

- standalone table 노드: `output.rowsTruncated` 를 output 안에 직접 넣어(`table.handler.ts:160`) 정상 동작.
- AI `render_table`: `truncation: { rowsTruncated, rowsTotalCount }` 를 최상위에 둔다(`render-tool-provider.ts:340-346`) → **유실**.
- **라이브 `ai_message` 경로에도 동일하게 존재하는 기존 버그** (복원 한정 아님).

spec `6-presentation/0-common.md` §10.4 는 이미 "`output.{itemsTruncated|rowsTruncated}` 와 **동등한 메타**가
top-level `presentations[i].truncation` 에 surface 한다" 고 규정한다 → **코드가 기존 spec 을 못 지킨 것**이며
spec 변경 불요. 메인 프런트엔드는 이 필드를 이미 소비한다(`assistant-presentations-block.tsx:316`) → 위젯만 outlier.

## 4. 변경안

### 4-1. spec (본 planner 트랙)

`spec/7-channel-web-chat/1-widget-app.md` §2 presentation 행을 정정:
- "알려진 제약(Planned) … 위젯 렌더러가 graceful 하게 무시(빈 렌더)" 서술 **삭제**(사실 아님).
- 위젯이 **두 shape 을 모두 수용**함을 명시: standalone 노드 `{config,output}` / AI `render_*` `PresentationPayload`.
- 남은 실제 제약을 정확한 원인과 함께 기술: durable thread 에는 AI `render_*` presentation 만 영속되므로
  standalone 노드 표시물은 새로고침 복원 대상이 아니다.
- `truncation` 메타 surface 를 렌더 계약으로 명시(0-common §10.4 와 정합).

### 4-2. 구현 (후속 developer 트랙)

- [x] `asEnvelope` 가 `PresentationPayload.truncation` 을 `output` 으로 흡수(`rowsTruncated`/`itemsTruncated`/
      `rowsTotalCount`/`itemsTotalCount`) → `toTable.truncated` 정상 동작.
- [x] 회귀 테스트 — 복원 thread turn 의 4종 presentation 렌더(`conversation.test.ts` + `presentations.test.tsx`).
- [x] 회귀 테스트 — AI `render_table` truncation 배너 노출.

> TDD red 확인: 신규 테스트 중 **truncation 2건만 실패**하고 복원 4종 렌더는 처음부터 통과 —
> §1 의 "이미 구현됨" 실증을 테스트가 재확인했다. 따라서 프로덕션 수정은 `asEnvelope` 1곳뿐.

### 4-3. 워크플로 체크리스트

- [x] `/consistency-check --spec` (22_27_45) — BLOCK: NO. WARNING 1 해소, INFO 3·4 반영.
- [x] `/consistency-check --impl-prep spec/7-channel-web-chat/` (22_41_55) — BLOCK: NO.
- [x] TEST WORKFLOW — lint PASS · unit PASS · build PASS · e2e PASS(249)
- [ ] `/ai-review`
- [ ] `/consistency-check --impl-done`

## 5. 본 PR 범위 밖 — 팔로우업 (impl-prep WARNING 3건)

impl-prep(22_41_55)이 검출한 WARNING 3건은 모두 **본 변경과 무관한 사전 존재 spec drift** 이며 planner 소관:

1. `spec/7-channel-web-chat/4-security.md` §4 가 EIA §8.4 `/interact` rate-limit(분당 60)을 "Planned" 로 오기재
   — SoT(EIA §8.4)는 "구현됨"(`InteractionRateLimiterService`). 중복 서술이 drift 원인.
2. `spec/2-navigation/_product-overview.md` NAV-WC-06(라이브 미리보기) 상태가 🚧 stale — 실제 완료(#web-chat-console).
3. `embed-config` 응답의 `{ data }` 봉투 표기가 `3-auth-session.md` §3 step 0 · `4-security.md` §3-①/I3 3곳 누락
   (런타임 영향 없음, 순수 문서 정정).

→ 본 PR 은 위젯 코드 + §2 계약 정정에 한정한다. 위 3건은 별도 spec-only 팔로우업으로 분리.

## Rationale

**R1 — spec 하향(제약 명시)이 아니라 정정(삭제+재기술)을 택한 이유.** 제기된 제약은 실측으로 존재하지
않음이 확인됐다(무수정 프로브 통과). 존재하지 않는 제약을 `Planned` 로 남겨두면 (a) 후속 작업자가 이미
구현된 변환기를 중복 구현하고, (b) 실제 남은 제약(standalone 노드 미영속)이 계속 가려진다. 따라서 문구를
삭제하고 **원인이 다른 진짜 제약**으로 대체한다.

**R2 — standalone 노드 복원을 "구현할 갭" 으로 등재하지 않는 이유.** durable thread 에 표시-전용 노드의
`{config,output}` 을 영속시키려면 `ConversationTurn` 에 새 source 또는 새 필드가 필요하고, 이는
conversation-thread 규약 §1.1 의 5-source enum 확장 영향이 크다. 현 시점 v1 은 "표시-전용 노드는 라이브
세션 한정" 이 의도된 범위이며(SSE `execution.message` 는 재생 버퍼 5분), 확장은 별도 결정 사안이다.
본 정정은 **현행 동작을 정직하게 기술**하는 데 그친다.

**R2-a — 백로그 등재 위치(consistency INFO 3 에 대한 명시적 선택).** 본 갭의 로드맵 미러는
`spec/7-channel-web-chat/_product-overview.md` §2 "비목표(v1 → 백로그)" 에 등재한다 — 영역 spec 의 백로그 SoT.
루트 `0-overview.md §6.3` 에는 등재하지 않는다: 본 갭은 웹채팅 채널 영역에 국한되고 cross-cutting 이 아니어서,
`execution-history` R-6 선례(영역 횡단 갭을 루트 로드맵에 미러)와 성격이 다르다. SoT 컨벤션
(`conversation-thread.md` §2.1) · 소비 문서(`1-widget-app.md` §2·§3.1) · 영역 백로그 3곳에 등재해
재발견을 막는다(consistency WARNING 1 해소).

**R3 — truncation 은 spec 변경 없이 코드 수정.** `0-common.md` §10.4 가 이미 `presentations[i].truncation` 을
`output.rowsTruncated` 와 동등한 메타로 규정하고, 메인 프런트엔드가 이를 소비한다. 위젯만 미소비이므로
spec 하향이 아니라 **코드를 spec 에 맞추는** 방향이 정합적이다. 위젯 spec §2 에는 렌더 계약으로만 명시한다.
