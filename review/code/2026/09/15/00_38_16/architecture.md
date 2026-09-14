# Architecture Review — trigger.config lost-update 수정

## 검토 범위

`trigger-config-lock.ts`(신규) 를 중심으로 `TriggersService`·`ChatChannelBinderService`·
`SchedulesService`·`HooksService` 의 쓰기 경로가 "락 안 재읽기 + 델타 병합" 패턴으로
전환된 변경. 이미 15회 이상의 리뷰 라운드를 거친 성숙한 코드라, 이번 라운드에서는
**이전 라운드가 아직 짚지 않은** 응집도/배치 관점의 잔여 이슈를 위주로 본다.

## 발견사항

- **[WARNING]** 공유돼야 할 "락 안 재읽기 서브키 병합" 프리미티브가 `TriggersService` 의
  private 메서드에 갇혀 있다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `mergeIntoFreshSubKey`
    메서드(380행 부근) / 대비 대상: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`
    `survivesWithFresh`·`buildChannel` (209행, 226행 부근)
  - 상세: `trigger-config-lock.ts` 는 "컨테이너(`config`) 전체를 락 안에서 재읽어 병합"하는
    프리미티브(`rewriteTriggerConfigLocked`)를 모듈 단위로 소유해 여러 파일이 공유한다.
    그런데 그 한 단계 아래 — "재읽은 `config` 의 **서브키** 위에 델타를 얹는" 병합 로직은
    같은 파일에 있지 않고 `TriggersService.mergeIntoFreshSubKey` 라는 **private** 메서드로
    구현됐다. 이 메서드는 `TriggersService` 안에서는 4곳(`normalizeNotificationSecretRef` ·
    `revokePerTriggerToken` · `rotateBotToken` · `promoteRotatedNotificationSecrets`)이
    재사용해 DRY 를 잘 지키지만, **클래스 경계를 넘지 못한다.** 실제로
    `ChatChannelBinderService` 는 정확히 같은 문제("재읽은 `chatChannel` 위에 이번 호출의
    산출만 델타로 얹고, presence 게이트는 재읽은 값도 함께 본다")를 풀어야 했는데
    `mergeIntoFreshSubKey` 를 재사용하지 못하고 `survivesWithFresh`/`buildChannel` 이라는
    **별도 구현**을 새로 만들었다(전자는 순수 스프레드 델타, 후자는 조건부 재구성이라
    형태는 다르지만 "락 안 재읽기 결과를 기준으로 컨테이너를 건드린다"는 개념은 같다).
    즉 "안전한 서브키 병합"이라는 하나의 개념이 두 파일에 서로 다른 API 로 흩어져
    있고, 그 개념의 정본은 클래스 캡슐화 때문에 세 번째 소비자(예: 향후 `schedules/`
    쪽에서 같은 필요가 생길 경우)가 재사용할 통로가 없다.
  - 제안: `mergeIntoFreshSubKey` 를 `trigger-config-lock.ts` 로 옮겨 `rewriteTriggerConfigLocked`
    와 나란히 export 하는 것을 고려한다. 그러면 "컨테이너 재작성"과 "서브키 델타 병합"이
    같은 모듈에 정본으로 모이고, `ChatChannelBinderService` 가 향후 유사 케이스를 만들 때도
    (형태가 맞는 한) 같은 프리미티브를 재사용할 길이 생긴다. `buildChannel` 처럼 완전히
    다른 형태(조건부 재구성)가 필요한 자리는 그대로 둬도 무방하다 — 요점은 재사용 가능한
    형태(순수 델타 병합)까지 private 로 가둘 이유가 없다는 것이다.

- **[INFO]** 상태를 읽는 접근자가 "입력 검증 규칙" 모듈에 얹혀 이름-용도 불일치가 생겼다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:239-250`
    (`extractInboundSigningRef`)
  - 상세: `chat-channel-input-rules.ts` 의 기존 export(`assertChatChannelInputSafe` ·
    `assertInboundSigningPlaintextByProvider` · `assertPatchCarriesNoSecrets` ·
    `stripChatChannelPlaintext` · `translateSetupChannelError`)는 전부 **요청 DTO 를
    검증·변환**하는 함수다. 반면 `extractInboundSigningRef` 는 **이미 영속된 `trigger.config`**
    에서 값을 읽어 동시성 병합 게이트의 항으로 쓰는 순수 접근자라, "입력 규칙"이라는
    모듈 이름·서사와 결이 다르다. 세 자리에 중복돼 있던 인라인 캐스트를 하나로 모은 것
    자체는 좋은 DRY 판단이지만, 위치 선정은 "입력 검증"과 "영속 상태 읽기"라는 서로 다른
    책임을 한 파일 이름 아래 섞는다 — 다음 사람이 "PATCH 입력을 어떻게 검증하나"를 찾다가
    이 파일에서 "DB 값 어떻게 읽나"를 만나거나, 반대로 "config 읽기 헬퍼가 어디 있지"를
    찾다가 `*-input-rules.ts` 를 후보에서 제외할 수 있다.
  - 제안: 치명적이지 않으나, 다음에 이 파일을 만질 때 `chat-channel-config-rules.ts` 류의
    이름 분리나 최소한 파일 상단 개요에 "입력 검증 + 영속 상태 접근자 혼재"를 명시해 둘 것.

- **[INFO]** `TriggersService` 가 이번 PR 로 트랜잭션/락 오케스트레이션 책임을 추가로
  흡수해 God-service 경향이 더 짙어졌다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:606-670` (`update()` "창 1")
    · `993-1039` (`remove()`)
  - 상세: `TriggersService` 는 이미 11개 협력자를 주입받는 CRUD+시크릿회전+응답정화+스케줄동기화
    오케스트레이터였다(사전 존재 상태). 이번 PR 은 `update()`/`remove()` 안에 advisory lock
    획득·트랜잭션 관리·재읽기·`save`/`remove` 호출까지 **인라인**으로 추가해, 원래도 크던
    책임 표면을 더 넓혔다. 코드 자체가 이 예외("창 1은 `save()` 계약 보존 때문에 헬퍼를
    못 쓴다")를 JSDoc 으로 상세히 정당화하고 있어 즉흥적 결정은 아니지만, 구조적으로는
    "이 서비스 하나가 비즈니스 규칙과 동시성 인프라를 모두 알아야 한다"는 결합이 남는다.
  - 제안: 지금 당장 리팩터를 요구할 사안은 아니다(과거에 통합 시도가 6개 케이스 RED 로
    되돌려진 이력이 코드에 남아 있다). 다만 향후 `lock_timeout` 도입처럼 락 SQL 자체를
    바꿀 변경이 생기면, `acquireTriggerConfigLock` 공유만으로는 "창 1"과 헬퍼 두 자리를
    동시에 고쳐야 한다는 점을 팀 차원에서 인지하고 있을 것 — 이는 이미 `trigger-config-lock.ts`
    자체의 JSDoc(WARNING#4 인용)이 인지하고 있는 위험이라 이 리뷰에서는 재확인만 한다.

- **[INFO]** 테스트 더블(Trigger repo mock) 배선이 프로덕션 코드 변경을 자동으로 따라가지
  않는 구조적 격차 — 코드 스스로 문서화했지만 강제 장치는 없다.
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:34-47`
  - 상세: `withTransactionMock` 은 현재 `triggers.service.spec.ts` ·
    `triggers.web-chat.spec.ts` 두 파일에만 적용됐고, 파일 자체 JSDoc 이 "Trigger repo mock 이
    6개 파일에 흩어져 있고, 나머지 4개(`auth-configs`·`external-interaction`·`hooks`·
    `schedules`)는 `TriggersService.update()`/`remove()` 의 트랜잭션 경로를 아직 타지 않아
    안전하지만, 타는 순간 같은 `Cannot read properties of undefined (reading 'transaction')`
    로 깨진다"고 명시한다. 즉 "새 호출부가 `manager.transaction` 을 타면 그 경로를 개입시키는
    모든 테스트 파일의 mock 도 함께 바뀌어야 한다"는 불변식이 있는데, 이를 강제하는
    컴파일 타임/정적 가드가 없다 — 순수히 사람의 기억(JSDoc)에 의존한다. 이 저장소는
    바로 이 PR 에서도 `endpoint-path-conflict-wrap-guard.ts` 같은 AST 기반 정적 가드를
    확장해 프로덕션 코드의 유사한 불변식(≪`save()` 는 항상 래핑된다≫)은 강제하고 있어서,
    "프로덕션 코드는 가드로 강제, 테스트 더블 배선은 주석으로만 안내"라는 비대칭이 생긴다.
  - 제안: 즉시 조치가 필요한 항목은 아니다(코드가 이미 위험을 알고 다음 사람에게
    안내해 뒀다). 다만 이 비대칭이 반복되면(예: 5번째 라운드 발견처럼) `manager.transaction`
    도입 자리를 스캔해 "이 리포지토리를 주입받는 spec 파일 중 `manager` 없는 mock" 을
    찾는 가벼운 정적 가드를 추가하는 것을 고려할 만하다.

## 긍정적으로 확인한 설계 판단 (참고용, 이슈 아님)

- `trigger-config-lock.ts` 를 락 키·타임아웃·재읽기-병합 프리미티브의 **단일 진실**로
  분리해, `triggers.service.ts`·`chat-channel-binder.service.ts` 가 같은 코드를 지나가게
  한 것은 좋은 응집도 판단이다(`acquireTriggerConfigLock` 공유).
- `acquireTriggerConfigLock(manager: Pick<EntityManager, 'query'>, ...)` 는 필요한
  능력만 요구하는 인터페이스 분리(ISP) 적용 사례다.
- `EXPECTED_UNWRAPPED_TRIGGER_SAVES` 를 빈 배열로 만들고 AST 가드
  (`endpoint-path-conflict-wrap-guard.ts`)가 `EntityManager.save(Trigger, …)` 형태까지
  따라가도록 확장한 것은, 정규식이 아니라 `ts.isFunctionLike`/호출식 경계를 보는 정밀
  파서로 "빈 목록이 더 강한 상태"를 만든 좋은 fitness-function 패턴이다.
- `chat-channel-binder.service.ts` 를 `chat-channel/` 이 아니라 `triggers/` 에 유지한
  결정은 과거에 끊은 순환 의존(`#676`)을 되살리지 않기 위한 것으로, 근거가 코드 상단에
  분명히 남아 있다 — 순환 의존 관점에서 새로 발견된 문제는 없다.
- "창 1"(`update()`)이 헬퍼를 억지로 통합하지 않고 `save()` 계약(반환 엔티티·subscriber·
  UNIQUE 충돌 경로)을 보존하는 별도 경로로 남긴 것은, 과거 통합 시도가 6개 테스트를
  깨뜨렸다는 실측을 근거로 한 것이라 리스코프 치환을 억지로 강요하지 않은 합리적 판단이다.

## 요약

핵심 동시성 수정(advisory lock + 락 안 재읽기)의 구조 자체는 견고하고, `trigger-config-lock.ts`
로의 프리미티브 추출·정적 가드 확장·중복 캐스트 통합(`extractInboundSigningRef`)·중복 저장
로직 통합(`touchLastTriggeredAt`) 등 이번 PR 이 수행한 리팩터들은 대체로 응집도를 높이는
방향이다. 다만 "재읽은 컨테이너 위에 서브키 델타를 병합한다"는 재사용 가능한 개념이
`TriggersService` 의 private 메서드에 갇혀 클래스 경계를 넘지 못하고, `ChatChannelBinderService`
가 같은 문제를 별도 구현으로 다시 풀었다는 점이 이번 라운드에서 새로 확인한 응집도 공백이다.
그 외에는 모듈 이름-책임 불일치, God-service 경향 심화, 테스트 더블 배선의 수동 동기화 같은
경미한 관찰 사항뿐이며 전부 INFO 수준이다. 차단할 사안은 없다.

## 위험도

LOW
