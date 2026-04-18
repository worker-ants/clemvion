# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** - `validate-scope.ts`의 모듈 수준 `/g` 정규식 `lastIndex` 미리셋 버그가 `hasItem: true` + 다중 블록 환경에서 실제 오탐을 유발할 수 있음

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 버그 | `containerScope.hasItem === true`일 때 `ITEM_ROOT_RE`와 `ITEM_INDEX_ROOT_RE`의 `lastIndex`가 리셋되지 않음. `if (!context.containerScope.hasItem)` 블록 전체를 건너뛰어 두 정규식의 `lastIndex`가 누적되고, 다음 블록 또는 다음 함수 호출에서 잘못된 위치부터 매칭 시작 | `validate-scope.ts` — `if (!context.containerScope.hasItem)` 블록 내 `lastIndex` 리셋 코드 | `ITEM_ROOT_RE.lastIndex = 0`과 `ITEM_INDEX_ROOT_RE.lastIndex = 0`을 `if` 블록 **밖**으로 이동. 또는 `/g` 플래그 자체를 제거하는 것이 근본 해결책 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 버그/부작용 | `LOOP_ROOT_RE`, `ITEM_ROOT_RE`, `ITEM_INDEX_ROOT_RE`에 불필요한 `/g` 플래그 사용. `.test()` 전용으로 사용하면서 `lastIndex` 수동 리셋에 의존하는 취약한 구조. 예외 발생 시 리셋 누락, React Concurrent Mode에서 상태 오염 가능 | `validate-scope.ts` L46–49 | `.test()` 전용 정규식에서 `/g` 플래그 제거. `lastIndex` 리셋 코드도 불필요해져 제거 가능 |
| 2 | 테스트 누락 | 사이클 테스트(`A → B → A`)에서 `fromA.has("B")` 검증만 있고, `fromA.has("A") === false`(자기 자신이 결과에 포함되지 않음) 검증 없음 | `reachable-nodes.test.ts` — "is cycle-safe" 테스트 | `expect(fromA.has("A")).toBe(false)` 추가 |
| 3 | 테스트 누락 | `hasItem: true` 환경에서 `$itemIndex` 단독 사용이 에러 없이 허용되는지 확인하는 테스트 없음. Critical 버그와 맞물려 신뢰성 공백 발생 | `validate-scope.test.ts` | `containerScope: { hasLoop: false, hasItem: true }` + `{{ $itemIndex }}` 케이스 추가 |
| 4 | 테스트 누락 | tool 노드가 체인 중간에 있는 간접 경로 테스트 없음. `T(tool) → M(normal) → Y`에서 M은 포함, T는 제외되어야 함 | `reachable-nodes.test.ts` | `n("T", "http_request", { toolOwnerId: "Agent" }) → n("M", "code") → n("Y", "code")` 케이스 추가 |
| 5 | 설계 | `ScopedNode.type` 필드가 인터페이스에 선언되어 있으나 `getContainerChain`, `getAncestorsInScope` 내부 어디에서도 사용되지 않는 dead field | `reachable-nodes.ts` L22 — `ScopedNode.type` | 미사용이면 인터페이스에서 제거. 향후 컨테이너 타입 판별용이라면 JSDoc에 명시 |
| 6 | 문서/코드 불일치 | 함수 JSDoc에 "BFS"라고 명시했으나 실제 구현은 `stack.pop()` 사용 DFS. 변수명도 `stack`으로 DFS 의미 | `reachable-nodes.ts` — `getAncestorsInScope` JSDoc 및 `const stack` | JSDoc을 "graph traversal" 또는 "DFS"로 수정하거나, `stack` → `queue` + `pop()` → `shift()`로 실제 BFS로 변경 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능 | `getAncestorsInScope` 호출마다 `byId` Map과 `incoming` Map을 O(N+E)로 재구성. 에디터 키입력마다 자동완성 계산 시 반복 비용 발생 | `reachable-nodes.ts` L71, L79 | 호출자에서 `nodes`/`edges` 변경 시에만 Map 재구성하도록 메모이제이션. 또는 `buildGraph()` + `computeAncestors()` 두 단계로 분리 |
| 2 | 성능 | `getContainerChain` 내부에서 `getAncestorsInScope`가 이미 구성한 `byId` Map을 중복 생성 | `reachable-nodes.ts` L48 (`getContainerChain`), L97 (호출) | `getContainerChain`에 `byId` 파라미터 추가하는 내부 오버로드 또는 이미 구성된 Map 전달 |
| 3 | 테스트 누락 | `seen` Set이 블록 루프 **밖**에 선언되어 서로 다른 `{{ }}` 블록에서 동일 에러가 전역 dedup됨. 이 동작이 의도적인지 명확하지 않고 테스트도 없음 | `validate-scope.ts` L75, `validate-scope.test.ts` | `{{ $item.a }} and {{ $item.b }}`(hasItem: false)에서 에러 수가 1인지 2인지 명시하는 테스트 추가 (현재 정책 문서화) |
| 4 | 테스트 누락 | `getAncestorsInScope`에 broken `containerId`를 가진 노드를 전달했을 때 crash 없이 처리되는지 통합 테스트 없음 | `reachable-nodes.test.ts` | `getAncestorsInScope("Leaf", [n("Leaf", "code", { containerId: "missing" })], [])` 케이스 추가 |
| 5 | 문서 | `validate-scope.ts` 모듈 주석이 `@workflow/expression-engine`의 `validate()`와의 분담을 언급하지만 어떤 에러를 각각 처리하는지 불명확 | `validate-scope.ts` L7 | 분담 내용 한 줄 추가. 예: `// Caller merges these errors with validate()'s output.` |
| 6 | 문서 | `getContainerChain`의 innermost-first 반환 순서에 `getAncestorsInScope`가 의존하지만 JSDoc에 명시 없음 | `reachable-nodes.ts` L70–71 | "primed with... (innermost first, as returned by `getContainerChain`)" 문구 추가 |
| 7 | 코드 품질 | `messageFor` switch에 `default` 케이스 없음. TypeScript exhaustive check로 커버되지만 런타임 타입 캐스팅 시 silent failure 가능 | `validate-scope.ts` — `function messageFor` | `default: return kind satisfies never;` 추가 |
| 8 | 코드 품질 | 테스트 헬퍼 `n()`, `e()` 이름이 너무 짧아 IDE 자동완성 및 오류 메시지에서 의도가 불명확 | `reachable-nodes.test.ts`, `validate-scope.test.ts` | `node()`, `edge()` 또는 팀 컨벤션에 맞는 이름으로 변경 |
| 9 | 코드 품질 | `NODE_REF_RE`, `VAR_REF_RE`는 `matchAll`로 사용되어 `lastIndex` 오염 없음 — 안전하나 주석 명시 없음 | `validate-scope.ts` L43–44 | 현 상태 유지. 선택적으로 `// matchAll copies the regex internally — lastIndex-safe` 주석 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | MEDIUM | `hasItem: true` 경로의 `lastIndex` 미리셋 버그를 CRITICAL로 식별, 관련 테스트 누락 |
| requirement | MEDIUM | `lastIndex` 리셋 누락 버그 및 `$itemIndex` 단독 테스트 누락 |
| security | LOW | `/g` 정규식 모듈 공유로 Concurrent Mode 오염 위험, `unescapeDoubleQuotedKey` 과도한 이스케이프 범위 |
| performance | LOW | `/g` 정규식 `lastIndex` 관리 취약, `getAncestorsInScope` Map 매번 재구성 |
| side_effect | LOW | `/g` 정규식 `lastIndex` 공유 상태 패턴 |
| architecture | LOW | `ScopedNode.type` dead field, 정규식 재진입 위험 |
| maintainability | LOW | BFS/DFS 명칭 불일치, Map 이중 생성, regex 상태 공유 |
| concurrency | LOW | `/g` 정규식 예외 경로에서 `lastIndex` 미리셋 |
| scope | LOW | `/g` 플래그 불필요한 복잡도, 블록 간 dedup 정책 불명확 |
| documentation | LOW | BFS/DFS 표현 불일치, `@workflow/expression-engine` 분담 불명확 |
| dependency | NONE | 신규 외부 의존성 없음, 단방향 내부 의존성 |

---

## 발견 없는 에이전트

- **database** — 순수 클라이언트 사이드 코드로 DB와 무관
- **api_contract** — HTTP API 계약과 무관한 로컬 유틸리티

---

## 권장 조치사항

1. **[즉시 필수]** `validate-scope.ts`의 `/g` 플래그 제거 — `LOOP_ROOT_RE`, `ITEM_ROOT_RE`, `ITEM_INDEX_ROOT_RE` 세 정규식에서 `g` 플래그를 삭제하고, 불필요해진 `lastIndex = 0` 리셋 코드 전체 제거. 이것이 Critical 버그(`hasItem: true` 경로의 `lastIndex` 누적)와 모든 WARNING 1번 문제를 동시에 해결하는 근본 해결책

2. **[즉시 필수]** `$itemIndex` 단독 허용 테스트 추가 (`containerScope: { hasItem: true }` + `{{ $itemIndex }}` → 에러 없음)

3. **[권장]** 사이클 테스트에 `expect(fromA.has("A")).toBe(false)` 어써션 추가

4. **[권장]** tool 노드 간접 경로 테스트 추가 (`T(tool) → M(normal) → Y` 패턴)

5. **[권장]** `reachable-nodes.ts` JSDoc의 "BFS" → "graph traversal (DFS)" 수정, `stack` 변수명 정정

6. **[선택]** `ScopedNode.type` 필드 사용 여부 재검토 — 미사용이면 인터페이스에서 제거

7. **[선택]** `getAncestorsInScope` 성능 개선 — 자동완성 호출 빈도에 따라 `byId`/`incoming` Map 메모이제이션 또는 그래프 빌드 단계 분리 검토