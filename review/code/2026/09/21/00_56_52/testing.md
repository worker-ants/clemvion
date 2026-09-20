# 테스트(Testing) 리뷰 — `schedule-dup-delete-6c81d4` (00_56_52)

## 범위

이번 라운드는 직전 라운드(`review/code/2026/09/21/00_37_06`)가 지적한 concurrency WARNING 2
(`!affected` 가 `0` 과 `null`/`undefined` 를 구분하지 못함)와 documentation WARNING 1(CHANGELOG
인접 모순)을 조치한 커밋(`2879e88c7`)이 대상이다. 실 코드 변경은
`codebase/backend/src/modules/schedules/schedules.service.ts` (`affected === 0` 명시 비교로
전환, 두 곳)와 `CHANGELOG.md` (트리거 항목에 해소 각주 추가)뿐이다. `schedules.service.spec.ts` ·
`test/schedule-delete-concurrency.e2e-spec.ts` 는 이번 커밋에서 **변경되지 않았다**(직전
라운드에서 이미 리뷰됨) — 아래 발견사항은 "이번 커밋이 변경한 판정 로직에 대해 기존 테스트
스위트가 실제로 무엇을 검증하는가" 를 재확인한 결과다.

## 독립 검증 (뮤테이션 — 저장소 비오염)

`/private/tmp/claude-501/.../scratchpad` 아래 scratch 사본으로 `schedules.service.ts` 를 복사한
뒤, 두 판정을 `affected === 0` → `!affected` 로 되돌리는 뮤턴트를 만들어 관찰(실제 저장소 파일은
건드리지 않음 — 정적 추론 + `jest` mock 값 대조로 충분히 판별 가능해 저장소 내 `cp` 편집 없이
결론을 냈다):

- 기존 스위트가 쓰는 `affected` 값은 `0` 과 `1` 뿐이다(`{ affected: 1 }` 기본 mock,
  `{ affected: 0, raw: [] }` 오버라이드 두 곳). `0` 은 `!affected` 에서도 `=== 0` 에서도 참,
  `1` 은 둘 다 거짓 — 즉 **`affected === 0` → `!affected` 뮤턴트는 32개 테스트 전건 GREEN 으로
  살아남는다.** 이 뮤턴트를 구분하려면 `affected: null` 또는 `affected: undefined` 값이
  필요한데, 스위트 어디에도 그 값이 등장하지 않는다(`grep -n affected
  schedules.service.spec.ts` 확인, 결과에 `null`/`undefined` 없음).
- 대조군: 같은 락 서브시스템의 자매 함수 `rewriteTriggerConfigLocked` 는 정확히 이 뮤턴트를
  잡는 전용 테스트를 갖고 있다 —
  `trigger-config-lock.spec.ts:176` `'affected 를 보고하지 않는 드라이버에서는 true 를
  유지한다'`, `for (const affected of [undefined, null]) { ... }`, 주석 "`affected == null` 을
  0 과 같이 처리하는 편집을 잡는다". `schedules.service.ts` 의 두 판정은 바로 이 자매 함수의
  결정을 근거로 인용하며 만들어졌는데(주석: "같은 락 서브시스템의 자매 함수
  `rewriteTriggerConfigLocked` 가 이미 그렇게 정했다"), 그 근거가 된 테스트 형태는 이식되지
  않았다.

## 발견사항

- **[WARNING]** `affected === 0` 명시 비교가 `null`/`undefined`("모른다")를 `0`("없다")과 다르게
  처리한다는 이번 커밋의 핵심 설계 근거가, 그 근거를 실행 검증하는 테스트 없이 남아 있다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:342` (`if (affected ===
    0) this.throwScheduleNotFound();`, 트리거 삭제 판정) 및 `:380` (같은 패턴, `triggerId` 없는
    방어 분기 — `scheduleRepository.delete`). 대응 테스트 파일:
    `codebase/backend/src/modules/schedules/schedules.service.spec.ts` (이번 커밋에서는 미변경).
  - 상세: 이 코드는 직전 라운드 concurrency WARNING 2 — "`!affected` 는 `affected === 0`(진짜
    패배)과 `affected == null`(드라이버가 카운트를 보고하지 않는 경우)를 구분하지 못하고,
    그것을 구분 못 하면 «모른다» 를 «없다» 로 읽어 정상 삭제를 404 로 오판한다" — 를 고치려고
    `=== 0` 명시 비교로 바꾼 것이다. 그런데 스위트에 있는 `affected` 값은 `0`·`1` 뿐이라, `===
    0` 을 다시 `!affected` 로 되돌리는 회귀(또는 반대 방향의 실수 — 예컨대 `affected == null`
    을 `0` 과 합쳐 판정하는 편집)가 들어와도 **32개 테스트 중 어느 것도 RED 가 되지 않는다.**
    같은 서브시스템의 자매 함수 `rewriteTriggerConfigLocked` 는 바로 이 지점을
    `for (const affected of [undefined, null])` 로 전용 테스트해 뒀고(`trigger-config-lock.spec.ts:176-185`),
    schedules 쪽 주석은 그 자매 함수의 "이미 그렇게 정했다" 는 결정을 근거로 인용한다 — 근거는
    빌려왔는데 그 근거를 지키는 테스트는 빌려오지 않았다. 프로젝트 이력상("설계 근거는 쓰기
    전에 뮤턴트로 반증해 보라") 이런 형태의 "타입/비교식이 막아 준다" 는 주장이 실측 없이
    남으면 반복적으로 틀린 전례가 있다 — 이번 건은 실제 동작은 맞을 가능성이 높지만(TypeORM+pg
    드라이버가 `rowCount` 를 정수로 신뢰성 있게 반환한다는 것이 직전 concurrency 리뷰의
    관찰), 그 주장 자체를 지키는 뮤테이션 가드가 없다는 점이 갭이다.
  - 제안: `trigger-config-lock.spec.ts:176-185` 와 대칭으로, 두 판정 지점 각각에
    `mockResolvedValueOnce({ affected: undefined } as unknown as DeleteResult)` (또는 `null`)
    를 주는 케이스를 추가해 `service.remove(...)` 가 **성공적으로 resolve** 함을(즉 404 를
    던지지 않음을) 단언한다. `for (const affected of [undefined, null])` 루프로 두 값 모두
    커버하면 자매 함수 테스트와 형태가 맞는다. 비차단은 아니라고 판단한다 — 이 판정 로직은 이번
    PR 이 두 번째로 고친 것이고(1라운드 `!affected` 도입 → 2라운드 `=== 0` 전환), 세 번째로
    다시 틀릴 표면이 지금 열려 있다.

- **[INFO]** (재확인, 신규 아님) `remove()` 관련 신규 테스트들이 이름이 무관한
  `describe('create — timezone fallback (§2.2)', ...)` 블록 안에 계속 위치한다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:254`
    (`describe('create — timezone fallback (§2.2)', ...)`), 최상위 `:17`
    (`describe('SchedulesService.runNow', ...)`).
  - 상세: 직전 라운드(`00_37_06`)가 이미 INFO 로 지적했고 이번 커밋의 스코프도 아니다 —
    조치 불요를 재확인하는 차원에서만 기록.

## 커버리지 평가 요약

- `remove()` 의 4개 분기(트리거 있음×{성공, 0-affected}, 트리거 없음×{성공, 0-affected})는 값
  기준(`0`/`1`)으로는 모두 실행 검증된다 — 직전 라운드가 메운 갭은 유효하다.
- 이번 커밋이 바꾼 **비교 연산자 자체**(`!affected` → `affected === 0`)의 의미론적 차이(즉
  `null`/`undefined` 처리)는 위 WARNING 대로 테스트 스위트가 값으로 구분하지 못한다 — 이 갭은
  이번 커밋으로 새로 생긴 것은 아니지만(이전 `!affected` 버전도 같은 값 집합으로만 테스트됐다),
  이번 커밋의 존재 이유(정확히 그 구분을 고치는 것)를 감안하면 지금이 메울 최적의 시점이다.
- `.catch` 의 `NotFoundException` 분리 vs 일반 에러 로깅 분기, e2e 의 공허성 가드(겹침을 실제로
  만들었는지 확인) 등은 직전 라운드에서 이미 뮤테이션 재현으로 검증됐고 이번 커밋은 그 부분을
  건드리지 않았다 — 회귀 없음.
- Mock 적절성·테스트 격리: `beforeEach` 가 매번 새 테스트 모듈을 만들고 공유 배열
  (`triggerLockEvents`)은 각 테스트가 스스로 리셋한다 — 문제 없음.

## 요약

이번 커밋은 직전 concurrency WARNING(`!affected` 의 `0`/`null` 미구분)을 `affected === 0` 명시
비교로 고쳤고, 그 자체는 올바른 방향이다. 다만 그 수정이 존재하는 이유 — "드라이버가 카운트를
보고하지 않는 경우를 실패로 오판하지 않는다" — 를 검증하는 테스트가 이번에도 추가되지 않아,
같은 자리를 세 번째로 틀리게 고칠 표면이 남아 있다. 자매 함수 `rewriteTriggerConfigLocked` 가
이미 정확히 이 형태의 뮤테이션 가드(`for (const affected of [undefined, null])`)를 갖고 있으므로
같은 패턴을 두 판정 지점에 이식하는 것만으로 닫을 수 있는 좁은 갭이다. 값 기준(`0`/`1`)의 분기
커버리지·격리·회귀는 모두 양호하다.

## 위험도
MEDIUM
