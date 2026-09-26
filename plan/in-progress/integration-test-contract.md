---
title: "`POST /api/integrations/:id/test` 응답 계약 — MCP 전용 필드 3종 선언 · 성공 경로 계약 검증 · HTTP 와이어 검증"
status: in-progress
owner: developer
worktree: integration-test-contract
spec_impact: none
started: 2026-09-26
---

# `/api/integrations/:id/test` 응답 계약

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 두 항목을 한 PR 로 닫는다.

- «`/api/integrations/:id/test` 의 MCP 전용 응답 필드 3종이 미선언 + 계약 검증자 미배선» (서비스 축)
- «`/api/integrations/:id/test` 에 HTTP 와이어-레벨 계약 검증이 없다» (와이어 축)

**한 PR 로 묶는 이유**: 필드 셋이 선언돼야 성공 경로에 계약 검증을 걸 수 있다. 셋이 미선언인 채로 와이어 검증을 걸면 성공
케이스가 그 자리에서 RED 다. 즉 와이어 항목은 서비스 항목에 막혀 있었다.

## 실측 (2026-09-26, origin/main `7e617acd6`)

- 생산자: `IntegrationsService.testMcpTransport` 가 성공 시 `{ success, message, capabilities, serverInfo, preview }` 를 돌려준다
  (`integrations.service.ts`). 값은 `McpTestConnectionService.test` 가 만든다 — `preview` 의 안쪽 키(`toolCount` ·
  `resourceSupported` · `promptSupported`)도 그쪽 리터럴이다.
- 선언: `TestConnectionResultDto` 는 `success` · `code?` · `message?` 만 선언한다. 같은 `dispatchTest` 결과를 돌려주는 형제
  `PreviewTestResultDto` 는 셋을 이미 선언한다(`capabilities` · `serverInfo` 는 열린 맵, `preview` 는 `McpConnectionPreviewDto`).
- spec: `spec/2-navigation/4-integration.md` §5.6 «테스트» 가 성공 응답의 세 필드를 이미 문서화한다(`spec/5-system/11-mcp-client.md` §9 도
  같다). 낡은 쪽은 spec 이 아니라 DTO 다 → `spec_impact: none`.
- 계약 검증: 서비스 spec 은 `testConnection` 의 `pending_install` 실패 경로 한 곳만 `assertMatchesContract(…, TestConnectionResultDto)`
  를 건다. 그 자리 주석이 «성공 경로에는 아직 걸 수 없다 … 닫히면 이 배선을 성공 경로로도 넓힌다» 고 예고한다. `testConnection` 의
  MCP 성공 케이스는 서비스 spec 에 **없다**. `previewTest` 의 MCP 성공 케이스는 있지만 계약 검증이 없다.
- 와이어: 이 엔드포인트의 supertest 왕복(전역 `TransformInterceptor` 포함)은 없다. 자매 `/api/model-configs/:id/test` 는
  `llm-model-config.controller.spec.ts` 에 있다.

## 방향

1. **DTO** — `TestConnectionResultDto` 에 `capabilities?` · `serverInfo?` · `preview?` 를 선언한다. 선언은 `PreviewTestResultDto` 와
   **같게** 한다(같은 생산자). `serverInfo` 를 닫힌 DTO 로 만들지 않는 이유: SDK 가 `name` · `version` 밖의 키를 실을 수 있어서다.
   열린 맵이면 검증자가 안으로 내려가지 않으므로 그 키가 거짓 RED 를 만들지 않는다. 형제와 다르게 선언하면 두 엔드포인트가
   같은 값을 다르게 광고한다.
   - 필드 옆 `//` 주석(«MCP 전용 필드도 미선언 … 별도 등재»)을 닫힘에 맞게 고친다.
   - 핸들러의 `@ApiOkWrappedResponse` 설명 «(성공 여부, 메타 정보)» 를 고친다. `meta` 는 `#1330` 이 제거한 유령 필드다. 새 설명:
     성공 여부 · 실패 코드 · MCP capability 미리보기.
2. **서비스 축** (`integrations.service.spec.ts`)
   - `testConnection` describe 에 MCP 성공 케이스를 추가하고 `assertMatchesContract(…, TestConnectionResultDto)` 를 건다.
     `pending_install` 자리 주석의 예고를 닫힘으로 고친다.
   - `previewTest` 의 MCP 성공 케이스에 `assertMatchesContract(…, PreviewTestResultDto)` 한 줄을 더한다. 같은 생산자의 형제
     응답인데 선언이 있으면서 검증이 없는 비대칭이다.
3. **와이어 축** — 새 `integrations.controller.wire.spec.ts`. 자매 패턴을 따른다.
   - `Test.createTestingModule` 에 진짜 `IntegrationsController` · 진짜 `IntegrationsService` · **진짜 `McpTestConnectionService`**
     를 넣는다. mock 은 그 의존(`McpClientService.connect` · 레포지토리 · 기타 서비스)뿐이다.
   - **왜 MCP 테스터까지 진짜인가**: 테스터를 mock 하면 `preview` 의 안쪽 키 이름을 내가 적고 내가 단언한다. 그러면 필드 이름
     축에서 vacuous 하다(자매 describe 의 docblock 이 적은 논지와 같다).
   - `app.useGlobalInterceptors(new TransformInterceptor())` 로 봉투를 태운다.
   - `@CurrentUser()` 는 가드가 `req.user` 를 채운다고 가정한다. 테스트 앱에는 가드가 없으므로 미들웨어로 `req.user` 를 채운다.
     `@WorkspaceId()` 는 헤더 `X-Workspace-Id` 로 채운다.
   - 케이스:
     - (a) MCP 성공 — `tools` capability 있음.
     - (b) MCP 성공 — `tools` 없음. `toolCount` 가 와이어에서 빠지는지(optional 선언이 맞는지) 본다.
     - (c) MCP 실패 — connect 가 `McpAuthError` → `MCP_AUTH_FAILED`.
   - 각 케이스는 `assertMatchesContract(res.body.data, …)` 에 더해 **키 전수**를 단언한다. `preview` 안쪽 키도 센다. 이유는 둘이다.
     검증자는 optional 필드가 통째로 빠져도 통과시킨다. 열린 맵 · `$ref` 밖의 변화는 보지 못한다.
4. **CHANGELOG** — 항목 1(OpenAPI): `/integrations/:id/test` 응답 스키마가 MCP 성공 필드 셋을 광고한다.

## 뮤턴트 (예측 — 실측은 구현 뒤 이 표에 채운다)

| # | 뮤턴트 | 예측 | 실측 · 죽인 케이스 |
|---|---|---|---|
| M1 | DTO 에서 `capabilities` 선언 제거 | 서비스 성공 · 와이어 (a)(b) RED | |
| M2 | DTO 에서 `preview` 선언 제거 | 서비스 성공 · 와이어 (a)(b) RED | |
| M3 | `serverInfo` 를 `additionalProperties` 없는 선언으로 | 검증자 판정 확인 필요 — 열린 맵과 닫힌 빈 객체의 차이 | |
| M4 | `testMcpTransport` 가 `preview` 를 복사하지 않음 | 계약 GREEN(optional) · 와이어 키 전수 RED | |
| M5 | `McpTestConnectionService` 가 `toolCount` → `toolsCount` | 서비스 spec GREEN(테스터 mock) · 와이어 (a) RED | |
| M6 | 와이어 앱에서 `TransformInterceptor` 제거 | 와이어 전 케이스 RED | |
| M7 | `McpConnectionPreviewDto.toolCount` 를 required 로 | 와이어 (b) RED | |

## `--impl-prep` 처분 (`review/consistency/2026/09/26/20_32_24` BLOCK: NO)

- **WARNING 1** — `INTEGRATION_TEST_FAILED` 의 상태 코드(§9.4 는 422) · 발생 경로(MCP client §9 는 `:id/test`)가 코드(`rotate()`
  의 400)와 어긋난다. 실측으로 확인했다. spec 만 틀렸고 이 PR 의 DTO · 테스트와는 무관하다 → planner 항목으로 트래커에 등재.
- **INFO 2** — `serverInfo` 의 TS 타입은 `{ name; version }` 인데 스키마는 열린 맵이다. 형제와 **같게** 둔다(방향 1). TS 타입은
  문서 전용 DTO 의 필드 타입이라 런타임 계약은 스키마가 정한다. 형제만 고치거나 이쪽만 고치면 둘이 갈린다.
- **INFO 5** — 별도 파일로 둔다. 이 모듈엔 평범한 `integrations.controller.spec.ts` 가 없고 `integrations.controller.owner.spec.ts`
  처럼 관점별 파일이 관례다. 자매는 기존 컨트롤러 spec 에 describe 를 더했지만, 여기선 더할 파일이 관점이 다른 owner spec 뿐이다.
- INFO 1 · 3(spec 이 서비스 타입명 `IntegrationTestResult` 로 부른다) · 4(무관 문서의 Rationale 번호) — 이 PR 은 spec 을 쓰지 않는다.

## 체크리스트

- [x] `--impl-prep` — `review/consistency/2026/09/26/20_32_24` BLOCK: NO(W1 은 트래커 planner 항목)
- [x] DTO · 서비스 축 · 와이어 축 · CHANGELOG
- [ ] 뮤턴트 표 실측
- [ ] TEST WORKFLOW (lint · unit · build · e2e)
- [ ] `/ai-review`
- [ ] `--impl-done`
- [ ] 트래커 두 항목 닫기
