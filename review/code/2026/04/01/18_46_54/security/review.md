## 보안 코드 리뷰

### 발견사항

---

**[CRITICAL] XSS (Cross-Site Scripting) — dangerouslySetInnerHTML 무검증 사용**
- 위치: `run-results-drawer.tsx` — `ChartContent`, `TemplateContent` 컴포넌트
- 상세: `data.rendered` 값이 서버에서 전달된 HTML 문자열을 그대로 `dangerouslySetInnerHTML`에 바인딩합니다. 워크플로우 실행 결과에 공격자가 제어할 수 있는 HTML/JS가 포함될 경우 (예: 외부 API 응답, DB 데이터가 chart/template 노드를 거친 경우) 브라우저에서 임의 스크립트가 실행됩니다.
- 제안:
  ```tsx
  // DOMPurify로 sanitize 후 렌더링
  import DOMPurify from "dompurify";
  
  function ChartContent({ data }) {
    const sanitized = DOMPurify.sanitize(data.rendered as string);
    return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
  }
  ```

---

**[CRITICAL] 인가(Authorization) 누락 — WebSocket form 제출 핸들러**
- 위치: `websocket.gateway.ts` — `handleSubmitForm()` (line ~156)
- 상세: `execution.submit_form` 이벤트는 `executionId`만 알면 누구든지 폼을 제출하여 타인의 실행을 resume할 수 있습니다. WebSocket 연결 시 JWT 인증은 수행되지만, 해당 `executionId`가 현재 연결된 사용자 소유인지 검증하지 않습니다. 악의적인 사용자가 다른 사용자의 워크플로우 실행에 임의 데이터를 주입할 수 있습니다.
- 제안:
  ```typescript
  @SubscribeMessage('execution.submit_form')
  async handleSubmitForm(
    @MessageBody() data: { executionId: string; formData: unknown },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = (client as Socket & { userId?: string }).userId;
    // execution 소유자 검증
    const execution = await this.executionRepository.findOneBy({ id: data.executionId });
    if (!execution || execution.executedBy !== userId) {
      return { event: 'execution.form_submitted', data: { success: false, error: 'Forbidden' } };
    }
    // ...
  }
  ```

---

**[CRITICAL] formData 입력 검증 완전 부재**
- 위치: `execution-engine.service.ts` — `continueExecution()` → `waitForFormSubmission()`
- 상세: WebSocket에서 수신한 `formData`가 아무런 스키마 검증 없이 `submittedData`로 저장되고 DB에 기록됩니다. 타입은 `unknown`이며 크기 제한, 구조 검증, 필드 화이트리스트 등이 전혀 없습니다. 의도적으로 매우 큰 페이로드를 전송하면 메모리 압박이나 DB 저장 오류를 유발할 수 있고, 이후 노드에서 해당 데이터를 신뢰하고 처리할 경우 2차 인젝션 위험이 있습니다.
- 제안: Form 노드 config에 정의된 `fields` 스키마 기반으로 서버 측에서 검증:
  ```typescript
  private validateFormData(formData: unknown, formConfig: Record<string, unknown>): void {
    const MAX_SIZE = 1024 * 100; // 100KB
    if (JSON.stringify(formData).length > MAX_SIZE) throw new Error('Form data too large');
    // field 타입/required 검증 로직
  }
  ```

---

**[WARNING] 에러 메시지에 내부 구현 정보 노출**
- 위치: `execution-engine.service.ts` — `continueExecution()` (line ~451)
- 상세: `throw new Error(`No pending continuation for execution: ${executionId}`)` 메시지가 WebSocket 응답을 통해 클라이언트에 그대로 전달됩니다(`websocket.gateway.ts` catch 블록). 이는 내부 상태(pendingContinuations Map 존재, executionId 유효성 여부)를 외부에 노출합니다.
- 제안:
  ```typescript
  // gateway에서 에러 메시지를 제네릭하게 처리
  return { event: 'execution.form_submitted', data: { success: false, error: 'Form submission failed' } };
  ```

---

**[WARNING] executionId 추측 가능성 — 타이밍 오라클**
- 위치: `execution-engine.service.ts` — `continueExecution()`, `cancelWaitingExecution()`
- 상세: 두 함수 모두 `pendingContinuations.has(executionId)` 여부에 따라 다른 동작을 합니다. 공격자가 유효한 executionId를 시도하면 에러 유무로 실행 존재를 탐지할 수 있습니다. 인가 검증이 추가되면 이 문제는 부분적으로 완화됩니다.

---

**[WARNING] WebSocket CORS 설정 — `origin: '*'`**
- 위치: `websocket.gateway.ts` — `@WebSocketGateway({ cors: { origin: '*' } })`
- 상세: 모든 출처의 WebSocket 연결을 허용합니다. JWT 인증이 있어 완전 무방비는 아니지만, CSRF류 공격의 가능성을 높이고 향후 인증 로직 변경 시 위험해질 수 있습니다.
- 제안: 환경변수로 허용 origin을 명시적으로 제한:
  ```typescript
  cors: { origin: process.env.ALLOWED_ORIGINS?.split(',') ?? 'http://localhost:3000' }
  ```

---

**[WARNING] CarouselContent 이미지 URL 검증 없음**
- 위치: `run-results-drawer.tsx` — `CarouselContent` 컴포넌트
- 상세: `item.image`가 검증 없이 `<img src>` 에 설정됩니다. `javascript:` 프로토콜은 최신 브라우저에서 img src로는 실행되지 않으나, `data:` URL을 통한 의도치 않은 콘텐츠 렌더링이나 SSRF 프록시 공격의 벡터가 될 수 있습니다.
- 제안:
  ```tsx
  const isValidImageUrl = (url: string) => /^https?:\/\//.test(url);
  {item.image && isValidImageUrl(item.image) && <img src={item.image} ... />}
  ```

---

**[INFO] PdfContent URL 검증 없음**
- 위치: `run-results-drawer.tsx` — `PdfContent` 컴포넌트
- 상세: `data.url`이 검증 없이 `<a href>`에 사용됩니다. `javascript:` 프로토콜 링크가 주입될 경우 클릭 시 XSS가 발생합니다.
- 제안:
  ```tsx
  const safeUrl = url?.startsWith('https://') || url?.startsWith('http://') ? url : null;
  {safeUrl && <a href={safeUrl} target="_blank" rel="noreferrer noopener">Open</a>}
  ```

---

**[INFO] 무한 대기 가능성 — DoS 잠재적 위험**
- 위치: `execution-engine.service.ts` — `waitForFormSubmission()`
- 상세: Form 제출 Promise에 타임아웃이 없습니다. 사용자가 폼을 영원히 제출하지 않으면 해당 실행의 비동기 컨텍스트가 메모리에 무한히 잔류합니다. `pendingContinuations` Map이 계속 누적될 수 있습니다.
- 제안:
  ```typescript
  const FORM_TIMEOUT_MS = 30 * 60 * 1000; // 30분
  const timeoutId = setTimeout(() => {
    pending.reject(new ExecutionCancelledError());
  }, FORM_TIMEOUT_MS);
  // resolve 시 clearTimeout(timeoutId)
  ```

---

### 요약

가장 심각한 문제는 두 가지입니다. 첫째, `dangerouslySetInnerHTML`에 서버 렌더링 결과(chart/template HTML)를 sanitize 없이 주입하여 외부 데이터가 워크플로우를 통과할 경우 XSS가 발생할 수 있습니다. 둘째, `execution.submit_form` WebSocket 핸들러에 소유자 인가 검증이 없어 executionId를 아는 임의의 인증 사용자가 다른 사용자의 실행에 임의 데이터를 주입하고 제어 흐름을 변경할 수 있습니다. formData에 대한 서버 측 입력 검증도 완전히 누락되어 있어, 이 세 가지를 먼저 수정해야 합니다.

### 위험도

**HIGH**