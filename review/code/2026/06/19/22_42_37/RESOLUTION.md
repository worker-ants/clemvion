# RESOLUTION — 모델 select 위젯 라벨·hint 복원 (PR #642 회귀)

SUMMARY: `review/code/2026/06/19/22_42_37/SUMMARY.md` (2 reviewer, 전체 LOW, Critical 0).

## 조치 항목

| SUMMARY 발견 | 심각도 | 조치 |
| --- | --- | --- |
| requirement: 회귀 테스트 hint 픽스처가 실제 schema hint 보다 짧음 | Warning | 실제 `agent-memory-schema.ts` hint(summary/embedding) 사용 + ko locale 케이스 추가(HINT_KO 번역 렌더 단언). 위젯 테스트 17→21 cases |

### NO-FIX / 후속 (범위 외)
- maintainability I: `WorkflowSelectorWidget`(Sub-Workflow 노드)도 FieldGroup 미사용 → 동일
  라벨 누락 가능성. **#642 이전부터의 별개 위젯/노드라 본 PR 범위 밖** — 사용자에게 별도
  확인 권고로 보고.
- maintainability I: LlmConfig/Kb/Mcp selector 는 내부 자체 라벨이라 FieldGroup 불필요(정당).

## TEST 결과
- **lint**: 통과 (44s)
- **unit**: 통과 (49s) — 위젯 21 cases 포함
- **build**: 통과 (142s, 직전 full 워크플로) — 테스트 강화는 .test.tsx 전용이라 런타임 무변경
- **e2e**: 통과 (74s, 205 tests, 직전 full 워크플로 clean — forceExit) — 이후 변경 테스트 .tsx
  전용으로 백엔드 e2e surface 무변경, carried forward.

## 보류·후속 항목
- WorkflowSelectorWidget 라벨 누락 가능성 — 별도 확인/PR 후보(다른 노드).
</content>
