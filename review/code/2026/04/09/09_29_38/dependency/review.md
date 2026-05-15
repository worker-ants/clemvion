## 의존성 코드 리뷰

### 발견사항

- **[INFO]** 신규 외부 의존성 없음 — 모든 변경이 기존 패키지 활용
  - 위치: 전체 변경 파일
  - 상세: `lucide-react`(History 아이콘), `@tanstack/react-query`, `next/navigation`(useParams) 모두 이미 프로젝트에 존재하는 패키지의 새 import. 번들 크기 증가 없음 (tree-shaking 적용).
  - 제안: 이슈 없음.

- **[WARNING]** `executionsApi.getById` 반환 타입 계약 변경 — 소비자 전수 확인 필요
  - 위치: `frontend/src/lib/api/executions.ts` (변경 후 `Promise<ExecutionData>` 반환)
  - 상세: 기존 `apiClient.get<T>()` 반환 타입은 `Promise<AxiosResponse<T>>`이었고, 소비자는 `.data`로 접근했다. 이번 변경에서 `executionsApi.getById`가 unwrap된 `ExecutionData`를 직접 반환하도록 변경됨. `use-execution-events.ts`와 해당 테스트는 업데이트되었으나, `executionsApi.getById`를 사용하는 다른 소비자(예: 페이지 컴포넌트의 `queryFn`)가 여전히 `.data` 접근을 시도하면 `undefined`를 반환한다.
  - 제안: `grep -r "executionsApi.getById" frontend/src`로 모든 소비자를 확인하고 `.data` 접근 패턴이 남아있지 않은지 검증.

- **[INFO]** `unwrap` 헬퍼의 `eslint-disable` 사용
  - 위치: `frontend/src/lib/api/executions.ts` — `unwrap<T>` 함수
  - 상세: 단일 진입점에서 `any` 캐스팅을 집중시켜 컴포넌트 레벨의 산발적 `any` 사용을 제거했다. 의존성 문제는 아니며 오히려 개선.
  - 제안: 이슈 없음. 단, `unwrap` 로직은 `data?.data !== undefined && typeof data.data === "object" && !Array.isArray(data.data)` 조건으로 배열 응답(`PaginatedExecutions.data`)을 의도적으로 제외하고 있는데, `getByWorkflow`의 `data as PaginatedExecutions` 직접 캐스팅과의 일관성 확인 권장.

- **[INFO]** 새 내부 모듈 `@/lib/utils/execution-status.ts` 도입
  - 위치: `frontend/src/lib/utils/execution-status.ts`
  - 상세: 중복 상수/유틸 제거를 위한 단일 출처 모듈로 적절한 추상화. 두 페이지 컴포넌트가 import하며 순환 의존성 없음. 테스트(`execution-status.test.ts`)도 함께 추가됨.
  - 제안: 이슈 없음.

- **[INFO]** 백엔드 `carousel.handler.ts` — 새 의존성 없음
  - 위치: `backend/src/modules/execution-engine/handlers/presentation/carousel.handler.ts`
  - 상세: `validateItemButtons`, `buttonItemMap` 등 신규 로직 모두 기존 타입과 내부 헬퍼만 사용.
  - 제안: 이슈 없음.

---

### 요약

이번 변경에서 추가된 신규 외부 의존성은 없으며, 번들 크기·라이선스·보안 취약점 관점에서 리스크가 없는 안전한 변경이다. 의존성 관점에서 유일한 주의 사항은 `executionsApi.getById`의 반환 타입이 `AxiosResponse<ExecutionData>` → `ExecutionData`로 변경된 내부 계약 파괴로, `use-execution-events.ts`는 이미 업데이트되었지만 다른 소비자(페이지 컴포넌트 `queryFn` 등)에서 `.data` 접근이 남아있으면 런타임 `undefined` 오류로 이어진다. 모든 소비자 전수 확인이 완료되었다면 위험도는 사실상 NONE이다.

### 위험도

**LOW** (executionsApi.getById 소비자 전수 확인 완료 시 NONE)