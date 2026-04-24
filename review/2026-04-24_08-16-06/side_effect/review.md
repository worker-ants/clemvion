## 발견사항

---

**[WARNING]** `models` 상태가 props 변경에도 초기화되지 않음
- **위치**: `model-combobox.tsx:27` — `useState<ModelInfo[]>([])`
- **상세**: `provider`, `apiKey`, `baseUrl`, `configId` props가 변경되어도 `models` state를 초기화하는 `useEffect`가 없다. 사용자가 프로바이더를 openai → anthropic으로 바꾼 뒤 "모델 불러오기"를 클릭하지 않으면, datalist에는 이전 프로바이더의 모델 목록이 그대로 남아 오토컴플리트 제안을 오염시킨다. `errorMessage`는 `onMutate`에서 초기화되는 것과 대조적으로, `models`만 cleanup 경로가 없다.
- **제안**: props 핵심 의존성 변경 시 `models` 초기화 추가:
  ```tsx
  useEffect(() => { setModels([]); }, [provider, configId]);
  ```

---

**[WARNING]** `onMutate`와 `onError` 간 비대칭 상태 관리
- **위치**: `model-combobox.tsx:64-68` — `onMutate`, `onError` 콜백
- **상세**: `onMutate`는 `errorMessage`만 초기화하고 `models`는 건드리지 않는다. `onError`는 `models`를 보존하고 `errorMessage`만 갱신한다. 결과적으로 성공 로드 → 재시도 중 → 실패 시나리오에서 `models`는 첫 번째 성공의 결과이고 `errorMessage`는 두 번째 시도의 오류인 혼재 상태가 만들어진다. 이 상태 조합은 datalist가 이전 성공의 모델을 보여주면서 동시에 새 오류를 표시하는 정황을 야기한다. 의도적 설계임이 주석에 명시되어 있으나, 두 state가 서로 다른 요청 시도에서 비롯된다는 점이 비자명하다.
- **제안**: 인라인 주석으로 의도 명시:
  ```tsx
  onError: (err: unknown) => {
    // 재시도 실패 시 models는 보존 — 사용자가 이미 선택한 값을 유지하기 위함.
    // models와 errorMessage가 서로 다른 요청 시도에서 온 것은 의도된 동작.
  ```

---

**[INFO]** `ValidateIf` 조건: `baseUrl: ""` 은 `undefined`와 다르게 처리됨
- **위치**: `preview-llm-models.dto.ts:42-50`
- **상세**: `@ValidateIf((dto) => PROVIDERS_REQUIRING_BASE_URL.includes(dto.provider) || dto.baseUrl !== undefined)` 에서 `baseUrl: ""`은 `"" !== undefined` = `true`이므로 모든 하위 validator가 실행된다. openai 프로바이더에 `baseUrl: ""`을 전달하면 `@IsNotEmpty`가 실패하여 400을 반환한다. `undefined`(필드 생략)는 허용이지만 빈 문자열은 비허용이라는 계약이 프론트엔드 호출자에게 비자명하다. 현재 `model-combobox.tsx`는 `trimmedBaseUrl || undefined`로 빈 문자열을 `undefined`로 변환하여 올바르게 처리하고 있지만, 다른 호출자가 이 계약을 알지 못하고 `baseUrl: ""`을 전송할 경우 예상치 못한 400이 발생한다.
- **제안**: `@ApiPropertyOptional` description에 `"빈 문자열 불가, 생략(undefined) 또는 유효한 URL만 허용"` 명시.

---

**[INFO]** `setErrorMessage(null)` 이중 호출
- **위치**: `model-combobox.tsx:65, 68` — `onMutate`, `onSuccess`
- **상세**: `onMutate`에서 `setErrorMessage(null)`, `onSuccess`에서도 `setErrorMessage(null)`을 다시 호출한다. `onSuccess`는 항상 `onMutate` 이후에 실행되므로 `onSuccess`의 호출은 중복이다. 렌더 사이클에 실질적 영향은 없으나 코드 의도를 모호하게 한다.
- **제안**: `onSuccess`에서 `setErrorMessage(null)` 제거 (이미 `onMutate`에서 처리됨).

---

**[INFO]** `llm-configs.test.ts` — `afterEach(vi.restoreAllMocks)` 효과 없음
- **위치**: `llm-configs.test.ts:14-16`
- **상세**: `vi.mock("../client")`로 모듈 수준에서 교체한 mock은 `vi.restoreAllMocks()`로 복원되지 않는다. `restoreAllMocks`는 `vi.spyOn()` 기반 spy에만 효과가 있다. 이 파일에서는 모든 mock이 `vi.mock()`과 `vi.mocked()`를 통해 사용되므로 `afterEach`는 무효 호출이다.
- **제안**: `afterEach(() => vi.restoreAllMocks())` 제거.

---

## 요약

실제 부작용 위험은 `model-combobox.tsx`의 `models` state 생명주기 관리에 집중된다. `models`가 props 변경에 반응하지 않아 사용자가 프로바이더를 바꾼 뒤 이전 모델 목록이 datalist에 잔존하고, `onMutate`/`onError`의 비대칭 처리로 두 state가 서로 다른 요청 시도의 결과를 혼재하여 표현하는 구조가 된다. 두 경우 모두 데이터 손상보다는 UX 혼란에 그치며 사용자의 입력 값(text input `value`)에는 영향이 없다. DTO의 `ValidateIf` 계약(`undefined` vs `""` 처리 차이)은 현재 프론트엔드에서 올바르게 처리되고 있으나 다른 호출자에게 암묵적 함정이 될 수 있다. 전체적으로 의도하지 않은 전역 상태 변경, 파일시스템 접근, 외부 API 우발적 호출 등의 심각한 부작용은 없다.

## 위험도

**LOW**