# RESOLUTION — 23_35_27

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | 아키텍처 (deferred) | — | 후속 작업 계획. ExecutionRepository 커스텀 클래스 도입(raw SQL data 레이어 격리). SUMMARY 권장 #9 로 지정됨 |
| #2 | 아키텍처 (deferred) | — | 후속 작업 계획. computeChainDepth ExecutionRepository 격리. SUMMARY 권장 #10 으로 지정됨 |
| #3 | 아키텍처 (deferred) | — | 후속 작업 계획. enqueueEmbedChunked SRP 분리. SUMMARY 권장 #10 으로 지정됨 |
| #4 | 코드 | d890e304, 3af5b1bf | findByWorkflow 반환 타입을 WorkflowVersionListItem(Omit<WorkflowVersion,'snapshot'>) 로 좁혀 snapshot 접근 컴파일 타임 차단 |
| #5 | 코드 | d890e304 | execution-engine.service.spec.ts 기존 6개 assertion 에 /status IN/ matcher 추가 |
| #6 | 코드 | d890e304 | PENDING→RUNNING 동시 선점(0행→false) + query() reject 케이스 2개 추가 |
| #7 | 코드 | d890e304 | knowledge-base.service.spec.ts 에 2 chunk 중 1번째 실패+2번째 성공 케이스 추가 |
| #8 | 코드 | d890e304 | integration-expiry-scanner.service.spec.ts 에 배치 경계 idempotency 테스트 추가 |
| #9 | 코드 | d890e304 | retryFailedDocuments 의 local CHUNK_SIZE=100 제거, EMBED_CHUNK_SIZE 참조 통일 |
| #10 | SPEC-DRIFT (적용됨) | spec §7.1 갱신 | `spec/3-workflow-editor/5-version-history.md` §7.1 을 `WorkflowVersionListItemDto[]`(snapshot 제외 명시) + §7.2 대비 표로 갱신. m-3 ticket 의 spec 갱신 권고와 일치. draft 제거. |
| #11 | 코드 (no-op) | d890e304 | 프론트엔드 영향 확인: version-history-panel.tsx 가 WorkflowVersionSummary(snapshot 없음) 소비 — 영향 없음. workflows.ts L99-106 확인 |
| #12 | 코드 | d890e304 | computeChainDepth JSDoc 에서 Rationale 해석 단언 완화, spec 갱신 예정 주석으로 교체 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (40 passed)
- e2e   : 통과 (188/188)

## 보류·후속 항목

- 아키텍처 deferred #1: ExecutionRepository 커스텀 클래스 도입(updateExecutionStatus raw SQL 격리) — 후속 refactor 태스크로 계획
- 아키텍처 deferred #2: computeChainDepth ExecutionRepository 격리 — 후속 refactor 태스크로 계획
- 아키텍처 deferred #3: enqueueEmbedChunked SRP 분리(큐 적재와 DB 보상 분리) — 후속 refactor 태스크로 계획
- spec draft #10: **적용 완료** — spec/3-workflow-editor/5-version-history.md §7.1 을 WorkflowVersionListItemDto(snapshot 제외 명시) + §7.2 대비 표로 갱신. draft (`plan/in-progress/spec-update-workflow-version-list-response.md`) 제거.
- INFO #5/#6 (데이터베이스): integration (status, tokenExpiresAt), workspace_member (workspace_id, role) 복합 인덱스 존재 여부 EXPLAIN 확인 권장
- INFO #7 (Requirement): reEmbedAll documentCount 의미 변경(프론트엔드가 전체 대상 수로 가정하면 { totalDocuments, enqueuedCount } 분리 노출 검토)
