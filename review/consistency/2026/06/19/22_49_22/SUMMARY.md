# Consistency Check (--impl-done) — 모델 select 위젯 라벨·hint 복원

**대상**: fix 코드 diff vs spec. 검토자: cross-spec (focused — 순수 UI 렌더 복원, spec 무변경).

## BLOCK: NO

cross-spec NO-BLOCK (NONE). spec drift 0.

## 확인
- FieldGroup 래핑은 순수 render-layer 변경 — widget 식별자(chat/embedding-model-selector)·저장
  형태(모델명 문자열)·런타임 resolve·WidgetProps 시그니처·backend schema 무변경.
- 표준 위젯(TextWidget/SelectWidget 등)의 FieldGroup(label, hint, required) 패턴과 일관.
- spec §2.6.1(`hint`="항상 노출 캡션") 계약을 **더 잘 충족**하는 방향 — 회귀 전엔 hint 미노출이었음.
- spec 4문서(node-common §2.6 / ai-agent §1·§12.12 / IE §1 / 17-agent-memory §3)와 모순 0.

## 결론
fix ↔ spec 정합. SPEC-CONSISTENCY 게이트 통과(BLOCK: NO).
</content>
