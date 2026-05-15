### 발견사항

- **[INFO]** `expression-resolver.service.ts` - Mixed text + expression 강제 문자열 변환 로직 개선
  - 위치: `resolveString` 메서드 (diff lines +8~+14)
  - 상세: `object` 타입에 대한 `JSON.stringify`, `null/undefined` 처리 개선이 중복 라벨 disambiguation과 무관하게 포함됨. 기존 `String(result ?? '')` 대비 동작이 변경될 수 있음.
  - 제안: 별도 PR로 분리하거나, 이 변경이 의도된 범위에 포함됨을 명시할 것

- **[INFO]** `node-settings-panel.tsx` - `useMemo` 내 `useEditorStore.getState()` 직접 호출
  - 위치: `isDuplicateLabel` useMemo (line ~130)
  - 상세: 중복 라벨 감지 기능은 범위 내이나, useMemo 안에서 store state를 직접 읽는 방식은 반응성을 보장하지 않음. `useEditorStore(s => s.nodes)` 훅으로 읽어야 리렌더링 시 갱신됨. 기존 컴포넌트 최상단에 이미 `useEditorStore((s) => s.nodes)`로 노드를 읽는 코드가 있는데, 그것을 활용하지 않고 `getState()`를 쓰는 것은 불필요한 패턴.
  - 제안: `const nodes = useEditorStore((s) => s.nodes)` 훅 결과를 useMemo dependency로 전달

- **[INFO]** `use-expression-context.test.ts` - mock 방식 변경 (스펙 외 영향)
  - 위치: `vi.mock("@workflow/expression-engine", ...)` 블록
  - 상세: `importOriginal`을 사용하는 방식으로 변경된 것은 `buildDisambiguatedKeys`를 실제 구현으로 사용하기 위한 것으로 범위 내 변경임. 기술적으로 타당하나, 기존 테스트들도 실제 함수에 의존하게 되어 테스트 격리도가 낮아짐.
  - 제안: 허용 가능하나 의도임을 주석으로 명시 권장

- **[INFO]** `variable-picker.tsx` - 표시 로직의 불필요한 조건
  - 위치: `{node.resolvedKey !== node.label ? node.resolvedKey : node.label}` (line ~212)
  - 상세: 이 조건식은 항상 `node.resolvedKey`를 표시하는 것과 동일함. `node.resolvedKey !== node.label`이면 `node.resolvedKey`, 아니면 `node.label`인데, `node.label === node.resolvedKey`인 경우 둘 다 동일한 값이므로 그냥 `{node.resolvedKey}`로 써도 무방.
  - 제안: `{node.resolvedKey}`로 단순화

### 요약

전체 변경사항은 "노드 라벨 유니크 정책 + 중복 라벨 자동 disambiguation + UUID 폴백" 기능 구현이라는 하나의 명확한 목적을 향해 일관되게 구성되어 있으며, 범위를 크게 벗어나는 변경은 없다. 다만 `expression-resolver.service.ts`의 mixed text 강제 변환 로직 개선은 직접 관련 없는 동작 변경을 포함하고, `node-settings-panel.tsx`의 `useMemo` 내 `getState()` 직접 호출은 반응성 버그 가능성이 있으며, `variable-picker.tsx`의 조건식은 불필요한 복잡성을 추가하는 사소한 코드 품질 이슈다. 이 세 가지는 범위 초과보다는 구현 품질 이슈에 해당하며, 기능 자체의 범위는 적절하게 유지되고 있다.

### 위험도
LOW