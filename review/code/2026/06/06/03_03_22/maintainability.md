# 유지보수성(Maintainability) Review

## 발견사항

### [WARNING] `ResumeCallStack.version` 필드명이 `_resumeCheckpoint.schemaVersion` 과 혼동 가능
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts` L37
- 상세: `ResumeCallStack` envelope 의 버전 필드명이 `version` 으로, 기존 `_resumeCheckpoint` 의 `schemaVersion` 과 다른 이름을 쓴다. 두 JSONB 컬럼이 같은 파일(`execution-engine.service.ts`)에서 함께 다뤄질 때 독자는 두 상수(`CHECKPOINT_SCHEMA_VERSION` vs `CALL_STACK_SCHEMA_VERSION`)와 두 필드명(`schemaVersion` vs `version`)의 대응 관계를 매번 추론해야 한다. 타입 JSDoc 에 "독립 상수" 언급이 있으나, 필드명 자체를 `schemaVersion` 으로 통일하거나 반대로 `callStackVersion` 으로 도메인 한정 이름을 쓰면 혼동이 줄어든다.
- 제안: `version` → `schemaVersion` 으로 통일(기존 `_resumeCheckpoint` 와 동일 패턴 채택)하거나, JSDoc 에 "`_resumeCheckpoint.schemaVersion` 과 독립이며 `CALL_STACK_SCHEMA_VERSION` 상수로 스탬프됨"을 한 줄 더 명시. 두 상수를 같은 파일에서 함께 선언하는 것도 가독성을 높인다.

### [WARNING] entity 인라인 주석이 타입 파일 JSDoc 의 설명을 중복 반복
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/modules/executions/entities/execution.entity.ts` L128-138
- 상세: `resumeCallStack` 필드 위 12줄 주석은 `resume-call-stack.types.ts` 의 모듈 JSDoc(9줄)과 사실상 동일한 내용을 한국어로 반복한다. `userVariables`(9줄), `conversationThread`(추정 유사 길이) 등 선행 패턴도 같은 방식이어서 코드베이스 내 관행이지만, 이 정도 분량의 중복 설명은 타입 파일이 변경될 때 entity 주석도 함께 업데이트해야 하는 동기화 부담을 만든다. 특히 "컨테이너 body blocking 은 §3.2 금지" 등 제약 설명이 두 곳에 나뉘어 있다.
- 제안: entity 주석은 "목적·컬럼명·버전(V087)·spec ref·API 배제 여부" 핵심 항목만 남기고, 재진입 메커니즘 세부는 타입 파일 JSDoc 으로 위임하는 방식을 고려. 현재 패턴이 코드베이스 전반의 기존 관행이라면 이번 변경 자체의 책임이 아니므로 INFO 로 강등해도 무방하나, 향후 타입 설명 변경 시 entity 주석도 함께 고쳐야 함을 인식해야 한다.

### [INFO] SQL 마이그레이션 파일 주석이 영·한 혼재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/migrations/V087__execution_resume_call_stack.sql` L1-16
- 상세: 파일 헤더 주석(1-16번 줄)은 한국어로, `COMMENT ON COLUMN` 본문(21번 줄)은 영어로 작성돼 있다. 다른 마이그레이션 파일들이 같은 혼재 패턴을 따르고 있다면 일관성 문제는 아니나, 한 파일 안에서 설명 언어가 달라지면 독자 혼란 여지가 있다.
- 제안: `COMMENT ON COLUMN` 은 DB 저장 용도이므로 영어 유지가 합리적이다. 헤더 주석도 코드베이스 표준이 한국어라면 현행 유지가 맞다. 단, 향후 신규 파일 작성 시 헤더는 한국어, DB comment 는 영어로 통일한다는 컨벤션을 migrations.md 에 명시하면 좋다.

### [INFO] `ResumeCallStackFrame` 의 `recursionDepth` 필드 설명이 이미 복잡한 문맥에서 추가 혼동 유발 가능
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts` L22-27
- 상세: 괄호 안 "(동음의 `Execution`/`ExecutionContext` 의 recursionDepth 와 같은 개념의 프레임-시점 스냅샷이다.)"는 이 필드가 세 가지 다른 엔티티(`Execution`, `ExecutionContext`, `ResumeCallStackFrame`)에 동명 필드로 존재한다는 사실을 알려주지만, "같은 개념의 스냅샷"이라는 표현이 독자에게 "그러면 왜 별도 저장이 필요한가?"라는 의문을 남긴다. 프레임 진입 시점의 값을 재개 시 복원하기 위해 영속한다는 목적이 더 명확히 드러나면 좋다.
- 제안: "재개 시 프레임별 recursionDepth 복원에 쓴다" 문장을 JSDoc 첫 줄로 올리고, 동명 필드와의 관계 설명은 부연으로 유지.

### [INFO] plan 보조 draft 파일(`spec-draft-exec-park-b2-durable.md`)에 frontmatter 없음 — 빌드 가드 위험
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/plan/in-progress/spec-draft-exec-park-b2-durable.md` 파일 최상단
- 상세: `plan/in-progress/*.md` 는 `plan-frontmatter.test.ts` 가 `worktree`/`started`/`owner` 세 필드를 의무화한다. 이 파일은 frontmatter 없이 H1 으로 시작하므로 빌드 가드를 위반한다. consistency-check `02_33_35` 에서 CRITICAL 로 이미 탐지된 항목이나, 이번 변경 셋에서 해소되지 않았다.
- 제안: 파일 최상단에 `worktree: exec-park-durable-resume`, `started: 2026-06-06`, `owner: planner` frontmatter 추가.

---

## 요약

이번 변경의 핵심 코드(마이그레이션 파일, 타입 정의, 엔티티)는 전반적으로 잘 구조화되어 있다. 파일 경계가 명확하고(`resume-call-stack.types.ts` 신규 모듈 분리), 기존 `conversation_thread`/`user_variables` 패턴을 일관되게 따른다. 다만 두 가지 유지보수성 위험이 있다. 첫째, `version` vs `schemaVersion` 필드명 혼재로 두 독립 버전 상수와의 대응 관계를 코드 독자가 매번 파악해야 한다. 둘째, entity 인라인 주석이 타입 파일 JSDoc 을 상당 부분 중복해 향후 설명 변경 시 두 곳을 동기화해야 하는 부담이 있다. plan 보조 파일의 frontmatter 누락은 빌드 가드에 영향을 미치는 즉각 조치 사항이다. 문서 파일(plan, consistency-check 결과)들은 이 변경의 복잡한 맥락(병렬 worktree 경합, 마이그레이션 번호 관리, spec 서술 재전환 조건)을 상세히 기록하고 있어 추적성은 높으나, 단일 plan 진행메모가 매우 길어 핵심 착수 조건이 묻히는 경향이 있다.

## 위험도

LOW
