# 테스트(Testing) 코드 리뷰

## 검토 범위·방법

이 changeset(51개 파일)의 실질 테스트 대상은 3개다.

- `codebase/backend/migrations/V110__schedule_workspace_next_run_index.{conf,sql}` (신규 DDL — 자체 단위 테스트 대상 아님, e2e schema 테스트로 검증)
- `codebase/backend/src/modules/schedules/schedules.service.spec.ts` (신규 unit 케이스 1개: `sort=next_run_at&order=desc`)
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` (신규 `it` 2개: `schema: ...` + `J. 목록 조회 — 워크스페이스 격리 + next_run_at 정렬`)

나머지(`plan/**`, `spec/**`, `review/**`)는 문서·plan·이전 리뷰/consistency-check 세션 산출물이며 테스트 코드·테스트 대상 코드를 포함하지 않는다.

이 changeset 은 이미 같은 코드에 대해 두 차례 코드 리뷰 라운드(`review/code/2026/09/04/23_02_51`, `review/code/2026/09/04/23_26_09`)를 거쳤고, testing 관점 WARNING 은 그때마다 발견·조치됐다 — (1) `GET /api/schedules`(V110 최적화 대상 쿼리) 자체를 부르는 e2e 부재 → `J.` 테스트 신설로 해소, (2) 파라미터화 목록 unit 테스트에서 `next_run_at` 축 누락 → 케이스 추가로 해소, (3) `J.` 테스트의 파일 내 삽입 위치가 알파벳 레이블 관례(물리 순서=레이블)를 깨던 것 → `I.` 뒤로 이동해 해소. 세 항목 모두 현재 파일에서 직접 `Read` 로 재확인했다 — 실제로 반영돼 있다(`schedule-trigger.e2e-spec.ts`: `schema:` → `A`~`I` → `J`; `schedules.service.spec.ts`: `sort=next_run_at&order=desc` 케이스 존재). 이 라운드에서는 그 위에 **새로 놓친 지점**을 찾는 데 집중했다.

`git status --short` 로 세션 시작·종료 시점 모두 저장소에 아무 쓰기도 하지 않았음을 확인했다(`review/code/2026/09/04/23_47_43/` 신규 산출물 제외). 뮤테이션은 수행하지 않았다 — production 코드(`schedules.service.ts`, DTO)와 테스트를 나란히 읽는 정적 대조만으로 판단했다.

## 발견사항

- **[WARNING]** 신규 `J.` 테스트의 "워크스페이스 격리" 단언이 정상 경로에서는 루프 바디가 한 번도 실행되지 않는 약한 형태다 — 저장소의 기존 격리-테스트 관례(`toBe(0)` 직접 단언)에서 벗어난다
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:403-416` (`it('J. 목록 조회 — 워크스페이스 격리 + next_run_at 정렬 (V110 대상 쿼리)'` 블록의 마지막 절, `const isolated = ...` ~ `for (const row of isolated.body.data ...) { expect(mine.has(row.id)).toBe(false); }`)
  - 상세: `otherWs` 는 이 테스트 안에서 `createTeamWorkspace` 로 갓 생성한, 스케줄을 **하나도 만들지 않은** 워크스페이스다. 워크스페이스 스코핑이 정상 동작하는 정상 경로에서는 `isolated.body.data` 가 항상 빈 배열이므로, 그 위의 `for (const row of isolated.body.data)` 루프 바디는 **한 번도 실행되지 않는다** — 즉 `expect(mine.has(row.id)).toBe(false)` 라는 핵심 단언은 정상 경로에서 실질적으로 관측되지 않은 채로 테스트가 초록으로 끝난다(Jest 는 `expect.hasAssertions()`를 강제하지 않으므로 "실행된 assertion 0개"도 PASS). 이 패턴은 이 저장소가 스스로 기록해 둔 "vacuous 테스트" 4형태 중 하나(빈 컬렉션을 도는 루프 안의 단언이 관측되지 않는 것)와 정확히 같은 모양이다. 저장소의 다른 격리 테스트들(`knowledge-base.e2e-spec.ts:122` `expect(row.rows.length).toBe(0)`, `agent-memory-admin.e2e-spec.ts:218,320` 동일 패턴)은 전부 이 상황에서 **직접·강한** 단언(`length).toBe(0)`)을 쓴다 — `schedule-trigger.e2e-spec.ts` 전체에서 `.body.data`(또는 `.rows`)를 루프로 도는 다른 3곳(`background-monitoring.e2e-spec.ts:120,338`, `workflow-crud.e2e-spec.ts:315`)은 모두 **비어 있지 않은 것으로 기대되는** 컬렉션을 도는 용도라 이 경우와 다르다. `schedule-trigger.e2e-spec.ts` 안에서 `.body.data` 를 루프로 도는 곳은 이 `J.` 테스트 하나뿐이며, 하필 "격리(빈 결과 기대)" 검증에 이 형태를 쓴 것이 유일한 사례다.

    완전히 무효(vacuous)한 것은 아니다 — 워크스페이스 필터가 **통째로 제거**되는 회귀(예: `WHERE s.workspace_id = :workspaceId` 절이 아예 빠지는 경우)라면 `isolated.body.data` 에 `mine` 의 스케줄이 섞여 나오므로 루프가 실행되고 실패로 잡힌다. 다만 (a) 필터가 걸리되 **다른** 워크스페이스로 잘못 스코프되는 버그(예: 변수 스왑으로 엉뚱한 workspace_id 를 참조), (b) 병렬로 실행 중인 다른 e2e 스펙 파일이 만든 스케줄이 우연히 필터 버그로 새는 경우처럼 "새는 대상이 `mine` 집합 밖" 인 회귀는 이 형태로는 못 잡는다. 또한 테스트 제목·주석("다른 워크스페이스에서는 이 스케줄들이 보이지 않는다")이 약속하는 것은 "빈 결과" 인데 실제 단언은 그보다 좁다 — 다음에 이 테스트를 읽는 사람이 "이미 강하게 검증돼 있다"고 오판할 여지가 있다.
  - 제안: `expect(isolated.body.data.length).toBe(0);` 를 (루프 대신 또는 루프에 더해) 추가한다. 저장소 관례와 일치시키면서, 위에서 언급한 "새는 대상이 `mine` 밖" 회귀 클래스까지 함께 잡는다.

## 확인 결과 (문제 없음 — 대조 재확인)

- `schedules.service.spec.ts` 신규 케이스(`sort=next_run_at&order=desc`)는 기존 `makeQb()` 헬퍼·mock 패턴을 그대로 재사용해 파일 내 스타일과 일관되고, `beforeEach` 로 매 테스트 fresh mock 을 받아 테스트 간 격리도 유지된다. 인접한 "미허용 sort 값은 s.created_at 로 폴백" 테스트가 injection 축을 이미 덮고 있어 이 신규 케이스와 축이 겹치지 않는다.
- `sort`/`order` 쿼리 파라미터가 `PaginationQueryDto`(`@Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)`, `@IsIn(['asc','desc'])`)를 거쳐 `SchedulesService.resolveOrderBy` 화이트리스트로 들어가는 경로를 직접 `Read` 로 확인했다 — `next_run_at` 이 정규식·화이트리스트 양쪽을 통과하는 값임을 확인했고, unit 테스트가 검증하는 문자열(`'next_run_at'`)이 실제 프로덕션 코드가 받는 값과 정확히 일치한다(테스트가 존재하지 않는 파라미터 이름을 검증하는 오탐 위험 없음).
- `J.` 테스트의 정렬 단언(`ascTimes`/`descTimes`)은 서로 다른 두 cron(`'0 3 * * *'`, `'0 21 * * *'`)으로 명확히 구분되는 `next_run_at` 값을 먼저 만든 뒤 오름차순·내림차순 양쪽에서 정렬을 확인한다 — "분기를 못 가르는 fixture" 문제(둘 다 같은 시각이라 정렬 여부를 관측 못 하는 경우)가 아니다. `new Set(ascTimes).size).toBeGreaterThanOrEqual(2)` 로 값이 실제로 갈렸는지도 먼저 단언해 정렬 관측이 공허해지는 것을 막는다.
- e2e 스펙의 알파벳 레이블(`schema:`, `A`~`J`)이 파일 내 물리적 등장 순서와 정확히 일치함을 `grep -n "it('"` 로 재확인했다(직전 라운드 WARNING #2 조치가 실제로 반영됨).
- 신규 `schema:` 테스트는 신규 인덱스 `indisvalid=true`·컬럼 순서·비-partial 여부와 구 인덱스 부재(`AND relkind = 'i'` 필터 포함)를 양방향으로 확인한다 — 직전 라운드 INFO(`relkind` 미필터)도 반영됐다.
- 마이그레이션 파일(`.conf`/`.sql`) 자체에는 별도 단위 테스트가 없으나, Flyway 가 e2e 부팅 시 전체 마이그레이션을 실제로 적용하고 `schema:` 테스트가 그 결과(인덱스 존재·구조)를 단언하므로 검증 공백은 아니다.

## 요약

이 changeset 은 이미 두 차례 코드 리뷰에서 testing 관점 WARNING(핵심 최적화 쿼리 e2e 부재, unit 파라미터화 누락, 테스트 삽입 순서)을 전부 조치했고, 이번 라운드에서 그 조치가 실제로 반영돼 있음을 소스 대조로 재확인했다. 새로 발견한 것은 하나다 — `J.` 테스트의 워크스페이스 격리 단언이 "빈 배열을 도는 for 루프" 형태라 정상 경로에서 그 단언이 실질적으로 관측되지 않으며, 저장소의 다른 격리 테스트 전부가 쓰는 `expect(length).toBe(0)` 직접 단언 관례에서 벗어난다. 완전한 무효 테스트는 아니고(완전한 워크스페이스 필터 제거는 잡는다) 프로덕션 코드 결함도 아니지만, 테스트 제목이 약속하는 보장보다 실제 커버리지가 좁고 한 줄 수정으로 격차를 없앨 수 있어 WARNING 으로 판정한다. Critical 은 없다.

## 위험도

LOW
