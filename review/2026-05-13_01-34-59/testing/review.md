### 발견사항

---

**[WARNING] `DocumentEmbeddingProcessor` — `onFailed` 핸들러 테스트 누락**
- 위치: `document-embedding.processor.spec.ts` (전체)
- 상세: `onCompleted`는 non-batch/batch 두 경로 모두 테스트되어 있으나, `@OnWorkerEvent('failed')` → `onFailed`는 단 하나의 테스트도 없음. `onFailed`가 `maybeFinalizeKbBatch`를 올바르게 호출하는지 검증되지 않음.
- 제안: `onFailed`에 batch/non-batch 케이스 추가.

---

**[WARNING] `DocumentEmbeddingProcessor` — `maybeChainGraphExtraction(ragMode='graph')` 미검증**
- 위치: `document-embedding.processor.spec.ts`
- 상세: 현재 `onCompleted` 테스트는 `ragMode='vector'`만 다뤄 `graphQueue.add`가 호출되지 않는 경로만 확인. `ragMode='graph'`일 때 `graphQueue.add('extract', …)`가 실제로 호출되는지 검증하는 테스트 없음. graph chaining은 핵심 side-effect이므로 회귀 위험이 있음.
- 제안: `ragMode: 'graph'`, `isKbBatch: false/true` 케이스를 각각 추가해 `mockGraphQueue.add` 호출을 assert.

---

**[WARNING] service guard 테스트 — 빈 문자열 케이스 assertion 불일치**
- 위치: `embedding.service.spec.ts:100-104`, `graph-extraction.service.spec.ts:97-100`
- 상세:
  - `EmbeddingService`: `undefined` 케이스는 `findOne`+`update`+`increment` 미호출 모두 검증. 빈 문자열 케이스는 `increment` 검증 누락.
  - `GraphExtractionService`: `undefined` 케이스는 `findOne`+`update` 검증. 빈 문자열 케이스는 `findOne`만 검증하고 `update` 누락.
  - 두 service 모두 진입 가드(`return` early)는 동일 코드 경로이므로 assertion 기준을 통일해야 함.
- 제안: 두 케이스 모두 동일한 mock 세트 전체를 `not.toHaveBeenCalled`로 assert.

---

**[WARNING] `maybeChainGraphExtraction` fallback DB 조회 경로 미검증**
- 위치: `document-embedding.processor.spec.ts`
- 상세: `ragMode`나 `knowledgeBaseId`가 payload에 없을 때 `dataSource.query`로 DB를 조회하는 fallback 분기가 있으나, 이 경로에 대한 테스트 없음. DB 조회 실패 시 catch-silently 처리도 미검증.
- 제안: `data: { documentId: 'd1' }` (ragMode/knowledgeBaseId 없음)으로 `onCompleted` 호출 시 `mockDataSource.query`가 호출되는지 assert하는 테스트 추가.

---

**[INFO] `cleanup-invalid-queue-jobs.ts` — `isInvalid` / `sweepQueue` 단위 테스트 없음**
- 위치: `backend/scripts/cleanup-invalid-queue-jobs.ts`
- 상세: 운영 스크립트이므로 e2e 테스트가 없는 것은 이해 가능하나, `isInvalid` 함수는 순수 함수로 독립 unit test가 가능함. 특히 whitespace-only string을 invalid로 처리하는 로직이 `assertDocumentIdPayload`와 별도로 구현되어 있어 향후 drift 위험이 있음.
- 제안: `isInvalid`를 export하거나 `assertDocumentIdPayload`의 검증 로직과 통합을 고려. 최소한 인라인 주석으로 "동일 기준 유지" 명시.

---

**[INFO] processor 레벨에서 whitespace-only documentId 미검증**
- 위치: `document-embedding.processor.spec.ts`, `graph-extraction.processor.spec.ts`
- 상세: `job-payload.util.spec.ts`에서 whitespace-only는 `it.each`로 커버되나, processor 테스트에서는 `''`(빈 문자열) 케이스만 있고 `'   '` 케이스 없음. util 테스트와 processor 테스트의 커버리지가 분리되어 있어 processor 변경 시 regression 발견이 늦어질 수 있음.
- 제안: processor 테스트 중 하나에 whitespace-only 케이스 추가(낮은 우선순위).

---

**[INFO] `InvalidJobPayloadError` debug context — `it.each` 전체 케이스 미검증**
- 위치: `job-payload.util.spec.ts:31-43`
- 상세: `it.each`는 throw 여부만 검증하고 debug 객체(`payloadKeys`, `documentIdType` 등)는 별도 단일 테스트 하나로만 확인. 예컨대 `{ documentId: null }` 케이스에서 `documentIdType: 'object'`가 정확히 보고되는지 미검증.
- 제안: 현재 구조로 충분하나, `documentId: null` 케이스의 `documentIdType`을 명시적으로 assert하는 테스트 추가 고려(null은 `typeof null === 'object'`이므로 실수 발견에 유효).

---

**[INFO] `variable-modification.handler.ts` — `Object.hasOwn` 변경은 기존 테스트로 충분히 커버**
- 위치: `variable-modification.handler.ts:124`
- 상세: `Object.prototype.hasOwnProperty.call` → `Object.hasOwn` 은 동등 치환이므로 신규 테스트 불필요. 기존 handler 테스트가 `hadVariable` 분기를 이미 커버한다고 가정하면 회귀 없음.

---

### 요약

핵심 guard 로직(`assertDocumentIdPayload`, service 진입 가드)은 체계적인 단위 테스트로 잘 커버되어 있고, `job-payload.util.spec.ts`의 `it.each` 패턴과 진단 컨텍스트 검증은 모범적이다. 다만 `DocumentEmbeddingProcessor`에서 `onFailed` 핸들러와 `ragMode='graph'` chaining 경로가 테스트되지 않아 향후 graph queue 연동 회귀를 탐지하기 어렵고, 두 service의 빈 문자열 guard 테스트가 undefined 케이스 대비 assertion 기준이 느슨해 일관성이 부족하다. 이 두 가지 WARNING을 해소하면 전체 테스트 품질은 양호한 수준이다.

### 위험도

**LOW** — guard 로직 자체는 잘 테스트되어 있으며, 미검증 경로(`onFailed`, graph chaining)는 기존 동작을 바꾸는 코드가 아닌 위임 경로이므로 즉각적 장애 위험은 낮다.