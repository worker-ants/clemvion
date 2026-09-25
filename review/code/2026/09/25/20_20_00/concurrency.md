# 동시성(Concurrency) 코드 리뷰

## 발견사항

- **[INFO]** `transferOwnership` 의 "락 재검사" 분기를 고정하는 신규 unit 테스트 — TOCTOU 경쟁을 정확히 겨냥
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1149-1185` (신규 `it('인가 선행은 owner 였지만 락 재검사에서 강등이 보이면 OWNER_REQUIRED — 멤버를 바꾸지 않는다', ...)`)
  - 상세: 실제 구현(`codebase/backend/src/modules/workspaces/workspaces.service.ts:723-808`)은 트랜잭션 밖에서 무락으로 `getMemberRole` 선행 인가를 하고(731행), 트랜잭션 안에서 워크스페이스(739-742행) → 요청자 멤버십(756-759행) → 대상 멤버십(772-775행) 순으로 `pessimistic_write` 락을 재취득한 뒤 요청자 role 을 **다시** 검사한다(760-762행). 신규 테스트는 `memberRepo.findOne` mock 을 `opts.lock` 유무로 분기시켜(선행 무락=owner, 재검사 락=admin) 이 재검사 분기가 실제로 `OWNER_REQUIRED` 를 던지고 `memberRepo.save`/`workspaceRepo.save` 가 전혀 호출되지 않음을 확인한다. plan(`plan/in-progress/canary-readme-recheck-test.md`) 체크리스트에 기록된 뮤턴트 검증(재검사가 role 을 안 보도록 죽였더니 이 테스트 하나만 RED)도 이 분기를 지키는 테스트가 이전엔 전무했음을 뒷받침한다. 이중검사 락(check-lock-recheck) 패턴이 올바르게 구현·검증됐다.
  - 제안: 없음 — 정상적인 방어 패턴을 정확한 방식(락 유무로 사전/사후를 구분하는 mock)으로 고정했다.

- **[INFO]** 락 순서 일관성 — `transferOwnership` 도 워크스페이스 → 멤버 순으로, `deleteWorkspace` 와 동일
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:739-775` (워크스페이스 락 → 요청자 멤버 락 → 대상 멤버 락)
  - 상세: 워크스페이스 행 락을 가장 먼저 잡으므로 같은 워크스페이스에 대한 동시 `transferOwnership` 호출은 사실상 직렬화되고(둘째 트랜잭션은 워크스페이스 락에서 대기), 멤버 락 두 개(요청자→대상) 사이의 순서 역전으로 인한 데드락 가능성도 배제된다. 이는 `workspaces.service.spec.ts` 의 기존 `deleteWorkspace` 테스트(“잠금 순서는 워크스페이스 → 멤버십이다 (transferOwnership 과 같아야 교착이 없다)”, 게이트 734-749행)가 전제하는 불변식과 일치한다. 이번 diff 는 이 락 순서 자체를 바꾸지 않았다.
  - 제안: 없음.

- **[INFO]** unit mock 은 코드 경로만 검증 — 실제 DB 레벨 `pessimistic_write` 차단·대기 의미론은 e2e 영역
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1149-1185`
  - 상세: jest mock 은 `findOne` 호출 시 전달된 `lock` 옵션 값만 관찰할 뿐, 실제 PostgreSQL row lock 이 두 번째 트랜잭션을 블로킹하는지는 검증하지 않는다(단위 테스트의 태생적 한계이며 이 프로젝트의 unit/integration/e2e 3계층 방침과 부합). 신규 코드가 아니라 기존 구현을 커버하는 회귀 테스트이므로 결함은 아니다.
  - 제안: 없음 — 실측이 필요하면 e2e 계층에서 동시 이양 시나리오로 보완 가능하나, 이번 작업 범위(README 정정 + unit 커버리지)를 벗어난다.

- **[INFO]** README 변경분(`codebase/backend/README.md:52,57-58`)은 워크스페이스 reflection 캐너리(부팅 시 데코레이터 인식 개수 집계)에 대한 서술 정정으로, 스레드/락/async 동시성 메커니즘과 무관하다.

## 요약

이번 diff 는 프로덕션 동시성 코드를 신규로 추가하지 않았다 — `workspaces.service.ts` 의 `transferOwnership` 이중검사 락(무락 선행 인가 → 트랜잭션 안 `pessimistic_write` 재검사) 구현은 기존 그대로이고, 변경은 (1) 그 재검사 분기가 실제로 강등 경쟁을 막는지 고정하는 신규 unit 테스트 1건과 (2) 무관한 README 문서 정정뿐이다. 신규 테스트는 `lock` 옵션 유무로 선행/재검사를 정확히 구분하는 mock 을 써서 TOCTOU 창을 겨냥했고, 플랜의 뮤테이션 검증(재검사 무력화 시 이 테스트만 RED)으로 유효성도 확인됐다. 락 순서(워크스페이스→멤버)도 `deleteWorkspace` 와 일치해 데드락 위험이 없다. 동시성 관점에서 결함 없음.

## 위험도

NONE
