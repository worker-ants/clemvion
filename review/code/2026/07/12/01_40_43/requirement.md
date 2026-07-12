# 요구사항(Requirement) 리뷰 — 웹채팅 위젯 multi-turn 히스토리 복원 통합 테스트 (fix 반영 후 재검증)

## 검증 방법
- 실제 소스 Read: `codebase/channel-web-chat/src/lib/widget-state.ts`(`mergeMessages`/`widgetReducer`), `src/lib/conversation.ts`(`threadToMessages`/`roleOf`/`stripUserInputMarkers`), `src/lib/eia-events.ts`(`parseWaitingForInput`), `src/lib/eia-client.ts`(`getStatus`), `src/lib/eia-types.ts`(`WaitingContext`/`ConversationTurn`), `src/widget/use-widget.ts`(`handleEiaEvent`/`seedWaitingFromStatus`/`applyConfig`) — 신규·수정 테스트의 각 assertion 을 line-level 로 대조.
- `spec/7-channel-web-chat/1-widget-app.md` §2(메시지 리스트 매핑 행)·§3.1(페이지 새로고침/이동 복원 행) Read — spec 본문과 테스트/코멘트 SoT 인용 대조.
- `git diff origin/main -- codebase/channel-web-chat/src/lib/widget-state.ts` 로 `mergeMessages` **함수 본문은 무변경**(JSDoc 만 교정)임을 확인.
- `npx vitest run src/lib/widget-state.test.ts src/widget/use-widget-eager-start.test.ts` 실제 실행 → **63/63 PASS**(직전 세션 62 + 이번 fix 로 추가된 빈-배열 스냅샷 케이스 1건).
- 직전 리뷰 세션(`review/code/2026/07/12/01_10_15/`)의 WARNING#1(Testing)·WARNING#2(Documentation)에 대해 `git show 462a23e4e` 로 실제 커밋 diff 를 RESOLUTION.md/SUMMARY.md 의 "조치 항목" 서술과 line-level 대조.

## 발견사항

없음(Critical/Warning 없음).

## 기능/spec 대조 결과 (문제 없음)

- **`mergeMessages` fix 검증**: `widget-state.ts` 의 diff 는 JSDoc 블록 교체뿐 — 함수 본문(`snapshot.length >= local.length ? snapshot : local`)은 한 글자도 바뀌지 않았다(순수 문서 정정, 회귀 위험 0). 새 JSDoc("하나를 통째로 선택한다(interleave·dedup 아님)")은 실제 구현·기존 함수명("병합")과의 괴리를 정확히 해소했다 — 직전 세션 WARNING#2(Documentation) 정확히 해소.
- **`waiting([])` 신규 케이스 검증**: `action.threadMessages`(`[]`)는 JS 진리값상 truthy 이므로 `widgetReducer` WAITING case(`widget-state.ts:129-137`)가 `mergeMessages(state.messages, [])` 를 호출한다. `mergeMessages([], [])`→`0>=0`→`[]` 반환(신규 리터럴, `toEqual` 로 검증해 참조 비교 오류 없음), `mergeMessages(local≠[], [])`→`0>=len`→`false`→`local` 그대로 반환. 두 분기 모두 테스트 assertion 과 정확히 일치.
- **`threadMessages=undefined` 코멘트 정정 검증**: `use-widget.ts` 의 두 프로덕션 dispatch 지점(`handleEiaEvent:151-155`, `seedWaitingFromStatus:233-241`) 모두 `threadToMessages(...)` 호출 결과를 그대로 전달하며, `threadToMessages`(`conversation.ts:50-51`, `if (!thread?.turns?.length) return [];`)는 **항상 배열**을 반환하고 `undefined` 를 반환하는 경로가 없다 — 테스트 신규 코멘트("타입 레벨 방어 분기, 프로덕션 미도달")가 실제 코드와 정확히 부합. 직전 세션 WARNING#1(Testing) 정확히 해소.
- **통합 테스트("복원 통합…") wire 형식 검증**: mock `context.interactionType`/`waitingNodeId`/`conversationThread.turns[].source`(`role` 없이 `source` 만)이 `WaitingContext`/`ConversationTurn` 타입(`eia-types.ts:47-59,135-142`)·`parseWaitingForInput`(`eia-events.ts:36-53`, top-level `interactionType`/`waitingNodeId`/`conversationThread` 그대로 매핑)·`roleOf`(`conversation.ts:42-46`, 명시 `role` 없으면 `source∈{presentation_user,ai_user}→user` 매핑)와 정확히 일치. `getStatus` 엔드포인트 매칭(GET, envelope `{data}`)도 `eia-client.ts:94-101` 실제 구현과 부합. `expect(webhookPosts(...).length).toBe(0)` 도 복원 경로가 `start()`(→webhook POST)를 호출하지 않는 실제 흐름(`applyConfig`→`RESTORED`+`seedWaitingFromStatus`, `use-widget.ts:516-538`)과 일치.
- **spec 본문 대조**: `1-widget-app.md` §2 메시지 리스트 행("turn source... user/assistant 축약... `[user-input]` strip... 새로고침 복원 시에도 이 매핑으로 과거 user/assistant 구분을 유지")과 §3.1 새로고침/이동 행("`waiting_for_input` 상태면 durable `conversationThread` 동봉... 전체 히스토리 복원")이 테스트·코드와 line-level 로 정합. `mergeMessages` 의 구체적 length-기반 select 알고리즘 자체는 spec 본문이 규정하지 않는 구현 세부사항(spec 은 "복원 시 히스토리를 유지한다"는 행위만 명세) — 회색지대로 문제 아님(INFO 대상도 아님, spec 이 침묵할 뿐 결함 아님).
- 직전 세션 산출물(`RESOLUTION.md`/`SUMMARY.md`)의 "조치 항목" 서술을 실제 커밋(`462a23e4e`)과 대조한 결과 완전히 일치 — 허위/과장 보고 없음.
- TODO/FIXME/HACK/XXX 주석 없음(diff 전체 grep 확인). 제품 코드 실질 변경은 JSDoc 1건뿐(회귀 위험 0) — 나머지는 test-only.
- `npx vitest run` 실행 결과 63/63 PASS 재확인(직전 세션 62 + 신규 1) — 회귀·거짓양성 없음.

## 참고 (INFO)

- **[INFO]** `plan/in-progress/webchat-multiturn-restore-test.md` 의 `/consistency-check --impl-done spec/7-channel-web-chat` 체크박스가 여전히 `[ ]`(미완료) — 테스트 파일이 `1-widget-app.md` `code:` glob(`codebase/channel-web-chat/**`)에 spec-linked 라 프로젝트 워크플로 상 gate 의무. 코드 정확성과는 무관한 프로세스 항목이며 본 리뷰(--impl-done 직전 단계로 보임) 이후 수행될 것으로 판단되어 blocking 아님.

## 요약
직전 리뷰 세션(01_10_15)에서 제기된 WARNING#1(Testing, `threadMessages=undefined` 커버리지 갭+오해 소지 코멘트)·WARNING#2(Documentation, `mergeMessages` JSDoc 과 실제 동작 불일치)가 커밋 `462a23e4e` 에서 정확히, 그리고 요구 이상의 부작용 없이 해소되었음을 소스·spec·테스트 실행 3중으로 재검증했다. `widget-state.ts` 의 유일한 변경은 JSDoc 교체뿐으로 함수 본문(`mergeMessages`)은 바이트 단위로 동일해 회귀 위험이 없고, 새 `waiting([])` 테스트는 실제 `action.threadMessages` truthy 판정·`mergeMessages` 의 `>=` 경계와 정확히 대응한다. 새로고침 복원 통합 테스트의 mock wire 형식은 `eia-types`/`eia-events`/`eia-client`/`conversation.ts` 의 실제 파싱 계약과 line-level 로 일치하며, spec `1-widget-app.md` §2/§3.1 의 복원·role 매핑 행과도 정합한다. Critical/Warning 수준 결함 없음.

## 위험도
NONE
