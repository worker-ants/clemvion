# Spec: Data 노드 공통 규약

> 관련 문서: [PRD Data 노드](../../../prd/3-node-system.md#7-data-노드-2종) · [Spec 노드 개요](../0-overview.md) · [Spec 노드 공통](../../3-workflow-editor/1-node-common.md) · [Spec 노드 샌드박싱](../0-overview.md#5-노드-실행-샌드박싱) · [Spec 표현식 언어](../../5-system/5-expression-language.md)

본 문서는 Data 카테고리 노드 전체에 공통되는 규약을 정의한다. 노드별 동작·설정은 각 노드 문서를 참조한다.

- [Transform](./1-transform.md)
- [Code](./2-code.md)

---

## 1. 표현식 지원 정책

Data 노드는 다음 시점에서 `{{ }}` 표현식을 평가한다:

| 노드 | 평가 위치 |
|------|-----------|
| Transform | `set_field` operation 의 `value`, `math_op` 의 `operand` 등 — 각 operation 의 표현식 허용 파라미터 |
| Code | `$input` / `$vars` 컨텍스트 객체 (코드 내부에서는 표현식 문법이 아닌 일반 JS 변수로 노출) |

표현식 문법 자체는 [Spec 표현식 언어](../../5-system/5-expression-language.md) 의 단일 정의를 따른다.

## 2. 샌드박싱 적용 범위

Code 노드는 [노드 실행 샌드박싱 정책](../0-overview.md#5-노드-실행-샌드박싱) 을 따른다. Transform 노드는 자체 격리 컨텍스트를 사용하지 않으며, operation 체인은 핸들러 프로세스 내부에서 실행된다 (외부 네트워크 / 파일시스템 접근 없음).

샌드박싱의 세부 규칙(타임아웃, 메모리, 허용/차단 API)은 Code 노드 문서 §[샌드박싱](./2-code.md#7-샌드박싱) 에서 정의한다.

---

## 3. 캔버스 요약

| 노드 | 요약 포맷 | 예시 |
|------|-----------|------|
| Transform | `{N} operations` (operations 배열의 길이) | `3 operations` |
| Code | `{language} · {N} lines` (코드 줄 수) | `JavaScript · 12 lines` |
