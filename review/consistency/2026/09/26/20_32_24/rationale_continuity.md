# Rationale 연속성 검토 — `spec/2-navigation/` (impl-prep: `integration-test-contract`)

## 검토 범위 확인

`--impl-prep` 대상은 `plan/in-progress/integration-test-contract.md` — `POST /api/integrations/:id/test` 응답 DTO(`TestConnectionResultDto`)에
MCP 전용 필드 3종(`capabilities`·`serverInfo`·`preview`)을 선언하고, 서비스 축 계약 검증(`assertMatchesContract`) + 와이어 축(supertest) 테스트를
추가하는 순수 **`codebase/backend/**` 변경**이다(`spec_impact: none`). 번들에 포함된 `spec/2-navigation/4-integration.md` §5.6 「테스트」·§9.1,
`spec/5-system/11-mcp-client.md` §9, `spec/conventions/swagger.md` §1-4·§5-4, `spec/5-system/2-api-convention.md` §5.4 를 직접 Read 해
plan 의 실측·인용과 대조했다.

## 발견사항

### INFO — `serverInfo` 의 TS 타입이 "열린 맵" 선언과 불일치 (기존 DTO 에서 이미 존재, 이번 plan 이 그대로 복제 예정)
- target 위치: plan §방향-1 「선언은 `PreviewTestResultDto` 와 **같게** 한다」
- 과거 결정 출처: `spec/conventions/swagger.md` §1-4 「열린/동적 map — 실제로 키가 열려 있는 경우에 한한다」· 「'타입을 특정하기 번거롭다'는 사유로 쓰지 않는다」
- 상세: 현재 `PreviewTestResultDto.serverInfo`(`integration-response.dto.ts:271-277`)는 `@ApiProperty({ additionalProperties: true })`로 "열린 맵"을 선언하면서 TS 타입은 `{ name: string; version: string }`로 **닫힌 2필드 shape**다. §1-4 가 요구하는 "실제로 키가 열려 있는" 근거(SDK가 `name`/`version` 밖의 키를 실을 수 있다)는 plan §방향-1 이 명시하지만, 그 근거가 맞다면 TS 타입도 `Record<string, unknown>`이거나 최소 `{ name: string; version: string; [k: string]: unknown }`이어야 §1-4 의 "닫힌 union을 additionalProperties 로 뭉개지 않는다"는 취지와 "선언이 wire 를 반영해야 한다"(§5.4)는 요구 양쪽에 부합한다. 이 불일치는 이번 plan 이 새로 만드는 것이 아니라 형제 DTO 에서 그대로 가져오는 것이므로 **재도입/번복은 아니지만**, "선언은 PreviewTestResultDto 와 같게 한다"는 결정이 이 기존 nit 도 함께 복제한다는 점은 인지해 둘 가치가 있다.
- 제안: 이번 PR 스코프를 넘는 문제이므로 차단 사유는 아니다. 다만 DTO 를 만지는 김에 `serverInfo` 타입을 `Record<string, unknown>`(또는 `{ name?: string; version?: string; [k: string]: unknown }`)으로 넓혀 선언·타입 일치를 맞추거나, 그럴 계획이 없다면 트래커에 별도 한 줄로 남겨 두는 것을 권장. 없어도 이번 PR 을 막을 사유는 아니다(INFO).

## 대조 결과 — 위반 없음을 확인한 항목

- **기각된 대안의 재도입 없음**: `git log -S "capabilities?"` 로 `TestConnectionResultDto` 이력을 확인한 결과 이 필드들이 과거에 선언됐다가 의도적으로 제거된 이력은 없다 — 생산자(`testMcpTransport`)는 처음부터 이 값을 반환했고 DTO 선언만 누락돼 있던 순수 gap 이다(플랜 §실측이 이를 실측·인용). "한때 있었다가 기각된 필드를 되살리는" 패턴이 아니다.
- **합의된 설계 원칙 준수**: `spec/conventions/swagger.md` §1-4 의 "열린 map은 키가 실제로 런타임 결정될 때만" 원칙에 대해, `capabilities`/`serverInfo`를 열린 맵으로, `preview`를 닫힌 `McpConnectionPreviewDto`로 선언하는 plan 의 선택은 이미 병존하는 형제 `PreviewTestResultDto` 선언과 **동형**이며, MCP SDK 응답이 `name`/`version` 밖의 키를 가질 수 있다는 근거도 §1-4 의 "번거로움" 예외 사유가 아니라 "실제로 열려 있다"는 주 사유에 해당한다.
- **spec 과의 일치**: `spec/2-navigation/4-integration.md` §5.6 「테스트」(MCP Server)와 `spec/5-system/11-mcp-client.md` §9 「연결 테스트」 모두 성공 응답에 `{ capabilities, serverInfo, preview: { toolCount, resourceSupported, promptSupported } }`을 이미 명문화하고 있다. plan 은 이 문서화된 계약에 코드를 맞추는 것이므로 spec 변경도, 과거 결정의 번복도 아니다(`spec_impact: none`이 정확).
- **`null` vs 키 생략 규약 준수**: `spec/5-system/2-api-convention.md` §5.4 는 "MCP 전용 필드는 다른 service_type 에서는 생략된다"는 present-when-available 패턴에 대해 `@ApiPropertyOptional()` + `field?: T`(`| null` 금지) 형태를 요구한다. plan 이 그대로 가져오는 `PreviewTestResultDto` 패턴(`@ApiProperty({ required: false, ... })`, `| null` 미사용)은 이 규약과 부합한다.
- **트래커 합의와 정합**: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 두 항목(3434행 근처 「MCP 전용 응답 필드 3종」, 3603행 근처 「HTTP 와이어-레벨 계약 검증」)이 이 plan 이 닫으려는 대상과 정확히 일치하며, 선례로 인용하는 `#1330`(자매 `/api/model-configs/:id/test`)의 패턴(서비스 축 계약 검증 + 와이어 supertest)과도 구조적으로 동일하다 — 새 원칙을 발명하지 않고 이미 확립된 선례를 적용한다.
- **무근거 번복 없음**: DTO의 `code?: string` 관련 기존 주석(«같은 인터페이스의 MCP 전용 필드도 미선언이지만 … 별도 등재»)을 plan 이 정확히 참조하며 그 예고를 이번 PR로 이행 — 예고했던 후속 작업의 정상 집행이지 임의 번복이 아니다.

## 요약

`integration-test-contract` plan 은 `spec/2-navigation/4-integration.md` §5.6·§9.1 및 `spec/5-system/11-mcp-client.md` §9 가 이미 문서화한 MCP 테스트 응답 계약(`capabilities`·`serverInfo`·`preview`)에 DTO·계약 검증·와이어 테스트를 사후 정합시키는 순수 gap-closure 작업이며, `spec/conventions/swagger.md`(§1-4 열린/닫힌 선언 기준, §5.4 부재 표현 규약)와 형제 엔드포인트(`#1330` `/api/model-configs/:id/test`) 선례를 그대로 따른다. 과거 Rationale에서 명시적으로 기각된 대안을 재도입하거나, 합의된 설계 원칙을 우회하거나, 근거 없이 결정을 번복하는 지점은 발견되지 않았다. 유일한 관찰(INFO)은 `serverInfo`의 OpenAPI "열린 맵" 선언과 TS 타입 "닫힌 2필드" shape 간의 기존 불일치를 이번 plan이 그대로 복제한다는 점이며, 이는 이번 PR이 새로 만드는 문제가 아니고 차단 사유도 아니다.

## 위험도

NONE
