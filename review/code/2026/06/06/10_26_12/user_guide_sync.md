# 유저 가이드 동반 갱신 (User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` 19행 로드 완료. `PROJECT.md` 보조 참조.

## 변경 파일 식별

이번 PR(`exec-park-durable-resume`, PR-B1/B2 범위) 의 코드 변경 파일:

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
- `codebase/backend/src/modules/executions/entities/execution.entity.ts`
- `codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts`
- `codebase/backend/migrations/V087__execution_resume_call_stack.sql`
- `spec/5-system/4-execution-engine.md`
- `spec/1-data-model.md`
- `review/**`, `plan/**` (리뷰·플랜 산출물 — trigger 매칭 무관)

## trigger 매칭 결과

| 매트릭스 row id | trigger | 매칭 파일 | 매칭 여부 |
|---|---|---|---|
| `run-debug-flow-change` | semantic — 실행 엔진·디버그 로깅 변경 | `execution-engine.service.ts` | 매칭 |
| `new-error-code` | glob `codebase/backend/src/nodes/core/error-codes.ts` | 미변경 (에러 코드가 서비스 내 string literal 로 정의) | 부분 매칭 (semantic 관점) |
| `spec-major-change` | glob `spec/5-*/**` | `spec/5-system/4-execution-engine.md` | 매칭 |
| `new-node` / `node-schema-change` | glob `codebase/backend/src/nodes/**` | 해당 없음 | 미매칭 |
| `new-ui-string` | semantic — TSX 신규 한국어 리터럴 | 해당 없음 (frontend TSX 변경 없음) | 미매칭 |
| `auth-session-flow-change` | semantic — auth 미들웨어 변경 | 해당 없음 | 미매칭 |
| `expression-language-change` | semantic | 해당 없음 | 미매칭 |
| `integration-provider-change` | semantic | 해당 없음 | 미매칭 |

---

## 발견사항

### [WARNING] 실행 엔진 변경에 대한 `05-run-and-debug/` 유저 가이드 동반 갱신 누락

- **변경 파일**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- **매트릭스 항목**: `run-debug-flow-change` — "backend 실행 엔진·디버그 로깅 변경이 `codebase/frontend/src/content/docs/05-run-and-debug/` 갱신 누락"
- **누락된 동반 갱신**: `codebase/frontend/src/content/docs/05-run-and-debug/` 내 관련 페이지 (특히 `running-a-workflow.mdx` / `run-results.mdx` / `error-handling.mdx`)
- **상세**: 이번 PR 은 실행 엔진에 park/durable-resume 흐름을 신규 도입했다. 구체적으로 (a) `waiting_for_input` 상태에서의 즉시 BullMQ worker 해제(park), (b) 재개 시 rehydration, (c) 재개 실패 시 `RESUME_CHECKPOINT_MISSING` / `RESUME_FAILED` / `RESUME_INCOMPATIBLE_STATE` 에러 코드로 Execution 종결 등 사용자에게 직접 관찰 가능한 실행 흐름 변화가 포함된다. `05-run-and-debug/error-handling.mdx` 는 `waiting_for_input` 대기 시간 제외를 언급하나 park/resume 실패 케이스(서버 재시작 후 재개 불가, checkpoint 누락 등)는 기술되지 않는다. 사용자 가이드가 stale 상태.
- **제안**: `05-run-and-debug/running-a-workflow.mdx` 또는 `run-results.mdx` 에 "Form 노드·AI Agent 대화 대기 중 서버 재시작이 발생하면 실행이 취소될 수 있다" 는 동작 설명 추가. `error-handling.mdx` 에는 RESUME_* 에러 코드 발생 시 사용자 대처 안내(재실행 권장) 추가 검토. 한/영 `.en.mdx` 양쪽 갱신 필요.

---

### [WARNING] 신규 RESUME_* 에러 코드의 `backend-labels.ts` ERROR_KO 매핑 누락

- **변경 파일**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (신규 에러 코드 `RESUME_CHECKPOINT_MISSING`, `RESUME_FAILED`, `RESUME_INCOMPATIBLE_STATE` 정의 및 사용)
- **매트릭스 항목**: `new-error-code` — "backend-labels.ts 에 ERROR_KO 매핑 테이블이 없어 영문 message 노출됨. errorCode 추가 시 사용자 가시 ko 노출을 PR 본문에 명시 (후속 plan 에서 ERROR_KO 신설 검토)"
- **누락된 동반 갱신**: `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 `ERROR_KO` 맵에 세 코드 미등록
- **상세**: `RESUME_CHECKPOINT_MISSING`, `RESUME_FAILED`, `RESUME_INCOMPATIBLE_STATE` 는 Execution 재개 실패 시 `Execution.error.code` 에 기록되어 프론트엔드 실행 결과 화면에 노출된다. 현재 `ERROR_KO` 맵에 세 코드 모두 없으므로 `translateBackendErrorCode` 함수가 영문 코드 원문을 그대로 반환한다. 기존 `EXECUTION_TIME_LIMIT_EXCEEDED` 는 PR-B1 때 `ERROR_KO` 에 한국어 설명이 등록된 반면, 이번 PR 의 RESUME_* 코드는 등록되지 않았다. 단, 매트릭스 row `new-error-code` 의 글로브 trigger 는 `codebase/backend/src/nodes/core/error-codes.ts` 이며 이 파일은 이번 PR 에서 변경되지 않았다 — RESUME_* 코드는 서비스 내 string literal 로 정의됨. 매트릭스 의도(사용자 노출 에러 코드 ko 매핑)는 동일하게 적용되므로 WARNING 처리.
- **제안**: `codebase/frontend/src/lib/i18n/backend-labels.ts` `ERROR_KO` 에 아래 세 항목 추가 또는 후속 plan 에 명시적 등록:
  - `RESUME_CHECKPOINT_MISSING`: "재개 데이터를 찾을 수 없어 실행이 취소됐어요. 워크플로우를 다시 실행해 주세요."
  - `RESUME_INCOMPATIBLE_STATE`: "재개 상태가 호환되지 않아 실행이 취소됐어요. 워크플로우를 다시 실행해 주세요."
  - `RESUME_FAILED`: "실행 재개 중 오류가 발생해 실행이 취소됐어요. 워크플로우를 다시 실행해 주세요."

---

### [INFO] `spec/5-system/4-execution-engine.md` 변경의 spec-major-change 동반 갱신 — frontmatter 정합 확인

- **변경 파일**: `spec/5-system/4-execution-engine.md`
- **매트릭스 항목**: `spec-major-change` — "frontmatter code: / status: / pending_plans: 정합 갱신"
- **누락된 동반 갱신**: (없음 — 아래 판정 참조)
- **상세**: `spec/5-system/4-execution-engine.md` frontmatter 확인 결과 `status: partial`, `code:` glob 존재, `pending_plans:` 에 `exec-park-durable-resume.md` 포함됨. `spec-frontmatter.test.ts` / `spec-code-paths.test.ts` / `spec-pending-plan-existence.test.ts` 가드 기준 충족. 누락 없음.

---

## 요약

매트릭스 19행 중 이번 PR 에 적용 가능한 trigger 는 `run-debug-flow-change`(실행 흐름 변경), `new-error-code`(신규 에러 코드), `spec-major-change`(spec 변경) 3개다. `spec-major-change` 는 frontmatter 정합이 유지되어 누락 없음. `run-debug-flow-change` 에 대한 `05-run-and-debug/` 유저 가이드 갱신(park/resume 실패 케이스 안내) 및 `new-error-code` 에 대한 `backend-labels.ts` ERROR_KO 3건(RESUME_CHECKPOINT_MISSING / RESUME_FAILED / RESUME_INCOMPATIBLE_STATE) 매핑이 누락됐다. 총 trigger 3개 매칭, 누락 2건(WARNING 2).

## 위험도

MEDIUM
