# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** - 모듈 레벨 `/g` 정규식 `lastIndex` 공유 상태가 scope 검증 오동작을 유발할 수 있으며, 테스트 커버리지 공백과 UI 색상 불일치가 존재함

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 버그 | 모듈 레벨 `/g` 플래그 정규식의 `lastIndex` 공유 상태 — `hasItem === true`일 때 `ITEM_ROOT_RE`·`ITEM_INDEX_ROOT_RE`의 리셋이 건너뛰어져 연속 호출 시 scope 검사 오탐 발생. React 18 concurrent mode에서도 위험 | `validate-scope.ts` — `LOOP_ROOT_RE`, `ITEM_ROOT_RE`, `ITEM_INDEX_ROOT_RE` | `g` 플래그를 제거하거나, 정규식을 함수 내부 로컬 변수로 이동. 또는 `lastIndex = 0` 리셋을 `hasItem` 분기 바깥으로 이동 |
| 2 | UI/UX | scope 에러(amber)임에도 `hasError = !!syntaxError \|\| scopeErrors.length > 0`로 `ExpressionHighlight`에 빨간 배경(`bg-red-500/15`)이 적용되어 border(amber)·메시지(amber)와 시각적 불일치 | `expression-input.tsx` — `hasError` 변수 및 `<ExpressionHighlight>` | `ExpressionHighlight`에 `hasWarning` prop 추가, 또는 syntax-only 에러와 scope 에러를 별도 prop으로 분리 |
| 3 | 테스트 누락 | `expression-autocomplete.tsx` 테스트 파일 없음 — 키보드 네비게이션(ArrowUp/Down/Enter/Tab), `scrollIntoView`, 20개 슬라이싱 등 인터랙션 로직 미검증 | `expression-autocomplete.tsx` | `@testing-library/react`로 키보드 이벤트, 선택 인덱스 변경, 항목 클릭 테스트 추가 |
| 4 | 테스트 누락 | `expression-highlight.tsx` 테스트 파일 없음 — `{{ }}` 블록 파싱(닫히지 않은 블록, 인접 블록, 특수문자) 미검증 | `expression-highlight.tsx` | 파싱 로직을 순수 함수로 분리하거나 컴포넌트 렌더링 단언 테스트 추가 |
| 5 | 테스트 누락 | `variable-picker.tsx`의 containerScope 필터링 UI 레벨 미검증 — `$loop`·`$item`·`$itemIndex`가 스코프에 따라 숨겨지는 동작 | `variable-picker.tsx` diff (scopedBuiltIns 필터) | VariablePicker에 `containerScope` 조합별 렌더링 테스트 추가 |
| 6 | 테스트 누락 | syntax 에러 + scope 에러 동시 발생 시 우선순위 동작 미검증. 스코프 내 유효한 `$loop` 참조가 경고를 생성하지 않는 긍정 케이스도 없음 | `expression-input.test.tsx` | syntax 에러 우선 케이스 및 유효 scope 참조 케이스 테스트 추가 |
| 7 | 테스트 누락 | 사이클 테스트(`A→B→A`)에서 `fromA.has("A")` 가 `false`인지(자기 자신이 결과에 포함되지 않아야 함) 검증 없음 | `reachable-nodes.test.ts:71-76` | `expect(fromA.has("A")).toBe(false)` 단언 추가 |
| 8 | 테스트 누락 | `selectedNodeId`가 `loop`/`foreach` 타입 자신일 때 `containerScope` 결과 미검증 | `use-expression-context.test.ts` containerScope 블록 | 루프 노드를 선택했을 때 `{ hasLoop: false, hasItem: false }`임을 검증하는 테스트 추가 |
| 9 | 아키텍처 | 컨테이너 스코프 변수 게이팅 로직(`$loop`/`$item`/`$itemIndex` 소속 조건)이 `use-expression-suggestions.ts`, `variable-picker.tsx`, `validate-scope.ts` 세 곳에 하드코딩으로 중복 — 새 컨테이너 스코프 변수 추가 시 다중 파일 수정 필요 | `use-expression-suggestions.ts`, `variable-picker.tsx`, `validate-scope.ts` | `expression-constants.ts`에 `scopeKey: keyof ContainerScope` 메타데이터 추가로 단일 진실 공급원화 |
| 10 | 유지보수성 | `variable-picker.tsx` JSX 내 IIFE(`(() => { ... })()`) 패턴 — 가독성 저하, 매 렌더마다 새 함수 생성, React 관용적이지 않음 | `variable-picker.tsx` Built-in variables 렌더링 블록 | `useMemo` 또는 `return` 전 `const scopedBuiltIns = ...`로 추출 |
| 11 | 성능 | `getContainerChain` 내부에서 `new Map(nodes.map(...))` 재생성 — `getAncestorsInScope`도 동일 Map을 생성하므로 O(n) 할당이 이중 발생 | `reachable-nodes.ts` — `getAncestorsInScope`, `getContainerChain` | `getContainerChain`이 기존 `byId` Map을 인자로 받도록 수정 |
| 12 | 성능 | `allDisambiguatedKeys` 역방향 탐색이 O(n) — `[...entries()].find(([, key]) => key === refLabel)` 매번 선형 탐색 | `use-expression-context.ts` — nodeRefMatch 처리 블록 | `useMemo` 내에서 역방향 Map(`resolvedKeyToId: Map<string, string>`) 추가 생성 |
| 13 | 테스트 누락 | `seen` Set이 모든 `{{ }}` 블록 간에 공유되어 동일 `(kind, token)` 에러가 복수 블록에서 발생해도 한 번만 보고되는 동작이 문서화·테스트 없음 | `validate-scope.ts:52-56`, `validate-scope.test.ts` | 복수 블록에서 동일 토큰 에러 시 기대 동작 명세 테스트 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `token` 값이 에러 메시지 문자열에 직접 포함됨. 현재 React JSX 이스케이프로 안전하나, 향후 `dangerouslySetInnerHTML` 사용 시 즉시 XSS 위험 | `validate-scope.ts:messageFor()`, `expression-input.tsx` — `{err.message}` | `{ template, token }` 구조 분리 검토. 단기적으로는 `dangerouslySetInnerHTML` 금지 lint 규칙 적용 |
| 2 | 보안/유지보수 | `unescapeDoubleQuotedKey` 결과에 `isSafeFieldName` 수준 검증 없음 — 현재 Set 조회에만 사용되어 직접 위험은 없으나 향후 객체 키로 사용 시 위험 | `validate-scope.ts` — `NODE_REF_RE` 추출 key 처리 | `__proto__` 등 위험 키에 대한 early-return 추가 권장 |
| 3 | 성능 | `expression-autocomplete.tsx`의 `suggestions.slice(0, 20)` 매 렌더마다 실행 | `expression-autocomplete.tsx` JSX 내 | `useMemo`로 슬라이스된 배열 메모이제이션 |
| 4 | 동시성 | `expression-input.tsx`의 `setTimeout` 내 `setSyntaxError` + `setScopeErrors` 순차 호출 — React 17 이하에서 별도 렌더 유발로 일시적 UI 불일치 가능 | `expression-input.tsx` — `useEffect` 내 setState 쌍 | `{ syntaxError, scopeErrors }` 단일 상태 객체 또는 `useReducer`로 원자적 갱신 |
| 5 | 유지보수성 | `expression-input.tsx`의 `runScopeValidation`과 `validateExpressionScope` 내부 모두에 `!value.includes("{{")` early-return 중복 | `expression-input.tsx` — `runScopeValidation` 함수 | 외부 wrapper의 early-return 제거, 내부 guard만 신뢰 |
| 6 | 유지보수성 | `use-expression-context.ts`의 `useMemo` 콜백이 ~150줄 이상으로 성장 — scopedNodes, ancestors, containerScope, allNodeKeys 등 다중 책임 혼재 | `use-expression-context.ts` — `useExpressionContext` 함수 | `buildContainerScope()`, `buildAvailableNodes()` 등 순수 함수로 분리 (장기 개선) |
| 7 | 유지보수성 | 노드 데이터 타입이 `unknown`이어서 `(n.data ?? {}) as Record<string, unknown>` + 필드별 캐스팅 반복 | `use-expression-context.ts` — `scopedNodes` 생성 부분 | 스토어 노드 타입에 `containerId`, `toolOwnerId` 명시 또는 `toScopedNode()` 헬퍼 함수 추출 |
| 8 | 테스트 누락 | `validateExpressionScope(null, ctx())` / `(undefined, ctx())` early return 동작 테스트 없음 | `validate-scope.test.ts` | null/undefined 입력 케이스 추가 |
| 9 | 테스트 누락 | `hasLoop && hasItem` 동시 true일 때 `$loop`·`$item`·`$itemIndex` 전부 표시됨을 검증하는 테스트 없음 | `use-expression-suggestions.test.ts` container scope gating 섹션 | 두 플래그 모두 true 케이스 추가 |
| 10 | 테스트 누락 | 단일 블록 내 `unknown-node` + `unknown-variable` 동시 발생 케이스 미검증 | `validate-scope.test.ts` | `{{ $node["Ghost"].x + $var.missing }}` 케이스 추가 |
| 11 | 문서화 | `expression-constants.ts`의 `ROOT_VARIABLES`에 `$loop`·`$item`·`$itemIndex`가 `containerScope` 필터링이 필요함을 소비자가 알 수 없음 | `expression-constants.ts:7-9` | JSDoc에 "일부 항목은 containerScope에 따라 필터링 필요" 한 줄 추가 |
| 12 | 문서화 | `variables-and-context.mdx`에 container scope 변수 제한 및 scope 경고 UI에 대한 설명 반영 여부 최종 확인 필요 | `frontend/src/content/docs/03-expression-language/` | docs 최종 확인 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| side_effect | MEDIUM | `/g` 정규식 lastIndex 누출, `ExpressionData` 파괴적 변경 가능성 |
| performance | MEDIUM | `/g` 정규식 concurrent mode 위험, 중복 Map 생성, O(n) 역방향 탐색 |
| requirement | MEDIUM | scope 에러 시 red 하이라이트 불일치, 전역 RegExp 상태 문제 |
| testing | MEDIUM | autocomplete·highlight 테스트 파일 없음, 다수 케이스 누락 |
| security | LOW | ReDoS 잠재 가능성, token XSS 구조적 위험, 정규식 상태 관리 |
| maintainability | LOW | `/g` 정규식 상태 패턴, scope 필터 로직 중복, useMemo 콜백 비대화 |
| architecture | LOW | 컨테이너 스코프 게이팅 로직 분산(OCP 위반), IIFE 안티패턴 |
| dependency | LOW | `/g` 정규식 공유 상태(유지보수 리스크) |
| concurrency | LOW | 전역 정규식 가변 상태, setTimeout 내 다중 setState |
| scope | LOW | hasError 시각적 불일치, `$input` 소스 필터 변경 명시 필요 |
| documentation | LOW | ROOT_VARIABLES 필터링 힌트 누락, mdx 최종 확인 권장 |
| api_contract | NONE | 해당 없음 |
| database | NONE | 해당 없음 |

---

## 발견 없는 에이전트
- **api_contract** — 순수 프론트엔드 내부 구현으로 API 계약 변경 없음
- **database** — DB 접근 코드 없음

---

## 권장 조치사항

1. **[즉시 수정 필수]** `validate-scope.ts`의 `LOOP_ROOT_RE`, `ITEM_ROOT_RE`, `ITEM_INDEX_ROOT_RE`에서 `g` 플래그 제거 또는 함수 내부 로컬 정규식으로 전환 — `lastIndex` 공유 상태가 foreach 컨텍스트에서 scope 검사 오동작을 유발하며 concurrent mode에서 더욱 위험

2. **[즉시 수정 필수]** `ExpressionHighlight`에 `hasWarning` prop 추가 — scope 에러 시 amber 배경, syntax 에러 시 red 배경으로 분리하여 시각적 불일치 해소

3. **[테스트 추가 필수]** `expression-autocomplete.tsx`, `expression-highlight.tsx` 테스트 파일 신규 작성 및 `variable-picker.tsx` containerScope 필터링 렌더링 테스트 추가

4. **[테스트 보완 필수]** `reachable-nodes.test.ts` 사이클 테스트에 `fromA.has("A") === false` 단언 추가; `use-expression-context.test.ts`에 루프 노드 자신 선택 케이스 추가; `expression-input.test.tsx`에 syntax+scope 동시 에러 우선순위 및 유효 scope 긍정 케이스 추가

5. **[중기 개선]** 컨테이너 스코프 변수 게이팅 로직을 `expression-constants.ts`에서 `scopeKey: keyof ContainerScope` 메타데이터로 중앙화 — `use-expression-suggestions.ts`, `variable-picker.tsx`, `validate-scope.ts` 세 곳의 중복 제거

6. **[중기 개선]** `variable-picker.tsx`의 IIFE를 `useMemo` 또는 `return` 전 `const` 변수로 교체

7. **[중기 개선]** `getContainerChain`이 기존 `byId` Map을 인자로 받도록 수정하여 중복 Map 생성 제거; `allDisambiguatedKeys` 역방향 Map 추가로 O(n) → O(1) 탐색 개선

8. **[장기 개선]** `useExpressionContext`의 `useMemo` 콜백을 `buildContainerScope()`, `buildAvailableNodes()` 등 순수 함수로 분리하여 단일 책임 원칙 준수