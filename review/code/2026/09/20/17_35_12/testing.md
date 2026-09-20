# 테스트(Testing) 리뷰 — rotate 동시성 lost-update 수정

대상: `codebase/backend/src/modules/integrations/integrations.service.ts`(`rotate()`),
`codebase/backend/src/modules/integrations/integrations.service.spec.ts`,
`codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts`

## 발견사항

- **[WARNING] 락 안 재읽기 후 재검증(`freshErrors`) 분기가 뮤테이션으로 실증한 커버리지 갭 — 통째로 지워도 141개 unit 테스트 전부 GREEN**
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `rotate()` 안 `if (freshErrors.length) { throw new BadRequestException(...) }` 블록 (해당 파일 1177~1182줄, diff 게이트 기준 동일 위치)
  - 상세: 이 블록은 이번 diff 가 새로 추가한 로직이다 — 연결 테스트가 끝난 뒤 락 안에서 다시 읽은 `fresh` 행 위에 머지한 `committed` 값을 `validateCredentials(fresh.serviceType, fresh.authType, committed)` 로 재검증한다. `git diff` 전/후를 스크래치 디렉터리에 백업해 두고 이 블록 전체를 `void freshErrors;` 로 치환한 뒤 `npx jest src/modules/integrations/integrations.service.spec.ts` 를 돌리니 **141개 테스트 전부 통과**했다(원복 후 재확인 완료, `git status --short` 클린). 즉 이 파일의 어떤 테스트도 락 안 재검증이 실제로 도는지, 그 실패 시 `INTEGRATION_INVALID_CREDENTIALS` 를 던지는지 검증하지 않는다. `동시 rotate (lost update)` describe 블록의 세 테스트는 모두 `stale()`/`committedByOther()` 조합이 구조적으로 유효한 자격증명이라 이 분기를 지나칠 뿐, 애초에 이 분기를 타격할 시나리오가 없다.
  - 제안: `동시 rotate (lost update)` describe 안에 "락 안 재읽은 행의 `serviceType`/`authType` 조합에서 `body.credentials` 머지 결과가 구조 검증에 실패하면 `INTEGRATION_INVALID_CREDENTIALS` 로 거부하고 `update` 를 호출하지 않는다" 는 테스트를 추가한다(예: `fresh` 를 `authType: 'basic'` 으로 두고 `body.credentials` 에 `basic` 검증을 통과 못 하는 값을 넣는 방식). 이 테스트가 있어야 `freshErrors` 분기 삭제·오조건(예: `entity` 대신 `fresh` 를 쓰지 않는 실수) 같은 회귀를 잡는다.

- **[WARNING] 락 안 재읽기의 `workspaceId` 스코핑이 뮤테이션으로 실증한 커버리지 갭**
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `repo.findOne({ where: { id: entity.id, workspaceId }, lock: { mode: 'pessimistic_write' } })` (1148~1151줄)
  - 상세: `where` 절에 `workspaceId` 를 추가한 것은 이번 diff 의 변경분이고(이전 코드는 `id` 만으로 `update` 했다), 다른 워크스페이스의 동일 `id` 충돌을 막는 방어선이다. `where: { id: entity.id, workspaceId }` 를 `where: { id: entity.id }` 로 뮤테이션해도 141개 테스트가 전부 GREEN 이었다(동일한 백업/원복 절차로 확인). `임계 구간은 트랜잭션 + pessimistic_write 락...` 테스트가 `lock` 옵션은 검증하지만 `where` 절의 `workspaceId` 존재는 검증하지 않기 때문이다.
  - 제안: 같은 테스트(또는 별도 테스트)에서 `integrationRepo.findOne.mock.calls[1]?.[0]` 의 `where` 에 `workspaceId` 가 포함되는지 함께 단언한다. `expect(lockedRead).toMatchObject({ where: { id: 'int-1', workspaceId: 'ws-1' }, lock: { mode: 'pessimistic_write' } })` 형태면 두 갭을 한 번에 닫는다.

- **[INFO] "서로 다른 필드를 겹쳐 바꾸는" 최종 조합은 코드·plan·테스트 세 곳 모두에서 일관되게 미검증으로 명시됨 — 재지적 불필요**
  - 위치: `integrations.service.ts` 1143~1145줄 주석, `plan/in-progress/rotate-lost-update.md` §B "남는 것을 정직하게 적는다"
  - 상세: rotate 두 건이 서로 다른 credential 필드를 동시에 바꾸는 조합 자체는 "테스트한 조합"과 "커밋하는 조합"이 갈릴 수 있음을 코드 주석·plan 문서가 스스로 인정하고 받아들인 트레이드오프다(선행 lost-update보다 낫다는 근거도 명시). 이것은 놓친 테스트가 아니라 **의도적으로 유예된 범위**이므로 CRITICAL/WARNING 으로 재지적하지 않는다.

- **[INFO] e2e 락 보유 구간에서 assertion 실패 시 `ROLLBACK` 없이 `locker.end()`로만 종료**
  - 위치: `codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts` — `locker.query('BEGIN')` (80줄) ~ `locker.query('COMMIT')` (122줄) 사이의 `expect(raced.settled).toBe(false)` (113줄)
  - 상세: 이 구간에서 assertion 이 실패하면 `COMMIT` 을 건너뛰고 테스트가 곧바로 실패 처리되며, 락은 `afterAll` 의 `locker.end()` 가 커넥션을 닫을 때 Postgres 가 암묵적으로 롤백해 풀린다. 같은 스위트 내 후속 테스트나 프로세스 생존 동안은 문제가 없으나(대상 행이 이 테스트 전용이라 다른 스위트와 경합하지 않음), `try/finally` 로 명시적 `ROLLBACK`을 두면 실패 시나리오에서의 의도가 더 분명해진다. 차단 사유는 아니다.

- **[INFO] `동시 rotate` 세 테스트 모두 `integrationRepo.update` 호출 인자만 검증 — `manager.getRepository()` 에 전달되는 엔티티 클래스는 미검증**
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts` 1337~1422줄
  - 상세: `beforeEach` 의 `dataSource.transaction` mock 은 `manager.getRepository()` 인자를 무시하고 항상 같은 `integrationRepo` 를 반환한다(주석에 명시된 의도적 단순화, 형제 스펙과 동일 패턴). 실서비스 코드가 `manager.getRepository(Integration)` 대신 다른 엔티티를 넘겨도 이 테스트 스위트는 잡지 못한다. 정적 타입 체크(TypeScript)가 `Integration` 이 아닌 다른 엔티티 타입을 넘기면 이후 필드 접근(`fresh.credentials` 등)에서 컴파일 에러를 내므로 실무 위험은 낮다 — 참고로만 남긴다.

## 요약

핵심 lost-update 수정(락 안 재읽기 위에 머지)은 세 테스트(필드 보존·락/순서·권한 재확인)가 각각 서로 다른 조작으로 구분되는 방식으로 잘 설계되어 있고, 뮤테이션 검증으로 세 테스트의 판별력을 직접 확인했다(옛 `entity.credentials` 위에 머지하도록 되돌리면 `key_name` 단언이 깨지는 방향은 diff 주석·plan 체크리스트에 "각 뮤턴트가 각각 한 테스트만 죽였다"고 이미 실증되어 있다). e2e(`integration-rotate-concurrency.e2e-spec.ts`)는 실제 DB 행 락으로 겹침을 강제하고 공허성 가드까지 갖춘 견고한 설계다. 다만 이번 diff 가 새로 추가한 두 안전장치 — 락 안 재읽기 후 자격증명 재검증(`freshErrors`)과 재읽기 `where` 절의 `workspaceId` 스코핑 — 은 실제로 뮤테이션(각각 블록 삭제, `workspaceId` 제거)을 가해도 141개 unit 테스트가 전부 통과해 회귀를 못 잡는 사각지대로 확인됐다. 둘 다 삭제·조건 오타 같은 실수를 잡아낼 최소 테스트가 없다는 점에서 WARNING 이며, 나머지는 이미 문서화된 의도적 유예(INFO)이거나 실무 위험이 낮은 참고 사항이다.

## 위험도

MEDIUM
