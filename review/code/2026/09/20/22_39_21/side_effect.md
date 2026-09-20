# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 같은 레이스에서 파생되는 "외부 provider teardown 중복 호출"은 이번 diff 로도 닫히지 않지만, 이번 라운드에서 **문서화 방식(옵션 a)으로 명시적으로 처분**됐다 — 재-flag 아님, 확인용 기록.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()` — `await this.resourceReleaser.releaseExternal(trigger);` 호출 (advisory lock 취득보다 앞, 이번 diff 범위 밖의 기존 줄). 문서화 지점: `plan/in-progress/trigger-dup-delete.md`(`## 이 PR 이 하지 않는 것` 섹션) · `CHANGELOG.md`(`## Unreleased — 동시 DELETE 두 건이 trigger.deleted 감사 행을 두 번 남기던 것` 항목의 `남는 것` 문단) · `plan/in-progress/spec-draft-nullable-notation-followups.md`(트리거 자원 정리 sweeper 재판단 항목의 새 불릿).
  - 상세: `releaseExternal(trigger)`는 잠금 없는 선조회 직후, advisory lock 취득 **전**에 무조건 실행된다. 동시 DELETE 두 건이 겹치면 chat-channel provider teardown·BullMQ job scheduler 해제·listener unregister 가 두 트리거 요청 모두에서 각각 한 번씩(총 두 번) 실행된다 — 이번 diff 가 추가한 락 안 재조회는 그 뒤의 `m.remove`·`recordAudit`·`releaseSecretsAfterCommit`만 두 번째 요청에서 막는다. 이 사실은 직전 라운드(`review/code/2026/09/20/22_07_23` side_effect WARNING #1 / concurrency INFO)가 이미 짚었고, `RESOLUTION.md` #1 이 "코드 수정 대상 아님 — best-effort·실패 삼킴이라 500 이나 처리 중단으로는 안 이어짐(concurrency 리뷰가 BullMQ·teardownChatChannel 소스로 실측), 대신 plan·트래커에 잔여로 명시"로 처분했음을 diff 로 확인했다. 신규 e2e(`trigger-delete-concurrency.e2e-spec.ts`)도 여전히 chatChannel 없는 webhook 트리거만 써서 이 경로를 커버하지 않는다는 사실을 스스로 독스트링에 적어 둔다.
  - 제안: 조치 불필요 — 이미 세 곳(plan/CHANGELOG/트래커)에 일관되게 등재됐다. 다음 라운드에서 이 항목을 "새 결함"으로 다시 지적하지 말 것(재-flag 방지).

- **[INFO]** `jest.spyOn(Logger.prototype, 'error')` 사용 두 곳 모두 `finally` 에서 `mockRestore()` — 전역 오염 없음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (게이트 4031-4053, 게이트 4126-4145)
  - 상세: `Logger.prototype.error`(NestJS 전역 Logger 클래스의 프로토타입 메서드)를 스파이하는 것은 프로세스 범위의 상태를 건드리는 조작이지만, 두 테스트 모두 `try { ... } finally { error.mockRestore(); }` 로 감싸 assertion 실패 시에도 복원이 보장된다. 형제 파일(`workflows.service.spec.ts:1062`)과 동일한 패턴.
  - 제안: 조치 불필요.

- **[INFO]** `remove()` 시그니처·공개 API 계약 변경 없음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `remove(id, workspaceId, userId): Promise<void>`
  - 상세: 이번 diff 는 함수 내부에 재조회 분기(`m.findOne` → `!fresh` → `throwTriggerNotFound()`)와 `.catch` 의 `NotFoundException` passthrough 한 줄을 추가했을 뿐, 파라미터·반환 타입·호출자 계약은 그대로다. `DELETE /api/triggers/:id` 의 패자 응답이 `204`→`404`로 바뀌는 것은 wire-visible 변경이지만 기존 `RESOURCE_NOT_FOUND` 에러 포맷·`@ApiNotFoundResponse` 문서를 재사용하며 spec §4.4 가 이미 계약으로 명시한 목표 동작이다(API 계약 관점 판단은 api_contract 리뷰 소관 — 여기서는 side-effect 프레임으로만 확인).
  - 제안: 조치 불필요.

- **[INFO]** 신규 e2e 의 DB 커넥션·트랜잭션 정리는 `finally`/`afterAll` 로 보장됨 — 리소스 누수 없음
  - 위치: `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts` (게이트 91-118, 게이트 59-62)
  - 상세: `locker` 트랜잭션은 `finally` 블록에서 `ROLLBACK.catch(() => undefined)` + `pending?.catch(() => undefined)` 로 정상/예외 경로 모두 정리되고, `db`/`locker` 두 `pg.Client` 는 `afterAll` 에서 `.end()` 로 반드시 해제된다. 테스트 실패 시에도 열린 커넥션이 남지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** `review/code/2026/09/20/22_07_23/**`·`review/consistency/2026/09/20/21_43_47/**` 를 새 파일로 커밋 — 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/trigger-dup-delete-3f7a92/...`)가 `_retry_state.json`·`meta.json` 에 영구히 박힌다
  - 위치: `review/code/2026/09/20/22_07_23/_retry_state.json`, `review/code/2026/09/20/22_07_23/meta.json` (다수 게이트, 전 파일 신규 추가)
  - 상세: 이 워크트리가 나중에 삭제되면 이 경로들은 더 이상 유효하지 않은 채로 git history 에 영구 보존된다. 다만 `git log --all -- 'review/code/**/_retry_state.json'` 로 확인한 결과 이는 이 PR 이 새로 만든 관행이 아니라 harness 가 매 리뷰 세션마다 반복해 온 기존 패턴이다(`review/code/2026/08/12`, `2026/08/15` 등 다수 선례). 새로 도입된 부작용이 아니므로 이 diff 에 대한 결함으로 보지 않는다.
  - 제안: 조치 불필요(기존 harness 관행, 이 PR 범위 밖).

CRITICAL/WARNING 없음.

## 요약

핵심 diff(`triggers.service.ts` 의 락 안 재조회 15줄 + `.catch` 분기 1줄, 신규 unit 2건, 신규 e2e 1파일)는 함수 시그니처·공개 API 계약·전역 상태·환경 변수를 변경하지 않고, 새로 도입된 `Logger.prototype` 스파이·DB 커넥션 모두 `finally`/`afterAll` 로 정리돼 부작용 격리가 깨지지 않는다. 직전 라운드(`22_07_23`)의 side_effect WARNING #1(외부 provider teardown 이 advisory lock 밖에서 동시 두 요청 모두에 대해 실행돼 중복 호출된다)은 이번 diff 로 코드가 고쳐지진 않았지만, RESOLUTION 커밋이 plan·CHANGELOG·트래커 세 곳에 그 잔여를 명시적으로 등재해 "닫힌 것처럼 보이는" 위험을 없앴다 — 이는 프로젝트 관행(옵션 a: 코드 수정 대신 명시적 disclosure)에 부합하는 처분이라 재차 WARNING 으로 올리지 않고 INFO 로 확인만 남긴다. `review/code/**`·`review/consistency/**` 산출물이 로컬 워크트리 절대경로를 git history 에 남기는 것도 이 PR 이 새로 만든 패턴이 아니라 기존 harness 관행이다. 새로 도입된 CRITICAL/WARNING 급 부작용은 발견하지 못했다.

## 위험도

LOW
