## 보안 코드 리뷰

### 발견사항

---

**[CRITICAL] Expression Injection — `evaluate()` 호출 시 코드 실행 가능성**
- 위치: `filter.handler.ts` — `resolveIfExpression()` 메서드 / `computeFieldValue()`
- 상세: `evaluate(value, ctx)` 는 `@workflow/expression-engine` 의 함수이며, 사용자가 author한 `condition.field`·`condition.value` 문자열이 그대로 전달된다. 만약 엔진 내부가 `eval()` / `new Function()` 기반이라면 `{{ process.env.SECRET_KEY }}`, `{{ require('child_process').execSync('id').toString() }}` 같은 페이로드로 서버 코드 실행이 가능하다. `resolveIfExpression` 의 `try/catch` 는 에러를 흡수할 뿐 실행 자체를 막지 않는다.
- 제안:
  1. `@workflow/expression-engine` 의 `evaluate` 구현이 샌드박스(AST 해석, 화이트리스트 operator) 기반인지 즉시 확인.
  2. `eval()` / `new Function()` 기반이면 이 변경은 **배포 불가** 수준의 취약점. 엔진 측에서 `process`, `require`, `global`, `__proto__`, `constructor` 등에 대한 접근을 차단하는지 검증 필요.
  3. 다른 노드(TableHandler 등)도 동일 엔진을 사용하므로 전체 표면 재검토 필요.

---

**[WARNING] ReDoS — 정규식 길이 제한만으로는 부족**
- 위치: `filter.handler.ts:getRegex()` / `condition-eval.util.ts:MAX_REGEX_LENGTH = 200`
- 상세: `MAX_REGEX_LENGTH = 200` 은 패턴 길이를 제한하지만 카타스트로픽 백트래킹(ReDoS)을 막지 못한다. 다음은 200자 미만이지만 지수 시간이 걸리는 예시다:
  ```
  (a+)+b           # 9자
  ([a-z]+)*@       # 10자
  ^(a|aa)+$        # 9자
  ```
  사용자가 `condition.value` 에 이런 패턴을 넣으면 Node.js 이벤트 루프를 블로킹해 DoS가 된다.
- 제안:
  1. 단기: `+`, `*`, `{n,m}` 퀀티파이어가 그룹과 중첩될 때 거부하는 간단한 사전 검사 추가.
  2. 중기: `safe-regex` 또는 `re2` 라이브러리 도입 — `new RegExp(p)` 대신 RE2 엔진 사용 시 선형 시간을 보장.
  3. 서버 측 실행이면 타임아웃 + Worker Thread 격리도 검토.

---

**[WARNING] Context Spreading — baseCtx 오염 위험**
- 위치: `filter.handler.ts:100-104`
  ```ts
  const itemCtx: EngineContext = {
    ...baseCtx,
    $item: item,
    $itemIndex: index,
  };
  ```
- 상세: `baseCtx`는 `context.expressionContext`에서 온다. 이 값이 이전 노드의 실행 결과(사용자 데이터)를 포함할 경우, 다음 두 위험이 존재한다.
  1. `baseCtx`에 `$item` 키가 이미 있으면 스프레드 순서상 현재 `item`으로 덮어쓰인다 — 이건 의도된 동작이므로 OK.
  2. 반대로 `item` 자체가 `__proto__`, `constructor`, `toString` 같은 키를 가진 객체라면, expression engine이 컨텍스트를 단순 객체로 처리할 때 prototype pollution이 발생할 수 있다.
- 제안:
  1. `itemCtx` 생성 시 `Object.create(null)` 기반 또는 엔진이 prototype-safe 컨텍스트를 요구하는지 확인.
  2. `item`이 plain object 인지 가드: `item !== null && typeof item === 'object' && !Array.isArray(item)` 가 아니어도 expression에서 키 접근이 가능한지 엔진 문서 확인.

---

**[WARNING] Silent Evaluation Failure — 보안 관련 에러 은닉 가능성**
- 위치: `filter.handler.ts:resolveIfExpression()`
  ```ts
  } catch {
    return null;
  }
  ```
- 상세: expression 평가 중 발생한 모든 예외를 소리 없이 `null`로 치환한다. 이는 정상 오작동 상황에서는 합리적이지만, expression injection 시도 시 발생하는 에러(예: 샌드박스 탈출 시도 감지 에러)도 같이 묻혀 **보안 이벤트가 로깅되지 않는다**.
- 제안:
  1. 최소한 `logger.warn` 수준으로 평가 실패 이벤트를 기록 (스택 트레이스 노출 금지, 단 식별 가능한 메시지).
  2. 반복적 평가 실패가 특정 IP/워크플로우에서 발생하면 알림을 보내는 rate-limiting 검토.

---

**[INFO] Loose Comparison Default — 의도하지 않은 타입 강제 허용**
- 위치: `filter.handler.ts:55` / `condition-eval.util.ts:eq`, `neq` 케이스
- 상세: `strictComparison = false` 가 기본값이므로 `==` 비교가 기본이다. `0 == false`, `"" == false`, `null == undefined` 등 자바스크립트 타입 강제가 적용된다. 공격 벡터라기보다는 필터 우회(예: `null == undefined`를 이용해 의도하지 않은 항목이 match에 포함) 가능성이 있다.
- 제안: UX에서 기본값을 `strictComparison: true`로 변경하거나, 사용자에게 non-strict 모드의 타입 강제 동작을 UI 힌트로 명시.

---

**[INFO] `field: unknown` 타입 확장 — 미검증 비문자열 통과 경로**
- 위치: `condition-eval.util.ts:Condition.field` → `evaluateCondition()` 마지막 분기
  ```ts
  const path = condition.field;
  const fieldValue =
    typeof path !== 'string' || path === '' || path === '$item'
      ? item
      : getNestedValue(item, path);
  ```
- 상세: `path`가 `number`, `object`, `array`인 경우 `item` 자체를 반환한다. `filter.schema.ts`에서 비문자열 explicit field는 이미 거부하므로 **정상 경로**에서는 이 분기가 도달하기 어렵다. 그러나 스키마 검증을 우회해 직접 `evaluateCondition`을 호출하는 내부 경로가 있다면 예상치 못한 동작이 발생할 수 있다.
- 제안: `condition-eval.util.ts`의 `evaluateCondition` 자체에 간단한 assert 주석 또는 내부 타입 가드 추가로 의도를 명시 (런타임 가드는 불필요하지만 문서화 목적).

---

### 요약

이번 변경의 핵심 보안 리스크는 `@workflow/expression-engine` 의 `evaluate()` 에 사용자 authored 문자열을 직접 전달하는 패턴이다. 이 엔진이 AST 기반 샌드박스이면 위험도는 낮아지나, `eval()` / `new Function()` 기반이면 Remote Code Execution(RCE) 수준의 취약점이 된다. 이 점을 배포 전 반드시 확인해야 하며, 엔진의 샌드박스 보장이 없다면 현 변경은 보류가 필요하다. ReDoS는 별도로 실제 DoS 경로이며 `safe-regex` 또는 RE2 도입으로 해소 가능하다. 나머지 항목들은 운영 환경의 관측 가능성 및 방어 심도 관련 개선 사항이다.

---

### 위험도

**HIGH** — expression engine의 샌드박스 여부가 확인되기 전까지. 샌드박스가 검증되면 **MEDIUM** (ReDoS 미조치 시).