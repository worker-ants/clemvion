## 발견사항

### [INFO] 외부 신규 의존성 없음 — 완전 내부 구현
- 위치: 전체 변경사항
- 상세: `retry-with-backoff.util.ts`, `stuck-document-recovery.service.ts`, `use-kb-events.ts` 모두 외부 패키지를 추가하지 않으며, 기존 `@nestjs/bullmq`, `bullmq`, `typeorm`, `@tanstack/react-query`, `react` 만 사용함.
- 제안: 유지. 외부 의존성 도입 없이 기능 구현한 점은 긍정적.

---

### [WARNING] `llm.service.ts` 의 `withTimeout` — diff 에 import 누락
- 위치: `backend/src/modules/llm/llm.service.ts`
- 상세: `withTimeout(() => client.chat(params), opts.timeoutMs)` 가 호출되지만, diff 에 해당 심볼의 import 추가가 보이지 않음. 기존 파일 상단에 이미 import 되어 있다면 문제없으나, 누락이면 런타임 `ReferenceError` 로 이어짐. 심볼 출처(`common/utils` 계열인지 `llm/utils` 계열인지)가 명확하지 않음.
- 제안: `llm.service.ts` 의 import 섹션 전체를 확인하여 `withTimeout` 출처를 명시적으로 검증할 것.

---

### [WARNING] `isRetryableLlmError` — `/not found/i` 패턴이 `ENOTFOUND` 류 네트워크 오류와 충돌 가능
- 위치: `retry-with-backoff.util.ts:52` — `NON_RETRYABLE_PATTERNS`
- 상세: `/not found/i` 는 HTTP 404 의도이지만, 일부 LLM provider SDK 가 DNS 실패를 `"Host not found: api.openai.com"` 형태로 표면화하면 재시도 대상 네트워크 오류가 비재시도로 오분류됨. Node.js 표준 DNS 오류(`ENOTFOUND`)는 공백 없어 안전하지만, SDK wrapping 메시지는 보장되지 않음.
- 제안: `/\b404\b/` 또는 `/\bnot found\b.*404/` 처럼 HTTP 상태 코드와 결합하거나, provider SDK 실제 오류 메시지 형식을 확인해 패턴을 좁힐 것.

---

### [WARNING] `StuckDocumentRecoveryService` — 다중 인스턴스 환경에서 중복 큐잉 가능
- 위치: `stuck-document-recovery.service.ts:79–96` (`recoverStuckEmbedding`)
- 상세: 코드 내 주석에 "race 발생 시 같은 문서가 두 번 큐잉되어도 idempotent" 라고 언급되어 있음. 그러나 이 의존성은 `EmbeddingService.processDocument` 의 `reEmbed=true` chunk 삭제 idempotency 에 전적으로 기댐. `document-embedding` 큐의 `removeOnComplete`/`jobId` 옵션이 없으면 중복 잡이 실제로 두 번 실행되어 임베딩 비용이 이중 청구될 수 있음.
- 제안: `embeddingQueue.add('embed', data, { jobId: \`recovery-${row.id}\` })` 처럼 명시적 `jobId` 를 사용해 BullMQ 레벨에서 중복 큐잉을 방지하거나, SELECT 후 UPDATE 를 단일 `UPDATE ... WHERE status='processing' RETURNING id` 로 원자화할 것.

---

### [INFO] `retry-with-backoff.util.ts` — `4^attemptIdx` 백오프 공식 최대 대기 총량
- 위치: `retry-with-backoff.util.ts:99`
- 상세: `baseDelayMs * 4^attemptIdx` 공식으로 3회 재시도 시 `1s + 4s + 16s = 21s` 총 대기. 임베딩 timeout 60s, 그래프 timeout 90s 기준으로 최대 4회 실행 × 90s + 21s = **381s(≈6.4분)** 의 단일 문서 처리 window. BullMQ 기본 `stalledInterval`(30s) × 반복 횟수와 충돌하지 않는지 확인 필요.
- 제안: BullMQ `lockDuration` 을 `GRAPH_CHUNK_TIMEOUT_MS × (GRAPH_MAX_RETRIES + 1) + totalBackoff + margin` 이상으로 설정하도록 `graph-extraction.processor.ts` Worker 옵션 점검.

---

### [INFO] 내부 모듈 의존 방향 — 적절
- 위치: `knowledge-base.module.ts`
- 상세: `StuckDocumentRecoveryService` 가 `providers` 에 등록되고, `DOCUMENT_EMBEDDING_QUEUE` / `GRAPH_EXTRACTION_QUEUE` 는 이미 `BullModule.registerQueue` 로 등록된 큐를 재사용함. 순환 의존 없음.
- 제안: 유지.

---

## 요약

이번 변경은 **외부 패키지를 전혀 추가하지 않고**, 기존 `@nestjs/bullmq`, `typeorm`, `@tanstack/react-query`, `react` 인프라만으로 재시도·실패·회수 기능을 구현했다. 의존성 관점의 리스크는 낮으나, `llm.service.ts` 의 `withTimeout` import 출처 확인, `isRetryableLlmError` 의 `/not found/i` 오분류 가능성, 다중 인스턴스 환경에서의 중복 큐잉 방지를 위한 BullMQ `jobId` 명시화 세 가지를 우선 검토할 것을 권장한다.

## 위험도

**LOW**