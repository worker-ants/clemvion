# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `PreviewTestDto.credentials` 의 Swagger 필드 설명이 이번 PR 이 바꾼 동작과 정면으로 모순된다
  - 위치: `codebase/backend/src/modules/integrations/dto/integration.dto.ts:175` (`PreviewTestDto` 클래스, `credentials` 필드의 `@ApiProperty({ description: ... })`) — 이 파일은 이번 diff 에 포함되지 않아 게이트 번호가 없으므로, 실제 저장소 파일을 `Read`/`Grep` 으로 열어 확인한 줄 번호를 그대로 적는다.
  - 상세: `POST /api/integrations/preview-test` 의 request body DTO 인 `PreviewTestDto.credentials` 필드는 여전히 `"검증 대상 자격 증명. 실제 외부 호출은 하지 않고 구조적 유효성만 확인합니다."` 라고 Swagger 에 노출한다. 그런데 같은 엔드포인트의 `@ApiOperation({ description })`(`integrations.controller.ts` — 이번 PR 이 정확히 이 문장을 고쳤다)은 `"필드 구조를 먼저 검증하고, MCP · Email · Database · HTTP 는 실제로 접속해 확인합니다(그 밖의 서비스는 구조 검증만)."` 라고 말한다. 같은 Swagger 페이지 안에서 operation-level 설명과 field-level 설명이 서로 반대되는 주장을 한다 — MCP · Email 은 이 PR 이전부터 이미 실제 접속을 했고(email `verify()`, mcp 실제 handshake), 이번 PR 이 Database · HTTP 를 추가해 네 서비스가 모두 실제로 접속하게 됐다. 이 PR 이 컨트롤러 쪽 문구는 정확히 고쳤으면서 같은 파일·같은 endpoint 의 DTO 필드 문구는 스윕에서 놓쳤다.
  - 제안: `PreviewTestDto.credentials` 의 `description` 을 컨트롤러 `@ApiOperation` 문구와 맞춘다 — 예: `"검증 대상 자격 증명. MCP · Email · Database · HTTP 는 실제로 접속해 확인하고, 그 밖의 서비스는 구조 검증만 합니다."` 사이드 노트: `RotateCredentialsDto.credentials` 는 이런 "외부 호출 없음" 주장을 하지 않으므로 이 문제가 없다(대조 확인 완료).

## 검증한 항목 (문제 없음)

- `CHANGELOG.md` — 새 Unreleased 항목이 타임아웃(10초×2 / 10초), 동시 상한(2), 에러 코드(`DB_AUTH_FAILED`/`DB_CONNECT_FAILED`/`HTTP_AUTH_FAILED`/`HTTP_SERVER_ERROR`/`HTTP_BLOCKED`/`DB_HOST_BLOCKED`) 를 실제 구현(`database-connection-tester.ts`/`http-connection-tester.ts`/`integrations.service.ts`)과 대조해 전부 일치. 기존 다중 `## Unreleased` 스택 관례도 그대로 따름.
- `codebase/backend/src/modules/integrations/clamp-message.ts`, `database-connection-tester.ts`, `http-connection-tester.ts`, `nodes/integration/database-query/database-connection.ts`, `nodes/integration/http-request/http-credentials.ts`, `http-redirect.ts`, `http-safety.ts` — 공개 함수·모듈 JSDoc이 분기(성공/차단/인증/그 밖 실패)와 근거(순환 import 회피, SSRF 재검증 시점, 소켓 파괴 타이밍)를 정확히 서술하고 코드와 대조해 어긋남 없음.
- `integrations.controller.ts` — `preview-test`·`rotate` 의 JSDoc·`@ApiOperation`·`@ApiOkWrappedResponse`·`@ApiBadRequestResponse` 문구가 새 동작(실접속 4개 서비스, `INTEGRATION_TEST_FAILED` 실패 가능성)을 정확히 반영하도록 갱신됨.
- `integration-response.dto.ts` — `PreviewTestResultDto.code`, `TestConnectionResultDto.code` 문서가 새 `DB_*`/`HTTP_*` 코드를 포함하도록 갱신되고 형제 DTO 상호 참조 주석도 정확함.
- `integrations.service.ts` — `clampMessage` 이동 후 독스트링이 새 위치(`clamp-message.ts`)로 옮겨졌고, `CONNECTION_TEST_MAX_CONCURRENCY`/`connectionTestLimit` 에 대한 새 JSDoc이 libuv 스레드풀 문제의 인과를 상세히 설명 — 코드(`pLimit(2)`, `dispatchTest` 배선)와 일치.
- `nodes/integration/http-request/http-request.handler.ts` — 리다이렉트 로직을 `followRedirectsSafely` 로 위임하면서, 구버전 `SSRF_BLOCKED_CLIENT_MESSAGE` 독스트링(중복)을 제거하고 `http-safety.ts` 쪽 단일 정의만 남김 — 오래된 주석 잔존 없음.
- `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.{mdx,en.mdx}` — 새 Callout 이 서비스별 연결 테스트 범위(실접속/구조검증/Cafe24·MakeShop 예외), 타임아웃, SSRF 차단 문구를 실제 구현과 일치하게 설명. `frontmatter code:` 목록에 새 테스터 파일 2개 추가.
- `spec/2-navigation/4-integration.md` — §5.3/§5.4/§9.2/§9.4/§10.3/§10.5/§14.1 갱신 및 `## Rationale` 신설 항목이 이전 라운드 consistency-check WARNING(§9.2 "Cafe24 한정" 옛 Rationale 미개정, `DB_CONNECT_FAILED`/`DB_CONNECTION_ERROR` 母집합 차이 미문서화)을 실제로 해소했음을 diff 로 확인.
- `plan/in-progress/integration-db-http-testers.md`, `spec-draft-nullable-notation-followups.md` — 처분 근거(뮤테이션 실측 표, e2e RED 원인 분석, `PreviewTestResultDto.code` 해소 기록)가 구체적 실측을 동반하며 상태 갱신이 정확함.
- 신규 spec 이 요구하는 환경변수는 기존 `ALLOW_PRIVATE_HOST_TARGETS` 재사용뿐이라 새 설정 문서화 의무 없음. `p-limit` 는 이번 PR 이전부터 이미 `package.json` 의존성이라 신규 의존성 문서화 의무 없음.
- 이미 알려진 후속 항목(연결 테스트 결과 코드의 프런트 지역화 사전 미등재, "확인 못 함" 안내가 화면에 닿지 않음)은 이 PR 자신의 plan(`spec-draft-nullable-notation-followups.md`)에 developer/planner owner 와 함께 이미 등재돼 있어 재지적하지 않음.

## 요약

이번 PR 의 문서화 수준은 전반적으로 높다 — 새로 추가된 두 테스터 모듈과 공유 모듈들은 분기별 동작·설계 근거를 상세히 설명하는 JSDoc을 갖췄고, CHANGELOG·사용자 가이드(ko/en)·spec(§5.3/§5.4/§9.2/§14.1/Rationale)이 실제 구현과 정확히 대조 검증됐으며, 이전 라운드 consistency-check 가 지적한 Rationale drift 도 이번 커밋에서 해소됐다. 다만 한 가지 놓친 지점이 있다 — `POST /api/integrations/preview-test` 의 컨트롤러 레벨 Swagger 설명은 정확히 갱신됐지만, 같은 엔드포인트의 request body DTO(`PreviewTestDto.credentials`) 필드 설명은 옛 "외부 호출 없음" 문구를 그대로 남겨 같은 Swagger 문서 안에서 자기모순을 만든다. 이 PR 이 다른 자리(controller docstring)에서 정확히 같은 문장을 고쳤다는 점에서, 스윕이 한 파일 앞에서 멈춘 것으로 보인다.

## 위험도

LOW
