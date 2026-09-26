# 요구사항(Requirement) 충족 리뷰 — success-advert 2R (11개 라우트 성공 응답 스키마 광고 + 가드 강화, 1R 조치 반영 후)

## 검증 방법

diff 대상 16개 코드 파일(CHANGELOG 제외, review/consistency 메타 산출물 제외) 전부를 실제 소스(`Read`)로 열어 다음을 대조했다.

- `AssistantSessionDto`/`AssistantMessageDto`/`AssistantToolCallDto`/`AssistantPlanDto`/`AssistantPlanStepDto`/`AssistantUsageDto`/`AssistantSessionDetailDto` (`assistant-session-response.dto.ts`) ↔ `workflow-assistant-session.entity.ts` · `workflow-assistant-message.entity.ts` 필드·nullable·enum 1:1 대조
- `workflow-assistant.controller.ts` 의 `list`/`latest`/`findOne`/`create`/`update`/`remove` 실제 반환값 ↔ 광고한 DTO/래퍼
- `TransformInterceptor`(`'data' in data` short-circuit) ↔ `ApiOkWrappedNullableResponse`/`ApiOkWrappedArrayResponse` 의 wire 가정
- `http-status-advertised-guard.ts` 의 `classifyDecorators`/`judgeHandler`(리팩터 후 형태) ↔ `spec/conventions/swagger.md` §2-4 신설 문단(같은 PR 이 이미 spec 본문에 반영)
- `triggers.service.ts` 의 `rotateNotificationSecret`/`revokePerTriggerToken` 실제 반환 객체 ↔ `NotificationRotateSecretDto`/`InteractionRevokeTokenDto`
- `shared/testing/response-contract.ts` 의 `descend`/`visit` — `additionalProperties: true` 오픈 맵(`arguments`/`result`) 이 하위 키까지 `undeclared` 로 오탐하지 않는지 직접 추적
- `workflow-assistant.e2e-spec.ts` H 케이스가 심은 두 메시지 행이 DTO 다섯 층(메시지·도구호출·계획·계획단계·사용량) 을 전부 왕복하는지
- 저장소를 뮤테이션하지 않고 정적 읽기로만 검증 — `git status --short` 확인 결과 이 세션이 만든 것은 자신의 리뷰 산출물 디렉터리뿐.

## 발견사항

이번 라운드(1R 조치 후)에서 CRITICAL/WARNING 급 신규 결함을 찾지 못했다. 1R 에서 이미 지적된 항목(RESOLUTION.md 기준 Critical 0 · Warning 3 전부 커밋 `bf1fa96fc` 로 조치, 뮤턴트 8/8 재확인)이 실제로 반영됐음을 코드 레벨에서 재확인했다 — `classifyDecorators` 분리, `advertise(status)` 공용 헬퍼, triggers 컨트롤러 반환 타입이 `Promise<NotificationRotateSecretDto>`/`Promise<InteractionRevokeTokenDto>` 로 좁혀진 것 전부 소스에 존재한다.

- **[INFO]** `sessions/latest` e2e 가 절대 발생할 수 없는 상태 코드까지 통과시킨다 — 이 PR 의 변경은 아니다
  - 위치: `codebase/backend/test/workflow-assistant.e2e-spec.ts` 함수 `F. sessions/latest` 테스트, `expect([200, 204, 404]).toContain(latest.status)` 줄
  - 상세: `workflow-assistant.controller.ts` 의 `latest()` 핸들러와 `WorkflowAssistantSessionService.findLatestActive()` 를 직접 확인한 결과 이 경로는 예외를 던지지 않고 항상 `WorkflowAssistantSession | null` 을 반환하며 `@HttpCode` 오버라이드도 없다 — 실제로 나올 수 있는 상태는 200 뿐이다(없으면 `{ data: null }`). `git diff origin/main -- codebase/backend/test/workflow-assistant.e2e-spec.ts` 로 확인한 결과 이 단언 줄 자체는 이번 PR 이 건드리지 않았고, PR 은 그 안쪽 `if (latest.status === 200)` 블록에 `assertMatchesContract` 호출만 추가했다. 즉 이번 diff 가 만든 결함은 아니며, `ApiOkWrappedNullableResponse` 광고(200 고정)와 이 테스트의 과관용적 단언이 약하게 어긋나 있다는 관찰이다.
  - 제안: 이번 PR 범위 밖 — 급하지 않으면 다음에 이 파일을 만질 때 `expect(latest.status).toBe(200)` 으로 좁혀서 향후 404/204 회귀(예: 라우트 순서가 깨져 `:id` 가 `latest` 를 가로채는 경우)를 실제로 잡게 할 수 있다.

## 점검 관점별 확인 (문제 없음)

- **기능 완전성**: plan 실측 표의 11곳(webauthn availability·delete, triggers rotate-secret·revoke-token, SSE, workflow-assistant 세션 6종) 전부 컨트롤러에서 대응 데코레이터가 확인된다. 처방 없음 4곳(테스트 훅 `@ApiExcludeEndpoint` 2, OAuth 리다이렉트 2)도 실측대로다.
- **엣지 케이스**: `title: null`(세션 제목 없음), `sessions/latest` 없음(`data: null`), `toolCalls`/`plan`/`usage` null vs 채워진 값, `result`/`planStepId`/`planStepIds`/`signature` optional 키 생략 — e2e H 가 두 극단(전부 생략 vs 전부 채움)을 실제로 DB 에 심어 대조한다(공허성 방지 단언 `toStrictEqual` 로 먼저 확인).
- **TODO/FIXME/HACK/XXX**: 대상 파일 전체(`grep`)에서 미완성 표식 없음.
- **의도와 구현 간 괴리**: `judgeHandler`/`scanHttpStatusAdvertised` JSDoc 이 `unadvertised` 축을 설명하며 실제 반환 필드와 일치. `wrapNullableDataSchema`/`ApiOkWrappedNullableResponse` 의 JSDoc(`allOf`+`nullable` 우회 근거)이 구현과 정확히 일치.
- **에러 시나리오**: `rotateNotificationSecret`/`revokePerTriggerToken` 의 `BadRequestException` 코드(`NOTIFICATION_NOT_CONFIGURED`/`NOT_PER_TRIGGER_STRATEGY`) 는 이번 diff 가 건드리지 않았고 그대로 유지됨을 확인 — 성공 응답 광고 추가가 에러 경로를 바꾸지 않았다.
- **데이터 유효성**: 이번 diff 는 요청 검증 로직을 바꾸지 않는다(응답 광고·가드·테스트만). `ParseUUIDPipe` 등 기존 검증 유지 확인.
- **비즈니스 로직**: `judgeHandler` 의 "성공 응답 하나도 없으면 unadvertised, 리다이렉트만 광고했으면 2xx 대조 생략" 규칙이 `spec/conventions/swagger.md` §2-4 신설 문단과 line-level 로 일치(같은 PR 이 spec 본문도 함께 갱신했다 — SPEC-DRIFT 아님, 코드와 spec 이 한 커밋 셋으로 동기).
- **반환값**: `list`(배열) · `latest`(객체|null) · `findOne`(세션+메시지) · `create`(201) · `update`(200) · `remove`(204, 본문 없음) 각각 실제 컨트롤러 반환문과 광고한 스키마가 대응.
- **spec fidelity**: `spec/conventions/swagger.md` §2-4(3xx 표 행·"라우트는 성공 응답을 하나 이상 광고한다" 문단·Rationale) 와 §5-2(`ApiOkWrappedNullableResponse` 표 행)가 이번 diff(파일 50)에 그대로 반영돼 있고, 구현(`api-wrapped.ts`, `http-status-advertised-guard.ts`)이 그 문구와 정확히 대응한다. `4-ai-assistant.md` §6 API 표에 `sessions/latest` 가 없다는 격차는 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 소관 저우선 백로그로 등재돼 있어 이번 리뷰에서 새로 지적할 필요 없음(재확인만).
- **오픈 맵 필드(`arguments`/`result`) 계약 검증 정확성**: `response-contract.ts` 의 `descend()` 는 `referencedNames(prop)` 이 빈 배열이면(즉 `$ref`/`allOf`/`oneOf` 가 없는 `{ type:'object', additionalProperties:true }`) 재귀하지 않고 반환한다 — 오픈 맵 내부 키를 "undeclared" 로 오탐하지 않음을 소스 레벨로 확인. 설계 의도(§1-4 "열린/동적 map")와 정확히 부합.

## 요약

1R 에서 발견된 Critical 0 · Warning 3(가드 SRP 분리, 메시지 DTO e2e 미대조, triggers 반환 타입 인라인)이 커밋 `bf1fa96fc` 로 전부 반영됐음을 소스 레벨로 재확인했고, 새 라운드에서 CRITICAL/WARNING 급 신규 결함은 찾지 못했다. DTO 필드는 엔티티·서비스 반환값과 1:1 대응하고, `ApiOkWrappedNullableResponse`/가드의 "하나 이상 광고" 규칙은 같은 PR 이 함께 갱신한 `spec/conventions/swagger.md` §2-4/§5-2 본문과 line-level 로 일치한다(SPEC-DRIFT 없음 — spec 과 코드가 한 변경으로 동기됨). 유일한 관찰은 이번 PR 이 만들지 않은 기존 테스트의 과관용적 상태코드 단언(INFO, 범위 밖)뿐이다.

## 위험도

NONE
