### 발견사항

- **[INFO]** `useParams` (`next/navigation`) 신규 임포트 — `run-results-drawer.tsx`
  - 위치: `run-results-drawer.tsx` L2
  - 상세: 기존 프로젝트에 이미 존재하는 `next/navigation` 패키지에서 추가 훅만 임포트. 신규 외부 의존성 없음.
  - 제안: 이슈 없음.

- **[INFO]** `History` 아이콘 (`lucide-react`) 신규 임포트 — `run-results-drawer.tsx`, `workflows/page.tsx`
  - 위치: `run-results-drawer.tsx` L12, `workflows/page.tsx` L20
  - 상세: 기존 프로젝트에서 이미 사용 중인 `lucide-react`에서 named import 추가. tree-shaking 적용됨.
  - 제안: 이슈 없음.

- **[INFO]** `executionsApi` 내부 모듈 의존 관계 변경 — `use-execution-events.ts`
  - 위치: `use-execution-events.ts` L441–443
  - 상세: `executionsApi.getById`의 반환 타입이 `AxiosResponse<ExecutionData>`에서 `ExecutionData`로 변경됨. `use-execution-events.ts`의 `response.data` 접근 패턴이 `execution` 직접 접근으로 올바르게 업데이트되었으나, 테스트의 mock 응답 구조도 `{ data: execution }` → `execution`으로 동기화됨. 내부 API 계약 변경이 의존 모듈과 테스트에 일관되게 반영된 것으로 적절.
  - 제안: 이슈 없음.

- **[INFO]** `unwrap<T>` 헬퍼의 `any` 타입 사용 — `executions.ts`
  - 위치: `frontend/src/lib/api/executions.ts` L49–52
  - 상세: `function unwrap<T>(data: any): T` 내부에서 `eslint-disable` 처리. API 레이어 내부에 격리된 단일 지점으로, 이전에 여러 컴포넌트에 산재하던 `(data as any).data ?? data` 패턴을 일원화한 올바른 개선. 단, `getByWorkflow`는 `unwrap`을 사용하지 않고 `data as PaginatedExecutions`로 직접 캐스팅하여 일관성이 없음.
  - 제안: `getByWorkflow`도 동일하게 `unwrap<PaginatedExecutions>(data)` 사용으로 통일.

- **[INFO]** `carousel.handler.ts`의 `ButtonDef` 타입 내부 의존
  - 위치: `carousel.handler.ts` 전반
  - 상세: `ButtonDef` 타입을 동일 파일 또는 인접 모듈에서 import하여 사용. 순환 의존성 없음.
  - 제안: 이슈 없음.

---

### 요약

이번 변경에서 추가된 신규 외부 의존성은 전혀 없다. 모든 import는 `next/navigation`, `lucide-react`, `@tanstack/react-query` 등 기존 프로젝트에 이미 존재하는 패키지 또는 내부 모듈에서의 추가 활용이다. 번들 크기 증가, 라이선스 충돌, 보안 취약점, 버전 충돌 위험이 없는 안전한 변경이다. 주목할 유일한 내부 의존성 이슈는 `executionsApi.getByWorkflow`가 `unwrap` 헬퍼를 사용하지 않아 `getById`와 응답 처리 방식이 일관되지 않다는 점으로, `unwrap` 도입으로 해결하려던 의도와 어긋난다.

### 위험도

**NONE**