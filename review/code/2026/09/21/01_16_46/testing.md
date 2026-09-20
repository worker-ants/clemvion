# 테스트(Testing) 리뷰 — `schedule-dup-delete-6c81d4` (01_16_46, 4라운드)

## 범위

이번 라운드는 직전 라운드(`review/code/2026/09/21/00_56_52`)의 testing WARNING 1
(`affected === 0` 판정으로 바꾼 **이유** — `null`/`undefined`("모른다")를 `0`("없다")과 다르게
처리한다는 설계 근거 — 를 실행 검증하는 테스트가 없다)을 조치한 커밋(`210808701`)이 대상이다.
실 코드 변경은 `schedules.service.spec.ts` 뿐이고(`schedules.service.ts` 는 이번 커밋에서
미변경), 대조군 테스트 두 건이 추가됐다.

## 독립 검증 (뮤테이션 — 저장소 비오염)

직전 라운드 리뷰어가 "32건 전건 GREEN 으로 생존한다"고 실측한 바로 그 뮤턴트를 이번 라운드
사본에서 다시 넣어 재확인했다 — 저장소 밖 scratch(`/tmp/mut_test_scratch_9bc8ff42`, 작업 종료 후
삭제)에 원본을 `cp` 로 백업 → 저장소 파일을 직접 `sed` 로 수정 → `jest` 실행 → `cp` 로 원복
(`git checkout`/`restore` 미사용, 원복 후 `git status --short` 로 잔여 diff 없음 확인):

```
schedules.service.ts:342,380  if (affected === 0) this.throwScheduleNotFound();
                           →  if (!affected) this.throwScheduleNotFound();
```

결과 — 새로 추가된 두 대조군 테스트만 RED, 나머지 32건은 GREEN:

```
● 삭제 — affected 를 보고하지 않는 드라이버에서는 404 로 뒤집지 않는다 (트리거 경로)
  Received promise rejected instead of resolved
  Rejected to value: [NotFoundException: Schedule not found]

● 삭제 — 같은 대조군 (triggerId 없는 방어 분기)
  Received promise rejected instead of resolved
  Rejected to value: [NotFoundException: Schedule not found]

Tests: 2 failed, 32 passed, 34 total
```

원복 후 `npx jest src/modules/schedules/` 전체 재실행 → 3 suites / 54 tests 전부 GREEN,
`git status --short` 로 저장소에 잔여 변경 없음 확인.

**직전 라운드 testing WARNING 1 은 실측으로 닫혔다.** 자매 함수 `rewriteTriggerConfigLocked`
(`trigger-config-lock.spec.ts:176-185`, `for (const affected of [undefined, null])`)와 정확히
같은 형태로 두 판정 지점(트리거 삭제 경로·`triggerId` 없는 방어 분기) 각각에 대조군이 이식됐고,
그 판별력이 이번 세션에서 독립 재현됐다.

## 신규 테스트 세부 검토

- 두 테스트 모두 `for (const affected of [undefined, null])` 루프 안에서
  `mockResolvedValueOnce({ affected, raw: [] } as unknown as DeleteResult)` 로 가짜
  드라이버 응답을 주입하고, `service.remove(...)` 가 **404 로 뒤집히지 않고 정상 resolve** 하며
  `auditLogs.record` 가 호출됨을 단언한다 — "모른다"(null/undefined)를 "없다"(0)로 읽지
  않는다는 주장을 정확히 겨냥한 대조군 형태다.
- `auditLogs.record.mockClear()`(및 트리거 경로 테스트의 `triggerLockEvents.length = 0`)가
  루프 **안쪽**에 위치해 두 반복(undefined/null) 사이에 mock 호출 카운트가 누적되지 않는다 —
  격리가 정확하다.
- `beforeEach` 가 매 `it()` 마다 새 `Test.createTestingModule` 을 만들므로, 루프 밖 테스트
  간 상태 누수는 없다. 루프 안 두 반복이 실패해도(첫 반복에서 `expect` 가 던지면) 두 번째
  반복은 실행되지 않지만, 이는 자매 함수 테스트와 동일한 기존 스타일이라 이번 diff 가 새로
  들여온 문제는 아니다.
- 타입: `DeleteResult.affected` 의 실제 타입(`number | null | undefined`)에 `null` 을
  직접 대입할 수 없어 `as unknown as DeleteResult` 캐스팅을 쓴 것은 자매 함수 테스트의 방식과
  일관되고, 정상 케이스(`as DeleteResult`, 값 있는 경우)와 캐스팅 강도를 구분해 타입 안전성을
  필요한 만큼만 낮췄다.

## 남은 발견사항 (신규 아님, 재확인)

- **[INFO]** `remove()` 관련 테스트들이 이름이 무관한 `describe('create — timezone fallback
  (§2.2)', ...)` 블록 안에 계속 위치한다 — `00_37_06`·`00_56_52` 에서 이미 INFO 로 지적됐고
  이번 커밋도 그 구조를 그대로 물려받았다(신규 추가 2건도 같은 자리에 얹힘). 실패 메시지
  breadcrumb 가 검증 대상과 무관해 가독성을 떨어뜨리지만 차단 사유는 아니다 — 세 번째
  재확인이므로 후속 정리 시(`describe('SchedulesService.remove', ...)` 분리) 함께 처리 권장.
- **[INFO]** `it('삭제 — 같은 대조군 (triggerId 없는 방어 분기)', ...)` 라는 테스트 이름이
  단독으로는 "무엇의 대조군인가"를 말하지 않는다 — 바로 위 테스트의 JSDoc 을 읽어야 맥락이
  잡힌다. 테스트 실행기 목록(`jest --listTests` 요약, CI 실패 알림 등)에서 이 이름만 보면
  의도 파악이 어렵다. 차단 사유는 아니며, 이름에 "triggerId 없는 방어 분기" 를 반복하는 지금
  형태로도 위치는 특정되므로 기능적 문제는 없다.

## 커버리지 평가 요약

- `remove()` 의 판정 로직은 이제 값(`0`/`1`) 기준 4분기(직전 라운드가 메움)와 **의미론**
  기준(`0` vs `null`/`undefined`, 이번 라운드가 메움) 양쪽에서 실행 검증된다 — 두 판정
  지점(트리거 경로·방어 분기) 모두 대칭.
- `.catch` 의 `NotFoundException` 분리, e2e 의 공허성 가드는 이번 커밋이 건드리지 않았고
  직전 라운드에서 이미 뮤테이션 재현으로 검증됨 — 회귀 없음.
- e2e(`schedule-delete-concurrency.e2e-spec.ts`)는 이번 커밋 대상이 아니다. 실 Postgres
  드라이버가 `rowCount` 를 정수로 신뢰성 있게 보고하므로 `affected: null/undefined` 시나리오를
  e2e 로 강제 재현하는 것은 비현실적이며, unit 대조군으로 그 경계를 검증하는 이번 접근이
  적절하다.

## 요약

직전 라운드(00_56_52)가 지적한 유일한 testing WARNING — `affected === 0` 전환의 존재 이유(드라이버
미보고 시 오판 방지)를 지키는 테스트 부재 — 는 자매 함수와 정확히 같은 형태(`for (const affected
of [undefined, null])`)의 대조군 두 건으로 닫혔고, 이번 세션에서 그 판별력을 뮤테이션으로 독립
재현했다(대조군 추가 전 뮤턴트 생존 확인은 이전 라운드 실측을 신뢰, 이번엔 대조군이 있는 현재
코드에서 같은 뮤턴트를 다시 넣어 정확히 그 두 테스트만 RED 로 잡음을 확인). 남은 것은 이전
라운드부터 반복 지적된 비차단 INFO(무관한 describe 블록 네이밍) 하나와, 이번에 새로 발견한
경미한 INFO(신규 테스트 이름의 자기완결성 부족) 하나뿐이다. 테스트 존재·커버리지·격리·회귀
전부 양호하며 신규 CRITICAL/WARNING 은 없다.

## 위험도

NONE
