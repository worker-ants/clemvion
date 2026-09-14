# 아키텍처(Architecture) 리뷰

## 검토 범위

`trigger.config` lost-update(동시 PATCH 가 서로의 `chatChannel.inboundSigningRef` 를
되돌려 인입 서명 검증이 fail-open 되는 결함)를 advisory lock(`pg_advisory_xact_lock`) +
락 안 재읽기로 막는 수정. 신규 `trigger-config-lock.ts`(`rewriteTriggerConfigLocked` /
`triggerConfigLockKey`)와 그 호출부 3곳(`chat-channel-binder.service.ts` 성공/실패 경로,
`triggers.service.ts#rotateBotToken`), 그리고 별도 인라인 구현 1곳(`triggers.service.ts#update`
창 1)을 확인했다. 부수로 `endpoint-path-conflict-wrap-guard.ts`(정적 가드가
`manager.transaction` 콜백 경계를 따라가도록 확장) 및 테스트 인프라
(`__test-utils__/trigger-transaction-mock.ts`)도 함께 봤다.

## 발견사항

- **[WARNING]** 락 획득 SQL 이 "공용 헬퍼로 감싼 자리"와 "직접 인라인한 자리"로 갈려
  중복된다 — 향후 `lock_timeout` 추가 시 한쪽만 반영될 위험
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` 함수
    `rewriteTriggerConfigLocked` (원본 파일 74~85행, `m.query('SELECT
    pg_advisory_xact_lock(hashtext($1))', [triggerConfigLockKey(triggerId)])`)
    vs `codebase/backend/src/modules/triggers/triggers.service.ts` 함수 `update()` 의
    "창 1" 트랜잭션 블록(원본 파일 549~576행, 동일한 SQL 문자열을
    `this.triggerRepository.manager.transaction(...)` 안에 직접 인라인).
  - 상세: 이 PR 은 "같은 트리거의 `config` 재작성끼리 직렬화"라는 하나의 관심사를 위해
    `rewriteTriggerConfigLocked` 라는 잘 문서화되고 단위 테스트도 갖춘(`trigger-config-lock.spec.ts`)
    추상화를 새로 만들었다. 그런데 이 추상화는 "재읽은 `config` 를 머지해 `m.update()`" 계약만
    지원하고, `update()` 의 창 1 은 `endpointPath` UNIQUE 충돌 처리·subscriber·반환 엔티티
    의미가 달라 `m.save(Trigger, trigger)` 를 써야 한다는 이유로(주석에 "저장 동사는 그대로
    둔다" 로 명시) 이 헬퍼를 재사용하지 못하고 락 획득 SQL 을 직접 다시 쓴다. 결과적으로
    "네 자리 전부를 advisory lock 안으로 넣는다"는 CHANGELOG 의 서술은 맞지만, 그 네 자리가
    **하나의 락-획득 구현을 공유하지 않는다** — 세 자리는 `rewriteTriggerConfigLocked` 를,
    한 자리는 복사된 리터럴을 쓴다. `trigger-config-lock.ts` JSDoc 은 스스로 "임계 구간에
    외부 호출이나 긴 계산을 들이는 변경을 하면 그때는 `SET LOCAL lock_timeout` 을 함께
    넣어야 한다"고 미래의 자신에게 경고를 남겨 두는데, 그 경고문이 사는 곳은 딱 한 곳
    (`trigger-config-lock.ts`)뿐이다. 다음 사람이 그 경고를 따라 `rewriteTriggerConfigLocked`
    에만 `lock_timeout` 을 추가하면 `update()` 의 창 1 은 자동으로 누락되어 이 두 구현은
    조용히 다른 락 시맨틱을 갖게 된다 — 지금 당장의 버그는 아니지만, 이 파일이 명시한 "다음
    변경 시 지켜야 할 제약"을 지킬 수 있는 자리가 구조적으로 하나뿐이 아니라는 점에서
    확장성/일관성 리스크다.
  - 제안: 락 획득 자체(`SELECT pg_advisory_xact_lock(hashtext($1))` 실행)를
    `acquireTriggerConfigLock(m: EntityManager, triggerId: string): Promise<void>` 같은
    더 낮은 수준의 프리미티브로 뽑아 `rewriteTriggerConfigLocked` 와 `update()` 의 창 1 이
    함께 호출하게 하거나, 최소한 `update()` 쪽에 "이 락 자리를 바꿀 때는
    `trigger-config-lock.ts` 도 함께 봐야 한다"는 상호 참조 주석을 남겨 두 자리가 갈라져
    있다는 사실 자체를 명시화할 것.

- **[INFO]** `previousInboundSigningRef` 가 `manager.transaction()` 콜백 내부에서
  바깥 스코프의 `let` 변수를 재대입하는 방식으로 트랜잭션 밖으로 값을 전달한다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` 함수 `update()`,
    `let previousInboundSigningRef = ...` 선언(원본 파일 512~514행)과 그 트랜잭션 콜백
    내부의 재대입(원본 파일 560~562행, `previousInboundSigningRef = (fresh?.config as
    ...)?.chatChannel?.inboundSigningRef ?? previousInboundSigningRef;`).
  - 상세: `manager.transaction(async (m) => {...})` 콜백이 순수하게 값을 반환하는 대신
    상위 스코프의 가변 변수를 부작용으로 갱신하고, 그 변수를 트랜잭션이 끝난 뒤
    (`setupChatChannel` 호출 시) 다시 읽는다. 트랜잭션 콜백의 반환 타입이 `Trigger`
    (`m.save(...)`) 하나로 고정돼 있어 두 번째 값(재읽은 ref)을 함께 반환하려면 반환
    형태를 튜플/객체로 바꿔야 하는 트레이드오프가 있고, 지금 방식이 "틀렸다"는 뜻은
    아니다. 다만 "락 안에서 계산된 값이 락 밖 변수를 통해 흘러나온다"는 데이터플로우가
    코드를 순서대로 읽지 않으면 드러나지 않아, 다음 사람이 이 함수를 확장할 때(예:
    또 다른 재읽기 파생값 추가) 같은 패턴을 반복하며 암묵적 결합이 누적될 수 있다.
  - 제안: 당장 고칠 필요는 없으나, 트랜잭션 콜백이 반환하는 값을
    `{ saved: Trigger; previousInboundSigningRef?: string }` 형태로 명시적으로 반환하는
    편이 다음 확장에서 더 안전하다는 점을 팀 컨벤션으로 남겨 둘 만하다.

- **[INFO]** `TriggersService` 가 이번 PR 로 트랜잭션·락 관리 책임을 추가로 흡수하며
  계속 커지고 있다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` 함수 `update()`
    (원본 파일 466행부터, 창 1 트랜잭션 포함) 및 `rotateBotToken()`
    (원본 파일 1026행부터).
  - 상세: 이 모듈은 이미 한 차례 `ChatChannelBinderService` 로 setup/teardown 을
    분리한 선례가 있고(`chat-channel-binder.service.ts` JSDoc 의 "경계 — 있다/없다" 표가
    그 근거를 잘 남겨 뒀다), 그 분리 기준("협력자 수")이 명확하다. 그런데 이번 PR 은
    `TriggersService` 안에 "advisory lock 획득 → 재읽기 → 병합 → save" 라는 새 책임을
    또 하나 인라인으로 얹었다(위 WARNING 항목의 창 1). 개별 커밋 단위로는 정당한 이유
    (save 시맨틱 보존)가 있지만, 누적되면 `TriggersService` 가 "트리거 CRUD 오케스트레이션"과
    "동시성 제어 프리미티브 적용"이라는 서로 다른 추상화 레벨의 코드를 한 메서드 안에
    계속 섞게 된다. 지금은 관리 가능한 크기지만, 같은 클래스가 이미 한 번 분리 리팩터를
    거쳤다는 사실 자체가 이 성장 방향을 주시할 신호다.
  - 제안: 지금 당장의 분리를 요구하는 것은 아니며(억지 추상화가 오히려 나쁘다), 다음에
    `config` 재작성이 필요한 다섯 번째 자리가 생기면 그때는 창 1 의 인라인 패턴을 그대로
    복제하지 말고 위 WARNING 의 제안대로 프리미티브를 먼저 뽑을 것을 권한다.

## 긍정적으로 확인한 설계 결정 (이슈 아님)

- `rewriteTriggerConfigLocked` 의 계약(락 → 재읽기 → 머지 → 컬럼 병합 → 쓰기, 행 삭제 시
  `false`)이 명확하고 `trigger-config-lock.spec.ts` 가 그 계약 자체(호출 순서, 스프레드
  순서, 삭제 시 no-op)를 별도 suite 로 검증한다 — 서비스 경유 테스트와 헬퍼 계약 테스트가
  책임을 잘 나눴다.
- `chat-channel-binder.service.ts` 의 `buildChannel` 추출은 이전 라운드에서 지적된
  "성공/실패 두 클로저가 같은 스프레드-조건을 따로 들고 있어 drift 를 부르는" 안티패턴을
  실제로 제거했다 — 두 경로가 이제 함수 하나를 공유한다(SRP/DRY 개선).
- `ChatChannelBinderService` 를 `chat-channel/` 이 아니라 `triggers/` 에 두는 경계 결정이
  `#676` 에서 끊은 순환 의존을 되살리지 않기 위한 것임을 JSDoc 에 명시해 뒀다 — 모듈
  경계가 취향이 아니라 실측(의존 방향)에 근거한다.
- advisory lock 을 임계 구간(읽기+머지+쓰기)에만 걸고 외부 provider 호출(`setupChannel`)을
  락 밖에 남긴 것은 Cafe24 토큰 갱신에서 기각된 "락 안에 HTTP 요청" 설계의 반론을 받아들인
  결과로, `execution-engine.service.ts` 의 admission 직렬화 선례와도 일관된다 — 신규
  공유 블로킹 자원이라는 트레이드오프는 WARNING 으로 이미 자체 인지되어 있다.
- 정적 가드(`endpoint-path-conflict-wrap-guard.ts`)가 `manager.transaction` 콜백 경계를
  따라가도록 AST 순회를 확장한 것은, 문자열/블라인드 정규식이 아니라 TS 컴파일러 AST 를
  쓰는 이 저장소의 기존 관례를 그대로 따른 것이고, 함수 경계(`ts.isFunctionLike(cur) &&
  !ts.isCallExpression(cur.parent)`)에서 멈추는 조건도 형제 문장을 잘못 주워 오지 않게
  구체적으로 좁혀져 있다.

## 참고 (절차 투명성, 이슈로 집계하지 않음)

리뷰 도중 `git status --short` 로 확인했을 때 `codebase/backend/src/modules/triggers/
chat-channel-binder.service.ts` 가 **일시적으로 커밋 상태와 다르게 관측**됐다 — `diff`
를 떠 보니 `survivesWithFresh`/`buildChannel`/`rewriteTriggerConfigLocked` 호출이 전부
사라지고 종전(이 PR 이전) 버전인 `this.triggerRepository.update(...)` 직접 호출로
되돌아가 있었다. 몇 초 뒤 재확인하니 다시 커밋 `567c82edb`(HEAD)과 정확히 일치하는
정상 상태로 돌아와 있었다 — 나는 이 파일을 읽기만 했고 어떤 방식으로도 쓰거나
되돌리지 않았다. 병렬 fan-out 리뷰 규약이 경고한 "다른 reviewer 가 같은 워킹트리를
동시에 mutate" 상황이 이번 라운드에서도 재현된 것으로 보인다(이전 라운드
`review/code/2026/09/14/18_17_44/api_contract.md` 의 "참고" 절과 같은 종류의 관측).
현재 저장소에는 잔여 이상 상태가 없다(`git status --short` 재확인 완료). 위 발견사항은
모두 이 파일이 정상 상태(HEAD)일 때 읽은 내용을 근거로 작성했다. 다음 라운드
리뷰어를 위해 기록만 남긴다.

## 요약

이번 변경의 핵심 아키텍처 결정(트리거 단위 advisory lock, 임계 구간에서 외부 호출 배제,
`buildChannel` 로 성공/실패 경로 통합, 순환 의존 재도입 회피)은 근거가 실측·선례와 함께
잘 문서화되어 있고 새로운 SOLID 위반이나 순환 의존, 레이어 경계 붕괴는 발견되지 않았다.
다만 새로 만든 락-재작성 추상화(`rewriteTriggerConfigLocked`)가 `save()` 시맨틱이 필요한
한 호출부(`update()` 창 1)를 커버하지 못해 락 획득 SQL 이 두 곳에 독립적으로 존재하게 됐고,
이 파일 자신이 예고한 "향후 `lock_timeout` 추가" 시나리오에서 한쪽만 갱신될 구조적 위험이
남아 있다. 이는 지금 당장의 버그가 아니라 다음 확장 시점의 일관성 리스크이므로 WARNING 으로
분류한다.

## 위험도

MEDIUM
