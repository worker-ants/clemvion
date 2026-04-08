### 발견사항

- **[WARNING]** 응답 래핑 구조의 불일치 및 방어적 처리
  - 위치: `[executionId]/page.tsx` L108–112, L121–126
  - 상세: `executionsApi.getById()` 응답을 `(data as unknown as { data?: ExecutionData }).data ?? data`로 처리하고, `getByWorkflow()` 응답도 `(data as any).data ?? data`로 이중 언래핑. API가 `{ data: T }` 래핑을 반환하는지 아닌지 불확실하다는 것을 코드가 스스로 드러내고 있음. 이는 API 응답 스키마가 명확하게 정의되지 않았거나, axios 인터셉터와 실제 API 응답 구조 간에 불일치가 있음을 의미함.
  - 제안: `executionsApi` 레이어에서 응답 정규화를 완전히 처리하고, 호출 측에서는 타입이 보장된 데이터만 받도록 설계. `// API may wrap response in { data: ... }` 같은 주석이 필요한 상황 자체가 계약 위반 신호.

- **[WARNING]** 인접 실행 조회를 위한 비효율적 API 사용 패턴
  - 위치: `[executionId]/page.tsx` L114–132
  - 상세: prev/next 네비게이션을 위해 최대 100건을 조회(`limit: 100`)한 후 클라이언트에서 인접 항목을 탐색. API에 `GET /executions/{executionId}/adjacent` 또는 커서 기반 페이지네이션이 없어 클라이언트가 이를 우회하는 구조. 실행 내역이 100건을 초과하면 인접 탐색이 실패함.
  - 제안: 백엔드에 `prev`/`next` 링크를 포함하는 단일 실행 조회 응답 구조 추가, 또는 커서 기반 페이지네이션 API 도입.

- **[WARNING]** 정렬 파라미터 네이밍 불일치 (`sort` vs `sort_by`)
  - 위치: `[executionId]/page.tsx` L119 (`sort: "started_at"`), `executions/page.tsx` L151–155
  - 상세: 클라이언트 내부 타입 `SortField`는 `"started_at" | "duration_ms" | "status"` snake_case를 사용. `ExecutionListParams`의 `sort` 필드에 그대로 전달. 백엔드 API의 실제 파라미터명이 `sort`인지 `sort_by`인지, 값이 snake_case를 수용하는지 스펙 문서 없이 확인 불가.
  - 제안: `executionsApi` 타입 정의에 허용 값을 리터럴 유니온으로 명시하고 스펙과 동기화.

- **[INFO]** 페이지네이션: `page.tsx`에서 `totalPages` 미존재 시 기본값 1로 처리
  - 위치: `executions/page.tsx` L161
  - 상세: `responseData.totalPages ?? 1`로 폴백하나, API가 `totalPages`를 반환하지 않는 경우 페이지네이션 UI가 숨겨짐. `total`과 `limit`으로 계산하는 방어 로직이 없음.
  - 제안: `Math.ceil(total / limit)`로 `totalPages`를 클라이언트에서 재계산하는 폴백 추가.

- **[INFO]** 테스트의 mock 응답 구조가 이중 래핑 (`{ data: { data: ... } }`)
  - 위치: `execution-detail-page.test.tsx` L18, L93; `execution-list-page.test.tsx` L29
  - 상세: 모든 mock이 `{ data: { data: { items: [...] } } }` 형태. 이는 axios의 응답 래핑(`data`)과 API 서버의 래핑(`data`)이 중첩된 구조를 테스트가 그대로 반영한 것. API 계약이 `{ data: T }` 래핑을 공식적으로 사용한다면 axios 인터셉터에서 한 번만 벗겨야 함.
  - 제안: axios 인스턴스의 response interceptor에서 `data.data` 언래핑을 일괄 처리하여 API 레이어 호출 측이 `T` 타입만 받도록 정규화.

---

### 요약

이 코드의 핵심 API 계약 문제는 **응답 래핑 구조의 미정규화**다. `executionsApi`가 axios 응답(`{ data: ... }`)을 그대로 반환하면서 서버 응답의 `{ data: T }` 래핑까지 겹쳐, 호출 측마다 `(data as any).data ?? data` 패턴이 반복된다. 이는 API 계약이 클라이언트 레이어에서 누수되고 있음을 의미하며, 백엔드 응답 구조 변경 시 여러 컴포넌트를 동시에 수정해야 하는 취약점이 된다. 추가로, 인접 실행 탐색을 위해 100건 bulk 조회를 사용하는 패턴은 백엔드 API의 기능 부재를 클라이언트가 보완하는 계약 위반이다.

### 위험도
**MEDIUM**