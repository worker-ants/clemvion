# 정식 규약 준수 검토 — spec/5-system/11-mcp-client.md

## 발견사항

- **[WARNING] 문서 구조 규약 — `## Rationale` 섹션 부재**
  - target 위치: 문서 전체 (§1~§12, `## Overview` 도 `## Rationale` 도 없음). 특히 §6.2(`mcpDiagnostics` 구조화 승격), §8.2(`errors[]` build/call-phase 분리), §3.2(SSRF escape hatch throw vs warn 분류) 등 명백히 "결정의 배경·기각 대안"을 담을 만한 지점들이 본문 인라인 각주(`>` blockquote)로만 처리되어 있다.
  - 위반 규약: CLAUDE.md "정보 저장 위치" 표 — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`". 동일 디렉토리의 `10-graph-rag.md`, `12-webhook.md`, `1-auth.md` 등은 `## Overview` / `## Rationale` 3섹션 구성을 실제로 따르고 있어 `11-mcp-client.md`만 이 컨벤션에서 벗어나 있다.
  - 상세: 예컨대 §3.2의 "Production fail-closed 강제 (refactor 04 M-7)" 단락은 `ALLOW_PRIVATE_HOST_TARGETS`와 `MCP_ALLOW_INSECURE_URL`을 throw/warn으로 분류한 근거를 본문에 바로 서술하는데, 이는 전형적인 Rationale 내용이다. §6.2의 "타입 확장 cluster" 결정(build-phase만 우선 처리, call-phase는 별도 follow-up)도 마찬가지로 기각된 대안·범위 경계 근거이며 본문에 산재해 있다.
  - 제안: 신규 spec 작성이 아니라 기존 문서 개정이므로 강제 리라이트보다는, 다음 project-planner 작업 시 §1을 `## Overview`로 승격하고 문서 끝에 `## Rationale` 섹션을 신설해 위 산재된 배경 서술(§2.2 stdio 미지원 사유, §3.2 fail-closed 분류, §6.2 cluster 분할 근거, §8.4 auto-recovery 미도입 근거)을 이관하는 것을 권장. 이미 `plan/in-progress/spec-sync-mcp-client-gaps.md`의 "완료 요약"에 `task_947e443e`(Rationale 섹션·코드 prefix)로 follow-up 등재되어 있어 인지된 채무 — 신규 발견이 아니라 기존 채무의 재확인.

- **[INFO] 에러 코드 명명 규약 — `INVALID_TOOL_ARGUMENTS`에 `MCP_` prefix 없음**
  - target 위치: §8.2 에러 코드 vocabulary 표, `mcp-error-codes.ts`의 `MCP_ERROR_CODES.INVALID_TOOL_ARGUMENTS`
  - 위반 규약: `spec/conventions/error-codes.md` §1 "도메인 prefix (권장)" — 도메인 범주화가 의미 있는 코드는 `<DOMAIN>_<CONDITION>`으로 그룹화 권장(`CAFE24_*`, `OAUTH_*`, `INTEGRATION_*`). 다른 MCP 코드 8종은 모두 `MCP_` prefix를 갖는데 이 코드만 예외.
  - 상세: 이는 "위반"이라기보다 §1의 "권장"(강제 아님) 범주이며, 코드베이스 검색 결과 다른 도메인(예: node-output.md Principle 3.2 하에서도 `INVALID_TOOL_ARGUMENTS`류의 범용 스키마 검증 코드는 종종 prefix 없이 쓰이는 관례가 있음 — `VALIDATION_ERROR`와 유사한 시스템 전역 공용 코드 취급 가능성). 다만 본 코드는 `MCP_ERROR_CODES` 상수 객체 안에 다른 `MCP_*` 코드들과 나란히 정의돼 있어 국소적으로는 비일관.
  - 제안: rename은 error-codes.md §2 정책상 breaking change이므로 신설 없이는 이름 교정 불가 — 실제로 target 문서(`plan/in-progress/spec-sync-mcp-client-gaps.md`)에도 이미 `task_947e443e`로 "INVALID_TOOL_ARGUMENTS prefix" follow-up이 등재돼 있다. 규약 준수 관점에서는 정정보다 `error-codes.md` §3 historical-artifact 예외 레지스트리에 등재하거나, 별도 PR에서 §1 원칙에 맞춰 `MCP_INVALID_TOOL_ARGUMENTS` 신설 + 구코드 병존 후 폐기(§5 이력)를 검토할 사안. Critical/Warning 아님 — 이미 인지·추적 중인 사소한 표기 이슈.

- **[INFO] `skipReason` / `code` 두 vocabulary 병존 설계는 규약과 정합 (문제 없음, 참고용)**
  - target 위치: §6.2 "명명 규칙 분리" 단락
  - 상세: `skipReason`은 `lower_snake_case`(운영 진단 enum), `code`는 `UPPER_SNAKE_CASE`(에러 코드)로 명시적으로 분리하고 `node-output.md` Principle 3.2를 인용해 경계를 밝힌 점은 오히려 모범적 준수 사례다. `Integration.status_reason`과의 의도적 표기 일치도 근거를 함께 서술해 규약 위반 소지가 없음. 별도 조치 불요.

- **[INFO] API 문서 규약(OpenAPI/Swagger) 해당 없음**
  - target 위치: 문서 전체
  - 상세: 본 spec은 MCP 클라이언트 프로토콜/도구 노출 모델을 다루며 REST 엔드포인트 데코레이터 패턴(`swagger.md`)이 적용될 대상(예: `preview-test` API)은 §9에서 `2-navigation/4-integration.md §3.3`을 참조로 위임하고 있어 자체적으로 Swagger 데코레이터 패턴을 규정하지 않는다 — 책임 분리가 적절하며 위반 없음.

## 요약

`spec/5-system/11-mcp-client.md`는 명명 규약(`mcp_<sid>__<toolName>` 도구명, `MCP_*` 에러 코드, `skipReason` lower_snake_case vs `code` UPPER_SNAKE_CASE 분리)과 출력 포맷 규약(`node-output.md` Principle 3.2 인용, `error-codes.md`의 SoT 위임 구조)을 대체로 충실히 준수하고 있으며, `MCP_ERROR_CODES` 코드베이스 상수와 문서상 vocabulary 표도 1:1 일치한다. 유일한 구조적 이탈은 CLAUDE.md가 권장하는 `## Overview` / 본문 / `## Rationale` 3섹션 구성을 따르지 않는다는 점이며(같은 폴더의 다른 spec들과 대비됨), 다수의 설계 결정 근거(fail-closed 분류, cluster 분할 범위 등)가 본문 인라인 blockquote로 흩어져 있다. 다만 이는 이미 `plan/in-progress/spec-sync-mcp-client-gaps.md`에 `task_947e443e`로 follow-up 등록된 인지된 채무이며, `INVALID_TOOL_ARGUMENTS` prefix 이슈도 같은 follow-up에 포함돼 있어 신규로 발견된 규약 위반이라기보다 이미 트래킹 중인 사소한 잔여 항목이다. Critical 등급 위반은 없다.

## 위험도

LOW
