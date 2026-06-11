# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [INFO] 기능 완전성 — `FREEZE_BRANCH_CACHE` 및 `deepFreeze`/`freezeSharedCacheValues` 구현 완전
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/plan-complete-turn-timing-aa533b/codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts` 라인 34–62
- 상세: plan 06 M-5 에서 승인한 "dev/test 환경에서 branch-local cache 값 객체 deep freeze" 기능이 완전히 구현됐다. `FREEZE_BRANCH_CACHE` (allowlist 방식), `deepFreeze`, `freezeSharedCacheValues` 세 요소가 모두 존재하고, `parallel-executor.ts` 라인 231–236 의 branchContext 생성부에서 `nodeOutputCache`/`structuredOutputCache` 양쪽에 올바르게 적용된다. production 경로에서 no-op 보장도 `FREEZE_BRANCH_CACHE === false` 단락으로 충족된다.
- 제안: 해당 없음.

### [INFO] 엣지 케이스 — `deepFreeze` 의 null·배열·기존 frozen 객체 처리 완전
- 위치: `parallel-executor.ts` 라인 38–46
- 상세: `value === null` 분기(null 방어), `typeof value !== 'object'` 분기(primitive 방어), `Object.isFrozen(value)` 분기(순환 참조 및 중복 freeze 방어)가 모두 존재한다. 배열도 `typeof ... === 'object'` 분기로 정상 처리되고, 인라인 주석으로 의도가 명시됐다. 빈 객체(`{}`)나 빈 캐시 상태에서도 `for...of Object.values({})` 루프가 0회 실행되어 안전하다.
- 제안: 해당 없음.

### [INFO] TODO/FIXME 부재 확인
- 위치: 변경된 코드 전체 (`parallel-executor.ts`, `plan/in-progress/spec-update-deadcode-cleanup.md`, `review/code/2026/06/10/22_00_04/RESOLUTION.md`, `review/code/2026/06/10/22_00_04/SUMMARY.md`)
- 상세: TODO, FIXME, HACK, XXX 주석이 없다. `spec-update-deadcode-cleanup.md` 의 체크리스트 항목은 미완성 코드가 아니라 project-planner 위임 의무 추적용으로 적합한 위치에 존재한다.
- 제안: 해당 없음.

### [INFO] 의도-구현 일치 — `@internal` JSDoc 추가로 export 오남용 위험 해소
- 위치: `parallel-executor.ts` 라인 34
- 상세: `FREEZE_BRANCH_CACHE` 앞에 `/** @internal — test-only export (M-5 가드의 환경 전제 단언용). 프로덕션 코드에서 사용 금지. */` JSDoc 이 추가됐다. 이전 리뷰(22_00_04 SUMMARY W2)가 지적한 "테스트용 export 임을 명시하지 않아 public API 로 오해 가능" 문제가 해소됐다. 상수명(`FREEZE_BRANCH_CACHE`)이 bool 플래그임을 이름에서 직접 드러내지 않는 약점은 존재하나, 상위 블록 JSDoc 과 `@internal` 태그가 충분히 보완한다.
- 제안: 해당 없음 (현 수준으로 수용 가능).

### [INFO] 에러 시나리오 — freeze 위반 시 TypeError 검출 경로 완전
- 위치: `parallel-executor.ts` 라인 57–61; `parallel-executor.spec.ts` M-5 describe 블록
- 상세: `Object.freeze` 후 값 내부 mutate 시도는 strict mode(TypeScript 컴파일 기본값)에서 `TypeError` 를 throw 한다. 테스트는 `expect(mutator).toThrow(TypeError)` 형태로 이 에러 경로를 명시적으로 검증하고, `FREEZE_BRANCH_CACHE === true` 전제 단언(guard assertion)이 Jest 환경 설정 오류로 인한 false positive 를 차단한다. production 에서 `FREEZE_BRANCH_CACHE === false` 이므로 freeze 자체가 발생하지 않아 에러 시나리오는 dev/test 전용으로 한정된다.
- 제안: 해당 없음.

### [INFO] 데이터 유효성 — cache 입력 타입 제약은 JSDoc 합의 수준
- 위치: `parallel-executor.ts` 라인 54–62; `node-handler.interface.ts` 라인 66
- 상세: `freezeSharedCacheValues<T extends Record<string, unknown>>(cache: T)` 는 제네릭 제약으로 Record 구조를 보장하지만, 값 객체가 "직렬화 가능한 output envelope" (순환 참조 없음)이라는 전제는 타입 시스템에서 강제되지 않는다. `structuredOutputCache: Record<string, NodeHandlerOutput>` 으로 node-handler.interface.ts 에 타입 정의가 있으나 `NodeHandlerOutput` 이 `JsonValue` 계약인지는 별도 검토 사항이다. 현재 use-case 범위에서 실질 위험은 낮다.
- 제안: 장기적으로 `nodeOutputCache` / `structuredOutputCache` 값 타입을 `JsonValue` 계약으로 타입 시스템에서 표현하면 컴파일 타임 보장이 추가된다. 현재는 INFO 수준.

### [INFO] 비즈니스 로직 — shallow copy + freeze 조합이 spec 의 "값 내부 mutate 금지" invariant 를 올바르게 강제
- 위치: `parallel-executor.ts` 라인 214–246
- 상세: spec `10-parallel.md §4.4` 는 "`nodeOutputCache` 는 shallow copy 로 격리된다"고 명시하며, 값 객체가 공유됨을 암묵적으로 포함한다. M-5 는 이 공유 값 객체의 내부 mutate 금지 invariant 를 dev/test 에서 기계 강제한다. `structuredOutputCache` 에도 동일하게 적용하여 두 캐시 모두를 커버한다. 비즈니스 로직 관점에서 이는 "branch 별 노드 출력 격리" 요구사항과 일치한다.
- 제안: 해당 없음.

### [INFO] 반환값 — `freezeSharedCacheValues` 가 입력 참조를 그대로 반환
- 위치: `parallel-executor.ts` 라인 57, 61
- 상세: `freezeSharedCacheValues` 는 `if (!FREEZE_BRANCH_CACHE) return cache;` 와 `return cache;` 두 경로 모두에서 값을 반환한다. branchContext 생성 시 반환값을 직접 사용(`nodeOutputCache: freezeSharedCacheValues({...})`)하므로 모든 코드 경로에서 할당이 보장된다. production(no-op) 경로에서도 할당 누락 없음.
- 제안: 해당 없음.

### [WARNING] [SPEC-DRIFT] `spec/4-nodes/1-logic/10-parallel.md` — `structuredOutputCache` shallow copy 격리 및 M-5 freeze invariant 미기술
- 위치: `spec/4-nodes/1-logic/10-parallel.md` 라인 14 및 §Rationale 섹션
- 상세: 현재 spec 라인 14 에는 "분기 간 `variables` 는 `structuredClone` 으로 deep clone, `nodeOutputCache` 는 shallow copy 로 격리된다" 만 기술되고 `structuredOutputCache` 는 언급되지 않는다. 또한 M-5 로 추가된 "dev/test 환경에서 공유 값 객체 내부 mutate 금지 invariant 를 `Object.freeze` 로 기계 강제" 행위가 §Rationale 에 없다. 코드는 이미 정상 구현됐고 production 동작에 영향이 없으므로 코드가 맞고 spec 이 낡음(SPEC-DRIFT). `plan/in-progress/spec-update-deadcode-cleanup.md §1b` 에 이미 draft 가 존재한다.
- 제안: 코드 유지 + spec 반영. 대상 spec 위치: `spec/4-nodes/1-logic/10-parallel.md` 라인 14 (`structuredOutputCache` shallow copy 추가) 및 `§Rationale` (M-5 freeze invariant 1줄 추가). project-planner 트랙에서 `spec-update-deadcode-cleanup.md §1b` 처리.

### [WARNING] [SPEC-DRIFT] `spec/conventions/execution-context.md §1` — `structuredOutputCache` 필드 미등재
- 위치: `spec/conventions/execution-context.md §1 설계 원칙 — Stable core` (라인 29)
- 상세: `§1 Stable core` 목록에 `nodeOutputCache` 가 포함돼 있으나 `structuredOutputCache` 는 없다. `grep -n structuredOutputCache spec/conventions/execution-context.md` 가 0건임이 `spec-update-deadcode-cleanup.md §1b` 에서 확인됐다. `node-handler.interface.ts` 에는 두 필드 모두 존재하며, M-5 는 두 필드 모두에 동일한 freeze 격리 규약을 적용한다. 코드가 맞고 spec 이 낡음(SPEC-DRIFT).
- 제안: 코드 유지 + spec 반영. 대상 spec 위치: `spec/conventions/execution-context.md §1` (라인 29 인근) 에 `structuredOutputCache` 를 `nodeOutputCache` 와 동일 격리 규약으로 추가. project-planner 트랙에서 `spec-update-deadcode-cleanup.md §1b` 처리.

### [INFO] spec fidelity — `spec/4-nodes/1-logic/10-parallel.md §4.4` shallow copy 설계 와 구현 일치
- 위치: `parallel-executor.ts` 라인 231–235; spec `10-parallel.md` 라인 14 및 라인 69
- 상세: spec 에 명시된 "`nodeOutputCache` shallow copy 격리" (`{...context.nodeOutputCache}`)가 코드에서 `nodeOutputCache: freezeSharedCacheValues({ ...context.nodeOutputCache })` 로 구현돼 있다. shallow copy 이후 freeze 를 적용하는 순서도 올바르다 (먼저 shallow copy → 값 공유 상태 → freeze 로 내부 mutate 금지). spec 이 기술한 shallow copy 설계와 구현이 일치한다.
- 제안: 해당 없음.

### [INFO] `plan/in-progress/spec-update-deadcode-cleanup.md` spec_impact 갱신 완전
- 위치: `plan/in-progress/spec-update-deadcode-cleanup.md` frontmatter
- 상세: `spec_impact` 배열에 `spec/4-nodes/1-logic/10-parallel.md` 와 `spec/conventions/execution-context.md` 가 신규 추가됐다. M-5 SPEC-DRIFT 에 영향받는 두 spec 파일을 정확히 기록하고 있다. project-planner 가 추적해야 할 파일 목록이 완전하다.
- 제안: 해당 없음.

---

## 요약

이번 변경의 핵심 기능(plan 06 M-5 — dev/test branch cache freeze 가드)은 요구사항을 완전히 충족한다. `FREEZE_BRANCH_CACHE` allowlist 판별, `deepFreeze` 재귀 구현, `freezeSharedCacheValues` 조건부 적용, branchContext 생성 시 `nodeOutputCache`/`structuredOutputCache` 양쪽 적용이 모두 올바르게 구현됐고 테스트도 `expect(mutator).toThrow(TypeError)` + 전제 단언으로 강화됐다. Critical 발견사항은 없으며 WARNING 2건은 모두 SPEC-DRIFT로, 코드가 올바르고 spec 이 구현을 따라가지 못한 상태다 — `spec/4-nodes/1-logic/10-parallel.md` 의 `structuredOutputCache` shallow copy 누락 및 M-5 freeze invariant 미기술, `spec/conventions/execution-context.md §1` 의 `structuredOutputCache` 필드 미등재. 두 건 모두 `plan/in-progress/spec-update-deadcode-cleanup.md §1b` draft 가 이미 project-planner 트랙으로 추적 중이며, 코드 되돌리기가 아닌 spec 갱신으로 해결해야 한다.

---

## 위험도

LOW

STATUS=success ISSUES=2
