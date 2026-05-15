### 발견사항

- **[WARNING]** 동일 세션에 대한 동시 요청 시 메시지 순서 역전 가능
  - 위치: `workflow-assistant-stream.service.ts` — `streamMessage()` 내 `appendMessage` 호출 구조
  - 상세: `loadMessages` → `appendMessage(user)` → LLM 처리 → `persistAssistantTurn(assistant)` 시퀀스가 원자적이지 않다. 동일 `sessionId`에 대해 두 요청이 동시에 진입하면 `loadMessages`가 서로의 메시지를 누락한 채 history를 조립하고, `appendMessage` 호출 순서가 뒤섞여 DB에 저장될 수 있다. 결과적으로 LLM에 전달되는 context가 부정합해진다.
  - 제안: 세션 단위로 동시 진입을 막는 분산 락(Redis-based lock) 또는 DB 레벨 serializable 트랜잭션을 적용하거나, `sessionId`를 키로 하는 인메모리 요청 큐(Map<sessionId, Promise>)를 서비스 레이어에서 관리해 순서를 직렬화한다.

- **[INFO]** AbortSignal 체크 위치가 yield 이전 청크 단위에만 적용됨
  - 위치: `google.client.ts` — `stream()` 내 `for await (const chunk of result.stream)` 루프 첫 줄
  - 상세: `signal?.aborted` 확인이 각 청크 진입 시점에만 이루어진다. 이미 `yield { type: 'text_delta' }`로 방출된 뒤 다음 청크 진입 전에 abort가 발생해도 현재 청크는 완전히 처리된다. Node.js 이벤트 루프 특성상 실제 경쟁 조건은 아니지만, 소비자 측에서 abort 후에도 text 이벤트가 추가로 도달할 수 있음을 인지해야 한다.
  - 제안: 현재 구조로 충분하나, 소비자(`workflow-assistant-stream.service.ts`)에서 `signal.aborted` 시 text_delta를 무시하는 guard가 있으면 명확성이 높아진다.

- **[INFO]** tool call ID 생성의 충돌 가능성
  - 위치: `google.client.ts` — `stream()` 내 `const id = \`call_${Date.now()}_${Math.random()...}\``
  - 상세: 동일 스트림 내에서 같은 밀리초에 두 개의 functionCall part가 처리될 경우 `Date.now()`가 동일하고 `Math.random()`의 7자 base36도 이론적으로 충돌 가능하다(확률 ~1/78억). Node.js 단일 스레드 환경에서 실제 문제가 되기 어렵지만, `randomUUID()`(이미 다른 곳에서 사용 중)로 교체하면 완전히 제거된다.
  - 제안: `import { randomUUID } from 'node:crypto'`를 사용해 `const id = \`call_${randomUUID()}\`` 로 교체.

- **[INFO]** `redact.ts` — 순수 재귀 함수, 공유 상태 없음. 동시성 문제 없음.

---

### 요약

세 파일 모두 Node.js 이벤트 루프 기반이므로 전통적인 스레드 경쟁 조건이나 데드락은 존재하지 않는다. 주요 위험은 `workflow-assistant-stream.service.ts`의 세션 레벨 동시성으로, 동일 세션에 두 요청이 병렬 진입하면 `loadMessages`→`appendMessage` 시퀀스가 비원자적으로 실행되어 LLM context가 오염될 수 있다. 나머지 사항(AbortSignal 타이밍, tool call ID 충돌)은 실환경 영향이 극히 낮은 INFO 수준이다.

### 위험도

**LOW**