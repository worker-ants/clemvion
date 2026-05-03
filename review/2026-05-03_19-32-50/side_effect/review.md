## 발견사항

### [WARNING] `turnRefIndex` 매 렌더마다 새 Map 객체 생성
- **위치**: `result-detail.tsx` — `ResultDetail` 컴포넌트 render body
- **상세**: `const turnRefIndex = new Map<number, RagSource[]>(...)` 가 훅 없이 render body 에 놓여 있어 `ResultDetail` 이 렌더링될 때마다 새 참조가 생성됨. `ConversationInspector` 에 `turnRefIndex` prop 으로 전달되므로, `React.memo` 나 props 비교 최적화가 있어도 항상 re-render 발생.
- **제안**: `useMemo(() => new Map(...), [aiMetadata])` 로 감싸 참조 안정성 확보.

---

### [WARNING] `setState` 호출을 render body 안에서 직접 실행
- **위치**: `result-detail.tsx` — `ResultDetail` 함수 body (약 819~825 행)
```tsx
if (result && activeTabNodeId !== result.nodeId) {
  setActiveTabNodeId(...);
  setActiveTab(...);
  setHighlightTurnIndex(null);
}
```
- **상세**: React 공식 문서에서 "render 중 setState" 패턴은 허용하지만, 한 번에 3개의 setState 호출이 render body 에서 발생하면 여분 render cycle 이 발생하고 Strict Mode 에서 예상치 못한 이중 실행이 일어날 수 있음.
- **제안**: `useEffect(() => { ... }, [result?.nodeId])` 로 이전하거나 `useReducer` 로 하나의 dispatch 로 통합.

---

### [WARNING] `AiMetadata` 인터페이스 파괴적 변경 — TypeScript 컴파일 오류 위험
- **위치**: `output-shape.ts` — `AiMetadata` 인터페이스에 `turnDebug: TurnDebugEntry[]` 필드 추가
- **상세**: 인터페이스에 필수 필드가 추가됐으므로, `AiMetadata` 타입으로 객체를 직접 생성하거나 스프레드하는 코드가 있다면 TypeScript 오류 발생. 테스트 파일에서 인라인으로 기대값을 작성한 부분들은 모두 `turnDebug: []` 를 추가해 대응했으나, 다른 파일에 동일 패턴이 있을 경우 컴파일 실패.
- **제안**: 단기적으로 `turnDebug?: TurnDebugEntry[]` 선택 필드로 만들고, 접근 시 `?? []` fallback 사용. 또는 코드베이스 전체에서 `AiMetadata` 객체 직접 생성 여부를 grep 확인.

---

### [WARNING] `RagReferencesSection` Output/Meta 탭에서 제거 — 기존 사용자 행동 파괴
- **위치**: `result-detail.tsx` — `OutputTabContent`, `MetaTabContent` 에서 `RagReferencesSection` 블록 삭제
- **상세**: 이전 버전에서는 Output 탭과 Meta 탭 양쪽에서 RAG references 를 볼 수 있었는데, 이번 변경으로 References 전용 탭으로만 이동됨. KB 를 사용하지 않는 노드(AI Agent 외 노드)는 References 탭이 나타나지 않으므로 문제없지만, KB 사용 이력을 Output 탭에서 확인하던 기존 사용자 워크플로가 깨짐.
- **제안**: 의도된 변경이라면 스펙 문서에 "Output 탭에서 RAG references 섹션 제거" 를 명시. 아니라면 References 탭과 Output 탭 양쪽에 모두 유지.

---

### [INFO] `e.stopPropagation()` 이 parent click 이벤트를 막음 — 의도된 동작
- **위치**: `conversation-inspector.tsx` — `ReferencesChip` 컴포넌트
- **상세**: `SummaryView` 의 `div[role="button"]` 안에서 chip 을 클릭하면 `stopPropagation` 이 메시지 선택 이벤트를 막음. References 탭으로 점프하면서 동시에 메시지 선택이 발생하지 않도록 의도된 처리. 동작 자체는 올바름.
- **제안**: 해당 동작을 주석이나 테스트로 명시해두면 향후 유지보수 시 혼란 방지.

---

### [INFO] `extractTurnDebug` 신규 public export — API 표면 확장
- **위치**: `output-shape.ts`
- **상세**: 순수 함수(pure function) 이며 외부 상태를 읽거나 쓰지 않음. legacy payload 에 대해 빈 배열 반환, null/undefined/비배열 입력에 대해 방어 처리 완비. 부작용 없음.

---

### [INFO] 테스트의 `await readSingleTurnMeta(handler)` → `readSingleTurnMeta(handler)` 변경
- **위치**: `ai-agent.handler.spec.ts` L140
- **상세**: `readSingleTurnMeta` 는 Promise 가 아닌 함수를 반환하므로 `await` 를 붙여도 기능은 동일 (`await non-Promise` = 원본 값 반환). 의미적으로 동등하지만 정확성을 높인 올바른 수정.

---

## 요약

이번 변경의 핵심(턴별 KB delta 를 `turnDebug` 에 노출 + References 탭 신설)은 구조적으로 건전하며, `turnRagAcc` 의 스코프가 턴 단위로 격리되어 있고 기존 `ragAcc` 와 병렬 누적 로직이 올바르게 유지된다. 다만 `turnRefIndex` 의 매 렌더 재생성과 render body 내 다중 `setState` 호출은 성능 저하나 여분 렌더링을 유발할 수 있고, `AiMetadata` 인터페이스의 필수 필드 추가는 직접 생성 코드에서 컴파일 오류를 일으킬 수 있어 주의가 필요하다.

## 위험도

**LOW** — 기능 동작은 정상이나, 성능 최적화 미흡(Map 재생성)과 인터페이스 파괴적 변경(컴파일 타임 문제, 런타임은 영향 없음)이 존재.