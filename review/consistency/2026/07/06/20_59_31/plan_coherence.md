### 발견사항

- **[INFO]** payload 에 실제 관련 plan(`spec-sync-mcp-client-gaps.md`) 누락 — 조회로 보완, 내용 자체는 정합
  - target 위치: `spec/5-system/11-mcp-client.md` frontmatter `pending_plans:` (L11-12), 본문 §3.3(L142-148)·§6.2(L352-400)·§8.2(L442-461)
  - 관련 plan: `plan/in-progress/spec-sync-mcp-client-gaps.md` (payload 의 "진행 중 plan 문서 모음" 섹션에는 포함되지 않았으나 저장소에는 존재)
  - 상세: prompt_file payload 에 첨부된 in-progress plan 목록에는 `spec-sync-mcp-client-gaps.md` 가 빠져 있다. 그러나 `plan/in-progress/` 를 직접 조회한 결과 target 문서 frontmatter 가 이미 이 plan 을 `pending_plans` 로 명시 참조하고, 본문 §3.3/§6.2/§8.2 세 곳 모두 "미구현 (Planned)" 주석과 함께 동일 plan 경로를 정확히 인용하고 있다. plan 문서의 미해결 체크박스 4건(`§6.2` 필드 확장 cluster 3건, `§3.3` capability 캐시 1건)과 target 의 Planned 표기가 완전히 일치하며, 완료 표시된 1건(외부 MCP `serverSummaries` push)도 target 에 "2026-06-14 갱신"으로 정확히 반영돼 있다. 즉 target 은 이 plan 의 미해결 항목을 우회하거나 일방적으로 결정하지 않았다 — 오히려 모범적으로 동기화된 상태다. 이 항목은 검토자가 payload 누락을 스스로 보완했다는 절차 기록 목적의 INFO 이며, target·plan 자체의 불일치는 없다.
  - 제안: 갱신 불필요(target 은 이미 정합). 다만 orchestrator 의 plan_coherence payload 생성 로직이 `grep -l "관련 spec: spec/5-system/11-mcp-client.md"` 류의 역참조를 놓친 것으로 보이므로, 다음 실행 전 payload 생성 스크립트가 target 경로를 plan 본문에서 문자열 검색하는 방식으로 filtering 하고 있는지 점검 권장 (스크립트 개선 사항이며 이번 target 문서 자체의 결함 아님).

- **[INFO]** `ai-agent-tool-connection-rewrite.md` 의 미해결 결정과 target 의 관계 — 충돌 없음, 참고용 cross-ref 확인됨
  - target 위치: `spec/5-system/11-mcp-client.md` 전역 (특히 §2.3 Internal Bridge, §5.2 도구 이름 규칙 `mcp_*` prefix)
  - 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §"관련 진행 작업" 메모(L44), 배경(L54), 참고 목록(L64)
  - 상세: 해당 plan 은 AI Agent 의 일반 `tool_*` 도구 재설계를 다루며, dispatcher 분류 순서(`cond_* → kb_* → mcp_* → render_* → tool_*`)에 `mcp_*` 를 이미 포함해 두었다. target 문서(mcp-client)는 이 dispatcher 순서나 `tool_*` 재설계에 관한 어떤 결정도 선점하지 않으며, `mcp_*` 도구는 "영향 받지 않는 정상 도구"로 plan 에도 명시돼 있다. 두 문서 간 결정 충돌 없음.
  - 제안: 조치 불필요. `tool_*` 모델 확정 시 해당 plan §3 에서 dispatcher 표만 갱신하면 되고, 본 target 문서는 변경 대상이 아니다.

### 요약

`spec/5-system/11-mcp-client.md` 는 관련 in-progress plan(`spec-sync-mcp-client-gaps.md`)의 미해결 결정·미구현 항목을 정확히 "Planned" 로 표기하며 우회 없이 정합 상태를 유지하고 있다. payload 에 이 plan 문서 자체가 누락돼 있었으나 저장소 직접 조회로 교차 검증한 결과 충돌·선행조건 미해소·후속 항목 누락 어느 것도 발견되지 않았다. `ai-agent-tool-connection-rewrite.md` 등 인접 plan 과도 명시적 cross-ref 로 경계가 잘 그어져 있어 결정 충돌 여지가 없다.

### 위험도
NONE
