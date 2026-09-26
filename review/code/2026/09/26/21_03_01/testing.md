# 테스트(Testing) 리뷰 — `/integrations/:id/test` MCP 필드 선언 · 성공 경로 · 와이어 계약

## 발견사항

- **[INFO]** 와이어 스펙(`integrations.controller.wire.spec.ts`)이 MCP 성공/실패 경로만 다루고, 같은 엔드포인트의 non-MCP(예: `cafe24`/`http`/`database`) 성공 경로에서 새로 선언된 `capabilities`/`serverInfo`/`preview` optional 필드가 실제로 와이어에 실리지 않는지(누출되지 않는지)를 직접 확인하는 케이스가 없다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.wire.spec.ts` (파일 전체 — `describe('POST /integrations/:id/test — 와이어 계약 (HTTP)', ...)`)
  - 상세: `dispatchTest`(`integrations.service.ts` 1728행)의 fallback 분기(`transportTesters`에 없는 서비스 타입)는 `{ success: true, message: 'Connection successful' }` 리터럴만 반환하므로 코드 구조상 MCP 전용 키가 섞일 수 없다 — 그래서 실제 결함 위험은 낮다. 다만 이 PR 이 만든 계약 검증 도구(`assertMatchesContract`)가 "선언에 없는 키가 응답에 있는가"도 검증하는 도구라는 점을 감안하면, non-MCP 성공 경로에도 한 줄(`assertMatchesContract(res.body.data, await contractForDto(TestConnectionResultDto))`)을 추가해 두면 향후 fallback 분기가 확장될 때(예: 서비스별 메타 필드 추가) 같은 그물로 잡힌다.
  - 제안: 필수는 아님 — 이번 PR 스코프(MCP 필드 선언)를 넘는 보강이라 트래커에 한 줄 남기거나 생략 가능.

- **[INFO]** 와이어 테스트 (a)/(b)에서 `capabilities`/`serverInfo`의 **값**은 `Object.keys(...).sort()` 로 키 존재만 확인하고, 실제 내용(`{tools:{}, resources:{}}`, `{name:'filesystem-mcp', version:'1.2.0'}`)에 대한 `toStrictEqual` 단언은 없다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.wire.spec.ts:143-149` (키 전수 단언), `:150-154`(`preview`만 값 대조)
  - 상세: 의도적 설계로 보인다 — docblock(`:25-42`)이 이 describe 의 존재 이유를 "필드 **이름**이 실제 생산자와 맞는지" 로 명시했고, `capabilities`/`serverInfo` 의 값 충실도는 `mcp-test-connection.service.spec.ts`(`:53,58`)가 이미 정밀하게 커버한다. 따라서 갭이라기보다 계층 분리가 의도대로 동작한 것에 가깝다 — 기록 차원의 INFO.
  - 제안: 없음(현행 유지 권장). 다만 다음에 이 describe 를 확장할 사람이 "capabilities/serverInfo 값은 왜 여기서 안 보나"를 궁금해할 수 있으니 docblock 에 한 줄만 보태면 좋다.

- **[INFO]** `plan/in-progress/integration-test-contract.md` 의 뮤턴트 표(M1~M11)는 실제로 해당 서비스/와이어 spec 을 대상으로 뮤테이션-킬 검증을 수행했다고 기술하며, 코드 읽기로 대조한 결과(`assertMatchesContract`의 `required`/`nullable`/`undeclared` 판정 로직, `McpTestConnectionService.test`의 `toolCount`/`resourceSupported`/`promptSupported` 산출 로직)와 일관된다 — 특히 M3/M9("`additionalProperties` 제거"·"`preview` 를 열린 맵으로 약화"가 캐너리 전엔 SURVIVED)라는 주장은 `response-contract.ts` 의 `PropertyContract` 인터페이스(`:86-93`)가 애초에 `additionalProperties` 를 안 보는 것으로 실측 확인된다 — 근거가 있는 주장이다. 별도 지적 없음, 확인 완료로 기록.

## 강점 (요약에 반영)

- `integrations.controller.wire.spec.ts` 는 컨트롤러·서비스·`McpTestConnectionService`(실제 필드 이름의 생산자)까지 진짜로 두고 `McpClientService.connect`만 모킹 — "테스터까지 mock 하면 필드 이름 축에서 vacuous" 라는 자체 진단이 정확하고, 실제로 그 경계에서 모킹을 멈췄다.
- 성공/실패, `toolCount` 있음/없음 두 갈래를 나눠 `McpConnectionPreviewDto.toolCount` 의 optional 선언을 실제로 강제하는 케이스((b))를 만든 점이 좋다 — required 로 되돌리면 이 케이스가 즉시 RED.
- `integrations.service.spec.ts` 에 추가된 "[형제 대조] MCP 필드 셋의 선언이 `PreviewTestResultDto` 와 같다" 테스트는 값 대조만으로는 못 잡는 "선언 자체의 갈림"(열린 맵 vs 닫힌 DTO, required 여부)을 존재→스키마→required 3단으로 좁혀 잡는다. 뮤턴트 M3/M9 가 캐너리 이전엔 SURVIVED 였다는 실측을 남기고 그 자리를 이 테스트로 메운 인과관계가 plan 문서에 명확히 기록되어 있다.
- 각 spec 파일의 `beforeEach` 가 `integrationRepo`/`mcpTestConnection` 등 모킹 객체를 매번 새로 생성해(`integrations.service.spec.ts:123` 이하) 테스트 간 상태 누출이 없다. 와이어 스펙도 `connect.mockReset()`(`:127`)으로 매 테스트 격리를 지킨다.
- `DataSource`, `WorkspacesService` 등 `:id/test` 경로가 닿지 않는 의존성을 `{}` 로 스텁하면서 "이 경로가 닿지 않는 의존이다" 라고 명시적으로 주석을 남긴 점 — 실제로 `dataSource.transaction` 은 `rotate()`(1272행)에서만 쓰이고 `testConnection` 경로에서는 호출되지 않아 스텁이 안전하다는 것을 코드로 확인했다.
- `toStrictEqual` 을 값 대조에 일관되게 사용해(`toMatchObject`/`toEqual` 의 부분/느슨 매칭에서 오는 vacuous 위험을 회피) `preview`·실패 응답 전체를 정확히 고정했다.
- TEST WORKFLOW 단계에서 backend typecheck ratchet 이 잡은 `TS2352`(`as Integration` 캐스팅 문제)를 `Partial<Integration>` 으로 교정한 이력(`53e11963d`)이 plan 체크리스트에 실측과 함께 남아 있어, 타입 안전성 문제를 은폐하지 않고 정정한 것으로 확인된다.

## 요약

이번 변경은 DTO 필드 신설(`capabilities`·`serverInfo`·`preview`)과 그 필드들의 성공 경로 계약 검증 배선을 서비스 레벨·와이어(HTTP) 레벨 양쪽에 추가한다. 테스트 설계가 특히 눈에 띄는데, (1) 실제 뮤테이션 테스트를 10개+ 수행해 표로 남겼고 그중 2건(SURVIVED)을 발견해 형제 DTO 대조 캐너리로 실제로 메운 인과관계가 문서화되어 있으며, (2) mock 경계를 "값을 내가 적으면 그 이름 축에서 vacuous" 라는 원칙으로 의식적으로 설정해 실제 생산자(McpTestConnectionService)를 살려 둔 와이어 테스트를 만들었고, (3) 테스트 격리(매 `beforeEach` 재생성)·정밀 단언(`toStrictEqual`)이 일관된다. 발견된 갭은 전부 INFO 수준(non-MCP 성공 경로의 계약 검증 부재, capabilities/serverInfo 값의 wire-레벨 미검증)이며 둘 다 설계상 의도되었거나 구조적으로 위험이 낮다는 근거가 코드에서 확인된다. 코드 변경에 대응하는 테스트가 충실히 동반되었고 회귀 위험을 낮추는 구조다.

## 위험도

LOW
