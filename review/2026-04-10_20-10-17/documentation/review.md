## 문서화 코드 리뷰 결과

### 발견사항

---

**[INFO]** `generateUniqueLabel` 함수 JSDoc이 충실함
- 위치: `frontend/src/lib/utils/generate-unique-label.ts`
- 상세: 함수 상단에 입출력 예시를 포함한 명확한 JSDoc이 작성되어 있음. 표준적인 수준 이상의 문서화.
- 제안: 유지

---

**[INFO]** `buildDisambiguatedKeys` 함수 JSDoc이 충실함
- 위치: `packages/expression-engine/src/disambiguate-labels.ts`
- 상세: 동작 원리, `#N` 접미사 규칙, 파라미터, 반환값이 모두 명시되어 있음.
- 제안: 유지

---

**[INFO]** `ExpressionNodeInfo` 인터페이스의 `resolvedKey` 필드에 JSDoc 주석 추가됨
- 위치: `frontend/src/components/editor/expression/use-expression-context.ts:12`
- 상세: `/** Disambiguated key used in $node["..."] expressions (label or label#N for duplicates) */` — 새 필드의 의미와 형식이 인라인 주석으로 명확하게 기술됨.
- 제안: 유지

---

**[WARNING]** `packages/expression-engine/src/index.ts` 모듈 수준 JSDoc에 새 export 미반영
- 위치: `packages/expression-engine/src/index.ts:1-12` (파일 헤더 주석)
- 상세: 파일 상단의 모듈 레벨 JSDoc은 `evaluate` 함수 사용 예시만 언급하고 있음. `buildDisambiguatedKeys` export가 추가되었으나 헤더에 언급이 없어, 패키지 공개 API 범위가 주석과 실제 코드 간에 불일치함.
- 제안: 헤더 주석에 새 export 추가를 반영하거나, 공개 API 목록을 언급하는 섹션을 추가

```typescript
/**
 * @workflow/expression-engine
 * ...
 * Exports:
 *   - evaluate: template string evaluation
 *   - validate: syntax validation without evaluation
 *   - buildDisambiguatedKeys: node label disambiguation for $node[] access
 */
```

---

**[WARNING]** `NodesService.assertLabelUnique`에 JSDoc 없음
- 위치: `backend/src/modules/nodes/nodes.service.ts:55-69`
- 상세: 새로 추가된 private 메서드로 핵심 비즈니스 규칙(라벨 유니크 강제)을 담당함. 파라미터 `excludeNodeId`의 용도(자기 자신 제외)가 주석 없이는 즉시 파악하기 어려움. `bulkCreate`에는 인라인 주석이 있지만 이 메서드엔 없음.
- 제안:

```typescript
/**
 * Asserts that a node label is unique within the workflow.
 * @param excludeNodeId - When provided, excludes this node from the uniqueness check (used during rename).
 * @throws ConflictException with code DUPLICATE_NODE_LABEL if a conflict is found.
 */
private async assertLabelUnique(...) { ... }
```

---

**[WARNING]** `validateUniqueLabels` 메서드에 JSDoc 없음
- 위치: `backend/src/modules/workflows/workflows.service.ts:306-314`
- 상세: `validateManualTrigger`와 같은 구조이지만, 해당 메서드에도 별도 주석이 없음. 두 메서드 모두 일관되게 주석이 없거나 있어야 함. 특히 `saveCanvas` 레벨의 검증 흐름을 이해하는 데 도움이 필요한 위치.
- 제안: `validateManualTrigger`와 동일한 수준으로 한 줄 주석이라도 추가 권장

---

**[INFO]** 스펙 문서(`5-expression-language.md`)가 변경과 함께 업데이트됨
- 위치: `spec/5-system/5-expression-language.md`
- 상세: UUID 폴백, 라벨 유니크 정책, `#N` 안전장치 등 세 가지 핵심 변경사항이 모두 스펙에 반영됨. 코드-문서 동기화 측면에서 양호함.
- 제안: 유지

---

**[INFO]** `node-settings-panel.tsx`의 `isDuplicateLabel` useMemo 내부에서 `useEditorStore.getState()` 직접 호출
- 위치: `frontend/src/components/editor/settings-panel/node-settings-panel.tsx:129-135`
- 상세: `useMemo` 내에서 React 스토어의 구독 없이 `getState()`를 호출하는 패턴은 동작하지만, 스토어 변경 시 자동 재계산되지 않음. 현재 동작 방식과 한계에 대한 주석이 없어 향후 혼란을 초래할 수 있음.
- 제안: 인라인 주석으로 의도 명시

```tsx
// getState()를 직접 사용하여 현재 nodes 스냅샷 조회 (label 변경 시 재계산됨)
const nodes = useEditorStore.getState().nodes;
```

---

**[INFO]** `variable-picker.tsx`의 `NodeSection` 컴포넌트에 `resolvedKey` props 문서 없음
- 위치: `frontend/src/components/editor/expression/variable-picker.tsx:177-184`
- 상세: props 타입 정의에 `resolvedKey`가 추가되었으나 각 필드의 역할을 설명하는 JSDoc이 없음. `label`과 `resolvedKey`의 차이가 주석 없이는 명확하지 않음.
- 제안: 타입 정의 위에 간단한 주석 추가 (단, 코드 내에서 사용 패턴으로 추론 가능하므로 낮은 우선순위)

---

### 요약

이번 변경은 **노드 라벨 중복 방지 및 표현식 참조 개선**이라는 기능적으로 복잡한 변경임에도 불구하고, 핵심 유틸리티 함수(`buildDisambiguatedKeys`, `generateUniqueLabel`)에 충실한 JSDoc이 작성되어 있고, 스펙 문서가 코드와 동기화되어 갱신된 점은 긍정적이다. 다만 `NodesService.assertLabelUnique`와 `WorkflowsService.validateUniqueLabels` 등 새로 추가된 서비스 레이어 메서드에 문서가 누락되어 있으며, `expression-engine` 패키지의 모듈 헤더 JSDoc이 새 공개 API를 반영하지 않고 있다. 전반적으로 문서화 수준은 양호하나, 백엔드 서비스 메서드의 JSDoc 보완이 권장된다.

### 위험도

**LOW**