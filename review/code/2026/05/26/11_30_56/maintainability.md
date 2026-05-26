# 유지보수성(Maintainability) 리뷰 결과

리뷰 대상: LLM 설정 / 임베딩 모델 선택 — select-only 전환 (llm-model-select)
리뷰 일시: 2026-05-26

---

## 발견사항

### **[WARNING]** `embedding-model-combobox.tsx` — 렌더 중 setState 패턴이 미래 유지보수자에게 혼란 유발

- **위치**: `embedding-model-combobox.tsx` 559–570행 (`prevResetKey` / `resetKey` 비교 블록)
- **상세**: React 공식 문서가 허용하는 "render 중 setState" 패턴이지만, 함수 컴포넌트 본문 안에 조건부 `setPrevResetKey` / `setModels` / `setErrorMessage` 직접 호출이 있는 형태는 일반적인 `useEffect` 패턴과 다르다. 이 패턴을 모르는 유지보수자가 "왜 useEffect를 쓰지 않았지?" 라는 의문을 갖고 변경하면 무한 리렌더 또는 누락된 초기화로 이어질 수 있다. `model-combobox.tsx` 는 이 패턴을 사용하지 않고 `useModelLoader` 훅에서 내부적으로 처리하는 반면, `EmbeddingModelCombobox` 는 직접 처리하여 두 컴포넌트 간 구현 방식이 다르다.
- **제안**: 주석이 이미 패턴을 설명하고 있으나, 왜 `useEffect`를 쓰지 않았는지에 대한 설명("useEffect 사용 시 렌더 후 cleanup이 한 프레임 지연되어 플래시가 발생할 수 있음")을 한 줄 추가하면 의도를 더 명확히 전달할 수 있다. 또는 `useEmbeddingModelLoader` 커스텀 훅으로 로직을 추출하여 `useModelLoader`와 대칭 구조를 만드는 것이 장기적으로 더 유지보수하기 좋다.

---

### **[WARNING]** `embedding-model-combobox.tsx` — `loadMutation.mutate()` 내부에서 `effectiveConfigId` closure 캡처 후 `snapshot`으로 별도 보관하는 이중 처리

- **위치**: `embedding-model-combobox.tsx` 572–603행 (`loadMutation` 정의)
- **상세**: `mutationFn` 내에서 `effectiveConfigId`를 `snapshot`에 복사한 뒤 `onSuccess`에서 `snapshot !== effectiveConfigId` 를 비교하는 stale closure 가드 패턴이 적용되어 있다. 이 패턴 자체는 정확하지만, React Query 의 `useMutation`은 `mutationFn`이 실행될 때 해당 시점의 값을 캡처하므로 `snapshot`이라는 별도 변수가 필요한지 코드만 보면 명확하지 않다. 주석("Stale closure 가드")이 있지만, 이 처리가 필요한 정확한 시나리오(`effectiveConfigId`가 비동기 응답 대기 중 변경되는 경우)를 명시하면 이해가 쉬워진다.
- **제안**: 주석을 "// Stale closure 가드 — llmConfigId prop 변경으로 effectiveConfigId가 바뀐 뒤 이전 요청이 응답하는 경우 무시" 와 같이 구체화한다. 또는 `useEmbeddingModelLoader` 훅으로 추출하면 이 복잡한 상태 관리 로직이 컴포넌트 렌더 JSX와 분리되어 가독성이 향상된다.

---

### **[WARNING]** `embedding-model-combobox.tsx` vs `model-combobox.tsx` — 동일한 JSX 패턴(NativeSelect + Load Button + 상태 메시지)이 두 파일에 중복

- **위치**: `embedding-model-combobox.tsx` 617–679행, `model-combobox.tsx` 471–531행
- **상세**: 두 컴포넌트의 렌더 JSX 구조가 거의 동일하다.
  1. `<div className="flex gap-2">` 래퍼 안에 `NativeSelect` + `Button` 배치
  2. `{!value && <option value="" disabled>placeholder</option>}`
  3. `{savedValueMissingFromLoaded && <option value={value}>fallback label</option>}`
  4. 모델 목록 `map` 렌더링 (`m.name !== m.id ? \`${m.name} (${m.id})\` : m.id`)
  5. 버튼 내 `isPending`/`loadMutation.isPending` 분기 (`Loader2` vs `RefreshCw`)
  6. 하단 상태 메시지 4-way 조건 (`errorMessage` / `isEmpty` / `!hasLoadedModels` / default)

  옵션 레이블 포맷(`${m.name} (${m.id})`)과 상태 메시지 조건문이 두 곳에 복사되어 있어, 향후 옵션 레이블 포맷 변경 시 두 파일을 모두 수정해야 하는 취약점이 있다.
- **제안**: 공통 JSX 부분을 `ModelSelectWithLoader` 또는 `SelectWithLoadButton` 내부 컴포넌트로 추출하거나, 공통 옵션 레이블 포맷 함수(`formatModelOption`)를 별도 유틸로 분리한다. `useModelLoader`처럼 이미 훅 추출 패턴이 있으므로 일관된 방향이다.

---

### **[WARNING]** `embedding-model-combobox.tsx` — `embeddingModels` useMemo 필터가 이미 `type: "embedding"` 으로 요청한 데이터를 재필터링

- **위치**: `embedding-model-combobox.tsx` 603–606행
- **상세**: `loadMutation`의 `mutationFn`에서 `llmConfigsApi.listModels(snapshot, { type: "embedding" })`로 이미 임베딩 타입만 요청한다. 그런데 `embeddingModels`를 계산할 때 다시 `models.filter((m) => m.type === "embedding")`를 수행한다. API 응답이 항상 요청한 type만 반환한다면 이 필터는 불필요하다. 반대로 API가 mixed type을 반환할 수 있다면 `mutationFn`의 타입 파라미터 전달 의미가 약해진다.
- **제안**: API 계약을 명확히 하여, `listModels`가 `type` 파라미터를 서버 측 필터로 사용한다면 클라이언트 재필터를 제거하고 `models`를 바로 사용한다. 방어적 이중 필터를 유지한다면 주석으로 의도를 명시한다("// API 응답이 항상 type 파라미터를 존중하지 않는 provider가 있을 수 있으므로 클라이언트에서도 필터링").

---

### **[WARNING]** `model-combobox.tsx` — `loadMutation.isPending` 조건의 `span` 내 `t(...)` 호출이 동일한 텍스트를 반환할 가능성

- **위치**: `embedding-model-combobox.tsx` 657–660행, `model-combobox.tsx` 1509–1511행
- **상세**: 두 컴포넌트 모두 버튼 내 `span` 안에서:
  ```
  {loadMutation.isPending / isPending
    ? t("llmConfigs.loadingModels")
    : t("llmConfigs.loadModels")}
  ```
  를 사용하고 있다. `aria-label`에는 이미 `t("llmConfigs.loadModels")`가 지정되어 있고, 버튼에 아이콘이 함께 표시되므로 `span` 텍스트의 pending/non-pending 조건 분기가 필요한지 재검토가 필요하다. 현재 구조는 `aria-label`은 항상 "Load models"인데 visible text는 "Loading..."과 "Load models"를 전환한다는 불일치가 있다.
- **제안**: `aria-label`도 pending 상태에 맞게 `t("llmConfigs.loadingModels")`로 동적 변경하거나, visible text와 aria-label을 일치시키는 방향으로 정리한다. 이는 접근성 관점이기도 하나, 코드 의도의 명확성과도 연관된다.

---

### **[INFO]** `embedding-model-combobox.tsx` — `configsRes` 타입 추론을 위한 `as` 캐스팅이 불투명

- **위치**: `embedding-model-combobox.tsx` 543–552행
- **상세**: `configsRes`를 `{ data?: LlmConfigData[] } | undefined`와 배열 모두로 처리하는 방어 코드가 있다. `llmConfigsApi.getAll()`의 반환 타입이 명확하다면 이런 이중 처리가 필요 없다. `as` 캐스팅과 `Array.isArray` 분기 두 개가 함께 있어 API 반환 형태가 불안정하다는 인상을 준다.
- **제안**: `llmConfigsApi.getAll()`의 반환 타입을 명확히 정의하거나, 래퍼 형식이 고정되어 있다면 타입을 그에 맞게 선언하여 방어 코드를 단순화한다. `model-combobox.tsx`는 `useModelLoader` 훅 안에서 이를 처리하므로 일관성이 낮다.

---

### **[INFO]** 테스트 파일 — `embedding-model-combobox.test.tsx`의 헬퍼 함수들이 `model-combobox.test.tsx`에도 유사하게 정의됨

- **위치**: `embedding-model-combobox.test.tsx` 47–64행, `model-combobox.test.tsx` (변경된 23–28행)
- **상세**: `wrap`, `getLoadButton`, `getSelect`, `optionValues` 헬퍼 함수가 두 테스트 파일에 각각 독립적으로 정의되어 있다. 내용이 거의 동일하다(`getLoadButton`의 `data-testid`만 다름). 현재는 큰 문제가 아니지만, 테스트 유틸리티 변경 시 두 파일 모두 수정해야 한다.
- **제안**: 공통 테스트 헬퍼를 `__tests__/test-utils.tsx` 등으로 분리하거나, 파라미터화된 팩토리 함수를 사용하는 것을 고려한다. 단, 테스트 파일 분리는 선택적이며 현재 크기에서는 INFO 수준이다.

---

### **[INFO]** `model-combobox.tsx` — `isEmpty` 조건에서 `!errorMessage && isSuccess && chatModels.length === 0`의 조건이 직관적이지 않음

- **위치**: `model-combobox.tsx` 1463행, `embedding-model-combobox.tsx` 608–611행
- **상세**: `isEmpty`가 `!errorMessage && isSuccess && length === 0`으로 정의되어 있다. `isSuccess && length === 0`이면 오류 없이 빈 응답이 온 경우인데, `!errorMessage` 체크가 중복적으로 느껴진다(`isSuccess`이면 이미 `errorMessage`가 없어야 하기 때문). 단, mutation 상태와 수동 `errorMessage` 상태가 분리되어 있어 실제로는 독립적이다. 그러나 이 미묘한 차이를 코드만 보고 이해하기 어렵다.
- **제안**: 변수명을 `isEmptyResult` 또는 `noModelsAfterLoad`로 구체화하거나, 짧은 주석으로 의도를 명시한다("// 로드 성공했으나 반환된 모델이 0개인 경우").

---

### **[INFO]** `plan/in-progress/llm-model-select-only.md` — `worktree` frontmatter 값이 실제 worktree 디렉토리명과 불일치

- **위치**: `plan/in-progress/llm-model-select-only.md` frontmatter `worktree: llm-model-select`
- **상세**: 실제 worktree 경로는 `.claude/worktrees/llm-model-select-4857c3/`인데, frontmatter의 `worktree` 값은 `llm-model-select`로 suffix가 생략되어 있다. 이는 plan 라이프사이클 관련 도구나 가드가 worktree 경로를 파싱할 때 불일치를 유발할 수 있다.
- **제안**: frontmatter를 `worktree: llm-model-select-4857c3`으로 수정하여 실제 디렉토리명과 일치시킨다.

---

## 요약

이번 변경은 `<Input list>` + `<datalist>` 기반의 자유 입력 combobox를 `<NativeSelect>` + 명시적 로드 버튼 조합으로 전환하는 목적이 명확하고, 코드 의도가 주석과 i18n 키 네이밍을 통해 잘 표현되어 있다. 전체적으로 가독성과 네이밍은 양호하다. 주요 유지보수성 우려는 두 가지다. 첫째, `EmbeddingModelCombobox`가 `useModelLoader` 훅 없이 컴포넌트 내부에 직접 mutation 상태 관리 로직을 구현하여 `ModelCombobox`와 구조적 비대칭이 발생하였고, 렌더 중 setState 패턴이 추가되어 로직 복잡도가 높아졌다. 둘째, 두 컴포넌트의 JSX 렌더 구조(NativeSelect 옵션 패턴, 로드 버튼, 상태 메시지 4-way 조건)가 상당 부분 중복되어 향후 변경 시 두 파일을 모두 수정해야 하는 부담이 있다. `useEmbeddingModelLoader` 훅 추출 및 공통 렌더 로직 분리를 통해 `useModelLoader` 패턴과 일관성을 맞추는 것이 장기 유지보수성을 높이는 방향이다.

---

## 위험도

**MEDIUM**

`EmbeddingModelCombobox`의 렌더 중 setState 패턴과 stale closure 가드는 현재는 정확히 동작하나, 패턴에 익숙하지 않은 기여자가 수정하면 버그가 발생하기 쉬운 구조다. 중복 JSX 로직은 현 시점에서 기능 버그를 유발하지 않지만 변경 시 이중 수정 누락 위험이 있다.
