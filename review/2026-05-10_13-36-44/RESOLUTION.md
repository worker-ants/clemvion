# Code Review 조치 (2026-05-10 13:36:44 — workflow Phase 1)

## 요약

`feat(workflow): Phase 1 (A+D) — sub-workflow output 표준화 + 에러 코드 세분화`
커밋(`ba7951a8`)에 대한 13개 에이전트 통합 리뷰의 Critical 3건 / Warning 11건 / Info 9건을 검토. 본 task 가
명시한 **호환성 무시 (D 정책)** 의 의도된 파괴적 변경은 WONTFIX 로 기록하고, 그 외 품질 이슈는 모두 조치.

## Critical

### Critical #1 — Sync 출력 1단 래핑 (호환성 파괴)

**WONTFIX (intentional D-policy)**. 본 task 가 명시한 D-1 변경. 사용자 지시: "호환성 무시 (D)". 마이그레이션 가이드 미제공
정책. `plan/in-progress/spec-4-nodes-unimplemented-cleanup.md` §결정사항에 동일 정책 명시.
사용자가 다운스트림 워크플로우의 `$node["X"].output.<field>` 표현식을 `output.result.<field>` 로 직접 정정한다.

### Critical #2 — `mappingDefSchema` 필드명 파괴적 변경

**WONTFIX (intentional D-policy)**. 본 task A-1 의 "schema/handler 키 일치 — handler truth" 변경. 호환성 폴백 도입은
D 정책에 반함. 사용자가 기존 워크플로우의 inputMapping 항목을 paramName/expression 으로 갱신한다.

### Critical #3 — spec §5.3 JSON 예시의 에러 코드 모순

**FIXED**. `"code": "SUB_WORKFLOW_FAILED"` → `"code": "SUB_WORKFLOW_NOT_FOUND"` 로 수정. 메시지
`"Workflow not found: wf_uuid_9999"` 와 일치하도록 정렬. `spec/4-nodes/2-flow/1-workflow.md` §5.3 JSON 예시.

## Warning

### Warning #1 — Async `meta.status` 제거 (expression 소비자 파괴)

**WONTFIX (intentional D-policy)**. 본 task A-2 의 "`meta.status` → top-level `status`" 변경. CONVENTIONS Principle 11
(5필드 invariant) 의 `status` slot 사용으로 spec/구현 정합. 호환성 alias 유지는 D 정책에 반함.

### Warning #2 — `mapSubWorkflowError` 문자열 패턴 매칭의 fragility

**PARTIAL FIX + 후속 plan 항목 등록**. 즉시 조치:
- TIMEOUT 매칭에서 `'timeout'` 단독 키워드 제거 (Warning #8 도 동시 해결) — 실제 executor 가 던지는 `"timed out"` 만 매칭.
- JSDoc 에 `TODO: replace with instanceof WorkflowNotFoundError ...` 추가 + plan 후속 항목 링크.

중기 조치는 plan 후속 항목으로 등록: `plan/in-progress/spec-4-nodes-unimplemented-cleanup.md` 의 "후속 (별도 plan)" 섹션에
**WorkflowExecutor typed error hierarchy** 항목 추가. ErrorCode 도메인별 분리도 같이 검토.

### Warning #3 — executor 에러 메시지 무검열 노출

**FIXED**. `buildSubWorkflowError` 가 `truncateForErrorDetails(rawMessage)` 로 메시지를 500자 cap 후 envelope 에 삽입.
이메일 마스킹은 SUB_WORKFLOW 에러 메시지 컨텍스트에서 일반적이지 않아 보류 (Info #4 처리 참조).

### Warning #4 — `mapSubWorkflowError` public export 의 anti-pattern

**MITIGATED**. JSDoc 에 `@internal` 태그 추가하여 의도(테스트 전용) 명시. 별도 모듈 분리는 typed-error 리팩토링과 함께
중기 plan 항목으로 묶어 처리 (Warning #2 항목 참조).

### Warning #5 — 작업 식별자 (D-1, A-2, A-3) 주석

**FIXED**. 다음 위치에서 task ID 주석 제거 후 설계 의도 기반 주석으로 대체:
- `workflow.handler.ts` (sync wrap 주석, buildSubWorkflowError JSDoc)
- `workflow.handler.spec.ts` (테스트 이름 + 주석 모두)
- `error-codes.spec.ts` (sub-workflow 코드 정의 주석)

### Warning #6 — `workflowNodeOutputSchema.meta.status` 잔류 (스키마-핸들러 드리프트)

**FIXED**. `workflowNodeOutputSchema` 의 `meta` 객체에서 `status` 필드 제거. 주석으로
"async progress markers live on the top-level `status` field" 명시. `meta` 는 engine-injected metrics
(`durationMs` 등) 전용으로 reserve.

### Warning #7 — `output.result.result` 이중 중첩 위험

**FIXED (문서화)**. `workflow.handler.ts` 의 wrap 주석에 "if the inner workflow itself emits a `result` key, the access path
becomes `output.result.result` — an intentional double-nest, not a bug" 추가. spec §5.1 에도
"이중 중첩 케이스" 안내 박스 추가. wrap key 변경(`subResult`/`value`)은 spec §5.1 의 1단 래핑 결정에 반함.

### Warning #8 — `'timeout'` 단독 키워드 매칭 과도

**FIXED**. `mapSubWorkflowError` 에서 `lower.includes('timeout')` 분기 제거. `'timed out'` (executor 의 실제
phrasing) 만 매칭. 단위 테스트 추가: `"PostgreSQL connection timeout after 5s"` → `SUB_WORKFLOW_FAILED`,
`"Sub-workflow timeout exceeded"` → `SUB_WORKFLOW_FAILED` (executor 가 실제로 던지지 않는 phrasing).

### Warning #9 — TIMEOUT async 경로 통합 테스트 누락

**FIXED**. `workflow.handler.spec.ts` 에 "maps "timed out" → SUB_WORKFLOW_TIMEOUT (async path symmetry)" 케이스 추가.

### Warning #10 — QUEUE_FAILED sync 경로 통합 테스트 누락

**FIXED**. `workflow.handler.spec.ts` 에 "maps queue enqueue failures → SUB_WORKFLOW_QUEUE_FAILED (sync path symmetry)"
케이스 추가. QUEUE_FAILED 가 의미상 async 전용임도 주석으로 문서화.

### Warning #11 — `_executedNodes` Set 공유 동시성

**OUT OF SCOPE**. 본 PR 이 도입한 이슈가 아니며, parallel 노드 컨텍스트 격리는 별도 엔진 PR 영역. 리뷰어도
"이번 PR 범위 밖" 으로 분류. 후속 ticket 으로 처리할지 사용자 결정 대기.

## Info

### Info #1 — async top-level `status` 접근 예시 누락 (mdx)

**FIXED**. `flow.mdx` / `flow.en.mdx` async 섹션의 example block 에 `$node["X"].status` 접근 예시 한 줄 추가.

### Info #2 — `mapSubWorkflowError` 후속 추적 장치 없음

**FIXED**. JSDoc 에 `TODO: replace with instanceof ...` 명시 + `plan/in-progress/spec-4-nodes-unimplemented-cleanup.md`
의 "후속 (별도 plan)" 섹션에 plan 항목 등록 (Warning #2 참조).

### Info #3 — `error-codes.ts` 의 cross-file 참조 주석 stale 위험

**FIXED**. `// See workflow.handler.ts#mapSubWorkflowError` 주석을 기능 설명 중심으로 재작성:
"The Sub-Workflow handler picks the right code based on the executor's thrown message."

### Info #4 — `maskEmailForErrorDetails` 미적용

**WONTFIX (low-priority, scope mismatch)**. SUB_WORKFLOW 에러 컨텍스트는 보통 인프라 메시지 (Workflow not found,
queue offline) 가 dominant 이며 이메일 패턴 노출 빈도가 낮다. truncate 도입(Warning #3)으로 대용량 메시지 노출은 차단됨.
이메일 자동 sanitization 은 별도 서비스 계층 정책으로 처리하는 것이 적절.

### Info #5 — `workflowId` UUID 노출 (열거 가능성)

**OUT OF SCOPE**. CONVENTIONS §3.2 의 정의된 동작이며, API 게이트웨이 / 응답 직렬화 계층의 책임. 본 핸들러 단위에서
필터링하는 것은 책임 누수.

### Info #6 — 비-Error 객체 throw 케이스 미검증

**FIXED**. `workflow.handler.spec.ts` 에 "handles non-Error rejections (string / object) without throwing" 케이스 추가.
`mockExecutor.executeInline.mockRejectedValue('plain string error')` 로 검증.

### Info #7 — `"queue error occurred"` 경계 케이스 미문서화

**FIXED**. `mapSubWorkflowError` 단위 테스트의 queue 분기 케이스에 "queue error occurred" 경계 케이스 추가 +
"Boundary: lacks the failure markers we look for, so it stays as the generic fallback. Documented intentionally." 주석.

### Info #8 — `ErrorCode` God Object 화 위험

**TRACKED**. plan 후속 항목 (Warning #2 와 같은 항목에 묶음) 로 등록. typed error 리팩토링과 동시 처리.

### Info #9 — 신규 에러 코드 client unknown handling

**ACK**. additive 변경이므로 기존 `code === 'SUB_WORKFLOW_FAILED'` 전수 조건 client 는 새 코드를 미처리하지만,
graceful default 가 있는 정상 클라이언트는 영향 없음. 릴리즈 노트는 본 프로젝트의 `plan/` 라이프사이클로 갈음.

## 검증

- `cd backend && npm test` 통과 (175 suites, 2988 tests, +5 신규)
- `cd backend && npm run lint` 통과
- `cd backend && npm run build` 통과
- `cd frontend && npm run lint` 통과
- `cd frontend && npm run build` 통과
- `python3 scripts/check-doc-links.py` 0 broken refs
