# Convention Compliance Review

**Target**: `spec/5-system/4-execution-engine.md` (검토 모드: --impl-done, diff-base=origin/main)
**Date**: 2026-06-06

---

## 발견사항

### 1. [WARNING] spec 구현 상태 배너가 "미구현"으로 기재되어 있으나 구현 완료됨

- **target 위치**: `spec/5-system/4-execution-engine.md` §4 §7.5 §Rationale의 다수 "(구현 상태 2026-06-06)" 배너 및 §Rationale exec-park D6 항목
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §2 (frontmatter `status` 필드 및 구현 증거 유지 의무) + CLAUDE.md "단일 진실 원칙" (spec 은 구현 상태의 단일 진실)
- **상세**: spec 의 여러 배너가 exec-park D6 의 핵심 구현(park 시 call-stack stage, `driveCallStackResume`/`driveResumeFrame`/`injectInvokerOutput` 재귀 재진입 로직, executeInline park-release+`ParkReleaseSignal`, full B3) 을 "PR-B2 후속 커밋에서 구현 — 미구현"으로 기재하고 있다. 그러나 이번 diff 는 정확히 그 기능을 구현한다:
  - `execution-engine.service.ts`: `driveCallStackResume`, `driveResumeFrame`, `injectInvokerOutput`, `snapshotCallStack` 신설; `stageDurableResumeSnapshot` 에 `resumeCallStack` stage 추가; `executeInline` 에 `_callStack` push/pop + `ParkReleaseSignal` throw; `runNodeDispatchLoop` 에 `ParkReleaseSignal` catch → `{parked:true}` 반환; `resumeFromCheckpoint` 에 callStack non-null 분기 (`driveCallStackResume` 호출) 추가; `NESTED_FIRE_MAX_ATTEMPTS`/`NESTED_FIRE_POLL_MS` 정적 상수 승격
  - `shared/execution-resume/park-release-signal.ts`: `ParkReleaseSignal` 신설
  - `shared/execution-resume/resume-call-stack.types.ts`: `ResumeCallStack`/`ResumeCallStackFrame`/`CALL_STACK_SCHEMA_VERSION` (이미 이전 커밋에서 추가됨)
  - `node-handler.interface.ts`: `_callStack?: ResumeCallStackFrame[]` 추가
  - `workflow-executor.interface.ts`: `InlineExecutionOptions.invokerNodeId` 추가
  - spec 의 §7.5 배너는 "재귀 재진입 로직·park 시 call-stack stage 는 PR-B2 후속 커밋에서 구현"이라 하지만, 구현이 완료된 시점에 spec 이 갱신되지 않아 spec과 코드가 불일치한다. `spec-impl-evidence.md` 는 spec 이 구현 증거(code 경로)와 정합해야 한다고 요구한다.
- **제안**: spec §6.2의 "(e)" 배너, §7.5 배너("재귀 재진입 로직 미구현"), §Rationale exec-park D6 구현 상태 배너를 "구현 완료(PR-B2b, 2026-06-06)" 로 갱신. 이는 developer SKILL.md 가 구현 완료 후 spec 갱신을 phase 로 요구하는 패턴과 일치한다.

---

### 2. [WARNING] `_callStack` 필드가 `execution-context.md` 원칙 4 선례 목록에 미등재

- **target 위치**: `codebase/backend/src/nodes/core/node-handler.interface.ts` (추가된 `_callStack?: ResumeCallStackFrame[]`) 및 `spec/5-system/4-execution-engine.md`
- **위반 규약**: `spec/conventions/execution-context.md` §1 원칙 4 ("Engine-internal infrastructure fields (`_`-prefix)" — 선례 목록에 신규 `_` 필드 추가 시 본 문서에 분류 근거 기록)
- **상세**: `execution-context.md` 원칙 4 선례 목록은 `_executedNodes`, `_resumeState`/`_retryState`, `_contextKey` 를 명시한다. 이번 diff 는 `_callStack` 을 `ExecutionContext` 에 추가했으나, `execution-context.md` 원칙 4 의 선례 목록에 이 필드가 등재되지 않았다. 원칙 4 는 "선례: ... 이들은 본 분류 체계 도입 이전에 추가됐으며, 원칙 4 신설과 함께 소급 분류한다" 고 기술하므로, 신규 필드는 **도입과 함께 본 목록에 등재** 해야 함이 원칙의 취지다. `node-handler.interface.ts` JSDoc 주석에 설명은 있으나, conventions 문서에 분류 SoT 가 반영되지 않았다.
- **제안**: `spec/conventions/execution-context.md` 원칙 4 선례 목록에 `_callStack?: ResumeCallStackFrame[]` 항목 추가 — 용도(중첩 executeInline 호출 체인 park/재개), spec 참조(4-execution-engine.md §7.5/§Rationale exec-park D6), 핸들러 비소비 내부 엔진 필드임을 명시.

---

### 3. [INFO] `resume-call-stack.types.ts` 파일명 규약 — `.types.ts` suffix 일관성 확인

- **target 위치**: `codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts`
- **위반 규약**: 명시적 파일 명명 규약 문서 없음 (INFO 수준)
- **상세**: `*.types.ts` suffix 패턴은 프로젝트 내 공유 타입 파일에서 관용적으로 쓰인다 (`conversation-thread.types.ts` 등). 이 파일은 그 패턴을 준수한다. `park-release-signal.ts` 는 signal/sentinel class 파일로 `.ts` 직접 사용이 적절하다. 명명 규약상 이슈 없음.
- **제안**: 해당 없음. 현행 파일명 패턴은 적절하다.

---

### 4. [INFO] 에러 코드 `RESUME_CHECKPOINT_MISSING` / `RESUME_INCOMPATIBLE_STATE` — 기존 코드 재사용 일관성

- **target 위치**: `execution-engine.service.ts` 내 `throw new RehydrationError('RESUME_CHECKPOINT_MISSING', ...)` 및 `throw new RehydrationError('RESUME_INCOMPATIBLE_STATE', ...)` (diff 신규 추가 케이스들)
- **위반 규약**: `spec/conventions/error-codes.md` §1 (의미 기반 명명) — 위반 여부 확인 목적
- **상세**: 두 코드 모두 기존에 정의된 코드를 새 오류 경로(중첩 재개 실패, frame 누락, invoker 노드 부재 등)에 재사용한다. `error-codes.md` §2 는 "의미가 분기되거나 새 조건이 생기면 새 코드를 신설" 하라고 하나, 이 케이스들은 의미상 동일 범주(`RESUME_CHECKPOINT_MISSING` = 재개에 필요한 데이터 부재, `RESUME_INCOMPATIBLE_STATE` = 스키마 버전 불일치)이므로 재사용이 규약에 부합한다. §3 historical-artifact 등재 불필요.
- **제안**: 현행 유지. 신규 코드 신설 불필요.

---

### 5. [INFO] `NESTED_FIRE_MAX_ATTEMPTS` / `NESTED_FIRE_POLL_MS` 상수 — spec 본문에 미참조

- **target 위치**: `execution-engine.service.ts` 내 `private static readonly NESTED_FIRE_MAX_ATTEMPTS = 250` / `NESTED_FIRE_POLL_MS = 20`; JSDoc `@todo full B3 에서 fireNested 폴링 자체를 제거`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §2 (구현 증거 정합) — 위반 여부 확인 목적
- **상세**: 두 상수는 plan `exec-park-durable-resume.md §B3` 이 제거 예정인 임시 폴링 메커니즘의 값이다. spec `4-execution-engine.md` §7.5 의 재귀 재진입 서술은 이 폴링 상수를 언급하지 않는다(구현 세부 — spec 에 박을 필요 없음). `@todo` 로 수명이 제한된 임시 코드임이 명시되어 있어 spec 명시 필요성은 낮다.
- **제안**: 해당 없음. 임시 폴링 상수는 spec 레벨 문서화 대상이 아니다.

---

## 요약

정식 규약 준수 관점에서 가장 중요한 이슈는 두 가지다. 첫째, spec의 "구현 상태" 배너가 이번 diff 로 실제 구현 완료된 exec-park D6 전체(park stage + 재귀 재진입 + ParkReleaseSignal + executeInline call-stack)를 여전히 "미구현"으로 기재하고 있어 spec-코드 불일치가 발생한다 — `spec-impl-evidence.md` 의 단일 진실 원칙 위반(WARNING). 둘째, `spec/conventions/execution-context.md` 원칙 4 의 `_` 접두사 엔진 내부 필드 선례 목록에 신규 추가된 `_callStack` 이 등재되지 않아 conventions 문서의 분류 SoT 가 불완전하다(WARNING). 나머지는 정보성(INFO) 수준이며 규약 위반이 아니다. 코드 자체(파일명, 에러 코드 명명, 출력 포맷, `_` prefix 규약 적용)는 각 conventions 를 올바르게 따르고 있다.

## 위험도

MEDIUM
