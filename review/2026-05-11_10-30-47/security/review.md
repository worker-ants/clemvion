## 발견사항

### [WARNING] LLM 타임아웃 시 HTTP 소켓 미해제로 인한 리소스 누수
- **위치**: `llm.service.ts:86`, 코드 주석: "LLMClient.chat 은 아직 AbortSignal 을 받지 않으므로 race 만 적용"
- **상세**: `withTimeout`은 `Promise.race`로 구현되어 타임아웃 시 reject하지만, 내부 HTTP 소켓은 AbortSignal 없이 계속 진행됨. 임베딩 60s × batch 재시도 3회 + 그래프 90s × CHUNK_LLM_CONCURRENCY(3) 동시 실행 환경에서 대량 타임아웃 발생 시 열린 소켓/스레드가 누적될 수 있으며, 충분한 부하에서 서버 리소스 고갈로 이어질 수 있음
- **제안**: 후속 PR에서 `LLMClient.chat/embed`에 `AbortSignal` 전파 우선 구현 권고. 단기적으로는 `http.globalAgent.maxSockets` 또는 provider SDK의 connection pool 상한 설정으로 방어

---

### [WARNING] WebSocket 채널(`kb:${documentId}`) 서버 측 인가 미확인
- **위치**: `use-kb-events.ts:98-100` — `ws.subscribe(\`kb:${docId}\`)`
- **상세**: 프론트엔드는 페이지에 표시된 `documentIds`를 기반으로 채널을 구독함. 백엔드 `WebsocketService`가 subscribe 시 사용자 ↔ documentId 소유 관계를 검증하지 않는다면, 타 워크스페이스 document ID를 알고 있는 공격자가 해당 문서의 LLM 오류 메시지(`embedding_error_message`, `graph_error_message`)를 WS 이벤트로 수신할 수 있음 (정보 노출)
- **제안**: `WebsocketService.emitExecutionEvent`의 채널 emit 방식 및 subscribe 핸들러에서 JWT workspaceId ↔ document.knowledgeBaseId.workspaceId 대조 로직 존재 여부 검증 필요

---

### [WARNING] `error_message` TEXT 컬럼 길이 미제한 → 저장 DoS 가능성
- **위치**: `V037__kb_retry_failed_status.sql:30,34` — `ADD COLUMN embedding_error_message TEXT`, `graph_error_message TEXT`
- **상세**: `sanitizeLlmErrorMessage`가 내부 URL/키를 걸러주지만 해당 함수의 최대 길이 제한 여부가 이 diff에서 확인 불가. LLM provider가 비정상적으로 긴 응답/오류 메시지를 반환하거나 `sanitizeLlmErrorMessage`가 길이를 제한하지 않을 경우, `embedding_error_message`/`graph_error_message`에 수MB짜리 텍스트가 저장될 수 있음 (pg row 크기 증가, 조회 시 네트워크 비용)
- **제안**: DB 컬럼 `length: 2000` 등 제약 또는 `sanitizeLlmErrorMessage` 내 `slice(0, 2000)` 강제 적용

---

### [INFO] `isRetryableLlmError` NON_RETRYABLE 패턴의 false-positive 위험
- **위치**: `retry-with-backoff.util.ts:58-68`
- **상세**: `/\bnot found\b/i` 패턴이 NON_RETRYABLE에 포함되어 있어, 네트워크 에러 메시지에 "not found"가 우연히 포함되면 재시도 가능한 오류임에도 즉시 `failed`로 전환됨. 예: `"DNS lookup: address not found for api.openai.com"`. 또한 `/Extraction response/i` 는 향후 provider가 에러 메시지에 해당 문자열을 포함시킬 경우 오분류 가능
- **제안**: `not found` 패턴을 HTTP 404 컨텍스트로 좁히거나(`/\b404\b.*not found/i`) 제거하고 명시적 404만 처리; `Extraction response` 패턴도 도메인 에러 판단 기준 문자열로 교체

---

### [INFO] `stuck-document-recovery.service.ts`의 비표준 interval 구성
- **위치**: `stuck-document-recovery.service.ts:87-91`
- **상세**: `($1::text || ' ms')::interval` 패턴은 $1이 parameterized bound value여서 SQL injection은 아니지만, `STUCK_THRESHOLD_MS`가 `10 * 60 * 1000` (상수)임에도 간접 문자열 조합 형태를 취해 코드 리뷰 시 injection 의심을 유발하고 향후 유지보수자 혼란 초래
- **제안**: `NOW() - INTERVAL '10 minutes'` 리터럴로 교체하거나 외부화 시 `MAKE_INTERVAL(secs => $1)` 사용

---

### [INFO] `retryFailed` body DTO 부재 — 런타임 검증 약화
- **위치**: `knowledge-base.controller.ts:257` — `@Body() body: { scope?: 'embedding' | 'graph' | 'all' }`
- **상세**: TypeScript 타입은 컴파일 타임 전용. 런타임에 `body.scope`는 임의 문자열. 화이트리스트 검사(`includes(scope)`)가 있어 현재 동작은 안전하나, 미들웨어 레이어에서 직렬화 오류(malformed JSON) 시 `body`가 `null`일 경우 `body?.scope ?? 'all'` 패턴은 방어되나 NestJS class-validator 기반 DTO가 아니므로 추가 필드 주입이 무시된 채 통과됨
- **제안**: `class RetryFailedBodyDto { @IsIn(['embedding','graph','all']) @IsOptional() scope: ... }` 형태의 DTO + ValidationPipe 적용

---

### [INFO] 다중 인스턴스 동시 stuck 회수 시 중복 큐잉
- **위치**: `stuck-document-recovery.service.ts:94-108` — 주석: "race 발생 시 같은 문서가 두 번 큐잉되어도 worker 단계에서 idempotent"
- **상세**: `SELECT → UPDATE → queue.add` 가 단일 트랜잭션이 아니므로 A·B 두 인스턴스가 동시에 SELECT 후 동일 문서를 모두 큐에 추가 가능. `reEmbed=true` idempotency로 기능 정확성은 보장되지만 불필요한 LLM 호출 비용 발생
- **제안**: `FOR UPDATE SKIP LOCKED` 또는 `CTE (WITH upd AS (UPDATE ... RETURNING id))`로 SELECT+UPDATE 원자화

---

## 요약

전체적으로 SQL 쿼리는 파라미터 바인딩을 일관되게 사용하고, 오류 메시지는 `sanitizeLlmErrorMessage`를 통해 외부 노출 전 처리되며, RBAC(`@Roles('editor')`) 및 UUID 파이프(`ParseUUIDPipe`)를 통한 입력 검증이 적용되어 있어 기본 보안 수준은 양호합니다. 주요 위험은 타임아웃 시 HTTP 소켓 미해제(리소스 누수), WebSocket 채널 subscribe의 서버 측 인가 여부 미확인, 그리고 `error_message` TEXT 컬럼의 길이 미제한 세 가지로, 이 중 WS 인가와 소켓 누수는 부하 증가 시 실질적 영향을 줄 수 있습니다.

## 위험도

**MEDIUM**