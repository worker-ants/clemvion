# 부작용(Side Effect) Review — trigger-config-lost-update (9라운드째 최종 상태 검토)

## 검토 범위와 방법

`origin/main...HEAD` 전체 diff(14개 프로덕션/테스트 파일)를 대상으로, 프롬프트에서 생략된
파일(`chat-channel-binder.service.ts`·`trigger-config-lock.ts`·`triggers.service.ts`·
`triggers.service.spec.ts`·e2e spec·plan 문서)은 저장소에서 직접 `git diff`/`Read` 로 원문을
확인했다. 이 PR 은 이미 8라운드에 걸쳐 side_effect 관점을 포함한 다관점 리뷰를 받았고
(`review/code/2026/09/14/{18_17_44,19_07_43,19_44_08,20_17_16,20_49_15,21_18_21,21_50_09,22_24_35}`),
plan(`plan/in-progress/trigger-config-lost-update.md`)이 그 처분을 라운드별로 표로 추적한다.
아래는 그 이력과 대조해 **이미 다뤄진 항목은 재확인만**, **아직 등재되지 않은 것으로 보이는
것**만 새로 적는다. 저장소 파일은 뮤테이션하지 않았다(`git status --short` 로 확인, 잔여 없음).

## 발견사항

- **[WARNING]** `update()` 가 `chatChannel` 없이 `normalization` 만 도는 경로에서, API 응답이
  **DB 에 실제로 커밋된 값보다 오래된 `notification` 서브키**를 돌려줄 수 있다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `normalizeNotificationSecretRef`
    (852-874행, in-memory 대입은 856-860행 `trigger.config = { ...trigger.config, notification: normalizedNotification }`,
    실제 쓰기는 864-874행 `rewriteTriggerConfigLocked(... mergeIntoFreshSubKey ...)`). 호출부는
    `update()` 648-650행(`await this.normalizeNotificationSecretRef(saved); let result = saved;`)과
    674행(`return this.sanitizeForResponse(result);`) — `chatChannel` 이 요청에 없으면 526행의
    `if (chatChannel)` 재조회 분기를 타지 않아 `result` 는 끝까지 `saved` 그대로다.
  - 상세: 8라운드 수정(`mergeIntoFreshSubKey`)이 고친 것은 **DB 에 쓰는 값**이다 — 이제
    `notification` 서브키는 락 안에서 재읽은 `freshConfig.notification` 위에 `signing` 만 얹어
    정확히 병합된다. 그런데 **API 응답에 실리는 in-memory 값**(`trigger.config.notification`)은
    여전히 그 이전 줄(856-860)에서 만든 `normalizedNotification` — 즉 **락 이전 스냅샷** 그대로다.
    `update()`(491행)의 본 트랜잭션이 커밋을 마친 **뒤**, `normalizeNotificationSecretRef` 가
    별도의 두 번째 advisory-lock 트랜잭션을 여는 사이에 다른 요청이 같은 트리거의
    `config.notification`(예: `url`·`headers` 같은 signing 이외 필드)을 커밋하면, DB 는 그
    값을 올바르게 보존하지만(고쳐진 부분) `update()` 가 클라이언트에게 돌려주는 응답 바디는
    그 필드를 **누락한 채로** `normalizedNotification`(구 스냅샷)을 보여준다 — 저장된 것과
    응답이 갈리는 새로운 형태의 read-after-write 불일치다. 이전 코드는 `save(trigger)` 로
    in-memory 값을 그대로 영속화했으므로 이 발산 자체가 구조적으로 불가능했다 — **lost-update
    를 DB 레벨에서 닫으면서, 그 대가로 "응답이 항상 방금 쓴 값과 같다" 는 이전의 암묵적
    불변식을 깼다.** 보안에 영향은 없다(plaintext 는 어차피 in-memory 대입에서도 제거됨) —
    영향은 응답 바디 정확성뿐이다. 발생 조건이 "같은 트리거에 대해 signing-secret 마이그레이션이
    필요한 PATCH 와 notification 서브필드를 바꾸는 다른 PATCH 가 좁은 창(두 번째 advisory-lock
    획득 전)에서 겹쳐야" 하므로 빈도는 낮다. `create()`(403행)의 동일 패턴(449-450행)은
    트리거 id 가 방금 생성돼 다른 요청이 아직 알 수 없으므로 사실상 도달 불가능.
    8라운드까지의 side_effect 리뷰 이력(`19_44_08`)은 이 지점을 "`normalizeNotificationSecretRef`
    의 쓰기가 락 없이 스냅샷을 통째로 덮는다"는 **DB 측** 결함으로만 등재했고, 그 결함이
    고쳐진 뒤 남는 **응답 측** 잔여 불일치는 plan 의 "후속" 표·`## 하지 않는 것` 어디에도
    보이지 않는다.
  - 제안: 급한 조치는 아니다(낮은 빈도·비보안). 다음 중 하나로 닫을 수 있다: (a) `create`/`update`
    양쪽에서 `chatChannel` 유무와 무관하게 모든 `config`-쓰기 헬퍼 호출 뒤 한 번만 재조회하도록
    통일, (b) `normalizeNotificationSecretRef` 가 실제로 병합해 쓴 `notification` 객체를
    반환하도록 시그니처를 바꿔 호출부가 `saved.config.notification` 을 그 반환값으로 갱신, (c)
    최소한 이 갭을 `## 하지 않는 것`/후속 표에 §8 스타일로 등재해 "응답은 항상 최신"이라는
    오해를 막는다.

- **[INFO]** 같은 함수의 `rewriteTriggerConfigLocked` 반환값(삭제 경합 시 `false`)이 관측되지
  않는다 — 형제 동기 경로(`revokePerTriggerToken`·`rotateBotToken`)와 다른 취급
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:864-874`
    (`normalizeNotificationSecretRef` 내부 `await rewriteTriggerConfigLocked(...)` — 반환값을
    받지 않음)
  - 상세: `trigger-config-lock.ts` JSDoc 의 "부재를 드러내는 방식" 표는 동기 요청 경로(창 1·
    `rotateBotToken`)는 **404 로 드러내야 한다**고 명시하고, 실제로 `revokePerTriggerToken`
    (triggers.service.ts, `wroteInteraction` 확인 후 `throwTriggerNotFound()`)과 `rotateBotToken`
    (`if (!wrote) this.throwTriggerNotFound();`)은 그 규율을 따른다. `normalizeNotificationSecretRef`
    는 `create()`/`update()`라는 같은 부류의 동기 요청 안에서 호출되는데도 반환값을 버려,
    트리거가 그 사이 삭제됐을 때 secret store 에는 이미 `secrets.rotate()`(845행)로 새 ref 가
    기록됐지만 `config` 쓰기는 조용히 no-op 된다 — 위 표에도, 8라운드 "부재 처리 판단 기준"
    서술에도 이 세 번째 함수는 등장하지 않는다. 실제 손상(orphan secret row)은 이미 plan
    후속 표의 "secret store 쓰기·provider 등록의 원자성" 항목(5라운드 W1)이 더 넓게 잡고 있어
    **새 위험은 아니다** — 다만 그 항목이 언급하는 것은 `setupChatChannel`/`rotateBotToken`
    이고 `normalizeNotificationSecretRef` 는 명시적으로 나열돼 있지 않아, 같은 클래스의 세
    번째 사례로 등재해 두는 편이 다음 사람에게 도움이 된다.
  - 제안: 조치 불요(이미 더 넓은 후속 항목에 사실상 포함). 후속 착수 시 그 항목의 대상
    호출부 목록에 `normalizeNotificationSecretRef` 를 추가하는 것을 권고.

- **[INFO]** (재확인, 이미 검증됨) `ChannelListenerRegistry.register()` 호출이 무조건 → `wrote`
  조건부로 바뀜 — 의도된 콜백 배선 변경
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:286-291`
  - 상세: 8라운드까지 여러 차례(`18_17_44` INFO#4, `22_24_35` INFO) 확인된 항목과 현재 코드가
    일치한다 — `rewriteTriggerConfigLocked` 가 삭제 경합으로 쓰기를 skip 하면(반환 `false`)
    listener 등록도 함께 건너뛴다. 유령 in-memory entry 를 막는 의도된 변경이고 대조군
    테스트가 걸려 있다. 새 결함 아님.
  - 제안: 조치 불요.

- **[INFO]** (재확인, plan 에 명시적으로 등재된 알려진 잔여 경로) `UpdateTriggerDto.config`
  raw 필드가 락 안 재읽기 병합을 우회한다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` 트랜잭션
    콜백의 `const baseConfig = this.stripInlineAuthKeys(config ?? fresh?.config ?? trigger.config ?? {});`
  - 상세: 클라이언트가 PATCH 바디에 `config` 필드를 명시하면 `fresh?.config`(락 안 재읽은
    최신 행)를 건너뛰고 요청 바디의 `config` 값 자체가 병합 기준이 된다 — 동시에 커밋된
    `chatChannel`/`interaction`/`notification` 서브키가 조용히 사라질 수 있다. `plan/in-progress/
    trigger-config-lost-update.md` §8라운드 후속 표에 "**의도된 설계**(사용자가 통째로 보낸
    것이 곧 의도)"라는 근거와 함께 명시적으로 등재돼 있고, 현재 코드는 그 설명과 정확히
    일치한다. 재-flag 하지 않고 추적 상태만 재확인한다.
  - 제안: 조치 불요(추적됨, developer/plan 소유자 판단 대기).

- **[INFO]** `acquireTriggerConfigLock` 의 `SET LOCAL lock_timeout` 문자열 보간 — 이미 수용된
  세션 범위 부작용의 재확인
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:39-63`
  - 상세: `Math.trunc(options.timeoutMs)` 로 정수만 보간되고 유일한 프로덕션 호출부
    (`triggers.service.ts` 의 `remove()`)는 모듈 상수 `TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000`
    만 넘긴다 — 인젝션 경로 없음. `SET LOCAL` 이 advisory lock 하나가 아니라 그 트랜잭션의
    모든 락 대기(뒤따르는 `DELETE` 행 잠금·`Schedule.triggerId` CASCADE 포함)에 적용된다는
    사실은 JSDoc 에 이미 명시돼 있다. 새 위험 없음.
  - 제안: 조치 불요.

## 시그니처·인터페이스·환경 변수·네트워크 변경 점검

- **함수 시그니처**: `TriggersService` 에 신설된 `assertTriggerFound`·`findByIdForUpdate`·
  `mergeIntoFreshSubKey`·`throwTriggerNotFound`·`touchLastTriggeredAt`(hooks) 는 전부 `private`
  이고 기존 공개 메서드(`findById`·`update`·`remove`·`rotateBotToken`·`revokePerTriggerToken`)의
  시그니처(파라미터·반환 타입)는 변경되지 않았다 — 호출자 영향 없음.
- **공개 API**: 컨트롤러·DTO·라우트·응답 스키마 변경 없음(별도 `api_contract` 리뷰가 이미
  확인). 위 신규 WARNING 은 응답 스키마가 아니라 응답 **값의 신선도** 문제라 이 범주에 속하지
  않는다.
- **환경 변수**: 신규 읽기/쓰기 없음. e2e 스펙의 `process.env.E2E_BASE_URL` 은 기존 e2e 파일들과
  동일한 기존 패턴.
- **네트워크 호출**: 외부 provider 호출(`adapter.setupChannel`)은 이미 있던 호출이고, 이 PR 은
  그 호출을 advisory lock **밖**에 유지하는 것이 핵심 설계라 새 외부 호출은 없다.
- **이벤트/콜백**: 위에서 다룬 `channelListenerRegistry.register()` 조건화 외에 콜백 발생 지점
  변경 없음. `EntitySubscriber`/`@BeforeUpdate`/`@AfterUpdate` 는 저장소 전체에 0건(19_44_08
  라운드 실측, 재확인 결과 여전히 유효)이라 `save()`→`update()` 전환이 우회하는 리스너도 없다.

## 요약

이 PR 은 `trigger.config` lost-update 를 advisory lock + 락 안 재읽기로 닫는 작업을 9라운드에
걸쳐 다듬어 왔고, side_effect 관점에서 지금까지 제기된 항목(락 대기 무상한·SET LOCAL 의
세션 범위·유령 listener 등록·삭제 경합·반환값 미관측·`UpdateTriggerDto.config` 우회)은
전부 코드로 고쳐졌거나 plan 에 명시적으로 등재·수용됐음을 현재 코드와 대조해 재확인했다.
이번 라운드에서 새로 확인한 것은 하나다 — 8라운드가 `notification` 서브키의 **DB 쓰기**를
정확히 고치면서, 그 수정 이전부터 있던 "in-memory 값을 그대로 응답에 쓴다"는 관행과
새로 생긴 "DB 쓰기가 요청 시작 시점 스냅샷보다 최신일 수 있다"는 사실이 충돌해, `update()`
가 좁은 동시성 창에서 실제 저장값보다 오래된 `notification` 서브키를 응답으로 돌려줄 수
있다(WARNING). 보안·데이터 무결성에는 영향이 없고(DB 자체는 정확), 발생 조건이 좁아
차단 사유는 아니나 이 PR 이 반복해서 강조해 온 "완결 선언"의 정확성을 위해 plan 에
등재할 가치가 있다. 그 외에는 시그니처·공개 인터페이스·환경 변수·네트워크 호출·이벤트
발생 지점 모두 이번 변경 범위 안에서 새로운 위험을 만들지 않았다.

## 위험도

LOW
