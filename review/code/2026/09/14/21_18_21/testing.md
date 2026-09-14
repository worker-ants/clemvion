# 테스트(Testing) 리뷰 — trigger-config-lost-update (6라운드)

## 검증 방법

이전 5라운드(`18_17_44` CRITICAL 2건 → `19_07_43` 닫힘 → `19_44_08` CRITICAL 1건 →
`20_17_16` 닫힘·LOW → `20_49_15` WARNING 2건)의 처분을 `plan/in-progress/trigger-config-lost-update.md`
§4·5라운드 표와 대조하고, 이번 배치(마지막 5커밋: `12ed21ff1`~`e5319a409`)가 실제로 그 두 WARNING
을 닫았는지 코드+테스트를 직접 열어 확인했다. 그 위에서 신규 뮤테이션 1건을 실측했다(저장소 밖
scratch 백업 → `cp` 로 원복, `git status --short` 로 잔여물 없음 확인 완료).

- `triggers.service.spec.ts` 3938줄 전수 확인 — `describe('TriggersService — 락 안 재읽기가 동시
  확립분을 본다 (lost update)')`(11개 케이스)가 창 1·binder·`rotateBotToken`·`remove()` 를 모두
  커버.
- `trigger-config-lock.spec.ts`·`trigger-transaction-mock.ts`·`chat-channel-input-rules.spec.ts`·
  `hooks.service.spec.ts` 를 원본에서 직접 Read.
- `npx jest src/modules/triggers/trigger-config-lock.spec.ts
  src/modules/triggers/chat-channel-input-rules.spec.ts src/modules/hooks/hooks.service.spec.ts`
  → 3 suites / 100 tests 전부 GREEN.
- `npx jest src/modules/triggers/triggers.service.spec.ts` → 140 passed / 1 skipped, 뮤테이션
  전후 모두 실행.

## 이전 라운드 대비 변화 요약

`20_49_15` WARNING#1(`remove()` 의 "락 먼저, 삭제 나중" 순서 미검증)과 WARNING#2(`if (wrote)
register(...)` 게이트 미행사)는 이번 배치가 정확히 닫았다 — `events` 배열에 `timeout:` →
`lock:` → `remove` 순서를 한 번에 담아 순서 자체를 단언하는 테스트(`triggers.service.spec.ts`
"remove() 도 같은 config 락을 잡는다")와, 음성(`skip → register 안 함`)+양성 대조군(`성공 →
register`) 쌍으로 확인했다. `hooks.service.ts` 의 두 hot-path(`handleWebhook`·chat-channel 인입)
는 `touchLastTriggeredAt` 하나로 합쳐졌고 두 호출부 모두 회귀 테스트가 있다(`hooks.service.spec.ts`
:201, :810 — 두 자리 다 `save` 미호출 + `update` 컬럼 단언 + patch shape 순회).

## 발견사항

- **[WARNING]** `remove()` 의 삭제-락 실패 시 "던진다" (조용한 지연 대신 드러나는 오류로 만든다는
  이 PR 의 명시적 설계 목표)가 **어떤 테스트로도 지켜지지 않는다** — 뮤테이션으로 실측
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `remove()` 내
    `.catch((err: unknown) => { this.logger.error(...); throw err; })` (트랜잭션 블록
    `acquireTriggerConfigLock(m, id, { timeoutMs: TRIGGER_DELETE_LOCK_TIMEOUT_MS }); await
    m.remove(trigger);` 바로 뒤 `.catch` 절)
  - 상세: 이 `.catch` 는 이번 PR 이 새로 추가한 로직이고, 그 존재 이유가 JSDoc·CHANGELOG·plan
    §5라운드 W2 처분에 정확히 적혀 있다 — "조용한 지연보다 드러나는 오류가 낫다". 그런데
    `throw err;` 한 줄을 지우고 `// swallow` 로 바꿔 `npx jest
    src/modules/triggers/triggers.service.spec.ts` 를 재실행하면 **140개 테스트가 전부
    GREEN** 이다(스위트 자체는 정상 실행됨, skip 1건은 이 뮤테이션과 무관). 즉 이 catch 가
    `logger.error` 만 부르고 에러를 삼키게 퇴행해도, 호출자가 실패를 알 방법이 없어지는 그
    회귀를 잡는 테스트가 하나도 없다. `remove()` 자체가 `Promise<void>` 를 리턴하므로 호출부
    (컨트롤러)는 락 타임아웃·삭제 실패를 그대로 200 으로 받게 된다 — 이 PR 이 막으려던 정확히
    그 실패 모드(반쯤 삭제된 상태가 "조용히" 성공으로 보고됨)가 재발해도 관측되지 않는다.
    이 저장소 자신의 5라운드 교훈("관측 고리가 없으면 그 보증은 테스트가 지킬 수 없다" —
    바로 이 커밋 시리즈의 마지막 커밋 제목이기도 하다)이 이 자리에는 아직 적용되지 않았다.
  - 제안: `m.remove` 를 reject 시키는 fixture 로 (1) `service.remove(...)` 가 그 에러를 그대로
    reject 하는지(`rejects.toThrow`/`rejects.toBe`), (2) `logger.error` 가 그 트리거 id 를 포함한
    메시지로 호출됐는지 두 가지를 단언하는 테스트 1개를 추가하면 닫힌다. `triggers.service.spec.ts`
    의 기존 `makeService`(락 안 재읽기 describe)가 이미 `repo.remove` 를 이벤트 배열에 꽂는
    구조라 `repo.remove.mockRejectedValueOnce(new Error('lock timeout'))` 정도로 재사용 가능.

- **[INFO]** (3라운드 연속 재확인, 미해소) `trigger-config-lock.spec.ts` 의 "config 가 비어
  있으면(null·undefined)" 케이스가 실제로는 `undefined` 만 검증한다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.spec.ts` — `it('config 가
    비어 있으면(null·undefined) 빈 객체로 좁혀 넘긴다', ...)` (`makeManager({ config: undefined
    })`)
  - 상세: 테스트 자신의 주석이 "`??` 라 두 값의 동작은 같다"고 명시적으로 인정하며 제목과
    fixture 의 괴리를 이미 알고 있다 — `19_44_08`·`20_17_16` 두 라운드가 같은 관찰을 INFO 로
    남겼는데도 아직 `null` 케이스가 추가되지 않았다. `Trigger['config']` 타입상 `null` 이 실제
    DB 값으로 들어올 여지(컬럼이 nullable 이면)가 있다면 `??` 의미상 안전하다는 **주장**은
    맞지만 그 주장 자체가 테스트되지 않은 채로 3라운드째 남아 있다. 코드 결함이 아니라 제목이
    약속한 커버리지와 실제 커버리지의 사소한 괴리다.
  - 제안: `it.each([['null', null], ['undefined', undefined]])` 로 한 줄이면 닫힌다. 급하지
    않음.

- **[INFO]** (2라운드 연속 재확인, 미해소) `withTransactionMock` 의 두 방어적 분기가 여전히 어떤
  테스트에도 실행되지 않는다
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:77`
    (`if (triggerRepoMock.manager) return triggerRepoMock;` — idempotency 가드), 그리고
    `triggers.service.spec.ts` 의 `freshFindOne` 클로저(`Math.min(freshCall, freshSequence.length
    - 1)` — "시퀀스 소진 후 마지막 값 반복" 폴백)
  - 상세: 전수 확인 결과(`grep -rn "withTransactionMock(" src/modules/triggers`) 모든 호출부가
    `.manager` 없는 순수 mock 만 넘겨 idempotency 가드가 한 번도 참이 되지 않고,
    `freshSequence` 배열 길이도 실제 재읽기 횟수(창1+binder=2, 단일창=1)와 정확히 맞춰 넘겨
    폴백 분기가 실행되지 않는다. 프로덕션 코드가 아니라 테스트 인프라의 방어적 분기라 위험도는
    낮다. `19_07_43`·`20_17_16` 라운드가 이미 지적했고 조치 불요로 처분됐던 항목이라 재확인
    차원으로만 기록한다(신규 이슈 아님).
  - 제안: 조치 불요(기존 처분 유지). 두 분기를 실제로 쓰는 테스트가 생기기 전까지 JSDoc 문구를
    "검증된 동작"이 아니라 "설계 의도"로만 읽을 것.

## 긍정적으로 확인한 점 (참고)

- `describe('TriggersService — 락 안 재읽기가 동시 확립분을 본다 (lost update)')` 의 `withRef`/
  `withoutRef` fixture 가 **서로 다른 키**(`untouchedByThisRequest`)와 **다른 컬럼 값**
  (`chatChannelHealth: 'degraded'` vs 기본값)을 갖도록 설계돼 있어, "스냅샷으로 병합" 류
  뮤턴트가 실제로 걸린다는 것이 코드·주석 양쪽에서 일관된다.
- `freshFindOne` 에 **호출 순서열**(배열)을 줘서 "창 1 재읽기"와 "binder 재읽기" 를 서로 다른
  값으로 분리한 설계는, 두 읽기가 항상 같은 값을 돌려주면 "재읽는다"는 동작 자체가 관측 불가능
  해진다는 이전 라운드의 CRITICAL 원인을 구조적으로 재발 방지한다.
- `remove()` 삭제-경합·순서 테스트가 "존재"가 아니라 "순서"(락→상한→삭제를 한 배열에 담아
  시퀀스로 단언)를 보는 것으로 바뀐 것은, 이 저장소가 반복해서 겪은 "존재 단언은 뒤집는 뮤턴트를
  못 잡는다"는 교훈을 정확히 실천한 사례다.
- `hooks.service.spec.ts` 의 두 신규 회귀 테스트(`handleWebhook`·chat-channel 인입 경로)가
  "부재 단언"(`save` 안 불림)과 "형태 단언"(`update` patch 가 `lastTriggeredAt` 단일 키인지
  `Object.keys` 로 순회)을 함께 걸어, "아무것도 안 했다"도 "config 를 patch 에 섞어 재발"도
  둘 다 통과 못 하게 막는다 — JSDoc 이 그 이유("부재 단언과 형태 단언을 함께 건다")를 명시한다.
- `chat-channel-input-rules.spec.ts` 의 `extractInboundSigningRef` 격리 테스트(7갈래
  `it.each`)는 4~5라운드가 지적했던 "간접 커버만 있었다" 갭을 정확히 닫는다 — presence 게이트의
  입력을 프로덕션 서비스 배선 없이 고정한다.
- e2e(`trigger-config-lost-update.e2e-spec.ts`)는 advisory lock 을 테스트가 직접 쥐어 인터리빙을
  결정적으로 만들고, 서로 다른 자리를 무는 3개 판별 단언(B 의 PATCH 값·A 의 신규 ref·A 의
  손대지 않은 키)을 두어 "하나만 남기는 편집이 나머지를 조용히 통과시키는" 실패 모드를 막는다.
  다만 이 e2e 는 PATCH-PATCH 경합만 다루고 `remove()` 의 삭제 경합은 다루지 않는다 — 위 WARNING
  이 unit 으로도 e2e 로도 아직 커버되지 않는다는 뜻이다.

## 요약

5라운드에 걸쳐 지적된 CRITICAL 3건·WARNING 다수가 이번 배치에서 실제로 뮤테이션 재확인을 통해
닫혔음을 확인했다 — 특히 직전 라운드(`20_49_15`)의 두 WARNING(삭제 순서 미검증, listener 등록
게이트 미행사)은 정확히 겨눈 테스트로 닫혔다. 다만 그 직전 라운드와 같은 커밋 시리즈가 새로
추가한 `remove()` 의 삭제-락 실패 시 "던진다" 는 보증(이 PR 의 명시적 설계 목표) 자체는 뮤테이션
실측 결과 **어떤 테스트로도 지켜지지 않는다** — `throw err` 를 지워도 스위트가 전건 GREEN 이다.
이 저장소가 이번 PR 안에서 다섯 번 반복해 학습한 "관측 고리 없는 보증은 테스트가 못 지킨다"는
교훈이 정확히 이 자리에 아직 적용되지 않은 것으로 보인다. 나머지 두 항목(`null` config 케이스
미검증, `withTransactionMock` 방어적 분기 미행사)은 2~3라운드째 반복 관찰된 낮은 위험도의 테스트
인프라 사소한 갭으로, 조치 불요로 이미 처분된 바 있다.

## 위험도

WARNING — 신규 코드 경로(삭제-락 실패 시 오류 전파)가 뮤테이션으로 검증되지 않는 커버리지 갭
1건. 프로덕션 결함은 아니지만(현재 구현은 `throw err` 로 올바르게 전파한다), 이 자리를 다시
만지는 다음 편집이 조용히 삼키는 방향으로 퇴행해도 CI 가 잡지 못한다.
