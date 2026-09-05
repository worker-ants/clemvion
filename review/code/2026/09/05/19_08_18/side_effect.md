# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `GET/POST/PATCH /api/schedules` 응답의 `trigger` 필드 형태가 (조인으로 새어 나가던) **Trigger 엔티티 전체**에서 4개 참조 필드(`id`/`name`/`workflowId`/`workflow.name`)로 좁혀지는 **인터페이스 변경**이다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts` — `private toResponse<T extends Schedule>(schedule: T)` (신설, `findAll`/`findOne`/`create`/`update` 4개 핸들러 응답 경로에 적용). 참조 DTO 는 `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts` 의 `ScheduleTriggerRefDto`/`ScheduleTriggerWorkflowRefDto`.
  - 상세: 이 변경 자체는 보안 결함(회전 secret 유출)을 막기 위한 필수 조치이고, CHANGELOG·plan 양쪽에 영향 범위(FE 소비처 4곳)를 실측 기재해 뒀다. 다만 순수하게 "시그니처/인터페이스 변경이 기존 호출자에 미치는 영향" 관점에서 보면, 이 저장소는 API 버전 negotiation 체계가 없고 이 엔드포인트를 이미 배포된 상태로 서빙해 왔으므로, **내부 FE 가 아닌 외부/서드파티 소비자**가 `trigger.type`/`trigger.config`/`trigger.endpointPath` 등 이번에 사라지는 필드를 참조하고 있었다면 이 PR 로 조용히 깨진다. (동일 지적이 `review/code/2026/09/05/18_23_02/api_contract.md` 에 이미 WARNING 으로 등재되어 있음 — 부작용 관점에서도 동일 근거로 재확인.)
  - 제안: 추가 조치 불요(이미 처분됨) — 다만 향후 이 엔드포인트에 알려진 외부 소비자가 생기면 이번과 같은 무공지 필드 축소가 재발하지 않도록 변경 공지 절차를 고려할 것.

- **[INFO]** 테스트 전용 유틸에 새 **모듈 레벨 전역 가변 상태**(`Map` 캐시)가 도입됐다.
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts` — `const contractCache = new Map<Type<unknown>, Promise<DtoContract>>();` (신설), 이를 참조하는 `contractForDto`/`buildContractForDto`.
  - 상세: DTO 클래스 참조를 키로 하는 module-level `Map` 이라 명백한 전역 변수 신설이지만, (1) `src/shared/testing/` 는 `tsconfig.build.json` 에서 production 빌드 제외 대상이라 런타임 프로덕션 코드에는 영향이 없고, (2) 실패한 promise 는 `.catch` 에서 즉시 `contractCache.delete(Dto)` 후 rethrow 하여 "한 번 실패하면 캐시가 영구히 실패를 반환" 하는 상태 오염을 방지했다. 다만 캐시 무효화(clear) API 가 없어 같은 Jest 워커/모듈 레지스트리 내에서 계속 누적되는 구조이며, 이 시점 이후 같은 DTO 클래스에 대해 결정적이지 않은 계약(예: 동적으로 데코레이터를 바꾸는 테스트가 미래에 추가된다면)을 가정하는 새 테스트가 오면 stale 계약을 돌려받을 수 있다.
  - 제안: 조치 불요(설계 근거 문서화·범위 격리 확인됨) — 참고 기록.

- **[INFO]** `sanitizeForResponse` (구 `sanitizeChatChannelForResponse`) 가 반환하는 객체의 **참조 동일성(reference identity)** 이 바뀌었다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:570` (`private sanitizeForResponse<T extends Trigger>(trigger: T): T`).
  - 상세: 종전 구현은 `config.chatChannel` 이 없으면 `return trigger;` 로 **인자로 받은 엔티티 객체 참조를 그대로** 반환하는 조기 return 경로가 있었다. 이번 수정은 그 조기 return 을 제거하면서, `cfg` 유무·`chatChannel`/`notification.signing` 유무와 무관하게 **항상** `Object.assign(Object.create(prototype), trigger, overrides)` 로 새 객체를 만들어 반환한다. 즉 "정화할 것이 없는" 트리거(예: `config` 가 비어 있는 webhook 트리거)도 이제는 원본과 다른 객체 참조를 받는다. 현재 호출부(컨트롤러 반환·JSON 직렬화)는 참조 동일성에 의존하지 않으므로 관측 가능한 부작용은 없지만, 보안 경계 함수의 반환 계약이 "원본 그대로 통과시킬 수도, 클론을 줄 수도 있다" 에서 "항상 클론" 으로 바뀐 점은 다음에 이 함수를 참조 동등성 전제로 재사용하려는 코드에는 함정이 될 수 있다.
  - 제안: 조치 불요 — 다만 이 함수의 JSDoc 에 "항상 새 객체를 반환한다(입력을 변경하지 않는다)" 는 계약을 한 줄 명시해 두면 다음 재작성 때 실수를 줄일 수 있다.

- **[INFO]** `config.chatChannel`/`config.notification` 정화가 **얕은 복사**라, strip 대상이 아닌 중첩 값(객체/배열)은 원본과 참조를 공유한 채로 응답 객체에 실린다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:588-616` (`sanitizedChatChannel[key] = value;` 및 `nextConfig.notification = { ...(cfg.notification as Record<string, unknown>), signing: sanitizedSigning }`).
  - 상세: 이번 PR 이 `config.notification.signing` 스트립을 새로 추가하면서 동일한 얕은 복사 패턴을 두 번째 지점에 반복했다. 현재 관측 가능한 다운스트림 코드(컨트롤러가 그대로 직렬화)는 이 응답 객체를 변형하지 않으므로 지금 당장 결함은 아니다. 다만 향후 누군가 응답 객체를 받은 뒤 `chatChannel`/`notification` 내부의 배열·객체 필드를 in-place 로 mutate 하는 코드를 추가하면, 그 mutate 가 `trigger.config`(DB 에서 방금 읽은 엔티티의 config, 다른 요청/캐시가 참조 중일 수 있음)까지 오염시킬 수 있다 — 기존 패턴을 그대로 반복 확장한 것이라 이번 PR 이 새로 만든 위험은 아니지만, 두 번째 발생이라는 점에서 기록해 둔다.
  - 제안: 조치 불요(기존 패턴 답습, 이번 PR 범위 밖) — 세 번째 재발 시 `structuredClone` 등으로 전환 검토.

- **[정보/양호]** `sanitizeForResponse`/`SchedulesController.toResponse` 모두 **입력 엔티티를 in-place mutate 하지 않고 새 객체를 반환**하는 원칙을 지킨다 — `Object.assign(Object.create(...), trigger, overrides)` 와 구조분해(`const { trigger: _drop, ...rest } = schedule`) 둘 다 새 plain object/clone 을 만들 뿐, `trigger`/`schedule` 엔티티 자체나 `trigger.config` 객체를 직접 변경하지 않는다. 응답 정화 로직이 DB 저장 경로에 영향을 주지 않는다는 기존 계약이 이번 확장에서도 유지됨을 확인했다.

- **[정보/양호]** 프로덕션 코드 경로에서 새로운 환경 변수 읽기/쓰기, 파일시스템 쓰기, 외부 네트워크 호출, 이벤트/콜백 배선 변경은 발견되지 않았다. `swagger-dto-contract-guard.ts` 의 신규 `findOptionalNullableResponseFields`/`isResponseDtoFile` 는 `fs.readFileSync` 로 소스만 읽는 정적 분석(repo-guard, 빌드 산출물 없음)이라 파일시스템 부작용이 없다.

## 요약

이번 변경의 핵심 두 수정(`TriggersService.sanitizeForResponse` 확장, `SchedulesController.toResponse` 신설)은 둘 다 입력 엔티티를 mutate 하지 않고 새 객체를 반환하는 안전한 패턴을 따르며, 프로덕션 코드에 새 전역 상태·환경 변수·파일시스템·네트워크 부작용을 들이지 않았다. 유일하게 실질적인 "부작용" 성격의 발견은 `GET/POST/PATCH /api/schedules` 의 `trigger` 응답 필드가 참조 4필드로 좁혀지는 **인터페이스 변경**인데, 이는 보안 유출을 막기 위한 의도된·문서화된 breaking change이고 이미 다른 리뷰어(`api_contract.md`)가 같은 근거로 지적·기록했다. 그 외에는 테스트 전용 유틸(`response-contract.ts`)에 도입된 module-level 캐시(`contractCache`, 프로덕션 빌드 제외 확인됨)와, 응답 정화 함수의 반환 참조 동일성이 "항상 클론"으로 바뀐 점, 얕은 복사가 두 번째 지점으로 확장된 점 등 낮은 위험의 INFO 항목뿐이다.

## 위험도

LOW
