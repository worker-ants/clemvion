# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `contractForDto` 캐싱 도입으로 **module-level 전역 가변 상태**(`Map`)가 새로 생겼다.
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:386` (`const contractCache = new Map<Type<unknown>, Promise<DtoContract>>();`), 사용처 `:410-423` (`export function contractForDto`).
  - 상세: `contractForDto`가 `async function`에서 평범한 `function`으로 바뀌고, DTO 클래스를 키로 하는 module-scope `Map`에 진행 중/완료된 계약 `Promise`를 캐싱한다. 이는 "부작용 관점 2. 전역 변수" 항목에 정확히 해당하는 **신규 전역 변수 도입**이다. 다만 (1) 이 파일은 `tsconfig.build.json`의 `exclude: ["src/shared/testing/**"]`로 프로덕션 번들에서 명시적으로 제외되어 있음을 실측 확인했고(런타임 영향 없음), (2) 실패한 promise는 `.catch()`에서 `contractCache.delete(Dto)`로 축출되어 캐시에 남지 않으며, (3) 이 PR 자신이 메모이제이션·실패 축출 두 동작을 회귀 테스트로 고정했다(`response-contract.spec.ts:484-521`, `describe('contractForDto 메모이제이션')`). Jest worker별로 모듈 레지스트리가 분리되므로 워커 간 캐시 오염도 없다. 즉 의도된 설계이고 테스트로 방어되어 있으나, "새 전역 변수 도입" 자체는 체크리스트 항목이라 기록한다.
  - 제안: 조치 불요. 프로덕션 제외·회귀 테스트가 이미 있다는 사실만 인지하면 된다.

- **[INFO]** `TriggersService.sanitizeForResponse()`가 "항상 새 객체를 반환"하도록 계약이 바뀌었다 — 종전에는 조기 return 경로에서 **원본 엔티티 참조**를 그대로 돌려주는 경우가 있었다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:576-638` (`private sanitizeForResponse<T extends Trigger>(trigger: T): T`), 관련 JSDoc은 그 바로 위(호출부는 `:194`, `:203`, `:226`, `:231-232`, `:322`, `:407`).
  - 상세: 종전 `sanitizeChatChannelForResponse`는 `if (!cfg?.chatChannel) return trigger;`로 조기 return 해 **원본 엔티티를 그대로** 반환했다. 이번 diff는 그 조기 return을 없애고 항상 `Object.assign(Object.create(proto), trigger, overrides)`로 새 객체를 만들어 반환한다 — 참조 동일성이 깨진다는 사실을 JSDoc에도 명시했다("호출부는 참조 동일성을 전제하지 말 것"). `grep`으로 전수 확인한 결과 현재 호출부 6곳(`findAll`/`findOneDetail`/`create`/`update`)은 모두 응답 경계의 최종 `return` 문에서만 이 값을 쓰고 있어 참조 동일성에 의존하는 코드는 없다 — 지금 당장 회귀는 없지만, 이 메서드는 `private`이 아니게 되거나 다른 호출부가 붙으면 그 가정이 깨질 수 있는 계약 변경이라는 점만 기록한다.
  - 제안: 조치 불요(현재 안전). 향후 이 메서드에 새 호출부를 추가할 때 참조 동일성을 가정하지 않는지 확인할 것.

- **[INFO]** `SchedulesService.create()`/`update()`에서 `saved.trigger` 대입이 `if (isActive)` 조건 밖으로 이동해 **항상 in-memory 엔티티를 뮤테이트**하도록 바뀌었다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:203` (`create()`, `saved.trigger = savedTrigger;`) 및 `:263` (`update()`, `saved.trigger = trigger ?? schedule.trigger;`).
  - 상세: `saved`는 두 메서드 모두 이 대입 이전에 이미 `await this.scheduleRepository.save(schedule)`로 저장이 끝난 엔티티이고(각 메서드 내 `const saved = await this.scheduleRepository.save(schedule);` 확인), 이 대입 뒤로 추가 `.save()` 호출이 없다 — 즉 이 뮤테이션은 DB에 반영되지 않고 컨트롤러가 응답 셰이핑에 쓰는 in-memory 객체에만 영향을 준다. `update()`의 경우 바로 다음 `if (schedule.isActive)` 분기(`registerJob`/`removeJob`)가 `.trigger`를 읽지 않으므로 대입 위치 변경이 그 분기의 동작에 영향을 주지 않는다. 의도된 대로 응답 형태만 바뀌는 안전한 변경으로 확인했다.
  - 제안: 조치 불요.

- **[INFO]** `GET/POST/PATCH /api/schedules[/:id]`의 `trigger` 필드가 조인된 `Trigger` 엔티티 전체(모든 컬럼)에서 4필드짜리 참조 DTO로 좁혀져, **공개 API 응답 형태가 축소**됐다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:67-83` (`private toResponse<T extends Schedule>`), `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts:91` (`trigger?: ScheduleTriggerRefDto;`).
  - 상세: 보안 유출(회전 secret 컬럼이 조인을 타고 새어 나가던 결함)을 막는 것이 이 변경의 목적이며, CHANGELOG(`CHANGELOG.md:24-26`)와 프런트엔드 소비처 4곳(`name`·`id`·`workflowId`·`workflow.name`) 실측으로 정당화되어 있다. 다만 "인터페이스 변경" 관점에서는 이 응답을 참조하는 문서화되지 않은 외부 소비자가 있었다면 `trigger.type`/`trigger.config`/`trigger.isActive` 등 이전에 노출되던 필드가 조용히 사라지는 breaking change다. 이미 세 차례의 코드 리뷰·consistency 라운드(`review/code/2026/09/05/18_23_02`, `19_08_18`, `20_45_37`)에서 동일 항목이 검토·수용됐으므로 신규 지적은 아니고, 부작용 관점에서 재확인한 결과만 기록한다.
  - 제안: 조치 불요(이미 검토·수용됨).

- **[INFO]** `sanitizeForResponse` 안에서 `config`가 `chatChannel`도 `notification.signing`도 건드리지 않는 트리거(`configTouched === false`)의 경우, 반환된 객체의 `config` 프로�터티는 원본 엔티티의 `config`와 **같은 객체 참조**를 공유한다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:590` (`let configTouched = false;`) ~ `:624` (`if (configTouched) overrides.config = nextConfig;`).
  - 상세: `Object.assign(target, trigger, overrides)`에서 `overrides`에 `config` 키가 없으면 `trigger.config`(객체 참조)가 그대로 얕은 복사된다. 이 메서드 자신은 그 객체를 변형하지 않으므로 JSDoc의 "엔티티를 변경하지 않는다" 주장 자체는 참이지만, 만약 이후 어떤 코드가 응답 객체의 `.config`를 제자리에서 mutate 한다면 원본 in-memory 엔티티까지 오염될 수 있는 잠재 경로다. 현재 diff 범위에서 그런 다운스트림 mutation은 발견하지 못했다(모든 호출부가 컨트롤러 응답 경계 직전에서 바로 반환).
  - 제안: 조치 불요(현재 안전, 잠재 경로만 기록). 필요하면 `configTouched` 분기에서도 `nextConfig = { ...cfg }`를 무조건 적용해 얕은 복사를 보장하는 것을 고려할 수 있으나 이번 PR 범위는 아니다.

## 요약

핵심 코드 변경(`triggers.service.ts`의 `sanitizeForResponse`, `schedules.controller.ts`의 `toResponse`, `schedules.service.ts`의 `saved.trigger` 대입 위치 이동, `response-contract.ts`의 `contractForDto` 메모이제이션)을 전수 대조한 결과, 의도치 않은 DB 쓰기·전역 상태 오염·시그니처 breaking change·네트워크 호출·이벤트/콜백 변경은 발견하지 못했다. 유일하게 체크리스트 항목에 직접 해당하는 것은 `contractForDto`의 module-level `Map` 캐시(신규 전역 변수)인데, 프로덕션 빌드에서 제외되고 자체 회귀 테스트(메모이제이션·실패 축출)가 딸려 있어 위험이 낮다. `sanitizeForResponse`의 "항상 새 객체 반환" 계약 변경과 `schedules.service.ts`의 엔티티 필드 대입 위치 이동은 둘 다 응답 경계에서만 소비되는 것으로 확인되어 현재 호출부에는 부작용이 없다. `GET/POST/PATCH /api/schedules`의 `trigger` 응답 형태 축소는 실질적인 공개 인터페이스 변경이지만, 보안 수정이 목적이고 이미 여러 리뷰 라운드에서 검토·수용된 사안이다. e2e 스펙에 추가된 `assertMatchesContract` 호출들은 이미 발생한 HTTP 응답에 대한 단언 추가일 뿐 새 네트워크 호출을 만들지 않으며, DTO 파일들의 `@ApiProperty` 필드 추가는 Swagger 문서 생성에만 영향을 주는 순수 선언 변경이다.

## 위험도

LOW
