# 테스트(Testing) 코드 리뷰

## 검토 범위

실질 테스트 대상은 3개 파일이다.

- `codebase/backend/migrations/V110__schedule_workspace_next_run_index.conf` (신규)
- `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql` (신규 DDL, `dd6549796` 에서 재실행 안전성 보강)
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` (신규 `it('schema: ...')` + `it('J. 목록 조회 ...')` 2건 추가)

나머지(`plan/**`, `review/code/2026/09/04/23_02_51/**`, `review/consistency/2026/09/04/{22_34_55,22_43_40}/**`, `spec/**`)는 이전 리뷰/consistency-check 라운드 산출물과 spec/plan 문서라 테스트 코드 자체는 없다. 다만 `review/code/2026/09/04/23_02_51/testing.md`(이전 라운드 testing 리뷰어의 WARNING #1: "`GET /api/schedules` 를 실행하는 e2e 가 없다")와 `RESOLUTION.md`(그 WARNING 을 `J.` 테스트 신설로 조치했다는 주장)가 이번 diff 의 배경이므로, 그 주장을 실제 테스트 실행 로그·소스 코드 대조로 검증하는 데 시간을 썼다.

### 실측 검증

- `git log --oneline -- codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql` → `dd6549796`, `e20fe5b0b` 두 커밋 모두 실존.
- `_test_logs/e2e-20260904-232140.log`: `Test Suites: 51 passed, 51 total` / `Tests: 295 passed, 295 total`, `PASS test/schedule-trigger.e2e-spec.ts` 확인 — RESOLUTION.md 의 "51 suites / 295 passed" 주장과 일치. (jest 기본 리포터라 개별 `it` 이름까지는 로그에 없음 — 파일 단위 PASS 까지만 직접 확인 가능.)
- `codebase/backend/src/common/interceptors/transform.interceptor.ts` 확인 — `PaginatedResponseDto` 가 이미 `data` 키를 갖고 있어 이중 래핑되지 않음. 신규 테스트의 `res.body.data` 를 배열로 취급하는 가정은 실제 응답 셰이프와 일치함(런타임에서 직접 실행하지 않고 코드 대조로 확인).
- `codebase/backend/src/modules/schedules/schedules.service.ts` `resolveOrderBy` 화이트리스트(`created_at`/`updated_at`/`next_run_at`/`last_run_at`/`name`) 확인 — 이번 PR 은 이 로직을 변경하지 않았으므로 기존 회귀 테스트(`schedules.service.spec.ts` mock 기반)는 여전히 유효.
- `git status --short` — 이 리뷰는 저장소를 뮤테이션하지 않았다(읽기만 수행).

## 발견사항

- **[INFO]** 신규 e2e `J.` 테스트가 `GET /api/schedules` 를 세 번 호출하지만, 이 마이그레이션이 함께 개선한 **기본 정렬(`ORDER BY created_at`, `sort` 파라미터 생략) 경로는 정렬 정확성이 단언되지 않는다**
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:371` (`GET /api/schedules?limit=50` — `sort` 미지정, 워크스페이스 격리 검증에만 쓰임), 대조 `codebase/backend/test/schedule-trigger.e2e-spec.ts:59-64` (테스트 JSDoc: "격리와 정렬이 같은 인덱스에 얹혔으므로, **둘 다 실제 응답으로 확인한다**")
  - 상세: `grep -rn "get('/api/schedules"` 로 저장소 전체를 확인한 결과 `/api/schedules` GET 호출은 이 파일의 3곳(`:336` `sort=next_run_at&order=asc`, `:355` `sort=next_run_at&order=desc`, `:371` `sort` 없음)뿐이다. `V110__schedule_workspace_next_run_index.sql:19`(`기본 정렬 ORDER BY created_at 도 선두 컬럼 덕에 6.89 → 1.08 ms`)가 명시하듯 이 인덱스는 `next_run_at` 정렬뿐 아니라 기본 정렬(`created_at`, 명시적 `sort` 를 안 준 모든 클라이언트 호출의 경로)도 함께 개선한다고 주장하는데, `:371` 호출은 그 기본 정렬 경로를 실행은 하면서도 반환된 `data` 의 정렬 순서는 전혀 단언하지 않는다(워크스페이스 격리만 확인). 파일 JSDoc(`:59-64`)이 "둘 다 실제 응답으로 확인한다"고 적은 것과 달리, 실제로 정렬이 검증되는 것은 `next_run_at` 명시 정렬뿐이고 기본 정렬은 절반만(호출은 되지만 검증은 안 됨) 닫혀 있다.
  - 제안: `:371` 응답에도 `ascTimes`/`descTimes` 와 같은 방식으로 `createdAt` 기준 내림차순(기본값) 단언을 추가하거나, 별도로 `sort` 생략 호출에 대해 정렬 단언 1줄을 추가한다. 비용이 낮고(이미 호출은 하고 있음) 이 PR 의 실측 근거 중 하나(기본 정렬 6.4배 개선)를 실제로 방어하게 된다.

- **[INFO]** mock 기반 unit 테스트(`schedules.service.spec.ts`)의 `sort/order` 파라미터화 케이스가 이 PR 이 최적화한 정확한 축(`next_run_at`)을 포함하지 않는다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:109-155` (`describe('findAll sort/order', ...)`) — 케이스: `기본값(created_at DESC)`, `sort=updated_at&order=asc`, `sort=name`, `미허용 sort→폴백`. `next_run_at`/`last_run_at` 케이스는 없음
  - 상세: `resolveOrderBy` 화이트리스트는 5개 값(`created_at`/`updated_at`/`next_run_at`/`last_run_at`/`name`)을 매핑하는데, unit 레벨 파라미터화 테스트는 그중 `next_run_at` — 즉 이번 V110 인덱스가 겨냥한 바로 그 컬럼 — 를 커버하지 않는다. 이번 PR 로 이 갭이 새로 생긴 것은 아니고(코드 로직 자체는 변경 없음), 신규 e2e `J.` 테스트가 실제 DB 왕복으로 `next_run_at` 정렬을 검증하므로 기능적으로는 닫혀 있다. 다만 unit 테스트는 e2e 보다 훨씬 빠르게(DB·컨테이너 없이) 회귀를 잡을 수 있는데, 정확히 이 PR 의 대상 컬럼만 그 빠른 방어선에서 빠져 있다는 점은 우연치고는 눈에 띈다.
  - 제안: 우선순위 낮음. `it('sort=next_run_at&order=desc 를 반영', ...)` 한 줄을 같은 `describe` 에 추가하면 향후 `resolveOrderBy` 리팩터링 시 e2e 까지 기다리지 않고 즉시 회귀를 잡을 수 있다.

- **[INFO]** 신규 `J.` 테스트가 파일 내 테스트 레이블 순서를 깬다 — `I.` 앞에 물리적으로 삽입됐지만 이름은 `J.`
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:320` (`it('J. 목록 조회 ...')`), 바로 다음 `:380` (`it('I. trigger DELETE ...')`)
  - 상세: 파일의 테스트는 `A → B → C → D → E → F → G → H` 까지 물리적 순서와 알파벳 레이블이 정확히 일치하다가, 이번 diff 가 `H` 다음·`I` **앞**에 `J` 를 삽입했다. 결과적으로 파일을 위에서 아래로 읽으면 `..., H, J, I` 순으로 나타나 레이블이 물리적 위치를 더 이상 반영하지 않는다. 기능에는 영향 없고 CI 실행 순서에도 영향 없지만(레이블은 설명용 텍스트일 뿐), 다음 사람이 "레이블 알파벳 = 파일 내 순서"라는 이 파일의 기존 관례를 신뢰하고 `I.` 를 찾다가 `J.` 를 먼저 만나는 사소한 탐색 혼선을 유발할 수 있다.
  - 제안: 별도 조치 불요(low priority). 다음에 이 파일을 편집할 기회가 있으면 `J` 를 `I` 뒤로 옮기거나 `I`→`J`, `J`(신규)→`K` 로 재레이블링해 순서를 복구하는 정도로 충분.

## 회귀 테스트 확인 (발견사항 아님, 확인용 기재)

- 이전 라운드(`review/code/2026/09/04/23_02_51/testing.md`) WARNING #1 "`GET /api/schedules` 를 실행하는 e2e 가 없다"는 이번 `J.` 테스트로 실질적으로 닫혔다 — 워크스페이스 격리 + `next_run_at` 오름/내림차순 양방향 + "정렬 관측이 공허해지지 않도록 값이 다른 행 ≥2 를 먼저 단언" 하는 설계까지 갖춰 vacuous test 위험을 스스로 방어하고 있다. 위 INFO 항목들은 그 위에 남은 잔여 갭이지 이 조치 자체의 결함이 아니다.
- 이전 라운드 INFO "`relkind` 미필터"(`pg_class WHERE relname = 'idx_schedule_next_run'`)는 `AND relkind = 'i'` 추가로 해소됨을 직접 확인(`:81`). `created` 쪽 쿼리(`:67-72`)는 `pg_index` 를 조인하므로 애초에 `relkind` 필터가 불필요(인덱스 카탈로그만 대상) — 비대칭 처리가 아니라 정확한 처리.
- `schedules.service.ts` 의 쿼리 빌더 로직(`resolveOrderBy`, `findAll`)은 이번 diff 에서 변경되지 않았으므로, 기존 mock 기반 unit 테스트(`schedules.service.spec.ts`)는 그대로 유효하다 — 회귀 없음.
- 신규 schema 테스트(`:66-84`)는 새 인덱스 존재+컬럼순서+non-partial 뿐 아니라 옛 인덱스 부재까지 양방향으로 확인해, "교체의 절반만 닫히는" vacuous 패턴을 피한다. `RESOLUTION.md` 가 주장하는 "사전 상태(옛 인덱스 1행·새 인덱스 0행)에서 두 단언이 모두 RED" 사전 검증은 이 세션에서 재실행하지 않았고 커밋 메시지 근거만 대조했다(직접 재현은 하지 않음 — 명시).

## 요약

핵심 변경(V110 마이그레이션 쌍 + e2e 스키마 테스트 + 목록 API 테스트)은 이전 라운드가 지적한 유일한 WARNING(최적화 대상 쿼리를 실행하는 e2e 부재)을 실제로 닫았다. 신규 `J.` 테스트는 워크스페이스 격리·양방향 정렬(asc/desc)·정렬 관측이 공허해지지 않도록 값 다양성을 먼저 확보하는 설계를 갖춰 이 저장소 평균보다 신중하다. `_test_logs/e2e-20260904-232140.log` 로 51/51 suite, 295/295 test PASS 및 `schedule-trigger.e2e-spec.ts` PASS 를 직접 확인했다. 남은 갭은 모두 INFO 수준이다: (1) 이 인덱스가 함께 개선한다고 주장하는 **기본 정렬(`created_at`, `sort` 파라미터 생략)** 경로는 호출만 되고 정렬 정확성은 단언되지 않아 파일 JSDoc 의 "둘 다 확인한다"는 서술과 실제 커버리지 사이에 작은 괴리가 있다, (2) mock 기반 unit 테스트의 `sort/order` 파라미터화 케이스가 하필 이 PR 의 대상 컬럼(`next_run_at`)만 비어 있어 빠른 회귀 방어선이 그 축에서 e2e 에만 의존한다, (3) 신규 테스트 레이블(`J`)이 파일 내 삽입 위치(`I` 앞)와 알파벳 순서가 어긋난다. 셋 다 이번 PR 을 막을 사유는 아니다. Mock 사용은 unit 레벨(쿼리 빌더 체이닝 mock)과 e2e 레벨(실 DB) 이 목적에 맞게 분리돼 있고, 신규 테스트는 기존 테스트와 독립적으로 실행 가능하며 다른 테스트의 상태를 변경하지 않는다.

## 위험도

LOW
