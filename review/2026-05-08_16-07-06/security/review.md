## 발견사항

---

### **[WARNING]** Background 핸들러 — rawConfig 전체 spread로 민감 필드 무제한 노출

- **위치**: `background.handler.ts:46` — `config: { ...rawConfig }`
- **상세**: 다른 핸들러들은 필요한 필드만 명시적으로 echo하는 반면 (e.g., `{ arrayField: rawConfig.arrayField }`), Background 핸들러는 `rawConfig` 전체를 spread한다. 워크플로 작성자가 `rawConfig`에 내부 자격증명 참조, 통합 ID, 서비스 토큰 등의 민감 필드를 설정했을 경우, 모두 output `config`에 포함된다. Background 노드는 pass-through이므로 향후 어떤 필드가 추가될지 예측 불가능하다.
- **제안**: 다른 핸들러와 일관되게, 실제로 필요한 필드만 명시적으로 선택해 echo한다.

```typescript
// 현재
config: { ...rawConfig }

// 개선 예시 (Background 노드의 실제 schema 필드 기준)
config: {
  label: rawConfig.label,
  // Background 노드에 필요한 필드만 명시
}
```

---

### **[WARNING]** 이중 템플릿 평가(Double Evaluation) 인젝션 위험

- **위치**: 전체 패턴 (`rawConfig.systemPrompt`, `rawConfig.conditions`, `rawConfig.userPrompt` 등)
- **상세**: `config` echo에 `{{ $userInput.field }}` 형태의 raw 템플릿이 저장된다. 만약 이 echoed config가 이후 실행의 입력으로 재사용되거나, 저장된 execution 결과가 다음 워크플로의 config로 바인딩되는 패턴이 있다면 이중 평가가 발생할 수 있다. 예를 들어 사용자가 `{{ $input.userControlled }}` 를 입력하고, 그 `$input.userControlled` 값이 `{{ $secrets.apiKey }}` 라면, 두 번째 평가 시 실제 비밀값이 노출된다.
- **제안**: 엔진 레벨에서 echoed config가 재평가 입력으로 절대 사용되지 않음을 명시적으로 보장해야 한다. `rawConfig`의 출처(workflow author config만 허용, runtime user input 불허)에 대한 타입 레벨 제약 또는 명시적 문서화가 필요하다.

---

### **[WARNING]** DatabaseQuery 핸들러 — raw query·parameters echo로 정보 노출

- **위치**: `database-query.handler.ts:111-118`
- **상세**: 변경 전에는 `queryType` 필드가 evaluated value로 echo되었으나, 변경 후에는 `rawConfig.query`와 `rawConfig.parameters`가 그대로 echo된다. 실제 DB 실행은 `config.query` (evaluated)를 사용하므로 SQL Injection 위험은 없다. 그러나 `rawConfig.parameters`에 `{{ $secrets.dbPassword }}` 같은 민감 참조가 포함된 경우, 이 template 문자열 자체가 execution 결과 로그나 클라이언트 응답에 노출된다. 또한 raw query template은 DB 스키마 구조(테이블명, 컬럼명)를 execution 결과로 노출한다.
- **제안**: parameters echo 시 민감 필드를 마스킹하거나, parameters는 echo에서 제외한다. query echo는 필요성을 재검토한다.

---

### **[WARNING]** AiAgent — rawConfig 없을 때 evaluated systemPrompt/userPrompt fallback

- **위치**: `ai-agent.handler.ts:743-745`
- **상세**:
  ```typescript
  systemPrompt: rawConfig.systemPrompt ?? systemPrompt,
  userPrompt: rawConfig.userPrompt ?? userPrompt,
  ```
  `rawConfig`에 해당 필드가 없을 경우 evaluated 값(`systemPrompt`, `userPrompt`)으로 fallback된다. 이 경우 LLM이 생성한 내용이나 외부 데이터 소스에서 가져온 내용이 평가된 후 `config` echo에 포함될 수 있다. CONVENTIONS Principle 7의 취지(raw template 보존)와 상충한다.
- **제안**: fallback 없이 `rawConfig.systemPrompt`만 사용하거나, rawConfig 필드 누락 시 `undefined`를 명시적으로 허용한다.

---

### **[INFO]** Code 핸들러 — 실행 코드 소스 echo

- **위치**: `code.handler.ts:178-180`
- **상세**: `rawConfig.code` (코드 소스 전문)가 `config` echo에 포함된다. 실행은 evaluated `config.code`를 사용하므로 코드 인젝션 위험은 없다. 그러나 코드 내부에 하드코딩된 내부 API endpoint, 비즈니스 로직, 민감 알고리즘이 있을 경우 execution 결과로 그대로 노출된다. 또한 `logs` 필드(코드 실행 출력)도 함께 포함되어 있어 코드가 출력한 민감 정보가 노출될 수 있다.
- **제안**: `code` 필드를 echo에서 제외하거나, 최소한 문서에 "코드 소스가 execution 기록에 저장됨"을 명기한다.

---

### **[INFO]** 다중 `as unknown as Type` 캐스팅으로 타입 안전성 우회

- **위치**: `filter.handler.ts`, `if-else.handler.ts`, `loop.handler.ts`, `switch.handler.ts`, `workflow.handler.ts` 등 다수
- **상세**:
  ```typescript
  const rawConfig = (context.rawConfig ?? config) as unknown as FilterConfig;
  ```
  `as unknown as T` 이중 캐스팅은 TypeScript 타입 시스템을 완전히 우회한다. `context.rawConfig`는 `Record<string, unknown>` 타입이므로 실제 값이 `FilterConfig` 인터페이스를 만족하지 않아도 컴파일 에러가 발생하지 않는다. 런타임에 `rawConfig.conditions`가 배열이 아닌 다른 타입일 경우 예상치 못한 동작이 발생할 수 있다.
- **제안**: `rawConfig`에서 필드를 추출할 때 타입 가드 또는 런타임 검증을 추가한다.

---

### **[INFO]** Parallel 핸들러 — context 파라미터 옵셔널로 인터페이스 불일치

- **위치**: `parallel.handler.ts:32`
- **상세**: `NodeHandler` 인터페이스의 다른 구현체들은 모두 `context: ExecutionContext`를 필수로 받지만, `ParallelHandler`만 `context?: ExecutionContext`로 선언한다. 이로 인해 엔진이 context 없이 호출할 경우 `rawConfig` 없이 `config`로 fallback되어 echo 일관성이 깨진다. 또한 향후 context를 사용하는 로직이 추가될 때 null 체크 누락 버그가 발생할 수 있다.
- **제안**: 다른 핸들러와 동일하게 `context: ExecutionContext`를 필수 파라미터로 변경한다.

---

### **[INFO]** multi-turn state.rawConfig 무검증 캐스팅

- **위치**: `ai-agent.handler.ts:1181`
- **상세**:
  ```typescript
  const turnRawConfig =
    (state.rawConfig as Record<string, unknown> | undefined) ?? {};
  ```
  `state`는 외부에서 주입되는 데이터인데, `state.rawConfig`를 검증 없이 캐스팅한다. state가 DB에서 로드되거나 외부 시스템에서 전달된 경우, 악의적으로 조작된 `state.rawConfig`가 echo로 전달될 수 있다. 특히 multi-turn AI 대화에서 state가 여러 단계를 거쳐 축적되는 만큼, 중간 단계에서 오염 가능성을 검토해야 한다.
- **제안**: `state.rawConfig`를 사용하기 전에 기본적인 타입 검증(객체 여부 확인)을 수행한다.

---

## 요약

이번 변경(CONVENTIONS Principle 7 — rawConfig echo)은 전체적으로 SQL Injection, XSS, Command Injection 등 직접적인 취약점을 새로 도입하지는 않는다. `rawConfig`는 workflow 작성자의 원본 설정이며, 실제 실행(LLM 호출, DB 쿼리, 코드 실행)은 여전히 engine이 평가한 `config`를 사용하기 때문이다. 다만 세 가지 위험이 잠재한다: (1) `Background` 핸들러의 무제한 spread는 향후 민감 필드 추가 시 자동 노출 경로가 된다, (2) echoed config의 이중 평가(double evaluation) 경로가 엔진 레벨에서 명시적으로 차단되어 있는지 확인이 필요하다, (3) `DatabaseQuery`의 raw query/parameters echo는 DB 스키마와 민감 참조를 execution 기록으로 영구화한다. 타입 안전성 측면에서 `as unknown as T` 패턴이 광범위하게 사용되고 있어 런타임 타입 오류에 대한 방어가 부족하다.

---

## 위험도

**LOW ~ MEDIUM**

직접적 익스플로잇 경로는 발견되지 않으나, Background 핸들러 spread와 이중 평가 위험은 시스템 아키텍처 이해 없이는 안전성을 보장하기 어려운 잠재적 위험이다.