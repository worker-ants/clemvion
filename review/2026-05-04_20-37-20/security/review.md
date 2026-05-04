### 발견사항

---

**[WARNING] `llmCalls` 내부에 raw LLM 요청/응답 페이로드가 프론트엔드로 전송됨**
- 위치: `use-execution-events.ts` `handleAiMessage` + 백엔드 테스트 ~L994 (`expect(payload.llmCalls).toEqual([llmCall])`)
- 상세: 상위 레벨의 flat `requestPayload`/`responsePayload` 필드는 이번 변경으로 올바르게 제거됐지만, `llmCalls` 배열 내부에는 동일한 데이터(`requestPayload`, `responsePayload`)가 여전히 포함된 채 클라이언트 브라우저로 전달됩니다. 이 데이터에는 시스템 프롬프트, 내부 tool 정의, RAG 컨텍스트, 모델 파라미터 등 민감한 내부 구현 정보가 담길 수 있습니다.
- 제안: `llmCalls`를 전송하기 전에 `requestPayload`/`responsePayload` 필드를 서버 측에서 제거하거나 redact하고, 클라이언트가 필요로 하는 디버그 메타데이터(모델명, 토큰 수, `durationMs`)만 포함된 별도 구조체로 대체하는 것을 권장합니다.

---

**[INFO] 개발 환경에서 `console.warn`에 전체 `payload` 객체 출력**
- 위치: `use-execution-events.ts` L322–328
  ```ts
  console.warn("[ws] execution.ai_message without messages snapshot — ignoring", payload);
  ```
- 상세: 브라우저 클라이언트 컨텍스트에서는 개발자 도구에서만 보이므로 영향 범위가 제한적입니다. 다만 `payload`에는 `llmCalls`(raw 요청/응답)가 포함될 수 있어, 향후 SSR 경로나 로그 집계 도구로 코드가 확장될 경우 민감 정보 노출 위험이 있습니다.
- 제안: 로그에는 `payload.nodeId`, `payload.turnCount` 같은 비민감 식별자만 포함하도록 제한하세요.

---

**[INFO] `messages` 및 `llmCalls` 배열 크기 상한 없음**
- 위치: `use-execution-events.ts` `handleAiMessage`
- 상세: 수신된 배열을 크기 검증 없이 상태로 적용합니다. 비정상적으로 큰 배열(백엔드 버그 또는 조작된 패킷)이 전달될 경우 브라우저 메모리 소진 및 렌더링 지연으로 이어질 수 있습니다.
- 제안: 예) `if (payload.messages.length > 2000) { console.warn(...); return; }` 형태의 상한 가드를 추가하세요.

---

**[INFO] 메시지 `content` 필드의 XSS 검증이 렌더링 레이어에 위임됨**
- 위치: `use-execution-events.ts` → `messagesToConversationItems(payload.messages, ...)`
- 상세: AI가 생성한 `content` 값은 WebSocket 핸들러 수준에서 별도 sanitize 없이 스토어에 저장됩니다. XSS 방어가 렌더링 컴포넌트에 전적으로 의존하므로, 향후 `dangerouslySetInnerHTML` 사용 등 렌더링 방식 변경 시 취약점이 발생할 수 있습니다.
- 제안: `content` 필드를 렌더링하는 컴포넌트가 텍스트 노드로만 처리하는지 주기적으로 감사하세요. 마크다운 렌더러를 사용하는 경우 HTML 태그를 이스케이프하는 옵션이 활성화되어 있는지 확인하세요.

---

**[INFO] (긍정적 발견) 제거된 flat 필드에 대한 명시적 회귀 테스트 추가됨**
- 위치: 백엔드 테스트 `expect(payload).not.toHaveProperty('requestPayload')`
- 상세: 삭제된 필드가 재도입되는 것을 방지하는 명시적 회귀 어서션은 보안 관점에서 좋은 관행입니다.

---

### 요약

이번 변경은 legacy fallback 경로 제거와 flat `requestPayload`/`responsePayload` 필드 삭제를 통해 데이터 노출 범위를 줄이는 **순보안 개선**입니다. 다만 `llmCalls` 배열 내부에 raw LLM 요청/응답 페이로드(`requestPayload`, `responsePayload`)가 여전히 포함된 채 브라우저 클라이언트로 전달되는 구조는 시스템 프롬프트·내부 tool 정의 등 민감 정보의 노출 경로로 남아 있습니다. WebSocket 연결 자체가 인증을 전제로 하므로 현재 위험도는 낮지만, 서버 측에서 전송 전 redact 처리하는 것이 권장됩니다.

### 위험도

**LOW**