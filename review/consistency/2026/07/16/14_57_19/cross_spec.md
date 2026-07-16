# Cross-Spec 일관성 검토 — spec/4-nodes/3-ai/ (--impl-done final pass)

검토 범위: `origin/main` 대비 diff — shared `operation-tool-schema.ts` 추출(cafe24/makeshop MCP tool provider 공유), `spec/conventions/cafe24-api-metadata.md` §2/§7 포인터 + frontmatter `code:` 갱신, `spec/4-nodes/3-ai/1-ai-agent.md` `pending_plans` 에 `spec-drift-ai-agent-outport-countmax.md` 추가. 코드 SoT 는 워킹트리 HEAD(`/Volumes/project/private/clemvion/.claude/worktrees/funny-mahavira-50d003`)로 확인.

## 발견사항

### 이번 diff 자체 — 신규 Cross-Spec 충돌 없음

- 신규 shared 모듈 `codebase/backend/src/nodes/ai/ai-agent/tool-providers/operation-tool-schema.ts` 의 `buildOperationJsonSchema()` / `makeEnabledToolsFilter()` 시그니처·동작이 `spec/conventions/cafe24-api-metadata.md` §2("MCP/JSON Schema 매핑")·§7 pseudo-code 주석의 서술과 정확히 일치함을 코드 대조로 확인(필드 타입 변환, `oneOf`→`anyOf`/`allOf` 결합, allowlist 판정 로직 모두 일치).
- `cafe24-mcp-tool-provider.ts`/`makeshop-mcp-tool-provider.ts` 양쪽 모두 구 인스턴스 메서드(`buildCafe24JsonSchema`/`buildMakeshopJsonSchema`/`applyCafe24Allowlist`/`applyMakeshopAllowlist`)를 제거하고 shared 함수로 위임 — spec 이 "cafe24/makeshop 공유 pure 함수"라 서술한 바와 실제 구현(두 provider 모두 위임)이 일치.
- `spec/conventions/cafe24-api-metadata.md` frontmatter `code:` 에 `operation-tool-schema.ts` 추가는 타당 (실제로 §2 매핑 로직의 구현처가 이동했으므로).
- `spec/conventions/makeshop-api-metadata.md` §7("MCP Bridge 와의 매핑")·frontmatter 는 이번 diff 로 변경되지 않았고, 옛 함수명(`buildMakeshopJsonSchema` 등)을 직접 인용하지 않으므로 stale 참조 없음 — 두 문서 간 새 불일치 없음 (`spec/` 전체에서 `buildJsonSchema`/`buildCafe24JsonSchema`/`buildMakeshopJsonSchema`/`apply*Allowlist` grep 결과, 무관한 `3-information-extractor.md` 의 동명이인 `buildJsonSchema(schema, multiTurn)`—outputSchema→JSON Schema 변환, 별개 함수—외 잔존 참조 없음 확인).
- Integration `service_type` 값 집합(`'mcp' | 'cafe24' | 'makeshop'`)은 `spec/1-data-model.md` §2.10(Integration.service_type enum), `spec/4-nodes/3-ai/0-common.md` §3, `spec/4-nodes/3-ai/1-ai-agent.md` §1/§2 전부 동일 3값으로 일관 — 이번 diff 가 건드리지 않았고 사전에도 정합.
- `pending_plans` 필드에 `spec-drift-ai-agent-outport-countmax.md` 추가는 실제로 아래 두 CRITICAL 이 여전히 미해결 상태이므로 근거가 있음 — 다만 이 추가 자체는 spec 본문 내용을 바꾸지 않는 메타데이터 갱신이라 새로운 cross-spec 충돌을 만들지 않음.

### **[CRITICAL]** (pre-existing, durably anchored — 본 diff 원인 아님) Multi Turn `out` 포트 존재 여부가 문서 간 정반대

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md:217` "Multi Turn 모드에는 **`out` 포트가 존재하지 않는다**" + §3.2 마이그레이션 절(조건 0개 multi_turn 의 `out` 엣지를 dangling 처리)
- 충돌 대상: `spec/4-nodes/_product-overview.md:215` 및 `spec/4-nodes/3-ai/_product-overview.md:84` — 두 문서 모두 동일 요구사항 ID **ND-AG-24** 에 "조건 0개 시 `out` + `error` 제공 (하위 호환)" 명시
- 상세: 같은 요구사항 ID(ND-AG-24)가 두 다른 영역(product-overview vs 기술 spec)에서 정반대 포트 계약을 서술 — 기술 spec 은 `out` 포트가 아예 없다고 하고, 두 product-overview 문서는 조건 0개 시 `out` 포트가 존재한다(하위호환)고 한다. 실제 코드(`ai-agent.handler.ts`/`ai-turn-executor.ts`) 동작이 아직 project-planner 에 의해 확정되지 않아 어느 쪽이 SoT 인지 미정.
- 상태: 그대로 재현됨(grep 으로 3개 파일 모두 재확인). 이번 diff 는 이 파일들을 건드리지 않았고, 새로 부여된 `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` "Critical 1" 항목이 이를 durable 하게 추적 중임을 확인 — `1-ai-agent.md` frontmatter `pending_plans` 에 정상 등록됨.
- 제안: (기존 plan 문서의 처분안과 동일) 실제 코드 동작 확정 후 (a) 기술 spec 이 맞으면 두 `_product-overview.md` 의 "하위호환" 문구 삭제, (b) 반대면 `1-ai-agent.md` §3.2·마이그레이션 절 정정. project-planner 소관.

### **[CRITICAL]** (pre-existing, durably anchored — 본 diff 원인 아님) `AI_AGENT_TOOL_COUNT_MAX=128` 기본값이 Cafe24/MakeShop 기본 연결에서 상시 초과

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md:330` (`AI_AGENT_TOOL_COUNT_MAX` 기본 128, 초과 시 hard 취급 — `TOOL_DEFINITION_PAYLOAD_EXCEEDED`)
- 충돌 대상: `spec/4-nodes/4-integration/4-cafe24.md:29`·`:446` (Cafe24 Admin API "~180 endpoint") — 및 (plan 문서에 따르면) 실측 카탈로그는 383개로 "~180" 표기 자체도 stale. `spec/0-overview.md` §6.1 이 AI Agent MCP 연동을 "구현 완료"로 서술하는데 카탈로그 규모 제약에 대한 각주가 없음.
- 상세: Cafe24 Integration 하나를 MCP 서버로 붙이기만 해도(allowlist 미설정 시 전체 노출) 도구 개수가 기본 128 상한을 넘는 상황이 카탈로그 규모상 사실상 상시 발생 — "128 기본값" 과 "Cafe24 통합 = 기본 사용 가능" 이라는 두 spec 서술이 실사용 시나리오에서 서로 배치된다. `1-ai-agent.md` §4.2/§12.15 는 이 팽창 문제를 인지하고 있으나(Rationale 에 "Cafe24 383개 실측" 언급), §1/§2 설정 필드 표에는 "Cafe24/MakeShop 연결 시 allowlist 설정 필수" 급의 명시적 경고가 없다.
- 상태: 그대로 재현됨(grep 재확인). `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` "Critical 2" 항목으로 durable 추적 중.
- 제안: (기존 plan 처분안과 동일) (1) `4-cafe24.md` 의 "~180" 표기를 실제 카탈로그 수(383)로 정정 또는 집합 차이 명시, (2) `1-ai-agent.md` §1/§2 에 "Cafe24/MakeShop 은 기본값 초과 → allowlist 설정 사실상 필수" 경고 명문화, (3) `spec/0-overview.md` §6.1 "구현 완료" 서술에 제약 각주 추가.

### **[INFO]** `spec/5-system/11-mcp-client.md` frontmatter `code:` 목록이 새 shared 모듈을 포함하지 않음 (사전 스코프 관행, 이번 diff 무관)

- target 위치: (참조 대상) `spec/5-system/11-mcp-client.md` frontmatter `code:` — `cafe24-mcp-tool-provider.ts` 는 나열하지만 `makeshop-mcp-tool-provider.ts`, 이번에 추가된 `operation-tool-schema.ts` 는 나열하지 않음
- 충돌 대상: `spec/conventions/cafe24-api-metadata.md` (이번 diff 로 `operation-tool-schema.ts` 를 자신의 `code:` 에 정확히 추가함)
- 상세: 두 문서가 겹치는 코드 파일 집합을 각자 부분집합으로 `code:` 에 나열하는 기존 관행(다른 SoT 우선순위—mcp-client.md 는 프로토콜/전송 레이어, cafe24-api-metadata.md 는 스키마 매핑 레이어—라 겹침 자체가 설계상 정상) 자체는 이번 diff 이전부터 존재했고 diff 가 이를 악화시키지 않음(오히려 신규 파일이 정확한 소유 문서 쪽에만 정확히 추가됨). 다만 mcp-client.md 는 애초에 `makeshop-mcp-tool-provider.ts` 도 나열하지 않는 등 대표 예시 나열이라 완전성 기준이 느슨함.
- 제안: 이번 PR 범위 밖. 필요 시 후속으로 `mcp-client.md` frontmatter `code:` 를 대표 예시 나열에서 전체 나열로 정비할지는 별도 판단.

## 요약

이번 diff(shared `operation-tool-schema.ts` 추출 + `cafe24-api-metadata.md` 포인터/frontmatter 갱신 + `1-ai-agent.md` pending_plans 등록)는 실제 코드와 spec 서술이 정확히 합치하며, 새로운 cross-spec(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임) 충돌을 만들지 않는다. 다만 이전부터 알려진 두 건의 CRITICAL — (1) `ND-AG-24` 요구사항 ID 에 대해 `_product-overview.md`(2곳)와 `1-ai-agent.md` 기술 spec 이 Multi Turn `out` 포트 존재 여부를 정반대로 서술, (2) `AI_AGENT_TOOL_COUNT_MAX` 기본값(128)이 Cafe24/MakeShop 카탈로그 규모(~180~383)와 실사용 시 상시 충돌 — 은 여전히 미해결 상태로 재현되며, 이번 diff 가 원인이 아니라 `plan/in-progress/spec-drift-ai-agent-outport-countmax.md` 로 durable 하게 앵커링된 기존 결함임을 확인했다. 두 CRITICAL 은 project-planner 가 실제 코드 동작을 SoT 로 확정한 뒤 spec 문서를 정정해야 하는 별도 작업이다.

## 위험도

CRITICAL (pre-existing 2건 미해결 — 단, 본 diff 기인 아님. 본 diff 자체는 NONE)
