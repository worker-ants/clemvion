# 아키텍처(Architecture) Review — trigger-config lost-update (9라운드 시점)

## 검토 범위와 방법

`trigger-config-lock.ts`(신규) · `triggers.service.ts` · `chat-channel-binder.service.ts` ·
`chat-channel-input-rules.ts` · `hooks.service.ts` · `schedules.service.ts` ·
`endpoint-path-conflict-wrap-guard.ts` 및 관련 테스트/e2e/`__test-utils__`를 실제 소스로 직접
열어 확인했다(diff 는 여러 곳이 잘려 있어 grep + Read 로 보완). 이 변경 세트는 이미
`review/code/2026/09/14/{18_17_44..22_24_35}` 8라운드를 거쳤고, `plan/in-progress/
trigger-config-lost-update.md` §D 가 라운드별 처분·유예 근거·뮤턴트 실측을 전부 기록해 뒀다.
이번 라운드에서 SOLID/결합도/레이어/순환의존/추상화/모듈경계/확장성 관점으로 **새로** 확인한
것과, 기존 8라운드가 이미 다룬 것을 구분해 적는다.

## 발견사항

- **[INFO]** `rewriteTriggerConfigLocked`/`acquireTriggerConfigLock` 이 `Trigger` 엔티티에
  하드코딩돼 있어 다른 엔티티의 같은 lost-update 클래스에 재사용할 수 없다 (재확인, 변경 없음)
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:136-173`
    (`rewriteTriggerConfigLocked` 시그니처가 `Trigger` 타입을 직접 참조)
  - 상세: 8라운드에 걸쳐 이 유틸리티가 정착됐지만 제네릭화(`<T>`)는 하지 않았다. plan
    §후속(`"헬퍼가 Trigger 에 하드코딩"`)에 이미 등재돼 있고, 이번 PR 범위를 넓히지 말라는
    판단도 명시돼 있다 — 8라운드 리뷰가 반복 지적하지 않은 것도 같은 이유로 보인다. 새로운
    지적이 아니라 여전히 유효함을 재확인하는 차원.
  - 제안: 조치 불요(이미 후속 등재). 다른 엔티티에 같은 패턴이 필요해지는 시점에
    `rewriteTriggerConfigLocked<T>(manager, entityClass, id, merge, columns)` 로 매개변수화.

- **[INFO]** `Trigger` 애그리게잇에 대한 쓰기 일관성 모델이 여전히 두 갈래(락 재읽기-머지 vs
  advisory lock 미참여 컬럼-한정 `update()`)로 나뉘어 있고, 그 경계가 클래스 밖(주석·plan
  문서)에서만 드러난다 — 다만 이 갭 자체는 이미 concurrency 8라운드(`review/code/2026/09/14/
  22_24_35` WARNING)가 정확히 같은 지점을 실측·등재했다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1062-1104`
    (`rotateNotificationSecret` — advisory lock 미참여 `triggerRepository.update`) vs
    `:605-670`(`update()` 창 1 — 락 안에서 재읽은 행을 `m.save(Trigger, target)` 로 통째 저장)
  - 상세: 아키텍처 관점에서 보면 이것은 "`Trigger` 행에 대한 단일 쓰기 관문(aggregate write
    gateway)이 없다"는 구조적 특성이다 — 어떤 필드를 고치느냐에 따라 호출부가 각자 판단해
    락 참여 여부를 정한다(공유 인터페이스가 강제하지 않음). 지금은 그 판단이 문서화돼 있고
    (`config` 를 고치면 락, 아니면 컬럼 한정) 8라운드가 남은 위험을 필드별로 정확히
    분류했으므로(예: `notificationSecretV2` 는 보안 성격이라 우선순위가 높고, `lastTriggeredAt`
    은 관측용이라 낮음) 급조된 구조는 아니다. 다만 다음 사람이 `Trigger` 에 새 락-미참여
    writer 를 추가할 때, 그 판단 기준(“이 필드가 창 1 의 `fresh` 스냅샷에 실리는가”)이
    코드 어디에도 강제되지 않고 산문으로만 남아 있다 — 같은 판단을 또 틀리기 쉬운 자리다.
  - 제안: 즉시 조치 불요(concurrency WARNING 이 이미 같은 근거로 후속을 제안했다: 락 도메인을
    `rotateNotificationSecret` 까지 넓히거나 위험도 구분을 plan 표에 명시). 아키텍처
    관점에서 덧붙이면, 장기적으로는 "이 컬럼은 락 도메인 안/밖" 을 타입 수준(예: 컬럼 이름을
    리터럴 유니온으로 선언하고 `rewriteTriggerConfigLocked` 의 `columns` 파라미터만 그 타입을
    받게 하는 식)에서 드러내면 새 writer 를 추가할 때 컴파일러가 이 판단을 상기시킬 수 있다.

- **[INFO]** 정적 래칫 파서(`endpoint-path-conflict-wrap-guard.ts`)가 이번 PR 의 코드 형태
  변화를 따라가느라 특수 케이스가 누적되고 있다 — 정밀 파서를 선택한 데 따른 예상된 비용이지만
  추세로서 기록해 둔다
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts:26-35`
    (`TRIGGER_ENTITY` 식별자-이름 매칭 추가), `:111-120`(`isWrappedByConflictCatch` 가 함수
    경계를 넘어가도록 확장), `:162-170`(수신자 이름 또는 `Trigger` 식별자, 두 조건의 OR)
  - 상세: 이 가드는 애초에 "수신자 프로퍼티 이름이 `triggerRepository`" 라는 단일 형태만
    인식했는데, 이번 PR 이 `manager.transaction(async (m) => m.save(Trigger, …))` 형태를
    도입하자 (a) 수신자 이름 매칭이 무력화되고 (b) `.catch` 탐색이 콜백 함수 경계에서 멈춰
    래핑을 놓치는 두 결함이 동시에 드러났다. 둘 다 파일 내 주석이 원인·수정 근거를 정확히
    남겨 뒀고 fixture(`managerSaveWrapped`/`managerSaveUnwrapped`/`managerSaveOtherEntity`)로
    회귀를 고정했다 — 수정 품질 자체는 좋다. 다만 `first.getText(sf) === TRIGGER_ENTITY` 는
    **수신자와 무관하게** 첫 인자가 문자 그대로 `Trigger` 인 모든 `.save(...)` 호출을 대상으로
    잡는다 — 예컨대 무관한 유틸 함수가 `helper.save(Trigger, x)` 형태를 쓰면(현재 코드베이스엔
    없음) 이 가드가 그것도 트리거 저장으로 오인해 스캔한다. 낮은 확률이고 fail-safe 방향(더
    엄격하게 잡는 쪽)이라 위험하지는 않지만, "정밀 파서"가 실제로는 타입 정보 없이 텍스트
    이름만 보는 한 이런 형태의 오탐 여지가 매 특수 케이스마다 조금씩 늘어난다.
  - 제안: 조치 불요. 다음에 저장 형태가 또 바뀌면(예: 중첩 트랜잭션, `Promise.all` 로 묶인
    병렬 저장) 같은 패턴으로 fixture 를 먼저 늘리고 파서를 넓히는 지금 방식을 유지하되,
    "임의 식별자 `Trigger`" 매칭이 실제 오탐을 내면 그때 첫 인자 타입 추론(불가능하면 최소
    `EntityManager` 타입의 수신자로 좁히는 방법)으로 좁히는 것을 고려.

## 확인했으나 문제 없음 (긍정적으로 평가한 설계)

- **DRY 추출이 실제 재발 방지로 이어졌다.** `acquireTriggerConfigLock`(락 SQL 한 줄을 두 자리가
  손으로 복제하던 것을 통합), `mergeIntoFreshSubKey`(하위 키 스냅샷 대입 lost-update 가 세
  자리에서 반복 재발하자 시그니처로 봉쇄), `touchLastTriggeredAt`(hooks 두 자리의 복제가 실제로
  이 PR 을 물었던 사례), `extractInboundSigningRef`(세 자리에 흩어진 동일 인라인 캐스트 통합) —
  넷 다 "복제가 drift 를 부른다" 는 같은 교훈에서 나온 리팩터고, plan 문서가 각각의 실측
  근거(뮤턴트 RED)를 남겨 뒀다.
- **레이어·모듈 경계가 명확하다.** `trigger-config-lock.ts`(순수 DB 프리미티브, 도메인 지식
  없음) → `chat-channel-binder.service.ts`/`triggers.service.ts`(도메인 병합 규칙을 콜백으로
  주입) → `chat-channel-input-rules.ts`(순수 함수, DI 없음)로 이어지는 의존 방향이 단방향이고
  순환이 없다. `ChatChannelBinderService` 가 `chat-channel/` 이 아니라 `triggers/` 에 남은
  이유(순환 재발 방지)도 클래스 docblock 에 근거와 함께 명시돼 있다.
- **외부 호출을 임계 구간 밖에 두는 원칙이 신규 지점 전부에 일관 적용됐다.** `update()`·
  `setupChatChannel()`(성공/실패 경로)·`rotateBotToken()`·notification/interaction 관련
  네 자리 모두 "외부 호출 → 락 안 재읽기·머지·쓰기" 순서를 지킨다 — 이 저장소가 Cafe24 advisory
  lock 을 기각했던 선례(HTTP 를 트랜잭션 안에 묶지 않는다)를 정확히 학습해 반영했다.
- **삭제(`remove()`)와 쓰기(`update()`/binder/`rotateBotToken`)가 같은 락 프리미티브를
  공유**해 "읽었을 땐 있었는데 저장 직전 삭제" 경합을 구조적으로 막는다. 삭제만 대기 상한을
  두는 비대칭도 "이번 요청의 결과인가, 뒤따르는 부수 작업인가"라는 명시적 판단 기준으로
  일관되게 설명된다.

## 참고 (절차 투명성, 이슈로 집계하지 않음)

리뷰를 마친 시점에 `git status --short` 로 확인하니 워킹트리에 **내가 만들지 않은** 미커밋
변경이 하나 있었다: `codebase/backend/src/modules/triggers/triggers.service.ts` 의
`cleanupRotatedChatChannelTokens` 안에서 `this.triggerRepository.update({ id }, { chatChannelTokenV2: null, chatChannelRotatedAt: null })`
(컬럼 한정)이 `this.triggerRepository.save(trigger)`(엔티티 통째 저장)로 되돌려져 있다. 이
리뷰는 저장소를 뮤테이션하지 않았고(읽기 전용 `Read`/`grep`/`wc` 만 사용), 다른 reviewer 가
같은 워킹트리에서 뮤턴트 검증 중일 가능성이 높다(병렬 fan-out 규약이 경고한 상황과 일치,
5라운드 처분 기록에도 같은 종류의 관측이 있었다). `git checkout`/`restore` 는 규약상 금지라
되돌리지 않았다 — 이 변경이 diff 로 커밋/제출되면 그것은 §D 8라운드가 이미 닫은 지점의
회귀이므로, 다음 라운드가 이 상태가 남아 있는지 `git status --short` 로 재확인할 것을 권고한다.

## 요약

이 변경 세트는 `trigger.config` lost-update 를 "advisory lock 안에서 최신 행을 재읽어 병합"
이라는 단일 설계로 닫고, 그 설계를 도메인 지식 없는 프리미티브(`trigger-config-lock.ts`)로
분리한 뒤 그 위에 4개 창(now 11개 쓰기 지점)을 얹었다. 8라운드에 걸친 반복 리뷰가 이미
SOLID·결합도·순환의존 관점의 실질적 문제(하드코딩된 락 프리미티브, 반환값 미관측, 두 쓰기
일관성 모델의 공존)를 전부 찾아 plan 문서에 근거·트레이드오프와 함께 등재했고, 이번 라운드가
직접 코드를 읽어 재확인한 결과 그 기록은 정확했다 — 특히 `notificationSecretV2` 락 도메인
이탈처럼 architecture 관점에서도 우려되는 지점은 concurrency 8라운드가 이미 WARNING 으로
포착·등재했다. 이번 라운드에서 새로 추가할 만한 것은 정적 래칫 파서가 코드 형태 변화를
따라가며 특수 케이스를 누적하는 추세 정도이며, 이는 차단 사유가 아니다. DRY 추출
(`acquireTriggerConfigLock`/`mergeIntoFreshSubKey`/`touchLastTriggeredAt`/
`extractInboundSigningRef`)은 실제 재발한 결함에서 나온 것으로 설계 절제가 좋다. 아키텍처
관점에서 이 배치를 막을 사유는 없다.

## 위험도

LOW
