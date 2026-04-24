---

## Testing Code Review

### 발견사항

---

**[INFO] `testing/review.md` 및 `side_effect/review.md` — WARNING 4건이 현재 코드와 불일치 (리뷰 문서 정합성)**
- 위치: `testing/review.md` — `model-combobox.test.tsx` 섹션 전체
- 상세: 리뷰 문서가 경고하는 아래 4개 항목이 실제 테스트 파일에는 이미 구현되어 있다. 리뷰 문서가 구 버전 기준으로 작성된 것으로 보인다.
  - `mockRejectedValue` 미사용 → 실제 코드 line 213 이미 `mockRejectedValue` 사용
  - `isPending` UI 미검증 → line 242–267 "disables the load button while the request is pending" 존재
  - 빈 배열 메시지 미검증 → line 269–283 "renders the 'no models available' hint" 존재
  - `disabled` prop 미검증 → line 339–352 "propagates disabled prop to both input and load button" 존재
- 제안: 리뷰 문서는 **이미 해결된 이슈**로 표시하거나 제거 필요. 이 갭들은 현재 존재하지 않는다.

---

**[INFO] `testing/review.md` — `llm-configs.test.ts` WARNING 2건도 이미 해결됨**
- 위치: `testing/review.md` — `llm-configs.test.ts` 섹션
- 상세:
  - `previewModels` fallback 미검증 → 실제 파일 line 76–86에 "falls back to the body itself" 케이스 존재
  - 에러 전파 미검증 → line 44–48, 88–98에 `mockRejectedValue` 케이스 존재
  - `afterEach(() => vi.restoreAllMocks())` 중복 → 현재 파일에 없음. 이미 제거됨
- 제안: 리뷰 내 해당 WARNING들도 이미 해결된 항목으로 처리 필요.

---

**[WARNING] `llm-config.controller.spec.ts` — `as never` 타입 캐스팅 미수정**
- 위치: `llm-config.controller.spec.ts:23–26`
- 상세: 두 리뷰 모두 INFO 수준으로 지적했으나 현재 코드에서 수정되지 않았다. `as never`는 TypeScript의 구조적 타입 검사를 완전히 우회하여, `LlmConfigController`의 생성자 시그니처가 변경되어도 테스트에서 컴파일 오류가 발생하지 않는다.
  ```ts
  // 현재 — 위험
  controller = new LlmConfigController(
    mockLlmConfigService as never,
    mockLlmService as never,
  );
  // 권장
  controller = new LlmConfigController(
    mockLlmConfigService as unknown as LlmConfigService,
    mockLlmService as unknown as LlmService,
  );
  ```
- 제안: `as unknown as ServiceType` 패턴으로 교체. 인터페이스 변경 시 컴파일 단계에서 탐지 가능.

---

**[WARNING] `llm-config.controller.spec.ts` — CRUD 핸들러 테스트 전무 (미해결)**
- 위치: `llm-config.controller.spec.ts:9–16` (mock 선언부)
- 상세: `findAll`, `create`, `update`, `setDefault`, `remove`가 mock에 선언되어 있으나 대응하는 테스트 케이스가 없다. 두 리뷰 모두 "별도 파일이 있으면 무시 가능"이라 표시했으나, 백엔드 전체에서 이 컨트롤러의 CRUD를 커버하는 스펙 파일이 존재하는지 확인이 필요하다.
- 제안: `llm-config.controller.spec.ts`에 최소한 위임(delegation) 테스트를 추가하거나, 별도 파일이 있다면 명시적으로 주석 처리.

---

**[WARNING] `model-combobox.test.tsx` — `onMutate` 에러 클리어 동작 미검증**
- 위치: `model-combobox.test.tsx` 전체 (해당 케이스 없음)
- 상세: 컴포넌트 `line 68–71`에 `onMutate: () => { setErrorMessage(null); }` 가 구현되어 있다. 즉, 버튼 재클릭 시 이전 에러 메시지가 **요청 시작 시점에 즉시** 사라져야 한다. 현재 테스트 중 "keeps previously loaded models visible when a retry fails"는 에러 메시지가 표시됨을 검증하지만, 3번째 클릭(성공)에서 에러가 즉시 사라지는지는 검증하지 않는다. `side_effect/review.md`가 이 동작을 `onMutate` 부재로 지적했으나, 실제 구현 후 테스트가 추가되지 않았다.
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
    // onMutate 즉시 에러 제거 검증
    expect(screen.queryByText(/rate limit exceeded/i)).not.toBeInTheDocument();
  });
  ```

---

**[WARNING] `model-combobox.test.tsx` — stale closure(props 불일치) 시나리오 미검증**
- 위치: 파일 전체
- 상세: `side_effect/review.md`에서 `mutationFn` 클로저와 `onSuccess` 핸들러 간 provider 불일치를 WARNING으로 지적했으나, 실제 컴포넌트 코드(`model-combobox.tsx`)를 보면 수정이 이루어지지 않았다 — `onSuccess`는 여전히 현재 props 검증 없이 `setModels(fetched)`를 호출한다. 이 동작을 검증하는 테스트도 없다.
- 제안: 컴포넌트 수정이 우선이지만, 수정 전 회귀 방지를 위해 테스트를 먼저 추가하는 것도 유효하다.

---

**[INFO] `model-combobox.test.tsx` — `baseUrl` 공백 케이스 미검증 (미해결)**
- 위치: 파일 전체
- 상세: `testing/review.md`에서 INFO로 지적한 `baseUrl="   "` (공백만 있는 경우) 로컬 프로바이더 비활성화 케이스가 여전히 없다.
  ```ts
  it('disables the load button when local provider has a whitespace-only baseUrl', () => {
    wrap(<ModelCombobox value="" onChange={vi.fn()} provider="local" apiKey="" baseUrl="   " />);
    expect(getLoadButton()).toBeDisabled();
  });
  ```

---

**[INFO] `model-combobox.test.tsx` — `datalist option` 직접 DOM 쿼리 설명 주석 없음 (미해결)**
- 위치: line 119, line 315
- 상세: `testing/review.md`에서 제안한 주석이 추가되지 않았다. `document.querySelectorAll("datalist option")`은 Testing Library 접근 방식과 다르며 후속 개발자에게 혼란을 줄 수 있다.
- 제안: `// datalist options are not accessible via Testing Library roles; direct DOM query is necessary here` 주석 추가.

---

**[INFO] `llm-config.controller.spec.ts` — `.rejects.toBe(err)` 참조 동등성 (미해결)**
- 위치: line 58–60
- 상세: 에러 객체가 동일 참조인지 검증한다. 컨트롤러가 에러를 변환(wrap/rethrow)하는 경우 이 테스트가 통과하지 않아야 하는데, 실제로는 통과한다. 현재는 변환 없음이 암묵적으로 보장되지만 `.rejects.toThrow()` 패턴이 의미상 더 명확하다. `testing/review.md`의 INFO 지적이 미수정 상태다.

---

### 요약

두 리뷰 문서 내 `model-combobox.test.tsx`·`llm-configs.test.ts` 관련 WARNING 6건은 현재 코드에서 이미 수정되어 있어 **리뷰 문서 자체가 구 버전을 기준으로 작성**되었거나, 리뷰 후 빠르게 반영된 것으로 보인다. 현재 실제로 존재하는 테스트 갭은 세 가지다: `llm-config.controller.spec.ts`의 `as never` 캐스팅과 CRUD 위임 테스트 부재(백엔드 안전망 공백), `onMutate` 에러 클리어 동작의 미검증(구현은 되었으나 테스트가 없어 회귀 위험), stale closure 시나리오의 미검증(컴포넌트 버그도 미수정). `baseUrl` 공백 케이스와 datalist 주석은 INFO 수준이다.

### 위험도
**LOW**