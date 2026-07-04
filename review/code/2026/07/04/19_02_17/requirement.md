# 요구사항(Requirement) Review — priority 3-tier (triggerType threading, §4.3)

## 검토 범위

`ExecutionEngineService.execute()` 의 트리거 우선순위를 2-tier(`manual`/그 외)에서
3-tier(`manual` > `webhook` > `schedule`)로 확장하는 변경. 대상 파일: `execution-engine.service.ts`
(+spec), `hooks.service.ts`(webhook/chat-channel 호출부), `schedule-runner.service.ts`(cron 호출부),
관련 `*.spec.ts` 3개, `spec/5-system/4-execution-engine.md`(§4 배너/§4.2/§8 배너/§9.3 큐 표),
`plan/complete/exec-intake-queue-impl.md`(spec_impact 추가), `review/consistency/2026/07/04/18_33_09/**`
(--impl-prep 산출물, 참고용).

## 발견사항

- **[INFO]** `ExecuteOptions.triggerId` variant 의 `triggerType?: ExecutionRunTriggerType` 타입이
  JSDoc 이 서술하는 값 집합보다 넓다 — `'manual'` 값도 타입상 허용됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:386-392`
    (`triggerId` variant 필드 선언), 비교: JSDoc 주석 "`'webhook'`/`'schedule'` (manual 은
    executedBy variant 로 판정)"
  - 상세: 필드 타입은 `ExecutionRunTriggerType`(`'manual' | 'webhook' | 'schedule'` 전체)으로
    선언되어 있으나, 판별 유니온 설계 의도와 인접 주석은 이 variant 에서 `triggerType` 값이
    `'webhook'`/`'schedule'` 두 가지만이어야 한다고 명시한다. 실제로 `{ triggerId: 't1', triggerType:
    'manual' }` 같은 호출은 TypeScript 컴파일을 통과한다(직접 검증함) — 컴파일러가 이 불변식을
    강제하지 않는다. 현재 프로덕션 호출부 3곳(hooks.service.ts webhook/chat-channel, schedule-runner)은
    모두 리터럴 `'webhook'`/`'schedule'` 만 전달하므로 **런타임 버그는 아니다**. 다만 이는 이번
    작업의 `--impl-prep` cross_spec 체커가 사전에 명시적으로 제안했던 좁히기("`triggerType?: 'webhook'
    | 'schedule'`")가 실제 구현에는 반영되지 않은 지점이다.
  - 제안: `triggerId` variant 의 `triggerType` 타입을 `Exclude<ExecutionRunTriggerType, 'manual'>`
    (또는 `'webhook' | 'schedule'`)로 좁혀 판별 유니온 불변식("이 variant 에서는 manual 이 나올 수
    없다")을 컴파일 타임에 강제할 것을 권고. 현재도 위험은 낮음(모든 호출부가 안전한 리터럴만
    전달) — WARNING 이 아닌 INFO로 유지.

- **[INFO]** 남은 주석 파편 — 편집 잔여물로 보이는 불완전 문장
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3245`
    (`// priority: 수동 실행(executedBy)을 트리거 실행보다 앞세운다(§4.3). webhook`)
  - 상세: diff 상 이 줄은 unchanged context 줄로 유지됐으나, 원래 이 줄 다음에 이어지던
    "vs schedule 의 세부 3-tier 구분은 ExecuteOptions 가 trigger type 을 싣지 않아 후속으로
    미룬다 — 현재는 manual > 그 외." 문장은 삭제되고 바로 아래 새 문단("3-tier(§4.3): **executedBy
    우선**...")이 붙었다. 결과적으로 3245번 줄이 "webhook" 한 단어로 끊긴 채 다음 문장으로
    바로 이어져 약간 어색한 주석 흐름이 됐다(기능에는 영향 없음 — 순수 주석 정리 누락).
  - 제안: 3245번 줄의 "webhook" 잔여 단어를 삭제하거나 문장을 자연스럽게 재작성.

- **[INFO]** `resolveExecutionRunPriority` 자체의 방어적 fallback(`undefined`/미상 → `schedule`)과
  `execute()` 의 fallback(`triggerType` 미지정 → `'webhook'`)이 서로 다른 값으로 문서화됨 —
  실질 충돌은 없음(현재 유일 호출부가 항상 정의된 값을 넘김)
  - 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts:33-41`
    (`resolveExecutionRunPriority` 및 그 위 JSDoc "미상/누락은 가장 낮은 우선순위(schedule)로 둔다")
    vs `execution-engine.service.ts:3250-3252`(`options?.triggerType ?? 'webhook'`)
  - 상세: `execute()` 는 `triggerId` variant 에서 `triggerType` 이 없으면 `'webhook'` 으로 명시
    fallback한 뒤 이미 정의된 값을 `resolveExecutionRunPriority` 에 넘기므로, 후자 함수 내부의
    `undefined`/미상 방어 분기(→`schedule`)는 이 호출 경로에서 도달 불가능한 방어적 코드다(현재
    이 함수의 유일한 프로덕션 호출부는 `execute()` 뿐 — 확인함). 두 계층의 fallback 값이 다르다는
    사실 자체가 스펙에 명시적으로 기술돼 있진 않으나, 실제 동작 충돌은 없다(죽은 코드 경로일 뿐).
  - 제안: 수정 불요 — 다만 향후 `resolveExecutionRunPriority` 를 다른 호출부에서 직접 쓰게 되면
    이 fallback 차이(`webhook` vs `schedule`)가 실제로 드러날 수 있음을 주석에 한 줄 남겨두면
    좋음(INFO, 선택 사항).

## 관점별 점검 결과

1. **기능 완전성**: 완전. `execute()` 가 `executedBy` 존재 시 `manual`, 아니면
   `options?.triggerType ?? 'webhook'` 을 계산해 `resolveExecutionRunPriority` 에 전달(이미
   3-tier로 구현·테스트된 함수를 그대로 재사용). 호출부 3곳(webhook/chat-channel `hooks.service.ts`,
   cron `schedule-runner.service.ts`) 모두 리터럴 값을 정확히 threading. `runNow`(schedule "지금
   실행")는 의도대로 `executedBy` variant 로 남아 `manual` 유지(무변경, 회귀 없음 — 직접 확인).
2. **엣지 케이스**: `triggerType` 미지정(`{ triggerId: 't-x' }`) → `webhook` fallback 을 신규
   단위테스트(`execution-engine.service.spec.ts` "triggerType threading — manual>webhook>schedule
   3-tier + fallback (PR2)")가 명시적으로 커버. manual/webhook/schedule 세 값 모두 우선순위 부등식
   검증(`sOpts.priority > wOpts.priority > EXECUTION_RUN_PRIORITY.manual`). `resolveExecutionRunPriority`
   자체의 `undefined` 방어 분기도 기존 `execution-run.queue.spec.ts` 에서 검증됨.
3. **TODO/FIXME**: 기존 `TODO(PR2): trigger type threading ...` 주석이 완전히 제거되고 실제 구현으로
   대체됨 — 확인. 신규 TODO/FIXME/HACK/XXX 없음.
4. **의도와 구현 간 괴리**: 함수명·주석과 구현 대체로 일치. 유일한 미세 괴리는 위 INFO 1건
   (`triggerId` variant 타입이 주석보다 넓음).
5. **에러 시나리오**: 트리거 우선순위 계산은 실패할 수 없는 순수 매핑이라 별도 에러 경로 불요 —
   해당 없음(정상).
6. **데이터 유효성**: `triggerType` 은 옵셔널 필드이고 `resolveExecutionRunPriority` 가 `in`
   체크로 미상 값을 방어(`schedule` fallback)하므로 타입 밖 문자열이 실수로 들어와도 크래시 없음.
7. **비즈니스 로직**: spec §4.3 규칙("manual > webhook > schedule", "executedBy 우선",
   "schedule 지금 실행(runNow) 은 manual 유지", "triggerType 미지정 시 webhook fallback")이 코드에
   정확히 반영됨. chat-channel 발화도 `Trigger.type` 이 항상 `webhook` 이라는 데이터모델 §2.8 과
   정합하게 하드코드 `'webhook'` 사용.
8. **반환값**: `execute()` 의 반환 계약(executionId) 무변경, 모든 분기가 큐 add 호출 후 정상 반환.
9. **spec fidelity**: `spec/5-system/4-execution-engine.md` §4(배너)/§4.2(PR1 jobId·triggerType
   메모)/§4.3(수평 확장 표)/§8(배너)/§9.3(큐 표) 전부 "구현 완료(2026-07-04)" 로 flip 되어 코드와
   line-level 로 일치. `spec/1-data-model.md` §2.8 `Trigger.type` enum(`webhook/schedule/manual`)과
   `ExecutionRunTriggerType` 값 집합도 일치. 코드가 spec 을 벗어나는 CRITICAL 급 불일치는 발견되지
   않음. 위 INFO 3건은 모두 spec 본문과 어긋나는 게 아니라 코드 내부의 미세한 타입-엄격성/주석-정리
   잔여물이며, spec 이 낡아 코드가 옳은 SPEC-DRIFT 케이스도 아니다(둘 다 이미 동시에 갱신되어
   합치함).

## 요약

`priority 3-tier(triggerType threading)` 구현은 spec §4.3 이 명시하는 "executedBy 우선 → manual,
그 외 호출부가 전달한 triggerType(webhook/schedule), 미지정 시 webhook fallback, manual>webhook>schedule"
규칙을 정확히 반영하며, 이미 구현·테스트돼 있던 `resolveExecutionRunPriority` 3-tier 함수에 정확한
인자를 공급하는 좁은 범위의 변경이다. `runNow`(schedule 즉시 실행)가 의도대로 `manual` 을 유지하는
회귀 방지도 확인됐고, 신규 단위테스트가 3-tier 우선순위 부등식과 fallback 을 모두 커버한다.
`ExecutionRunJob` payload 에 `triggerType` 을 싣지 않는다는 §9.3 경계도 코드와 일치한다. 발견된
3건은 모두 INFO 등급 — (1) `triggerId` variant 의 `triggerType` 타입이 주석보다 넓어 이론상
`'manual'` 값도 컴파일 통과 가능(런타임 영향 없음), (2) 주석 편집 잔여물 한 줄, (3) 두 계층
fallback 값 차이(도달 불가능한 죽은 분기)이며 모두 즉시 수정을 요하는 CRITICAL/WARNING 은 아니다.
전반적으로 요구사항·spec §4.3 본문과 구현이 신뢰할 수 있는 수준으로 일치한다.

## 위험도

LOW

STATUS: SUCCESS
