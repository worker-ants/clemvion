# 부작용(Side Effect) 리뷰

## 검토 범위

`origin/main` 대비 37개 파일. 런타임 부작용 표면을 가진 것은 다음 3개뿐이다:

- `codebase/backend/migrations/V110__schedule_workspace_next_run_index.conf` (신규)
- `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql` (신규 DDL — `schedule` 인덱스 교체)
- `codebase/backend/test/schedule-trigger.e2e-spec.ts` (신규 e2e `it` 2건 추가)

나머지 34개(`plan/**`, `review/**`, `spec/**`)는 문서 편집으로 실행 시 부작용이 없다. 이 diff 는
`review/code/2026/09/04/23_02_51/**` 와 `review/consistency/2026/09/04/{22_34_55,22_43_40}/**` 전 라운드
산출물을 함께 포함하므로, 그 라운드가 이미 낸 side_effect 판정(`23_02_51/side_effect.md`, WARNING)이
**이후 커밋(`dd6549796`)에서 실제로 해소됐는지**를 코드 현재 상태로 재검증하는 것이 이번 라운드의 핵심
작업이다.

뮤테이션은 수행하지 않았다 — `Read`/`Bash`(`git log`, `git status --short`, `git diff origin/main --stat`,
migration 파일 `cat`)만 사용했다. `git status --short` 로 확인한 결과 이 세션은 저장소 파일을 하나도
건드리지 않았다(`review/code/2026/09/04/23_26_09/` 산출물 디렉터리 자체 제외).

## 발견사항

- **[INFO]** (재검증 완료) `23_02_51` W1 — `CREATE INDEX CONCURRENTLY IF NOT EXISTS` INVALID 인덱스
  재실행 위험은 `dd6549796` 로 실제로 닫혔다
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:53-58`
  - 상세: 이전 라운드(`review/code/2026/09/04/23_02_51/side_effect.md`)는 `CREATE INDEX CONCURRENTLY
    IF NOT EXISTS` 가 이름 존재만 보고 `indisvalid` 를 보지 않아, 빌드 실패로 invalid 인덱스가 남은
    채 재실행되면 뒤이은 `DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_next_run` 이 옛 인덱스를
    지워 "쓸 수 있는 인덱스 0개" 상태로 조용히 회귀할 수 있다고 WARNING 판정했다. 현재 파일을 직접
    열어 확인한 결과, `CREATE` 앞에 `DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_workspace_next_run;`
    가 새로 추가되어 있다(L53). 순서는 DROP(신규 이름, 실패 잔재 정리)→CREATE→DROP(구 인덱스) 이고,
    RESOLUTION.md(`review/code/2026/09/04/23_02_51/RESOLUTION.md`)가 이 순서를 UNIQUE 인덱스로 결정적
    실패를 재현해 검증했다고 기록한다. 이 순서라면 정상 첫 실행에서 L53 의 DROP 은 대상이 없어
    no-op 이고, 실패 후 재실행에서만 invalid 잔재를 치우므로 이전 라운드가 지적한 실패 모드는 막힌다.
    e2e `schema:` 테스트(`schedule-trigger.e2e-spec.ts:64-84`)도 `indisvalid=true` 를 실제로 단언해
    회귀를 잡는다. **원 WARNING 은 해소로 재확인**.

- **[WARNING]** 새로 추가된 선(先)-DROP 이 "성공 후 수동 재실행" 경로에서는 오히려 **살아 있는
  인덱스를 지우고 처음부터 다시 빌드**하게 만든다 — 헤더 주석의 "재실행 안전"이 이 경로는
  다루지 않는다
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:32-51`(헤더 설명),
    `:53`(`DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_workspace_next_run;`)
  - 상세: 헤더는 이 DROP 을 "실패 후 재실행" 시나리오로만 설명한다(L42-44, L47 "첫 실행엔 no-op").
    그런데 이 파일이 **정상적으로 완료된 뒤** 다시 실행되는 경로 — Flyway 정상 운영에서는 발생하지
    않지만, `flyway repair` 후 수동 psql 재적용처럼 이 저장소 스스로가 실패 복구 수단으로 문서화해
    둔 경로(`migrations.md`/`README.md` 의 비-트랜잭션 마이그레이션 운영 관행) — 에서는 L53 의 DROP
    이 **지금 정상적으로 서빙 중인 `idx_schedule_workspace_next_run` 을 지운다.** 이어지는 `CREATE
    INDEX CONCURRENTLY IF NOT EXISTS` 는 이름이 비어 있으므로 스킵되지 않고 **처음부터 다시
    빌드**하며, L58 의 옛 인덱스 DROP 은 첫 성공 실행에서 이미 실행됐으므로 no-op 이다. 결과적으로:
    (1) 재빌드가 끝날 때까지 이 마이그레이션이 만들려던 `(workspace_id, next_run_at)` 진입로가
    사라져 목록 쿼리가 다시 seq scan 으로 돌아가는 창이 생기고(이 PR 이 측정한 20배 개선을 그
    구간 동안 잃음), (2) 실제 운영 규모(200,000행보다 훨씬 큰 테이블)에서는 이 빌드가 이 파일이
    막으려 했던 종류의 정지 시간·리소스 비용을 다시 낸다. **수정 전 버전(단순 `CREATE ... IF NOT
    EXISTS` → `DROP` 옛 것)은 이 경로에서 완전한 no-op** 이었다 — 즉 이번 수정은 "실패 후 재실행"
    실패 모드를 닫는 대신 "성공 후 재실행" 을 유휴 재실행에서 강제 재빌드로 바꾸는 새로운 트레이드
    오프를 도입했다. 헤더 주석(L32 `## IF NOT EXISTS 만으로는 재실행이 안전하지 않다`)과 `.conf`
    의 "재실행 안전" 문구는 이 트레이드오프를 언급하지 않는다.
  - 제안: 이번 diff 를 막을 사유는 아니다 — 촉발 조건이 Flyway 정상 흐름 밖(수동 재실행)이고,
    닫힌 실패 모드(invalid 인덱스 영구 잔존)가 더 심각하다. 다만 헤더 주석에 "이 DROP-first 는
    실패 후 재실행만 대상으로 한다 — **이미 성공한 마이그레이션을 수동으로 재실행하면 살아 있는
    인덱스가 재빌드된다**(정상적으로는 발생하지 않음, `flyway repair` 등 수동 개입 시에만)" 한
    줄을 추가하면 다음 사람이 "안전"의 범위를 오독하지 않는다. `spec-draft-nullable-notation-followups.md`
    에 이미 등재된 "CONCURRENTLY 재실행 위험 규약화" 후속 항목(`migrations.md`/`README.md` §5)에
    이 비대칭도 함께 담을 수 있다.

- **[INFO]** 마이그레이션·e2e 외 34개 파일(plan/spec/review 문서)에서 런타임 부작용 없음 — 확인 기록
  - 위치: `plan/in-progress/spec-draft-{nullable-notation-followups,schedule-index}.md`,
    `spec/1-data-model.md`, `spec/data-flow/10-triggers.md`, `review/code/2026/09/04/23_02_51/**`,
    `review/consistency/2026/09/04/{22_34_55,22_43_40}/**`
  - 상세: 전부 서술형 마크다운/JSON 감사 기록이며 실행되는 스크립트·hook·CI 설정·package 스크립트가
    아니다. `git diff origin/main --stat` 로 diff 전체를 확인한 결과 `.claude/**`, `package.json`,
    `Dockerfile`, CI 워크플로 파일은 이 changeset 에 전혀 포함되지 않는다 — 즉 이번 라운드의 "부작용
    표면"은 처음부터 DB 마이그레이션 하나로 좁혀져 있고, 문서 산출물이 그 표면을 넓히지 않는다.
    `spec/1-data-model.md`·`spec/data-flow/10-triggers.md` 는 §3/§2.1 표 서술만 바꾸고 코드 실행
    경로에 영향을 주지 않는다.
  - 제안: 없음 (조치 불요).

- **[INFO]** e2e 신규 테스트는 격리된 신규 리소스만 만들고 공유 상태를 변경하지 않음 — 확인 기록
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:66-84`(schema 테스트, SELECT 전용),
    `:320-378`(J. 목록 조회 테스트)
  - 상세: schema 테스트는 `pg_index`/`pg_class` 를 SELECT 만 하고 DDL/DML 을 수행하지 않는다. `J.`
    테스트는 `uniqueName`/`uniqueEmail` 로 이름이 충돌하지 않는 신규 schedule·workspace 를 만들 뿐,
    같은 파일의 다른 `it` 블록(A~I)이 참조하는 공유 `token`/`workspaceId`/`workflowId` 를 변형하지
    않는다(다른 workspace 생성은 로컬 변수 `otherWs` 로만 쓰고 전역 상태에 대입하지 않음). 병렬 e2e
    실행에서도 상호 오염 위험이 낮다.
  - 제안: 없음 (조치 불요).

## 요약

이번 changeset 의 유일한 실질 부작용 표면은 `V110` 스케줄 인덱스 마이그레이션이다. 직전 라운드
(`23_02_51`)가 WARNING 으로 낸 "`CREATE INDEX CONCURRENTLY IF NOT EXISTS` 가 invalid 인덱스를 못
알아채 재실행 시 인덱스 0개로 회귀할 수 있다" 결함은, 이후 커밋(`dd6549796`)이 CREATE 앞에 같은
이름의 DROP 을 추가하면서 코드 현재 상태 기준으로 **실제로 해소됨을 직접 확인**했다. 다만 그 수정
자체가 새로운 비대칭을 하나 들여왔다 — "실패 후 재실행"은 이제 안전해졌지만, "**성공 후 수동
재실행**"(정상 Flyway 흐름 밖의 운영 개입)에서는 이전엔 완전한 no-op 이었던 것이 이제는 살아 있는
인덱스를 지우고 처음부터 재빌드하는 동작으로 바뀐다 — 이 경로 동안 이 마이그레이션이 만들려던 진입로가
일시적으로 사라진다. 촉발 조건이 좁고(Flyway 정상 운영에서는 발생 불가) 새 실패 모드가 데이터 손실이나
영구적 성능 회귀로 이어지지 않으므로 WARNING 으로 등급을 매기되 blocking 사유로는 보지 않는다. 그 외
함수 시그니처·전역 변수·환경 변수·네트워크 호출·이벤트/콜백 축, 그리고 마이그레이션·e2e 외 34개 문서
파일에서는 부작용을 발견하지 못했다.

## 위험도

LOW
