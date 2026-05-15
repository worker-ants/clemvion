## Security Code Review

---

### 발견사항

---

**[WARNING] LLM 프롬프트에 설정값 직접 삽입 (Prompt Injection)**
- 위치: `text-classifier.handler.ts` — `buildSingleLabelPrompt()`, `buildMultiLabelPrompt()`
- 상세: `instructions`, `categoryList` (카테고리 이름·설명)이 시스템 프롬프트에 이스케이프 없이 템플릿 리터럴로 삽입됨. 특히 `instructions`와 카테고리 `description`은 워크플로우 설계자가 자유롭게 입력하는 값이어서, 악의적 또는 실수로 작성된 지시문이 LLM 시스템 프롬프트를 오염시킬 수 있음.
  ```ts
  // buildSingleLabelPrompt
  ${instructions ? `Additional instructions: ${instructions}\n` : ''}
  ```
  현재 스펙상 `instructions`는 워크플로우 설계자(owner) 권한 범위이므로 외부 공격자가 직접 조작하기는 어려움. 그러나 설계자가 상위 시스템에서 외부 입력을 `instructions`에 연결하는 경우 2차 프롬프트 인젝션이 발생할 수 있음.
- 제안: `instructions` 및 카테고리 필드에 최대 길이 제한(`instructions` ≤ 2,000자, category description ≤ 500자 등)을 `validate()`에 추가하고, 잠재적으로 위험한 메타 지시 패턴(`ignore previous instructions`, `[SYSTEM]` 등)에 대한 경고 로깅을 고려.

---

**[WARNING] 폴백 텍스트 매칭에서의 부분 문자열 오탐**
- 위치: `text-classifier.handler.ts` — `processSingleLabelResult()` 및 `processMultiLabelResult()`의 catch 블록
- 상세: JSON 파싱 실패 시 LLM 원문 응답에서 카테고리 이름을 `String.includes()`로 찾는 폴백 로직이 있음. 이름이 짧거나 일반적인 단어인 경우(예: `"A"`, `"General"`, `"Tech"`) LLM 오류 메시지 또는 무관한 텍스트에서 오탐이 발생해 의도하지 않은 포트로 라우팅될 수 있음. Multi-label 모드에서는 매칭 카테고리가 복수이므로 영향 범위가 더 넓음.
  ```ts
  // processMultiLabelResult fallback
  if (result.content?.includes(c.name)) {
    matchedCategories.push({ name: c.name, ... });
  }
  ```
- 제안: 폴백 매칭 시 단어 경계(`\b{name}\b`) 기반 정규표현식 매칭 사용, 또는 LLM JSON 파싱 실패 자체를 `fallback` 포트로 처리하는 엄격 모드 옵션 제공.

---

**[WARNING] execute()에서 config 구조 미검증**
- 위치: `text-classifier.handler.ts` — `execute()` 메서드
- 상세: `execute()` 내에서 `config.categories as Category[]` 등 모든 필드에 런타임 검증 없이 타입 단언만 사용. `validate()`를 우회한 채 `execute()`가 직접 호출되는 경우(테스트, 내부 호출 등) 구조 불일치로 인해 예외가 발생하거나 예상치 못한 동작이 유발될 수 있음.
  ```ts
  const categories = config.categories as Category[];
  // categories가 undefined이거나 빈 배열이면 이후 로직에서 런타임 에러 발생
  ```
- 제안: `execute()` 진입부에서 최소한의 필수 필드 존재 여부(`categories`, `inputField`)를 확인하고, 없으면 `error` 포트로 안전하게 라우팅.

---

**[INFO] LLM API 오류 메시지의 출력 노출**
- 위치: `text-classifier.handler.ts` — `execute()` catch 블록
- 상세: LLM API 에러 메시지가 필터링 없이 `output.error`에 포함되어 다운스트림 노드로 전달됨. 공급자에 따라 API 엔드포인트, 요청 ID, 계정 정보 등이 오류 메시지에 포함될 수 있음.
  ```ts
  output: {
    error: error instanceof Error ? error.message : String(error),
  }
  ```
- 제안: 외부 노출 전 오류 메시지를 일반화하거나, 상세 메시지는 서버 로그에만 기록하고 클라이언트에는 코드화된 에러(`LLM_API_ERROR` 등)만 노출.

---

**[INFO] `__none__` 예약어 검증이 validate()에만 존재**
- 위치: `text-classifier.handler.ts` — `execute()` / `processSingleLabelResult()`
- 상세: `__none__` 예약어 사용 금지는 `validate()`에서만 체크됨. `execute()`는 별도로 검증하지 않아, `validate()`를 거치지 않는 경로(내부 직접 호출 등)에서 `__none__`이 카테고리명으로 들어오면 폴백 라우팅 로직이 오동작할 수 있음.
- 제안: `execute()` 내에서도 카테고리명에 `__none__` 포함 여부를 방어적으로 확인하거나, 예약어 필터링을 별도 유틸리티 함수로 분리하여 양쪽에서 호출.

---

**[INFO] Array.isArray() 검사 시 배열 원소 타입 미검증**
- 위치: `execution-engine.service.ts` — `isPortFiltered()`, `handler-output.adapter.ts`
- 상세: `Array.isArray(selectedPort)` 확인 후 `selectedPort.includes(edgeSourcePort)`를 호출하지만, 배열 원소가 실제로 `string`인지 검증하지 않음. 원소에 비문자열이 포함되어 있어도 런타임 에러 없이 비교가 수행되므로 오동작 가능성이 낮지만, 타입 안정성이 보장되지 않음.
- 제안: 필요하다면 `selectedPort.every(p => typeof p === 'string')` 방어 조건 추가. 현재 코드 흐름상 위험도는 낮음.

---

**[INFO] 카테고리 수 및 텍스트 크기 제한 없음**
- 위치: `text-classifier.handler.ts` — `validate()`, `text-classifier.schema.ts`
- 상세: 카테고리 최대 개수 및 각 카테고리 필드의 최대 길이에 대한 제한이 없음. 다수의 카테고리나 과도하게 긴 description, examples가 설정될 경우 LLM 토큰 소비가 급증할 수 있음 (Token DoS 가능성).
- 제안: `validate()`에서 카테고리 최대 개수(예: 50개), description 최대 길이, examples 최대 개수에 대한 상한 검증 추가.

---

### 요약

이번 변경의 주요 보안 이슈는 LLM 프롬프트 인젝션, 폴백 텍스트 매칭의 오탐, 그리고 런타임 입력 미검증 세 가지다. `instructions`와 카테고리 메타데이터가 시스템 프롬프트에 직접 삽입되는 구조는 현재 접근 권한이 워크플로우 설계자로 제한되어 있어 즉각적인 외부 공격 경로는 없지만, 설계자가 외부 입력을 해당 필드에 연결하는 경우 2차 인젝션이 가능하며, JSON 파싱 실패 시의 부분 문자열 폴백은 의도하지 않은 라우팅을 유발할 수 있어 운영 신뢰성과 보안 모두에 영향을 준다. 하드코딩된 시크릿, SQL 인젝션, 인증 우회 등의 전통적 취약점은 발견되지 않았으며, Zod 스키마 기반의 설정 유효성 검사 구조와 `__none__` 예약어 메커니즘은 LLM 응답 처리의 안전성을 높이는 긍정적 설계다.

### 위험도

**MEDIUM**