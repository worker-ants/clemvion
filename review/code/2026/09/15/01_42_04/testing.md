# 테스트(Testing) 리뷰 — trigger-config-lost-update (13라운드 처분 반영분)

## 검토 범위

이 PR 은 14+ 라운드의 `/ai-review` 를 거쳤다. 직전 라운드(`review/code/2026/09/15/01_09_53`)가
testing WARNING(schedules 삭제 락의 `timeoutMs` 상한 뮤턴트가 전건 GREEN)을 냈고, 최신 커밋
`6ebc760d1`("형제 경로엔 있고 여기엔 없던 것 — 상한 단언·반쯤 삭제 로깅")가 그 처분 diff다.
이번 라운드는 **그 커밋이 건드린 파일**(`CHANGELOG.md`, `schedules.service.ts`,
`schedules.service.spec.ts`, `trigger-transaction-mock.ts` JSDoc, `plan/in-progress/…`)에
집중했다. 나머지 파일(`trigger-config-lock.ts`/`.spec.ts`, `chat-channel-binder.service.ts`,
`triggers.service.ts`/`.spec.ts`, e2e 스펙, `endpoint-path-conflict-wrap-guard.ts` 정적 가드 등)은
이전 다수 라운드가 이미 파일 단위로 전수 확인했고 이번 커밋에서 변경되지 않았다.

## 검증 절차 (뮤테이션 실측)

`schedules.service.ts`/`.spec.ts` 를 직접 `Read` 했고, 저장소 밖 scratch 사본
(`/private/tmp/.../scratchpad/mutbak/schedules.service.ts.orig`)에 원본을 백업한 뒤, 커밋
메시지가 주장한 뮤턴트(`acquireTriggerConfigLock(m, triggerId, { timeoutMs: … })` →
`acquireTriggerConfigLock(m, triggerId)`, 즉 상한 인자 제거)를 저장소 파일에 직접 적용해
`npx jest src/modules/schedules/schedules.service.spec.ts` 를 돌렸다.

- **뮤테이션 전(원본)**: 26/26 PASS.
- **뮤테이션 후**: `'삭제 — trigger 행을 config 락 안에서 지운다'` 1건만 RED —

  ```
  - "timeout:SET LOCAL lock_timeout = '5000ms'",
    "lock:trigger-config:trig-del",
    "delete:trig-del",
  ```

  나머지 25건은 그대로 PASS. 커밋 메시지의 "46건 중 1 RED"(아마 unit+e2e 합산 카운트)와 결이
  다르지만, 이 파일 단위로는 정확히 **뮤턴트가 죽는다**는 핵심 주장이 재현됐다.
- 뮤테이션 직후 `cp` 로 원복하고 `git status --short`/`git diff --stat` 로 clean 확인.
  잔여 상태 없음.
- 이어서 `npx jest src/modules/schedules src/modules/triggers src/modules/hooks` 전체를
  돌려 460개 중 459 PASS·1 skip(회귀 없음) 확인.

이전 라운드(01_09_53)가 지적한 갭 — "존재만 단언해 `onLockTimeout` 상한 제거 뮤턴트가
살아남는다" — 은 이번 diff 에서 **순서 배열 단언**(`timeout:` → `lock:` → `delete:`)으로
교체되어 실측대로 닫혔다.

## 발견사항

- **[INFO]** 실패 경로 신규 테스트가 `Logger.prototype.error` 를 전역 spy 로 감싼다 — 격리는
  적절히 처리됨
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts` —
    `'삭제 실패는 조용히 지나가지 않는다 — 반쯤 삭제된 상태를 로그로 드러낸다'`
  - 상세: `jest.spyOn(Logger.prototype, 'error')` 는 클래스 프로토타입 전체에 영향을 주는
    넓은 spy 다. 다만 이 테스트는 `try { … } finally { error.mockRestore(); }` 로 감싸 assertion
    실패 여부와 무관하게 항상 원복하도록 짜여 있다 — 테스트 간 spy 누출 위험을 스스로 인지하고
    막은 형태라 문제로 보지 않는다(참고 사항으로만 기록).
  - 제안: 없음(현재 형태로 충분).

- **[INFO]** 상한 값(`'5000ms'`)이 상수 참조 대신 리터럴로 하드코딩됐다 — 다만 형제 테스트와
  동일한 기존 관례
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:627`
    (`"timeout:SET LOCAL lock_timeout = '5000ms'"`)
  - 상세: `TRIGGER_DELETE_LOCK_TIMEOUT_MS`(5_000)를 문자열 보간 없이 그대로 적었다.
    `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3915` 의 형제 단언도 동일한
    리터럴 스타일이라 이 PR 이 새로 도입한 패턴은 아니다. 상수 값이 바뀌면 두 자리를 손으로
    맞춰야 하는 결합이 있지만, 상수 변경 자체가 드물고 실패 시 즉시 드러나는 형태(문자열
    불일치)라 낮은 우선순위.
  - 제안: 여력이 있으면 `` `timeout:SET LOCAL lock_timeout = '${TRIGGER_DELETE_LOCK_TIMEOUT_MS}ms'` `` 로 상수를 참조하도록 두 자리를 함께 정리. 차단 사유 아님.

- **[INFO]** `SchedulesService.remove()` 의 `schedule.triggerId` 가 falsy(연결된 트리거가
  없는 스케줄)인 분기는 이번 PR 로 추가된 세 테스트(성공 삭제·실패 로깅·감사 로깅) 모두에서
  커버되지 않는다 — 단, 이 가드절 자체는 이번 PR 이전부터 있던 코드(`git log -S` 로 확인,
  `ae8f9cfd9` 부터 존재)라 회귀는 아니다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` — `remove()` 의
    `if (schedule.triggerId) { … }` 분기
  - 상세: 세 테스트 모두 `triggerId: 'trig-…'` 로 고정된 스케줄만 사용한다. 이 분기가
    거짓일 때(트리거 없이 만들어진 스케줄) `acquireTriggerConfigLock`/`m.delete` 호출을
    건너뛰고 `scheduleRepository.remove` 로 바로 가는 경로가 unit 테스트로 고정돼 있지 않다.
    이번 PR 의 신규 코드(락·트랜잭션·`.catch` 로깅)는 모두 `if` **안쪽**에만 있어 이 갭이
    새 결함을 감추고 있지는 않지만, "trigger 없는 스케줄 삭제" 라는 코드 경로 자체가 테스트
    스위트 어디에도 없다는 점은 커버리지 갭으로 남는다.
  - 제안: 이번 배치를 막을 사유는 아니다. 여력이 있으면 `triggerId: null` 케이스 1건을
    추가해 "트랜잭션/락을 아예 타지 않는다"를 명시적으로 고정하면 향후 이 조건문을 건드릴
    때 회귀를 잡는다.

## 회귀 테스트 확인 (긍정)

- `'삭제 실패는 조용히 지나가지 않는다'` 테스트는 (a) 예외 전파(`rejects.toThrow`),
  (b) 로그 내용(트리거 id + "반쯤 삭제된 상태" 문구), (c) `scheduleRepository.remove` 미호출,
  (d) `schedule.deleted` 감사 미기록 네 가지를 함께 단언한다 — 부재 단언(remove 미호출) 하나만
  걸었다면 "예외가 나서 아무것도 안 했다"는 통과하지만 그 경로가 실제로 로그를 남기는지는
  검증되지 않았을 것이다. 형태(로그 내용)와 부재(remove/audit)를 함께 거는 설계는
  `hooks.service.spec.ts` 의 `touchLastTriggeredAt` 회귀 테스트("부재 단언과 형태 단언을 함께
  건다")와 같은 원칙을 따른다.
- `triggerLockEvents` 배열은 두 신규/기존 테스트 모두 실행 전 `.length = 0` 으로 리셋한다 —
  테스트 간 격리가 유지된다(실행 순서에 의존하는 오염 없음).
- `withTransactionMock`(`trigger-transaction-mock.ts`)에 새로 추가된 `onLockTimeout` 관측
  고리는 이미 형제 파일(`triggers.service.spec.ts`)이 쓰던 것을 그대로 재사용한 것이라 신규
  mock 설계가 아니다 — 검증된 패턴의 재적용.
- `hooks.service.ts` 의 `touchLastTriggeredAt` 공용 헬퍼(이번 라운드 대상은 아니지만 같은
  diff 안에서 함께 확인)는 두 호출부(`handleWebhook` 일반 경로·chat-channel 인입 경로) 모두
  독립된 회귀 테스트를 갖는다 — 과거 라운드(19_44_08 CRITICAL#2)에서 한쪽만 테스트가 있어
  다른 쪽 되돌림을 놓쳤던 결함이 헬퍼 추출 + 양쪽 테스트로 구조적으로 닫혔다.
- 전체 스위트(`schedules`+`triggers`+`hooks`, 18 suites) 재실행 결과 459 PASS/1 skip, 회귀 없음.

## 요약

직전 라운드가 지적한 유일한 testing WARNING(스케줄 cascade 삭제 락의 `timeoutMs` 상한을
지키는 회귀 테스트 부재)은 형제 구현(`TriggersService.remove()`)이 이미 쓰던 "순서 배열
단언" 패턴을 그대로 이식해 닫혔고, 독립적으로 재현한 뮤테이션 테스트(상한 인자 제거 →
RED)로 그 주장을 확인했다. 같은 커밋이 추가한 "반쯤 삭제 상태" 로깅 회귀 테스트도 부재+형태
단언을 함께 걸어 vacuous 하지 않다. 남은 항목은 모두 INFO 수준(리터럴 하드코딩·
`Logger.prototype` 전역 spy 격리 확인·`triggerId` 없는 스케줄 분기의 사전 존재 커버리지 갭)
이며 이번 배치를 막을 사유가 아니다. 전체 관련 스위트 재실행으로 회귀도 없음을 확인했다.

## 위험도

NONE
