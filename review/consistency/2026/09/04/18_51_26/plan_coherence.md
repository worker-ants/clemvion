# Plan 정합성 검토 — spec/2-navigation/ (impl-done)

## 검토 범위 요약

- `spec/2-navigation/` 자체의 이번 브랜치 델타는 0개 파일(정상 — 이 브랜치는 코드 전용 PR).
- 실제 구현 diff 는 3개 파일 121줄: `codebase/backend/src/modules/executions/dto/query-execution.dto.ts`(죽은 `workflowId` 쿼리 파라미터 제거), `codebase/backend/src/common/pipes/validation.pipe.spec.ts`(`forbidNonWhitelisted` 회귀 테스트 신설), `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`(`@Transform` 예외 주석 재실측).
- `plan/in-progress/**` 전체(61개 절단 포함 전 파일, 저장소 파일 직접 grep)를 `QueryExecutionDto|workflowId.*executions|executions/workflow|swagger-dto-contract|idx_schedule_next_run|next_run_at` 로 검색한 결과, 이 diff 와 겹치는 plan 은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 단 하나였다.

## 대조 결과

`plan/in-progress/spec-draft-nullable-notation-followups.md` 의 `## 후속` 섹션에 다음 항목이 이미 **`[x]` 완료**로 기록돼 있고, 그 근거 서술(실측 수치·결정 경위)이 diff 의 코드 주석과 정확히 일치한다:

- "`QueryExecutionDto.workflowId` 죽은 필드 — 제거 완료 (2026-09-04)": "사용자가 옵션 A(제거)를 선택했다", "엔드포인트 경로(`workflow/:workflowId`)가 이미 하나의 워크플로우로 한정하므로 쿼리 레벨 워크플로우 필터는 개념적으로 존재할 수 없다" — diff 의 `query-execution.dto.ts` 신규 주석과 동일한 근거·동일한 날짜.
- 부수 효과로 기록된 "`swagger-dto-contract` 가드의 `@Transform` 예외가 실사례 0건이 됨 (1,095 필드 중 `@Transform` 17개, null 축 불일치 0)" — diff 의 `swagger-dto-contract-guard.ts` 주석 "2026-09-04 재실측: `Api*` 필드 1,095개 중 `@Transform` 동반 17개, 그중 null 축이 갈리는 것 0개" 와 숫자까지 정확히 일치.
- `spec/2-navigation/14-execution-history.md:345` 직접 확인 — `GET /api/executions/workflow/:workflowId` 항목은 "페이지네이션, 상태 필터, 정렬 지원"만 약속하고 `workflowId` 쿼리 필터는 언급하지 않는다. diff 주석의 spec 인용("spec 도 페이지네이션, 상태 필터, 정렬만 약속")이 실측과 일치 — spec 이 약속한 계약을 diff 가 축소한 것이 아니다.

즉 이 diff 는 plan 이 "결정 필요" 로 남겨둔 항목을 우회한 것이 아니라, **plan 이 이미 사용자 결정(옵션 A)까지 거쳐 완료로 기록해 둔 항목을 그대로 구현한 것**이다.

### 같은 plan 의 잔여 미해결 항목과의 관계

`spec-draft-nullable-notation-followups.md` 하단 표에는 여전히 열린 항목 2개가 있다:

1. §5.4 drift 배치 2단계 — 검증자 없는 응답 DTO 78곳 (developer, 검증자 도입 선행)
2. `idx_schedule_next_run` 부분 조건 불일치 — DROP 인가 재생성인가 (developer/DBA, `EXPLAIN` 선행)

이 diff 는 둘 중 어느 것도 건드리지 않는다 (`QueryExecutionDto` 는 요청 DTO 이고 78곳은 응답 DTO 집합, 인덱스 항목은 스케줄 도메인). 두 항목의 선행 조건 미해소 상태도 이 diff 로 인해 바뀌지 않는다 — plan 은 여전히 정확히 in-progress 상태를 반영하고 있어 갱신 불필요.

### spec/2-navigation 본문(3-schedule.md, 1-workflow-list.md, 2-trigger-list.md) 과의 교차

이번 diff 는 스케줄/워크플로우/트리거 화면 관련 코드를 건드리지 않는다. `1-workflow-list.md` frontmatter 의 `pending_plans`(`marketplace-and-plugin-sdk.md`, `plan/complete/workflow-duplicate-nodes-edges.md`)도 이 diff 의 대상 파일과 무관하다.

## 발견사항

없음 (CRITICAL/WARNING/INFO 모두 해당 없음).

## 요약

이번 diff(백엔드 `QueryExecutionDto.workflowId` 죽은 필드 제거 + 회귀 테스트 신설 + swagger-dto-contract 가드 주석 재실측)는 `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 사용자 결정까지 거쳐 이미 "완료"로 기록해 둔 항목을 그대로 구현한 것으로, plan 이 열어둔 미해결 결정을 우회하거나 다른 plan 의 후속 항목·선행 조건과 충돌하지 않는다. `spec/2-navigation/14-execution-history.md` 의 API 계약(§4, `:345`)도 diff 의 근거 서술과 정확히 일치해 spec-plan-code 삼자가 정합하다. 같은 plan 의 잔여 미해결 항목(§5.4 drift 2단계, `idx_schedule_next_run`) 은 이 diff 의 영향 범위 밖이며 상태 변경이 필요하지 않다.

## 위험도

NONE
