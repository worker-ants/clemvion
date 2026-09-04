# 요구사항(Requirement) 리뷰 — V110 schedule 인덱스 교체

## 검토 범위

- `codebase/backend/migrations/V110__schedule_workspace_next_run_index.{conf,sql}` (신규)
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` (양방향 인덱스 확인 `it` 블록 추가)
- `plan/in-progress/spec-draft-schedule-index.md` (신규, 실측 draft)
- `plan/in-progress/spec-draft-nullable-notation-followups.md` (후속 항목 갱신)
- `spec/1-data-model.md` §3, `spec/data-flow/10-triggers.md` §2.1 (미러 스펙 정정)
- `review/consistency/2026/09/04/22_34_55/**` (선행 `--spec` consistency-check 산출물, 참고용)

실제 리포지토리(worktree)를 열어 코드/spec 원문을 직접 대조했다(뮤테이션 없음, 읽기 전용).

## 발견사항

- **[WARNING]** plan 종결 상태가 실제 구현 완료 상태를 반영하지 못함(stale)
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:379`, `:430` (프롬프트 게이트 번호 기준 동일)
  - 상세: L379 체크박스가 `- [ ]` 미체크 상태로 "**`idx_schedule_next_run` — 실측 완료, 답은 (c). V110 적용만 남았다**"라고 적고, L430 종결조건 표도 "잔여는 **V110 마이그레이션 적용**뿐"이라고 적는다. 그런데 실제로는 `codebase/backend/migrations/V110__schedule_workspace_next_run_index.{sql,conf}` 가 이미 작성·커밋됐고(`git log`: `e20fe5b0b perf(db): V110 …`), `migration-guard`(`python3 scripts/check-migration-versions.py --base origin/main`)도 `OK: 110 migration(s), max V110` 로 통과한다. 즉 "적용만 남았다"고 서술된 유일한 잔여 작업이 이미 끝나 있다.
  - 제안: 이 리뷰(구현 완료 시점) 이후 마무리 커밋에서 L379 체크박스를 `[x]`로, L430 표의 상태를 "V110 적용 완료"로 갱신한다. (본 저장소 관례상 "체크와 완료 반영은 리뷰 뒤 마무리 커밋"이 정상 흐름이므로 이번 diff 자체의 결함이라기보다, 다음 커밋에서 반드시 반영돼야 할 잔여 항목으로 플래그한다 — 누락되면 다음 사람이 "아직 안 끝났다"고 오인해 (a)/(b) 로 재작업할 위험이 `review/consistency/2026/09/04/22_34_55/SUMMARY.md` WARNING #2 가 이미 경고한 그대로다.)

- **[WARNING]** `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 의 "재실행 안전" 주석이 Postgres 실제 동작보다 넓게 주장됨
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:33` ("IF NOT EXISTS / IF EXISTS 로 CONCURRENTLY 실패 후 부분 상태에서도 재실행 안전.")
  - 상세: `DROP INDEX CONCURRENTLY IF EXISTS` 쪽은 이름 존재 여부만 보므로 실제로 안전하다. 그러나 `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 는 **이름이 이미 존재하면 유효성(valid/invalid)을 검사하지 않고 그냥 스킵**한다(PostgreSQL 공식 문서: "there is no guarantee that the existing index is anything like the one that would have been created"). `CREATE INDEX CONCURRENTLY` 가 스캔 도중 실패하면 해당 이름의 **invalid 인덱스가 그대로 남는데**, 재실행 시 `IF NOT EXISTS` 가 이름이 이미 있다는 이유로 재생성을 건너뛰어 invalid 상태가 영구화될 수 있다(Postgres 권장 복구 절차는 `DROP INDEX` 후 재시도이지 재실행이 아니다). 이 상태에서 뒤이은 `DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_next_run` 은 정상 실행되므로, 최악의 경우 "옛 인덱스는 지워지고 새 인덱스는 invalid" 상태로 마이그레이션이 겉보기엔 성공(exit 0)한 채 끝날 수 있다.
  - 이 패턴은 이번 PR 고유의 신규 결함이 아니라 기존 선례(`V056__notification_active_partial_index.sql` 등)에서 그대로 계승한 관례이며, `spec/conventions/migrations.md`·`codebase/backend/migrations/README.md` 어디에도 이 edge case(invalid 인덱스 재실행 시나리오)에 대한 언급이 없다.
  - 제안: 이번 diff 를 막을 사유는 아니다(선례를 그대로 따랐고, 새 결함을 도입한 것이 아님). 다만 주석 문구를 "이름 재사용은 안전하나 CREATE 실패로 invalid 인덱스가 남으면 수동으로 `DROP INDEX idx_schedule_workspace_next_run` 후 재실행이 필요하다"로 좁히거나, `migrations.md`/`README.md` 에 이 운영 주의사항을 별도 항목으로 문서화하는 후속 작업을 권장한다.

- **[INFO]** spec fidelity — line-level 일치 확인, 두 미러 문서 모두 동기화됨
  - 위치: `spec/1-data-model.md:914` (§3 인덱스 전략 Schedule 행), `spec/data-flow/10-triggers.md:175` (§2.1 Schema 매핑 schedule 행)
  - 상세: `review/consistency/2026/09/04/22_34_55/SUMMARY.md` WARNING #1 이 지적한 "두 spec 문서가 같은 물리 인덱스에 대해 서로 다른 값을 주장" 문제가 **이번 diff 에서 이미 해소**됐다 — 두 문서 모두 `(workspace_id, next_run_at)` 로 갱신돼 있고 `spec-draft-schedule-index.md` frontmatter `spec_impact` 에도 두 파일이 함께 등재돼 있다(WARNING #1 의 제안 그대로 반영). 실제 쿼리 코드(`schedules.service.ts:84` `WHERE s.workspace_id = :workspaceId` + `:96-99` `qb.orderBy(...)`, `schedule-runner.service.ts:114-116` `find({ where: { isActive: true } })`)도 spec/plan 이 서술하는 술어와 정확히 일치함을 직접 확인했다.

- **[INFO]** 마이그레이션 명명·구조 컨벤션 준수 확인
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.{sql,conf}`
  - 상세: `spec/conventions/migrations.md` §1(명명)·§2(V번호 단조성, main max=V109 다음 V110)·§5(`.conf` executeInTransaction=false + CREATE/DROP CONCURRENTLY 순서 + `IF NOT EXISTS`/`IF EXISTS`)를 모두 준수하고, `V056` 선례와 파일 구조가 동일하다. `python3 scripts/check-migration-versions.py --base origin/main` 실행 결과 `OK: 110 migration(s), max V110` 로 가드 통과를 직접 확인했다.

- **[INFO]** e2e 테스트가 실제로 "양방향"을 검증함(의도-구현 일치)
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:64-82`
  - 상세: 새 인덱스 존재(`indisvalid=true`, 컬럼 순서, non-partial) + 옛 인덱스(`idx_schedule_next_run`) 부재를 모두 단언한다. 커밋 메시지(`e20fe5b0b`)에 "사전 상태(옛 인덱스 1행·새 인덱스 0행)에서 두 단언이 모두 RED 임을 실제 Postgres 로 확인했다"는 기록이 있어 vacuous test 가 아님이 근거를 갖고 뒷받침된다. 정규식 `/\(workspace_id,\s*next_run_at\)/` 은 `pg_get_indexdef` 실제 출력 형식(`... USING btree (workspace_id, next_run_at)`)과 일치한다.

## 요약

이번 변경은 `spec-draft-nullable-notation-followups.md` 에 developer 권한 밖으로 남아 있던 `idx_schedule_next_run` 부분 인덱스 불일치 항목을 실측(`EXPLAIN`, PostgreSQL 18.4, 200,000행)으로 닫고, 그 결론을 두 미러 spec 문서(`1-data-model.md` §3, `data-flow/10-triggers.md` §2.1)에 line-level 로 반영한 뒤, 실제 마이그레이션(V110, CONCURRENTLY CREATE→DROP, V056 선례 준수)과 양방향 e2e 검증까지 이어지는 일관된 작업 흐름이다. 실측 수치(5.99→0.30ms, 20배 등)는 SQL 주석·plan draft·spec 서술 세 곳 모두에서 산술적으로 정합하며, 코드(쿼리 술어)와 spec 서술이 실제로 일치함을 직접 대조 확인했다. 선행 `consistency-check`(22:34:55)가 지적한 WARNING #1(미러 문서 미반영)은 이 diff 에서 이미 해소됐다. 남은 결함은 (1) 원 plan(`spec-draft-nullable-notation-followups.md`)의 체크박스/종결조건 표가 "V110 적용 잔여"로 stale 하게 남아 있는 plan 위생 문제와, (2) `CREATE INDEX CONCURRENTLY IF NOT EXISTS` 의 재실행-안전 주석이 Postgres 의 invalid-index 엣지케이스를 완전히 커버하지 못하는 문서화 갭(기존 선례에서 계승된 것으로 이번 PR 고유 결함 아님) 두 가지이며, 둘 다 기능을 막는 CRITICAL 은 아니다.

## 위험도

LOW
