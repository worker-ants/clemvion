# 요구사항(Requirement) 리뷰

**리뷰 대상**: refactor-approved-batch (2026-06-10) — 2차 리뷰 (22_20_51)
- W2·W3 fix: `FREEZE_BRANCH_CACHE` allowlist 로 변경 + `expect(mutator).toThrow(TypeError)` + 전제 단언
- 1차 리뷰(22_00_04) requirement.md 의 SPEC-DRIFT 1-4 및 INFO 항목 포함 동일 변경 집합의 재점검

---

## 발견사항

### **[INFO]** [SPEC-DRIFT] `spec/5-system/16-system-status-api.md §3:90,94` — 삭제된 상수명이 spec 본문에 잔류
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/spec/5-system/16-system-status-api.md` line 90, 94
- 상세: spec line 90 은 `recentFailed >= FAILED_DEGRADED_THRESHOLD` 로 코드 상수명을 직접 참조하고, line 94 는 "코드상수 ↔ env 매핑: `FAILED_DEGRADED_THRESHOLD` ← ..." 을 기술한다. 이번 변경으로 해당 상수 2건은 코드에서 삭제됐고 getter 함수(`getFailedDegradedThreshold()`, `getDelayedDegradedThreshold()`)가 계속 존재한다. 기능 동작은 getter 를 통해 동일하게 동작하므로 비즈니스 로직 충돌은 없다. 다만 spec 이 코드에 없는 식별자를 SoT 로 기술하는 상태가 지속된다.
- 판단: "코드가 맞고 spec 이 낡음" — deprecated getter 우회 패턴은 NestJS DI 테스트 격리상 올바른 방향. 코드 되돌리기는 오답. `plan/in-progress/spec-update-deadcode-cleanup.md §1` 에 갱신 draft 가 이미 준비되어 project-planner 트랙 대기 중.
- 제안: 코드 유지. project-planner 가 `spec/5-system/16-system-status-api.md §3:90,94` 를 `getFailedDegradedThreshold()` / `getDelayedDegradedThreshold()` 표현으로 갱신해야 spec 단일 진실 원칙이 복원된다.

---

### **[INFO]** [SPEC-DRIFT] `spec/4-nodes/1-logic/10-parallel.md` — `FREEZE_BRANCH_CACHE`/`freezeSharedCacheValues` 동작이 spec 미기술
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/spec/4-nodes/1-logic/10-parallel.md` §P1 구현 상태 (line 14)
- 상세: spec line 14 는 "분기 간 `variables` 는 `structuredClone` 으로 deep clone, `nodeOutputCache` 는 shallow copy 로 격리된다" 고만 기술한다. "값 내부 mutate 금지 invariant — dev/test 에서 `Object.freeze` 로 기계 강제, production 무적용" 에 대한 서술이 spec 본문에 없다. JSDoc 은 충분히 기술하고 있으나 spec 단일 진실 관점에서 갭이다. 또한 `structuredOutputCache` 필드가 `spec/conventions/execution-context.md` 에 `nodeOutputCache` 와 동일 격리 규약으로 적용되고 있으나 spec 에 등재 여부가 불명확하다.
- 판단: "코드가 맞고 spec 이 낡음" — production 동작(shallow copy 결정)을 변경하지 않고 dev/test 한정 invariant 강화를 추가했으므로 구현이 의도적·합리적.
- 제안: 코드 유지. `spec/4-nodes/1-logic/10-parallel.md §Rationale` 에 "값 객체 내부 mutate 금지 invariant — dev/test(`NODE_ENV ∈ {development,test}`) 에서 deep `Object.freeze` 로 기계 강제, production 무적용" 1줄 추가. `spec/conventions/execution-context.md §1` 에 `structuredOutputCache` 필드 표기 누락이면 추가. 대상 spec 위치: `spec/4-nodes/1-logic/10-parallel.md §Rationale`, `spec/conventions/execution-context.md §1`.

---

### **[INFO]** `FREEZE_BRANCH_CACHE` allowlist 전환 — W2 fix 완전 충족 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts` line 34-35
- 상세: 이전 `!== 'production'` 음성 판별이 `NODE_ENV === 'development' || NODE_ENV === 'test'` allowlist 로 변경됐다. `NODE_ENV` 미정의(undefined) 시 production 에서 freeze 가 켜지지 않는다. 기능 완전성 관점에서 의도와 구현 일치.

---

### **[INFO]** 테스트 전제 단언 + `expect(mutator).toThrow(TypeError)` — W2·W3 fix 완전 충족 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/containers/parallel-executor.spec.ts` line 82-110
- 상세: `expect(FREEZE_BRANCH_CACHE).toBe(true)` 전제 단언이 describe 블록 최상단에 추가됐다. 이후 `try/catch` 패턴이 제거되고 `mutator` 함수를 수집해 `expect(mutator!).toThrow(TypeError)` 로 단언하는 구조로 변경됐다. non-strict 환경에서의 false positive 가능성이 제거되고, Jest 환경이 production 으로 설정된 경우에도 전제 단언이 먼저 실패해 freeze 가드 검증이 건너뛰어지지 않는다.
- 주의 사항: `mutator` 수집 패턴은 executor.execute 가 실제로 branchCallback 을 호출해야만 `mutator !== null` 이 된다. 현재 `branchCount: 1` 테스트 구성에서는 항상 호출되므로 문제 없으나, 만약 executor 내부 변경으로 callback 이 호출되지 않는 경우 `expect(mutator).not.toBeNull()` 이 먼저 실패해 의도를 드러낸다. 설계상 올바른 구조.

---

### **[INFO]** `deepFreeze` 배열 처리 — 부분 커버
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts` line 37-44
- 상세: `Object.values(value as Record<string, unknown>)` 로 객체 속성을 순회하는 구현은 배열의 경우 배열 원소가 freeze 되지 않는 엣지 케이스가 있다. `Array.isArray(value)` 분기가 없어 배열 원소 내부 객체는 freeze 대상에서 빠진다. dev/test 용 invariant 가드이고 cache 값이 직렬화 가능한 output envelope 이라는 코드 주석 전제가 유지되는 한 실용 영향 낮음. 단, freeze 가드 검출 목적의 불완전 커버지 INFO.
- 제안: 필수 수정 아님. 필요 시 `Array.isArray(value)` 분기를 추가해 배열 원소도 순회하면 된다.

---

### **[INFO]** `spec/5-system/4-execution-engine.md §7.4` — on() 제거 날짜 갱신 미반영 (선택 사항)
- 위치: `spec/5-system/4-execution-engine.md §7.4` 구현 상태 메모
- 상세: `plan/in-progress/spec-update-deadcode-cleanup.md §2` 가 §7.4 의 구현 상태 메모 날짜(2026-06-06 → 2026-06-10) 갱신을 "선택" 항목으로 추적하고 있다. spec 서사는 이미 full B3 완료 + in-memory 제거를 선언하고 있어 실질 내용 불일치 없음. 비차단 INFO.

---

## 요약

이번 변경(22_20_51 리뷰 범위)은 1차 리뷰(22_00_04)의 W2·W3 발견사항에 대한 수정을 포함하며, 두 가지 핵심 수정이 올바르게 이행됐다. 첫째, `FREEZE_BRANCH_CACHE` 환경 판별이 `!== 'production'` 음성 판별에서 `=== 'development' || === 'test'` allowlist 로 전환돼 NODE_ENV 미정의 시 production-safe 하게 동작한다. 둘째, 테스트의 `try/catch` 구조가 `mutator` 수집 패턴 + `expect(mutator!).toThrow(TypeError)` 로 교체돼 non-strict 환경에서의 false positive 가능성이 제거되고, `FREEZE_BRANCH_CACHE===true` 전제 단언이 명시됐다. 비즈니스 로직 관점(branch cache isolation, degraded 판정 로직, continuation 라우팅)은 모두 spec 의도대로 유지되며 production 동작에 영향이 없다. 유일한 잔류 이슈는 SPEC-DRIFT 2건으로, `spec/5-system/16-system-status-api.md §3:90,94` 의 삭제 상수명 잔류와 `spec/4-nodes/1-logic/10-parallel.md` 의 freeze invariant 미기술이다 — 모두 "코드가 맞고 spec 이 낡음" 방향이며 `plan/in-progress/spec-update-deadcode-cleanup.md` 가 project-planner 트랙으로 이미 추적 중이다. 기능 요구사항 관점에서 Critical/Warning 발견사항 없음.

---

## 위험도

LOW

STATUS=success ISSUES=0
