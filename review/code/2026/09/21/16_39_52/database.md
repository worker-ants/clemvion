# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** `recordAudit` 는 삭제 트랜잭션 밖에서 best-effort 로 실행된다
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:422-437` (`remove()`)
  - 상세: `const { affected } = await this.repo.delete({ id, workspaceId })` 로 원자적 삭제를 커밋한 뒤, `notifyInvalidated(id)` → `recordAudit(...)` 를 별도로 호출한다. 두 단계가 하나의 트랜잭션으로 묶여 있지 않으므로, `recordAudit`(즉 `auditLogsService.record`)이 실패하면 config 는 이미 삭제됐지만 `model_config.delete` 감사 행은 남지 않는 상태가 될 수 있다.
  - 다만 이는 이 diff 가 새로 만든 위험이 아니다 — 종전 `repo.remove(config)` 경로도 동일하게 삭제 후 별도로 `recordAudit` 를 호출했고, 같은 파일의 `create()`/`setDefault()` 도 "커밋 뒤에 기록한다"(롤백된 작업이 감사에 남는 것을 막기 위해)는 동일한 컨벤션을 명시적으로 따른다. 즉 감사 기록을 트랜잭션에 포함하지 않는 것은 이 코드베이스의 일관된 설계 선택이며, 이번 fix 가 그 트레이드오프를 바꾸지 않는다. 회귀는 아니므로 조치 불요, 참고용으로만 기록.

## 검증한 내용 (문제 없음으로 확인)

- **동시성 처방의 정확성**: 종전 `findEntity()`(무락 SELECT) → `repo.remove(config)` 는 check-then-act 레이스였다 — 동시 삭제 두 건이 모두 `findEntity` 를 통과하면 `remove` 가 0행이어도 예외를 던지지 않아 감사 행이 2건 남는 결함이 실측(플랜 문서 기재)으로 확인됐다. 수정은 단일 원자적 `DELETE ... WHERE id = $1 AND workspace_id = $2` 로 판별을 DB 레이어의 `affected` 카운트로 옮겼다 — 별도 advisory lock/행 락 없이도 정합성이 보장되는 올바른 패턴이다(형제 7건과 동일 클래스).
- **`affected` 판정 술어**: `if (affected === 0)` 로 **명시 비교**를 쓴다. `!affected` 로 되돌리면 드라이버가 `affected: null/undefined` 를 보고하는 경우(“보고하지 않음”)를 “못 지웠음”으로 오판해 정상 삭제를 404 로 뒤집는 회귀가 생긴다 — 이를 막는 대조군 단위 테스트(`it.each([[undefined],[null]])`, `model-config.service.spec.ts:1129-1145`)가 실제로 존재한다.
- **인덱스**: `ModelConfig.id` 는 `@PrimaryGeneratedColumn('uuid')`(PK) 이므로 `delete({ id, workspaceId })` 는 PK 인덱스로 단건 삭제된다. `workspaceId` 조건 추가는 성능이 아니라 테넌트 격리(다른 워크스페이스 소유 행의 우발적 삭제 방지) 목적이며 `findEntity`/형제 모듈과 동일한 관례다. 누락된 인덱스 없음.
- **N+1**: 이 diff 범위(단건 `remove`)에는 반복문 내 개별 쿼리가 없다. 같은 파일의 `findManyByIds`(비-diff, 기존 코드)도 `In(ids)` 배치 조회로 N+1 을 이미 회피하고 있다.
- **트랜잭션 필요성**: 단일 `DELETE` 문이므로 명시적 트랜잭션 없이도 원자성이 보장된다 — 트랜잭션을 새로 도입하지 않은 선택이 타당하다.
- **`remove(entity)` → `delete(criteria)` 동작 등가성 실측**: `ModelConfig` 엔티티에 `cascade: true`·`@OneToMany` 가 없음을 엔티티 파일에서 직접 확인했고, 저장소 전체에서 `ModelConfig` 관련 `@OneToMany`/`@BeforeRemove`/`@AfterRemove`/`EventSubscriber` 가 0건임을 grep 으로 재확인했다(코드 코멘트의 주장과 일치). 즉 TypeORM 라이프사이클 훅 차이로 인한 부작용은 없다.
- **FK 무결성**: `knowledge_base.rerank_config_id`(`V090__model_config_absorb_rerank.sql`) · `knowledge_base.embedding_model_config_id`(`V091__kb_embedding_model_config.sql`) 둘 다 `ON DELETE SET NULL` 로 정의돼 있음을 마이그레이션 파일에서 직접 확인했다. DB 레벨 액션이므로 `.remove()`/`.delete()` 어느 쪽으로 삭제하든 동일하게 발화한다 — 참조 무결성 이상 없음.
- **마이그레이션 안전성**: 이번 diff 에 스키마 변경 없음. 해당 없음.
- **SQL 인젝션**: `this.repo.delete({ id, workspaceId })` 는 TypeORM Repository API 로 파라미터화된다. 신규 e2e 테스트의 raw `pg.Client` 쿼리(`'SELECT id FROM model_config WHERE id = $1 FOR UPDATE', [id]`, 감사 카운트 쿼리)도 전부 `$1` 파라미터 바인딩을 쓴다. 인젝션 위험 없음.
- **커넥션 관리**: 신규 e2e 스펙(`model-config-delete-concurrency.e2e-spec.ts`)은 락 보유용 `locker` 커넥션을 `beforeAll`에서 별도로 열고 `afterAll`에서 `db`/`locker` 모두 `.end()` 로 명시 해제한다. `finally` 블록에서 `ROLLBACK` 을 항상 시도(`.catch(() => undefined)`)해 락 보유 트랜잭션을 확실히 닫으므로 커넥션·락 누수 없음.
- **대량 데이터**: 이번 변경은 단건 삭제 경로라 페이지네이션/대용량 스캔과 무관.

## 요약

`ModelConfigService.remove()` 를 무락 `findEntity → repo.remove(entity)` 조합에서 단일 원자적 `repo.delete({id, workspaceId})` + `affected === 0` 판정으로 전환한 fix로, 동시 삭제 두 건이 감사 로그(`model_config.delete`)를 중복 기록하던 레이스 컨디션을 해소한다. PK 기반 삭제라 인덱스 문제 없고, 새 트랜잭션 없이도 단일 DML 문으로 원자성을 확보한 설계가 적절하며, `affected` 의 `0` 대 `null/undefined` 구분을 명시 비교로 처리해 드라이버 미보고 케이스의 오판을 방지한다. FK(`ON DELETE SET NULL`)·ORM 라이프사이클 훅 부재·PK 정의를 직접 확인해 "`remove`→`delete` 전환이 동작을 바꾸지 않는다"는 코드 주석의 주장이 사실임을 검증했다. 신규 e2e 테스트는 실제 행 락(`SELECT ... FOR UPDATE`)으로 겹침을 재현하고 파라미터화된 쿼리·명시적 커넥션 해제를 사용해 DB 관점에서 결함이 없다. 유일하게 적을 만한 점은 삭제와 감사 기록이 한 트랜잭션에 묶여 있지 않다는 것인데, 이는 이 코드베이스 전반(및 종전 코드)의 기존 컨벤션이라 회귀가 아니며 조치를 요구하지 않는다.

## 위험도
LOW
