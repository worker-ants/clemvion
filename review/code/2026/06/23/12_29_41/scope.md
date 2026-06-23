# 변경 범위(Scope) 리뷰

## 발견사항

### 파일 1–3: 페이지 파일 (dashboard/statistics/schedules page.tsx)

- **[INFO]** 범위 내 변경 — 명시된 작업(apiClient 직접 호출 → lib/api 카탈로그 이전) 에 정확히 부합. 임포트 교체, 인라인 타입/인터페이스 삭제, queryFn 위임으로만 구성. 기존 react-query 키·toast·navigation 무변 확인.
  - 위치: `codebase/frontend/src/app/(main)/dashboard/page.tsx`, `statistics/page.tsx`, `schedules/page.tsx`
  - 상세: 세 파일 모두 apiClient 직접 호출 제거 후 신규 카탈로그 함수로 위임. 인라인 타입 정의 삭제는 카탈로그로 이전됐으므로 중복 제거 목적으로 범위 내.

- **[INFO]** cross-domain `/workflows` 호출 잔류 — 범위 내 의도적 결정. statistics·schedules 에 각 1개씩 잔류하며 주석으로 명시(`// /workflows: cross-domain — workflows 트랙에서 이전 예정`). 범위 외 도메인이므로 적절히 후속 트랙으로 이월.
  - 위치: `statistics/page.tsx` line 224, `schedules/page.tsx` line 533

- **[INFO]** statistics.tsx 에 `apiClient` 임포트가 잔류 — `/workflows` cross-domain 호출에 사용되므로 정당한 잔류. 미사용 임포트 아님.
  - 위치: `statistics/page.tsx` 상단 `import { apiClient } from "@/lib/api/client"`

### 파일 4–6: 신규 유닛 테스트 (dashboard/schedules/statistics .test.ts)

- **[INFO]** 범위 내 추가 — 신규 카탈로그 모듈(`dashboard.ts`, `statistics.ts`, `schedules.ts`)의 wrapper 함수를 검증하는 테스트. 커밋 메시지에 "신규 wrapper 유닛 테스트" 로 명시. SDD+TDD 방법론 준수.

### 파일 7–9: 신규 카탈로그 모듈 (dashboard/schedules/statistics .ts)

- **[INFO]** 범위 내 핵심 산출물 — 작업의 중심. 기존 페이지 인라인 호출을 typed 카탈로그로 집중. 타입 정의는 페이지에서 이전된 것이고 구조 동일.

- **[INFO]** `statistics.ts` 에 `LlmUsageByModel` 인터페이스 신규 추가 — 기존 페이지에는 존재했으나 카탈로그로 이전 시 함께 포함됨. `LlmUsageSummaryResponse.byModel` 배열 요소 타입이므로 필수 추가. 범위 내.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/frontend/src/lib/api/statistics.ts`

- **[INFO]** `schedules.ts` 에 `ScheduleListParams`, `CreateScheduleBody`, `UpdateScheduleBody` 신규 인터페이스 추가 — 기존 페이지에는 인라인 객체 리터럴로만 존재했으나 카탈로그 함수 시그니처를 위해 타입화. 작업 의도(typed 카탈로그 구축)에 부합.

### 파일 10: plan/in-progress/refactor/02-architecture.md

- **[INFO]** 범위 내 plan 업데이트 — m-2 항목의 진행 상태(`[ ]` → `[x]`) 및 완료 내용 갱신. developer SKILL 규약상 plan 파일 업데이트는 구현 완료 후 의무. 내용도 완료 사실만 기록하며 다른 항목 수정 없음.

### 파일 11–13: review/consistency/... SUMMARY.md, _retry_state.json, convention_compliance.md

- **[INFO]** 범위 내 리뷰 산출물 — `/consistency-check --impl-prep` 실행 결과물. CLAUDE.md 규약상 "developer 는 구현 착수 직전 `consistency-check --impl-prep` 의무" 이므로 본 커밋에 포함되는 것이 적절. `review/consistency/**` 폴더 하위로 정확히 저장.

---

## 요약

본 변경은 의도된 범위(statistics/schedules/dashboard 페이지의 apiClient 직접 호출을 `lib/api/*` 카탈로그로 이전)에 충실하게 한정된다. 3개 페이지 파일·3개 신규 카탈로그·3개 신규 테스트·1개 plan 업데이트·consistency-check 산출물로 구성되며 각 파일의 변경이 모두 명시된 작업 목적에 직결된다. cross-domain `/workflows` 호출은 의도적으로 주석과 함께 잔류시켰고, 뷰모델 로직(mapSchedule 등)은 페이지에 잔류시켜 적정 경계를 유지했다. 범위 초과 리팩토링, 불필요한 기능 확장, 무관 파일 수정, 의미 없는 포맷팅 변경은 발견되지 않았다.

## 위험도

NONE
