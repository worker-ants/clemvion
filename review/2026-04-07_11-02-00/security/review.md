### 발견사항

---

**[WARNING] 노드 라벨의 표현식 경로 직접 삽입 — 표현식 인젝션 가능성**
- 위치: `use-expression-suggestions.ts:145`
  ```ts
  insertText: `${n.label}"].output`,
  ```
- 상세: 노드 라벨이 검증 없이 표현식 문자열에 직접 삽입됩니다. 라벨에 `"` 또는 `]` 등의 특수문자가 포함되면 생성되는 표현식 구문이 깨질 수 있습니다. 예: 라벨이 `evil"].output; $env["` 이면 `$node["evil"].output; $env[""].output` 형태의 비정상 토큰이 생성됩니다. 표현식 엔진이 `eval()`이나 `Function()` 기반이라면 실제 코드 실행으로 이어질 수 있습니다.
- 제안: 라벨을 표현식에 삽입하기 전에 `"` 및 `\` 등의 특수문자를 이스케이프하거나, 라벨 허용 문자를 `[a-zA-Z0-9_\- ]` 범위로 제한하는 검증을 도입하세요.

---

**[WARNING] 노드 출력 데이터의 Prototype Pollution 잠재 위험**
- 위치: `use-expression-context.ts:36-43`, `variable-picker.tsx:168`
  ```ts
  function extractFields(data: unknown): string[] {
    if (!data || typeof data !== "object" || Array.isArray(data)) return [];
    return Object.keys(data as Record<string, unknown>);
  }
  ```
- 상세: `nodeResults`의 `outputData`는 외부 워크플로우 실행 결과로부터 옵니다. `__proto__`, `constructor`, `toString` 등의 키가 포함된 데이터가 `Object.keys()`로 열거되어 UI에 렌더링되거나 표현식 경로로 사용될 수 있습니다. 직접적인 prototype pollution은 아니지만, 이 키들이 이후 표현식 엔진에서 프로퍼티 접근(예: `$input.__proto__.isAdmin`)에 사용된다면 예기치 않은 동작을 유발할 수 있습니다.
- 제안: `Object.keys()` 결과에서 `__proto__`, `constructor`, `prototype` 등을 필터링하거나, `Object.create(null)`로 생성된 순수 객체만 허용하세요.

---

**[INFO] ReDoS 잠재 가능성 (매우 낮음)**
- 위치: `use-expression-suggestions.ts:55`, `113`
  ```ts
  const tokenMatch = between.match(/([a-zA-Z0-9_$."[\]]*?)$/);
  const nodeOutputMatch = trimmedToken.match(/\$node\["([^"]+)"\]\.output\.(.*)$/);
  ```
- 상세: 정규식이 사용자가 입력한 표현식 문자열에 적용됩니다. `.*` 패턴이 긴 입력에서 성능 저하를 일으킬 수 있으나, 표현식이 `{{ }}` 내부 단문으로 제한되어 실용적 위협은 낮습니다.
- 제안: 입력 길이를 적절히 제한하거나(예: 1000자), `.*` 대신 구체적인 문자 클래스를 사용하세요.

---

**[INFO] 전체 노드 실행 결과가 모든 노드 표현식에 노출**
- 위치: `use-expression-context.ts:83-94`
- 상세: 선택된 노드와 무관하게 모든 노드의 `outputData`가 `availableNodes`를 통해 표현식 자동완성에 노출됩니다. 민감한 데이터(API 키, PII 등)가 노드 출력에 포함된 경우, 다른 노드의 표현식 편집 UI에서도 해당 값이 노출될 수 있습니다.
- 제안: 노드 간 데이터 접근 정책을 명시적으로 정의하고, 필요하다면 출력 데이터 중 민감 필드를 마스킹하는 레이어를 추가하세요.

---

**[INFO] `dangerouslySetInnerHTML` 미사용 — XSS 없음**
- 위치: `variable-picker.tsx` 전체
- 상세: 모든 동적 값이 JSX 표현식(`{}`)으로 렌더링되어 React의 자동 이스케이핑이 적용됩니다. XSS 위험 없음.

---

**[INFO] 하드코딩된 시크릿 없음**
- 코드 내 API 키, 비밀번호, 토큰 등 하드코딩된 인증 정보는 발견되지 않았습니다.

---

### 요약

이 코드는 워크플로우 에디터의 표현식 자동완성 및 변수 선택 UI로, 직접적인 서버 통신이나 인증/인가 로직이 없는 순수 프론트엔드 컴포넌트입니다. 가장 중요한 보안 고려사항은 **노드 라벨이 검증 없이 표현식 문자열에 삽입되는 부분**으로, 표현식 엔진의 실행 방식에 따라 실제 위협이 될 수 있습니다. Prototype Pollution 방어와 노드 출력 데이터의 민감 정보 노출 정책도 보완이 필요합니다. React JSX를 사용하므로 XSS 위험은 없으며, 하드코딩된 시크릿도 없습니다.

### 위험도

**LOW** (표현식 엔진의 구현 방식에 따라 MEDIUM으로 상승 가능)