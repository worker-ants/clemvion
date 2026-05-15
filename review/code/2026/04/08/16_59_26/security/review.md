## 보안 코드 리뷰 결과

### 발견사항

---

**[WARNING] WebSocket 메시지 데이터 미검증 — 서버 데이터 신뢰**
- 위치: `use-execution-events.ts` — `handleAiMessage`, `handleWaitingForInput`
- 상세: `data as { message?: string; ... }` 패턴으로 서버 WebSocket 페이로드를 타입 단언(type assertion)만으로 처리. 런타임 검증 없이 `payload.message`, `payload.turnCount` 등을 직접 상태에 저장. 악의적이거나 손상된 서버/중간자(MITM)가 비정상 페이로드를 보낼 경우 클라이언트 상태 오염 가능.
- 제안: 런타임 스키마 검증 라이브러리(zod 등) 또는 최소한 `typeof` 검사를 추가. `turnCount`가 숫자인지, `message`가 문자열인지, 길이 상한이 있는지 검증.

---

**[WARNING] 대화 메시지 콘텐츠의 XSS 위험 — `whitespace-pre-wrap` 렌더링**
- 위치: `conversation-inspector.tsx:96` (`<div className="whitespace-pre-wrap text-sm">{item.content}</div>`), `SummaryView`의 `lastAssistant.content`
- 상세: AI 응답 및 사용자 메시지를 React JSX에 직접 삽입하는 것은 기본적으로 안전(React가 이스케이프). 그러나 `GenericRenderer`에서 HTML 렌더링을 수행하는 경우(Chart 노드 등 다른 노드 타입에서 `dangerouslySetInnerHTML`을 사용한다면) ConversationInspector의 `SummaryView`가 `GenericRenderer`를 재사용하므로, `result.outputData`에 HTML이 포함되어 있으면 위험. 이 코드 자체는 안전하나, `GenericRenderer` 구현에 의존적인 간접 위험 존재.
- 제안: `GenericRenderer`가 HTML을 렌더링하는 경우 DOMPurify sanitize 적용 여부 확인(스펙 문서에서 Chart 노드에 `DOMPurify sanitize 적용`이 명시되어 있으나 AI Agent의 GenericRenderer 경유 경로에서도 적용되는지 확인 필요).

---

**[WARNING] `result-timeline.tsx` — 변수 사용 전 선언 오류 (보안 우회 가능성)**
- 위치: `result-timeline.tsx:130-135`
- 상세: `isExpanded = isLiveNode || ...` 라인이 `isLiveNode` 선언보다 앞에 위치 (호이스팅 없는 `const`). 런타임에서 `isLiveNode`가 `undefined`로 평가되어 `isExpanded`가 항상 `false`가 됨. 이는 기능 버그이지만, Live 대화 중 자동 펼침이 동작하지 않아 대화 내용이 표시되지 않는 문제로 이어짐 — 보안 측면에서 의도치 않은 정보 미표시.
- 제안: `isLiveNode` 선언을 `isExpanded` 선언보다 앞으로 이동.

---

**[WARNING] `handleSendMessage`에서 optimistic update와 WebSocket emit 순서**
- 위치: `result-detail.tsx:157-168`, `run-results-drawer.tsx:150-162`
- 상세: `handleSendMessage`는 (1) `onSendMessage`(스토어에 user 메시지 추가 + `isWaitingAiResponse=true`)를 먼저 호출한 후 (2) WebSocket `emit`을 호출. WebSocket 전송 실패 시 UI에는 메시지가 표시됐으나 서버로 전달되지 않은 상태가 됨. 오류 처리(emit 실패 rollback)가 없음.
- 제안: WebSocket emit 실패 콜백(ACK 등)을 처리하거나, 전송 실패 시 optimistic update를 롤백하는 로직 추가.

---

**[INFO] `executionId`와 `nodeId`가 사용자 입력 없이 서버에서 수신되어 그대로 emit**
- 위치: `result-detail.tsx:162-166`, `handleEndConversation:171-179`
- 상세: `executionId`, `result.nodeId`는 서버에서 수신한 값을 그대로 WebSocket에 재전송. 이 값들이 상태 오염(위의 WARNING 참조)된 경우 비정상 nodeId가 서버로 전달될 수 있음. 프론트엔드 자체의 취약점이라기보다 서버 측 검증이 필수.
- 제안: 서버에서 executionId/nodeId 유효성을 세션 기반으로 검증하고 있는지 확인.

---

**[INFO] 하드코딩된 시크릿 없음**
- 코드 전반에 API 키, 토큰, 비밀번호 하드코딩 없음.

---

**[INFO] `localStorage` 사용 (패널 높이 저장)**
- 위치: `run-results-drawer.tsx` — `STORAGE_KEY = "run-results-height"`
- 상세: 숫자 값만 저장하며 민감 정보 없음. 안전.

---

### 요약

이번 변경은 AI Agent Multi-Turn 대화 기능을 프론트엔드에 추가하는 내용으로, 전반적으로 React의 기본 XSS 방어 메커니즘을 활용하고 있어 직접적인 인젝션 취약점은 없다. 주요 보안 위험은 **WebSocket으로 수신되는 서버 페이로드에 대한 런타임 검증 부재**로, 서버가 신뢰되지 않는 환경(MITM, 취약한 서버)에서 클라이언트 상태가 오염될 수 있다. 또한 `result-timeline.tsx`의 변수 선언 순서 버그(`isLiveNode` before use)는 기능 장애를 유발하는 결함이다. 인증/인가는 WebSocket 연결 수립 시점에서 처리되는 구조로 보이며, 이 코드 레이어에서 별도 우회 경로는 발견되지 않았다. 전체 위험도는 서버 측 검증에 크게 의존하는 구조임을 고려할 때 **MEDIUM**으로 평가한다.

### 위험도

**MEDIUM**