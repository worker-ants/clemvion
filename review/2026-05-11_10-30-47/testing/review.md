### 발견사항

---

**[CRITICAL] `retryFailedDocuments` 메서드 테스트 부재**
- 위치: `knowledge-base.service.spec.ts`
- 상세: `retryFailedDocuments` (scope='embedding'/'graph'/'all' 분기, vector 모드 KB에 graph 요청, 대상 0건, 다수 문서 큐잉)는 이번 변경의 핵심 비즈니스 로직임에도 테스트가 전혀 없음.
- 제안: 각 scope 분기 + vector 모드 KB에 graph scope 요청 + 대상 없음 케이스 테스트 추가 필요.

---

**[CRITICAL] `getEmbeddingStats` 메서드 테스트 부재**
- 위치: `knowledge-base.service.spec.ts`
- 상세: 신규 `getEmbeddingStats` 메서드에 단일 테스트도 없음. completed/failed/pending 카운트 집계 SQL 결과 매핑 검증 불가.
- 제안: 다양한 status 분포 데이터로 집계 결과 매핑 검증 테스트 추가.

---

**[CRITICAL] `GraphExtractionService` 재시도 시나리오 테스트 부재**
- 위치: `graph-extraction.service.spec.ts`
- 상세: `EmbeddingService`에는 timeout 후 성공, 3회 연속 실패 시나리오 테스트가 신규 추가됐으나, 동일 `retryWithBackoff` 로직을 사용하는 `GraphExtractionService`에는 대응 테스트가 없음. `doExtract`의 idempotency(chunk_entity DELETE 재진입) 검증도 없음.
- 제안: `embedding.service.spec.ts`와 동등한 `retry & failure` describe 블록 추가.

---

**[WARNING] 컨트롤러 테스트 부재 — `embeddingStats`, `retryFailed` 엔드포인트**
- 위치: `knowledge-base.controller.ts` — 컨트롤러 spec 파일 없음
- 상세: `GET /:id/embedding-stats`, `POST /:id/retry-failed` 엔드포인트에 대한 단위·통합 테스트가 없음. `retryFailed`의 `BadRequestException` 분기(잘못된 scope), Throttle 적용 여부도 미검증.
- 제안: 컨트롤러 spec 또는 e2e 테스트에서 두 엔드포인트의 정상 흐름 + 유효성 검증 실패 케이스 추가.

---

**[WARNING] `stuck-document-recovery.service.spec.ts` — 그래프 테스트 mock 순서 취약**
- 위치: `stuck-document-recovery.service.spec.ts:61–75`
- 상세: `mockResolvedValueOnce([]) / mockResolvedValueOnce([{id:'d2'...}]) / mockResolvedValueOnce([])` 순서는 서비스 내부 쿼리 실행 순서와 1:1 매핑됨. `recoverStuckEmbedding`/`recoverStuckGraphExtraction` 내부 로직 변경 시 테스트가 묵묵히 오작동할 수 있음.
- 제안: `queryMock.mock.calls` 내용으로 실제 실행된 SQL 을 명시적으로 검증하거나, 각 복구 메서드를 분리 테스트해 mock 의존성 감소.

---

**[WARNING] `onAttempt` 내부 throw 시 동작 미검증**
- 위치: `retry-with-backoff.util.spec.ts`, `retry-with-backoff.util.ts:79–83`
- 상세: 구현이 `onAttempt` 오류를 무음으로 삼키는데, 이 동작(DB 업데이트 실패가 재시도 루프를 막지 않음)을 검증하는 테스트가 없음.
- 제안: `onAttempt`가 reject하는 경우 재시도가 계속 진행됨을 검증하는 테스트 케이스 추가.

---

**[WARNING] `reEmbedAll` 변경에 대한 검증 누락**
- 위치: `knowledge-base.service.spec.ts`, `knowledge-base.service.ts:497–506`
- 상세: `reEmbedAll`에 신규 추가된 `embedding_retry_count = 0, embedding_error_message = NULL` reset SQL이 기존 spec에 검증되지 않음.
- 제안: 기존 `reEmbedAll` 테스트에 해당 UPDATE SQL 호출 검증 추가.

---

**[WARNING] `retryWithBackoff` maxRetries=0 엣지 케이스 미검증**
- 위치: `retry-with-backoff.util.spec.ts`
- 상세: `maxRetries=0`(단 1회 실행, 재시도 없음)은 현재 테스트되지 않음. `attemptIdx <= maxRetries` 루프에서 0은 즉시 throw 경로를 거침.
- 제안: `maxRetries=0` 케이스에서 fn이 1회만 호출되고 즉시 throw됨을 검증.

---

**[INFO] `sanitizeLlmErrorMessage` 동작이 간접적으로만 검증됨**
- 위치: `embedding.service.spec.ts:291`, `retry-with-backoff.util.spec.ts`
- 상세: `embeddingErrorMessage: expect.any(String)`처럼 느슨한 매처를 사용하거나, timeout 메시지 sanitize 결과를 `stringContaining('timed out')`으로만 검증. sanitize 함수 자체의 필터링 로직(URL·키 제거 등) 단위 테스트가 이 파일군에 없음.
- 제안: `sanitize-error.util.spec.ts`를 독립 파일로 작성하거나, 현재 `embedding.service.spec.ts`에서 sanitize 결과물을 더 구체적인 문자열로 검증.

---

**[INFO] `useKbEvents` 훅 테스트 없음**
- 위치: `frontend/src/lib/websocket/use-kb-events.ts`
- 상세: WS 연결·구독·cleanup, throttle(1초), documentIds 변경 시 재구독 같은 복잡한 비동기 동작을 검증하는 테스트 없음. WS 단절 시 polling fallback과의 공존도 미검증.
- 제안: `renderHook` + msw/fake-socket으로 subscribe/unsubscribe 흐름, throttle, cleanup 검증 추가 권장(필수 우선순위는 백엔드보다 낮음).

---

### 요약

핵심 재시도·실패 복구 유틸(`retryWithBackoff`, `StuckDocumentRecoveryService`)과 `EmbeddingService` 재시도 시나리오는 잘 테스트되어 있으나, 가장 중요한 엔트리포인트인 `retryFailedDocuments`·`getEmbeddingStats` 서비스 메서드와 해당 컨트롤러 엔드포인트에 테스트가 전혀 없다. `GraphExtractionService`도 동일한 retry 로직을 가지면서 대응 테스트가 누락되어 대칭성이 깨진다. 이 세 가지 CRITICAL 갭은 운영 환경에서 "실패 문서 재시도" 기능이 조용히 오동작해도 테스트로 잡을 수 없는 상태를 만든다.

### 위험도

**HIGH**