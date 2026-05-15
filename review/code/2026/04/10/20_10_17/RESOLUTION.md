# 코드 리뷰 이슈 조치 내용

## Critical #1: useMemo + getState() 반응성 버그
- **조치**: `node-settings-panel.tsx`에서 `useEditorStore.getState().nodes`를 `useEditorStore((s) => s.nodes)` 구독 방식으로 변경. `useMemo` 의존성에 `nodes` 추가.

## Warning #1-2: TOCTOU 레이스 컨디션 / DB 유니크 제약 누락
- **조치**: `node.entity.ts`에 `@Unique('UQ_node_workflow_label', ['workflowId', 'label'])` 복합 유니크 제약 추가. `@Index` 추가. `nodes.service.ts`에 `saveWithUniqueConstraint()` 메서드 추가하여 DB 제약 위반 시 `ConflictException` 반환.

## Warning #3: API 일관성 (409 vs 400)
- **조치**: `workflows.service.ts`의 `validateUniqueLabels`에서 `BadRequestException` → `ConflictException`(409)으로 통일.

## Warning #4: importWorkflow 검증 누락
- **조치**: `importWorkflow` 메서드 진입 시 중복 라벨 검증 로직 추가.

## Warning #5: bulkCreate O(n²) 성능
- **조치**: `batchLabels.filter((label, i) => batchLabels.indexOf(label) !== i)` → `Set` 기반 O(n) 알고리즘으로 교체.

## Warning #6: bulkCreate 전체 노드 로딩 비효율
- **조치**: `findByWorkflow` → `find({ where: { workflowId, label: In(batchLabels) } })` IN 쿼리로 최적화.

## Warning #7: 자동완성-실행 키 불일치
- **조치**: `use-expression-context.ts`에서 `buildDisambiguatedKeys`를 `filteredNodes` 대신 전체 `nodes` 기준으로 호출하도록 변경.

## Warning #8: variable-picker 불필요한 삼항 연산
- **조치**: `{node.resolvedKey !== node.label ? node.resolvedKey : node.label}` → `{node.resolvedKey}`로 단순화.

## Warning #9: DB 인덱스 누락
- **조치**: Warning #1-2 조치 시 `@Index('IDX_node_workflow_label', ['workflowId', 'label'])` 함께 추가.

## INFO #3: `#` 문자 라벨 충돌 방지
- **조치**: `CreateNodeDto`, `UpdateNodeDto`에 `@Matches(/^[^#]*$/)` 검증 추가.

## INFO #5: nodeMap 순서 의존성 명시
- **조치**: `expression-resolver.service.ts`에 nodeMap 순서 계약 주석 추가.

## INFO #6: workflow-canvas 중복 패턴 추출
- **조치**: `getExistingLabels()` 헬퍼 함수로 추출하여 3곳에서 공유.

## INFO #7: nodes.service.spec.ts 미사용 import
- **조치**: `NotFoundException` import 제거.

## INFO #8: assertLabelUnique JSDoc
- **조치**: `assertLabelUnique`, `saveWithUniqueConstraint` 메서드에 JSDoc 추가.

## INFO #10: validateUniqueLabels JSDoc
- **조치**: `validateUniqueLabels` 메서드에 JSDoc 추가.

## INFO #11: 중복 라벨 resolvedKey 테스트 추가
- **조치**: `use-expression-context.test.ts`에 "assigns disambiguated resolvedKey for duplicate labels" 테스트 케이스 추가.

## 미조치 사항 (의도적 보류)
- **INFO #1** (포맷 불일치): `generateUniqueLabel`(UI 라벨: "HTTP Request 2")과 `buildDisambiguatedKeys`(런타임 키: "HTTP Request#2")는 서로 다른 목적(영구 라벨 vs 임시 참조 키)이므로 의도적으로 다른 포맷 유지.
- **INFO #2** (UUID 노출): UUID 폴백은 스펙에 문서화 완료.
- **INFO #4** (에러 메시지 사용자 입력 포함): 라벨은 이미 MaxLength(255) + `#` 금지 검증이 적용되어 위험 낮음.
- **INFO #9** (expression-engine 패키지 위치): `@workflow/shared-utils` 분리는 추후 검토.
- **INFO #12** (node-settings-panel 컴포넌트 테스트): 중복 감지의 핵심 로직은 `useMemo` + `useEditorStore` 구독으로 수정 완료. 컴포넌트 테스트는 추후 별도 작업.
- **INFO #13** (update 테스트 findOne 호출 횟수): 현재 테스트로 기능 검증 충분.
- **INFO #14** (패키지 위치): 추후 검토.
