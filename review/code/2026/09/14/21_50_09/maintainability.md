# 유지보수성(Maintainability) 리뷰

## 검토 범위

`git diff origin/main...HEAD` 기준 `codebase/backend` 내 실제 프로덕션/테스트 코드 변경분
(`trigger-config-lock.ts`·`trigger-config-lock.spec.ts`·`chat-channel-binder.service.ts`·
`triggers.service.ts`·`triggers.service.spec.ts`·`triggers.web-chat.spec.ts`·
`__test-utils__/trigger-transaction-mock.ts`·`hooks.service.ts`/`.spec.ts`·
`chat-channel-input-rules.ts`/`.spec.ts`·`repo-guards/__tests__/*`·
`test/trigger-config-lost-update.e2e-spec.ts`)를 원본 파일 기준으로 직접 열어 확인했다.
`plan/**`·`review/**` 하위 산출물은 이 관점의 대상이 아니라 제외했다.

이 PR 은 여러 라운드의 `/ai-review` 를 거쳤고, 직전 라운드
(`review/code/2026/09/14/21_18_21/maintainability.md`)가 남긴 WARNING/INFO 4건 중 어느 것이
이번 마지막 커밋(`bf2becd0c`)까지 해소됐는지, 어느 것이 아직 남아 있는지를 먼저 실측했다.
아래 발견사항은 **그 대조 결과**다 — 이미 `plan/in-progress/trigger-config-lost-update.md`
후속 표에 근거와 함께 등재·유예된 항목은 재지적하되 심각도를 INFO 로 낮췄고, **등재되지 않은
채 남아 있는 항목**은 원래 등급을 유지했다.

## 발견사항

- **[WARNING]** 테스트 헬퍼 안에서, 뒤에 정의되는 `at()` 과 동일한 provider 검색 로직이 그 앞에 인라인으로 한 번 더 반복된다 (직전 라운드 지적 미해소·미등재)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3710-3721`
  - 상세: `ChannelListenerRegistry` provider 를 교체하는 코드(3710-3716)가
    `providers.findIndex((pr) => 'provide' in pr && (pr as { provide: unknown }).provide === X)`
    술어를 직접 인라인으로 쓰고, 바로 다음 줄(3717-3721)에서 정확히 같은 술어를
    `const at = (token) => providers.findIndex(...)` 로 이름 붙여 이후
    `ChannelAdapterRegistry`·`SecretResolverService` 교체(3722-3739)에 재사용한다.
    이 지적은 `review/code/2026/09/14/21_18_21/maintainability.md` WARNING#4 로 이미 한 번
    보고됐고, 그 라운드 이후 커밋(`bf2becd0c`)이 다른 WARNING/INFO 는 대부분 반영했지만 이
    항목만 코드도 안 바뀌었고 `plan/in-progress/trigger-config-lost-update.md` 후속 표에도
    등재되지 않았다 — 지적이 조용히 유실될 위험이 있는 자리다.
  - 제안: `const at = ...` 선언을 위로 올려 `ChannelListenerRegistry` 교체도
    `providers[at(ChannelListenerRegistry)] = ...` 로 통일한다. 순수 테스트 헬퍼 내부라
    런타임 리스크는 없지만, 같은 파일 안에서 반복되는 세 번째 provider 교체 자리이니 한
    형태로 맞추거나, 계속 유예할 것이면 최소한 후속 표에 올려 재발견을 막아야 한다.

- **[INFO]** 같은 함수(`makeManager`) 위에 두 개의 JSDoc 블록이 병합되지 않고 나란히 쌓여 있다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.spec.ts:27-32` (`function makeManager` 바로 위)
  - 상세: `/** 호출 순서를 관측할 수 있는 EntityManager mock. */` (27번 줄) 한 줄짜리 블록
    바로 아래에, `config` 를 `null` 로도 받을 수 있게 넓힌 이유를 설명하는 5줄짜리 블록
    (28-32번 줄)이 별도 JSDoc 으로 다시 열려 있다. 둘 다 같은 대상(`makeManager`)을
    설명하므로 오작동은 아니지만, 이번 PR 이 막 고친 "인접 주석이 다른 함수를 설명하게
    되는" 결함 클래스(`bf2becd0c` 커밋 메시지 W3 — `hooks.service.ts` 의 CCH-NF-03 docblock
    orphan 사례)와 형태가 닮아 있다 — 새 주석을 함수 바로 위에 끼워 넣을 때 기존 주석과
    합칠지 검토하지 않고 쌓은 흔적이다.
  - 제안: 두 블록을 하나의 JSDoc 으로 합친다(예: 첫 문장을 요약으로 유지하고 null 관련
    설명을 이어 붙임). 동작에 영향 없는 사소한 가독성 정리.

- **[INFO]** `TriggersService.update()` 가 여전히 트랜잭션 클로저를 안으로 삼킨 182줄 다책임 메서드다 (직전 라운드 WARNING → 등재·유예 확인됨)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:507-688` (메서드 전체), 트랜잭션 콜백은 `:588-638`
  - 상세: `review/code/2026/09/14/21_18_21/maintainability.md` WARNING#1 이 지적한 상태
    그대로다 — 스케줄 타입 가드·인증 검증·notification/interaction 병합·advisory lock
    획득·재읽기·presence 게이트 재계산·config 병합·저장 대상 결정·chatChannel 재조회·감사
    로그까지 한 메서드 본문(과 그 안의 트랜잭션 콜백)에 있다. 다만 `plan/in-progress/
    trigger-config-lost-update.md:471` 이 "다음 편집 때 (6라운드 W4)" 로 명시 등재했고,
    `bf2becd0c` 커밋 메시지가 "이 라운드부터 규율을 좁혔다 — 동작 결함이거나 서술이 거짓인
    것만 코드로 고치고 나머지는 등재한다" 는 방침을 선언한 뒤 실제로 이 항목을 등재만 하고
    코드는 건드리지 않았다 — 매 라운드 리팩터가 새 결함을 만드는 것을 피하려는 의도적
    유예로 보여 등급을 INFO 로 낮춘다.
  - 제안: 다음 실질 편집 시 트랜잭션 콜백 본문을 `private mergeAndSaveLocked(...)` 로 뽑을 것 — 이미 계획에 있음, 이번 배치를 막을 사유 아님.

- **[INFO]** 락 안 재읽기 결과가 메서드 스코프의 `let` 변수를 통해 클로저 경계를 셋 넘는다 (직전 라운드 INFO → 등재·유예 확인됨)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:553` (`let previousInboundSigningRef = ...` 선언), `:602-603` (트랜잭션 콜백 안 재대입), `:671` (콜백 밖 소비)
  - 상세: 값이 "선언(요청 시작 시점) → 트랜잭션 콜백 안 재대입(재읽은 행 시점) → 콜백 밖
    소비(setupChatChannel 호출)" 순으로 세 지점에 흩어져 있어 최종 값을 알려면 위→콜백
    안→콜백 밖을 순서대로 따라가야 한다. `plan/in-progress/trigger-config-lost-update.md:474`
    에 "트랜잭션 콜백이 `{ saved, previousInboundSigningRef }` 를 반환하도록 (급하지 않음)"
    으로 이미 등재돼 있다.
  - 제안: 등재된 대로 콜백 반환값에 실어 단방향 흐름으로 바꾸는 것을 다음 편집 때 권고. 현재도 정확하게 동작하며 이번 배치를 막을 사유는 아니다.

## 긍정적으로 확인한 점 (참고)

- 직전 라운드가 지적한 항목 3건이 `bf2becd0c` 로 실제로 해소된 것을 원본 파일에서 확인했다: `assertTriggerFound(null)` 우회 호출이 `throwTriggerNotFound(): never` 로 분리됐고(`triggers.service.ts:357-372`, `:1252`), `CHANGELOG.md` 의 "대기 상한은 없다" 서술이 삭제 5초 예외와 함께 정정됐으며, `trigger-config-lock.spec.ts` 의 "null·undefined" 제목이 `it.each` 로 두 값을 모두 검증하도록 고쳐졌다(`:110-120`).
- `hooks.service.ts` 의 `save(trigger)` 두 자리가 `touchLastTriggeredAt()` 사설 메서드 하나로 유지되고(`:973-979`), CCH-NF-03 docblock 이 자기 원래 위치(`markChatChannelRateLimited` 바로 위)로 복원돼 orphan JSDoc 문제가 사라졌다.
- `chat-channel-binder.service.ts` 의 `buildChannel(freshConfig, setupResult?)` 통합이 유지되어(성공·실패 경로가 한 함수 공유), `extractInboundSigningRef()` 추출도 그대로 유지돼 인라인 캐스트 중복이 재발하지 않았다.
- 신규 상수(`TRIGGER_CONFIG_LOCK_PREFIX`·`TRIGGER_DELETE_LOCK_TIMEOUT_MS`·`TRIGGER_ENTITY`)는 이름이 목적을 정확히 드러내고 매직 넘버가 없으며, 각 상수 옆에 "왜 상수로 뒀는가"를 설명하는 JSDoc이 붙어 있어 코드베이스 컨벤션과 일관된다.
- `trigger-config-lost-update.e2e-spec.ts` 의 `RATE_LIMIT_FROM_A/B`·`SETTLE_MS`·`UNTOUCHED_KEY` 등도 모두 이름 있는 상수로 선언되고 각 상수의 존재 이유가 주석으로 설명돼 있다.
- `endpoint-path-conflict-wrap-guard.ts` 의 콜백 경계 판별 로직(`isWrappedByConflictCatch`)이 함수 선언 경계에서 멈추는 새 분기를 기존 순회 구조 안에 자연스럽게 추가해 중첩을 늘리지 않았고, 판단 근거를 주석으로 남겨 다음 변경자가 왜 그 경계인지 알 수 있게 했다.

## 요약

이 배치의 마지막 커밋(`bf2becd0c`)은 직전 라운드가 지적한 유지보수성 항목 대부분(orphan JSDoc, 검증 헬퍼 우회 호출, CHANGELOG 서술 오류, 테스트 제목-fixture 불일치)을 실제로 해소했고, 그 과정에서 새 orphan-comment 류 결함을 만들지 않으려 규율을 스스로 좁혔다는 점이 코드에서 확인된다. 남은 두 구조적 항목(`update()` 182줄·`previousInboundSigningRef` 클로저 경계 이동)은 plan 후속 표에 실측 근거와 함께 명시적으로 등재된 의도적 유예라 이번 배치를 막을 사유가 아니다. 다만 테스트 헬퍼의 `at()` 인라인 반복(WARNING)은 두 라운드 연속 지적됐음에도 코드도 안 바뀌었고 후속 표에도 오르지 않아, 다음 라운드에서 같은 이유로 다시 지적될 위험이 있다 — 사소하지만 유일하게 "등재되지 않은 채 남은" 항목이다. `trigger-config-lock.spec.ts` 의 이중 JSDoc(INFO)은 이번 라운드에 새로 생긴 사소한 흠이다.

## 위험도

LOW
