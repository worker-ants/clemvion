# 부작용(Side Effect) Review

## 발견사항

- **[INFO]** `start()` 의 `useCallback` 의존성 배열에 더 이상 직접 참조되지 않는 `sessionEstablished` 가 남아 있음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:612`
  - 상세: 이번 변경 전에는 `start()` 본문이 `if (sessionEstablished()) return; openStream(session, "0");` 로 `sessionEstablished()` 를 직접 호출했으므로 의존성 배열의 `sessionEstablished` 항목이 정당했다. 이번 diff 로 그 직접 호출이 `if (!openStream(session, "0")) return;` 로 대체되면서(게이트가 `openStream` 내부로 이동), `start()` 본문에는 더 이상 `sessionEstablished` 를 직접 참조하는 코드가 없다(전체 파일 `grep` 결과 `sessionEstablished()` 직접 호출은 `seedWaitingFromStatus`(494번째 줄 부근)와 `applyConfig`(920번째 줄 부근)에만 남아 있음). 다만 `sessionEstablished` 자체가 `useCallback(() => streamRef.current !== null, [])` 로 참조 안정적(empty deps)이라 `start` 콜백의 재생성 빈도 등 실질적 런타임 동작에는 영향이 없다 — 기능적 부작용은 아니다.
  - 제안: cleanup 성격의 항목이므로 급하지 않음. 추후 이 파일을 다시 만질 때 `eslint-plugin-react-hooks`(exhaustive-deps) 로 미사용 의존성을 정리하거나, 최소한 주석으로 "간접 의존(openStream 내부에서 사용)" 임을 남겨 두면 향후 유지보수자가 `start()` 본문에서 `sessionEstablished` 호출을 찾다가 헷갈리는 것을 방지할 수 있음.

## 점검 세부 결과 (관점별)

1. **의도치 않은 상태 변경**: `openStream` 내부에 새로 추가된 `if (streamRef.current !== null) return false;` 가드는 종전 두 호출부(`start()`·`applyConfig` 복원)가 `openStream` 호출 **직전** 동기적으로 수행하던 `if (sessionEstablished()) return;` 검사를 함수 **내부**로 옮긴 것과 동치다. 검사와 `closeStream()`/`streamRef.current = ...` 대입 사이에 `await` 등 비동기 경계가 없어(순수 동기 코드) 이전과 동일한 타이밍에 동일한 상태만 변경한다. `streamRef`/`clientRef` 외에 새로 건드리는 ref/상태 없음.
2. **전역 변수**: 새 전역 변수 없음. 모든 변경은 `useWidget()` 훅 내부 `useRef`/`useCallback` 스코프에 한정.
3. **파일시스템 부작용**: 없음. `plan/in-progress/webchat-usewidget-extraction.md` 변경은 체크리스트 문서 갱신(plan 라이프사이클 문서화)일 뿐 런타임 코드가 아니며 코드 실행 중 파일을 생성/수정/삭제하지 않음.
4. **시그니처 변경**: `openStream`(내부 `useCallback`)의 반환 타입이 `void → boolean` 으로 바뀌었다. `openStream` 은 `export` 되지 않고 `useWidget()` 이 반환하는 `actions` 객체(`open, close, start, submitMessage, clickButton, submitForm, newChat, endConversation, show, hide, updateProfile, sendResize`)에도 포함되지 않는 **완전히 비공개(모듈 내부)** 콜백이다. `grep` 으로 확인한 호출부는 `start()`(602번째 줄)과 `applyConfig`(951번째 줄) 두 곳뿐이며 둘 다 새 반환값 계약(`if (!openStream(...)) return;`)에 맞춰 이번 diff 에서 함께 수정됐다. 외부(다른 모듈·테스트가 `openStream` 을 직접 import)에 영향 없음.
5. **인터페이스 변경**: `useWidget()` 이 반환하는 공개 계약(`state, config, actions.{...}`)은 이번 diff 로 변경되지 않았다. 위젯을 사용하는 상위 컴포넌트/호스트 SDK 에 영향 없음.
6. **환경 변수**: 읽기/쓰기 변경 없음.
7. **네트워크 호출**: `client.openStream(...)`(EiaClient 의 실제 SSE 연결 생성)이 호출되는 조건이 바뀌지 않았다 — 오히려 게이트를 구조적으로 강제해 "이미 열린 세션에 대해 중복 `EventSource` 를 여는" 잠재적 이중 네트워크 연결(부작용)을 두 호출부 모두에서 일관되게 차단한다는 점에서 개선. `client` 미확립(부팅 전) 시 `true` 를 반환해 기존처럼 `scheduleRefresh()` 로 계속 진행하는 동작도 JSDoc·코드 모두 "기능 변경 없음"을 명시하고 실제로 그렇게 구현됨(`if (!client) return true;`).
8. **이벤트/콜백**: `onEvent: handleEiaEvent`, `onError: (e) => console.warn(...)` 콜백 배선은 변경되지 않았다. `dispatch`/`bridgeRef.current?.sendEvent(...)` 호출 위치·조건도 이번 diff 로 달라지지 않았다(스트림을 못 열면 `scheduleRefresh()` 까지 건너뛰는 동작은 종전 "손으로 복제된 가드"와 동일한 지점에서 동일하게 스킵됨).

## 요약

이번 diff 는 `openStream` 을 `void` 반환에서 `boolean` 반환("다른 시도가 세션을 넘겨받았는가")으로 바꾸고, 종전 `start()`·`applyConfig` 두 호출부에 손으로 복제돼 있던 `sessionEstablished()` 스트림 게이트를 `openStream` 함수 내부로 옮겨 구조적으로 강제한 리팩터링이다. `openStream` 은 export 되지 않는 훅 내부 전용 콜백이라 시그니처 변경의 영향 범위는 이 파일의 두 호출부로 완전히 국한되며, 두 곳 모두 이번 diff 에서 함께 갱신되어 있다. 가드 검사 시점·검사와 부수효과(`closeStream`/`streamRef` 대입) 사이의 동기성도 종전과 동일하게 유지되어 새로운 race window 를 만들지 않고, `client` 미확립 시 `true` 를 반환해 "기능 변경 없음" 이라는 JSDoc 주장과 실제 동작이 일치한다. 네트워크 호출(SSE 오픈) 관점에서는 오히려 두 호출부 모두에서 이중 `EventSource` 생성을 구조적으로 막아 부작용을 줄이는 방향이다. 발견된 유일한 항목은 `start()` 의 `useCallback` 의존성 배열에 더 이상 직접 참조되지 않는 `sessionEstablished` 가 남아있다는 INFO 성 잔재로, `sessionEstablished` 참조가 안정적이라 실질적 부작용은 없다. `plan/in-progress/webchat-usewidget-extraction.md` 변경은 문서 갱신뿐이라 부작용 없음.

## 위험도

LOW
