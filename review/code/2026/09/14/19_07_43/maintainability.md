# 유지보수성(Maintainability) Review

## 검토 범위

이번 라운드는 직전 라운드(`review/code/2026/09/14/18_17_44`)의 security CRITICAL(창 1 재현)·testing
CRITICAL(락 안 재읽기 무보호)을 닫는 후속 커밋이다. 실제 코드 변경은
`chat-channel-binder.service.ts`(`buildChannel` 통합) · 신규 `trigger-config-lock.ts`/`.spec.ts` ·
`triggers.service.ts`(창 1 lock 배선) · 신규 `__test-utils__/trigger-transaction-mock.ts` · 두 테스트
파일 배선 · `endpoint-path-conflict-wrap-guard.ts`(트랜잭션 콜백 경계 추적) 다. `CHANGELOG.md`·
`plan/in-progress/*.md`·`review/**` 산출물은 코드가 아니므로 유지보수성 관점 평가 대상에서 제외했다.

먼저 확인한 것: 직전 라운드 maintainability WARNING(`buildFallbackChannel`/`buildMergedChannel` 이
거의 동일한 스프레드-조건을 반복)은 이번 라운드에서 `buildChannel` 단일 함수로 통합되어 **해소됐다**
(`chat-channel-binder.service.ts:226-241`, 통합 근거를 그 자리 JSDoc 이 직접 인용한다). 좋은 수정이다.

## 발견사항

- **[WARNING]** advisory lock 획득 SQL 이 두 곳에 손으로 두 번 쓰여 있다 — 유틸리티가 있는데도
  재사용되지 않았다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:81-83`
    (`rewriteTriggerConfigLocked` 내부) vs
    `codebase/backend/src/modules/triggers/triggers.service.ts:551-553` (`update()` 창 1)
  - 상세: 두 자리 모두 정확히 같은 리터럴 `'SELECT pg_advisory_xact_lock(hashtext($1))'` 를
    `triggerConfigLockKey(...)` 와 함께 부른다. `trigger-config-lock.ts` 의 JSDoc 은 "네 자리
    전부를 advisory lock 안으로" 라고 설계 의도를 명시하는데, 정작 그 파일이 내보내는 것은
    `rewriteTriggerConfigLocked`(간단한 `config` 서브키 머지 전용, `m.update` 고정)뿐이라 `update()`
    처럼 엔티티 전체를 `m.save(Trigger, trigger)` 로 저장해야 하는 창 1 은 이 유틸리티를 못 쓰고
    "락 획득" 단계 자체를 다시 손으로 적었다. 지금은 두 곳의 리터럴이 우연히 일치하지만, 락
    쿼리나 키 포맷을 나중에 바꿀 때(예: `lock_timeout` 을 추가하는 이 파일의 자기 예고, 79행) 한
    곳만 고치고 다른 곳을 놓치는 drift 위험이 그대로 있다 — 이 PR 자체가 "쌍으로 된 로직은
    한쪽만 고치기 쉽다"는 교훈을 `buildChannel` 통합으로 방금 학습했는데, 같은 형태의 위험이 락
    획득 단계에는 남았다.
  - 제안: "advisory lock 을 잡는다" 는 단계 자체를 별도로 뽑아
    (`acquireTriggerConfigLock(manager, triggerId): Promise<void>` 또는
    `withTriggerConfigLock(manager, triggerId, cb)` 형태로 "락 획득 + 트랜잭션"만 감싸고 읽기/머지/
    쓰기는 호출자에게 맡김), `rewriteTriggerConfigLocked` 와 `update()` 양쪽이 그 안쪽 단계만
    다르게 채우도록 하면 리터럴 중복이 사라진다.

- **[WARNING]** 같은 함수(`update()`) 안에서 동일한 인라인 타입 캐스트가 48줄 간격으로 두 번
  반복되고, 세 번째 사본이 다른 파일에도 있다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:512-514`(최초 계산) 및
    `:560-562`(락 안 재계산) — 같은 함수 안의 두 사본. 세 번째 사본:
    `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:209-210`
    (`survivesWithFresh` 내부).
  - 상세: 세 자리 모두 `{ chatChannel?: { inboundSigningRef?: string } }` 라는 동일한 부분 타입을
    인라인으로 재정의한다. 직전 라운드 maintainability 리뷰가 이미 이 패턴을 INFO(중복 2건, 파일
    2개)로 지적했는데, 이번 PR 이 같은 파일 `triggers.service.ts` 안에 **세 번째 사본**을 추가하며
    악화됐다 — 특히 512-514 와 560-562 는 같은 함수의 같은 관심사(“이 트리거의 이전
    `inboundSigningRef` 추출”)를 두 번 손으로 반복한 것이라 다른 파일의 사본보다 더 쉽게
    합칠 수 있었던 자리다. `ChatChannelConfig` 의 `inboundSigningRef` 필드명이 바뀌면 세 곳을
    동시에 찾아 고쳐야 하는데, grep 으로 걸리는 것은 리터럴 필드명뿐이고 타입 이름이 없어
    누락되기 쉽다.
  - 제안: `extractInboundSigningRef(config: Trigger['config'] | Record<string, unknown>):
    string | undefined` 같은 이름 있는 헬퍼 하나로 세 자리를 교체한다. 적어도 같은 함수 안의
    두 사본(512-514, 560-562)만이라도 로컬 헬퍼로 묶으면 이번 PR 범위 안에서 중복이 늘어난
    부분은 해소된다.

- **[INFO]** `update()` 가 이미 매우 긴 메서드(약 160줄)인데, 이번 PR 이 락 획득·재읽기·게이트
  재계산 로직(~40줄)을 그 안에 그대로 인라인했다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:466`(메서드 시작)~`:626`
    (메서드 끝), 신규 블록은 `:534`~`:576`("── 창 1 ──" 주석부터 `.catch(...)` 까지)
  - 상세: `update()` 는 이미 schedule 타입 필드 제한 검증·`chatChannel` 입력 검증·
    `authConfigId` 워크스페이스 검증·optional-필드 undefined 필터링·감사 로깅·schedule 역동기화·
    secret ref 정규화·chatChannel 바인딩·재조회까지 담당하는 오케스트레이터였다. 이번 PR 은 거기에
    "advisory lock 획득 → 커밋된 최신 행 재읽기 → 보존 게이트 재계산 → merge → save" 라는 또 하나의
    완결된 책임을 트랜잭션 콜백으로 통째로 얹었다. 로직 자체는 (앞선 리뷰가 실측한 대로) `save(trigger)`
    의 의미(반환 엔티티·subscriber·UNIQUE 충돌 경로)를 지키기 위해 지금 형태여야 했던 것으로
    보이지만, 결과적으로 메서드 하나가 스캔해야 할 로컬 상태·분기가 한 단 더 늘었다.
  - 제안: 급하게 바꿀 사유는 아니다(이번 PR 은 보안 회귀를 닫는 것이 최우선이었다). 다음에 이
    메서드를 다시 만질 일이 있으면, "── 창 1 ──" 블록(534-576행)을 `private async
    saveWithConfigLock(trigger, workspaceId, dto 관련 값들): Promise<Trigger>` 형태의 별도
    private 메서드로 뽑아 `update()` 본문을 오케스트레이션 수준으로 되돌리는 것을 고려.

- **[INFO]** `previousInboundSigningRef` 가 `let` 으로 선언되고 트랜잭션 콜백 **안에서** 재대입된다
  — 값의 최종 확정 시점이 코드 흐름만 봐서는 바로 드러나지 않는다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:512`(선언) → `:560-562`(락
    콜백 안 재대입) → `:609`(사용 — `preservedInboundSigningRef: previousInboundSigningRef`)
  - 상세: 지금은 `await this.triggerRepository.manager.transaction(...)` 이 완료된 뒤에야 609행이
    실행되므로 정확하다. 다만 "콜백이 외부 변수를 mutate 하고, 콜백 밖에서 그 변수를 나중에 읽는다"
    는 패턴은 두 지점이 멀리 떨어져 있어(48줄) 다음에 이 함수를 편집하는 사람이 609행만 보고는
    `previousInboundSigningRef` 가 이미 "재읽은 값으로 갱신됐다"는 사실을 놓치기 쉽다. 예컨대 저장
    실패를 다른 방식으로 처리하도록 바꾸며 `.catch()` 앞뒤 순서를 건드리면 이 mutation 의 완료
    시점 보장이 조용히 깨질 수 있다.
  - 제안: 트랜잭션 콜백이 `{ savedTrigger, previousInboundSigningRef }` 를 함께 반환하고,
    `update()` 본문에서 `const { previousInboundSigningRef } = await ...` 로 구조분해하면 데이터
    흐름이 mutation 없이 명시적으로 드러난다.

## 긍정적으로 확인한 점

- 직전 라운드 WARNING(`buildFallbackChannel`/`buildMergedChannel` 중복)을 `buildChannel` 단일
  함수로 정확히 해소했다 — 두 클로저가 갈라져 있던 이유(성공/실패 경로의 `configUpdates`·
  `issuedInboundSigning` 차이)를 옵셔널 `setupResult` 파라미터 하나로 흡수해, "한쪽만 고치는 drift"
  구조 자체를 제거했다.
- `trigger-config-lock.ts` 는 단일 책임(advisory lock + 재읽기 + 머지 + 쓰기)의 작고 순수한
  유틸리티로 잘 분리돼 있고, 왜 그런 형태인지(외부 호출을 락 밖에 두는 이유, 대기 상한이 없는
  이유, JSONB 캐스트가 필요한 이유)를 실제 저장소 선례(Cafe24 advisory-lock 기각,
  `execution-engine.service.ts`)를 인용해 설명한다 — 결정의 배경이 코드 옆에 남아 있다.
  네이밍(`triggerConfigLockKey`, `rewriteTriggerConfigLocked`, `survivesWithFresh`)도 목적을 잘
  드러낸다.
  - 하드코딩 상수 `TRIGGER_CONFIG_LOCK_PREFIX`·테스트의 `RATE_LIMIT_FROM_A/B`·`SETTLE_MS`·
    `UNTOUCHED_KEY` 등 매직 넘버/문자열은 전부 이름 있는 상수로 선언되고 각각 존재 이유가
    주석에 있다.
- `trigger-transaction-mock.ts` 로 8개 테스트 describe 블록에 흩어져 있던 `manager.transaction`
  mock 배선을 하나로 통합한 것은 실질적인 중복 감소다. 두 읽기(최초/락 안)를 갈라 놓는
  `freshFindOne` 옵션 설계는 "GREEN 만으로는 증거가 안 된다"는 뮤테이션 실측(문서화됨)에 기반해
  판별력을 갖췄다.
- `endpoint-path-conflict-wrap-guard.ts` 의 `isManagerTriggerSave` 판별(수신자 이름 대신 첫 인자가
  `Trigger` 엔티티인지로 좁힘)은 이 저장소의 다른 정적 가드(`user-entity-exposure-guard.ts` 류)와
  같은 "모르는 것은 통과, 아는 결함은 확실히 잡는다" 관용구를 일관되게 따른다.

## 요약

이번 변경은 직전 라운드가 지적한 CRITICAL(창 1 재현·테스트 무보호)을 닫는 목적에 충실했고, 그
과정에서 직전 maintainability WARNING(중복 클로저)도 함께 해소해 전체적으로 유지보수성을 개선하는
방향이다. 다만 그 해소 과정에서 두 가지 중복이 새로 생기거나 악화됐다 — advisory-lock 획득
SQL 이 유틸리티 밖에서 한 번 더 손으로 쓰였고, `inboundSigningRef` presence 를 읽는 인라인 타입
캐스트가 같은 함수 안에서까지 반복됐다. 둘 다 지금 당장 동작을 그르치지는 않지만, 이 PR 이 스스로
증명한 "쌍으로 된 로직은 한쪽만 고치는 drift 를 부른다"는 교훈이 아직 완전히 적용되지 않은 자리다.
그 외에는 이미 길었던 `update()` 가 더 무거워진 점, 트랜잭션 콜백의 mutation 이 데이터 흐름을
암묵적으로 만드는 점이 낮은 위험도의 관찰로 남는다. 모두 차단 사유는 아니다.

## 위험도

LOW
