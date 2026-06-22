### 발견사항

- **[INFO]** API 레이어 단일 책임 강화 — 정방향 리팩터
  - 위치: `codebase/frontend/src/lib/api/triggers.ts`, `trigger-delete-dialog.tsx`, `trigger-history-dialog.tsx`
  - 상세: 이번 변경으로 트리거 도메인의 직접 `apiClient` 호출 13곳 전부가 `triggersApi` 카탈로그로 집결됐다. 컴포넌트(프레젠테이션 레이어)가 HTTP 동사·경로 문자열을 직접 조합하는 책임을 내려놓고 도메인 API 모듈에 위임하는 구조로, SRP 및 레이어 책임 분리 방향과 부합한다.
  - 제안: 해당 없음(긍정 발견).

- **[WARNING]** `TriggerDeleteDialog` 내 캐시 무효화 책임 미분리 — 레이어 책임 경계 모호
  - 위치: `codebase/frontend/src/components/triggers/trigger-delete-dialog.tsx` L150, L157
  - 상세: 컴포넌트가 `queryClient.invalidateQueries({ queryKey: ["triggers"] })`를 `onSuccess`·`onError(404)` 두 경로 모두에서 직접 호출한다. `["triggers"]` prefix 무효화는 "이 컴포넌트를 사용하는 페이지"에 암묵적으로 결합되어 있어, 컴포넌트를 다른 화면에서 재사용할 경우 의도치 않은 광범위 refetch가 발생할 수 있다. 파일 내 JSDoc 주석이 이 위험을 이미 인식해 `onDeleted?: () => void` prop 패턴을 언급하고 있으나, 실제 구조로 반영되지 않은 상태다. 현재 단일 사용처(`page.tsx`)에서는 무해하지만, 재사용 가능한 Dialog로 export되는 이상 인터페이스 설계가 내부 캐시 정책에 결합되어 있다는 점은 개방-폐쇄 원칙(OCP) 관점의 약점이다.
  - 제안: `onDeleted?: () => void` prop을 추가하고, 캐시 무효화 책임을 호출자(page.tsx)에게 위임한다. 컴포넌트는 삭제 성공 신호만 전달하고, 어떤 쿼리키를 무효화할지는 호출자가 결정하도록 분리하면 재사용성과 레이어 책임이 모두 개선된다. M-8 2단계 god-component 분리 시 함께 처리하는 것을 권장한다.

- **[WARNING]** `getHistory` 제네릭 타입 매개변수 + 다중 응답 형태 정규화 — 추상화 수준 불일치
  - 위치: `codebase/frontend/src/lib/api/triggers.ts` L836-843
  - 상세: `getHistory<T>` 가 제네릭을 받지만 실제 호출부(`trigger-history-dialog.tsx`)는 `TriggerHistoryEntry`를 명시적으로 전달하고 있고, 함수 내부의 `body.data ?? body`, `Array.isArray(data) ? data : (data?.items ?? [])` 정규화 로직은 백엔드 응답 형태의 3가지 변형(배열 root, `{data: {items}}` 이중 봉투, `{data: {}}` 빈값)을 한 줄에서 처리한다. 동일한 패턴이 `getById`에도 이미 존재하므로 이 자체는 codebase 관례를 따른 것이나, 정규화 로직이 각 메서드에 인라인으로 중복되어 있다. 이 패턴이 계속 확산되면 백엔드 응답 envelope 변경 시 수정 지점이 분산된다.
  - 제안: `normalizeEnvelope<T>(res: AxiosResponse, mode: "single" | "array"): T` 형태의 헬퍼를 `lib/api/` 공통 유틸로 추출하는 것을 중기 과제로 검토한다. 현 단계(M-8 1단계)의 범위를 초과하므로 즉각 수정 요구는 아니며, M-8 2단계 또는 별도 리팩터 항목으로 등록을 권장한다.

- **[INFO]** `triggersApi` 객체 리터럴 패턴 — 인터페이스 없는 직접 export
  - 위치: `codebase/frontend/src/lib/api/triggers.ts` L979
  - 상세: `triggersApi`는 `const` 객체 리터럴로 export된다. `executions.ts` 관례를 답습한 것으로 일관성은 있다. 다만 인터페이스 정의 없이 구현체가 직접 노출되므로, 테스트 시 mock 교체는 `vi.mock("../triggers")` 모듈 mock으로 처리된다. 의존성 역전(DIP) 관점에서는 인터페이스 경유가 더 엄격하지만, 현 규모(단일 SPA, 단일 백엔드)에서 추가 추상화가 실익보다 복잡도를 높일 가능성이 크다. 현 방향을 유지하는 것이 적절하다.
  - 제안: 해당 없음. 현 패턴 유지가 적절하다.

- **[INFO]** `TriggerDetail` 프론트/백엔드 동명 공존 — 모듈 경계 위험 잠재
  - 위치: `codebase/frontend/src/lib/api/triggers.ts:32` vs 백엔드 `TriggerDetail`
  - 상세: consistency check(W-3)가 이미 지적한 사항. 현재는 프론트/백엔드 컴파일 격리로 런타임 충돌 없으나, shared-types 패키지 도입 시 네임 충돌이 발생할 수 있다. 모듈 경계 명확화 관점에서 M-8 2단계에서 `TriggerDetailView` 등으로 개칭하는 것이 권장된다.
  - 제안: consistency check W-3 권장사항과 동일. M-8 2단계에 포함 처리.

### 요약

이번 변경은 트리거 도메인의 프레젠테이션 레이어(`trigger-delete-dialog.tsx`, `trigger-history-dialog.tsx`)에 잔류하던 `apiClient` 직접 호출 마지막 2곳을 `triggersApi` 카탈로그로 이전 완료한 behavior-preserving 리팩터다. 아키텍처 관점에서 핵심 방향(프레젠테이션-데이터 레이어 분리, 도메인 API SoT 단일화)은 명확하게 달성됐으며, 순환 의존성·안티패턴·레이어 역전은 발견되지 않는다. 주요 개선 여지는 두 가지로, 첫째 `TriggerDeleteDialog`의 캐시 무효화 책임이 컴포넌트에 내재화되어 재사용 시 결합 위험이 있고(WARNING), 둘째 응답 envelope 정규화 로직이 API 레이어 내 각 메서드에 인라인으로 중복 산재해 향후 확장 시 수정 분산 위험이 있다(WARNING). 두 사항 모두 M-8 2단계 이후 처리 가능한 비차단 수준이다.

### 위험도

LOW

STATUS: SUCCESS
