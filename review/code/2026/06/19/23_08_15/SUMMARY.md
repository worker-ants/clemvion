# AI Review SUMMARY — selector 위젯(MCP/Workflow/KB) 라벨·hint 복원

**대상**: `git diff 8042bd2d..HEAD`(selector 위젯 fix). 리뷰어: maintainability / requirement.

## 전체 위험도: LOW (Critical 0, Warning 0)

| reviewer | risk | 결과 |
| --- | --- | --- |
| maintainability | LOW | FieldGroup 래핑이 model-selector·표준 위젯과 일관, hint 스타일 토큰 일치, 주석 문서화 양호. 전부 Info |
| requirement | NONE | McpServer(label+hint)·Workflow(label, hint 없음 안전)·Kb(자체라벨+hint캡션 이중라벨 없음)·LlmConfig(3노드 hint 미정의 무변경 정당) 전수 확인. Info 1 |

## 조치 (Info 보강 — Warning 없음, 선택적 polish 적용)
- **[req I]** selector-widgets.test.tsx 의 `useEditorStore` mock 을 selector-fn 형태로 → 미래에
  WorkflowSelectorWidget 테스트 추가 시 안전.
- **[maint I]** Kb 테스트에 `label` prop 명시(타입 계약 완결).
- **[maint I]** WorkflowSelectorWidget inner div gap-3 의도 주석 추가.

## NO-FIX (근거)
- maint I: KbSelectorWidget/LlmConfigSelectorWidget 이 `label` 을 구조분해 안 함 — 자체 라벨 보유
  위젯의 기존 패턴(LlmConfig 선례)과 일관, 주석으로 의도 명시됨. 유지.
- maint I: workflow 회귀 테스트가 hint 미단언 — `workflowId` 필드에 schema hint 가 **없으므로**
  단언할 hint 가 없음(정상). label 누락 회귀 가드에 집중.

## 확인 (requirement PASS)
- 각 위젯이 쓰이는 노드 필드의 schema label/hint 가 이제 렌더됨. `translateBackendHint(undefined)`
  → 빈 hint span 미생성. 위젯 식별자·저장 형태·런타임 무변경.
</content>
