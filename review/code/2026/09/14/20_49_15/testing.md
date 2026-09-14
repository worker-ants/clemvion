# 테스트(Testing) 리뷰 — trigger-config-lost-update (5라운드)

## 검증 방법

이전 4라운드가 뮤테이션으로 실측·정리한 항목들이 이번 배치(`889c93cd9` "삭제도 같은 락을
잡는다" 포함)에서도 유지되는지, 그리고 **이번 라운드에 처음 diff 에 들어온 코드**(주로
`remove()` 의 삭제-락, `touchLastTriggeredAt` 공용화, `extractInboundSigningRef` 격리
테스트, repo-guard 의 `manager.save` 형태 확장)를 중심으로 뮤테이션 재실측했다. 저장소
파일을 고쳐야 했던 두 자리는 원본을 scratch 디렉터리(`/private/tmp/.../scratchpad`)에
`cp` 로 백업 → 수정 → 테스트 실행 → `cp` 로 원복 → `git status --short`/`diff` 로 잔여물
없음을 확인하는 절차를 지켰다(`git checkout`/`restore` 미사용).

## 발견사항

- **[WARNING]** `remove()` 의 "락을 먼저 잡고 삭제한다" 는 순서가 **어느 테스트로도 검증되지
  않는다** — 실측: 순서를 뒤집어도 스위트 138건 전건 GREEN
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:960-963`
    (`manager.transaction(async (m) => { await acquireTriggerConfigLock(m, id); await m.remove(trigger); })`)
    / 대응 테스트: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3823-3834`
    (`'remove() 도 같은 config 락을 잡는다 (쓰기 시점 삭제 경합)'`)
  - 상세: 이 커밋(`889c93cd9`)의 존재 이유 자체가 "읽기 시점 가드(`!fresh`)는 **쓰기 시점**
    삭제 경합을 못 막는다 — 락을 먼저 잡아야 한다" 는 것인데, 그 순서를 지키는지 검증하는
    단언이 없다. 현재 테스트는 `expect(lockKeys).toContain('trigger-config:trig-l')` 와
    `expect(repo.remove).toHaveBeenCalled()` 두 개뿐이고, 둘 다 **순서 무관 존재 단언**이다.
    직접 뮤테이션으로 확인했다 — `await acquireTriggerConfigLock(m, id); await m.remove(trigger);`
    를 `await m.remove(trigger); await acquireTriggerConfigLock(m, id);` 로 뒤집은 뒤
    `npx jest src/modules/triggers/triggers.service.spec.ts` 를 돌리면 **138건 전건 GREEN**
    (해당 테스트 단독 실행도 GREEN)이었다. 원복 후 재확인, `git status --short` clean.
    같은 파일 안에 정확히 이 문제를 잡는 관용구가 이미 있다 — `runner.removeJob`/
    `triggerRepo.remove` 순서를 `mock.invocationCallOrder` 로 비교하는 테스트
    (`triggers.service.spec.ts:2412-2425`, `'DELETE (schedule 타입) → trigger 삭제 전
    removeJob 으로 BullMQ 엔트리 정리'`)와, 헬퍼 레벨에서도 `rewriteTriggerConfigLocked`
    자신은 "락을 읽기보다 먼저 잡는다" 를 호출 순서 배열로 직접 단언한다
    (`trigger-config-lock.spec.ts:61-71`). `remove()` 만 그 관용구가 빠졌다 — 참고로 이
    갭은 3라운드 리뷰(`review/code/2026/09/14/19_07_43` testing INFO)가 지적했던 "창 1 의
    락→읽기 순서도 unit 으로 직접 못 본다" 는 갭과 **같은 클래스**이지만, 창 1 은 e2e 가
    ①②③ 단언으로 간접 방어한다는 근거가 있었던 반면 `remove()` 는 e2e 커버리지 자체가
    없어(아래 참고) 그 간접 방어도 없다.
  - 제안: `withTransactionMock`/`onLock` 옵션을 확장해 락 획득과 `remove` 호출을 같은
    공유 순서 배열에 기록하게 하거나(예: `onLock`/`onRemove` 콜백을 하나의 `order: string[]`
    로 통합), 최소한 `query`(lock)·`remove` 양쪽에 `mock.invocationCallOrder` 를 걸 수
    있도록 내부 mock 참조를 테스트에 노출한다. 지금처럼 존재만 확인하는 단언은 이 커밋의
    핵심 보증(순서)을 지키지 않는다.

- **[WARNING]** binder 성공 경로의 `if (wrote) { channelListenerRegistry.register(...) }`
  게이트가 **어떤 테스트로도 행사되지 않는다** — 실측: 게이트를 통째로 제거해도 302건 전건
  GREEN
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:286-291`
  - 상세: 이 분기는 "삭제 경합 시 유령 listener 등재" 를 막기 위해 4라운드에서 도입됐고
    (`plan/in-progress/trigger-config-lost-update.md` §"4라운드 리뷰 처분" INFO#4, 아키텍처
    리뷰 `review/code/2026/09/14/18_17_44/architecture.md` 도 관측), 그때 "긍정적 설계"로
    평가됐지만 **테스트 관점에서 이 분기 자체를 행사하는 테스트가 있는지는 어느 라운드도
    확인하지 않았다.** 직접 뮤테이션으로 확인했다 — `if (wrote) { register(...) }` 를
    무조건 `register(...)` 호출로 바꾼 뒤 `npx jest src/modules/triggers` 를 돌리면
    **302건 전건 GREEN**(1건 skip 은 무관 항목)이었다. `grep -rln "ChannelListenerRegistry"
    src --include="*.spec.ts"` 로 전수 확인해도 `.register(` 호출 자체를 단언하는 테스트가
    프로젝트 전체에 **0건**이다(DI provider 로만 mock 되고 호출 인자는 아무 데서도 검사되지
    않는다). `wrote=false`(재읽기 시점 삭제됨) 시나리오는
    `triggers.service.spec.ts` 의 lost-update describe 안에 이미 있는 헬퍼
    (`makeService([() => undefined as never])`, 3813행/3840행에서 각각 창 1·`rotateBotToken`
    에 씀)를 `patchChatChannel` 경로에 한 번 더 조합하기만 하면 만들 수 있어 인프라 추가
    비용은 없다. 원복 후 `git status --short`/`diff` 로 clean 확인.
  - 제안: `makeService([withRef, () => undefined as never])` 형태로 창 1 재읽기는 정상,
    binder 재읽기는 삭제됨을 만들어 `patchChatChannel` 을 호출한 뒤
    `expect(channelListenerRegistry.register).not.toHaveBeenCalled()` 를 거는 테스트를
    추가한다(양성 쪽 `expect(...).toHaveBeenCalledWith(...)` 도 아직 없으므로 함께).

- **[INFO]** hooks.service.spec.ts 의 두 회귀 테스트 제목이 서로 다른 `describe` 안에서
  글자 그대로 동일하다
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts:201`
    (`describe('HooksService')` 최상위)과 `:810`(`describe('Chat Channel 분기')` 중첩) —
    둘 다 `it('lastTriggeredAt 갱신이 config 를 다시 쓰지 않는다 (컬럼 한정 update)', ...)`.
  - 상세: Jest 는 부모 `describe` 이름으로 구분하므로 실행·리포팅 자체는 문제없고, 810행
    주석이 "대칭 자리" 임을 의도적으로 서술하고 있어 **동일한 불변식을 다른 call site 에서
    반복 확인한다** 는 의도가 읽힌다(오히려 819번째 줄의 3라운드 CRITICAL#2 재발 방지
    맥락과 맞음). 다만 `-t "lastTriggeredAt 갱신"` 처럼 이름만으로 필터링하면 두 테스트가
    함께 걸려 "어느 call site 가 실패했는지" 를 실행 로그 제목만으로 즉시 구분하기 어렵다.
  - 제안: 필수 아님. 필요하면 제목에 call site 를 짧게 덧붙인다(예: `'... (handleWebhook)'`
    / `'... (chat-channel 인입)'`).

- **[INFO]** repo-guard 의 신규 `isManagerTriggerSave` 판별이 `Trigger` **네임스페이스
  한정 식별자**(`Entities.Trigger` 형태) 형태는 못 잡는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`
    (`ts.isIdentifier(first) && first.getText(sf) === TRIGGER_ENTITY` 조건)
  - 상세: `m.save(Trigger, x)` 형태만 커버하고 `m.save(Entities.Trigger, x)` 처럼 프로퍼티
    접근으로 참조되면 `ts.isIdentifier` 가 거짓이라 스캔 대상에서 빠진다. 이 저장소의
    `Trigger` import 관례(`import { Trigger } from './entities/trigger.entity'`)상 실제로
    이 형태가 나올 가능성은 낮아 보이지만, fixture(`endpoint-path-save.fixture.ts`)에도
    이 변형을 가르는 케이스는 없다.
  - 제안: 조치 불요 수준. 실제로 네임스페이스 import 관례가 생기면 그때 fixture 를
    추가한다.

## 긍정적으로 확인한 점 (참고)

- `trigger-config-lock.spec.ts` 는 헬퍼의 계약(락→읽기 순서, `config` 비어있음 정규화,
  `columns`/`config` 스프레드 순서, 행 삭제 시 `false`+머지 미호출)을 순서 배열까지 포함해
  직접 실행 가능한 단위로 고정해 뒀다 — 서비스 경유로는 만들 수 없는 분기(재읽기 시점 행
  삭제)를 정확히 겨눈 설계다.
- `withTransactionMock` 은 콜백을 실제로 실행하고 내부 `query`/`findOne`/`save`/`update`/
  `remove` 를 바깥 repo mock 에 위임하는데, 그 위임이 장식이 아님을 "콜백 미실행" 뮤테이션
  실측(문서화된 시점 값 53건)으로 근거를 남겨 뒀다 — 이 저장소가 반복 강조하는 "GREEN 은
  증거가 아니다" 원칙을 스스로 실천한 드문 사례다.
- `chat-channel-input-rules.spec.ts` 의 `extractInboundSigningRef` 신규 테스트는
  `it.each` 로 7가지 입력 형태(정상·필드 없음·`null`·키 없음·빈 객체·`config` 자체가
  `null`/`undefined`)를 표로 고정해 부재 표현의 여러 축을 한 자리에서 판별 가능하게 했다.
  이전 라운드(20_17_16 testing INFO#7)가 지적한 "간접 커버만 있었다" 갭을 정확히 닫는다.
  실제로 `npx jest`로 확인해도 GREEN.
- `triggers.service.spec.ts` 의 "락 안 재읽기가 동시 확립분을 본다" describe 는 `withRef`/
  `withoutRef` 두 fixture 를 **의도적으로 다른 컬럼 값**(`chatChannelHealth` 등)까지 갖게
  설계해, "스냅샷으로 병합" 류의 뮤턴트가 대조군을 구분 못 하고 살아남는 것을 막았다 —
  주석에 그 실패 경험(한 번 살려 보냈다)까지 정직하게 남겨 뒀다.
- e2e(`trigger-config-lost-update.e2e-spec.ts`)는 우연한 인터리빙에 기대지 않고 advisory
  lock 을 테스트가 직접 쥐어 결정적으로 겹침을 만들고, 단언을 ①②③ 세 갈래로 나눠 "하나만
  남기면 나머지가 조용히 통과" 하지 않게 설계했다. 다만 이 e2e 는 PATCH-vs-PATCH 겹침만
  다루고 `remove()` 의 삭제 경합은 다루지 않는다 — 위 WARNING#1 이 unit 으로도 e2e 로도
  방어되지 않는 이유다.

## 이전 라운드 대비 변화 요약

3라운드(`19_44_08`)가 지적한 "chat-channel 인입 자리에 회귀 테스트 부재"(CRITICAL#2)는
`hooks.service.spec.ts:810` 의 대칭 테스트로 정확히 닫혔다 — 직접 실행해 GREEN 을 확인했고,
주석이 이전 실측 실패("뮤턴트 스크립트가 두 자리 중 하나만 건드렸다")를 정직하게 남겨 뒀다.
4라운드(`20_17_16`)가 문서 수준에서 관측한 "삭제 경합 시 유령 listener 등재" 는 코드는
고쳐졌지만(WARNING#2), 이번 라운드에 처음 뮤테이션으로 확인한 결과 **그 수정 자체를 지키는
테스트가 없다.** `remove()` 의 신규 삭제-락(WARNING#1)도 존재는 검증되지만 순서는 검증되지
않는다 — 두 갭 모두 "코드는 맞는데 회귀 방지가 안 된다" 는 같은 성격이다.

## 요약

이번 배치는 지난 라운드들이 지적한 커버리지 갭(chat-channel 인입 대칭 테스트, `extractInboundSigningRef` 격리 테스트, 헬퍼의 행-삭제 분기)을 실제로 닫았고, 그 근거를 GREEN
확인이 아니라 뮤테이션 실측으로 남기는 규율이 파일 곳곳(주석)에서 일관되게 지켜지고 있다.
다만 이번 라운드에 새로 들어온 두 자리 — `remove()` 의 "락을 먼저 잡는다" 는 순서 보증과,
binder 성공 경로의 `wrote` 게이트(유령 listener 등재 방지) — 는 둘 다 **존재만 검증되고
동작은 검증되지 않는다.** 두 곳 모두 직접 뮤테이션(순서 반전, 게이트 제거)으로 재현했고
각각 138건·302건 전건 GREEN 으로 확인했다. 두 결함 모두 이 PR 이 명시적으로 의도한 보증을
정면으로 겨누므로(전자는 이 배치의 마지막 커밋 자체의 존재 이유, 후자는 4라운드가 이미
"긍정적 설계"로 기록한 항목) 회귀 방지 관점에서 방치하면 다음 리팩터가 조용히 되돌릴 수
있다. 그 외 인프라(`withTransactionMock`)·edge-case 테스트(`extractInboundSigningRef`)·
e2e 설계는 모두 견고하다.

## 위험도

MEDIUM
