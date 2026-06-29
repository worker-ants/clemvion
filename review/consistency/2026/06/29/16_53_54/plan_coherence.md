# Plan 정합성 검토 결과

검토 대상: `spec/conventions/i18n-userguide.md`
검토 시점: 2026-06-29

## 변경 내용 요약

이번 브랜치(`claude/spec-userguide-residual-closeout-e723f5`)의 `i18n-userguide.md` 변경은 총 3건이다:

1. **Principle 3-C "보간 계약" bullet** — `params` 노출 문장에 `GraphWarningRule.evaluate` 반환 타입 정의처(`cross-node-warning-rules.md`)로의 정방향 cross-ref 링크 추가.
2. **Principle 7 "GUI 흐름 절" 서술** — `findGuiFlowSections()` 의 두 신호(heading `GUI` OR 절 본문 bold strong `GUI`) 정의로 확장하고 SoT 명시.
3. **자동 가드 요약표 Principle 7 행** — `— / manual` 에서 GUI 흐름 절 hard fail 3건과 개념 설명 절 manual 로 분리 갱신.

---

## 발견사항

### [INFO] parallel-p2-followups.md §6 의 Principle 3-C 체크박스 — 이미 완료 처리, 충돌 없음

- target 위치: `spec/conventions/i18n-userguide.md` Principle 3-C "보간 계약" bullet
- 관련 plan: `/Volumes/project/private/clemvion/plan/in-progress/parallel-p2-followups.md` §6 (line 36)
- 상세: `parallel-p2-followups.md §6` 은 `i18n-userguide.md Principle 3-C` 확정을 `[x]` 완료로 기록한다. 이번 변경은 `cross-node-warning-rules.md` 를 향한 정방향 링크를 보강한 것으로, 이미 완료된 architecture 결정에 추적 링크를 추가하는 것이지 미해결 결정을 일방적으로 내리는 행위가 아니다. 역방향 링크(`cross-node-warning-rules.md` → `i18n-userguide.md`)는 이미 main 에 존재하므로 양방향 완성이다.
- 제안: 변경 불요. plan 은 이미 완료(`[x]`) 상태이며 target 변경과 정합.

### [INFO] Principle 7 서술 강화 — user-guide-evidence.md §2 와의 동기화, 미해결 결정 없음

- target 위치: `spec/conventions/i18n-userguide.md` Principle 7 "GUI 흐름 절" bullet 및 가드 요약표
- 관련 plan: 직접 연관된 `plan/in-progress` 파일 없음. `spec/conventions/user-guide-evidence.md` §2 의 기정의(`findGuiFlowSections()` 두 신호) 를 i18n-userguide 서술에 동기화하는 것이므로 미해결 결정 우회가 아니다.
- 상세: `user-guide-evidence.md` 의 `findGuiFlowSections()` 두 신호 정의(line 70)는 이미 main 에 확정돼 있다. i18n-userguide Principle 7 이 그 정의를 요약으로만 참조하던 것을 정밀화한 것. 어떤 in-progress plan 도 이 서술의 "결정 필요" 상태를 보유하지 않는다.
- 제안: 변경 불요.

---

## 요약

`spec/conventions/i18n-userguide.md` 의 이번 변경 3건은 (a) 이미 `[x]` 완료된 Principle 3-C 아키텍처 결정에 cross-ref 링크를 추가하고, (b) 이미 `user-guide-evidence.md §2` 에 확정된 `findGuiFlowSections()` 정의를 Principle 7 서술에 반영하며, (c) 가드 요약표를 현실 구현 상태에 맞게 갱신한 것이다. `plan/in-progress/` 의 어떤 파일도 이 세 항목을 "결정 필요" 또는 "미해소 선행 조건"으로 보유하지 않으며, 후속 plan 을 무효화하거나 새 후속 항목을 요구하는 부수 효과도 없다.

## 위험도

NONE
