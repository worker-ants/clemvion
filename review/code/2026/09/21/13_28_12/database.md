# 데이터베이스(Database) 리뷰 — `WorkspacesService.removeMember()` 동시 제거 감사 중복 수정 (follow-up 라운드)

## 발견사항

- **[WARNING]** owner 승격 TOCTOU — `removeMember()` 의 owner 보호 가드가 여전히 무락 읽기 위에 있어, 동시 `transferOwnership()` 과 겹치면 owner 멤버가 삭제될 수 있다 (이번 diff 가 새로 만든 결함 아님, 기존에 실측·등재·유예된 항목의 재확인)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:803`(무락 `findOne`) ~ `:809`(`member.role === 'owner'` 무락 판정) ~ `:834`(원자적 `delete`). 자기-인지 주석은 `:816-833`.
  - 상세: `member.role === 'owner'` 검사(:809)와 `assertAdmin`(:815)이 `:800-802` 의 무락 `findOne` 스냅샷을 근거로 판단한다. 이 읽기와 `:834` 의 `DELETE`(원자적 단일 문장) 사이에 동시 `transferOwnership()` 이 같은 행을 owner 로 승격시키면, `removeMember()` 는 이미 "owner 아님"을 확인한 뒤이므로 재검사 없이 그대로 `DELETE`를 실행해 owner 행을 지운다. 이번 diff 가 도입한 `affected === 0` 판별자는 "행이 사라졌는가"만 구분할 뿐 "owner 로 바뀌었는가"는 구분하지 못하므로, 이 창에서 owner 삭제는 그대로 성공(200)한다. `plan/in-progress/member-dup-remove.md` §C-2 와 `plan/in-progress/spec-draft-nullable-notation-followups.md`(4840~4872행)에 재진입 기법(locker 가 행을 쥔 채 요청을 대기시키고, 락을 놓기 직전 `role='owner'` 로 UPDATE)으로 **실측 재현**됐다(`status=200`, `rows_remaining=0`). 후보 처방(`delete({..., role: Not('owner')})` + 0행 시 재조회로 "행없음 vs owner변경" 원인 분기)까지 이미 문서화돼 있고, `review/code/2026/09/21/12_57_05/RESOLUTION.md` 는 이를 "코드 무수정, 이번 PR 스코프 밖 유지"로 의도적으로 유예했다고 기록한다. 즉 이번 follow-up 라운드(`throwMemberNotFound()` 추출, `getAudit()` 통합, `ADMIN_REQUIRED` 테스트 추가)는 이 창을 전혀 건드리지 않았고, DB 동시성 정합성 관점에서 여전히 열려 있는 실측된 결함이다.
  - 제안: 이번 PR 을 막을 사유는 아니다(판별자 재사용 오염을 피하려는 유예 논리가 타당하고, 트래커·주석에 정직하게 기록돼 있다). 다만 후속 PR 에서 `role: Not('owner')` 조건부 `DELETE` + 0행 시 원인 재조회(행 부재 vs owner 승격) 처방을 별도 뮤테이션 테스트와 함께 반드시 닫을 것.

- **[INFO]** 원자적 `DELETE` + `affected === 0` 명시 비교는 인덱스·동시성 관점에서 적절 — 신규 인덱스 불필요
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:834-838`, 엔티티 `codebase/backend/src/modules/workspaces/entities/workspace-member.entity.ts:16`(`@PrimaryGeneratedColumn('uuid') id`), `:14`(`@Unique(['workspaceId', 'userId'])`)
  - 상세: `DELETE ... WHERE id = $1 AND workspace_id = $2` 는 `id` 가 PK(자동 인덱스)라 단일 행 PK 조회로 처리되고, `workspace_id` 조건은 방어적 필터로 별도 인덱스가 필요한 스캔 패턴이 아니다. advisory lock·행 락 없이 DB 단일 문장의 원자성만으로 동시 삭제 두 건 중 정확히 하나만 성공시키는 방식은 형제 PR #1372(`IntegrationsService.remove()`)와 동일한 검증된 패턴이다. `affected` 를 `null`/`undefined`(드라이버 미보고)와 `0`(실제 미삭제)으로 명시 구분한 것도 올바르다 — 이를 검증하는 대조군 테스트(`it.each([[undefined],[null]])`, `workspaces.service.spec.ts:1524-1537`)가 함께 추가돼 회귀를 구조적으로 막는다.
  - 제안: 없음 — 참고용 확인.

- **[INFO]** 감사 로그 기록이 `DELETE` 와 같은 트랜잭션에 묶여 있지 않다 (best-effort, 기존 모듈 관례와 일치)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:834-845`
  - 상세: `memberRepository.delete()`(:834, autocommit) 성공 후 `auditLogsService.record()`(:840)를 별도 호출로 실행한다. 감사 기록이 실패해도 `DELETE` 는 이미 커밋된 채로 남는다. 이는 이번 diff 가 새로 만든 패턴이 아니라 형제 5건(#1369~#1372)과 `leaveWorkspace()` 등 모듈 전체에 이미 일관되게 적용된 관례다.
  - 제안: 조치 불요 — 기존 설계 결정(감사=best-effort)과 정합. 트랜잭션으로 묶으려면 모듈 전체 컨벤션을 바꿔야 하므로 이 PR 단독 스코프가 아니다.

- **[INFO]** `throwMemberNotFound()` 헬퍼 추출은 DB 동작에 영향 없는 순수 리팩터링
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:342-347`(신규 private 메서드), 호출부 `:310`·`:838`
  - 상세: `if (!member) { throw new NotFoundException({...}) }` 블록과 `if (affected === 0) { throw new NotFoundException({...}) }` 블록이 던지던 동일 리터럴을 `throwMemberNotFound(): never` 로 추출했을 뿐, 쿼리·조건·트랜잭션 경계는 그대로다. `member` 존재 확인 쿼리(`:800-802`, 무락 `findOne`)와 원자적 `DELETE`(:834) 사이의 관계도 변경 전과 동일하다.
  - 제안: 없음 — DB 관점에서 중립적인 변경.

- **[INFO]** e2e 테스트(`member-remove-concurrency.e2e-spec.ts`)의 DB 커넥션·락·파라미터 바인딩은 적절
  - 위치: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts:41-59`(`db`/`locker` connect·end), `:88-118`, `:167-193`(BEGIN/`FOR UPDATE`/COMMIT/ROLLBACK)
  - 상세: `locker` 커넥션이 `SELECT id FROM workspace_member WHERE id = $1 FOR UPDATE`(:91-94, :170-173)로 단일 행만 잠그고(테이블/범위 락 아님), 두 `DELETE` 요청이 그 락 뒤에서 대기하는 동안 `Promise.race`(:101-106, :176-181)로 "1.5초 안에 둘 다 아직 안 끝남"을 먼저 관측(공허성 가드)한 뒤 `COMMIT` 으로 함께 푼다. `finally` 블록에서 `locker.query('ROLLBACK').catch(() => undefined)` 로 항상 정리를 시도해(:115-117, :190-192; `COMMIT` 이 이미 성공한 경우의 뒤이은 `ROLLBACK` 은 "트랜잭션 없음" 상태에서 무해하게 끝난다) 커넥션이 락을 쥔 채 남지 않는다. `afterAll`(:56-59)에서 `locker.end()`/`db.end()` 로 두 커넥션을 명시적으로 닫는다. 모든 쿼리가 `$1`/`$2` 파라미터 바인딩(`db.query('SELECT ... WHERE workspace_id = $1 AND user_id = $2', [workspaceId, invitee.userId])` 등)을 쓰고 문자열 결합이 없어 SQL 인젝션 위험이 없다.
  - 제안: 없음 — 참고용 확인. (행을 락으로 쥔 채 HTTP 요청 완료까지 대기하는 것은 테스트 전용 기법으로만 적절하다.)

- **[INFO]** N+1·마이그레이션·대량 데이터/페이지네이션 관점은 해당 없음
  - 상세: 이번 diff(파일 1~3)는 단일 행 조회/삭제 경로(`findOne` 1회 + `delete` 1회)만 바꾸며, 반복문 내 쿼리, 스키마 변경(마이그레이션), 목록 조회·페이지네이션을 포함하지 않는다. 파일 4~5(`plan/*.md`)와 파일 6 이후(`review/**` 산출물)는 코드가 아니라 계획 문서·이전 리뷰/consistency-check 산출 아티팩트이므로 DB 관점 점검 대상이 아니다.

## 요약

이번 follow-up 라운드의 실질 변경(`throwMemberNotFound()` 헬퍼 추출, `getAudit()` 테스트 헬퍼 통합, `ADMIN_REQUIRED` 거부 테스트 추가)은 모두 DB 동작에 중립적인 리팩터링·테스트 보강이며, 핵심 DB 로직(무락 `remove(member)` → 원자적 `delete({id, workspaceId})` + `affected === 0` 명시 판정)은 직전 라운드에서 이미 검증된 형태 그대로 유지된다. 인덱스(PK 기반 단일 행 삭제)·SQL 인젝션(전부 파라미터 바인딩)·커넥션 관리(e2e 커넥션 명시적 종료, 락 해제 보장)·대량 데이터/N+1/마이그레이션 관점에서 새로운 문제는 없다. 다만 `member.role === 'owner'` 가드가 여전히 무락 스냅샷 위에 있어 동시 `transferOwnership()` 과 겹치면 owner 가 삭제될 수 있는 TOCTOU 창이 실측으로 재확인됐다 — 이는 이번 PR(및 이번 follow-up 라운드)이 새로 만든 회귀가 아니라, 판별자 오염을 이유로 이미 트래커에 등재되고 근거와 함께 의도적으로 유예된 별개 결함이므로 병합을 막을 사유는 아니지만 후속 PR 에서 반드시 닫아야 한다.

## 위험도
LOW
