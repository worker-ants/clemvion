# Rationale 연속성 검토 결과

검토 대상: `spec/conventions/user-guide-evidence.md`
검토 기준: 기존 spec Rationale 에서 기각·합의된 결정과의 연속성

---

### 발견사항

- **[INFO]** §5 "후속 갱신" 약속이 이미 완료된 상태 — 문서 내 future tense 불일치
  - target 위치: `spec/conventions/user-guide-evidence.md §5` 마지막 문장 ("후속으로 `i18n-userguide.md §Principle 7` 본문에 본 가드의 부분 커버 범위를 명시한다")
  - 과거 결정 출처: `spec/conventions/i18n-userguide.md §Principle 7` 본문 (자동 검출 — 부분 커버 절)
  - 상세: target §5 는 "후속으로 i18n-userguide.md §Principle 7 본문에 본 가드의 부분 커버 범위를 명시한다" 라고 future tense 로 선언하지만, `i18n-userguide.md §Principle 7` 본문은 이미 `<ImplAnchor>` 3개 가드(`impl-anchor-existence`, `integrations-coverage`, `triggers-coverage`)를 "부분 커버" 로 명시하고 있다. 해당 내용은 현재 i18n-userguide.md 에 반영 완료된 상태이므로 §5 의 future tense 가 stale 한 상태다. (합의 원칙 위반이나 기각된 대안 재도입은 아님 — 단순 문서 동기화 미완)
  - 제안: §5 마지막 문장을 "후속으로 ... 명시한다" 에서 "본 갱신은 `i18n-userguide.md §Principle 7` 에 이미 반영됐다" 또는 해당 문장 삭제로 정리.

- **[INFO]** §5 vs `i18n-userguide.md` 자동 가드 요약 표 Row 7 불일치 — 가드 자동화 여부 신호 엇갈림
  - target 위치: `spec/conventions/user-guide-evidence.md §5` (GUI 흐름 절 → anchor 가드로 §Principle 7 부분 보완 선언)
  - 과거 결정 출처: `spec/conventions/i18n-userguide.md` "자동 가드 요약" 표, Principle 7 행 (`— | manual / reviewer`)
  - 상세: i18n-userguide.md 의 §Principle 7 본문은 `<ImplAnchor>` 가드가 부분 자동 커버함을 명시하고 있으나, 같은 문서 내 "자동 가드 요약" 표의 Row 7 은 여전히 `— | manual / reviewer` 로 표기되어 있어 내부 불일치가 발생한다. user-guide-evidence.md 가 §5 에서 이 관계를 언급하므로 gap 이 target 에 의해 간접적으로 포인트된다. (기각된 대안의 재도입이나 합의 원칙 위반은 아니나, 가드 자동화 현황에 대한 두 위치의 신호가 모순이라 외부 검토자 혼란 유발 가능)
  - 제안: `i18n-userguide.md` 의 자동 가드 요약 표 Row 7 을 `impl-anchor-existence + integrations-coverage + triggers-coverage (GUI 흐름 절 한정) | hard fail (부분) / manual (개념 절)` 로 갱신. 이는 target 문서가 아닌 `i18n-userguide.md` 측의 수정 사안.

- **[INFO]** R-5 (`<ImplAnchor>` 본문 안 vs frontmatter) 결정 — spec-impl-evidence R-6 과의 관계 언급 부재
  - target 위치: `spec/conventions/user-guide-evidence.md ##Rationale R-5`
  - 과거 결정 출처: `spec/conventions/spec-impl-evidence.md ##Rationale R-6` ("code: 의미 도메인" — user-guide MDX `code:` 와 spec `.md` `code:` 가 같은 키 이름이지만 다른 invariant 라 통합하지 않음)
  - 상세: R-5 는 frontmatter `anchors:` 배열 대신 본문 내 컴포넌트를 선택한 이유를 설명한다. 이는 spec-impl-evidence R-6 이 이미 "user-guide MDX `code:` 와 spec `.md` `code:` 를 동일 키 이름으로 공유하되 통합하지 않는다" 고 결정한 방향과 원칙적으로 일치한다. 그러나 R-5 본문이 R-6 을 교차 참조하지 않아, frontmatter-anchor 기각 이유가 spec-impl-evidence 의 "frontmatter 는 다른 목적의 invariant 에 이미 사용됨" 원칙과 연결되지 않는다. 기각 이유 (문맥 손실) 는 충분히 독자적이라 모순이 아니지만, Rationale 사슬의 완전성 측면에서 보완 여지.
  - 제안: R-5 에 "spec-impl-evidence R-6 이 이미 user-guide frontmatter `code:` 를 별도 invariant 로 확립했으므로, frontmatter 에 anchor 배열을 추가하면 두 도메인 간 경계가 모호해진다" 라는 한 문장 추가 (선택적).

---

### 요약

`spec/conventions/user-guide-evidence.md` 는 기존 Rationale 에서 명시적으로 기각된 대안(frontmatter `anchors:` 배열, CSS `display: none`, `kind` 세분화, `/toggle` endpoint, `per-node` task queue 등)을 재도입하지 않으며, `spec-impl-evidence` R-6·R-10, `i18n-userguide` Principle 7 등 합의된 설계 원칙과 전반적으로 정합한다. 발견된 사항은 모두 INFO 등급이며, §5 의 "후속 갱신" 문장이 이미 완료된 사실을 가리키는 future tense stale 과, `i18n-userguide.md` 자동 가드 요약 표 Row 7 이 Principle 7 본문과 불일치하는 내부 조각이 전부다. 기각된 결정의 재도입이나 합의 invariant 직접 위반은 없다.

### 위험도

LOW
