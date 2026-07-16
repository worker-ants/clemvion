# 신규 식별자 충돌 검토 — spec-draft-cafe24-countmax

## 발견사항

없음.

target 문서(D1~D4)를 6개 관점(요구사항 ID / 엔티티·타입명 / API endpoint / 이벤트·메시지명 / 환경변수·설정키 / 파일 경로)으로 전수 점검한 결과, **신규로 도입되는 식별자가 존재하지 않는다** — target 스스로도 "검토 요청 관점 §5. naming collision: 신규 식별자 0건" 이라고 명시하며, 실제 diff 내용도 이를 뒷받침한다.

- **D1** (`4-cafe24.md` L29·L446): 순수 수치 정정("~180"→"485", "~10"→"~27"). 신규 식별자 없음.
- **D2** (`1-ai-agent.md` §4.2): "count_max 표 아래" 에 note 블록 신설이지만, 새 heading/anchor·requirement ID·타입명이 아니라 본문 서술 삽입이다. 인용된 식별자(`AI_AGENT_TOOL_COUNT_MAX`, `AI_AGENT_TOOL_PAYLOAD_HARD_BYTES`, `TOOL_DEFINITION_PAYLOAD_EXCEEDED`, `enabledTools`, `mcpServers[].enabledTools`)는 실제 저장소에서 전부 기존 정의를 그대로 재인용한다 — 검증 결과:
  - `AI_AGENT_TOOL_COUNT_MAX` = 128 : `spec/4-nodes/3-ai/1-ai-agent.md:330`, `codebase/backend/.env.example:336` 과 일치
  - `AI_AGENT_TOOL_PAYLOAD_HARD_BYTES` = 262144 : `spec/4-nodes/3-ai/1-ai-agent.md:329`, `codebase/backend/.env.example:333` 과 일치
  - `TOOL_DEFINITION_PAYLOAD_EXCEEDED` : `spec/4-nodes/3-ai/1-ai-agent.md:1128`, `spec/5-system/11-mcp-client.md:339`, `spec/conventions/cross-node-warning-rules.md:134`, `codebase/backend/src/nodes/ai/ai-agent/tool-payload-budget.ts` 등과 의미 일치(동일 에러코드, 동일 판정 축)
  - 새 requirement ID(`NAV-*`/`ND-*`/`ED-*` 류)·새 DTO·새 엔티티명 없음.
- **D3** (`11-mcp-client.md` §5.8): 기존 문단에 구체 수치(485/161)를 병기하는 것뿐, 새 endpoint·식별자 없음.
- **D4** (`0-overview.md` §6.1): 기존 Cafe24 행에 "485 endpoint" 문구를 추가하는 것뿐, 새 표 행·새 용어 없음. 인접 MakeShop 행("161 REST operation")과 표현 대칭도 맞아 오히려 명명 일관성이 개선된다.

새 API endpoint(method+path), 새 webhook/queue/SSE 이벤트명, 새 ENV var/config key, 새 spec 파일 경로 — 4개 diff 어디에도 등장하지 않는다. 모두 기존 파일의 기존 섹션 내 수치·서술 보강이다.

## 요약

target 문서는 4개 spec 파일(4-cafe24.md, 1-ai-agent.md, 11-mcp-client.md, 0-overview.md)의 기존 섹션에 측정값(485/161/~27)과 설명 문구를 추가·정정하는 순수 문서 정정 작업이며, 신규 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·config key·spec 파일 경로 중 어느 것도 새로 도입하지 않는다. 인용되는 모든 식별자(`AI_AGENT_TOOL_COUNT_MAX`, `AI_AGENT_TOOL_PAYLOAD_HARD_BYTES`, `TOOL_DEFINITION_PAYLOAD_EXCEEDED`, `enabledTools`)는 저장소의 기존 SoT(`spec/4-nodes/3-ai/1-ai-agent.md`, `codebase/backend/.env.example`, `spec/conventions/cross-node-warning-rules.md`)와 값·의미가 정확히 일치해 재사용 충돌도 없다. 신규 식별자 충돌 관점에서는 이의 없음.

## 위험도

NONE
