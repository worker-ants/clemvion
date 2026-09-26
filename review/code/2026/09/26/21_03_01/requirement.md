# 요구사항(Requirement) 리뷰 — `integration-test-contract`

## 검증 방법

저장소 내 뮤테이션 없이 `Read`/`Grep`/`Bash`(읽기 전용)만 사용했다. 확인한 실제 소스:
`integrations.service.ts`(`IntegrationTestResult`·`testConnection`·`previewTest`·`dispatchTest`·`testMcpTransport`),
`mcp-client.service.ts`(`ServerCapabilities`·`ServerInfo`), `mcp-test-connection.service.ts`(`ConnectionPreview`·
`McpTestConnectionService.test`), `shared/testing/response-contract.ts`(`assertMatchesContract` 판정 규칙),
`spec/2-navigation/4-integration.md` §5.6/§9, `spec/5-system/11-mcp-client.md` §9. 저장소 파일은 전혀 수정하지
않았다 — `git status --short` 로 원상 확인 불필요(쓰기 자체가 없었음).

## 발견사항

- **[INFO] `INTEGRATION_TEST_FAILED` 상태 코드 spec 간 불일치는 이 PR 의 결함이 아니다 — 이미 올바르게 처리됨**
  - 위치: `spec/2-navigation/4-integration.md` §9.4 (`INTEGRATION_TEST_FAILED (422)`) vs
    `spec/5-system/11-mcp-client.md` §9 (`INTEGRATION_TEST_FAILED`, HTTP 400, `:id/test` 로 오귀속)
  - 상세: 실제 코드는 `rotate()` 한 곳에서만 400 을 던지며(`integrations.service.ts` 확인), `:id/test`
    (`testConnection`)는 절대 throw 하지 않고 항상 200 이다 — 두 spec 문서 중 하나가 낡았다. 이 PR 의
    `--impl-prep` (`review/consistency/2026/09/26/20_32_24`)이 이미 WARNING 으로 잡아냈고, plan 이
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 후속 항목으로 정확히 등재했다
    (`spec_impact: none` 유지, developer 가 spec 을 직접 고치지 않음 — CLAUDE.md 규약대로).
  - 제안: 조치 불필요. spec 정정은 project-planner 턴에서 별도로 처리될 사안이며 이번 코드 변경 범위 밖이다.
    기록 목적으로만 남긴다.

- **[INFO] `serverInfo` 의 TS 타입(닫힌 `{name; version}`)과 OpenAPI 스키마(열린 맵) 불일치는 신규가 아니라 형제 복제**
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` —
    `TestConnectionResultDto.serverInfo`(게이트 516) / `PreviewTestResultDto.serverInfo`(게이트 277, 기존)
  - 상세: `McpClientService.ServerInfo` 는 `{name: string; version: string}` 이지만 SDK 가 그 밖의 키를 실을 수
    있어(주석에 근거 명시) 스키마는 의도적으로 `additionalProperties: true` 로 열어 뒀다. 이번 PR 은 이미
    존재하던 `PreviewTestResultDto` 의 동일 패턴을 `TestConnectionResultDto` 에 **그대로 복제**했을 뿐이라
    신규 결함이 아니다. `--impl-prep` 리뷰가 이미 확인·용인했다.
  - 제안: 조치 불필요.

## 교차 검증 결과 (실측 — 문제 없음)

- **필드명·shape 이 spec·생산자·DTO 세 층에서 정확히 일치**: `spec/5-system/11-mcp-client.md` §9 의 성공 응답 예시
  `{ capabilities, serverInfo, preview: { toolCount, resourceSupported, promptSupported } }` 가
  `McpTestConnectionService.test()` 의 실제 반환값(게이트 122-132), `IntegrationsService.testMcpTransport()` 의
  전달 로직(게이트 1808-1829), `TestConnectionResultDto` 의 신규 선언(게이트 499-521) 과 line-level 로 일치한다.
  `spec/2-navigation/4-integration.md` §5.6(게이트 562)도 같은 필드명·shape 을 문서화해 두 spec 문서 사이에서도
  이 축은 정합이다.
- **optional 여부가 실제 부재 정책과 일치**: `preview.toolCount` 는 `capabilities.tools === undefined` 일 때만
  생략되고(§9 서술과 정확히 일치), DTO 는 `toolCount?: number`(옵션)로 선언 — `resourceSupported`/`promptSupported`
  는 항상 채워지고 DTO 도 required 로 선언(`McpConnectionPreviewDto`, 게이트 235-243). 실패 경로에서는
  `capabilities`/`serverInfo`/`preview` 가 응답에서 완전히 생략되는데(`testMcpTransport` 실패 분기, 게이트
  1824-1828) DTO 주석("다른 service_type 에서는 생략된다")과 일치.
- **`assertMatchesContract` 판정 규칙과 뮤턴트 표의 정합성**: `response-contract.ts` 를 직접 읽어 "열린 맵/oneOf
  는 내부를 보지 않는다"·"optional 필드 통째 부재는 위반 아님" 판정 규칙을 확인했고, plan 의 뮤턴트 표(M3·M9
  SURVIVED→형제 대조 캐너리로 KILLED)가 이 판정 규칙과 정확히 부합한다 — 근거 없는 주장이 아니라 실제 구현을
  반영한 서술이다.
- **와이어 테스트 3케이스 기대값 재계산 결과 모두 실제 코드 동작과 일치**: (a) `tools/resources` 있음 →
  `toolCount:3, resourceSupported:true, promptSupported:false`, (b) `prompts` 만 있음 → `toolCount` 키 자체
  생략(JS `undefined` 값이 JSON 직렬화에서 드롭됨) + `resourceSupported:false, promptSupported:true`, (c)
  `McpAuthError` → `{success:false, code:'MCP_AUTH_FAILED', message: <원본 메시지>}`. 세 값 모두 손으로 재계산한
  결과가 테스트 단언과 일치한다.
- **엣지 케이스**: `capabilities.tools` 부재(toolCount 생략), 실패 경로의 필드 완전 부재, MCP 외 service_type
  에서 세 필드 부재 — 전부 코드·테스트·spec 세 층에서 일관되게 다뤄진다. TODO/FIXME/HACK/XXX 주석 없음(전수
  grep 확인).
- **반환값**: `testConnection`/`previewTest`/`dispatchTest`/`testMcpTransport` 모든 분기가 `IntegrationTestResult`
  형태의 값을 반환하며 누락 경로 없음.

## 요약

`POST /integrations/:id/test` 의 MCP 성공 응답 필드 3종(`capabilities`·`serverInfo`·`preview`) 선언, 서비스 레벨
계약 검증, HTTP 와이어 계약 검증을 추가하는 변경으로, spec(`4-integration.md §5.6`·`11-mcp-client.md §9`)·실제
생산자(`McpTestConnectionService`·`IntegrationsService.testMcpTransport`)·신규 DTO 선언이 필드명·optional 여부·
값 계산 로직까지 line-level 로 정확히 일치함을 직접 소스를 열어 재확인했다. 형제 `PreviewTestResultDto` 와의
선언 동일성을 강제하는 회귀 테스트(캐너리)까지 갖춰 향후 두 선언이 다시 벌어지는 것을 막는다. 유일하게 발견된
불일치(`INTEGRATION_TEST_FAILED` 상태 코드의 spec 간 오기)는 이 PR 의 코드 변경과 무관한 기존 spec 결함이며,
이미 `--impl-prep` 단계에서 올바르게 식별되어 개발자가 직접 spec 을 고치지 않고 planner 후속 항목으로 정확히
분리·기록했다(CLAUDE.md 의 spec 소유권 경계를 준수). Critical/Warning 급 발견사항 없음.

## 위험도

NONE
