# 정식 규약 준수 검토 결과

**검토 모드**: --impl-done  
**대상**: `spec/5-system/4-execution-engine.md`  
**diff-base**: origin/main  
**검토 일시**: 2026-06-17

---

## 발견사항

### [INFO] `pending_plans` 에 이미 complete 로 이동된 plan이 잔류

- target 위치: `spec/5-system/4-execution-engine.md` frontmatter `pending_plans:` 4번째 항목
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3.1` — "마지막 `pending_plans` 가 `complete/` 로 이동한 commit 안에서 승격 의무"
- 상세: `pending_plans` 에 `plan/in-progress/spec-sync-execution-engine-gaps.md` 가 기재돼 있으나, 해당 파일은 실제로 `plan/complete/spec-sync-execution-engine-gaps.md` 에 존재하고 `plan/in-progress/` 에는 없다. `spec-pending-plan-existence.test.ts` 는 `in-progress/` 또는 `complete/`(in-progress→complete 치환) 실존을 모두 허용하므로 build 가드는 통과하지만, 나머지 3개 plan 이 여전히 in-progress 이므로 status 승격 가드는 현재 발동하지 않는다. spec-sync plan 이 완료됐다는 사실 자체는 frontmatter 에 반영되지 않은 상태다.
- 제안: 이 항목 하나만 제거하거나, 또는 이 commit 에 영향이 없는 정보이므로 현 상태 유지 후 나머지 pending_plans 가 모두 complete 되는 시점에 일괄 정리해도 가드 관점에서 문제없다. 즉각 수정 불요.

---

### [INFO] 구현 diff 가 `spec/4-nodes/0-overview.md` 의 `code:` glob 과 교차하는 영역을 변경함

- target 위치: 구현 diff — `codebase/backend/src/nodes/core/workflow-executor.interface.ts` (WORKFLOW_EXECUTOR DI 토큰 추가)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §1·§2` — 해당 경로(`codebase/backend/src/nodes/core/**`)는 `spec/4-nodes/0-overview.md` 의 `code:` 글로브로 커버됨. 본 변경이 노드 시스템의 engine↔node 계약(`WORKFLOW_EXECUTOR` 토큰)을 공식화하는 인터페이스 추가이므로 `spec/4-nodes/0-overview.md` 본문이 이를 언급하는지 검토가 필요함
- 상세: `spec/4-nodes/0-overview.md §1.0` 은 "`NodeComponentRegistry` 는 서버 부팅 시 `ALL_NODE_COMPONENTS` 배열을 순회하며 … `NodeHandlerRegistry` 에 등록" 이라고 기술하나, 그 등록을 실제로 트리거하는 주체(`NodeBootstrapService`), DI 토큰(`WORKFLOW_EXECUTOR`), bootstrap 분리 결정은 spec 본문에 언급되지 않는다. `node-bootstrap.service.ts` JSDoc 은 이를 `spec/4-nodes/0-overview.md §1.0` 계약을 "트리거하는 lifecycle 진입점" 으로 표현하며 spec 계약이 유지됨을 명시한다. 즉 기존 spec 기술된 계약("무엇이 일어나는가")은 변하지 않고, "어떻게 트리거되는가" 의 구현 내부만 변경된 것이다.
- 제안: 본 diff 의 `WorkflowExecutor` 인터페이스 변경과 `NodeBootstrapService` 신설은 `spec/4-nodes/0-overview.md` 이 기술한 계약(등록 결과)을 파괴하지 않으므로 spec 갱신 의무는 없다. 단, refactor plan(`plan/in-progress/refactor/02-architecture.md`) 의 C-1 step 1 이 완료 상태로 간주되는 경우 해당 plan 의 spec_impact 갱신이 plan 완료 시 필요하다(Gate C). 현 시점에서 spec 위반 없음.

---

### [INFO] `WORKFLOW_EXECUTOR` DI 토큰 문자열 값이 단순 문자열 리터럴임

- target 위치: `codebase/backend/src/nodes/core/workflow-executor.interface.ts` (새 추가 블록) — `export const WORKFLOW_EXECUTOR = 'WORKFLOW_EXECUTOR';`
- 위반 규약: 해당 없음 — conventions 에 NestJS DI 토큰 명명·형식에 관한 규약이 없음. error-codes.md 의 UPPER_SNAKE_CASE 규칙은 `ErrorCode` enum 및 에러 코드 문자열에 적용되며 DI 토큰은 해당 규약 적용 범위 밖이다.
- 상세: `WORKFLOW_EXECUTOR` 는 `'WORKFLOW_EXECUTOR'` 문자열 리터럴로 선언됐다. `Symbol('WORKFLOW_EXECUTOR')` 또는 `InjectionToken` 패턴을 사용하지 않는다. 이는 NestJS 관행 범위의 선택이며 conventions 에서 정의된 규칙은 없다.
- 제안: conventions 에서 명시적으로 다루지 않는 영역이므로 규약 위반으로 분류하지 않는다. 필요 시 DI 토큰 패턴을 `spec/conventions/` 에 추가하거나, 현 실용적 패턴을 유지하면 된다. 현 diff 에서 다른 DI 토큰(`WORKFLOW_EXECUTOR`)이 다른 곳에서 문자열 중복 위험이 있다면 `Symbol`/`InjectionToken` 선택을 검토할 수 있으나 spec 의무 사항 아님.

---

## 요약

`spec/5-system/4-execution-engine.md` 의 구현 diff(C-1 step 1 — `NodeBootstrapService` 분리·`WORKFLOW_EXECUTOR` DI 토큰 신설)는 정식 규약(`spec/conventions/**`)을 직접 위반하는 패턴을 도입하지 않았다. frontmatter `status: partial` + `code:` 글로브 + `pending_plans:` 구조는 `spec-impl-evidence.md` 요건을 충족하며, 새 구현 파일(`node-bootstrap.service.ts`)은 기존 `codebase/backend/src/modules/execution-engine/**` 글로브로 커버된다. `workflow-executor.interface.ts` 변경은 `spec/4-nodes/0-overview.md` 의 `code:` 영역(`codebase/backend/src/nodes/core/**`)에 속하나 spec 기술 계약을 보존하므로 갱신 의무가 없다. `pending_plans` 에 완료된 plan 1건이 잔류하는 것은 build 가드(spec-pending-plan-existence)가 `plan/complete/` 실존도 허용하므로 차단되지 않으며, 나머지 3개 plan 이 in-progress 인 동안 status 승격 가드도 발동하지 않는다. 전반적으로 규약 준수 상태이며 CRITICAL/WARNING 등급 발견사항은 없다.

---

## 위험도

NONE
