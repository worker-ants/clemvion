# 부작용(Side Effect) 리뷰 — trigger-config-lost-update

## 검토 방법

`git diff origin/main...HEAD --stat`(17개 codebase 파일, `+2287/-164`)로 전체 변경 범위를
확인했고, 프롬프트가 크기 제한으로 생략한 파일(`schedules.service.ts` · `triggers.service.ts` ·
`trigger-config-lock.ts` · `chat-channel-binder.service.ts` · `trigger-transaction-mock.ts` ·
e2e 스펙 등)은 전부 `git diff origin/main...HEAD -- <path>` 로 원문을 직접 열어 확인했다. 이
PR 은 이미 side-effect 관점만 6회(`18_17_44`·`23_38_09`·`00_07_52`·`00_38_16`·`00_38_16`·
`01_09_53`) 독립 검토됐다. 그 중 실측으로 확인한 두 건의 이전 지적을 코드 대조로 재검증했다:

- `23_38_09` CRITICAL(`rotateBotToken` 이 `mergeIntoFreshSubKey` 에 델타가 아니라 함수 시작
  시점의 전체 스냅샷(`mergedChannel`)을 `patch` 로 넘겨 락 안 재읽기를 무력화)은 **현재
  코드에서 수정 확인됨** — `triggers.service.ts` 의 `rotateBotToken` 이 이제
  `{ ...(result.configUpdates ?? {}), botTokenRef, inboundSigningRef }` 를 `patch` 로,
  `mergedChannel` 을 `fallback` 으로만 넘긴다.
- `01_09_53` WARNING(`SchedulesService.remove()` 의 lock-timeout 트랜잭션에 형제
  `TriggersService.remove()` 가 갖춘 "반쯤 삭제된 상태" 진단 로그가 없음)은 **현재 코드에서
  수정 확인됨** — `schedules.service.ts` `remove()` 가 이제 동일한 형태의
  `.catch((err) => { this.logger.error(...'반쯤 삭제된 상태'...); throw err; })` 를 갖는다.

저장소 파일은 뮤테이션하지 않았다(`Read`/`git diff`/`grep`/`sed -n` 만 사용, 이 세션 종료
시점 `git status --short` 에도 이 세션이 만든 잔여 변경 없음).

## 발견사항

- **[INFO]** `SchedulesService.update()` 가 patch 가 비어 있으면 트리거 행 쓰기를 완전히
  생략 — `Trigger.updated_at` 자동 갱신이 조용히 사라지는 경우가 생긴다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` — `update()` 의
    `if (trigger) { ...; if (Object.keys(patch).length > 0) { await this.triggerRepository.update(...) } }` 블록
  - 상세: 수정 전엔 `trigger` 가 존재하면(사실상 항상 — `Schedule.triggerId` 는 NOT NULL
    1:1) `dto.name`/`dto.isActive` 유무와 무관하게 매 `PATCH /api/schedules/:id` 마다
    `triggerRepository.save(trigger)` 를 무조건 호출했다. `Trigger` 는 `@UpdateDateColumn`
    (`entities/trigger.entity.ts:162`)을 갖고 있어, 이 무조건 `save()` 는 `cronExpression`/
    `timezone`/`parameterValues` 만 바뀐 요청에서도 연결된 트리거 행의 `updated_at` 을 매번
    갱신하는 부수효과를 냈다. 이번 수정은 이 결함 클래스(엔티티 통째 저장으로 인한
    lost-update)를 닫으려고 컬럼 한정 `update()` 로 바꾸면서, `patch` 가 비면(=`dto.name`·
    `dto.isActive` 둘 다 없으면) 그 쓰기 자체를 건너뛴다 — 새 테스트("수정 — trigger 필드를
    하나도 안 바꾸면 patch 를 쓰지 않는다")가 이를 명시적으로 의도한 동작으로 고정한다.
    결과적으로 schedule 을 cron/timezone/parameterValues 만 바꿔 PATCH 하면, 연결된 트리거의
    `updated_at` 은 더 이상 갱신되지 않는다 — 종전에는 항상 갱신됐다.
  - 실제 응답 노출 여부는 확인했다: `SchedulesService.update()` 의 응답에 실리는
    `ScheduleTriggerRefDto`(`schedules/dto/responses/schedule-response.dto.ts:27-56`)는
    `id`·`name`·`workflowId`·`workflow` 만 담고 **`updatedAt` 을 노출하지 않는다** — 이
    엔드포인트 자체의 응답 계약에는 이 변화가 드러나지 않는다. 다만 이후 별도로
    `GET /api/triggers/:id`(`TriggerResponseDto.updatedAt`, 존재함)를 호출하는 클라이언트나
    "최근 변경된 트리거" 정렬/캐시-무효화 로직이 `updated_at` 을 신호로 쓴다면, "schedule 만
    편집했는데 트리거는 안 바뀐 것처럼 보인다"는 조용한 관측 차이가 생길 수 있다. 코드
    전수 grep 으로는 `trigger.updatedAt` 을 비교/정렬/캐시 키로 쓰는 소비처를 찾지 못했다 —
    현재로선 관측 가능한 하위 소비처가 없어 보이는 낮은 위험이다.
  - 제안: 조치 불요 수준(차단 사유 아님). 다만 CHANGELOG 의 "컬럼만 고치는 자리는 컬럼 한정
    갱신으로 바꿨다"는 서술에 이 부수효과(빈 patch 시 `updated_at` 미갱신)를 한 줄 덧붙이면,
    다음에 "트리거가 최근에 안 바뀐 것 같다"는 관측을 이 PR 과 연결 짓기 쉬워진다.

- **[INFO]** (재확인, 신규 아님) `pg_advisory_xact_lock(hashtext('trigger-config:<id>'))` 는
  트리거별로 **새로운 공유 블로킹 자원**을 도입한다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` —
    `acquireTriggerConfigLock`/`rewriteTriggerConfigLocked`
  - 상세: 같은 트리거를 향한 동시 PATCH/rotate/삭제 요청은 이제 서로를 직렬화한다(삭제만
    5초 상한, 나머지는 무한 대기). 이는 이 PR 의 핵심 의도이고 `concurrency.md`/`database.md`
    등 이전 라운드가 이미 검토·수용했다. side-effect 관점에서 새로 짚을 것은 없고, "새 공유
    블로킹 프리미티브 도입"이라는 사실 자체를 기록으로 남긴다.
  - 제안: 조치 불요.

- **[INFO]** (재확인, 신규 아님) `SET LOCAL lock_timeout = '${Math.trunc(options.timeoutMs)}ms'`
  는 파라미터 바인딩이 안 되는 문자열 보간이다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` —
    `acquireTriggerConfigLock`
  - 상세: `grep -rn "TRIGGER_DELETE_LOCK_TIMEOUT_MS"` 로 호출부를 재확인한 결과 두 곳
    (`triggers.service.ts` `remove()`, `schedules.service.ts` `remove()`) 모두 모듈 상수
    `TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000` 리터럴만 넘긴다 — 사용자 입력이 이 문자열
    보간에 닿는 경로는 없다. `Math.trunc` 가 정수화를 강제하지만 `NaN`/`Infinity` 입력에는
    무효한 SQL(`'NaNms'`)을 만들 수 있는데, 현재 호출부가 상수만 쓰므로 실제 발생 경로는
    없다. 이전 두 라운드(`21_18_21`, `01_09_53`)가 이미 같은 결론에 도달했다.
  - 제안: 조치 불요. 향후 `timeoutMs` 를 상수가 아닌 계산값으로 넘기는 호출부가 생기면
    그때 유한 양의 정수 여부를 assert 하는 방어선을 이 함수 안에 추가할 것.

## 확인했으나 이슈 없음

- **시그니처/공개 API**: 컨트롤러가 소비하는 공개 메서드(`findById`/`create`/`update`/
  `remove`/`rotateBotToken`/`revokePerTriggerToken`, `SchedulesService.update`/`remove`)의
  파라미터·반환 타입 변경 없음. 신규 export(`acquireTriggerConfigLock`·
  `rewriteTriggerConfigLocked`·`triggerConfigLockKey`·`TRIGGER_DELETE_LOCK_TIMEOUT_MS`·
  `TRIGGER_CONFIG_LOCK_PREFIX`·`extractInboundSigningRef`)와 신규 private 헬퍼
  (`assertTriggerFound`·`mergeIntoFreshSubKey`·`throwTriggerNotFound`·`findByIdForUpdate`·
  `touchLastTriggeredAt`)는 전부 additive 이고 기존 호출자에 영향 없음.
- **전역 변수**: 신규 mutable 모듈 레벨 상태 없음. `TRIGGER_CONFIG_LOCK_PREFIX`/
  `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 는 불변 상수.
- **파일시스템**: 이번 diff 에 파일 생성·삭제 로직 변경 없음(리뷰/plan 산출물 커밋 제외).
- **환경 변수**: 신규 읽기/쓰기 없음.
- **네트워크 호출**: 외부 provider 호출(`adapter.setupChannel`/`teardownChannel`) 횟수·순서
  불변 — 임계 구간을 락 밖에 두는 것이 이 수정의 핵심 제약이고 그대로 유지된다.
- **이벤트/콜백**: `chat-channel-binder.service.ts` 의 `channelListenerRegistry.register()`
  가 `if (wrote)` 조건부로 바뀌었다 — 락 안 재읽기에서 트리거가 삭제된 것을 발견하면 등록을
  건너뛰는 의도된 변경이고, 실패(`catch`) 경로는 애초에 이 호출을 하지 않으므로 비대칭이
  새로 생기지 않는다. `TriggersService.remove()` 의 `channelListenerRegistry.unregister()` 는
  락 밖에서 그대로 실행되며(순서 불변), 이 함수 자체가 idempotent(미등록 시 graceful noop)라
  락 타임아웃 실패와 경합해도 안전하다.
- **트랜잭션 중첩**: `rewriteTriggerConfigLocked`/인라인 `manager.transaction()` 을 부르는
  모든 자리는 호출 시점에 바깥 트랜잭션이 이미 커밋된 뒤이거나(외부 HTTP 호출 이후) 애초에
  트랜잭션 밖의 컨텍스트라, 진행 중인 트랜잭션 안에서 재귀적으로 새 트랜잭션을 여는 자리는
  없다.
- **`hooks.service.ts` 의 `touchLastTriggeredAt()`**: 두 호출부가 `save(trigger)` →
  private 헬퍼 호출로 바뀌었을 뿐 시그니처는 그대로고, in-memory `trigger.lastTriggeredAt`
  갱신 + 컬럼 한정 `update()` 를 동일하게 유지한다 — 호출부 이후 코드가 그 값을 읽어도
  DB 상태와 어긋나지 않는다.
- **테스트 인프라(`withTransactionMock`)**: 파일마다 새 mock 객체를 생성해 반환하고
  `global`/`process.env`/모듈 레벨 mutable 상태를 만들지 않는다 — 병렬 테스트 파일 간
  오염 경로 없음.

## 요약

이 PR 은 이미 6라운드 독립 side-effect 검토를 거쳤고, 그중 실측 가능한 두 건(이전 CRITICAL —
`rotateBotToken` 이 델타 대신 전체 스냅샷을 패치로 넘겨 lost-update 방지가 무력화됐던 것;
이전 WARNING — `SchedulesService.remove()` 의 반쯤-삭제 진단 로그 누락)을 이번 라운드에서
코드 대조로 재검증한 결과 **모두 후속 커밋에서 실제로 수정됐다.** 새로 발견한 것은 하나뿐이고
심각도는 낮다 — `SchedulesService.update()` 가 빈 patch(=name/isActive 변경 없음)일 때 트리거
행 쓰기를 완전히 생략하면서, 종전에는 매 schedule PATCH 마다 무조건 일어나던 트리거의
`updated_at` 자동 갱신이 그 경우 더 이상 일어나지 않게 됐다. 이 값을 노출하는 스케줄 응답
DTO(`ScheduleTriggerRefDto`)가 애초에 `updatedAt` 을 담지 않아 이 엔드포인트 자체의 응답
계약에는 드러나지 않고, 다른 소비처(정렬·캐시 무효화 등)가 이 컬럼에 의존하는 코드도
발견되지 않아 실질 위험은 낮다. 그 외 공개 시그니처·전역 변수·파일시스템·환경 변수·네트워크
호출·이벤트 발생 조건·트랜잭션 중첩은 모두 변경 없거나 이미 검토·수용된 의도된 설계다.

## 위험도

LOW
