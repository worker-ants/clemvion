## 발견사항

### 인라인 주석 정확성

- **[WARNING]** plan 문서의 실패 반환값이 구현과 불일치
  - 위치: `plan/in-progress/node-features/filter-conditions-expression-binding.md` §2, `filter.handler.ts:resolveIfExpression`
  - 상세: plan에는 "평가 실패는 try/catch 로 흡수 → `undefined` 로 fallback"이라고 명시되어 있으나, 실제 구현은 `null`을 반환한다. 주석("Per-item evaluation failure → null")은 코드와 일치하지만 plan 문서가 outdated 상태다.
  - 제안: plan 문서의 해당 항목을 `null` 로 수정하거나, 이미 구현 완료된 시점이라면 체크리스트를 완료 처리하고 `plan/complete/`로 이동

- **[WARNING]** plan 체크리스트가 전부 미완료(`[ ]`) 상태로 추가됨
  - 위치: `plan/in-progress/node-features/filter-conditions-expression-binding.md` 전체
  - 상세: 해당 plan은 새 파일로 추가되었는데 git 커밋 이력(f424ec6: `fix(filter)`)으로 보아 구현이 이미 완료된 상태다. plan 문서의 체크리스트가 단 하나도 체크되지 않아 실제 완료 상태를 반영하지 못한다.
  - 제안: 완료된 단계의 체크박스를 `[x]`로 갱신하고, 모든 항목 완료 후 `git mv`로 `plan/complete/node-features/`로 이동 (CLAUDE.md의 plan 라이프사이클 규칙 준수)

### 독스트링/JSDoc

- **[INFO]** `Condition` 인터페이스에 JSDoc 없음
  - 위치: `condition-eval.util.ts:37-41`
  - 상세: `field: unknown`으로 타입이 변경되면서 인라인 주석이 추가되었으나, 인터페이스 자체에 JSDoc이 없어 IDE hover 시 컨텍스트가 표시되지 않는다. 다른 핸들러(if-else, while 등)에서 공유되는 유틸리티이므로 공개 인터페이스 문서화 가치가 있다.
  - 제안: 인터페이스 상단에 `/** Condition evaluated against each array item ... */` 수준의 짧은 JSDoc 추가

- **[INFO]** `evaluateCondition`, `computeFieldValue`, `resolveIfExpression`에 함수 시그니처 문서 없음
  - 위치: `condition-eval.util.ts:67`, `filter.handler.ts:142, 156`
  - 상세: 내부 동작은 인라인 주석으로 잘 설명되어 있으나, 파라미터와 반환값에 대한 공식 문서가 없다. 특히 `evaluateCondition`은 여러 파일에서 import해 사용하는 공개 함수다.
  - 제안: `@param item`, `@param strict` 정도의 간단한 JSDoc — 복잡하게 쓸 필요 없이 파라미터 역할만 명시

### spec 문서 동기화

- **[INFO]** `spec/4-nodes/1-logic-nodes.md`에 sentinel 동작이 공식화되지 않음
  - 위치: `spec/4-nodes/1-logic-nodes.md` §8 (참조 line 367, 405)
  - 상세: plan 및 테스트 주석에서 spec을 근거로 인용하나, spec 문서 자체에 "빈 문자열·`$item` 리터럴·비-문자열 field는 item 자체를 비교"하는 sentinel 규칙과 `field` 타입이 `Expression` (즉 `unknown`으로 해석 가능)임이 명시되어 있는지 확인이 필요하다. 구현이 spec을 선행한 경우 spec 역갱신이 필요하다.
  - 제안: spec §8에 sentinel 동작 및 `$item` / `$itemIndex` 바인딩 시점을 명시적으로 기술

### 기타

- **[INFO]** `EXPRESSION_PATTERN = /\{\{/` 패턴 선택 이유 미문서화
  - 위치: `filter.handler.ts:31`
  - 상세: 닫는 `}}` 없이 여는 `{{`만 감지하는 이유(충분조건)가 설명되어 있지 않아, 나중에 읽는 사람이 패턴을 `/{{\s*.*?\s*}}/`로 "수정"하려는 충동을 받을 수 있다.
  - 제안: 주석 한 줄 — `// opening brace is sufficient; expression-engine handles malformed tails`

---

### 요약

전반적으로 인라인 주석의 질은 높다 — sentinel 로직, per-item 컨텍스트 바인딩, regex 캐시 재설계 등 "왜"가 필요한 지점에 적절히 설명이 붙어 있다. 주된 문제는 **plan 문서의 상태 불일치**로, 구현이 완료된 시점임에도 체크리스트가 전부 미완료이고 실패 반환값(`undefined` vs `null`)이 틀렸다. 이는 CLAUDE.md의 plan 라이프사이클 규칙 위반이다. 나머지는 공개 인터페이스(Condition, evaluateCondition)의 JSDoc 누락과 spec 동기화 확인 수준의 낮은 위험도 항목이다.

### 위험도

**LOW**