# 보안(Security) 코드 리뷰

## 발견사항

- **[INFO]** `source` 필드 값 검증 없이 신뢰 — 클라이언트 측 `isInjected` 플래그 파생
  - 위치: `frontend/src/lib/conversation/conversation-utils.ts` 라인 +8 (`const isInjected = msg.source === "injected"`)
  - 상세: `source` 필드는 백엔드 WebSocket 이벤트 페이로드에서 수신되는 값이다. 현재 프론트엔드는 `msg.source === "injected"` 비교만으로 `isInjected` 플래그를 결정하며, 허용 값 집합(`"live" | "injected"`)에 대한 명시적 화이트리스트 검사가 없다. 정상적인 백엔드에서는 두 값만 내려오지만, 중간자 개입이나 악성 WebSocket 메시지가 `source: "live"` 외의 임의 문자열을 보내더라도 `isInjected`는 `false`로 처리되어 기능적으로 무해하다. 그러나 타입 경계 밖의 값이 조용히 통과한다는 점은 방어 심층 관점에서 개선 여지가 있다.
  - 제안: `source` 값이 TypeScript 타입 범위(`"live" | "injected"`)에 들어오는지 런타임에서도 검증하는 가드 함수를 추가하거나, `source` 필드를 수신 즉시 정규화(`undefined` 또는 허용된 두 값 중 하나로 고정)한다.

- **[INFO]** 백엔드에서 `source` 필드 스트리핑 전 LLM 제공자에게 원본 메시지 전달 가능성
  - 위치: `backend/src/modules/llm/llm.service.ts` 라인 +222~228 (`sanitized` 블록)
  - 상세: `llm.service.ts`는 `source` 필드를 destructuring으로 제거한 `sanitized` 객체를 생성하고 `client.chat(sanitized)`를 호출하는 방식으로 올바르게 처리한다. `void source` 구문도 linter 경고를 억제하기 위한 의도된 패턴이다. 단, 이 스트리핑 로직이 `LlmService.chat` 내의 단일 경로에서만 이뤄지고, 향후 다른 호출 경로(직접 `client.chat` 호출 등)가 추가될 경우 `source`가 LLM API에 유출될 위험이 생긴다.
  - 제안: `ChatMessage` 타입을 LLM 제공자에게 전달하는 `ProviderChatMessage` 타입과 분리하거나, `LlmClient.chat` 인터페이스 수준에서 `source` 필드를 아예 받지 않는 별도 타입을 정의해 컴파일 타임에 유출을 방지한다.

- **[INFO]** `Record<string, unknown>` 타입 사용으로 인한 입력 검증 우회 위험
  - 위치: `backend/src/modules/execution-engine/execution-engine.service.ts` 라인 +96~104 (`withSourceMarker` 함수 인자 타입)
  - 상세: `withSourceMarker` 함수의 파라미터 타입이 `Array<Record<string, unknown>>`로 정의되어 있어, `source` 필드의 값이 실제로 `'live' | 'injected'` 리터럴 타입인지 컴파일 타임에 보장되지 않는다. `m.source === 'injected' || m.source === 'live'` 비교는 기능적으로 올바르지만, 타입 시스템이 이 불변식을 강제하지 않는다.
  - 제안: `withSourceMarker`의 입력 타입을 `Array<ChatMessage>` 또는 `source` 필드를 포함한 구체적인 인터페이스로 교체해 타입 안전성을 높인다.

- **[INFO]** `[from Template]`, `[from AI Agent]` 등 사용자 제공 콘텐츠가 메시지 prefix에 직접 삽입
  - 위치: `backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` 라인 +271 (`content: \`[from ${t.nodeLabel}] ${t.text}\``)
  - 상세: `nodeLabel`은 사용자가 워크플로 편집기에서 입력한 노드 이름이고, `t.text`는 이전 노드의 출력값이다. 이 두 값이 LLM에 전달되는 메시지 내용에 직접 보간된다. LLM 프롬프트 인젝션(Prompt Injection) 관점에서, 악의적인 사용자가 `nodeLabel`이나 상위 노드 출력에 LLM 지시어를 삽입해 AI 에이전트의 동작을 의도치 않게 변경할 수 있다. 이는 이번 PR에서 새로 도입된 패턴이 아니라 기존 코드이나, 보안 리뷰 맥락에서 기록한다.
  - 제안: `nodeLabel`에 허용 문자 집합 제한을 두거나, 시스템 프롬프트와 사용자 입력 경계를 명확히 구분하는 구조적 메시지 포맷 사용을 검토한다. 단기적으로는 `nodeLabel`의 최대 길이와 허용 문자 검증을 강화한다.

- **[INFO]** 테스트 파일에 실제 사용자 메시지 문자열이 하드코딩 — 한국어 리터럴
  - 위치: `backend/src/nodes/ai/ai-agent/ai-agent.thread.spec.ts` 라인 +358 (`'실제 메시지'`), `frontend/src/lib/conversation/__tests__/conversation-utils.test.ts` 여러 라인
  - 상세: 테스트 픽스처로 사용된 한국어 문자열(`'실제 메시지'`, `'어떤 상품이 있는지 알려줘'` 등)은 보안 취약점이 아니다. 그러나 테스트 데이터가 실제 사용자 데이터처럼 보이는 경우, 향후 로그나 에러 리포트에 포함될 때 민감 정보로 오해될 수 있다.
  - 제안: 테스트 픽스처 문자열에 명확한 테스트용 접두사(`[TEST]` 등)를 붙이거나, 픽스처 상수로 분리해 테스트 데이터임을 명시한다.

## 요약

이번 PR은 WebSocket 이벤트 페이로드의 `messages[]` 배열에 `source: 'live' | 'injected'` 마커를 도입하고, 백엔드에서 LLM 제공자에게 전달 전 해당 필드를 스트리핑하는 구현이다. 전반적으로 보안 측면에서 심각한 취약점은 발견되지 않았다. `source` 필드 스트리핑은 `LlmService.chat` 단일 경로에서 올바르게 수행되며, `withSourceMarker` 함수도 화이트리스트 방식으로 값을 처리한다. 주요 개선 제안은 타입 경계를 런타임까지 확장하여 방어 심층(defense in depth)을 강화하는 것과, `ChatMessage` 타입과 LLM 제공자 전달용 타입을 분리해 향후 `source` 유출 경로를 컴파일 타임에 차단하는 것이다. 하드코딩된 시크릿, SQL 인젝션, XSS, 커맨드 인젝션, 경로 탐색, 인증/인가 우회, 안전하지 않은 암호화 알고리즘, 에러 메시지 민감 정보 노출 등 주요 보안 취약점은 이번 변경 범위 내에서 발견되지 않았다.

## 위험도

LOW
