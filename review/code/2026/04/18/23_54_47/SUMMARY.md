SUMMARY.md가 이미 작성되어 있습니다. 내용이 이미 완성도 높게 정리되어 있으므로, 이를 그대로 활용하여 최종 통합 보고서를 출력합니다.

---

# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — `validate-scope.ts`의 모듈 수준 `/g` 정규식 `lastIndex` 미리셋 버그가 `hasItem: true` + 다중 블록 환경에서 실제 오탐을 유발할 수 있음

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 버그 | `containerScope.hasItem === true`일 때 `ITEM_ROOT_RE`와 `ITEM_INDEX_ROOT_RE`의 `lastIndex`가 리셋되지 않음. `if (!context.containerScope.hasItem)` 블록 전체를 건너뛰어 두 정규식의 `lastIndex`가 누적되고, 다음 블록 또는 다음 함수 호출에서 잘못된 위치부터 매칭 시작 | `validate-scope.ts` — `if (!context.containerScope.hasItem)` 블록 내 `lastIndex` 리셋 코드 | `/g` 플래그 자체 제거가 근본 해결책. `lastIndex = 0` 리셋 코드 전체 제거 가능 |

> **주의**: `side_effect` 에이전트는 정상 경로에서는 `.test()` 자체가 실행되지 않아 `lastIndex`가 항상 0으로 유지된다고 분석했으나, 구조적 취약점(`/g` 플래그 공유)은 동일하게 수정 권장.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 버그/부작용 | `LOOP_ROOT_RE`, `ITEM_ROOT_RE`, `ITEM_INDEX_ROOT_RE`에 불필요한 `/g` 플래그. `.test()` 전용으로 사용하면서 `lastIndex` 수동 리셋에 의존하는 취약한 구조. 예외 발생 시 리셋 누락, React Concurrent Mode에서 상태 오염 가능 | `validate-scope.ts` L46–49 | `/g` 플래그 제거. `lastIndex` 리셋 코드도 전체 제거 가능 |
| 2 | 보안/검증 | `unescapeDoubleQuotedKey`가 `\"` 외 모든 백슬래시 시퀀스(`\n`, `\t` 등)를 해제해 노드 키 검증 우회 가능 (false-negative) | `validate-scope.ts` L52 | `raw.replace(/\\"/g, '"')` — `\"` 시퀀스만 처리로 제한 |
| 3 | 테스트 누락 | 사이클 테스트(`A → B → A`)에서 `fromA.has("A") === false`(자기 자신 미포함) 검증 없음 | `reachable-nodes.test.ts` — "is cycle-safe" 테스트 | `expect(fromA.has("A")).toBe(false)` 추가 |
| 4 | 테스트 누락 | `hasItem: true` 환경에서 `$itemIndex` 단독 사용이 에러 없이 허용되는지 테스트 없음 | `validate-scope.test.ts` | `containerScope: { hasLoop: false, hasItem: true }` + `{{ $itemIndex }}` 케이스 추가 |
| 5 | 테스트 누락 | tool 노드가 체인 중간에 있는 간접 경로 테스트 없음. `T(tool) → M(normal) → Y`에서 M 포함·T 제외 미검증 | `reachable-nodes.test.ts` | `n("T", "http_request", { toolOwnerId: "Agent" }) → n("M") → n("Y")` 케이스 추가 |
| 6 | 설계 | `ScopedNode.type` 필드가 인터페이스에 선언되어 있으나 `getContainerChain`, `getAncestorsInScope` 내부에서 미사용 dead field | `reachable-nodes.ts` L22 | 미사용이면 인터페이스에서 제거. 향후 사용 예정이면 JSDoc에 명시 |
| 7 | 문서/코드 불일치 | JSDoc에 "BFS"라고 명시했으나 `stack.pop()` 사용으로 실제 구현은 DFS. 테스트 주석에도 "BFS should terminate" 혼재 | `reachable-nodes.ts` JSDoc L62, `reachable-nodes.test.ts` L72 | JSDoc을 "graph traversal (DFS)" 또는 "DFS over reverse edges"로 수정 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능 | `getAncestorsInScope` 호출마다 `byId` Map과 `incoming` Map을 O(N+E)로 재구성. 에디터 키입력마다 자동완성 계산 시 반복 비용 | `reachable-nodes.ts` L71, L79 | 호출자에서 `nodes`/`edges` 변경 시에만 Map 재구성하도록 메모이제이션. 또는 `buildGraph()` + `computeAncestors()` 분리 |
| 2 | 성능 | `getContainerChain` 내부에서 `getAncestorsInScope`가 이미 구성한 `byId` Map을 중복 생성 | `reachable-nodes.ts` L48, L97 | `getContainerChain`에 `byId?: Map<string, ScopedNode>` 파라미터 추가 |
| 3 | 테스트 누락 | `seen` Set이 블록 루프 밖에 선언되어 다른 `{{ }}` 블록에서 동일 에러가 전역 dedup됨. 의도적 정책인지 불명확하고 테스트도 없음 | `validate-scope.ts` L89, `validate-scope.test.ts` | `{{ $item.a }} and {{ $item.b }}`(hasItem: false) 에러 수가 1인지 명시하는 테스트 추가 |
| 4 | 테스트 누락 | `getAncestorsInScope`에 broken `containerId` 노드 전달 시 crash 없이 처리되는지 통합 테스트 없음 | `reachable-nodes.test.ts` | `containerId: "missing"` 노드를 target으로 전달하는 케이스 추가 |
| 5 | 문서 | `seen` Set의 전역 cross-block dedup 동작이 주석으로 명시되지 않아 future reader가 버그로 오인할 수 있음 | `validate-scope.ts` L89 | `// Cross-block dedup: same (kind, token) pair reported at most once per expression.` 추가 |
| 6 | 문서 | `validate-scope.ts` 모듈 주석이 `@workflow/expression-engine`과의 분담을 불명확하게 기술 | `validate-scope.ts` L7 | `// Caller merges these errors with validate()'s output.` 추가 |
| 7 | 문서 | `getAncestorsInScope` JSDoc이 `getContainerChain`의 innermost-first 순서 의존성을 명시하지 않음 | `reachable-nodes.ts` L70–71 | `"(innermost first, as returned by getContainerChain)"` 문구 추가 |
| 8 | 코드 품질 | `messageFor` switch에 `default` 케이스 없음. 런타임 타입 캐스팅 시 silent `undefined` 반환 가능 | `validate-scope.ts` — `function messageFor` | `default: return kind satisfies never;` 추가 |
| 9 | 코드 품질 | 테스트 헬퍼 `n()`, `e()` 이름이 너무 짧아 IDE 오류 메시지에서 의도가 불명확 | `reachable-nodes.test.ts`, `validate-scope.test.ts` | `node()`, `edge()` 등 명시적 이름으로 변경 고려 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | MEDIUM | `hasItem: true` 경로의 `lastIndex` 미리셋 버그를 CRITICAL 식별, 관련 테스트 4건 누락 |
| requirement | MEDIUM | `lastIndex` 리셋 누락 버그, `$itemIndex` 단독 테스트 및 tool 간접 경로 테스트 누락 |
| security | LOW | `/g` 정규식 Concurrent Mode 오염, `unescapeDoubleQuotedKey` 과도한 이스케이프 범위 |
| performance | LOW | Map 매번 재구성, `/g` 정규식 `lastIndex` 취약 구조 |
| side_effect | LOW | `/g` 정규식 `lastIndex` 공유 상태 패턴 (정상 경로는 안전하나 구조적 취약) |
| architecture | LOW | `ScopedNode.type` dead field, 정규식 재진입 위험, Map 이중 생성 |
| maintainability | LOW | BFS/DFS 명칭 불일치, Map 이중 생성, regex 상태 공유 |
| concurrency | LOW | `/g` 정규식 예외 경로 및 Concurrent Mode에서 `lastIndex` 오염 가능 |
| scope | LOW | `ScopedNode.type` 미사용 필드, `unescapeDoubleQuotedKey` 과도한 이스케이프 범위 |
| documentation | LOW | BFS/DFS 표현 불일치, 분담 관계 불명확 |
| dependency | NONE | 신규 외부 의존성 없음, 단방향 내부 의존성 유지 |

---

## 발견 없는 에이전트

- **database** — 순수 클라이언트 사이드 코드로 DB와 무관
- **api_contract** — HTTP API 계약과 무관한 로컬 유틸리티

---

## 권장 조치사항

1. **[즉시 필수]** `validate-scope.ts` — `/g` 플래그 제거: `LOOP_ROOT_RE`, `ITEM_ROOT_RE`, `ITEM_INDEX_ROOT_RE` 세 정규식에서 `g` 삭제 + `lastIndex = 0` 리셋 코드 전체 제거. Critical 버그와 WARNING #1을 동시 해결하는 근본 해결책

2. **[즉시 필수]** `validate-scope.ts` L52 — `unescapeDoubleQuotedKey`를 `raw.replace(/\\"/g, '"')`로 제한. 노드 키 검증 우회(false-negative) 방지

3. **[즉시 필수]** 테스트 추가 — `hasItem: true` + `{{ $itemIndex }}` 단독 케이스 (에러 없음)

4. **[권장]** 테스트 보강 — 사이클 자기포함 assertion (`fromA.has("A") === false`), tool 간접 경로(`T→M→Y`), cross-block dedup 정책, broken containerId 통합 케이스

5. **[권장]** `reachable-nodes.ts` JSDoc "BFS" → "graph traversal (DFS)" 수정 (테스트 주석 포함 3곳)

6. **[권장]** `messageFor` switch에 `default: return kind satisfies never;` 추가

7. **[선택]** `ScopedNode.type` 필드 — 미사용 확인 후 인터페이스에서 제거 또는 사용 의도 JSDoc 명시

8. **[선택]** `getAncestorsInScope` 성능 개선 — 자동완성 호출 빈도에 따라 `byId`/`incoming` Map 메모이제이션 또는 `getContainerChain`에 `byId` 파라미터 추가 검토