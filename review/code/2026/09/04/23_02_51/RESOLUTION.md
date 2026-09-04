# RESOLUTION — `23_02_51`

전체 위험도 **MEDIUM** · Critical **0** · WARNING **4**. 네 건 **전부 조치**했다 (등재 유예 없음).

## 조치 항목

| # | 카테고리 | 지적 | 조치 | commit |
|---|---|---|---|---|
| 1 | database / side_effect | `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 는 **이름만 보고 `indisvalid` 를 안 본다.** 빌드 실패로 남은 invalid 인덱스를 건너뛴 뒤 DROP 이 옛 인덱스를 지우면 **쓸 수 있는 인덱스가 0개** — 이 마이그레이션이 없애려던 seq scan 으로 조용히 회귀 | 주석을 좁히는 데서 멈추지 않고 **CREATE 앞에 같은 이름의 DROP** 을 넣었다. 정상 첫 실행엔 no-op, 실패 후 재실행에서만 invalid 잔재를 치운다 | `dd6549796` |
| 2 | documentation | plan 이 "V110 적용만 남았다" 로 stale — 이 PR 이 그 잔여를 끝냈다 | 체크박스 `[x]`, 종결 조건 표 행 묘비 처리, `spec-draft-schedule-index.md` `status: complete` + §6 을 "완료" 서술로 | `dd6549796` |
| 3 | documentation | `spec/1-data-model.md` `## Rationale` 에 이 결정의 근거가 없다 — 같은 파일이 다른 행 변경 시엔 남기는 관행 | 네 후보 실측 비교표 + **기각 사유 셋**(부분 조건만 제거 / `(workspace_id)` 단독 / 단순 DROP)을 기존 항목 형식으로 추가 | `dd6549796` |
| 4 | testing | 최적화 대상 쿼리 자체(`GET /api/schedules`)의 e2e 가 없다 — 인덱스 존재와 "그 인덱스로 서빙되는 API 가 옳다" 는 별개 명제 | `J.` 테스트 신설: 워크스페이스 격리 + `next_run_at` 정렬을 **asc/desc 양방향**으로. 값이 다른 행 ≥2 를 먼저 단언해 정렬 관측이 공허해지지 않게 했다 | `dd6549796` |

네 건 모두 단일 커밋 `dd6549796` 에 담았다 — 서로 얽혀 있어(주석·plan·spec·테스트가 같은 결정을 서술) 쪼개면 각 커밋이 반쪽 상태가 된다.

### W1 을 "주석 정정" 으로 끝내지 않은 이유 — 실패 상태를 재현했다

리뷰는 두 갈래를 줬다 — 주석을 실제 보장 범위로 좁히거나, 런북에 `indisvalid` 확인 절차를
넣거나. **둘 다 문서 조치**다. 그런데 이 결함은 **동작 결함**이다: 재실행 경로가 DB 를
"인덱스 0개" 로 만든다.

그래서 주장을 검증부터 했다. `CREATE UNIQUE INDEX CONCURRENTLY` 를 중복 데이터에 걸어
**결정적으로 실패**시켜 `indisvalid = false` 를 만든 뒤, 두 순서를 각각 돌렸다:

| 순서 | 최종 상태 |
|---|---|
| **종전** (CREATE IF NOT EXISTS → DROP 옛것) | `NOTICE: … already exists, skipping` → **새 인덱스 invalid + 옛 인덱스 삭제 = 쓸 수 있는 인덱스 0개** |
| **V110** (DROP 새 이름 → CREATE → DROP 옛것) | `indisvalid=true`, `btree (workspace_id, next_run_at)` — **정상 복구** |

즉 위험은 이론이 아니라 재현되는 것이었고, 한 줄로 닫혔다. 문서만 고쳤다면 다음 사람이
런북을 안 읽었을 때 그대로 밟는다.

**선례 `V056`·`V106` 에는 이 줄이 없다.** 이미 적용된 마이그레이션은 append-only 라 수정
대상이 아니므로, 규약 차원의 처리(패턴 성문화 / 런북 절차)는
`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 **후속으로 등재**했다.
`spec/conventions/` 쓰기가 걸려 planner 트랙과 겹치는 항목이다.

### W3 을 developer 턴에서 쓴 근거

`spec/` 쓰기는 planner 트랙이다. 이 PR 은 **planner 단계를 먼저 수행**했고
(`--spec 22_34_55` BLOCK:NO), Rationale 항목의 내용은 그 draft 가 이미 담고 있던 것을
spec 형식으로 옮긴 것이다. 새 판단을 넣지 않았다. 사후 그물로 `--impl-done` 을 이 spec
파일이 포함되는 scope 로 돌린다.

## TEST 결과

| 단계 | 결과 |
|---|---|
| lint | **PASS** (`_test_logs/lint-20260904-231624.log`) |
| unit | **PASS** (`_test_logs/unit-20260904-231719.log`) |
| build | **PASS** (`_test_logs/build-20260904-231900.log`) |
| e2e | **통과** — **51 suites / 295 passed** (직전 294 → **+1**, W4 의 `J.` 목록 테스트). 그 스펙이 실제로 돌았음을 로그에서 확인 (`PASS test/schedule-trigger.e2e-spec.ts`) (`_test_logs/e2e-20260904-232140.log`) |

## 보류·후속 항목

- **`CREATE INDEX CONCURRENTLY IF NOT EXISTS` 재실행 위험의 규약 처리** — 등재 완료
  (`spec-draft-nullable-notation-followups.md`). V110 자신은 닫혔고, 남은 것은
  `migrations/README.md` §5 · `spec/conventions/migrations.md` 성문화 또는 배포 런북 절차다.

### INFO 처분

| # | 처분 |
|---|---|
| 1 (쓰기 비용 미측정) · 2 (CONCURRENTLY 빌드 소요시간 미문서화) | **미조치.** 둘 다 운영 환경의 실데이터가 있어야 의미 있는 수치다. 합성 데이터로 낸 값을 런북에 적으면 그 자체가 잘못된 기준선이 된다 |
| 3 (플래너가 실제로 그 인덱스를 고르는지 `EXPLAIN` 단언) | **미조치.** 리뷰도 "flaky 위험, 강제 불요" 로 판단했다. e2e 데이터가 수십 행이라 플래너는 정당하게 seq scan 을 고른다 — 단언하면 **가드가 아니라 오탐 생성기**가 된다 |
| 4 (§4 `trigger_id` 행 드라이브바이) | PR 설명에 명시 |
| 5 (부팅 쿼리 완충 제거) | 의도적 트레이드오프 — 실측·문서화됨 |
| 6 (벤치마크 표가 마이그레이션 헤더와 plan 에 중복) | **미조치 — 의도.** *(처음 이 칸에 "이미 적용된 마이그레이션이라 수정 불가" 라고 적었는데 **틀렸다** — append-only 는 **운영에 적용된** 마이그레이션에 걸리고 V110 은 아직 머지 전이라 지금은 얼마든지 고칠 수 있다.)* 실제 이유는 다른 데 있다: 마이그레이션 헤더는 장애 대응 중에 읽는 자리라 **자체 완결적인 수치가 기능**이다. 그리고 적용되는 순간 얼어붙어 **그 시점의 기록**이 되므로, 나중에 plan 쪽 수치가 갱신돼 갈리는 것은 drift 가 아니라 이 저장소가 리뷰 산출물에 쓰는 "시점 스냅샷" 관례와 같다. 다만 **안정된 SoT 를 함께 가리키도록** `spec/1-data-model.md` `## Rationale` 에 같은 표를 뒀다 — `plan/in-progress/…` 는 `complete/` 로 옮겨 가며 경로가 바뀐다 |
| 7 (schema 테스트가 무거운 `beforeAll` 에 결속) | **미조치.** 저장소 관례(`notifications-dismiss.e2e-spec.ts`)를 그대로 따랐다. 관례를 깨는 리팩터라 이 PR 범위 밖 |
| 8 (`relkind` 미필터) | **조치** — `AND relkind = 'i'` 추가 |
| 9 (파일 상단 JSDoc 이 신규 축 미반영) | **조치** — 두 줄 추가 |
