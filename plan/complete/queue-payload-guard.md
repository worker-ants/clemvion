# Queue Payload Guard — Embedding / Graph 워커 영구실패 로그 잡음 보완

## 배경

백엔드 기동 시 매번 다음 로그가 떨어졌다.

```
ERROR [EmbeddingService] Embedding failed permanently for document undefined: Empty criteria(s) are not allowed for the update method.
ERROR [GraphExtractionService] Graph extraction failed permanently for document undefined: Empty criteria(s) are not allowed for the update method.
ERROR [GraphExtractionService] Graph extraction failed permanently for document undefined: Empty criteria(s) are not allowed for the update method.
```

원인:
1. BullMQ 큐(Redis) 에 누적된 손상/레거시 job — payload 에 documentId 가 빠져 있음.
2. `DocumentEmbeddingProcessor.process()` / `GraphExtractionProcessor.process()` 가 `job.data.documentId` 를 검증 없이 그대로 service 로 위임.
3. service 의 catch 블록이 `documentRepository.update(undefined, …)` 를 호출해 TypeORM 이 "Empty criteria(s)" 로 거부 → 같은 catch 안에서 추가 update 호출이 2차 에러로 증폭.

스펙 (`spec/5-system/8-embedding-pipeline.md §9`, `spec/5-system/10-graph-rag.md §7.1`) 은 LLM 일시 오류에 대한 재시도 정책만 정의. 입력 검증(payload 무결성) 은 별도 정의 없음 — 본 패치는 **스펙 변동 없는 입력 검증 강화**.

## 작업 항목

- [x] spec/5-system/8, 10 의 Retry & Failure / Rationale 검토 → spec 변동 없음
- [x] `backend/src/modules/knowledge-base/queues/job-payload.util.ts` 신규
  - `InvalidJobPayloadError extends UnrecoverableError` (BullMQ 재시도 폭주 차단)
  - `isValidDocumentId` (processor·service·cleanup 스크립트 공통 검증)
  - `assertDocumentIdPayload` (job → documentId 추출 + diagnostic debug 컨텍스트)
  - `logInvalidJobPayload` (두 processor 공통 로그 헬퍼)
- [x] 두 processor 에 `assertDocumentIdPayload` + `logInvalidJobPayload` 적용
- [x] 두 service (`processDocument` / `extractDocument`) 진입부 가드 — `isValidDocumentId` 로 통일 (whitespace 도 차단)
- [x] `knowledge-base.module.ts` 의 BullModule.registerQueue 에 `defaultJobOptions.attempts=1` 명시
- [x] 테스트: helper / 두 processor (정상·invalid·whitespace·onFailed·graph chain·DB fallback) / 두 service (it.each 통합)
- [x] `backend/scripts/cleanup-invalid-queue-jobs.ts` 신규 — BullMQ Queue 직접 인스턴스화 (AppModule 부팅 X → 워커 활성화 X) + 페이지네이션 + 병렬 remove
- [x] TEST WORKFLOW: lint · npm test · npm run build (e2e 는 `[skip-e2e]` — LLM·queue 입력 검증만 변경)
- [x] REVIEW WORKFLOW: ai-review → RESOLUTION.md (Warning 12건 / Info 14건 조치)

## 결정 사항

- criteria 표기 `update(documentId, …)` → `update({ id: documentId }, …)` 통일은 **제외**. TypeORM 0.3 에서 `{ id: undefined }` 도 동일 거부 + `{ id: '' }` 는 silent no-op (오히려 위험).
- 누적 손상 job 정리는 **수동 스크립트 (dry-run/--apply)**. 자동 sweep 은 향후 producer 변경 시 정상 job 까지 삭제할 위험으로 채택하지 않음.
- cleanup 스크립트는 회귀 재발 대비로 `backend/scripts/` 에 보존. 일회성이지만 운영자가 동일 증상 재발 시 재실행 가능.
- Layer 1+2+3 (입력 검증 + 진단 로그 + service 가드) + Layer 4 (운영 스크립트) 를 한 PR 로 묶음. 실행은 머지 후 수동 1회.

## 관련 파일

- `backend/src/modules/knowledge-base/queues/document-embedding.processor.ts`
- `backend/src/modules/knowledge-base/queues/graph-extraction.processor.ts`
- `backend/src/modules/knowledge-base/queues/job-payload.util.ts` (신규)
- `backend/src/modules/knowledge-base/embedding/embedding.service.ts` (진입부 가드)
- `backend/src/modules/knowledge-base/graph/graph-extraction.service.ts` (진입부 가드)
- `backend/src/modules/knowledge-base/knowledge-base.module.ts` (attempts=1 명시)
- `backend/scripts/cleanup-invalid-queue-jobs.ts` (신규)
- 참고 plan: `/Users/gehrig/.claude/plans/merry-enchanting-naur.md`
- 리뷰 산출물: `review/2026-05-13_01-34-59/` (+ `RESOLUTION.md`)
