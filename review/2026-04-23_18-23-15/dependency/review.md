## 발견사항

### **[INFO]** `model-combobox.tsx`에서 `axios` 직접 임포트 (기존 의존성 재확인)
- **위치**: `frontend/src/components/llm-config/model-combobox.tsx` — 5번째 import 라인
- **상세**: `axios.isAxiosError` 단 한 번 호출을 위해 UI 컴포넌트가 HTTP 클라이언트 구현에 직접 결합됨. `axios`가 기존 프로젝트 의존성에 포함되어 있으므로 번들 크기 증가는 없으나, 향후 axios 교체 또는 래핑 시 이 컴포넌트도 수정 대상이 됨. API 레이어(`llm-configs.ts`)가 에러를 정규화해서 throw하거나 `@/lib/api/client`에서 `isApiError` 유틸리티를 export하면 이 결합을 끊을 수 있음.
- **제안**: `llm-configs.ts`에서 axios 에러를 domain 에러로 변환 후 throw, 또는 `@/lib/api/client.ts`에서 `export function isApiError(e: unknown): e is AxiosError` 유틸리티 export.

---

### **[INFO]** `LlmProvider`/`LLM_PROVIDERS` 공유 — 백엔드만 적용, 프론트엔드 미적용
- **위치**: `frontend/src/components/llm-config/model-combobox.tsx:22` (`LOCAL_PROVIDER = "local"`)
- **상세**: 백엔드 `preview-llm-models.dto.ts`는 `create-llm-config.dto.ts`에서 `LLM_PROVIDERS`·`LlmProvider`를 올바르게 재사용하나, 프론트엔드는 `'local'`·`'azure'` 등 provider 식별자를 컴포넌트 내부에서 독립적으로 하드코딩함. 프론트에도 공유 constants 파일이 없어 provider 추가 시 두 곳을 별도 수정해야 하는 암묵적 의존성이 생김.
- **제안**: `@/lib/llm-providers.ts` 등에 `LLM_PROVIDERS` 상수와 `LlmProvider` 타입을 export해 프론트엔드 전반에서 재사용.

---

### **[INFO]** 테스트 mock 인터페이스 drift 위험 — `mockLlmService`
- **위치**: `backend/src/modules/llm-config/llm-config.controller.spec.ts` — `beforeEach` 블록
- **상세**: `mockLlmService`를 `Record<string, jest.Mock>`으로 선언하고 수동으로 메서드 목록(`testConnection`, `listModels`, `previewModels`, `clearClientCache`)을 나열함. `LlmService`에 새 public 메서드가 추가되거나 기존 메서드가 rename되어도 타입 오류 없이 컴파일되어 mock이 실제 서비스 계약과 무음으로 diverge할 수 있음.
- **제안**: `Partial<Record<keyof LlmService, jest.Mock>>` 또는 `jest.Mocked<LlmService>`로 선언해 타입 시스템이 drift를 감지하도록 변경.

---

### **[INFO]** `QueryClient` 인스턴스 테스트별 격리 — 올바른 패턴
- **위치**: `frontend/src/components/llm-config/__tests__/model-combobox.test.tsx` — `wrap()` 헬퍼
- **상세**: 각 렌더마다 `new QueryClient({ defaultOptions: { queries: { retry: false } } })`를 새로 생성해 테스트 간 쿼리 캐시 오염을 방지함. `retry: false` 설정으로 네트워크 재시도에 의한 비결정적 타이밍 문제도 제거됨.
- **제안**: 현행 유지.

---

### **[INFO]** 새 외부 패키지 추가 없음 — 변경 전체 기존 의존성만 사용
- **상세**: 이번 변경에서 추가된 외부 패키지는 없음. `class-validator`·`@nestjs/throttler`·`@tanstack/react-query`·`lucide-react`·`axios`·`vitest`·`@testing-library/react` 모두 기존 프로젝트 의존성이며, 내부 모듈 의존 관계도 기존 import 패턴을 따름.
- **제안**: 현행 유지.

---

## 요약

이번 변경에서 새로운 외부 패키지가 추가되지 않았으며, 번들 크기·빌드 시간·라이선스·취약점 관련 신규 위험은 없다. 의존성 관점의 유일한 실질적 이슈는 `model-combobox.tsx`가 `axios.isAxiosError` 단 한 줄을 위해 HTTP 클라이언트에 직접 결합되는 것으로, 이미 기존 의존성이므로 즉각적 위험은 아니나 API 레이어에서 에러 정규화를 담당하면 해소된다. 백엔드는 `LLM_PROVIDERS`·`LlmProvider` 재사용으로 내부 의존성이 잘 정리되어 있으나, 프론트엔드는 동일 상수를 독립 하드코딩해 암묵적 분기 의존성이 있다. 컨트롤러 spec의 mock 타입 선언 방식도 서비스 계약 drift를 타입 시스템이 감지하지 못하는 잠재적 취약점이다.

## 위험도
**LOW**