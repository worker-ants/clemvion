# 보안(Security) 리뷰 — post-status-openapi

## 범위 요약

이번 변경은 POST 액션 다수(`auth-configs`, `integrations`, `knowledge-base`, `schedules`,
`workflow-assistant`, `workflows`, `workspaces`)에 `@HttpCode(HttpStatus.OK)` 를 추가해
**실제 응답 코드를 OpenAPI 광고와 일치**시키는 작업, 그 불일치를 검출하는 신규 repo-guard
(`http-status-advertised-guard.ts` + `.spec.ts` + fixture), 그리고 그에 맞춰 갱신된 다수 e2e 테스트의
상태 코드 단언(`[200,201]`/`201` → `200`)으로 구성된다. `workspaces.controller.ts` 의 초대 취소
엔드포인트는 `@ApiNoContentResponse`(204) 광고를 실제 동작(200 + `{ data: { ok: true } }`)에 맞춰
`@ApiOkWrappedResponse(OkResultDto)` 로 바꿨다.

각 컨트롤러 파일을 직접 열어 diff 인접 컨텍스트(가드 데코레이터, 역할 검증)를 확인했다 — 아래 요약.

- `auth-configs.controller.ts`: `regenerate` 에 `@HttpCode(HttpStatus.OK)` 추가. 인접 `@Roles('admin')` ·
  `@ParseUUIDPipe` 등 인가/입력 검증 로직은 변경 없음.
- `integrations.controller.ts`: `preview-test`/`oauth/begin`/`:id/test`/`:id/rotate`/`:id/reauthorize`/
  `:id/request-scopes` 5곳에 동일 데코레이터 추가. `@Roles('editor')`, `@Throttle`, SSRF 차단 관련
  서비스 호출은 그대로.
- `knowledge-base.controller.ts`: `search` 에 추가. `@Roles('viewer')` 유지.
- `schedules.controller.ts`: `preview` 에 추가. 인가 데코레이터 없음(원래도 없었음 — 입력은 cron 문자열
  파싱뿐이라 이 변경으로 새로 열리는 표면 없음).
- `workflows.controller.ts`: `:id/save` 에 추가. `@Roles('editor')` 유지.
- `workspaces.controller.ts`: `leave`/`transfer-ownership`/`invitations/accept` 에 추가 + 초대 취소
  응답 문서를 실제 응답 모양(200 + `OkResultDto`)에 맞춤. `@Roles('owner')`/`@Roles('admin')`,
  `WorkspaceParam` 가드 로직은 손대지 않음.
- `workflow-assistant.controller.ts`: SSE 핸들러(`sessions/:id/messages`)에 추가. 세션 소유권 검증
  (`findOneForUser`)이 SSE 헤더 송출 전에 수행되는 기존 순서는 유지됨 — 상태 코드만 201→200 으로
  바뀌었고 인가 체크 위치·타이밍에는 영향 없음.

신규 repo-guard(`http-status-advertised-guard.ts`)는 순수 AST 스캔 개발 도구로, 사용자 입력이 아닌
저장소 자체 소스 파일만 읽으며(`collectTsFiles` 로 수집한 고정 경로) 런타임에 서빙되지 않는다 — 공격
표면 아님.

## 발견사항

- **[INFO]** 초대 취소 응답 스펙이 204(No Content)에서 200+바디로 문서가 정정됨
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts` — `revokeInvitation` (`@Delete(':id/invitations/:invitationId')` 핸들러, `@ApiOkWrappedResponse(OkResultDto, ...)`)
  - 상세: 런타임 동작(200 + `{ data: { ok: true } }`) 자체는 이번 diff 이전부터 그랬고 이번 변경은 **문서만** 정정한다. 인가(`@Roles('admin')`)나 검증 로직 변경은 없음. 정보 노출·인가 우회 요소 없음 — 순수 계약-정합성 개선으로, 긍정적 방향(API 클라이언트의 오해 소지 감소).
  - 제안: 없음(문서 정확도 개선 자체가 유일한 변화).

- **[INFO]** e2e 테스트 파일에 로컬 인프라용 더미 자격 증명 문자열 다수 존재 (`clemvion-e2e`, `e2e-makeshop-secret`, `old-secret`, `e2e-token-old` 등)
  - 위치: 예) `codebase/backend/test/integration-connection-test.e2e-spec.ts` (`privateDb.password`), `codebase/backend/test/integration-makeshop-begin.e2e-spec.ts` (`clientSecret`)
  - 상세: 이번 diff 는 해당 파일들의 **상태 코드 단언 줄만** 바꿨다 — 이 자격 증명 리터럴은 diff 대상이 아닌 기존 컨텍스트이며, docker-compose e2e 환경 전용 로컬 테스트 값(실 서비스 자격 증명 아님)이다. 신규로 도입된 하드코딩 시크릿이 아니므로 이번 변경의 결함으로 보고하지 않음 — 참고용으로만 기록.
  - 제안: 조치 불필요(범위 밖, 사전 존재).

## 점검 관점별 결론

1. 인젝션(SQL/XSS/커맨드/경로탐색): 해당 diff 에 사용자 입력 처리 로직 변경 없음. repo-guard 는 고정 경로만 읽음. 이상 없음.
2. 하드코딩된 시크릿: 신규 도입 없음(위 INFO 참고, 기존 e2e 더미값).
3. 인증/인가: 모든 변경 지점에서 `@Roles`/`@WorkspaceParam`/소유권 검증 등 기존 가드가 그대로 유지됨을 소스 대조로 확인. `@HttpCode` 데코레이터 추가/순서는 NestJS 메타데이터 수집에 영향 없음(reflect-metadata 는 위치 무관 수집).
4. 입력 검증: 변경 없음.
5. OWASP Top 10: 해당 없음 — 응답 상태 코드 표준화는 A05(Security Misconfiguration)류에 해당할 수도 있으나, 이번 변경은 오히려 그 misconfiguration(광고-실제 불일치)을 **줄이는** 방향.
6. 암호화: 변경 없음. `integration-rotate-concurrency.e2e-spec.ts` 등에서 관찰되는 `encryptedJsonTransformer` 기반 저장 암호화 로직은 diff 대상 아님(테스트 단언만 변경).
7. 에러 처리: `workflow-assistant.controller.ts` 의 SSE 에러 처리(스택은 서버 로그에만, 클라이언트엔 코드만)는 diff 이전부터 있던 기존 설계이며 변경 없음.
8. 의존성 보안: 신규 의존성 추가 없음(`typescript`, `@nestjs/swagger`, `reflect-metadata` 는 기존 devDependency 활용).

## 요약

이번 변경은 실제 HTTP 성공 코드와 OpenAPI 문서 광고 간 불일치 15곳을 `@HttpCode(HttpStatus.OK)` 추가로
해소하고, 이를 회귀 방지하는 정적 AST 가드를 신설하며, 관련 e2e 단언을 갱신한 것이 전부다. 인가
데코레이터(`@Roles`)·소유권 검증·SSRF 차단·암호화 저장 로직 등 보안에 직결되는 코드는 각 컨트롤러
직접 열람으로 대조한 결과 모두 그대로 유지되었다. 새로운 인젝션·인증 우회·시크릿 노출·암호화 약화
징후는 발견되지 않았다. 신규 repo-guard 는 개발 도구로 런타임 공격 표면이 아니다.

## 위험도

NONE
