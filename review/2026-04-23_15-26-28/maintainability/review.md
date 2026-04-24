### 발견사항

- **[WARNING]** 서비스 메서드 인라인 타입 vs DTO 불일치
  - 위치: `llm.service.ts` `previewModels` 시그니처
  - 상세: 메서드가 `{ provider: string; apiKey: string; baseUrl?: string }` 인라인 타입을 받지만, 동일한 모양의 `PreviewLlmModelsDto`가 이미 존재한다. 컨트롤러에서 DTO를 그대로 전달하면 구조적 타이핑으로 동작하지만, 의도가 암묵적이다. 인터페이스가 변경될 경우 서비스 시그니처는 업데이트되지 않을 수 있다.
  - 제안: 공유 인터페이스(`PreviewLlmModelsParams`)를 별도 파일에 정의하거나, 서비스가 DTO를 직접 참조하도록 변경한다.

- **[WARNING]** `'local'` 매직 스트링 중복
  - 위치: `llm.service.ts:193`, `model-combobox.tsx:22` (`providerRequiresApiKey`)
  - 상세: `'local'` 문자열이 백엔드 서비스와 프론트엔드 컴포넌트 양쪽에 독립적으로 하드코딩되어 있다. `LLM_PROVIDERS` 상수가 `create-llm-config.dto.ts`에 이미 정의되어 있음에도 참조하지 않는다. 프로바이더 식별자 변경 시 누락 가능성이 있다.
  - 제안: 프론트엔드에도 providers 상수 파일을 두거나, 백엔드의 경우 `LlmProvider` 타입 리터럴 `'local'`을 상수로 추출한다.

- **[WARNING]** `data?.data ?? data` 응답 정규화 패턴 중복
  - 위치: `llm-configs.ts:72`, `llm-configs.ts:80` (`listModels`, `previewModels`)
  - 상세: API 응답 래핑 해제 로직이 두 메서드에 동일하게 반복된다. 반면 `testConnection`은 `data.data`만 사용해 패턴이 불일치한다. 래핑 구조가 바뀌면 수정 지점이 분산된다.
  - 제안: axios 인터셉터 또는 `apiClient` 래퍼에서 `data.data` unwrapping을 중앙화한다.

- **[INFO]** `useSavedConfig && configId` 이중 검사 중복
  - 위치: `model-combobox.tsx:44-47`
  - 상세: `useSavedConfig`는 이미 `Boolean(configId)`를 포함하므로 `if (useSavedConfig && configId)`에서 `&& configId`는 불필요한 중복이다.
  - 제안: `if (useSavedConfig)` 로 단순화한다.

- **[INFO]** `apiKey.trim()` 반복 호출
  - 위치: `model-combobox.tsx` `mutationFn`, `canLoad`
  - 상세: `apiKey.trim()`이 두 맥락에서 각각 독립적으로 계산된다. 값이 아닌 연산이므로 성능 문제는 없지만 일관성이 낮다.
  - 제안: `const trimmedApiKey = apiKey.trim()` 지역 변수로 추출한다 (특히 `mutationFn` 내부).

- **[INFO]** 서비스 주석이 WHY 대신 WHAT 설명
  - 위치: `llm.service.ts:178-183` JSDoc 블록
  - 상세: 프로젝트 컨벤션은 구현 설명 주석을 금지하고 비자명한 이유만 기록하도록 한다. "캐시를 우회한다", "BadRequest로 변환한다" 등은 코드 자체에서 읽힌다. 단, "API Key는 호출 스코프 밖으로 저장·로깅되지 않는다"는 보안 불변식이므로 남길 이유가 있다.
  - 제안: 보안 의도 한 줄(`API Key는 이 스코프 밖으로 기록되지 않는다`)만 남기고 나머지는 제거한다.

- **[INFO]** `editId ?? undefined` 표현식
  - 위치: `page.tsx:257`
  - 상세: `editId`가 `string | null`이므로 `?? undefined`는 올바르지만, 같은 패턴이 코드베이스의 다른 곳에서는 사용되지 않는다. 가독성 측면에서 `editId || undefined`와의 선택 기준이 불명확하다.
  - 제안: 일관성을 위해 nullable → optional 변환 패턴을 코드베이스에서 통일한다.

---

### 요약

전체적으로 책임 분리, 에러 처리, 보안(API Key 비저장), 테스트 커버리지 모두 잘 설계된 구현이다. 유지보수 관점에서 주요 위험은 `'local'` 매직 스트링의 프런트·백엔드 분산, 서비스 메서드의 인라인 타입과 기존 DTO 간 암묵적 결합, API 응답 unwrap 패턴의 불일치 세 가지로, 이 세 지점이 향후 프로바이더 추가나 API 응답 포맷 변경 시 silent bug의 온상이 될 수 있다. 나머지 지적은 코드 품질을 약간 낮추는 수준이며 즉각적인 위험은 없다.

### 위험도

**LOW**