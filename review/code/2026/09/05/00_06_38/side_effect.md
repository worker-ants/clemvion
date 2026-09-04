# 부작용(Side Effect) 리뷰

## 검토 범위

`git diff origin/main` 기준 65개 파일 중, 런타임 상태에 실제 부작용을 낼 수 있는 것은 여전히
`codebase/backend/migrations/V110__schedule_workspace_next_run_index.{conf,sql}` (DB 마이그레이션)과
`codebase/backend/test/schedule-trigger.e2e-spec.ts` / `codebase/backend/src/modules/schedules/schedules.service.spec.ts`
(테스트) 뿐이다. 나머지는 `plan/**`·`spec/**`·`review/**` 문서다.

이 changeset 은 이미 세 차례(`23_02_51`→`23_26_09`→`23_47_43`) side_effect 리뷰를 거쳤다.
`git log --oneline a74704c49..HEAD -- codebase/` 로 직접 확인한 결과, **`23_47_43` 라운드의 수정
커밋(`a74704c49`) 이후 `codebase/` 트리는 전혀 바뀌지 않았다** — 그 뒤에 추가된 유일한 커밋
(`703e10dca`)은 `review/code/2026/09/04/23_47_43/**` 문서 산출물만 담고 있다(`git show --stat`
으로 확인, 14 files 전부 `review/` 하위). 즉 이번 라운드(`00_06_38`)에서 재검토할 새 코드
부작용 표면은 없고, 아래는 기존 코드에 대한 독립 재확인이다.

뮤테이션은 수행하지 않았다 — 저장소 밖 실행 없이 정적 분석 + PostgreSQL 문서화된
`CREATE/DROP INDEX CONCURRENTLY` 동작으로 판단했다. `git status --short` 로 이 리뷰 세션이
저장소 파일을 하나도 건드리지 않았음을 확인했다(결과 없음, clean).

## 발견사항

- **[INFO]** (기존 라운드에서 이미 식별·문서화됨, 재확인) DROP-first 인덱스 교체 순서가 **이미
  성공한 마이그레이션의 수동 재실행** 경로에서 살아 있는 인덱스를 재빌드하는 비대칭 부작용을
  코드 수준에서 그대로 안고 있다
  - 위치: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.sql` (헤더의
    "비대칭 하나를 감수한다" 절, `DROP INDEX CONCURRENTLY IF EXISTS idx_schedule_workspace_next_run;`
    로 시작하는 3문 시퀀스)
  - 상세: `0) DROP 새 인덱스 이름(invalid 잔재 정리, 첫 실행엔 no-op) → 1) CREATE 새 인덱스 →
    2) DROP 옛 인덱스` 순서에서, 0) 의 `DROP ... IF EXISTS` 는 대상이 **빌드 실패로 남은 invalid
    인덱스인지 이미 정상 적용된 살아있는 인덱스인지 구분하지 않는다**. Postgres 의 `DO` 블록은
    트랜잭션이라 같은 파일의 `CONCURRENTLY` 문과 공존할 수 없어, `indisvalid` 분기를 SQL 로 넣는
    것은 이 파일 구조상 불가능하다(코드로 없앨 수 없는 제약이라는 기존 판단을 직접 검증). 정상
    Flyway 배포(이 마이그레이션을 정확히 1회만 실행)에서는 발동하지 않지만, 운영자가 이미
    적용된 이 파일을 Flyway 정상 흐름 밖에서 수동 재실행하면 살아 있는 인덱스를 지우고 처음부터
    다시 빌드한다 — 재빌드 구간 동안 `GET /api/schedules` 목록 조회가 이 PR 이 없애려던 seq
    scan 으로 되돌아간다. 헤더 주석에 트레이드오프가 명시돼 있고 세 라운드 전체가 동일하게
    INFO 로 하향한 판정에 동의한다: (1) 정상 배포 경로에서 재현 안 됨, (2) 문서로 명시된 의식적
    선택, (3) 발동해도 재빌드 완료 시 자가 복구.
  - 제안: 조치 불요(이미 반영된 트레이드오프, 규약화는 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 후속 등재 완료).

- **[INFO]** (기존 라운드에서 이미 식별·문서화됨, 재확인) 신규 e2e 테스트(`J.`)가 생성한 스케줄
  2건·워크스페이스 1건에 대한 명시적 cleanup 이 없음 — 파일 전체의 기존 관례와 동일
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` (`it('J. 목록 조회 — …')` 블록의
    `POST /api/schedules` 2회, `createTeamWorkspace(..., uniqueName('SCH-OTHER'))` 호출부)
  - 상세: `afterAll` 은 `db.end()` 만 수행하고, `A.`~`I.` 도 동일하게 생성물을 정리하지 않는다
    (`uniqueName`으로 이름 충돌만 회피). e2e 스택은 세션 종료 시 `make e2e-down`(볼륨 포함
    삭제)으로 초기화되는 것이 이 저장소의 기존 운영 방식이라, 이 diff 가 새로 만든 side-effect
    축이 아니다. `J.` 가 파일의 **마지막** `it` 블록으로 추가돼 있어(같은 파일 내 후속 테스트에
    대한 순서 의존 오염도 없음을 직접 diff 로 확인) 같은 파일 안에서의 상태 누수 위험도 없다.
  - 제안: 조치 불요.

- **[INFO]** 신규 유닛 테스트(`schedules.service.spec.ts`)·스키마 e2e 테스트(`schedule:` 블록)
  는 순수 mock/read-only 라 부작용 표면 없음 — 확인용 기재
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:139-147`,
    `codebase/backend/test/schedule-trigger.e2e-spec.ts` (`it('schema: schedule 인덱스가 …')`)
  - 상세: 유닛 테스트는 `scheduleRepo.createQueryBuilder.mockReturnValue(qb as never)` 로 완전히
    mock 된 쿼리 빌더만 쓴다. `SchedulesService.resolveOrderBy`(`schedules.service.ts:115-124`)의
    화이트리스트에 `next_run_at → s.next_run_at` 매핑이 **이미 이번 diff 이전부터 존재**함을
    직접 열어 확인했다 — 이 PR 은 그 기존 매핑에 대한 커버리지만 추가할 뿐 함수 시그니처·동작을
    바꾸지 않는다. e2e 스키마 테스트는 `pg_index`/`pg_class` 를 읽기만 하는 SELECT 다.

## 확인했으나 위반 없음

- `.conf` 의 `executeInTransaction=false` 스코프는 Flyway 명명 규약(`V110__*.conf` ↔
  `V110__*.sql`)상 이 파일 하나에만 정확히 국한되고, 다른 마이그레이션의 트랜잭션 모드에
  영향을 주지 않는다.
- 마이그레이션 버전 번호(`V110`)·인덱스 이름(`idx_schedule_workspace_next_run`,
  `idx_schedule_next_run`) 충돌 없음을 `codebase/backend/migrations/`, `src/`, `test/` 전수
  grep 으로 직접 재확인했다(V109/V111 인접 파일도 확인).
- 이번 diff 는 `codebase/backend/src/**` 의 함수 시그니처·공개 API·환경 변수 읽기/쓰기·전역
  변수·네트워크 호출·이벤트/콜백을 하나도 변경하지 않는다 — `codebase/` 변경분 전체가
  마이그레이션 2개 + 테스트 파일 2개다.
- 마이그레이션은 순수 DDL(`CREATE`/`DROP INDEX`)이며 데이터(UPDATE/DELETE/INSERT)를 건드리지
  않는다.

## 요약

이번 라운드(`00_06_38`)에서 재검토 대상인 코드는 `23_47_43` 라운드의 수정 커밋(`a74704c49`)
이후 전혀 바뀌지 않았다 — 그 뒤 유일한 커밋은 리뷰 문서 산출물뿐이다. 실제 부작용 표면은
여전히 스케줄 인덱스 교체 마이그레이션(V110) 하나이며, 컨트롤러·서비스 코드는 변경되지 않아
시그니처·인터페이스·환경 변수·네트워크 호출 축의 부작용은 없다. 마이그레이션은 재실행 안전성
(`IF NOT EXISTS`/`IF EXISTS`)을 갖췄고, 유일한 잔여 리스크(DROP-first 의 수동 재실행 비대칭)는
Postgres `DO`+`CONCURRENTLY` 제약상 코드로 없앨 수 없어 문서로 명시하는 쪽을 세 라운드에 걸쳐
의식적으로 택한 것이며 새 결함이 아니다. 신규 e2e 테스트의 cleanup 부재도 파일 전체의 기존
관례 연장이다. Critical·Warning 급 부작용은 발견하지 못했다.

## 위험도

LOW
