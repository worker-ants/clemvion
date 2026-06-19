# AI Review SUMMARY — 모델 select 위젯 라벨·hint 복원 (PR #642 회귀 fix)

**대상**: `git diff origin/main...HEAD`. 리뷰어: maintainability / requirement (2종, bg bgIsolation →
텍스트 반환 + main 기록).

## 전체 위험도: LOW (Critical 0)

| reviewer | risk | 결과 |
| --- | --- | --- |
| maintainability | LOW | fix 정확·표준 위젯(TextWidget 등) FieldGroup 패턴과 일관, import/구조분해 정확. 렌더 순서 라벨→combobox→경고→hint 자연스러움. 전부 Info |
| requirement | LOW | 세 필드 라벨+hint 복원 완전 충족, KO/EN 번역 경로 정확(LABEL_KO·HINT_KO 등록 확인), 경고 보존. Warning 1(테스트 hint 픽스처) |

## 조치 (FIX 적용)
- **[requirement W]** 회귀 테스트 hint 픽스처가 실제 schema hint 보다 짧아 ko 번역 파이프라인 미검증
  → 실제 `agent-memory-schema.ts` hint(summary/embedding) 사용 + **ko locale 케이스 추가**(HINT_KO
  번역 렌더 단언). 회귀 테스트 17→21 cases(en 라벨+hint / ko hint × 2 위젯).

## NO-FIX / 후속 (범위 외)
- **[maintainability I] WorkflowSelectorWidget(Sub-Workflow 노드)도 FieldGroup 미사용** — schema
  필드 라벨 누락 가능성(동일 회귀 위험). 단 #642 이전부터 존재한 별개 위젯/노드 → 본 fix 범위 밖.
  **사용자에게 별도 확인 권고로 보고**(다른 노드라 본 PR 에 끼우지 않음).
- **[maintainability I]** LlmConfig/Kb/Mcp SelectorWidget 은 내부 컴포넌트가 자체 라벨 보유 →
  FieldGroup 불필요(설계상 정당, 모순 아님). 주석 보강은 선택적.

## 결론
회귀 원인(FieldGroup 누락) 정확 진단·복원. 표준 위젯 패턴 일관, 라벨+hint KO/EN 렌더 검증.
저장 형태·런타임·경고 기능 무변경.
</content>
