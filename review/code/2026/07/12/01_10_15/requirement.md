# 요구사항(Requirement) 리뷰 — 웹채팅 위젯 multi-turn 히스토리 복원 통합 테스트

## 검증 방법
- `codebase/channel-web-chat/src/lib/widget-state.ts`(mergeMessages/widgetReducer), `src/lib/conversation.ts`(threadToMessages/roleOf/stripUserInputMarkers), `src/widget/use-widget.ts`(handleEiaEvent/seedWaitingFromStatus/applyConfig 복원 경로)를 직접 Read 하여 신규 테스트의 각 assertion 이 실제 구현과 line-level 로 일치하는지 대조.
- `spec/7-channel-web-chat/1-widget-app.md` §2(메시지 리스트 매핑)·§3.1(페이지 새로고침/이동 복원 행)을 Read 하여 spec 본문과 테스트 코멘트의 SoT 인용이 정확한지 확인.
- `npx vitest run src/lib/widget-state.test.ts src/widget/use-widget-eager-start.test.ts` 실제 실행 — 62 tests 전부 PASS(신규 6건 포함) 확인.
- `git diff origin/main --stat` 로 변경 범위가 테스트 2파일 + plan md 1파일뿐임(제품 코드 무변경) 확인.

## 발견사항

- **[INFO]** `widgetReducer` 의 `WAITING` 액션에서 `threadMessages` 가 `undefined` 인 분기(“기존 messages 불변”)는 현재 프로덕션 호출부 2곳(`use-widget.ts:152-155`, `:234-241`) 모두 `threadToMessages(...)` 호출 결과(빈 배열이라도 `[]`)를 항상 전달하므로 실제로는 도달하지 않는 방어적 분기다.
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.test.ts:91-96` (`"threadMessages 없는 WAITING → 기존 messages 불변"`)
  - 상세: `WidgetAction`(`widget-state.ts:81`) 타입 상 `threadMessages?`가 optional 이라 reducer 계약(public contract) 단위로는 유효한 테스트이지만, "복원 시드" 문맥에서 실제 프로덕션 경로를 대표하는 케이스는 아니다. 결함은 아니며 커버리지 확장 자체는 무해하다.
  - 제안: 별도 조치 불요(정보성). 필요 시 테스트 주석에 "reducer 공개 계약 방어 커버리지(현재 프로덕션 호출부에선 항상 배열 전달)"를 한 줄 부연하면 다음 독자의 오해를 줄일 수 있다.

## 기능/spec 대조 결과 (문제 없음)

- `mergeMessages(local, snapshot) → snapshot.length >= local.length ? snapshot : local` (`widget-state.ts:182-185`) 와 신규 5개 테스트(빈 로컬+snapshot/snapshot 김/`>=`경계/snapshot 짧음/threadMessages 없음)가 1:1 정확히 대응 — 로직·경계값(`>=`) 모두 소스와 일치.
- `threadToMessages`/`roleOf`(`conversation.ts:42-65`)의 `ai_user→user`, `ai_assistant→assistant`, `[user-input]…[/user-input]` strip 이 통합 테스트(`use-widget-eager-start.test.ts` "복원 통합…") mock 데이터·assertion 과 정확히 일치. `presentation_user`/`ai_tool`/`system` 등 나머지 3개 source 매핑은 본 PR 스코프가 아니며 이미 `src/lib/conversation.test.ts` 가 별도로 exhaustively 커버(중복 없이 위임) — plan 의 "배경" 절 서술과 실제 코드가 일치.
- 통합 테스트의 흐름(저장 세션 pre-seed → `boot()`(open() 불필요) → `applyConfig` `RESTORED` dispatch → `seedWaitingFromStatus` → `WAITING` dispatch(threadMessages) → `mergeMessages`)이 `use-widget.ts:516-538`(`applyConfig`)·`225-251`(`seedWaitingFromStatus`) 실제 구현과 정확히 일치. `expect(webhookPosts(...).length).toBe(0)` 도 복원 경로가 `start()`를 호출하지 않는 실제 코드 흐름과 부합.
- spec `1-widget-app.md` §2("복원 thread…과거 user/assistant 구분을 유지") · §3.1 새로고침/이동 행("`waiting_for_input` 상태면 durable `conversationThread` 동봉 … 전체 히스토리 복원")과 테스트/코드가 line-level 로 정합. 테스트 상단 주석의 SoT 인용(`widget-state.ts mergeMessages, spec/7-channel-web-chat/1-widget-app §2·§3`)도 정확.
- TODO/FIXME/HACK/XXX 주석 없음. 제품 코드 변경 0(test-only) — 회귀 위험은 테스트 자체의 오탐/거짓양성 여부로 국한되며, 실행 결과 62/62 PASS 로 오탐 없음 확인.
- `plan/in-progress/webchat-multiturn-restore-test.md` 의 범위·워크플로 체크박스(`--impl-prep` 스코프아웃 근거, `--impl-done` spec-linked 의무, e2e 수행 근거)가 실제 diff·spec `code: codebase/channel-web-chat/**` glob 과 부합. `/ai-review`·`--impl-done` 체크박스가 미체크 상태인 것도 본 리뷰가 그 절차의 일부이므로 정합.

## 요약
순수 테스트 추가(제품 코드 변경 없음) PR로, `widgetReducer`의 비공개 `mergeMessages` 병합 정책(4분기 + `>=` 경계)과 새로고침 복원 시 multi-turn `conversationThread` → `state.messages` 시드 통합 경로를 실제 소스 대조·실행(62/62 PASS)으로 검증한 결과 모든 assertion 이 구현·spec 본문과 정확히 일치한다. Critical/Warning 수준 결함 없음. 유일한 관찰(INFO)은 `threadMessages=undefined` reducer 분기가 현재 프로덕션 호출부에서 도달 불가능한 방어적 코드라는 점이나, 이는 결함이 아니라 타입 계약 커버리지이며 조치 불요.

## 위험도
NONE
