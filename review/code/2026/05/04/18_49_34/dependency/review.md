### 발견사항

---

**[WARNING]** `lib/websocket` → `components/editor/run-results` 역방향 의존성

- **위치**: `frontend/src/lib/websocket/use-execution-events.ts`
  ```ts
  import { messagesToConversationItems } from "@/components/editor/run-results/conversation-utils";
  ```
- **상세**: `lib/` 계층은 통상 `components/`보다 하위 레이어로, `lib` → `components` 방향 임포트는 의존성 방향이 역전된다. `conversation-utils.ts`가 `components/` 트리에 있는 한, `lib/` 파일이 이를 직접 참조하면 추후 `conversation-utils`를 다른 컴포넌트에서 분리하거나 테스트할 때 `lib/`까지 끌려오는 문제가 생긴다.
- **제안**: `messagesToConversationItems`와 관련 타입(`RawMessage`, `ToolStatusInfo`, `ConvertOptions`)을 `lib/utils/conversation-utils.ts` 또는 `lib/stores/conversation-utils.ts`로 이동하고, `components/editor/run-results/conversation-utils.ts`는 그 경로를 re-export하는 얇은 래퍼로 유지한다.

---

**[WARNING]** 노드 핸들러(`ai-agent.handler.ts`)가 인프라 서비스(`WebsocketService`)를 직접 임포트

- **위치**: `backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`
  ```ts
  import { ExecutionEventType, WebsocketService } from '../../../modules/websocket/websocket.service';
  ```
- **상세**: 노드 핸들러는 도메인 로직을 담당하는 계층인데, 인프라 계층(`websocket` 모듈)을 직접 참조하게 되었다. `optional` 파라미터로 완화했지만 임포트 자체가 컴파일 타임 결합을 만든다. `ExecutionEventType`의 enum 값을 핸들러가 알아야 한다는 것도 불필요한 지식 의존이다.
- **제안**: 핸들러에 콜백/이벤트 에미터 인터페이스(`ToolEventEmitter`)를 주입하는 방식을 검토한다. 또는 최소한 `ExecutionEventType`을 핸들러 쪽 인터페이스 파일(`node-handler.interface.ts` 근방)에 상수로 분리해 websocket 모듈 임포트를 제거한다.

---

**[INFO]** `tryParseJson` 함수 중복 정의

- **위치**: `frontend/src/lib/websocket/use-execution-events.ts` (신규) + `frontend/src/components/editor/run-results/conversation-utils.ts` (기존)
- **상세**: 동일한 함수가 두 파일에 각각 정의되었다. 외부 패키지 문제는 아니지만, 위의 역방향 의존성 해결(공유 `lib/` 유틸리티로 이동)이 완료되면 이 중복도 자동으로 제거된다.
- **제안**: `lib/utils/parse-json.ts` 등 단일 위치로 추출한다.

---

**[INFO]** `HandlerDependencies`에 추가된 `websocketService?` — 모든 핸들러에 불필요한 인프라 노출

- **위치**: `backend/src/nodes/core/node-component.interface.ts`
  ```ts
  websocketService?: WebsocketService;
  ```
- **상세**: 현재 이 필드를 소비하는 핸들러는 `AiAgentHandler` 하나뿐이다. 나머지 수십 개의 핸들러는 이 필드를 무시하지만, 인터페이스에 올라가 있으므로 모든 핸들러 팩토리가 이 서비스의 존재를 인지해야 한다. 향후 WS 이벤트가 필요한 핸들러가 늘어날 때 올바른 패턴이지만, 현 시점 사용처가 하나임에도 공용 인터페이스를 확장한 것은 YAGNI 측면에서 주의가 필요하다.
- **제안**: 당장 제거할 필요는 없으나, 여러 핸들러에서 사용 계획이 없다면 `AiAgentHandler`의 생성자 파라미터로만 유지하고 `HandlerDependencies`에서 제외하는 것도 고려한다.

---

**[INFO]** 새로운 외부 패키지 없음 — `Loader2` 아이콘 추가는 기존 `lucide-react` 임포트 확장

- **위치**: `frontend/src/components/editor/run-results/conversation-timeline-item.tsx`
  ```ts
  import { CheckCircle, Loader2, XCircle, Wrench } from "lucide-react";
  ```
- **상세**: `lucide-react`는 기존 의존성이며 `Loader2`는 해당 패키지 내 아이콘 추가다. 번들 크기 영향은 tree-shaking 기준 단일 아이콘 추가(~1KB)로 무시 가능하다.
- **제안**: 없음.

---

### 요약

이번 변경에서 새로운 외부 npm 패키지는 추가되지 않았으며, 취약점·라이선스·버전 충돌 문제는 없다. 핵심 의존성 리스크는 두 가지로, 첫째 `frontend/src/lib/websocket/use-execution-events.ts`가 `components/` 트리의 `conversation-utils.ts`를 직접 임포트해 `lib` → `components` 역방향 결합이 발생한 것, 둘째 `ai-agent.handler.ts`(도메인 계층)가 `websocket.service.ts`(인프라 계층)를 직접 임포트해 계층 간 결합이 생긴 것이다. 두 문제 모두 기능 동작에는 지장이 없으나 유지보수성과 테스트 독립성에 영향을 줄 수 있으며, 특히 `conversation-utils`의 위치 이동이 가장 우선순위가 높은 개선점이다.

### 위험도

**LOW**