# Database Review

## 발견사항

- **[INFO]** `V056`·`V106` 이 "0) DROP-first 없음과 같은 위험을 갖는다"는 서술은 두 파일에 대해 정확도가 다르다
  - 위치: `codebase/backend/migrations/README.md:159` ("선례: `V110`...그 이전의 `V056`·`V106` 은 0) 이 없어 같은 위험을 갖습니다")
  - 상세: 실제 두 파일을 열어 대조했다. `V056`(`codebase/backend/migrations/V056__notification_active_partial_index.sql`)은 `CREATE`(new) → `DROP`(old) 의 진짜 **교체** 패턴이라 문서가 말하는 위험(재실행 시 CREATE 가 invalid 잔재를 보고 건너뛰고 뒤이은 DROP 이 옛 인덱스를 지워 "쓸 수 있는 인덱스 0개"가 되는 것)이 문자 그대로 적용된다. 반면 `V106`(`codebase/backend/migrations/V106__schedule_trigger_id_index.sql`)은 **교체가 아니라 단일 `CREATE INDEX CONCURRENTLY IF NOT EXISTS`** 뿐이고 짝이 되는 `DROP` 이 없다 — 옛 인덱스를 지우는 두 번째 statement가 없으므로 "DROP 이 옛 인덱스를 지워 0개가 된다"는 메커니즘 자체가 성립하지 않는다. 실제 결과 상태는 같다(그 인덱스 이름이 영구히 invalid 로 남아 조용히 seq scan 으로 회귀)지만, 원인 경로가 다르다 — V106 은 재실행이 "지운다"가 아니라 애초에 "고쳐지지 않는다"(Flyway 가 재실행 시 `IF NOT EXISTS` 로 인해 에러 없이 success 처리하고 넘어간다)는 쪽에 가깝다.
  - 제안: 문구를 "재실행 시 인덱스가 0개가 된다(V056 형)" 와 "재실행해도 invalid 인덱스가 영구히 고쳐지지 않는다(V106 형, 짝이 되는 DROP 이 아예 없음)"로 나눠 적으면 다음에 이 문서를 읽고 V106 류(단일 CREATE, 교체 아님) 파일에 그대로 DROP-first 3문장 패턴을 적용하려는 사람이 "옛 인덱스가 뭔지" 헷갈리는 것을 방지할 수 있다. 다만 두 케이스 모두 "수동 재실행 전 `indisvalid` 확인" 이라는 처방은 동일하므로 실무 영향은 낮다.

## 검증 사실 (참고)

- `plan/complete/spec-draft-migration-rerun-and-citations.md` §1.1~1.4 가 주장하는 세 형태(DROP-first 없음/DROP-first/`indisvalid` 분기 `DO` 블록)의 실측 결과, `-mixed=true` 요구사항, `.conf`의 `executeInTransaction=false`가 mixed 판정을 면제하지 않는다는 주장은 이 reviewer 가 별도로 재현하지 않았으나 (a) `codebase/backend/migrations/README.md` §4 의 `FLYWAY_POSTGRESQL_TRANSACTIONAL_LOCK=false` 관련 근본원인 설명, (b) Flyway 의 "실패한 마이그레이션만 재실행" 동작, (c) PostgreSQL 의 `CONCURRENTLY` 트랜잭션 내 실행 불가 제약과 정합적이라 기술적으로 이상 없다.
- 신규 규약이 제시하는 "DROP-먼저" 3-statement 패턴(`DROP IF EXISTS <new>` → `CREATE IF NOT EXISTS <new>` → `DROP IF EXISTS <old>`)을 실제 선례 `V110__schedule_workspace_next_run_index.sql`과 대조한 결과 **정확히 일치**한다 — 문서가 사후 정당화가 아니라 실제 적용된 패턴을 있는 그대로 성문화한 것으로 확인됨.
- 이번 changeset 에는 **신규 SQL 마이그레이션 파일이 없다** — `codebase/backend/migrations/README.md`, `spec/conventions/migrations.md`, plan/review 문서만 변경. 따라서 인덱스·N+1·트랜잭션·커넥션 관리·SQL 인젝션·페이지네이션 관점에서 실제 DB 런타임에 영향을 주는 코드 변경은 없음.
- `spec/conventions/migrations.md`에 추가된 한 단락(“기존 인덱스를 교체하는 마이그레이션은…”)은 패턴을 복제하지 않고 README.md §5 로 포인터만 거는 방식이라 두 문서 간 원문 이중 관리 문제가 생기지 않는다.

## 요약

이번 변경은 실제 실행되는 마이그레이션 SQL이나 애플리케이션 DB 코드가 아니라, `CREATE INDEX CONCURRENTLY` 기반 인덱스 교체의 재실행 안전성에 관한 **운영 컨벤션 문서**(README.md §5 보강 + `migrations.md` 포인터 추가)와 그 배경을 정리한 plan/review 산출물이다. 제시된 "DROP-먼저" 3-statement 패턴은 PostgreSQL의 invalid-index-behind-a-name 문제를 정확히 겨냥하고 있고, 기존 적용된 선례(V110)와 실제로 일치함을 직접 대조해 확인했다. 유일한 옥의 티는 "V056·V106 모두 같은 위험을 갖는다"는 일반화 문장이 두 파일의 실제 패턴(진짜 교체 vs 단일 CREATE)이 다름을 뭉뚱그린 것으로, 실무 영향은 낮은 서술 정밀도 문제다. 신규 SQL 마이그레이션이 포함되지 않아 인덱스/N+1/트랜잭션/락/커넥션/SQL 인젝션/대량 데이터 관점에서 실제 위험은 없다.

## 위험도
NONE
