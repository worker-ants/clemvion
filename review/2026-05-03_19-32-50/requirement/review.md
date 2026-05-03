### 발견사항

---

**[INFO]** Spec JSON 예제 미갱신
- 위치: `spec/4-nodes/3-ai-nodes.md` — `_turnDebugHistory` JSON 예시 블록
- 상세: 텍스트 설명("각 turn 항목에 `ragSources` / `ragDiagnostics` 가 함께 채워진다")은 추가되었으나, 바로 위에 있는 JSON 예시 코드에는 두 필드가 빠져 있다. 문서를 스키마 레퍼런스로 참조하는 독자가 혼동할 수 있다.
- 제안: `_turnDebugHistory` JSON 예시에 `"ragSources": [], "ragDiagnostics": null` 필드를 추가

---

**[WARNING]** `turnRefIndex` Map 매 렌더마다 새로 생성
- 위치: `result-detail.tsx` — `ResultDetail` 함수 내 `const turnRefIndex = new Map<number, RagSource[]>(...)`
- 상세: `aiMetadata`도 동일 렌더에서 새로 계산되므로 현재 동작 오류는 없지만, `ConversationInspector`에 prop으로 전달될 때 자식 컴포넌트의 불필요한 리렌더 트리거 가능성이 있다. 기능적 오류는 아니나 레퍼런스 동일성이 깨진다.
- 제안: `useMemo(() => new Map(...), [aiMetadata?.turnDebug])` 로 감싸기

---

**[WARNING]** References 탭 스크롤이 탭 재진입 시 미발동
- 위치: `result-detail.tsx` — `ReferencesTabContent` 내 `useEffect([highlightTurnIndex])`
- 상세: 사용자가 chip 클릭 → References 탭 이동 → 다른 탭 전환 → References 탭 수동 재진입 시, `highlightTurnIndex` 값이 바뀌지 않으므로 `useEffect` 가 재실행되지 않는다. 강조 테두리는 남지만 해당 항목으로의 자동 스크롤이 복원되지 않는다.
- 제안: 의존성 배열에 별도 `scrollKey` (counter) 를 포함하거나, `handleJumpToReferences` 호출 시마다 `highlightTurnIndex`를 일시 null → 재설정하여 effect 재트리거

---

**[INFO]** 초기 activeTab 상태와 에러 노드 간 미세 불일치
- 위치: `result-detail.tsx` — `useState<DetailTab>("preview")` + 렌더 중 `setActiveTab(result.error ? "error" : "preview")`
- 상세: 렌더 단계 `setState`(derived-state reset 패턴)로 실제 UI 노출 전에 수정되지만, React 가 두 번 렌더를 수행하는 구조다. 기능상 문제는 없으나 React 공식 권장 패턴(`useReducer` 또는 `key` prop 리셋)과 다르다.
- 제안: 개선 우선순위가 낮으나, `ResultDetail` 에 `key={result.nodeId}` 를 사용해 노드 변경 시 컴포넌트를 완전 리셋하는 방식으로 단순화 고려

---

**[INFO]** `readSingleTurnMeta` 의 불필요한 `await` 제거 — 정확한 수정
- 위치: `ai-agent.handler.spec.ts` L140
- 상세: 함수가 Promise를 반환하지 않으므로 `await` 제거가 올바르다. 기존 코드는 `await undefined` 였으므로 테스트 동작에는 영향 없었으나, 의도 오독 가능성을 제거한 명확한 수정.

---

**[INFO]** 단일턴 References chip 미노출은 설계 의도
- 위치: `conversation-inspector.tsx` — `ReferencesChip` 렌더 조건
- 상세: 단일턴은 `ConversationInspector` 를 사용하지 않으므로 chip 이 렌더될 컨텍스트가 없다. References 탭에서 `turnDebug[0]` 항목이 직접 노출되어 목적을 달성한다. 의도적 설계이나, 단일턴 결과를 리뷰할 때 chip 진입점이 없다는 점을 문서화해두면 향후 혼동 방지에 도움이 된다.

---

### 요약

요구사항("assistant 응답별 KB chunk를 References 탭 + Preview chip으로 노출")은 백엔드(turnRagAcc per-turn delta 수집 → turnDebug에 ragSources/ragDiagnostics 포함), 프론트엔드(extractTurnDebug 정규화 → ReferencesChip → References 탭 jump), 스펙 문서까지 일관되게 구현되어 있다. 단일턴/멀티턴 양 경로, legacy 페이로드 fallback, LLM이 KB를 호출하지 않는 경우(empty delta) 모두 테스트로 커버되어 기능 완전성은 높다. 발견된 문제는 References 탭 재진입 시 scroll 미복원(WARNING)과 turnRefIndex 메모이제이션 누락(Warning)이 주요 개선 포인트이며, spec JSON 예시 미갱신은 문서 일관성 차원의 정리가 필요하다.

### 위험도

**LOW**