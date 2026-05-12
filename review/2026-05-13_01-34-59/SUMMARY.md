# Code Review 통합 보고서

## 전체 위험도
**LOW** — 핵심 payload guard 로직은 올바르게 구현되었으나, 정리 스크립트의 워커 활성화 부작용·문서 상태 방치·레이어 간 검증 불일치·테스트 공백이 복합적으로 잔류

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side Effect | `NestFactory.createApplicationContext(AppModule)` 호출이 `@Processor` 워커를 즉시 활성화시켜, dry-run 중에도 실제 큐 소비가 발생함. 정상 pending job이 스크립트 실행 도중 처리되거나, `active` job이 조회에서 누락됨 | `cleanup-invalid-queue-jobs.ts:71` | AppModule 대신 BullMQ `Queue`를 Redis URL로 직접 인스턴스화하거나, 슬림 컨텍스트 모듈 사용 |
| 2 | Architecture / Testing | `InvalidJobPayloadError` throw 시 `documentRepository.update`가 호출되지 않아 해당 document의 `embeddingStatus`/`graphExtractionStatus`가 `pending`/`processing`으로 영구 방치될 수 있음 | `document-embedding.processor.ts:47-60`, `graph-extraction.processor.ts:43-56` | `onFailed` 핸들러에서 `InvalidJobPayloadError` 여부를 확인하여 문서 상태를 `failed`로 마킹. `onFailed` 테스트도 함께 추가 |
| 3 | Requirement | `assertDocumentIdPayload`는 `documentId.trim() === ''`으로 whitespace-only를 차단하지만, service 진입부 가드 `!documentId`는 `'   '`를 truthy로 통과시킴. 두 경로가 동일 입력에 대해 다른 에러 경로를 발생시킴 | `job-payload.util.ts:38` vs `embedding.service.ts:61`, `graph-extraction.service.ts:100` | service 가드 조건을 `!documentId?.trim() \|\| typeof documentId !== 'string'`으로 통일. 테스트에 `'   '` 케이스 추가 |
| 4 | Plan / Documentation | `job-payload.util.ts` 신규, 두 processor, 두 service 가드, 테스트, cleanup 스크립트가 모두 구현되었으나 체크리스트가 전부 `[ ]` 로 남아 있음. CLAUDE.md PLAN 라이프사이클 규약 위반 | `plan/in-progress/queue-payload-guard.md` 전체 | 완료된 항목을 `[x]`로 갱신. TEST/REVIEW WORKFLOW 완료 후 `git mv plan/in-progress/queue-payload-guard.md plan/complete/` |
| 5 | Architecture | `InvalidJobPayloadError`가 BullMQ `UnrecoverableError`를 상속하지 않아, 큐 설정의 `attempts`가 변경되면 손상 job이 재시도 폭주할 수 있음 | `job-payload.util.ts:9-17`, 두 processor의 throw 경로 | `InvalidJobPayloadError extends UnrecoverableError` 적용 또는 processor에서 `throw new UnrecoverableError(err.message)`로 래핑 |
| 6 | Testing | `DocumentEmbeddingProcessor.onFailed` 핸들러 테스트 전무. batch/non-batch 두 경로 모두 미검증 | `document-embedding.processor.spec.ts` 전체 | `onFailed` batch/non-batch 케이스 추가 |
| 7 | Testing | `ragMode='graph'`일 때 `graphQueue.add('extract', ...)` 호출 여부 미검증. graph chaining은 핵심 side-effect | `document-embedding.processor.spec.ts` | `ragMode: 'graph'`, `isKbBatch: false/true` 케이스 추가하여 `mockGraphQueue.add` 호출 assert |
| 8 | Testing | `EmbeddingService`/`GraphExtractionService` 가드 테스트에서 `undefined` 케이스와 empty string 케이스의 assertion 대상이 비대칭. 동일 코드 경로임에도 검증 기준이 불일치 | `embedding.service.spec.ts:90-102`, `graph-extraction.service.spec.ts:97-100` | 두 케이스 모두 동일한 mock 전체를 `not.toHaveBeenCalled`로 assert하거나 `it.each`로 통합 |
| 9 | Testing | `maybeChainGraphExtraction`의 fallback DB 조회 경로 미검증 (`ragMode`/`knowledgeBaseId` 없는 케이스) | `document-embedding.processor.spec.ts` | `data: { documentId: 'd1' }` payload로 `onCompleted` 호출 시 `mockDataSource.query` 호출 assert |
| 10 | Architecture | processor(인프라)와 service(도메인) 양 계층이 동일한 payload 검증 책임을 중복 보유. service 가드 주석이 "컨트롤러 직접 호출"을 언급하여 컨트롤러-서비스 간 입력 검증 체인 결함을 시사 | `embedding.service.ts:58-68`, `graph-extraction.service.ts:97-109` | 컨트롤러 경로가 실제로 존재한다면 `ParseUUIDPipe`/DTO class-validator로 진입부 차단. 서비스 가드는 `assert`로 교체 검토 |
| 11 | Maintainability | `assertDocumentIdPayload` 호출 감싸는 try-catch + `InvalidJobPayloadError` 타입가드 + 로그 구조가 두 processor에 동일하게 복제됨 | `document-embedding.processor.ts:47-58`, `graph-extraction.processor.ts:43-54` | `job-payload.util.ts`에 `logAndRethrowPayloadError(logger, jobType, job, err)` 헬퍼 추출 |
| 12 | Scope | `variable-modification.handler.ts`의 `Object.hasOwn` 리팩토링, `integration-credentials.e2e-spec.ts`·`workflow-crud.e2e-spec.ts` 포맷팅 변경이 큐 payload guard 스코프와 혼입 | 세 파일 전체 | 별도 커밋 또는 별도 PR로 분리 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Dependency | `Object.hasOwn`은 Node.js 16.9+ / ES2022 API. Node 14 환경이면 `TypeError` 발생 | `variable-modification.handler.ts:124` | `package.json` `engines.node` 또는 `.nvmrc`로 16.9+ 보장 확인. NestJS v10 기준 사실상 위험 없음 |
| 2 | Performance / Security | `queue.getJobs([...QUEUE_STATES])`가 `start=0, end=-1`(전체)로 동작. 수만 건 이상 누적 시 힙 OOM 위험 | `cleanup-invalid-queue-jobs.ts:57` | `getJobCountByTypes()`로 규모 확인 후 진행하는 절차를 주석에 추가. 또는 청크 단위(1000건) 페이지네이션 |
| 3 | Performance | `job.remove()` 직렬 실행 — invalid job이 수백 건이면 O(n × RTT) | `cleanup-invalid-queue-jobs.ts:73-81` | `Promise.all(invalid.map(j => j.remove()))` 또는 p-limit 병렬화 |
| 4 | Architecture | `InvalidJobPayloadError` 재시도 방지가 큐 `defaultJobOptions.attempts=1` 설정에 암묵적으로 의존. 큐 설정 변경 시 무력화 | `job-payload.util.ts:9-12` | 큐 등록 시 `defaultJobOptions: { attempts: 1 }` 명시적 설정 (WARNING #5와 연계) |
| 5 | Dependency | cleanup 스크립트 실행이 `ts-node`를 암묵적으로 요구하나 코드에 명시 없음 | `cleanup-invalid-queue-jobs.ts:11` 사용법 주석 | 주석에 `ts-node`가 devDependencies 필요임을 명시하거나 `package.json` scripts에 등록 |
| 6 | Testing | `isInvalid` 함수가 `assertDocumentIdPayload`와 별도로 구현되어 향후 drift 위험. 순수 함수이므로 단위 테스트 가능 | `cleanup-invalid-queue-jobs.ts` | `isInvalid`를 export하거나 `assertDocumentIdPayload` 검증 로직과 통합. 최소한 "동일 기준 유지" 주석 추가 |
| 7 | Architecture | `job-payload.util.ts`가 `queues/` 하위에 위치하여 세 번째 큐 추가 시 `shared/queue/`로 이동 필요 | `queues/job-payload.util.ts` | 현 규모에서 적절. 세 번째 큐 추가 시 이동 검토 |
| 8 | Concurrency | `graph-extraction.service.ts` `pLimit` 병렬 처리에서 `totalEntityDelta` 등 누적 변수가 `await` 없는 연속 라인에 의존. `await` 삽입 시 데이터 레이스 구조적 취약점 | `graph-extraction.service.ts` `doExtract()` | 누적 라인이 yield 없이 실행됨을 명시하는 짧은 주석으로 의도 고정 |
| 9 | Concurrency | `sweepQueue()`의 `getJobs()` → `remove()` 사이 TOCTOU. 워커 활성 시 처리 중 job이 false-positive로 집계될 수 있음 | `cleanup-invalid-queue-jobs.ts` `sweepQueue()` | `--apply` 실행 전 워커 중지 또는 큐 pause 권고를 usage 주석에 추가 |
| 10 | Documentation | service 가드 주석이 processor 구현에 교차 의존("DocumentEmbeddingProcessor가 이미 검증"). processor가 변경되거나 직접 호출 경로가 늘면 오해 유발 | `embedding.service.ts:61-64`, `graph-extraction.service.ts:98-101` | "큐 워커 경로에서는 processor가 검증. 본 가드는 직접 호출 경로 방어용"으로 caller 중립적 표현으로 교체. CLAUDE.md 규약상 1줄로 압축 |
| 11 | Documentation | cleanup 스크립트 실행 완료 후 파일 보존 여부가 plan 어디에도 기록되지 않음 | `plan/in-progress/queue-payload-guard.md` | "회귀 재발 대비로 `scripts/`에 보존" 또는 "1회 사용 후 삭제" 결정을 plan 문서에 한 줄 추가 |
| 12 | Database | `maybeFinalizeKbBatch`의 `NOT EXISTS` 서브쿼리가 `document(knowledge_base_id, embedding_status)` 복합 인덱스 없을 시 full scan | `document-embedding.processor.ts`, `graph-extraction.processor.ts` (컨텍스트) | 마이그레이션에서 두 복합 인덱스 확보 여부 점검 |
| 13 | Testing | processor 테스트에서 whitespace-only documentId(`'   '`) 케이스 없음. `job-payload.util.spec.ts`의 커버리지와 분리 | `document-embedding.processor.spec.ts`, `graph-extraction.processor.spec.ts` | processor 테스트 중 하나에 whitespace-only 케이스 추가 (낮은 우선순위) |
| 14 | Security | `cleanup-invalid-queue-jobs.ts`가 전체 AppModule 부팅으로 DB/Redis 자격증명을 메모리에 로드 | `cleanup-invalid-queue-jobs.ts:71` | 운영 절차 문서에 최소 권한 환경에서 실행 명시 (WARNING #1과 연계) |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Side Effect | LOW | cleanup 스크립트 워커 활성화 부작용, 문서 상태 `pending` 방치 |
| Architecture | LOW | UnrecoverableError 미상속, 레이어 책임 모호성, AppModule 과부팅 |
| Testing | LOW | `onFailed` 미테스트, graph chaining 미테스트, guard 테스트 assertion 비대칭 |
| Requirement | LOW | whitespace documentId 레이어 간 불일치, plan 미갱신, attempts=1 코드 미강제 |
| Scope | LOW | 무관한 3개 파일 혼입(variable-modification, 두 e2e 파일) |
| Maintainability | LOW | try-catch 패턴 중복, 주석 장황, plan 체크박스 미갱신 |
| Documentation | LOW | plan 체크박스 미갱신, service 가드 주석 교차의존, JSDoc 설정 의존 |
| Performance | LOW | `getJobs()` 전체 적재, serial `remove()` |
| Security | LOW | payload keys 로그 노출(미미), cleanup 스크립트 자격증명 메모리 로드 |
| Concurrency | LOW | pLimit 누적 변수 암묵적 단일스레드 의존, sweepQueue TOCTOU |
| Dependency | LOW | `Object.hasOwn` Node.js 16.9+ 하한, ts-node 암묵적 의존 |
| Database | LOW | NOT EXISTS 복합 인덱스 미확보 위험, N+1 트랜잭션 |
| API Contract | NONE | 외부 HTTP API 계약 변동 없음 |

---

## 발견 없는 에이전트

- **API Contract** — 공개 HTTP 엔드포인트 경로·요청/응답 스키마·인증 방식·HTTP 상태 코드 중 어느 것도 변경 없음

---

## 권장 조치사항

1. **[즉시] cleanup 스크립트 워커 활성화 차단** — `NestFactory.createApplicationContext(AppModule)` 대신 BullMQ `Queue`를 Redis URL로 직접 인스턴스화. 운영 실행 전 반드시 해결 (WARNING #1)

2. **[즉시] `InvalidJobPayloadError` → `UnrecoverableError` 상속** — 큐 `attempts` 설정 변경 시 재시도 폭주 방지를 코드 수준에서 강제 (WARNING #5)

3. **[즉시] plan 문서 갱신 및 이동** — 완료된 체크박스 `[x]` 갱신 후 TEST/REVIEW WORKFLOW 완료 시 `git mv plan/in-progress/queue-payload-guard.md plan/complete/` (WARNING #4)

4. **[단기] `onFailed` 핸들러에서 문서 상태 `failed` 마킹** — `InvalidJobPayloadError` 감지 시 `embeddingStatus`/`graphExtractionStatus`를 `failed`로 업데이트하여 영구 pending 방지 (WARNING #2)

5. **[단기] whitespace documentId 검증 통일** — service 가드를 `!documentId?.trim() || typeof documentId !== 'string'`으로 수정. 테스트에 `'   '` 케이스 추가 (WARNING #3)

6. **[단기] 테스트 공백 보완** — `onFailed` 핸들러 테스트, `ragMode='graph'` chaining 테스트, guard 테스트 assertion 통일 (WARNING #6, #7, #8)

7. **[단기] try-catch 패턴 DRY화** — `logAndRethrowPayloadError` 헬퍼를 `job-payload.util.ts`에 추출하여 두 processor의 중복 제거 (WARNING #11)

8. **[중기] 스코프 외 변경 분리** — `variable-modification.handler.ts`, e2e 포맷팅 변경을 별도 커밋/PR로 분리 (WARNING #12)

9. **[운영] cleanup 스크립트 실행 절차 문서화** — 규모 확인(`getJobCountByTypes`), 워커 중지 절차, `--apply` 전 dry-run 검토를 운영 가이드에 명시 (INFO #2, #9)