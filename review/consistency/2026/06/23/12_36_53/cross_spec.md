# Cross-Spec 일관성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/2-navigation, diff-base=origin/main)
검토 일시: 2026-06-23

---

## 발견사항

### [INFO] `statisticsApi` 의 `LlmUsageSummaryResponse` — spec 미정의 응답 shape 를 백엔드 구현에서 직접 도출

- **target 위치**: `codebase/frontend/src/lib/api/statistics.ts` — `LlmUsageSummaryResponse` / `LlmUsageByModel` 인터페이스
- **충돌 대상**: `spec/2-navigation/7-statistics.md §3` — `GET /api/statistics/llm-usage/summary` 를 "LLM 토큰 사용량 요약(프로바이더×모델별 합계 + 추정 비용)" 으로만 기술하며, 응답 필드 목록을 정의하지 않음
- **상세**: `statistics.ts` 의 인터페이스(`totalPromptTokens`, `totalCompletionTokens`, `totalTokens`, `totalCostUsd`, `topProvider`, `byModel[]`)는 스펙이 아닌 백엔드 `statistics.service.d.ts` 의 `LlmUsageSummary`·`LlmUsageByModel` 인터페이스를 직접 반영한다. 두 셰이프가 일치하므로 런타임 충돌은 없다. 그러나 spec/2-navigation 이 응답 shape 를 문서화하지 않아, statistics spec 과 프론트 타입 간 drift 가 생길 경우 탐지가 늦다.
- **제안**: 실질 충돌 없음. statistics spec §3 의 `/api/statistics/llm-usage/summary` 행에 응답 필드 요약 한 줄을 추가하는 것은 planner 선택 사항.

---

### [INFO] `statisticsApi` 에 `/api/statistics/llm-usage/timeseries` 미수록 — spec §3 에 정의된 엔드포인트

- **target 위치**: `codebase/frontend/src/lib/api/statistics.ts` — `timeseries` 메서드 없음
- **충돌 대상**: `spec/2-navigation/7-statistics.md §3` — `GET /api/statistics/llm-usage/timeseries` 엔드포인트가 명시됨
- **상세**: statistics 페이지(`statistics/page.tsx`)가 현재 `timeseries` 엔드포인트를 호출하지 않으며, 카탈로그 API 는 페이지가 실제로 사용하는 엔드포인트만 수록하는 원칙으로 작성됐다 — 이 불일치는 기존 ai-review W-1 에서 이미 인지·defer 됐다. spec 에 "카탈로그 미수록(timeseries 위젯 미구현)" 표기 또는 timeseries 위젯 구현 시 메서드 추가는 planner/개발자 후속 작업.
- **제안**: 구현 회귀 없음. planner 에게 spec 미수록 표기 여부 결정 위임(W-1 per 기존 리뷰).

---

### [INFO] `ScheduleListParams` 가 spec §4 의 `search`/`sort`/`order` 파라미터를 미포함 — known gap 유지

- **target 위치**: `codebase/frontend/src/lib/api/schedules.ts` — `ScheduleListParams = { page, limit }` 만 정의
- **충돌 대상**: `spec/2-navigation/3-schedule.md §4` — `GET /api/schedules` 쿼리 파라미터: `page`, `limit`, `search`, `sort`, `order`
- **상세**: schedules 페이지가 현재 search/sort/order UI 를 제공하지 않아, 카탈로그도 페이지 실사용 파라미터만 수록한다. spec 은 서버가 `sort`/`order` 를 whitelist 기반으로 지원함을 명시하며 이는 백엔드와 일치한다. cross-spec 모순이 아니라 "프론트 미구현 기능을 카탈로그가 미수록" 하는 상태다. 동일 패턴이 `spec/2-navigation/2-trigger-list.md §3` 주석("sort/order 미구현/Planned")에도 선례로 있다.
- **제안**: 실질 충돌 없음.

---

### [INFO] `DashboardSummary.successRate` 단위 — spec §7 과 프론트 타입이 "정수 반올림" vs "float" 로 불일치 가능

- **target 위치**: `codebase/frontend/src/lib/api/dashboard.ts` — `successRate: number` (float 허용)
- **충돌 대상**: `spec/2-navigation/0-dashboard.md §3` — "카드에는 정수로 반올림하여 표시"; §7 `DashboardSummaryDto` 예시 `"successRate": 94.2` (소수 포함)
- **상세**: spec §7 의 응답 예시는 소수(`94.2`)를 보내지만 §3 카드 표시는 "정수 반올림" 이라고 적는다. 즉 API 는 float 를 응답하고 UI 가 반올림 표시한다는 의미. 프론트 타입 `successRate: number` 는 이 약속에 부합하며 cross-spec 모순이 없다. 다만 §3 카드 설명이 "API 응답이 정수" 인지 "UI 표시가 정수" 인지 문언이 약간 모호하다.
- **제안**: 실질 충돌 없음. spec 문언에 "(API 는 float, 표시 시 정수로 반올림)" 부연은 planner 선택 사항.

---

## 요약

본 검토는 `--impl-done` 모드로 `spec/2-navigation` 영역과 관련 spec(`spec/1-data-model.md`, `spec/5-system/2-api-convention.md`, `spec/2-navigation/7-statistics.md`, `spec/2-navigation/3-schedule.md`, `spec/2-navigation/0-dashboard.md`)의 cross-spec 일관성을 재점검했다. 이번 브랜치(`claude/refactor-m2-page-api`)는 `spec/2-navigation` 을 수정하지 않으며, 구현(`codebase/frontend/src/lib/api/{dashboard,statistics,schedules}.ts` 신설·페이지 이전)이 spec 계약에 정합하는지를 중심으로 확인했다. CRITICAL 및 WARNING 수준 모순은 없다. 발견된 항목 4건은 모두 INFO 등급이며, timeseries 미수록·search/sort 파라미터 미포함은 페이지 미구현 기능의 의도적 미수록으로 ai-review 에서 이미 defer 처분된 사항이고, 응답 shape 미문서화는 spec 보강 여부를 planner 가 결정할 수 있는 사항이다. `--impl-prep` 시점의 INFO 4건도 모두 유지되며 신규 CRITICAL/WARNING 은 추가되지 않았다.

---

## 위험도

NONE

STATUS: OK
