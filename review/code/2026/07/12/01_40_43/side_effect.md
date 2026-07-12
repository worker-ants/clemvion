# 부작용(Side Effect) Review — widget-state 복원 mergeMessages 테스트/JSDoc

## 발견사항

- **[INFO]** `mergeMessages` 는 배열을 참조 그대로 반환한다(방어적 복사 없음)
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts:614-617` (함수 본체는 이번 diff 로 변경되지 않음, JSDoc 만 정정됨)
  - 상세: `mergeMessages(local, snapshot)` 은 `snapshot` 또는 `local` 배열을 그대로(clone 없이) 반환하고, reducer 는 이를 `state.messages` 에 그대로 대입한다. 만약 어떤 호출부가 `threadMessages` 로 넘긴 배열을 넘긴 이후에도 계속 보유·재사용하며 in-place 로 mutate 한다면, 이미 커밋된 과거 `WidgetState.messages` 스냅샷까지 뒤늦게 오염될 수 있다(React 불변성 계약 위반).
  - 실측: 두 프로덕션 호출부(`use-widget.ts:154`, `:240`) 모두 `threadToMessages(...)` 의 반환값을 즉시 인라인으로 넘기며, `threadToMessages` 자체가 `thread.turns.filter(...).map(...)` 로 매 호출 **새 배열**을 생성한다(`conversation.ts:50-64`, 빈 케이스는 `[]` 리터럴). 따라서 현재 호출 경로에서 실제 aliasing/mutation 위험은 없다. `local` 쪽도 reducer 전체가 `{...state, ...}` spread 로 일관되게 불변 갱신하므로 이전 `state.messages` 참조가 다른 곳에서 mutate 되는 경로도 없다.
  - 제안: 조치 불필요(현재 호출부 기준 안전). 향후 `threadMessages` 를 캐시된/재사용 배열로 넘기는 새 호출부가 생기면 `mergeMessages` 에 방어적 복사를 고려할 것 — 이번 diff 스코프 밖.

- **[INFO]** 신규 통합 테스트가 파일 레벨 전역 stub(`fetch`, `EventSource`, `sessionStorage`)을 사용
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:641-702` (신규 "복원 통합" 테스트)
  - 상세: 테스트가 `window.sessionStorage.setItem(...)` 로 세션을 pre-seed 하고 `vi.stubGlobal("fetch", fetchMock)` 을 호출한다. 두 API 모두 jsdom 전역이라 파일 스코프 밖으로 누출될 수 있는 잠재적 부작용원이다.
  - 실측: 파일 최상단 `beforeEach`(`window.sessionStorage.clear()`, `EventSource` 재stub)와 `afterEach`(`vi.unstubAllGlobals()`)가 이미 전체 describe 블록에 적용되어 있어(`use-widget-eager-start.test.ts:865-871`), 신규 테스트도 기존 파일 관례를 그대로 따른다. 격리 신규 도입 없음, 회귀 없음.
  - 제안: 조치 불필요.

- **[INFO]** 신규 테스트가 공유 `initialState` 를 직접 mutate 하지 않음
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.test.ts:340, 350, 359, 368, 377, 380, 390`
  - 상세: 모든 신규 케이스가 `{ ...initialState, messages: [...] }` spread 패턴으로 새 객체를 만들어 `widgetReducer` 에 전달한다. `widgetReducer` 자체도 모든 case 에서 `{...state, ...}` 로 새 객체를 반환하는 순수 함수이며, 이번 diff 는 reducer 로직을 변경하지 않았다(변경분은 JSDoc 뿐).
  - 제안: 조치 불필요.

- **[INFO]** `review/`·`plan/` 하위 신규 문서 파일(8개) 커밋 — 파일시스템 신규 생성이지만 프로젝트 관례상 정상
  - 위치: `plan/in-progress/webchat-multiturn-restore-test.md`, `review/code/2026/07/12/01_10_15/*` (RESOLUTION.md, SUMMARY.md, 개별 리뷰어 산출물 등 11개 파일)
  - 상세: 다수의 새 파일이 생성되지만 전부 `plan/**`·`review/code/**` — CLAUDE.md 가 정의한 "코드 리뷰 산출물 저장 위치" 규약에 정확히 부합하는 예상된 산출물이다. 애플리케이션 코드·설정·환경에 영향 없음.
  - 제안: 조치 불필요.

## 검토했으나 해당 사항 없음

- 함수/메서드 시그니처 변경: 없음 (`WidgetAction`/`widgetReducer`/`mergeMessages` 공개 시그니처 불변, `threadMessages?` optional 필드는 이미 기존 타입에 존재).
- 전역 변수 신설: 없음 (테스트 로컬 `const` helper 뿐).
- 환경 변수 읽기/쓰기: 없음.
- 네트워크 호출: 신규 테스트의 `fetch` 는 전부 `vi.stubGlobal` mock이며 실 네트워크 호출 없음. 복원 경로에서 신규 webhook POST 가 발생하지 않음을 오히려 단언(`webhookPosts(fetchMock).length` === 0)하는 테스트로, 의도된 회귀 방지.
- 이벤트/콜백 변경: 없음. `mergeMessages` JSDoc 정정은 텍스트 주석뿐, 런타임 동작·이벤트 발행 경로 불변.

## 요약

이번 변경은 테스트 전용 추가(`widget-state.test.ts` 신규 6개 케이스, `use-widget-eager-start.test.ts` 신규 통합 케이스 1개)와 `mergeMessages` JSDoc 정정 1건, 그리고 plan/review 산출물 문서 커밋으로 구성되며 프로덕션 코드 로직 변경은 전무하다. reducer 는 여전히 순수 함수이고 공유 `initialState` mutate 없음, 테스트의 전역 stub(`fetch`/`EventSource`/`sessionStorage`)은 기존 파일 레벨 `beforeEach`/`afterEach` 가드로 이미 격리되어 신규 테스트도 동일하게 안전하다. `mergeMessages` 가 배열을 참조 그대로 반환하는 기존 특성은 현재 두 프로덕션 호출부가 매번 `threadToMessages` 로 새 배열을 생성해 넘기므로 실질 aliasing 위험이 없다. 부작용 관점에서 조치가 필요한 항목은 없다.

## 위험도

NONE
