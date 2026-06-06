# Testing 관점 코드 리뷰

## 발견사항

### [WARNING] `ResumeCallStack` / `resume_call_stack` 에 대한 전용 단위 테스트 부재
- 위치: `/codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts` (신규 파일)
- 상세: `conversation-thread.types.ts` 에는 `conversation-thread.types.spec.ts` 가 동반돼 null/undefined 입력, 손상 데이터, 경계값, 배열 참조 분리 등을 촘촘히 검증한다. 반면 `resume-call-stack.types.ts` 는 순수 타입 정의 파일이지만, 이 JSONB 값은 DB 에서 `unknown`/`any` 형태로 로드되므로 런타임 rehydration 함수(아직 미구현 단계)가 추가될 때 동반 테스트가 필요하다. 현재 PR-B2 착수 전 단계이므로 해당 함수가 없는 것은 이해할 수 있으나, rehydration 로직 구현 시 `conversation-thread.types.spec.ts` 패턴을 동일하게 따르도록 명시해야 한다.
- 제안: PR-B2 구현 단계에서 `resume-call-stack.types.spec.ts` 파일을 추가하고 최소 항목으로 (a) `null` 입력 → 빈/기본값 반환, (b) 손상 JSON (frames 가 배열 아닌 경우, version 없는 경우), (c) 정상 frames 배열 lossless 복원, (d) frames 배열 참조 분리(영속본 오염 방지)를 커버한다.

### [WARNING] `execution.entity.ts` 신규 컬럼 `resumeCallStack` 이 기존 엔티티 테스트에 반영 안 됨
- 위치: `/codebase/backend/src/modules/executions/entities/execution.entity.ts` + `executions.service.spec.ts`
- 상세: `executions.service.spec.ts` 는 `Execution` mock 객체를 직접 생성해 사용하는데, 신규 컬럼 `resumeCallStack` 이 mock 에 포함되지 않아도 현재는 테스트가 통과한다. 그러나 향후 이 필드를 읽는 서비스 로직(rehydration) 이 추가될 때 mock 이 실제 엔티티와 괴리되는 silent bug 의 씨앗이 된다. 기존 `userVariables`, `conversationThread` 와의 패턴 일관성 관점에서도, 해당 필드들이 mock 에 `null` 로 초기화돼 있어야 한다.
- 제안: 엔티티 mock 헬퍼 또는 `executions.service.spec.ts` 의 mock execution 객체에 `resumeCallStack: null` 을 추가해 엔티티 형태와 일치시킨다.

### [WARNING] 마이그레이션 `V087__execution_resume_call_stack.sql` 에 대한 통합 테스트 / DB 마이그레이션 검증 커버리지
- 위치: `/codebase/backend/migrations/V087__execution_resume_call_stack.sql`
- 상세: 마이그레이션 파일 자체는 단순한 `ALTER TABLE ... ADD COLUMN` 이지만, 기존 row 에 `NULL` 이 올바르게 설정되는지, Flyway 적용 후 TypeORM 엔티티와 컬럼 타입이 일치하는지는 e2e / 통합 테스트에서만 검증 가능하다. 현재 리뷰 대상 코드 변경에는 이 마이그레이션을 직접 검증하는 별도 통합 테스트가 없다. JSONB nullable 컬럼은 TypeORM 이 `null` vs `undefined` 를 다르게 처리하는 경우가 있어 런타임에서 예기치 않은 동작을 일으킬 수 있다.
- 제안: e2e 테스트에서 (a) 마이그레이션 적용 후 기존 execution row 의 `resume_call_stack` 이 `NULL` 인지, (b) `resumeCallStack` 필드에 `{ version: 1, frames: [...] }` 를 쓰고 읽었을 때 JSONB 가 lossless 인지 확인하는 케이스를 추가한다. 기존 `conversation_thread`(V084) / `user_variables`(V085) e2e 테스트 패턴을 참고한다.

### [INFO] `resume-call-stack.types.ts` — 타입 전용 파일은 런타임 로직 없으므로 현시점 테스트 대상 없음
- 위치: `/codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts`
- 상세: 파일은 `interface ResumeCallStackFrame` 과 `interface ResumeCallStack` 두 개의 순수 TypeScript 인터페이스만 포함한다. 런타임 로직(유효성 검사, 변환, 파싱)이 없으므로 현시점에서 단위 테스트 대상이 없는 것은 정상이다.
- 제안: PR-B2 에서 rehydration 함수(`rehydrateResumeCallStack` 또는 유사 이름)가 추가될 때 해당 함수와 함께 테스트를 추가한다.

### [INFO] 리뷰 대상 파일 중 테스트 관련 파일(plan, review, consistency 결과물)은 테스트 의무 없음
- 위치: 파일 4~31 (plan/in-progress, review/consistency 산출물)
- 상세: 이 파일들은 plan 문서 및 consistency-check 산출물로, 코드가 아니므로 단위·통합·e2e 테스트 의무가 없다. 단, `plan-frontmatter.test.ts` build guard 가 `plan/in-progress/*.md` 파일의 frontmatter 를 검증하는 점에서, 현재 `spec-draft-exec-park-b2-durable.md` 에 frontmatter (`worktree: exec-park-durable-resume`, `started: 2026-06-06`, `owner: planner`) 가 이미 추가돼 있음을 확인했다 — build guard 는 통과한다.

### [INFO] `conversation-thread.types.spec.ts` 는 유사 패턴의 우수 선례 — `ResumeCallStack` rehydration 에 그대로 적용 가능
- 위치: `/codebase/backend/src/shared/conversation-thread/conversation-thread.types.spec.ts`
- 상세: 해당 파일은 null/undefined 입력, 손상 데이터 graceful 처리, 배열 참조 분리, 파생값 재유도, 경계값(MAX_RUNNING_SUMMARY_CHARS) 등을 포괄적으로 검증한다. `ResumeCallStack` rehydration 테스트 작성 시 이 파일을 템플릿으로 사용하면 일관성과 품질을 확보할 수 있다.
- 제안: PR-B2 구현 시 위 파일과 동일한 describe 구조(null/undefined 처리 → 정상 경로 → 손상 케이스 → 파생값 재유도)로 `resume-call-stack.types.spec.ts` 를 작성한다.

## 요약

이번 PR 에서 실제 런타임 코드 변경은 두 파일에 국한된다: SQL 마이그레이션(`V087__execution_resume_call_stack.sql`)과 엔티티 컬럼 추가(`execution.entity.ts`), 그리고 순수 타입 정의 파일(`resume-call-stack.types.ts`). 타입 파일은 런타임 로직이 없으므로 현시점 테스트 대상이 아니며, 나머지는 PR-B2 구현 단계에서 rehydration 로직이 추가될 때 동반 테스트가 필요하다. 가장 큰 위험은 `conversation-thread.types.spec.ts` 와 같은 수준의 rehydration 테스트가 PR-B2 에서 누락될 경우로, `version` 불일치, `frames` 손상, `null` 처리 분기가 무테스트 코드 경로로 남는다. SQL 마이그레이션의 `NULL` 기본값 및 JSONB round-trip 도 e2e 수준에서 회귀 방어가 필요하다. 현재 변경 자체는 plan 문서와 review 산출물 위주이며, plan frontmatter guard(`plan-frontmatter.test.ts`) 는 통과 상태다.

## 위험도

MEDIUM

STATUS: DONE
