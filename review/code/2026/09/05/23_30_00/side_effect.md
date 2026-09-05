# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `SchedulesController` 4개 엔드포인트의 공개 HTTP 응답 형태가 축소됐다 — `trigger` 필드가 전체 `Trigger` 엔티티에서 참조 4필드(`id`·`name`·`workflowId`·`workflow.name`)로 좁혀진다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts` — 신설 `private toResponse<T extends Schedule>(schedule: T)` 메서드와 그 호출부 `findAll`(목록, `GET /api/schedules`)·`findById`(`GET /api/schedules/:id`)·`create`(`POST /api/schedules`)·`update`(`PATCH /api/schedules/:id`) 네 곳.
  - 상세: 이 축소 자체는 `notificationSecretV2`(평문 서명 secret)·`chatChannelTokenV2`(secret store ref)가 조인을 타고 새어 나가던 보안 결함을 막는 의도된 수정이며, `CHANGELOG.md` 의 "Unreleased — 트리거 회전 secret 이 두 엔드포인트로 나갔다" 항목이 원인·영향·이미 나간 값에 대한 권고까지 명시적으로 문서화했다 — 숨겨진 부작용은 아니다. 다만 부작용 관점에서 짚어 둘 점: 이 스케줄 응답을 소비하는 **외부 API 클라이언트**가 `trigger.type`·`trigger.config`·`trigger.workspaceId`·타임스탬프 등 참조 4필드 밖의 값을 참조하고 있었다면 이번 배포로 그 값이 조용히 사라진다(키 자체는 남아 있으나 하위 필드가 준다). CHANGELOG 는 프런트엔드 소비처(`schedules/page.tsx` 4곳)만 근거로 들었고, 그 외 외부 소비자에 대한 언급은 없다.
  - 제안: 조치 불요(이미 CHANGELOG 로 고지되고 보안 트레이드오프가 명시됨). 다만 사내/외부에 공개된 API 문서·SDK 가 있다면 이 축소를 별도로 공지했는지 확인할 가치가 있다.

- **[INFO]** `codebase/backend/src/shared/testing/response-contract.ts` 에 모듈 레벨 가변 전역 상태(`Map`)가 새로 도입됐다.
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts` — `const contractCache = new Map<Type<unknown>, Promise<DtoContract>>();` (신설) 및 그것을 읽고 쓰는 `contractForDto`/`buildContractForDto`.
  - 상세: `contractForDto` 가 기존 `async function`(항상 새로 부트스트랩)에서 DTO 클래스별로 진행 중인 promise 를 캐시하는 형태로 바뀌었다. 이 파일은 `src/shared/testing/` 아래에 있고 `codebase/backend/src` 안에서 비-스펙(non-`.spec.ts`) 파일 중 이를 import 하는 곳이 없어(확인함) 프로덕션 런타임에는 영향이 없다 — 테스트 실행 중에만 존재하는 전역 상태다. 실패한 promise 는 캐시에서 제거하도록 처리돼 있고(`.catch` → `contractCache.delete`), 격리 단위(테스트 파일마다 Jest 모듈 레지스트리가 새로 생성됨)에 대한 근거도 JSDoc 에 실측으로 남아 있다(이전 라운드에서 "worker 단위" 라는 잘못된 주장이 실측으로 반증되어 정정됨). 새 전역 변수 도입이라는 사실 자체는 부작용 점검 관점에서 기록해 둘 만하다.
  - 제안: 조치 불요 — 설계·근거가 문서화돼 있고 프로덕션 코드 경로에 노출되지 않음을 확인함.

- **[INFO]** `TriggersService.sanitizeForResponse`(구 `sanitizeChatChannelForResponse`)가 조기 return 을 제거하면서 **항상 새 객체**를 반환하도록 바뀌었다 — 이전에는 `config.chatChannel` 이 없으면 원본 엔티티 참조를 그대로 반환했다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:608` (`private sanitizeForResponse<T extends Trigger>(trigger: T): T`) 및 호출부 5곳(`findAll`·`findOneDetail`·`create`·`update` — 라인 211/220/243/248-249/339/433).
  - 상세: 참조 동일성이 깨지는 것은 JSDoc 에 "호출부는 참조 동일성을 전제하지 말 것" 으로 명시돼 있다. 다섯 호출부 전부 이 메서드의 반환값을 컨트롤러로 즉시 반환(terminal call)하고, 반환 후 그 객체의 `===` 동일성에 의존하는 후속 로직이 없음을 확인했다 — 실질적 부작용은 없다.
  - 제안: 조치 불요.

- **[INFO]** private 메서드 rename(`sanitizeChatChannelForResponse` → `sanitizeForResponse`)이 전체 저장소에서 일관되게 적용됐다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` 전역(선언 및 5개 호출부), 관련 언급은 `schedules.controller.ts:59`(주석)·`triggers.service.spec.ts:453`(주석)·`chat-channel-trigger-create.e2e-spec.ts:165`(주석)에만 있음.
  - 상세: `private` 메서드라 클래스 외부에서 호출할 수 없으므로 시그니처/이름 변경의 외부 호출자 영향은 없다. grep 으로 옛 이름(`sanitizeChatChannelForResponse`)의 잔존 참조가 없음을 확인했다.
  - 제안: 조치 불요.

- **[INFO]** `schedules.service.ts` 의 `saved.trigger = savedTrigger`/`saved.trigger = trigger ?? schedule.trigger` 대입이 `if (isActive)` 조건 밖으로 이동했다 — DB 재저장(`scheduleRepository.save`) 은 이 대입보다 **앞서** 이미 끝나 있어 이 이동이 추가 DB write 를 유발하지 않음을 확인했다(순서만 바뀌고 영속화 대상은 동일).
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts:203`(`create()`)·`:263`(`update()`).
  - 상세: 이 대입은 응답으로 반환되는 in-memory `saved` 객체의 `trigger` 필드 존재 여부만 바꾼다 — `registerJob`/`removeJob` 호출 조건(`if (isActive)`/`if (schedule.isActive)`)은 그대로이므로 BullMQ 잡 등록/해제 타이밍이나 횟수에는 변화가 없다.
  - 제안: 조치 불요.

## 요약

이번 diff 는 트리거 회전 secret(`notificationSecretV2`·`chatChannelTokenV2`)이 트리거 자신의 4개 응답 경로와 스케줄 조인을 통한 2차 경로로 유출되던 것을 응답 경계(서비스: `sanitizeForResponse`, 컨트롤러: `SchedulesController.toResponse`)에서 막는 보안 수정과, §5.4 응답-계약 검증자를 18개 DTO·14개 e2e 로 넓히는 스윕이 결합된 변경이다. 부작용 관점에서 실질적으로 유의미한 것은 (1) `SchedulesController` 4개 엔드포인트의 응답 `trigger` 형태가 전체 엔티티에서 참조 4필드로 좁혀지는 공개 인터페이스 변경(단, CHANGELOG 에 원인·영향·권고까지 상세히 고지됨), (2) 테스트 전용 `response-contract.ts` 에 새 모듈 레벨 캐시(`Map`)가 도입된 것(프로덕션 경로 미노출 확인) 정도다. 그 외 `sanitizeForResponse` 의 참조 동일성 변화, private 메서드 rename, 스케줄 서비스의 대입 순서 이동은 모두 문서화돼 있고 실제 호출부·영속화 경로에 부작용을 미치지 않음을 코드 추적으로 확인했다. 전역 변수·환경 변수·네트워크 호출·이벤트/콜백 발생 패턴에서 새로운 미고지 부작용은 발견되지 않았다.

## 위험도

LOW
