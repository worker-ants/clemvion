# 문서화(Documentation) Review

## 검토 범위

`codebase/backend/src/modules/{triggers,hooks,schedules}/**`·`repo-guards/**`·신규
`trigger-config-lost-update.e2e-spec.ts`·`CHANGELOG.md`·`plan/in-progress/trigger-config-lost-update.md`.
`plan/` 문서(§A~§D, 8라운드 처분 이력)를 전량 읽고 이번 라운드(9라운드, `23_01_18`)에서
**아직 등재되지 않은** 신규 결함만 추리는 방식으로 검토했다 — 이미 §D 표에 처분이 적힌
항목(예: `rewriteTriggerConfigLocked` 반환값 미소비, `redis-keys.md §4` 미등재, advisory
lock 32비트 키 공간 공유 등)은 이미 정확히 알려져 있으므로 재지적하지 않는다.

## 발견사항

- **[WARNING]** 신규 orphan JSDoc — `throwTriggerNotFound()` 의 설명이 엉뚱하게
  `mergeIntoFreshSubKey()` 위에 붙어 있다 (이 PR 이 이미 두 번 반복한 결함 클래스의 세 번째 재발)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:361`~`367` (orphan
    JSDoc 블록 시작) / 실제 대상 함수는 `:400` (`private throwTriggerNotFound(): never`)
  - 상세: 361~367줄의 JSDoc(`"«없다» 를 그대로 던진다 — 검증할 행이 아예 없는 자리용..."`)은
    명백히 `throwTriggerNotFound` 를 설명한다(문구 자체가 그 함수의 존재 이유를 서술).
    그런데 바로 다음에 **또 다른 JSDoc**(368~385줄, `mergeIntoFreshSubKey` 를 설명)이 곧바로
    이어지고, 실제 코드 선언(`private mergeIntoFreshSubKey(...)`, `:386`)은 그 **두 번째**
    JSDoc 에 붙는다. 결과적으로 `mergeIntoFreshSubKey` 위에는 자신과 무관한 `throwTriggerNotFound`
    설명이 앞서 뜨고(IDE 툴팁·문서 생성기가 두 블록을 이어 읽으면 헷갈린다), 정작
    `throwTriggerNotFound` 자신(`:400`)은 **JSDoc 없이** 정의돼 있다.
    이 PR 은 정확히 같은 결함 클래스를 이미 두 차례 자기 발견·수정했다 — plan §D 1라운드
    (`createBaseProviders`)와 6라운드 W3(`touchLastTriggeredAt` 이 `CCH-NF-03` docblock 을
    가로챈 사례, "이 PR 에서 **두 번째** 같은 클래스" 라고 스스로 적음). 이번이 **세 번째**다.
    `assertTriggerFound`(`:356`)를 만들며 그 보조 함수 `throwTriggerNotFound` 를 뒤로 밀어낼 때
    JSDoc 을 함께 옮기지 않아 생긴 것으로 보인다.
  - 제안: 361~367줄 블록을 `throwTriggerNotFound` 정의(`:400`) 바로 위로 옮긴다. 세 번째
    재발이므로, 이 PR 자신의 6라운드 교훈("산문 규율이 아니라 코드가 범위를 지킨다")을 그대로
    적용해 — 함수 정의 순서를 JSDoc 순서와 맞추거나(예: `throwTriggerNotFound` 를
    `assertTriggerFound` 바로 아래로 이동), 최소한 이번엔 이 자리를 직접 고쳐 네 번째 재발을
    막는다.

- **[INFO]** `create()` 안의 두 주석이 `setupChatChannel` 의 실제 쓰기 경로를 더 이상
  정확히 서술하지 않는다 — 이 PR 이 그 쓰기 방식을 바꿨기 때문
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:511`, `:705`
    (`// setupChatChannel 은 별도 triggerRepository.update 로 ...`)
  - 상세: 두 주석 다 "setupChatChannel 이 `triggerRepository.update` 를 별도로 부르므로
    in-memory 엔티티가 stale 하다" 고 설명한다. 이 설명의 핵심 결론(부분 컬럼 갱신이라
    in-memory 엔티티가 그 갱신을 모른다 → 재조회 필요)은 여전히 참이지만, 실제 호출
    경로는 이 PR 로 `this.triggerRepository.update(...)` 에서
    `rewriteTriggerConfigLocked(this.triggerRepository.manager, ...)`(advisory lock
    트랜잭션 안의 `EntityManager.update`)로 바뀌었다(`chat-channel-binder.service.ts` diff
    참조). 두 줄 다 이번 diff 의 편집 대상이 아니라(주석 자체는 수정되지 않음) 이 PR 이
    간접적으로 만든 드리프트다.
  - 제안: 급하지 않음(오해를 부르는 수준은 아니다) — 다음에 이 근처를 편집할 때
    `"별도 triggerRepository.update"` → `"별도 rewriteTriggerConfigLocked (락 안 컬럼 갱신)"`
    으로 갱신.

## 참고 (절차 투명성, 이슈로 집계하지 않음)

리뷰 종료 직전 `git status --short` 로 재확인하던 중, 내가 Read 전용으로만 다룬
`codebase/backend/src/modules/triggers/triggers.service.ts` 가 **워킹트리에서 수정된 채로
관측됐다** — `cleanupRotatedChatChannelTokens()` 안의
`await this.triggerRepository.update({ id: trigger.id }, { chatChannelTokenV2: null,
chatChannelRotatedAt: null })`(이 PR 의 diff 내용)가 종전 `await
this.triggerRepository.save(trigger)` 로 **되돌아가 있다**(주변 컬럼-한정 갱신 주석은 그대로
남은 채). 나는 이 파일에 Write/Edit 을 수행하지 않았다 — 병렬 fan-out 규약이 경고한 "다른
reviewer 가 같은 워킹트리를 동시에 뮤테이션한다" 상황으로 보인다(뮤테이션 검증 중인 다른
reviewer 의 원복 누락 가능성). 규약상 `git checkout`/`git restore` 로 직접 되돌리지 않고
그대로 기록만 남긴다 — 다음 라운드 리뷰어는 이 파일의 `cleanupRotatedChatChannelTokens` 를
결함으로 오인하지 말 것(원래 diff 는 `update()` 컬럼-한정 갱신이 맞다).

## 그 밖에 확인했지만 문제 없음으로 판정한 것 (오탐 방지 기록)

- `CHANGELOG.md` 신규 Unreleased 항목 — 직전 라운드(`18_17_44`) WARNING#1 이 지적한 부재가
  이번엔 채워져 있다. 본문의 「일곱 자리」열거(notification secret 정규화·회전, per-trigger
  토큰 폐기, 승격 cron 둘, chat-channel v2 정리 cron, schedule 편집 트리거 동기화)를 실제
  diff 와 대조 확인 — 정확히 일치한다. 「기존 행에 `save(entity)` 하는 자리가 하나도
  남지 않는다」는 문장도 diff 상의 `triggerRepository.save`/`triggerRepo.save` 호출 전수와
  대조 확인 — 남은 `save` 3건(두 `create()`, 창 1 의 락 안 `m.save`)은 전부 신규 INSERT
  또는 재읽은 최신 행 저장이라 예외 사유와 일치한다(위 "참고" 절의 워킹트리 이상 상태는
  이 결론과 무관 — diff 자체는 `update()` 로 고쳐져 있다).
- `spec/5-system/15-chat-channel.md` `code:` glob 미등재(직전 라운드 WARNING#2)는 plan
  §D "`--impl-prep`·`/ai-review` 등재 항목(planner 범위)" 표에 이미 올라 있다 — developer
  권한 밖이라 재지적하지 않는다.
- `trigger-config-lock.ts` 파일에 지배 plan 문서 포인터가 없다던 직전 라운드 INFO 는
  `:20-22` 의 신규 주석(`"상위 plan: plan/in-progress/trigger-config-lost-update.md ..."`)으로
  해소돼 있다.
- `hooks.service.ts` 의 `touchLastTriggeredAt` JSDoc — 두 호출부가 공유하는 이유·되돌아간
  결함 클래스·부재/형태 이중 단언 근거가 모두 실제 테스트(`hooks.service.spec.ts`)와 일치한다.
  orphan JSDoc 이 아니다 (6라운드에서 이미 이 문제를 직접 고친 자리).
- `trigger-config-lock.ts`·`chat-channel-binder.service.ts`(`survivesWithFresh`/`buildChannel`)의
  JSDoc은 인용하는 선례(`execution-engine.service.ts`, `workflows.service.ts`,
  `spec/2-navigation/4-integration.md` Cafe24 기각 사례)·자체 인용 리뷰 좌표 모두 실측
  대조에서 일치했다.
- `plan/in-progress/trigger-config-lost-update.md` 체크리스트 하단 3개 미체크 항목
  (`트래커 [x]+각주`·`run-test-all.sh`·`/ai-review + --impl-done`)은 이 라운드 리뷰가
  진행 중이므로 미체크 상태가 실제 상태와 일치한다 — stale claim 아님.
- `endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`/fixture 의 신규 주석(`TRIGGER_ENTITY`,
  콜백 경계 판정, `managerSaveWrapped`/`Unwrapped`/`OtherEntity` 대조군 설명)은 실제 판정
  로직·픽스처 형태와 대조해 불일치 없음.
- `mergeIntoFreshSubKey`·`extractInboundSigningRef` 의 `@param` 계약은 실제 호출부
  (`normalizeNotificationSecretRef`·`revokePerTriggerToken`·`promoteRotatedNotificationSecrets`)
  전부에서 지켜지고 있다.

## 요약

핵심 구현(`trigger-config-lock.ts`·`chat-channel-binder.service.ts`·`triggers.service.ts`·
`hooks.service.ts`·`schedules.service.ts`)의 JSDoc·인라인 주석·CHANGELOG·plan 문서는 8라운드에
걸친 자기 검증(뮤테이션 실측·라운드별 처분표·거짓 서술의 명시적 취소선 정정)을 거쳐 이례적으로
높은 정확도를 유지하고 있고, 직전 라운드가 지적한 CHANGELOG 부재·plan 포인터 부재는 이번에
해소됐다. 다만 새로 발견한 것이 하나 있다 — `assertTriggerFound`/`throwTriggerNotFound` 를
분리하는 리팩터 과정에서 `throwTriggerNotFound` 의 JSDoc 이 엉뚱하게 `mergeIntoFreshSubKey`
위로 밀려난 **orphan JSDoc** 이며, 이는 이 PR 이 스스로 두 차례(1라운드·6라운드) 반복해 자인한
바로 그 결함 클래스의 **세 번째 재발**이다. 그 외에는 이 PR 이 간접적으로 stale 하게 만든
사소한 주석 2곳(`create()` 안의 "별도 triggerRepository.update" 서술)이 있으나 핵심 결론은
여전히 참이라 낮은 우선순위다. 리뷰 종료 직전 다른 reviewer 의 것으로 보이는 워킹트리
뮤테이션 잔여물(`cleanupRotatedChatChannelTokens` 가 `save` 로 되돌아간 상태)을 관측해
기록해 두었다 — 내 발견사항 판단에는 영향 없음. 둘 다(orphan JSDoc·stale 주석) 배치를 막을
사유는 아니다.

## 위험도

LOW
