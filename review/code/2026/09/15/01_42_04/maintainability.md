# 유지보수성(Maintainability) 리뷰 — trigger-config-lost-update

## 검토 범위

`origin/main...HEAD` 기준 실제 코드 diff(19개 파일, `codebase/**` + `CHANGELOG.md` +
`plan/in-progress/**`)를 대상으로 했다. `review/code/**`·`review/consistency/**` 하위의
과거 라운드 산출물(마크다운 리포트)은 프로세스 아티팩트이며 유지보수성 관점의 "코드"가
아니므로 이번 리뷰 대상에서 제외했다. 다음 파일을 `git diff`/`Read` 로 전체 컨텍스트까지
직접 확인했다: `trigger-config-lock.ts`(신규), `hooks.service.ts`, `schedules.service.ts`,
`chat-channel-binder.service.ts`, `triggers.service.ts`, `chat-channel-input-rules.ts`,
`__test-utils__/trigger-transaction-mock.ts`(신규), `endpoint-path-conflict-wrap-guard.ts`,
그리고 관련 스펙/픽스처 파일.

## 발견사항

- **[WARNING]** 트리거 행 삭제의 "락 획득 → 삭제 → 실패 로깅·재던짐" 블록이 두 서비스에
  거의 동일하게 복제돼 있다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()` (약 1025~1039줄,
    `await this.triggerRepository.manager.transaction(...).catch(...)` 블록) vs
    `codebase/backend/src/modules/schedules/schedules.service.ts` `remove()` (약 313~331줄,
    같은 형태의 `await this.triggerRepository.manager.transaction(...).catch(...)` 블록)
  - 상세: 두 블록 모두 `manager.transaction(async (m) => { await acquireTriggerConfigLock(m, id, { timeoutMs: TRIGGER_DELETE_LOCK_TIMEOUT_MS }); await m.remove/delete(...); }).catch((err) => { this.logger.error(‹반쯤 삭제 메시지›); throw err; })` 형태로, 차이는 `m.remove(trigger)` vs `m.delete(Trigger, triggerId)`와 로그 메시지 문구뿐이다. 이 PR 자신의 `trigger-config-lock.ts` JSDoc 이 "락 획득 SQL 을 바꿀 일이 생기면 한쪽만 고칠 위험이 구조적으로 남는다"는 근거로 `acquireTriggerConfigLock` 자체를 프리미티브로 뽑아냈는데, 그 프리미티브를 감싸는 "트랜잭션+락+삭제+실패로깅+재던짐" 이라는 한 단계 위 패턴은 여전히 두 자리에 손으로 복제돼 있다 — 같은 근거가 그대로 적용되는 자리다. 실제로 스케줄 삭제 쪽 주석이 "`TriggersService.remove()` 와 **대칭**이어야 한다"고 명시하고 있어, 작성자도 이 쌍을 인지하고 있다.
  - 제안: `trigger-config-lock.ts` 에 `deleteTriggerRowLocked(manager, id, { onRemove: (m) => m.remove(trigger) | m.delete(Trigger, id), logger, contextLabel })` 류의 공용 헬퍼를 하나 더 뽑아 두 자리가 같은 코드를 지나가게 하면, 다음에 락 타임아웃 처리나 에러 메시지 포맷을 바꿀 때 한쪽만 고치고 다른 쪽을 놓치는 drift 위험이 사라진다. 다만 두 자리 모두 이미 촘촘한 회귀 테스트(순서·타임아웃 문자열까지 단언)를 갖고 있어 지금 당장 블로킹할 사유는 아니다.

- **[INFO]** `TriggersService.update()` 가 이미 길었던 메서드에 트랜잭션 콜백 한 단계를 더 얹었다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `update()` (540~721줄, 약 180줄)
  - 상세: 이 메서드는 schedule 타입 필드 제한 검증·notification/chatChannel 안전성 검증·authConfig 검증·config 병합(이번 PR 이 `manager.transaction` 콜백으로 감쌈)·감사 기록·schedule 활성 동기화·notification secret 정규화·chatChannel setup·재조회·응답 정화까지 한 함수에 담고 있다. 이번 PR 은 이 중 "병합+저장" 구간(621~671줄)을 advisory lock 트랜잭션 콜백으로 새로 감싸 중첩 depth 를 한 단계 더 올렸다. 각 구간의 근거 주석은 훌륭하지만, 함수 하나가 스캔해야 하는 로컬 상태(`previousInboundSigningRef`, `defined`, `baseConfig`, `mergedConfig`, `target` 등)가 늘어 인지 부하가 누적되는 방향이다.
  - 제안: 621~671줄의 "락 안 재읽기 + 병합 + save" 구간을 `rewriteAndSaveTriggerLocked(manager, id, workspaceId, mergeFn)` 류의 private 메서드로 뽑아 `update()` 본문에서는 그 결과(`saved`, `previousInboundSigningRef`)만 받게 하면, 트랜잭션 콜백 내부 로직을 열어 보지 않고도 `update()` 의 전체 흐름을 스캔할 수 있다. 급하지 않음 — 기존에도 이런 길이였고 이번 PR 이 새로 만든 문제는 아니다.

- **[INFO]** `ChatChannelBinderService.setupChatChannel()` 은 여전히 길고, 이번 PR 이 두 클로저를 하나로 합쳤지만 함수 길이 자체는 줄지 않았다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` `setupChatChannel()` (87~323줄, 약 237줄)
  - 상세: 종전 라운드에서 `buildFallbackChannel`/`buildMergedChannel` 두 클로저의 중복이 WARNING 으로 지적됐고, 이번 PR 은 그 지적대로 `buildChannel` 하나로 통합했다(긍정적 개선). 다만 그 결과로도 함수 자체는 secret 3중 쓰기·plaintext 제거·presence 게이트 재계산(`survivesWithFresh`)·`buildChannel` 정의·adapter 호출·성공/실패 두 분기의 락 안 재작성을 여전히 한 메서드 안에 담고 있어, 로컬 클로저 2개(`survivesWithFresh`, `buildChannel`)를 포함한 전체 길이는 줄지 않았다.
  - 제안: presence-gate 재계산과 config 조립(`survivesWithFresh`/`buildChannel`)을 메서드 밖의 모듈 레벨 순수 함수로 뽑아 `internalCfg`/`inboundSigningRef`/`botTokenRef` 를 명시적 인자로 받게 하면 메서드 본문의 스캔 범위가 줄어든다. 이전 라운드에서 이미 제안된 항목이라 반복 지적은 아니고, 이번엔 "일부는 개선됐지만 전체 길이는 그대로"라는 상태 갱신이다.

- **[INFO]** `SchedulesService.update()` 의 컬럼 한정 patch 가 엔티티를 먼저 mutate 한 뒤 그 값을 다시 읽어 담는 간접 경로를 쓴다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` `update()` — `patch.name = trigger.name`, `patch.isActive = trigger.isActive` (약 248~250줄)
  - 상세: 바로 위 233~239줄에서 `trigger.name = dto.name`, `trigger.isActive = dto.isActive` 로 이미 값을 대입해 놓고, 새로 추가된 patch 블록은 `dto.name`/`dto.isActive` 를 직접 쓰지 않고 방금 대입한 `trigger.name`/`trigger.isActive` 를 다시 읽어 담는다. 현재는 두 값이 항상 동일하므로 동작에 문제는 없지만, 다음 사람이 이 코드를 읽을 때 "`trigger.name` 이 `dto.name` 과 다를 수 있어서 굳이 엔티티에서 재조회하는가"라는 불필요한 의문을 유발한다.
  - 제안: `patch.name = dto.name`, `patch.isActive = dto.isActive` 로 직접 원본 값을 쓰거나, 굳이 엔티티 경유가 필요한 이유(예: 응답용 `trigger` 참조와 patch 값이 항상 같은 소스여야 한다는 불변식)가 있다면 그 이유를 한 줄 주석으로 남기면 간접 경로에 대한 오해를 없앨 수 있다. 급하지 않음.

- **[INFO]** `withTransactionMock()` 내부의 5개 위임 클로저가 거의 동일한 캐스트-후-위임 패턴을 반복한다
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` — `findOne`/`delete`/`remove`/`save`/`update` mock (약 107~135줄)
  - 상세: 각 클로저가 `const xMock = triggerRepoMock.x as (...) | undefined; return xMock ? xMock(...) : fallback;` 형태를 인자 개수만 다르게 5번 반복한다. 이 헬퍼 자체는 종전에 8개 호출부에 흩어져 있던 `manager` mock 배선을 한 곳으로 모은 좋은 리팩터라(이전 라운드에서도 긍정 평가됨) 이 지적은 그 안의 반복을 조금 더 줄일 수 있다는 수준의 사소한 지적이다.
  - 제안: `delegate<A extends unknown[]>(mockFn: ((...a: A) => unknown) | undefined, args: A, fallback?: unknown)` 같은 제네릭 헬퍼로 5곳의 캐스트-분기를 한 줄씩으로 줄일 수 있다. 테스트 전용 유틸이라 급하지 않음.

## 긍정적으로 확인한 점 (참고)

- `hooks.service.ts` 의 `touchLastTriggeredAt` 추출은 정확히 이 PR 을 물었던 실제 회귀(두 호출부 중 한쪽만 테스트가 있어 복제된 코드의 다른 쪽이 되돌려져도 GREEN 이었던 사례)를 근거로 중복을 제거했고, 근거를 코드 주석에 명시했다.
- `chat-channel-input-rules.ts` 의 `extractInboundSigningRef` 추출은 세 자리에 복제돼 있던 동일 인라인 캐스트(`{ chatChannel?: { inboundSigningRef?: string } }`)를 이름 있는 함수 하나로 모았고, 새 `it.each` 스펙(7케이스: 정상·부재·null·키 없음 등)으로 그 함수의 입출력을 격리해 고정했다 — 네이밍이 목적을 정확히 드러낸다.
- `TriggersService.mergeIntoFreshSubKey` / `assertTriggerFound` / `throwTriggerNotFound` 추출은 이 PR 스스로 반복 지적하는 "복제가 drift 를 부른다"는 원칙을 실제로 지켰다 — 동일 리터럴(`RESOURCE_NOT_FOUND`)이 네 곳에 흩어져 있던 것과, "재읽은 config 의 하위 키 위에 병합"이라는 패턴이 여러 메서드(`normalizeNotificationSecretRef`·`revokePerTriggerToken`·`promoteRotatedNotificationSecrets`·`rotateBotToken`)에서 일관되게 재사용된다.
- `endpoint-path-conflict-wrap-guard.ts` 의 `TRIGGER_ENTITY` 상수·콜백 경계 판정 로직은 왜 두 형태(`triggerRepository.save` vs `manager.save(Trigger, …)`)를 모두 봐야 하는지 근거를 명확히 남겼고, 새 양성/음성/타 엔티티 판별 fixture(`managerSaveWrapped`/`managerSaveUnwrapped`/`managerSaveOtherEntity`)로 술어의 경계를 실제로 고정했다.
- 매직 넘버 없음 — `TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000`, e2e 의 폴링 상수 등 모두 의미가 드러나는 이름으로 선언되고 존재 이유가 주석에 있다.
- 네이밍은 목적을 잘 드러낸다 (`acquireTriggerConfigLock`, `rewriteTriggerConfigLocked`, `triggerConfigLockKey`, `mergeIntoFreshSubKey`, `touchLastTriggeredAt`, `extractInboundSigningRef`).

## 참고 (절차 투명성, 이슈로 집계하지 않음)

리뷰 종료 시점 `git status --short` 확인 중 `plan/in-progress/trigger-config-lost-update.md` 와
`plan/in-progress/spec-draft-nullable-notation-followups.md` 가 **이 세션이 만들지 않은**
미커밋 diff(각각 +8/-2, +16/-1)를 갖고 있는 것을 관측했다. 이 리뷰는 두 파일 모두 Write/Edit
하지 않았고(코드 diff 만 `git diff`/`Read` 로 조회), 원본을 건드리지도 되돌리지도 않았다.
병렬 fan-out 리뷰 규약이 경고한 "다른 프로세스가 같은 워킹트리를 동시에 mutate" 상황으로
보이며, 두 파일 모두 이번 유지보수성 리뷰의 코드 대상(`codebase/**`)이 아니라 분석 결론에는
영향이 없다. 다음 라운드 리뷰어를 위해 기록만 남긴다.

## 요약

이 변경은 트리거 config 의 lost-update 를 advisory lock 기반 read-merge-write 로 닫으면서, 그 과정에서 발견한 열한 곳의 유사 위험 지점(구조적 위험 4곳 + 의도치 않은 전체 저장 7곳)을 컬럼 한정 갱신 또는 락 안 재작성으로 정리했다. 이전 라운드에서 지적된 클로저 중복(`buildFallbackChannel`/`buildMergedChannel`)과 로직 중복(`touchLastTriggeredAt`, 인라인 캐스트 세 자리)은 이번 라운드에서 실제로 해소됐고, 그 해소 자체가 이름 있는 순수 함수·공용 헬퍼로 이어져 전체적인 중복은 오히려 줄었다. 남은 지적은 새로 생긴 하나의 실질적 중복(두 `remove()` 의 "락+삭제+실패로깅" 블록)과, 이미 컸던 함수(`update()`, `setupChatChannel()`)의 길이·중첩이 이번 PR 로 소폭 더 깊어졌다는 것, 그리고 사소한 간접 경로·테스트 헬퍼 반복 두 건이다. 전부 차단 사유가 아니며, 특히 새 코드의 네이밍·근거 문서화·회귀 테스트 밀도는 이 코드베이스의 기존 컨벤션과 일관되고 오히려 그 컨벤션을 모범적으로 따른다.

## 위험도

LOW
