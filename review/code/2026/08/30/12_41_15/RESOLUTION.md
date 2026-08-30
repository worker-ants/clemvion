# RESOLUTION — 12_41_15

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1        | 코드 | `1a051bbe7` | 중첩 제네릭(`.query<Array<{...}>>(`) `CALL` 정규식을 `<(?:[^<>]|<[^<>]*>)*>` 로 확장. `.query(sqlVar)` 미탐지는 원리적 한계라 docstring 의 "안 보는 것" 절에 명시(넓히지 않음) |
| #2        | 코드 | `1a051bbe7` | `hasRawUpdateReturning` → `countRawUpdateReturning`(개수 반환) 신설, `discover()` 가 (파일, raw 지점 수) 튜플 반환, 판정을 `countCalls(...) >= rawCount` 로 강화 |
| #3        | 코드 | `1a051bbe7` | `source-scan.spec.ts` 에 `describe('countRawUpdateReturning / hasRawUpdateReturning')` 신설 — 양성 6·음성 5·카운트 1, 합성 문자열 12개 |
| #4        | 코드 | `31ff78bfd` | `kb-stats.helper.spec.ts` mock 을 `[[{ entity_count, relation_count }], 1]` / `[[], 0]` 튜플로 정정 |
| #5        | 코드 | `1a051bbe7` | `discover()` 3회 반복 호출을 `beforeAll` 캐싱 1회로 |
| #6        | 코드 | `dd273828f` | `CHANGELOG.md` `## Unreleased` 신규 항목 추가(발견형 가드 확장 + kb-stats 타입 정정). 기존 `:559` "8곳" 항목은 시점 기록이라 비수정 |

## TEST 결과

- lint  : 통과 (51s)
- unit  : 통과 (76s, backend 435 suites / 9,081 passed·1 skipped·9,082 total — baseline 9,069 + 신규 12)
- build : 별도 미실행(unit·e2e 로 충분히 검증된 범위, TS 컴파일은 lint/unit 의 ts-jest·eslint 경로에서 이미 통과)
- e2e   : 통과 (239s, backend 285 passed) — `_test_logs/e2e-20260830-130818.log`

## 뮤테이션 검증 (예측/실측)

| # | 뮤턴트 | 대상 | 예측 | 실측 |
|---|--------|------|------|------|
| 1 | `countRawUpdateReturning` → `return 1` 로 뭉갬 | SUMMARY#3 (음성 테스트) | 음성 5개 + 카운트 테스트 1개 RED | **RED 6/18** — 5개 음성 케이스 전부 실패(`Expected: false, Received: true`) + 카운트 테스트(`Expected: 2, Received: 1`). 양성 12개는 GREEN 유지 |
| 2 | `CALL` 정규식을 옛 `<[^>]*>` 로 되돌림 | SUMMARY#1 (중첩 제네릭) | 중첩 제네릭 케이스만 RED | **RED 1/18** — `.query<Array<{...}>>(` 케이스만 실패(`Expected: true, Received: false`), 나머지 17개(단일 제네릭 포함) GREEN — 정밀 표적 확인 |
| 3 | 허용목록 밖 파일에 raw 지점 2개 + 헬퍼 1개 합성(`src/common/utils/__raw-update-probe.ts`, 검증 직후 삭제) | SUMMARY#2 (개수 판정) | 강화 후(현재 코드) RED / 판정을 `=== 0`(강화 전 존재-only)으로 되돌리면 GREEN | **강화 후**: `unguarded` 배열에 `["common/utils/__raw-update-probe.ts", 2]` 등장 → RED. **판정을 `guardCount === 0` 으로 되돌리자** 같은 합성 파일이 `unguarded` 에서 빠짐 → **GREEN** — "2곳 중 1곳만 헬퍼" 를 존재-only 판정이 실제로 놓치는 것을 재현 확인 |

원복은 전부 `cp` 백업(스크래치패드에 백업 후 뮤턴트 적용 → 검증 → `cp` 로 원복, `git checkout`/`git restore` 미사용). 뮤테이션 3의 합성 프로브 파일은 검증 직후 `rm` 으로 제거(신규 미추적 파일이라 백업 불요) — 최종 `git status` 로 잔존 없음 확인.

## 보류·후속 항목

- INFO 10건은 SUMMARY 상 전부 "조치 불요" 로 이미 판정됨 — 추가 조치 없음.
- spec 관련 항목 없음(spec draft 위임 대상 0건).
- 민감 변경 가드 적용 항목 없음(DB 마이그레이션·외부 API 계약·인증·결제 변경 없음).

---

## main 의 독립 재검증 (에이전트 보고를 그대로 받지 않는다)

`resolution-applier` 의 "6/6 처리" 보고를 확인 없이 받지 않았다. **W2 강화가 실제로 무는지**를
직접 합성해 확인했다 — 리뷰어가 지적한 정확히 그 상황이다:

| 뮤턴트 | 예측 | 실측 |
| --- | --- | --- |
| 허용목록 밖 파일에 raw 지점 **2곳** + 헬퍼 호출 **1곳** | RED | **RED 1** — `발견된 지점은 모두 raw 지점 수만큼 헬퍼를 거친다` |

**강화 전이었다면 GREEN 이다** — 옛 판정은 `countCalls(...) === 0` 이라 헬퍼가 하나라도
있으면 통과시켰다. 즉 이 뮤턴트가 W2 의 존재 근거이자 fix 의 증거다.

W1·W3 은 산출물을 직접 읽어 확인했다 — `source-scan.spec.ts` 에
`describe('countRawUpdateReturning / hasRawUpdateReturning')` 이 신설됐고 **양성 6 · 음성 5 ·
개수 1** 로 판정 축을 합성 입력으로 고정한다. 음성에 `INSERT … ON CONFLICT DO UPDATE`,
주석 안 SQL, QueryBuilder 형태가 포함돼 있어 `return true` 뭉갬이 살 수 없다.

원복 후 `src/common/**` + `kb-stats.helper.spec.ts` **17 suites / 214 tests** GREEN,
`git status` clean 확인.

## 이 라운드가 드러낸 것 — 가드가 자기 결함 클래스를 가졌다

리뷰 총평이 정확했다: 이 PR 이 막으려는 *"새 raw UPDATE 지점이 조용히 미가드로 남는 것"* 과
**같은 형태의 blind spot 이 신설 가드 자체에** 있었고, 세 리뷰어가 독립 수렴했다.

1. **W2 는 후퇴였다.** 기존 큐레이션 가드는 정확한 **개수 튜플**로 판정했는데, 내가 "넓게
   보는" 발견형으로 바꾸면서 **파일 단위 존재-only** 로 정밀도를 잃었다. 넓힌 대가로 얕아진
   것을 못 봤다 — **보장을 옮길 때는 옮기기 전 보장을 전수로 세라.**
2. **W3 은 이 세션에서 두 번째다.** `#1238` 에서 "되돌린 뮤테이션은 회귀 방어가 아니다" 를
   배우고 메모리에까지 적었는데, 이번에도 뮤턴트 3개를 돌려 plan 에 표를 남기고 **스캐너의
   판정 축을 합성 입력으로 고정하는 테스트는 안 남겼다.** 내가 남긴 4개는 가드의 *결과*를
   보는 테스트이지 *판정 축*을 보는 테스트가 아니다.
