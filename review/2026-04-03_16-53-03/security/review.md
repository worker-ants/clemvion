## 보안 코드 리뷰 결과

---

### 발견사항

---

#### **[WARNING]** Expression Injection via `col.field` — 사용자 제어 표현식의 직접 실행

- **위치**: `table.handler.ts:113–116`
  ```ts
  if (EXPRESSION_PATTERN.test(col.field)) {
    row[col.field] = evaluate(col.field, itemCtx);
  }
  ```
- **상세**: `col.field`는 워크플로우 설계 시점에 사용자가 입력하는 값입니다. `{{ ... }}` 패턴이 감지되면 표현식 엔진이 직접 실행됩니다. `evaluate()`가 샌드박스 환경에서 안전하게 구현되어 있는지가 핵심인데, 현재 `ExpressionContext` 안에 `$dataSource`, `$sourceItem` 등 런타임 데이터가 직접 주입됩니다. 만약 표현식 엔진이 prototype 접근이나 반복적인 연산(예: `{{ Array(1000000).fill(0) }}`)을 허용한다면 DoS 또는 데이터 유출 가능성이 있습니다.
- **제안**:
  - `evaluator.ts`에 이미 `timeout: 100ms`, `maxDepth: 100` 제한이 있어 기본 보호는 존재합니다. 다만 `$dataSource` 전체 배열이 컨텍스트에 노출되므로, 표현식에서 `$dataSource[0].$sensitiveField` 형태로 다른 행의 민감 데이터를 읽을 수 있습니다.
  - 필요 이상의 컨텍스트 노출 최소화를 검토하세요. 특히 `$dataSource` 전체 배열 대신 현재 항목만 노출하는 방향을 고려하세요.

---

#### **[WARNING]** `col.label` 표현식 결과가 HTML에 렌더링될 때 `escapeHtml` 처리 의존성

- **위치**: `table.handler.ts:189`
  ```ts
  .map((col) => `<th>${this.escapeHtml(col.label)}</th>`)
  ```
- **상세**: `resolveColumnLabels()`에서 `{{ ... }}` 표현식을 통해 `col.label`이 교체된 후, `renderHtml()`에서 `escapeHtml()`을 통해 출력됩니다. `escapeHtml()`이 `&`, `<`, `>`, `"` 를 이스케이프하므로 기본 XSS 방어는 작동합니다. 단, `'` (single quote) 이스케이프가 누락되어 있습니다.
  ```ts
  // 현재
  .replace(/"/g, '&quot;');
  // 누락
  // .replace(/'/g, '&#x27;');
  ```
- **제안**: HTML attribute 컨텍스트에서 single quote가 사용될 경우를 위해 `'` → `&#x27;` 변환을 추가하세요.

---

#### **[WARNING]** `expressionContext`가 `ExecutionContext`를 통해 핸들러 간 공유됨

- **위치**: `execution-engine.service.ts:578–580`
  ```ts
  context.expressionContext = exprContext;
  ```
- **상세**: `ExecutionContext`는 워크플로우 실행 전체를 통해 공유되는 가변 객체입니다. `exprContext`를 각 노드 실행마다 덮어쓰기 때문에, 동시에 실행되는 노드(현재 토폴로지 순서로 실행되지만 이후 병렬 실행 확장 시)가 서로의 컨텍스트를 오염시킬 수 있습니다. 또한 이전 노드의 `$var`, `$node` 데이터가 다음 노드의 표현식 평가에 잔류할 수 있습니다.
- **제안**: `expressionContext`를 `ExecutionContext`의 공유 필드로 유지하지 말고, `handler.execute()` 호출 시 인자로 직접 전달하거나 로컬 스코프로 제한하세요.

---

#### **[INFO]** `EXPRESSION_PATTERN`이 `{{` 시작만 체크 (불완전한 패턴 감지)

- **위치**: `table.handler.ts:15`
  ```ts
  const EXPRESSION_PATTERN = /\{\{/;
  ```
- **상세**: `}}` 닫힘 여부를 확인하지 않습니다. `{{ unterminated` 와 같은 잘못된 입력이 `evaluate()`로 넘어가면 파서 에러가 발생합니다. 에러 핸들링이 없으면 전체 실행이 중단될 수 있습니다.
- **제안**: `evaluate()` 호출 시 try-catch로 감싸 파싱/평가 오류 시 `null`을 반환하거나 명확한 에러 메시지를 제공하세요.

---

#### **[INFO]** `$env` 변수가 `ExpressionContext`에 포함 가능

- **위치**: `evaluator.ts:30`
  ```ts
  $env?: Record<string, string>;
  ```
- **상세**: 직접적인 변경사항은 아니지만, `$dataSource`/`$sourceItem`이 추가되면서 표현식 컨텍스트의 노출 면적이 넓어졌습니다. 표현식에서 `$env.DATABASE_URL`과 같이 환경 변수에 접근 가능한지 확인이 필요합니다. `buildExpressionContext()`가 `$env`를 실제로 주입한다면 Table 노드의 사용자 표현식을 통해 환경 변수가 외부로 노출될 수 있습니다.
- **제안**: `$env`가 실제로 컨텍스트에 주입되는지 확인하고, 주입된다면 Table 노드의 expression 평가 시 `$env`를 제거한 컨텍스트를 사용하는 것을 고려하세요.

---

### 요약

이번 변경에서 가장 주목할 보안 포인트는 **사용자 정의 표현식(`col.field`, `col.label`)이 런타임 데이터가 포함된 컨텍스트에서 직접 평가**된다는 점입니다. `evaluate()`에 timeout/depth 제한이 존재하여 기초적인 DoS 방어는 마련되어 있고, HTML 렌더링에 `escapeHtml()`이 적용되어 직접적인 XSS는 차단됩니다. 그러나 `$dataSource` 전체 배열의 컨텍스트 노출, single quote 미이스케이프, `$env` 접근 가능성, 그리고 `expressionContext`의 공유 가변 상태는 보완이 필요합니다. 전반적으로 구현 방향은 적절하나 컨텍스트 최소 노출 원칙(principle of least privilege)을 표현식 평가 범위에 적용하는 것을 권장합니다.

---

### 위험도

**MEDIUM**