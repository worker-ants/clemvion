# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `AssistantSessionDetailDto.messages` 하위의 `AssistantMessageDto`/`AssistantToolCallDto`/`AssistantPlanDto`/`AssistantPlanStepDto`/`AssistantUsageDto` 5개 DTO가 e2e 계약 검증에서 실제로 한 번도 대조되지 않는다.
  - 위치: `codebase/backend/src/modules/workflow-assistant/dto/responses/assistant-session-response.dto.ts:196` (`AssistantMessageDto` 클래스), `codebase/backend/test/workflow-assistant.e2e-spec.ts:89-97` (세션 상세 조회 테스트 A)
  - 상세: `assertMatchesContract`(`codebase/backend/src/shared/testing/response-contract.ts:191-228` `descend()`)는 값이 배열이면 `value.forEach`로 **원소마다** 내려가 대조한다. 즉 `messages` 배열이 비어 있으면 `AssistantMessageDto` 스키마는 전혀 검사되지 않는다. `workflow-assistant.e2e-spec.ts`의 테스트 A는 세션을 만들자마자(메시지 0건) `GET /sessions/:id`를 호출해 `AssistantSessionDetailDto` 계약을 검사하므로, `messages: []`인 상태만 검증된다. 이 PR이 다른 e2e(테스트 G, SSE 스트림)에서 세션에 메시지를 보내긴 하지만 `llmConfigId`가 존재하지 않는 값이라 요청 검증 단계에서 끝나고(`ASSISTANT_NO_LLM_CONFIG`), 그 뒤 `GET /sessions/:id`로 상세를 다시 조회해 `assertMatchesContract`를 부르는 코드가 없다. 결과적으로 `toolCalls`/`plan`/`usage`/`autoResumeReason`/`autoResumeAttempt` 등 5개 중첩 DTO에 선언한 `nullable`·`required`·필드 목록이 실제 저장된 메시지 row(엔티티 → DTO 변환 경로, `workflow-assistant-session.service.ts:158` 부근의 매핑)와 맞는지 이번 PR의 e2e가 전혀 확인하지 못한다. 이 PR의 취지 자체가 "엔티티 그대로 반환 → 선언되지 않은 키/`null` 불일치를 e2e가 잡는다"(파일 상단 주석, `spec/conventions/swagger.md §5.4`)인데, 정작 메시지 레벨 DTO는 그 취지가 적용되지 않는 사각지대로 남는다.
  - 제안: 실제 LLM 호출 없이도(예: DB에 `workflow_assistant_message` row를 직접 INSERT하거나, mock LLM 설정으로 최소 1턴 완료) `messages` 배열에 항목이 최소 1건 있는 상태로 `GET /sessions/:id`를 호출해 `assertMatchesContract(detail.body.data, await contractForDto(AssistantSessionDetailDto))`를 검증하는 케이스를 추가할 것. 최소한 `toolCalls`/`plan`/`usage`가 `null`인 단순 텍스트 메시지 하나만 있어도 `AssistantMessageDto` 최상위 필드는 검증된다.

- **[INFO]** `AssistantSessionDto`의 `title`/`llmConfigId` 등 `required + nullable` 필드가 실제 `null` 값으로 온 경우를 대조하는 e2e 케이스가 없다.
  - 위치: `codebase/backend/src/modules/workflow-assistant/dto/responses/assistant-session-response.dto.ts:57-67` (`title`, `llmConfigId` 선언), `codebase/backend/test/workflow-assistant.e2e-spec.ts:63-97, 99-116, 185-205` (테스트 A/B/F)
  - 상세: 이 PR이 `assertMatchesContract`를 호출하는 세 지점(A/B/F)은 전부 `title`을 명시적으로 채워서 세션을 만든다(`'Initial session'`/`'Before'`·`'After'`/`'Latest test'`). `title: string | null`이 `required`(키 생략 불가) + `nullable`(값 `null` 허용) 조합으로 선언돼 있는데, `visit()`의 `value === null` 분기(`response-contract.ts:259-270`)를 통과하는 실제 응답이 이번 PR e2e에는 없다. 제목 없이 세션을 만드는 테스트 C/D/E는 `assertMatchesContract`를 부르지 않는다. `llmConfigId`도 마찬가지로 항상 미설정 상태로만 검사된다(값이 `undefined`인 경우는 대조 자체를 안 함 — required 위반으로만 걸림).
  - 제안: 제목 없이 생성한 세션(테스트 C·D·E가 이미 그렇게 만든다)에도 `assertMatchesContract` 한 줄을 추가하면 `title: null` 실측 경로를 덤으로 확보할 수 있다. 필수는 아니나, 이 검증기의 핵심 가치가 "`required`+`nullable` 조합에서 값이 실제로 `null`로 오는지"를 잡는 것이므로 저비용으로 커버리지를 늘릴 수 있는 자리다.

- **[INFO]** `api-wrapped.spec.ts`의 신규 `wrapNullableDataSchema` 단위 테스트는 스키마 생성 함수만 검증하고, 같은 커밋에서 추가된 `ApiOkWrappedNullableResponse`(데코레이터 조합 함수, `api-wrapped.ts:162-170`) 자체는 단위 테스트로 직접 검증되지 않는다.
  - 위치: `codebase/backend/src/common/swagger/api-wrapped.spec.ts:36-45`, `codebase/backend/src/common/swagger/api-wrapped.ts:162-170`
  - 상세: `ApiOkWrappedResponse`/`ApiOkWrappedArrayResponse` 등 기존 래퍼 함수들도 동일하게 단위 테스트에서 직접 다루지 않고 컨트롤러 e2e를 통해서만 간접 검증되는 기존 패턴을 그대로 따른 것이라 이 PR만의 새로운 결함은 아니다. `ApiOkWrappedNullableResponse`는 `workflow-assistant.e2e-spec.ts` 테스트 F(`sessions/latest`)로 간접 커버된다.
  - 제안: 우선순위 낮음 — 기존 컨벤션과 일관되므로 반드시 고칠 필요는 없다. 다만 향후 래퍼 함수가 늘어나면 `ApiExtraModels`가 실제로 붙는지까지 (Swagger 문서 생성 스모크 테스트로) 한 번에 보는 것을 고려할 만하다.

## 요약

이 PR의 테스트 설계는 전반적으로 견고하다 — 특히 `http-status-advertised-guard.ts`/`.spec.ts`는 대조군 fixture(`sample.controller.ts`)로 판정 분기를 촘촘히 가르고, 근거 캐너리(실제 Nest 앱으로 `@Res()` 핸들러 상태 코드 확정)와 뮤테이션 테스트(6/6 KILLED, plan에 기록)까지 갖춰 회귀 방지력이 높다. `api-wrapped.spec.ts`의 `wrapNullableDataSchema` 테스트도 `allOf` + `nullable` 모양을 `toStrictEqual`로 정밀하게 고정해 명확하다. 다만 이번 PR이 새로 추가한 `workflow-assistant` 세션 상세 DTO 5종 중 메시지 레벨 DTO(`AssistantMessageDto`와 그 하위 4종)는 `assertMatchesContract`의 대상 배열이 항상 빈 상태로만 검사되어, 이 PR의 핵심 방어선(엔티티 패스스루 응답의 선언-실제 불일치 검출)이 정작 가장 필드가 많고 복잡한 DTO에는 적용되지 않는 사각지대가 생겼다. 이는 CRITICAL한 결함은 아니지만, 이 검증 계층이 잡으려는 것과 정확히 같은 클래스의 갭이라 WARNING으로 표시한다. 나머지 파일(webauthn availability, trigger secret DTO 둘)은 `advertised-response-contract.e2e-spec.ts`/`chat-channel-trigger-create.e2e-spec.ts`로 실측 계약 검증이 잘 이루어졌다.

## 위험도

MEDIUM
