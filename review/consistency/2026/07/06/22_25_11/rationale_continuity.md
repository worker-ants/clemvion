# Rationale 연속성 검토 — spec/5-system/11-mcp-client.md (mcpDiagnostics 구조화 객체 승격)

## 발견사항

- **[INFO]** `spec/5-system/11-mcp-client.md` 및 `spec/4-nodes/3-ai/1-ai-agent.md` 에 `## Rationale` 섹션 자체가 부재
  - target 위치: `spec/5-system/11-mcp-client.md` 문서 끝(§12 이후), `spec/4-nodes/3-ai/1-ai-agent.md` 문서 끝
  - 과거 결정 출처: 없음 (해당 spec 에는 애초에 `## Rationale` 섹션이 존재하지 않음)
  - 상세: 본 PR 은 `mcpDiagnostics` 를 `McpServerSummary[]` 단일 배열 → 구조화 객체(`attempted`/`serverCount`/`toolCalls`/`resourceReads`/`promptGets`/`serverSummaries[]`/`errors[]`)로 승격하는 의미 있는 설계 결정("배열 → 구조화 객체", "provider 는 두 sub-array 슬롯만 push, 조립은 핸들러 책임" 등)을 내렸지만, 이 결정의 배경·대안 비교를 정식 `## Rationale` 절에 남기지 않았다. 대신 §6.2 본문에 인라인 "구현 현황 (2026-07-06 갱신)" 코멘트로 흡수되어 있다.
  - 제안: 신규 Rationale 작성 의무는 아님 — `plan/in-progress/spec-sync-mcp-client-gaps.md` 가 이미 이 gap 을 `task_947e443e`(Rationale 섹션 부재 follow-up)로 명시 추적 중이므로 별도 조치 불요. 단, follow-up 착수 시 "왜 단일 배열이 아닌 구조화 객체를 택했는가"(KB `ragDiagnostics` 패턴과의 정합, provider/handler 책임 분리 등)를 `## Rationale` 로 승격하는 것을 권장.

## 검토 상세

1. **기각된 대안의 재도입 여부**: 확인 결과 해당 없음. 오히려 반대 방향 — 과거(`301b6c11d`, 2026-06-14) 커밋에서 명시적으로 "보류(별도 PR)"로 지정했던 `errors[]`/`attempted`/`serverCount`/`toolCalls`/`resourceReads`/`promptGets`/코드 granularity 확장을 정확히 그 계획대로(`spec-sync-mcp-client-gaps.md` "타입 확장 cluster" 섹션) 이행한 것으로, 이전에 기각된 대안의 무단 재도입이 아니라 사전에 합의·명시된 후속 작업의 예정된 실행이다.

2. **합의된 원칙 위반 여부**: 없음.
   - "provider 는 push 만, 조립/카운터는 핸들러 책임" 이라는 §6.2 기존 원칙이 diff 전반에서 그대로 유지됨 (`ProviderBuildCtx.mcpDiagnostics`/`mcpDiagnosticErrors` 는 sub-array 슬롯, `finalizeMcpDiagnostics` 만 구조화 객체 조립).
   - "meta lean" 원칙(MCP 미시도 시 키 자체 omit)도 `finalizeMcpDiagnostics`/`buildMcpDiagnosticsMeta` 양쪽에서 하위호환 유지.
   - `errors[]` 는 비어도 항상 포함(안정 shape) 규칙이 `1-ai-agent.md` §7.1 예시(`"errors": []`)와 `mcp-client.md` §6.2 모두 일치.
   - `code` UPPER_SNAKE_CASE / `skipReason` lower_snake_case 명명 규칙 분리(`node-output.md` Principle 3.2 참조)도 신규 `McpDiagnosticError.code` 도입 시 그대로 준수.

3. **결정의 무근거 번복 여부**: 없음. `mcp-client.md` §6.2/§8.1/§8.2, `1-ai-agent.md` §7.1 이 코드와 같은 커밋(`1a4124842`)에서 함께 갱신되어 spec↔코드 정합이 유지됨. "구현 현황" 인라인 노트가 날짜별로 갱신되며 이전 상태("Planned")에서 현재 상태로의 전이 근거를 그때그때 기록하는 이 문서 고유의 관행(정식 `## Rationale` 대신 날짜 태그 인라인 코멘트)을 일관되게 따르고 있다.

4. **암묵적 가정 충돌 여부**: 없음. §8.1 격리 원칙("한 서버 장애가 노드 전체를 죽이지 않는다")·§6.2 "call-phase errors[] 누적은 Planned" 경계가 코드(`openServer` catch 블록에서 build-phase 만 `McpBuildPhaseError` 분류, call-phase 는 기존 경로 유지)와 정확히 일치. `spec-sync-mcp-client-gaps.md` 도 이 경계를 "본 PR 범위 밖"으로 명시해 spec-코드-plan 삼자가 정합.

## 요약

target(`spec/5-system/11-mcp-client.md`)의 `mcpDiagnostics` 구조화 객체 승격은 2026-06-14 커밋에서 명시적으로 예고("보류: 타입 확장 cluster")된 후속 작업을 계획대로 이행한 것으로, 과거 Rationale 상 기각된 대안의 재도입이나 합의 원칙 위반, 무근거 결정 번복은 발견되지 않았다. 다만 이 spec 파일 자체에 정식 `## Rationale` 섹션이 없어 이번 결정의 배경이 인라인 "구현 현황" 코멘트로만 남아 있는데, 이는 이미 `plan/in-progress/spec-sync-mcp-client-gaps.md` 에 별도 follow-up(task_947e443e)으로 추적 중인 기존 컨벤션 부채이지 본 PR 이 새로 만든 문제가 아니다.

## 위험도

NONE
