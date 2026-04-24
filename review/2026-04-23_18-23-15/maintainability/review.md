### 발견사항

---

**[WARNING]** `useSavedConfig && configId` 이중 검사 중복
- **위치**: `model-combobox.tsx:47`
- **상세**: `useSavedConfig`는 `Boolean(configId) && !trimmedKey`로 이미 `configId` 존재를 포함한다. `if (useSavedConfig && configId)`의 `&& configId`는 불필요한 중복이며, 조건 사이의 논리적 관계를 불명확하게 만든다.
- **제안**: `if (useSavedConfig)` 로 단순화.

---

**[WARNING]** verbose ternary `trimmedBaseUrl ? trimmedBaseUrl : undefined`
- **위치**: `model-combobox.tsx:52`
- **상세**: `trimmedBaseUrl || undefined`로 표현 가능한 것을 3항 연산자로 풀었다. 코드베이스 내 `baseUrl?.trim() || undefined` 같은 더 간결한 패턴과 불일치.
- **제안**: `baseUrl: trimmedBaseUrl || undefined`

---

**[WARNING]** 테스트 내 axios 에러 mock 구성이 과도하게 복잡함
- **위치**: `model-combobox.test.tsx:164-179`
- **상세**: `Object.create(Object.getPrototypeOf(new Error("fail")))` + `Object.assign`의 두 단계 조합은 프로토타입 체인까지 맞추려는 의도이나, `axios.isAxiosError`는 프로토타입이 아닌 `isAxiosError` 플래그만 검사한다. 실제로 `Object.assign(new Error("fail"), { isAxiosError: true, response: { ... } })`로 충분하며 읽기 훨씬 쉽다.
- **제안**:
  ```ts
  mockRejectedValue(
    Object.assign(new Error("Request failed"), {
      isAxiosError: true,
      response: { data: { message: "Authentication failed. Please check your API key." } },
    })
  )
  ```

---

**[WARNING]** `beforeEach(clearAllMocks)` + `afterEach(restoreAllMocks)` 혼용
- **위치**: `llm-configs.test.ts:11-16`
- **상세**: `vi.clearAllMocks()`는 호출 기록을 초기화하고, `vi.restoreAllMocks()`는 spy를 원본으로 복원한다. `vi.mock()`으로 모듈을 교체한 경우 `restoreAllMocks`는 효과가 없다. 두 훅이 서로 다른 목적처럼 보이나 실질적으로 `clearAllMocks`만으로 충분하며, `afterEach`의 의도가 불명확하다.
- **제안**: `afterEach` 제거 또는 주석으로 `restoreAllMocks` 사용 이유 명시.

---

**[WARNING]** "falls back to the body itself" 테스트가 버그 우회를 계약으로 고정
- **위치**: `llm-configs.test.ts:34-39`
- **상세**: "falls back to the body itself when not enveloped (legacy tests/mocks)"라는 케이스는 `data?.data ?? data` 방어 패턴의 fallback 경로를 "기대 동작"으로 명세화한다. 이 패턴이 실제로는 인터셉터 불일치라는 버그를 은폐하는 것인데, 테스트가 이를 정식 계약처럼 보호하면 나중에 중앙화 리팩터 시 이 테스트가 오히려 걸림돌이 된다. RESOLUTION.md(W-12)에서도 이 언래핑 중앙화를 보류한 이유로 기술했으나, 테스트 설명이 "legacy"임을 암시하는 것만으로는 부족하다.
- **제안**: 테스트 이름을 `"interim: accepts raw array until transform interceptor centralizes unwrapping"`처럼 임시임을 명확히 하거나, 해당 케이스에 `// TODO: remove after W-12 centralization` 주석 추가.

---

**[INFO]** `llm-config.controller.spec.ts`가 `previewModels`만 커버
- **위치**: `llm-config.controller.spec.ts` 전체
- **상세**: 컨트롤러의 다른 메서드(`findAll`, `create`, `update`, `setDefault`, `remove`, `testConnection`, `listModels`)에 대한 테스트가 없다. 기존에 별도 파일로 테스트되고 있다면 문제없으나, 이 파일이 해당 컨트롤러의 유일한 spec이라면 커버리지 공백이 크다. 파일명이 컨트롤러 전체를 암시하므로 혼란을 줄 수 있다.
- **제안**: 파일 상단에 `// Only covers previewModels; other endpoints tested in integration tests` 주석 추가, 또는 `llm-config.controller.preview.spec.ts`로 파일명 변경.

---

**[INFO]** `getLoadButton()` 의 `as HTMLButtonElement` 불필요한 type assertion
- **위치**: `model-combobox.test.tsx:24`
- **상세**: `screen.getByTestId()`는 `HTMLElement`를 반환하며, `getByTestId`의 반환 타입이 이미 충분하다. `.disabled` 같은 `HTMLButtonElement` 전용 프로퍼티를 쓰기 위한 cast지만, `expect(...).toBeDisabled()`는 `HTMLElement`에서 작동한다.
- **제안**: assertion 제거 또는 `HTMLElement`로 유지.

---

**[INFO]** `canLoad` 내 `apiKey.trim().length > 0` vs 암묵적 boolean 불일치
- **위치**: `model-combobox.tsx:84`
- **상세**: 같은 함수 내에서 `!(baseUrl?.trim() ?? "")` (암묵적 falsy)와 `apiKey.trim().length > 0` (명시적 length 비교)가 혼재한다. 일관성 없이 두 패턴이 뒤섞이면 다음 개발자가 의도적 차이인지 실수인지 알 수 없다.
- **제안**: `apiKey.trim() !== ""` 또는 `Boolean(apiKey.trim())`으로 통일.

---

### 요약

코드 전반의 책임 분리, 네이밍, 구조는 양호하다. `LOCAL_PROVIDER` 상수 추출, `getLoadButton()` 헬퍼, `wrap()` 유틸리티 등 반복 제거 노력도 적절하다. 유지보수 측면의 주요 위험은 세 곳에 집중된다: `model-combobox.tsx`의 중복 논리 검사와 verbose ternary(미래 조건 추가 시 실수 온상), 테스트의 복잡한 axios mock 구성(복사·수정 시 의도 파악 어려움), 그리고 "legacy fallback" 테스트가 임시 우회를 계약으로 고착화하는 패턴이다. 나머지는 코드 품질에 경미한 영향이며 즉각적 위험은 없다.

### 위험도

**LOW**