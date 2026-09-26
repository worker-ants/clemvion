# 보안(Security) 코드 리뷰

## 스코프 요약

이번 변경은 `POST /integrations/:id/test` 응답의 MCP 전용 필드 3종(`capabilities` · `serverInfo` · `preview`)을
`TestConnectionResultDto` 에 뒤늦게 **선언**하고(같은 값을 반환하는 형제 `PreviewTestResultDto` 와 동일한 선언),
서비스 축 계약 검증(`assertMatchesContract`)과 새 HTTP 와이어 레벨 테스트(`integrations.controller.wire.spec.ts`)를
추가한다. 나머지는 CHANGELOG·plan 문서·consistency 리포트 산출물이다. **런타임 동작(핸들러 로직·인가·응답 생성 경로)은
바뀌지 않는다** — 이 필드들은 plan 자신이 실측했듯 이미 `testMcpTransport` 가 반환하고 있었고, 이번 diff 는 OpenAPI
문서화와 테스트 커버리지만 따라잡는다. 따라서 새로운 공격 표면을 추가하는 코드는 없다.

## 발견사항

- **[INFO]** 신규 와이어 테스트의 인증 우회는 테스트 전용 스캐폴딩이며 프로덕션 코드에 영향 없음
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.wire.spec.ts:113` (`app.use((req, _res, next) => { req.user = { sub: CREATOR }; next(); })`)
  - 상세: `Test.createTestingModule` 로 만든 앱에는 실제 `JwtAuthGuard`/`Roles` 가드가 없으므로 `@CurrentUser()` 가 읽는
    `req.user` 를 미들웨어로 직접 채운다. NestJS 컨트롤러 단위-와이어 테스트의 표준 패턴이며(형제
    `llm-model-config.controller.spec.ts` 도 같은 방식), 실제 인증·인가 로직을 테스트 대상에서 제외하고 응답 shape 만
    검증하려는 의도적 설계다. 프로덕션 부트스트랩(`main.ts`)에는 이 미들웨어가 없으므로 인증 우회가 배포 코드에
    반영되지 않는다.
  - 제안: 조치 불필요. 참고용으로만 기재.

- **[INFO]** 테스트 픽스처의 `token: 'abc'` 는 실제 시크릿이 아니라 합성 더미 값
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.wire.spec.ts:59` (`credentials: { url: 'https://mcp.example.com', token: 'abc' }`)
  - 상세: 시크릿 스캐너가 `token:` 키를 오탐할 수 있으나 값이 임의 자리표시자(`abc`)이고 실제 서비스로 전송되지
    않는 mock 픽스처다(`McpClientService.connect` 자체가 `jest.fn()` 으로 mock). 하드코딩된 실제 시크릿이 아니다.
  - 제안: 조치 불필요.

- **[INFO]** MCP 서버가 보고하는 `capabilities`/`serverInfo` 를 그대로 클라이언트에 반환하는 기존 동작이
  이번 diff 로 OpenAPI 계약에 공식 광고된다 (diff 자체가 도입한 위험은 아님)
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:508` (`capabilities?: Record<string, unknown>`), `:516` (`serverInfo?: { name: string; version: string }` + `additionalProperties: true`)
  - 상세: 두 필드는 외부(사용자가 등록한) MCP 서버가 보낸 값을 검증·필터링 없이 그대로 실어 나른다(`testMcpTransport`
    → `session.capabilities`/`session.serverInfo`). 이 pass-through 자체는 이번 diff 이전부터 있던 동작이고, 이번
    변경은 그 기존 동작을 OpenAPI 스키마에 **문서화**할 뿐 새 코드 경로를 추가하지 않는다. 다만 열린 맵으로
    공식 계약화되면 서드파티 API 소비자(프런트엔드 포함)가 이 값을 그대로 렌더링할 유인이 커진다 — 만약 프런트엔드가
    `capabilities`/`serverInfo` 의 임의 키 값을 이스케이프 없이 HTML 에 꽂으면 악의적/침해된 MCP 서버가 저장형
    XSS 벡터가 될 수 있다. 이번 diff 범위(백엔드 DTO·테스트) 안에는 그런 렌더링 코드가 없으므로 이 diff 자체의
    결함은 아니다.
  - 제안: 이번 PR 스코프 밖. 프런트엔드가 이 필드들을 렌더링하는 지점이 있다면 해당 코드에서 이스케이핑을
    확인해 둘 가치가 있다는 점만 기록(차단 사유 아님).

이 외 인젝션(SQL/XSS/커맨드/경로탐색), 인증·인가 로직 변경, 암호화 알고리즘 변경, 신규 의존성, 에러 메시지의
민감정보 노출(신규)은 diff 범위 내에서 관측되지 않았다. `integrations.controller.ts` 의 `:id/test` 라우트 자체
(가드·역할 검사)는 이번 diff 가 건드리지 않은 기존 코드이며 설명(description) 문자열만 바뀌었다.

## 요약

이번 변경은 이미 반환되고 있던 MCP 성공 응답 필드를 OpenAPI DTO 로 뒤늦게 선언하고 그에 대한 테스트 커버리지
(서비스 계약 검증 + HTTP 와이어 검증)를 추가하는 문서/테스트 정합화 작업이다. 새로운 실행 코드 경로, 인증/인가
변경, 시크릿 하드코딩, 인젝션 가능 지점이 없으며, 테스트 파일의 인증 우회 미들웨어와 더미 토큰은 표준적인
단위 와이어 테스트 스캐폴딩으로 프로덕션에 영향이 없다. MCP 서버 응답 pass-through 가 향후 프런트엔드
렌더링 시 XSS 벡터가 될 수 있다는 점은 기존 동작에 대한 참고 사항(INFO)으로만 남긴다.

## 위험도

NONE
