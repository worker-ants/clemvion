# Convention Compliance Review

**Target**: `spec/5-system/4-execution-engine.md` (impl-done, scope=spec/5-system/4-execution-engine.md, diff-base=origin/main)
**Date**: 2026-06-06
**Reviewer**: convention_compliance sub-agent

---

## 발견사항

### [INFO] `spec/conventions/execution-context.md` — `_contextKey` 의 분류 기술 불일치

- **target 위치**: `spec/conventions/execution-context.md` 원칙 4("Engine-internal fields") 선례 목록
- **위반 규약**: `spec/conventions/execution-context.md` §원칙 4 (본 문서가 SoT)
- **상세**: diff 에서 `_contextKey` 를 "선례" 목록에 추가하면서 동시에 "엔진 전용 범주" 섹션 바로 아래에 `_contextKey` 에 대한 정의 단락이 이미 존재한다 (원래부터 있던 단락). 선례 목록과 정의 단락이 중복 존재해 문서 내 단일 진실이 흐려진다. 선례 목록은 "소급 분류 근거 목록"이고 이하 `_contextKey` 단락은 정의 SoT 인데, 이 관계가 명시되지 않아 읽는 사람이 어느 쪽이 정의인지 모호하다.
- **제안**: 선례 목록의 `_contextKey` 항목을 "상세 정의는 아래 단락 참조"로 연결하거나, 중복 열거를 제거하고 한 곳만 SoT 로 유지. 규약 위반이 아닌 문서 내 중복이므로 INFO.

---

### [INFO] `spec/5-system/4-execution-engine.md` `pending_plans` — 완료된 PR-B2b 에도 `exec-park-durable-resume.md` 가 `partial` 유지 중

- **target 위치**: `spec/5-system/4-execution-engine.md` frontmatter `pending_plans:` + `status: partial`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §3 — `partial` 의 `pending_plans` 모두 complete 이면 `implemented` 로 승격 의무 (가드: `spec-status-lifecycle.test.ts`)
- **상세**: 이번 PR(PR-B2b exec-park D6 + full B3)이 완료됐다고 spec 본문에 명기됐음에도 `plan/in-progress/exec-park-durable-resume.md` 가 여전히 `plan/in-progress/` 에 있고, `spec/5-system/4-execution-engine.md` 의 `status` 는 `partial` 이다. 해당 플랜이 `plan/complete/` 로 이동하지 않았으므로 현재 시점에서는 가드가 실패하지 않지만, PR 완료 선언과 plan 라이프사이클 이동이 동기화되지 않은 상태다. 다른 3개 `pending_plans` (`execution-engine-residual-gaps.md`, `spec-sync-execution-engine-gaps.md`, `exec-intake-queue-impl.md`)는 별도 미완 계획이므로 `partial` 유지 자체는 타당하나, PR-B2b 완료 후 `exec-park-durable-resume.md` 는 `plan/complete/` 이동이 필요하다.
- **제안**: `plan/in-progress/exec-park-durable-resume.md` 를 `plan/complete/` 로 이동하고 frontmatter 에 `spec_impact` 선언 추가(`spec/5-system/4-execution-engine.md` 등 갱신 대상 기재) 후 `spec/5-system/4-execution-engine.md` 의 `pending_plans` 에서 해당 항목 제거. `plan-lifecycle §3` + `spec-plan-completion.test.ts` (Gate C) 요구사항. 단, 나머지 3개 plan 이 여전히 in-progress 이므로 `status: partial` 은 유지.

---

### [INFO] `codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts` — `spec/conventions/execution-context.md` 의 `code:` 미등록

- **target 위치**: `spec/conventions/execution-context.md` frontmatter `code:` 목록
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §2.1 — `status: implemented` 인 spec 의 `code:` 는 ≥1 매치 의무
- **상세**: `spec/conventions/execution-context.md` 는 `status: implemented` 이며 `code:` 에 `codebase/backend/src/nodes/core/node-handler.interface.ts` 와 `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts` 만 등재된다. 이번 PR 에서 신설된 `codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts` 는 `ExecutionContext._callStack` 의 타입 정의 (`ResumeCallStackFrame[]`) SoT 이지만 `code:` 에 미등록이다. glob 이 기존 경로만 커버하므로 새 shared 모듈은 누락이다.
- **제안**: `spec/conventions/execution-context.md` 의 `code:` 에 `codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts` (또는 `codebase/backend/src/shared/execution-resume/**`) 추가. 현재 glob 매치는 기존 파일로 충분하므로 build 가드 실패 위험은 없으나, SoT 표명 정확성 관점에서 갭이다.

---

### [INFO] `spec/5-system/4-execution-engine.md` §7.5 중첩 재개 설명 — spec 본문과 구현 메서드명 일부 불일치(상태 메모)

- **target 위치**: `spec/5-system/4-execution-engine.md` §7.5 중첩 sub-workflow 재개 절차 step 2.a~c
- **위반 규약**: 규약 직접 위반은 아님 — 문서 정확성 품질 관찰
- **상세**: spec §7.5 step 2 에서 "재진입은 `executeInline` 을 재호출하지 않고" 라고 명기하면서, 동시에 Rationale 에 "W2 SPEC-DRIFT — direct-drive vs `executeInline` 재호출" 로 설계 선택 근거를 기재했다. 이전 revision 의 step 2 설명("각 프레임의 `invokerNodeId`(sub-workflow 호출 노드)까지 전진한 뒤 `executeInline` 을 재호출")이 spec diff 에 삭제되어 최신 구현(`driveCallStackResume`/`driveResumeFrame`)으로 교체됐다. spec 본문과 구현이 정합하도록 갱신된 것은 올바르나, step 2 초반에 "bubble-up" 용어가 spec 에서는 "innermost-first + bubble-up"으로 표기되고 구현 테스트에서는 "Case2: 2-depth — innermost 완료 후 bubble-up 외곽 frame 구동"으로 표기되어 일치한다. 이상 없음 — INFO 수준 확인.
- **제안**: 현 상태 유지. spec 이 구현을 정확히 기술하고 있으며 Rationale 에 근거가 기록됐다.

---

### [WARNING] `spec/5-system/4-execution-engine.md` §1.1 상태 전이 표 — `failed → running` 행의 cancel 동작 서술 spec 갱신이 코드 주석과 경미하게 비대칭

- **target 위치**: `spec/5-system/4-execution-engine.md` §1.1 허용 전이 표 `failed → running` 행
- **위반 규약**: 규약 직접 위반 아님 — 문서 내 일관성 관찰
- **상세**: `failed → running` 행에 "replay 가 RUNNING 으로 도는 중 도착한 cancel 은 graceful no-op 이며... 취소는 다음 `waiting_for_input` park 에서 비로소 발효된다(`cancelParkedExecution` 의 WAITING 가드가 `cancelled` 로 마킹 — §12.2)"라고 명시됐다. 그러나 같은 내용이 Rationale §retry-last-turn 절에도 "replay 중 사용자 cancel 도달 시 cancelled 로 마감"이라는 삭제된 구 서술이 제거된 뒤, 새로운 서술이 추가됐다. 두 곳의 내용은 일치하나 §12.2 링크(`cancelParkedExecution` WAITING 가드)가 실제 `cancelParkedExecution`의 로직이 §12.2 에 기술돼 있는지 확인이 필요하다. §12 섹션 번호(spec 내 실제 §12.2 존재 여부)는 이번 diff 범위 내에서 검증 불가.
- **제안**: `§12.2` 앵커가 실제 spec 섹션에 존재하는지 확인. 없으면 링크 제거 또는 정확한 절 번호로 수정. 이는 WARNING 수준 — spec 내부 링크 무결성(`spec-link-integrity.test.ts` 가드) 대상이므로 build 가드에서 자동 탐지 가능.

---

### [INFO] `codebase/backend/src/shared/execution-resume/park-release-signal.ts` — `code:` 미등록 (spec/5-system/4-execution-engine.md)

- **target 위치**: `spec/5-system/4-execution-engine.md` frontmatter `code:`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §2.1 — `code:` 는 spec 이 약속한 구현 surface 의 증거 (완전한 글로브 커버 권장)
- **상세**: `ParkReleaseSignal` 은 spec §4.x(park 시그널) + §7.5(중첩 park 전파)의 핵심 구현 primitive 다. `codebase/backend/src/shared/execution-resume/` 경로는 `code:` glob `codebase/backend/src/modules/execution-engine/**` 에 **매칭되지 않는다** (다른 경로). 현재 glob 이 다른 impl 파일을 충분히 커버해 `spec-code-paths.test.ts` 는 통과하지만, spec 이 약속한 `ParkReleaseSignal` / `ResumeCallStackFrame` 의 영속 타입 구현 파일이 증거에서 누락된다.
- **제안**: `spec/5-system/4-execution-engine.md` `code:` 에 `codebase/backend/src/shared/execution-resume/**` 추가. build 가드 실패 위험은 없으나 SoT 표명 완결성 개선.

---

## 요약

이번 PR(exec-park D6 + full B3)은 spec `5-system/4-execution-engine.md` 본문을 구현 완료 상태로 정확하게 갱신했으며, 명명 규약(`UPPER_SNAKE_CASE` 에러 코드, `kebab-case` 식별자, `driveCallStackResume`/`driveResumeFrame` 등 `camelCase` 메서드명), 출력 포맷 규약(NodeHandlerOutput 5필드 불변, park sentinel `PARK_RELEASED` Symbol, `ResumeCallStack` envelope), 문서 구조(Overview/본문/Rationale 3섹션) 모두 정식 규약과 일치한다. `spec/conventions/execution-context.md` 에 `_callStack` 내부 필드를 원칙 4 분류로 적절히 추가했고, `spec/1-data-model.md` 의 `resume_call_stack` 컬럼 설명도 갱신됐다. 주요 발견사항은 모두 INFO/WARNING 수준이며: (1) `plan/in-progress/exec-park-durable-resume.md` 가 완료 선언 후에도 `plan/complete/` 로 이동되지 않아 plan 라이프사이클이 미동기화된 점, (2) `codebase/backend/src/shared/execution-resume/` 하위 신설 파일이 관련 spec `code:` frontmatter에 미등록된 점, (3) spec 내 `§12.2` 링크 존재 여부 확인 필요 점이다. 정식 규약을 직접 위반하는 CRITICAL 항목은 없다.

---

## 위험도

LOW
