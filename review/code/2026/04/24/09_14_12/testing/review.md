## 발견사항

---

### **[WARNING]** `llm-config.controller.spec.ts` — `as never` 미수정 (4라운드 동안 미해결)
- **위치**: `llm-config.controller.spec.ts:24-26`
- **상세**: 라운드 1(File 3)부터 라운드 4(File 48)까지 모든 testing 리뷰에서 지적했으나 실제 코드에 반영되지 않음. `as never`는 TypeScript 타입 검사를 완전히 우회해 `LlmConfigService`/`LlmService` 시그니처 변경 시 테스트가 무음으로 stale 상태가 됨.
- **제안**: `as unknown as LlmConfigService`, `as unknown as LlmService` 패턴으로 교체. 최소한 인터페이스 변경이 컴파일 오류로 이어지는 수준은 확보해야 함.

---

### **[WARNING]** `llm.service.spec.ts` — 172.16.x.x 범위 및 기존 `listModels` 에러 경로 미검증 (라운드 2에서 지적, 이후 리뷰에서 추적 끊김)
- **위치**: `llm.service.spec.ts` — SSRF 테스트 블록, 기존 `listModels` describe
- **상세**: 라운드 2(File 18)에서 `172.16.0.0/12` SSRF 범위 미검증과 기존 `listModels`의 `withTimeout`·`BadRequestException` 래핑 경로 테스트 미갱신을 WARNING으로 지적했으나, 라운드 3·4 testing 리뷰에서 해당 항목이 다시 등장하지 않아 반영 여부가 불명확함.
- **제안**: 두 항목의 반영 여부를 실제 spec 파일에서 확인 필요. 미반영 시 즉시 추가.
  ```ts
  it('rejects 172.16.x.x (RFC1918 class B)', async () => {
    await expect(service.previewModels({ provider: 'openai', apiKey: 'k', baseUrl: 'http://172.16.0.1' }))
      .rejects.toThrow(BadRequestException);
  });
  ```

---

### **[WARNING]** `google.client.spec.ts` — `MAX_MODELS=100` 상한 및 `models/` prefix 제거 로직 미검증 (라운드 2 지적, 이후 추적 없음)
- **위치**: `google.client.spec.ts` — `listModels` describe 블록
- **상세**: 라운드 2(File 18)에서 두 항목을 WARNING으로 지적했으나 라운드 3·4에서 재확인 없음. 상한 로직은 SDK 페이지네이션 동작 변경 시 silent regression 경로가 됨.
- **제안**:
  ```ts
  it('caps model list at 100 entries', async () => {
    const models = await client.listModels();
    expect(models.length).toBeLessThanOrEqual(100);
  });
  it('strips models/ prefix from resource name', async () => { ... });
  ```

---

### **[WARNING]** `model-combobox.test.tsx` — `onMutate` 에러 즉시 클리어 동작 미검증 (구현 후 테스트 누락)
- **위치**: `model-combobox.test.tsx` 전체
- **상세**: File 48이 확인한 바와 같이 `model-combobox.tsx`에 `onMutate: () => setErrorMessage(null)` 구현은 존재하나 이를 검증하는 테스트 케이스가 없음. 구현-테스트 분리 상태로 회귀 방지가 불가능함.
- **제안** (File 48 제시 코드):
  ```ts
  it('clears the error message immediately when the load button is clicked again', async () => {
    vi.mocked(llmConfigsApi.previewModels)
      .mockRejectedValueOnce(Object.assign(new Error('fail'), {
        isAxiosError: true,
        response: { data: { message: 'Rate limit exceeded' } },
      }))
      .mockResolvedValueOnce([]);
    wrap(<ModelCombobox value="" onChange={vi.fn()} provider="openai" apiKey="sk-xxx" />);
    fireEvent.click(getLoadButton());
    await waitFor(() => expect(screen.getByText(/rate limit exceeded/i)).toBeInTheDocument());
    fireEvent.click(getLoadButton());
    expect(screen.queryByText(/rate limit exceeded/i)).not.toBeInTheDocument();
  });
  ```

---

### **[WARNING]** `model-combobox.test.tsx` — stale closure (provider 불일치) 시나리오 미검증 및 컴포넌트 버그 미수정
- **위치**: `model-combobox.tsx:onSuccess`, `model-combobox.test.tsx`
- **상세**: File 48 기준 `onSuccess`가 여전히 현재 props 검증 없이 `setModels(fetched)`를 호출하며, 이를 검증하는 테스트도 없음. 컴포넌트 수정과 테스트 추가 모두 미완.
- **제안**: `mutationFn` 에서 `{ fetched, snapshot: { provider } }` 를 반환하고 `onSuccess`에서 `snapshot.provider !== provider`이면 무시하는 패턴 적용 후 테스트 추가.

---

### **[WARNING]** 라운드 2·3 testing 리뷰가 이미 해결된 이슈를 WARNING으로 분류 (리뷰 문서 정합성)
- **위치**: `review/2026-04-24_08-11-00/testing/review.md`, `review/2026-04-24_08-16-06/testing/review.md`
- **상세**: File 48이 확인한 바와 같이 라운드 2·3의 WARNING 6건(`mockRejectedValue`, `isPending`, 빈 배열 메시지, `disabled` prop, `previewModels` fallback, 에러 전파)이 실제 코드에서 이미 구현되어 있음. 리뷰 문서가 구 버전 기준으로 작성되거나 최신 코드 상태를 반영하지 않아 RESOLUTION 작성 시 이미 해결된 항목을 조치 대상으로 오인할 수 있음.
- **제안**: RESOLUTION.md 작성 시 라운드 2·3 testing WARNING을 일괄 "이미 해결됨"으로 표시. 이후 리뷰에서는 코드 상태를 직접 확인한 후 이슈를 분류할 것.

---

### **[INFO]** `anthropic.client.spec.ts`, `openai.client.spec.ts` — AbortSignal SDK 전달 미검증 (라운드 2 지적, 이후 추적 없음)
- **위치**: `anthropic.client.spec.ts`, `openai.client.spec.ts`
- **상세**: 서비스 레벨에서 AbortSignal 전달은 검증하나, 클라이언트가 `signal`을 실제 SDK 호출(`client.models.list`)로 전파하는지 클라이언트 단위 테스트가 없음.
- **제안**: 각 클라이언트 spec에 `expect(listMock).toHaveBeenCalledWith(undefined, { signal: ctrl.signal })` 케이스 추가.

---

### **[INFO]** `llm-config.controller.spec.ts` — `clearClientCache` mock 선언만 있고 검증 없음 (라운드 2·3·4 공통 지적, 미해결)
- **위치**: `llm-config.controller.spec.ts:10`
- **상세**: `clearClientCache: jest.fn()`이 선언되어 있으나 어떤 테스트에서도 호출/미호출 여부를 검증하지 않음. 이 항목이 여러 라운드에 걸쳐 반복 지적되었으나 미수정.
- **제안**: 항목 제거 또는 `expect(mockLlmService.clearClientCache).not.toHaveBeenCalled()` 어서트 추가.

---

### **[INFO]** `model-combobox.test.tsx` — `baseUrl` 공백 케이스, datalist 쿼리 주석 (3라운드 동안 미반영)
- **위치**: `model-combobox.test.tsx` 전체, line 119/315
- **상세**: 라운드 1~3에서 반복 지적된 두 항목이 라운드 4 기준에서도 미반영. 기능 정확성 영향은 없으나 지속적인 미반영은 리뷰-구현 피드백 루프 단절을 의미함.
- **제안**: `baseUrl="   "` 케이스 테스트 추가 및 datalist 쿼리에 `// datalist options are not accessible via Testing Library roles; direct DOM query is necessary here` 주석 추가.

---

## 요약

4라운드에 걸친 testing 리뷰 중 라운드 4(File 48)가 실제 코드 상태를 직접 확인해 이전 라운드의 stale 이슈를 정리한 점은 가치 있다. 그러나 진짜 미해결 항목이 여전히 존재한다: `as never` 캐스팅(4라운드 연속 미수정), `onMutate` 에러 클리어 동작의 구현-테스트 분리, stale closure 미수정·미검증, 그리고 라운드 2에서 지적된 백엔드 항목들(`172.16.x.x` SSRF 범위, `listModels` 에러 경로, Google MAX_MODELS 상한, AbortSignal SDK 전달)이 이후 라운드에서 추적이 끊겨 반영 여부가 불명확하다. 라운드 2·3 testing 리뷰가 이미 해결된 항목을 WARNING으로 분류한 문제는 RESOLUTION 작성 시 혼선을 유발할 수 있으므로 정리가 필요하다.

## 위험도

**MEDIUM** — 핵심 SSRF 가드의 172.16.x.x 범위 테스트 누락과 stale closure 버그가 테스트 없이 프로덕션에 존재하는 상태