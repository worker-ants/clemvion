# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** (Critical 1건 포함) — React 반응성 버그, DB 레벨 유니크 제약 누락, TOCTOU 레이스 컨디션이 핵심 위험 요소

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 반응성 버그 | `useMemo` 내부에서 `useEditorStore.getState()` 직접 호출. Zustand 구독이 생성되지 않아 다른 노드의 라벨이 변경되어도 `isDuplicateLabel`이 재계산되지 않으며, stale 상태로 중복 감지가 무력화됨 | `node-settings-panel.tsx:130-136` | `const nodes = useEditorStore((s) => s.nodes)`를 컴포넌트 최상단에서 구독하고, `useMemo` 의존성에 포함: `[nodes, nodeId, label]` |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성 / DB | `bulkCreate`: `findByWorkflow` → `save` 사이 구간에서 TOCTOU 레이스 컨디션. 동시 요청 시 중복 라벨이 DB에 삽입될 수 있음 | `nodes.service.ts` `bulkCreate` | `(workflowId, label)` 복합 유니크 제약 조건을 DB 레벨에 추가하고, DB 제약 위반도 `ConflictException`으로 처리 |
| 2 | 동시성 / DB | `assertLabelUnique`: `findOne` + `save` 패턴이 원자적이지 않아 동시 요청 시 중복 검사가 우회될 수 있음 | `nodes.service.ts` `assertLabelUnique` | DB 레벨 유니크 제약 추가 (위 항목과 동일한 해결책) |
| 3 | API 일관성 | 동일한 비즈니스 규칙(중복 라벨 금지)에 대해 `NodesService`는 HTTP 409 (`ConflictException`), `WorkflowsService.saveCanvas`는 HTTP 400 (`BadRequestException`)을 반환 | `nodes.service.ts`, `workflows.service.ts:validateUniqueLabels` | `validateUniqueLabels`도 `ConflictException`(409)으로 통일 |
| 4 | 정책 일관성 | `importWorkflow`는 라벨 유니크 검증 없이 `manager.save()`로 직접 삽입. 외부에서 가져온 워크플로우에 중복 라벨이 있어도 그대로 저장됨 | `workflows.service.ts` `importWorkflow` | `importWorkflow`에도 라벨 유니크 검증 로직 추가, 또는 스펙에 import 시 중복 허용 여부를 명시 |
| 5 | 성능 | `bulkCreate`의 배치 중복 감지 알고리즘이 O(n²): `batchLabels.filter((label, i) => batchLabels.indexOf(label) !== i)` | `nodes.service.ts:58-64` | `Set`을 활용한 O(n) 알고리즘으로 교체 |
| 6 | 성능 / DB | `bulkCreate`에서 충돌 여부만 확인하면 되는데 `findByWorkflow`로 전체 노드를 메모리에 로드 | `nodes.service.ts` `bulkCreate` | `WHERE workflowId = ? AND label IN (...)` 쿼리로 최적화하거나, `assertLabelUnique`와 동일한 전략 사용 |
| 7 | 요구사항 | `use-expression-context.ts`의 `buildDisambiguatedKeys` 호출이 `selectedNodeId`를 제외한 노드 기준으로 계산됨. 백엔드 실행 시점은 전체 노드 기준이므로, 자동완성 키(`HTTP Request#2`)와 실제 실행 키(`HTTP Request#3`) 불일치 가능 | `use-expression-context.ts` `filteredNodes` 생성 | 전체 노드 기준으로 `buildDisambiguatedKeys` 호출 후, 표시 시 선택된 노드 엔트리만 필터링 |
| 8 | 코드 품질 | `variable-picker.tsx`의 `{node.resolvedKey !== node.label ? node.resolvedKey : node.label}` 삼항 연산이 항상 `node.resolvedKey`를 반환하므로 불필요한 복잡성 | `variable-picker.tsx:~213` | `{node.resolvedKey}`로 단순화 |
| 9 | DB 인덱스 | `assertLabelUnique`의 `findOne({ where: { workflowId, label } })` 쿼리에 복합 인덱스 없으면 풀 스캔 발생. 노드 생성/수정마다 호출되므로 성능 영향 | `nodes.service.ts` | Node 엔티티에 `@Index(['workflowId', 'label'])` 추가 (유니크 제약 추가 시 자동 생성) |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 설계 일관성 | `generateUniqueLabel`(공백+숫자: `"HTTP Request 2"`)과 `buildDisambiguatedKeys`(`#`+숫자: `"HTTP Request#2"`)가 동일한 "중복 구분" 개념에 다른 포맷 사용. 두 용도는 다르나(UI 라벨 생성 vs 표현식 참조 키) 혼동 가능 | `generate-unique-label.ts`, `disambiguate-labels.ts` | 두 함수의 목적 차이를 JSDoc 주석으로 명시. 스펙 문서에도 두 체계의 의도를 기술 |
| 2 | 보안 | `$node[nodeId]` 형태로 내부 DB UUID가 표현식 컨텍스트에 노출됨. UUID 기반 접근이 의도된 설계이나 용도를 스펙에 명시 필요 | `expression-resolver.service.ts:44` | UUID 폴백 용도(디버깅/안전망 여부)를 스펙 문서에 명시. 실행 로그에 UUID 기반 접근 기록 권장 |
| 3 | 보안 | 라벨에 `#` 문자가 포함된 경우(`"HTTP#2"`) disambiguation 접미사와 충돌 가능. UUID 형식 라벨도 UUID 폴백 키와 충돌 가능 | `disambiguate-labels.ts`, 라벨 유효성 검증 | 라벨 입력에서 `#` 문자 금지 검증 추가 |
| 4 | 보안 | 에러 메시지에 사용자 입력(`label`)이 직접 포함되어 API 응답으로 반환됨. 로그 인젝션 가능성 | `nodes.service.ts:62,72,87`, `workflows.service.ts:309` | 길이 제한 및 새니타이징 적용, 또는 상세 정보는 `code` 필드로만 전달 |
| 5 | 동시성 | `buildDisambiguatedKeys`가 `Map` 삽입 순서(= 위상 정렬 순서)에 의존하나 이 계약이 암묵적. 순서가 달라지면 `#N` 번호가 비결정적 | `expression-resolver.service.ts:28-43` | "`nodeMap`은 위상 정렬 순서로 구성되어야 한다"는 계약을 주석으로 명시 |
| 6 | 코드 품질 | `workflow-canvas.tsx`에서 `nodes.map((n) => (n.data as Record<string, unknown>).label as string)` 패턴이 복사/추가/드롭 3곳에 중복 | `workflow-canvas.tsx:177-181`, `281-284`, `337-340` | 공통 헬퍼 함수(`getExistingLabels`)로 추출 |
| 7 | 코드 품질 | `nodes.service.spec.ts`에서 `NotFoundException` import 후 미사용 | `nodes.service.spec.ts:1` | `NotFoundException` import 제거 |
| 8 | 문서화 | `NodesService.assertLabelUnique` private 메서드에 JSDoc 없음. `excludeNodeId` 파라미터 용도가 불명확 | `nodes.service.ts:55-69` | JSDoc 추가 (`@param excludeNodeId`, `@throws ConflictException`) |
| 9 | 문서화 | `packages/expression-engine/src/index.ts` 헤더 JSDoc에 새로 추가된 `buildDisambiguatedKeys` export 미반영 | `expression-engine/src/index.ts:1-12` | 헤더 주석에 새 export 명시 |
| 10 | 문서화 | `validateUniqueLabels` 메서드에 JSDoc 없음 | `workflows.service.ts:306-314` | 한 줄 주석이라도 추가 권장 |
| 11 | 테스트 | `use-expression-context.test.ts`에 duplicate label 시나리오 테스트 누락. 두 노드가 동일 label일 때 `resolvedKey`에 `#N` suffix가 올바르게 설정되는지 미검증 | `use-expression-context.test.ts` | `"assigns disambiguated resolvedKey for duplicate labels"` 테스트 케이스 추가 |
| 12 | 테스트 | `node-settings-panel.tsx`의 `isDuplicateLabel` 로직에 대한 컴포넌트 테스트 없음 | `node-settings-panel.tsx` | `isDuplicateLabel` 동작 검증 단위 테스트 추가 |
| 13 | 테스트 | `nodes.service.spec.ts`의 `update` 테스트에서 label 미변경 케이스 시 `findOne` 호출 횟수 미검증 | `nodes.service.spec.ts:69` | `expect(mockRepo.findOne).toHaveBeenCalledTimes(1)` 검증 추가 |
| 14 | 아키텍처 | `buildDisambiguatedKeys`가 표현식 평가와 무관한 순수 유틸리티임에도 `expression-engine` 패키지에 위치 | `packages/expression-engine/src/disambiguate-labels.ts` | 추후 `@workflow/shared-utils` 패키지 분리 고려 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| architecture | MEDIUM (Critical 포함) | `useMemo`+`getState()` 반응성 버그, `bulkCreate` 비원자적 중복 검사, 라벨 포맷 불일치 |
| concurrency | MEDIUM | `bulkCreate`/`assertLabelUnique` TOCTOU, `useMemo`+`getState()` stale 상태, `nodeMap` 순서 의존성 |
| database | MEDIUM | TOCTOU 레이스 컨디션, DB 유니크 제약 누락, 복합 인덱스 누락, O(n²) 중복 탐지 |
| security | MEDIUM | TOCTOU 레이스 컨디션, Hook 규칙 위반, UUID 노출, 에러 메시지 사용자 입력 포함 |
| testing | MEDIUM | `useMemo`+`getState()` 버그 감지 테스트 누락, duplicate label 시나리오 미검증 |
| requirement | MEDIUM | `useMemo`+`getState()` Hook 위반, `importWorkflow` 검증 누락, 자동완성-실행 키 불일치 |
| maintainability | MEDIUM | `useMemo`+`getState()` Hook 위반, 라벨 포맷 불일치, `bulkCreate` 전략 불일치 |
| performance | MEDIUM | `useMemo`+`getState()` stale, O(n²) 배치 중복 탐지, 전체 노드 로딩 비효율 |
| api_contract | MEDIUM | 중복 라벨 에러 코드 불일치(409 vs 400), TOCTOU, `#N` 포맷과 라벨 충돌 가능성 |
| scope | LOW | `expression-resolver.service.ts` 동작 변경 혼재, `getState()` 패턴, 불필요한 삼항 연산 |
| dependency | LOW | `useMemo`+`getState()` 반응성 불일치, `generateUniqueLabel`/`buildDisambiguatedKeys` 역할 불명확 |
| documentation | LOW | 새 export JSDoc 미반영, `assertLabelUnique`/`validateUniqueLabels` JSDoc 누락 |

---

## 발견 없는 에이전트
없음 — 모든 에이전트가 하나 이상의 발견사항을 보고함

---

## 권장 조치사항

1. **[즉시 필수]** `node-settings-panel.tsx`의 `useMemo` + `getState()` 패턴을 `useEditorStore((s) => s.nodes)` 구독 방식으로 수정 — 중복 감지 기능이 사실상 동작하지 않는 상태
2. **[즉시 필수]** Node 엔티티에 `(workflowId, label)` 복합 유니크 제약 추가 및 DB 제약 위반 에러를 `ConflictException`으로 처리 — TOCTOU 레이스 컨디션의 유일한 근본 해결책
3. **[필수]** `validateUniqueLabels`의 에러 타입을 `ConflictException`(409)으로 통일하여 API 응답 일관성 확보
4. **[필수]** `importWorkflow` 경로에 라벨 유니크 검증 추가 또는 스펙에 허용 여부 명시
5. **[필수]** `use-expression-context.ts`의 disambiguation 범위를 전체 노드 기준으로 수정하여 자동완성 키와 실행 키 일치
6. **[권장]** `bulkCreate`의 O(n²) 배치 중복 탐지를 `Set` 기반 O(n)으로 교체
7. **[권장]** `bulkCreate`의 전체 노드 로딩을 `IN` 쿼리로 최적화
8. **[권장]** `variable-picker.tsx`의 불필요한 삼항 연산을 `{node.resolvedKey}`로 단순화
9. **[권장]** `workflow-canvas.tsx`의 반복되는 라벨 추출 패턴을 공통 헬퍼로 추출
10. **[권장]** 라벨 유효성 검증에 `#` 문자 금지 추가하여 disambiguation 포맷 충돌 방지
11. **[권장]** `use-expression-context.test.ts`에 duplicate label 시나리오 테스트 추가
12. **[선택]** `assertLabelUnique`, `validateUniqueLabels` JSDoc 및 `expression-engine/index.ts` 헤더 주석 보완