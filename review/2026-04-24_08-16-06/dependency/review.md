## 발견사항

---

### **[INFO]** `model-combobox.tsx`에서 `axios` 직접 임포트 — UI 레이어가 HTTP 클라이언트에 결합

- **위치**: `frontend/src/components/llm-config/model-combobox.tsx:5`
- **상세**: `import axios from "axios"` 단 한 줄 — `axios.isAxiosError(err)` 호출 하나를 위해 사용. `axios`는 기존 프로젝트 의존성이라 번들 증가는 없으나, UI 컴포넌트가 HTTP 클라이언트 구현 세부사항에 직접 결합된다. 향후 `axios` 교체·래핑 시 이 컴포넌트도 수정 대상이 된다.
- **제안**: API 레이어(`llm-configs.ts`)에서 에러를 정규화된 형태로 변환해 throw하거나, `@/lib/api/client.ts`에서 `isApiError(e: unknown): e is AxiosError` 유틸리티를 export해 컴포넌트가 axios에 직접 의존하지 않도록 분리.

---

### **[INFO]** 백엔드 `LLM_PROVIDERS` 재사용 — 올바른 단일 진실 소스 패턴

- **위치**: `backend/src/modules/llm-config/dto/preview-llm-models.dto.ts:10`
- **상세**: `LLM_PROVIDERS`·`LlmProvider`를 `create-llm-config.dto.ts`에서 재사용. 프로바이더 목록 변경 시 단일 위치만 수정하면 되며 내부 의존성이 적절하게 구성됨.
- **제안**: 현행 유지.

---

### **[INFO]** 프론트엔드 프로바이더 상수 독립 하드코딩 — 백엔드와 암묵적 동기화 의존성

- **위치**: `frontend/src/components/llm-config/model-combobox.tsx:22, 34`
- **상세**: 백엔드는 `LLM_PROVIDERS`를 단일 파일에서 관리하는 반면, 프론트엔드는 `LOCAL_PROVIDER = "local"`과 `PROVIDERS_REQUIRING_BASE_URL = new Set(["azure", "local"])`을 컴포넌트 내부에서 독립적으로 정의한다. `azure`나 `local` 식별자가 바뀌면 두 곳을 별도로 수정해야 하며, 컴파일 타임에 불일치를 감지할 방법이 없다.
- **제안**: `@/lib/constants/llm-providers.ts` 같은 공유 상수 파일을 도입하거나, monorepo 내 `/packages/shared`에 타입·상수를 정의해 프론트엔드가 단일 소스를 참조하도록 구성.

---

### **[INFO]** `llm-config.controller.spec.ts` mock 타입 — `as never` 캐스팅으로 계약 drift 미감지

- **위치**: `backend/src/modules/llm-config/llm-config.controller.spec.ts:24-25`
- **상세**: `mockLlmService as never` 패턴은 TypeScript 타입 시스템을 완전히 우회한다. `LlmService`에 메서드가 추가·변경되어도 컴파일 오류 없이 통과하며, mock이 실제 서비스 계약과 무음으로 diverge할 수 있다. 의존성 관점에서 내부 서비스 계약 변화를 테스트가 감지하지 못한다.
- **제안**: `jest.Mocked<Pick<LlmService, 'testConnection' | 'listModels' | 'previewModels' | 'clearClientCache'>>` 로 타입을 명시해 서비스 인터페이스 변경이 테스트 컴파일 오류로 이어지도록 구성.

---

### **[INFO]** 신규 외부 패키지 없음 — 번들·라이선스·취약점 위험 없음

- **상세**: 이번 변경에서 추가된 외부 패키지가 없다. `class-validator`, `@nestjs/swagger`, `@tanstack/react-query`, `lucide-react`, `axios`, `vitest`, `@testing-library` 모두 기존 프로젝트 의존성이며, 버전 충돌·라이선스 비호환·알려진 취약점 관련 신규 위험이 없다.
- **제안**: 현행 유지.

---

### **[INFO]** 프론트엔드 `QueryClient` 테스트별 격리 — 올바른 패턴

- **위치**: `frontend/src/lib/api/__tests__/llm-configs.test.ts` — `vi.mock("../client", ...)`
- **상세**: `vi.mock`으로 `apiClient`를 모듈 수준에서 교체하고 `beforeEach(() => vi.clearAllMocks())`로 호출 기록을 초기화. 테스트 간 쿼리 캐시 오염 없이 의존성이 격리됨.
- **제안**: 현행 유지.

---

## 요약

이번 변경에서 추가된 신규 외부 패키지는 없으며, 번들 크기·라이선스·보안 취약점 관련 신규 위험은 발생하지 않는다. 내부 의존성 설계에서 백엔드 `preview-llm-models.dto.ts`가 `LlmProvider` 타입을 `create-llm-config.dto.ts`에서 재사용하는 것은 단일 진실 소스 원칙에 부합하는 올바른 패턴이다. 실질적 의존성 이슈는 두 가지로 집약된다: ① `model-combobox.tsx`가 `axios.isAxiosError` 단 한 번을 위해 HTTP 클라이언트에 직접 결합되어 추상화 경계를 약화시키는 것과, ② 백엔드가 관리하는 프로바이더 상수(`LLM_PROVIDERS`, `'local'`, `'azure'`)를 프론트엔드가 독립적으로 하드코딩해 동기화 불일치가 컴파일 타임에 감지되지 않는 것이다. 두 이슈 모두 즉각적 장애 요인은 아니나 프로바이더 추가·변경 시 silent bug의 온상이 될 수 있다.

## 위험도

**LOW**