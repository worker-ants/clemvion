# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — React 렌더 경로의 미메모이제이션과 신규 UI 컴포넌트 테스트 공백이 주요 리스크이며, 기능 동작 자체는 전반적으로 건전하다.

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance / Maintainability / Concurrency | **렌더 중 setState 3회 직접 호출** — `setActiveTabNodeId`, `setActiveTab`, `setHighlightTurnIndex`를 render body에서 직접 호출해 노드 전환 시 여분 렌더 사이클 발생. React Strict Mode·Concurrent Mode에서 이중 실행 위험 | `result-detail.tsx` `ResultDetail` 함수 본문 | `useEffect(() => { ... }, [result?.nodeId])` 로 이전하거나, `<NodeDetailTabs key={result.nodeId} />` 를 사용해 노드 변경 시 상태 자동 리셋 |
| 2 | Performance / Architecture | **`aiMetadata` / `turnRefIndex` 미메모이제이션** — `extractAiMetadata()`와 `new Map(turnDebug.map(...))` 이 매 렌더마다 실행되어 WebSocket 메시지·탭 클릭 등 빈번한 상호작용 시 수십~수백 개 객체 반복 생성 | `result-detail.tsx` `ResultDetail` 렌더 함수 내 | `useMemo(() => extractAiMetadata(result.outputData), [result.outputData])` 및 `useMemo(() => new Map(...), [aiMetadata])` 로 감싸기 |
| 3 | Architecture | **듀얼 어큐뮬레이터 동기화 불변식 — 컴파일러 미보호** — `ragAcc` / `turnRagAcc` 병렬 push 4개소에서 "turn delta 합 = 노드 전체 누적" 불변식이 호출자 규율로만 지켜짐. `pushSources` / `pushDiagnostic` 을 한쪽만 빠뜨려도 컴파일 에러 없이 조용히 깨짐 | `ai-agent.handler.ts` ~L314, ~L316, ~L664, ~L666 | `RagAccumulatorGroup` (또는 `pushToAllAccs` helper) 도입해 push를 원자적으로 만들기 |
| 4 | Testing | **`ReferencesChip` 컴포넌트 단위 테스트 없음** — 문서명 중복 제거(`Set`)와 2개 초과 시 `+N` 축약 로직이 있으나 검증 없음. 동일 문서명 반복 시 `extra` 계산 오류 edge case 미확인 | `conversation-inspector.tsx` `ReferencesChip` | `sources 0개 → null`, `3개 → 2개 + +1`, `중복 documentName → dedup 후 1개` 케이스 추가 |
| 5 | Testing | **`ReferencesTabContent` scroll/highlight `useEffect` 테스트 없음** — `highlightTurnIndex` 변경 시 `scrollIntoView` 호출 경로 및 존재하지 않는 turnIndex 접근 시 동작 미검증 | `result-detail.tsx` `ReferencesTabContent` | `scrollIntoView` mock + `highlightTurnIndex` prop 변경 시나리오 테스트. 없는 turnIndex → 조용히 통과 케이스 포함 |
| 6 | Testing | **단일턴 no-KB 경로 `turnDebug[0]` 미검증** — KB 호출이 없을 때 `turnDebug[0].ragSources === []`, `ragDiagnostics.attempted === false` 검증 없음. 멀티턴 동일 케이스는 추가됐으나 단일턴은 누락 | `ai-agent.handler.spec.ts` | `"emits turnDebug[0] with empty ragSources when LLM responds directly"` 케이스 추가 |
| 7 | Testing | **`turnRefIndex` Map 생성 로직 및 `handleJumpToReferences` 미검증** — chip 클릭 → `activeTab === "references"` 상태 전이 통합 테스트 없음 | `result-detail.tsx` | `turnDebug` 데이터로 렌더 후 chip 클릭 → 탭 전환 통합 테스트 추가 |
| 8 | Security | **KB 청크 내용이 `turnDebug` 경로로 추가 노출** — 기존 `meta.ragSources` 외에 `meta.turnDebug[].ragSources`로 청크 미리보기가 turn 단위 복제되어 노출 경로 증가 | `ai-agent.handler.ts` L291, L419, L626, L731 | `turnDebug` 포함 응답 API 전반에 워크플로우 소유자 권한 검증이 일관 적용되는지 integration/E2E 레벨 확인 |
| 9 | Security | **LLM 제어 `query` 문자열이 검색 서비스에 그대로 전달** — 타입 체크(`typeof === 'string'`) 외 내용 무결성 검증 없이 `ragSearchService.search()` 로 전달. `RagSearchService` 내부에 full-text search·동적 SQL 포함 시 위험 증가 | `kb-tool-provider.ts` `parseKbArgs()` / `execute()` | `parseKbArgs`에 `query` 길이 상한(예: 2,000자) 추가. `RagSearchService.search()` 내부에서 임베딩 생성에만 사용되는지 확인 |
| 10 | Scope / UX | **`RagReferencesSection`을 Output·Meta 탭에서 제거** — 기존 사용자가 Output 탭에서 확인하던 RAG 참조 정보가 References 탭으로만 이동되어 기존 워크플로 파괴 | `result-detail.tsx` `OutputTabContent`, `MetaTabContent` | 의도된 변경이라면 스펙에 명시. 아니라면 References 탭 추가 + Output 탭 기존 섹션 유지 방식으로 변경 |
| 11 | Maintainability | **`SummaryView`의 이중 non-null assertion (`!`)** — 외부 조건으로 안전이 보장되나, TypeScript 타입 체크를 침묵시켜 리팩터링 시 컴파일러 경고 누락 위험. 같은 파일의 `SelectedItemDetail`은 `?? []` 패턴 사용으로 스타일 불일치 | `conversation-inspector.tsx` `SummaryView` 렌더 내 `turnRefIndex!.get(item.turnIndex)!` | `const sources = turnRefIndex?.get(item.turnIndex) ?? []` 로 명시적 변수로 좁혀 non-null assertion 제거 |
| 12 | API Contract | **`NodeDetailTabs` required props 4개 추가** — `activeTab`, `onActiveTabChange`, `highlightTurnIndex`, `aiMetadata` 내부 컴포넌트 API breaking change. 현재 유일한 호출처는 갱신 완료되었으나 테스트·스토리북 등 별도 render 코드가 있을 경우 타입 에러 | `result-detail.tsx` `NodeDetailTabsProps` | 다른 render 코드(테스트, 스토리북) 존재 여부 확인. 있을 경우 optional 또는 기본값 제공 |
| 13 | Requirement | **References 탭 재진입 시 스크롤 미복원** — chip 클릭 → References 탭 이동 → 다른 탭 전환 → References 탭 수동 재진입 시 `highlightTurnIndex` 값이 불변이라 `useEffect` 재실행 안 됨. 강조 테두리는 남지만 스크롤 미복원 | `result-detail.tsx` `ReferencesTabContent` `useEffect([highlightTurnIndex])` | 의존성에 별도 `scrollKey` (counter) 포함하거나 `handleJumpToReferences` 호출 시 `highlightTurnIndex`를 null → 재설정으로 effect 재트리거 |
| 14 | Documentation | **`spec/4-nodes/3-ai-nodes.md` JSON 예시 미갱신** — 본문·표는 `ragSources?` / `ragDiagnostics?` 반영했으나, `_turnDebugHistory` JSON 예시 코드 블록에는 두 필드 누락 | `spec/4-nodes/3-ai-nodes.md` `_turnDebugHistory` 섹션 | JSON 예시에 `// optional` 주석 처리한 `ragSources` / `ragDiagnostics` 필드 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | **단일턴 `ragAcc` / `turnRagAcc` 이중 누적** — 단일턴 경로에서 두 accumulator가 항상 동일한 값을 보유하며 별도 배열을 반환해 불필요한 메모리 중복 | `ai-agent.handler.ts` ~L195 | `RagAccumulatorGroup` 캡슐화 시 자연 해소. 현재 규모에서는 허용 범위 |
| 2 | Architecture | **3단계 prop drilling** — `turnRefIndex` / `onJumpToReferences` 가 `result-detail.tsx` → `conversation-inspector.tsx` → `SelectedItemDetail` / `SummaryView` 까지 전달 | `result-detail.tsx`, `conversation-inspector.tsx` | 컴포넌트 트리가 더 깊어지면 React Context 또는 slot 패턴 전환 고려 |
| 3 | Architecture | **`NodeDetailTabs` 기본 탭 결정 로직이 부모(`ResultDetail`)로 이동** — `NodeDetailTabs`가 자신의 기본값을 알지 못함 | `result-detail.tsx` ~L836 | `defaultTab` prop을 받아 내부에서 초기화하는 방식이 더 응집도 높음 |
| 4 | Security | **`sanitizeKbId` 다대일 충돌 가능성** — `a-b`와 `a_b` 모두 `a_b`로 sanitize되어 이론적으로 다른 KB 검색 위험. UUID 기반 ID는 현실적 위험 낮음 | `kb-tool-provider.ts` `sanitizeKbId()` | UUID 구분자 처리 시 정확히 1건만 매칭되는지 검증하거나 충돌 시 warn 로그 출력 |
| 5 | Security | **KB tool 이름이 에러 메시지에 그대로 반영** — LLM 응답에서 온 `call.name`이 다음 LLM 호출 context에 포함되어 반사형 정보 노출 | `kb-tool-provider.ts` L157-160 | `error: 'unknown_kb_tool'` 고정 코드만 반환, `call.name`은 로그에만 기록 |
| 6 | Maintainability | **`ReferencesChip` 매직 넘버 `2`** — "최대 2개 inline 노출" 규칙이 리터럴로 박혀 있음 | `conversation-inspector.tsx` `const shown = docNames.slice(0, 2)` | `const MAX_VISIBLE_DOC_NAMES = 2` 상수 선언 |
| 7 | Maintainability | **`refMap` stale ref cleanup 없음** — 턴 항목 제거 시 `refMap`의 해당 키가 남아 긴 대화에서 의미 없는 entry 누적 | `result-detail.tsx` `ReferencesTabContent` `useRef(new Map())` | `ref={(el) => { if (el) refMap.current.set(...); else refMap.current.delete(entry.turnIndex); }}` |
| 8 | Maintainability | **`turnRagAcc` 초기화·누적 패턴이 single/multi-turn 양 경로에서 반복** — 현재 2회 복제는 허용 범위이나 세 번째 경로 추가 시 버그 온상 가능성 | `ai-agent.handler.ts` 싱글턴 경로·멀티턴 경로 | 현재 수준은 허용. 주석에 "동일 패턴, 의도적 복제" 한 줄 추가로 혼선 방지 |
| 9 | Performance | **`SummaryView`에서 Map 키 이중 조회** — 조건 평가 후 참 분기에서 `turnRefIndex.get()` 재호출. O(1)이지만 가독성·중복 비용 | `conversation-inspector.tsx` `SummaryView` | `const turnSources = turnRefIndex?.get(item.turnIndex)` 로 로컬 변수 캐싱 |
| 10 | Testing | **`extractTurnDebug`에서 `turnIndex: 0` edge case 미검증** — `0 == null`은 `false`이므로 코드는 정상이나 의도를 보여주는 테스트 부재 | `output-shape.test.ts` | `{ turnIndex: 0, ... }` 항목이 출력에 포함되는지 확인 케이스 추가 |
| 11 | Testing | **멀티턴 동일 턴 내 KB 복수 호출 시 `turnRagAcc` 누적 미검증** — LLM이 한 턴에서 `kb_*` tool을 2회 연속 호출하는 경로 커버 없음 | `ai-agent.handler.spec.ts` | 한 턴 안에서 두 번의 KB 호출이 `turnSources.length === 2`인지 확인 테스트 추가 |
| 12 | Database | **`KbToolProvider.execute()`에서 KB 메타 중복 조회** — `buildTools()`에서 이미 조회한 KB를 `execute()`에서 `findById()`로 재조회. 멀티턴 시 반복 발생 | `kb-tool-provider.ts` `execute()` | `buildTools()` 결과를 `Map<kbId, kb.name>` 형태로 캐시에 저장해 재사용 (현재 KB 수 소규모라 영향 낮음) |
| 13 | Documentation | **`extractTurnDebug` JSDoc에 `turnIndex` 없는 항목 skip 동작 미기재** | `output-shape.ts` `extractTurnDebug` | JSDoc에 "entries without a numeric `turnIndex` are silently dropped" 추가 |
| 14 | Documentation | **`ReferencesChip` `compact` prop 미문서화** — caller 입장에서 사용 시점 파악 불가 | `conversation-inspector.tsx` `ReferencesChip` JSDoc | `compact: SummaryView 의 인라인 버블용 (padding 축소)` 한 줄 추가 |
| 15 | Documentation | **`useState("preview")` 초기값이 첫 렌더에서 즉시 덮어써지는 패턴 미문서화** | `result-detail.tsx` `ResultDetail` `useState<DetailTab>("preview")` | 선언 위에 "초기값은 placeholder — 첫 렌더에서 노드 변경 감지 블록이 즉시 재설정" 한 줄 주석 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Performance | **MEDIUM** | aiMetadata/turnRefIndex 미메모이제이션 + 렌더 중 다중 setState |
| Testing | **MEDIUM** | ReferencesChip·ReferencesTabContent·단일턴 no-KB 등 신규 UI 컴포넌트 테스트 공백 |
| Security | **LOW** | KB 청크 추가 노출 경로, LLM query 검증 미흡 |
| Architecture | **LOW** | 듀얼 어큐뮬레이터 불변식 컴파일러 미보호, useMemo 누락 |
| Maintainability | **LOW** | 렌더 중 setState anti-pattern, 이중 `!` assertion |
| Scope | **LOW** | Output/Meta 탭 RagReferencesSection 제거 의도 불명 |
| Side Effect | **LOW** | turnRefIndex 매 렌더 재생성, AiMetadata 필수 필드 추가 |
| API Contract | **LOW** | NodeDetailTabs required props 추가, turnDebug additive 확장은 호환 |
| Requirement | **LOW** | References 탭 재진입 시 스크롤 미복원, spec JSON 예시 미갱신 |
| Documentation | **LOW** | JSON 예시 불일치, JSDoc 누락 일부 |
| Database | **LOW** | KB 메타 중복 조회 (기존 코드, 영향 낮음) |
| Concurrency | **NONE** | 동시성 안전성 양호 |
| Dependency | **NONE** | 외부 패키지 추가 없음, 내부 의존성 단방향 구조 |

---

## 발견 없는 에이전트

- **Dependency** — 신규 외부 패키지 없음, 내부 의존성 단방향 구조로 문제 없음
- **Concurrency** — `turnRagAcc` 함수 스코프 지역 생성으로 요청 간 공유 상태 없음, 비동기 흐름 안전

---

## 권장 조치사항

1. **[즉시] `aiMetadata` / `turnRefIndex` `useMemo` 적용** — `result-detail.tsx` 렌더 함수 내 `extractAiMetadata()`와 `new Map(turnDebug.map(...))` 을 `useMemo`로 감싸 매 렌더마다 발생하는 불필요한 객체 생성 제거 (WARNING #2)

2. **[즉시] 렌더 중 setState → `useEffect` 또는 `key` prop 리셋으로 교체** — `result-detail.tsx` 의 `if (result && activeTabNodeId !== result.nodeId) { setXxx(...) }` 블록을 `useEffect([result?.nodeId])` 또는 `<NodeDetailTabs key={result.nodeId} />` 패턴으로 교체 (WARNING #1)

3. **[단기] References 탭 재진입 스크롤 복원** — `handleJumpToReferences` 호출 시 `scrollKey` 카운터를 effect 의존성에 추가하거나 `highlightTurnIndex` null → 재설정 방식으로 effect 재트리거 보장 (WARNING #13)

4. **[단기] 신규 UI 컴포넌트 테스트 추가** — `ReferencesChip` (dedup·+N 로직), `ReferencesTabContent` (scroll·highlight effect), 단일턴 no-KB `turnDebug[0]` 형태, chip 클릭 → 탭 전환 통합 시나리오 (WARNING #4, #5, #6, #7)

5. **[단기] spec JSON 예시 갱신** — `spec/4-nodes/3-ai-nodes.md` `_turnDebugHistory` JSON 예시에 `ragSources`/`ragDiagnostics` 선택 필드 추가 (WARNING #14)

6. **[단기] `SummaryView` 이중 non-null assertion 제거** — `const sources = turnRefIndex?.get(item.turnIndex) ?? []` 로 타입 안전하게 교체 (WARNING #11)

7. **[단기] Output·Meta 탭 `RagReferencesSection` 제거 의도 명시** — 의도된 UX 변경이라면 스펙 문서에 명시. 아니라면 기존 섹션 복원 후 References 탭 병행 제공 (WARNING #10)

8. **[중기] `RagAccumulatorGroup` 도입** — `ragAcc` / `turnRagAcc` 의 `pushSources` / `pushDiagnostic` 호출을 단일 진입점으로 묶어 4개소 동기화 불변식을 타입 시스템 수준으로 보호 (WARNING #3)

9. **[중기] LLM query 길이 상한 추가** — `parseKbArgs`에서 `query` 최대 길이(예: 2,000자) 검증 추가. `RagSearchService` 내부에 동적 SQL 없는지 재확인 (WARNING #9)

10. **[저우선] `RagAccumulatorGroup` 캡슐화 후 단일턴 이중 누적 정리**, `refMap` stale ref cleanup, `MAX_VISIBLE_DOC_NAMES` 상수화 등 코드 품질 개선 (INFO 항목들)