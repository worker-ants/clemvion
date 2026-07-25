# Cross-Spec 일관성 검토 — `spec/conventions/` (node-cancellation.md §1·§6 정정 검증)

## 방법론 메모

프롬프트 번들은 이번에도 컨텍스트 예산을 초과해 target 문서 자체
(`spec/conventions/node-cancellation.md`)와 가장 관련 깊은 파일(`chat-channel-adapter.md`,
`execution-context.md`, `5-system/15-chat-channel.md`, `data-flow/14-chat-channel.md`,
`4-nodes/1-logic/10-parallel.md` 등)가 **본문 없이 파일명만** 나열됐고, `## 구현 변경 사항`
diff 섹션 자체가 프롬프트에 존재하지 않았다. 이에 지시대로 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/node-cancel-chat-9f3e`, 절대경로)를 직접
Read/Grep/`git show`로 열어 진행했다.

검토 대상: 커밋 `babaf0030`(`docs(spec): chat-channel 범주 오류 제거 + commerce 2행 상태 갱신
(node-cancellation §1·§6)`)이 직전 라운드(`review/consistency/2026/07/26/00_08_39`)가 낸
**CRITICAL**(chat-channel "노드" 오분류)과 부수 **WARNING**(MakeShop/Cafe24 §6 행 staleness)을
실제로 해소했는지, 그리고 그 정정이 다른 spec 영역과 새 모순을 만들지 않았는지.

## 발견사항

### 검증 결과 — 이전 CRITICAL 은 해소됨, 새 cross-spec 모순 없음

1. **§1 "목적" 목록 정정 확인** — `spec/conventions/node-cancellation.md:24` 는 이제
   `"HTTP / DB / AI / Email / 이커머스 통합 Cafe24·MakeShop"` 로 chat-channel 이 제거됐다.
   `spec/1-data-model.md §2.8 Trigger.type`(`chat-channel 은 별도 type 이 아니라 webhook 트리거의
   config.chatChannel 변형`)과 정합.

2. **§6 표 chat-channel 행 정정 확인** — 137행이 `~~chat-channel 노드 signal 전파~~ | N/A |
   범주 오류로 철회…` 로 재기재됐고, 서술(webhook 트리거의 `config.chatChannel` 변형·
   `modules/chat-channel/**` 는 `executionEvents$` 를 구독하는 outbound 어댑터·§4 cascade 대상
   아님·취소 시 오히려 `execution.cancelled` 를 발송)이 아래 두 독립 SoT 와 **정확히 일치**한다.
   - `spec/5-system/15-chat-channel.md` CCH-AD-05(어댑터가 `WebsocketService.executionEvents$` 를
     `onModuleInit` 에 구독하는 outbound listener) 및 Rationale R1(새 트리거 유형 신설하지 않음 —
     webhook + config 갈래로 유지).
   - `spec/data-flow/14-chat-channel.md §1.2 "Outbound"` — `ChatChannelDispatcher` 가 구독하는
     이벤트 5종에 `execution.cancelled` 가 명시적으로 포함(`... / 'cancelled') + chat-channel-internal
     execution.node.completed ...`), node-cancellation.md 의 "취소 시 발송" 서술과 완전 정합.
   - 범례에 `N/A = 범주 오류로 대상에서 철회(애초에 노드가 아님)` 가 신설돼, 직전 02_52_18 라운드가
     지적한 INFO(범례 미정의)도 함께 해소됐다.

3. **저장소 전수 grep 재확인** — `grep -rn "chat-channel.*노드\|노드.*chat-channel" spec/` 결과,
   chat-channel 을 "노드"로 서술하는 지점은 이제 node-cancellation.md 137행(취소선 처리된 묘비, N/A
   라벨)뿐이다. `4-nodes/7-trigger/0-common.md`·`4-nodes/7-trigger/providers/telegram.md`·
   `conventions/chat-channel-adapter.md`·`5-system/15-chat-channel.md`·`data-flow/14-chat-channel.md`
   등 다른 모든 참조는 이미 "webhook 트리거의 config.chatChannel 변형" / "어댑터" 로 정확히
   서술하고 있었다 — 이번 정정이 새로 만든 잔여 불일치 없음.

4. **MakeShop/Cafe24 §6 행 ✓ 갱신의 사실관계 실측** — 138~139행이 `— 미구현 (Planned)` 에서 `✓`
   로 바뀌었고, 근거로 인용한 커밋 `e83da5052`(#1019)를 직접 대조했다.
   - `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.ts` /
     `cafe24-api.client.ts` — §4 cascade(already-aborted 분기 포함) 실측 확인.
   - `makeshop.handler.ts:259` / `cafe24.handler.ts:272` — `err.name === 'AbortError'` 재throw
     가드 실측 확인(엔진의 `isAbortError` catch 가 도달하도록 하는 구현).
   - `makeshop.handler.spec.ts:577` / `cafe24.handler.spec.ts:750` — `describe('abortSignal
     forwarding (node-cancellation §4)')` > `it('rethrows AbortError so the ENGINE can classify
     the node as cancelled')` 테스트가 실제로 존재하며 인용 위치와 거의 일치(±수 줄, 파일 상단
     주석 삽입 여파로 자연스러운 편차).
   - 새로 쓴 §6 행 서술(“client 의 §4 cascade **와** handler 의 §5.1 AbortError 재throw — 둘 다
     있어야 엔진이 cancelled 로 분류”)은 node-cancellation.md 자체 §4/§5.1 정의와도 합치하고,
     e83da5052 커밋 로그가 기록한 "handler 가 AbortError 를 삼켜 cancelled 분류에 도달하지
     못하던 문제"를 고친 이력과도 정합적이다 — 과장 없는 정확한 요약이다.

5. **`4-nodes/1-logic/10-parallel.md:244` 동반 정정 확인** — "2026-07-26 기준 signal-aware 는
   HTTP / DB / AI / 이커머스 통합 Cafe24·MakeShop 이며, Email 은 사전 abort 체크만 … chat-channel
   은 노드가 아니라 webhook 트리거의 outbound 어댑터라 애초에 대상이 아니다" 로 갱신됐다. 이
   목록은 node-cancellation.md §6 표의 현재 상태(HTTP ✓/DB ✓/AI ✓/Email 🚧/MakeShop ✓/Cafe24 ✓/
   chat-channel N/A)와 1:1 대응 — 같은 사실을 서술하는 두 문서 사이에 새 drift가 없다.

6. **plan 라이프사이클 정합** — 커밋이 갱신한 두 in-progress plan
   (`node-cancellation-residual-signal-propagation.md`, `spec-update-node-cancellation-shutdown-
   classification.md`)의 "이행 완료" 포인터가 실제로 `plan/complete/spec-draft-node-cancellation-
   chat-channel-correction.md` 로 이동한 초안 문서를 정확히 가리키며, 그 초안의 변경 범위(§1/§6
   chat-channel + §6 commerce 2행)가 실제 diff 와 1:1 일치한다. 순환·유령 참조 없음.

### [INFO] 사전 존재하던(이번 diff 무관) 잔여 stale 포인터 1건 — 새 drift 아님

- 위치: `spec/4-nodes/3-ai/1-ai-agent.md:1374` — `"사용자 cancel signal 전파는
  node-cancellation-infrastructure 후속으로 남지만…"`
- 상세: `node-cancellation-infrastructure.md` 는 2026-06-28 에 이미 완료·`plan/complete/` 로 이동했고
  (`node-cancellation-residual-signal-propagation.md` Overview 가 이를 명시), 잔여 항목의 현재
  추적처는 `node-cancellation-residual-signal-propagation.md` 다. 이 링크는 `babaf0030` 이전부터
  존재하던 staleness이며 본 커밋이 건드린 파일(§1·§6, `10-parallel.md`)과 무관해 **이번 정정이
  만든 새 drift가 아니다**. 차단 사유 아님, 참고용으로만 기록.

## 요약

`babaf0030` 은 직전 impl-done 라운드(`00_08_39`)가 낸 유일한 CRITICAL(chat-channel을 "노드"로
오분류해 `1-data-model.md §2.8`·`5-system/15-chat-channel.md` CCH-AD-05 와 정면 모순)을 완전히
해소했다 — §1 목록에서 제거, §6 행을 묘비(N/A, 취소선)로 재기재하고 그 서술이 `15-chat-channel.md`
Rationale R1·CCH-AD-05 및 `data-flow/14-chat-channel.md §1.2`(구독 이벤트 5종에 `execution.cancelled`
명시)와 독립적으로 정합함을 확인했다. 부수 WARNING(MakeShop/Cafe24 행 staleness)도 실제 병합된
구현(`e83da5052`/#1019)의 client cascade + handler AbortError 재throw + 대응 단위 테스트 4건과
1:1 대조해 정확함을 확인했다. `10-parallel.md:244`의 동반 정정도 §6 표 현재 상태와 어긋남 없이
같은 사실을 재서술한다. 저장소 전수 grep 으로 chat-channel을 "노드"로 오분류하는 다른 잔여 지점이
없음을 재확인했고, plan 라이프사이클(위임 → 초안 → complete 이동) 도 실제 파일 이동과 정확히
대응해 유령 참조가 없다. 새로 발견된 문제는 이번 diff와 무관한 사전 존재 stale 링크 1건(INFO)
뿐이며, 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 어느 축에서도 새 cross-spec 충돌은
없다.

## 위험도

NONE

STATUS: OK
