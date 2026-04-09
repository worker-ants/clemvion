## 보안 코드 리뷰

### 발견사항

---

**[WARNING] Button ID에 내부 구분자(`__item_`) 포함 여부 미검증 — 포트 라우팅 조작 가능**
- 위치: `carousel.handler.ts` `validateItemButtons()`, `execution-engine.service.ts` L1594–1597
- 상세: 실행 엔진은 버튼 ID에 `__item_`이 포함되면 그 앞 부분을 포트로 사용한다.
  ```ts
  selectedPort = buttonId.includes('__item_')
    ? buttonId.split('__item_')[0]
    : buttonId;
  ```
  그런데 `validateItemButtons()`는 ID의 형식(허용 문자, 예약 구분자 포함 여부)을 검증하지 않는다. 버튼 설정을 제어할 수 있는 사용자가 `maliciousPort__item_X` 형태의 ID를 지정하면, 실제로 연결되지 않은 `maliciousPort`로 실행 흐름이 라우팅된다. Carousel 글로벌 버튼도 동일한 경로를 타므로 영향 범위는 static/dynamic 모드 전체.
- 제안:
  ```ts
  const RESERVED_SEPARATOR = '__item_';
  if (typeof btn.id === 'string' && btn.id.includes(RESERVED_SEPARATOR)) {
    errors.push(`${prefix}.buttons[${j}].id must not contain "${RESERVED_SEPARATOR}"`);
  }
  // 추가로 허용 문자 패턴 적용 권장: /^[a-zA-Z0-9_-]+$/
  ```

---

**[WARNING] `sanitizeUrl()`이 `javascript:` 스킴을 차단하는지 불명확 — XSS 위험**
- 위치: `carousel.handler.ts` `sanitizeUrl()` / `validateItemButtons()` link 타입 버튼
- 상세: `validateItemButtons()`에서 link 버튼의 `url` 필드는 "string이며 비어있지 않음"만 확인한다. `sanitizeUrl()`은 이미지 URL에만 적용되고 있으며, 버튼 URL에는 적용되지 않는다. `javascript:alert(1)` 같은 URL이 buttonConfig에 그대로 저장되어 프론트엔드에서 `<a href="...">` 또는 `window.open()`으로 렌더링될 경우 XSS가 발생한다.
- 제안:
  ```ts
  // validateItemButtons 내 link 타입 검증 강화
  if (btn.type === 'link' && btn.url) {
    const sanitized = sanitizeUrl(String(btn.url));
    if (!sanitized) {
      errors.push(`${prefix}.buttons[${j}].url contains an unsafe scheme`);
    }
  }
  ```
  `sanitizeUrl()`이 `javascript:`, `data:`, `vbscript:` 스킴을 명시적으로 차단하는지 확인 필요.

---

**[WARNING] `buttonConfig`를 `cleanNodeOutput`에 유지 — 내부 설정 정보 다운스트림 노출**
- 위치: `execution-engine.service.ts` L1573–1580
- 상세: 변경 전에는 `delete cleanNodeOutput.buttonConfig`로 제거했으나, 이번 변경으로 실행 상세 페이지 렌더링을 위해 유지하도록 변경되었다. `buttonConfig`에는 `buttonItemMap`, `buttonTimeout`, `buttonTimeoutAction`, 그리고 모든 버튼 정의(URL 포함)가 담겨 있다. 이 데이터가 다운스트림 노드 입력으로 전달되면, 뒤따르는 AI Agent 노드가 프롬프트 컨텍스트로 수신하거나, 외부 HTTP Request 노드가 API 호출 바디에 포함시킬 수 있다.
- 제안: 실행 상세 페이지 렌더링 데이터는 DB의 원본 nodeExecution 레코드에서 직접 읽어오는 방식으로 분리하고, 다운스트림으로 전달되는 `cleanNodeOutput`에서는 계속 `buttonConfig`를 제거하는 것이 권장된다.

---

**[WARNING] `unwrap<T>()` — `null`이 타입 T로 반환되어 런타임 오류 유발 가능**
- 위치: `frontend/src/lib/api/executions.ts` L43–49
- 상세:
  ```ts
  function unwrap<T>(data: any): T {
    return data?.data !== undefined && typeof data.data === "object" && !Array.isArray(data.data)
      ? data.data
      : data;
  }
  ```
  `typeof null === "object"`이고 `!Array.isArray(null) === true`이며, `null !== undefined`이다. 따라서 서버가 `{ data: null }`을 반환하면 `null`이 `T`로 반환된다. 이후 호출 측에서 속성에 접근하면 런타임 오류가 발생하며, 에러 메시지가 사용자에게 노출될 수 있다.
- 제안:
  ```ts
  function unwrap<T>(data: unknown): T {
    const d = data as Record<string, unknown> | null | undefined;
    if (d != null && 'data' in d && d.data !== null && d.data !== undefined
        && typeof d.data === 'object' && !Array.isArray(d.data)) {
      return d.data as T;
    }
    return data as T;
  }
  ```

---

**[INFO] `selectedItem`이 다운스트림 노드 입력에 포함 — 민감 데이터 전파**
- 위치: `execution-engine.service.ts` L1617
- 상세:
  ```ts
  ...(selectedItem !== undefined && { selectedItem }),
  ```
  캐러셀 아이템 전체 객체가 다음 노드로 전달된다. API 응답을 캐러셀로 표시하는 경우, 아이템에 포함된 민감 필드(내부 ID, 가격 정보, 개인식별정보 등)가 의도치 않게 다운스트림 노드(특히 외부 HTTP 호출 노드)에 노출될 수 있다.
- 제안: `selectedItem`을 필드 화이트리스트로 필터링하거나, 사용자가 전달할 필드를 명시적으로 선택할 수 있도록 설정 옵션 제공 검토.

---

**[INFO] `_selectedPort` 스트리핑 — 긍정적 보안 개선**
- 위치: `execution-engine.service.spec.ts`, `execution-engine.service.ts`
- 상세: 내부 라우팅 필드 `_selectedPort`를 다운스트림 노드 입력에서 제거한 것은 올바른 방향이다. 내부 시스템 필드가 사용자 데이터 공간으로 누출되면 AI 노드의 프롬프트 오염이나 의도치 않은 분기 조작에 활용될 수 있다.

---

**[INFO] `source` 표현식 필드 — 표현식 엔진의 샌드박스 수준 확인 필요**
- 위치: `carousel.handler.ts` L156–161, `carousel.handler.spec.ts`
- 상세: `source: '{{ $input }}'` 형태의 템플릿 표현식이 추가되었다. 표현식 엔진이 어디까지 접근을 허용하는지(프로세스 환경변수, 파일시스템 등)에 따라 Server-Side Template Injection 위험이 있을 수 있다. 현재 코드에는 검증이 없으며 단순 문자열로만 처리된다.
- 제안: 표현식 엔진이 실행 컨텍스트(노드 출력, 워크플로우 입력)만 접근 가능하도록 샌드박스 경계를 명시적으로 문서화하고 테스트로 검증할 것.

---

### 요약

이번 변경의 가장 중요한 보안 이슈는 두 가지다. 첫째, 버튼 ID 검증에서 내부 라우팅 구분자 `__item_`의 포함 여부를 차단하지 않아, 버튼 설정 권한이 있는 사용자가 의도하지 않은 포트로 실행 흐름을 조작할 수 있다. 둘째, link 타입 버튼 URL에 대한 스킴 검증(`javascript:` 등 차단 여부)이 명확하지 않아 XSS 위험이 존재한다. 긍정적인 면으로는 `_selectedPort` 내부 필드 스트리핑이 적용된 것은 올바른 보안 개선이다. `buttonConfig`를 다운스트림에 유지하는 설계 변경은 데이터 흐름 관점에서 재검토가 필요하며, `unwrap()` 함수의 `null` 처리 오류는 런타임 에러 노출로 이어질 수 있다.

### 위험도

**MEDIUM**