# Cross-Spec 일관성 검토 결과

target: `spec/conventions/i18n-userguide.md` (draft)

---

## 발견사항

### [WARNING] Principle 7 자동 가드 요약 표가 현재 커밋된 본문과 불일치

- **target 위치**: 자동 가드 요약 표 — Principle 7 행 / Principle 7 본문 `findGuiFlowSections()` 설명
- **충돌 대상**: `spec/conventions/i18n-userguide.md` (현재 커밋 버전) 의 동일 표 Principle 7 행
- **상세**:
  - 현재 커밋된 `spec/conventions/i18n-userguide.md` 의 자동 가드 요약 표 Principle 7 행은 `"—"` / `"manual / reviewer"` 로 기록되어 있다.
  - draft 는 동일 행을 `"GUI 흐름 절: impl-anchor-existence.test.ts / integrations-coverage.test.ts / triggers-coverage.test.ts (SoT: user-guide-evidence.md). 개념 설명 절: —"` + `"hard fail (GUI 흐름 절) / manual (개념 설명 절)"` 로 갱신한다.
  - `spec/conventions/user-guide-evidence.md §2` 는 `integrations-coverage.test.ts` / `triggers-coverage.test.ts` 를 Principle 7 GUI 흐름 절에 대한 build-time 가드로 이미 정의하고 있으므로, 현재 커밋된 `i18n-userguide.md` 의 "—" 표기가 `user-guide-evidence.md` 와 **내부 모순** 상태다.
  - draft 가 이 모순을 해소하는 방향이므로 draft 자체가 틀린 것은 아니나, draft 채택 시 현재 커밋된 `i18n-userguide.md` 를 정확히 이 행만 교체해야 한다 — 두 버전이 동시에 존재하는 과도기 동안 어느 쪽이 SoT 인지 혼란을 줄 수 있다.
- **제안**: draft 를 채택해 커밋된 파일을 갱신하는 것이 올바른 방향. 갱신 후 `user-guide-evidence.md §2` 와 일치 여부를 재확인.

---

### [WARNING] Principle 7 본문의 `findGuiFlowSections()` 판별 설명이 현재 커밋 버전과 다름

- **target 위치**: Principle 7 본문 `findGuiFlowSections()` 설명 문장
- **충돌 대상**: `spec/conventions/i18n-userguide.md` (현재 커밋 버전) Principle 7 본문
- **상세**:
  - 현재 커밋 버전: `"(가이드 본문이 \`**GUI ...**\` strong 패턴으로 시작하거나 heading 에 \`GUI\` 키워드를 가진 절)"`
  - draft 버전: `"두 신호 OR — (1) h2/h3 heading 텍스트에 bareword \`GUI\` 포함, 또는 (2) 절 본문 **어디든** \`GUI\` 를 포함한 bold strong 존재; 판별 정의 SoT 는 user-guide-evidence.md §2"`
  - `spec/conventions/user-guide-evidence.md §2` 의 실제 정의는 draft 의 설명과 일치한다. 현재 커밋 버전의 "strong 패턴으로 **시작하거나**" 라는 표현은 "절 본문 **어디든**" 이라는 실제 가드 동작과 미묘하게 다를 수 있어 가이드 작성자에게 오해를 줄 수 있다.
- **제안**: draft 설명이 더 정확하므로 채택 권장. 현재 커밋 버전의 표현을 draft 로 교체한다.

---

### [INFO] 자동 가드 요약 표 Principle 1 행의 가드 코드명 혼용

- **target 위치**: 자동 가드 요약 표 Principle 1 행
- **충돌 대상**: 해당 없음 (내부 일관성 주의)
- **상세**: 요약 표 Principle 1 행은 `hardcoded-korean-ratchet.test.ts` 를 가리키며 `(P2-b, hardcoded-korean-baseline.json)` 라는 괄호 주석을 달고 있다. "P2-b" 는 Principle 2-b 를 뜻하는데, 표의 행 레이블은 "1 (TSX 하드코딩)" 이다. 이 비대칭은 draft 와 현재 커밋 버전 모두 동일하게 존재하며, spec 내부에서 Principle 번호 체계가 변경된 이력의 흔적으로 보인다. 혼란을 줄이려면 "P2-b" 주석을 제거하거나 "P1-b" 로 정정하는 것이 바람직하다.
- **제안**: 별도 PR 에서 "P2-b" → "P1-b" 또는 제거.

---

### [INFO] Principle 3-C 의 `params` 노출 의무와 `cross-node-warning-rules.md` 의 연계 명시 부재

- **target 위치**: Principle 3-C 보간 계약 항목
- **충돌 대상**: `spec/conventions/cross-node-warning-rules.md` (GraphWarningRule 타입 정의)
- **상세**: Principle 3-C 는 `graphWarningRules[].message` 에 `params: Record<string, string | number>` 가 함께 노출될 것을 요구한다. `cross-node-warning-rules.md` 의 `GraphWarningRule` 타입 정의가 실제로 `params` 필드를 포함하는지 명시적으로 교차 참조하는 문구가 없다. 타입 정의가 `params` 를 지원하지 않으면 P3-C 보간 계약이 실현 불가능해진다. draft 와 현재 커밋 버전 모두 동일하게 이 참조가 없다.
- **제안**: `cross-node-warning-rules.md` 의 `GraphWarningRule` 인터페이스에 `params` 필드 포함 여부 확인 후, Principle 3-C 본문에 참조 링크 추가를 권장.

---

## 요약

target 문서(`spec/conventions/i18n-userguide.md` draft)는 다른 spec 영역과 직접 모순되는 CRITICAL 충돌은 없다. 주요 발견은 두 건의 WARNING — 모두 draft 가 현재 커밋된 동일 파일의 Principle 7 기술을 정정하는 방향이며, `spec/conventions/user-guide-evidence.md §2` 의 실제 정의와 정합하도록 동기화하는 내용이다. 달리 말해 draft 는 현재 커밋된 `i18n-userguide.md` 와 `user-guide-evidence.md` 사이에 이미 존재하던 불일치를 해소하므로, draft 채택 자체가 일관성을 높이는 방향이다. INFO 사항 2건은 별도 PR 로 처리 가능한 명명·참조 미비다.

## 위험도

LOW
