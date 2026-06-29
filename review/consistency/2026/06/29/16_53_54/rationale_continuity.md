# Rationale 연속성 검토 결과

검토 대상: `spec/conventions/i18n-userguide.md`
검토 모드: spec draft 검토 (--spec)
검토 기준 Rationale 출처: `spec/conventions/i18n-userguide.md ##Rationale`, `spec/conventions/cross-node-warning-rules.md ##Rationale`, `spec/conventions/user-guide-evidence.md ##Rationale`, 및 prompt payload 에 포함된 관련 spec Rationale 발췌

---

## 변경 범위 (diff 기준)

`origin/main` 대비 3곳 변경:

1. **Principle 3-C 보간 계약 bullet** (line 99) — `GraphWarningRule.evaluate` 반환 타입과 `cross-node-warning-rules.md` SoT 포인터를 괄호 보충으로 추가.
2. **Principle 7 GUI 흐름 절 설명** (line 172) — 기존 느슨한 패턴 기술을 `findGuiFlowSections()` 두 신호 OR 정의(SoT: `user-guide-evidence.md §2`)로 교체.
3. **자동 가드 요약 표 Principle 7 행** (line 189) — `— | manual / reviewer` 에서 세 테스트 파일 명시 + `hard fail (GUI 흐름 절) / manual (개념 설명 절)` 분리로 갱신.

---

## 발견사항

발견된 Rationale 연속성 위반 없음.

각 변경에 대한 검토 내용:

**변경 1 — Principle 3-C 보간 계약 SoT 포인터 추가**
- `cross-node-warning-rules.md ##Rationale` 는 `backend Accept-Language 서버 localization 을 기각`하고 `params 분리 + ruleId 키` 를 채택했다. 새 괄호 보충은 이 결정의 타입 SoT 위치만 명시하며, 기각된 대안(서버 localization)을 재도입하거나 채택 결정(params 분리)을 번복하지 않는다. 영문 SoT invariant 유지됨.
- `i18n-userguide.md ##Rationale "왜 영문 SoT 인가"` 와 충돌 없음.

**변경 2 — Principle 7 GUI 흐름 절 탐지 정의 갱신**
- 기존 텍스트는 `**GUI ...**` strong 패턴으로 시작하거나 heading 에 `GUI` 가 있는 절 이라 기술했다. `user-guide-evidence.md §3` 가 `findGuiFlowSections()` 의 두 신호 OR 를 정식 정의로 확정했으며, 새 텍스트는 그 정의를 i18n-userguide.md 에 반영한 것이다.
- 이전 기술에서 암시된 `strong 패턴으로 시작` 조건이 `절 본문 어디든` 으로 확장되었으나, 이는 `user-guide-evidence.md` 의 기존 정의와 일치하므로 기각된 대안의 재도입이 아니라 SoT 문서와의 동기화다.
- `user-guide-evidence.md ##Rationale` 의 "개념 설명 절은 자동 검출 불가" 경계가 그대로 유지된다.

**변경 3 — 자동 가드 요약 표 Principle 7 행 현행화**
- 기존 `— | manual / reviewer` 는 `user-guide-evidence.md` 에서 세 테스트(`impl-anchor-existence.test.ts`, `integrations-coverage.test.ts`, `triggers-coverage.test.ts`)가 구현된 사실을 반영하지 못한 stale 상태였다. 새 행은 이미 합의·구현된 사실을 표에 반영한 것이며, 새 가드를 도입하거나 기존 가드를 교체하는 것이 아니다.
- `i18n-userguide.md ##Rationale "왜 P2-b 는 hard fail 이 아닌 ratchet 인가"`, `"왜 .en.mdx sibling 누락은 위반이 아닌가"` 등 기존 Rationale 모두 영향받지 않는다.

---

## 요약

`spec/conventions/i18n-userguide.md` 의 세 변경 모두 기존 Rationale 에서 합의된 결정을 번복하거나 기각된 대안을 재도입하지 않는다. 변경 1은 `cross-node-warning-rules.md` 의 `params 분리` 결정을 강화하는 SoT 포인터 추가이고, 변경 2는 `user-guide-evidence.md §2` 가 이미 확정한 `findGuiFlowSections()` 두 신호 OR 정의를 본문에 동기화한 것이며, 변경 3은 구현 완료된 세 가드 테스트를 요약 표에 반영한 stale 정정이다. 영문 SoT invariant, hard fail vs ratchet 분리, .en.mdx 미위반 원칙, 개념 설명 절 수동 검수 경계 등 모든 핵심 합의 원칙이 유지된다.

---

## 위험도

NONE
