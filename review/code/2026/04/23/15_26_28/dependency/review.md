### 발견사항

- **[INFO]** `model-combobox.tsx`에서 `axios` 직접 임포트
  - 위치: `frontend/src/components/llm-config/model-combobox.tsx` (상단 임포트)
  - 상세: `axios.isAxiosError`를 사용하기 위해 axios를 직접 임포트함. axios가 이미 프로젝트 의존성에 포함되어 있으므로 새 패키지 추가는 아니지만, UI 컴포넌트가 HTTP 클라이언트 구현 세부 사항에 직접 결합됨. 향후 HTTP 클라이언트를 교체하거나 래핑 시 이 컴포넌트도 수정해야 함.
  - 제안: API 레이어(`llm-configs.ts`)에서 에러를 정규화된 형태로 변환해 throw하거나, `@/lib/api/client`에서 `isApiError` 유틸리티를 export해 사용하는 방식이 더 적절함.

- **[INFO]** `preview-llm-models.dto.ts`에서 `LLM_PROVIDERS`, `LlmProvider`를 `create-llm-config.dto`로부터 재사용
  - 위치: `backend/src/modules/llm-config/dto/preview-llm-models.dto.ts`
  - 상세: 기존 상수·타입을 재사용하는 올바른 패턴. provider 목록 변경 시 단일 위치만 수정하면 됨.
  - 제안: 현행 유지.

- **[INFO]** `llm-configs.ts`의 `listModels` 응답 정규화 변경
  - 위치: `frontend/src/lib/api/llm-configs.ts`, `listModels` 함수
  - 상세: `data as ModelInfo[]` → `(data?.data ?? data) as ModelInfo[]`로 변경. API 래퍼 응답 구조(`{ data: [...] }`) 처리를 일관되게 맞춘 것으로, 기존 버그 수정에 해당. 의존성 이슈 없음.

### 요약

이번 변경에서 새로 추가된 외부 패키지는 없음. 모든 의존성(class-validator, @nestjs/swagger, @tanstack/react-query, lucide-react, axios)은 기존 프로젝트 의존성이며, 내부 모듈 간 의존 관계도 `LLM_PROVIDERS` 상수 재사용 등 적절하게 구성됨. 유일한 지적 사항은 `model-combobox.tsx`가 axios를 직접 임포트해 HTTP 클라이언트 구현에 결합되는 것으로, 기능 동작에는 문제없으나 추상화 경계를 약화시킴.

### 위험도

**LOW**