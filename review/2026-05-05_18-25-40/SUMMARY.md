파일 쓰기 권한 승인이 필요합니다. 허용해주시면 `review/2026-05-05_18-25-40/SUMMARY.md`에 통합 보고서를 저장하겠습니다.

권한 승인 전에 보고서 내용을 먼저 보여드립니다:

---

# Code Review 통합 보고서

## 전체 위험도
**HIGH** — Expression Engine의 샌드박스 여부가 확인되기 전까지. 샌드박스 검증 완료 시 **MEDIUM** (ReDoS 미조치, `computeFieldValue` undefined 버그, stub 패턴 아키텍처 부채 잔류).

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | **Expression Injection** — `evaluate(value, ctx)`에 사용자 작성 `condition.field`·`condition.value` 문자열이 그대로 전달. 엔진이 `eval()`/`new Function()` 기반이면 RCE 가능. | `filter.handler.ts` — `resolveIfExpression()` | expression-engine 샌드박스 여부 즉시 확인. `eval()` 기반이면 **배포 불가** |

---

## 경고 (WARNING) — 주요 항목

| # | 카테고리 | 발견사항 |
|---|----------|----------|
| 1 | Security | ReDoS — 길이 제한만으로 카타스트로픽 백트래킹 미방어 |
| 2 | Security | Prototype Pollution 위험 (baseCtx 스프레드 + item 키) |
| 3 | Security | 보안 이벤트 은닉 (silent catch) |
| **4** | **Bug** | **`computeFieldValue`: `undefined` field가 sentinel 처리 안 됨 → 전 항목 unmatched** |
| 5 | Architecture | `Condition.field: unknown` 공유 인터페이스 완화 — 다른 노드 타입 안전성 저하 |
| 6 | Architecture/Perf | `stub: Condition` 패턴 — N×M 할당 + 내부 결합 |
| 7 | Performance | `evalOne` 클로저 per-item + `baseCtx` 스프레드 O(vars×N) |
| 8 | Side Effect | `resolveIfExpression` null 반환 → `is_null`/숫자 비교 시 암묵적 match |
| 9 | API Contract | `context.expressionContext` — `ExecutionContext` 인터페이스 미선언 |
| 10 | Dependency | `VALID_OPS` 이중 관리 (schema vs util) |
| 11 | Plan | Plan 체크리스트 전항목 미완료 + `in-progress/` 잔류 |
| 12~16 | Testing | `$itemIndex`, `or` 모드, 동적 regex, 워크플로 변수, condition-eval util 직접 테스트 누락 |

---

## 권장 조치 순서

1. **[즉시]** Expression Engine 샌드박스 검증
2. **[즉시]** `computeFieldValue` `undefined` field 버그 수정
3. **[즉시]** `resolveIfExpression` null → undefined 반환 변경
4. **[단기]** ReDoS 방어 (`safe-regex` / RE2)
5. **[단기]** `stub` 패턴 + `Condition.field` 리팩토링
6. **[단기]** `expressionContext` 인터페이스 선언
7. **[단기]** 누락 테스트 추가 (6건)
8. **[관리]** Plan 완료 처리, spec 동기화, VALID_OPS CI 검증

---

파일 저장을 허용해주시면 위 내용을 `review/2026-05-05_18-25-40/SUMMARY.md`에 기록합니다.