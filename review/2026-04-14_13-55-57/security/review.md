## 보안 코드 리뷰 결과

---

### 발견사항

---

**[WARNING] ReDoS (Regular Expression Denial of Service) — `apply-operation.ts`**
- 위치: `apply-operation.ts` — `evaluateCondition` 함수의 `regex` case, `string_op` replace의 regex 처리
- 상세: 사용자가 입력한 문자열을 `new RegExp(compareValue)` / `new RegExp(search, ...)` 로 직접 컴파일합니다. 악의적인 정규식(e.g. `(a+)+`, `(a|a)+`) 을 입력하면 단일 스레드인 Node.js/브라우저 이벤트 루프를 블로킹하여 UI 응답 불능 상태를 만들 수 있습니다.
- 제안: 정규식 길이 제한(예: 200자 이하), 허용 패턴 검증, 또는 `safe-regex` / `regexp-to-function` 같은 라이브러리로 악성 패턴을 사전 차단하세요. 프론트엔드 전용 로직이라면 위험도는 낮지만, 이 로직이 백엔드에서도 재사용될 경우 서비스 거부 공격 벡터가 됩니다.

---

**[WARNING] Prototype Pollution 방어 불완전 — `apply-operation.ts`**
- 위치: `BLOCKED_KEYS` 집합 정의 및 `object_omit` case (라인 ~200)
- 상세: `BLOCKED_KEYS`로 `__proto__`, `constructor`, `prototype`은 차단하고 있으나, `object_omit`의 루트 처리(`!op.field` 분기)에서 `for (const key of op.keys) delete data[key]` 수행 시 `key`가 `BLOCKED_KEYS`에 포함된 값인지 검사하지 않습니다. `op.keys`에 `"__proto__"` 등이 포함되면 `delete`가 호출됩니다(`delete`는 직접적인 오염은 아니지만, 일관성 없는 방어 로직은 추후 변경 시 실수를 유발합니다).
- 제안: `object_omit` / `object_pick`의 `keys` 루프에도 `BLOCKED_KEYS` 필터를 적용하세요:
  ```ts
  for (const key of op.keys) {
    if (!BLOCKED_KEYS.has(key)) delete data[key];
  }
  ```

---

**[WARNING] XSS — `preview.tsx` 의 `JsonCard` 컴포넌트**
- 위치: `preview.tsx` — `JsonCard` 함수, `<pre>` 내부의 `JSON.stringify(value, null, 2)`
- 상세: React는 `{...}` 표현식 내 텍스트를 자동 이스케이프하므로 현재 코드는 **직접적인 XSS 위험은 없습니다**. 단, `value` 객체 내에 `<script>` 등의 HTML 문자열이 포함된 경우 `<pre>` 내에서 텍스트로만 렌더링되므로 안전합니다. **그러나** 추후 `dangerouslySetInnerHTML`로 변경되거나 서버 사이드 렌더링으로 전환될 경우 즉시 XSS 취약점이 됩니다. 현재 상태에서는 INFO 수준이나 주의가 필요합니다.
- 제안: 현재 구조 유지 권장. `dangerouslySetInnerHTML` 사용 금지 원칙을 코드 주석으로 명시하는 것도 좋습니다.

---

**[INFO] 사용자 입력 길이 제한 없음 — `chip-input.tsx`, `ops.tsx`**
- 위치: `ChipInput` 컴포넌트, 각 `Input` 필드 전체
- 상세: 필드 경로, 키 목록, 정규식 패턴 등 모든 텍스트 입력에 `maxLength` 제한이 없습니다. 로컬 상태 조작이므로 직접적인 서버 공격 벡터는 아니지만, 매우 긴 경로를 입력하면 `parsePath` 재귀 처리에서 성능 저하가 발생할 수 있습니다.
- 제안: `pathInput`, `ChipInput`, regex 입력에 적절한 `maxLength`(예: 경로 256자, regex 200자)를 설정하세요.

---

**[INFO] `eq` / `neq` 연산자의 타입 강제 비교 — `apply-operation.ts`**
- 위치: `evaluateCondition` 함수 — `case "eq"`, `case "neq"`
- 상세: `==` / `!=` (느슨한 동등 비교)를 사용하고 있어, `"0" == false`, `null == undefined` 등 예상치 못한 결과가 나올 수 있습니다. 보안 취약점은 아니지만 필터 우회로 이어질 수 있습니다(예: `null` 값을 가진 항목이 `eq "0"` 조건을 통과하지 않아야 하는데 통과하는 경우).
- 제안: `===` / `!==`로 교체하거나, 타입 강제 비교를 의도한 것이라면 명시적으로 문서화하세요.

---

**[INFO] 하드코딩된 시크릿 없음**
- 모든 파일에서 API 키, 비밀번호, 토큰 등 하드코딩된 민감 정보는 발견되지 않았습니다.

---

### 요약

이 코드셋은 전반적으로 보안 의식이 반영되어 있습니다. 특히 `BLOCKED_KEYS`를 통한 prototype pollution 방어, `structuredClone`을 통한 불변성 보장, React의 자동 이스케이프 활용 등 긍정적인 패턴이 확인됩니다. 가장 주의해야 할 사항은 사용자 입력 정규식을 그대로 `new RegExp()`에 전달하는 **ReDoS 취약점**으로, 이 로직이 백엔드에서 재사용될 경우 서비스 가용성에 직접적인 위협이 됩니다. `object_omit` 루트 처리에서 `BLOCKED_KEYS` 필터가 누락된 점도 방어 일관성 측면에서 수정이 권장됩니다.

---

### 위험도

**MEDIUM** (ReDoS 위험이 현재 프론트엔드 전용이지만, 백엔드 공유 가능성 고려)