# 정식 규약 준수 검토 — spec/5-system/11-mcp-client.md

## 발견사항

- **[INFO] `## Rationale` 섹션 부재**
  - target 위치: 문서 전체 (마지막 섹션이 `## 12. 확장 포인트`로 종료, `## Rationale` 없음)
  - 위반 규약: `CLAUDE.md` "정보 저장 위치" 표 — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" 및 각 SKILL.md 의 Overview/본문/Rationale 3섹션 권장
  - 상세: 본 문서는 §2.2(stdio 미지원 사유), §3.2(production fail-closed 강제 근거), §8.4(자동 status 전환 정책의 근거) 등 실질적으로 설계 결정의 배경을 여러 곳의 인라인 `>` 인용구로 흩어 서술하고 있으나, 별도 `## Rationale` 섹션으로 집약하지 않았다. 이는 3섹션 구성을 "권장"하는 수준이라 CRITICAL 은 아니며, 다른 conventions 문서(`node-output.md`, `error-codes.md`, `secret-store.md`)들이 예외 없이 `## Rationale` 을 갖는 것과 대비된다.
  - 제안: 문서 말미에 `## Rationale` 섹션을 신설해 (a) 왜 stdio 를 MVP 에서 배제했는지(§2.2 는 이미 근거 나열형이라 그대로 승격 가능), (b) 왜 Internal Bridge 패턴을 신설했는지(§2.3), (c) 왜 외부 MCP 인증 실패에 자동 복구를 두지 않는지(§8.4) 를 모아 재서술. 급하지 않은 문서 정리성 개선이며, 이번 --impl-prep 검토를 차단할 사유는 아니다.

- **[INFO] `mcpDiagnostics.errors[].code` 코드 granularity 계획과 §8.2 vocabulary 표기 정합**
  - target 위치: §6.2 (`mcpDiagnostics` 예시 JSON, "미구현 (Planned)" 서술) 및 §8.2 에러 코드 표
  - 위반 규약: 해당 사항 없음 (직접적 위반 아님) — 다만 `error-codes.md` §1 "의미 기반 명명" 원칙과의 교차 확인 결과 특기할 이슈 없음. 코드 SoT(`mcp-error-codes.ts`)와 문서의 vocabulary(`MCP_CONNECT_FAILED`/`MCP_LIST_FAILED`/`MCP_CALL_FAILED`/`MCP_TOOL_ERROR`/`MCP_TIMEOUT`/`MCP_AUTH_FAILED`/`MCP_HTTPS_REQUIRED`/`MCP_UNKNOWN_TOOL`/`MCP_RESPONSE_TOO_LARGE`/`INVALID_TOOL_ARGUMENTS`) 는 `UPPER_SNAKE_CASE` 표기(`node-output.md §3.2`)를 정확히 준수하며 코드와 완전히 1:1 대응함을 확인했다 (`codebase/backend/src/modules/mcp/mcp-error-codes.ts` 실제 상수와 대조 완료).
  - 상세: 이 항목은 위반이 아니라 "이미 잘 지켜지고 있음"의 확인 기록으로, 별도 조치 불필요.
  - 제안: 조치 불필요 (참고용 기록).

## 검토 결과 상세 (규약 항목별 확인)

1. **명명 규약**
   - `mcp_<sid>__<toolName>` (§5.2), `<sid>` 파생 규칙, `__` 구분자 근거 서술 모두 명확하고 일관. `node-output.md` §6 "시스템 포트 예약어"(`out`/`error`/`default` 등)는 포트 ID 네임스페이스이고 본 문서의 `mcp_` prefix 는 LLM tool-name 네임스페이스라 레이어가 달라 충돌 없음 — 정합.
   - `skipReason` 값(`lower_snake_case`)과 `error.code`(`UPPER_SNAKE_CASE`) 를 의도적으로 분리한다는 §6.2 인용문("명명 규칙 분리")은 `node-output.md §3.2` 규약을 정확히 인지하고 자기 문서 내에서 명시적으로 구분한 모범 사례 — 위반 없음.
   - Integration `service_type` 값(`mcp`/`cafe24`/`makeshop`, §3.1, §11)은 소문자 식별자로 기존 `Integration.service_type` 컬럼 관례와 일치.

2. **출력 포맷 규약** (`node-output.md`)
   - 본 spec 은 AI Agent 노드의 `meta.mcpDiagnostics`(§6.2) 서브필드로, `node-output.md` Principle 2 (`meta`는 실행 메트릭만)의 틀 안에 있다. `mcpDiagnostics` 자체가 `meta.*` 하위이므로 Principle 2 위반 없음.
   - §8 에러 vocabulary → `tool_result.error` / `mcpDiagnostics.errors[].code` 사용은 `node-output.md` Principle 3.2 (`output.error` 표준 형태: `code`/`message`/`details`, `UPPER_SNAKE_CASE`) 의 취지와 합치. 단, MCP tool 호출은 `NodeHandlerOutput.output.error` 표준 그 자체가 아니라 tool_result 내부 형식이라 계층이 다름을 §8.2 서두에서 명확히 하고 있어 혼선 없음.
   - `IntegrationUsageLog` 사용(§8.3)은 `2-navigation/4-integration.md §14` 패턴을 그대로 참조·재사용한다고 명시 — SoT 위임이 정확.
   - §9 연결 테스트 응답 포맷(`{ capabilities, serverInfo, preview }` 및 실패 시 `{ success: false, code, message }` HTTP 200)과 저장된 Integration rotate 경로의 `INTEGRATION_TEST_FAILED`(400, `BadRequestException`) 구분은 실제 코드(`integrations.service.ts:1097-1100`)와 정확히 일치 — 위반 없음.

3. **문서 구조 규약**
   - Frontmatter(`id: mcp-client`, `status: partial`, `code:`, `pending_plans:`)는 `spec-impl-evidence.md` §2.1 스키마를 정확히 충족. `pending_plans` 경로(`plan/in-progress/spec-sync-mcp-client-gaps.md`) 실존 확인 완료.
   - `## 1. 개요`가 Overview 역할을 수행하나 명시적 `## Overview` 헤더는 아님 — 이는 기존 `5-system/*.md` 다수 문서의 관용적 패턴("## 1. 개요")과 일치하므로 프로젝트 관행상 이슈 아님.
   - `## Rationale` 섹션 부재는 위 INFO 항목 참고.

4. **API 문서 규약** (swagger/DTO)
   - 본 문서는 API 엔드포인트의 데코레이터·DTO 명명 자체를 다루지 않는다 (그 책임은 `2-navigation/4-integration.md` 및 실제 컨트롤러가 짐). 해당 축은 본 문서 범위 밖이라 위반 여지 없음.

5. **금지 항목**
   - `secret-store.md` 의 `secret://` scheme 미사용은 §1 "비대상" 조항(`AuthConfig.config`) 대상은 아니지만, Integration credentials 자체가 이미 `Integration §5.6` 의 AES-256-GCM 정책(별도 SoT)으로 암호화되므로 secret-store 를 우회한 것이 아니라 애초에 다른 정식 경로. 위반 아님.
   - `MCP_ALLOW_INSECURE_URL` / production fail-closed 패턴(§3.2)은 `secret-store.md` R5, `1-auth.md §Rationale`의 "Production fail-closed 가드" 패밀리와 정확히 동형 — 규약이 요구하는 cross-cutting 일관성을 잘 따르고 있음.

## 요약

`spec/5-system/11-mcp-client.md` 는 명명 규약(`mcp_` prefix, `skipReason` vs `error.code` 표기 분리), 출력 포맷 규약(`node-output.md` Principle 2/3.2, IntegrationUsageLog 패턴), frontmatter(`spec-impl-evidence.md`) 등 조사한 모든 정식 규약 축에서 실제 코드(`mcp-error-codes.ts`, `integrations.service.ts`)와 정합했으며 CRITICAL/WARNING 급 위반은 발견되지 않았다. 유일한 지적 사항은 문서 말미 `## Rationale` 섹션의 부재로, 다른 conventions/spec 문서들의 관행과 비교하면 아쉬운 점이나 CLAUDE.md 상 "권장" 수준이라 --impl-prep 검토를 차단할 사유는 아니다. 전반적으로 정식 규약 준수도가 높은 문서.

## 위험도
LOW
