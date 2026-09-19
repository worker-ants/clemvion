# RESOLUTION — review/code/2026/09/19/17_04_28

수동 처리(main). 처분은 커밋 `717382613`.

## 조치 항목

| SUMMARY # | 처분 | 커밋 | 근거 · 검증 |
|---|---|---|---|
| Warning 1 (컬럼 층 패턴 중 `ADD` · `RENAME COLUMN` 미검증) | 수정 | `717382613` | 일회용 DB(V001~V132)에 엔티티 뮤턴트를 걸어 비교기가 **실제로 낸** 문장을 채집, DB 없이 도는 표본 테스트로 고정(잡을 9 · 흘릴 5 · 패턴별 최소 1). RENAME 도 실제로 나온다는 것을 채집으로 확인. 뮤턴트 P1~P4 RED |
| Warning 2 (`log()` 읽기 전용이 주석 근거뿐) | 수정 | `717382613` | 호출 전후 카탈로그 해시(컬럼 정의 · enum 타입) 단언. 뮤턴트 S1(`log()` 뒤 DDL) RED |
| INFO 5 (`now()` 소문자 vs 다수 관례 `NOW()`) | 조치 불요 | — | 기능 동일(Postgres 함수명 대소문자 무관). 비교기도 같은 기본값으로 본다(가드 GREEN) — 표기 통일은 이 PR 범위 밖 |
| INFO 9 (헤더가 `plan/complete/` 를 선인용) | 마무리 커밋 | (마무리) | 같은 PR 에서 plan 을 옮긴다 |
| INFO 그 밖 | 조치 불요 | — | 1 · 7 · 8 · 10 · 11 · 12 는 확인 기록. 2 · 4 는 런타임 영향이 e2e 로 확인됨. 3 · 6 은 W2 보강 · 예외 목록 신선도 단언이 이미 덮는다 |

## TEST 결과

- lint: PASS (`_test_logs/lint-20260919-171858.log`)
- unit: PASS (`_test_logs/unit-20260919-171952.log`)
- build: PASS — 타입체크 ratchet 포함 (`_test_logs/build-20260919-172111.log`)
- e2e: 통과 — backend 355(가드 파일 6건 포함) · Playwright 51, 커밋 `717382613` 기준 (`_test_logs/e2e-20260919-172507.log`)
