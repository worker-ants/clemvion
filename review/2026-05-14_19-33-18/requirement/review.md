### 발견사항

- **[WARNING]** `ConversationThread.totalChars` 주석과 실제 사용 불일치
  - 위치: `conversation-thread.types.ts` — `totalChars` 필드 JSDoc, `thread-renderer.ts` — `applyCap` 함수
  - 상세: 타입 주석이 `"cap 빠른 경로 — applyCap에서 사용"`이라고 명시하지만, `applyCap`은 `ConversationThread` 객체를 받지 않고 `ConversationTurn[]`만 받는다. 내부적으로 `sumChars`를 통해 totalChars를 매번 재계산한다. 결국 `thread.totalChars`는 외부 소비(WebSocket payload 등)에만 사용되고, 명시된 "빠른 경로" 최적화는 구현되지 않았다.
  - 제안: 주석을 `"누적 char 길이 캐시 — WebSocket payload 및 외부 소비용"` 으로 수정하거나, `applyCap`에 `totalChars` 힌트 파라미터를 추가하여 `sumChars` 재계산을 생략하는 실제 최적화를 구현

- **[WARNING]** WebSocket waiting payload에 캡 미적용 전체 thread 포함
  - 위치: `execution-engine.service.ts` — form/button/ai waiting emit 세 곳 (각 `conversationThread: context.conversationThread` 추가)
  - 상세: `applyCap` (MAX 200,000자, 100 turns)이 LLM 주입 경로에만 적용되고, WebSocket 전송 시에는 unbounded한 `context.conversationThread` 전체가 페이로드에 포함된다. 장기 실행 워크플로에서 thread가 수천 turn, 수백만 char로 성장하면 WebSocket 메시지가 비정상적으로 커질 수 있다.
  - 제안: WebSocket emit 전 `applyCap`을 거쳐 capped snapshot을 전송하거나, thread payload를 별도 `GET /executions/:id/thread` 엔드포인트로 분리하고 WebSocket에는 `threadLength`, `threadTotalChars`만 포함

- **[WARNING]** 버튼 resume의 ConversationThread push가 통합 테스트 미검증
  - 위치: `execution-engine.service.spec.ts` — Phase 3 테스트, `execution-engine.service.ts` — `handleButtonResume` 경로
  - 상세: Phase 3 테스트(`appends presentation_user turn to ConversationThread on form resume`)는 form resume만 검증한다. button/carousel resume의 `button_click`, `button_continue` 인터랙션 타입은 `thread-renderer.spec.ts` 단위 테스트만 존재하며, engine 레벨에서 `appendPresentationInteraction`이 실제로 호출되는지 통합 수준에서 검증하지 않는다.
  - 제안: `button_click` resume에 대한 Phase 3 병렬 통합 테스트 추가 (form 테스트와 동일한 spy 패턴 적용)

- **[INFO]** `buildThreadView`의 `!thread` 가드가 dead code
  - 위치: `expression-resolver.service.ts` — `buildThreadView` 메서드
  - 상세: `ExecutionContext.conversationThread`가 이번 변경으로 required 필드(non-optional)가 되었으므로 `if (!thread) return undefined` 분기에 도달할 수 없다.
  - 제안: 가드 제거 또는 `conversationThread`를 optional로 유지하면서 일관성 확보

- **[INFO]** `execution-context.service.spec.ts`에서 `DEFAULT_THREAD_ID` 상수 대신 magic string 사용
  - 위치: `execution-context.service.spec.ts` — `id: 'default'`
  - 상세: 타입 파일 주석이 "magic string 직접 사용을 금한다"고 명시하지만 동일 PR의 테스트가 `'default'`를 직접 사용한다. 컨벤션 위반.
  - 제안: `import { DEFAULT_THREAD_ID } from '../conversation-thread/conversation-thread.types'` 후 `id: DEFAULT_THREAD_ID`로 교체

- **[INFO]** `$thread.text` 가 모든 `buildExpressionContext` 호출 시 즉시 렌더링
  - 위치: `expression-resolver.service.ts` — `buildThreadView`의 `text: renderThreadAsSystemText(thread.turns)`
  - 상세: 코드 주석이 "Lazy via getter would be ideal"이라고 인지하고 있지만, `$thread.text`를 사용하지 않는 표현식 평가에도 전체 thread 렌더링 비용이 발생한다. 큰 thread + 많은 노드 환경에서 매 노드 실행마다 반복 렌더링이 일어날 수 있다.
  - 제안: 단기적으로는 현 상태 유지 가능. 향후 성능 이슈 시 `Object.defineProperty`의 lazy getter 또는 memoization으로 전환

- **[INFO]** `buildAiNodeRefFromContext` — label이 nodeId(UUID)와 동일
  - 위치: `ai-agent.handler.ts` — `buildAiNodeRefFromContext`
  - 상세: `label: id`로 설정되어 thread에 UUID가 표시된다. 주석이 v2 작업으로 명시해 두었으나, 현재 thread 디버깅/UI 표시 시 가독성이 저하된다.
  - 제안: v2 이전까지는 허용 가능. `ExecutionContext`에 `nodeLabel?: string` 필드를 추가하는 경로를 v2 로드맵에 명시

- **[INFO]** `button_click` 데이터에서 `buttonLabel`, `buttonId` 모두 없을 때 빈 suffix 출력
  - 위치: `thread-renderer.ts` — `case 'button_click'`
  - 상세: `data.buttonLabel ?? data.buttonId ?? ''`에서 두 값이 모두 없으면 `'clicked: '`(빈 suffix)를 반환한다. 현재 테스트에서 이 경우를 커버하지 않는다.
  - 제안: 빈 문자열 fallback 처리 테스트 추가 또는 `'clicked: (unknown button)'`로 명시적 fallback

---

### 요약

ConversationThread 기능의 핵심 요구사항(단일 mutation 진입점, opt-out, seq 단조 증가, cap 3종, 표현식 노출, AI Agent contextScope 주입)은 모두 구현되어 있으며 스펙과 코드 간 의도-구현 일치도가 높다. 다만 `totalChars`의 "빠른 경로" 최적화가 선언만 되고 실제로는 미구현된 점, WebSocket 전송 시 thread에 크기 제한이 없는 점, button resume 통합 테스트가 누락된 점이 실제 운영 환경에서 문제가 될 가능성이 있는 요구사항 공백이다. 나머지 발견사항은 컨벤션·성능·가독성 수준이며 기능 동작에는 영향이 없다.

### 위험도

**LOW**