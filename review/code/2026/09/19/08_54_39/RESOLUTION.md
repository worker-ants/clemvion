# RESOLUTION — review/code/2026/09/19/08_54_39 (ai-review 1라운드)

SUMMARY: Critical 0 · WARNING 3 · INFO 9. 동작 결함 없음 — 셋 다 가독성 · 문서 정합성.

## 조치 항목

| SUMMARY # | 발견 | 조치 | 커밋 |
|---|---|---|---|
| W1 | 가드의 «같은 정의 없음 / 이름이 다르다» 판정이 인덱스 · 유니크 · CHECK 세 곳에 반복 | `reportMatch(problems, label, matches, givenName, missing)` 하나로 모았다. 판정 문구는 그대로 | `6e18aa4d8` |
| W2 | 라벨 템플릿의 중첩 삼항, 최대 240자 줄 | `describeIndexDecl` · `describeDbIndex` · `describeForeignKeyDecl` · `describeDbForeignKey` · `fkActions` · `nameOrNone` 로 분리. 남은 최장 코드 줄은 106자(삼항 없음) | `6e18aa4d8` |
| W3 | `plan/complete/entity-schema-declaration-drift.md` 선인용이 아직 없는 경로 | 이 PR 의 마무리 커밋에서 plan 을 `plan/complete/` 로 옮겨 닫는다(체크리스트 마지막 항목). 저장소의 확립된 선인용 관례 | 마무리 커밋 |
| INFO 1 | 식을 이스케이프 없이 SQL 에 잇는다 | 두 함수 위에 «입력은 엔티티 데코레이터의 문자열 리터럴뿐, 외부 입력을 넘기지 말 것» 주석 | `6e18aa4d8` |
| INFO 4 | FK 테스트만 트랜잭션 밖 | «카탈로그를 읽기만 한다 — 위 셋은 임시 테이블 때문에 ROLLBACK 이 필요했다» 주석 | `6e18aa4d8` |
| INFO 2 | `checked > 0` 은 부분 축소를 못 잡는다 | 채택 안 함. 하한을 실측치(104)로 박으면 선언을 **정당하게** 지우거나 더할 때마다 가드가 깨진다 — 이 PR 이 선언 두 개를 지웠듯 선언 수는 고정값이 아니다. `ROOT_ENTITIES` 와의 대조는 메타데이터가 바로 그 배열로 만들어지므로 항상 참이다. 루프가 도는지는 뮤턴트 10개가 증명했다 | — |
| INFO 3 | 뮤턴트 10개 중 8개가 영구 테스트가 아니다 | 채택 안 함. 영구 대조군이 지키는 것은 이 가드만의 판정 수단(정규화 비교 · 만들 수 없는 식)이다. 나머지 분기는 고치기 전 RED 여덟과 뮤턴트 열의 예측/실측으로 plan 에 기록했다. 영구화하려면 가짜 엔티티 메타데이터를 만들어야 해 가드보다 픽스처가 커진다 | — |
| INFO 5 | DataSource 접속 기본값 중복 | 범위 밖 — 기존 e2e 두 파일과 같은 관례(리뷰어도 «새 문제 아님») | — |
| INFO 6 | «선언은 실재하는 것만» 규칙이 plan 에만 있다 | 규칙의 집행은 이 가드가 기계적으로 한다(가드 머리말이 규칙을 적는다). 문서 규약 승격은 강제력이 없어 등재하지 않는다 | — |
| INFO 7 | spec §2 Workspace `owner_id` 삭제 동작 미기재 | 이미 트래커 등재(`--impl-prep` `08_33_13` WARNING 1) | — |
| INFO 8 | 두 plan(엔티티 정정 · spec i18n 동기화) 병존 | PR 설명에 명시한다 | PR 본문 |
| INFO 9 | Workspace 소유자 CASCADE 명시 | 정보성 — 동작 불변(V001 부터 CASCADE). 유저 삭제 기능이 생기면 1-data-model Rationale 의 «user 참조 FK 13개 재처분» 게이트가 다시 본다 | — |

## TEST 결과

- lint: PASS (`_test_logs/lint-20260919-091004.log`)
- unit: PASS (`_test_logs/unit-20260919-091059.log`)
- build: PASS (`_test_logs/build-20260919-091219.log`)
- e2e: 통과 — PASS 348 (`_test_logs/e2e-20260919-091557.log`, `entity-schema-declarations.e2e-spec.ts` 포함)
- 추가: 로컬 pg18(V001~V132)에서 가드 4/4 GREEN, 판정 분기 뮤턴트 10개 모두 리팩터 전과 같은 RED(문제 1건 · 해당 분기 문구)
