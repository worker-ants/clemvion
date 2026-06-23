# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/2-navigation, diff-base=origin/main)
검토 일시: 2026-06-23

---

## 발견사항

### 발견사항 없음 — NONE

M-2 브랜치의 실제 변경은 `codebase/frontend` 의 3개 페이지(`dashboard/page.tsx`, `statistics/page.tsx`, `schedules/page.tsx`) 에서 인라인 `apiClient.get()` 직접 호출을 `lib/api/dashboard.ts` · `lib/api/statistics.ts` · `lib/api/schedules.ts` typed 카탈로그 함수로 이전한 순수 내부 리팩토링이다. `spec/2-navigation` 내 어떤 파일도 수정되지 않았으며, API 경로·응답 형태·동작 계약도 변경되지 않았다.

**관점별 검토 결과:**

1. **기각된 대안의 재도입**
   - `0-dashboard.md Rationale` — Success Rate 분모를 `completed/(completed+failed)` 로 되돌리는 변경 없음. `dashboardApi.getSummary()` 는 기존 `/dashboard/summary` 경로를 그대로 호출하며 응답 필드(`successRate`, `avgExecutionTime` 등)를 변경하지 않는다.
   - `0-dashboard.md Rationale` — Avg Time 카드 미노출 결정(초기 초안의 Avg Time 카드 폐기)을 번복하는 UI 변경 없음.
   - `1-workflow-list.md Rationale §2` — Import permissive config 정책(parse 실패 시 raw 보존)을 hard-fail 로 되돌리는 코드 없음 — 해당 logic 은 backend 에 있으며 이번 변경 범위 밖.
   - `14-execution-history.md Rationale R-3` — 단일 `LLM Information` 하위 탭 구조(기각됨)로 복귀하는 UI 변경 없음.

2. **합의된 원칙 위반**
   - `14-execution-history.md Rationale R-1` — 목록 API 가 `nodeExecutions` 를 응답에 포함하지 않는 N+1 회피 원칙 — 이번 리팩토링은 페이지 내 API 호출 위치만 이동하므로 해당 없음.
   - `spec/0-overview.md Rationale` "forward-only" Flyway 원칙 — codebase 변경이며 migration 미포함.
   - `10-auth-flow.md §5.3` "access token 은 URL 에 싣지 않는다 (decision A)" — auth 흐름 미변경.

3. **결정의 무근거 번복**
   - `spec/2-navigation` 문서는 이번 브랜치에서 수정되지 않았다. 구현 코드의 변경도 기존 API 계약 · 응답 타입 · 동작을 그대로 보존한다 (`dashboardApi`, `schedulesApi`, `statisticsApi` 는 기존 인라인 로직을 그대로 함수화한 것이므로 의미상 동등).

4. **암묵적 가정 충돌**
   - `14-execution-history.md §5` 목록 API `sort` 기본값 `started_at` — 이번 변경은 executions API 를 건드리지 않는다.
   - `15-system-status.md Rationale R-2` drill-down 미제공 결정 — system-status 페이지는 이번 M-2 변경 범위 밖.
   - `dashboardApi.getRecentExecutions()` 의 `RecentExecution.triggerSource` 타입이 `ExecutionTriggerSource` (5종 enum) 를 그대로 재사용하므로 `14-execution-history.md Rationale R-2` 의 5종 정규화 원칙과 일치한다.

---

## 요약

M-2 브랜치는 `spec/2-navigation` 을 전혀 수정하지 않았으며, 구현 변경(`dashboard/page.tsx`, `statistics/page.tsx`, `schedules/page.tsx` 의 API 호출 위치 이전)도 기존 API 계약·응답 형태·동작 의미를 보존한다. 기각된 대안 재도입·합의 원칙 위반·무근거 번복·invariant 우회 중 어느 항목에도 해당하지 않는다. 이번 작업은 Rationale 연속성에 영향을 주지 않는 내부 리팩토링이다.

---

## 위험도

NONE
