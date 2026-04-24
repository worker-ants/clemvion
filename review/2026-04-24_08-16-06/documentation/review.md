## 문서화 리뷰 결과

### 발견사항

---

**[WARNING]** `providerRequiresApiKey` — 빈 문자열 처리 의도 미문서화
- **위치**: `frontend/src/components/llm-config/model-combobox.tsx:21`
- **상세**: `provider !== "" && provider !== LOCAL_PROVIDER` 조건에서 빈 문자열을 `local`과 동일하게 "API Key 불필요" 상태로 처리하는 이유가 코드에 드러나지 않음. `""`은 "프로바이더 미선택" 상태를 뜻하는 암묵적 규약인데, 이 규약은 함수 이름(`providerRequiresApiKey`)만 봐서는 알 수 없음. 향후 프로바이더 목록이 확장되거나 빈 문자열 규약이 변경될 때 이 함수를 함께 갱신해야 한다는 사실을 알기 어려움.
- **제안**: 한 줄 인라인 주석으로 충분.
  ```ts
  // "" = 프로바이더 미선택 상태 — local과 동일하게 API Key 불필요로 처리
  function providerRequiresApiKey(provider: string) {
  ```

---

**[WARNING]** `PROVIDERS_REQUIRING_BASE_URL` — `azure` 포함 근거 미명시
- **위치**: `frontend/src/components/llm-config/model-combobox.tsx:20`
- **상세**: `local`은 로컬 서버 주소가 필요하다는 것이 직관적이나, `azure`가 포함된 이유(Azure OpenAI는 배포 엔드포인트 URL이 모델 경로에 포함되는 구조)는 코드만으로 파악하기 어려움. 새 프로바이더 추가 시 이 Set을 갱신해야 하는 기준이 무엇인지 알 수 없음.
- **제안**:
  ```ts
  // azure: 배포 엔드포인트 URL이 모델 경로에 포함되어 baseUrl 필수
  const PROVIDERS_REQUIRING_BASE_URL = new Set(["azure", LOCAL_PROVIDER]);
  ```

---

**[INFO]** `PreviewLlmModelsDto` — 클래스 수준 JSDoc 없음
- **위치**: `backend/src/modules/llm-config/dto/preview-llm-models.dto.ts`
- **상세**: 각 프로퍼티에 `@ApiProperty` 설명은 충실하게 갖춰져 있으나, 클래스 자체의 용도(저장 전 폼 자격증명으로 모델 목록 조회 — DB에 저장되지 않음)와 `local` 프로바이더의 빈 `apiKey` 허용 같은 비자명한 규칙이 클래스 상단에 정리되어 있지 않음. `ValidateIf` 주석이 필드 레벨에서 잘 설명하고 있지만, 클래스를 처음 보는 개발자가 전체 맥락을 한눈에 파악할 수 없음.
- **제안**: 1~2줄 JSDoc 추가.
  ```ts
  /**
   * 저장 전 평문 자격증명으로 프로바이더 모델 목록을 조회할 때 사용.
   * API Key는 이 요청 스코프 밖으로 저장·캐시되지 않음.
   */
  export class PreviewLlmModelsDto {
  ```

---

**[INFO]** `llm-configs.test.ts` — transform interceptor 배경 설명 부재
- **위치**: `frontend/src/lib/api/__tests__/llm-configs.test.ts`
- **상세**: "unwraps the {data: ...} envelope from the transform interceptor"라는 테스트 설명이 인터셉터가 서버사이드(`NestJS TransformInterceptor`)에서 래핑한다는 사실을 언급하지만, 어디에 등록되어 있는지 맥락이 없음. 또한 "interim dual-shape contract"라는 표현이 과도기적 패치임을 암시하지만, 해당 TODO 주석(`// TODO: response envelope 중앙화 적용 시...`)과의 연결이 describe 블록 내에서 명시적이지 않아 두 케이스의 관계를 초기 독자가 오해할 수 있음.
- **제안**: describe 블록 상단에 한 줄 배경 주석 추가.
  ```ts
  describe("listModels", () => {
    // 백엔드 TransformInterceptor가 모든 응답을 { data: T }로 래핑함
  ```

---

**[INFO]** `llm-config.controller.spec.ts` — `as never` 캐스팅 패턴 무설명
- **위치**: `backend/src/modules/llm-config/llm-config.controller.spec.ts:24-25`
- **상세**: `mockLlmConfigService as never`, `mockLlmService as never` 패턴이 왜 `as any` 대신 `as never`를 쓰는지 맥락이 없음. 프로젝트 전반의 관례라면 별도 주석이 불필요하나, 이 파일만 보는 독자에게는 의도가 불명확함.
- **제안**: 프로젝트 내 패턴이 통일되어 있다면 생략 가능. 그렇지 않다면 한 줄 주석: `// DI 타입 검사를 우회하는 프로젝트 관례`

---

### 긍정적 사항

- `ValidateIf` 데코레이터 바로 위의 주석(`// Azure/Local 에서는 baseUrl 이 필수...`)은 "왜"를 정확히 설명하며 CLAUDE.md 컨벤션(WHY만 남김)을 잘 준수함.
- `ModelComboboxProps.apiKey` / `configId` JSDoc이 생성/수정 플로우 분기를 명확히 설명함.
- `onMutate`, `onError` 인라인 주석이 각각 에러 숨김과 모델 목록 보존의 의도를 잘 문서화함.
- `llm-configs.test.ts`의 TODO 주석이 W-12 중앙화 시 제거 대상임을 명시해 기술 부채를 추적 가능하게 함.

---

### 요약

이전 리뷰에서 지적된 핵심 문서화 이슈(`ModelComboboxProps` JSDoc 누락, 로케일 독립 테스트 쿼리)는 모두 반영되어 있으며, `ValidateIf` 로직과 Props 설명은 모범적 수준이다. 남은 문서화 공백은 두 곳에 집중된다: `providerRequiresApiKey`의 빈 문자열 처리 의도와 `PROVIDERS_REQUIRING_BASE_URL`에 `azure`가 포함된 근거 — 둘 다 향후 프로바이더 추가 시 해당 상수를 갱신해야 한다는 사실을 알기 어렵게 만드는 WHY 누락이다. 나머지는 맥락 보완 수준의 INFO 이슈로, 기능 정확성에 영향이 없다.

### 위험도
**LOW**