# 테스트(Testing) 리뷰 — trigger-config-lost-update (schedules cascade 락 추가분)

## 검토 범위

이 PR 은 이미 12+ 라운드의 `/ai-review` 를 거쳤고, 직전 라운드(`review/code/2026/09/15/00_38_16`)는
Critical 0 · Warning 4 로 종결됐다. 최신 커밋 `2a87eb2f0`(“삭제 경로는 둘이었다 — 스케줄
cascade 도 같은 config 락을 잡는다”)이 그 W1 을 닫은 실제 diff 이므로, 이번 라운드는 **그
커밋이 건드린 5개 파일**(`CHANGELOG.md`, `schedules.service.ts`, `schedules.service.spec.ts`,
`trigger-transaction-mock.ts`, `trigger-config-lock.ts` JSDoc)에 집중했다. 그 밖의 파일은
직전 라운드(00_38_16)가 이미 전수 확인했고 이번 커밋에서 변경되지 않았다.

`schedules.service.ts`/`.spec.ts`/`trigger-transaction-mock.ts` 를 직접 `Read` 했고,
가설을 확인하려고 **저장소 밖 scratch 사본**(`/private/tmp/.../scratchpad/mutbak/`)에 원본을
백업한 뒤 저장소 파일을 1군데 뮤테이션해 `npx jest schedules.service.spec.ts` 를 돌리고,
`cp` 로 원복 → `git status --short`/`git diff` 로 clean 확인까지 마쳤다(아래 발견사항 참고).

## 발견사항

- **[WARNING]** schedule cascade 삭제의 `acquireTriggerConfigLock` 호출에서 `timeoutMs` 를
  빼는 뮤턴트가 **전건 GREEN** 이다 — sibling(`TriggersService.remove()`)이 같은 라운드에서
  이미 고정한 것과 같은 클래스의 갭이 이 새 코드에 재발했다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:311-313`
    (`acquireTriggerConfigLock(m, triggerId, { timeoutMs: TRIGGER_DELETE_LOCK_TIMEOUT_MS })`)
    — 회귀 테스트는 `codebase/backend/src/modules/schedules/schedules.service.spec.ts:594-609`
    (`'삭제 — trigger 행을 config 락 안에서 지운다'`)
  - 상세: 실제로 `{ timeoutMs: TRIGGER_DELETE_LOCK_TIMEOUT_MS }` 를
    `acquireTriggerConfigLock(m, triggerId)` (옵션 없이)로 치환하고
    `npx jest src/modules/schedules/schedules.service.spec.ts` 를 돌려 확인했다 —
    **25/25 전건 PASS**(뮤턴트 생존). 새 테스트는 `triggerLockKeys`(`onLock` 훅)만 관측하고
    `onLockTimeout` 훅을 provider 설정(`schedules.service.spec.ts:56-64`)에 아예 연결하지
    않는다. 그 결과 이 삭제 경로가 무한 대기(창 1·`update()`·binder 등 다른 경로와 동일하게)로
    조용히 되돌아가도 이 스펙은 이를 감지하지 못한다.
    이는 **같은 PR, 같은 라운드 안에서 이미 고쳐진 결함의 재발**이다 —
    `triggers.service.spec.ts:3899-3920`(`'remove() 도 같은 config 락을 잡는다'`)의 주석이
    정확히 이 클래스를 지목한다: *"존재가 아니라 순서를 단언한다. 종전엔 «락 키가 들어 있다» +
    «remove 가 불렸다» 만 봐서, 둘을 뒤집는 뮤턴트가 그대로 통과했다"* — 그리고 그 테스트는
    `events` 배열에 `"timeout:SET LOCAL lock_timeout = '5000ms'"` 를 **순서까지** 포함해
    고정한다. 새 schedules 테스트는 그 하드닝 패턴을 이식하지 않고 이전의(이미 반증된) “존재만
    본다” 형태로 작성됐다.
    영향은 CHANGELOG 의 "**삭제(`DELETE /api/triggers/:id`)만** 5초 상한을 둔다... 상한을
    넘기면 그 사실을 로그로 남기고 오류로 드러낸다" 는 문장과도 맞물린다 — schedule cascade
    경로는 실제로 같은 5초 상한(`TRIGGER_DELETE_LOCK_TIMEOUT_MS` 공유)을 걸고 있지만, 그
    사실을 지키는 회귀 테스트가 없고, 게다가 `SchedulesService.remove()` 에는
    `TriggersService.remove()` 와 달리 실패 시 `logger.error` 로 "반쯤 삭제된 상태" 를 남기는
    `.catch` 도 없다(`grep -n "logger.error\|\\.catch(" schedules.service.ts` 0건). 타임아웃이
    발생해도 도메인 맥락이 실린 로그 없이 예외가 그대로 전파된다는 점까지 합치면, 관측성
    측면에서 두 삭제 경로가 비대칭이다.
  - 제안: `schedules.service.spec.ts` 의 새 테스트에 `onLockTimeout` 훅을 연결하고,
    `triggers.service.spec.ts:3899-3920` 과 동일하게 **순서 배열**로
    `["timeout:SET LOCAL lock_timeout = '5000ms'", "lock:trigger-config:trig-del", ...]` 형태를
    단언해 이 뮤턴트를 RED 로 잡을 것. 여력이 있으면 `SchedulesService.remove()` 에도
    `TriggersService.remove()` 와 대칭인 `.catch` 로깅을 추가해 관측성 비대칭을 없애는 것을
    고려(이 부분은 차단 사유는 아니고 후속 등재로도 충분).

## 회귀 테스트 확인 (긍정)

- 뮤테이션 검증 뒤 원본을 `cp` 로 정확히 원복했고 `git status --short`/`git diff` 로 저장소가
  clean 함을 확인했다 — 다른 병렬 리뷰어에게 남긴 잔여 상태 없음.
- `trigger-transaction-mock.ts` 에 새로 추가된 `delete` 위임(`m.delete(Trigger, criteria) →
  repo.delete(criteria)`)은 기존 "콜백을 실제로 실행해야 단언이 무의미해지지 않는다" 설계를
  그대로 확장한 것이고, 이 프록시가 없으면 `schedules.service.spec.ts` 의 새 테스트가 런타임
  에러로 죽는다는 점에서 필연적인 변경이다. 이 위임의 존재 자체는 문제 없다 — 갭은 그 위임을
  통해 관측 가능해진 `onLockTimeout` 이벤트를 **아무도 단언하지 않는다**는 데 있다.
- `trigger-transaction-mock.ts` JSDoc 의 "53개 케이스" 실측 문구가 이번 diff 로 stale 해지는지
  확인했다 — 새 `delete` 프록시는 `schedules.service.spec.ts`(scope 밖)에서만 쓰이고
  `src/modules/triggers` 안에는 `m.delete(Trigger, …)` 호출부가 없어(`grep` 0건) 그 카운트
  범위에 영향이 없다. Stale 아님.
- `SchedulesService.remove()` 의 새 테스트는 `triggerRepo.delete` 가 정확한 `triggerId`
  (`'trig-del'`)로 불렸는지를 값까지 단언해, 트리거/스케줄 id 를 뒤바꾸는 뮤턴트는 잡는다.

## 요약

직전 라운드(00_38_16)가 지적한 "삭제 경로가 둘인데 하나만 락을 잡는다"(W1)는 실제로 락 자체는
닫혔지만, 그 락을 지키는 새 테스트가 **같은 PR 이 몇 커밋 전에 이미 반증하고 고친 "존재만
본다" 패턴**(`onLockTimeout` 미관측)을 그대로 재현했다 — 뮤테이션으로 실측 확인(25/25 GREEN).
sibling 구현(`TriggersService.remove()`)은 정확히 이 클래스의 갭을 순서 배열 단언으로 이미
막아 뒀으므로, 그 패턴을 그대로 이식하면 해소된다. 이 외에 이번 커밋(`trigger-config-lock.ts`
JSDoc 정정, `trigger-transaction-mock.ts` 의 `delete` 위임 추가)은 테스트 관점에서 새 갭을
만들지 않았다.

## 위험도

MEDIUM
