### 발견사항

- **[WARNING] `spec/conventions/conversation-thread.md`(SoT 워킹트리 버전)에 위젯 role-축약의 정식 근거 문구가 아직 반영되지 않음**
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md` §2 "메시지 리스트" 행 — `presentation_user`·`ai_user`→**user**, `ai_assistant`·`ai_tool`·`system`→**assistant** 2-way 축약 렌더 서술.
  - 위반 규약: `spec/conventions/conversation-thread.md` §9 "미리보기 UI 렌더 규칙"(§9.1 source-별 시각 매핑·§9.2 3중 신호는 "강제")
  - 상세: 본 워킹트리(`.claude/worktrees/widget-presentation-restore-357c22`, 이 검토의 SoT)의 `conversation-thread.md` 를 직접 확인한 결과, §9 도입부(line 392) 직후에 있어야 할 `> **스코프 예외 — 임베드형 채널 위젯**` blockquote와 §8.2 "적용 surface 범위" 단락, §4 영속화 표의 "소비처는 (a) rehydration (b) SSE emit (c) `getStatus`... `redactThreadForPublic` 로 egress 마스킹" 문구, `code:` frontmatter 의 `interaction.service.ts` 항목이 **모두 부재**하다. 이 내용들은 sibling PR #899(`52f46f95f docs(spec): PR #874 defer 문서 보강 — R7 신설·§9 위젯 스코프 예외·conversation_thread 소비처 미러`)가 이미 `origin/main` 에 병합해 두었으나, 본 task 브랜치는 공통 조상(`cc3dafa8c`)에서 분기된 뒤 그 커밋을 아직 받지 못한 상태다(`git merge-base --is-ancestor 52f46f95f HEAD` → false). 즉 현재 SoT 워킹트리만 놓고 읽으면, `1-widget-app.md` §2 의 2-way 축약이 §9 의 "강제" 규정에 대한 명시적 예외 근거 없이 서술된 것처럼 보인다(§9 도입부 "Conversation Preview / history view" 한정 문맥으로 미루어 실질적으로는 scope 밖이라고 추론 가능하지만, 명시적 carve-out 문장은 현재 부재).
  - 제안: 이 task 브랜치를 `origin/main`(또는 최소 `52f46f95f`) 기준으로 rebase/merge 하여 `conversation-thread.md` 의 §9 scope-exception blockquote·§8.2 단락·§4 소비처 enumeration·`code:` 항목을 회수할 것. 두 PR 의 편집 영역은 겹치지 않아(§2.1 근처 vs §9/§4/frontmatter) 실제 merge 충돌 가능성은 낮으며, 단순 반영 누락이므로 conflict 없이 흡수될 가능성이 높다. 병합 전 반드시 재확인.

- **[INFO] `1-widget-app.md` R7 Rationale 서브섹션도 동일 원인으로 미반영 — 단, 정보 손실은 없음**
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md` `## Rationale` 말미(R6 다음).
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성(Overview/본문/Rationale)" 권장 — 결정 배경은 `## Rationale` 에 두는 정식 규약.
  - 상세: 같은 브랜치 분기로 인해 origin/main 이 보유한 `### R7. 헤더 세션 컨트롤 — booting 게이팅 + graceful/cancel 분기` 서브섹션이 이 워킹트리에는 없다. 다만 그 내용(부팅 게이팅 사유·graceful/cancel 분기 근거·optimistic 종료 근거)은 이미 §2 헤더 행과 §3.1 표 산문에 인라인으로 존재하므로 독자에게 실질 정보 손실은 없다 — R7 은 그 산문의 Rationale 승격본이었다.
  - 제안: 위 WARNING 과 동일한 rebase 로 자연 회수됨. 이 항목 자체가 이번 task(위젯 presentation 복원)의 책임 범위는 아니므로 별도 조치는 불필요하고, 병합 시점에만 확인하면 된다.

- **[INFO] target 문서 자체의 명명·포맷·구조 규약 준수는 양호**
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md` §2·§3.1 및 `_product-overview.md` 비목표 항목(diff 대상 전체).
  - 상세(위반 아님, 확인 결과 기록): `PresentationPayload{type,toolCallId,renderedAt,payload,truncation?}` 필드명·`output.{rowsTruncated|itemsTruncated|rowsTotalCount|itemsTotalCount}` 필드명은 [`spec/4-nodes/3-ai/1-ai-agent.md §7.10`](../../spec/4-nodes/3-ai/1-ai-agent.md)·[`spec/4-nodes/6-presentation/0-common.md §10.4`](../../spec/4-nodes/6-presentation/0-common.md)·[`2-table.md`](../../spec/4-nodes/6-presentation/2-table.md)·[`1-carousel.md`](../../spec/4-nodes/6-presentation/1-carousel.md) 과 1:1 일치. SSE 이벤트명 `execution.message` 는 [`14-external-interaction-api.md §5.2·R18`](../../spec/5-system/14-external-interaction-api.md) 에 등재된 정식 이벤트명과 일치. 모든 신규 cross-ref 앵커(`0-common.md#106-blocking-vs-display-only`, `#104-1mb-cap`, `1-ai-agent.md#710-...`, `conversation-thread.md#21-presentation-노드`)가 실제 존재. 문서 구조(`## Overview`/본문/`## Rationale`, `_product-overview.md`, `0-`~`5-` 넘버링, `id: web-chat-*` frontmatter)는 CLAUDE.md·기존 spec 관례와 일치. `codebase/channel-web-chat/src/lib/presentation.ts`(diff 대상 구현)도 spec 이 서술한 dual-shape 정규화·truncation whitelist 병합 규칙을 그대로 구현.
  - 제안: 조치 불필요 — 참고용 기록.

### 요약
diff 대상(`spec/7-channel-web-chat/1-widget-app.md` §2·§3.1, `_product-overview.md` 비목표 항목)은 그 자체로 명명·출력 포맷·문서 구조·상호 참조가 관련 정식 규약(AI Agent §7.10, Presentation 공통 §10.4/§10.6, EIA §5.2, conversation-thread §1/§2.1)과 정확히 일치해 실질 위반은 발견되지 않았다. 다만 이 검토용으로 지정된 SoT 워킹트리를 직접 열람한 결과, sibling PR #899 가 `origin/main` 에 이미 병합해 둔 `conversation-thread.md` 의 위젯 scope-exception 문서화(§9 blockquote·§8.2 단락·§4 소비처/egress 마스킹 서술·`code:` 프런트매터)가 이 브랜치엔 아직 반영되지 않아, 병합 전 rebase 없이는 그 정식 규약 문서화가 누락된 채로 남을 위험이 있다(R7 서브섹션도 동일 원인). 이는 이번 task 의 편집이 유발한 위반이 아니라 branch 분기에 기인한 반영 지연이며, 겹치지 않는 영역이라 rebase 시 충돌 없이 흡수될 가능성이 높다. (참고: 본 checker 에 제공된 `## 정식 규약 모음` payload 는 `audit-actions.md`·`cafe24-api-catalog/**` 만 포함해 정작 target 이 실제로 인용하는 `conversation-thread.md`/`interaction-type-registry.md`/`error-codes.md`/`swagger.md`/`node-output.md` 는 빠져 있었다 — 본 검토는 `spec/conventions/` 를 직접 열람해 이를 보완했다.)

### 위험도
LOW