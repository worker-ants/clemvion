# 부작용(Side Effect) 리뷰

## 검토 범위

`git diff origin/main` 기준 51개 파일 중, 런타임 상태에 실제 부작용을 낼 수 있는 것은
`codebase/backend/migrations/V110__schedule_workspace_next_run_index.{conf,sql}` (신규 DB
마이그레이션)과 `codebase/backend/test/schedule-trigger.e2e-spec.ts` /
`codebase/backend/src/modules/schedules/schedules.service.spec.ts` (테스트 추가) 뿐이다.
나머지 45개 파일은 `plan/**`, `spec/**`, `review/**` 문서이며, 이번 diff 는 어떤
컨트롤러·서비스·API 시그니처도 변경하지 않는다(`git diff origin/main -- codebase/backend/src`
결과, `schedules.service.spec.ts` 외 `src/` 트리 변경 없음 — `findAll` 시그니처·`sort=next_run_at`
지원은 이미 기존 코드에 있었고 이번 PR 은 그 경로에 유닛/e2e 커버리지만 추가한다).

뮤테이션 재현은 수행하지 않았다 — 저장소 밖 실행 없이 PostgreSQL 문서화된
`CREATE/DROP INDEX CONCURRENTLY` 동작과 diff 정적 분석으로 판단했다. `git status --short` 로
이 리뷰 세션이 저장소 파일을 건드리지 않았음을 확인했다(결과 없음, clean).

## 발견사항

- **[INFO]** DROP-first 인덱스 교체 순서가, **이미 성공한 마이그레이션을 Flyway 정상 흐름
  밖에서 수동 재실행**하면 살아 있는 인덱스를 지우고 재빌드하는 부작용을 낸다 — 이미 문서화·
  의도적으로 수용된 트레이드오프
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql:53-60`
    (주석 "**비대칭 하나를 감수한다**" ~ `DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_workspace_next_run;`)
  - 상세: 이 파일은 `0) DROP 새 인덱스 이름 CONCURRENTLY (invalid 잔재 정리) → 1) CREATE 새 인덱스
    → 2) DROP 옛 인덱스`순으로 실행한다. 0) 의 `DROP INDEX CONCURRENTLY IF EXISTS` 는 대상이
    **빌드 실패로 남은 invalid 인덱스인지, 정상 적용되어 살아 있는 인덱스인지 구분하지 않는다**
    (`indisvalid` 분기는 `DO` 블록이 필요한데 `DO` 는 트랜잭션이라 같은 파일의 `CONCURRENTLY`
    와 공존 불가 — 코드로 없앨 수 없는 제약). 그 결과: 정상 배포(Flyway 가 이 마이그레이션을
    딱 한 번만 실행)에서는 발동하지 않지만, 운영자가 이미 적용된 이 파일을 수동으로 재실행하면
    (예: `flyway repair` 이후 재적용, 수기 psql 실행 등) 살아 있는 `idx_schedule_workspace_next_run`
    을 지우고 처음부터 다시 만든다 — 재빌드가 끝날 때까지 이 PR 이 최적화한 목록 쿼리
    (`GET /api/schedules`)가 seq scan 으로 되돌아간다. 이 자체는 **의도치 않은 상태 변경**의
    정의에 부합하는 실질 side effect(공유 프로덕션 DB 스키마·쿼리 성능 상태를 외부 트리거
    없이 변경)이지만, 코드가 아니라 **문서로만** 완화돼 있다는 점을 side-effect 관점에서 재확인해
    둔다. 다운그레이드 근거: (1) 헤더 주석(`:53-58`)·`review/code/2026/09/04/23_26_09/RESOLUTION.md`
    양쪽에 트레이드오프 표까지 곁들여 명시적으로 남아 있고, (2) 이미 두 차례 리뷰 라운드
    (`23_02_51` WARNING → `23_26_09` WARNING → 문서화로 해소)를 거쳐 **의식적으로 선택된**
    비대칭이며, (3) Flyway 정상 배포 경로에서는 재현되지 않고, (4) 발동해도 재빌드 완료 시
    자가 복구된다. 이 PR 을 막을 사유는 아니라고 판단해 INFO 로 남긴다 — 다만 다음 사람이
    "완전히 안전하다"로 오독하지 않도록, 이 비대칭이 **코드가 아니라 운영 절차(Flyway 정상
    흐름 준수)에 의존한다**는 점은 기록해 둔다.
  - 제안: 조치 불요(이미 반영된 트레이드오프). 후속으로 이미 등재된
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "CONCURRENTLY 재실행 위험
    — 규약 차원 처리" 항목이 이 비대칭까지 함께 다루기로 돼 있어(`23_26_09` 보류 항목), 그
    규약(런북 `indisvalid` 확인 절차 또는 `migrations/README.md` §5 성문화)이 자리 잡으면
    "수동 재실행" 경로 자체가 절차적으로 차단된다.

- **[INFO]** 신규 e2e 테스트(`J.`)가 생성한 스케줄 2건·워크스페이스 1건에 대한 명시적 정리
  (cleanup)가 없음 — 파일 기존 관례와 동일해 새로 도입된 문제 아님
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` (`it('J. 목록 조회 — …')` 블록,
    `POST /api/schedules` 2회 + `createTeamWorkspace(..., uniqueName('SCH-OTHER'))` 호출부)
  - 상세: 이 `it` 블록은 `POST /api/schedules` 로 스케줄 2건, `createTeamWorkspace` 로 워크스페이스
    1개를 생성하지만 테스트 종료 시 삭제하지 않는다. `afterAll` 은 `db.end()` 만 수행한다.
    다만 같은 파일의 기존 테스트(`A.`~`I.`)도 동일하게 생성물을 정리하지 않는 관례를 이미
    갖고 있고(`uniqueName`/`uniqueEmail` 로 이름 충돌만 회피), e2e 스택은 세션 종료 시
    `make e2e-down`(볼륨 포함 삭제)으로 초기화되는 것이 이 저장소의 기존 운영 방식이다. 즉
    이 diff 가 새로 만든 side effect 축이 아니라 파일 전체의 기존 패턴을 그대로 따른 것이다.
  - 제안: 조치 불요 — 파일 전체를 아우르는 정리 정책 변경은 이 PR 범위 밖.

- **[INFO]** 신규 유닛 테스트(`schedules.service.spec.ts`)는 순수 mock 기반이라 부작용 표면
  없음 — 확인용 기재
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:139-147`
  - 상세: `scheduleRepo.createQueryBuilder.mockReturnValue(qb as never)` 로 완전히 mock 된
    쿼리 빌더만 사용하고 `service.findAll` 의 시그니처·동작을 바꾸지 않는다(기존 `sort`/`order`
    파라미터의 커버리지 추가일 뿐).

## 확인했으나 위반 없음

- `.conf` 의 `executeInTransaction=false` 스코프는 동봉된 `.sql` 파일에만 정확히 국한되고,
  다른 마이그레이션 파일의 트랜잭션 모드에 영향을 주지 않는다.
- 마이그레이션은 순수 DDL(`CREATE`/`DROP INDEX`)이며 데이터(UPDATE/DELETE/INSERT)를 건드리지
  않는다 — 스키마 상태 변경 외 부작용 없음.
- 이번 diff 는 `codebase/backend/src/**` 의 함수 시그니처·공개 API·환경 변수 읽기/쓰기·전역
  변수·네트워크 호출·이벤트/콜백을 하나도 변경하지 않는다(변경분 전체가 마이그레이션 2개 +
  테스트 파일 2개 + 문서 47개).
- `idx_schedule_workspace_next_run`/`idx_schedule_next_run` 이름이 저장소 내 다른 마이그레이션·
  코드와 충돌하지 않음을 grep 으로 직접 확인.

## 요약

이번 changeset 에서 런타임 부작용 표면은 스케줄 인덱스 교체 마이그레이션(V110) 하나뿐이며,
코드(컨트롤러·서비스)는 전혀 변경되지 않아 시그니처·인터페이스·환경 변수·네트워크 호출 축의
부작용은 없다. 마이그레이션 자체는 순수 DDL 이고 재실행 안전성(`IF NOT EXISTS`/`IF EXISTS`)도
갖췄으나, DROP-first 순서가 "이미 성공한 마이그레이션을 Flyway 밖에서 수동 재실행하면 살아
있는 인덱스를 재빌드한다"는 비대칭 side effect 를 여전히 코드 수준에서 안고 있다 — 다만 이는
Postgres 의 `DO`+`CONCURRENTLY` 제약상 코드로 없앨 수 없어 **문서로 명시하는 쪽을 의식적으로
택한 것**이고, 이미 두 차례 리뷰 라운드를 거쳐 트레이드오프 표까지 남긴 상태라 신규 결함이
아닌 INFO 로 남긴다. 신규 e2e 테스트의 정리(cleanup) 부재도 파일 기존 관례의 연장이라 새로
도입된 문제가 아니다. Critical·Warning 급 부작용은 발견하지 못했다.

## 위험도

LOW
