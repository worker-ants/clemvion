# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 1건(신규 e2e `J.` 테스트의 워크스페이스 격리 단언이 빈 배열을 도는 for-loop 안에 있어 정상 경로에서 실질적으로 관측되지 않는 약한 형태). forced 화이트리스트(database·documentation·maintainability·requirement·scope·security·side_effect·testing) 8명 전원 결과 확보 확인 — 강제 대상 미이행 없음.

## Critical 발견사항

없음.

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| — | — | 없음 | — | — |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | 신규 `J.` 테스트("워크스페이스 격리 + next_run_at 정렬")의 격리 단언이 `for (const row of isolated.body.data) { expect(mine.has(row.id)).toBe(false); }` 형태다. `otherWs` 는 스케줄을 하나도 만들지 않은 워크스페이스라 정상 경로에서 `isolated.body.data` 는 항상 빈 배열이고, 루프 바디는 한 번도 실행되지 않는다 — 즉 핵심 단언이 정상 경로에서 실질적으로 관측되지 않은 채 PASS 한다(완전 무효는 아님 — 워크스페이스 필터가 통째로 제거되는 회귀는 여전히 잡음). 저장소의 다른 격리 테스트(`knowledge-base.e2e-spec.ts`, `agent-memory-admin.e2e-spec.ts`)는 전부 `expect(length).toBe(0)` 직접 단언을 쓰는 것과 대비됨 | `codebase/backend/test/schedule-trigger.e2e-spec.ts:403-416` | `expect(isolated.body.data.length).toBe(0);` 를 (루프 대신 또는 추가로) 넣어 "필터가 걸리되 다른 workspace_id 로 새는" 회귀 클래스까지 잡는다 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | SQL 인젝션 표면 없음 — 마이그레이션은 전부 정적 리터럴 DDL, `sort`/`order` 쿼리 파라미터는 DTO(`@IsIn`, `@Matches`) + 서비스 `resolveOrderBy` 화이트리스트 이중 방어 유지 (신규 코드 아님, 재확인) | `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:60-65`, `schedules.service.ts:80-105` | 조치 불요 |
| 2 | Security/Database | 워크스페이스 인가 경계는 변경되지 않았고, 신규 `J.` e2e 가 `otherWs` 헤더로 조회 시 원 워크스페이스 schedule id 가 섞이지 않음을 명시적으로 검증 | `schedule-trigger.e2e-spec.ts` `J.` 블록 | 조치 불요 |
| 3 | Side effect / Concurrency / Database | DROP-first 인덱스 교체 순서(`DROP idx_schedule_workspace_next_run` → `CREATE ... IF NOT EXISTS` → `DROP idx_schedule_next_run`)가 이미 성공한 마이그레이션을 Flyway 정상 흐름 밖에서 수동 재실행하면 살아있는 인덱스를 지우고 재빌드하는 비대칭을 여전히 안고 있음 — Postgres `DO`+`CONCURRENTLY` 제약상 코드로 없앨 수 없어 문서로 명시하는 쪽을 의식적으로 택한 상태(트레이드오프 표 포함), 정상 Flyway 배포 경로에서는 발동 안 함 | `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:53-65` | 조치 불요 — 후속 규약 성문화(`indisvalid` 재실행 절차)가 `plan/in-progress/spec-draft-nullable-notation-followups.md:395-428` 에 이미 등재됨 |
| 4 | Maintainability / Scope / Testing | 직전 두 라운드(`23_02_51`, `23_26_09`)가 지적한 WARNING(J. 테스트 삽입 위치가 알파벳 레이블 관례를 깨고 `H,J,I` 순이던 문제, unit 파라미터화 누락, 핵심 최적화 쿼리 e2e 부재)이 이번 라운드에서 소스 직접 대조로 실제 해소됨을 재확인 — `A`~`J` 물리 순서와 레이블 완전 일치 | `schedule-trigger.e2e-spec.ts` (`grep -n "it('[A-Z]\."` 결과), `schedules.service.spec.ts:142` | 조치 불요(확인용) |
| 5 | Documentation | 마이그레이션 헤더 주석이 일시적 리뷰-세션 ID(`23_02_51 W1`, `23_26_09 W3`)를 처음으로 인용 — append-only 파일의 "영구 기록" 성격과 맞지 않는 식별자지만, 본문 자체가 자기완결적이라 인용이 사라져도 의미 손실은 없음 | `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:32,53` | 향후 유사 패턴에서는 세션 ID 대신 커밋 SHA/PR 번호 사용 권장(결함 아님) |
| 6 | Database | partial(활성 70%) → non-partial(전체) 인덱스 전환으로 쓰기 경로(INSERT/UPDATE) 유지비용이 크기 추정(+2.6MB)으로만 문서화되고 별도 처리량/지연 벤치마크는 없음 — 읽기 개선(20배)이 압도적이라 결정을 뒤집을 사안 아님 | `V110__schedule_workspace_next_run_index.sql:26-27` | 배포 후 `pg_stat_user_tables.n_tup_upd`/인덱스 쓰기 지연 모니터링 권장 |
| 7 | Scope | `Schedule (trigger_id)` 인덱스 표 행 추가는 이 PR 의 원 티켓과 무관한 드라이브바이 문서 보정이나, 이미 3회째 동일 판정·처분(공개·저위험) 유지 중인 항목 | `spec/1-data-model.md:915` | 조치 불요 |
| 8 | User Guide Sync | doc-sync-matrix 24개 trigger 행 전수 대조 결과 매칭 0건 — 노드/스키마/TSX 문자열/통합·제공자/auth/표현식 언어/실행·디버깅 흐름/신규 warningCode·errorCode 어느 것도 해당 없는 순수 백엔드 DB 인덱스 마이그레이션 | 전체 51개 변경 파일 | 유저 가이드 동반 갱신 불요 |
| 9 | Side effect | 신규 e2e(`J.`)가 생성한 스케줄 2건·워크스페이스 1건에 대한 명시적 cleanup 없음 — 파일 내 기존 테스트(`A.`~`I.`) 관례와 동일, 새로 도입된 문제 아님(`make e2e-down` 으로 초기화되는 기존 운영 방식) | `schedule-trigger.e2e-spec.ts` `J.` 블록 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션 표면 없음, 시크릿 없음, 인가 경계 유지 — 전부 INFO |
| requirement | NONE | spec-코드-테스트 line-level 일치, 이전 라운드 WARNING 전부 반영 재확인 |
| scope | NONE | 실질 코드 변경 4개 파일에 국한, 무관 수정 없음 |
| side_effect | LOW | DROP-first 재실행 비대칭(문서화된 트레이드오프), e2e cleanup 부재(기존 관례) — 둘 다 INFO |
| maintainability | NONE | 직전 WARNING(테스트 삽입 순서) 해소 확인, 신규 unit 테스트 관례 준수 |
| testing | LOW | WARNING 1건(J. 테스트 격리 단언이 vacuous loop 형태) |
| documentation | NONE | 이전 WARNING 4건 전부 해소 확인, 세션ID 인용은 참고 사항 |
| database | LOW | 인덱스 교체 근거 실측 일치, DROP-first 재실행 비대칭·쓰기비용 벤치마크 부재는 INFO |
| concurrency | NONE | CONCURRENTLY 3-statement 원자성 결여는 이미 해소, Flyway advisory lock 이 다중 인스턴스 레이스 차단 |
| user_guide_sync | NONE | doc-sync-matrix 매칭 0건 |

## 발견 없는 에이전트

없음 — 전 에이전트가 최소 1건 이상의 INFO 또는 그 이상을 기재했다(user_guide_sync 는 "매칭 대상 없음" 자체가 판정 결과).

## 권장 조치사항

1. (WARNING #1) `schedule-trigger.e2e-spec.ts` 의 `J.` 테스트에 `expect(isolated.body.data.length).toBe(0);` 를 추가해 워크스페이스 격리 단언을 저장소 관례(직접 강한 단언)와 일치시키고, 필터가 걸리되 다른 workspace_id 로 새는 회귀 클래스까지 포착하도록 강화한다.
2. (선택, 결함 아님) 향후 유사 append-only 마이그레이션 헤더 작성 시 일시적 리뷰-세션 ID 대신 커밋 SHA/PR 번호를 인용해 영구 기록 성격과 맞춘다.
3. (선택, 결함 아님) 배포 후 partial→non-partial 인덱스 전환에 따른 쓰기 경로 비용을 `pg_stat_user_tables.n_tup_upd`/인덱스 쓰기 지연으로 모니터링한다.
4. `CREATE INDEX CONCURRENTLY` 재실행 안전성 규약화(선례 `V056`/`V106` 대상) 후속은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재돼 있으므로 별도 신규 조치 불요 — 해당 plan 트랙에서 진행.

## 라우터 결정

- `routing=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, user_guide_sync` (10명)
  - **강제 포함(router_safety)**: `database, documentation, maintainability, requirement, scope, security, side_effect, testing` (8명) — forced 전원 결과 확보됨(미이행 없음)
  - **제외**: 아래 표 (4명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(구체적 사유 미제공 — 순수 DB 인덱스 마이그레이션이라 API 응답시간·프론트 렌더링 성능 표면 부재로 추정) |
  | architecture | 라우터 판단(구체적 사유 미제공 — 모듈 경계·레이어링 변경 없음으로 추정) |
  | dependency | 라우터 판단(구체적 사유 미제공 — 패키지/의존성 변경 없음으로 추정) |
  | api_contract | 라우터 판단(구체적 사유 미제공 — controller/DTO 시그니처 변경 없음으로 추정) |
