# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 외부 provider teardown 중복 호출 잔존 — 이미 3곳에 문서화된 기존 잔여, 재-flag 아님
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1066` (`await this.resourceReleaser.releaseExternal(trigger);`) — 이번 diff 범위 밖의 기존 줄
  - 상세: `remove()`는 advisory lock 취득(`triggers.service.ts:1081` 부근) **이전**, 잠금 없는 `findById` 직후 `releaseExternal(trigger)`를 무조건 실행한다. 동시 DELETE 두 건이 겹치면 chat-channel provider teardown·BullMQ job scheduler 해제·listener unregister 가 두 요청 모두에서 각각 실행돼 provider API 에 대한 중복 외부 호출이 발생한다. 이번 diff 가 추가한 락 안 재조회(`triggers.service.ts:1090-1094`)는 그 뒤의 `m.remove`·`recordAudit`·`releaseSecretsAfterCommit`만 패자 쪽에서 막을 뿐 이미 실행된 teardown 은 되돌리지 못한다. 다만 이 잔여는 이전 두 라운드(`review/code/2026/09/20/22_07_23` side_effect WARNING #1, `22_39_21` side_effect INFO)에서 이미 지적됐고, `RESOLUTION.md`(두 라운드 모두)가 "코드 수정 대상 아님 — best-effort·실패 삼킴이라 500 이나 처리 중단으로 안 이어짐"으로 처분한 뒤 `plan/in-progress/trigger-dup-delete.md`·`CHANGELOG.md`·`plan/in-progress/spec-draft-nullable-notation-followups.md` 세 곳에 명시적으로 등재했다(이번 diff 로 재확인, `spec-draft-nullable-notation-followups.md` 게이트 4583-4589). 신규 e2e(`trigger-delete-concurrency.e2e-spec.ts`)도 chatChannel 없는 webhook 트리거만 써서 이 경로를 의도적으로 피한다.
  - 제안: 조치 불필요 — 이미 일관되게 문서화·트래킹됨. 이번 라운드에서 새 결함으로 다시 올리지 말 것.

- **[INFO]** `.catch` 의 `NotFoundException` passthrough 는 새 코드 경로에만 정확히 스코프됨
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1101` (`if (err instanceof NotFoundException) throw err;`)
  - 상세: 이 분기가 앞서는 `this.logger.error(...)` 를 건너뛰게 만들므로, 트랜잭션 콜백 안에서 `NotFoundException` 을 던질 수 있는 다른 경로가 있으면 그 경로의 "반쯤 삭제된 상태" 경보도 함께 삼켜질 위험이 있다. 확인 결과 콜백 안에서 예외를 던지는 지점은 `acquireTriggerConfigLock`(타임아웃 시 일반 `Error`, `NotFoundException` 아님 — `trigger-config-lock.ts` 확인)과 이번에 추가된 `if (!fresh) this.throwTriggerNotFound()`(`triggers.service.ts:1094`) 둘뿐이라, 이 passthrough 는 정확히 새로 추가된 재조회 실패 경로만 겨냥한다. 기존 genuine 실패 로그 경로를 실수로 침묵시키지 않는다(신규 단위 테스트 `remove() — genuine 삭제 실패는 반쯤 삭제된 상태를 logger.error 로 남긴다` 가 이를 회귀로 고정).
  - 제안: 조치 불필요.

- **[INFO]** `Logger.prototype.error` 스파이(공유 프로토타입 상태) — 두 테스트 모두 `finally` 로 복원
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` 신규 테스트 두 건(게이트 4035-4064, 4135-4156)
  - 상세: `jest.spyOn(Logger.prototype, 'error')`는 프로세스 범위 상태(NestJS 공유 `Logger` 클래스 프로토타입)를 건드리지만, 두 테스트 모두 `try { ... } finally { error.mockRestore(); }` 로 감싸 assertion 실패 시에도 복원이 보장된다. 형제 파일(`workflows.service.spec.ts`)과 동일한 패턴이며 전역 오염 없음.
  - 제안: 조치 불필요.

- **[INFO]** 이번 라운드의 실질 diff(`freshFindOptions` mock 확장)는 테스트 전용 — 프로덕션 코드 변경 없음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` 게이트 3812-3816, 3874, 4053-4055
  - 상세: `git diff origin/main...HEAD --stat -- codebase/` 로 확인한 결과 이번 헤드 커밋(`ba904cdfe`)까지 포함해 `codebase/` 변경은 `triggers.service.spec.ts`(+74/-1)·`triggers.service.ts`(+14)·`trigger-delete-concurrency.e2e-spec.ts`(신규 127줄) 세 파일뿐이고, `triggers.service.ts` 는 직전 라운드에서 이미 리뷰된 내용과 동일하다(추가 변경 없음). 새로 추가된 `const freshFindOptions: unknown[] = []`는 `makeService`/`createBaseProviders` 팩토리 함수 스코프 안에서 매 호출마다 새로 생성돼 테스트 간 공유되는 전역/모듈 상태가 아니며, 목적대로 `where: { id, workspaceId }` 인가 스코프 회귀를 잡는 단언에만 쓰인다.
  - 제안: 조치 불필요.

- **[INFO]** 신규 e2e 의 DB 커넥션·advisory lock·pending promise 정리는 `finally`/`afterAll` 로 보장됨
  - 위치: `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts` 게이트 91-118, 59-62
  - 상세: `locker` 트랜잭션은 `finally` 블록에서 `ROLLBACK.catch(() => undefined)` + `pending?.catch(() => undefined)` 로 성공/실패 양쪽 모두 정리되고(성공 경로에서 이미 `COMMIT` 됐어도 뒤이은 `ROLLBACK` 은 no-op 이라 안전), `db`/`locker` 두 `pg.Client` 는 `afterAll` 에서 `.end()` 로 반드시 해제된다. 이 diff 가 새로 여는 네트워크 자원(HTTP 2건, DB 커넥션 2개)은 모두 같은 `it`/`beforeAll`/`afterAll` 범위 안에서 닫힌다.
  - 제안: 조치 불필요.

- **[INFO]** 공개 API·함수 시그니처 변경 없음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1060` (`remove(id: string, workspaceId: string, userId: string): Promise<void>`)
  - 상세: 파라미터·반환 타입·호출자 계약은 그대로다. `DELETE /api/triggers/:id` 패자 응답이 `204→404` 로 바뀌는 것은 wire-visible 이지만 기존 `RESOURCE_NOT_FOUND` 에러 포맷·기존 `@ApiNotFoundResponse` 문서를 재사용하며, spec `2-trigger-list.md §4.4` 가 이미 그 계약을 명시한 목표 동작이다(API 계약 판단 자체는 `api_contract` 리뷰 소관).
  - 제안: 조치 불필요.

CRITICAL/WARNING 없음. 저장소 파일에 대한 뮤테이션은 수행하지 않았다(`git status --short` 기준 세션이 만든 잔여는 이 리뷰 세션 디렉터리뿐).

## 요약

이번 라운드(`23_04_17`)가 보는 diff 의 실질 프로덕션 코드 변경(`triggers.service.ts` 락 안 재조회 14줄)은 직전 두 라운드(`22_07_23`, `22_39_21`)에서 이미 상세 검토된 것과 동일하며, 함수 시그니처·공개 API 계약·전역 변수·환경 변수를 건드리지 않는다. 이번에 새로 추가된 것은 테스트 전용 변경(`triggers.service.spec.ts` 의 `freshFindOptions` mock 확장 + `workspaceId` 스코프 단언)뿐이라 side-effect 관점에서 새로 도입된 위험은 없다. 유일하게 반복 확인할 가치가 있는 항목은 "advisory lock 취득 전 `releaseExternal` 이 동시 요청 둘 다에서 실행돼 외부 provider 에 대한 중복 네트워크 호출이 남는다"는 것인데, 이는 새 결함이 아니라 이전 라운드에서 지적되고 처분(코드 수정 대신 plan·CHANGELOG·트래커 3곳에 명시적 disclosure)된 기존 잔여임을 재확인했다. `Logger.prototype` 스파이·DB 커넥션 등 테스트가 건드리는 공유 상태는 모두 `finally`/`afterAll` 로 정리돼 격리가 깨지지 않는다.

## 위험도

LOW
