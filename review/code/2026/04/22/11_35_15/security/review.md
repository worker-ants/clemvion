### 발견사항

---

**[WARNING] 기본 루즈 비교(`==`)로 인한 조건 우회 가능성**
- 위치: `condition-evaluator.util.ts:30-31`, `switch.handler.ts:153-155`
- 상세: `eq` / `neq` 연산자의 기본 모드가 JS `==`를 사용합니다. JS 타입 강제 변환의 몇 가지 규칙이 보안 관련 워크플로에서 예기치 않은 결과를 낼 수 있습니다.
  - `null == undefined` → `true` (null 체크 조건이 undefined 값에도 통과)
  - `"" == 0` → `true` (빈 문자열이 숫자 0과 같이 취급)
  - `"0" == false` → `true` (문자열 `"0"`이 `false` 케이스와 매칭)
  
  예: "premium" 플랜 여부를 확인하는 조건이 `planLevel == 1`일 때, 공격자가 `planLevel: "1"` 또는 `planLevel: true`를 주입하면 strict 모드 없이도 매칭될 수 있습니다. `hasDefault: false`가 없는 경우 `default` 브랜치로 폴스루될 수도 있어 잘못된 경로가 실행됩니다.
- 제안: 문서화를 강화하고, 보안 관련 분기 조건(인증·인가·결제 플랜 등)을 다루는 노드는 `strictComparison: true`를 강제하는 검증 로직 또는 UI 경고를 추가하세요. 혹은 기본값을 strict로 변경하고 loose를 opt-in으로 전환하는 것을 검토하세요.

---

**[WARNING] `not_contains` 연산자의 비문자열 입력 시 묵시적 `true` 반환**
- 위치: `condition-evaluator.util.ts:49-52`
- 상세:
  ```typescript
  case 'not_contains':
    return typeof fieldValue === 'string' && typeof compareValue === 'string'
      ? !fieldValue.includes(compareValue)
      : true;  // ← 비문자열이면 항상 true
  ```
  필드 값이 숫자·객체·배열인 경우 `not_contains` 조건이 항상 통과됩니다. 만약 이 조건이 "차단 목록에 없으면 허용" 패턴으로 사용된다면, 타입이 다른 값이 입력될 때 필터가 무력화됩니다.
- 제안: 타입이 문자열이 아닌 경우 `false`를 반환하거나 명시적 에러를 발생시키도록 변경하세요. 최소한 `contains`와 동일하게 `false`를 기본값으로 통일하는 것이 일관성 있습니다.

---

**[WARNING] `getNestedValue`의 프로토타입 오염 방어가 외부 구현에 전적으로 의존**
- 위치: `condition-evaluator.util.ts:28`, `switch.handler.ts`(간접)
- 상세: `condition.field`로 전달되는 경로(`__proto__.constructor`, `constructor.prototype` 등)의 차단이 `getNestedValue` 구현에만 의존합니다. 이번 diff에 해당 구현이 포함되지 않아 검증이 불가능하며, 만약 `getNestedValue`가 향후 변경되거나 다른 경로로 우회되면 프로토타입 오염 벡터가 열릴 수 있습니다.
- 제안: `evaluateCondition` 진입부에서 `condition.field`에 대한 화이트리스트/블랙리스트 검증을 독립적으로 추가하세요.
  ```typescript
  const BLOCKED_PATHS = /(__proto__|prototype|constructor)/;
  if (BLOCKED_PATHS.test(condition.field)) return false;
  ```

---

**[INFO] 에러 메시지에 핸들러 반환값 일부 노출 (production)**
- 위치: `handler-output.adapter.ts:51-55`
- 상세: `adaptHandlerReturn`이 프로덕션에서 핸들러 반환값 최대 200자를 에러 메시지에 포함합니다. 핸들러가 실수로 민감 데이터(API 응답, PII 등)를 반환하면 에러 로그에 노출될 수 있습니다.
- 제안: 에러 메시지에는 반환값의 shape(키 목록)만 포함하고, 실제 값은 제외하는 것을 권장합니다.

---

**[INFO] 컨트롤 필드 스트리핑 변경은 보안 개선**
- 위치: `execution-engine.service.ts` — `stripControlFields` (구 `stripSelectedPort`)
- 상세: 업스트림 노드의 `port` / `status` / `_resumeState` 필드가 다운스트림 노드 입력으로 누수되던 문제를 수정했습니다. 이는 업스트림 노드 출력을 통해 라우팅 로직을 조작할 수 있던 **컨트롤 필드 인젝션 취약점**을 방어하는 올바른 수정입니다.

---

### 요약

이번 변경사항에서 SQL 인젝션, XSS, 하드코딩 시크릿, 인증 우회 등의 고위험 취약점은 발견되지 않았습니다. 컨트롤 필드 스트리핑(`stripControlFields`) 확장은 노드 간 라우팅 메타데이터 주입을 차단하는 명확한 보안 개선입니다. 주요 우려사항은 `condition-evaluator`의 기본 루즈 비교(`==`)로, 보안 관련 분기 조건에서 타입 강제 변환에 의한 예기치 않은 통과가 발생할 수 있습니다. 또한 `not_contains`의 비문자열 묵시적 `true` 반환과 프로토타입 오염 방어의 외부 의존성도 개선이 필요합니다.

### 위험도

**LOW** (단, `==` 기본 비교가 보안 관련 워크플로에 사용되는 경우 **MEDIUM**으로 상향)