## 발견사항

### [WARNING] 워크플로 로드 시 엣지 묵시적 삭제 — 저장 후 비가역적
- **위치**: `editor-loader.tsx` L60-74, `edge-utils.ts` `dropStaleEdges`
- **상세**: `dropStaleEdges`는 로드 타임에 핸들이 없는 엣지를 메모리에서 제거합니다. 사용자가 워크플로를 이후에 저장하면 해당 엣지는 백엔드 DB에서도 영구 삭제됩니다. `console.warn`은 개발자만 볼 수 있고, 사용자는 조용히 데이터가 손실됩니다.
- **제안**: 삭제된 엣지 수를 에디터 토스트/배너로 사용자에게 알리거나, 삭제를 저장 시점으로 지연시켜 명시적 동의를 구하세요.

---

### [WARNING] `insertText` 변경 — `isExpandable` 미구현 소비자에게 회귀
- **위치**: `use-expression-suggestions.ts` L207
- **상세**: 노드 선택 시 `insertText`가 `'${escaped}"].output'` → `'${escaped}"]'`로 변경됩니다. `isExpandable: true`를 보고 `.`을 자동 추가하는 `handleSelect` 구현에 의존하는 변경입니다. 해당 핸들러가 `isExpandable`을 처리하지 않으면 `$node["X"]`에서 자동완성이 멈추고 사용자가 직접 `.output`을 타이핑해야 합니다.
- **제안**: 표현식 입력 컴포넌트의 `handleSelect`에서 `isExpandable` 처리를 확인하고, 없다면 이번 변경과 함께 추가해야 합니다.

---

### [WARNING] `dropStaleEdges` 퍼미시브 폴백의 빈 Set 의존성
- **위치**: `edge-utils.ts` L119-132, L148-160
- **상세**: 알 수 없는 노드 타입에 대해 `size === 0`인 빈 `Set`를 반환하고 `size > 0` 조건으로 검증을 스킵합니다. `loadNodeDefinitions()`가 `Promise.all`에 포함되어 있어 현재는 안전하지만, 이 함수가 다른 컨텍스트(예: 실시간 노드 추가)에서 재사용될 경우 캐시 미스 상태에서 스테일 엣지를 통과시킬 수 있습니다.
- **제안**: 빈 Set와 "알 수 없음" 상태를 구분하는 명시적 플래그(`null` 반환 등)를 사용하면 향후 재사용 시 명확합니다.

---

### [INFO] `enrichInfoExtractorOutputSchema` — 렌더마다 `JSON.parse/stringify` 호출
- **위치**: `use-expression-context.ts` L84-105
- **상세**: `useMemo` 내부에서 `information_extractor` 노드마다 `JSON.parse(JSON.stringify(baseSchema))`를 호출합니다. 단일 워크플로에 IE 노드가 많거나 스키마가 클 경우 불필요한 직렬화 비용이 발생합니다.
- **제안**: `structuredClone`을 사용하거나, 스키마 변경이 없는 경우 캐싱을 고려하세요.

---

### [INFO] `useExpressionContext` — 추가 스토어 구독
- **위치**: `use-expression-context.ts` L113, L265
- **상세**: 이 훅을 사용하는 모든 컴포넌트가 `useNodeDefinitionsStore`를 추가로 구독합니다. `nodeDefinitions`는 초기 로드 후 변경되지 않아야 하므로 실질적 영향은 낮습니다.

---

### [INFO] `getExpressionToken` 역방향 탐색 — 이스케이프 따옴표 엣지 케이스
- **위치**: `use-expression-suggestions.ts` L66-68
- **상세**: `between[i-1]`에서 `i=0`일 때 `between[-1]`은 `undefined`이고, `undefined !== "\\"` 는 `true`로 평가됩니다. `\"`로 시작하는 문자열에서는 잘못된 결과가 나올 수 있으나, 실제 표현식에서 발생 가능성은 매우 낮습니다.

---

## 요약

이번 변경은 자동완성 힌트를 위한 정적 스키마 첨부와 로드 타임 스테일 엣지 정리를 구현한 것으로, 전반적으로 단방향·순수 함수 중심의 안전한 코드입니다. 주요 부작용 위험은 두 가지입니다: (1) `dropStaleEdges`가 사용자 인지 없이 데이터를 묵시적으로 제거하고, 이후 저장 시 비가역적으로 손실될 수 있는 점과 (2) 노드 선택 `insertText` 변경이 `isExpandable` 처리를 구현하지 않은 소비자 컴포넌트에서 자동완성 회귀를 일으킬 수 있는 점입니다.

## 위험도

**MEDIUM**