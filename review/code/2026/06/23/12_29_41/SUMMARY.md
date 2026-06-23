# Code Review 통합 보고서

## 전체 위험도
**LOW** — behavior-preserving 리팩터링으로 Critical 발견 없음. Warning 4건 중 2건은 SPEC-DRIFT(코드가 맞고 spec 갱신 필요), 2건은 기술 부채 등록 권장 수준으로 즉시 차단 사유 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `GET /api/statistics/llm-usage/timeseries` 엔드포인트가 spec §3 에 정의되어 있으나 신규 `statisticsApi` 카탈로그에 `getLlmUsageTimeseries` 메서드 미수록. 페이지도 해당 엔드포인트를 호출하지 않으므로 기능 회귀 없음. 카탈로그가 도메인 SoT 역할을 하려면 spec 또는 카탈로그 보완 필요. | `codebase/frontend/src/lib/api/statistics.ts` | 코드 유지. timeseries 위젯 구현 시 메서드 추가 또는 `spec/2-navigation/7-statistics.md §3` 에 "카탈로그 미수록(페이지 미구현)" 표기. project-planner 위임. |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] 신규 생성된 `lib/api/dashboard.ts`, `statistics.ts`, `schedules.ts` 3개 파일이 각 spec frontmatter `code:` 목록에 미등재. spec-coverage 감사 시 누락 위험. | `spec/2-navigation/0-dashboard.md`, `spec/2-navigation/7-statistics.md`, `spec/2-navigation/3-schedule.md` (각 frontmatter) | 코드 유지. 각 spec frontmatter `code:` 에 신규 파일 경로 추가. project-planner 위임. |
| 3 | 아키텍처 | `executions.ts` 내 로컬 `unwrap<T>` 함수가 이번 변경에서 신설된 `lib/api/unwrap.ts` 공유 유틸과 중복 유지됨. 두 구현이 향후 발산할 위험. | `codebase/frontend/src/lib/api/executions.ts` lines 107–111 | 별도 PR 에서 로컬 `unwrap` 을 `import { unwrap } from "./unwrap"` 로 교체. 기술 부채 등록 권장. |
| 4 | 아키텍처 | `statistics/page.tsx` 와 `schedules/page.tsx` 가 각각 `/workflows` 엔드포인트를 `apiClient` 직접 호출로 잔류. 동일 cross-domain 호출이 두 곳에 복제된 상태로 아키텍처 목표의 예외 지속. | `codebase/frontend/src/app/(main)/statistics/page.tsx` line 438, `schedules/page.tsx` line 256 | workflows 트랙 PR 에서 `workflowsApi.list()` 로 통합. plan 에 추적 항목 등록 권장. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | URL 경로에 `id` 파라미터 런타임 검증 없이 보간. 백엔드 인가 레이어가 실질 게이트이므로 현재 수용 가능. | `codebase/frontend/src/lib/api/schedules.ts` update/delete/runNow | 필요 시 UUID 형식 검증 추가 고려. |
| 2 | 보안 | `StatisticsQueryParams`가 `Record<string, string\|number\|undefined>` 광역 허용 타입. 런타임 게이트 아님. | `codebase/frontend/src/lib/api/statistics.ts` line 15–18 | 실제 사용 필드를 명시적 인터페이스로 좁히는 것 고려. |
| 3 | 보안 | `handleExport` catch 블록이 모든 오류를 무음 처리. 인증 만료 등을 사용자가 인지 못할 수 있음. | `statistics/page.tsx` lines 376–378 | `toast.error(...)` 처리 추가 고려. 주석에서 이미 인지됨. |
| 4 | 부작용 | `exportStats`에서 `new Blob([res.data as BlobPart])` 이중 래핑 패턴. 구 코드와 동일하여 회귀 없으나 불필요한 메모리 복사. | `codebase/frontend/src/lib/api/statistics.ts` | `return res.data as Blob;` 으로 단순화 가능. |
| 5 | 테스트 | `statisticsApi.getErrors`·`getNodeStats` 2개 메서드 유닛 테스트 누락. 특히 `getNodeStats`의 `workflowId` 전달 특이점 미검증. | `codebase/frontend/src/lib/api/__tests__/statistics.test.ts` | 각 1개씩 테스트 추가 고려. |
| 6 | 테스트 | `fakeAxios<T>` 헬퍼가 3개 테스트 파일에 복제됨. | `dashboard.test.ts`, `schedules.test.ts`, `statistics.test.ts` | `__tests__/helpers/fake-axios.ts` 공통 파일 추출 고려. |
| 7 | 테스트 | `dashboard/page.tsx` 에 대한 컴포넌트 레벨 테스트 없음. dashboardApi 시그니처 변경 시 페이지 레벨 감지 수단 부재. | `codebase/frontend/src/app/(main)/dashboard/page.tsx` | 별도 이슈로 smoke test 추가 트래킹. |
| 8 | 문서화 | `statistics.ts` 공개 인터페이스 7개에 JSDoc 없음. `dashboard.ts`·`schedules.ts`와 일관성 어긋남. | `codebase/frontend/src/lib/api/statistics.ts` | `dashboard.ts` 패턴 따라 단행 JSDoc 추가. |
| 9 | 유지보수성 | `schedules/page.tsx` `calendarSchedulesQuery`의 `limit: 200` 매직 넘버. | `codebase/frontend/src/app/(main)/schedules/page.tsx` line 247 | `const CALENDAR_MAX_SCHEDULES = 200` 으로 상수화 고려. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 새로운 취약점 없음. INFO 5건(ID 경로 보간, 광역 타입, export 오류 무시 등) |
| architecture | LOW | `executions.ts` 로컬 unwrap 중복(W), cross-domain /workflows 잔류(W) |
| requirement | LOW | SPEC-DRIFT 2건: llm-usage timeseries 미수록, spec frontmatter code: 미갱신 |
| scope | NONE | 범위 내 변경만 확인, 초과 없음 |
| side_effect | NONE | 의도치 않은 부작용 없음. blob 이중 래핑은 기존 동일 패턴 |
| maintainability | NONE | INFO 4건: 광역 타입·매직 넘버·fakeAxios 중복·apiClient 혼용 |
| testing | LOW | getErrors/getNodeStats 테스트 누락, dashboard 컴포넌트 테스트 없음 |
| documentation | LOW | statistics.ts 인터페이스 JSDoc 누락, 일관성 흠 |

## 발견 없는 에이전트

- **scope**: 범위 초과·불필요 변경 없음으로 NONE 판정.
- **side_effect**: 의도치 않은 부작용 없음으로 NONE 판정.
- **security**: 신규 취약점 없음으로 NONE 판정.
- **maintainability**: Critical/Warning 없음으로 NONE 판정.

## 권장 조치사항

1. **[SPEC-DRIFT — project-planner 위임]** spec frontmatter `code:` 갱신: `spec/2-navigation/0-dashboard.md`, `7-statistics.md`, `3-schedule.md` 에 신규 `lib/api/*.ts` 파일 경로 추가.
2. **[SPEC-DRIFT — project-planner 위임]** `spec/2-navigation/7-statistics.md §3` 에 `GET /api/statistics/llm-usage/timeseries` 카탈로그 미수록 상태 명시 또는 timeseries 위젯 구현 시 `statisticsApi.getLlmUsageTimeseries` 추가.
3. **[기술 부채 등록]** `executions.ts` 로컬 `unwrap` → `lib/api/unwrap.ts` 교체 (별도 PR).
4. **[기술 부채 등록]** workflows 트랙 PR 에서 statistics/schedules 페이지의 `/workflows` 직접 호출을 `workflowsApi.list()` 카탈로그로 통합.
5. **[선택적 개선]** `statisticsApi.getErrors`·`getNodeStats` 유닛 테스트 추가 (특히 `workflowId` 전달 정확성 pin).
6. **[선택적 개선]** `statistics.ts` 공개 인터페이스 JSDoc 추가 (`dashboard.ts` 패턴 답습).
7. **[선택적 개선]** `exportStats` blob 이중 래핑 해소: `return res.data as Blob;` 단순화.

## 라우터 결정

라우터가 reviewer 를 선별했습니다 (`routing_status=done`).

- **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (8명, 전원 router_safety 강제 포함)
- **제외**: 6명

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 라우터 선별 제외 |
| dependency | 라우터 선별 제외 |
| database | 라우터 선별 제외 |
| concurrency | 라우터 선별 제외 |
| api_contract | 라우터 선별 제외 |
| user_guide_sync | 라우터 선별 제외 |

- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (전원 강제 포함)