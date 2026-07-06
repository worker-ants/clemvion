## 발견사항

- **[WARNING]** `## Rationale` 섹션 부재 — 문서 구조 규약 미준수
  - target 위치: `spec/5-system/11-mcp-client.md` 전체 (문서 끝, §12 이후에 Rationale 섹션 없이 종료)
  - 위반 규약: CLAUDE.md "정보 저장 위치" 표 — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" 및 `.claude/skills/project-planner/SKILL.md` §"Spec 문서 구조 (3섹션 권장)" — Overview / 본문 / `## Rationale`
  - 상세: `spec/5-system/` 디렉토리의 18개 문서 중 16개가 `## Rationale` 섹션을 갖고 있다 (`1-auth.md`, `2-api-convention.md`, `3-error-handling.md`, `4-execution-engine.md`, `6-websocket-protocol.md`, `7-llm-client.md`, `8-embedding-pipeline.md`, `9-rag-search.md`, `10-graph-rag.md`, `12-webhook.md` ~ `17-agent-memory.md` 등). `11-mcp-client.md` 는 `## Rationale` 섹션이 전혀 없는 2개 예외 문서 중 하나다 (다른 하나는 `5-expression-language.md`, 이 역시 오래된 outlier). 그러나 본 문서는 non-trivial 한 설계 결정을 다수 포함한다 — 예: §2.2 stdio 미지원 사유, §8.4 "Internal Bridge 예외"(refresh_token 자가회복 vs 외부 MCP 즉시격하 분기), §6.2 `serverSummaries[]`/`errors[]` 역할 분리(2026-07-06 갱신), §3.2 `MCP_ALLOW_INSECURE_URL` throw-vs-warn 분류 기준. 이런 결정들이 본문 산문에 인라인으로 흩어져 있을 뿐 "왜 이렇게 결정했는가" 를 모으는 전용 섹션이 없어, `audit-actions.md`/`error-codes.md`/`node-output.md`/`swagger.md` 등 다른 conventions·spec 문서가 따르는 3섹션 패턴과 어긋난다.
  - 제안: 문서 끝에 `## Rationale` 섹션을 신설해 위 예시 결정들(§2.2 stdio 배제, §8.4 Internal Bridge 자가회복 예외, §6.2 진단 스키마 분리, §3.2 escape hatch 분류 기준 등)의 배경·기각 대안을 이관한다. "권장" 등급이라 CRITICAL 은 아니나, 같은 영역 문서와의 구조적 일관성을 위해 정리가 바람직하다.

- **[INFO]** `INVALID_TOOL_ARGUMENTS` 에러 코드의 도메인 prefix 누락
  - target 위치: `spec/5-system/11-mcp-client.md` §8.2 에러 코드 vocabulary 표 (463행) — 및 대응 코드 `codebase/backend/src/modules/mcp/mcp-error-codes.ts:23`
  - 위반 규약: `spec/conventions/error-codes.md` §1 "도메인 prefix (권장)" — "도메인 범주화가 의미 있는 코드는 `<DOMAIN>_<CONDITION>` 으로 그룹화한다 (`CAFE24_*`, `OAUTH_*`, `INTEGRATION_*`)"
  - 상세: §8.2 vocabulary 의 다른 9개 코드는 모두 `MCP_` prefix 를 갖는다 (`MCP_CONNECT_FAILED`, `MCP_LIST_FAILED`, `MCP_CALL_FAILED`, `MCP_TOOL_ERROR`, `MCP_TIMEOUT`, `MCP_AUTH_FAILED`, `MCP_HTTPS_REQUIRED`, `MCP_UNKNOWN_TOOL`, `MCP_RESPONSE_TOO_LARGE`). `INVALID_TOOL_ARGUMENTS` 만 홀로 prefix 가 없다. 다만 error-codes.md §1 은 이 규칙을 "권장" 으로 명시하고, `VALIDATION_ERROR` 처럼 시스템 전역 공용 코드는 prefix 없이 쓰는 별개 범주로 인정한다 — `INVALID_TOOL_ARGUMENTS` 도 "LLM tool-calling 인터페이스 전반에 적용 가능한 범용 코드"(MCP 고유 의미가 아니라 스키마 검증 실패라는 범용 조건)로 해석될 여지가 있어 CRITICAL/WARNING 이 아닌 INFO 로 표기한다.
  - 제안: 의도가 "MCP 전용 코드"라면 `MCP_INVALID_TOOL_ARGUMENTS` 로 정정 검토(단, error-codes.md §2 rename=breaking 정책 고려 — 이미 코드/테스트에 정착된 값이므로 실익 대비 비용을 따져야 함). 의도가 "범용 코드" 라면 error-codes.md §1 의 "시스템 전역 공용 코드" 예외 목록에 `INVALID_TOOL_ARGUMENTS` 를 명시적으로 등재해 규약과 실제를 정합화하는 것을 권장.

- **[INFO]** `skipReason` vocabulary 의 conventions 상호참조 정합성 (검증 결과 — 문제 없음, 참고용 기록)
  - target 위치: `spec/5-system/11-mcp-client.md` §6.2 (393행) "명명 규칙 분리" 콜아웃
  - 위반 규약: 없음 (`node-output.md` §3.2 참조가 정확)
  - 상세: 문서가 스스로 `skipReason` 은 `lower_snake_case` 이며 `node-output.md` Principle 3.2 의 `code` UPPER_SNAKE_CASE 규약과 별개 (운영 진단 enum) 임을 명시하고 있다. 실제 `node-output.md` §3.2 확인 결과 이 self-referential 구분은 정확하다 — 규약 위반 아님.
  - 제안: 없음. (긍정적 준수 사례로 기록만.)

## 요약

`spec/5-system/11-mcp-client.md` 는 frontmatter(`id`/`status: partial`/`code:`/`pending_plans:`)가 `spec-impl-evidence.md` 스키마를 정확히 준수하고, 에러 코드 9/10 이 `MCP_` 도메인 prefix + `UPPER_SNAKE_CASE` 규약(`node-output.md` §3.2, `error-codes.md` §1)을 지키며, `mcp-error-codes.ts` 코드와 spec 표가 1:1 대응한다. `MCP_ALLOW_INSECURE_URL` vs `ALLOW_PRIVATE_HOST_TARGETS` 의 throw/warn 분류, `skipReason`/`code` 명명 레이어 분리, Internal Bridge 관련 cafe24-api-metadata.md 상호참조 앵커도 모두 유효하고 일관적이다. 유일한 구조적 이슈는 `spec/5-system/` 내 사실상 표준인 `## Rationale` 섹션이 본 문서에 없다는 점(WARNING) 이며, `INVALID_TOOL_ARGUMENTS` 의 domain-prefix 누락은 의도적 범용 코드일 가능성이 있어 INFO 로 처리한다. 전체적으로 정식 규약 위반은 경미하고 CRITICAL 은 없다.

## 위험도

LOW
