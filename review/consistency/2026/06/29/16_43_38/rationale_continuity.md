# Rationale 연속성 검토 결과

검토 대상: `spec/conventions/i18n-userguide.md`
검토 기준 Rationale 출처: `spec/conventions/i18n-userguide.md ## Rationale`, `spec/conventions/user-guide-evidence.md ## Rationale`

---

## 변경 범위 (diff 요약)

origin/main 대비 두 줄만 변경됨:

1. **Principle 7 "GUI 흐름 절" 판별 기준 서술 갱신** (line 172): 구 표현 `(가이드 본문이 **GUI ...** strong 패턴으로 시작하거나 heading 에 GUI 키워드를 가진 절)`을 `findGuiFlowSections()` 의 두 신호 OR 정의 `((1) h2/h3 heading bareword GUI, (2) 절 본문 어디든 GUI 포함 bold strong)` 으로 정밀화하고, 판별 정의 SoT 를 `user-guide-evidence.md §2` 로 명시.
2. **자동 가드 요약 표 Principle 7 행 갱신** (line 189): 구 표현 `— / manual / reviewer` 에서 세 테스트 파일(`impl-anchor-existence.test.ts` / `integrations-coverage.test.ts` / `triggers-coverage.test.ts`) 을 명시하고 `hard fail (GUI 흐름 절) / manual (개념 설명 절)` 로 분리.

---

## 발견사항

발견된 Rationale 연속성 위반 사항이 없습니다.

**변경 1 — GUI 판별 기준 정밀화**: 구 서술은 `**GUI ...**` 패턴이 절 **시작**에 있어야 한다는 좁은 기준을 내포하고 있었다. `user-guide-evidence.md §2` (line 70)의 `findGuiFlowSections()` SoT 는 처음부터 절 본문 **어디든** strong 이 있으면 인정하는 두 신호 OR 정의였다. 이번 변경은 i18n-userguide.md 의 기술을 SoT 에 맞게 정렬한 것으로, 과거 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 설계 원칙을 위반하지 않는다.

**변경 2 — 자동 가드 표 갱신**: 과거 표에 `—` 로 기입된 것은 "Principle 7 에는 자동 가드를 두지 않는다"는 결정이 아니라, `user-guide-evidence.md` 가 합의된 시점에 표가 갱신되지 않은 문서 지연이었다. `user-guide-evidence.md Rationale R-4` (line 183~185)는 명시적으로 "GUI 흐름 절 자동 가드 + 개념 설명 절 수동 검수" 의 분리를 설계 의도로 기록하고, 이를 `i18n-userguide.md §Principle 7 와 동일 경계` 로 선언하고 있다. 따라서 표 갱신은 두 문서 간 드리프트를 해소하는 동기화이며, 기각된 대안 재도입이나 무근거 번복이 아니다.

---

## 요약

target 의 두 변경은 모두 `spec/conventions/user-guide-evidence.md` 의 기존 Rationale(R-4) 및 §2 SoT 정의와 i18n-userguide.md 사이의 기술 불일치를 해소하는 동기화다. 과거 Rationale 에서 기각된 대안(예: 절 전체 GUI 페이지 hard fail, 단일 테이블 통합 가드, 수동-only 영구 정책 등)을 재도입하지 않으며, 합의된 invariant(영문 SoT, parity hard fail, 점진적 0화 ratchet)에 영향을 주지 않는다. Rationale 연속성 관점에서 차단할 사항이 없다.

---

## 위험도

NONE
