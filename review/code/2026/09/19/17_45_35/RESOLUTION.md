# RESOLUTION — review/code/2026/09/19/17_45_35

수동 처리(main). 처분은 커밋 `6b357e715`.

## 조치 항목

| SUMMARY # | 처분 | 커밋 | 근거 · 검증 |
|---|---|---|---|
| Warning 1 (읽기 전용 `DataSource` 가 `CREATE EXTENSION` 을 시도하고 삼킴) | 수정 — **내 2라운드 주장 정정** | `6b357e715` | 실측: 일회용 DB 의 Postgres 로그에 `ERROR: cannot execute CREATE EXTENSION in a read-only transaction` 1건. `installExtensions: false` 뒤 같은 DB 에 6건 재실행 — 거부 로그 0건 증가. plan 의 «쓰기를 하지 않는다는 실측» 은 취소선으로 남기고 정정 |
| Warning 2 (`describe` 제목이 단방향만) | 수정 | `6b357e715` | «인덱스 · 제약은 선언 → DB, 컬럼 정의는 양방향» |
| INFO 3 (`initialize()` 가 `try/finally` 밖) | 수정 | `6b357e715` | 초기화도 안으로, `isInitialized` 일 때만 `destroy()` |
| INFO 8 (`as DataSourceOptions` 단언) | 수정 | `6b357e715` | 접속 옵션을 `PostgresConnectionOptions` 로 좁혀 단언 제거 |
| INFO 13 (서브패스 import 이유 없음) | 수정 | `6b357e715` | 두 타입이 루트 `index.d.ts` 에 없음(grep 0) — 주석 |
| INFO 1 · 2 (`1-data-model.md` §2.16 · §2.20 에 DB 기본값 미기재) | 트래커 | (이 턴) | spec 이라 planner — `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재 |
| INFO 그 밖 | 조치 불요 | — | 4 · 11 · 12 는 TypeORM 업그레이드 때 표본 재채집(머리말에 채집 버전). 5 · 6 · 14 · 15 확인 기록. 7 은 e2e 로 확인된 의도된 변화. 9 · 10 은 이름 · 반환 타입 제안 |

## TEST 결과

- lint: PASS (`_test_logs/lint-20260919-180008.log`)
- unit: PASS (`_test_logs/unit-20260919-180114.log`)
- build: PASS — 타입체크 ratchet 포함 (`_test_logs/build-20260919-180302.log`)
- e2e: 통과 — backend 355 · Playwright 51, 커밋 `6b357e715` 기준 (`_test_logs/e2e-20260919-180658.log`)
