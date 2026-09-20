# 테스트(Testing) 리뷰 — `schedule-dup-delete-6c81d4`

## 범위

이번 라운드(`00_37_06`)는 직전 리뷰(`review/code/2026/09/21/00_06_01`)의 testing WARNING 1·2 를
포함한 4건의 WARNING 을 조치한 커밋(`893dfeb7a`·`69889f74e`·`131296205`)과, 그 조치 사실을
기록한 문서(CHANGELOG·plan·RESOLUTION 등)가 대상이다. 실제 애플리케이션 코드 변경은
`codebase/backend/src/modules/schedules/schedules.service.ts` (구현) ·
`schedules.service.spec.ts` (unit) · `test/schedule-delete-concurrency.e2e-spec.ts` (e2e, 신규)
세 파일로 좁다. 나머지(`plan/**`, `review/code/2026/09/21/00_06_01/**`,
`review/consistency/2026/09/20/23_37_12/**`)는 이전 라운드의 산출물/추적 문서라 테스트 관점의
직접 대상이 아니다.

## 독립 검증 (뮤테이션 재실행)

WARNING 1·2 조치의 판별력 주장(RESOLUTION.md·주석)을 직접 재현했다 — 저장소 밖
scratch 사본으로 원본을 백업한 뒤, 실제 파일을 `cp` 로 임시 수정 → `jest` 실행 → `cp` 로 원복
(`git status --short` 로 원복 확인, `git checkout`/`restore` 미사용):

1. `schedules.service.ts` 의 `const { affected } = await m.delete(Trigger, triggerId); if (!affected) this.throwScheduleNotFound();` → `await m.delete(Trigger, triggerId);` 로 되돌리는 뮤턴트:
   `삭제 — 락 안 트리거 삭제가 0행이면 404 이고…` 테스트가 RED (`Received promise resolved instead of rejected`). 다른 31개는 GREEN 유지 — 이 테스트만의 판별력 확인.
2. `else` 분기의 `const { affected } = await this.scheduleRepository.delete(...); if (!affected) this.throwScheduleNotFound();` 를 판정 없는 단순 `delete` 호출로 되돌리는 뮤턴트:
   `삭제 — triggerId 없는 분기에서 scheduleRepo.delete 가 0행이면 404 이고…` 테스트가 RED. 나머지 GREEN.
3. 두 뮤턴트 모두 원복 후 `npx jest src/modules/schedules/schedules.service.spec.ts` 재실행 → 32/32 GREEN, `git status --short` 로 잔여 diff 없음 확인.

즉 직전 라운드 SUMMARY testing WARNING 1·2 는 **실측으로 닫혔다** — 산문 주석의 "뮤턴트로 확인했다"는
주장이 이번 세션에서 재현 가능했다.

## 발견사항

- **[INFO]** 동시성 404 테스트(`삭제 — 락 안 트리거 삭제가 0행이면 404 이고 감사·비밀 정리를 남기지 않는다`)가 `scheduleRepo.remove` 가 호출되지 않았음을 직접 단언하지 않는다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts` — `it('삭제 — 락 안 트리거 삭제가 0행이면 404 이고 감사·비밀 정리를 남기지 않는다', ...)` 블록 (약 778~813행대, 신규 추가분).
  - 상세: 이 테스트는 `auditLogs.record`·`deleteByPrefix` 미호출·에러 미로깅은 단언하지만, `scheduleRepository.remove(schedule)` 이 호출되지 않았음은 단언하지 않는다. 현재 제어 흐름상 `throwScheduleNotFound()` 가 트랜잭션 콜백 안에서 던져지고 `.catch` 가 재던지므로 이후 코드(`remove`·`recordAudit`)는 도달 불가하다 — 이미 `auditLogs.record` not-called 단언이 "그 뒤 전체가 실행되지 않았다"를 간접적으로 담보한다. 다만 형제 테스트(`삭제 실패는 조용히 지나가지 않는다…`, 이 파일 내 다른 케이스)는 같은 상황에서 `expect(scheduleRepo.remove).not.toHaveBeenCalled()` 를 명시적으로 단언한다 — 대칭을 맞추면 향후 누군가 "0-affected 인데도 remove 는 방어적으로 부른다"는 식으로 코드를 바꿨을 때 감사 단언보다 먼저, 더 명확한 실패 지점을 준다.
  - 제안: `expect(scheduleRepo.remove).not.toHaveBeenCalled();` 한 줄 추가해 형제 테스트와 대칭을 맞춘다. 차단 사유는 아니다(간접 커버리지가 이미 있음).

- **[INFO]** 이번 diff 로 추가된 `remove()` 방어 분기 테스트 2건이, 이름이 `create` 인 `describe('create — timezone fallback (§2.2)', ...)` 블록 안에 계속 얹혔다(기존 구조 답습, 신규 도입 아님).
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:254` (`describe('create — timezone fallback (§2.2)', ...)`) 및 그 안의 최상위 `describe('SchedulesService.runNow', ...)` (`:17`).
  - 상세: `remove()`/`update()` 관련 테스트가 모두 "create — timezone fallback" 이라는 이름의 describe 안에, 그리고 그 바깥은 "SchedulesService.runNow" 라는 이름의 describe 안에 있다 — 테스트 실패 메시지의 breadcrumb(`SchedulesService.runNow › create — timezone fallback (§2.2) › 삭제 — …`)가 실제 검증 대상과 무관해 가독성을 떨어뜨린다. 이번 PR 이 만든 문제는 아니지만, 새 테스트 2건이 그 자리에 더 쌓였다.
  - 제안: 우선순위 낮음(비차단). 후속 정리 시 `describe('SchedulesService.remove', ...)` 로 분리 권장 — 지금 당장 요구하지 않는다.

## 커버리지 평가 요약

- `remove()` 의 4개 분기(트리거 있음×{성공, 0-affected}, 트리거 없음×{성공, 0-affected}) 모두
  전용 유닛 테스트로 실행 검증된다 — 직전 라운드에 지적된 두 개의 미검증 방어 분기(WARNING 1·2)가
  이번 diff 로 정확히 메워졌다.
- `.catch` 분기의 `NotFoundException` 특수 처리(거짓 경보 억제)와 일반 에러 처리(반쯤 삭제 로그) 둘 다
  개별 테스트로 분리돼 있고, 두 테스트 모두 `Logger.prototype.error` spy 를 `try/finally` 로 안전하게
  복원한다 — 테스트 격리 양호.
- e2e(`schedule-delete-concurrency.e2e-spec.ts`)는 형제 3개 파일과 동일한 기법(별도 커넥션이 advisory
  lock 선점 → 두 요청 fire → 공허성 가드로 "아직 안 끝남" 확인 → lock 해제 → 상태쌍·감사 카운트 검증)을
  따른다. 공허성 가드(1.5초 race)가 있어 "테스트가 겹침을 실제로 못 만들었는데 통과"하는 거짓 GREEN을
  차단한다 — 이 시리즈에서 반복 검증된 패턴이며 이번에도 올바르게 적용됐다.
- Mock 적절성: `beforeEach` 가 매 테스트 새 `Test.createTestingModule` 을 만들어 테스트 간 상태 누수가
  없다. 유일한 모듈 스코프 공유 상태(`triggerLockEvents` 배열)는 각 관련 테스트가 시작부에서
  `.length = 0` 으로 리셋해 실질적 격리를 유지한다. `triggerRepo.delete`/`scheduleRepo.delete` 기본
  mock 이 `{ affected: 1 }` 를 돌려주도록 바뀐 것은 실제 `DeleteResult` 계약과 일치하며(과거 `undefined`
  반환은 실제 TypeORM 동작과 괴리가 있었다), `mockResolvedValueOnce({ affected: 0, raw: [] } as DeleteResult)`
  로 진 쪽 케이스만 오버라이드하는 구성도 타입 안전하고 명확하다.
- 회귀 테스트: 기존 `삭제 — trigger 행을 config 락 안에서 지운다` 테스트에 `scheduleRepo.remove` 호출
  단언이 추가되면서도 기존 순서 단언(`triggerLockEvents`)·`triggerRepo.delete` 호출 단언은 그대로
  유지돼 회귀 안전성이 보존됐다. `빌드(ratchet)` 가 `{ affected: 0 }` 를 `DeleteResult` 로 캐스팅하지
  않은 최초 시도에서 타입 오류를 잡았다는 RESOLUTION.md 의 서술은 현재 코드의 `as DeleteResult` 캐스팅과
  일치한다.

## 요약

직전 라운드에서 지적된 두 testing WARNING(방어적 `scheduleRepository.remove` 호출의 미검증, `triggerId`
없는 분기의 0-affected→404 미검증)은 이번 diff 로 정확히 닫혔고, 그 판별력을 이 세션에서 독립적으로
뮤테이션 재현해 확인했다(두 뮤턴트 모두 새 테스트가 RED 로 잡음, 원복 후 32/32 GREEN). e2e 는 형제
3파일과 동일한 검증된 겹침 기법 + 공허성 가드를 갖춰 거짓 GREEN 위험이 낮다. 남은 것은 비차단 INFO
2건뿐이다 — 하나는 이미 간접적으로 커버되는 단언의 명시화 제안, 다른 하나는 이 PR 이전부터 있던 describe
네이밍 관례상의 가독성 이슈. 테스트 존재·커버리지·격리·회귀 모두 양호하다.

## 위험도
LOW
