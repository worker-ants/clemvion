# Consistency Check (--impl-done) — selector 위젯 라벨·hint 복원

검토자: cross-spec (focused). 대상: selector-widgets 라벨/hint fix.

## BLOCK: NO

cross-spec NO-BLOCK (NONE). spec drift 0.

## 확인
- fix 는 §2.6.1("hint = 항상 노출 캡션") 계약을 **복원**하는 방향 — 변경 전 5개 위젯이 hint 미렌더로
  이 계약을 위반하던 상태였음. 어떤 spec 본문과도 모순 0.
- widget 식별자(mcp-server-selector/workflow-selector/kb-selector/llm-config-selector/모델 selector)·
  저장 형태(workflowId UUID / mcpServers McpServerRef[] / knowledgeBases UUID[] / 모델명 문자열)·
  런타임 resolve·backend schema 전부 무변경.
- ai-assistant §4.3.1 pendingUserConfig 후보 조회 계약 무영향(렌더 레이어만 수정).

## 결론
fix ↔ spec 완전 정합. SPEC-CONSISTENCY 게이트 통과(BLOCK: NO).
