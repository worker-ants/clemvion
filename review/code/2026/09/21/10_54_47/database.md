# Database 리뷰 — integration-dup-delete

## 발견사항

- **[INFO]** `DELETE` 성공 후 감사 로그·broadcast 실패 시 "행은 지워졌는데 감사가 없는" 상태가 남을 수 있음
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:800-823` (`remove()`)
  - 상세: 원자적 `delete({ id, workspaceId })` 로 `affected` 를 판정한 뒤, 트랜잭션 없이 곧바로 `auditLogsService.record(...)` 와 `broadcastCredentialChange(id)` 를 호출한다. 둘 중 하나가 던지면 이미 커밋된 `DELETE` 는 되돌릴 수 없고, 호출자에게는 500 이 전달되어도 리소스는 이미 삭제된 상태가 된다. 다만 이는 이번 diff 가 새로 만든 패턴이 아니라, 같은 결함 클래스를 고친 형제 경로(`triggers.service.ts:1080-1120`, `schedules.service.ts:308-370`)도 동일하게 "삭제(또는 삭제 트랜잭션) 커밋 → 커밋 후 감사/후처리" 순서를 따른다. 즉 기존에 이미 받아들여진 설계이며, 이번 PR 이 새로 도입한 회귀는 아니다.
  - 제안: 조치 불요(형제 구현과 일관). 다만 향후 "삭제+감사 원자성"을 다루는 별도 트래커가 생긴다면 4개 경로(workflows/triggers/schedules/integrations)를 함께 다뤄야 한다.

- **[INFO]** 사용처 검사(`queryUsageNodes`)와 `DELETE` 사이의 TOCTOU
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:775-809`
  - 상세: `usages.length > 0` 검사 통과 뒤 `DELETE` 사이에 다른 요청이 해당 integration 을 노드에 새로 연결하면 "사용 중인데 삭제된" 상태가 될 수 있다. `plan/in-progress/integration-dup-delete.md` §"이 PR 이 하지 않는 것"에 별개 사안으로 명시적으로 스코프 아웃되어 있고, 노드 저장 쪽 가드가 필요한 다른 표면이라 이 PR 범위가 아니다.
  - 제안: 조치 불요(의도된 스코프 경계). 참고로만 기록.

## 점검 관점별 확인 결과

1. **인덱스** — `Integration.id` 는 PK(`@PrimaryGeneratedColumn('uuid')`)이므로 `DELETE ... WHERE id = $1 AND workspace_id = $2` 는 PK 로 단일 행을 특정한 뒤 `workspace_id` 를 추가 필터링한다. `workspace_id` 에 별도 인덱스가 필요하지 않다(이미 PK 로 최대 1행이 좁혀짐). 문제 없음.
2. **N+1** — 반복문 안 개별 쿼리 없음. 단일 `findOne` → 단일 사용처 조회 → 단일 `delete` 시퀀스. 문제 없음.
3. **트랜잭션** — `DELETE ... WHERE id = $1 AND workspace_id = $2` 한 문장은 그 자체로 원자적이라 별도 트랜잭션/락이 필요 없다는 설계 근거가 코드 주석(`integrations.service.ts:784-799`)과 plan 문서에 상세히 기록되어 있고, 형제 네 경로(workflows/workspaces/triggers/schedules, #1368~#1371)의 advisory-lock/row-lock 처방과 대비해 "이 경로엔 외부 부수효과가 없어 락이 불필요하다"는 판단이 타당하다. `Integration` 엔티티에 `cascade: true` 관계·`@OneToMany` 가 없음을 직접 확인했고(엔티티 파일 열람), `@BeforeRemove`/`@AfterRemove`/`EventSubscriber` 도 검색 결과 없어 `remove(entity)` → `delete(criteria)` 전환이 ORM 레벨 부수효과를 스킵하지 않는다는 주장도 확인됨.
4. **마이그레이션 안전성** — 이번 diff 에 스키마 변경 없음. 해당 없음.
5. **스키마 설계** — 변경 없음. `integration_usage_log`(V008)·`integration_oauth_state`/`integration_expiry_alert`(V009) 가 `integration_id ... REFERENCES integration(id) ON DELETE CASCADE` 로 DB 레벨 FK CASCADE 를 갖고 있음을 마이그레이션에서 직접 확인 — ORM 메서드가 `remove()`→`delete()` 로 바뀌어도 raw DELETE 이므로 DB 레벨 CASCADE 는 동일하게 작동한다는 주석 주장이 실측과 일치한다.
6. **커넥션 관리** — e2e 테스트(`integration-delete-concurrency.e2e-spec.ts`)는 앱 풀과 별개인 raw `pg.Client` 두 개(`db`, `locker`)를 만들어 `beforeAll`/`afterAll` 로 명확히 connect/end 하고, `finally` 블록에서 `ROLLBACK` 을 항상 시도한 뒤 `pending` 프라미스도 흡수한다. 커넥션 누수 없음.
7. **SQL 인젝션** — 서비스 코드는 TypeORM `repository.delete({ id, workspaceId })` criteria 객체로 파라미터화됨. e2e 테스트의 raw SQL(`SELECT ... FOR UPDATE`, `SELECT COUNT(*) ... WHERE resource_id = $1`)도 전부 `$1` 플레이스홀더 사용. 문제 없음.
8. **대량 데이터** — 단일 PK 기반 삭제/조회이며 대용량 스캔이나 페이지네이션 대상 쿼리 아님. 해당 없음.

## 검증용 뮤테이션

이번 리뷰에서는 저장소 파일을 수정하지 않았다(읽기 전용 확인만 수행). `git status --short` 결과 미리 존재하던 `review/code/2026/09/21/10_54_47/` 외 변경 없음.

## 요약

`IntegrationsService.remove()` 를 무락 `remove(entity)` 에서 원자적 `delete({ id, workspaceId })` + `affected === 0` 판정으로 바꾼 것은 동시 DELETE 중복 감사 문제를 DB 문장 하나의 원자성만으로 해결하는 적절한 처방이다. PK 기반 삭제라 인덱스 문제가 없고, TypeORM cascade/entity listener 부재 및 DB 레벨 FK CASCADE 존속을 코드·마이그레이션에서 직접 확인해 `remove()`→`delete()` 전환에 따른 부수효과 누락은 없다. 파라미터화된 쿼리만 사용해 SQL 인젝션 우려도 없다. 삭제-감사-broadcast 가 단일 트랜잭션으로 묶이지 않은 점과 사용처검사-삭제 사이 TOCTOU 는 남아있지만, 둘 다 형제 구현과 동일한 기존 패턴이거나 plan 문서에서 의도적으로 스코프 아웃된 사안이라 이번 diff 가 새로 만든 회귀는 아니다. e2e 동시성 테스트는 별도 커넥션으로 행 락을 걸어 겹침을 결정적으로 재현하고 종료 시 안전하게 정리한다.

## 위험도

LOW
