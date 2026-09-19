# RESOLUTION — review/code/2026/09/19/17_25_09

수동 처리(main). 처분은 커밋 `756286f80`.

## 조치 항목

| SUMMARY # | 처분 | 커밋 | 근거 · 검증 |
|---|---|---|---|
| Warning 1 (`log()` 호출에 예방이 없고 탐지만 있다) | 수정 | `756286f80` | `log()` 는 자기 커넥션을 써서 트랜잭션으로 감쌀 수 없다 — 비교기 전용 `DataSource` 를 `default_transaction_read_only=on` 세션으로 열어 DDL 자체를 Postgres 가 거부하게 했다. 카탈로그 비교는 두 번째 방어로 남김. 읽기 전용에서도 6건 GREEN. 뮤턴트 RO1(같은 `DataSource` 에서 `build()`) → RED(`cannot execute ALTER TABLE in a read-only transaction`) · 카탈로그 불변 |
| INFO 4 (표본 테스트가 DB 없는데 e2e `describe` 에 묶임) | 조치 불요 | — | 표본 · 패턴이 컬럼 층 라이브 테스트와 같은 파일에 있어야 한 곳에서 함께 바뀐다(한쪽만 고치면 어긋난다). backend unit 으로 옮기면 e2e 가드와 패턴 정의가 두 파일로 갈린다 |
| INFO 5 (스키마 프리픽스 붙은 `ADD`) | 조치 불요 | — | 실측 표본은 프리픽스 없음. TypeORM 을 올릴 때 표본을 다시 채집한다(표본 머리말에 채집 버전 명시) |
| INFO 6 · 7 · 10 (plan 경로 · 실측 시점 · 기준 문장) | 마무리 커밋 | (마무리) | 10 의 문장은 이미 plan «가드» 절에 있다(«트래커가 물은 «선언 생략 vs 거짓 선언» 기준은 이것이다»). 7 은 마무리 때 최신 커밋 기준으로 갱신 |
| INFO 그 밖 | 조치 불요 | — | 1 · 2 · 3 · 11 · 12 · 13 은 확인 기록. 8 · 9 는 이름 · 중복 제안(세 번째 vector 컬럼이 생길 때) |

## TEST 결과

- lint: PASS (`_test_logs/lint-20260919-173746.log`)
- unit: PASS (`_test_logs/unit-20260919-173854.log`)
- build: PASS — 타입체크 ratchet 포함 (`_test_logs/build-20260919-174046.log`)
- e2e: 통과 — backend 355(가드 6건 — 읽기 전용 세션으로 실제 e2e DB 에서도 GREEN) · Playwright 51, 커밋 `756286f80` 기준 (`_test_logs/e2e-20260919-174532.log`)
