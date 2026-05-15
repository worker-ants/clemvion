### 발견사항

---

**[WARNING] 목록 API에 페이지네이션 없음 — 하드코딩된 `take: 50`**
- 위치: `workflow-assistant-session.service.ts` — `listForWorkflow()`, `loadMessages()`
- 상세: `listForWorkflow`는 세션을 최대 50건으로 고정 반환하고, `loadMessages`는 무제한으로 모든 메시지를 반환한다. 장기 사용 세션의 경우 메시지 수가 수백~수천 건이 될 수 있으며, 클라이언트가 페이지 단위로 조회할 방법이 없다.
- 제안: `GET /sessions?workflowId=&page=&limit=` 형태의 커서 또는 오프셋 페이지네이션 도입. 메시지 목록도 `GET /sessions/:id/messages?cursor=&limit=` 별도 엔드포인트로 분리하거나 `findDetail`에 `limit`/`before` 파라미터 추가.

---

**[WARNING] SSE 에러 이벤트가 HTTP 상태 코드를 우회함**
- 위치: `workflow-assistant.controller.ts` — `sendMessage()` 핸들러, `assistant.ts` — `streamMessage()`
- 상세: 스트림이 일단 열리면 이후 발생하는 모든 오류(LLM 오류, 세션 미존재 등)는 `event: error`로 내려오고 HTTP 200이 유지된다. 클라이언트 `assistant.ts`의 `if (!response.ok)` 체크는 스트림 시작 전 4xx/5xx만 잡는다. 인증 만료나 세션 미존재 같은 오류가 200으로 내려오면 모니터링·로그 분석에서 누락된다.
- 제안: 스트림 시작 전 세션 조회·검증을 선행하고 실패 시 400/403/404를 즉시 반환. 스트림 내 에러(`event: error`)는 LLM 레이어 이후의 런타임 오류로 범위를 좁힌다.

---

**[WARNING] `GET /sessions/latest`와 `GET /sessions/:id`의 경로 충돌 위험**
- 위치: `workflow-assistant.controller.ts` — `latest()`, `findOne()` 라우트 순서
- 상세: NestJS는 선언 순서 기준으로 라우트를 매칭한다. `GET /sessions/latest`가 `GET /sessions/:id`보다 앞에 선언되어 있어 현재는 정상 동작하지만, 리팩터링 시 순서가 역전되면 `"latest"`가 UUID로 파싱되어 `ParseUUIDPipe`에서 400이 발생한다. 또한 `latest`가 별도 행위(최근 활성 세션)를 나타내므로 하위 리소스 구조가 아닌 쿼리 파라미터 방식이 더 명확하다.
- 제안: `GET /sessions?workflowId=&onlyLatest=true` 또는 `GET /sessions/active/latest?workflowId=`로 변경하거나, 현재 순서를 테스트로 고정(e.g. e2e 라우팅 테스트).

---

**[WARNING] `AssistantMessageRequestDto.currentWorkflow`에 `@ApiProperty` 데코레이터 누락**
- 위치: `assistant-message-request.dto.ts` — `AssistantWorkflowSnapshotDto`, `AssistantWorkflowNodeDto`, `AssistantWorkflowEdgeDto`
- 상세: `AssistantWorkflowSnapshotDto`와 그 하위 DTO들에 `@ApiProperty` 데코레이터가 없어 Swagger 문서에서 `currentWorkflow`의 내부 스키마가 `{}`로 표현된다. API 계약 문서의 정확성이 저하된다.
- 제안: `AssistantWorkflowNodeDto`, `AssistantWorkflowEdgeDto`의 각 필드에 `@ApiProperty` 추가.

---

**[WARNING] `LLMClient.stream()`이 optional이지만 오류 코드가 문자열 리터럴**
- 위치: `llm-client.interface.ts`, `llm.service.ts` — `chatStream()`
- 상세: `stream?`가 없을 때 `throw new BadRequestException({ code: 'LLM_STREAMING_UNSUPPORTED' })`를 던지나, 이 에러 코드가 프론트엔드 `assistant.ts`의 `AssistantSseEvent` 타입과 연동되지 않는다. 클라이언트는 `event: error`로만 수신하므로 코드 문자열이 계약상 정의되어야 한다.
- 제안: 에러 코드 열거형(`LLM_STREAMING_UNSUPPORTED`, `LLM_RATE_LIMIT`, `LLM_CONNECTION_ERROR`, `ASSISTANT_STREAM_FAILED`)을 공유 상수 파일로 추출하고, `AssistantSseEvent`의 error data에 `code: KnownErrorCode` 타입을 적용.

---

**[INFO] `DELETE /sessions/:id`가 소유 세션 전용이지만 `@Roles('editor')`로만 가드됨**
- 위치: `workflow-assistant.controller.ts` — `remove()`
- 상세: 삭제는 `WorkflowAssistantSessionService.findOneForUser()`에서 `userId` 소유권을 검증하므로 실질적 보안 문제는 없다. 그러나 역할 기반 가드와 소유권 기반 검증의 레이어가 명시적으로 문서화되지 않아 이후 유지보수 시 한 레이어만 수정하는 실수 가능성이 있다.
- 제안: 컨트롤러 메서드에 JSDoc 또는 인라인 주석으로 "role guard + ownership check" 이중 보호임을 명시.

---

**[INFO] 응답 래핑 구조 불일치 — 세션 API vs 기존 패턴**
- 위치: `assistant.ts` — `listSessions()`, `getLatestSession()`, `getSessionDetail()`, `createSession()`, `updateSession()`
- 상세: 클라이언트 코드가 `data.data` 형태로 응답을 언래핑하는데(`{ data: AssistantSessionData[] }`), 컨트롤러는 `return this.sessionService.xxx()`를 그대로 반환한다. 프로젝트에 글로벌 `TransformInterceptor`가 `{ data: ... }` 래핑을 자동 적용하는지 확인 필요하다. 만약 미적용 상태라면 `data.data`가 항상 `undefined`가 된다.
- 제안: 글로벌 인터셉터 적용 여부를 `app.module.ts`에서 확인하고, 없다면 컨트롤러에 `@UseInterceptors(TransformInterceptor)`를 명시하거나 클라이언트를 `data.data` → `data`로 수정.

---

**[INFO] SSE keepalive 주석 코드(`': ping\n\n'`)가 클라이언트 파서에서 무시되는지 검증 필요**
- 위치: `workflow-assistant.controller.ts` — `keepalive` interval, `assistant.ts` — `parseSseRecord()`
- 상세: keepalive는 `': ping\n\n'` 형식으로 전송되고, `parseSseRecord`에서는 `line.startsWith(":")` 줄을 `continue`로 건너뛴다. 현재는 정상 동작하지만, SSE 레코드 구분자가 `\n\n`인데 keepalive 자체도 `\n\n`으로 끝나므로 `buffer.indexOf("\n\n")` 로직이 빈 레코드를 파싱할 수 있다. 빈 레코드는 `event`가 null이므로 `return null`로 처리되어 문제없지만, 의도를 명확히 하는 주석이 없다.
- 제안: `parseSseRecord`에 keepalive/comment 레코드 처리 명시 주석 추가.

---

### 요약

신규 Workflow AI Assistant API는 전반적으로 RESTful 설계 원칙을 따르고, JWT + RolesGuard + 소유권 검증의 다층 인증을 갖추고 있다. 그러나 **메시지 목록 무제한 조회**(응답 크기 리스크)와 **SSE 에러가 HTTP 200으로 흡수되는 구조**(모니터링 사각지대)가 운영 환경에서 실질적인 문제를 유발할 수 있다. `GET /sessions/latest` 경로 충돌 위험과 Swagger 스키마 불완전은 중간 우선순위의 개선 사항이며, 응답 래핑 불일치(`data.data`)는 글로벌 인터셉터 설정에 따라 즉시 버그로 전환될 수 있어 즉각 확인이 필요하다.

### 위험도
**MEDIUM**