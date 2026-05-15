### 발견사항

- **[WARNING]** `Condition` 인터페이스 타입 완화 — 잠재적 breaking change
  - 위치: `condition-eval.util.ts:38` — `field: string` → `field: unknown`
  - 상세: 이 인터페이스를 import해서 `Condition` 객체를 생성하거나 `field`를 string으로 narrowing 없이 사용하는 모든 소비자의 타입 안전성이 저하됩니다. `evaluateCondition`을 직접 호출하는 코드(if-else 핸들러, rule 엔진 등)에서 타입 오류가 숨겨질 수 있습니다.
  - 제안: `field: string | undefined` 또는 `field?: string`으로 의도를 명시하는 것이 더 좁고 안전합니다. `unknown`은 "resolved non-string value"가 유입될 수 있는 internal path임을 숨깁니다.

- **[WARNING]** `ExecutionContext.expressionContext` — 선언되지 않은 프로퍼티 접근
  - 위치: `filter.handler.ts:68` — `context.expressionContext ?? {}`
  - 상세: `ExecutionContext` 인터페이스에 `expressionContext` 가 선언되어 있지 않다면, TypeScript 컴파일러가 `any`로 처리하거나 타입 오류를 발생시킵니다. `?? {}` fallback이 있어 런타임에는 안전하지만, 인터페이스 계약이 불명확해집니다.
  - 제안: `ExecutionContext` 인터페이스에 `expressionContext?: Record<string, unknown>` 또는 `expressionContext?: EngineContext`를 명시적으로 추가해야 합니다.

- **[INFO]** validation 계약 변경 — 기존 거부 케이스가 승인으로 전환
  - 위치: `filter.schema.ts:122` — `!cond.field` 거부 제거
  - 상세: 이전에는 `field` 누락 조건을 `BlockingError`로 처리했습니다. 이제 허용됩니다. 이 변경은 더 permissive한 방향이므로 기존 유효한 요청은 그대로 통과하지만, 상위 레이어(프론트엔드 빌더, API 클라이언트)가 `field` 없는 조건을 "잘못된 입력"으로 간주하고 사전 거부하는 로직이 있다면 server-side와 불일치가 발생합니다.
  - 제안: 프론트엔드 `condition-builder` 위젯 및 API 문서에 `field` 생략이 유효함을 명시해야 합니다.

- **[INFO]** `compileRegexCache` export 유지되나 filter handler에서 미사용
  - 위치: `condition-eval.util.ts` — 함수는 여전히 export됨, `filter.handler.ts`는 `MAX_REGEX_LENGTH`로 교체
  - 상세: `compileRegexCache`를 사용하는 다른 노드 핸들러(if-else 등)가 있다면 영향 없음. 단, 이 함수는 이제 filter 노드와 동작 모델이 다르므로(사전 컴파일 vs. per-item 메모이즈) 두 모델이 공존하는 것이 장기적으로 혼란을 줄 수 있습니다.
  - 제안: `compileRegexCache`를 사용하는 다른 핸들러가 없다면 deprecated 표시 또는 제거를 검토하세요.

- **[INFO]** silent expression evaluation failure — `null` 반환 계약 비명시
  - 위치: `filter.handler.ts:164` — `catch { return null; }`
  - 상세: 표현식 평가 실패 시 `null`을 반환해 해당 item을 `unmatched`로 처리합니다. 이 동작이 API 응답 계약에 문서화되어 있지 않아 호출자 입장에서 "왜 이 item이 unmatched인가"를 디버깅하기 어렵습니다. 플랜 문서는 `meta.expressionEvalErrors` 노출을 후속 과제로 인식하고 있으나, 현재 계약에는 포함되지 않습니다.
  - 제안: 응답 payload에 `meta: { expressionEvalErrors?: ... }` 필드를 추가하거나, 최소한 `ExecutionContext`의 로깅 채널을 통해 디버깅 정보를 남기는 것을 권장합니다.

---

### 요약

이번 변경은 HTTP REST API 엔드포인트가 아닌 내부 노드 핸들러 계약에 해당합니다. 가장 주목할 부분은 `Condition.field`의 타입이 `string`에서 `unknown`으로 완화된 것과, `ExecutionContext`에 선언되지 않은 `expressionContext` 프로퍼티를 사용하는 것입니다. 두 이슈 모두 런타임에서는 정상 동작하지만 타입 수준의 계약 명확성을 훼손합니다. validation 계약 변경(field 누락 허용)은 서버-클라이언트 간 유효성 기대치 불일치 가능성이 있으므로 프론트엔드 측 동기화가 필요합니다. 전반적으로 응답 형식과 에러 처리 구조는 기존 계약을 유지하고 있어 중대한 breaking change는 없습니다.

### 위험도
**LOW**