# 테스트(Testing) 리뷰 — 트리거 동시 DELETE 감사 중복 수정 (3라운드, fresh)

## 검토 범위와 방법

이 changeset 은 1~2 라운드(`review/code/2026/09/20/22_07_23`, `22_39_21`)에서 testing agent 가
지적한 두 WARNING 을 닫는 커밋들(`931877519`·`4abc730cb`·`ba904cdfe`)과, 그 원인이 된 핵심 구현/테스트
(`triggers.service.ts` `remove()`, `triggers.service.spec.ts`, `trigger-delete-concurrency.e2e-spec.ts`)를
포함한다. 이번 라운드에서는 과거 지적이 **말로만 닫혔는지 실제로 닫혔는지**를 직접 실행·뮤테이션으로
재검증했다(저장소는 `cp` 백업 후 뮤테이션 → 복원, `git checkout`/`restore` 미사용. 작업 종료 시
`git status --short` 로 무변경 확인 완료).

- `npx jest src/modules/triggers/triggers.service.spec.ts -t "remove"` → **12 passed** (신규 2건 포함)
- `npx jest src/modules/triggers/triggers.service.spec.ts` 전체 → **165 passed, 1 skipped**(기존 `it.skip('structural anchor', ...)`, 이 diff 와 무관), RESOLUTION.md 가 claim 한 수치와 일치
- **독립 뮤테이션 재현**: `triggers.service.ts:1092` 의 `where: { id, workspaceId }` 를 `where: { id }` 로
  좁혀(`cp` 백업 후 수정) 같은 `-t "remove"` 를 재실행 → **정확히 신규 테스트 1건만 RED**(`Expected ... workspaceId: "ws-1" ... Received {} `), 나머지 11건은 GREEN. `cp` 로 원복 후 `git status --short` 로 저장소 무변경 확인. `review/code/2026/09/20/22_39_21/RESOLUTION.md` 가 적은 "1 failed, 1 skipped, 164 passed, 166 total"과 형태가 일치한다 — SUMMARY 의 판별력 주장이 실측으로 재확인됐다.

## 발견사항

- **[INFO]** 이전 두 WARNING 은 실제로 닫혔다 — 재검증 완료
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` 게이트 4030-4064(신규 404 테스트, `freshFindOptions.at(-1)` 로 `where: { id, workspaceId }` 단언), 게이트 4127-4156(신규 genuine-실패 `logger.error` 단언 테스트)
  - 상세: (a) `22_39_21` testing WARNING 1 — 락 안 재조회의 `workspaceId` 스코프를 단언하는 테스트가 없었다 — 는 `makeService()` 의 `freshFindOne` 콜백이 호출 인자(`findOptions`)를 받아 `freshFindOptions` 배열에 적재하고, 신규 테스트가 `expect(freshFindOptions.at(-1)).toMatchObject({ where: { id: 'trig-l', workspaceId: 'ws-1' } })` 로 단언하는 방식으로 닫혔다. 위 독립 뮤테이션으로 이 단언이 실제로 그 회귀(다른 workspace 의 동일 id 를 "있다"로 오판하는 authz 누수)를 잡는다는 것을 재확인했다. (b) `22_07_23` testing WARNING 4 — genuine(비-404) 실패 시 `logger.error` 호출 자체를 아무도 단언하지 않았다 — 는 신규 테스트가 `error.mock.calls` 를 검사해 `trig-l`·`이미 끝났으므로`·`반쯤 삭제된 상태` 세 문자열 포함을 단언하는 방식으로 닫혔다.
  - 제안: 조치 불필요 — 확인 목적 기록.

- **[INFO]** e2e lock-key 리터럴 중복도 실제로 해소됨
  - 위치: `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts:8` (`import { triggerConfigLockKey } from '../src/modules/triggers/trigger-config-lock';`)
  - 상세: 1라운드 maintainability WARNING 이 지적한 `lockKey = (id) => \`trigger-config:${id}\`` 리터럴 복제가 제거되고, `trigger-config-lock.ts` 가 export 하는 `triggerConfigLockKey()` 를 그대로 재사용한다(`triggers.service.ts` 자체는 이번 diff 에서 이 함수를 쓰지 않지만 — advisory lock 문자열은 `acquireTriggerConfigLock` 내부에서 같은 prefix 로 생성됨 — 테스트가 별도 진실원을 갖던 위험은 사라졌다). prefix 가 바뀌면 이제 이 e2e 는 컴파일 타임에 같이 갱신되거나, 최소한 단일 지점에서만 갱신하면 된다.
  - 제안: 조치 불필요.

- **[INFO]** (재확인, 신규 아님) 404 분기 단위 테스트는 `releaseExternal`(teardown) 이 여전히 실행됐는지는 단언하지 않는다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:4035-4064`
  - 상세: `2라운드 22_39_21` testing INFO 가 이미 짚은 선택 사항이다 — 이 테스트의 `events` 배열에 `'teardown'` 포함 여부를 단언하면 "패자 쪽도 외부 teardown 은 그대로 실행된다"(스코프 밖으로 문서화된 잔여, `trigger-dup-delete.md` "이 PR 이 하지 않는 것")는 사실이 회귀 가드로 고정된다. 새 결함은 아니고, 이번 라운드에도 여전히 미반영이지만 우선순위는 낮다.
  - 제안: 선택 사항 — `expect(events).toContain('teardown')` 한 줄 추가 고려. 없어도 이번 PR 의 목표(감사 중복 방지)는 완전히 검증됨.

- **[INFO]** `SchedulesService.remove()` 잔여 결함은 이 PR 의 테스트 스코프 밖이며 트래커에 적절히 등재됨
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 개발자 항목("`SchedulesService.remove()` 도 동시 삭제에서 감사 행을 두 번 남길 수 있다")
  - 상세: 트리거·워크플로·워크스페이스 세 자리와 같은 형태의 결함이 `SchedulesService.remove()` 자신의 스케줄 행 삭제에도 남아 있다고 코드 읽기로 확인했으나 재현 e2e 는 아직 없다. 이번 diff 의 테스트가 이 경로를 커버하지 않는 것은 결함이 아니라 명시된 스코프 경계다.
  - 제안: 조치 불필요 — 이미 후속 항목으로 추적 중.

## 회귀·격리·가독성 점검

- **회귀**: 기존 `remove()` 인접 테스트(락 순서 단언, teardown→lock→remove→secret 순서 단언, genuine 실패 시 secret 미삭제 단언 등)는 이번 diff 로 시그니처·mock 구조가 바뀌지 않아 전부 그대로 GREEN(165/166, 1 skip 은 무관 anchor).
- **격리**: 신규 두 테스트 모두 `jest.spyOn(Logger.prototype, 'error').mockImplementation(...)` 를 `try/finally` 로 감싸 `mockRestore()` 하므로 전역 오염이나 순서 의존이 없다 — 파일 내 기존 패턴(게이트 2072 부근)과 일치.
- **Mock 적절성**: `withTransactionMock` 의 `m.findOne` 은 `options.freshFindOne` 이 있으면 그것으로, 없으면 바깥 `repo.findOne` 으로 위임하도록 분리돼 있어(`trigger-transaction-mock.ts:108-114`) "바깥 조회 == 락 안 재조회"로 뭉뚱그려지는 함정이 없다. `freshFindOptions` 캡처도 이 위임 지점(`m.findOne` 콜)에만 걸리므로 다른 호출(`repoMock.findOne` 등)과 섞이지 않는다 — 코드로 확인.
- **가독성**: 두 신규 테스트 모두 JSDoc 블록 주석으로 "왜 이 단언이 필요한가"(어떤 이전 리뷰 라운드의 어떤 WARNING을 닫는지까지)를 명시해 추적성이 높다.

## 요약

`review/code/2026/09/20/22_07_23`·`22_39_21` 두 라운드에서 testing agent 가 낸 WARNING(락 안 재조회의 `workspaceId` 스코프 미검증, genuine 실패 시 `logger.error` 호출 미검증)은 이번 changeset 에서 각각 전용 단위 테스트로 닫혔다. 말뿐인 해소가 아님을 직접 확인했다 — 전체 스위트(165/166 pass)를 재실행했고, `where` 절에서 `workspaceId` 를 제거하는 뮤테이션을 독립적으로 재현해 정확히 그 신규 테스트 1건만 RED 로 떨어짐을 검증했다(뮤테이션 후 `cp` 로 즉시 원복, `git status --short` 무변경 확인). e2e lock-key 리터럴 중복(maintainability WARNING)도 export 된 `triggerConfigLockKey` import 로 교체돼 해소됐다. 남은 항목은 전부 이미 이전 라운드에서 INFO 로 낮춰지고 선택 사항 또는 스코프 외 후속 트래커 항목으로 명시적으로 처리된 것들뿐이며, 새로 도입된 테스트 결함·커버리지 갭·격리 문제는 발견하지 못했다.

## 위험도

NONE
