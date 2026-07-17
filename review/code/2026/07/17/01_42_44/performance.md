# 성능(Performance) Review

## 발견사항

- **[INFO]** `execution.replay_unavailable` 폴백이 매 이벤트마다 무조건 REST 재조회를 발생시킴 (디바운스/중복호출 방지 없음)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:1354-1360` (`handleEiaEvent` 의 `execution.replay_unavailable` 분기 → `seedWaitingFromStatusRef.current?.(client, session)`)
  - 상세: SSE 버퍼(5분) 만료 신호를 받을 때마다 `getStatus`(GET) 를 호출해 재동기화한다. 호출 자체는 반복문/루프 안이 아니라 단발 이벤트 핸들러이므로 N+1 패턴은 아니며, 이벤트 발생 빈도도 "5분 버퍼 만료" 라는 드문 조건이라 정상 사용 범위에서는 문제 없다. 다만 서버가 짧은 간격으로 `replay_unavailable` 을 반복 발사하는 예외적 상황(예: SSE 재연결이 계속 실패해 매 재연결마다 신호가 오는 경우)이면 in-flight 요청 여부를 확인하지 않고 매번 새 `getStatus` 호출이 나갈 수 있다. `seedWaitingFromStatus` 는 이미 `try/catch` 로 soft-fail 처리되어 있어 실패가 누적되지는 않는다.
  - 제안: 현재 구현으로 충분(호출량이 구조적으로 제한됨). 다만 향후 서버측 재연결 폭주 시나리오가 실제로 문제가 된다면 in-flight 플래그(예: `seedInFlightRef`)로 중복 호출만 스킵하는 가벼운 가드를 고려할 수 있음 — 지금 시점 필수 아님.

- **[INFO]** ref 홀더(`seedWaitingFromStatusRef`)에 대한 매 렌더 재대입
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:1447` (`seedWaitingFromStatusRef.current = seedWaitingFromStatus;`)
  - 상세: 컴포넌트 렌더 함수 본문에서 (이펙트 밖) 매 렌더마다 ref 를 재대입한다. `seedWaitingFromStatus` 는 `useCallback(..., [])` 로 참조가 stable 하므로 실질적으로 매번 동일 함수 참조를 재대입하는 것이라 연산 비용은 무시 가능(포인터 대입 1회/렌더)하다. 성능 영향은 없음 — TDZ 회피를 위한 의도된 패턴이며 주석으로도 명시됨.
  - 제안: 조치 불필요. (React 렌더 중 ref mutation 은 concurrent 렌더 재시도 시나리오에서만 이론적 이슈이나, 이 프로젝트는 해당 패턴을 다른 곳에도 이미 사용 중이며 idempotent 대입이라 실무 영향 없음.)

- **[NONE]** 나머지 diff(테스트 헬퍼 추출, DTO 주석, plan/spec 문서)는 런타임 성능에 영향 없음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` (EventSource stub 공용화), `codebase/backend/.../webauthn-response.dto.ts` (JSDoc), `plan/in-progress/*.md`, `spec/7-channel-web-chat/1-widget-app.md`
  - 상세: 테스트 파일은 로컬 변수 캡처(`latestEs`/`latest`)를 `getEs()` 클로저로 교체하고 4곳에 중복됐던 `EventSource` stub 클래스를 `installControllableEventSource()` 로 통합한 순수 리팩터다. 알고리즘 복잡도·호출 횟수 변화 없음(테스트 실행 시간에도 실질 영향 없음, 26→27 tests). DTO/문서 변경은 주석·서술뿐.
  - 제안: 해당 없음.

## 요약
이번 변경의 핵심은 EIA SSE 5분 버퍼 만료 신호(`execution.replay_unavailable`)를 받을 때 기존 `seedWaitingFromStatus`(단발 `getStatus` REST 폴백)를 재사용해 재동기화하는 배선이며, 이는 반복문·루프 내 호출이 아니라 드문 단발 이벤트에 묶인 1회성 네트워크 호출이라 N+1/블로킹/캐싱 관점에서 문제가 되지 않는다. ref 홀더를 통한 TDZ 회피 패턴도 stable 참조 재대입뿐이라 무시 가능한 오버헤드다. 테스트 리팩터·DTO 주석·plan/spec 문서 변경은 런타임 경로에 전혀 영향을 주지 않는다. 전반적으로 성능 관점에서 우려할 사항이 없다.

## 위험도
NONE
