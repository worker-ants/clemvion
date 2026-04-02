## 발견사항

### INFO: `resolveString` 메서드의 로직 불일치
- 위치: `expression-resolver.service.ts` - `resolveString` 메서드
- 상세: 혼합 텍스트와 표현식의 경우 "항상 string"을 반환한다는 주석이 있으나, `evaluate()`의 반환값을 그대로 사용함. `evaluate()`가 mixed template을 string으로 처리한다면 의존성 있는 동작이며, 명시적 `String(result)` 변환이 없어 의도와 구현이 불일치함.
- 제안: 분기를 명확히 하거나 주석을 실제 동작에 맞게 수정

```typescript
// 현재
if (FULL_EXPRESSION_PATTERN.test(value)) {
  return result;  // 원래 타입
}
return result;  // 동일한 코드, 분기 무의미

// 개선
if (FULL_EXPRESSION_PATTERN.test(value)) {
  return result;
}
return String(result);  // mixed → 항상 string
```

---

### WARNING: `buildExpressionContext`에서 `startedAt` 하드코딩
- 위치: `expression-resolver.service.ts:42`
- 상세: `$execution.startedAt`을 `new Date().toISOString()`으로 생성하고 있어, 실제 실행 시작 시각이 아닌 표현식 평가 시각이 들어감. `ExecutionContext`에 `startedAt`이 있다면 사용해야 하고, 없다면 필드를 추가해야 함.
- 제안: `ExecutionContext`에서 `startedAt`을 읽거나, 없을 경우 `undefined`로 처리

---

### WARNING: `mode` 필드 하드코딩
- 위치: `expression-resolver.service.ts:43`
- 상세: `$execution.mode`가 `'manual'`로 하드코딩되어 있음. 실제 실행 모드(scheduled, webhook 등)가 표현식에서 참조될 경우 항상 `'manual'`을 반환함.
- 제안: `ExecutionContext`에서 `mode`를 전달받아 사용

---

### INFO: `MAX_DEPTH` 도달 시 원본 객체 반환 (무음 실패)
- 위치: `expression-resolver.service.ts:73`
- 상세: 깊이 제한 초과 시 오류 없이 원본 객체를 그대로 반환함. 표현식이 해석되지 않았음에도 사용자는 알 수 없음.
- 제안: `Logger.warn()`으로 경고 로깅 추가

---

### INFO: `logger` 필드 선언 후 미사용
- 위치: `expression-resolver.service.ts:14`
- 상세: `private readonly logger`가 선언되어 있으나 실제로 사용되지 않음.
- 제안: 경고 로깅 위치(MAX_DEPTH, 에러 등)에 활용하거나 제거

---

### INFO: `frontend/package.json` - `--webpack` 플래그 추가
- 위치: `frontend/package.json:7`
- 상세: `next build --webpack`으로 변경되었는데, Next.js 13+ 기본 번들러는 Turbopack임. 이 플래그가 `transpilePackages` 지원을 위한 것인지 주석이 없어 의도가 불명확함. 향후 Turbopack으로 전환 시 혼란 발생 가능.
- 제안: 변경 이유를 주석으로 명시

---

### INFO: `ExpressionHighlight` - 멀티라인에서 하이라이트 미지원
- 위치: `expression-input.tsx:158-166`
- 상세: `hasExpression && !multiline` 조건으로 멀티라인 입력에서는 하이라이트 오버레이가 렌더링되지 않음. 이는 의도적 제약인지 미구현인지 코드에서 불명확함.
- 제안: 스펙에서 명시된 제약이라면 TODO 주석으로 명시

---

### INFO: `getExpressionToken` - 후방 탐색 경계 조건
- 위치: `use-expression-suggestions.ts:44`
- 상세: `value[i-1]`에서 `i=0`일 때 `value[-1]`은 `undefined`이므로 `}` 비교가 실패함. 현재는 문제없이 동작하나 명시적 가드가 없어 가독성 저하.
- 제안: `i >= 1 && value[i] === "}"` 조건으로 명시화

---

### INFO: `use-expression-context.ts` - 다중 입력 엣지 처리
- 위치: `use-expression-context.ts:62-66`
- 상세: 다중 입력 엣지가 있을 때 `edge.source` ID들을 `inputFields`로 push하고 있음. 이 값은 노드 UUID이므로 사용자에게 의미 없는 자동완성 제안이 됨.
- 제안: 다중 입력의 경우 각 소스의 출력 필드를 병합하거나, 명확한 처리 방식을 구현

---

### INFO: `EXPRESSION_EXCLUSIONS` - 타입 추론 약화
- 위치: `expression-exclusions.ts:7`
- 상세: `Record<string, Set<string>>`으로 선언하여 핸들러 타입 키가 문자열로 느슨하게 관리됨. 핸들러 타입 유니온이 있다면 `Partial<Record<NodeType, Set<string>>>`으로 타입 안전성 강화 가능.
- 제안: 노드 타입 유니온과 연계하여 타입 강화 (현재 구조 변경 불필요 시 INFO 수준 유지)

---

## 요약

전반적으로 `ExpressionResolverService`와 `ExpressionInput` 컴포넌트의 구조는 단일 책임 원칙을 잘 따르며 가독성도 양호하다. 핵심 이슈는 `resolveString` 메서드에서 full-expression과 mixed-expression 분기가 동일한 코드를 실행해 의도와 구현이 불일치하는 점, 그리고 `$execution.startedAt`과 `mode`가 하드코딩되어 런타임 컨텍스트를 반영하지 못하는 점이다. `logger` 미사용과 `MAX_DEPTH` 무음 실패는 운영 중 디버깅을 어렵게 만드는 소규모 문제이다. 프론트엔드 측의 다중 입력 엣지 처리는 자동완성 품질에 영향을 줄 수 있다. 코드 전체적으로 일관된 컨벤션을 따르고 있으며 심각한 구조적 문제는 없다.

## 위험도
**LOW**