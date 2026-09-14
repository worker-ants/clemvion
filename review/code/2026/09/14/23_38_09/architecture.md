# 아키텍처(Architecture) Review — trigger-config lost-update (10라운드 시점)

## 검토 범위와 방법

이 PR 은 이미 `review/code/2026/09/14/{18_17_44..23_01_18}` 9라운드를 거쳤고,
`plan/in-progress/trigger-config-lost-update.md` §D 가 라운드별 처분·유예 근거·뮤턴트 실측을
전부 기록해 뒀다. 이번 라운드는 (a) 9라운드 이후 실제로 코드가 바뀐 자리가 있는지, (b) 이전
9라운드가 이미 찾은 항목이 실제로 안정 상태인지, (c) 이번 diff 에 새로 등장한 파일
(`schedules.service.ts`/`.spec.ts`, `chat-channel-input-rules.ts`/`.spec.ts`,
`endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`, `hooks.service.ts`/`.spec.ts`)에 아직
지적되지 않은 아키텍처 관점의 관찰이 남아 있는지에 집중했다. `trigger-config-lock.ts` ·
`chat-channel-binder.service.ts` · `triggers.service.ts` · `trigger-transaction-mock.ts` ·
`schedules.service.ts` 를 현재 소스 그대로 직접 Read 해 확인했다(diff 가 프롬프트 크기
제한으로 다수 생략돼 있어 grep + Read 로 보완). `review/code/**`·`review/consistency/**`
아래의 이전 라운드 산출물은 코드가 아니라 리뷰 이력이므로 판단 대상에서 제외했다.

## 발견사항

- **[INFO]** `Trigger` 애그리게잇에 대한 "락 도메인 참여 여부" 판단이 이제 모듈 경계를
  넘어서까지 각자 판단으로 흩어져 있다 — `SchedulesService` 도 자신만의 `Repository<Trigger>`
  를 들고 독립적으로 그 판단을 내린다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:33-34`
    (`@InjectRepository(Trigger) private readonly triggerRepository: Repository<Trigger>`),
    `:216-247`(`update()` 의 `name`/`isActive` 컬럼 한정 갱신, 특히 `:241`
    `const patch: Partial<Pick<Trigger, 'name' | 'isActive'>> = {}`)
  - 상세: 9라운드 리뷰(`review/code/2026/09/14/23_01_18` architecture INFO)가 이미 "`Trigger`
    행에 대한 단일 쓰기 관문이 없다 — 어떤 필드를 고치느냐에 따라 호출부가 각자 락 참여
    여부를 판단한다"는 구조적 특성을 지적했는데, 그 지적은 `TriggersService` **내부**의
    여러 메서드(`rotateNotificationSecret` 등)를 근거로 든 것이었다. 이번에 직접 읽어 보니
    같은 판단이 **모듈 경계를 넘어서도** 반복된다 — `SchedulesService` 는 `TriggersService`
    를 거치지 않고 자기 자신의 `Repository<Trigger>` 로 `Trigger` 행의 `name`/`isActive`
    컬럼을 직접 쓴다. 이 PR 은 그 쓰기 동사만 `save(trigger)`(엔티티 통째 저장 →
    `chatChannel.inboundSigningRef` fail-open 재발 가능)에서 컬럼 한정 `update()` 로
    바꿨을 뿐, "두 모듈이 같은 애그리게잇을 각자의 판단으로 직접 쓴다"는 결합 자체는
    이 PR 이전부터 있던 구조이고 이번 수정도 그 구조를 유지한다. 지금은 안전하다 —
    `name`/`isActive` 는 `config` 도, 이 PR 이 지키려는 보안 성격의 서브키
    (`inboundSigningRef`)도 건드리지 않는다. 다만 "이 컬럼은 락 도메인 밖에서 써도 되는가"
    라는 판단 기준이 코드 어디에도 강제되지 않고, `schedules.service.ts:234-240` 의 산문
    주석(그리고 그 주석이 인용하는 `21_50_09` 리뷰 라운드 번호)에만 존재한다. 이 판단
    기준을 모르는 다음 사람이 `SchedulesService` 에 `Trigger.config` 를 건드리는 세 번째
    필드를 추가하면, `TriggersService` 쪽의 락 도메인과 무관하게 같은 결함 클래스가
    **다른 모듈에서** 재발할 수 있다.
  - 제안: 지금 배치를 막을 사유는 아니다(실제 침해된 필드가 없고, 9라운드가 이미 같은
    근거로 후속을 제안해 뒀다). 장기적으로는 "`Trigger` 의 `config` 서브키를 쓰려면
    반드시 `trigger-config-lock.ts` 를 거친다"는 규칙을, `TriggersService` 를 그
    애그리게잇의 유일한 쓰기 관문으로 만들어(`SchedulesService` 가 `Repository<Trigger>`
    를 직접 주입받지 않고 `TriggersService` 의 메서드를 호출하도록) 컴파일 타임에 가깝게
    끌어올리는 것을 후속 후보로 plan §후속 표에 추가할 만하다.

- **[INFO]** (긍정적 관찰) `schedules.service.ts:241` 의 `Partial<Pick<Trigger, 'name' |
  'isActive'>>` 타입 주석은, 9라운드 리뷰가 제안한 "컬럼을 타입 수준에서 락 도메인
  안/밖으로 드러내면 컴파일러가 판단을 상기시킬 수 있다"는 방향을 이 한 호출부에서
  이미 부분적으로 구현하고 있다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:241-246`
  - 상세: `patch` 변수를 `Partial<Pick<Trigger, 'name' | 'isActive'>>` 로 명시적으로 좁혀
    둔 덕분에, 이 자리에 실수로 `config` 나 다른 컬럼을 대입하려 하면 타입 오류가 난다.
    산문 규율("컬럼만 쓴다")이 아니라 타입이 그 규율의 일부를 강제한다는 점에서, 위
    INFO 가 지적하는 "코드로 강제되지 않는 판단 기준" 문제를 이 지점만큼은 이미 완화하고
    있다. 다만 이 타입은 이 호출부에만 지역적으로 적용돼 있어, `TriggersService` 쪽의
    비슷한 컬럼 한정 갱신(`rotateNotificationSecret`, `cleanupRotatedChatChannelTokens`
    등)에는 대응하는 명시적 타입이 없다 — 강제가 아니라 사례다.
  - 제안: 조치 불요. 위 항목의 "유일한 쓰기 관문" 후속을 설계할 때, 이 타입 패턴
    (`Partial<Pick<Trigger, ColumnUnion>>`)을 컬럼 한정 갱신 헬퍼의 공용 시그니처로
    승격하는 것을 함께 검토할 만하다.

- **[INFO]** (재확인, 변화 없음) `rewriteTriggerConfigLocked`/`acquireTriggerConfigLock` 이
  여전히 `Trigger` 엔티티에 하드코딩돼 있다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:136-141`(함수
    시그니처), `:151`(`m.findOne(Trigger, ...)`), `:170`(`m.update(Trigger, ...)`)
  - 상세: 1라운드부터 9라운드까지 반복 지적된 사항이 이번 라운드에도 그대로 유지된다.
    `plan/in-progress/trigger-config-lost-update.md` §후속(`"헬퍼가 Trigger 에
    하드코딩"`)에 이미 등재돼 있고 이번 PR 범위를 넓히지 말라는 판단도 명시돼 있다 —
    새 지적이 아니라 재확인.
  - 제안: 조치 불요(추적됨).

- **[INFO]** (재확인, 변화 없음) `TriggersService.update()` 의 "읽기-병합-쓰기"가 여전히
  `rewriteTriggerConfigLocked`(창 2·3·4)와 인라인 구현(창 1, `save`)으로 갈려 있다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:606-671`(창 1,
    `manager.transaction` 안에서 `m.save(Trigger, target)`) vs
    `codebase/backend/src/modules/triggers/trigger-config-lock.ts:136-173`
    (`rewriteTriggerConfigLocked`, `m.update(Trigger, ...)`)
  - 상세: `save()` 의 계약(반환 엔티티·subscriber·`endpointPath` UNIQUE 충돌 경로, 6개
    unit 케이스 RED 로 실측된 근거)을 보존해야 해서 공용 헬퍼를 그대로 못 쓴다는 사실이
    `trigger-config-lock.ts:83-86` 자신의 JSDoc 에 "세 라운드 연속 지적된 혼동"으로
    명시돼 있다. 이미 문서화된 트레이드오프이지 숨은 결함이 아니다.
  - 제안: 조치 불요(문서화된 트레이드오프, 다섯 번째 자리가 생길 때 판단 기준으로 재사용).

## 이번 라운드에 새로 확인한 파일에 대한 결론 (문제 없음)

- `chat-channel-input-rules.ts:239-250`(`extractInboundSigningRef`)와 그 테스트
  (`chat-channel-input-rules.spec.ts`, `it.each` 7 케이스)는 순수 함수·DI 없음·부재
  값(`undefined`/`null`/빈 config) 처리까지 좁게 커버돼 있어, "협력자 0개는 순수 함수"
  라는 이 모듈의 기존 원칙과 일치한다. 새로운 지적 없음.
- `endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`/`endpoint-path-save.fixture.ts` 는
  8·9라운드가 이미 지적한 "식별자 텍스트 매칭이라 타입 체커를 안 쓴다"는 한계를 그대로
  유지한 채(`TRIGGER_ENTITY = 'Trigger'`, `first.getText(sf) === TRIGGER_ENTITY`), 그
  한계 안에서 fixture 세 종(`managerSaveWrapped`/`Unwrapped`/`OtherEntity`)으로 회귀를
  정확히 고정했다. 새로운 지적 없음(9라운드 재확인 유지).
- `hooks.service.ts` 의 `touchLastTriggeredAt`(:957-979, 두 호출부 :227·:686)과
  `schedules.service.ts` 의 컬럼 한정 `update()` 는 둘 다 이 PR 이 확립한 "설정 서브키를
  안 건드리는 쓰기는 락을 끌어오지 않고 컬럼 한정 갱신으로 좁힌다"는 원칙을 그대로 따른다
  — 불필요한 트랜잭션/락 오버헤드를 들이지 않는 적절한 추상화 수준이다.

## 요약

이번 10라운드는 9라운드가 이미 LOW 로 수렴시킨 아키텍처(advisory lock + 락 안 재읽기-병합,
외부 호출을 임계 구간 밖에 두는 설계, 순환 의존 부재, DRY 추출)를 그대로 유지한 채, 마지막
일곱 자리 전환(§D 7~9라운드)이 끝난 최종 상태를 최종 확인하는 라운드다. 코드를 직접 읽어
재확인한 결과 이전 라운드들의 architecture 지적은 전부 여전히 유효한 상태로 문서화·추적되고
있고 새로 회귀한 것은 없다. 이번 라운드에서 유일하게 새로 추가할 만한 관찰은, 9라운드가
`TriggersService` 내부에 한정해 지적한 "`Trigger` 애그리게잇의 단일 쓰기 관문 부재"가
실제로는 `SchedulesService` 라는 **다른 모듈**까지 걸쳐 있다는 점이다 — 지금은 그 모듈이
건드리는 컬럼(`name`/`isActive`)이 이 PR 의 보안 성격 서브키와 무관해 안전하지만, 그 경계가
타입이 아니라 산문 주석으로만 강제된다. `schedules.service.ts` 의 `Partial<Pick<Trigger,
'name' | 'isActive'>>` 타입 좁히기는 그 경계를 부분적으로나마 컴파일 타임에 드러내는 좋은
사례다. 두 관찰 모두 INFO 수준이며 이 PR 을 막을 사유가 아니다. 새로운 SOLID 위반, 순환
의존, 레이어 경계 붕괴, 안티패턴은 발견되지 않았다.

## 위험도

LOW
