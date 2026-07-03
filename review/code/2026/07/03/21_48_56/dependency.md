### 발견사항

- **[INFO]** 새 외부 의존성 없음
  - 위치: 전체 6개 파일 (codebase/backend/src/modules/websocket/websocket.gateway.{ts,spec.ts}, codebase/frontend/src/lib/websocket/{use-execution-events.ts,ws-client.ts,__tests__/use-execution-events.test.ts,__tests__/ws-client.test.ts})
  - 상세: 이번 diff 는 `package.json`/lockfile 변경이 없고, 신규 `import` 구문도 없다. 프런트엔드 테스트에서 기존 `@testing-library/react` import 에 `act` 를 추가한 것과, `socket.io-client` 의 `Socket.active` 프로퍼티(백엔드 `client.join`/`client.leave` await 화 포함)를 참조한 것이 전부이며, 둘 다 이미 설치된 패키지의 기존 공개 API 다. `socket.io-client`(frontend) `^4.8.3`, `socket.io`(backend) `^4.8.3` 로 pin(caret) 되어 있고, `Socket.active` 는 socket.io-client v4.1.2+ 부터 제공되는 안정 API 라 버전 호환성 문제 없음.
  - 제안: 조치 불필요.

- **[INFO]** 내부 의존성 변경 없음
  - 위치: websocket.gateway.ts / websocket.gateway.spec.ts
  - 상세: `CHANNEL_AUTHORIZER`, `ExecutionEngineService`, `RetryTurnService`, `ExecutionsService` 등 기존 내부 모듈 의존 그래프에 변화가 없다. 이번 변경은 `client.join`/`client.leave` 호출을 `void`(fire-and-forget) 에서 `await` + try/catch 롤백으로 바꾸는 로직 변경과, 대응하는 테스트 보강뿐이다.

### 요약
이번 diff 는 06 concurrency 리팩터의 일환으로 WebSocket gateway 의 join/leave 를 await 화하고 프런트엔드 ws-client 의 연결 상태 가드(`active` 체크)와 이벤트 핸들러 이중 등록 방지(`bind` off-before-on) 로직을 추가한 순수 동작 변경이다. 신규 외부 패키지 추가, 버전 변경, lockfile 수정이 전혀 없으며 사용된 API(`socket.active`)는 이미 pin 된 `socket.io`/`socket.io-client` `^4.8.3` 의 기존 공개 인터페이스다. 의존성 관점에서는 검토할 리스크가 없다.

### 위험도
NONE
