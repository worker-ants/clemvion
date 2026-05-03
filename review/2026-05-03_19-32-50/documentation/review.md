## 발견사항

### [WARNING] `_turnDebugHistory` JSON 예시가 새 필드를 반영하지 않음
- **위치**: `spec/4-nodes/3-ai-nodes.md` — `_turnDebugHistory` 섹션 JSON 예시 블록
- **상세**: 본문(prose)과 표의 `meta.turnDebug` 행은 `ragSources?` / `ragDiagnostics?` 추가를 반영했으나, 바로 위에 있는 JSON 예시 코드 블록은 여전히 `turnIndex`, `llmCalls`, `totalDurationMs` 만 보여줌. 예시와 설명이 불일치해 처음 읽는 독자에게 혼란을 줄 수 있음.
- **제안**: JSON 예시에 주석(`// optional`) 처리한 `ragSources` / `ragDiagnostics` 필드를 추가해 선택적 존재를 명확히 표시.

### [WARNING] `useState("preview")` 초기값이 즉시 override되는 패턴이 문서화되지 않음
- **위치**: `result-detail.tsx` — `ResultDetail` 함수 내 `activeTab` 상태 선언부
- **상세**: `useState<DetailTab>("preview")` 로 초기화하지만, 바로 아래 render-phase 조건문(`if (result && activeTabNodeId !== result.nodeId)`)이 첫 렌더에서 즉시 `result.error ? "error" : "preview"` 로 덮어씀. 초기값이 실질적으로 쓰이지 않는데 왜 `"preview"` 인지 코드만 봐서는 파악하기 어려움.
- **제안**: 선언 위에 "초기값은 placeholder — 첫 렌더에서 아래 노드 변경 감지 블록이 즉시 재설정한다" 는 한 줄 주석 추가.

### [INFO] `extractTurnDebug` 공개 API의 JSDoc이 반환 타입 범위를 명시하지 않음
- **위치**: `output-shape.ts` — `extractTurnDebug` 함수
- **상세**: JSDoc이 "drops llmCalls / totalDurationMs"라고 명시한 것은 좋음. 다만 `ragSources` / `ragDiagnostics` 가 없는 레거시 항목에 대해 각각 `[]` / `null` 로 기본값 처리함을 JSDoc에서 언급하지만, `turnIndex`가 없으면 항목 자체를 skip한다는 동작은 본문에만 있고 JSDoc에는 빠져 있음. 사용 측이 오해할 여지가 있음.
- **제안**: JSDoc에 "entries without a numeric `turnIndex` are silently dropped" 한 줄 추가.

### [INFO] `ReferencesChip` 컴포넌트 JSDoc이 `compact` prop의 시각적 차이를 설명하지 않음
- **위치**: `conversation-inspector.tsx` — `ReferencesChip` 컴포넌트 JSDoc
- **상세**: `sources`, `onClick`, `compact` 세 prop 중 `compact`만 JSDoc에 언급이 없음. `compact` 여부에 따라 padding/font-weight가 달라지는데 caller 입장에서 언제 `compact`를 써야 하는지 파악하려면 구현을 직접 읽어야 함.
- **제안**: JSDoc에 "compact: SummaryView 의 인라인 버블용 (padding 축소, font-weight 생략)" 한 줄 추가.

### [INFO] 스펙 문서 두 곳의 변경이 일관되게 반영됨 (긍정 관찰)
- **위치**: `spec/4-nodes/3-ai-nodes.md`, `spec/5-system/9-rag-search.md`
- **상세**: 구현 변경(`turnDebug[].ragSources` 추가)에 맞춰 두 스펙 파일 모두 적절히 갱신됨. "turn delta의 합 = 전체 누적" 불변식 명시는 특히 유용함.

---

## 요약

전반적으로 문서화 품질이 높다. 새로 추가된 공개 API(`extractTurnDebug`, `TurnDebugEntry`, `ReferencesChip`)는 모두 JSDoc을 갖추고, 스펙 문서도 구현과 동기화되었다. 주된 리스크는 `spec/4-nodes/3-ai-nodes.md`의 `_turnDebugHistory` JSON 예시가 새 선택적 필드를 반영하지 않아 스펙을 레퍼런스로 쓰는 개발자가 스키마를 오해할 수 있다는 점이며, 이는 텍스트 수준 수정으로 즉시 해결 가능하다.

## 위험도

**LOW**