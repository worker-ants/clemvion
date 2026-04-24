### 발견사항

---

**[WARNING]** `useSavedConfig && configId` 이중 검사
- **위치**: `model-combobox.tsx:65`
- **상세**: `useSavedConfig = Boolean(configId) && !trimmedKey`가 이미 `configId` 존재를 포함하므로 `if (useSavedConfig && configId)`의 `&& configId`는 항상 참. 이 중복 조건은 두 변수 간의 논리적 관계를 읽는 사람이 파악하기 어렵게 만들며, 향후 `useSavedConfig` 정의가 바뀌면 여기도 함께 고쳐야 함을 놓치기 쉽다.
- **제안**: `if (useSavedConfig)` 로 단순화.

---

**[WARNING]** `onSuccess`에서 `setErrorMessage(null)` 중복 호출
- **위치**: `model-combobox.tsx:69-71`
- **상세**: `onMutate`에서 이미 `setErrorMessage(null)`을 호출하는데 `onSuccess`에서 다시 호출한다. 성공 경로에서는 `onMutate` 이후 에러 메시지가 달리 세팅될 경로가 없으므로 중복이다. 읽는 사람에게 "성공 시 에러가 발생할 수 있다"는 거짓 인상을 준다.
- **제안**: `onSuccess` 내 `setErrorMessage(null)` 제거.

---

**[WARNING]** `trimmedBaseUrl` 조건이 verbose ternary
- **위치**: `model-combobox.tsx:52-54`
- **상세**: `const trimmedBaseUrl = baseUrl?.trim(); ... baseUrl: trimmedBaseUrl ? trimmedBaseUrl : undefined` 구문은 `baseUrl: trimmedBaseUrl || undefined`로 표현 가능. 바로 위의 `trimmedKey`는 `apiKey.trim()`이고 이를 직접 쓰는 반면, `baseUrl`만 다른 패턴을 쓰고 있어 일관성도 없다.
- **제안**: `baseUrl: trimmedBaseUrl || undefined`

---

**[WARNING]** `apiKey.trim()` 중복 평가
- **위치**: `model-combobox.tsx:44`, `84`, `87`
- **상세**: `mutationFn` 내부의 `trimmedKey`와 `canLoad` useMemo 내부에서 `apiKey.trim()`이 독립적으로 각각 계산된다. 성능 문제는 아니지만, 두 컨텍스트가 서로 다른 스냅샷을 볼 가능성이 있고(클로저 캡처 시점), 동일 연산이 두 곳에 산재하면 하나만 고칠 때 나머지를 누락하기 쉽다.
- **제안**: `trimmedKey`를 `useMemo`나 컴포넌트 렌더 최상단에서 한 번 계산하고 양쪽에서 참조.

---

**[WARNING]** `Record<string, jest.Mock>` 타입으로 mock drift 무음 허용
- **위치**: `llm-config.controller.spec.ts:4-5`
- **상세**: `mockLlmService`를 `Record<string, jest.Mock>`으로 선언하면 `LlmService`의 public 메서드 시그니처가 변경되어도 TypeScript 오류 없이 컴파일된다. `previewModels` 파라미터 타입이 바뀌거나 메서드명이 바뀌어도 이 테스트는 녹색을 유지해 컨트롤러가 실제 서비스 계약과 어긋나게 동작해도 감지할 수 없다.
- **제안**: `jest.Mocked<Pick<LlmService, 'previewModels' | 'listModels' | 'testConnection'>>` 처럼 부분 타입을 명시해 계약 변경 시 컴파일 단계에서 감지.

---

**[WARNING]** `clearClientCache` 미사용 mock 항목
- **위치**: `llm-config.controller.spec.ts:22`
- **상세**: `mockLlmService`에 `clearClientCache: jest.fn()`이 포함되어 있지만 파일 어디에서도 호출·검증하지 않는다. 테스트 대상인 `previewModels` 핸들러가 `clearClientCache`를 사용하지 않으므로 이 항목은 유효한 계약을 설명하는 것처럼 오독된다.
- **제안**: `clearClientCache` 항목 제거. 나중에 관련 테스트가 추가될 때 함께 넣는다.

---

**[WARNING]** `"falls back to the body itself"` 케이스가 버그 우회를 영구 계약처럼 고착화
- **위치**: `llm-configs.test.ts:34-43`
- **상세**: `listModels`와 `previewModels` 양쪽에 "falls back to the body itself when not enveloped" 케이스가 있다. RESOLUTION.md(W-12)에서 "인터셉터 중앙화 전 임시 계약"임을 인정하지만 테스트 설명에서는 `"(interim dual-shape contract)"`가 `listModels`에만 붙어 있고 `previewModels`(39번째 케이스)에는 붙지 않았다. 나중에 인터셉터를 중앙화할 때 이 케이스가 제거 대상인지 아닌지 판별하기 어렵다.
- **제안**: `previewModels` fallback 케이스 설명에도 `"(interim...)"` 접미사 또는 `// TODO: remove after apiClient interceptor centralizes unwrapping` 주석 추가.

---

**[INFO]** `!(baseUrl?.trim() ?? "")` 패턴이 불필요하게 복잡
- **위치**: `model-combobox.tsx:79`
- **상세**: `baseUrl?.trim()` 자체가 `undefined` → `undefined`, `""` → `""` (모두 falsy)를 반환하므로 `?? ""`는 의미 없는 중간 단계다. `!baseUrl?.trim()`으로 동일하게 표현된다.
- **제안**: `!(baseUrl?.trim() ?? "")` → `!baseUrl?.trim()`

---

**[INFO]** `providerRequiresApiKey`의 빈 문자열 처리 의도 미문서화
- **위치**: `model-combobox.tsx:33-35`
- **상세**: `provider !== ""` 조건이 왜 필요한지 함수 이름만으로는 알 수 없다. `""`는 "선택되지 않은 상태"를 나타내는 암묵적 규약인데, 이 가정이 어디에도 표현되지 않아 나중에 provider 목록이 확장될 때 이 함수도 갱신해야 한다는 사실을 놓치기 쉽다.
- **제안**: `// "" = no provider selected — treated like local (no key required)` 한 줄 인라인 주석.

---

**[INFO]** `models` state와 `loadMutation.data` 이중 진실 소스
- **위치**: `model-combobox.tsx:27`, `68`
- **상세**: `useState<ModelInfo[]>(models)`를 별도로 관리하면서 `onSuccess`에서 `setModels(fetched)`로 갱신한다. `loadMutation.data`가 이미 동일 정보를 보유하므로 진실 소스가 둘이다. `onError` 시 `setModels([])` 로 초기화하는 현재 구현은 "에러 시 이전 목록 유지" 의도(주석에 명시됨)와 상충하는데, 이미 로드된 상태에서 재시도가 실패하면 목록이 사라진다.
- **제안**: `loadMutation.data ?? []`를 직접 파생해 local state 제거, `chatModels`는 `useMemo(() => (loadMutation.data ?? []).filter(m => m.type === "chat"), [loadMutation.data])`로 처리. "에러 시 이전 목록 유지" 의도가 있다면 `useRef`로 마지막 성공 결과를 보관.

---

**[INFO]** `PROVIDERS_REQUIRING_BASE_URL` 프론트/백엔드 이중 정의
- **위치**: `model-combobox.tsx:34`, `preview-llm-models.dto.ts:12`
- **상세**: 백엔드 DTO에 `PROVIDERS_REQUIRING_BASE_URL: ReadonlyArray<LlmProvider>`, 프론트엔드 컴포넌트에 `PROVIDERS_REQUIRING_BASE_URL = new Set([...])` 로 동일 규칙이 두 곳에 독립적으로 정의된다. `azure`를 추가하거나 삭제할 때 한 쪽만 바꾸면 프론트가 버튼을 활성화하지만 백엔드가 거부하는(또는 그 역) 무음 불일치가 발생한다.
- **제안**: 단기적으로는 `@/lib/llm-providers.ts`에 프론트엔드 공유 상수를 추출하고 "백엔드 DTO와 동기화 필요" 주석을 남기는 것으로 충분.

---

### 요약

`preview-llm-models.dto.ts`는 `ValidateIf` 의 복잡한 조건에 대한 주석이 명확하고 `LLM_PROVIDERS` 재사용 패턴도 적절하다. 반면 `model-combobox.tsx`는 세 곳의 복합적인 유지보수 부채를 안고 있다: `useSavedConfig && configId` 이중 가드, `models` local state와 `loadMutation.data`의 이중 진실 소스, 그리고 `PROVIDERS_REQUIRING_BASE_URL`의 백엔드와의 암묵적 이중 정의. 이 세 지점이 provider 추가나 플로우 변경 시 불일치 버그의 온상이 될 수 있다. 컨트롤러 spec은 `Record<string, jest.Mock>` 타입 선언으로 서비스 계약 변경에 무감각하며, API 클라이언트 테스트의 "falls back" 케이스는 임시 우회를 영구 계약처럼 보이게 하는 표현 문제가 있다.

### 위험도

**LOW**