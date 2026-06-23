# 신규 식별자 충돌 검토 결과

scope: `spec/2-navigation` (--impl-done, diff-base=origin/main)  
실제 변경 파일: `codebase/frontend/src/lib/api/dashboard.ts`, `schedules.ts`, `statistics.ts` + 해당 페이지 수정

---

## 발견사항

### **[WARNING]** `StatsSummary` (frontend) vs `StatisticsSummary` (backend) — 동일 자원, 다른 이름

- target 신규 식별자: `export interface StatsSummary` — `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/frontend/src/lib/api/statistics.ts:20`
- 기존 사용처: `export interface StatisticsSummary` — `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/backend/src/modules/statistics/statistics.service.ts:10` / `export class StatisticsSummaryDto` — `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/backend/src/modules/statistics/dto/responses/statistics-response.dto.ts`
- 상세: 프론트엔드 API 카탈로그의 `StatsSummary` 와 백엔드 서비스 레이어의 `StatisticsSummary(Dto)` 가 동일 API 응답(`GET /statistics/summary`)을 표현한다. 두 타입의 필드 집합은 동일하다. 레이어 간 직접 import 가 없어 런타임 오류는 없으나, 코드 탐색 시 두 이름이 혼재하면 "같은 것인가" 의 인지 비용이 발생한다.
- 제안: 기존 `lib/api` 카탈로그 관례(다른 파일 참고 — `DashboardSummary` / `DashboardSummaryDto` 패턴)는 백엔드 Dto suffix 를 제거하고 같은 루트 이름을 쓴다. 일관성 유지를 위해 `StatsSummary → StatisticsSummary` 로 rename 하거나, 반대로 백엔드 이름이 더 축약된 형식을 원하면 `StatisticsSummary → StatsSummary` 로 정렬하는 것을 제안한다 (백엔드 변경 없이 프론트엔드만 rename 하는 것이 범위가 좁음). 현 시점 동작 자체는 정상이라 차기 개선 시 반영 가능.

---

### **[WARNING]** `ExecutionDataPoint` (frontend) vs `ExecutionsByPeriod` (backend) — 동일 API 응답 항목, 이름 불일치

- target 신규 식별자: `export interface ExecutionDataPoint` — `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/frontend/src/lib/api/statistics.ts:31`
- 기존 사용처: `export interface ExecutionsByPeriod` — `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/backend/src/modules/statistics/statistics.service.ts:20`
- 상세: `GET /statistics/executions` 응답 항목(`{ date, total, completed, failed, cancelled }`)을 프론트엔드에서 `ExecutionDataPoint`, 백엔드에서 `ExecutionsByPeriod` 로 부른다. 필드 구조는 동일하다.
- 제안: 프론트엔드 이름을 `ExecutionsByPeriod` 로 통일하거나 역으로 백엔드 이름을 맞추는 편이 양쪽 코드를 같이 볼 때 혼선이 없다. 동작에는 영향 없음.

---

### **[WARNING]** `ErrorEntry` (frontend) vs `ErrorStat` (backend) — 동일 API 응답 항목, 이름 불일치

- target 신규 식별자: `export interface ErrorEntry` — `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/frontend/src/lib/api/statistics.ts:38`
- 기존 사용처: `export interface ErrorStat` — `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/backend/src/modules/statistics/statistics.service.ts:27`
- 상세: `GET /statistics/errors` 응답 항목(`{ workflowId, workflowName, errorCount, lastErrorAt }`)을 각 레이어에서 다른 이름으로 부른다. 필드는 동일하다.
- 제안: 이름을 `ErrorStat` 으로 통일하거나, 최소한 JSDoc 에 백엔드 대응 타입명을 명시하여 혼동을 줄인다.

---

### **[WARNING]** `LlmUsageSummaryResponse` (frontend) vs `LlmUsageSummary` (backend) — 동일 API 응답, 이름 불일치

- target 신규 식별자: `export interface LlmUsageSummaryResponse` — `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/frontend/src/lib/api/statistics.ts:71`
- 기존 사용처: `export interface LlmUsageSummary` — `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/backend/src/modules/statistics/statistics.service.ts`; `export class LlmUsageSummaryDto` — `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/backend/src/modules/statistics/dto/responses/statistics-response.dto.ts`
- 상세: `Response` suffix 가 프론트엔드에서만 붙었다. 백엔드의 `LlmUsageSummary` / `LlmUsageSummaryDto` 와 대응 관계가 모호해진다. 필드 일치 여부는 확인됨.
- 제안: `LlmUsageSummaryResponse → LlmUsageSummary` 로 rename 하여 백엔드 이름과 통일. `Response` suffix 는 다른 API 카탈로그 타입에서 사용되지 않는 이례적 패턴이다.

---

### **[INFO]** `StatisticsQueryParams` 타입은 `Record<string, string | number | undefined>` — 과도하게 넓은 타입

- target 신규 식별자: `export type StatisticsQueryParams = Record<string, string | number | undefined>` — `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/frontend/src/lib/api/statistics.ts:15`
- 기존 사용처: 해당 없음 (신규). 비교 대상: 다른 API 카탈로그 파일들(`workflows.ts`, `triggers.ts`)은 params 를 리터럴 필드 타입으로 정의한다.
- 상세: 현재는 통계 쿼리 파라미터가 다양한 조합(`period`, `workflowId`, custom range 등)을 허용해 `Record` 형식이 실용적이다. 충돌 자체는 없으나, 향후 다른 API 파일에서 동일 이름으로 다른 의미의 `StatisticsQueryParams` 가 도입될 경우 혼선 여지가 있다는 INFO 기록.
- 제안: 단기적으로 현재 형태 유지 가능. 파라미터가 안정화되면 구체 필드 타입으로 교체 고려.

---

### **[INFO]** `RawSchedule` — `Raw` prefix 가 다른 API 카탈로그와 다른 관례

- target 신규 식별자: `export interface RawSchedule` — `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/frontend/src/lib/api/schedules.ts:14`
- 기존 사용처: 다른 API 카탈로그(`workflows.ts`, `triggers.ts` 등)는 `Raw` prefix 없이 `TriggerListItem`, `WorkflowListItem` 등 의미 기반 이름을 사용한다. 유일하게 `schedules.ts` 만 `Raw` prefix 를 붙였다.
- 상세: 충돌이 아니라 관례 비일관성. `RawSchedule` 이라는 이름은 "뷰 모델 매핑 전 백엔드 응답 형태" 임을 명시한다는 의도가 있어 실용적이지만, 기존 API 카탈로그 파일들과 명명 패턴이 다르다.
- 제안: 충돌 아님. 단, 다른 파일과 패턴을 통일할 의향이 있다면 `ScheduleListItem` 과 같은 이름으로 교체 고려.

---

## 요약

`spec/2-navigation` 구현 완료 후 도입된 신규 API 카탈로그 파일 3개(`dashboard.ts` / `schedules.ts` / `statistics.ts`)는 기존 식별자와 **CRITICAL 수준의 충돌이 없다**. 동일 식별자가 다른 의미로 사용되는 케이스는 발견되지 않았다. 다만 `statistics.ts` 의 인터페이스 이름 4건(`StatsSummary` / `ExecutionDataPoint` / `ErrorEntry` / `LlmUsageSummaryResponse`)이 백엔드 대응 타입명(`StatisticsSummary` / `ExecutionsByPeriod` / `ErrorStat` / `LlmUsageSummary`)과 불일치하며, 동일 API 응답을 레이어별로 다른 이름으로 부르는 관례 비일관성을 만든다. 이들은 레이어 간 직접 import 가 없어 런타임에는 영향이 없으나, 코드 탐색 비용이 높아지므로 후속 개선 시 정렬이 권장된다.

## 위험도

LOW
