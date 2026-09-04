# RESOLUTION — `23_26_09`

전체 위험도 **LOW** · Critical **0** · WARNING **3**. 세 건 **전부 조치**했다 (등재 유예 없음).
지적된 INFO 중 2건(#8·#9)도 함께 닫았다.

## 조치 항목

| # | 카테고리 | 지적 | 조치 |
|---|---|---|---|
| 1 | documentation / requirement | `spec-draft-schedule-index.md` 가 `status: complete` 인데 `plan/in-progress/` 에 남아 있다. 앞선 두 검토에서 "범위 밖" 으로 두 번 미뤄진 항목 | `git mv` → `plan/complete/` + **인입 참조 전수 갱신** |
| 2 | maintainability / testing | 신규 `J.` 테스트를 `H.`/`I.` 사이에 끼워 넣어 "물리 순서 = 알파벳 레이블" 관례가 깨졌다 (`…, H, J, I`) | `J.` 를 `I.` 뒤로 이동. 현재 `A`~`J` 순 |
| 3 | side_effect | 직전 라운드의 DROP-first 가 비대칭을 만든다 — **이미 성공한** 마이그레이션을 수동 재실행하면 살아 있는 인덱스를 재빌드한다. 헤더가 이 트레이드오프를 언급하지 않았다 | 헤더에 명시 + 왜 그럼에도 이쪽을 택했는지 기록 |

세 건 모두 단일 커밋 `8b0f5ac0c` 에 담았다.

### W1 — 리뷰가 센 인입 참조는 2곳, 실제로는 **4곳**이었다

리뷰는 `spec/1-data-model.md:978` 과 `spec-draft-nullable-notation-followups.md:379` 를 들었다.
경로 문자열로 전수 grep 하니 **둘이 더 있었다**:

| 위치 | 성격 |
|---|---|
| `spec/1-data-model.md` | 리뷰가 지목 |
| `plan/in-progress/spec-draft-nullable-notation-followups.md` | 리뷰가 지목 — **상대 링크**라 이동하면 실제로 깨진다 |
| `codebase/backend/migrations/V110__…sql` 헤더 | **누락돼 있었다** |
| `codebase/backend/test/schedule-trigger.e2e-spec.ts` JSDoc | **누락돼 있었다** |

`review/**` 안의 언급은 고치지 않았다 — 이 저장소에서 리뷰 산출물은 **시점 스냅샷**이다.

### W3 — 비대칭을 없애지 않고 명시한 이유

0) 의 `DROP INDEX CONCURRENTLY IF EXISTS` 는 대상이 **invalid 잔재인지 정상 인덱스인지
구분하지 않는다**. 구분하려면 `indisvalid` 를 읽고 분기해야 하는데, 그건 `DO` 블록이 필요하고
`DO` 는 트랜잭션이라 `CONCURRENTLY` 와 같은 파일에 둘 수 없다.

그래서 트레이드오프를 견주었다:

| 경로 | 종전(DROP-first 없음) | 지금(DROP-first) |
|---|---|---|
| 실패 후 재실행 | **쓸 수 있는 인덱스 0개** (실증됨) | 정상 복구 |
| 성공 후 수동 재실행 | no-op | 살아 있는 인덱스 재빌드 (그 구간 seq scan) |

앞줄은 **정상 운영 중 조용히** 일어나고 회복도 수동이다. 뒷줄은 Flyway 정상 흐름에서
**발생하지 않고**(성공한 마이그레이션을 다시 돌리지 않는다), 발생해도 재빌드가 끝나면
스스로 정상으로 돌아온다. 비대칭이 있다는 사실 자체를 헤더에 남기는 것이 옳은 처리다.

## INFO 중 함께 닫은 것

| # | 지적 | 조치 |
|---|---|---|
| 8 | 기본 정렬(`created_at`) 경로가 호출만 되고 결과 정확성은 미단언 — 이 인덱스가 그 경로도 개선한다고 주장(6.89 → 1.08 ms)해 놓고 | `J.` 에 `createdAt` 내림차순 단언 추가 + 파일 JSDoc 동기화 |
| 9 | `next_run_at` 정렬이 unit 파라미터화 목록에서만 빠져 있다 — 하필 V110 이 최적화한 축 | `schedules.service.spec.ts` 에 케이스 추가 (19 tests, 전부 통과) |

## 나머지 INFO 처분

| # | 처분 |
|---|---|
| 1~4 (W1 해소 확인 · 인젝션 없음 · 더미 비밀번호 · 인가 경계) | 확인 보고 — 조치 불요 |
| 5 (쓰기 증폭 미실측) · 6 (빌드 소요시간 미측정) · 7 (`EXPLAIN` 미단언) | **미조치, 직전 라운드 처분 유지.** 5·6 은 합성 데이터로 낸 값을 런북 기준선으로 쓰면 그 자체가 잘못된 기준이 된다. 7 은 e2e 시드가 수십 행이라 플래너가 정당하게 seq scan 을 고른다 — 단언하면 가드가 아니라 오탐 생성기가 된다 |
| 10·11·14 (드라이브바이 · 후속 등재 · 표 중복) | 기존 처분 유지 |
| 12 (`J.` 안 시간 추출 3단 체인 2회 반복) | **미조치.** asc/desc 두 방향을 **눈으로 나란히 비교**할 수 있는 것이 이 테스트의 요점이라, 헬퍼로 접으면 "무엇을 다르게 걸었는지" 가 흐려진다 |
| 13 (헤더 주석이 동종 파일 대비 최장) | **미조치.** 길이가 늘어난 것은 W1·W3 두 리뷰 지적을 근거와 함께 담았기 때문이다. 리뷰의 제안(반복되는 안전성 설명을 `migrations/README.md`·`migrations.md` 로 이관)은 이미 등재한 CONCURRENTLY 규약 후속 항목과 같은 작업이다 |
| 15~19 (미러 정합 · 컨벤션 준수 · 커넥션 · CHANGELOG 불요 · 근거 밀도) | 확인 보고 — 조치 불요 |

## TEST 결과

| 단계 | 결과 |
|---|---|
| lint | **PASS** (`_test_logs/lint-20260904-233800.log`) |
| unit | **PASS** (`_test_logs/unit-20260904-233900.log`) |
| build | **PASS** (`_test_logs/build-20260904-234045.log`) |
| e2e | **통과** — **51 suites / 295 passed**. 직전과 **같다** — INFO#8 은 기존 `J.` 안에 단언을 더한 것이라 `it` 수가 늘 이유가 없다. 반면 unit 은 9,339 → **9,340** (INFO#9 의 신규 케이스) (`_test_logs/e2e-20260904-234335.log`) |

## 보류·후속 항목

- **`CREATE INDEX CONCURRENTLY` 재실행 규약화** — 등재 유지
  (`spec-draft-nullable-notation-followups.md`). 이번 W3 이 드러낸 **DROP-first 의 비대칭**도
  그 항목에서 함께 다뤄야 한다: 선례 V056/V106 은 DROP-first 가 없어 반대 위험을 갖고,
  V110 은 DROP-first 가 있어 이 비대칭을 갖는다 — 규약은 둘 중 하나를 고르거나
  `indisvalid` 확인 절차를 런북에 두어야 한다.
