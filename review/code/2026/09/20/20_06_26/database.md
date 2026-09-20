# 데이터베이스(Database) 리뷰

## 환경 관측 (코드 결함 아님 — 투명성 고지)

리뷰 도중 `git status`에서 `codebase/backend/src/modules/workflows/workflows.service.ts`가 일시적으로 `M`(수정됨)으로 표시되는 것을 관측했다. `git diff` 결과 293번째 줄의 `if (err instanceof NotFoundException) throw err;`가 삭제된 상태였다 — 이 프로젝트의 plan(`plan/in-progress/dup-delete-audit.md`)이 이미 수행했다고 기록한 "404 분기 제거" 뮤턴트와 동일한 형태다. 이 저장소는 병렬 fan-out 리뷰 중이라 다른 세션이 같은 워킹트리에서 뮤테이션 테스트를 재현하는 중이었을 가능성이 높다. 본 리뷰어는 해당 파일을 `Read`만 했고 직접 수정하지 않았다(수정 전 `Read` 시점에는 해당 줄이 존재했다). 재확인 시점에는 이미 원상복구되어 있었다(`grep`으로 293번째 줄 존재 확인). 잔여 이슈는 없으나, 동시 세션 오염 가능성을 기록해 둔다.

## 발견사항

- **[INFO]** `WorkspacesService.deleteWorkspace`의 실패 로그가 "정상적인 동시-삭제 패배자"와 "진짜 반쯤-삭제된 실패"를 구분하지 않는다 — 이 PR이 `WorkflowsService.remove`에는 추가한 구분을 워크스페이스 경로에는 넣지 않았다(의도적 범위 제외).
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:541-550` (해당 `.catch` 블록 자체는 이번 diff의 변경 대상이 아니다 — 이번 diff는 519~527줄의 구조 분해 대입만 건드렸다). 대조: `codebase/backend/src/modules/workflows/workflows.service.ts:289-293`의 새 `if (err instanceof NotFoundException) throw err;` 분기.
  - 상세: `deleteWorkspace`는 `lockParentAndListTriggerIds`가 반환하는 `parent: 'absent'`를 직접 보지 않고, 바로 뒤이은 잠금 재검사 `assertWorkspaceDeletable(..., { mode: 'pessimistic_write' })`가 사라진 워크스페이스를 `NotFoundException`으로 거부하도록 위임한다(plan §B에 "동작 변화 없음"으로 명시된 의도적 설계). 문제는 이 `NotFoundException`(그리고 동시 역할 변경으로 인한 `ForbiddenException`)이 트랜잭션 밖 `.catch` 블록에 그대로 떨어지는데, 그 블록은 예외 종류를 가리지 않고 `WorkspacesService.deleteWorkspace: workspace=${workspaceId} 삭제가 트랜잭션에서 실패했다 — ... 트리거는 발화하지 않을 수 있다(비밀은 남아 있다)`라는 "수동 정리가 필요하다"는 뉘앙스의 error 로그를 남긴다. 두 요청이 겹쳐 워크스페이스 DELETE가 경합하는 정상적인 상황(패배한 쪽)에서도 이 무서운 로그가 매번 찍힌다 — 워크플로 경로에서 정확히 이 거짓 경보를 없애기 위해 `if (err instanceof NotFoundException) throw err;`를 추가한 것과 대비된다. 데이터 정합성 문제는 아니고(트리거 목록은 여전히 이미 반환된 값을 그대로 쓰므로 비밀 정리 자체는 정확하게 스킵된다 — `releaseSecretsAfterCommit`가 `triggerIds`를 받되 트랜잭션이 실패했으므로 이 라인 자체에 도달하지 못하고 함수가 예외로 끝난다), 순수하게 **운영 로그의 신호 대 잡음비** 문제다.
  - 제안: plan이 "동작 변화 없음"으로 명시적으로 범위를 뺀 것은 합당하지만(트랜잭션 원자성·데이터 정합성 자체는 이미 안전), 후속 정리 항목으로 `deleteWorkspace`의 `.catch`에도 `NotFoundException`/`ForbiddenException`(잠금 재검사 실패로 인한 정상적 거부)을 구분해 로그를 스킵하는 대칭 처리를 고려할 만하다. 이번 PR을 막을 사유는 아니다.

## 관점별 점검 결과

1. **인덱스** — 변경된 쿼리는 모두 PK(`Workflow.id`, `Workspace.id`) 또는 이미 FK 인덱스가 붙어 있는 컬럼(`Trigger.workflowId`/`workspaceId`) 기준 조회이고, 이번 PR은 새 쿼리 패턴을 추가하지 않았다(기존 `findOne`/`find` 호출의 반환값 소비 방식만 바뀜). 인덱스 이슈 없음.
2. **N+1** — `lockParentAndListTriggerIds`는 부모 1회 조회 + 트리거 1회 조회, 총 2쿼리로 고정이며 반복문 안에서 개별 쿼리를 실행하지 않는다. 변경 전후로 쿼리 횟수 변화 없음(버려지던 `findOne` 결과를 반환하도록 바꿨을 뿐 추가 쿼리는 없다).
3. **트랜잭션** — 이번 PR의 핵심이 바로 이 축이다. `WorkflowsService.remove`는 `pessimistic_write`로 부모 행을 잠근 뒤 그 결과(`parent: 'present'|'absent'`)를 트랜잭션 내부에서 즉시 분기해 `absent`면 `NotFoundException`을 던져 트랜잭션을 롤백시킨다(감사 로그 미기록, `manager.remove` 미실행) — TypeORM `transaction()` 콜백이 예외를 던지면 자동 ROLLBACK 되므로 원자성이 보장된다. `WorkspacesService.deleteWorkspace`는 같은 헬퍼의 반환값 중 `triggerIds`만 취하고 `parent` 판정은 곧바로 뒤따르는 재잠금 재검사(`assertWorkspaceDeletable`)에 위임하는데, 그 재검사도 같은 트랜잭션 안에서 수행되므로 원자성 자체는 안전하다(위 INFO 항목은 로그 품질 이슈이지 트랜잭션 정합성 이슈가 아니다). e2e 테스트(`workflow-delete-concurrency.e2e-spec.ts`)가 별도 커넥션으로 `SELECT ... FOR UPDATE`를 직접 쥐어 두 DELETE 요청을 실제로 겹치게 만든 뒤 COMMIT으로 동시에 풀어주는 방식은 우연에 의존하지 않는 견고한 결정적 재현 기법이며, "판별력 가드"(락을 풀기 전 `Promise.race`로 두 요청이 아직 끝나지 않았음을 확인)까지 포함해 무의미한 테스트가 될 위험을 스스로 차단한다.
4. **마이그레이션 안전성** — 이번 diff에 스키마 변경(마이그레이션 파일)은 없다. 해당 없음.
5. **스키마 설계** — 테이블 구조 변경 없음. 반환 타입만 `string[]` → `{ parent: 'present'|'absent', triggerIds: string[] }`로 바뀐 애플리케이션 레벨 계약 변경이며, "부재"와 "0개"를 명시적으로 분리한 설계는 이전 truthiness 오판 버그 계열을 막는 합리적 선택이다.
6. **커넥션 관리** — `manager`는 `dataSource.transaction()`/`repository.manager.transaction()`이 제공하는 스코프 내에서만 쓰이고 별도로 얻거나 해제하는 코드가 없어 기존 패턴을 그대로 따른다. e2e 테스트는 `locker`/`db` 두 개의 별도 `pg.Client`를 `beforeAll`에서 열고 `afterAll`에서 `end()`로 해제하며, 테스트 본문도 `try/finally`로 `ROLLBACK`과 pending 실패를 모두 흡수해 커넥션이나 락이 새는 경로가 없다.
7. **SQL 인젝션** — 신규/변경 쿼리는 전부 TypeORM `findOne`/`find`(파라미터 바인딩)이며, e2e 테스트의 원시 SQL(`SELECT id FROM workflow WHERE id = $1 FOR UPDATE`, `SELECT COUNT(*) ... WHERE resource_id = $1 ...`)도 `$1` 플레이스홀더로 파라미터화되어 있다. 문자열 결합으로 사용자 입력을 SQL에 직접 삽입하는 자리는 없다.
8. **대량 데이터** — 이번 변경은 단건 PK/FK 조회이고 목록 페이지네이션이나 대용량 스캔과 무관하다. 해당 없음.

## 요약

이번 변경은 동시 DELETE 두 건이 감사 로그를 중복 기록하던 결함을, 이미 잠그며 읽고 있던 부모 행의 존재 여부를 버리지 않고 호출자에게 명시적으로 돌려주는 방식으로 고친다. 추가 쿼리 없이(기존 `pessimistic_write` 조회 결과를 재사용) 트랜잭션 내부에서 즉시 404로 단락시키는 설계이며, 실제 행 락으로 경합을 결정적으로 재현하는 e2e 테스트까지 갖춰 검증 신뢰도가 높다. 유일하게 짚을 점은 `WorkspacesService.deleteWorkspace`의 기존 `.catch` 로그가 정상적인 동시-삭제 패배(404/403)와 진짜 반쯤-삭제 실패를 구분하지 않아, 워크플로 경로와 비대칭적으로 거짓 경보를 남길 수 있다는 것인데 — 이는 plan이 명시적으로 범위 밖으로 뺀 기존 동작이라 이번 PR을 막을 사유는 아니다(INFO). 인덱스·N+1·마이그레이션·스키마·커넥션·SQL 인젝션·대량 데이터 관점에서는 문제가 발견되지 않았다.

## 위험도

LOW
