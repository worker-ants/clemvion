# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** 이 PR 이 고친 "선언에 없는데 실제로 실리는 필드" 결함과 **동일한 클래스**가 형제 엔드포인트 `POST /api/integrations/preview-test` 에 그대로 남아 있다 — `code` 필드.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` — `class PreviewTestResultDto`(diff 밖 기존 코드, `success`/`message`/`capabilities?`/`serverInfo?`/`preview?` 만 선언, `code` 없음). 생산 쪽: `codebase/backend/src/modules/integrations/integrations.service.ts` — `private async dispatchTest(...)`(email/mcp 로 분기) → `private async testEmailTransport(...)`(`code: 'EMAIL_HOST_BLOCKED'`, `code: 'EMAIL_CONNECT_FAILED'`) / `private async testMcpTransport(...)`(`code: result.code ?? 'MCP_CONNECT_FAILED'`).
  - 상세: 이 PR 은 `TestConnectionResultDto`(`POST /api/integrations/:id/test`)에 `code?: string` 을 추가하면서 근거를 "`integrations.service.ts` 4곳 + 그 서비스가 호출하는 MCP 테스터 6곳에서 `success:false` 와 같은 객체에 `code` 를 싣고 있었다"고 적었다. 그런데 `code` 를 실제로 만드는 함수 `dispatchTest`/`testEmailTransport`/`testMcpTransport` 는 `testConnection()`(930행대) 뿐 아니라 **`previewTest()`(969행)에서도 그대로 호출된다** — 같은 코드 경로, 같은 반환 타입(`IntegrationTestResult`)이다. `spec/2-navigation/4-integration.md` §9.1(810행)·§5.5(1178행: "preview-test / `:id/test` / rotate 세 경로 모두 email 에서는 실제 `verify()` 를 수행한다")·§(1095행: `EMAIL_CONNECT_FAILED` 는 "연결 테스트 전용 — `IntegrationTestResult.code` namespace")도 preview-test 가 이 코드들을 낼 수 있다는 것을 이미 전제하고 있다. 즉 `POST /api/integrations/preview-test` 응답도 실패 시 `code` 를 실을 수 있는데, 그 DTO(`PreviewTestResultDto`)는 이 PR 이 고친 자매 DTO 와 달리 여전히 `code` 를 선언하지 않는다. 정적 `swagger-dto-contract-guard` 는 "DTO 데코레이터 vs 그 DTO 자신의 TS 필드 타입" 만 비교하는 **DTO 내부 자기정합성 검사**라(`swagger-dto-contract-guard.ts` 상단 주석 — `ContractMismatch` 는 `presence`/`null` 축만 다룬다) 이 결손을 원리적으로 못 잡는다. 이 PR 이 배선한 `assertMatchesContract`(값 vs 선언) 도 `integrations.service.spec.ts`·`llm.service.spec.ts`·`llm-model-config.controller.spec.ts` 세 곳에만 걸렸고 `previewTest()` 경로에는 걸리지 않았다. 결과적으로 이 PR 이 "형제에도 같은 점검을 돌렸다"고 주장하는 감사가 실제로는 `dispatchTest` 를 공유하는 세 번째 소비자(`previewTest`)를 놓쳤다.
  - 제안: `PreviewTestResultDto` 에도 `code?: string`(같은 JSDoc — `EMAIL_HOST_BLOCKED`·`EMAIL_CONNECT_FAILED`·`MCP_*`)을 추가하고, `integrations.service.spec.ts` 의 `previewTest()` 실패 케이스(email/mcp)에 `assertMatchesContract(result, await contractForDto(PreviewTestResultDto))` 를 배선한다. 이번 PR 범위 밖이면 최소한 `plan/in-progress/spec-draft-nullable-notation-followups.md` 같은 트래커에 등재해 다음 사람이 "이미 감사했다"고 오판하지 않게 한다.

- **[INFO]** `POST /api/model-configs/:id/test` 응답 필드 `error` → `message` 리네임은 breaking change 인데 API 버전 관리 체계가 없다.
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts` — `async testConnection(...)` 반환 타입 및 `catch` 블록.
  - 상세: 이 저장소는 애초에 엔드포인트 버저닝(`/v1/` 등) 관례가 없고, 이번 변경은 CHANGELOG 에 "Behavior change" 로 명시 고지 + 저장소 내 소비처 전수 확인(`저장소 안 소비처는 없었다`)으로 대응했다(실측: `model-config-manager.tsx` 는 이미 `result.message` 를 읽고 있어 리네임과 정합). Bearer 인증 + 워크스페이스 스코프의 내부용 API 라 외부 파트너 계약 문서가 없다는 전제하에서는 이 처리가 적절하다. 다만 이 프로젝트에 API 버전 정책 자체가 없다는 사실은 구조적 리스크로 남는다 — 이번 건은 잘 처리됐지만 일반 원칙(버전 관리)의 부재를 상쇄하지는 않는다.
  - 제안: 별도 조치 불요(이번 PR 한정). 외부 공개 API 화 계획이 생기면 버전 정책을 spec 에 명문화할 것.

- **[INFO]** 신규 `code?: string` (`TestConnectionResultDto`) 가 OpenAPI 스키마 상 자유 문자열로만 선언돼 있어 클라이언트 codegen 이 값 집합을 알 수 없다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:477` (게이트 확인: diff 상 `code?: string;` 줄).
  - 상세: JSDoc 주석은 `MCP_*`·`EMAIL_CONNECT_FAILED`·`INTEGRATION_INCOMPLETE` 등을 산문으로 나열하지만 `@ApiPropertyOptional()` 데코레이터에는 `enum`/`example` 옵션이 없어 생성된 OpenAPI 문서·타입에는 반영되지 않는다. 기능 결함은 아니고 문서 정밀도 문제다.
  - 제안: 가능하면 `@ApiPropertyOptional({ example: 'INTEGRATION_INCOMPLETE' })` 정도라도 추가. 값 집합이 여러 계층(email/mcp/backstop)에서 동적으로 합쳐져 닫힌 enum 을 만들기 어렵다면 현행 유지도 수용 가능.

- **[INFO]** 프런트엔드 `integrationsApi.test`/`previewTest` 의 TS 반환 타입은 여전히 `{ success: boolean; message: string }` 뿐이라, 백엔드가 이번에 정식 선언한 `code`(및 기존에 선언돼 있던 `capabilities`/`serverInfo`/`preview`)를 타입 레벨에서 못 받는다.
  - 위치: `codebase/frontend/src/lib/api/integrations.ts` — `async test(id: string)`, `async previewTest(body: ...)` (이번 PR 의 diff 대상 파일 아님, 기존 상태).
  - 상세: 이 PR 범위는 아니고 회귀도 아니다(`code` 는 이 PR 이전부터 와이어에 실리고 있었다 — DTO 선언만 없었을 뿐). 다만 백엔드 DTO 가 이제 `code` 를 계약으로 명시했으니 소비 계층 타입도 맞추는 편이 API 계약의 실질적 일관성에 부합한다.
  - 제안: 이번 PR 범위 밖이므로 후속 항목으로만 기록 권고.

## 요약

이 PR 은 `POST /api/model-configs/:id/test` 와 `POST /api/integrations/:id/test` 두 엔드포인트에서 "서비스가 실제로 내는 필드"와 "DTO 가 선언한 필드"의 3중 불일치(반대 방향 둘 다)를 실측 기반으로 바로잡고, 그 결함 클래스를 재발 방지하는 런타임 계약 검사(`assertMatchesContract`)를 두 서비스 스펙과 신규 HTTP 와이어 레벨 스펙에 배선했다 — 회귀 방지 근거(뮤테이션 표)까지 갖춘 견고한 수정이다. HTTP 상태 코드·인증/인가(`@Roles('editor')`, `@ApiBearerAuth`)·URL 설계는 변경되지 않았고, `error`→`message` 리네임은 저장소 내 유일한 소비처가 이미 새 이름을 읽고 있어 실질적인 하위 호환성 파손은 없다. 다만 이 PR 이 스스로 세운 "형제 DTO 감사" 기준을 한 걸음 더 밀어붙이면, `dispatchTest`/`testEmailTransport`/`testMcpTransport` 를 공유하는 세 번째 소비자 `previewTest()`(`PreviewTestResultDto`)가 정확히 같은 "생산자 있음·선언 없음" 결함을 아직 안고 있다는 것이 드러난다 — spec 문서(§9.1, §5.5)조차 preview-test 의 email 실패 시 `code` 발행을 이미 전제하고 있다. 이는 이번 PR이 새로 만든 결함은 아니지만, "형제까지 다 봤다"는 이 PR의 서술 범위를 넘어서는 미해결 잔여 항목이다.

## 위험도

LOW
