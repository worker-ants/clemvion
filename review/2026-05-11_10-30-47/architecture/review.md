## 아키텍처 리뷰

### 발견사항

---

**[WARNING] `isRetryableLlmError`의 모듈 위치 오분류**
- 위치: `backend/src/modules/knowledge-base/utils/retry-with-backoff.util.ts`
- 상세: LLM 에러 패턴 판정 로직(`isRetryableLlmError`)이 `knowledge-base/utils/`에 위치해 있어, 향후 다른 모듈(예: Workflow 실행, Agent 호출)이 LLM 재시도 로직이 필요할 때 `knowledge-base` 모듈을 직접 참조하거나 패턴을 복제해야 하는 구조가 된다. `sanitizeLlmErrorMessage`는 이미 `modules/llm/utils/`에 있으므로 도메인 귀속이 명확한데, `isRetryableLlmError`만 KB 모듈에 고립되어 있는 것은 일관성 위배.
- 제안: `isRetryableLlmError`를 `modules/llm/utils/retryable-error.util.ts`로 이동하고 `retry-with-backoff.util.ts`에서 import. 이렇게 하면 `retryWithBackoff` 유틸 자체는 LLM 무관한 범용 유틸로 `common/utils/`로 승격도 가능.

---

**[WARNING] 비재시도성 오류 시 DB 이중 쓰기 (error → failed)**
- 위치: `retry-with-backoff.util.ts:73-84`, `embedding.service.ts:onAttempt 콜백`
- 상세: `retryWithBackoff`에서 `onAttempt`는 에러의 재시도 여부 판정 *이전에* 항상 호출된다. 비재시도성 오류(401, 차원 mismatch 등) 발생 시 `onAttempt`가 `embeddingStatus = 'error'`를 DB에 쓴 뒤 즉시 throw되고, 외부 catch가 `embeddingStatus = 'failed'`로 덮어쓴다. 결과적으로 최종 실패 하나에 DB write가 2회 발생하며 중간에 짧은 `'error'` 상태가 노출된다.
- 제안: `onAttempt` 콜백 signature에 `willRetry: boolean`을 추가하거나, `onAttempt`를 재시도 *전에만* 호출하고 최종 실패 알림은 별도 `onFinalFailure` 옵션으로 분리. 또는 `onAttempt` 내에서 `willRetry` 여부를 판단해 status 분기 처리(현재 EmbeddingService의 `willRetry` 변수는 있으나 status 분기가 외부 catch에 의존).

---

**[WARNING] `retryFailed` 엔드포인트의 인라인 타입 body — DTO 없음**
- 위치: `knowledge-base.controller.ts:264`
- 상세: `@Body() body: { scope?: 'embedding' | 'graph' | 'all' }` 인라인 타입을 사용해 class-validator 데코레이터도, Swagger `@ApiBody()` 문서화도 없다. 현재 수동으로 `BadRequestException`을 throw하는 코드가 Service가 아닌 Controller에 있어 레이어 책임 경계도 모호.
- 제안: `RetryFailedBodyDto` 클래스를 생성해 `@IsOptional()`, `@IsIn(['embedding','graph','all'])` 적용. Controller의 scope 검증 코드를 제거하고 ValidationPipe에 위임.

---

**[WARNING] EmbeddingService / GraphExtractionService 간 재시도 상수 중복**
- 위치: `embedding.service.ts:14-16`, `graph-extraction.service.ts:29-31`
- 상세: `MAX_RETRIES = 3`, `BASE_DELAY_MS = 1_000`이 두 서비스에 동일하게 선언되어 있다. 현재는 동일 값이지만 독립적으로 관리되므로 한쪽만 변경되면 정책 불일치가 발생한다.
- 제안: `retry-with-backoff.util.ts`에 `DEFAULT_RETRY_OPTIONS`를 export하거나, 환경 변수 기반 설정 모듈로 중앙화.

---

**[WARNING] `doExtract`에서 KB 이중 조회 (N+1 on retry)**
- 위치: `graph-extraction.service.ts:processDocument`, `graph-extraction.service.ts:doExtract`
- 상세: `processDocument`에서 KB를 `findOne`으로 조회한 뒤 `kb.id`를 `doExtract`에 전달하는데, `doExtract` 내부에서 `knowledgeBaseId`로 KB를 다시 `findOne` 조회한다. 3회 재시도 시 KB를 총 4회 SELECT한다. KB는 임베딩 진행 중 거의 변경되지 않으므로 불필요한 쿼리.
- 제안: `processDocument`에서 조회한 `kb` 객체를 `doExtract(documentId, kb)` 형태로 직접 전달하거나, `kb`를 클로저로 캡처.

---

**[INFO] `KnowledgeBaseService`의 단일 책임 부담 증가**
- 위치: `knowledge-base.service.ts`
- 상세: 기존의 KB CRUD + 재임베딩 외에 `getEmbeddingStats`, `retryFailedDocuments`, `getGraphStats` 확장이 추가되어 서비스 파일이 500줄 이상으로 성장 중이다. 현재는 수용 가능한 수준이나 `KbDocumentStatusService`나 `KbRetryService` 분리를 중기적으로 검토할 시점.
- 제안: 즉시 분리보다는 명확한 모듈 경계 설정을 위해 서비스 내에 `// --- Retry & Status 관련 ---` 구분 주석이라도 유지. 다음 대형 기능 추가 시 분리.

---

**[INFO] `StuckDocumentRecoveryService`의 SQL interval 생성 방식**
- 위치: `stuck-document-recovery.service.ts:75`
- 상세: `($1::text || ' ms')::interval` 방식으로 interval을 생성. `$1`이 하드코드된 숫자이므로 SQL injection 위험은 없으나, `make_interval(mins => 10)` 또는 PostgreSQL 파라미터 바인딩에서 직접 `INTERVAL` 리터럴을 쓰는 것이 더 관용적이고 이식성이 높다.

---

**[INFO] `useKbEvents`의 deps 배열 join 우회**
- 위치: `use-kb-events.ts:107`
- 상세: `documentIds.join(",")` 는 문서 ID 배열의 변화를 단일 문자열로 비교하는 알려진 패턴이지만, 문서 수가 많을 경우 매 렌더링마다 문자열 연결 비용이 발생한다. `eslint-disable` 주석도 추가되어 있어 잠재적 버그 은폐 가능성.
- 제안: `useMemo`로 안정적인 의존성 값을 만들거나, 문서 ID set의 size + 정렬된 첫/마지막 ID로 cheap hash 구성.

---

### 요약

전체 아키텍처는 명확한 계층 분리와 책임 할당을 유지하고 있으며, `retryWithBackoff` 유틸의 Strategy 패턴 설계와 `StuckDocumentRecoveryService`의 Bootstrap Hook 활용은 적절하다. 다만 `isRetryableLlmError`의 모듈 귀속 오류와 비재시도성 에러 발생 시 불필요한 이중 DB 쓰기는 향후 다른 모듈의 LLM 통합 확장이나 상태 일관성 측면에서 정리가 필요하다. `retryFailed` 엔드포인트의 DTO 누락은 NestJS 컨벤션 위반이자 입력 검증 공백으로 조기에 수정하는 것이 바람직하다. 나머지 이슈들은 현재 기능에 직접적 위험을 주지 않으며 중기적 리팩토링 대상으로 충분하다.

### 위험도

**LOW**