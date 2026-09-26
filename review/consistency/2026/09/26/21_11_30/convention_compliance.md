# 정식 규약 준수 검토 — `spec/2-navigation/` (--impl-done, `integration-test-contract`)

## 검토 범위 메모

`spec/2-navigation/` 자체는 이번 PR 에서 델타 0 (정상 — 코드 전용 PR). 실제 구현 diff(4파일/346줄, `origin/main...HEAD`)는
`POST /api/integrations/:id/test` 의 MCP 성공 응답 필드(`capabilities`/`serverInfo`/`preview`)를 `TestConnectionResultDto`
에 뒤늦게 선언한 것으로, 대상 spec 문서는 `spec/2-navigation/4-integration.md §5.6·§9.1·§9.4` + `spec/5-system/11-mcp-client.md §9`
이고 관련 정식 규약은 `spec/conventions/swagger.md`(§1-4·§3·§5-4)다. 이 기준으로 코드·spec 양쪽을 대조했다.

## 발견사항

- **[WARNING] `INTEGRATION_TEST_FAILED` 의 상태 코드·발생 경로를 spec 두 문서가 다르게 적는다 (이미 등재된 기존 결함)**
  - target 위치: `spec/2-navigation/4-integration.md` §9.4 공통 응답 포맷 (`INTEGRATION_TEST_FAILED (422)` 행) vs
    `spec/5-system/11-mcp-client.md` §9 연결 테스트 (rotate 경로가 "`POST /api/integrations/:id/test` 후 갱신"에서
    400 `BadRequestException` 을 던진다고 서술)
  - 위반 규약: `spec/conventions/error-codes.md` (HTTP 상태 코드 선택의 SoT 는 `5-system/2-api-convention.md §6`이며
    본 규약 문서는 코드 명명·의미의 단일성을 전제) — 같은 코드에 대해 두 spec 문서가 서로 다른 실제 동작(422 vs 400)과
    서로 다른 발생 엔드포인트(`:id/test` vs `:id/rotate`)를 주장해 "정의(spec 본문)가 진실" 이라는 §1 원칙이 무너진다.
  - 상세: 실측(코드) 기준 `INTEGRATION_TEST_FAILED` 를 던지는 곳은 `integrations.service.ts` `rotate()` 단 한 곳(400)뿐이고,
    `:id/test`(`testConnection()`)는 이 코드를 던지지 않고 항상 200 + `{ success, code?, message }` 를 반환한다. 즉
    `4-integration.md §9.4` 의 "422" 표기와 `11-mcp-client.md §9` 의 "`:id/test` 후 갱신" 경로 서술이 모두 부정확하다.
    이 사안은 이번 PR 이전 `--impl-prep` 단계(`review/consistency/2026/09/26/20_32_24`)에서 convention_compliance ·
    cross_spec 두 checker 가 이미 WARNING 으로 짚었고, `plan/in-progress/spec-draft-nullable-notation-followups.md`
    (2026-09-26 planner 항목, 처분안까지 기록됨: §9.4 를 400·rotate 한정으로 정정 + mcp-client §9 의 경로를 `:id/rotate`
    로 정정)에 열린 항목(`[ ]`)으로 이미 등재돼 있다. 이번 PR 의 diff·plan(`spec_impact: none`)는 이 항목과 무관한
    별개 스코프(DTO 필드 선언)를 닫는 것이라 **이 PR 을 막을 사유는 아니다** — 재확인 차 다시 짚되 중복 등재는 하지 않는다.
  - 제안: 별도 planner 턴에서 `4-integration.md §9.4` 를 "400, `:id/rotate` 한정" 으로, `11-mcp-client.md §9` 의 경로
    설명을 `:id/rotate` 로 정정 (이미 트래커에 처분안이 있으므로 그대로 집행하면 됨). 이번 PR 범위에는 포함하지 않음.

- **[WARNING] MCP 열린 map 필드가 `spec/conventions/swagger.md §1-4` 의 명시 표기(`type: 'object'`)를 생략**
  - target 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
    `TestConnectionResultDto.capabilities` / `.serverInfo` (신규, 이번 diff) — 및 동일 파일의 사전 존재 형제
    `PreviewTestResultDto.capabilities` / `.serverInfo` (비변경, 패리티 대상)
  - 위반 규약: `spec/conventions/swagger.md` §1-4 "열린/동적 map" — "`@ApiProperty({ type: 'object', additionalProperties:
    true })`"
  - 상세: 신규 선언은 `@ApiProperty({ required: false, additionalProperties: true, description: '...' })` 로
    `type: 'object'` 를 적지 않는다. 같은 파일의 다른 열린 map 필드 `IntegrationActivityDto.summary`(line 465)와
    최상단 `IntegrationDto` 계열 필드(line 27)는 규약대로 `type: 'object'` 를 함께 적어 한 파일 안에서 표기가
    갈린다. 이번 PR 은 이 형태를 **의도적으로** 이미 존재하는 형제 `PreviewTestResultDto` 와 글자 그대로 동일하게
    맞췄고(뮤턴트 대조 테스트로 고정) — 그 판단 자체(와이어 패리티 우선)는 합리적이라 CRITICAL 로 보지 않는다.
    다만 두 DTO 모두 규약 문면과는 어긋난 상태로 남는다. `@nestjs/swagger` CLI 플러그인이 TS 타입에서 `type: 'object'`
    를 추론할 가능성이 높아 실제 OpenAPI 산출물에는 기능적 영향이 없을 것으로 보이나(미검증), 이는 가드가 강제하지
    않는 순수 문서 규율이라 이 검토가 아니면 걸러지지 않는다.
  - 제안: 다음에 이 두 DTO를 건드릴 때 `capabilities`/`serverInfo` 양쪽에 `type: 'object'` 를 추가해 규약 문면과
    파일 내부 일관성을 맞춘다. 지금 당장 고치면 형제 패리티 테스트(§ "형제 대조" it) 통과를 위해 두 DTO를 동시에
    고쳐야 하므로, 이번 PR 스코프 확장보다는 후속 처리로 미뤄도 무방하다.

- **[INFO] 같은 두 필드의 `@ApiProperty.description` 이 영어 — §3 "한국어 톤" 과 어긋남**
  - target 위치: 위와 동일한 `capabilities`/`serverInfo` 필드의 `description: 'MCP capabilities (mcp service_type
    only)'` / `'MCP server identity (mcp service_type only)'`
  - 위반 규약: `spec/conventions/swagger.md` §3 "주석/설명 톤 — 한국어, 간결"
  - 상세: 바로 위 JSDoc(`/** MCP service_type 한정 — 성공 시 서버가 보고한 capabilities 객체 그대로. ... */`)은
    한국어인데 `@ApiProperty` 의 `description` 만 영어다. OpenAPI 소비자가 실제로 읽는 문장(§3 이 명시하는 대상)이
    영어와 한국어로 갈린다. 이 또한 사전 존재 형제 `PreviewTestResultDto` 를 그대로 미러링한 결과라 이번 PR 이 새로
    만든 편차는 아니다.
  - 제안: 사소하므로 즉시 조치는 불필요. 다음에 이 DTO를 건드릴 때 한국어 설명으로 통일 검토.

- **[INFO] `POST /integrations/:id/test` 의 `@ApiOperation` 길이가 §3 "강제" 하한 미달 (PR 이 만든 문제는 아님)**
  - target 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` `testConnection()` —
    `@ApiOperation({ summary: '통합 연결 테스트', description: '저장된 자격 증명을 사용해 실제 외부 서비스에 테스트
    호출을 수행합니다.' })`
  - 위반 규약: `spec/conventions/swagger.md` §3 길이 표 — 엔드포인트 `summary` 10~20자 **강제**, `description`
    50~150자 **강제**
  - 상세: 실측 `summary` 9자, `description` 40자로 둘 다 명시 하한 미달. 이번 diff 는 같은 데코레이터 그룹 안의
    `@ApiOkWrappedResponse` `description` 한 줄만 고쳤고 `@ApiOperation` 은 손대지 않았다. 저장소 전수 확인 결과
    `IntegrationsController` 17개 엔드포인트 중 13개의 `summary` 가 10자 미만(예: "통합 생성" 5자, "통합 삭제" 5자)이라
    **이 컨트롤러 전반의 기존 패턴**이며 이번 PR 이 새로 만든 위반이 아니다. 이 길이 규칙을 강제하는 자동 가드도
    없다(swagger-dto-contract 계열 어디에도 summary/description 길이 검사가 없음, 실측). §3 의 이웃 규칙(JSDoc
    내부서사분리)에는 "기존 DTO는 소급 정리 대상이 아니다" 라는 명시적 유예 문구가 있지만 길이 표에는 그런 유예
    문구가 없어, 규약 문서 자체가 "강제" 라 적어놓고 사실상 전 저장소가 이를 어기는 상태로 방치돼 있다.
  - 제안: (a) 코드 스윕 대신 규약 문서에 길이 규칙도 JSDoc 규칙과 동일한 "기존 것은 소급 정리 대상 아님, 다음에
    건드릴 때 맞춘다" 유예 문구를 명시하거나, (b) 정말 강제하고 싶다면 `swagger-dto-contract` 계열에 summary/description
    길이 가드를 신설한다. 이번 PR 범위에서 고칠 필요는 없음.

## 요약

이번 PR 의 실제 코드 변경(`TestConnectionResultDto` 에 MCP 성공 응답 필드 3종 추가 + wire 계약 테스트 신설)은
`spec/2-navigation/4-integration.md §5.6`·`spec/5-system/11-mcp-client.md §9` 가 이미 문서화해 둔 wire 포맷(`capabilities`/
`serverInfo`/`preview.{toolCount,resourceSupported,promptSupported}`)과 정확히 일치하고, `spec/conventions/swagger.md`
의 응답 DTO 규약(§5-1 이름 유일성·§5-4 체크리스트·§3 내부서사/JSDoc 분리)도 충족한다. 발견된 항목은 모두 (1) 이미
`--impl-prep` 단계에서 짚혀 트래커에 등재된 별도 스코프의 spec 자기모순(§9.4 vs mcp-client §9), 또는 (2) 이번 PR 이
"형제 DTO 와 글자 그대로 동일하게" 라는 명시적·검증된 설계 선택으로 그대로 미러링한 기존 코드의 사소한 표기 편차
(`type: 'object'` 생략, 영어 description, 컨트롤러 요약 길이 미달)로, 어느 것도 이번 PR 의 신규 위반이 아니며 병합을
막을 사유가 없다.

## 위험도

LOW
