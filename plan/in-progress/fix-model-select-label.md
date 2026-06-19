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
- [x] FieldGroup 래핑 + 회귀 테스트 (위젯 테스트 17→19)
- [ ] TEST WORKFLOW (lint/unit/build/e2e)
- [ ] /ai-review + (fix)
- [ ] /consistency-check --impl-done
</content>
