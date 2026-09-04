# 요구사항(Requirement) 코드 리뷰

## 검토 범위 및 방법

핵심 코드 변경은 `codebase/backend/migrations/V110__schedule_workspace_next_run_index.{sql,conf}`
(신규 마이그레이션 쌍)과 `codebase/backend/test/schedule-trigger.e2e-spec.ts` (스키마 e2e +
목록 조회 e2e `J.` 추가) 두 쌍이며, 나머지는 `spec/1-data-model.md`·`spec/data-flow/10-triggers.md`
(spec 반영)와 `plan/in-progress/*.md`(작업 추적), `review/code/2026/09/04/23_02_51/**`·
`review/consistency/2026/09/04/{22_34_55,22_43_40}/**`(직전 라운드 리뷰/일관성 산출물)이다.
이 changeset 은 **직전 리뷰 라운드(`23_02_51`)의 WARNING 4건(CONCURRENTLY 재실행 안전성·
plan stale·spec Rationale 누락·대상 쿼리 e2e 부재)에 대한 조치**이므로, 각 WARNING 이
실제로 해소됐는지를 현재 커밋된 코드/문서를 직접 열어 대조 검증했다:

- `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql` — DROP(새 이름)→CREATE→DROP(옛 이름)
  순서, `V002__indexes.sql:30` 의 `idx_schedule_next_run (next_run_at, is_active) WHERE is_active = TRUE`
  와 DOWN 절 정의가 정확히 일치함을 확인.
- `codebase/backend/src/modules/schedules/schedules.service.ts` (`findAll`, `resolveOrderBy`) —
  `WHERE s.workspace_id = :workspaceId` 만 걸고 `is_active` 를 걸지 않는다는 마이그레이션 주석의
  주장, `sort=next_run_at` 화이트리스트 존재를 코드로 직접 대조.
  `dto/responses/schedule-response.dto.ts` 의 `nextRunAt` 필드명이 e2e 단언과 일치.
  `common/dto/pagination.dto.ts` 의 `limit` 상한 100 → e2e 의 `limit=50` 유효.
- `spec/1-data-model.md:914`(§3 표 행) + `## Rationale`(947행 이하, 4후보 실측 비교표) —
  마이그레이션 헤더 주석의 수치(5.99/12.77/0.30 ms, 20배, 6.4~6.89→1.08)와 line-level 일치.
- `spec/data-flow/10-triggers.md:175` 미러 — 인덱스명·컬럼 순서 일치.
- `plan/in-progress/spec-draft-nullable-notation-followups.md:379,450` — 체크박스 `[x]`,
  종결조건 표 셀 묘비 처리 확인.
- `codebase/backend/migrations/README.md §5`("CREATE INDEX CONCURRENTLY 정확히 한 개")와
  선례 `V056__notification_active_partial_index.sql` 대조 — V110 은 CREATE 1개 + DROP 2개로
  §5 컨벤션(CREATE 개수 기준) 위반 아님, V056 도 CREATE 1개 + DROP 1개 선례.

## 발견사항

- **[WARNING]** `plan/in-progress/spec-draft-schedule-index.md` 가 `status: complete` 이고
  본문(§6)이 모든 산출물을 "완료"로 서술하며 파일 내 미해결 `[ ]` 항목이 0건인데도,
  여전히 `plan/in-progress/` 에 있다 — 저장소 자신의 라이프사이클 규약을 어긴다.
  - 위치: `plan/in-progress/spec-draft-schedule-index.md:6` (frontmatter `status: complete`), 파일
    경로 자체(`plan/in-progress/` 하위, `plan/complete/` 아님)
  - 상세: `.claude/docs/plan-lifecycle.md §3` 은 "모든 항목이 완료된 순간 `complete/` 로 이동",
    "이동은 마지막 작업 PR 안에서 — 모든 체크박스 `[x]` + 미해결 follow-up 0건이 되는 PR 안에
    `chore(plan): mark <name> complete` 형태의 별 commit 으로" 라고 명시한다. 이 문서는
    `## 6. 구현` 표 4행이 전부 "완료"이고, 유일한 후속 항목(`CREATE INDEX CONCURRENTLY IF NOT
    EXISTS` 재실행 위험의 규약 차원 처리)은 **이 파일이 아니라** 별도 파일
    `spec-draft-nullable-notation-followups.md` 에 등재돼 있어(§6 마지막 문단이 스스로 그렇게
    말한다) 이 파일 자체에는 미해결 항목이 없다. 즉 lifecycle 정의상 "이동 시점"의 두 조건
    (모든 항목 완료 + 미해결 follow-up 0건)을 이미 만족한다.
    이 문제는 **이미 두 번 지적됐고 둘 다 "범위 밖"으로 미뤄졌다** — 직전 코드리뷰
    (`review/code/2026/09/04/23_02_51/documentation.md` WARNING #1)이 "`plan/complete/` 이동
    대상 여부 판단"을 권고했고, `RESOLUTION.md` #2 는 그 권고 중 `status` 필드 갱신만
    수행하고 실제 `git mv` 는 하지 않았다. 이어 `review/consistency/2026/09/04/22_43_40/SUMMARY.md`
    INFO #5 도 "완료 여부는 plan 라이프사이클 관점에서 별도 확인 권장(본 리뷰 범위 밖)"이라고
    다시 미뤘다. 두 살아있는 문서가 이미 이 파일을 참조하고 있어(`spec/1-data-model.md:978`
    `plan/in-progress/spec-draft-schedule-index.md`, `plan/in-progress/
    spec-draft-nullable-notation-followups.md:379` `[spec-draft-schedule-index.md](./spec-draft-schedule-index.md)`)
    이동 시 두 링크의 상대/절대 경로 갱신이 함께 필요하다(lifecycle §3 "이동하는 문서 자신의
    outgoing 링크" 규칙과는 별개로, 이번엔 *인입* 참조 갱신 대상).
    자동 가드(`plan-frontmatter.test.ts`)는 `plan/complete/**` 방향만 검사하고
    (`findNonTerminalCompletedPlans`) 그 역방향(`in-progress/` 에 있으면서 `status` 가 종료값)은
    검사하지 않으므로 CI 로는 잡히지 않는다 — 사람 리뷰가 놓치면 영구적으로 stale 상태로 남는다.
  - 제안: 이 PR(또는 마무리 커밋)에서 `git mv plan/in-progress/spec-draft-schedule-index.md
    plan/complete/spec-draft-schedule-index.md` 수행 + `spec/1-data-model.md:978`,
    `spec-draft-nullable-notation-followups.md:379` 두 인입 참조 경로 갱신. 반복적으로 "범위 밖"
    으로 미뤄지는 패턴이므로 이번 라운드에서 확정 짓는 것을 권고.

- **[INFO]** 나머지 요구사항 관점(기능 완전성·엣지 케이스·에러 시나리오·spec fidelity)은
  결함 없음 — 확인 근거만 기재
  - `V110__*.sql` 의 재실행 안전성 주석(0) DROP → 1) CREATE → 2) DROP)과 실제 SQL 문 순서가
    정확히 일치(코멘트 46~51행 vs 실행문 53~58행), "1) 실패해도 옛 인덱스는 2) 전이라 남는다"는
    불변식 주장도 각 실패 지점(step0/1/2)을 따라가 보면 성립함을 확인.
  - 신규 e2e 스키마 테스트가 새 인덱스 존재·컬럼 순서·비-partial 여부(`indisvalid=true`,
    `(workspace_id, next_run_at)`, `WHERE` 없음)와 **옛 인덱스 부재**를 양방향으로 고정,
    `relkind = 'i'` 필터도 반영됨(직전 라운드 INFO #8 조치 확인).
  - 신규 e2e `J.` 테스트가 이 마이그레이션이 최적화 대상으로 삼은 실제 쿼리
    (`GET /api/schedules?sort=next_run_at`)를 워크스페이스 격리(다른 워크스페이스 헤더로 재조회
    시 자기 스케줄 미노출) + asc/desc 양방향 정렬(정렬 관측이 공허해지지 않도록 서로 다른
    `nextRunAt` 값 ≥2 를 먼저 단언)로 검증 — 인덱스 "존재"와 "그 인덱스로 서빙되는 API 가
    옳다"는 별개 명제라는 직전 라운드 W4 의 문제의식이 실제로 충족됨.
  - TODO/FIXME/HACK/XXX 주석 없음.
  - `spec/1-data-model.md` §3 표 행·`## Rationale` 신규 섹션, `spec/data-flow/10-triggers.md`
    §2.1 미러 모두 마이그레이션 SQL 헤더 주석의 실측 수치·기각 사유와 line-level 로 일치.

## 요약

핵심 변경(V110 마이그레이션 쌍 + e2e 2건)은 기능적으로 완전하고, 관련 spec 본문
(`spec/1-data-model.md` §3+Rationale, `spec/data-flow/10-triggers.md` §2.1)과 line-level 로
일치하며, 직전 코드리뷰 라운드가 지적한 4건의 WARNING(CONCURRENTLY 재실행 안전성 미비·plan
stale·spec Rationale 누락·대상 쿼리 e2e 부재)이 실제로 코드/문서에 반영돼 있음을 직접 대조로
확인했다. 유일하게 남은 문제는 코드가 아니라 **plan 라이프사이클 절차의 미완결**이다 —
`spec-draft-schedule-index.md` 는 `status: complete` 이고 모든 산출물이 완료로 서술돼 있는데도
`plan/in-progress/` 에 그대로 남아 있고, 이 문제는 두 차례(코드리뷰·consistency-check) 지적됐지만
매번 "범위 밖"으로 판단이 미뤄져 실제로 해소되지 않았다. 자동 가드가 이 방향(in-progress 인데
종료 status)을 검사하지 않아 사람이 놓치면 영구적으로 남는다.

## 위험도

LOW
