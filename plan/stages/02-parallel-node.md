# Stage 2 · Parallel 노드

## 배경

PRD `ND-PL-*`는 여러 분기를 동시 실행하는 노드이지만 현재 스펙만 존재하고 런타임·레지스트리에 없다. 기존 우회(1:N 분기 + Merge `wait_all`)로 대체되지만 동시 실행 의도가 표현되지 않아 표현력·성능 모두 제약된다.

## 설계

### 노드 정의

- 타입: `parallel`
- 카테고리: `logic`
- 입력 포트: 1 (`in`)
- 출력 포트: N (동적, `branch_0`, `branch_1`, ...) + error 포트(정책 적용 시)
- 설정: `branchCount` (number, 기본 2, min 2, max 16), `concurrencyLimit?` (number, 0 = 무제한)

### 실행 의미

입력이 들어오면 `branch_*` 포트 각각으로 **동일한 입력을 복제**하여 병렬 실행 시작. 각 분기는 독립 실행 컨텍스트에서 진행된다.

> **주의**: 현재 실행 엔진(`backend/src/modules/execution-engine`)이 위상 정렬 기반으로 동시 실행 가능한 노드를 자동 병렬화한다. Parallel 노드의 고유 가치는 **사용자가 "이 분기들은 반드시 동시 실행"이라고 선언**하는 의미론적 표시다. 구현상으로는 Switch의 "선택 1개"와 달리 **모든 포트로 전송**하는 분기 노드.

### 영향받는 파일

- 신규: `backend/src/nodes/logic/parallel/parallel.schema.ts`
- 신규: `backend/src/nodes/logic/parallel/parallel.component.ts`
- 신규: `backend/src/nodes/logic/parallel/index.ts`
- 수정: `backend/src/nodes/index.ts` (export 추가)
- 수정: `backend/src/nodes/core/node-component.registry.ts` 에 자동 등록(기존 패턴 따름)
- 수정: `spec/4-nodes/1-logic-nodes.md` §Parallel (구현됨으로 갱신)
- 수정: `prd/3-node-system.md` ND-PL-* → ✅
- 수정: `frontend/src/content/docs/02-nodes/logic.mdx` Parallel 섹션 갱신

### 테스트

- backend unit: `parallel.schema.spec.ts`, `parallel.component.spec.ts` — 동적 포트, 모든 분기 전송
- backend integration: Parallel → 3분기 → Merge 워크플로우 실행

### 검증

- 실행 이력에서 `branch_0~N`이 모두 동시간대에 시작되는지 타임라인 확인
