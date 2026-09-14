# 테스트(Testing) Review

## 검토 범위

이번 라운드(22_24_35)는 직전 라운드(`review/code/2026/09/14/21_50_09`)의 Critical#1(«config 를
다시 쓰는 네 자리 전부» 문장이 거짓이었다)에 대한 응답으로 커밋된 `a92bce095`("남은 일곱
자리까지 닫아 «모든 자리» 를 참인 문장으로 만든다")를 포함한다. 이전 라운드까지 이미 7번의
mutation-tested 검증 사이클을 거친 매우 성숙한 코드베이스라, 이번 리뷰는 **직전 라운드
이후 새로 닫힌 일곱 자리** 와 그 회귀 테스트에 집중했다.

방법: `git diff origin/main...HEAD` 전체 확인 + `git show a92bce095`(마지막 커밋)만 별도 확인,
그리고 가설 검증을 위해 프로덕션 코드를 **스크래치 디렉터리에 백업 후 직접 뮤테이션 →
`npx jest` 실행 → `cp` 로 원복**(`git checkout`/`restore` 미사용)했다. 뮤테이션 3건 모두 실행
직후 원복했고, 최종 `git status --short` 로 저장소가 깨끗함을 확인했다(현재 이 리뷰 산출물
디렉터리만 untracked로 남아 있다). 원복 후 `codebase/backend/src/modules/triggers`,
`schedules`, `hooks` 전체를 재실행해 447 passed / 1 skipped 를 확인했다.

## 발견사항

- **[CRITICAL]** `TriggersService.revokePerTriggerToken()` 의 삭제-경합 404 게이트가 **어떤
  테스트로도 지켜지지 않는다** — 뮤테이션으로 실측(전건 GREEN)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `revokePerTriggerToken()`
    본문의 `if (!wroteInteraction) this.throwTriggerNotFound();` 한 줄(`rewriteTriggerConfigLocked`
    호출 직후). 함수 시작은 `async revokePerTriggerToken(`.
  - 상세: 이 줄은 이번 라운드가 새로 추가한 코드다(커밋 `a92bce095`, CHANGELOG 상 "삭제 경합 시
    404"). `update()`·`rotateBotToken()`·`remove()` 는 각각 이 정확히 같은 클래스의 삭제-경합
    분기에 대해 `triggers.service.spec.ts` 의 "락 안 재읽기가 동시 확립분을 본다" describe 블록에
    전용 테스트(`update() — 그 사이 삭제된 트리거를 되살리지 않는다`, `rotateBotToken — 그 사이
    삭제되면 404 + 감사 미기록`)가 있는데, `revokePerTriggerToken` 만 빠져 있다. 실측: 이 한 줄을
    지우고 `npx jest src/modules/triggers/triggers.service.spec.ts` 를 돌리면 **141개 테스트
    전부 GREEN** 이다(원복 후 재확인 완료, 저장소에 잔여 변경 없음). `revokePerTriggerToken` 은
    라이브 동기 엔드포인트이고, 게이트가 사라지면 삭제된 트리거에 대해 `itk_*` 토큰을 생성해
    `RESOURCE_NOT_FOUND` 대신 **200 을 반환**하면서 아무 데도 쓰이지 않는 토큰을 돌려주는
    회귀가 조용히 재발할 수 있다 — 정확히 이 PR 이 `rotateBotToken`/`update()` 에서 막았다고
    주장하는 것과 같은 결함 클래스다.
  - 제안: 같은 describe 블록에 `revokePerTriggerToken — 그 사이 삭제되면 404` 테스트를 추가한다
    (패턴은 이미 있는 `rotateBotToken — 그 사이 삭제되면 404 + 감사 미기록` 테스트를 그대로
    따르면 된다 — `freshSequence` 를 `[() => undefined as never]` 로 주고
    `rejects.toMatchObject({ response: { code: 'RESOURCE_NOT_FOUND' } })` + 감사 미기록을 단언).

- **[CRITICAL]** `TriggersService.normalizeNotificationSecretRef()` 가 이번 PR 의 핵심 수정
  (락 안 재읽기)을 실제로 타는지 **어떤 테스트도 검증하지 않는다** — 뮤테이션으로 실측(전건
  GREEN)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `normalizeNotificationSecretRef()`
    본문의 `rewriteTriggerConfigLocked(this.triggerRepository.manager, trigger.id, (freshConfig) =>
    ({ ...freshConfig, notification: normalizedNotification }))` 호출부. `create()`(사설
    notification signing 평문 정규화)와 `update()` 양쪽에서 호출된다.
  - 상세: 이 함수는 `a92bce095` 가 새로 락 기반 재작성으로 바꾼 "일곱 자리" 중 하나다
    (CHANGELOG/커밋 메시지: *"`normalizeNotificationSecretRef` — `config.notification` 재작성 →
    락 안 재작성"*). 그런데 이 함수를 락 안 재읽기 없이 **요청 시작 시점 스냅샷**(`trigger.config`)
    위에 병합하는 옛 방식으로 되돌려도 `triggers.service.spec.ts` **141개 테스트 전부 GREEN**
    이었다(실측, 원복 완료). 기존 테스트(`triggerRepo.save`→`update` 로 어서션만 갈아 끼운
    자리, 예: `savedSigning.notification.signing.secret` 단언)는 "secret 이 제거됐는가" 만
    보고 "그 값이 어느 config 위에 병합됐는가" 는 보지 않는다. 이 자리는 `create()`/`update()`
    양쪽에서 사용자가 notification 서명 평문을 보낼 때마다 지나가므로, 동시에 커밋된
    `chatChannel.inboundSigningRef` 를 되돌려 인입 서명 fail-open 을 재현할 수 있는 **살아있는
    경로**다 — 이 PR 전체가 막으려는 결함 클래스가 정확히 여기로 재발할 수 있는데, 그 사실을
    보호하는 테스트가 없다.
  - 제안: `triggers.service.spec.ts` 의 "락 안 재읽기가 동시 확립분을 본다" suite 패턴
    (`freshFindOne` 로 두 읽기를 갈라 놓는 방식)을 이 자리에도 적용해, notification 정규화가
    지나가는 PATCH/생성 요청에서 락 안 재읽은 행이 방금 확립한 `chatChannel.inboundSigningRef`
    가 살아남는지 단언하는 테스트를 추가한다.

- **[CRITICAL]** `SchedulesService.update()` 의 trigger 컬럼 한정 쓰기(이번 PR 의 수정 대상)가
  `save(trigger)` 로 되돌아가도 `schedules.service.spec.ts` **21개 테스트 전부 GREEN** —
  뮤테이션으로 실측
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` — `update()` 메서드의
    `if (trigger) { const patch: Partial<Pick<Trigger, 'name' | 'isActive'>> = {}; ...
    await this.triggerRepository.update({ id: trigger.id }, patch); }` 블록(파일 4 diff 게이트
    기준 신규 추가분).
  - 상세: 이 블록 전체를 `await this.triggerRepository.save(trigger);` (이번 PR 이 고치려던
    원래 형태)로 되돌려도 `npx jest src/modules/schedules/schedules.service.spec.ts` 가
    **21개 전부 통과**한다(실측, 원복 완료). 원인은 `schedules.service.spec.ts` 의 유일한 관련
    단언(`수정 — isActive:false 로 비활성화해도 응답에 trigger 가 실린다`, 파일 상 line
    466 부근)이 **in-memory** `saved.trigger = trigger ?? schedule.trigger` 재부착만 검사하기
    때문이다 — 이 대입은 DB 쓰기가 `update` 든 `save` 든 삭제됐든 무관하게 항상 일어난다.
    이 PR 의 diff(파일 4)는 트리거 repo mock 에 `update: jest.fn()` 을 **추가만** 했을 뿐(에러
    방지용 배선), `triggerRepo.update` 가 실제로 올바른 patch 로 호출되는지, `triggerRepo.save`
    가 호출되지 **않는지**를 단언하는 테스트는 하나도 추가되지 않았다. `triggers.service.ts` ·
    `hooks.service.ts` 의 동급 컬럼-한정 전환은 전부 `expect(repo.update).toHaveBeenCalledWith(...)`
    + `expect(repo.save).not.toHaveBeenCalled()` 쌍으로 지켜지는데, 이 자리만 그 규율에서
    빠졌다 — 이 PR 이 스스로 반복해 온 "복제·전환에는 회귀 테스트가 따라와야 한다" 원칙에서
    벗어난 유일한 자리로 보인다.
  - 제안: `schedules.service.spec.ts` 의 "수정 — isActive:false…" 테스트(또는 인접 신규 테스트)에
    `expect(triggerRepo.update).toHaveBeenCalledWith({ id: 'trig-tr' }, { isActive: false })`
    와 `expect(triggerRepo.save).not.toHaveBeenCalled()` 를 추가한다. `name` 단독 변경·
    `name`+`isActive` 동시 변경·`Object.keys(patch).length === 0`(둘 다 미지정) 세 분기도
    함께 걸면 더 좋다 — 지금은 `if (dto.name) patch.name = …` 분기와 `if
    (Object.keys(patch).length > 0)` 게이트도 어떤 테스트로도 구분되지 않는다.

- **[INFO]** 위 세 CRITICAL 발견은 같은 커밋(`a92bce095`)이 닫은 "일곱 자리" 중 세 곳이고,
  나머지 네 곳(`rotateNotificationSecret`·`cleanupRotatedChatChannelTokens`·
  `promoteRotatedNotificationSecrets` 의 두 쓰기)은 이미 `triggerRepo.update`
  호출 인자 + `triggerRepo.save` 미호출을 명시적으로 단언하는 테스트가 있어 이 리뷰의
  뮤테이션 확인 대상에서 제외했다(코드 리딩으로 재확인만 함). 이 비대칭(7곳 중 4곳은
  단언이 갱신됐고 3곳은 mock 배선만 갱신됨) 자체가, 커밋 메시지가 주장하는 *"도구는 이미
  있고 테스트도 서 있었다"* 는 문장이 이번엔 실측 없이 쓰였을 가능성을 시사한다 — 이 PR
  히스토리(§D)가 스스로 여러 번 지적해 온 "서술이 구현보다 넓다" 패턴과 같은 모양이다.

- **[INFO]** 그 외 범위(핵심 lock 프리미티브 `trigger-config-lock.ts`/`.spec.ts`, 락 재읽기
  대응표 suite, hooks.service.ts 두 자리, e2e 레이스 재현, endpoint-path-conflict-wrap 가드)는
  이례적으로 성숙한 mutation-tested 회귀 테스트를 갖추고 있다. 특히 `__test-utils__/trigger-transaction-mock.ts`
  가 "두 읽기가 같으면 재읽기 동작이 관측되지 않는다"는 근본 원인을 정확히 짚고
  `freshFindOne`/`onLock`/`onLockTimeout` 관측 고리를 마련한 설계, `triggers.service.spec.ts`
  의 "락 안 재읽기가 동시 확립분을 본다" suite 가 재읽기가 **두 번** 일어나는 지점(창1·binder)을
  `freshSequence` 로 갈라 각 자리를 독립적으로 죽이는 뮤턴트-대응표를 문서화한 점은 이
  코드베이스에서 본 것 중 상위권의 테스트 설계다. `trigger-config-lost-update.e2e-spec.ts` 도
  advisory lock 을 테스트가 직접 쥐어 결정론적으로 레이스를 재현하고, 세 단언(①②③)이 서로
  다른 실패 모드를 물도록 설계돼 있다. 이 부분은 위 세 CRITICAL 과 대조적으로 조치 불필요.

## 요약

이번 PR 은 트리거 config lost-update(인입 서명 fail-open) 를 막는 8라운드째 수정이며, 대부분의
쓰기 지점에 대해 이례적으로 엄격한 mutation-tested 회귀 테스트(관측 고리·순서 단언·양성/음성
대조군·자리별 뮤턴트 대응표)를 갖추고 있다. 그러나 마지막 커밋(`a92bce095`)이 "모든 자리를
닫는다"는 CHANGELOG 문장을 참으로 만들기 위해 새로 락 기반 재작성으로 전환한 **일곱 자리 중
세 곳**(`revokePerTriggerToken` 의 삭제-경합 404 게이트, `normalizeNotificationSecretRef` 의
락 안 재읽기, `SchedulesService.update()` 의 컬럼 한정 갱신)은 실제로 뮤테이션 테스트를 하면
전건 GREEN 이 나온다 — 즉 이 PR 자신이 막으려는 결함 클래스가 이 세 자리에서 회귀해도 현재
테스트 스위트는 알아채지 못한다. 세 건 모두 프로덕션 코드를 스크래치 백업 후 직접 뮤테이션해
실측했고 즉시 원복해 저장소는 깨끗한 상태다. 이 PR 이 반복적으로 스스로 지적해 온 "전환에는
반드시 회귀 테스트가 따라와야 한다"·"서술이 구현보다 넓으면 안 된다" 원칙이 바로 이 마지막
커밋에서 부분적으로 깨졌다.

## 위험도

CRITICAL
