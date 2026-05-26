# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### 파일 16: `codebase/frontend/src/lib/api/llm-configs.ts`

- **[INFO]** `list()` 내부에서 `llmConfigsApi.getAll()` 을 자기 참조 호출
  - 위치: `list()` 함수 내 `await llmConfigsApi.getAll()`
  - 상세: `list`는 `llmConfigsApi` 객체 리터럴 안에 선언되어 있으며, 같은 객체의 `getAll`을 `llmConfigsApi.getAll()`로 직접 참조한다. 이 방식은 동작하지만, `llmConfigsApi` 이름이 변경되거나 모듈 범위 외부에서 재정의될 경우 의도치 않게 동작할 수 있다. `this.getAll()`이 없는 plain object 패턴에서 자기 참조는 암묵적 결합을 형성한다.
  - 제안: `apiClient.get('/llm-configs')` 를 직접 호출하거나, 내부 헬퍼 함수 `fetchAllRaw()`로 분리해 `getAll`과 `list` 가 공통 기반을 공유하도록 리팩터링하면 더 명확해진다.

- **[INFO]** `list()`의 타입 캐스팅 중복
  - 위치: `list()` 함수 — `(raw as { data?: LlmConfigData[] } | undefined)?.data`
  - 상세: `getAll()`의 반환 타입이 `any`(TypeScript 추론 기준)여서 호출 측에서 매번 `as`로 캐스팅해야 한다. `getAll()` 자체에 반환 타입 `Promise<{ data?: LlmConfigData[] } | LlmConfigData[]>`를 선언했다면 `list()` 내부 캐스팅이 불필요해진다.
  - 제안: `getAll()`에 명시적 반환 타입을 부여해 `list()` 내 캐스팅을 제거한다.

---

### 파일 13: `codebase/frontend/src/components/llm-config/use-embedding-model-loader.ts`

- **[WARNING]** `useModelLoader`와 구조적 중복
  - 위치: 파일 전체, 특히 `prevResetKey/resetKey` 패턴과 `loadMutation` 선언 블록
  - 상세: `use-embedding-model-loader.ts`와 `use-model-loader.ts`는 거의 동일한 상태 관리 패턴(render-phase reset, `hasAttemptedLoad`, stale closure 가드, `sanitizeLoaderError` 위임)을 공유한다. `useEmbeddingModelLoader`가 `useModelLoader`에서 추출된 변형이라는 점은 JSDoc에 명시되어 있지만, 코드 동기화 부담이 실질적으로 존재한다. plan의 followup 항목(`SUMMARY #8`)으로 이미 인식되어 있다.
  - 제안: 이미 등록된 followup plan 대로 공통 베이스 훅(`useBaseModelLoader`) 추출을 진행한다. 당장 차단하지는 않으나 두 훅 중 한 곳에서 버그 수정 시 다른 쪽도 동기화해야 함을 문서화한다.

- **[INFO]** `"missing-config-id"` 매직 문자열
  - 위치: `use-embedding-model-loader.ts` 42행 `throw new Error("missing-config-id")`
  - 상세: 방어용 에러 메시지가 하드코딩 문자열이다. 동일한 패턴이 `use-model-loader.ts`에도 존재하지 않지만, 향후 오류 분류 시 구분이 어렵다.
  - 제안: 에러 코드 상수(`MISSING_CONFIG_ID_ERROR`)를 공통 위치에 정의하거나, 인스턴스 이름을 포함한 메시지 포맷을 통일한다.

---

### 파일 11: `codebase/frontend/src/components/llm-config/model-select-field.tsx`

- **[INFO]** `renderOption` prop 미사용 실효성
  - 위치: `ModelSelectFieldProps.renderOption` 선언 + 94행 `{renderOption ? renderOption(m) : defaultOptionLabel(m)}`
  - 상세: 현재 두 호출자(`ModelCombobox`, `EmbeddingModelCombobox`) 모두 `renderOption`을 전달하지 않는다. 사용되지 않는 확장 포인트는 코드를 읽는 사람에게 "이미 사용 중인 기능인지, 미래 예정인지" 불분명하다.
  - 제안: 현재 사용 사례가 없다면 제거하거나, `// 현재 미사용 — 향후 커스텀 옵션 렌더링 확장용` 주석을 명시한다.

- **[INFO]** `isPending` 텍스트가 버튼 본문과 `aria-label` 에 이중 반복
  - 위치: 버튼 내부 `aria-label` 조건 + `<span>` 조건 (74-86행)
  - 상세: `isPending ? t("...loadingModels") : t("...loadModels")` 조건이 `aria-label`과 `<span>` 텍스트에 각각 반복된다. 동일 삼항이 두 번 쓰이며, 하나만 수정하고 다른 쪽을 빠뜨릴 위험이 있다.
  - 제안: `const loadLabel = isPending ? t("llmConfigs.loadingModels") : t("llmConfigs.loadModels")` 로 추출해 두 위치에서 재사용한다.

---

### 파일 2: `codebase/frontend/src/components/editor/canvas/custom-node.tsx`

- **[INFO]** 포트 타입 분기 `isEmit` 로직의 하드코딩
  - 위치: 189행 `const isEmit = port.id === "emit"`
  - 상세: `"emit"` 은 특정 포트 ID에 의존하는 매직 문자열이다. 기존 코드에서 유지된 패턴이지만, 이번 변경에서 건드리지 않았으므로 신규 회귀는 아니다.
  - 제안: 포트 타입이나 color 속성을 포트 정의에서 직접 가져오도록 중장기 리팩터링을 고려한다. 이번 변경 범위 밖이다.

- **[INFO]** `showSystemDivider` / `showGlobalDivider` 조건의 복잡도
  - 위치: 214-218행 다중 boolean 조건
  - 상세: 기존 코드가 유지된 영역이므로 이번 변경의 직접 결과물은 아니다. 참고 사항으로 기록.

---

### 파일 5: `codebase/frontend/src/components/knowledge-base/create-kb-form-dialog.tsx`

- **[INFO]** 폼 상태 변수 다수 및 `resetForm()` 중복 초기화
  - 위치: `useState` 선언 10개 + `resetForm()` 함수
  - 상세: 이번 변경 범위 밖의 기존 코드이나, 폼 상태가 개별 `useState`로 분산되어 있고 `resetForm()`에서 동일 초기값을 하드코딩으로 반복한다. 초기값을 상수 객체로 추출하면 `useState(INITIAL_STATE.x)` + `resetForm = () => 상수 참조` 패턴으로 중복이 제거된다.
  - 제안: `const INITIAL_FORM_STATE = { name: "", chunkSize: "1000", ... }` 추출을 followup으로 고려한다.

---

### 파일 12: `codebase/frontend/src/components/llm-config/sanitize-loader-error.ts`

- **[INFO]** 200자 상한의 매직 넘버
  - 위치: `combined.slice(0, 200)`
  - 상세: 200자 상한의 의도(스택 트레이스 노출 방지)는 JSDoc에 명시되어 있어 이해 가능하지만, 상수로 추출되어 있지 않다.
  - 제안: `const MAX_ERROR_MESSAGE_LENGTH = 200;` 으로 추출해 명명하면 의도가 더 명확해진다. 낮은 우선순위.

---

### 파일 4 / 7: 테스트 파일 (`embedding-model-combobox.test.tsx`, `llm-config-selector.test.tsx`)

- **[INFO]** `as never` 타입 단언
  - 위치: `embedding-model-combobox.test.tsx` — `vi.mocked(llmConfigsApi.list).mockResolvedValue([DEFAULT_CONFIG] as never)`
  - 상세: `as never`는 타입 불일치를 강제로 억제하는 패턴이다. `DEFAULT_CONFIG`의 타입이 `LlmConfigData`의 subset임을 TypeScript가 인식하지 못해 사용된 것으로 보인다. 테스트 픽스처에 완전한 타입을 부여하면 `as never` 없이도 통과된다.
  - 제안: `DEFAULT_CONFIG`를 `Partial<LlmConfigData>` 혹은 완전한 `LlmConfigData` shape로 선언하고 `as never`를 제거한다.

- **[INFO]** `llm-config-selector.test.tsx` mock 주석의 부정확성
  - 위치: mock 블록 주석 "내부적으로 `getAll()` 을 한 번 더 호출하는 정규화 헬퍼이므로 둘 다 mock 해도 되나 단순성 위해 분리"
  - 상세: `list()`가 내부적으로 `getAll()`을 호출한다는 설명이 구현과 일치하나, "정규화 헬퍼"라는 표현은 `list`와 `getAll`의 관계를 모호하게 표현한다. `list()` 자체가 노출 API이며 `getAll()`은 내부 구현 세부사항임을 명확히 하면 독자 혼란이 줄어든다.
  - 제안: 주석을 "selector는 `list()` 를 호출. `list()` 는 내부에서 `getAll()` 을 통해 응답을 정규화하지만 테스트에서는 `list` 만 mock 하면 충분"으로 정리한다.

---

## 요약

이번 변경은 API 응답 정규화 로직을 각 컴포넌트에서 제거하고 `llmConfigsApi.list()`라는 단일 진입점으로 집약하며, 공통 UI 패턴을 `ModelSelectField` + `sanitizeLoaderError` + `useEmbeddingModelLoader`로 추출한 구조 개선 작업이다. 전반적으로 코드가 더 읽기 쉬워졌고, 이전의 `IIFE`와 이중 타입 캐스팅이 제거된 것은 명확한 개선이다. 지적할 만한 사항은 대부분 기존 코드 유지 구간의 패턴이거나, 이미 followup plan에 등록된 항목(두 훅의 중복 구조)이다. `ModelSelectField` 내 `isPending` 삼항 이중 반복과 `as never` 타입 단언은 소규모 정리로 해결 가능한 INFO 수준이며, `list()` 내 자기 참조 패턴은 실용적으로 문제가 없으나 장기 유지보수 측면에서 개선 여지가 있다.

## 위험도

LOW
