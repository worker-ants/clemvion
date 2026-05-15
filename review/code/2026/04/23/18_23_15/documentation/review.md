## 문서화 리뷰 결과

### 발견사항

---

**[WARNING]** `model-combobox.tsx` — `providerRequiresApiKey` 헬퍼의 빈 문자열 처리 미문서화
- **위치**: `model-combobox.tsx:21` `providerRequiresApiKey`
- **상세**: `provider !== "" && provider !== LOCAL_PROVIDER` 패턴에서 빈 문자열을 로컬과 동일하게 "API Key 불필요"로 취급하는 이유가 명시되어 있지 않음. `""` 는 "선택되지 않은 상태"를 표현하는 암묵적 규약으로, provider 목록이 확장될 때 이 함수도 함께 갱신해야 한다는 사실을 알기 어려움.
- **제안**: 1줄 인라인 주석 추가. 예: `// "" = no provider selected — treated like local (no key required)`

---

**[INFO]** `model-combobox.test.tsx` — Axios 에러 mock 복잡 생성 패턴 무설명
- **위치**: `model-combobox.test.tsx` "shows a sanitized error message" 케이스
- **상세**: `Object.create(Object.getPrototypeOf(new Error("fail")))` 패턴으로 에러를 수동 조합함. `new Error()`를 직접 쓰지 않고 이 복잡한 생성 방식을 사용하는 이유(AxiosError 프로토타입 체인을 유지하면서 `isAxiosError` 체크를 통과시키고 `response` 프로퍼티를 추가하기 위함)가 주석 없이는 불분명함.
- **제안**: `// AxiosError prototype chain을 수동 생성 — vi.mocked + mockRejectedValue로도 대체 가능` 수준의 1줄 주석 추가.

---

**[INFO]** `model-combobox.tsx` — `PROVIDERS_REQUIRING_BASE_URL` 상수 맥락 미문서화
- **위치**: `model-combobox.tsx:20` `PROVIDERS_REQUIRING_BASE_URL`
- **상세**: `azure`가 포함된 이유가 상수 이름만으로는 자명하지 않음. `local`은 직관적이나 `azure`는 Azure OpenAI의 배포 엔드포인트 URL 구조 때문에 필수인 점이 새 프로바이더 추가 시 기준이 됨.
- **제안**: 상수 옆에 1줄 주석. 예: `// azure: deployment endpoint URL이 모델 경로에 포함됨`

---

**[INFO]** `llm-config.controller.spec.ts` — `as never` 캐스팅 패턴 무설명
- **위치**: `llm-config.controller.spec.ts:24-25`
- **상세**: `mockLlmConfigService as never`, `mockLlmService as never` 패턴은 프로젝트 내 다른 spec 파일에서 관례적으로 사용되겠으나, 이 파일만 보는 독자에게는 왜 `as any` 대신 `as never`를 쓰는지가 불분명함.
- **제안**: 관례가 프로젝트 전반에 통일되어 있다면 추가 주석은 불필요. 프로젝트 내 패턴이 일관적이지 않다면 `// DI 타입 검사를 우회하는 프로젝트 관례` 주석 추가.

---

**[INFO]** `llm-configs.test.ts` — transform interceptor 컨텍스트 부재
- **위치**: `llm-configs.test.ts` "unwraps the {data: ...} envelope from the transform interceptor" 케이스
- **상세**: 테스트 설명에서 "transform interceptor"를 언급하지만 이 인터셉터가 어디에 등록되어 있는지(서버사이드 `TransformInterceptor` 또는 프론트엔드 axios 인터셉터) 컨텍스트가 없음. "falls back to the body itself when not enveloped (legacy tests/mocks)" 설명은 오히려 이 fallback 동작이 영구적 계약인지 과도기적 패치인지 모호하게 만듦.
- **제안**: 테스트 describe 블록 상단에 1줄 배경 주석. 예: `// 백엔드 TransformInterceptor가 모든 응답을 { data: T } 로 래핑함`

---

### 요약

이번 변경의 문서화 수준은 전반적으로 양호함. 이전 리뷰에서 지적된 `ModelComboboxProps.apiKey`/`configId` JSDoc(I-6)과 로케일 독립 테스트 쿼리(I-7)가 모두 반영되어 있음. 남은 항목은 `providerRequiresApiKey`의 빈 문자열 처리 의도, Axios 에러 mock 생성 패턴, `PROVIDERS_REQUIRING_BASE_URL`의 azure 포함 근거 등 WHY가 비자명한 부분에 대한 1줄 인라인 주석 누락이며, 모두 INFO 수준으로 기능적 위험은 없음.

### 위험도
**LOW**