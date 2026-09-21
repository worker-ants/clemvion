# 데이터베이스(Database) 리뷰

## 발견사항

- **[WARNING]** owner 승격 TOCTOU — `removeMember()` 의 owner 보호 가드가 무락 읽기 위에 있어 동시 `transferOwnership()` 과 겹치면 owner 가 지워질 수 있다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:797`(무락 owner 가드) ~ `:822`(원자적 DELETE)
  - 상세: `member.role === 'owner'` 검사(:797)와 `assertAdmin`(:803)이 `:783` 의 무락 `findOne` 결과에 기반한다. 이 읽기와 `:822` 의 `DELETE` 사이에 동시 `transferOwnership()` 이 같은 행을 owner 로 승격시키면, 가드는 이미 통과한 뒤이므로 owner 행이 그대로 삭제된다. 이번 PR 이 도입한 `affected === 0` 판별자는 "0행 삭제=이미 없음"만 구분할 뿐 "owner 로 바뀌어 보호돼야 함"은 구분하지 못한다 — 즉 이 PR 의 원자적 DELETE 자체는 이중 감사 문제를 정확히 닫지만, DB 트랜잭션/락 관점에서 owner invariant 를 보호하는 범위까지 원자화하지는 않는다.
  - 참고: 코드 주석(`:817-821`)과 plan(`plan/in-progress/member-dup-remove.md` §C-2)이 이 창을 재진입 기법으로 **실측 재현**(`status=200, rows_remaining=0`)했고, 의도적으로 별건으로 유예했다(판별자 오염을 이유로). `spec-draft-nullable-notation-followups.md` 에 후보 처방(`delete({..., role: Not('owner')})` + 0-행 시 재조회로 원인 분기)까지 등재돼 있다. 이 PR 이 새로 만든 결함은 아니고 신규 회귀도 아니지만, DB 동시성 정합성 관점에서 여전히 열린 진짜 TOCTOU 창이므로 기록한다.
  - 제안: 이번 PR 의 스코프 밖으로 두는 판단 자체는 타당하다(판별자 재사용 오염 방지 논리가 합리적). 다만 후속 PR 에서 `role: Not('owner')` 조건부 DELETE + 0-행 원인 분기(행 부재 vs owner 승격)를 별도 뮤테이션 테스트와 함께 반드시 닫을 것.

- **[INFO]** 감사 로그 기록이 DELETE 와 같은 트랜잭션에 묶여 있지 않다 (best-effort, 기존 관례와 일치)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:822-837`
  - 상세: `memberRepository.delete()` (:822, autocommit) 성공 후 `auditLogsService.record()` (:833) 를 별도 호출로 실행한다. 감사 기록이 실패해도 DELETE 는 이미 커밋된 상태로 남는다. 다만 이는 이 PR 이 새로 만든 패턴이 아니라 형제 5건(#1369~#1372)과 `leaveWorkspace()`(`:671`, "감사 로그는 트랜잭션 커밋 후 best-effort") 등 모듈 전체에 이미 일관되게 적용된 관례다.
  - 제안: 조치 불요 — 기존 설계 결정(감사=best-effort)과 정합. 트랜잭션으로 묶으려면 모듈 전체 컨벤션을 바꿔야 하므로 이 PR 단독 스코프가 아니다.

- **[INFO]** 원자적 DELETE 판정 자체는 인덱스·동시성 관점에서 적절 — 신규 인덱스 불필요
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:822-825`, 엔티티 `codebase/backend/src/modules/workspaces/entities/workspace-member.entity.ts:16`
  - 상세: `DELETE ... WHERE id = $1 AND workspace_id = $2` 는 `id` 가 `@PrimaryGeneratedColumn('uuid')`(PK, 자동 인덱스)라 단일 행 PK 조회로 처리된다. `workspace_id` 조건은 단순 방어적 필터이고 별도 인덱스가 필요한 스캔 패턴이 아니다. 이 방식은 advisory lock·행 락 없이 DB 의 단일 문장 원자성만으로 동시 삭제 두 건 중 하나만 성공하도록 정확히 가르며, 형제 PR #1372(`IntegrationsService.remove()`)와 동일한 검증된 패턴이다. `affected` 를 `null`/`undefined` 와 `0` 을 구분해 명시 비교하는 것도 올바르다(드라이버 미보고 vs 실제 미삭제 구분).
  - 제안: 없음 — 참고용 확인.

- **[INFO]** e2e 테스트의 DB 커넥션·락 관리는 적절
  - 위치: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts:41-59`(connect/end), `:88-118`, `:167-193`(BEGIN/FOR UPDATE/COMMIT/ROLLBACK)
  - 상세: `locker` 커넥션이 `SELECT id FROM workspace_member WHERE id = $1 FOR UPDATE` 로 단일 행만 잠그고(테이블/범위 락 아님), `finally` 블록에서 항상 `ROLLBACK` 을 시도(`.catch(() => undefined)`)해 실패해도 커넥션이 잠금을 쥔 채 남지 않는다. `afterAll` 에서 `locker.end()`/`db.end()` 로 커넥션을 명시적으로 닫는다. 모든 쿼리가 `$1`/`$2` 파라미터 바인딩을 쓰고 문자열 결합이 없어 SQL 인젝션 위험이 없다.
  - 제안: 없음 — 참고용 확인. (락을 쥔 채 HTTP 요청 두 건이 완료될 때까지 최대 1.5초+ 대기하는 것은 테스트 전용 기법으로만 적절하며, 프로덕션 코드에 이식하면 커넥션 점유 시간 문제가 된다는 점만 유의.)

- **[INFO]** N+1·마이그레이션·대량 데이터 페이지네이션 항목은 해당 없음
  - 상세: 이 diff 는 단일 행 조회/삭제 경로만 바꾸며 반복문 내 쿼리, 스키마 변경, 목록 조회 페이지네이션을 포함하지 않는다.

## 요약

이번 변경(`WorkspacesService.removeMember()` 를 무락 `remove(member)` 에서 원자적 `delete({id, workspaceId})` + `affected===0` 명시 판정으로 교체)은 동시 제거 요청 두 건이 감사 행을 중복 기록하던 결함을 DB 단일 문장 원자성만으로 정확히 닫으며, 형제 PR 5건과 동일한 검증된 패턴이라 인덱스·트랜잭션·SQL 인젝션·커넥션 관리 측면에서 새로운 문제를 만들지 않는다. 다만 owner 보호 가드가 여전히 무락 읽기 위에 있어 동시 `transferOwnership()` 과 겹치면 owner 가 삭제될 수 있는 TOCTOU 창이 실측으로 재확인됐다 — 이번 PR 이 만든 회귀는 아니고 판별자 오염을 이유로 의도적으로 별건 유예했다는 근거도 합리적이지만, DB 동시성 정합성 관점의 실질 결함이므로 후속 PR 에서 반드시 닫아야 한다. 감사 로그가 DELETE 와 분리된 별도 커밋(best-effort)인 점은 기존 모듈 전역 관례와 일치해 이번 PR 단독 이슈가 아니다. e2e 테스트의 커넥션 수명 관리·행 단위 락·파라미터화 쿼리는 모두 적절하다.

## 위험도

LOW
