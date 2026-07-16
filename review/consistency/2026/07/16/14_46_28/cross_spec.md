# Cross-Spec 일관성 검토 — operation-tool-schema 추출 리팩터 (--impl-done)

## 검토 범위

- 코드: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/{cafe24-mcp-tool-provider,makeshop-mcp-tool-provider,operation-tool-schema}.ts` — cafe24/makeshop 의 `build*JsonSchema` + `apply*Allowlist` 인스턴스 메서드를 공유 pure 함수 `buildOperationJsonSchema()` / `makeEnabledToolsFilter()` (`operation-tool-schema.ts`) 로 추출.
- spec: `spec/conventions/cafe24-api-metadata.md` §2 "MCP/JSON Schema 매핑" 및 §7 "MCP Bridge 와의 매핑" 의 구현 위치 pointer 를 `Cafe24McpToolProvider.buildJsonSchema()` → `tool-providers/operation-tool-schema.ts` 의 `buildOperationJsonSchema()` 로 정정 (`git diff origin/main...HEAD -- spec/conventions/cafe24-api-metadata.md` 확인, 6 lines 변경).
- 동작 보존 리팩터(behavior-preserving) 여부 확인 목적.

## 확인한 사실

1. `operation-tool-schema.ts` 의 `buildOperationJsonSchema()` / `makeEnabledToolsFilter()` 는 `cafe24-mcp-tool-provider.ts:22-24,726,749` 와 `makeshop-mcp-tool-provider.ts:22-24,735,761` 양쪽에서 동일하게 import·사용됨 — 두 provider 가 실제로 단일 구현을 공유한다.
2. `cafe24-api-metadata.md` §2 (line 153) / §7 (line 391, 398) 의 pointer 는 실제 코드 위치(`tool-providers/operation-tool-schema.ts` export `buildOperationJsonSchema`)와 정확히 일치. pseudo-code (`parameters: buildOperationJsonSchema(operation)`)도 실제 두 provider 코드와 라인 단위로 일치.
3. `OperationSchemaSource` / `OperationFieldSpec` (공유 타입, `operation-tool-schema.ts:26-44`)는 `Cafe24FieldSpec`/`Cafe24FieldConstraint` (`codebase/backend/src/nodes/integration/cafe24/metadata/types.ts`) 의 구조적 상위 집합이며, spec §2 의 `constraints` kind 표(`oneOf`만 JSON Schema 변환)와 정확히 일치.
4. spec 전체(`spec/**`)에서 제거된 구식별자 — `Cafe24McpToolProvider.buildJsonSchema()`, `apply*Allowlist` — 에 대한 잔존(stale) 참조를 grep 했으나 발견되지 않음. `spec/4-nodes/3-ai/3-information-extractor.md:147` 의 `buildJsonSchema(schema, multiTurn=false)` 는 Information Extractor 핸들러의 **별개 함수**(`information-extractor.handler.ts` private method, outputSchema→JSON Schema 변환)로, 이번 추출과 무관 — 오탐 아님.
5. `spec/conventions/makeshop-api-metadata.md` §7 "MCP Bridge 와의 매핑"은 이번 diff 에서 갱신되지 않았고 여전히 "`MakeshopMcpToolProvider` 가 메타데이터에서 MCP 도구를 생성한다"라는 일반 서술만 유지 — `buildOperationJsonSchema()` 공유 사실을 명시하지 않지만, 오류나 모순은 아니다(§2 에서 "`constraints` 형식·의미는 Cafe24 API Metadata §2 와 동일하므로 재정의하지 않는다"로 이미 cafe24 문서를 참조하는 기존 패턴). `operation-tool-schema.ts` 파일 헤더 주석도 "SoT: cafe24-api-metadata.md §2 (makeshop-api-metadata.md §2 가 이를 참조)"라고 명시해 의도된 비대칭.
6. `spec/5-system/11-mcp-client.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/4-nodes/4-integration/5-makeshop.md`, `spec/4-nodes/3-ai/1-ai-agent.md` 등 인접 spec 은 `Cafe24McpToolProvider`/`MakeshopMcpToolProvider` 를 파일 단위(`tool-providers/*.ts` glob, `1-ai-agent.md` frontmatter `code:` 342행)로만 참조하고 함수 단위 pointer 를 갖지 않아 이번 내부 리팩터로 인한 drift 없음.

## 발견사항

- **[INFO]** makeshop-api-metadata.md §7 이 공유 함수(`buildOperationJsonSchema`) 존재를 명시하지 않아 cafe24 문서 대비 상세도 비대칭
  - target 위치: (해당 없음 — target 문서 자체가 아니라 인접 파일) `spec/conventions/makeshop-api-metadata.md` §7 "MCP Bridge 와의 매핑"
  - 충돌 대상: `spec/conventions/cafe24-api-metadata.md` §7 (같은 항목에서 `tool-providers/operation-tool-schema.ts` 의 `buildOperationJsonSchema()` 를 명시)
  - 상세: 모순은 없음(둘 다 정확) — 다만 cafe24 문서는 공유 pure 함수 구현 위치를 상세히 pointer 하는 반면 makeshop 문서는 "`MakeshopMcpToolProvider` 가 메타데이터에서 MCP 도구를 생성한다"는 원론적 서술만 유지해 독자가 두 provider 가 스키마 생성 로직을 실제로 공유한다는 사실(drift 방지 근거)을 makeshop 문서만 봐서는 알기 어렵다. `operation-tool-schema.ts` 헤더 주석이 "makeshop-api-metadata.md §2 가 cafe24 §2 를 참조"라고 명시해 의도된 설계이므로 이는 이번 diff 가 만든 문제가 아니라 기존 문서 구조 관례(makeshop 문서가 cafe24 문서를 참조하는 패턴)의 연장.
  - 제안: (선택) `makeshop-api-metadata.md` §7 에 "JSON Schema 변환은 cafe24 와 동일 공유 함수(`operation-tool-schema.ts` `buildOperationJsonSchema()`) 사용, 재정의하지 않음" 한 줄 추가하면 대칭성이 개선되나 필수는 아님. 이번 PR 범위(cafe24-api-metadata.md 만 pointer 정정) 내에서는 조치 불요.

## 사전 위임된 기존 Critical (본 diff 미도입 — 참고용 보고)

아래 2건은 orchestrator 로부터 "이미 project-planner task_3ac39ebd 로 위임됨"이라 안내받은 pre-existing 이슈다. 코드 확인 결과 실제로 여전히 존재하나, **이번 operation-tool-schema 추출 리팩터가 만들거나 악화시키지 않았다** (추출 전후 `AI_AGENT_TOOL_COUNT_MAX` 값·필터링 로직 동일, allowlist 시맨틱 100% 보존).

1. Multi-turn `out` 포트 모순 (본 검토에서 재확인 안 함 — 범위 밖).
2. `AI_AGENT_TOOL_COUNT_MAX` 기본값 128 (`tool-payload-budget.ts:55`, `spec/4-nodes/3-ai/1-ai-agent.md:329,1127`) vs Cafe24(~180 operation)/MakeShop(161 operation) 카탈로그 크기 — allowlist 미설정 시 단일 통합만으로도 128 초과 가능. 이번 diff 는 `makeEnabledToolsFilter`/`buildOperationJsonSchema` 를 그대로 재현(behavior-preserving)했으므로 이 한도 자체나 카탈로그 크기 관계에 변화 없음.

## 요약

이번 diff 는 cafe24/makeshop MCP tool provider 의 `build*JsonSchema`/`apply*Allowlist` 를 `tool-providers/operation-tool-schema.ts` 공유 pure 함수(`buildOperationJsonSchema`/`makeEnabledToolsFilter`)로 추출하는 순수 내부 리팩터이며, 두 provider 코드가 실제로 이 공유 함수를 동일하게 사용함을 확인했다. `spec/conventions/cafe24-api-metadata.md` §2/§7 의 구현 위치 pointer 정정은 실제 코드와 정확히 일치하고, spec 전역에서 제거된 구 식별자(`Cafe24McpToolProvider.buildJsonSchema()`, `apply*Allowlist`)에 대한 잔존 참조도 없다. 유일한 관찰 사항은 makeshop-api-metadata.md 가 이번 pointer 갱신에서 제외되어 cafe24 문서 대비 상세도가 비대칭하다는 INFO 수준 항목이며, 이는 기존 "makeshop 문서가 cafe24 문서를 참조" 관례의 연장으로 모순이 아니다. Cross-spec 관점에서 이 리팩터가 도입한 CRITICAL/WARNING 은 없다.

## 위험도

NONE
