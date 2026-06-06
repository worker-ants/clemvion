# 성능(Performance) 리뷰 — webchat-eager-start

## 발견사항

### [INFO] eager start 로 인한 방치 execution row 증가
- 위치: `use-widget.ts` `open()` / `newChat()`, `spec/7-channel-web-chat/1-widget-app.md §R6`
- 상세: lazy→eager 전환으로 패널 open 시마다 `POST /api/hooks/:path` 가 즉시 호출되어 execution row 가 생성된다. 사용자가 패널을 열었다 바로 닫는 경우("방치 execution") spec 에서는 "토큰 TTL/idle 만료에 위임"으로 명시했지만, 이는 서버 측 DB row 가 TTL 만료 전까지 잔류함을 의미한다. 위젯 측 close/destroy 시 `end_conversation` 명령을 보내지 않기 때문에 단순 방치 세션이 누적될 수 있다.
- 제안: 즉각적 성능 병목은 아니며 spec 상 알려진 트레이드오프로 문서화되어 있다. 단, 향후 대량 트래픽에서 방치 execution row 증가가 DB 스토리지·idle TTL 처리에 부담을 줄 수 있으므로, `close` 이벤트 혹은 일정 idle 타임아웃 후 `end_conversation` 명령을 보내는 cleanup 전략을 백로그에 추가하는 것을 권장한다.

### [INFO] `open()` 호출 시 `startedRef` 가드 — 중복 시작 방지 정상 동작
- 위치: `use-widget.ts` L1388 `if (startedRef.current || sessionRef.current) return;`
- 상세: React StrictMode 나 연속 `open()` 호출에서 중복 실행을 ref 수준에서 차단한다. `useCallback` deps에 `start`가 포함된 `open`, `newChat`이 매 렌더에서 새 함수 참조를 만들지 않도록 deps가 올바르게 선언되어 있다. 성능상 문제 없음.
- 제안: 없음(현행 유지).

### [INFO] `newChat()` 에서 `start()` 호출 전 `startedRef.current = false` 리셋 후 즉시 `start()` — race 가능성 낮음
- 위치: `use-widget.ts` `newChat()` (L1463–1470)
- 상세: `startedRef.current = false` 로 리셋한 뒤 동기적으로 `void start()` 를 호출하므로, `start()` 내부 가드 통과 후 `startedRef.current = true` 가 되기 전에 외부에서 `open()` 이 추가로 호출되면 두 번 시작될 여지가 있다. 단, `newChat` 은 UI 버튼 클릭으로만 트리거되고 `dispatch({ type: "NEW_CHAT" })` 이 `sessionRef.current = null` 리셋 후에 이루어지므로 실질적 race 확률은 매우 낮다.
- 제안: `startedRef.current = true` 를 리셋 직후가 아니라 `start()` 에 진입하는 첫 줄에서 세팅하는 현 구조는 올바르다. 추가 보호가 필요하면 `newChat` 에서 `startedRef.current = false` → `start()` 호출을 단일 마이크로태스크로 묶는 패턴을 고려할 수 있다.

### [INFO] `panel.tsx` disabled 조건 — 매 렌더마다 Boolean 연산 3회
- 위치: `panel.tsx` L776–780
- 상세: `phase !== "awaiting_user_message" || pending?.type === "buttons" || pending?.type === "form"` 은 O(1) Boolean 연산으로 복잡도 문제 없음. 단, `pending?.type` 을 두 번 참조하므로 변수로 추출하면 가독성 향상.
- 제안: 성능 영향 없음. 코드 스타일 선택의 영역.

### [INFO] `mergeMessages` — O(1) 비교로 효율적
- 위치: `widget-state.ts` L628–631
- 상세: `snapshot.length >= local.length` 조건만 비교하므로 O(1). 메시지 개수가 많아도 배열 전체 스캔이 없다.
- 제안: 없음(현행 유지).

### [INFO] `openStream` 에서 8개 이벤트 이름 배열 — 매 호출 시 리터럴 배열 생성
- 위치: `eia-client.ts` L178–188
- 상세: `openStream()` 이 호출될 때마다 `names` 배열(8개 문자열)이 새로 할당된다. `openStream`은 세션 시작·복원·`newChat` 시 호출되어 호출 빈도가 낮으므로 실질적 메모리 영향은 미미하다.
- 제안: 모듈 스코프 상수로 추출하면 이론적으로 반복 할당을 없앨 수 있으나, 실용적 이익은 없다.

### [INFO] `submitMessage` — `sessionRef.current` null 체크로 race 무시(메시지 유실)
- 위치: `use-widget.ts` L1431
- 상세: eager 전환으로 `booting` → `streaming` 사이에 사용자가 메시지를 보내려 해도 `sessionRef.current === null` 이면 조용히 무시된다. `panel.tsx` 에서 `awaiting_user_message` 에서만 입력창을 활성화하므로 정상 흐름에서는 이 경로가 실행되지 않는다. 성능 관점 문제는 없다.
- 제안: 없음.

## 요약

이번 변경은 lazy start(첫 입력 시)에서 eager start(패널 open 시)로 전환하는 리팩토링이다. 코드 자체의 성능 문제는 없다. reducer(`widgetReducer`)는 순수 함수이고 모든 연산이 O(1) 수준이며, `startedRef` 가드로 중복 HTTP 호출을 효과적으로 차단한다. 주목할 만한 트레이드오프는 순수 코드 성능이 아니라 "패널을 열었다 바로 닫는 방치 execution row"가 서버 측 DB에 누적될 수 있다는 점인데, 이는 spec §R6에서 이미 인식하고 있는 비용이다. 위젯 클라이언트 코드 범위 내에서 Critical 또는 Warning 수준의 성능 이슈는 발견되지 않았다.

## 위험도

NONE
