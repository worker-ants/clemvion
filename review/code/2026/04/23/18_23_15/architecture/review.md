아키텍처 관점에서 제공된 코드를 분석합니다.

---

## 발견사항

---

**[WARNING] `ModelCombobox` - UI 컴포넌트가 비즈니스 라우팅 로직을 직접 보유 (SRP 위반)**
- 위치: `model-combobox.tsx:63-72` — `mutationFn` 내 분기 로직
- 상세: "저장된 configId가 있고 apiKey가 비어 있으면 `listModels`, 그 외엔 `previewModels`"라는 **생성/수정 플로우 분기**는 도메인 규칙이다. 이 로직이 UI 컴포넌트의 `mutationFn` 안에 내재되어 있어, 컴포넌트가 어떤 API 엔드포인트를 호출할지 스스로 결정하는 구조다. 향후 플로우가 3개 이상으로 분기되거나(`configId` + `apiKey` + `baseUrl` 조합이 늘어날 경우) 컴포넌트 내부가 비대해지고, 호출 전략을 재사용하거나 테스트하기 어려워진다.
- 제안: 분기 결정 로직을 `useModelLoader(provider, apiKey, baseUrl, configId)` 커스텀 훅으로 추출. 컴포넌트는 훅이 반환하는 `load()` 함수만 호출하고, 어떤 엔드포인트를 쓰는지는 모른다.

---

**[WARNING] `useSavedConfig && configId` 이중 가드 — 방어적 코딩이 불변식을 위반**
- 위치: `model-combobox.tsx:65-68`
- 상세:
  ```ts
  const useSavedConfig = Boolean(configId) && !trimmedKey; // configId 참임을 보장
  if (useSavedConfig && configId) {                        // configId 재검사 — 항상 참
  ```
  `useSavedConfig`가 `true`이면 `configId`는 이미 truthy이다. `&& configId` 재검사는 TypeScript 타입 narrowing을 위한 것이지만, 코드상 불변식이 `useSavedConfig` 정의에서 이미 성립한다. 더 큰 문제는 `useSavedConfig`라는 변수가 존재함에도 `configId`를 다시 참조함으로써 이 분기 결정의 단일 진입점이 깨진다는 것이다.
- 제안: `if (useSavedConfig)` 로 단순화. TypeScript narrowing이 필요하면 타입 시그니처를 좁히거나 non-null assertion 사용.

---

**[WARNING] `as never` 타입 단언 — 테스트에서 타입 안전성 완전 포기**
- 위치: `llm-config.controller.spec.ts:24-26`
- 상세:
  ```ts
  controller = new LlmConfigController(
    mockLlmConfigService as never,
    mockLlmService as never,
  );
  ```
  `as never`는 TypeScript 타입 시스템을 완전히 무력화한다. 서비스 인터페이스가 변경되어도 이 테스트는 타입 오류 없이 통과하며, mock 객체의 메서드 시그니처 불일치를 컴파일 단계에서 잡을 수 없다. `mockLlmService`에 `previewModels`가 추가되어 있지만 타입이 강제되지 않아, 실제 `LlmService.previewModels` 시그니처와 달라져도 테스트가 녹색을 유지한다.
- 제안: 부분 mock 타입을 명시적으로 선언:
  ```ts
  const mockLlmService: jest.Mocked<Pick<LlmService, 'previewModels' | 'listModels' | 'testConnection' | 'clearClientCache'>> = { ... };
  ```

---

**[WARNING] `llm-configs.test.ts` — "fallback to body" 케이스가 코드 스멜을 계약으로 고정**
- 위치: `llm-configs.test.ts:38-43` — `"falls back to the body itself when not enveloped"` 케이스
- 상세:
  ```ts
  it("falls back to the body itself when not enveloped (legacy tests/mocks)", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [{ id: "claude-sonnet-4-20250514", ... }],  // envelope 없음
    });
    const result = await llmConfigsApi.listModels("abc");
    expect(result).toHaveLength(1);  // 이 동작이 "정상"으로 확정됨
  });
  ```
  RESOLUTION.md의 W-12에서 "테스트로 동작 계약을 고정"한다고 했지만, 이 케이스는 **두 가지 다른 응답 구조 모두를 허용**하는 것을 계약화한다. 이는 API 레이어의 불일치를 제거하는 대신 영속화하는 방향이다. `data?.data ?? data` 패턴 자체가 envelope 구조의 불일치를 런타임에서 방어적으로 처리하는 것으로, 계약이 명확하지 않은 상태를 코드와 테스트 모두에서 고착시킨다.
- 제안: axios 인터셉터에서 envelope을 일관되게 벗겨내면 이 fallback 분기와 테스트 케이스 자체가 제거된다. 단기적으로 부담이 크면 "legacy" 케이스는 TODO 주석과 함께 남기되, 정상 케이스(`data.data`)만 계약으로 인정하는 방향을 명시.

---

**[INFO] `LlmConfigController`에 프로바이더 비즈니스 규칙(`PROVIDERS_REQUIRING_BASE_URL`) 중복 표현**
- 위치: `model-combobox.tsx:35-39` — `PROVIDERS_REQUIRING_BASE_URL` Set + `providerRequiresApiKey` 함수
- 상세: 백엔드는 `LLM_PROVIDERS`, `LlmProvider` 타입, `local` 분기를 서비스 레이어에서 관리하고, 프론트엔드 컴포넌트는 동일한 규칙을 독립적인 상수(`LOCAL_PROVIDER`, `PROVIDERS_REQUIRING_BASE_URL`)로 중복 정의한다. `azure`가 `baseUrl` 필수 프로바이더 목록에 포함된 것이 백엔드 로직과 일치하는지 컴파일 타임에 검증할 방법이 없다. RESOLUTION I-2에서 "부분 조치"로 남겨졌으나, 실제로는 새 파일에 상수를 추출하는 것만으로는 백엔드와의 동기화 보장이 안 된다.
- 제안: 프로바이더별 요구사항을 공유 타입 패키지(monorepo 내 `/packages/shared`)나 백엔드 API 스키마(`openapi.json`)에서 프론트엔드가 읽는 방식으로 단일 출처를 확보. 단기적으로는 `providers.ts`에 모아두되 백엔드와의 동기화 필요성을 주석으로 명시.

---

**[INFO] `LlmService` 추상화 경계 혼재 — 저장 설정 기반 호출 vs 임시 자격증명 호출**
- 위치: `backend/src/modules/llm/llm.service.ts` — `previewModels` 메서드
- 상세: 기존 메서드(`chat`, `embed`, `testConnection`, `listModels`)는 모두 `LlmConfig` 엔티티(DB에 저장된 설정)를 매개로 동작하지만, `previewModels`는 raw 자격증명을 직접 받는다. 이 두 추상화 레벨이 같은 클래스에 공존하면서 클래스의 인터페이스가 일관되지 않은 입력 계약을 갖게 된다. 이미 architecture review에서 지적되었으며, RESOLUTION에서는 미래 분기 기준점으로 언급했다.
- 제안: 이번 PR 범위는 아니나, `previewModels` 계열이 추가될 시 `LlmCredentialProber` 또는 `LlmPreviewService`로 분리하는 것이 `LlmService`의 응집도를 유지하는 명확한 기준이다.

---

## 요약

전체 구조는 계층 책임 분리(DTO 검증 → 서비스 비즈니스 로직 → 컨트롤러 라우팅)가 잘 정립되어 있고, per-config 캐시 우회·API Key 비영속화·에러 sanitize 등 보안 설계도 아키텍처적으로 올바른 선택이다. 다만 세 가지 구조적 문제가 남아 있다: ① `ModelCombobox`가 어떤 API 엔드포인트를 호출할지 결정하는 플로우 라우팅 로직을 직접 보유하여 SRP를 위반하고 있고(커스텀 훅으로 분리 권장), ② 테스트의 `as never` 타입 단언이 서비스 인터페이스 변경에 대한 컴파일 타임 보호를 완전히 포기하며, ③ `data?.data ?? data` fallback 계약화가 API 응답 envelope 불일치를 해결하는 대신 고착시킨다. 나머지 지적(이중 가드 중복, 프로바이더 상수 분산)은 낮은 위험도의 유지보수 이슈다.

## 위험도

**LOW**