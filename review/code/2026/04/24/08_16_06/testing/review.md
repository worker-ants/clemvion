## 발견사항

---

### **[WARNING]** `llm-config.controller.spec.ts` — `as never` 캐스트로 서비스 인터페이스 계약 무력화
- **위치**: `llm-config.controller.spec.ts:24-26`
- **상세**: `mockLlmConfigService as never`, `mockLlmService as never` 패턴은 TypeScript 타입 시스템을 완전히 무력화한다. `LlmService.previewModels` 파라미터 타입이 `provider: string` → `provider: LlmProvider`로 변경되었어도 이 테스트는 컴파일 오류 없이 통과한다. mock 객체에 선언된 메서드 시그니처가 실제 서비스 계약과 무음으로 diverge해도 감지 불가능하다.
- **제안**:
  ```typescript
  const mockLlmService: Pick<LlmService, 'testConnection' | 'listModels' | 'previewModels' | 'clearClientCache'> = {
    testConnection: jest.fn(),
    listModels: jest.fn(),
    previewModels: jest.fn(),
    clearClientCache: jest.fn(),
  };
  controller = new LlmConfigController(
    mockLlmConfigService as jest.Mocked<LlmConfigService>,
    mockLlmService as jest.Mocked<LlmService>,
  );
  ```

---

### **[WARNING]** `llm-config.controller.spec.ts` — `clearClientCache` mock이 어떤 테스트에서도 검증되지 않음
- **위치**: `llm-config.controller.spec.ts:10`
- **상세**: `mockLlmService`에 `clearClientCache: jest.fn()`이 선언되어 있으나, 3개의 테스트 케이스 중 어디에서도 이 메서드의 호출 여부 또는 미호출 여부를 검증하지 않는다. `previewModels` 핸들러가 `clearClientCache`를 호출하지 않는다는 점을 명시적으로 검증해야 회귀 방지가 된다.
- **제안**: `clearClientCache` mock을 제거하거나, 테스트에 `expect(mockLlmService.clearClientCache).not.toHaveBeenCalled()` 어서트를 추가한다.

---

### **[WARNING]** `llm-configs.test.ts` — `afterEach(vi.restoreAllMocks)` 실질적 무효
- **위치**: `llm-configs.test.ts:11-16`
- **상세**: `vi.mock('../client', ...)` 으로 모듈을 교체한 경우 `vi.restoreAllMocks()`는 해당 mock을 원본으로 복원하지 않는다. `restoreAllMocks`는 `vi.spyOn()`으로 생성한 spy에만 유효하다. 결과적으로 `afterEach` 훅이 아무 역할도 하지 않으면서 마치 추가적인 격리를 보장하는 것처럼 오해를 유발한다.
- **제안**: `afterEach(vi.restoreAllMocks)` 제거. `vi.clearAllMocks()`만으로 충분하다.

---

### **[WARNING]** `llm-configs.test.ts` — "falls back to the body itself" 테스트가 임시 버그 우회를 영구 계약으로 고착화
- **위치**: `llm-configs.test.ts:34-43`
- **상세**: `data?.data ?? data` 방어 패턴의 fallback 경로를 정식 계약처럼 명세화하고 있다. 향후 axios 인터셉터에서 envelope을 중앙화할 때 이 테스트가 걸림돌이 된다. 파일 내 TODO 주석이 있으나 테스트 명세 자체에 임시성이 드러나지 않는다.
- **제안**: 테스트 이름을 `"interim: accepts raw array until transform interceptor centralizes unwrapping (W-12)"` 으로 변경하고, 케이스 내부에 `// TODO: W-12 중앙화 후 제거` 주석을 추가해 임시 계약임을 명확히 한다.

---

### **[WARNING]** `preview-llm-models.dto.ts` — `baseUrl: ''` (빈 문자열) 엣지 케이스 미테스트
- **위치**: `preview-llm-models.dto.ts:37-46` — `@ValidateIf` 조건부 검증
- **상세**: `ValidateIf`는 `dto.baseUrl !== undefined`를 조건으로 사용한다. `baseUrl: ''`은 `undefined`가 아니므로 ValidateIf가 `true`를 반환하고 `@IsNotEmpty`가 발동해 유효성 검사가 실패한다. openai 같은 baseUrl 선택 프로바이더에서 `baseUrl: ''`을 전달하면 예상치 못한 400 응답을 받는다. dto.spec.ts에 이 케이스가 없으면 회귀 방지가 불완전하다.
- **제안**:
  ```typescript
  it('rejects empty string baseUrl even for non-required providers', async () => {
    await expectValidationError({ provider: 'openai', apiKey: 'sk-x', baseUrl: '' }, 'baseUrl');
  });
  ```

---

### **[INFO]** `llm-config.controller.spec.ts` — 에러 전파 테스트가 에러 불변성만 검증
- **위치**: `llm-config.controller.spec.ts:44-51`
- **상세**: `rejects.toBe(err)`는 동일 참조를 확인해 "컨트롤러가 에러를 변형하지 않고 그대로 던진다"는 계약을 검증한다. 이는 올바른 테스트지만, 에러가 `BadRequestException`인지 여부나 에러 코드는 검증하지 않는다. 서비스 레이어에서 throw한 에러 타입을 컨트롤러가 래핑해서는 안 된다는 계약이 스펙에 있다면 타입 검증이 추가되어야 한다.
- **제안**: 현재 수준은 허용 가능하나, 에러가 NestJS HTTP 예외 클래스인 경우 `rejects.toBeInstanceOf(BadRequestException)` 어서트를 추가하면 계약이 더 명확해진다.

---

### **[INFO]** `llm-configs.test.ts` — `previewModels`에서 `baseUrl` 생략 케이스 미테스트
- **위치**: `llm-configs.test.ts:45-73`
- **상세**: `previewModels`의 두 테스트 케이스 중 하나는 `baseUrl`을 포함하고 다른 하나(`falls back to the body itself`)는 `baseUrl`을 생략한다. 그러나 `baseUrl` 생략 시 API 호출에서 `baseUrl` 키가 payload에서 완전히 제외되는지(`undefined` 직렬화 → 키 누락) 명시적으로 검증하는 케이스가 없다.
- **제안**:
  ```typescript
  it("omits baseUrl key from request body when not provided", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: [] } });
    await llmConfigsApi.previewModels({ provider: "openai", apiKey: "sk-xxx" });
    expect(apiClient.post).toHaveBeenCalledWith(
      "/llm-configs/preview-models",
      expect.not.objectContaining({ baseUrl: expect.anything() }),
    );
  });
  ```

---

### **[INFO]** `llm-config.controller.spec.ts` — `previewModels` 3개 케이스만 존재, 다른 엔드포인트 커버 없음
- **위치**: `llm-config.controller.spec.ts` 전체
- **상세**: 파일명이 `LlmConfigController` 전체를 암시하지만 실제로는 `previewModels`만 테스트한다. 기존 컨트롤러 메서드(`findAll`, `create`, `update`, `setDefault`, `remove`, `testConnection`, `listModels`)에 대한 테스트가 이 파일에 없다. 별도의 컨트롤러 테스트가 없다면 전체적인 컨트롤러 회귀 감지 능력이 `previewModels`에만 집중된다.
- **제안**: 파일 상단에 `// Only covers previewModels; other endpoints covered in integration tests` 주석 추가, 또는 파일을 `llm-config.controller-preview.spec.ts`로 분리 명명한다.

---

### **[INFO]** `model-combobox.tsx` — `loadMutation.isSuccess && chatModels.length === 0` 렌더 분기 미테스트 가능성
- **위치**: `model-combobox.tsx:108-111` — 빈 모델 목록 메시지 렌더링
- **상세**: 컴포넌트에는 로드 성공 후 chat 타입 모델이 없을 때 `t("llmConfigs.noModelsFound")` 메시지를 렌더하는 분기가 존재한다. 리뷰 문서에 따르면 이 케이스에 대한 테스트가 없다.
- **제안**:
  ```typescript
  it("shows no-models-found message when provider returns empty chat model list", async () => {
    vi.mocked(llmConfigsApi.previewModels).mockResolvedValue([
      { id: 'text-embedding-ada', name: 'Ada', type: 'embedding' }  // no chat type
    ]);
    render(wrap(<ModelCombobox ... />));
    await userEvent.click(getLoadButton());
    await waitFor(() => expect(screen.getByText(/noModelsFound/)).toBeInTheDocument());
  });
  ```

---

## 요약

테스트 코드의 전반적인 커버리지 방향성은 양호하다. `previewModels` 서비스 메서드의 핵심 경로(캐시 우회, 자격증명 검증, 에러 sanitize, 30초 타임아웃), DTO 유효성 검사의 주요 케이스, 프론트엔드 API 클라이언트의 요청/응답 계약이 테스트로 고정되어 있다. 다만 세 가지 구조적 문제가 향후 유지보수 위험을 높인다: `as never` 캐스트로 인해 컨트롤러 테스트가 서비스 인터페이스 변경을 타입 수준에서 감지하지 못하고, "falls back to body itself" 테스트가 임시 우회 로직을 영구 계약으로 고착화하며, `afterEach(vi.restoreAllMocks)`가 실질적 무효임에도 격리 보장처럼 오해를 준다. `baseUrl: ''` 엣지 케이스와 빈 모델 목록 렌더 분기의 테스트 부재는 회귀 안전망의 작은 빈틈이다.

## 위험도

**LOW**