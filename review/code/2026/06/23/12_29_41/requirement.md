# 요구사항(Requirement) 리뷰 결과

리뷰 대상: commit `cb18b7b` — statistics/schedules/dashboard 페이지 apiClient → lib/api 카탈로그 이전 (refactor m-2)
리뷰 일시: 2026-06-23

---

## 발견사항

### [INFO] 기능 완전성 — 모든 페이지 API 호출 성공적으로 카탈로그 이전

dashboard, statistics, schedules 3개 페이지의 도메인 API 호출이 각각 `dashboardApi`, `statisticsApi`, `schedulesApi` 로 완전히 이전됐다. 잔류한 `apiClient` 직접 호출(`/workflows`)은 cross-domain 이라 주석으로 명시돼 있으며, 이는 의도적 scope-out 이다. 동작 보존 기준(URL·params·body·envelope 언래핑·blob·react-query 키·toast) 이 구조적으로 충족됐다.

### [INFO] spec fidelity — dashboard spec (spec/2-navigation/0-dashboard.md §7) 일치

`DashboardSummary` 인터페이스 7개 필드(`totalWorkflows`, `activeWorkflows`, `runs7d`, `runs7dPrevious`, `runs7dChangePercent`, `successRate`, `avgExecutionTime`)가 spec §7 예시 JSON 필드명과 정확히 일치한다. `RecentWorkflow`·`RecentExecution` 타입도 spec §4·§5 기술 내용과 대응한다. `RecentExecution.triggerSource` 타입이 `ExecutionTriggerSource` (executions.ts에서 재사용)로 정의돼 spec §5 의 "triggerSource 5종" 구조와 부합한다.

### [INFO] spec fidelity — schedules spec (spec/2-navigation/3-schedule.md §4) 일치

`schedulesApi` 의 5개 메서드(list/create/update/delete/runNow)가 spec §4 API 표에 정의된 엔드포인트와 HTTP 메서드, 경로, `PATCH /:id` 의 `{ isActive }` 토글 일치 규약을 정확히 구현한다. spec §4 각주 "별도 `/toggle` 라우트 없음" 이 코드에서 `update(id, { isActive })` 단일 경로로 반영됐다.

### [INFO] spec fidelity — statistics spec (spec/2-navigation/7-statistics.md §3) 일치

`statisticsApi` 의 7개 메서드가 spec §3 의 8개 엔드포인트 중 7개를 커버한다. `StatsSummary`·`ExecutionDataPoint`·`ErrorEntry`·`TopWorkflow`·`NodeStat`·`LlmUsageSummaryResponse` 타입이 spec §2 (요약 카드·차트 설명)에서 파생되는 필드와 구조적으로 일치한다. blob export 경로는 spec §2.6 에 기술된 CSV/JSON 형식을 지원한다.

### [WARNING] [SPEC-DRIFT] statistics spec — `GET /api/statistics/llm-usage/timeseries` 카탈로그 미수록

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/frontend/src/lib/api/statistics.ts` (신규 파일)
- 상세: spec/2-navigation/7-statistics.md §3 은 `GET /api/statistics/llm-usage/timeseries` 를 공식 엔드포인트로 정의하고 있으나, 신규 `statisticsApi` 카탈로그에 `getLlmUsageTimeseries` 메서드가 없다. 현재 `statistics/page.tsx` 도 이 엔드포인트를 호출하지 않으므로 페이지 동작 회귀는 없다. 그러나 카탈로그가 spec 에 정의된 전체 도메인 API 의 SoT 역할을 하려면 이 endpoint 도 포함돼야 한다.
- 판단: 페이지 기능은 timeseries 를 사용하지 않고(spec §2.5 "일별 추이" 차트가 미구현 상태임을 page.tsx 가 보여줌), 카탈로그 누락이 기능 회귀를 유발하지 않으므로 코드가 틀린 것이 아니라 카탈로그가 spec 의 전체 API 목록을 아직 다 반영하지 않은 것이다. 코드 유지 + spec or 카탈로그 보완 대상.
- 제안: 코드 유지. `statisticsApi` 에 `getLlmUsageTimeseries` 추가는 timeseries 위젯 구현 시 함께 수행하거나, spec/7-statistics.md §3 주석에 "카탈로그 미수록(페이지 미구현)" 표기로 갭을 명시. spec 반영 주체: project-planner.

### [WARNING] [SPEC-DRIFT] 3개 spec frontmatter `code:` — 신규 lib/api 파일 미등재

- 위치:
  - `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/spec/2-navigation/0-dashboard.md` (frontmatter)
  - `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/spec/2-navigation/7-statistics.md` (frontmatter)
  - `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/spec/2-navigation/3-schedule.md` (frontmatter)
- 상세: 신규 생성된 `codebase/frontend/src/lib/api/dashboard.ts`, `statistics.ts`, `schedules.ts` 가 각 spec 의 `code:` 목록에 등재되어 있지 않다. `spec-code-paths.test.ts` 가드는 기존 page.tsx 글로브가 여전히 파일을 매칭하므로 빌드 게이트는 통과한다. 그러나 spec `code:` 는 해당 도메인의 구현 SoT 파일 목록이므로, 도메인 API 카탈로그 파일이 누락되면 spec-coverage 감사 시 놓칠 수 있다.
- 판단: 코드(신규 파일 추가)는 의도적·합리적이며 되돌리는 것이 오답이다. spec 갱신 누락.
- 제안: 코드 유지. 각 spec frontmatter `code:` 에 아래 항목 추가를 project-planner 에 위임:
  - `spec/2-navigation/0-dashboard.md`: `codebase/frontend/src/lib/api/dashboard.ts`
  - `spec/2-navigation/7-statistics.md`: `codebase/frontend/src/lib/api/statistics.ts`
  - `spec/2-navigation/3-schedule.md`: `codebase/frontend/src/lib/api/schedules.ts`

### [INFO] 엣지 케이스 — envelope 언래핑 폴백 커버

`unwrap<T>` 함수가 `{ data: T }` envelope 와 bare 배열/원시값 두 경우를 모두 처리한다. `normalizePagedResponse` 도 표준 페이지 응답과 bare array 를 모두 처리한다. dashboard 테스트의 "bare array as-is" 케이스와 schedules 테스트의 "pagination meta absent" 케이스가 이를 검증한다.

### [INFO] 에러 시나리오 — API 에러 처리는 호출부(page) 의존

`dashboardApi`, `statisticsApi`, `schedulesApi` 의 모든 메서드는 에러 처리 없이 `apiClient` 예외를 그대로 throw 한다. react-query 의 `isError` / `onError` 처리가 각 페이지에 이미 존재하므로 이는 기존 패턴과 동일하며 기능 회귀 없다 (`executions.ts`/`triggers.ts` 관례와 일치).

### [INFO] 데이터 유효성 — 입력 파라미터 검증 없음

`statisticsApi` 의 `StatisticsQueryParams` 가 `Record<string, string | number | undefined>` 로 정의돼 타입 안전성은 있으나 런타임 유효성 검증(예: `period` 허용값 `1d|7d|30d|90d|custom`)은 없다. 이는 기존 직접 호출 패턴에도 없던 검증이므로 회귀가 아니며, 유효성 검증 책임이 페이지 컴포넌트에 있는 구조는 유지된다.

### [INFO] 반환값 — 모든 경로 적절

`schedulesApi.create/update/delete/runNow` 가 `Promise<void>` 로 정의돼 있으며, 페이지에서 반환값을 사용하지 않는다. blob export 경로는 `new Blob([res.data as BlobPart])` 로 항상 Blob 인스턴스를 반환한다. `normalizePagedResponse` 는 빈 응답(`null`/`undefined` body)에 대해 `items: []` 로 안전하게 폴백한다.

### [INFO] TODO/FIXME — 미완성 주석 없음, cross-domain 주석만 존재

변경된 코드 전체에 TODO/FIXME/HACK/XXX 주석 없음. schedules/statistics 페이지에 `// /workflows: cross-domain — workflows 트랙에서 이전 예정` 주석이 존재하나, 이는 의도적 scope-out 을 명시한 것으로 미완성 표시가 아니다.

---

## 요약

이번 변경은 behavior-preserving 리팩터링으로, dashboard/statistics/schedules 3개 페이지의 도메인 API 호출을 typed 카탈로그 파일로 성공적으로 이전했다. spec/2-navigation/{0-dashboard, 7-statistics, 3-schedule}.md 본문의 API 엔드포인트·필드명·HTTP 메서드·파라미터·페이지네이션 규약과 코드 구현 사이의 line-level 일치도가 높다. CRITICAL 또는 기능 회귀 발견사항 없음. WARNING 2건은 모두 SPEC-DRIFT (코드가 맞고 spec/카탈로그 갱신 누락) 으로, 코드 수정 대상이 아닌 spec 갱신 대상이다.

---

## 위험도

LOW
