# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `response-contract.ts` 에 모듈 레벨 가변 전역 상태(`Map`)가 있다 — 신규 전역 변수 도입.
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:386` (`const contractCache = new Map<Type<unknown>, Promise<DtoContract>>();`), 읽고 쓰는 자리는 `:412-425`(`contractForDto`).
  - 상세: `contractForDto` 가 DTO 클래스별로 "진행 중이거나 완료된 promise" 를 캐시한다. `codebase/backend/src` 안에서 이 파일을 import 하는 비-테스트(non-`.spec.ts`, non-`test/`) 파일은 없음을 확인했다 — 프로덕션 런타임 경로에는 노출되지 않는다. 실패한 promise 는 `.catch` 에서 캐시를 지우고 다시 던지므로(`:420`) 원인이 해소된 뒤 캐시가 계속 실패를 재생하는 문제는 없다. 격리 단위(테스트 파일마다 Jest 모듈 레지스트리가 새로 생성됨)에 대한 근거도 JSDoc 에 실측으로 적혀 있다. 새 전역 변수 도입이라는 사실 자체는 부작용 점검 관점에서 기록해 둘 만하지만, 설계·근거가 문서화돼 있고 조치가 필요한 결함은 아니다.
  - 제안: 조치 불요.

- **[INFO]** `TriggersService.sanitizeForResponse`(`codebase/backend/src/modules/triggers/triggers.service.ts:627`)가 조기 return 을 없애면서 **항상 새 객체**를 반환하도록 바뀌었다 — 정화할 것이 없는 트리거도 이제 원본과 다른 참조를 받는다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:627` 선언, 호출부는 `findAll`·`findOneDetail`(2회)·`create`·`update` 총 5곳.
  - 상세: JSDoc 이 "호출부는 참조 동일성을 전제하지 말 것" 이라고 명시한다. 5개 호출부 모두 반환값을 컨트롤러로 즉시 반환하는 terminal call이고, 반환 후 그 객체에 `===` 동일성을 요구하는 후속 로직은 없다 — 실질적 부작용은 없다. `sanitizeForResponse` 자체는 `Object.assign(Object.create(proto), trigger, overrides)` 로 새 객체를 만들고 비밀 컬럼은 그 **새 객체에서만** `delete` 하므로(`:627` 함수 말미), 원본 엔티티(`trigger`)와 그 `config` 는 변형되지 않는다 — TypeORM 이 추적하는 엔티티 상태에 영향 없음을 확인했다.
  - 제안: 조치 불요.

- **[INFO]** `TriggersService.update()` 가 PATCH 응답 조립 방식을 바꿔, 종전에 있던 미고지 부작용(생략 필드가 응답에서 조용히 사라지는 것)을 없앴다 — 동작 변경이라 기록해 둔다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:413-416` (`const defined = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)); Object.assign(trigger, defined, { config: mergedConfig });`).
  - 상세: `target: ES2023`(`useDefineForClassFields`)에서 DTO 의 optional 필드는 값이 없어도 `undefined` 인 own property 로 존재한다. 종전엔 `Object.assign(trigger, rest, {...})` 가 이 `undefined` 값으로 로드된 엔티티 필드를 덮어써, DB 에는 영향 없지만(TypeORM 이 undefined 를 skip) **응답에서만** 필드가 사라지는 부작용이 있었다. 이번 수정은 `v !== undefined` 필터로 그 부작용을 제거한다. `null !== undefined` 이므로 명시적 `null` 을 통한 필드 초기화 의미는 그대로 보존된다 — PATCH 의 "키 생략(불변) vs `null`(초기화) vs 값(설정)" tri-state 계약과 일치한다. unit(`triggers.service.spec.ts` "PATCH 에서 생략된 필드는 로드된 값을 유지한다")과 e2e 가 이 경로를 고정하고 있음을 확인했다.
  - 제안: 조치 불요 — 의도된 수정이고 회귀 테스트로 고정됨.

- **[INFO]** `SchedulesController` 4개 엔드포인트(목록·단건 조회·생성·수정)의 공개 응답에서 `trigger` 필드 형태가 전체 `Trigger` 엔티티에서 참조 필드(`id`·`name`·`workflowId`·선택적 `workflow`)로 좁혀졌다 — 공개 인터페이스 축소.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:67`(`private toResponse<T extends Schedule>(schedule: T)`)와 그 호출부 4곳(`findAll`·`findById`·`create`·`update`).
  - 상세: 이 축소는 `notificationSecretV2`(평문 서명 secret)·`chatChannelTokenV2`(secret store ref)가 스케줄→트리거 조인을 타고 유출되던 보안 결함을 막는 의도된 수정이며, `CHANGELOG.md` 에 원인·영향·외부 소비자 실측(프런트엔드 `RawSchedule` 1곳뿐, `@workflow/sdk` 는 schedule API 미사용)까지 명시돼 있다 — 숨겨진 부작용이 아니다. `toResponse` 는 `const { trigger: _drop, ...rest } = schedule;` 로 새 plain object 를 만들 뿐 `schedule` 엔티티 자체를 변형하지 않음을 확인했다.
  - 제안: 조치 불요.

- **[INFO]** `schedules.service.ts` 의 `saved.trigger = savedTrigger` / `saved.trigger = trigger ?? schedule.trigger` 대입이 `if (isActive)` 조건 밖으로 이동했다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:203`(`create()`)·`:263`(`update()`).
  - 상세: 두 대입 모두 `scheduleRepository.save(...)` 가 **이미 끝난 뒤**의 in-memory 객체(`saved`)에 대한 대입이라 추가 DB write 를 유발하지 않는다. `registerJob`/`removeJob` 호출 조건(`if (isActive)` / `if (schedule.isActive)`)은 그대로이므로 BullMQ 잡 등록·해제의 타이밍·횟수에는 변화가 없다 — 응답 객체의 `trigger` 키 존재 여부만 `isActive` 와 무관해진다(§5.4 준수를 위한 의도된 수정).
  - 제안: 조치 불요.

- **[INFO]** `TriggersService` 의 `omitKeys` 헬퍼 추출(`:126`)과 `swagger-dto-contract-guard.ts`/`schedules.controller.ts`/`schedule-response.dto.ts` 의 최신 커밋(`30b0f60b6`) 변경은 전부 순수 리팩터·주석 정정·신규 테스트이며, 세 대상 파일을 원본 대비 대조한 결과 실행 경로 동작에 차이가 없다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:126-141`(`omitKeys`) 및 3개 호출부; `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`(JSDoc 추가만); `codebase/backend/src/modules/schedules/schedules.controller.ts:74`·`schedules/dto/responses/schedule-response.dto.ts`(주석 정정만).
  - 상세: `omitKeys` 는 기존 3개 인라인 for-loop 와 문자 그대로 동일한 filter-copy 로직을 함수로 뽑은 것으로, 입출력 동작 변화 없음. 나머지는 JSDoc/주석 텍스트 변경뿐이다.
  - 제안: 조치 불요.

## 요약

이번 diff(브랜치 전체, `origin/main` 대비)는 트리거 회전 secret(`notificationSecretV2`·`chatChannelTokenV2`, `config.interaction.triggerToken`, `config.notification.signing.{secret,secretRef}`)이 트리거 자신의 응답과 스케줄 조인을 통한 2차 경로로 유출되던 것을 응답 경계(`TriggersService.sanitizeForResponse`, `SchedulesController.toResponse`)에서 막는 보안 수정과, §5.4 응답-계약 검증자를 18개 DTO·14개 e2e·정적 래칫으로 넓히는 스윕이 결합된 변경이다. 이 세션은 7라운드 앞선 코드 리뷰(가장 최근 `23_30_00`)가 이미 같은 축을 각각 확인했고, 그 이후 최신 커밋(`30b0f60b6`)은 순수 리팩터(`omitKeys` 추출)·주석 정정(`schedules.controller.ts:74`)·신규 unit 2건뿐이라 새 부작용을 만들지 않았음을 diff 대조로 확인했다. 실질적으로 기록해 둘 만한 항목은 (1) 테스트 전용 `response-contract.ts` 의 신규 모듈 레벨 캐시(`Map`, 프로덕션 미노출 확인), (2) `sanitizeForResponse` 의 참조 동일성 변화(호출부 무영향 확인), (3) `TriggersService.update()` 의 `undefined` 필터링(생략 필드가 응답에서 사라지던 기존 부작용을 제거하는 의도된 수정), (4) `SchedulesController` 4개 엔드포인트의 `trigger` 응답 형태 축소(CHANGELOG 로 고지·외부 소비자 실측 완료된 공개 인터페이스 변경), (5) `schedules.service.ts` 대입 위치 이동(추가 DB write 없음 확인) 정도이며 전부 이미 설계·테스트로 뒷받침돼 있다. 전역 변수·환경 변수·네트워크 호출·이벤트/콜백 순서에서 새로운 미고지 부작용은 발견되지 않았다. 저장소 트리에 대한 뮤테이션은 이번 리뷰에서 수행하지 않았다(`git status --short` 로 확인, 세션 산출물 디렉터리 외 변경 없음).

## 위험도

LOW
