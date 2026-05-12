# Resolution — review/2026-05-13_01-34-59

본 리뷰는 `fix(kb-queue): 손상 job payload 가드` 커밋(`4e736653`) 을 대상으로 했다. Critical 0, Warning 12, Info 14. Warning 은 모두 조치, Info 는 본 작업 영역에 해당하는 항목만 조치하고 나머지는 명시적으로 사유와 함께 보류.

## Warning (12건) 조치

### #1 — cleanup 스크립트 워커 활성화 부작용 [Side Effect]
**조치 완료.** `NestFactory.createApplicationContext(AppModule)` 호출을 제거하고 BullMQ `Queue` 를 host/port 환경변수로 직접 인스턴스화하도록 재작성. AppModule 부팅이 사라져 `@Processor` 워커가 활성화되지 않으며, DB 자격증명도 메모리에 로드되지 않는다.

### #2 — InvalidJobPayloadError 발생 시 문서 상태 영구 방치 [Architecture/Testing]
**기각.** documentId 자체가 invalid 한 손상 job 은 매칭할 document 행이 없어 `embeddingStatus`/`graphExtractionStatus` 마킹 자체가 무의미하다. 정상 documentId 가 있으나 다른 이유로 영구 실패하는 경로(LLM 오류 소진 등) 는 service 의 try-catch 가 이미 status='failed' 로 마킹하고 있으므로 추가 조치 불요. processor 의 onFailed 는 KB batch finalize 만 책임.

### #3 — whitespace documentId 가드 불일치 [Requirement]
**조치 완료.** helper 의 `isValidDocumentId` 를 단일 진실 소스로 도입하고 service 진입부 가드(`embedding.service.ts:60`, `graph-extraction.service.ts:97`) 와 helper(`assertDocumentIdPayload`) 양쪽에서 동일하게 사용. 두 service spec 에 `'   '` 케이스 포함 `it.each` 로 통합.

### #4 — plan 체크박스 갱신 / 라이프사이클 위반 [Plan/Documentation]
**조치 완료.** `plan/in-progress/queue-payload-guard.md` 의 모든 항목을 `[x]` 로 갱신. TEST/REVIEW WORKFLOW 완료 후 `plan/complete/` 로 `git mv` 예정.

### #5 — InvalidJobPayloadError 가 UnrecoverableError 미상속 [Architecture]
**조치 완료.** `InvalidJobPayloadError extends UnrecoverableError` 적용. BullMQ 가 attempts 와 무관하게 즉시 failed 처리. 더불어 `BullModule.registerQueue` 에 `defaultJobOptions: { attempts: 1 }` 도 명시해 의도를 코드 레벨에서 이중으로 보장.

### #6 — DocumentEmbeddingProcessor.onFailed 테스트 부재 [Testing]
**조치 완료.** `document-embedding.processor.spec.ts` 에 batch / non-batch 두 케이스 추가:
- `onFailed: skips finalize for non-batch jobs`
- `onFailed: runs the same atomic finalize for batch child`

### #7 — ragMode='graph' chain 테스트 부재 [Testing]
**조치 완료.** 두 케이스 추가:
- `chains graph extraction when ragMode=graph in payload (no DB lookup)`
- `chains graph extraction with isKbBatch=true through to graphQueue`

### #8 — service guard 테스트 assertion 비대칭 [Testing]
**조치 완료.** 두 service spec 의 invalid documentId 케이스를 `it.each` 로 통합. `undefined / null / '' / '   '` 모든 케이스가 동일 assertion 묶음(`findOne`/`update`/`increment` 미호출) 사용.

### #9 — maybeChainGraphExtraction fallback DB 경로 미검증 [Testing]
**조치 완료.** 두 케이스 추가:
- `falls back to DB lookup when ragMode/knowledgeBaseId are missing` (graph mode 분기)
- `does not chain when DB fallback returns vector ragMode` (vector mode 분기)

### #10 — processor/service 검증 책임 중복 + 컨트롤러 직접 호출 시사 [Architecture]
**조치 완료.** service 가드 주석을 "큐 워커 경로에서는 processor 가 검증. 본 가드는 직접 호출 경로(테스트/스크립트) 방어용." 으로 caller-neutral 표현 변경. 컨트롤러는 실제로는 service 를 직접 호출하지 않고 큐 enqueue 만 하므로 주석에서 컨트롤러 언급 제거. service 가드는 외부 직접 호출(테스트/스크립트) 방어로만 의미를 한정.

### #11 — try-catch 패턴 중복 [Maintainability]
**조치 완료.** `logInvalidJobPayload(logger, jobType, job, err)` 헬퍼를 `job-payload.util.ts` 에 추출. 두 processor 의 catch 블록은 `logInvalidJobPayload(this.logger, 'embedding'|'graph extraction', job, err); throw err;` 두 줄로 축소.

### #12 — 스코프 외 변경 혼입 [Scope]
**기각 (사유 기록).** `variable-modification.handler.ts`, `integration-credentials.e2e-spec.ts`, `workflow-crud.e2e-spec.ts` 의 변경은 TEST WORKFLOW lint 단계에서 발견된 기존 main 의 error 2건 + warning 1건을 처리한 결과. developer skill 의 ISSUE FIX 규약(TEST WORKFLOW 에서 발견되는 사항은 기존부터 있던 이슈라도 반드시 해결)에 따라 같이 정리. 별도 PR 분리는 변경 자체가 사소해 비용 대비 이득이 작아 본 PR 에 포함 유지.

## Info (14건) 조치

| # | 카테고리 | 조치 |
|---|----------|------|
| 1 | Dependency — Object.hasOwn Node 16.9+ | **기각** — package.json engine·NestJS v10 환경 사실상 위험 없음 |
| 2 | Performance — getJobs 전체 적재 | **조치** — cleanup 스크립트에 `PAGE_SIZE=1000` 페이지네이션 적용 |
| 3 | Performance — serial remove() | **조치** — `Promise.all(invalidPage.map(j => j.remove()))` 병렬화 |
| 4 | Architecture — attempts=1 암묵 의존 | **조치** — knowledge-base.module 에 `defaultJobOptions: { attempts: 1 }` 명시 |
| 5 | Dependency — ts-node 암묵 의존 | **조치** — cleanup 스크립트 주석에 "ts-node 가 devDependencies 에 있어야 함" 명시 |
| 6 | Testing — isInvalid drift | **조치** — cleanup 스크립트가 `isValidDocumentId` (helper) 를 import 해 동일 기준 공유 |
| 7 | Architecture — job-payload.util 위치 | **기각** — 현 위치 적절. 세 번째 큐 추가 시 재검토 |
| 8 | Concurrency — pLimit 누적 변수 race | **기각 (작업 범위 외)** — graph-extraction.service.ts 의 기존 패턴, 본 패치와 무관. 별도 리팩토링 티켓으로 분리 권장 |
| 9 | Concurrency — sweepQueue TOCTOU | **조치** — cleanup 스크립트 주석에 "워커 stop / 큐 pause" 운영 절차를 1단계로 명시 |
| 10 | Documentation — service 가드 주석 교차의존 | **조치** — Warning #10 과 함께 처리 |
| 11 | Documentation — cleanup 보존 결정 | **조치** — plan 문서와 스크립트 헤더 주석에 보존 명시 |
| 12 | Database — NOT EXISTS 인덱스 | **기각 (작업 범위 외)** — 기존 finalize 패턴, 본 패치와 무관. 별도 마이그레이션 점검 티켓으로 분리 권장 |
| 13 | Testing — processor whitespace 케이스 | **조치** — 두 processor spec 에 whitespace 케이스 추가 |
| 14 | Security — cleanup 자격증명 메모리 로드 | **조치** — Warning #1 과 함께 처리 (AppModule 부팅 제거로 DB 자격증명 미로딩) |

## 후속 작업

- (별도 티켓) `graph-extraction.service.ts` 의 `pLimit` 안 누적 변수 동기성 명시 주석 (Info #8)
- (별도 티켓) `document(knowledge_base_id, embedding_status)` / `document(knowledge_base_id, graph_extraction_status)` 복합 인덱스 점검 (Info #12)
- (운영) 머지 후 `npx ts-node backend/scripts/cleanup-invalid-queue-jobs.ts` dry-run 1회 → `--apply` 로 Redis 손상 job 청소

## 재검증

- `npm run lint` — 통과
- `npm test` — 188 suites / 3293 tests 모두 통과 (이전 대비 +20: helper / processor / service 신규 케이스)
- `npm run build` — 통과 (`nest build`)
- e2e — 입력 검증·진단 로그·운영 스크립트만 변경, 통합/E2E 기능 변경 없음. `[skip-e2e]` 유지.

plan 문서 `plan/in-progress/queue-payload-guard.md` 의 모든 항목 완료 → `plan/complete/` 로 `git mv` 진행.
