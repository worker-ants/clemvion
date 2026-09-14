# 유지보수성(Maintainability) 리뷰

## 검토 범위

`codebase/backend/src/modules/triggers/{trigger-config-lock.ts, trigger-config-lock.spec.ts,
chat-channel-binder.service.ts, chat-channel-input-rules.ts, triggers.service.ts,
triggers.service.spec.ts, triggers.web-chat.spec.ts,
__test-utils__/trigger-transaction-mock.ts}`, `codebase/backend/src/modules/hooks/{hooks.service.ts,
hooks.service.spec.ts}`, `codebase/backend/src/repo-guards/__tests__/{endpoint-path-conflict-wrap-guard.ts,
endpoint-path-conflict-wrap.spec.ts, fixtures/endpoint-path-save.fixture.ts}`,
`codebase/backend/test/trigger-config-lost-update.e2e-spec.ts`, `CHANGELOG.md`, plan 문서를
프롬프트 diff와 저장소의 현재 파일을 직접 `Read`로 대조해 확인했다. `review/code/**`·
`review/consistency/**` 하위 50여 개 파일은 이전 두 라운드(`18_17_44`, `19_07_43`)의 리뷰
산출물(생성된 보고서)이라 그 자체는 "유지보수할 코드"가 아니므로 이번 리뷰의 관점 적용
대상에서 제외했다 — 다만 그 안의 이전 maintainability 발견사항(특히 `buildFallbackChannel`/
`buildMergedChannel` 중복 WARNING, `extractInboundSigningRef` 미추출 WARNING)이 이번 diff에서
실제로 해소됐는지는 직접 코드로 재검증했다(아래 "이전 라운드 대비 확인한 해소 사항").

## 발견사항

- **[WARNING]** 외부 스코프 `let` 변수가 트랜잭션 클로저 안에서 재할당되고, 트랜잭션이 끝난 뒤 다른 호출의 인자로 다시 쓰인다 — 값의 흐름을 추적하려면 클로저 경계를 세 번 넘나들어야 한다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:513`(선언) → `:562-563`(트랜잭션 콜백 내부 재할당) → `:619`(트랜잭션 커밋 후 `preservedInboundSigningRef` 인자로 사용)
  - 상세: `previousInboundSigningRef`는 `update()` 최상단에서 요청 시작 시점 값으로 초기화된 뒤(513), `this.triggerRepository.manager.transaction(...)` 콜백 내부에서 락 안 재읽기 결과로 조건부 재할당되고(562-563), 트랜잭션이 커밋되고도 한참 뒤인 `chatChannel` 분기(611-620)에서 `setupChatChannel`의 옵션 인자로 소비된다. 코드를 읽는 사람은 "이 변수가 지금 어떤 값을 들고 있는가"를 답하려면 (a) 선언 시점 값, (b) 트랜잭션 콜백이 실행됐는지, (c) 그 안에서 재읽은 행에 ref가 있었는지 세 가지를 모두 추적해야 한다. 함수가 무엇을 하는지 설명하는 JSDoc 주석(505-512)이 이례적으로 상세해 지금은 의도가 잘 문서화돼 있지만, 이런 밀도의 주석 없이는 클로저를 넘나드는 mutable 변수 하나만으로도 유지보수자가 재할당 지점을 놓치기 쉬운 패턴이다(실제로 이 결함 클래스 자체가 "락 밖 스냅샷"을 여러 자리에서 각각 다르게 다루다 발생했다).
  - 제안: 트랜잭션 콜백이 `{ target, previousInboundSigningRef }` 형태의 결과 객체를 반환하고, 바깥 스코프의 `let`을 없애 `const { target: saved, previousInboundSigningRef } = await this.triggerRepository.manager.transaction(...)`처럼 단일 대입점으로 만들면 재할당 지점이 코드 구조에서 바로 드러난다. 지금 당장 리팩토링을 요구할 정도는 아니지만(주석이 이미 함정을 명시), 다음에 이 함수를 만지는 사람을 위해 남겨 둘 가치가 있다.

- **[INFO]** `setupChatChannel`/`update()` 두 메서드가 이미 길었는데 이번 PR로 로컬 클로저·트랜잭션 블록이 더 늘어 함수 하나의 인지 부하가 계속 누적되고 있다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:87-316`(`setupChatChannel`, 약 230줄 — 이번 PR이 `survivesWithFresh`·`buildChannel` 두 클로저와 `rewriteTriggerConfigLocked` 호출 두 곳을 추가), `codebase/backend/src/modules/triggers/triggers.service.ts:467-636`(`update()`, 약 170줄 — 이번 PR이 "창 1" 트랜잭션 블록 전체를 추가)
  - 상세: 두 함수 모두 원래도 secret 쓰기·검증·에러 처리 등 여러 책임을 한 메서드에 담고 있었고, 이번 결함 수정은 그 위에 "advisory lock 획득 → 락 안 재읽기 → 병합 → 쓰기"라는 새 책임을 얹었다. 새로 생긴 코드 자체는 잘 분리돼 있지만(클로저 이름이 목적을 드러내고, `rewriteTriggerConfigLocked`로 공용 로직은 이미 뽑아냄), 함수 전체 스캔 범위는 계속 넓어지는 방향이다. 이번 PR의 신규 결함은 아니다.
  - 제안: 지금 막을 필요는 없다. 다음에 이 두 메서드 중 하나를 다시 확장할 일이 생기면, `setupChatChannel`의 presence-gate·config 조립 로직(`survivesWithFresh`/`buildChannel`)을 모듈 레벨 순수 함수로, `update()`의 트랜잭션 콜백 본문을 private 메서드로 뽑아내는 것을 우선 검토할 것.

- **[INFO]** 새 공용 테스트 mock(`withTransactionMock`)이 자신이 겨눈 "6개 파일 산재" 문제 중 2개만 실제로 이관했다 — JSDoc과 실제 적용 범위 사이에 괴리가 있다
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:20-27`(JSDoc: "전수로 세니 provider 는 **6개 파일**에 흩어져 있다") vs 실제 소비처 `codebase/backend/src/modules/triggers/triggers.service.spec.ts`, `codebase/backend/src/modules/triggers/triggers.web-chat.spec.ts` 2곳뿐
  - 상세: `grep -rl "getRepositoryToken(Trigger)" codebase/backend/src --include="*.spec.ts"`로 직접 확인한 결과 `interaction.controller.spec.ts`·`schedules.service.spec.ts`·`hooks.service.spec.ts`·`auth-configs.service.spec.ts` 4개 파일도 같은 Trigger repo mock provider 패턴을 갖고 있지만 `withTransactionMock`으로 옮기지 않았다. 오늘 기준으로는 이 4개 파일이 `TriggersService`의 트랜잭션 경로(`update`/`create`/`rotateBotToken`)를 호출하지 않아 깨지지 않는 것으로 보이지만(테스트가 통과하는 것으로 간접 확인), JSDoc이 "6개 파일"이라는 전수 조사 결과만 적어 두고 이번 diff가 그중 몇 개를 실제로 옮겼는지는 말하지 않아, 다음 사람이 이 JSDoc만 보고 "이미 다 이관됐다"고 오인할 소지가 있다.
  - 제안: 차단 사유는 아니다. JSDoc에 "이번 PR은 그중 2곳(`triggers.service.spec.ts`, `triggers.web-chat.spec.ts`)만 이관했다 — 나머지 4곳은 `TriggersService` 트랜잭션 경로를 아직 호출하지 않아 미이관"이라는 한 줄을 추가하면, 다음에 `TriggersService`의 트랜잭션 배선이 또 바뀔 때 그 4개 파일이 같은 실패(`Cannot read properties of undefined (reading 'transaction')`)를 겪을 수 있다는 점을 사전에 알 수 있다.

- **[INFO]** 이미 3,800줄을 넘는 단일 스펙 파일이 이번 PR로 261줄 더 늘었다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (전체 3,810줄, `git diff origin/main...HEAD --stat` 기준 이번 PR +261/-14)
  - 상세: 새로 추가된 `describe('TriggersService — 락 안 재읽기가 동시 확립분을 본다 (lost update)', ...)`(약 3602행~) suite 자체는 목적이 분명하고 잘 격리돼 있어 이번 diff의 결함은 아니다. 다만 이 파일이 이미 이 저장소에서 가장 큰 스펙 파일 축에 속하는 상태에서 계속 커지고 있어, IDE 탐색·리뷰 diff 가독성 비용이 누적되는 추세다.
  - 제안: 지금 분할을 요구할 정도는 아니다(이 저장소에 이미 `triggers.web-chat.spec.ts`처럼 관심사별로 스펙을 분리한 선례가 있으므로, 다음에 큰 기능을 또 추가할 때 이 lost-update suite처럼 새 관심사는 별도 `*.spec.ts`로 시작하는 편을 고려할 만하다는 정도의 관찰).

## 이전 라운드 대비 확인한 해소 사항 (참고, 재지적 아님)

- 직전 라운드(`18_17_44`) maintainability WARNING("`buildFallbackChannel`/`buildMergedChannel` 거의 동일한 스프레드 패턴 반복")은 이번 diff에서 두 클로저가 `buildChannel` 하나로 통합되어 실제로 해소됐음을 `chat-channel-binder.service.ts:226-241`에서 직접 확인했다.
- 같은 라운드 WARNING#7("`{ chatChannel?: { inboundSigningRef?: string } }` 인라인 캐스트가 세 자리에 중복")도 `chat-channel-input-rules.ts`의 `extractInboundSigningRef`로 추출되고 `triggers.service.ts:50,513,563`·`chat-channel-binder.service.ts:14,211`에서 공유되는 것을 확인했다.
- `19_07_43` architecture WARNING#4("락 획득 SQL을 두 자리가 각자 손으로 적음")도 `acquireTriggerConfigLock` 프리미티브 추출(`trigger-config-lock.ts:39-46`)로 `rewriteTriggerConfigLocked`와 `triggers.service.ts:550`의 인라인 트랜잭션이 같은 코드를 공유하도록 해소됐다.

## 긍정적으로 확인한 점

- `trigger-config-lock.ts`의 네이밍(`triggerConfigLockKey`, `acquireTriggerConfigLock`, `rewriteTriggerConfigLocked`)은 각 함수가 하는 일을 정확히 드러내고, 락·재읽기·머지·쓰기라는 단일 관심사에 집중된 작은 유틸리티로 잘 분리돼 있다.
- 매직 넘버 없음 — e2e 테스트의 `RATE_LIMIT_FROM_A/B`·`SETTLE_MS`·`UNTOUCHED_KEY` 모두 의미가 드러나는 상수명과 그 존재 이유를 설명하는 주석을 갖췄다.
- `trigger-config-lock.spec.ts`는 헬퍼의 계약(락 순서·행 소실·스프레드 순서)만 좁게 겨눈 전용 suite로, 서비스 경유 테스트와 역할이 겹치지 않게 잘 분리돼 있다.
- `endpoint-path-conflict-wrap-guard.ts`의 AST 워커 확장(`isWrappedByConflictCatch`의 콜백 경계 판정)은 작은 헬퍼 함수(`isPropertyAccessNamed`, `callsConflictWrapper`)로 분해돼 있어 새로 추가된 분기 하나(`ts.isFunctionLike(cur) && !ts.isCallExpression(cur.parent)`)의 의도가 주석과 함께 명확히 읽힌다.

## 요약

핵심 변경(`trigger-config-lock.ts`)은 락·재읽기·머지·쓰기라는 단일 책임에 집중된 작은 유틸리티로 설계돼 있고, 이전 두 리뷰 라운드가 지적한 중복(클로저 쌍·인라인 타입 캐스트·락 SQL 중복)이 이번 diff에서 실제로 공용 함수 추출을 통해 해소된 것을 직접 코드로 확인했다. 남는 항목은 모두 차단 사유가 아니다 — `TriggersService.update()` 안에서 트랜잭션 클로저를 넘나드는 mutable 변수(`previousInboundSigningRef`) 하나가 값의 흐름 추적을 어렵게 만드는 점(WARNING, 다만 상세한 인접 주석이 함정을 이미 문서화함), 이미 길었던 두 메서드가 이번 PR로 조금 더 무거워진 점, 테스트 mock 통합이 대상 6곳 중 2곳에만 적용돼 JSDoc의 서술 범위와 실제 적용 범위 사이에 괴리가 있는 점, 그리고 이미 큰 스펙 파일이 계속 커지는 추세 정도다.

## 위험도

LOW
