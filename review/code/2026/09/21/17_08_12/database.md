# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** `recordAudit`/`notifyInvalidated` 가 삭제(`DELETE`)와 한 트랜잭션에 묶여 있지 않다
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` — `remove()` (게이트 426~437, `const { affected } = await this.repo.delete(...)` 이후 `this.notifyInvalidated(id)` → `await this.recordAudit(...)`)
  - 상세: 삭제는 이미 커밋된 뒤 별도로 감사 기록을 호출한다. `recordAudit`(`auditLogsService.record`)이 실패하면 config 는 삭제됐지만 `model_config.delete` 감사 행은 남지 않을 수 있다. 다만 이는 이번 diff 가 새로 만든 위험이 아니라 종전 `repo.remove(config)` 경로에도 이미 있던 순서이고, 같은 파일의 `setDefault()`(게이트 388~396, "트랜잭션 **커밋 뒤**에 기록한다 — 안에서 남기면 롤백 시 일어나지 않은 일이 감사에 남는다" 주석)도 동일한 컨벤션을 명시적으로 채택하고 있다. 형제 7건(#1369~#1374)과 이번 형제(model-config) 리뷰(`review/code/2026/09/21/16_39_52/database.md`)에서 이미 같은 결론(회귀 아님)으로 처리된 항목이며 재확인만 한다.
  - 제안: 조치 불요(기존 설계 범위, 회귀 아님).

- **[관측, 비-결함]** 이번 diff 의 대부분(파일 7~30)은 이전 리뷰 라운드(`review/code/2026/09/21/16_39_52/*`, `review/consistency/2026/09/21/16_16_35/*`)의 산출물 커밋으로, DB 관점에서 검토할 실행 코드가 없다. 실질적 DB 표면은 파일 1~4(CHANGELOG, 서비스 코드, 단위/​e2e 테스트)뿐이다.

## 검증한 내용 (문제 없음으로 확인 — 직접 `Read`/`grep` 로 재확인)

- **동시성 처방**: `findEntity()`(무락 `SELECT`) 뒤 종전 `repo.remove(config)` 는 0행이어도 예외를 던지지 않아 동시 DELETE 두 건이 둘 다 `model_config.delete` 감사를 남겼다(plan 문서 실측: 고치기 전 `[204,204]`, 감사 2건). 수정은 단일 원자적 `DELETE ... WHERE id = $1 AND workspace_id = $2` + `affected` 카운트로 판별을 DB 레이어로 옮겼다 — advisory lock/행 락을 새로 들이지 않고도 원자성을 보장하는 올바른 패턴이다(형제 7건과 동일 클래스). `model-config.service.ts:426-430` 실물 코드로 확인.
- **판정 술어**: `if (affected === 0)`(`model-config.service.ts:428`) 는 **명시 비교** — `!affected` 였다면 드라이버가 `affected: null/undefined` 를 보고하는 경우(=드라이버 미보고)를 "못 지웠음"으로 오판해 정상 삭제를 404 로 뒤집는 회귀가 생긴다. 이를 막는 대조군 단위 테스트(`it.each([[undefined],[null]])`, `model-config.service.spec.ts:1128-1144`)가 실제로 존재함을 grep 으로 확인.
- **인덱스**: `ModelConfig.id` 는 `@PrimaryGeneratedColumn('uuid')`(PK, `model-config.entity.ts:34-35` 실물 확인) — `delete({ id, workspaceId })` 는 PK 인덱스로 단건 삭제된다. `workspaceId` 조건은 성능이 아니라 테넌트 격리(다른 워크스페이스 소유 행의 우발적 삭제 방지) 목적이며 `findEntity`/형제 모듈과 동일한 관례. 누락된 인덱스 없음.
- **N+1**: 이 diff 범위(단건 `remove`)에는 반복문 내 개별 쿼리가 없다.
- **트랜잭션 필요성**: 단일 `DELETE` 문이므로 새 트랜잭션 없이도 원자성이 보장된다 — 트랜잭션을 도입하지 않은 선택이 타당하다.
- **`remove(entity)` → `delete(criteria)` 동작 등가성**: `ModelConfig` 엔티티에 `cascade: true`·`@OneToMany` 가 없음을 엔티티 파일에서 직접 확인(`ManyToOne(Workspace, {onDelete:'CASCADE'})` 뿐이며 이는 `model_config→workspace` 참조 방향이지 반대가 아니다). 저장소 전체에서 remove 계열 ORM 라이프사이클 훅(`@BeforeRemove`/`@AfterRemove`/subscriber)이 없다는 코드 주석 주장과 일치.
- **FK 무결성**: `knowledge_base.rerank_config_id`(`V090__model_config_absorb_rerank.sql:22`) · `knowledge_base.embedding_model_config_id`(`V091__kb_embedding_model_config.sql:23`) 둘 다 `ON DELETE SET NULL` 로 정의돼 있음을 마이그레이션 파일 원문으로 직접 확인. DB 레벨 액션이므로 `.remove()`/`.delete()` 어느 쪽으로 삭제해도 동일하게 발화 — 참조 무결성 이상 없음.
- **마이그레이션 안전성**: 이번 diff 에 스키마 변경 없음(해당 없음).
- **SQL 인젝션**: `this.repo.delete({ id, workspaceId })` 는 TypeORM Repository API 로 파라미터화된다. 신규 e2e 의 raw `pg.Client` 쿼리(`'SELECT id FROM model_config WHERE id = $1 FOR UPDATE', [id]`, 감사 카운트 쿼리)도 전부 `$1` 파라미터 바인딩. 인젝션 위험 없음.
- **커넥션 관리**: 신규 e2e 스펙(`model-config-delete-concurrency.e2e-spec.ts`)은 락 보유용 `locker` 커넥션을 `beforeAll`에서 열고 `afterAll`에서 `db`/`locker` 모두 `.end()` 로 명시 해제한다. `finally` 블록에서 `ROLLBACK` 을 항상 시도(`.catch(() => undefined)`)해 락 보유 트랜잭션을 확실히 닫는다 — 커넥션·락 누수 없음.
- **대량 데이터**: 단건 삭제 경로라 페이지네이션/대용량 스캔과 무관.

## 참고

- 이 진단은 동일 코드에 대한 직전 라운드(`review/code/2026/09/21/16_39_52/database.md`)의 결론과 일치한다. 그 라운드의 SUMMARY 는 이 항목(감사 비-트랜잭션)을 "회귀 아님, 조치 불요"로 이미 판정했고 RESOLUTION 도 이를 무조치로 남겼다 — 재-flag 대상 아님.
- 본 세션은 저장소 트리에 어떤 파일도 쓰거나 고치지 않았다(`git status --short` 확인, 유일한 항목은 이 리뷰 세션 자신의 출력 디렉터리).

## 요약

`ModelConfigService.remove()` 를 무락 `findEntity → repo.remove(entity)` 조합에서 단일 원자적 `repo.delete({id, workspaceId})` + `affected === 0` 명시 비교로 전환한 수정으로, 동시 DELETE 두 건이 `model_config.delete` 감사 로그를 중복 기록하던 레이스 컨디션을 해소한다. PK 기반 삭제라 인덱스 문제가 없고, 새 트랜잭션 없이도 단일 DML 문으로 원자성을 확보한 설계가 타당하며, `affected` 의 `0` 대 `null/undefined` 구분을 명시 비교로 처리해 드라이버 미보고 케이스의 오판(정상 삭제를 404로 뒤집는 회귀)을 방지한다. FK(`ON DELETE SET NULL`, V090/V091 마이그레이션 원문으로 직접 확인)·ORM 라이프사이클 훅 부재·PK 정의를 실물 코드로 재검증해 "`remove`→`delete` 전환이 동작을 바꾸지 않는다"는 주석의 주장이 사실임을 확인했다. 신규 e2e 테스트는 실제 행 락(`SELECT ... FOR UPDATE`)으로 겹침을 재현하고 파라미터화된 쿼리·명시적 커넥션 해제를 사용한다. 유일한 참고 사항은 삭제와 감사 기록이 한 트랜잭션에 묶여 있지 않다는 것인데, 이는 이 코드베이스 전반의 기존 컨벤션(예: `setDefault()`)이며 이번 fix 가 만든 회귀가 아니므로 조치를 요구하지 않는다. 이번 diff 의 나머지 파일(5~30번)은 대부분 plan·이전 리뷰 라운드 산출물이라 DB 관점의 실행 코드 표면이 없다.

## 위험도
LOW
