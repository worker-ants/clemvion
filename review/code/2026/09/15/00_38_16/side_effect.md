# 부작용(Side Effect) 리뷰 — trigger-config-lost-update (11번째 검토 라운드)

## 검토 방법

`git diff origin/main...HEAD` 로 전체 diff(17개 codebase 파일, `+2148/-162`)를 확인했고,
프롬프트에서 생략된 파일(`trigger-config-lock.ts`·`chat-channel-binder.service.ts`·
`triggers.service.ts`·`triggers.service.spec.ts`·`trigger-transaction-mock.ts`·
`trigger-config-lost-update.e2e-spec.ts`)은 저장소에서 `Read`/`git show`로 원문을 직접
확인했다. 이 PR 은 이미 10라운드(`review/code/2026/09/14/{18_17_44…23_38_09}`,
`review/code/2026/09/15/00_07_52`)에 걸쳐 side-effect 관점만 3회(`18_17_44`·`23_38_09`·
`00_07_52`) 별도 검토됐다. 가장 최근 side-effect 라운드(`00_07_52`)는 **LOW**로 마무리됐고,
그 이후 커밋(`3641ead21`)은 `docs(triggers):` 접두가 말하듯 JSDoc·테스트 fixture 추가뿐
(`git show --stat 3641ead21`으로 확인 — 프로덕션 코드 변경은 `trigger-config-lock.ts`의
주석 문구 교정 15줄뿐)이라, 이번 라운드는 그 사이 무엇이 바뀌었는지 재확인하는 성격이다.
저장소 파일은 뮤테이션하지 않았다(`git status --short` 로 확인, 본 산출물 디렉터리 외
잔여물 없음).

## 이전 CRITICAL 의 현재 상태 — 직접 재확인

`review/code/2026/09/14/23_38_09/side_effect.md` 가 지적한 CRITICAL(`rotateBotToken` 이
`mergeIntoFreshSubKey` 의 `patch` 자리에 함수 시작 시점 **전체 스냅샷**(`mergedChannel`)을
넘겨, 락 안 재읽기로 얻은 `rateLimitPerMinute`/`uiMapping` 등을 무조건 되돌리던 결함)를
현재 `triggers.service.ts` 소스에서 직접 재확인했다:

```
this.mergeIntoFreshSubKey(
  freshConfig,
  'chatChannel',
  { ...(result.configUpdates ?? {}), botTokenRef, inboundSigningRef },  // patch = 델타
  mergedChannel as unknown as Record<string, unknown>,                  // fallback = 전체
)
```

`patch` 가 이번 회전의 산출(`configUpdates`/두 ref)로 좁혀졌고 `mergedChannel` 전체는
`fallback`(재읽은 행에 `chatChannel` 자체가 없을 때만 쓰이는 기준)으로만 남아 — 수정이
**실제로 적용되어 있음을 확인**했다. 회귀 테스트(`triggers.service.spec.ts`
`'rotateBotToken — 재읽은 chatChannel 의 다른 필드가 살아남는다'`)도 판별 fixture 요건(같은
키 `rateLimitPerMinute` 에 스냅샷=30·재읽기=99 로 서로 다른 값)을 충족하도록 고쳐져 있다.

## 발견사항 — 이번 라운드 기준 CRITICAL/WARNING 없음

새로 발견된 부작용은 없다. 이하는 side-effect 관점에서 기록해 둘 만한 항목이며, 전부
이전 라운드(`18_17_44`·`23_38_09`·`00_07_52`)에서 이미 INFO 로 등재·수용된 것을 이번
라운드에서 소스 대조로 재확인한 것이다 — 새 지적이 아니라 재확인이다.

- **[INFO]** 새 DB 레벨 공유 블로킹 자원(advisory lock)이 다수의 쓰기 경로를 상호 직렬화한다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (`acquireTriggerConfigLock`, `TRIGGER_CONFIG_LOCK_PREFIX`)
  - 상세: `pg_advisory_xact_lock(hashtext('trigger-config:<id>'))` 를 `update()`(창 1)·`remove()`·`rotateBotToken`·`normalizeNotificationSecretRef`·`revokePerTriggerToken`·`promoteRotatedNotificationSecrets`·`cleanupRotatedChatChannelTokens`·`ChatChannelBinderService.setupChatChannel` 성공/실패 경로가 공유한다. 이전에는 서로 독립적으로 완료되던 요청들이 이제 같은 트리거 id 기준으로 직렬화되며, 삭제 경로(5초 타임아웃)를 제외하면 대기 상한이 없다. 결함 수정을 위한 의도된 설계이고 concurrency/database 리뷰에서 이미 검토·수용됐다.
  - 제안: 조치 불요(설계 의도).

- **[INFO]** `SET LOCAL lock_timeout` 의 적용 범위가 advisory lock 하나가 아니라 트랜잭션 전체다
  - 위치: `trigger-config-lock.ts` — `acquireTriggerConfigLock`, `` `SET LOCAL lock_timeout = '${Math.trunc(options.timeoutMs)}ms'` ``
  - 상세: `lock_timeout` 은 그 트랜잭션이 이후 기다리는 **모든** 락(advisory lock 뿐 아니라 뒤따르는 `m.remove(trigger)` 의 행 잠금·`Schedule.triggerId` CASCADE 연쇄)에 적용된다. 다른 writer 가 그 행을 오래 붙잡고 있으면 advisory lock 과 무관한 사유로 `55P03` 이 날 수 있다 — 코드 주석에 이미 명시돼 있고, "삭제 경로에서는 조용한 지연보다 드러나는 오류가 낫다"는 판단으로 이미 수용됐다(`/ai-review` `review/code/2026/09/14/21_18_21` side_effect WARNING#6).
  - 제안: 조치 불요(문서화·수용됨).

- **[INFO]** `ChannelListenerRegistry.register()` 호출이 조건부로 바뀜 — 이벤트/콜백 발생 조건 변경
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` — `setupChatChannel` 성공 경로, `if (wrote) { this.channelListenerRegistry.register(...) }`
  - 상세: 종전엔 `triggerRepository.update()` 호출 뒤 무조건 등록했다. 이제는 `rewriteTriggerConfigLocked()` 가 락 안 재읽기에서 트리거가 그 사이 삭제된 것을 발견하면 `false` 를 반환하고, 그 경우 등록을 건너뛴다. 콜백 발생 시점·조건이 바뀌는 변경(점검 관점 8)이지만, 삭제된 트리거에 대한 유령 registry entry 를 막는 의도된 개선이며 이미 문서화·검토됐다.
  - 제안: 조치 불요.

- **[INFO]** `TriggersService.remove()` 삭제 실패 시 신규 에러 로그 + 신규 에러 유형(lock timeout) 추가
  - 위치: `triggers.service.ts` `remove()` — `.catch((err) => { this.logger.error(...); throw err; })`
  - 상세: 삭제 경로가 5초 advisory lock 타임아웃을 새로 도입해, 타임아웃 시 Postgres `55P03` 이라는 이전에 없던 에러 클래스가 발생할 수 있다. catch 블록이 "반쯤 삭제된 상태" 경고를 로그로 남긴 뒤 그대로 rethrow 하므로 최종 클라이언트 응답 처리 방식(컨트롤러가 그대로 propagate)은 동일하지만, 서버 로그에 새 관측 가능한 라인이 추가된다. 설계 의도(조용한 지연보다 드러나는 오류)로 문서화된 의도적 변경이다.
  - 제안: 조치 불요. 이 새 에러 로그 패턴이 운영 알람 룰에 걸리는지는 후속으로 확인할 만하다(blocking 아님).

- **[INFO]** 공개 시그니처 변경 없음 — 신규 export/private 헬퍼는 전부 additive
  - 위치: `triggers.service.ts`(`assertTriggerFound`·`mergeIntoFreshSubKey`·`throwTriggerNotFound`·`findByIdForUpdate` — 전부 `private`), `hooks.service.ts`(`touchLastTriggeredAt` — `private`), `trigger-config-lock.ts`(`triggerConfigLockKey`·`acquireTriggerConfigLock`·`rewriteTriggerConfigLocked`·`TRIGGER_DELETE_LOCK_TIMEOUT_MS`·`TRIGGER_CONFIG_LOCK_PREFIX` — 신규 export), `chat-channel-input-rules.ts`(`extractInboundSigningRef` — 신규 export), `endpoint-path-conflict-wrap-guard.ts`(`TRIGGER_ENTITY` — 신규 export, dev-only 정적 분석 가드)
  - 상세: 컨트롤러가 소비하는 공개 메서드(`findById`/`create`/`update`/`remove`/`rotateBotToken`/`revokePerTriggerToken` 등)의 파라미터·반환 타입은 변경되지 않았다. 신규 export 는 모두 순수 추가이며 기존 export 제거·시그니처 변경이 없어 다른 모듈의 호출자에 영향이 없다.
  - 제안: 조치 불요.

## 확인했으나 이슈 없음

- **환경 변수**: 신규 읽기/쓰기 없음. e2e 의 `process.env.E2E_BASE_URL` 은 기존 e2e 관례 재사용.
- **네트워크 호출**: 외부 provider 호출(`adapter.setupChannel`/`teardownChannel`)의 횟수·순서는 변경되지 않았고, 이번 수정의 핵심 설계 제약이 그 호출을 advisory lock **밖**에 유지하는 것이다(`spec/2-navigation/4-integration.md` 의 Cafe24 advisory-lock 기각 선례를 정확히 반영).
- **전역 변수**: 모듈 레벨 mutable state 신규 도입 없음. `trigger-config-lock.ts` 의 신규 export 는 상수(`TRIGGER_CONFIG_LOCK_PREFIX`·`TRIGGER_DELETE_LOCK_TIMEOUT_MS`)와 순수 함수뿐이다.
- **트랜잭션 중첩**: `rewriteTriggerConfigLocked` 를 부르는 모든 자리(binder 성공/실패 경로, `normalizeNotificationSecretRef`·`revokePerTriggerToken`·`rotateBotToken`·`promoteRotatedNotificationSecrets`)가 호출 시점에 바깥 트랜잭션이 이미 커밋된 뒤라 독립 트랜잭션으로 안전하게 열린다. `TriggersService.update()`(창 1) 내부에서 재귀적으로 `manager.transaction()` 을 또 여는 자리는 없다.
- **`schedules.service.ts` 의 `save(trigger)` → 컬럼 한정 `update()` 전환**: `Schedule.trigger` 관계에 `cascade: true` 가 없어(엔티티 확인), 이어지는 `scheduleRepository.save(schedule)` 이 `trigger` 서브엔티티를 다시 저장(cascade)해 방금 한 컬럼 갱신을 덮어쓸 위험은 없다.
- **`hooks.service.ts` 의 `touchLastTriggeredAt()`**: 두 호출부(`handleWebhook`, chat-channel 인입)가 `trigger.lastTriggeredAt` in-memory 갱신 + 컬럼 한정 `update()`로 관측 가능한 부작용을 동일하게 유지한다. 회귀 테스트가 `update` 호출의 patch 키를 `['lastTriggeredAt']` 로 정확히 단언해 `config` 재유입을 막는다.
- **`SET LOCAL lock_timeout` 문자열 보간**: `Math.trunc()` 로 숫자만 문자열에 들어가게 강제하고, 유일한 호출부가 모듈 상수 `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 하나만 넘긴다(`grep` 재확인) — 사용자 입력이 닿는 경로 없음, 인젝션 위험 없음.
- **파일시스템**: 이번 diff 에 파일 생성·삭제 로직 변경 없음(테스트/리뷰 산출물 제외).

## 요약

이 PR 은 이미 side-effect 관점만 3회 독립 검토됐고, 직전 라운드(`00_07_52`)가 지적한
유일한 CRITICAL(`rotateBotToken` 의 `patch` 가 델타가 아니라 전체 스냅샷이던 결함)은
`91b816498` 커밋으로 실제로 고쳐졌음을 이번 라운드에서 소스 코드를 직접 읽어 재확인했다.
그 이후 유일한 커밋(`3641ead21`)은 JSDoc 문구 교정과 테스트 fixture 추가뿐이라 side-effect
표면에 변화가 없다. 새로 도입된 advisory lock 공유 상태, `lock_timeout` 의 넓은 적용 범위,
조건부 `ChannelListenerRegistry.register()`, `remove()` 의 신규 에러 로그 등은 모두 의도된
설계로 이미 문서화·검토·수용된 항목이며 이번 라운드에서 새로 추가할 CRITICAL/WARNING 은
없다. 공개 API 시그니처·환경 변수·네트워크 호출·전역 변수는 변경되지 않았고, 신규 export 는
모두 additive 다.

## 위험도

LOW
