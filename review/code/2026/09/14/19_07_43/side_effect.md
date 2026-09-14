# 부작용(Side Effect) Review

## 검토 범위

핵심 변경(`trigger-config-lock.ts` 신규 + `chat-channel-binder.service.ts`·`triggers.service.ts`
세 write-site + 관련 테스트/가드)을 실제 소스로 열어 확인했다. `review/`·`plan/`·`CHANGELOG.md`
는 산출물/문서라 런타임 부작용 관점에서는 해당 없음으로 처리했다.

## 발견사항

- **[WARNING]** 이 PR 이 잠근 "네 자리" 밖에, `trigger.config` 를 **락 없이 통째로 덮어쓰는**
  형제 write-site 가 최소 3곳 더 있고, 그중 하나(`revokePerTriggerToken`)는 legacy 데이터가
  아니라 **지금도 상시 도달 가능한 라이브 엔드포인트**다 — 이 PR 이 닫으려는 바로 그
  fail-open(`chatChannel.inboundSigningRef` 소실)을 인접 코드 경로로 재현할 수 있다.
  - 위치:
    - `codebase/backend/src/modules/triggers/triggers.service.ts` `revokePerTriggerToken`
      (972~1006행, 특히 `997`: `trigger.config = { ...trigger.config, interaction: updated }`,
      `998`: `await this.triggerRepository.save(trigger)`)
    - 같은 파일 `normalizeNotificationSecretRef` (735~766행, 특히 `758`·`765`) — `update()`
      의 `599`행과 `create()` 의 `448`행에서 호출
    - 같은 파일 `promoteRotatedNotificationSecrets` (1189~1247행, 특히 `1240`·`1246`, 매시간
      cron)
  - 상세: 세 메서드 모두 (a) 어느 시점에 `trigger`/`fresh` 를 **한 번** 읽고 (b) `secrets.rotate`
    같은 `await` 를 거친 뒤 (c) 그 **읽은 시점의 in-memory `config` 스냅샷**을 통째로 스프레드해
    `triggerRepository.save(trigger)` 한다 — 이번 PR 이 `chat-channel-binder.service.ts`·
    `triggers.service.ts::update()`(창 1)·`rotateBotToken` 에서 걷어낸 것과 **같은 모양의
    lost-update** 다. 세 곳 다 `rewriteTriggerConfigLocked`/advisory lock 을 타지 않으므로,
    이들의 `save()` 와 이 PR 이 새로 락으로 보호한 4개 write-site 중 하나가 겹치면 나중에
    커밋되는 쪽이 이긴다 — `chatChannel.inboundSigningRef` 를 다른 트리거가 아니라 **같은
    요청 처리 흐름 밖의 형제 메서드**가 지울 수 있다.
    - `revokePerTriggerToken` 은 DTO 게이팅이 전혀 없는 **독립 엔드포인트**다(트리거의
      `interaction.tokenStrategy==='per_trigger'` 인 트리거라면 언제든 호출 가능). `chatChannel`
      과 `interaction` 은 서로 다른 config 하위 키라 같은 트리거에 둘 다 설정하는 것을 막을
      이유가 없고, 이 엔드포인트 호출과 동시에 그 트리거에 대한 `chatChannel` PATCH 가 겹치면
      곧바로 재현된다 — **legacy 데이터에 의존하지 않는, 상시 열린 창**이다.
    - `normalizeNotificationSecretRef` 는 `NotificationSigningDto` 가 더 이상 `secret` 필드를
      받지 않아(`dto/notification-config.dto.ts:38-48` 확인 — `algorithm` 만 존재) **legacy
      평문이 남아 있는 트리거에서 한 번만** 발동하는 마이그레이션 경로로 좁다. 그래도 그
      마이그레이션이 아직 안 끝난 트리거가 존재하는 한 창은 남는다.
    - `promoteRotatedNotificationSecrets` 는 상시 hourly cron 이라 `notification_secret_v2` 승격
      대상인 모든 트리거에 대해 매시간 이 창이 열린다.
  - 이미 알려진 갭인가: `plan/in-progress/trigger-config-lost-update.md` §D("같은 클래스의
    자리가 넷보다 많다")가 이 셋을 "기존 행에 `save(entity)` 하는 자리 10곳" 표에 **`config` 를
    명시 수정(✔)** 으로 정확히 열거해 뒀고, "이 PR 로 넓히지 않는다"고 명시적으로 유예했다 —
    그래서 이건 놓친 결함이 아니라 **의식적으로 연기된 잔여 위험**이다. 다만 그 유예의 근거
    문장("열 곳을 일괄로 락에 넣으면 위 hot path 에 트랜잭션을 새로 얹게 된다")은 표 안의
    **컬럼만 고치는 6곳**(`hooks.service.ts` 웹훅 타격마다 도는 hot path 등, ✔ 아닌 행)에는
    맞지만, `config` 를 명시적으로 덮어쓰는 이 3곳(✔ 표시)에는 그대로 적용되지 않는다 — 이들은
    PATCH/cron 빈도이지 요청마다 도는 hot path 가 아니다. "10곳을 한 축으로 묶어 함께 유예"한
    것이, 서로 다른 위험도의 두 부분집합(컬럼만 vs config 통째)을 같은 근거로 미룬 결과로 보인다.
  - 제안: 새 결함으로 처리하기보다, §D 표의 ✔ 3행(`normalizeNotificationSecretRef` ·
    `revokePerTriggerToken` · `promoteRotatedNotificationSecrets`)을 "컬럼만 고치는 6행"과
    분리해 **이 PR 의 후속으로 우선순위를 올릴지** 재검토를 권고한다. 특히
    `revokePerTriggerToken` 은 legacy-only 가 아니라 상시 재현 가능하므로 우선순위가 가장 높다.

- **[INFO]** `previousInboundSigningRef` 가 "창 1" 트랜잭션 콜백 **바깥**에서 선언되고
  **안**에서 재대입된다 — 오늘은 안전하지만 전제가 하나 있다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:512`(선언, `let`),
    `:560-562`(재대입, `manager.transaction(async (m) => {...})` 콜백 내부)
  - 상세: `manager.transaction()` 콜백이 정확히 한 번만 실행된다는 전제(현재 이 저장소에
    자동 재시도/`SERIALIZABLE` 격리 설정이 없음을 grep 으로 확인)하에서만 이 클로저 변수
    재대입이 "정확히 한 번, 락 안에서 읽은 값으로" 라는 의도대로 동작한다. `?? previousInboundSigningRef`
    폴백이 있어 재실행되더라도 값 자체가 틀리게 나오지는 않겠지만, 트랜잭션 재시도 정책이
    이 코드베이스에 도입되는 시점에는 이런 "콜백 안에서 바깥 `let` 을 대입" 패턴 전체를
    다시 점검해야 한다.
  - 제안: 지금 당장 조치 불필요. 재시도 정책 도입 시 체크리스트에 추가할 만한 항목.

## 검증한 것 — 부작용 없음으로 판정

- **새 export**(`rewriteTriggerConfigLocked`·`triggerConfigLockKey`·`TRIGGER_CONFIG_LOCK_PREFIX`)는
  기존 함수 시그니처를 하나도 바꾸지 않는 순수 추가다. 기존 호출자에게 영향 없음.
- **외부 네트워크 호출**(`adapter.setupChannel`·`this.secrets.rotate`)은 설계대로 새 advisory
  lock 임계구간 **밖**에 남아 있다 — `chat-channel-binder.service.ts`·
  `triggers.service.ts::rotateBotToken` 양쪽 다 실제 코드로 확인.
- **`withTransactionMock`**(신규 테스트 유틸)은 인자로 받은 mock 객체를 스프레드로 감싸
  새 객체를 반환할 뿐 원본을 mutate 하지 않는다(`manager` 가 이미 있으면 원본을 그대로
  반환 — 이것도 mutate 아님) — 테스트 간 mock 오염 없음.
- **`endpoint-path-conflict-wrap-guard.ts`** 의 새 `isManagerTriggerSave` 매칭(수신자 이름
  무관, 첫 인자가 `Trigger` 식별자)은 호출부(`endpoint-path-conflict-wrap.spec.ts`)가 스캔
  대상을 `modules/triggers/` 디렉터리로 한정해 호출하므로, 그 밖의 `EntityManager.save(Trigger, …)`
  형태를 가진 무관한 코드까지 잘못 집어내는 부작용은 없다(`grep` 으로 해당 디렉터리 안에
  다른 `save(Trigger, …)` 호출이 없음을 확인). 이 가드는 정적 분석 전용이라 런타임 부작용도
  없다.
- **e2e 테스트**(`trigger-config-lost-update.e2e-spec.ts`)가 `lockDb` 로 advisory lock 을
  직접 쥐는 것은 특정 신규 트리거 id 스코프의 lock key 에만 영향을 주므로 다른 테스트/트리거를
  오염시키지 않는다. (실패 시 `bPromise` 정리 미흡은 `concurrency.md` 가 이미 지적한 항목이라
  중복 기재하지 않는다.)
- **환경 변수**: 새로 읽거나 쓰는 환경 변수 없음. **파일시스템**: 새 파일 생성/수정 없음(테스트
  fixture·소스 파일 추가 자체는 이 diff 의 정상적인 코드 변경이지 런타임 파일 I/O 가 아님).
  **전역 변수**: 새 전역 상태 없음. **이벤트/콜백**: `channelListenerRegistry.register(...)` 호출
  조건은 이 diff 이전과 동일(성공 경로에서 무조건 호출, `rewriteTriggerConfigLocked` 반환값과
  무관)임을 `git show HEAD~2:...chat-channel-binder.service.ts` 로 대조해 확인 — 이 diff 가
  새로 만든 변경이 아니다.

## 요약

핵심 수정 자체(`trigger-config-lock.ts` + 세 write-site + "창 1")는 광고된 대로 동작한다 —
새 export 는 기존 시그니처를 깨지 않고, 외부 호출은 락 임계구간 밖에 남아 있으며, 새 테스트
유틸/가드도 다른 파일·다른 테스트를 오염시키지 않는다. 다만 이 PR 이 "네 자리 전부"를 잠갔다고
말하는 것과 별개로, **같은 서비스 안에 `trigger.config` 를 락 없이 통째로 덮어쓰는 형제
write-site 가 최소 3곳 더 있고, 그중 `revokePerTriggerToken` 은 legacy 데이터 여부와 무관하게
지금도 상시 재현 가능**하다 — 이 PR 이 닫으려는 fail-open 이 그 인접 경로로 되살아날 수 있다.
plan 문서가 이 갭을 이미 열거하고 의식적으로 유예했으므로 "놓친 결함"은 아니지만, 유예 근거가
그 3곳(=config 를 명시 수정하는 곳)과 나머지 6곳(=컬럼만 고치는 hot path)을 구분하지 않고
뭉뚱그린 것으로 보여 재검토를 권고한다. 그 외 클로저 변수 재대입 패턴은 현재 안전하지만
트랜잭션 재시도 정책 도입 시 재점검 대상으로 남겨 둔다.

## 위험도

MEDIUM
