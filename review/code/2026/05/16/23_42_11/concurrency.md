### 발견사항

- **[WARNING]** WebSocket handleSubscribe: await 이후 MAX_SUBSCRIPTIONS 재검사가 여전히 TOCTOU 경쟁 조건에 노출됨
  - 위치: `backend/src/modules/websocket/websocket.gateway.ts` 라인 1608–1618 (패치 기준)
  - 상세: W-68 조치로 `authorize()` 완료 후 `clientSubs.size >= MAX_SUBSCRIPTIONS_PER_CONNECTION` 재검사를 추가한 것은 올바른 방향이다. 그러나 Node.js 이벤트 루프는 단일 스레드이므로 동일 clientId 에서 두 개의 subscribe 이벤트가 거의 동시에 도달하면 다음 시나리오가 가능하다: (1) 요청 A가 authorize() await 진입 → (2) 요청 B가 authorize() await 진입 → (3) A가 재검사 통과 (size < MAX) → (4) B가 재검사 통과 (size 아직 A 미반영) → 두 요청 모두 add. 이는 `clientSubs`가 Map/Set 같은 동기 자료구조라는 전제 하에, `await` 경계를 넘어선 TOCTOU(Time-Of-Check-Time-Of-Use) 패턴이다. JavaScript의 단일 스레드 특성상 실제 발생 가능성은 낮으나, 외부 I/O(authorize 내부에 DB/Redis 조회가 있다면)가 개입하면 두 microtask 사이의 인터리빙으로 한도 초과가 발생할 수 있다.
  - 제안: subscribe 핸들러를 클라이언트별로 직렬화하거나, "check-then-add" 를 단일 동기 블록 안에서 처리하도록 리팩토링한다. 가장 단순한 방법은 `authorize()` 이후 재검사와 `clientSubs.add()` 를 하나의 동기 함수(async 없는 helper)로 분리해 원자성을 보장하는 것이다. 또는 per-client Promise 큐(직렬화 큐)를 두어 동일 소켓의 subscribe 요청이 중첩되지 않도록 한다.

- **[INFO]** `sanitizePayloadForWs` 최적화(W-25): 원본 참조 반환 시 공유 상태 돌연변이 위험 없음 확인
  - 위치: `backend/src/modules/websocket/websocket.service.ts` 라인 1693–1709 (패치 기준)
  - 상세: 변경 없는(unchanged) 경우 원본 객체 참조를 그대로 반환한다. 반환된 참조가 WebSocket 전송 후 외부에서 변경되면 이미 전송된 데이터와 다를 수 있다. 단, WebSocket `emit`이 직렬화(JSON.stringify) 를 수행하므로 전송 후 변경은 영향 없다. 전송 전 공유 객체를 동시에 수정하는 경로가 없는지 호출 측 코드를 확인 권장.
  - 제안: 이슈로 등록하기보다는 코드 주석으로 "반환 참조는 JSON 직렬화 이전에 외부에서 수정하지 말 것" 을 명시하면 충분하다.

- **[INFO]** `credentials-transformer.ts`의 모듈 수준 Logger 인스턴스(W-31)는 단일 인스턴스로 공유되어 thread-safe
  - 위치: `backend/src/modules/integrations/services/credentials-transformer.ts` 라인 1421
  - 상세: `const logger = new Logger(...)` 를 모듈 최상단에 선언했다. NestJS Logger는 내부적으로 상태를 거의 갖지 않으며, Node.js 단일 스레드 환경에서 문제없다. `warnedMissingKey`, `warnedUnreadable` 플래그도 동일 이유로 경쟁 조건 없음.
  - 제안: 현재 구현 무방. 다만 멀티 프로세스(cluster mode) 전환 시 플래그가 프로세스별로 분리되어 warn 중복 출력될 수 있음을 문서화 권장.

### 요약

이번 변경에서 동시성 관점에서 유의미한 수정은 W-68(WebSocket handleSubscribe await 이후 구독 수 재검사)이다. 재검사 추가는 적절하나, `authorize()` 가 외부 I/O를 포함하면 동일 소켓에서 복수의 subscribe 요청이 병렬로 진입해 재검사를 모두 통과하는 TOCTOU 경쟁 조건이 잔존한다. Node.js 이벤트 루프의 단일 스레드 특성 덕분에 실제 발생 빈도는 낮으나 이론적으로 한도 초과가 가능하므로 WARNING으로 분류한다. 나머지 변경(SQL 마이그레이션, 의존성 업데이트, DTO 검증, Logger 교체, 통계 쿼리 통합, README 수정)은 동시성 영역과 무관하거나 안전하다.

### 위험도
LOW
