# 요구사항(Requirement) 충족 리뷰 — trigger-lock-followups (`#1334` developer 범위 후속 5건)

## 검증 방법

diff 대상 소스 5개(`trigger-config-lock.ts`/`.spec.ts`, `trigger-transaction-mock.ts`,
`triggers.service.ts`, `schedules.service.spec.ts`)와 plan/CHANGELOG/consistency 산출물을
`Read`로 전문 대조했고, 다음을 저장소에서 직접 실행해 claim 을 실측했다(모두 scratch 디렉터리
백업 후 `cp` 로 복원, `git status --short` 로 원복 확인 완료 — 최종 상태는 review 산출물 외
diff 없음):

- `npx jest src/modules/triggers src/modules/schedules` → **13 suites / 367 tests (1 skipped) 전부
  PASS**, plan 이 적은 "367건 표면"과 일치.
- `toLockTimeoutMs` 순수 함수 실행: `-5→1`, `999999→60000`, `5000→5000`, `1500.9→1500` — plan/테스트
  케이스와 정확히 일치.
- 뮤테이션 2건 직접 적용·복원: `if (result.affected === 0) return false;` 제거 → 정확히 1개 테스트
  RED(`UPDATE 가 0행에 매치되면 false`). `=== 0` → `!result.affected` 로 치환 → 정확히 1개 테스트
  RED(`affected 를 보고하지 않는 드라이버에서는 true 를 유지한다`). 둘 다 plan 의 M4a/M4b 표와
  정확히 일치 — 생존 0·교차 오염 0 주장이 검증됨.
- `grep -rEln "[A-Za-z_]+ForUpdate"` → 저장소 전체에 `triggers.service.ts` 1건(그마저 개명 후
  JSDoc 안의 역사적 언급). `grep -rlin "FOR UPDATE"` → `triggers.service.ts` 제외 정확히 **7개
  파일**(engine-driver.interface.ts·ai-turn-orchestrator.service.{ts,spec.ts}·
  execution-engine.service.{ts,spec.ts}·webauthn.service.ts·integration-oauth.service.ts) —
  plan 의 "7개 파일" 실측과 정확히 일치.
- `AuthConfigsService.findByIdForResponse` grep → 6건(선언 1 + 소비 1 + spec 3 + 인용 1),
  plan/naming_collision checker 의 선례 인용과 일치.
- `grep -rn "trigger-config-lock" spec/` → 0건, `spec_impact: none` 선언과 일치.
- `SchedulesService.remove()` 실제 구현을 열어 `if (schedule.triggerId)` 가드와 신규 테스트의
  기대(락 이벤트 0·`triggerRepo.delete` 미호출·`scheduleRepo.remove` 는 호출됨)가 정확히 대응함을
  확인.
- `TriggersService.rotateBotToken()` 의 `if (!wrote) this.throwTriggerNotFound();` 가 이미
  선재해 있음을 확인 — `rewriteTriggerConfigLocked` 의 `affected===0` 수정이 실제로 이 호출부의
  404 계약을 되살리는 것이지, 새 분기를 만드는 게 아님을 코드로 검증.

## 발견사항

- **[INFO]** `affected` 의 타입 서술이 TypeORM 선언보다 넓다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.spec.ts:43-44`(`UpdateResult.affected
    는 number | null | undefined 다` 주석)
  - 상세: 설치된 `typeorm@0.3.31`(`UpdateResult.d.ts`)의 실제 선언은 `affected?: number`
    (`number | undefined`)이고 `null` 은 타입에 없다. 주석·JSDoc(`trigger-config-lock.ts:232-233`
    도 동일 서술)이 "드라이버가 `null` 을 줄 수 있다"는 방어적 가정을 실제 타입 선언보다 넓게
    적었다. 다만 이는 **해가 없는 과잉 방어**다 — `result.affected === 0` 비교는 `null`·`undefined`
    양쪽 모두에서 자연히 `false`(≠0)로 평가돼 "판정하지 않고 `true` 유지"라는 의도대로 동작하고,
    테스트(`affected 를 보고하지 않는 드라이버…`)도 `undefined`·`null` 둘 다 실제로 검증한다.
    기능·계약 결함은 아니며, 서술 정밀도의 사소한 과장이다.
  - 제안: 조치 불요(선택적으로 "드라이버 실측이 아니라 방어적 가정"이라고 한 단어만 보태면
    더 정확해진다).

- **[INFO]** `spec/data-flow/11-workflow.md §3.1` CASCADE 열거 누락은 이 PR 이 만든 결함이
  아니라 V001 스키마 이래의 기존 문서 갭이며, 처리 경로가 규약대로 정확히 분기됨을 확인
  - 위치: `plan/in-progress/trigger-lock-followups.md` §"④" / `spec/data-flow/11-workflow.md §3.1`
  - 상세: `trigger.entity.ts:39,46` 의 `onDelete: 'CASCADE'`(Workflow·Workspace)는 이번 PR 이
    도입한 게 아니라 기존 스키마이고, 이번 PR 은 그 경로가 advisory lock 을 우회한다는 사실을
    **드러내는 코드 fix**(`affected===0` 판정)만 한다. spec 문서 자체를 developer 가 고치지
    않고 `--impl-prep` 산출물(`review/consistency/2026/09/15/08_58_18`)에 planner 인계로 정확히
    등재한 것도 CLAUDE.md 의 자기-반증형 소정정 조건 1(원저작자 아님)을 올바르게 적용한 결과다.
    코드가 옳고 spec 만 낡은 전형적 SPEC-DRIFT 형태이지만, developer 가 spec 을 직접 고치는 것이
    금지된 경계이므로 이미 올바른 경로(project-planner 턴 인계)로 처리됐다 — 본 리뷰에서 추가
    조치가 필요한 새 항목은 아니다.
  - 제안: 조치 불요 — 이미 `review/consistency/2026/09/15/08_58_18/SUMMARY.md` WARNING#1 로
    planner 인계 대기 중.

- **[INFO]** `SchedulesService.remove()` 신규 테스트(`triggerId` falsy 분기)가 `removeJob`/
  `recordAudit` 호출 여부까지는 단언하지 않음
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts:674-693`
  - 상세: 새 테스트는 테스트 제목이 약속한 핵심(락 이벤트 0·`triggerRepo.delete` 미호출·
    `scheduleRepo.remove` 는 호출됨)은 정확히 검증하지만, `scheduleRunnerService.removeJob`
    이나 `recordAudit`(`SCHEDULE_DELETED`)이 이 분기에서도 정상 호출되는지는 별도로 단언하지
    않는다. 실제 구현(`schedules.service.ts:297-339`)을 보면 이 둘은 `if (schedule.triggerId)`
    가드 **밖**에서 무조건 실행되므로 현재 동작에 결함은 없다 — 이 테스트가 존재 이유로 삼는
    "가드가 trigger 쪽만 건너뛴다"는 명제와도 일치한다. 커버리지가 제목이 약속한 범위를
    넘어서지 않는다는 점만 기록한다.
  - 제안: 조치 불요(선택적으로 `expect(scheduleRunnerService.removeJob).toHaveBeenCalled()` 를
    추가하면 회귀 방지 범위가 넓어지지만 이번 PR 의 스코프인 "가드 자체의 미실행 회귀 포착"에는
    이미 충분하다).

## 요약

`rewriteTriggerConfigLocked` 의 `affected===0` 미판정(락으로 못 막는 세 번째 삭제 경로 —
`Workflow`/`Workspace` FK CASCADE)과 `SET LOCAL lock_timeout` 보간값의 `NaN`/`Infinity` 무방비를
정확히 겨냥해 고쳤고, 두 수정 모두 뮤테이션 테스트로 "정확히 1개 테스트만 죽는다"는 자체
claim 을 직접 재현해 확인했다. `findByIdForUpdate` → `findByIdForPatchValidation` 개명은
"이 저장소의 `FOR UPDATE` 관용구 7개 파일" 실측을 grep 으로 재확인했고, 대체 후보
(`…ForPatchPrecheck`)가 Cafe24/MakeShop 전용 어휘와 충돌한다는 판단도 실제 사용례로
뒷받침된다. `SchedulesService.remove()` 의 `triggerId` falsy 가드 테스트는 실제 미실행이던
분기를 정확히 겨냥한 대조군이다. `withTransactionMock` 의 `{ affected: 1 }` 기본값 변경은
`affected` 검사 도입이 깨뜨린 기존 서비스 테스트 전체를 실제로 복구했음을 전체 스위트 재실행으로
확인했다. spec 참조 0건(`spec_impact: none`)과 `spec/data-flow/11-workflow.md` CASCADE 문서
갭에 대한 처리(developer 권한 밖 → planner 인계)도 프로젝트 규약과 정확히 부합한다. TODO/FIXME/
HACK 성격의 미완성 표식은 없으며, 모든 코드 경로가 값을 반환한다(`return false`/`return true`
누락 없음, `toLockTimeoutMs` 는 유한하지 않으면 명시적으로 throw). CRITICAL·WARNING 급 결함은
발견되지 않았다.

## 위험도

NONE
