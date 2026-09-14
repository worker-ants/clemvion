# 테스트(Testing) 리뷰 — trigger-config-lost-update (4라운드)

## 검증 방법

이전 세 라운드(`18_17_44`→CRITICAL 2건, `19_07_43`→닫힘, `19_44_08`→CRITICAL 1건)가 이미
`trigger-config-lock.ts`(창 2·3·4)와 `hooks.service.ts`의 hot-path 수정을 각각 뮤테이션으로
검증했고, 그 결과 이번 배치(`c7a9c107e`·`12ed21ff1`·`369852b4f`)가 그 지적들을 어떻게
닫았는지가 diff 의 핵심이다. 이번 라운드는 그 "닫았다"는 주장 자체를 신뢰하지 않고 저장소
밖 scratch 에 원본을 `cp` 로 백업 → 대상 파일을 직접 뮤테이션 → `jest` 실행 → `cp` 로 원복 →
`git status --short` 로 잔여물 없음 확인, 이 절차로 5개 뮤턴트를 독립 재현했다. 전부 원복
확인 완료, 저장소에 잔여 변경 없음(마지막 `git status --short` = `review/code/2026/09/14/20_17_16/`
untracked 만 존재).

| # | 뮤턴트 | 대상 | 결과 |
|---|---|---|---|
| 1 | `chat-channel-binder.service.ts` `survivesWithFresh` 의 재읽기 항(`Boolean(extractInboundSigningRef(freshConfig))`) 제거 | 이 PR 의 핵심 방어 | **RED 2건** (`triggers.service.spec.ts` "binder 재읽기" 케이스 2개) — 19_07_43 라운드가 실측한 CRITICAL#2·#3 이 아직 닫혀 있음을 재확인 |
| 2 | `hooks.service.ts` `handleChatChannelWebhook`(`:700-704`)의 컬럼 한정 `update`를 `save(trigger)`로 되돌림 | 19_44_08 CRITICAL 이 지적한 자리 | **RED 1건** — 이번 배치가 추가한 `hooks.service.spec.ts:810` "대칭 자리" 테스트가 정확히 잡는다. **19_44_08 CRITICAL 이 실제로 닫혔음을 독립 재현으로 확인.** |
| 3 | `endpoint-path-conflict-wrap-guard.ts`의 `first.getText(sf) === TRIGGER_ENTITY` 엔티티 이름 검사를 제거(임의 첫 인자 식별자를 전부 허용하도록 넓힘) | 새 `managerSaveOtherEntity` 음성 fixture | **RED 3건** — 넓힌 술어가 다른 엔티티의 `manager.save`까지 스캔 대상으로 끌어들이는 것을 새 음성 케이스가 정확히 잡는다 |
| 4 | 같은 가드 파일의 콜백 경계 판정(`ts.isFunctionLike(cur) && !ts.isCallExpression(cur.parent)`)을 종전 `ts.isStatement(cur)`로 되돌림 | `triggers.service.ts#update`(실제 프로덕션 코드, `manager.transaction` 콜백 안의 `m.save(Trigger, fresh)`) | **RED 2건** — 되돌리면 실제 프로덕션 저장 자리가 "래핑 없음"으로 오분류된다. JSDoc 이 주장하는 "종전엔 fail-safe 오탐이었다"가 사실임을 확인 |
| 5 | `trigger-transaction-mock.ts`의 `transaction: jest.fn((cb) => Promise.resolve(cb({...})))`를 콜백을 아예 부르지 않는 `jest.fn(() => Promise.resolve(undefined))`로 교체 | 테스트 인프라 자체의 위임 로직 | **RED 43건**(`src/modules/triggers` 전체) — 이 위임이 장식이 아니라 다수 테스트를 실제로 살아 있게 하는 배선임을 재확인(JSDoc 은 "13개"라 적었는데, 그 수치는 특정 describe 범위 한정으로 보이고 파일 전체 기준으로는 더 넓다 — 수치 자체가 새 결함은 아니지만 문서 표현이 조금 좁다) |

## 발견사항

- **[INFO]** `trigger-transaction-mock.ts` JSDoc 의 "실측(뮤턴트): 13개 케이스가 RED" 서술이 이 세션의 재측정(43건)보다 좁다
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` (파일 상단 JSDoc, "**실측(뮤턴트)**" 단락)
  - 상세: 같은 방향의 뮤테이션(`transaction` 콜백 미실행)을 독립적으로 재현하면 `src/modules/triggers` 전체 기준 **43개 RED**가 난다. JSDoc 이 적은 "13개(R-CC-21 5·생성 경로 5·callbackUrl 1·`rotateBotToken` 2)"는 아마 최초 측정 시점에 특정 describe 블록만 대상으로 세었을 가능성이 있다 — 이후 "락 안 재읽기" describe(6건)·`endpoint_path` UNIQUE 충돌 describe 등 `withTransactionMock`을 쓰는 다른 여러 describe 가 함께 걸린다. 수치가 좁다고 해서 결론("장식이 아니라 배선이다")이 틀린 것은 아니고 방향은 정확하지만, "정확히 13개"라는 문장 자체는 파일 전체 스코프에서는 사실이 아니다. (메모리: "실측했다"가 프록시·측정 시점 문제로 반복 지적된 패턴과 같은 종류 — 다만 이번엔 안전한 방향의 과소평가이고 결론에 영향은 없다.)
  - 제안: 급하지 않음. 후속 편집 시 "13개"를 "(특정 describe 한정, 파일 전체 기준으로는 더 많음)"으로 좁혀 적거나 범위를 명시하면 다음 사람이 그대로 인용해 좁은 숫자를 사실로 오인하는 것을 막을 수 있다.

- **[INFO]** 새 순수 함수 `extractInboundSigningRef`(보안 관련 presence 게이트의 입력)에 대한 격리된(isolated) unit 테스트가 없다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:247` (`extractInboundSigningRef`). 호출부: `chat-channel-binder.service.ts:211`, `triggers.service.ts:513`, `:563`
  - 상세: 이 함수는 세 자리에 복제돼 있던 인라인 캐스트를 통합한 것으로(JSDoc 자체가 그 근거를 밝힘), `inboundSigningRef` 보존 여부를 가르는 presence 게이트의 입력을 만든다 — 보안 관련 회귀에 민감한 자리다. 그런데 `chat-channel-input-rules.spec.ts`(같은 파일의 다른 함수들을 테스트하는 spec)에 이 함수를 직접 겨눈 `describe`/`it`이 없다. 현재는 `triggers.service.spec.ts`의 "락 안 재읽기" describe 등 더 큰 통합 테스트를 통해서만 간접적으로 커버된다 — `config`가 `null`·`undefined`·`chatChannel` 없음·`chatChannel`이 객체가 아닌 경우 같은 입력 경계는 명시적으로 단언되지 않는다. 다만 optional chaining(`?.`)만으로 구현된 한 줄 함수라 실질 위험은 낮다.
  - 제안: `chat-channel-input-rules.spec.ts`에 `extractInboundSigningRef`용 짧은 `describe`를 추가해 `config: null`/`undefined`/`{}`/`{ chatChannel: null }`/정상 값 다섯 갈래를 표로 단언하면, 향후 이 함수의 캐스트 형태가 바뀔 때(예: `ChatChannelConfig`가 구조를 바꿀 때) 통합 테스트까지 가지 않고 이 자리에서 바로 잡힌다.

- **[INFO]** (이전 라운드 대비 변화 없음, 재확인) `withTransactionMock`의 idempotency 가드와 `freshFindOne` 시퀀스의 "모자라면 마지막 값 반복" 폴백이 여전히 어느 테스트에도 실행되지 않는다
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:57`(`if (triggerRepoMock.manager) return triggerRepoMock;`), `triggers.service.spec.ts:3681`(`Math.min(freshCall, freshSequence.length - 1)`)
  - 상세: 전수 확인(`grep -rn "withTransactionMock(" src/modules/triggers/*.spec.ts`) 결과 10개 호출부 전부 `.manager` 없는 순수 객체만 넘기고, "락 안 재읽기" describe 의 모든 `freshSequence`는 실제 재읽기 호출 횟수와 정확히 같은 길이로만 주어진다(1개 또는 2개). 19_44_08 라운드가 지적한 상태 그대로다. 프로덕션 코드가 아니라 테스트 인프라의 방어적 분기라 위험은 낮다.
  - 제안: 조치 불필요 수준 유지. 두 분기를 실제로 쓰는 테스트가 생기기 전까지는 "검증된 동작"으로 인용하지 말 것(기존 권고와 동일).

- **[INFO]** (이전 라운드 대비 변화 없음, 재확인) `trigger-config-lock.spec.ts`의 "config 가 비어 있으면(null·undefined)" 테스트가 실제로는 `undefined`만 검증한다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` — `it('config 가 비어 있으면(null·undefined) 빈 객체로 좁혀 넘긴다', ...)` 본문의 `makeManager({ config: undefined })`
  - 상세: 제목이 이번 라운드에 "null 이면"에서 "비어 있으면(null·undefined)"으로 정정돼 실제로 테스트하는 값(undefined)과 제목의 불일치는 줄었지만, `config: null`을 직접 넣는 케이스는 여전히 이 스위트에 없다. 프로덕션 코드가 `??`를 쓰므로 동작 차이는 없고, DB `NULL`→TypeORM `null` 매핑 경로를 명시적으로 고정하는 캐너리는 아직 부재하다.
  - 제안: 급하지 않음. 유지.

## 이번 배치가 닫은 것 (참고 — 회귀 아님)

- **19_44_08 CRITICAL** (`hooks.service.ts` chat-channel 인입 hot-path 회귀 테스트 부재) — `hooks.service.spec.ts:810` 신규 테스트로 닫혔고, 뮤턴트 2로 독립 재확인.
- **18_17_44/19_07_43 이 실측한 "핵심 수정이 어떤 테스트로도 안 걸린다"** — `triggers.service.spec.ts`의 "락 안 재읽기가 동시 확립분을 본다" describe(6건, `freshFindOne` 시퀀스로 최초 읽기/재읽기를 의도적으로 분리)와 `trigger-config-lock.spec.ts`(8건)가 여전히 그 결함 클래스를 잡는다 — 뮤턴트 1로 재확인.
- **`endpoint-path-conflict-wrap` 래칫이 `manager.transaction` 안으로 들어간 저장 형태를 못 따라가던 것**(정적 가드가 실제 프로덕션 코드의 형태 변화를 "래핑 사라짐"으로 오판) — 뮤턴트 3·4로 두 방향(엔티티 좁히기·콜백 경계) 모두 독립 재확인.
- **삭제-경합에서 트리거가 고아로 부활하는 경로**(`update()`의 `save(trigger)`, `!fresh` 미검사) — `triggers.service.spec.ts:3799` "그 사이 삭제된 트리거를 되살리지 않는다" 테스트가 `repo.save`가 전혀 호출되지 않았음을 부재 단언으로 고정.
- e2e(`trigger-config-lost-update.e2e-spec.ts`)는 advisory lock 을 테스트가 직접 쥐어 인터리빙을 결정적으로 만들고, 서로 다른 자리를 무는 3개의 판별 단언(B 의 PATCH 값·A 의 신규 ref·A 의 손대지 않은 키)을 두어 "하나만 남기는 편집이 나머지를 조용히 통과시키는" 실패 모드를 스스로 방지하도록 설계돼 있다 — 코드 재실행은 이번 라운드에서 하지 않았지만(DB 필요), 정적으로 재확인한 구조는 견고하다.

## 테스트 격리 · 가독성

- 뮤테이션 검증 중 확인한 `makeService()`(락 안 재읽기 describe)는 `freshCall` 카운터를 클로저 지역 변수로 두고 매 테스트마다 새 `Test.createTestingModule`을 만들어, 테스트 간 상태 누수가 없다.
- `withRef`/`withoutRef` 두 fixture 가 **서로 다른 키**(`untouchedByThisRequest`)와 **다른 컬럼 값**(`chatChannelHealth`)을 갖도록 의도적으로 설계돼 있다는 점을 JSDoc이 명시하고("두 상태가 같은 키를 가지면 «스냅샷으로 병합» 뮤턴트가 살아남는다 — 실제로 한 번 살려 보냈다") 실제로 뮤턴트 1이 이 설계 덕분에 잡힌다 — 판별 fixture 설계 원칙이 문서와 실측이 일치한다.
- 각 describe 상단의 표(`재읽기 ① / ② / 죽이는 뮤턴트`)가 테스트 목적을 코드 밖에서도 추적 가능하게 해 가독성이 높다.

## 위험도

NONE — 이전 라운드의 CRITICAL 지적사항(hooks hot-path 회귀 테스트 부재)이 이번 배치에서 실제로 닫혔음을 5개 독립 뮤테이션으로 재확인했고, 새로운 회귀나 커버리지 갭은 발견되지 않았다. 남은 항목은 전부 INFO 수준(수치 서술의 좁은 스코프, 새 헬퍼의 격리 테스트 부재, 두 개의 미실행 방어 분기, null 케이스 미검증)이며 모두 이전 라운드부터 알려진 낮은 위험도이거나 사소한 신규 관찰이다.
