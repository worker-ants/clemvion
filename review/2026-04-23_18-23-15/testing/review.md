## 발견사항

---

### `llm-config.controller.spec.ts`

- **[WARNING]** `previewModels` 외 다른 컨트롤러 메서드 테스트 전무
  - 위치: 파일 전체
  - 상세: `findAll`, `create`, `update`, `setDefault`, `remove` 등 mock으로만 선언되어 있고 실제 테스트 케이스 없음. `mockLlmConfigService`에 메서드가 선언되어 있어 기존 스펙이 있을 것으로 보이나, 이 파일 기준으로는 신규 추가된 `previewModels` 만 커버
  - 제안: 기존 테스트 파일이 별도로 존재한다면 무시 가능. 아니라면 CRUD 핸들러도 최소 위임 테스트 필요

- **[INFO]** `as never` 타입 캐스팅 사용
  - 위치: `new LlmConfigController(mockLlmConfigService as never, mockLlmService as never)`
  - 상세: `as never`는 TypeScript 타입 체크를 완전히 우회. `Partial<LlmConfigService>`나 구체적인 타입 단언이 더 안전하고 인터페이스 변경 시 테스트가 컴파일 단계에서 경고를 줌
  - 제안: `as unknown as LlmConfigService` 또는 typed mock 유틸리티 사용 검토

- **[INFO]** 에러 전파 테스트에서 `.rejects.toBe(err)` 참조 동등성 사용
  - 위치: `propagates service-layer errors` 케이스
  - 상세: 현재는 올바르지만, `.rejects.toThrow(err)` 이 의미상 더 명확하고 관용적인 패턴. 특히 에러 객체가 변환되는 경우 탐지 가능
  - 제안: 현재 수준 유지 가능. 단 에러 변환 여부를 명시적으로 검증하려면 `.rejects.toThrow()` 권장

---

### `model-combobox.test.tsx`

- **[WARNING]** 에러 mock이 `mockRejectedValue` 대신 synchronous throw 사용
  - 위치: `shows a sanitized error message` 케이스 (파일 하단)
  - 상세: `mockImplementation(() => { throw ... })`는 async `mutationFn` wrapper가 동기 throw를 rejection으로 변환하기 때문에 현재는 동작하지만, 실제 axios 에러는 비동기적으로 발생하므로 의미적으로 부정확. `mockImplementation`이 `Object.create` + `Object.assign`을 사용해 과도하게 복잡한 에러 객체 구성
  - 제안:
    ```ts
    vi.mocked(llmConfigsApi.previewModels).mockRejectedValue(
      Object.assign(new Error('Request failed'), {
        isAxiosError: true,
        response: { data: { message: 'Authentication failed. Please check your API key.' } },
      })
    );
    ```

- **[WARNING]** 로딩 상태(`isPending`) UI 미검증
  - 위치: 파일 전체
  - 상세: 버튼 클릭 후 `isPending` 상태에서 스피너 아이콘과 "로딩 중" 텍스트가 렌더링되는지, 버튼이 비활성화되는지 검증하는 케이스 없음. 이 상태는 중복 클릭 방지의 핵심 메커니즘
  - 제안:
    ```ts
    it('disables the load button and shows spinner while loading', async () => {
      vi.mocked(llmConfigsApi.previewModels).mockImplementation(
        () => new Promise(() => {}), // never resolves
      );
      wrap(<ModelCombobox value="" onChange={vi.fn()} provider="openai" apiKey="sk-xxx" />);
      fireEvent.click(getLoadButton());
      await waitFor(() => expect(getLoadButton()).toBeDisabled());
    });
    ```

- **[WARNING]** 빈 배열 반환 후 "모델 없음" 메시지 미검증
  - 위치: 파일 전체
  - 상세: `loadMutation.isSuccess && chatModels.length === 0` 분기에서 렌더링되는 "noModelsFound" 텍스트가 실제로 표시되는지 확인하는 케이스 없음. `previewModels` mock이 `[]`를 반환하는 케이스("trims apiKey" 등)가 있지만 해당 UI 상태를 assert하지 않음

- **[INFO]** `baseUrl`이 공백 문자열만인 경우 미검증
  - 위치: 없음
  - 상세: `baseUrl="   "` (공백만 있는 경우) 로컬 프로바이더에서 로드 버튼이 비활성화되는지 검증 없음. `PROVIDERS_REQUIRING_BASE_URL.has(provider) && !(baseUrl?.trim() ?? '')` 로직이 이 케이스를 올바르게 처리하는지 확인 필요

- **[INFO]** `disabled` prop 전달 시 동작 미검증
  - 위치: 파일 전체
  - 상세: 컴포넌트에 `disabled` prop이 있고 이를 Input과 Button 양쪽에 전달하지만, 이 prop이 올바르게 전파되는지 확인하는 테스트 없음

- **[INFO]** `datalist option` 직접 DOM 쿼리
  - 위치: `calls previewModels ... and renders chat-only options` 케이스
  - 상세: `document.querySelectorAll("datalist option")` 사용은 Testing Library 원칙에서 벗어나지만 `<datalist>` 특성상 불가피. 주석으로 이 한계를 명시하면 향후 혼란 방지
  - 제안: `// datalist options are not accessible via Testing Library roles; direct DOM query is necessary here`

---

### `llm-configs.test.ts`

- **[WARNING]** `previewModels`의 fallback 언래핑(`data?.data ?? data`) 검증 없음
  - 위치: `previewModels describe` 블록
  - 상세: `listModels`는 엔벨로프 케이스와 비엔벨로프 케이스 2건을 모두 검증하지만, `previewModels`는 엔벨로프 케이스만 1건. 응답이 직접 배열로 오는 경우 fallback 처리가 되는지 미검증
  - 제안: `listModels`의 두 번째 케이스와 동일한 패턴으로 fallback 케이스 추가

- **[WARNING]** API 호출 실패 케이스 테스트 없음
  - 위치: 파일 전체
  - 상세: `listModels`, `previewModels` 모두 성공 경로만 테스트. `apiClient.get/post`가 rejection을 반환하는 경우 에러가 올바르게 전파되는지 미검증
  - 제안: `mockRejectedValue(new Error('Network Error'))` 케이스 추가

- **[INFO]** `beforeEach(() => vi.clearAllMocks())` + `afterEach(() => vi.restoreAllMocks())` 중복
  - 위치: 파일 상단
  - 상세: 두 가지를 함께 사용하면 `vi.fn()`에는 `clearAllMocks`로 충분하고 `restoreAllMocks`는 `vi.spyOn`에만 의미가 있음. 현재 코드에 `spyOn`이 없으므로 `afterEach` 블록이 중복이나 무해함
  - 제안: `afterEach` 제거 또는 주석으로 의도 명시

---

## 요약

테스트 코드 전체의 구조와 커버리지 수준은 양호하다. 버튼 활성화 조건(provider/apiKey/baseUrl 조합), create/edit 플로우 분기, chat 전용 모델 필터링, trim 처리, 에러 메시지 표시 등 핵심 동작이 잘 검증되어 있다. 주요 갭은 세 가지다: `model-combobox.test.tsx`의 에러 mock이 `mockRejectedValue` 대신 동기 throw를 사용해 의미적으로 부정확하고, `isPending` 로딩 상태와 빈 결과 메시지 UI 분기가 검증되지 않았으며, `llm-configs.test.ts`에서 `previewModels`의 fallback 언래핑과 에러 전파 케이스가 누락되어 있다. 이 갭들이 즉각적인 회귀를 일으킬 가능성은 낮지만, 에러 경로 검증 부재는 향후 sanitize 로직 변경 시 silent regression으로 이어질 수 있다.

## 위험도

**LOW**