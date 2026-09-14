# 유지보수성(Maintainability) 리뷰 — trigger-config-lost-update (2026-09-14 22:24 라운드)

## 검토 범위

`git diff origin/main...HEAD --stat -- codebase/` 로 확인한 실제 코드 변경 파일 17개
(`hooks.service.ts`/`.spec.ts` · `schedules.service.ts`/`.spec.ts` ·
`trigger-transaction-mock.ts`(신규) · `chat-channel-binder.service.ts` ·
`chat-channel-input-rules.ts`/`.spec.ts` · `trigger-config-lock.ts`/`.spec.ts`(신규) ·
`triggers.service.ts`/`.spec.ts` · `triggers.web-chat.spec.ts` ·
`endpoint-path-conflict-wrap-guard.ts`/`.spec.ts` · `endpoint-path-save.fixture.ts` ·
`trigger-config-lost-update.e2e-spec.ts`(신규))를 원본 파일 기준으로 직접 열어 확인했다.
`plan/**`·`review/**` 하위 산출물(과거 라운드 리뷰 결과물 포함)은 코드가 아니므로 이 관점의
대상에서 제외했다.

이 PR 은 이미 여러 라운드의 `/ai-review` 를 거쳤다. 직전 라운드
(`review/code/2026/09/14/21_50_09/maintainability.md`)가 남긴 WARNING 1건·INFO 2건이 이번
마지막 커밋(`a92bce095`)까지 해소됐는지를 실제 파일 대조로 재확인했다.

## 발견사항

- **[WARNING]** 테스트 헬퍼 안 provider 검색 로직 인라인 중복 — **3라운드 연속 미해소·미등재**
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3757-3768`
    (`makeService` 함수 내부, `ChannelListenerRegistry` 교체 직후 `const at = (token) => …` 선언)
  - 상세: `ChannelListenerRegistry` provider 를 교체하는 코드(3757-3763)가
    `providers.findIndex((pr) => 'provide' in pr && (pr as { provide: unknown }).provide === X)`
    술어를 인라인으로 한 번 쓰고, 바로 다음 줄(3764-3768)에서 정확히 같은 술어를
    `const at = (token) => providers.findIndex(...)` 로 이름 붙여 `ChannelAdapterRegistry`·
    `SecretResolverService` 교체(3769-3781)에 재사용한다. `git diff origin/main...HEAD` 로
    확인한 결과 `makeService` 전체가 이번 PR 이 새로 추가한 함수이고(diff 전량 `+`), 이
    지적은 `review/code/2026/09/14/21_18_21/maintainability.md` WARNING#4 → `21_50_09/
    maintainability.md` WARNING#1 로 이미 두 번 보고됐다. 두 라운드 모두 "코드도 안
    바뀌었고 `plan/in-progress/trigger-config-lost-update.md` 후속 표에도 등재되지 않았다"
    고 명시했는데, 이번 최종 커밋까지도 코드가 그대로이고(`grep` 재확인) plan 후속 표에도
    여전히 없다(`grep -n "findIndex\|ChannelListenerRegistry" plan/in-progress/
    trigger-config-lost-update.md` 0건). 순수 테스트 헬퍼 내부라 런타임 리스크는 없지만,
    지적이 두 번 조용히 유실된 자리라는 점 자체가 이번 라운드에서 다시 지적할 이유다.
  - 제안: `const at = (token) => …` 선언을 함수 상단으로 올려 `ChannelListenerRegistry`
    교체도 `providers[at(ChannelListenerRegistry)] = …` 로 통일한다. 계속 유예할 것이면
    최소한 `plan/in-progress/trigger-config-lost-update.md` 후속 표에 올려 세 번째 라운드째
    같은 항목을 재발견하는 비용을 없애야 한다.

- **[INFO]** `TriggersService.update()` 가 여전히 182줄 다책임 메서드다 — 등재·유예 확인(재발 아님)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:507-688`
    (메서드 전체), advisory-lock 트랜잭션 콜백은 `:588-637`
  - 상세: 스케줄 타입 가드·인증 검증·notification/interaction 병합 준비·advisory lock
    획득·재읽기·presence 게이트 재계산·config 병합·저장 대상 결정·chatChannel 재조회·감사
    로그가 한 메서드(와 그 안의 트랜잭션 콜백)에 있다. `plan/in-progress/
    trigger-config-lost-update.md:501` 이 "`update()` 가 182줄 — 트랜잭션 클로저를
    `mergeAndSaveLocked(...)` 로 분리" 를 "다음 편집 때" 로 명시 등재했고, 이번 라운드는
    실제로 코드를 건드리지 않아 동작 결함으로 재발하지도 않았다. 이번 배치를 막을 사유는
    아니다.
  - 제안: 다음 실질 편집 시 트랜잭션 콜백 본문(락 획득+재읽기+병합+저장)을
    `private mergeAndSaveLocked(...)` 로 뽑을 것 — 이미 계획에 있음.

- **[INFO]** `previousInboundSigningRef` 가 `let` 을 통해 클로저 경계를 셋 넘는다 — 등재·유예 확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:553`(선언, 요청 시작
    시점) → `:602-603`(트랜잭션 콜백 안 재대입, 재읽은 행 시점) → `:671`(콜백 밖 소비,
    `setupChatChannel` 호출 인자)
  - 상세: 최종 값을 알려면 선언→콜백 안→콜백 밖 세 지점을 순서대로 따라가야 한다.
    `plan/in-progress/trigger-config-lost-update.md:504` 에 "트랜잭션 콜백이
    `{ saved, previousInboundSigningRef }` 를 반환하도록" 이미 등재돼 있다. 동작은
    정확하며 이번 배치를 막을 사유는 아니다.
  - 제안: 등재된 대로 콜백 반환값에 실어 단방향 흐름으로 바꾸는 것을 다음 편집 때 권고.

- **[INFO]** 같은 함수(`makeManager`) 위 두 JSDoc 블록이 병합되지 않고 나란히 쌓여 있다 — 재확인, 여전히 미병합
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.spec.ts:27-33`
    (`function makeManager` 바로 위)
  - 상세: `/** 호출 순서를 관측할 수 있는 EntityManager mock. */`(27번 줄) 한 줄짜리 블록
    바로 아래, `config` 를 `null` 로도 받을 수 있게 넓힌 이유를 설명하는 5줄짜리 블록
    (28-32번 줄)이 별도 JSDoc 으로 다시 열려 있다. `review/code/2026/09/14/21_50_09/
    maintainability.md` INFO 로 이미 지적됐고, 이번 최종 커밋까지 병합되지 않았다. 동작에
    영향 없는 사소한 가독성 흠이다.
  - 제안: 두 블록을 하나의 JSDoc 으로 합친다(첫 문장을 요약으로 유지하고 null 관련 설명을
    이어 붙임).

- **[INFO]** 같은 "advisory lock 트랜잭션을 손으로 연다" 보일러플레이트가 세 형태(창 1·`remove()`·
  `rewriteTriggerConfigLocked`)로 공존한다 — 이미 여러 라운드 architecture 리뷰가 추적 중,
  재확인 차원
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:588-637`(창 1 —
    `manager.transaction` 안에서 `acquireTriggerConfigLock` + `m.findOne` + `m.save`),
    `:988-994`(`remove()` — 같은 골격 + `m.remove`), `codebase/backend/src/modules/
    triggers/trigger-config-lock.ts:136-173`(`rewriteTriggerConfigLocked` — 같은 골격 +
    `m.update`)
  - 상세: 락 획득 SQL 자체는 `acquireTriggerConfigLock` 프리미티브로 이미 공유되지만(과거
    WARNING 해소 확인됨), "트랜잭션을 열고 그 안에서 락을 잡은 뒤 재읽는다" 는 준비 단계
    자체는 세 자리 모두 손으로 반복 조립돼 있다. `save`/`remove`/`update` 세 계약이 서로
    달라 완전 통합은 어렵다는 근거가 코드 주석·plan §D 에 이미 상세히 기록돼 있어 숨은
    결함은 아니고, `review/code/2026/09/14/20_49_15/architecture.md` 등 여러 라운드가 이미
    추적 중이라 이 라운드에서 새로 지적할 사항은 아니다. 참고로만 남긴다.
  - 제안: 별도 조치 불요(추적됨). 후속에서 "트랜잭션을 열고 락을 잡은 뒤 재읽는다" 부분만
    `withTriggerConfigLock(manager, id, cb)` 로 뽑으면 세 자리가 최소한 그 지점까지는 같은
    코드를 지나가게 할 수 있다.

## 긍정적으로 확인한 점 (참고)

- `hooks.service.ts` 의 두 호출부(`handleWebhook`·chat-channel 인입)가 `save(trigger)` 를
  각자 반복하던 것을 `touchLastTriggeredAt()` 사설 메서드 하나로 통합했다(`:973-979`).
  docblock 이 "두 호출부가 이 한 함수를 공유한다"는 이유를 명시해, 다음 사람이 한쪽만
  고치는 drift 를 구조적으로 막는다.
- `schedules.service.ts` 의 schedule 편집 trigger 동기화가 `save(entity)` 대신
  `Pick<Trigger, 'name' | 'isActive'>` 로 좁힌 컬럼 한정 `update()` 로 바뀌어(`:231-247`),
  의도(무엇을 바꾸는가)가 타입 시그니처에서 그대로 드러난다.
- `chat-channel-input-rules.ts` 의 `extractInboundSigningRef()` 추출이 세 자리에 흩어져
  있던 동일한 인라인 캐스트(`{ chatChannel?: { inboundSigningRef?: string } }`)를 이름
  있는 함수 하나로 대체했다 — 형태가 바뀔 때 고칠 자리를 하나로 줄인 정확한 리팩터.
- `endpoint-path-conflict-wrap-guard.ts` 의 콜백 경계 판별 로직(`isWrappedByConflictCatch`)
  확장이 기존 순회 구조 안에 새 종료 조건 하나만 자연스럽게 추가했고(`ts.isFunctionLike(cur)
  && !ts.isCallExpression(cur.parent)`), 왜 그 경계인지 주석으로 남겨 중첩·복잡도를 키우지
  않았다.
- `trigger-config-lost-update.e2e-spec.ts` 의 `RATE_LIMIT_FROM_A/B`·`SETTLE_MS`·
  `UNTOUCHED_KEY` 등은 전부 이름 있는 상수로 선언되고 각 상수의 존재 이유가 주석에 있다 —
  매직 넘버 없음.
- `TRIGGER_CONFIG_LOCK_PREFIX`·`TRIGGER_DELETE_LOCK_TIMEOUT_MS`·`TRIGGER_ENTITY` 등 신규
  상수의 네이밍이 목적을 정확히 드러내고, 각각 "왜 상수로 뒀는가"를 설명하는 JSDoc이
  붙어 있어 코드베이스 컨벤션과 일관된다.
- `triggers.service.ts` 의 `assertTriggerFound`/`throwTriggerNotFound` 분리가 네 곳에
  복제돼 있던 "없으면 `RESOURCE_NOT_FOUND`" 리터럴을 한 곳으로 모았다.

## 요약

이번 최종 라운드의 실질 코드 변경(`a92bce095` — 남은 일곱 자리의 `save(entity)` 를 컬럼
한정 `update`/락 안 재작성으로 닫는 작업)은 기존에 확립된 패턴(`touchLastTriggeredAt`,
컬럼 한정 `update`, `rewriteTriggerConfigLocked`)을 그대로 재사용해 새로운 중복이나 구조적
결함을 만들지 않았다. 직전 라운드가 지적한 구조적 부채 2건(`update()` 182줄,
`previousInboundSigningRef` 클로저 경계 이동)은 plan 후속 표에 실측 근거와 함께 명시적으로
등재된 의도적 유예로 재확인됐고, 이번 라운드도 그 자리를 건드리지 않아 재발 위험이 없다.
다만 테스트 헬퍼의 provider 검색 인라인 중복(WARNING)은 **이번이 세 번째 지적**인데도
코드가 그대로이고 여전히 plan 후속 표에 오르지 않았다 — 런타임 리스크는 없는 테스트 전용
코드이지만, "지적이 조용히 유실되는 패턴" 자체가 이 저장소가 이미 여러 번 경계해 온 결함
클래스와 닮아 있어 이번엔 명시적으로 다시 올린다. `makeManager` 의 이중 JSDoc(INFO)도
같은 이유로 재확인 차원에서 남긴다. 전체적으로 이 배치는 유지보수성 관점에서 차단 사유가
없다.

## 위험도

LOW
