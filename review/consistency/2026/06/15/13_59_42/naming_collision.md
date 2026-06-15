# 신규 식별자 충돌 검토 결과

> 검토 모드: --impl-prep  
> 대상 계획: `plan/in-progress/exec-single-node.md` — execution §1.3 단일 노드 실행  
> 검토 일시: 2026-06-15

---

## 발견사항

### [INFO] `getLatestPredecessorOutputs` — 기존 `executeNode` private 메서드와 네이밍 패밀리 정합
- **target 신규 식별자**: `getLatestPredecessorOutputs(executionId, nodeIds)` (private 헬퍼)
- **기존 사용처**: `execution-engine.service.ts:7093` 에 `private async executeNode(...)` 이미 존재. 동 파일에 `runContainer`, `runParallel`, `scheduleBackgroundBody` 등 동사+명사 camelCase 패턴의 private 메서드군이 있음.
- **상세**: 동일 이름이 기존 코드에 없어 충돌 없음. 다만 기존 네이밍 패턴은 `getXxx`보다 동사 단독(`executeNode`, `runContainer`)을 선호하므로 일관성 측면의 참고 사항. `getLatestPredecessorOutputs`의 `get` 접두사는 조회 전용(write 없음) 의미가 명확하므로 허용 범위 내.
- **제안**: 기존 패턴과 완전한 정렬을 원하면 `fetchPredecessorOutputs` 또는 `loadPredecessorOutputs`로 명명 가능하나 강제 사항 아님. 현재 명칭 그대로 사용해도 무방.

---

### [INFO] `execution.single_node_id` — 기존 `re_run_of` / `parent_execution_id` 설계 맥락 확인
- **target 신규 식별자**: DB 컬럼 `single_node_id uuid null`, 엔티티 필드 `singleNodeId: string | null`
- **기존 사용처**: `execution.entity.ts:79–84` `parent_execution_id` (sub-workflow 부모 포인터), `execution.entity.ts:112` `re_run_of` (re-run 직계 부모). 두 컬럼 모두 `execution` 테이블에 UUID nullable FK.
- **상세**: 이름 충돌 없음. 의미 충돌도 없음(`parent_execution_id`는 sub-workflow 부모, `re_run_of`는 re-run 체인 부모, `single_node_id`는 단일 노드 실행 대상 노드 식별자로 각각 다른 차원). 다만 세 컬럼이 모두 nullable UUID이므로 운영 쿼리 시 혼동 가능성 있음.
- **제안**: 엔티티 주석에 "단일 노드 테스트 실행 시 대상 노드 id (NULL = 일반/부분 실행)" 명시 권장. 기존 `re_run_of` / `chain_id` 주석 패턴(V067, `execution.entity.ts:108–116`) 선례 따를 것.

---

### [INFO] `execution.previous_execution_id` — `re_run_of` · `parent_execution_id` 와 의미 유사성
- **target 신규 식별자**: DB 컬럼 `previous_execution_id uuid null`, 엔티티 필드 `previousExecutionId: string | null`
- **기존 사용처**: `re_run_of` (`execution.entity.ts:112`)는 "re-run 으로 파생된 직계 부모 실행", `parent_execution_id` (`execution.entity.ts:79`)는 "sub-workflow 를 발화한 부모 실행". 둘 다 `execution` 테이블의 UUID nullable 포인터.
- **상세**: 이름 자체는 충돌 없음. 그러나 `previous_execution_id`는 "직전에 실행된 실행" 이라는 의미가 `re_run_of`("직전 실행의 re-run")와 가독성상 혼동될 수 있음. `re_run_of`는 "현재 실행이 누구를 다시 실행한 것인가"이고, `previous_execution_id`는 "단일 노드 실행 시 입력 seed 출처가 되는 참조 실행" 이므로 의미가 다름. 하지만 이름만 보면 관계가 즉각 구분되지 않음.
- **제안**: `previous_execution_id` 대신 `seed_execution_id`(입력 seed 출처 실행) 또는 `ref_execution_id`(참조 실행)로 명명하면 `re_run_of`와의 의미 차별화가 선명해짐. 단, plan 문서에서 이미 `previousExecutionId`로 확정·결정된 사항이므로 변경 여부는 팀 재검토 필요. 현재 명칭도 충돌은 아님.

---

## 충돌 없음 확인 항목

| 대상 식별자 | 기존 충돌 여부 | 확인 근거 |
|---|---|---|
| `POST /api/workflows/:id/execute-node` | 없음 | `workflows.controller.ts` 에 `@Post(':id/execute')` 하나만 존재. `execute-node` 경로 미등록. spec `3-execution.md §9` 테이블에도 해당 경로 없음 ("전용 부분실행/단일노드 엔드포인트 없음" 명시). |
| `V098__*.sql` 마이그레이션 | 없음 | `codebase/backend/migrations/` 최신은 `V097__workflow_test_dataset.sql`. V098 미사용. |
| `ExecuteOptions.singleNodeId` | 없음 | `execution-engine.service.ts:556` 의 `ExecuteOptions` 유니온 타입에 `singleNodeId` 필드 부재. |
| `ExecuteOptions.previousExecutionId` | 없음 | 동 유니온 타입에 `previousExecutionId` 필드 부재. |
| i18n "이 노드 실행" (ko) | 없음 | `codebase/frontend/src/lib/i18n/dict/ko/editor.ts` 에 `disableNode: "이 노드 비활성화"` 존재하나 "이 노드 실행" 키는 미존재. |
| i18n "Run this node" (en) | 없음 | `codebase/frontend/src/lib/i18n/dict/en/editor.ts` 에 `disableNode: "Disable this node"` 존재하나 "Run this node" 키는 미존재. |

---

## 요약

target(`exec-single-node` 구현 계획)이 도입하는 7개 신규 식별자(API 엔드포인트 `POST /api/workflows/:id/execute-node`, DB 컬럼 `single_node_id`/`previous_execution_id`, 마이그레이션 `V098`, `ExecuteOptions` 필드 2종, private 메서드 `getLatestPredecessorOutputs`, i18n 키 2종)는 기존 코드베이스 및 spec 과 이름·의미 양면에서 직접 충돌하지 않는다. `V097`이 현재 마지막 마이그레이션이므로 `V098` 사용은 정확하다. 다만 `previous_execution_id`가 기존 `re_run_of`와 의미상 혼동 가능성이 있고, `getLatestPredecessorOutputs`의 `get` 접두사가 기존 private 메서드 네이밍 패턴과 미세하게 다른 점이 INFO 수준으로 기록된다. 어느 항목도 구현 착수를 차단하지 않는다.

### 위험도
LOW
