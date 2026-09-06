# 테스트(Testing) 리뷰

## 발견사항

- **[INFO]** `SchedulesController` 의 `findAll`/`findById` 경로(둘 다 신설 `toResponse()` 를 타는 응답 경계)는 컨트롤러 **unit** 레벨에서 mock 으로 직접 검증되지 않는다 — `schedules.controller.spec.ts` 는 `create`/`update`/`remove` 세 개만 서비스 mock 을 세우고 `res.trigger` 형태를 단언한다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.spec.ts` (describe `'SchedulesController — 행위자(userId) 배선'`, `it('create ...')`/`it('update ...')` 두 건뿐)
  - 상세: `SchedulesController.findAll`(`page.data.map((s) => this.toResponse(s))`)과 `findById`(`this.toResponse(await ...findById(...))`)도 같은 `toResponse` 경계를 지나 `trigger` 를 참조 필드로 좁힌다. 이 경로들 자체는 `codebase/backend/test/schedule-trigger.e2e-spec.ts` 의 `GET /api/schedules?limit=50`·`GET /api/schedules/:id` 단언(`Object.keys(...).sort()` + `assertMatchesContract`)으로 실동작 커버리지는 있다. 다만 그 커버리지가 unit 이 아니라 e2e 뿐이라, 예를 들어 `findAll`/`findById` 에서 `.map(toResponse)`/`toResponse(...)` 호출을 실수로 빠뜨리는 회귀는 (인프라가 필요한) e2e 스위트가 돌아야만 잡힌다 — `create`/`update` 두 자매를 unit 으로 문 것과 대칭이 아니다.
  - 제안: 급하지 않음. 다음에 `SchedulesController` 를 손댈 일이 생기면 `findAll`/`findById` 도 같은 mock 패턴(`scheduleWithSecretTrigger()`)으로 unit 커버리지를 대칭으로 맞추는 것을 고려.

- **[INFO]** `TriggersService.sanitizeForResponse` 의 `cfg` (트리거 `config`) 가 `null`/`undefined` 인 방어 분기(`if (cfg) { ... }`)를 실제로 발동시키는 unit 케이스가 없다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (`sanitizeForResponse` 내부 `if (cfg) { ... }` 블록)
  - 상세: `Trigger.config` 컬럼은 `@Column({ type: 'jsonb', default: {} })` 로 `nullable: true` 가 없어 DB 불변식상 `null` 이 불가능하다(`codebase/backend/src/modules/triggers/entities/trigger.entity.ts:59-60`). 그래서 이 분기는 사실상 죽은 방어 코드에 가깝고, 테스트 갭이라기보다 순수 방어적 프로그래밍이다 — 실측(엔티티 스키마)이 전제를 반증하지 않으므로 우선순위는 낮다.
  - 제안: 조치 불요. 다만 `config` 를 nullable 로 바꾸는 마이그레이션이 생기면 이 분기부터 unit 을 채울 것.

## 테스트 품질에 대한 관찰 (긍정)

이번 라운드(마지막 커밋 `30b0f60b6`)와 그 직전 라운드들을 함께 보면, 이 PR 은 이미 7 라운드의 코드 리뷰 + 4 라운드의 consistency 리뷰를 거치며 아래를 실제로 갖췄다 (직접 diff 대조로 확인):

- **뮤테이션 검증이 문서화돼 있다** — 커밋 메시지가 `saved.trigger` 보존 회귀 unit 2건에 대해 예측(생성 RED/수정 GREEN, 수정 RED/생성 GREEN)과 실측을 표로 남겼고, `schedules.service.spec.ts` 의 `update()` 테스트는 mock `save` 가 인자를 그대로 돌려주면 vacuous 하다는 것을 주석에 명시하고 `delete copy.trigger` 로 실제로 그 관계를 떨어뜨려 대입 한 줄만이 유일한 경로가 되게 만들었다.
- **양성/음성 대조군(control group) 패턴** — `optional-nullable.fixture.ts` + `swagger-dto-contract.spec.ts` 의 4개 `[대조군]` 테스트는 술어가 실제로 위반 2형태를 잡는지, 준수 형태는 안 잡는지, fixture 가 프로덕션 베이스라인을 오염시키지 않는지를 각각 독립적으로 고정한다 — 이 자리 자체가 직전 라운드의 vacuous 버그(존재하지 않는 fixture 경로 참조)를 실측으로 잡아낸 결과다.
- **부재 단언의 vacuity 이중 방어** — `chat-channel-trigger-create.e2e-spec.ts` 의 새 테스트는 "무엇이 없다" 를 단언하기 전에 토큰을 실제로 발급시키고(발급 없이는 부재가 무의미), 같은 블록의 비-비밀 필드(`tokenStrategy`)를 양성으로 함께 단언해 `interaction` 전체가 사라지는 구현으로 퇴행해도 검출되게 했다.
- **`contractForDto` 캐시 설계 근거가 직접 테스트로 고정됨** — "실패는 캐시에 남기지 않는다" 는 서술이 `contractCache.delete` 를 지워도 이전엔 GREEN 이었는데(20_45_37 W4), 이번엔 `notADto` 실패 케이스로 `secondAttempt !== firstAttempt` 를 직접 단언한다.
- **`response-contract.ts` 의 `allowMissing` 신규 옵션**이 이름 정확 매칭·중첩 경로·`allowUndeclared` 와의 독립성까지 3면으로 커버된다(`response-contract.spec.ts`).

## 요약

이번 리뷰 대상 diff 는 §5.4 응답-계약 검증자를 4개→18개 DTO 로 넓히는 스윕과, 그 과정에서 실측으로 드러난 트리거 회전 secret 유출(엔티티 컬럼 미스트립 + 스케줄 조인을 통한 2차 유출) 수정으로 구성된다. 이미 다수의 이전 리뷰 라운드가 테스트 갭(vacuous mock, 자매 함수 미검증, 캐시 실패 경로 미검증, 대조군 fixture 부재 등)을 지적했고, 이번 최종 커밋을 포함해 전부 실제 코드 변경으로 반영된 것을 diff 대조로 확인했다. `omitKeys` 헬퍼 추출은 동작을 바꾸지 않는 순수 리팩터라 기존 회귀 테스트(3축 스트립 unit)가 여전히 유효하고, `schedules.service.spec.ts` 에 새로 추가된 2건(`isActive:false` 에서도 `trigger` 가 응답에 실리는지, 생성·수정 각각)은 vacuous 방지 장치까지 갖춘 정밀한 회귀 테스트다. 남은 갭은 컨트롤러 `findAll`/`findById` 의 unit 레벨 부재(e2e 는 있음)와, DB 스키마상 도달 불가능에 가까운 `config` null 방어 분기의 미검증 정도로, 둘 다 INFO 수준이며 이 PR 을 막을 사유가 아니다.

## 위험도

LOW
