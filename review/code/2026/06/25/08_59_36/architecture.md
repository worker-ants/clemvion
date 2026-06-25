# 아키텍처(Architecture) 리뷰

## 발견사항

### **[INFO]** `execution.message` 이벤트 - additive SSE 표면 설계의 레이어 경계 준수 양호
- 위치: `codebase/backend/src/modules/websocket/websocket.service.ts`, `execution-engine.service.ts`
- 상세: `execution.message` 를 node-level `execution.node.completed` (firehose)와 분리해 execution-level 전용 이벤트로 신설한 결정은 레이어 경계를 명확히 한다. node-level 내부 라이프사이클 이벤트가 EIA 표면(외부 소비자)으로 누출되는 것을 방지하는 구조적으로 올바른 추상화다. OCP(개방-폐쇄 원칙) 관점에서도 기존 `node.completed` firehose를 수정하지 않고 additive로 추가한 점이 적절하다.
- 제안: 해당 없음(양호).

### **[INFO]** `PRESENTATION_NODE_TYPES` 공용 상수 - 의존 방향 위반 예방의 적절한 구조화
- 위치: `codebase/backend/src/common/constants/presentation.ts`
- 상세: `execution-engine` 과 `chat-channel.dispatcher` 양쪽이 동일한 타입 집합을 참조해야 할 때, `common/constants/` 중간 레이어에 단일 출처를 두어 `execution-engine → chat-channel` 또는 반대 방향의 모듈 간 직접 의존을 차단한 것은 DIP(의존성 역전 원칙) + 모듈 경계 위반 예방에 충실하다. 주석에 소비처 두 곳을 명시해 의도를 명확히 기록한 것도 적절하다.
- 제안: 해당 없음(양호).

### **[INFO]** `parseMessage` 반환 타입 - 인라인 구조체 vs. 명명 인터페이스
- 위치: `codebase/channel-web-chat/src/lib/eia-events.ts`
- 상세: `parseAiMessage` 는 `ParsedAiMessage` 명명 인터페이스를 반환하지만, `parseMessage` 는 `{ presentations?: Array<Record<string, unknown>> }` 인라인 구조체를 반환한다. 현재 소비처(`use-widget.ts`)가 단순 구조 분해로 쓰는 범위에서는 기능 문제가 없으나, `ParsedAiMessage` 와 병렬적으로 설계된 함수임을 고려하면 `ParsedMessage` 또는 `ParsedPresentationMessage` 명명 인터페이스로 내보내 패턴 일관성을 유지하는 것이 바람직하다. 향후 소비처가 늘거나 타입 단언이 필요해질 때 이름 없는 인라인 타입은 추론·재사용에 마찰을 준다.
- 제안: `eia-events.ts` 에 `export interface ParsedMessage { presentations?: Array<Record<string, unknown>>; }` 를 선언하고 `parseMessage` 반환 타입에 적용한다.

### **[INFO]** `presentations` 페이로드 - `Record<string, unknown>[]` 로의 과도한 완화
- 위치: `codebase/channel-web-chat/src/lib/eia-types.ts`, `eia-events.ts`
- 상세: `ExecutionMessageEvent.presentations` 와 `parseMessage` 반환 모두 `Array<Record<string, unknown>>` 로 선언되어 있다. 실제 소비처인 `classifyPresentation` 은 `{ config, output }` 구조를 요구하지만, 인터페이스 수준에서 이 계약이 표현되지 않아 계약 위반이 런타임까지 전파될 수 있다. 단, 백엔드·위젯이 별개 패키지(monorepo 내부 코드 공유 없음)이므로 현 단계의 완화는 실용적 선택이며 Critical이 아니다.
- 제안: 중기적으로 `{ config: Record<string, unknown>; output: Record<string, unknown> }` 최소 shape 인터페이스(`PresentationEnvelope`)를 `eia-types.ts` 에 선언해 `presentations` 필드 타입을 강화하는 것을 검토한다.

### **[INFO]** `use-widget.ts` - `AI_MESSAGE` reducer 재사용의 의미적 결합
- 위치: `codebase/channel-web-chat/src/widget/use-widget.ts`
- 상세: `execution.message` 를 `{ type: "AI_MESSAGE", text: "", presentations }` 로 dispatch 하는 것은 기존 렌더 경로를 재사용해 구현 비용을 낮추는 실용적 선택이다. 그러나 presentation-only 노드 완료를 "AI 메시지" action type 으로 표현하면 reducer 의 의미 경계가 흐려진다. 현재 소비처와 렌더 로직이 단순해 기능적 문제는 없으나, 향후 `AI_MESSAGE` reducer 에 AI 전용 로직(예: 타이핑 인디케이터, AI 에러 처리)이 추가되면 presentation 노드에 의도치 않게 적용될 수 있다.
- 제안: 장기적으로 `PRESENTATION_MESSAGE` 전용 action type을 추가하는 것을 고려한다. 단기에는 현 구조가 `text: ""` 분기로 이중 텍스트를 방지하므로 수용 가능하다.

### **[INFO]** `postCommand` 헬퍼 - `wc:command` action 타입 미고정
- 위치: `codebase/frontend/src/components/web-chat/live-preview.tsx`
- 상세: `postCommand(action: string)` 가 임의 문자열 action을 받으므로 오탈자에 의한 런타임 오류가 컴파일 타임에 잡히지 않는다. 현재 호출처가 단일(하나의 onClick)이라 실질 위험은 낮지만, 확장 시 문제가 될 수 있다.
- 제안: `action: 'resetSession' | 'open' | 'close' | 'show' | 'hide'` 등 리터럴 유니언으로 좁히거나, `wc:command` payload 타입을 별도 모듈에 선언해 공유한다.

---

## 요약

이번 변경은 아키텍처 관점에서 전반적으로 건전한 설계 원칙을 따른다. 핵심 결정인 `execution.message` 이벤트 신설은 firehose 내부 이벤트(`node.completed`)와 EIA 외부 표면 이벤트를 분리해 모듈 경계와 레이어 책임을 명확히 하며, `PRESENTATION_NODE_TYPES` 공용 상수는 `execution-engine` ↔ `chat-channel` 간 의존 방향 위반을 예방하는 구조적으로 올바른 선택이다. `chat-channel.dispatcher` 는 `execution.message` 를 구독하지 않음으로써 기존 채널(텔레그램 등)에 중복 발화 없이 SSE 표면에만 additive 추가하는 OCP 준수가 확인된다. 경미한 개선 사항으로는 `parseMessage` 반환 인터페이스 미명명, `presentations` 타입 완화, `AI_MESSAGE` reducer 재사용의 의미적 결합, `postCommand` action 타입 미고정이 있으나 모두 INFO 수준으로 현재 범위에서 즉시 차단할 필요는 없다.

## 위험도

NONE
