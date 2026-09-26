# 신규 식별자 충돌 검토 — post-status-openapi

## 발견사항

검토 결과 target(`plan/in-progress/post-status-openapi.md`, `--impl-prep` scope)이 새로 도입하는 식별자는
사실상 **정적 가드 파일 경로 1개**(`src/repo-guards/__tests__/http-status-advertised{-guard.ts,.spec.ts}`)뿐이다.
그 외에는 기존 엔드포인트의 `@HttpCode`/`@Api*Response` 데코레이터 값만 바꾸고, 기존 DTO(`OkResultDto`)와 기존
헬퍼(`ApiOkWrappedResponse`)를 그대로 재사용한다(`spec_impact: none`). 각 관점별로 확인한 결과는 다음과 같다.

- **요구사항 ID 충돌**: target 은 새 요구사항 ID 를 발급하지 않는다(이슈 번호·트래커 항목은 기존 것을 텍스트로 인용만 함). 해당 없음.
- **엔티티/타입명 충돌**: 새 엔티티·DTO 없음. `OkResultDto` 는
  `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:143` 에 유일하게 정의된 기존 타입이고,
  `ApiOkWrappedResponse` 는 `codebase/backend/src/common/swagger/api-wrapped.ts` 에 유일하게 정의된 기존 헬퍼다. 두 곳 모두
  다른 워크스페이스 컨트롤러 라우트(DELETE 형제들)에서 이미 같은 의미로 쓰이고 있어 재사용이며 충돌이 아니다.
- **API endpoint 충돌**: 새 endpoint 없음. 14곳 모두 기존 라우트(`POST /api/auth-configs/:id/regenerate` 등)의 응답 상태 코드
  데코레이터만 교체한다. `DELETE /api/workspaces/:id/invitations/:invitationId` 도 기존 라우트로, 런타임은 유지하고
  OpenAPI 광고만 `ApiNoContentResponse`(204) → `ApiOkWrappedResponse(OkResultDto)`(200) 로 바꾼다.
- **이벤트/메시지명 충돌**: 신규 webhook·queue·SSE 이벤트명 없음. `workflow-assistant.sendMessage` 의 SSE 스트림은 이름이 아니라
  HTTP 상태 코드(201→200)만 바뀐다.
- **환경변수·설정키 충돌**: 신규 ENV var·config key 없음.
- **파일 경로 충돌**: 신규 파일은 `src/repo-guards/__tests__/http-status-advertised-guard.ts` ·
  `http-status-advertised.spec.ts` 뿐이다. `find codebase/backend/src -iname "*http-status-advertised*"` 결과 0건 —
  기존 파일과 겹치지 않는다. 같은 디렉터리의 명명 컨벤션(`<name>-guard.ts` 순수 로직 + `<name>.spec.ts` 소비 spec, 예:
  `dto-class-name-collision-guard.ts`/`dto-class-name-collision.spec.ts`, `swagger-dto-contract-guard.ts`/
  `swagger-dto-contract.spec.ts`)과도 정확히 일치한다. 기능적으로도 인접 가드
  `swagger-dto-contract-guard.ts`(OpenAPI `nullable`/`required` vs TS 타입 정합)와는 축이 달라(그 가드는 필드 타입, 신규
  가드는 성공 상태 코드) 역할 중복도 없다.

INFO 이상으로 보고할 충돌은 발견되지 않았다.

## 요약

target 이 새로 도입하는 식별자는 정적 가드 파일 경로 한 쌍뿐이며, `find` 로 저장소 전체를 확인한 결과 기존 파일·기존
명명 컨벤션과 충돌하지 않는다. 그 외 엔티티(`OkResultDto`)·헬퍼(`ApiOkWrappedResponse`)는 모두 기존 정의를 재사용하는
것으로 확인됐고, 새 API endpoint·이벤트명·ENV/config key·요구사항 ID 는 전혀 발급되지 않는다(`spec_impact: none`,
기존 라우트의 상태 코드 데코레이터만 변경). 신규 식별자 충돌 관점에서는 문제가 없다.

## 위험도

NONE
