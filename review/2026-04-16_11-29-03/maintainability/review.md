## 유지보수성 코드 리뷰

### 발견사항

---

**[INFO]** `NONE_SENTINEL` 상수 위치가 클래스 내부에 있어 외부 참조 시 클래스 이름 노출 필요
- 위치: `text-classifier.handler.ts:17` — `static readonly NONE_SENTINEL = '__none__'`
- 상세: 상수가 `TextClassifierHandler.NONE_SENTINEL`로만 참조 가능. 스키마나 타입 정의에서 독립적으로 사용할 때 클래스 의존성이 생김. 현재 코드에서는 `buildSingleLabelPrompt` 내부에서 `const NONE = TextClassifierHandler.NONE_SENTINEL;`로 재바인딩하는 중복 패턴이 있음.
- 제안: 파일 최상단에 `export const NONE_SENTINEL = '__none__'`로 분리하거나, 클래스 내 참조는 `this.constructor` 대신 `TextClassifierHandler.NONE_SENTINEL`을 직접 쓰는 일관성 유지. 재바인딩(`const NONE = ...`) 패턴 제거하고 직접 참조 사용.

---

**[INFO]** `processSingleLabelResult` / `processMultiLabelResult`의 메타데이터 블록 중복
- 위치: `text-classifier.handler.ts` — 두 `process*` 메서드 모두 동일한 `meta` 블록 반환
- 상세: 아래 코드가 양쪽에 동일하게 복사됨:
  ```ts
  meta: {
    model: result.model,
    inputTokens: result.usage?.inputTokens ?? 0,
    outputTokens: result.usage?.outputTokens ?? 0,
    totalTokens: result.usage?.totalTokens ?? 0,
  }
  ```
- 제안: `private extractMeta(result: ChatResult)` 헬퍼 메서드로 추출.

---

**[INFO]** `buildMultiLabelPrompt` / `buildSingleLabelPrompt` 시그니처가 동일한데 반환 타입 명시 없음
- 위치: `text-classifier.handler.ts:113, :148`
- 상세: 두 빌더 메서드 모두 `{ systemPrompt: string; jsonSchema: Record<string, unknown> }`를 반환하지만 타입 추론에 의존. 리팩터링 시 타입 불일치를 컴파일러가 감지하지 못할 수 있음.
- 제안: 인터페이스 또는 타입 별칭으로 반환 타입 명시:
  ```ts
  interface ClassifierPrompt {
    systemPrompt: string;
    jsonSchema: Record<string, unknown>;
  }
  ```

---

**[WARNING]** `isPortFiltered`에서 multi-port 지원 추가 시 타입 가드 없이 `Array.isArray` 단독 사용
- 위치: `execution-engine.service.ts:2237–2243`
- 상세: `selectedPort`의 타입이 `unknown`으로 추론되는 상황에서 `Array.isArray` 후 `.includes()` 호출은 안전하나, 배열 요소 타입이 `string`임을 보장하는 코드가 없음. LLM 오류 등으로 port 배열에 비문자열이 포함될 경우 예상치 못한 동작 가능.
- 제안:
  ```ts
  if (Array.isArray(selectedPort)) {
    return !selectedPort.some((p) => typeof p === 'string' && p === edgeSourcePort);
  }
  ```
  또는 `NodeHandlerOutput.port`의 타입이 `string | string[]`이므로 상위에서 타입 좁힘 후 전달.

---

**[INFO]** `handler-output.adapter.ts`의 `Array.isArray(port)` 처리 일관성
- 위치: `handler-output.adapter.ts:35, :53`
- 상세: 두 경로(레거시 포트 셀렉터, 베어 오브젝트)에서 동일한 `typeof port === 'string' || Array.isArray(port)` 패턴이 반복됨.
- 제안: `isValidPort` 헬퍼 함수로 추출하여 중복 제거:
  ```ts
  function isValidPort(v: unknown): v is string | string[] {
    return typeof v === 'string' || Array.isArray(v);
  }
  ```

---

**[INFO]** 테스트에서 `(result as any).port` 사용 반복
- 위치: `text-classifier.handler.spec.ts` — 다수 테스트 케이스
- 상세: `port` 필드에 접근할 때 `(result as any).port` 패턴이 약 15회 반복됨. 타입 정보 없이 `any` 캐스팅이 남용되고 있어, 핸들러의 반환 타입이 변경될 경우 컴파일 오류 없이 테스트가 통과할 수 있음.
- 제안: 헬퍼 타입 또는 단언 함수 사용:
  ```ts
  interface ClassifierResult {
    port: string | string[];
    output: Record<string, unknown>;
    meta: Record<string, unknown>;
    config: Record<string, unknown>;
  }
  // 테스트에서
  const result = (await handler.execute(...)) as ClassifierResult;
  ```

---

**[INFO]** Multi-label fallback 텍스트 파싱 시 순서 비결정론 가능성
- 위치: `text-classifier.handler.ts:270–277` — `processMultiLabelResult` catch 블록
- 상세: `result.content?.includes(c.name)`은 텍스트 내 카테고리 이름이 등장하는 순서와 무관하게 `categories` 배열 순서대로 추출됨. 의도된 동작이라면 주석으로 명시 필요.
- 제안: `// Fallback order follows categories array, not text occurrence order` 주석 추가.

---

### 요약

이번 변경은 Text Classifier 노드에 `multiLabel` 모드와 `__none__` 센티널 지원을 추가한 기능 확장으로, 전반적으로 단일 책임 원칙에 따라 `buildSingleLabelPrompt`, `buildMultiLabelPrompt`, `processSingleLabelResult`, `processMultiLabelResult`로 잘 분리되어 있다. `NodeHandlerOutput.port`의 타입을 `string | string[]`으로 확장하고 어댑터와 엔진까지 일관되게 전파한 점도 체계적이다. 다만 `meta` 블록 중복, `const NONE = TextClassifierHandler.NONE_SENTINEL` 재바인딩 패턴, 테스트 내 `as any` 남용 등 소규모 중복 및 타입 안전성 문제가 있어 향후 리팩터링 시 부채가 될 수 있다. 기능 영향 없는 수준이나 지속적으로 누적되면 핸들러 확장 시 복사-붙여넣기 오류 위험이 높아진다.

### 위험도
**LOW**