---

## 발견사항

### **[WARNING]** 스펙 정의 참조 변수 누락: `$trigger`, `$env`
- **위치**: `use-expression-suggestions.ts:19-29` (ROOT_VARIABLES), `variable-picker.tsx:28-35` (BUILT_IN_VARIABLES)
- **상세**: 스펙 §4.1에서 명시한 `$trigger` (트리거 데이터)와 `$env` (환경 변수)가 자동완성 제안 및 변수 피커 양쪽 모두에서 누락되어 있음. `$trigger`는 webhook payload 등 트리거 노드에서 필수적으로 참조하는 변수임.
- **제안**: ROOT_VARIABLES에 `$trigger`와 `$env`를 추가. BUILT_IN_VARIABLES에도 동일하게 추가.

---

### **[WARNING]** 다중 predecessor 연결 시 `inputSample` 미완성
- **위치**: `use-expression-context.ts:74-79`
- **상세**: `incomingEdges.length > 1`인 경우 `inputFields`에 source node ID 목록만 push하고 `inputSample = {}`을 유지. `$input.` 자동완성 시 source node ID들이 필드명으로 표시되어 사용자에게 혼란을 줌. 스펙 §3.2 "직전 연결 노드의 출력"의 다중 입력 케이스에 대한 명확한 처리 정의가 없는 상태.
- **제안**: 다중 입력이 있는 경우 `$input`이 의미 없음을 나타내는 힌트 또는 피커에서 `$input` 섹션을 숨기는 처리 필요.

---

### **[WARNING]** 미실행 워크플로우 힌트 미구현
- **위치**: `use-expression-suggestions.ts` 전반, `variable-picker.tsx` 전반
- **상세**: 스펙 §8.4.2: "미실행 워크플로우에서 필드 제안은 '워크플로우를 먼저 실행하세요' 힌트를 표시해야 함." 현재 구현은 실행 결과가 없을 때 단순히 빈 배열을 반환하고, 피커에서도 `$input` 섹션 자체가 사라지는 방식임. 사용자에게 왜 필드가 없는지 안내하지 않음.
- **제안**: 실행 결과가 없을 때 빈 suggestions 대신 "워크플로우를 먼저 실행하세요" 텍스트 아이템을 포함하거나 별도 힌트 렌더링 추가.

---

### **[WARNING]** `$dataSource` 자동완성과 변수 피커 간 불일치
- **위치**: `use-expression-suggestions.ts:213`, `variable-picker.tsx:338-367`
- **상세**: 자동완성(`useExpressionSuggestions`)은 `sourceItemSample` 존재 시 `$dataSource`를 root 제안에 포함하지만, 변수 피커의 `$sourceItem` 섹션에는 `$dataSource` 항목이 없음. count도 `+ 1`로 `$sourceItemIndex`만 계산. 두 UI 진입점 간 기능 불일치.
- **제안**: 피커의 `$sourceItem` 섹션에 `$dataSource` 항목 추가 및 count를 `+ 2`로 수정.

---

### **[WARNING]** 함수 자동완성에 시그니처 미포함
- **위치**: `use-expression-suggestions.ts:221-227`
- **상세**: 스펙 §7.1: "함수 이름 일부 입력 → 매칭되는 내장 함수 목록 + **시그니처**". 현재 `label: ${f}()`, `detail` 없이 반환. 시그니처(파라미터 정보)가 사용자에게 표시되지 않음.
- **제안**: 함수 레지스트리에 시그니처 정보를 포함시키고, `detail` 필드에 시그니처 문자열 추가.

---

### **[INFO]** `getExpressionToken` 미발견 시 `tokenStart: 0, tokenEnd: 0` 반환
- **위치**: `use-expression-suggestions.ts:105`
- **상세**: `ctx`가 null이면 `{ tokenStart: 0, tokenEnd: 0 }`을 반환. 호출 측이 이를 검사 없이 사용하면 입력 맨 앞(위치 0)을 조작할 위험이 있음. 의미상 `{ tokenStart: cursorPos, tokenEnd: cursorPos }` 또는 `null` 반환이 더 안전.
- **제안**: `empty` 값을 `{ suggestions: [], tokenStart: cursorPos, tokenEnd: cursorPos }`로 변경하거나 null을 반환하도록 타입 변경.

---

### **[INFO]** 배열 인덱스 접근 자동완성 미지원
- **위치**: `use-expression-suggestions.ts` 전반
- **상세**: 스펙 §3.2에서 `{{ $input.data[0].name }}`과 같은 배열 인덱스 접근을 명시. 현재 자동완성은 `$input.items.` 입력 시 첫 번째 배열 요소의 키를 제안하지만, `$input.items[0].` 형식의 토큰 패턴은 인식하지 못함.
- **제안**: `getExpressionToken` 또는 경로 파싱 로직에서 `[0]` 인덱스 표기를 처리하는 케이스 추가.

---

### **[INFO]** 테스트 커버리지 누락
- **위치**: `__tests__/use-expression-suggestions.test.ts`
- **상세**: 다음 케이스에 대한 테스트 없음:
  - `$var.` 제안 (variables 배열 기반 필터링)
  - 함수명 입력 시 함수 제안
  - root 제안 필터링 (예: `{{ $in }}` → `$input` 필터)
  - `$trigger`, `$env` 변수 (구현 추가 후 필요)
  - 빈 expression 토큰 결과 처리 (`tokenStart: 0, tokenEnd: 0` 이슈)

---

## 요약

전반적으로 핵심 자동완성 기능(`$input`, `$node`, `$sourceItem` 중첩 경로 탐색)은 스펙에 충실하게 구현되어 있으나, 스펙 §4.1에서 명시된 `$trigger`·`$env` 참조 변수가 양쪽 UI 모두에서 누락된 점은 워크플로우 실제 사용 시나리오(webhook 트리거, 환경 변수 참조)에서 기능 공백을 만든다. 미실행 워크플로우 안내 힌트, 함수 시그니처 표시, `$dataSource` 피커-자동완성 불일치도 스펙 대비 미이행 항목이다. 다중 predecessor 케이스의 `inputSample` 처리는 현재 동작이 사용자에게 혼란을 줄 수 있어 주의가 필요하다.

## 위험도

**MEDIUM**