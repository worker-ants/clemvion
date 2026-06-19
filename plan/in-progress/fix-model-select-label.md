---
worktree: fix-model-select-label-e0d535
started: 2026-06-19
owner: developer
status: in-progress
---

# fix: 모델 select 위젯의 필드 라벨·hint 복원 (PR #642 회귀)

## 문제
PR #642 에서 메모리 모델 필드(embeddingModel/summaryModel/extractionModel)를 select
위젯으로 전환할 때, 신규 `ChatModelSelectorWidget`/`EmbeddingModelSelectorWidget` 가
콤보박스만 렌더하고 **필드 라벨("Embedding/Summary/Extraction Model")과 hint(역할 설명)를
빠뜨렸다**. 표준 위젯(TextWidget 등)은 `<FieldGroup label hint>` 로 이를 렌더하는데, 신규
위젯이 이를 누락 → 사용자가 각 모델이 무슨 용도인지 알 수 없게 됨.

## fix
- `model-selector-widgets.tsx`: 두 위젯을 `FieldGroup`(`../node-configs/shared`)으로 감싸
  `label` + `translateBackendHint(ui?.hint, locale)` + `required` 를 렌더. 콤보박스+경고는
  FieldGroup children 으로.
- 회귀 테스트: 두 위젯이 라벨+hint 를 렌더하는지 단언(19 cases).

## 체크리스트
- [x] FieldGroup 래핑 + 회귀 테스트 (위젯 테스트 17→21, en 라벨+hint / ko hint × 2 위젯)
- [x] TEST WORKFLOW: lint/unit/build/**e2e 205 전원 PASS** (clean, forceExit)
- [x] /ai-review (2 reviewer, LOW, Critical 0) — review/code/2026/06/19/22_42_37/. requirement Warning
      (테스트 hint 픽스처) fix: 실제 schema hint + ko 케이스. RESOLUTION 동봉.
- [x] /consistency-check --impl-done BLOCK:NO — review/consistency/2026/06/19/22_49_22/ (순수 UI 렌더, drift 0).

## 후속 감사 + 수정 (사용자 요청 — 같은 PR #643)
FieldGroup 미사용 custom 위젯 전수 감사 결과 동일 라벨/hint 누락 추가 발견 → 같은 브랜치에서 수정:
- [x] **McpServerSelectorWidget**: 라벨("MCP Servers")+hint 둘 다 누락(내부 라벨 없음) → FieldGroup 래핑.
- [x] **WorkflowSelectorWidget**: schema 라벨("Target Workflow") 누락(ExpressionInput "Workflow ID"는
      별개 내부 라벨) → FieldGroup 래핑.
- [x] **KbSelectorWidget**: 자체 라벨 있음(OK) but schema hint 누락 → 셀렉터 아래 캡션으로 hint 렌더
      (이중 라벨 회피 위해 FieldGroup 미사용).
- [x] LlmConfigSelectorWidget: 자체 라벨 OK + schema hint 미정의 → 무변경(주석만 보강).
- [x] 회귀 테스트: workflow 라벨 단언 + 신규 selector-widgets.test.tsx(mcp 라벨+hint / kb hint).
- [x] selector fix TEST WORKFLOW: lint/unit/build/**e2e 205 PASS** (clean). /ai-review(2 reviewer, LOW,
      Critical/Warning 0) — review/code/2026/06/19/23_08_15/. impl-done BLOCK:NO —
      review/consistency/2026/06/19/23_14_28/ (fix 가 §2.6.1 hint 계약 복원, drift 0).
</content>
