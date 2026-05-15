### 발견사항

- **[WARNING]** 백엔드 미지원 시 `page`/`limit` 파라미터 동작 미검증
  - 위치: `schedules/page.tsx`, `triggers/page.tsx` (인라인 `apiClient.get`)
  - 상세: 이 두 파일은 타입드 API 클라이언트를 거치지 않고 `apiClient.get("/schedules", { params: { page, limit } })`를 직접 호출합니다. 백엔드가 아직 페이지네이션을 지원하지 않으면 파라미터를 무시하고 전체 목록을 반환하며, 응답에 `pagination` 블록이 없어 `totalPages` 폴백 계산(`Math.ceil(items.length / PAGE_SIZE)`)이 항상 1을 반환합니다. 이 경우 UI에 페이지네이션이 표시되지 않아 사용자가 이후 페이지에 접근 불가합니다.
  - 제안: 백엔드 `/schedules`와 `/triggers` 엔드포인트가 `page`/`limit` 쿼리를 수용하고 `pagination` 블록이 포함된 응답을 반환하는지 확인하거나, 해당 엔드포인트 구현이 완료될 때까지 프론트엔드 페이지네이션을 피처 플래그로 보호하세요.

- **[WARNING]** `queryFn` 반환 타입 변경으로 인한 캐시 구조 불일치 가능성
  - 위치: `schedules/page.tsx:491–540`, `triggers/page.tsx:79–128`
  - 상세: 기존 `useQuery<Schedule[]>`에서 `useQuery<{ items: Schedule[]; totalPages: number }>`로 제네릭 타입이 변경되었습니다. `queryKey`에 `page`가 추가되어 기존 캐시는 다른 키로 격리되므로 일반적인 오염은 없지만, `queryClient.invalidateQueries({ queryKey: ["schedules"] })`와 같이 키 접두사로 무효화하는 코드가 있다면 구조가 다른 캐시를 다시 읽을 때 타입 오류가 발생할 수 있습니다.
  - 제안: `invalidateQueries` 호출부를 grep하여 `["schedules"]`나 `["triggers", ...]` 키를 접두사로 사용하는 모든 지점이 새 응답 구조를 안전하게 처리하는지 확인하세요.

- **[WARNING]** `integrations/page.tsx` 페이지네이션 표시 조건과 다른 페이지의 불일치
  - 위치: `integrations/page.tsx:299–320`
  - 상세: Integrations 페이지만 `pagination && pagination.totalPages > 1` 조건으로 외부에서 가드하고, 나머지 페이지(workflows, executions, knowledge-bases 등)는 `<Pagination>` 컴포넌트 내부에서 `totalPages <= 1`일 때 `null`을 반환합니다. 기능상 동일하지만, `integrations/page.tsx`에서 `pagination` 객체 자체가 없을 때(백엔드가 `pagination` 필드를 내려보내지 않는 경우) 페이지네이션 UI 전체가 렌더링되지 않아 `totalPages` 기본값 처리 로직이 우회됩니다.
  - 제안: `integrations/page.tsx`도 다른 페이지와 동일하게 `<Pagination page={...} totalPages={pagination?.totalPages ?? 1} .../>` 형태로 통일하거나, `pagination` 부재 시 `totalPages`를 산출하는 폴백 로직을 추가하세요.

- **[INFO]** `totalPages` 폴백 계산 로직 4개 파일에 중복
  - 위치: `knowledge-bases/page.tsx:52–57`, `llm-configs/page.tsx:65–70`, `schedules/page.tsx:520–527`, `triggers/page.tsx:109–116`
  - 상세: 동일한 `Math.max(1, data?.pagination?.totalPages ?? Math.ceil(...))` 패턴이 4곳에 복사되어 있어, 폴백 규칙을 수정할 때 모두 동기화해야 합니다. API 클라이언트 레이어나 유틸 함수에서 정규화하면 좋습니다.
  - 제안: `parsePaginatedResponse<T>(data, pageSize)` 유틸을 `@/lib/api/utils`에 추출하여 중복을 제거하세요.

- **[INFO]** `llm-configs/page.tsx`에서 `const PAGE_SIZE = 20;`이 `import` 구문 사이에 삽입됨
  - 위치: `llm-configs/page.tsx:14–20`
  - 상세: `const PAGE_SIZE = 20;` 선언이 두 `import` 블록 사이에 위치해 있습니다. JS 호이스팅 규칙상 동작은 올바르지만, ESLint의 `import/first` 규칙에 위반될 수 있어 CI에서 린트 오류를 유발할 수 있습니다.
  - 제안: `PAGE_SIZE` 선언을 모든 `import` 구문 이후로 이동하세요.

- **[INFO]** `executions/page.tsx`만 `useState`로 page 관리 — URL 동기화 없음
  - 위치: `executions/page.tsx:99`
  - 상세: 실행 목록 페이지는 `usePageParam` 대신 `useState(1)`을 사용합니다. 페이지 새로고침이나 링크 공유 시 항상 1페이지로 초기화됩니다. 현재 스펙상 허용되는 설계로 보이지만, 딥링킹이 필요한 경우 API 계약 관점에서 `?page=` 파라미터가 무시됩니다.
  - 제안: 의도적인 설계라면 코드 주석으로 명시하고, URL 공유가 필요하면 `usePageParam`으로 전환하세요.

---

### 요약

이번 변경은 공용 `Pagination` 컴포넌트와 `usePageParam` 훅을 통해 6개 목록 페이지에 페이지네이션을 일괄 적용한 것으로, 응답 구조의 하위 호환성(배열 폴백, `pagination` 블록 부재 처리)을 고려한 방어적 파싱이 포함되어 있습니다. 스펙 문서도 함께 갱신되어 API 계약 문서화는 일관성을 유지합니다. 다만 `/schedules`와 `/triggers` 엔드포인트의 백엔드 지원 여부가 이 변경의 핵심 전제이며, 미지원 시 해당 페이지에서 페이지네이션이 무음 실패(silent failure)합니다. `totalPages` 폴백 계산의 코드 중복과 `llm-configs` 파일의 import 순서 위반은 기능 위험은 아니지만 유지보수 부채로 남습니다.

### 위험도
**LOW**