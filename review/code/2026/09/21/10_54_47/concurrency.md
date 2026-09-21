# 동시성(Concurrency) 코드 리뷰

## 발견사항

- **[INFO]** 사용처 검사(`queryUsageNodes`)와 원자적 `DELETE` 사이의 TOCTOU 는 여전히 남아 있다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:775`~`809` (`remove()`)
  - 상세: `remove()` 는 `findOne`(무락) → `queryUsageNodes`(무락, 사용처 0건 확인) → `delete({id, workspaceId})` 순서다. 사용처 검사를 통과한 직후, 다른 요청이 같은 통합을 워크플로 노드에 새로 연결하면 "사용 중인데 삭제됨" 상태가 될 수 있다. 다만 이번 diff 는 이 구간의 순서·락 유무를 바꾸지 않았고 — 종전 `remove(entity)` 코드에도 동일하게 존재했던 무락 구간이다 — 신규 회귀가 아니다. `plan/in-progress/integration-dup-delete.md` §"이 PR 이 하지 않는 것" 이 별개 사안으로 명시적으로 범위 밖에 두고 트래커에 등재해 두었다.
  - 제안: 별도 트래킹된 대로 진행. 이 PR 범위에서 추가 조치 불필요.

- **[INFO]** 원자적 `DELETE` 성공과 감사 로그 기록·`broadcastCredentialChange` 가 하나의 DB 트랜잭션으로 묶여 있지 않다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:800`(`delete`)~`823`(`broadcastCredentialChange`)
  - 상세: `delete()` 가 `affected: 1` 로 성공한 뒤 `auditLogsService.record()` 또는 `broadcastCredentialChange()` 가 예외를 던지면, 행은 이미 삭제됐지만 감사 기록이 남지 않거나 캐시 무효화가 누락될 수 있다. 이는 이번 PR 이 도입한 패턴이 아니라 형제 커밋들(#1369~#1371, `workflows`/`triggers`/`schedules`)과 동일한 기존 구조이므로 이 diff 고유의 회귀는 아니다.
  - 제안: 이 PR 범위에서는 불필요 — 형제 경로 전체에 공통되는 사안이라 별도 트랙(트랜잭션 경계 재검토)이 있다면 그쪽에서 다룰 문제.

- **[INFO]** 감사 `details` 에 쓰이는 `entity.serviceType`/`entity.name` 은 `findOne` 시점의 스냅샷
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:762`(`findOne`), `816`~`819`(`details`)
  - 상세: `delete()` 완료 시점과 `findOne()` 조회 시점 사이에 다른 요청이 같은 통합의 `serviceType`/`name` 을 갱신하면 감사 로그에는 삭제 시점이 아닌 조회 시점 값이 남는다. 영향은 감사 메타데이터에 국한되고, 형제 구현들도 동일 패턴을 쓴다.
  - 제안: 조치 불필요 (관행과 일치, 심각도 낮음).

## 핵심 수정에 대한 평가 (문제 없음, 근거 확인됨)

`remove(entity)` → `delete({id, workspaceId})` + `affected === 0` 판정으로의 전환은 락 없이 경쟁 조건을 올바르게 닫는다:

- PostgreSQL 기본 격리 수준(READ COMMITTED)에서 동일 행을 겨냥한 두 `DELETE` 문은 행 잠금으로 직렬화된다 — 먼저 커밋한 트랜잭션이 행을 지우면, 대기하던 두 번째 `DELETE` 는 커밋 후 재평가되어 대상 행이 없으므로 `affected: 0` 을 돌려준다. 별도 advisory lock·행 락 없이도 "둘 중 하나만 1행 삭제" 를 보장한다는 주석의 주장은 타당하다.
- 판정을 `!affected` 가 아닌 `affected === 0` 명시 비교로 한 것도 옳다 — 드라이버가 `affected` 를 `null`/`undefined` 로 보고하는 경우(미보고)까지 "삭제 실패" 로 오판하지 않는다. 이를 지키는 대조군 테스트(`integrations.service.spec.ts:1097`, `undefined`/`null` 양쪽)가 함께 추가되어 있어 `!affected` 로의 회귀를 방지한다.
- `remove(entity)` → `delete(criteria)` 전환이 cascade 동작을 바꾸지 않는다는 주석 주장도 확인됨 — `Integration` 엔티티(`codebase/backend/src/modules/integrations/entities/integration.entity.ts`)에 `cascade: true` 관계나 `@OneToMany` 가 없음을 grep 으로 직접 확인했다.
- e2e 테스트(`codebase/backend/test/integration-delete-concurrency.e2e-spec.ts`)는 별도 커넥션으로 대상 행을 `SELECT ... FOR UPDATE` 로 잠근 뒤 두 DELETE 요청을 동시에 발사하고, `Promise.race` 로 "락 해제 전 아직 미완료" 를 확인하는 공허성 가드까지 갖춰 겹침을 실제로 검증한다. 두 DELETE 요청이 잠금을 기다리는 동안 서로 다른 락 체인이 생기지 않으므로 데드락 가능성도 없다.
- 단위 테스트 mock(`integrations.service.spec.ts:134`)도 `delete` 로 전환되었고, 진 쪽(`affected: 0`) 케이스가 404 로 감사·broadcast 없이 종료되는 것을 검증한다(`:1078`~`:1087`).

## 요약

`IntegrationsService.remove()` 의 동시 DELETE 이중 감사 결함을 락 없이 단일 원자적 `DELETE` 문의 `affected` 판정으로 해소한 수정으로, PostgreSQL 행 잠금 직렬화에 기댄 근거가 타당하고 형제 PR들이 겪었던 `!affected`/`=== 0` 함정도 대조군 테스트로 방어했다. e2e 는 `FOR UPDATE` 잠금 기법으로 실제 겹침을 만들고 공허성 가드까지 갖춰 판별력이 있다. 사용처 검사와 삭제 사이의 TOCTOU, 삭제-감사-broadcast 트랜잭션 미결합은 남아 있으나 모두 이번 diff 이전부터 존재했고 명시적으로 범위 밖(별도 트래킹)으로 처리되어 있어 이 PR 자체의 회귀는 아니다. 리포지토리 파일은 뮤테이션하지 않았다(`git status --short` 로 확인, 조회만 수행).

## 위험도

LOW
