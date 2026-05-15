## 문서화 리뷰 결과

### 발견사항

**[WARNING]** `reachable-nodes.ts` 모듈 주석 및 JSDoc에서 "BFS"라고 명시했으나 실제 구현은 DFS
- 위치: `reachable-nodes.ts` L10 (모듈 주석 "during BFS"), L63 (`getAncestorsInScope` JSDoc "BFS over reverse edges"), `reachable-nodes.test.ts` L72 ("BFS should terminate")
- 상세: `stack.pop()`을 사용하므로 실제 순회는 DFS임. 현재 결과의 correctness에는 영향 없으나, 문서와 코드가 불일치하면 향후 순서 의존 기능 추가 시 잘못된 전제로 수정 실수가 발생할 수 있음
- 제안: 세 곳 모두 "BFS" → "graph traversal (DFS)" 또는 "traversal over reverse edges"로 수정. `const stack` 변수명도 `queue`(BFS) 혼동을 방지하기 위해 그대로 `stack`으로 유지하거나, 실제 BFS로 전환(`shift()`)하여 명칭과 일치시킬 것

---

**[WARNING]** `getAncestorsInScope` JSDoc이 `getContainerChain`의 innermost-first 순서 의존성을 명시하지 않음
- 위치: `reachable-nodes.ts` L63–L70 (`getAncestorsInScope` JSDoc)
- 상세: "The frame stack is primed with... plus one entry per ancestral container"라고 설명하지만, 이 프레임 초기화가 `getContainerChain`의 innermost-first 반환 순서에 의존함을 언급하지 않음. 순서가 역전되면 알고리즘 correctness는 유지되나 프레임 스택 의미가 달라짐
- 제안: `"(each at that container's outer level)"` 뒤에 `"as returned by getContainerChain (innermost first)"` 문구 추가

---

**[INFO]** `validate-scope.ts` 모듈 주석이 `@workflow/expression-engine`과의 책임 분담을 불명확하게 기술
- 위치: `validate-scope.ts` L4–L5
- 상세: "Complements `@workflow/expression-engine` `validate()`"라고만 기술되어 있어, 구문 오류는 expression-engine이, 스코프 의미론은 이 모듈이 담당하고 두 결과를 호출자가 병합해야 한다는 사실이 불명확함
- 제안: 한 줄 추가: `// Caller is responsible for merging these errors with validate()'s syntax/type errors.`

---

**[INFO]** `ScopedNode.type` 필드에 JSDoc 설명 없음
- 위치: `reachable-nodes.ts` L26
- 상세: 인터페이스의 다른 필드들(`containerId`, `toolOwnerId`)은 용도가 알고리즘에서 명확히 드러나지만, `type` 필드는 내부 알고리즘 어디에서도 사용되지 않아 목적 불명. 테스트 헬퍼에서는 사용되나 인터페이스에 문서가 없음
- 제안: 사용 의도가 없다면 필드 제거. 미래 컨테이너 타입 판별을 위한 예비 확장이라면 `/** Node type identifier; reserved for future container-type dispatch. */` 주석 추가

---

**[INFO]** `seen` Set의 크로스 블록 dedup 동작이 문서화되지 않음
- 위치: `validate-scope.ts` L78
- 상세: `const seen = new Set<string>()`이 `{{ }}` 블록 루프 외부에 선언되어 있어 서로 다른 블록에서 동일한 (kind, token) 오류가 발생해도 전역 dedup됨. 이 의도적 설계가 주석으로 명시되어 있지 않아 future reader가 버그로 오인할 수 있음
- 제안: 선언 옆에 `// Cross-block dedup: same (kind, token) pair reported at most once per expression.` 추가

---

**[INFO]** `unescapeDoubleQuotedKey` 함수의 범위가 함수명과 구현 간에 불일치
- 위치: `validate-scope.ts` L52–54
- 상세: 함수명은 "double-quoted key unescape"를 암시하나 `replace(/\\(.)/g, "$1")`는 `\"` 뿐 아니라 모든 백슬래시 시퀀스를 처리함. 주석이 없어 이 과도한 범위가 의도적인지 불명확함
- 제안: `// Strips all backslash escapes — covers \\" (the only valid escape in node keys).` 주석 추가, 또는 `/\\"/g`로 범위를 좁히고 함수명 유지

---

### 요약

`reachable-nodes.ts`와 `validate-scope.ts` 모두 모듈 레벨 JSDoc, 인터페이스 필드 설명, 복잡한 알고리즘 주석이 잘 작성된 편이다. 가장 실질적인 문제는 "BFS"라는 알고리즘 명칭이 세 곳에서 실제 구현(DFS)과 불일치하는 점으로, 순서 의존 기능 추가 시 잘못된 전제로 이어질 수 있다. 나머지 발견사항은 `seen` Set의 전역 dedup 정책, `getAncestorsInScope`의 호출 순서 의존성, `unescapeDoubleQuotedKey`의 처리 범위 등 명확성 보완 수준의 제안으로, README나 외부 API 문서 변경은 불필요하다(순수 내부 유틸리티).

### 위험도
**LOW**