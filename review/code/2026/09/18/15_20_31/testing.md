# 테스트(Testing) 리뷰 — V117~V120 그래프 RAG FK 인덱스

## 발견사항

- **[WARNING]** `/ai-review` 시점에 TEST WORKFLOW(lint·unit·build·e2e)가 checklist 상 미완료 상태
  - 위치: `plan/in-progress/spec-draft-graph-fk-indexes.md` `## 체크리스트` (`- [x] V117~V120 · e2e 네 건 · ... check-migration-versions.py ... → OK` 다음 줄 `- [ ] lint · unit · build · e2e`, 그다음 `- [ ] /ai-review`)
  - 상세: 이 PR 이 테스트로 검증하는 유일한 실행 가능 자산은 `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` 에 추가된 4건의 `it.each` 케이스다. developer SKILL 의 정의된 순서(TEST WORKFLOW → REVIEW WORKFLOW, `.claude/skills/developer/SKILL.md` 51~64행·196행)상 `/ai-review` 는 lint/unit/build/e2e 통과 **이후**에 호출되어야 하는데, 이 draft 의 체크리스트는 `e2e` 항목이 아직 `[ ]` 다. "V117~V120 · e2e 네 건 · check-migration-versions.py" 체크는 마이그레이션 버전 충돌 검사(`check-migration-versions.py`)만 확인했음을 명시하고 있고, 실제 `make e2e-test`/jest e2e 실행으로 새 4개 index 단언(`idx_entity_last_seen_chunk_id` 등)이 실제로 **초록**인지는 별도 항목(`lint · unit · build · e2e`)에 남아 미확인이다. `indisvalid`·정의 regex 대조가 이 PR의 유일한 자동 회귀 방어선이므로, 그 단언이 실제로 통과했다는 근거 없이 리뷰가 먼저 도는 것은 순서 위반이며 — 만약 regex 오타나 `CREATE INDEX CONCURRENTLY` 실패(invalid 인덱스)가 있었다면 이 시점까지 드러나지 않았을 수 있다.
  - 제안: `/ai-review` 완료 후에도 반드시 실제 e2e 실행 로그(4건 GREEN)를 확보해 체크박스를 갱신하고, TEST WORKFLOW commit 을 REVIEW WORKFLOW commit 과 구분해 남길 것.

- **[INFO]** 성능 개선 주장(KB 삭제 129,941 ms → 48.1 ms)에 대한 자동 회귀 테스트 부재
  - 위치: `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` (전체 — `EXPECTED` 배열과 `it.each` 블록)
  - 상세: 테스트는 인덱스의 존재·`indisvalid`·정의(선두 컬럼·partial 조건)만 검증하고, 실제 삭제 소요 시간은 검증하지 않는다. 따라서 향후 누군가 이 인덱스를 의도치 않게 제거하거나 정의를 되돌리면 이 e2e 가 즉시 잡아내지만(RED), 인덱스가 "존재는 하되 플래너가 기대한 만큼 쓰이지 않는" 회귀(예: planner 가 다른 실행계획을 택하는 PG 버전 변경)는 잡지 못한다. 다만 이는 새로 도입된 갭이 아니라 V112~V116 선례부터 이어진 동일한 설계이므로 이 PR 단독의 결함은 아니다.
  - 제안: 조치 불요(선례와 일관). 필요하다면 향후 별도 트래커에서 "인덱스 존재 e2e" 와 "실측 성능 e2e"를 분리하는 논의를 남길 수 있다.

- **[INFO]** `check-migration-versions.py` 가 "CONCURRENTLY 이면 `.conf` 필수"의 역방향을 검사하지 않음
  - 위치: `scripts/check-migration-versions.py` `check()` 함수의 "검사 4: .conf pair" 블록(`.conf` → `.sql` 방향만 검사, `.sql` 안의 `CREATE INDEX CONCURRENTLY` 유무를 보고 `.conf` 존재를 강제하는 역방향 검사는 없음)
  - 상세: 이번 PR 은 V117~V120 모두 `.conf` 를 정확히 동봉해 문제가 없지만, 이 스크립트가 그 짝을 자동으로 강제하지 않으므로 향후 PR 에서 `.conf` 를 빠뜨려도 이 가드는 통과한다(오직 Flyway 실행 시점에 트랜잭션 오류로만 드러남). 이 PR 이전부터 있던 하네스 갭이라 이번 diff 의 결함은 아니다.
  - 제안: 조치 불요(스코프 밖). 향후 harness 개선 항목으로만 참고.

- **[INFO]** 신규 e2e 케이스는 기존 5건과 동일한 검증 패턴(존재·`indisvalid`·정의 regex)을 그대로 재사용해 회귀 위험이 낮음
  - 위치: `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts:45-61` (`EXPECTED` 배열에 추가된 4개 항목), `:64` (describe 제목 V112~V120 갱신)
  - 상세: 기존 5개 항목(V112~V116)은 값 변경 없이 그대로 보존되어 회귀 테스트로서 유효하다. 신규 4개 항목의 regex 는 `partial`(V117·V118, `WHERE ... IS NOT NULL`)과 `non-partial`(V119·V120, tail-anchor `$` 로 WHERE 부재까지 검증)을 실제 스키마(`V025__graph_rag.sql` 의 nullable/NOT NULL 정의)와 일치시켜 head/tail 이 NOT NULL, last_seen/evidence 가 nullable 이라는 전제와 부합한다. 별도 조치 불요, 확인만.
  - 제안: 없음(정상).

- **[INFO]** DB 도입 방식(Mock 미사용, 실제 `pg` Client 로 카탈로그 조회)이 스키마 검증에 적절
  - 위치: `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts:1-2, 67-74`
  - 상세: `pg_index`/`pg_class` 카탈로그를 실제 커넥션으로 조회하므로 mock 과 실제 동작의 괴리 위험이 없다. `beforeAll`/`afterAll` 로 커넥션을 한 번만 열고 `it.each` 는 읽기 전용 쿼리만 수행해 테스트 간 격리도 충분하다(공유 상태를 변형하지 않음).
  - 제안: 없음(정상).

## 요약

이번 변경의 테스트 대상은 사실상 DDL(마이그레이션 SQL/conf 4쌍)과 그 스키마 존재·유효성·정의를 검증하는 e2e 단언 4건 추가뿐이며, 애플리케이션 코드 변경은 없다. 새 e2e 케이스는 V112~V116 선례의 검증 패턴(존재 + `indisvalid` + 선두 컬럼/부분조건 regex)을 정확히 재사용했고 nullable/NOT NULL 전제와 정의가 실제 `V025__graph_rag.sql` 스키마와 일치해 회귀 방어력이 있다. 다만 리뷰 시점에 plan 체크리스트상 `lint · unit · build · e2e` 가 아직 미완료(`[ ]`)로 남아 있어, 이 PR의 유일한 자동 검증 수단인 신규 e2e 4건이 실제로 통과했는지가 이 리뷰 시점 기준으로는 확인되지 않는다 — SKILL 이 정의한 "TEST WORKFLOW 이후 REVIEW WORKFLOW" 순서와 어긋나므로 이 부분만 후속 확인이 필요하다. 그 외 mock 사용·테스트 격리·가독성 측면은 문제가 없고, 성능 회귀 테스트 부재나 `.conf` 강제 검사 부재는 이 PR 이전부터 있던 설계/하네스 갭으로 이번 diff 의 결함은 아니다.

## 위험도

LOW
