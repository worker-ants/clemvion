# 부작용(Side Effect) Review

## 리뷰 대상

- `codebase/channel-web-chat/src/lib/widget-state.test.ts` (widgetReducer WAITING/mergeMessages 분기 테스트 5건 추가)
- `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` (복원 통합 테스트 1건 추가)
- `plan/in-progress/webchat-multiturn-restore-test.md` (신규 plan 문서)

전체 diff 는 **test-only** — 제품/런타임 코드 변경 없음(진단자 사전 확인과 diff 자체 확인 일치).

## 발견사항

- **[INFO]** `initialState` 싱글턴을 매 테스트에서 spread 하지만 reducer 는 완전 불변 구현이라 오염 없음
  - 위치: `widget-state.test.ts` 신규 `describe("widgetReducer — WAITING threadMessages 병합...")`, 각 `it()` 의 `{ ...initialState, messages: ... }` 사용부
  - 상세: `widget-state.ts` 의 `widgetReducer` 를 직접 확인한 결과 모든 case 가 `{ ...state, ... }` 스프레드로 새 객체를 반환하고, `messages` 배열도 `[...state.messages, x]`(신규 배열) 아니면 `mergeMessages(local, snapshot)` 이 `snapshot`(신규 배열, WAITING dispatch 시 caller 가 전달) 또는 `local`(원본 참조, 그대로 반환) 중 하나를 그대로 리턴 — in-place mutation 이 전혀 없다. 따라서 여러 `it()` 가 공유 모듈 레벨 `initialState` 오브젝트를 스프레드해 사용해도 서로 오염시키지 않는다. 마지막 케이스("threadMessages 없는 WAITING → 기존 messages 불변")는 `expect(s.messages).toBe(local)` 로 참조 동일성까지 명시적으로 검증해, 불필요한 재할당(즉, 잠재적 향후 회귀로 배열을 매번 새로 만드는 것)이 없음을 락인한다. 부작용 관점에서는 문제가 아니라 오히려 불변성 회귀를 잡는 좋은 가드.
  - 제안: 조치 불필요.

- **[INFO]** 신규 통합 테스트의 `vi.stubGlobal("fetch", ...)` / `window.sessionStorage.setItem` 은 파일 전역 `beforeEach`/`afterEach` 가드로 정상 격리됨
  - 위치: `use-widget-eager-start.test.ts` 신규 `it("복원 통합: getStatus 다중 turn conversationThread → state.messages 를 role/text/순서대로 시드", ...)` (diff 상 `@@ -638,6 +638,73 @@` 삽입 지점, 전체 파일 기준 약 1098~1163행)
  - 상세: 이 테스트는 (1) `window.sessionStorage.setItem("clemvion-web-chat:session:t1", ...)` 로 세션을 사전 시드하고 (2) `vi.stubGlobal("fetch", fetchMock)` 으로 전역 `fetch` 를 교체한다. 두 조작 모두 파일 상단에 이미 존재하는(diff 로 변경되지 않은) 전역 훅으로 격리된다 — `beforeEach(() => { vi.stubGlobal("EventSource", FakeEventSource); window.sessionStorage.clear(); })` 이 다음 테스트 시작 전 `sessionStorage` 를 비우고, `afterEach(() => { vi.unstubAllGlobals(); })` 이 `fetch`/`EventSource` 스텁을 매 테스트 후 원복한다. 신규 테스트는 이 관례를 그대로 따르므로 cross-test leakage 나 un-restored global stub 위험이 없다.
  - 제안: 조치 불필요. (참고로 fetch mock 의 default 분기가 `Promise.reject(new Error("unexpected fetch ${u}"))` 로 막혀 있어, 예상 밖 URL 로의 실제 네트워크 호출도 원천 차단된다 — 파일 전역 관례와 동일.)

- **[INFO]** `renderHook` 인스턴스가 테스트 내에서 명시적으로 unmount 되지 않음(파일 전체의 기존 패턴, 이번 diff 로 신규 도입된 것 아님)
  - 위치: `use-widget-eager-start.test.ts` 신규 테스트의 `const { result } = renderHook(() => useWidget());` 호출부
  - 상세: `useWidget()` 훅은 토큰 리프레시 `setTimeout` 스케줄링·`EventSource` 구독 등 effect 를 갖는데, 이 테스트를 포함해 파일 내 모든 `it()` 가 반환된 `unmount()` 를 호출하지 않는다. `@testing-library/react` 는 `vitest.config.ts` 의 `globals: true` 설정 하에서 자동으로 `afterEach` cleanup(컴포넌트/훅 unmount)을 등록하는 것이 표준 동작이라 실제 누수는 없을 것으로 판단되나, 이 자동 정리는 `vitest.setup.ts`(`@testing-library/jest-dom/vitest` 만 import)에 명시적으로 나타나지 않고 라이브러리 기본값에 암묵적으로 의존한다. 신규 테스트가 새로 도입한 위험이 아니라 파일 전체의 기존 관례이므로 이번 diff 범위의 결함으로 분류하지 않는다.
  - 제안: 조치 불필요(diff 범위 밖). 다만 향후 auto-cleanup 이 비활성화되는 설정 변경이 있다면 실제 타이머/구독 누수로 이어질 수 있으니 인지만 해둘 것.

- **[INFO]** 신규 `import type { DisplayMessage } from "./conversation";` 는 type-only import — 런타임 부작용 없음
  - 위치: `widget-state.test.ts` 상단 import 추가
  - 상세: `import type` 이므로 모듈 초기화 코드가 실행되지 않는다(트랜스파일 시 완전히 제거). 부작용 없음.
  - 제안: 조치 불필요.

## 그 외 점검 관점 요약

- **전역 변수 신설/수정**: 없음. 새 `describe`/`it` 블록의 헬퍼(`user`/`bot`/`waiting`)는 해당 `describe` 스코프 내부 `const` 로, 모듈/전역 스코프 오염 없음.
- **파일시스템 부작용**: 없음. 신규 코드는 파일 I/O 를 하지 않는다(`plan/in-progress/webchat-multiturn-restore-test.md` 는 리뷰 대상 자체가 plan 문서 신설이며, 코드가 파일을 쓰는 것이 아니라 이번 변경 자체가 정적 문서 추가임).
- **시그니처/인터페이스 변경**: 없음. `widgetReducer`, `useWidget`, `mergeMessages` 등 어떤 함수 시그니처도 변경되지 않았다(테스트 파일만 diff).
- **환경 변수**: 읽기/쓰기 없음.
- **네트워크 호출**: 신규 테스트가 추가한 `fetchMock` 은 `vi.stubGlobal` 로 완전히 격리되고, 미매치 URL 은 reject 되어 실제 외부 호출 경로가 없다.
- **이벤트/콜백**: `window.dispatchEvent(new MessageEvent(...))`(`boot()` 헬퍼, 기존 함수 재사용) 를 통해 위젯 부트 이벤트를 주입하는 것은 기존 파일의 표준 패턴을 그대로 재사용한 것이며 신규 이벤트 타입이나 새 리스너를 도입하지 않았다.

## 요약

diff 는 순수 테스트 추가(2개 vitest 파일 + 1개 plan 마크다운)로, 제품/런타임 코드나 공개 인터페이스에 대한 변경이 전혀 없다. 신규 테스트가 사용하는 `vi.stubGlobal("fetch", ...)` 와 `window.sessionStorage.setItem` 은 모두 해당 파일에 이미 존재하는 전역 `beforeEach`(sessionStorage clear)/`afterEach`(unstubAllGlobals) 가드로 정상 격리되어 cross-test 오염이나 un-restored stub 위험이 없으며, `widgetReducer`/`mergeMessages` 소스를 직접 확인한 결과 완전 불변(immutable) 구현이라 공유 `initialState` 싱글턴을 여러 테스트에서 spread 해도 상호 오염되지 않는다. `renderHook` 미명시 unmount 는 파일 전체의 기존 관례이며 이번 diff 로 새로 생긴 위험이 아니다. 종합적으로 부작용 관점에서 실질적 위험은 발견되지 않았다.

## 위험도

NONE
