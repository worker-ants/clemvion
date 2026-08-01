# 부작용(Side Effect) 리뷰

## 개요

리뷰 대상은 `model-config`/`schedules`/`triggers`/`workflows` 4개 모듈 CRUD 경로에 감사 로깅
(`AuditLogsService.record`)을 추가한 변경(20개 파일)이다. 이전 라운드(`review/code/2026/08/01/12_06_37`)가
같은 변경 계열을 이미 상세히 검토했고, 이번에 프롬프트에 실린 스냅샷은 그 뒤 커밋
`4b9f50a87`(C1 순서 위반 수정 + `importWorkflow` 감사 + 순서 가드 확장) · `d538d909b`(prettier 포맷)까지
반영된 상태다. `git diff origin/main...HEAD`(해당 20파일), `git show 4b9f50a87`, 프롬프트에 실리지 않은
`triggers.service.ts`/`triggers.service.spec.ts`/`workflows.service.ts`/`workflows.service.spec.ts` 전문을
`Read`로 직접 확인했고, 콜러 그래프(`grep`) · `tsc --noEmit` · 관련 6개 스펙 파일 `jest` 실행(251 passed, 1
skipped)으로 교차 검증했다.

## 발견사항

- **[INFO]** (직전 라운드 Critical 로 지적된 항목의 해소 확인) `TriggersService.update()` 에서
  `recordAudit()` 이 `syncScheduleActivation()`(BullMQ 등록, 외부 호출) **앞**으로 재배치됨.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:342`(recordAudit) → `:354`(syncScheduleActivation 호출)
  - 상세: 수정 전에는 같은 함수의 다른 두 외부 호출(`normalizeNotificationSecretRef`, `setupChatChannel`)은
    감사 뒤에 있었는데 `syncScheduleActivation` 만 감사보다 먼저 실행되어, schedule 타입 트리거의
    `isActive` 변경 경로에서만 "registerJob 이 throw 하면 트리거는 커밋됐는데 감사가 유실된다"는
    불변식 위반이 있었다. 이번 커밋(`4b9f50a87`)으로 순서가 교정됐고, 회귀 테스트
    `codebase/backend/src/modules/triggers/triggers.service.spec.ts` 의 `'update 는 schedule
    역동기화(BullMQ) **전에** 기록한다 (C1 회귀)'`(schedule 타입 + `isActive` 조합)가 `['commit', 'audit',
    'bullmq']` 순서를 명시적으로 고정한다. `create()`/`remove()` 경로는 원래부터 순서가 올발랐음을 직접
    확인했다(`create()`: `recordAudit` → `normalizeNotificationSecretRef`/`setupChatChannel`; `remove()`:
    `secrets.deleteByPrefix`가 실제 DB 삭제·감사보다 앞서 있어, 그 호출이 실패해도 삭제·감사 둘 다
    일어나지 않으므로 반대 방향 불변식 위반이 없음). `jest` 로 해당 스펙을 재실행해 GREEN 확인.
  - 제안: 없음 — 수정과 회귀 테스트가 유효함을 확인.

- **[INFO]** `WorkflowsService.duplicate()`/`importWorkflow()` 에 신규 `recordAudit()` 호출이
  트랜잭션 커밋 **뒤**에 추가됨(`duplicate` 는 `details.duplicatedFrom`, `importWorkflow` 는
  `details.imported: true`).
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:294`(duplicate 트랜잭션 시작) →
    `:397`(recordAudit) / `:481`(importWorkflow 트랜잭션 시작) → `:582`(recordAudit)
  - 상세: 두 메서드 모두 `const duplicated = await this.dataSource.transaction(...)` /
    `const imported = await this.dataSource.transaction(...)` 로 트랜잭션 결과를 변수에 담은 뒤
    `recordAudit`을 호출하는 형태로, 트랜잭션 내부에서 기록하지 않아 롤백 시 유령 감사 row 가 남는
    문제가 없다. `workflows.service.spec.ts` 의 `'duplicate 는 details.duplicatedFrom 으로 원본을
    남긴다'`·`'duplicate 도 트랜잭션 **커밋 뒤**에 기록한다 (W5)'` 테스트가 순서(`['tx-start',
    'tx-commit', 'audit']`)를 회귀 고정하며, `jest` 실행으로 GREEN 확인.
  - 제안: 없음.

- **[INFO]** `ModelConfigService`/`SchedulesService`/`TriggersService`/`WorkflowsService` 의
  `create`/`update`/`remove`(+ ModelConfig `setDefault`) 시그니처에 필수 `userId: string` 파라미터가
  추가되어 기존 시그니처가 깨짐.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:226`(create) / `:294`(update, 3번째
    파라미터) / `:854`(remove) — 동형 변경이 `model-config.service.ts`/`schedules.service.ts`/
    `workflows.service.ts` 의 동일 메서드에도 적용됨.
  - 상세: `grep -n` 으로 프로덕션 코드 전체에서 이 메서드들의 호출자를 재확인한 결과 각 모듈의
    controller 뿐이며, 4개 controller 모두 `@CurrentUser('sub') userId` 를 추가해 새 시그니처와
    동기화되어 있다(`triggers.controller.ts:100,126,165` 등). `TriggersService`/`ModelConfigService`
    등을 주입만 받는 다른 서비스(`llm.service.ts`, `knowledge-base.service.ts` 등)는 read-only 메서드
    (`findEntity`/`findDefault`/`findManyByIds`/`getDecryptedApiKey`/`onConfigInvalidated`)만 호출해
    영향이 없음을 확인했다. `npx tsc --noEmit` 결과 이 4개 서비스/컨트롤러 관련 신규 타입 에러는 없음
    (`workflows.service.spec.ts` 에 남아있는 mock 타입 에러들은 이번 diff 의 변경 라인과 겹치지 않는
    기존 결함 — hunk 범위를 diff 로 대조해 확인). HTTP 요청/응답 바디는 변하지 않는다(`userId` 는 JWT
    유래 서버측 값).
  - 제안: 없음.

- **[INFO]** `AUDIT_ACTIONS` const(`audit-action.const.ts`)에 13개 액션 추가, `AuditLogsModule` 을
  `ModelConfigModule`/`SchedulesModule`/`TriggersModule`/`WorkflowsModule` 4곳에 신규 import.
  - 위치: `codebase/backend/src/modules/model-config/model-config.module.ts:3,12` /
    `schedules.module.ts:1,24` / `triggers.module.ts:1,28` / `workflows.module.ts:1,24`
  - 상세: `AuditLogsModule` 은 `TypeOrmModule.forFeature([AuditLog])` 만 import 하는 leaf 모듈이라
    순환 의존을 새로 만들지 않는다. `AUDIT_ACTIONS` 는 `as const` 객체에 새 키만 추가하는 순수 확장이라
    기존 액션 문자열·소비자에 영향 없음.
  - 제안: 없음.

- **[INFO]** `recordAudit` → `AuditLogsService.record()` 는 내부 `try/catch` 로 실패를 삼키는 기존
  관례(`audit-logs.service.ts:80-96`, "Failures are swallowed")를 그대로 따르므로, 4개 모듈에 새로
  추가된 DB INSERT 부작용이 주 동작(트리거/워크플로/스케줄/모델설정 CRUD)을 실패시키거나
  unhandled rejection 을 만들 위험은 없다. `ModelConfigService.update()`/`remove()` 의 기존
  `notifyInvalidated()`(LLM 캐시 무효화 콜백, `try/catch` 로 리스너별 격리)와 신규 `recordAudit()` 의
  상대 순서도 두 호출 모두 예외를 외부로 전파하지 않아 관측 가능한 차이가 없음을 재확인했다.
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:80` / `codebase/backend/src/modules/model-config/model-config.service.ts:336`(notifyInvalidated) → `:338`(recordAudit)
  - 제안: 없음.

## 요약

이번 스냅샷의 핵심은 직전 라운드에서 Critical 로 지적된 `TriggersService.update()` 의 감사-BullMQ
순서 위반이 실제로 교정되고 회귀 테스트로 고정됐는지, 그리고 새로 추가된 `duplicate()`/`importWorkflow()`
감사 기록이 트랜잭션 커밋 뒤에 안전하게 배치됐는지를 검증하는 것이었다. 두 항목 모두 소스 라인 순서와
전용 회귀 테스트(순서를 배열로 명시 단언)로 확인했고, `jest`(251 passed)·`tsc --noEmit`(신규 타입 에러
없음)로 교차 검증했다. 4개 서비스의 필수 `userId` 파라미터 추가는 호출자가 4개 controller 뿐임을
grep 전수 조사로 재확인했으며, `AuditLogsModule` 신규 import 도 순환 의존을 만들지 않는다. 새로 발견된
Critical/Warning 급 부작용은 없다.

## 위험도

NONE
