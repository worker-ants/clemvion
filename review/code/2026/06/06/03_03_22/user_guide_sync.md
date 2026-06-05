# 유저 가이드 동반 갱신(User Guide Sync) Review

## 발견사항

### [INFO] 실행 엔진 resume 인프라 변경 — 05-run-and-debug/ 동반 갱신 해당성 회색 지대

- 변경 파일:
  - `codebase/backend/migrations/V087__execution_resume_call_stack.sql`
  - `codebase/backend/src/modules/executions/entities/execution.entity.ts`
  - `codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts`
- 매트릭스 항목: `run-debug-flow-change` (id) — change_type "실행·디버깅 흐름 변경", trigger semantic, targets `codebase/frontend/src/content/docs/05-run-and-debug/`
- 누락된 동반 갱신: `codebase/frontend/src/content/docs/05-run-and-debug/` 관련 페이지
- 상세: 이번 변경은 `Execution` 엔티티에 `resumeCallStack JSONB NULL` 컬럼(V087)과 타입 정의(`ResumeCallStack` / `ResumeCallStackFrame`)를 추가해 중첩 sub-workflow blocking 노드의 durable park/resume 인프라를 구축합니다. 그러나 entity 주석에 "API DTO 미포함(whitelist 매핑이라 자동 배제)"가 명시되어 있어 해당 컬럼은 사용자 가시 API 응답이나 UI에 노출되지 않습니다. 또한 이번 커밋 범위는 타입 정의와 migration 추가에 한정되며, 실제 park/resume 로직 변경(pendingContinuations 제거, slow-path 일원화 등)은 PR-B2 이후 단계입니다. 사용자가 관찰하는 실행·디버깅 흐름 자체는 이번 커밋으로 변경되지 않으므로 `05-run-and-debug/` 갱신 의무가 즉시 발생하지는 않습니다. PR-B2(turn-park + barrier 제거)가 실제 실행 흐름을 변경할 때 동반 갱신 여부를 재검토해야 합니다.
- 제안: PR-B2 구현 완료 시점에 `05-run-and-debug/` 문서가 중첩 sub-workflow 재개 동작을 사용자에게 안내해야 하는지 재점검. 이번 커밋 단독으로는 docs 갱신 의무 없음.

---

## 요약

매트릭스 19개 rows 중 이번 변경 파일(`codebase/backend/migrations/**`, `codebase/backend/src/modules/executions/entities/**`, `codebase/backend/src/shared/**`, `plan/**`, `review/**`)에 glob-match 되는 trigger는 없음. 의미 매칭(semantic) 대상으로 `run-debug-flow-change`(실행·디버깅 흐름 변경)가 회색 지대에 해당하나, 해당 변경은 사용자 가시 API/UI에 노출되지 않는 내부 DB persistence 인프라이며 실제 흐름 변경은 이번 커밋 범위 밖임. 나머지 trigger(new-node, node-schema-change, new-ui-string, integration-provider-change, new-warning-code, new-error-code, new-backend-ui-zod-value, new-handler-output-field, auth-session-flow-change, expression-language-change 등)는 모두 해당 없음. 매칭 trigger 1건(INFO 회색 지대), 누락 판정 0건.

## 위험도

NONE
