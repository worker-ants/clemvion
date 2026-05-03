### 발견사항

---

**[WARNING] `ReferencesChip` 컴포넌트 테스트 없음**
- 위치: `conversation-inspector.tsx` — `ReferencesChip` 함수
- 상세: 문서명 중복 제거(`Array.from(new Set(...))`)와 2개 초과 시 `+N` 축약 로직이 있으나 단위 테스트 없음. 동일 문서명이 여러 소스에 반복될 때 `docNames.length`가 줄어 `extra` 계산이 달라지는 edge case가 검증되지 않음.
- 제안: Vitest + React Testing Library로 `sources 0개 → null 렌더`, `소스 3개 → 2개 표시 + +1`, `중복 documentName → dedup 후 1개` 케이스 추가.

---

**[WARNING] `ReferencesTabContent` — scroll/highlight `useEffect` 테스트 없음**
- 위치: `result-detail.tsx` — `ReferencesTabContent`, `highlightTurnIndex` 변경 시 `scrollIntoView` 호출
- 상세: `useEffect`가 `refMap`에서 DOM 요소를 찾아 `scrollIntoView`를 호출하는 경로가 완전히 미검증. `highlightTurnIndex`가 존재하지 않는 turnIndex를 가리킬 때의 무효 접근도 확인 안 됨.
- 제안: `scrollIntoView` mock + `highlightTurnIndex` prop 변경 시나리오 단위 테스트. "없는 turnIndex → 에러 없이 조용히 통과" 케이스 포함.

---

**[WARNING] single-turn에서 LLM이 KB를 호출하지 않는 경우 `turnDebug[0]` 미검증**
- 위치: `ai-agent.handler.spec.ts` — `single-turn turnDebug ragSources` describe
- 상세: KB 호출이 있는 single-turn만 테스트됨. LLM이 small-talk 응답을 바로 반환해 `turnRagAcc`에 push가 없을 때 `turnDebug[0].ragSources === []`, `ragDiagnostics.attempted === false`임을 직접 검증하는 테스트가 없음. multi-turn의 동일 케이스는 추가됐음(`emits turnDebug with empty ragSources`).
- 제안: `single-turn turnDebug ragSources` describe에 `"emits turnDebug[0] with empty ragSources when LLM responds directly"` 케이스 추가.

---

**[WARNING] `turnRefIndex` Map 생성 로직 및 `handleJumpToReferences` 미검증**
- 위치: `result-detail.tsx` — `ResultDetail` 컴포넌트 내 `turnRefIndex` 계산, `handleJumpToReferences`
- 상세: `aiMetadata?.turnDebug.map(t => [t.turnIndex, t.ragSources])`로 Map을 생성하는 로직이 렌더 경로에 인라인으로 있어 별도 단위 테스트 없음. `handleJumpToReferences` 호출 시 `activeTab`이 `"references"`로, `highlightTurnIndex`가 올바른 값으로 전환되는지 검증 안 됨.
- 제안: `turnDebug` 데이터를 가진 `aiMetadata`로 `ResultDetail`을 렌더한 뒤 chip 클릭 → `activeTab === "references"` 상태 전이 통합 테스트 추가.

---

**[INFO] `extractTurnDebug`에서 `turnIndex: 0` edge case 미검증**
- 위치: `output-shape.test.ts` — `extractTurnDebug` describe
- 상세: `if (turnIndex == null) continue` 조건에서 `0 == null`은 `false`이므로 0이 유효하게 통과하지만, 이 케이스를 명시적으로 테스트하지 않음. 코드는 정상이지만 의도를 보여주는 테스트가 있으면 회귀 방어에 유리.
- 제안: `{ turnIndex: 0, ragSources: [], ragDiagnostics: null }` 항목이 출력에 포함되는지 확인하는 케이스 1개 추가.

---

**[INFO] multi-turn에서 동일 턴 내 KB 복수 호출 시 `turnRagAcc` 누적 미검증**
- 위치: `ai-agent.handler.spec.ts`
- 상세: 한 턴에서 LLM이 `kb_*` tool을 2번 연속 호출(refined query 재호출)하면 `turnRagAcc`에 두 차례 push가 일어나는데 이 경로의 `turnDebug[n].ragSources` 길이가 검증되지 않음.
- 제안: 한 턴 안에서 두 번의 KB 호출이 `turnSources.length === 2`인지 확인하는 테스트 추가.

---

**[INFO] `readSingleTurnMeta` - 잘못된 `await` 제거 (lint 이상 없으나 리스크)**
- 위치: `ai-agent.handler.spec.ts` line 140
- 상세: `(await readSingleTurnMeta(handler))` → `readSingleTurnMeta(handler)`로 수정. `await`가 non-Promise에 붙어있었으므로 동작은 동일하지만, TypeScript strict 설정에 따라 컴파일 경고 여부가 달라짐. 수정 자체는 맞지만, 이를 잡아주는 `no-floating-promises` 또는 타입 수준 검증 설정 여부를 확인 권장.

---

### 요약

backend 테스트(`ai-agent.handler.spec.ts`)는 multi-turn KB delta 및 no-KB turn 케이스를 신규 추가했고, frontend utility(`extractTurnDebug`)는 경계값·legacy fallback까지 고르게 검증되어 핵심 데이터 변환 로직의 커버리지는 양호하다. 그러나 `ReferencesChip`, `ReferencesTabContent`, `NodeAggregateRagSummary` 등 신규 UI 컴포넌트에 대한 단위 테스트가 전무하고, `handleJumpToReferences`로 시작되는 탭 전환·스크롤 상태 흐름이 미검증 상태다. single-turn no-KB 경로의 `turnDebug[0]` 형태도 명시적 테스트가 빠져 있어, 실수로 `ragSources` 필드가 누락되거나 `attempted` 값이 잘못 설정되어도 현재 테스트로는 감지되지 않는다.

### 위험도

**MEDIUM**