### 발견사항

- **[INFO]** `fillCandidates`의 `Promise.all` 병렬 조회
  - 위치: `candidate-lookup.service.ts` — `fillCandidates` 메서드
  - 상세: `pending` 배열의 각 field에 대해 `Promise.all`로 동시 조회를 수행한다. `kb-selector`와 `mcp-server-selector`가 동시에 pending인 경우, `lookupKnowledgeBases`와 `lookupMcpServers`가 병렬로 실행되어 각각 DB 커넥션을 점유한다. 두 조회는 독립적인 읽기 연산이므로 경쟁 조건은 없다. 의도된 설계이며 현재 패턴은 적절하다.
  - 제안: 특별한 수정 불필요. 다만 매우 많은 위젯이 동시에 pending될 경우 커넥션 풀 압박 가능성이 있으나, 실제 운용 환경에서 widget 종류가 5개로 제한되므로 문제없음.

- **[INFO]** React `useEffect` + `confirmed` 상태 동기화의 비원자성
  - 위치: `candidate-picker.tsx` — `useEffect(() => { setConfirmed(isFilled(currentValue)); }, [currentValue])`
  - 상세: React 18 Concurrent Mode에서 `currentValue`가 변경되는 동안 컴포넌트가 중간 렌더를 거칠 수 있어 `confirmed`와 `currentValue`가 한 프레임 동안 불일치할 수 있다. 단, `setConfirmed`는 idempotent하며 최종 상태는 항상 일치한다. 표준 React 파생 상태 패턴으로, 허용 가능한 수준이다.
  - 제안: 수정 불필요. 단, 더 엄격하게 처리하려면 `useMemo`로 `confirmed`를 `currentValue`에서 직접 파생시킬 수 있다: `const confirmed = useMemo(() => isFilled(currentValue), [currentValue])`.

- **[INFO]** multi 모드 `onToggle`의 함수형 setState 사용 — 올바름
  - 위치: `candidate-picker.tsx` — `onToggle` 함수
  - 상세: `setSelectedIds((prev) => ...)` 형태의 함수형 업데이트를 사용하여 stale closure 없이 이전 상태를 정확히 참조한다. 빠른 연속 클릭에서도 안전하다.
  - 제안: 현재 구현이 올바름. 추가 조치 불필요.

- **[INFO]** `confirmed=false` 복귀 시 `selectedIds` 미초기화
  - 위치: `candidate-picker.tsx` — `useEffect`
  - 상세: 외부에서 `currentValue`가 빈 값으로 변경되어(`Undo/Redo`) `confirmed`가 false로 복귀할 때, `selectedIds`는 이전 선택 상태를 그대로 유지한다. 동시성 버그는 아니나 Undo 후 체크박스가 이전 선택 상태를 기억하는 UX 불일치가 발생할 수 있다.
  - 제안: Undo 복귀 시 선택 초기화가 필요하다면 `useEffect`에 `setSelectedIds([])` 및 `setSelectedId("")`를 추가한다.

---

### 요약

이번 변경은 `mcp-server-selector` 위젯 추가와 multi-select 지원을 위한 기능 확장이다. 동시성 관점에서 핵심 변경인 `lookupMcpServers`는 단순 읽기 연산이며, `fillCandidates`의 `Promise.all` 패턴은 독립적 읽기들의 병렬화로 경쟁 조건이 없다. React 컴포넌트의 상태 관리는 함수형 `setState`와 표준 `useEffect` 동기화 패턴을 올바르게 사용하고 있다. 전체적으로 동시성 관련 심각한 결함은 없으며, 발견된 항목들은 모두 INFO 수준의 관찰사항이다.

### 위험도

**LOW**