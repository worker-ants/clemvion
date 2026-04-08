## 보안 코드 리뷰

### 발견사항

---

**[CRITICAL] LLM 요청/응답 페이로드 클라이언트 노출**
- 위치: `execution-engine.service.ts:884-891`, `use-execution-events.ts:218-251`
- 상세: `requestPayload`(LLM에 보내는 전체 요청)와 `responsePayload`(LLM의 원시 응답)가 WebSocket 이벤트를 통해 클라이언트로 전송됩니다. 요청 페이로드에는 **시스템 프롬프트 전체**, RAG 컨텍스트(지식베이스 내용), 대화 히스토리, 모델 설정이 포함됩니다. 시스템 프롬프트는 일반적으로 비즈니스 로직과 보안 지침을 담고 있어 노출 시 프롬프트 인젝션 공격의 벡터가 됩니다.
- 제안: 디버깅 목적이라면 관리자/개발자 전용 채널로 분리하거나, 프로덕션 환경에서는 `NODE_ENV`로 게이팅. 최소한 시스템 프롬프트(`role: 'system'` 메시지)는 필터링 후 전송:
  ```ts
  requestPayload: process.env.NODE_ENV === 'development' 
    ? { ...chatParams, messages: chatParams.messages.filter(m => m.role !== 'system') }
    : undefined,
  ```

---

**[WARNING] 민감 데이터 클라이언트 스토어 영구 저장**
- 위치: `execution-store.ts:45-62`, `conversation-inspector.tsx:RequestTab`, `ResponseTab`
- 상세: `requestPayload`와 `responsePayload`가 Zustand 스토어에 저장되고 UI에서 `JSON.stringify`로 그대로 렌더링됩니다. 이 데이터에는 RAG 검색 결과(지식베이스 민감 데이터), API 키가 포함된 헤더(LLM 서비스 응답에 따라), 내부 프롬프트 구조가 포함될 수 있습니다. 브라우저 메모리에 장시간 유지되고 React DevTools 등으로 열람 가능합니다.
- 제안: 스토어에 저장 시 민감 필드 제거 또는 디버그 모드 플래그로 제어. 표시 시 최대 사이즈 제한 및 스크롤 적용(이미 `max-h-[60vh]` 적용은 긍정적).

---

**[WARNING] XSS 잠재 위험 - JSON 렌더링**
- 위치: `conversation-inspector.tsx:ResponseTab`, `RequestTab`
- 상세: `JSON.stringify(item.responsePayload, null, 2)`를 `<pre>` 태그 내에 직접 렌더링합니다. React는 기본적으로 XSS를 방지하지만, LLM 응답 데이터가 `dangerouslySetInnerHTML`로 처리되거나 향후 마크다운 렌더러가 추가될 경우 위험해집니다. 현재는 안전하나 잠재적 확장 위험 존재.
- 제안: 현재 구현은 안전. 단, 향후 마크다운 렌더러 추가 시 `requestPayload`/`responsePayload`는 반드시 raw 텍스트로만 처리.

---

**[WARNING] 사용자 메시지 입력 검증 부재**
- 위치: `run-results-drawer.tsx:handleSendMessage`, `execution-engine.service.ts:continueAiConversation`
- 상세: 사용자가 입력한 메시지가 `trim()` 외 별도 검증 없이 LLM으로 전달됩니다. 메시지 길이 제한이 없어 매우 긴 텍스트로 토큰 소비 공격(Denial of Service)이 가능합니다. 또한 프롬프트 인젝션 시도를 탐지/차단하는 레이어가 없습니다.
- 제안:
  ```ts
  // backend: continueAiConversation
  if (!message || message.length > 10000) {
    throw new Error('Message too long or empty');
  }
  ```

---

**[WARNING] `turnTimeout` 설정값 클라이언트 신뢰**
- 위치: `execution-engine.service.ts:waitForAiConversation:turnTimeout`
- 상세: `multiTurnState.turnTimeout`은 원래 서버 설정에서 오지만, `processMultiTurnMessage` 반환값의 `_multiTurnState`를 통해 계속 전파됩니다. 클라이언트가 WebSocket 메시지를 조작할 수 없지만, `processMultiTurnMessage` 결과 객체가 신뢰 경계 없이 그대로 다음 상태로 사용되어 `maxTurns: 0` 등의 값 조작 가능성이 있습니다.
- 제안: 서버 측 `node.config`에서 값을 재검증하거나 초기 상태 외에는 변경 불가하도록 고정.

---

**[INFO] 디버깅 페이로드에 모델 정보 포함**
- 위치: `execution-engine.service.ts:886`, `use-execution-events.ts:metadata`
- 상세: 사용 중인 모델명(`gpt-4o`, `claude-3-opus` 등)이 클라이언트에 노출됩니다. 비즈니스 상 경쟁사에 내부 AI 전략이 노출될 수 있습니다.
- 제안: 허용된 공개 범위인지 비즈니스 측과 확인.

---

**[INFO] `timestamp` 클라이언트 생성 시간 신뢰**
- 위치: `run-results-drawer.tsx:157`, `use-execution-events.ts:timestamp`
- 상세: 메시지 타임스탬프를 서버가 아닌 클라이언트에서 `new Date().toISOString()`으로 생성합니다. 보안상 직접 위험은 없으나 포렌식/감사 목적으로 신뢰할 수 없는 타임스탬프입니다.
- 제안: 감사 로그 목적이라면 서버에서 타임스탬프를 생성하여 전송.

---

### 요약

이번 변경의 핵심 보안 위험은 **LLM 디버깅 페이로드(요청/응답 전문)를 WebSocket을 통해 클라이언트에 노출**하는 것입니다. 시스템 프롬프트, RAG 컨텍스트, 모델 설정 등 민감한 비즈니스 로직이 포함된 데이터가 프론트엔드 스토어와 UI에 그대로 전달됩니다. 이는 프롬프트 인젝션 공격 설계를 용이하게 하고, 지식베이스 내용 유출 위험을 높입니다. 사용자 입력에 대한 길이 제한 부재도 토큰 소비형 DoS 위험을 내포합니다. 현재 React 렌더링 방식은 XSS로부터 안전하나, 향후 마크다운 렌더러 도입 시 재검토가 필요합니다.

### 위험도

**HIGH** — 시스템 프롬프트 및 RAG 데이터의 클라이언트 노출이 운영 환경에서 실제 위협이 됩니다.