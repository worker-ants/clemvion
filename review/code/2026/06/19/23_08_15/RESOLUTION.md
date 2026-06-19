# RESOLUTION — selector 위젯(MCP/Workflow/KB) 라벨·hint 복원

SUMMARY: review/code/2026/06/19/23_08_15/SUMMARY.md (2 reviewer, LOW, Critical/Warning 0).

## 조치 항목 (Info 보강 — Warning 없음)
| 발견 | 심각도 | 조치 |
| --- | --- | --- |
| req: selector-widgets.test.tsx useEditorStore mock 형태 | Info | selector-fn 형태로 교체(미래 안전) |
| maint: Kb 테스트 label prop 누락 | Info | label="Knowledge Bases" 명시 |
| maint: WorkflowSelectorWidget inner div gap-3 의도 불명 | Info | 의도 주석 추가 |

### NO-FIX (근거)
- maint: Kb/LlmConfig 가 label 미구조분해 — 자체 라벨 위젯의 기존 패턴(LlmConfig 선례) 일관, 주석 명시.
- maint: workflow 회귀 테스트 hint 미단언 — workflowId 필드에 schema hint 가 없음(정상).

## TEST 결과
- **lint**: 통과 (54s)
- **unit**: 통과 (60s)
- **build**: 통과 (92s, 직전 full 워크플로) — polish 는 주석/테스트 전용, 런타임 무변경
- **e2e**: 통과 (75s, 205 tests, 직전 full 워크플로 clean — #639 forceExit) — 이후 변경 주석/테스트
  전용으로 백엔드 e2e surface 무변경, carried forward.

## 보류·후속 항목
- 없음 (auto-form custom 위젯 전수 감사 완료 — FieldGroup 누락 위젯 모두 처리).
