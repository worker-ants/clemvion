## 보안 코드 리뷰 결과

### 발견사항

---

#### **[CRITICAL]** 표현식 인젝션 / 서버사이드 템플릿 인젝션 (SSTI) 위험

- **위치:** `ai-agent.schema.ts` — `systemPrompt`, `userPrompt`, `model` 필드 (`widget: 'expression'`)
- **상세:** `systemPrompt`와 `userPrompt`는 `{{ expression }}` 템플릿 문법을 지원하며, 이는 서버에서 평가됩니다. 악의적인 사용자가 `{{ process.env }}`, `{{ require('child_process').exec(...) }}` 같은 표현식을 주입할 경우, 서버사이드 코드 실행으로 이어질 수 있습니다. 특히 AI 에이전트의 `systemPrompt`는 LLM 동작을 직접 제어하므로 프롬프트 인젝션(Prompt Injection)도 동시에 발생합니다.
- **제안:** 표현식 평가 시 허용 변수 화이트리스트를 적용하고, 샌드박스 환경(vm2, isolated-vm 등)에서 실행하세요. 서버에서 표현식 평가 전 변수 참조를 검증하고 `$input`, `$node`, `$var` 등 제한된 컨텍스트만 노출하세요.

---

#### **[CRITICAL]** `.passthrough()`로 인한 임의 필드 주입

- **위치:** `ai-agent.schema.ts:283`, `carousel.schema.ts`, `table.schema.ts`, `buttonDefSchema`, `itemDefSchema` — 모두 `.passthrough()` 사용
- **상세:** 모든 노드 설정 스키마가 `.passthrough()`를 사용하므로, 스키마에 정의되지 않은 임의 필드가 유효성 검사 없이 통과됩니다. 공격자가 `__handler`, `_internalFlag`, `adminOverride` 같은 필드를 설정 객체에 포함시켜 백엔드 실행 컨텍스트에 의도치 않은 데이터를 주입할 수 있습니다.
- **제안:** `.passthrough()` 대신 `.strip()`(기본값)을 사용하거나, 백엔드 실행 핸들러에서 사용 전 반드시 알려진 필드만 추출하세요.

---

#### **[WARNING]** `clearFields`를 통한 프로토타입 오염 가능성

- **위치:** `schema-form.tsx:174-179`
- **상세:**
  ```typescript
  if (ui?.clearFields) {
    for (const f of ui.clearFields) {
      delete updated[f];  // f가 '__proto__', 'constructor', 'toString'일 경우
    }
  }
  ```
  `clearFields` 값이 백엔드 스키마를 통해 오며, 스키마 정의가 변조되거나 악의적인 노드 정의가 등록된 경우 `__proto__`, `constructor` 같은 예약 키를 삭제 대상으로 지정할 수 있습니다. 스프레드 객체에서의 `delete`는 직접적 프로토타입 오염보다 위험도가 낮지만, 방어적 프로그래밍이 필요합니다.
- **제안:**
  ```typescript
  const SAFE_FIELD_RE = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
  for (const f of ui.clearFields) {
    if (SAFE_FIELD_RE.test(f) && Object.prototype.hasOwnProperty.call(updated, f)) {
      delete updated[f];
    }
  }
  ```

---

#### **[WARNING]** 사용자 입력 JSON 비검증 파싱

- **위치:** `widgets.tsx` — `FieldArrayWidget` 폴백 textarea
- **상세:**
  ```typescript
  onChange={(e) => {
    try {
      update(i, JSON.parse(e.target.value));
    } catch {
      /* ignore parse errors while typing */
    }
  }}
  ```
  사용자가 직접 입력한 JSON을 무제한 파싱합니다. 파싱된 객체가 최종적으로 백엔드에 저장되고 실행될 때, 스키마 검증을 우회한 임의 구조가 포함될 수 있습니다. 특히 `.passthrough()` 스키마와 결합되면 위험도가 높아집니다.
- **제안:** JSON 파싱 후 해당 필드의 스키마(`schema.items`)로 재검증하거나, 알려진 최대 크기(예: 64KB)를 초과하는 입력을 차단하세요.

---

#### **[WARNING]** `jsonSchema` 필드 — 임의 JSON 스키마 주입

- **위치:** `ai-agent.schema.ts` — `jsonSchema: z.record(z.string(), z.unknown())`
- **상세:** 사용자가 LLM 응답 파싱에 사용될 JSON Schema를 직접 정의할 수 있습니다. 서버에서 이 스키마로 LLM 응답을 검증/파싱할 때, 악의적으로 구성된 스키마(재귀 `$ref`, 과도한 중첩 등)가 ReDoS나 메모리 과부하를 유발할 수 있습니다.
- **제안:** JSON Schema 최대 깊이/크기 제한을 적용하고, `$ref`를 통한 외부 참조를 금지하세요. 서버에서 스키마 평가 전 구조적 유효성 검사를 추가하세요.

---

#### **[WARNING]** `visibleWhen` DSL — 타입 미검증으로 인한 로직 우회

- **위치:** `visibility.ts:15-20`
- **상세:**
  ```typescript
  if ("equals" in rule) return value === rule.equals;
  if ("notEquals" in rule) return value !== rule.notEquals;
  if ("oneOf" in rule) return Array.isArray(rule.oneOf) && rule.oneOf.includes(value);
  ```
  `rule.equals`의 값 타입이 `unknown`이므로 `{field: "mode", equals: {"__proto__": null}}` 같은 객체 비교가 가능합니다. 또한 `oneOf.includes(value)`는 객체 참조 비교를 수행하므로 의도치 않게 필드가 숨겨지거나 노출될 수 있습니다.
- **제안:** 비교 대상 값을 문자열/숫자/불린 기본 타입으로 제한하고, TypeScript 타입 가드로 강화하세요.

---

#### **[INFO]** 타입 단언(as)으로 런타임 검증 우회

- **위치:** `selector-widgets.tsx:9`, `table-grid-widget.tsx:27-30`
- **상세:**
  ```typescript
  value={(value as string) ?? ""}  // LlmConfigSelectorWidget
  const data = (value as Record<string, unknown>) ?? {};  // TableGridWidget
  ```
  TypeScript `as` 단언은 런타임 검증을 수행하지 않습니다. 값 타입이 예상과 다를 경우 하위 컴포넌트로 잘못된 타입이 전달될 수 있습니다.
- **제안:** 런타임 타입 검사를 추가하세요: `typeof value === 'string' ? value : ''`

---

#### **[INFO]** `key={i}` 사용 — 보안과 무관하나 데이터 무결성 위험

- **위치:** `widgets.tsx:255` — `key={i}`, `table-grid-widget.tsx` 동일
- **상세:** 배열 인덱스를 React key로 사용하면 항목 삭제/재정렬 시 상태가 잘못된 항목에 매핑될 수 있습니다. 보안 이슈는 아니지만 데이터 손상 시나리오에서 잘못된 설정이 저장될 수 있습니다.
- **제안:** `buttonDefSchema`처럼 안정적인 `id` 필드를 배열 아이템에 추가하고 이를 key로 사용하세요.

---

### 요약

이번 변경은 스키마 기반 자동 폼(auto-form) 시스템 확장이 핵심입니다. **보안상 가장 우선 처리해야 할 위험은 두 가지**입니다: (1) 표현식 위젯(`widget: 'expression'`)이 서버에서 어떻게 평가되는지에 따라 SSTI 및 프롬프트 인젝션 위험이 존재하며, (2) 모든 설정 스키마에 `.passthrough()`가 적용되어 미정의 필드가 실행 컨텍스트에 그대로 유입될 수 있습니다. `clearFields` 로직의 프로토타입 오염 가능성과 `jsonSchema` 필드를 통한 임의 스키마 주입은 중간 수준 위험으로, 백엔드 처리 방식에 따라 실제 영향도가 결정됩니다. 프론트엔드 코드 자체는 서버 데이터를 렌더링할 때 React의 기본 이스케이핑에 의존하고 있어 XSS 직접 노출은 낮습니다.

### 위험도

**HIGH**