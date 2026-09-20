# 동시성(Concurrency) 리뷰 — 트리거 동시 DELETE 감사 중복 수정 (3라운드, 23_04_17)

## 검토 방법

`git log --oneline`/`git diff origin/main...HEAD --stat` 로 이번 브랜치 전체 diff(45개 파일, 2553행
추가)를 확인했다. 핵심 production 동시성 코드(`triggers.service.ts` `remove()`)는 커밋 `bb0cfbe3b`
이후 **변경되지 않았다** — 그 커밋은 이미 두 차례(`review/code/2026/09/20/22_07_23`,
`review/code/2026/09/20/22_39_21`) concurrency 리뷰를 통과했고(둘 다 위험도 LOW, Critical 0), 이번
라운드에서 새로 추가된 것은:

1. `195bc38e8` — 2라운드(22_39_21) RESOLUTION 기록 (문서, 코드 아님)
2. `ba904cdfe` — `triggers.service.spec.ts` 에 **테스트만** 추가: 락 안 재조회(`m.findOne`)가
   실제로 `workspaceId` 로 스코프됨을 단언

프로덕션 동시성 로직은 이 라운드에서 손대지 않았으므로, 뮤테이션 재검증은 생략하고(저장소 파일
쓰기/되돌리기 없음, `git status --short` 로 무변경 확인) 다음 두 가지를 직접 열어 확인했다:
(a) `triggers.service.ts` 의 락 순서·재조회 위치가 이전 라운드 분석과 동일한지, (b) 신규 테스트
단언이 실제로 그 값을 관측하는지(vacuous 여부).

## 발견사항

- **[INFO]** 신규 단언은 실제 호출 인자를 관측한다 — vacuous 아님
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (신규 `freshFindOptions`
    캡처, `makeService` 헬퍼 안) 및 `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:108-114`
  - 상세: `withTransactionMock` 의 `manager.findOne` 은
    `jest.fn((_entity, findOptions) => options.freshFindOne ? options.freshFindOne(findOptions) : ...)`
    로 **프로덕션 코드가 실제로 넘긴 `findOptions` 객체**를 그대로 콜백에 전달한다. 신규
    `freshFindOne: (findOptions) => { freshFindOptions.push(findOptions); ... }` 은 그 인자를
    배열에 쌓고, 단언(`expect(freshFindOptions.at(-1)).toMatchObject({ where: { id: 'trig-l',
    workspaceId: 'ws-1' } })`)이 마지막 호출의 `where` 절을 직접 검사한다. 값만 하드코딩된
    고정 mock 이 아니라 실제 인자 경로를 통과하므로, 프로덕션 `where: { id, workspaceId }`
    (`triggers.service.ts` `remove()`, `const fresh = await m.findOne(Trigger, { select: { id:
    true }, where: { id, workspaceId } })`)에서 `workspaceId` 가 빠지면 이 단언이 즉시 깨진다.
    직전 라운드(`22_39_21` RESOLUTION)가 이미 뮤턴트로 실측(해당 필드 제거 → 166건 중 1건만
    RED)해 판별력을 확인해 두었다 — 이번 라운드는 그 결과를 재현하지 않고 배선만 재확인했다.
  - 제안: 없음. 인가 경계(다른 워크스페이스의 동일 id 노출 방지)를 잠금-경합 상황에서도
    회귀로부터 지키는 유효한 회귀 가드다.

- **[INFO]** 이 테스트 추가 자체는 동시성 코드가 아니다 — 단일 스레드 mock 호출 순서 검증뿐
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (신규 `it('remove() —
    락 안에서 행이 사라졌으면...')` 테스트 확장 부분)
  - 상세: 테스트는 Jest 단일 실행 컨텍스트에서 순차 `await` 로만 진행되고, 실제 병렬 요청이나
    타이머 인터리빙을 만들지 않는다(그 역할은 동일 브랜치의 `trigger-delete-concurrency.e2e-spec.ts`
    가 이미 맡고 있고, 이번 라운드에서 변경되지 않았다). 새로 도입된 async/await 오용, deadlock,
    race 는 없다.
  - 제안: 없음.

- **[INFO]** 핵심 동시성 수정(advisory lock 뒤 재조회, `.catch` 의 `NotFoundException` 분리)은
  이번 라운드에서 변경되지 않았고, 이전 두 라운드의 결론이 그대로 유효하다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()` (락 취득 →
    `m.findOne` 재조회 → `!fresh` 시 404 → `m.remove`, 그 뒤 `.catch` 의 `NotFoundException`
    passthrough)
  - 상세: 직접 열어 재확인한 결과 코드는 `review/code/2026/09/20/22_39_21/concurrency.md` 가
    분석한 형태와 동일하다 — advisory lock(`pg_advisory_xact_lock(hashtext('trigger-config:<id>'))`)
    이 두 트랜잭션을 줄 세우고, 락을 먼저 얻어 커밋(행 삭제)한 트랜잭션 뒤에 락을 얻는 두 번째
    트랜잭션의 새 `SELECT`(`m.findOne`)는 READ COMMITTED 하에서 새 스냅샷을 보므로 삭제된 상태를
    정확히 관측한다. `throwTriggerNotFound()` 의 동기적 throw → TypeORM 트랜잭션 콜백 롤백 →
    advisory lock(xact 스코프) 자동 해제 → `.catch` 재던짐 경로도 그대로다.
  - 제안: 없음(재확인 목적).

- **[INFO]** (기존에 이미 등재·추적 중, 이번 라운드가 닫지 않음 — 재기재 목적 아님) 두 잔여 항목이
  여전히 트래커에 열려 있다
  - `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()` 의
    `releaseExternal(trigger)` 호출은 advisory lock **취득 전**, 잠금 없는 `findById` 직후
    무조건 실행돼 동시 DELETE 두 건이 겹치면 provider teardown·listener 해제가 두 번(중복) 일어난다
    — `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 sweeper 항목에 등재됨.
  - `codebase/backend/src/modules/schedules/schedules.service.ts:345` 의
    `this.scheduleRepository.remove(schedule)` 은 advisory lock 도 재조회 가드도 없이 트랜잭션
    밖에서 호출돼 같은 형태(동시 삭제 시 `SCHEDULE_DELETED` 감사 중복 가능)의 결함을 아직 갖고
    있다 — 같은 트래커 파일에 developer 후속 항목으로 신규 등재됨(재현 e2e 아직 없음).
  - 위치: 두 항목 모두 이번 diff 범위 밖(파일 변경 없음).
  - 제안: 트래커 항목대로 별도 세션에서 처리. 이번 라운드의 병합/수렴을 막을 사유 아님.

## 뮤테이션 검증

이번 라운드에서 프로덕션 동시성 코드가 변경되지 않아 새로운 뮤테이션을 만들지 않았다 — 정적 확인
(파일 직접 열람 + mock 배선 추적)만 수행했다. 저장소 파일은 읽기만 했고 아무것도 쓰거나 되돌리지
않았다(`git status --short` 로 무변경 확인, 세션 시작 시점과 종료 시점 동일).

## 요약

이번 라운드(23_04_17)의 실질 변경은 이전 라운드(22_39_21)가 지적한 testing WARNING 1
(락 안 재조회의 `workspaceId` 스코프를 아무도 단언하지 않던 것)에 대한 조치 하나뿐이며, 코드가
아니라 테스트다. 그 단언은 `withTransactionMock` 이 프로덕션이 넘긴 실제 `findOptions` 를 그대로
전달하는 경로를 통해 이뤄져 vacuous 하지 않고, 인가 경계(다른 워크스페이스로의 존재 유출) 회귀를
실제로 잡을 수 있는 형태다. 핵심 동시성 수정(advisory lock 취득 뒤 재조회로 「락 획득 ≠ 행 존재」
간극을 닫은 것) 자체는 이번 라운드에서 손대지 않았고, 이전 두 차례 concurrency 리뷰(LOW, Critical
0)의 결론이 그대로 유효함을 직접 파일을 열어 재확인했다. 새로 도입된 경쟁 조건·데드락·async 오용은
없다. 남아 있는 두 잔여(외부 provider teardown 중복 호출, `SchedulesService.remove()` 의 동형
결함)는 모두 이 diff 범위 밖이고 트래커에 이미 정확히 등재돼 있어 이번 라운드의 새 발견이 아니다.

## 위험도

LOW
