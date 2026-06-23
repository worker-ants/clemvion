# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — Warning 4건(naming_collision, 모두 동작 무관 이름 불일치) + INFO 다수. Critical 0건.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Naming Collision | `StatsSummary`(frontend) vs `StatisticsSummary`/`StatisticsSummaryDto`(backend) — 동일 API 응답, 이름 불일치 | `codebase/frontend/src/lib/api/statistics.ts:20` | `codebase/backend/src/modules/statistics/statistics.service.ts`, `statistics-response.dto.ts` | `StatsSummary → StatisticsSummary` rename. 런타임 영향 없음, 차기 개선 반영 가능 |
| W-2 | Naming Collision | `ExecutionDataPoint`(frontend) vs `ExecutionsByPeriod`(backend) — 동일 API 응답 항목, 이름 불일치 | `codebase/frontend/src/lib/api/statistics.ts:31` | `codebase/backend/src/modules/statistics/statistics.service.ts:20` | 프론트 `ExecutionDataPoint → ExecutionsByPeriod` 또는 역방향 정렬 |
| W-3 | Naming Collision | `ErrorEntry`(frontend) vs `ErrorStat`(backend) — 동일 API 응답 항목, 이름 불일치 | `codebase/frontend/src/lib/api/statistics.ts:38` | `codebase/backend/src/modules/statistics/statistics.service.ts:27` | `ErrorEntry → ErrorStat` 또는 JSDoc 에 대응 타입명 명시 |
| W-4 | Naming Collision | `LlmUsageSummaryResponse`(frontend) vs `LlmUsageSummary`/`LlmUsageSummaryDto`(backend) — `Response` suffix 이례적 패턴 | `codebase/frontend/src/lib/api/statistics.ts:71` | backend `LlmUsageSummary`, `LlmUsageSummaryDto` | `LlmUsageSummaryResponse → LlmUsageSummary` rename. `Response` suffix 는 다른 카탈로그 타입에서 미사용 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `statisticsApi` 의 `LlmUsageSummaryResponse` — spec 미정의 응답 shape 를 백엔드 구현에서 직접 도출 | `codebase/frontend/src/lib/api/statistics.ts` | statistics spec §3 에 응답 필드 요약 한 줄 추가 여부 planner 선택 |
| I-2 | Cross-Spec | `statisticsApi` 에 `/api/statistics/llm-usage/timeseries` 미수록 — spec §3 에 정의된 엔드포인트 | `codebase/frontend/src/lib/api/statistics.ts` | 기존 ai-review W-1 defer 유지. timeseries 위젯 구현 시 메서드 추가 |
| I-3 | Cross-Spec | `ScheduleListParams` 에 `search`/`sort`/`order` 미포함 — known gap 유지 | `codebase/frontend/src/lib/api/schedules.ts` | 페이지 미구현 기능의 의도적 미수록. 실질 충돌 없음 |
| I-4 | Cross-Spec | `DashboardSummary.successRate` 단위 — spec §7 예시(float) vs §3 표시(정수 반올림) 문언 모호 | `codebase/frontend/src/lib/api/dashboard.ts` | API float 응답·UI 반올림으로 일치. spec 문언에 부연 추가 여부 planner 선택 |
| I-5 | Convention Compliance | `14-execution-history.md` — `## Overview (제품 정의)` 절이 인라인 포함, 다른 파일과 구조 불일치 | `spec/2-navigation/14-execution-history.md` | 내용을 `_product-overview.md` 이관 또는 영역 규약 갱신 |
| I-6 | Convention Compliance | `15-system-status.md` — 공식 `## Overview` 헤딩 누락, 단문 산문으로만 개요 제공 | `spec/2-navigation/15-system-status.md` | 규약 갱신(생략 허용 명시) 또는 헤딩 추가 |
| I-7 | Convention Compliance | `16-agent-memory.md` frontmatter `id: nav-agent-memory` — basename 불일치(의도된 패턴) | `spec/2-navigation/16-agent-memory.md` | spec-impl-evidence §2.1 에 명시된 허용 패턴. 변경 불필요 |
| I-8 | Convention Compliance | `14-execution-history.md §5` swagger.md `ApiOkPaginatedResponse` 설명이 이중 data 래퍼처럼 읽힐 수 있음 | `spec/2-navigation/14-execution-history.md §5` | 응답 예시 자체는 규약 준수. swagger.md 내 문구 명확화 고려 |
| I-9 | Convention Compliance | `10-auth-flow.md §5.4` OAuth error query param `lower_snake_case` — historical-artifact 등재됨 | `spec/2-navigation/10-auth-flow.md §5.4` | 이미 처리된 예외. 변경 불필요 |
| I-10 | Plan Coherence | spec frontmatter `code:` 에 신규 API wrapper 파일 미등재 | `spec/2-navigation/0-dashboard.md`, `3-schedule.md`, `7-statistics.md` frontmatter | plan 완료 후 planner 가 각 spec frontmatter `code:` 에 wrapper 경로 추가 |
| I-11 | Plan Coherence | `spec-sync-schedule-gaps.md` 미해결 frontend 항목과 `schedules/page.tsx` 수정 범위 구분 | `plan/in-progress/spec-sync-schedule-gaps.md` | plan 주석에 "apiClient 이전(m-2)은 별도 PR 완료" 기록 권장 |
| I-12 | Naming Collision | `StatisticsQueryParams` 가 `Record<string, string | number | undefined>` — 과도하게 넓은 타입 | `codebase/frontend/src/lib/api/statistics.ts:15` | 단기 현상 유지. 파라미터 안정화 후 구체 필드 타입으로 교체 고려 |
| I-13 | Naming Collision | `RawSchedule` — 다른 API 카탈로그의 `Raw` prefix 없는 관례와 불일치 | `codebase/frontend/src/lib/api/schedules.ts:14` | 충돌 아님. 통일 원하면 `ScheduleListItem` 등으로 교체 고려 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | Critical/Warning 없음. INFO 4건(spec 미문서화·미수록·known gap·표현 모호) |
| Rationale Continuity | NONE | 기각 대안 재도입·합의 원칙 위반 없음. behavior-preserving 내부 리팩토링 |
| Convention Compliance | LOW | Critical/Warning 없음. INFO 6건(문서 구조 소소 불일치·이미 등재된 예외) |
| Plan Coherence | NONE | Critical/Warning 없음. INFO 2건(frontmatter traceability 갭·동일 파일 수정 범위 안내) |
| Naming Collision | LOW | Critical 없음. Warning 4건(statistics.ts 인터페이스 이름 4건이 백엔드 대응 타입명과 불일치) |

## 권장 조치사항

1. (BLOCK 사유 없음) 이번 PR 은 차단 없이 진행 가능.
2. (W-1~W-4 후속 정렬) `codebase/frontend/src/lib/api/statistics.ts` 의 `StatsSummary → StatisticsSummary`, `ExecutionDataPoint → ExecutionsByPeriod`, `ErrorEntry → ErrorStat`, `LlmUsageSummaryResponse → LlmUsageSummary` rename — 동작 무관, 차기 PR 또는 동일 PR 내 정리 가능.
3. (I-10 traceability) plan 완료 이동 시 planner 가 `spec/2-navigation/{0-dashboard,3-schedule,7-statistics}.md` frontmatter `code:` 에 신규 wrapper 파일 경로 추가.
4. (I-11 plan 주석) `plan/in-progress/spec-sync-schedule-gaps.md` 에 "apiClient 이전(m-2) 완료" 메모 추가로 후속 작업자 혼동 방지.
5. (I-5/I-6 문서 구조) `14-execution-history.md` Overview 절 이관 및 `15-system-status.md` Overview 헤딩 추가는 planner 의 spec 정리 작업으로 이월.

---