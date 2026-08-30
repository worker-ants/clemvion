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
