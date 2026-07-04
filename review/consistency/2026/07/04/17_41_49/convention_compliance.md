# 정식 규약 준수 검토 — PR2b (concurrency cap enforcement)

## 스코프 정정 (mis-scoped payload)

전달받은 `_prompts/convention_compliance.md` 의 Target 문서는 `spec/5-system/1-auth.md`·
`spec/5-system/10-graph-rag.md`·`spec/conventions/audit-actions.md`·`cafe24-api-catalog/*` 였으나,
`git diff origin/main --stat` 으로 확인한 실제 변경 파일은 이들과 무관하다. 실제 diff 는:

- `spec/5-system/4-execution-engine.md` (§4, §8 텍스트 갱신)
- `codebase/backend/migrations/V104__execution_queued_at.sql` · `V105__execution_workflow_status_index.{sql,conf}`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`(`admitExecutionOrDefer`·`markQueueWaitTimeout`)
- `codebase/backend/src/modules/execution-engine/execution-limits.ts`(`resolveConcurrencyCap`·`resolveQueueWaitTimeoutMs`)
- `codebase/backend/src/modules/executions/entities/execution.entity.ts`(`queuedAt`)
- `codebase/backend/src/modules/workspaces/{workspaces.service.ts, dto/update-workspace-settings.dto.ts, dto/responses/workspace-response.dto.ts}`
- `codebase/backend/.env.example`(`EXECUTION_QUEUE_WAIT_TIMEOUT_MS`)
- e2e `codebase/backend/test/execution-concurrency-cap.e2e-spec.ts`

지시("mis-scoped 이면 git diff origin/main 사용")에 따라 위 실제 변경 파일 기준으로 정식 규약(`spec/conventions/**`) 준수를 재검토했다. 아래 발견사항은 이 실제 스코프에 대한 것이다.

---

## 발견사항

### [WARNING] `3-error-handling.md` 가 `EXECUTION_QUEUE_WAIT_TIMEOUT` 구현완료 상태를 반영하지 못함 (SoT 정합)
- target 위치: `spec/5-system/3-error-handling.md` §1.4 인용부(93행)·§1.5 상단(104행)
- 위반 규약: CLAUDE.md "정보 저장 위치(단일 진실 원칙)" — 기술 명세는 `spec/<영역>/*.md` 본문이 SoT 이며 cross-reference 문서 간 상태 표기가 어긋나면 안 됨. 간접적으로 `spec/conventions/error-codes.md` §1(의미 기반 명명)의 전제인 "코드의 정의(spec 본문)가 진실" 원칙과도 연결.
- 상세: 이번 PR 로 `spec/5-system/4-execution-engine.md` §8 은 `EXECUTION_QUEUE_WAIT_TIMEOUT` 을 "**PR2b 구현 완료**" 로 갱신했다(§8 rationale 블록·admission 문단 모두 갱신됨, code-review documentation 리뷰어가 §4 텍스트 모순도 이미 FIX 확인 — `review/code/2026/07/04/17_26_57/SUMMARY.md`). 그러나 같은 코드를 참조하는 `spec/5-system/3-error-handling.md` §1.4 인용부(93행)와 §1.5 상단 설명(104행)은 여전히 `"**PR2b(정책 정의, enforcement 후속)**"` 문구를 그대로 유지하고 있어 두 SoT 문서 간 구현 상태 표기가 어긋난다. 이번 diff 는 `3-error-handling.md` 를 건드리지 않았다(`git diff origin/main --stat -- spec/5-system/3-error-handling.md` 결과 없음).
- 제안: `3-error-handling.md` §1.4/§1.5 의 `EXECUTION_QUEUE_WAIT_TIMEOUT` 관련 문구를 "PR2b 구현 완료"로 동기화. project-planner 영역(spec 변경)이므로 developer PR2b 자체 스코프 밖일 수 있으나, 최소 후속 커밋으로 정정 필요 — 그렇지 않으면 이 문서만 읽는 소비자는 여전히 "enforcement 후속(미구현)" 으로 오인한다.

### [WARNING] `EXECUTION_QUEUE_WAIT_TIMEOUT` 이 중앙 `ErrorCode` enum(대표 surface) 에 미등록
- target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2551` (`const code = 'EXECUTION_QUEUE_WAIT_TIMEOUT'` 리터럴)
- 위반 규약: `spec/conventions/error-codes.md` "적용 범위" — "본 규율은 `code:` 의 `ErrorCode` enum(`codebase/backend/src/nodes/core/error-codes.ts` — **명명이 중앙화된 대표 surface**)뿐 아니라 프로젝트 전체의 에러 코드 문자열에 적용된다."
- 상세: `error-codes.md` §3 historical-artifact 레지스트리에는 같은 엔진 레벨 시스템-취소 계열 코드인 `WORKER_HEARTBEAT_TIMEOUT` 이 등재돼 있고, `EXECUTION_TIME_LIMIT_EXCEEDED` 는 `ErrorCode` enum 본체(`error-codes.ts:73`)에 정식 등록돼 있다. 반면 신규 `EXECUTION_QUEUE_WAIT_TIMEOUT` 은 enum 에도, §3 레지스트리에도 등재되지 않은 채 `execution-engine.service.ts` 리터럴 문자열로만 존재한다. 이름 자체는 `UPPER_SNAKE_CASE`·의미 기반(§1 원칙)을 준수하므로 CRITICAL 은 아니나, "대표 surface" 원칙의 완전한 적용은 아니다. 다만 `RESUME_CHECKPOINT_MISSING`·`RESUME_FAILED`·`RESUME_INCOMPATIBLE_STATE` 등 §7.5 계열 코드도 이미 동일하게 enum 밖 리터럴로 존재하는 기존 패턴이라(`execution-engine.service.ts` 내 다수 선례), 이번 PR 만의 신규 일탈은 아니고 기존 관행을 답습한 것이다.
- 제안: (a) 최소 조치로 `error-codes.md` §3 historical-artifact 레지스트리 또는 신규 절에 `EXECUTION_QUEUE_WAIT_TIMEOUT`·`RESUME_*` 계열을 "엔진 레벨 codes — enum 밖, spec 이 SoT" 로 명시적으로 예외 등재해 규약 문서가 실제 관행을 추적하게 한다. (b) 또는 코드 쪽에서 `ErrorCode` enum 에 추가(다른 소비처 없어 breaking 없음). 둘 중 하나로 문서-코드 간극을 닫을 것을 권고. BLOCK 사유는 아님.

### [INFO] 마이그레이션 파일 2건 명명은 규약 완전 준수
- target 위치: `codebase/backend/migrations/V104__execution_queued_at.sql`, `V105__execution_workflow_status_index.sql`/`.conf`
- 위반 규약: 해당 없음(준수 확인)
- 상세: `codebase/backend/migrations/README.md §1` 의 "단조 증가 정수 + `__` + 설명" 규칙, origin/main 마지막 마이그레이션(V103)과 연속된 V104/V105 순번, `CREATE INDEX CONCURRENTLY` + 동봉 `.conf`(`executeInTransaction=false`) 패턴(V022 선례)까지 정확히 준수. DOWN 롤백 주석도 code-review 지적 이후 V105 에 추가됨. 문제 없음 — 참고용 기록.

### [INFO] Workspace settings DTO/응답 필드 명명은 기존 컨벤션과 일관
- target 위치: `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts`(`maxConcurrentExecutions`), `dto/responses/workspace-response.dto.ts`(`WorkspaceSettingsDto.maxConcurrentExecutions`)
- 위반 규약: 해당 없음(준수 확인)
- 상세: `camelCase` 필드명, `@ApiPropertyOptional({ type, example, description })` 사용, `dto/responses/*-response.dto.ts` 배치 모두 `spec/conventions/swagger.md` §1-2·§2 패턴과 기존 `timezone`/`interactionAllowedOrigins` 필드 스타일에 부합. DB 컬럼(`queued_at` snake_case) ↔ TypeORM 필드(`queuedAt` camelCase) 매핑도 기존 엔티티 관례와 일치.

### [INFO] env var 명명(`EXECUTION_QUEUE_WAIT_TIMEOUT_MS`) 은 기존 패턴과 일관, `.env.example` 수동 등재도 선례 인지
- target 위치: `codebase/backend/.env.example`, `execution-limits.ts` (`resolveQueueWaitTimeoutMs` JSDoc)
- 위반 규약: 해당 없음(준수 확인)
- 상세: `UPPER_SNAKE_CASE` + `_MS` suffix 로 기존 `EXECUTION_MAX_ACTIVE_RUNNING_MS` 와 동일 관용을 따름. "config-env-coverage 가드 스캔 밖이라 수동 등록 필요" 를 JSDoc 에 선례(`EXECUTION_MAX_ACTIVE_RUNNING_MS`)와 함께 명시해 향후 가드 갱신 시 추적 가능하게 함 — 규약 준수 사고가 코드에 남아 있음.

---

## 요약

실제 diff(`git diff origin/main`) 기준으로 재확인한 결과, PR2b 의 명명 규약(마이그레이션 파일명·DTO/엔티티 필드명·env var 명명)은 기존 컨벤션과 완전히 일관되며 CRITICAL 급 위반은 없다. 다만 두 가지 WARNING 이 있다: ① `spec/5-system/3-error-handling.md` 가 이번 PR 로 `4-execution-engine.md` 에서 이미 "구현 완료"로 갱신된 `EXECUTION_QUEUE_WAIT_TIMEOUT` 상태를 여전히 "정책 정의, enforcement 후속"으로 stale 하게 서술해 spec 문서 간 단일 진실 정합이 깨졌고, ② 신규 에러 코드 `EXECUTION_QUEUE_WAIT_TIMEOUT` 이 `error-codes.md` 가 "대표 surface" 로 지목한 `ErrorCode` enum 이나 historical-artifact 레지스트리 어디에도 등재되지 않았다(단, `RESUME_*` 계열의 기존 관행을 답습한 것이라 이번 PR 고유의 새 일탈은 아님). 원래 전달된 payload 의 target 문서(`1-auth.md`/`10-graph-rag.md`/`audit-actions.md` 등)는 이번 PR 변경 범위와 무관한 mis-scoping 이었음을 확인했다.

## BLOCK: NO

Critical: 0
Warning: 2 (③ spec 문서 간 구현 상태 stale — `3-error-handling.md`, ④ 신규 에러 코드 enum/레지스트리 미등재)

STATUS: SUCCESS
