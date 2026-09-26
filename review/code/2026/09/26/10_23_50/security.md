# 보안(Security) 리뷰 — post-status-openapi

## 스코프 요약

이 변경은 실제 응답 코드(Nest 기본값 또는 `@HttpCode`)와 OpenAPI 가 광고하는 성공 코드를 일치시키는
작업이다. 31개 파일 중 대부분은:

- 7개 컨트롤러에 `@HttpCode(HttpStatus.OK)` 데코레이터를 추가 (POST 액션의 실제 응답을 201→200 으로),
- `workspaces.controller.ts` 의 초대 취소(`DELETE :id/invitations/:invitationId`) 응답을
  204(No Content) 광고 → `ApiOkWrappedResponse(OkResultDto)`(200 + `{ok:true}` 바디) 로 변경,
- 신규 정적 가드(`http-status-advertised-guard.ts` + `.spec.ts` + fixture)로 앞으로 이런 불일치를
  회귀 방지,
- 다수의 e2e 스펙에서 `expect([200, 201]).toContain(status)` 관용구를 `expect(status).toBe(200)` 으로
  조인다.

인증/인가 가드(`@Roles`, `@WorkspaceParam`/`@WorkspaceId`, `ParseUUIDPipe` 등)는 diff 상 전혀 손대지
않았고, 각 변경 지점 주변 전체 컨텍스트를 직접 열어 대조한 결과도 동일하다(아래 검증 목록 참고).
`@HttpCode` 는 응답 상태 줄에만 영향을 주며 인증·인가·유효성 검증 로직에는 관여하지 않는다.

## 직접 대조한 파일 (전체 컨텍스트가 프롬프트에서 잘려 `Read` 로 재확인)

- `codebase/backend/src/modules/integrations/integrations.controller.ts` — `preview-test` ·
  `oauth/begin` · `:id/test` · `:id/rotate` · `:id/reauthorize` · `:id/request-scopes` 5곳 모두
  기존 `@Roles`/역할 검증(`roleOf` + `requireModifiable`)이 그대로 유지됨을 확인.
- `codebase/backend/src/modules/workspaces/workspaces.controller.ts` — `:id/leave` ·
  `:id/transfer-ownership`(`@Roles('owner')` 유지) · `:id/invitations/:invitationId`(`@Roles('admin')`
  유지) · `invitations/accept` 모두 인가 데코레이터 불변.
- `codebase/backend/src/modules/knowledge-base/knowledge-base.controller.ts` — `search` 의
  `@Roles('viewer')` 유지.
- `codebase/backend/src/modules/schedules/schedules.controller.ts` — `preview` (인증만 필요, 원래도
  role 제한 없음, 변경 없음).
- `codebase/backend/src/modules/workflows/workflows.controller.ts` — `:id/save` 의
  `@Roles('editor')` 유지.
- `codebase/backend/test/helpers/auth.ts` — `inviteAndAccept` 를 `createInvitation` + 기존 로직으로
  분리한 리팩토링. RBAC·권한 흐름 변경 없음.

## 발견사항

- **[INFO]** e2e 테스트 헬퍼의 하드코딩된 고정 비밀번호
  - 위치: `codebase/backend/test/helpers/auth.ts` (파일 컨텍스트 11번째 줄, `export const TEST_PASSWORD = 'E2eTest!1234';` — 이 파일은 diff 로 새로 추가된 줄이 아니라 기존 상수이므로 게이트 번호 없음, 상수명으로 특정)
    - 상세: 테스트 전용 fixture 값으로 `e2e-spec` 전역에서 재사용된다. 실제 운영 자격 증명이나 외부 서비스로 전송되는 값이 아니고, 로컬/CI e2e 인프라(`backend-e2e:3011`)에 대해서만 사용되므로 실질적 위험은 없다. 다만 "하드코딩된 시크릿" 점검 관점에서 존재 자체는 기록해 둔다 — 프로덕션 코드/설정에는 나타나지 않음을 확인했다.
    - 제안: 조치 불필요. 프로덕션 코드 경로에 동일 패턴이 없는지만 주기적으로 확인.

- **[INFO]** 초대 취소 성공 응답이 `204 No Content` → `200 + {data:{ok:true}}` 로 바뀜
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts:550` (`@ApiOkWrappedResponse(OkResultDto, { description: '초대 취소 결과' })`)
    - 상세: 응답 바디가 없던 것에서 `{ ok: true }` 만 담은 바디로 바뀌었다. 새로 노출되는 필드가 없고(`ok:true` 고정값), 민감정보 노출이나 정보 누출 소지는 없다. 기존 `@Roles('admin')` 인가는 그대로다.
    - 제안: 조치 불필요 — API 계약 변경 사항으로만 기록.

- **[INFO]** SSE 스트림 상태 코드 변경(`workflow-assistant` `sendMessage`, 201→200)
  - 위치: `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts:151-229` (`sendMessage`)
    - 상세: 세션 소유권 검증(`findOneForUser`)이 SSE 헤더 송출·상태 코드 확정 이전에 그대로 수행되고 있어(주석·코드 모두 변경 없음), 인가 우회나 응답 스플리팅 등 새로운 벡터는 없다. 에러 처리도 기존과 동일하게 상세 스택은 서버 로그에만, 클라이언트에는 `ASSISTANT_STREAM_FAILED` 코드만 노출한다(§7 에러 처리 관점 양호).
    - 제안: 조치 불필요.

- **[INFO]** 신규 정적 가드(`http-status-advertised-guard.ts`)의 AST 파싱 대상은 저장소 자체 소스
  - 위치: `codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts`
    - 상세: `ts.createSourceFile` 로 컨트롤러/래퍼 파일을 파싱하지만 입력은 신뢰된 저장소 파일 경로(`collectTsFiles(SCAN_ROOT)`)로 한정되고 테스트 실행 시점에만 동작한다. 사용자 입력이나 외부 데이터를 파싱하지 않으므로 인젝션 표면이 아니다.
    - 제안: 조치 불필요.

이 외 나머지 e2e 스펙 변경(`expect([200, 201]).toContain(...)` → `expect(...).toBe(200)` 류)은 단언을
좁히는 것뿐이며 보안 관점의 영향이 없다.

## 요약

이번 변경은 HTTP 상태 코드와 OpenAPI 문서 간의 불일치를 해소하는 순수 계약(contract) 정합화 작업으로,
인증·인가 데코레이터, 입력 검증, 암호화, 에러 메시지 노출 방식 등 보안에 직접 관련된 로직은 diff 및
주변 컨텍스트 확인 결과 전혀 변경되지 않았다. 인젝션·하드코딩된 운영 시크릿·인증 우회·안전하지 않은
암호화·민감정보 에러 노출 등 CRITICAL/WARNING 급 발견사항은 없다. 테스트 헬퍼의 고정 비밀번호와 초대
취소 응답 바디 변경 등 경미한 관찰 사항만 INFO 로 기록한다. 저장소 파일은 뮤테이션하지 않았으며
`git status --short` 확인 결과 리뷰 산출물 디렉터리 외 변경 없음.

## 위험도

NONE
