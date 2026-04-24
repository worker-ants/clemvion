## 문서화 리뷰 결과

### 발견사항

---

- **[WARNING]** `spec/5-system/7-llm-client.md` §5.4에서 참조하는 에러 코드가 §6 에러 테이블에 없음
  - 위치: `spec/5-system/7-llm-client.md`, §5.4 및 §6
  - 상세: §5.4는 "§6 에러 매핑 기준으로 sanitize" 된다고 명시하지만, `previewModels`에서 실제로 발생하는 `LLM_CREDENTIALS_REQUIRED`, `LLM_CONFIG_INVALID`, `LLM_MODEL_LIST_FAILED` 세 코드가 §6 에러 테이블에 존재하지 않음. 스펙과 구현 사이에 갭이 있음.
  - 제안: §6 에러 테이블에 세 코드 추가, 또는 §5.4에 "preview 전용 코드이며 §6 표준과 별도"임을 명시

---

- **[WARNING]** `ModelComboboxProps.configId`/`apiKey` 조합 로직이 문서화 없음
  - 위치: `frontend/src/components/llm-config/model-combobox.tsx`, `ModelComboboxProps` 인터페이스
  - 상세: `configId`가 있고 `apiKey`가 비어 있으면 `listModels`, 그 외에는 `previewModels`를 호출하는 분기 로직은 비직관적임. 이 규칙은 인터페이스 선언부에 JSDoc이 없어 prop을 처음 사용하는 개발자가 내부 구현을 읽어야만 이해 가능함.
  - 제안: `configId`와 `apiKey` prop에 JSDoc 추가. 예: `/** Edit flow: if set and apiKey is empty, uses saved encrypted key via GET /:id/models instead of preview-models */`

---

- **[WARNING]** `model-combobox.test.tsx`가 Korean 로케일 문자열에 하드코딩 의존
  - 위치: `frontend/src/components/llm-config/__tests__/model-combobox.test.tsx:24`
  - 상세: `const loadLabel = /모델 불러오기/` 로 button을 쿼리하는데, 컴포넌트 내부에서 `t("llmConfigs.loadModels")`를 `aria-label`로 사용하므로 테스트 환경의 로케일이 Korean이라는 묵시적 가정이 있음. 이 가정이 어디에도 문서화되어 있지 않아 `useT()`가 English를 반환하는 환경에서는 테스트 전체가 실패함.
  - 제안: 테스트 상단에 `// assumes Korean locale (useT returns ko dict)` 주석 추가, 또는 `aria-label`에 `data-testid`를 병행 사용하도록 변경

---

- **[INFO]** `llm-configs.ts`의 `listModels` 언래핑 패턴 변경에 주석 없음
  - 위치: `frontend/src/lib/api/llm-configs.ts`, `listModels`
  - 상세: `return data as ModelInfo[]`에서 `return (data?.data ?? data) as ModelInfo[]`로 변경됨. 이 패턴은 응답 래핑 여부 불일치를 방어적으로 처리하는 것으로 보이는데, 왜 다른 메서드(`getAll`, `getById` 등)는 래핑 처리 없이 `data`를 그대로 반환하는지 맥락이 없음. 처음 읽는 개발자는 이 불일치의 의도를 파악하기 어려움.
  - 제안: 짧은 인라인 주석으로 배경 설명. 예: `// some endpoints return { data: [...] }, others return the array directly`

---

- **[INFO]** `PreviewLlmModelsDto` 클래스 수준 JSDoc 없음
  - 위치: `backend/src/modules/llm-config/dto/preview-llm-models.dto.ts`
  - 상세: 각 프로퍼티에 `@ApiProperty` 설명은 있지만, 클래스 자체의 목적(저장 전 자격증명으로 모델 목록 조회 용도)이나 `local` 프로바이더의 `apiKey` 빈 문자열 허용 같은 비자명적 규칙이 클래스 상단에 정리되어 있지 않음.
  - 제안: 클래스 위에 1~2줄 JSDoc 추가

---

- **[INFO]** `providerRequiresApiKey` 헬퍼 함수 문서 없음
  - 위치: `frontend/src/components/llm-config/model-combobox.tsx:21`
  - 상세: 함수 이름은 직관적이나, `""` (빈 문자열)을 local과 동일하게 API Key 불필요로 취급하는 이유가 불분명함. 추후 provider 목록이 변경될 때 이 함수도 갱신되어야 함을 알기 어려움.
  - 제안: `// Returns false only for "local" and empty-string (no-provider-selected) states` 수준의 인라인 주석

---

### 요약

전반적으로 이번 변경은 문서화 수준이 우수함. Swagger 데코레이터, 양국어 사용자 문서(`.mdx`), 스펙 문서(`.md` 2종) 모두 신기능과 일관되게 갱신되었고, `llm.service.ts`의 JSDoc도 보안 주의사항(API Key 로깅 금지, 캐시 우회)을 명확히 설명함. 다만 §5.4에서 참조하는 에러 코드 3종이 §6 표준 테이블에 빠져 있는 것이 스펙 내부 일관성 측면에서 가장 즉각적인 수정이 필요한 부분이고, `ModelComboboxProps`의 `configId`/`apiKey` 조합 로직은 인터페이스 레벨 문서가 없어 신규 사용자가 오용할 가능성이 있음.

### 위험도
**LOW**