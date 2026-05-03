### 발견사항

- **[WARNING]** `result-detail.tsx` 렌더 중 상태 갱신 — React anti-pattern
  - 위치: `result-detail.tsx`, `ResultDetail` 함수 내 `if (result && activeTabNodeId !== result.nodeId) { setActiveTabNodeId(...) ... }`
  - 상세: 렌더 함수 body에서 직접 `setState`를 호출하는 방식은 React 공식 문서에서 명시적으로 금지하는 패턴이다. React Strict Mode에서 렌더가 두 번 실행되면 상태 초기화가 두 번 발생하고, concurrent mode에서 예상치 못한 tear가 생길 수 있다.
  - 제안: `useEffect(() => { if (result?.nodeId !== activeTabNodeId) { ... } }, [result?.nodeId])` 로 교체하거나, `key={result.nodeId}` 를 컴포넌트에 부여해 노드 변경 시 자동 마운트/언마운트로 상태를 리셋한다.

- **[WARNING]** `turnRefIndex` 매 렌더마다 새 `Map` 생성
  - 위치: `result-detail.tsx` — `const turnRefIndex = new Map<number, RagSource[]>(...)`
  - 상세: `aiMetadata` 계산 이후 곧바로 `Map`을 생성하는데, 이 객체는 렌더마다 새 참조를 가지므로 `ConversationInspector`가 `React.memo`나 props 비교를 하는 경우 불필요한 리렌더를 유발한다. 현재는 memo 없이 통과되지만, 이후 최적화 시 버그 원인이 된다.
  - 제안: `useMemo(() => new Map(...), [aiMetadata?.turnDebug])` 로 감싼다.

- **[WARNING]** `SummaryView`의 이중 non-null assertion (`!`)
  - 위치: `conversation-inspector.tsx` — `sources={turnRefIndex!.get(item.turnIndex)!}`
  - 상세: 외부 조건 `(turnRefIndex?.get(item.turnIndex)?.length ?? 0) > 0` 으로 안전이 보장되지만, TypeScript 타입 검사를 침묵시켜 리팩터링 시 조건식이 바뀌어도 컴파일러가 경고를 내지 않는다. 스타일 불일치도 있다 — 같은 파일의 `SelectedItemDetail`은 `turnRefIndex?.get(item.turnIndex) ?? []` 패턴으로 안전하게 처리한다.
  - 제안: 조건 블록 진입 전에 `const sources = turnRefIndex?.get(item.turnIndex) ?? []; if (sources.length === 0 || !onJumpToReferences) return null;` 처럼 명시적 변수로 좁혀서 non-null assertion 제거.

- **[INFO]** `ReferencesChip`의 매직 넘버 `2`
  - 위치: `conversation-inspector.tsx` — `const shown = docNames.slice(0, 2)`
  - 상세: "최대 2개 inline 노출" 규칙이 상수 없이 리터럴로 박혀 있어, 나중에 `3`으로 바꾸려면 코드를 읽고 의미를 추론해야 한다. JSDoc에는 명시되어 있지만 코드 자체는 말이 없다.
  - 제안: `const MAX_VISIBLE_DOC_NAMES = 2;` 상수를 컴포넌트 위에 선언.

- **[INFO]** `turnRagAcc` 초기화·누적 패턴이 single-turn / multi-turn 양쪽에서 반복
  - 위치: `ai-agent.handler.ts` — `new RagAccumulator(...)` + `pushSources` + `pushDiagnostic` 블록이 싱글턴 경로(line ~192)와 멀티턴 경로(line ~543)에서 동일하게 등장
  - 상세: 지금은 2회 복제이고 두 경로의 생명주기가 달라 추상화 비용이 더 크지만, 향후 세 번째 경로가 생기면 버그 온상이 될 수 있다.
  - 제안: 두 경로의 구조 차이가 크므로 현재 수준은 허용범위. 단, 주석에 "동일 패턴, 의도적 복제" 한 줄 추가로 후임 개발자 혼선 방지.

- **[INFO]** `ReferencesTabContent` 내 `refMap`이 `useRef(new Map())` 으로 초기화되지만 cleanup 없음
  - 위치: `result-detail.tsx` — `const refMap = useRef(new Map<number, HTMLLIElement | null>())`
  - 상세: 턴 항목이 제거되어도 `refMap`의 해당 키가 남아 stale ref를 보유하는 것은 메모리 누수보다는 스타일 문제지만, 동일 컴포넌트가 긴 대화를 표시하면 의미 없는 entry가 누적된다.
  - 제안: `ref={(el) => { if (el) refMap.current.set(...); else refMap.current.delete(entry.turnIndex); }}` 처럼 cleanup 처리 추가.

---

### 요약

전체 변경은 새로운 "turn-level KB delta" 노출 기능을 일관된 데이터 흐름(`RagAccumulator` → `turnDebug` → `extractTurnDebug` → `turnRefIndex` → `ReferencesChip`)으로 구현했으며, 기존 코드 스타일과 인터페이스 설계를 잘 따르고 있다. 가장 시급한 문제는 렌더 중 `setState`를 직접 호출하는 `result-detail.tsx`의 패턴으로, React 동시 모드나 Strict Mode에서 의도치 않은 동작을 유발할 수 있다. `turnRefIndex`의 `useMemo` 누락과 `SummaryView`의 이중 `!` assertion도 코드 안정성을 조금씩 깎는 요소다.

### 위험도

**LOW**