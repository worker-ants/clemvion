### 발견사항

---

- **[CRITICAL]** WebSocket 이벤트 의미론(Semantics) 파괴적 변경
  - 위치: `spec/5-system/8-embedding-pipeline.md`, `spec/5-system/10-graph-rag.md`, `embedding.service.ts`, `graph-extraction.service.ts`
  - 상세: `document:embedding_error`와 `document:graph_error` 이벤트가 기존에는 **영구 실패**를 의미했으나, 이번 변경으로 **일시 오류(자동 재시도 예정)** 로 의미가 바뀌었다. 기존 WebSocket 구독자가 이 이벤트를 받아 "실패 처리"(알림 표시, 워크플로우 중단 등)를 수행하고 있었다면, 이제는 재시도 중인 문서를 잘못 실패로 간주하게 된다. 신규 최종 실패 이벤트(`embedding_failed` / `graph_failed`)는 완전히 새로운 이름이므로 기존 구독자는 영구 실패 신호 자체를 수신하지 못한다.
  - 제안: WebSocket API의 경우 버전 분리 또는 하위 호환 기간을 두는 것이 일반적이다. 단기 조치로는 `document:embedding_error`를 **deprecated** 상태로 병행 발행(dual-emit)하고, 새로운 의미의 이벤트는 `document:embedding_transient_error`처럼 별도 이름으로 신규 도입하는 방안을 권장한다.

---

- **[WARNING]** `graphExtractionStatus` 응답 필드의 nullable 변경
  - 위치: `frontend/src/lib/api/knowledge-bases.ts:47`, `backend/.../knowledge-base-response.dto.ts`
  - 상세: 기존 프론트엔드 타입은 `graphExtractionStatus: "pending" | "processing" | "completed" | "error"` (non-nullable)였으나, 이번 변경으로 `DocumentGraphExtractionStatus | null`(nullable)로 바뀌었다. DB 컬럼이 원래부터 nullable이었으므로 타입 수정 자체는 올바르나, 기존에 이 타입을 참조하던 프론트엔드 코드가 `null` 체크 없이 `.toLowerCase()` 등을 호출하면 런타임 에러가 발생할 수 있다. TypeScript는 이를 컴파일 에러로 잡아주겠지만 명시적 검토가 필요하다.
  - 제안: 기존 `STATUS_CONFIG` 참조 등 `graphExtractionStatus`를 사용하는 코드 전체에 `null` 가드 처리 여부를 확인한다.

---

- **[WARNING]** `POST /retry-failed` 요청 바디 검증이 런타임 수동 체크에만 의존
  - 위치: `knowledge-base.controller.ts:252-271`
  - 상세: `@Body() body: { scope?: 'embedding' | 'graph' | 'all' }` 는 인라인 타입으로, class-validator 데코레이터(`@IsIn()`, `@IsOptional()` 등)가 없다. NestJS의 전역 `ValidationPipe`가 이 타입을 런타임에 검증하지 못하므로, 컨트롤러 내부의 수동 `includes` 체크가 유일한 가드이다. 또한 `@ApiBody()` 데코레이터가 없어 OpenAPI 스키마에서 요청 바디가 문서화되지 않는다.
  - 제안: 별도 DTO 클래스 `RetryFailedBodyDto` 를 생성하고 `@IsIn(['embedding', 'graph', 'all'])`, `@IsOptional()` 을 적용한 뒤, `@ApiBody({ type: RetryFailedBodyDto })` 를 컨트롤러에 추가한다.

---

- **[WARNING]** `KbGraphStats` 응답에 필드 추가 — 기존 클라이언트 타입 불일치
  - 위치: `knowledge-base.service.ts:320-354`, `frontend/src/lib/api/knowledge-bases.ts:62-66`
  - 상세: `getGraphStats` 응답에 `failedDocumentCount`와 `pendingDocumentCount` 필드가 추가되었다. JSON 레벨에서는 additive이므로 HTTP 클라이언트 자체는 문제없다. 그러나 이 응답을 타입으로 엄격하게 검증하는 소비자(예: 기타 백엔드 서비스, OpenAPI codegen 클라이언트, E2E 테스트의 응답 스키마 검증)는 불일치를 감지할 수 있다.
  - 제안: 낮은 위험도이나, OpenAPI 스펙이 외부로 노출되거나 codegen을 사용하는 소비자가 있다면 버전 관리 여부를 확인한다.

---

- **[INFO]** `BadRequestException` 에러 응답 형식이 표준 NestJS 포맷과 상이
  - 위치: `knowledge-base.controller.ts:265-268`
  - 상세: `throw new BadRequestException({ code: 'INVALID_RETRY_SCOPE', message: "..." })` 는 NestJS가 `message` 필드에 객체를 넣어 `{ statusCode: 400, message: { code: ..., message: ... }, error: "Bad Request" }` 형태로 직렬화한다. 프로젝트의 다른 에러가 `message` 를 문자열로 반환하는 표준 포맷을 사용한다면 일관성이 깨진다.
  - 제안: `scope` 검증을 DTO + `ValidationPipe`로 이전하면 이 수동 throw 자체가 불필요해진다. 불가피하다면 `throw new BadRequestException("scope must be 'embedding', 'graph', or 'all'")` (문자열 인수)로 통일한다.

---

- **[INFO]** URL 경로 네이밍 불일치 — 임베딩 통계 vs 그래프 통계
  - 위치: `knowledge-base.controller.ts:208`, `frontend/src/lib/api/knowledge-bases.ts`
  - 상세: 신규 임베딩 통계 엔드포인트는 `GET /knowledge-bases/:id/embedding-stats`이나, 기존 그래프 통계는 (코드에 노출된 패턴으로 보아) `/knowledge-bases/:id/graph/stats` 또는 유사한 경로일 가능성이 있다. 두 통계 리소스의 경로 규칙이 다를 수 있다(`/embedding-stats` suffix형 vs `/graph/stats` subdirectory형).
  - 제안: 두 통계 엔드포인트의 경로를 `/knowledge-bases/:id/stats/embedding`, `/knowledge-bases/:id/stats/graph` 처럼 동일 패턴으로 맞추거나, 기존 패턴을 따라 `/knowledge-bases/:id/embedding/stats`로 조정한다.

---

- **[INFO]** `retryFailed` 에서 vector 모드 KB에 `scope='graph'` 요청 시 0건 반환 (에러 없음)
  - 위치: `knowledge-base.service.ts:391-396`
  - 상세: vector 모드 KB에 `{ scope: 'graph' }` 요청을 보내면 에러 없이 `{ graphRequeued: 0 }` 을 반환한다. 이는 의도된 설계(주석 참조)이나, API 소비자 입장에서는 요청이 조용히 무시되는 것처럼 보인다. `scope='all'` 호환을 위한 결정이므로 이해되지만, `scope='graph'` 를 명시적으로 지정한 경우는 클라이언트 실수일 가능성이 있다.
  - 제안: vector 모드 KB에 `scope='graph'`를 명시하면 `400 BAD_REQUEST` 또는 최소한 응답에 `"warning": "graph scope ignored for vector-mode KB"` 등의 힌트를 포함한다.

---

### 요약

이번 변경의 가장 중요한 API 계약 이슈는 WebSocket 이벤트 의미론 파괴적 변경이다. `document:embedding_error` / `document:graph_error` 가 "영구 실패 신호"에서 "일시 오류 신호"로 의미가 완전히 뒤바뀌었고, 기존 구독자는 새로운 영구 실패 이벤트(`*_failed`)를 수신하지 못한다. REST API 계약은 신규 엔드포인트 추가(하위 호환) 및 응답 필드 추가(additive) 위주로 비교적 안전하게 설계되었으나, `POST /retry-failed` 바디 검증 누락, `@ApiBody()` 미선언, 에러 응답 포맷 불일치 등의 중간 수준 문제가 혼재되어 있다. `graphExtractionStatus` nullable 변경은 타입 수정이 올바르지만 기존 소비자 코드 점검이 필요하다.

### 위험도
**HIGH** (WebSocket 이벤트 의미론 파괴적 변경으로 인해)