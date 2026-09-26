# Plan 정합성 검토 — `plan/in-progress/integration-test-contract.md` (impl-prep, scope=spec/2-navigation/)

## 발견사항

없음. CRITICAL/WARNING/INFO 등급의 발견사항이 없다.

### 확인한 근거 (충돌 없음을 뒷받침)

- **트래커 항목과의 일치**: target plan(`integration-test-contract.md`)이 닫으려는 두 항목 —
  「MCP 전용 응답 필드 3종 미선언」(`spec-draft-nullable-notation-followups.md:3434` 근처)과
  「HTTP 와이어-레벨 계약 검증 부재」(같은 파일 `:3603` 근처) — 은 실제로 그 트래커에 존재하며,
  둘 다 owner `developer` 로 등재돼 있고 "결정 필요(planner)" 표식이 없다. target plan 의 실측·방향
  문단이 두 항목의 원문 서술(생산자 필드·DTO 미선언·`#1330` 배경)과 정확히 대응한다 — 일방적 결정
  덮어쓰기가 아니라 이미 위임된 항목의 집행이다.
- **`spec_impact: none` 검증**: `spec/2-navigation/4-integration.md` §5.6(«테스트» 문단, 559행 근처)과
  `spec/5-system/11-mcp-client.md` §9(517행 근처)를 직접 열어 확인한 결과, 성공 응답 `{ capabilities,
  serverInfo, preview: { toolCount, resourceSupported, promptSupported } }` 는 **이미 spec 이 문서화**하고
  있다. DTO 쪽이 낡은 상태였다는 target plan 의 주장과 일치 — spec 변경 없이 DTO 를 spec 에 맞추는
  방향이며 미해결 spec 결정을 우회하지 않는다.
- **코드 자체의 교차 참조**: `integration-response.dto.ts:484-485` 의 기존 주석이 이미 이 작업을
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 로 명시 지목하고 있다 — 두 문서가
  서로를 가리키는 상태로, 문서 간 드리프트가 없다.
- **설계 근거(열린 맵)와 기존 규약의 정합**: target plan 은 `serverInfo` 를 닫힌 DTO 대신 열린 맵으로
  선언하겠다고 하는데, 이는 `spec/conventions/swagger.md` §1-4 Rationale("열림은 키 집합이 런타임에
  결정된다는 사실 진술")과 일치하며 같은 파일의 형제 `PreviewTestResultDto.serverInfo` 도 이미 동일하게
  `additionalProperties: true` 로 선언돼 있다(코드 확인 완료). 새로운 정책 결정이 아니라 기존 선례를
  따르는 것이다.
- **다른 in-progress plan 과의 충돌 없음**: `plan/in-progress/` 전체에서 `integrations.service.ts` ·
  `integrations.controller.ts` · `integration-response.dto.ts` 를 언급하는 plan 은 target 자신과
  `spec-draft-nullable-notation-followups.md`(트래커 원본) · `cafe24-backlog-residual.md` 뿐이다.
  `cafe24-backlog-residual.md` 의 해당 항목(C-6, `buildIntegrationMeta` 레지스트리)은 이미 `[x]` 로
  해소됐고 target 이 건드리는 `testMcpTransport`/`TestConnectionResultDto` 와 다른 함수·다른 축이라
  겹치지 않는다. `integration-personal-owner-followup.md`(같은 spec 파일 §8 관련 후속)도 인가·소유권
  축이라 응답 필드 계약 축과 무관하다.
- **선행 조건 없음**: target 이 계획한 `integrations.controller.wire.spec.ts` 신설은 자매 패턴
  (`llm-model-config.controller.spec.ts`)을 그대로 따르며, 별도로 진행 중인 `nestjs-v12-coordinated-upgrade.md`
  (착수 후 되돌려져 코드 변경 0건, 상류 대기 중)는 TestingModule API 자체를 바꾸지 않으므로 이 wire
  테스트 작성에 전제 조건을 걸지 않는다.

## 요약

Target plan(`plan/in-progress/integration-test-contract.md`)은 `plan/in-progress/spec-draft-nullable-notation-followups.md`
트래커의 두 기존 항목(둘 다 owner=developer, 미결 "결정 필요" 표식 없음)을 문구·배경까지 정확히 인용해
집행하는 문서이며, 대상 스펙(`spec/2-navigation/4-integration.md` §5.6, `spec/5-system/11-mcp-client.md` §9)이
이미 해당 필드를 문서화하고 있어 `spec_impact: none` 주장도 실측과 일치한다. 설계 선택(serverInfo 열린 맵)은
기존 swagger 규약 및 형제 DTO 선례와 합치하고, 다른 in-progress plan 과 파일·범위 충돌도 없다. Plan 정합성
관점에서 구현 착수를 막을 사유가 없다.

## 위험도
NONE
