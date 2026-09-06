# 아키텍처(Architecture) 리뷰

## 발견사항

- **[INFO]** 응답-셰이핑(비밀·조인 엔티티 축소) 책임이 두 레이어에 갈라져 있다 — `TriggersService.sanitizeForResponse`(서비스 레이어) vs `SchedulesController.toResponse`(컨트롤러 레이어).
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:594-627`(JSDoc+메서드 선언), `codebase/backend/src/modules/schedules/schedules.controller.ts:53-85`(`toResponse`)
  - 상세: 같은 종류의 판단(조인된 엔티티에서 비밀·과다 필드를 걷어내고 참조 형태로 좁히는 것)이 트리거 모듈에서는 서비스의 `private` 메서드로, 스케줄 모듈에서는 컨트롤러의 `private` 메서드로 서로 다른 레이어에 산다. 스케줄 쪽 배치는 `toResponse` JSDoc(`schedules.controller.ts:63-65`)이 "서비스 반환 타입을 좁히면 `update()` 등 내부 소비자가 깨진다" 는 근거를 명시적으로 남겨 두었고, 이 판단과 그 대가(unit 테스트 불가·e2e 전담)는 이미 `review/code/2026/09/05/21_40_37/architecture.md`(WARNING)에서 지적되고 `RESOLUTION.md`("추출은 하지 않는다 — 순수 함수 추출은 검증 수단을 바꾸지 않으면서 diff 만 넓힌다")로 의도적으로 유예됐다. 이번 라운드(최종 커밋 `30b0f60b6`)에서도 그 구조는 그대로다 — 새로 만들어진 결함은 아니고, 기존에 측정·기록된 트레이드오프가 유지되고 있을 뿐이다.
  - 제안: 조치 불요(이미 유예 결정 기록 있음). 세 번째 유사 모듈(예: 다른 컨트롤러가 조인 엔티티를 반환하는 경우)이 생기면 그때 공용 `*-response.mapper.ts` 패턴 도입을 재검토할 것.

- **[INFO]** 트리거 비밀 스트립이 여전히 4벌의 수기 deny-list(`Set`/`array`)로 구성돼 있다 — `CHAT_CHANNEL_RESPONSE_STRIP_KEYS`·`NOTIFICATION_SIGNING_STRIP_KEYS`·`INTERACTION_RESPONSE_STRIP_KEYS`·`TRIGGER_RESPONSE_STRIP_COLUMNS`.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:53-61`(chatChannel), `:74-77`(notification.signing), `:94-97`(엔티티 컬럼), `:114`(interaction)
  - 상세: 이 네 목록의 존재 이유 자체가 "같은 형태로 세 번 좁게 틀렸다" 는 이 PR 자신의 실측(`sanitizeForResponse` JSDoc `:611-625`)이다 — 새 비밀 축이 추가될 때마다 하나씩 놓쳤고, 그때마다 이번 PR 이 그 결함을 실제로 고쳤다. 최종 커밋(`30b0f60b6`)이 세 축의 중복 순회 루프를 `omitKeys()` 헬퍼(`:126-136`)로 DRY 하게 통합해 유지보수 부담은 줄였지만, "새 비밀 필드를 추가하는 사람이 목록에 넣는 것을 잊으면 기본값이 노출" 이라는 fail-open 구조 자체는 남아 있다. 이는 이미 인지되어 `plan/in-progress/spec-draft-nullable-notation-followups.md:302-320`("트리거 비밀 스트립을 deny-list 4벌에서 선언적 SoT 로")에 착수 전 측정 조건까지 포함해 등재돼 있으므로 새로 지적할 결함이 아니라 확인 기록이다.
  - 제안: 조치 불요(이미 백로그 등재·측정 조건 명시). 등재된 항목 그대로 진행.

- **[INFO]** `§5.4` 금지-조합 래칫이 두 파일에 부분집합 관계로 중복 추적된다 — `swagger-dto-contract.spec.ts` 의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT`(78건, 응답 DTO 전수)와 `execution-response.dto.spec.ts` 의 `OPTIONAL_NULLABLE_DRIFT`(10건, `ExecutionDto` 만)가 단일 SoT 없이 나란히 존재한다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts`(EXPECTED_OPTIONAL_NULLABLE_DRIFT 배열), `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.spec.ts:59-71`(교차 참조 주석)
  - 상세: 두 목록은 구조적으로 하나가 다른 하나의 부분집합이라 결함을 고칠 때 두 곳을 함께 줄이지 않으면 한쪽이 조용히 낡는다. `execution-response.dto.spec.ts:62-70`에 상호 참조("한쪽만 상환하면 다른 쪽이 조용히 낡는다")를 추가해 두었고, 이 자체가 `review/consistency/2026/09/05/19_08_19` W5 의 처분 결과다 — 목록을 구조적으로 하나로 합치는 대신 주석으로 관계를 명시하는 완화책을 택했다. 완전한 구조적 해소(예: 전자에서 `ExecutionDto` 하위 집합을 파생)는 아니지만, 의도적으로 문서화된 트레이드오프다.
  - 제안: 조치 불요(이미 완화·기록됨). 다음에 이 축을 만질 때 두 목록을 함께 파생 관계로 리팩터링하는 것을 고려.

- **[INFO, positive]** 응답-계약 검증을 담당하는 두 모듈이 서로 다른 사각지대를 명시적으로 문서화하며 겹치지 않게 분업한다.
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:11-71`(런타임 "값 vs 선언" 대조 — JSDoc 이 판정 규칙 표로 경계를 명시), `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:220-296`(정적 "선언 vs 선언" 대조 — `findOptionalNullableResponseFields`)
  - 상세: `response-contract.ts` 는 실제 HTTP 응답 값과 DTO 스키마를 대조하고(엔티티 패스스루로 인한 과다 노출·`Date`→`string` 직렬화 간극을 잡음), `swagger-dto-contract-guard.ts` 는 데코레이터 선언만 정적으로 훑어 `required:false + nullable:true` 금지 조합을 찾는다. 두 도구가 서로의 사각지대(런타임 도구는 선언 자체의 형태를, 정적 도구는 실제 값을 못 본다)를 자기 JSDoc 에 명시하고, `response-contract.ts:33-55` 는 "이 표의 넷째·다섯째 행은 §5.4 가 아니라 이 도구의 확장" 이라고 판정 경계까지 구분해 둔다. 계층별 책임이 명확히 분리된 좋은 설계다.
  - 제안: 없음(참고용 관찰).

- **[INFO, positive]** 신규 참조(Ref) DTO들이 모듈 경계를 존중해 중복을 감수하고 결합을 피했다.
  - 위치: `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts`(`ScheduleTriggerRefDto`·`ScheduleTriggerWorkflowRefDto` 신설), `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts`(`TriggerWorkflowRefDto` 신설)
  - 상세: `schedules` 모듈이 `triggers` 모듈의 `TriggerDto`/`TriggerWorkflowRefDto` 를 직접 import 하는 대신, 자신이 필요로 하는 최소 형태(`id`·`name`·`workflowId`·`workflow.name`)를 자체 DTO 로 새로 정의했다. `id`/`name` 필드 형태가 두 모듈에 살짝 중복되지만, 그 대가로 모듈 간 DTO 결합(다른 모듈의 응답 스키마 변경이 이쪽 계약에 전파되는 것)을 원천 차단했다 — 바운디드 컨텍스트 소유권이 올바른 방향이다.
  - 제안: 없음(참고용 관찰).

- **[INFO]** 순환 의존성은 이 diff 범위에서 발견되지 않았다.
  - 상세: `SchedulesService`↔`TriggersService` 는 여전히 엔티티 타입만 상호 참조하고(`Schedule.trigger`, `Trigger`↔`schedule-runner`) 서비스 간 순환 호출은 없다(사전에 존재하던 단방향 `TriggersService → ScheduleRunnerService/ScheduleRepository` 구조가 그대로 유지됨). 이번 PR 이 추가한 새 모듈 등록·프로바이더 변경은 없다.
  - 제안: 없음.

## 요약

이 PR 은 §5.4 응답-계약 검증자의 배선을 4→18개 DTO 로 넓히는 작업과, 그 과정에서 실측으로 드러난 트리거 비밀(`notificationSecretV2`·`chatChannelTokenV2`·`config.interaction.triggerToken`·`config.notification.signing.secret`)의 응답 유출을 서비스·컨트롤러 두 경계에서 고친 보안 수정이 결합된 작업이다. 이미 8라운드의 코드 리뷰와 6라운드의 consistency 리뷰를 거치며 이 PR 이 스스로 만든 아키텍처 관련 지적(레이어 배치·deny-list 반복 누락·JSDoc 배치·중복 루프)이 대부분 실제로 조치되거나(예: 최종 커밋의 `omitKeys` DRY 추출) 근거와 함께 명시적으로 유예·백로그 등재됐음을 `git log`/`git diff`/`plan/in-progress/spec-draft-nullable-notation-followups.md` 대조로 확인했다. 이번 라운드에서 새로 지적할 아키텍처 결함은 발견되지 않았다 — 남아 있는 구조적 트레이드오프(컨트롤러 레벨 응답-셰이핑의 unit 테스트 불가, 비밀 strip 의 deny-list 구조, 두 drift 래칫의 부분집합 중복)는 전부 이전 라운드에서 실측 근거와 함께 검토되고 유예 조건 또는 백로그 항목으로 이미 문서화돼 있다. 반대로 검증자 계층 분리(정적 선언-대조 vs 런타임 값-대조)와 신규 참조 DTO 의 모듈 경계 존중은 이 PR 이 보여준 견고한 설계 판단이다. 순환 의존성·레이어 경계 침범·부적절한 추상화는 관측되지 않았다.

## 위험도

NONE
