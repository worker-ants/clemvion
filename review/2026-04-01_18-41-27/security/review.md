## 보안 코드 리뷰 결과

---

### 발견사항

---

#### **[CRITICAL] XSS (Cross-Site Scripting) — dangerouslySetInnerHTML 무방비 사용**

- **위치**: `frontend/src/components/editor/run-results/run-results-drawer.tsx` — `ChartContent`, `TemplateContent` 컴포넌트
- **상세**: 서버에서 수신한 `data.rendered` (HTML 문자열)를 `dangerouslySetInnerHTML`로 직접 렌더링. 워크플로우 실행 결과 데이터가 외부 데이터 소스를 처리했거나 공격자가 악의적인 워크플로우를 실행할 수 있다면, `<script>` 태그나 이벤트 핸들러 삽입을 통해 XSS가 발생할 수 있음.
  ```tsx
  // ChartContent
  dangerouslySetInnerHTML={{ __html: data.rendered }}
  // TemplateContent
  dangerouslySetInnerHTML={{ __html: rendered }}
  ```
- **제안**: [DOMPurify](https://github.com/cure53/DOMPurify) 등의 라이브러리로 렌더링 전 HTML 새니타이징 필수. `DOMPurify.sanitize(data.rendered)` 적용.

---

#### **[WARNING] 인가(Authorization) 부재 — Form 제출 엔드포인트**

- **위치**: `backend/src/modules/executions/executions.controller.ts` — `POST /executions/:id/continue`, `backend/src/modules/websocket/websocket.gateway.ts` — `execution.submit_form` 핸들러
- **상세**: `continueExecution` REST 엔드포인트와 WebSocket `execution.submit_form` 핸들러 모두 **실행 소유자 검증 없음**. 누구든 유효한 `executionId`(UUID)를 알면 타인의 실행을 임의로 재개하거나 폼 데이터를 주입할 수 있음. WebSocket 핸들러는 인증된 소켓인지도 확인하지 않음 (`@ConnectedSocket()` 미사용).
  ```ts
  // 실행 소유자 확인 없음
  continueExecution(@Param('id', ParseUUIDPipe) id: string, @Body() body?) {
    this.executionEngineService.continueExecution(id, body?.formData);
  }
  ```
- **제안**: 
  1. REST 엔드포인트에 JWT Guard + 실행 소유자 검증 추가 (`execution.userId === req.user.sub`).
  2. WebSocket 핸들러에 `@ConnectedSocket() client: Socket` 추가 후, `client.userId`와 실행의 소유자를 대조 검증.

---

#### **[WARNING] 인가(Authorization) 부재 — `cancelWaitingExecution` 노출 경로 없음이나 향후 노출 시 위험**

- **위치**: `backend/src/modules/execution-engine/execution-engine.service.ts` — `cancelWaitingExecution`
- **상세**: 현재 REST/WebSocket으로 직접 노출되어 있지는 않으나, `continueExecution`과 동일한 패턴으로 향후 엔드포인트가 추가될 경우 동일한 인가 부재 문제가 발생할 수 있음. 설계 레벨에서 소유자 검증을 표준화 필요.
- **제안**: `ExecutionEngineService`의 `continueExecution`, `cancelWaitingExecution` 내부에서 `executionId`로 소유자를 조회하는 검증 레이어를 추가하거나, 서비스 계층에서 `userId`를 파라미터로 받아 검증.

---

#### **[WARNING] 메모리 누수 / DoS — `pendingContinuations` Map 무제한 증가**

- **위치**: `backend/src/modules/execution-engine/execution-engine.service.ts` — `pendingContinuations` Map
- **상세**: Form 노드 대기 중 서버가 재시작되거나, 클라이언트 연결이 끊기거나, 명시적인 취소 없이 타임아웃이 발생하면 `pendingContinuations`에 항목이 영구적으로 잔류할 수 있음. 공격자가 다수의 Form 실행을 생성하고 제출하지 않으면 메모리 고갈(DoS) 가능.
- **제안**: 
  1. 대기 항목에 TTL(예: 30분) 설정 후 자동 만료(`setTimeout` + `reject`).
  2. `pendingContinuations.size` 상한선 설정.

---

#### **[WARNING] 입력 검증 부재 — formData 무제한 수용**

- **위치**: 
  - `backend/src/modules/executions/executions.controller.ts` — `body?: { formData?: unknown }`
  - `backend/src/modules/websocket/websocket.gateway.ts` — `data: { executionId: string; formData: unknown }`
- **상세**: `formData`가 `unknown` 타입으로 전달되어 크기 제한 없음. 매우 큰 페이로드를 전송하여 메모리 부하를 유발할 수 있음. 또한 `executionId`에 대한 WebSocket 핸들러 내 형식 검증 없음.
- **제안**: 
  1. NestJS의 `ValidationPipe` + DTO를 사용하여 `formData` 구조와 크기를 검증.
  2. `executionId`가 유효한 UUID인지 WebSocket 핸들러에서도 검증 (`validate` 유틸리티 사용).

---

#### **[WARNING] 에러 메시지 정보 노출**

- **위치**: `backend/src/modules/websocket/websocket.gateway.ts` — `handleSubmitForm`
- **상세**: 예외 메시지가 그대로 WebSocket 응답에 포함됨. 내부 구현 상세(`No pending continuation for execution: ${executionId}`)가 클라이언트에 노출되어 유효한 executionId 탐색에 활용될 수 있음.
  ```ts
  return { event: 'execution.form_submitted', data: { success: false, error: message } };
  ```
- **제안**: 클라이언트에는 일반적인 에러 메시지만 반환 (`"Form submission failed"`), 상세 메시지는 서버 로그에만 기록.

---

#### **[WARNING] CORS 설정 — 모든 origin 허용**

- **위치**: `backend/src/modules/websocket/websocket.gateway.ts`
  ```ts
  cors: { origin: '*', credentials: true }
  ```
- **상세**: `origin: '*'`과 `credentials: true`의 조합은 브라우저에서 실제로 동작하지 않으나(`credentials: true`와 wildcard origin은 CORS 스펙상 호환 불가), 프레임워크/라이브러리가 이를 묵인하는 경우 CSRF 위험이 있음. 또한 명시적 허용 도메인 없이 모든 origin에서 WebSocket 연결 가능.
- **제안**: `origin`을 환경변수로 관리하여 허용된 도메인만 명시 (`process.env.ALLOWED_ORIGINS`).

---

#### **[INFO] WebSocket 인증 우회 가능성 — `@Public()` 데코레이터**

- **위치**: `backend/src/modules/websocket/websocket.gateway.ts`
  ```ts
  @Public()
  @WebSocketGateway(...)
  export class WebsocketGateway
  ```
- **상세**: `@Public()`으로 전역 JwtAuthGuard를 우회하고 `handleConnection()`에서 수동 JWT 검증. 이는 의도된 설계이나, `handleSubmitForm` 등 이벤트 핸들러가 연결 시 인증된 소켓(`this.subscriptions`에 등록된)으로부터 온 것인지 추가 검증을 하지 않음. 소켓 연결 없이 직접 이벤트를 보낼 수 있는 경우 우회 가능.
- **제안**: 각 메시지 핸들러에서 `this.subscriptions.has(client.id)` 확인을 통해 인증된 연결임을 보장.

---

#### **[INFO] 하드코딩된 Fallback Secret**

- **위치**: `backend/src/modules/websocket/websocket.module.ts`
  ```ts
  secret: configService.get<string>('jwt.secret') ?? 'fallback'
  ```
- **상세**: 환경변수 미설정 시 `'fallback'`이라는 예측 가능한 JWT secret이 사용됨. 개발 환경에서 실수로 프로덕션 배포 시 토큰 위조 가능.
- **제안**: fallback 제거 후 환경변수 미설정 시 애플리케이션 시작 실패 처리. `configService.getOrThrow<string>('jwt.secret')` 사용.

---

### 요약

이번 변경에서 가장 심각한 보안 위험은 **XSS** (ChartContent/TemplateContent의 `dangerouslySetInnerHTML` 무방비 사용)와 **인가 부재** (Form 제출 엔드포인트의 실행 소유자 미검증)이다. Form 기반 실행 재개 기능을 추가하면서 인증/인가 레이어가 충분히 고려되지 않았으며, WebSocket 핸들러에서 메시지를 처리할 때 발신자의 권한 검증이 누락되어 있다. `pendingContinuations` Map의 TTL 부재는 DoS 위험을 내포하고, 에러 메시지 노출과 CORS 와일드카드 설정도 보완이 필요하다. JWT fallback secret은 배포 실수 시 치명적인 취약점이 될 수 있다.

---

### 위험도

**HIGH**