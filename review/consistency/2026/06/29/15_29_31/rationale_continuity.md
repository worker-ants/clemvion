### 발견사항

- **[INFO]** R-5 (frontmatter vs 본문 내 컴포넌트) 와 spec-impl-evidence R-10 의 방향 상호 보완 설명 없음
  - target 위치: `spec/conventions/user-guide-evidence.md §2.1` 의 `spec frontmatter user_guide:` 항목
  - 과거 결정 출처: `spec/conventions/spec-impl-evidence.md Rationale R-10` ("user_guide: build-time 가드 미적용")
  - 상세: `user-guide-evidence.md §2.1` 은 "`user_guide:` 는 build-time 가드가 없는 선언적 링크" 라고 적고 그 근거를 `spec-impl-evidence.md §2.1 + Rationale R-10` 으로 위임한다. 이 교차 링크는 정합하나, `user-guide-evidence.md` 의 자체 Rationale (R-1~R-5) 안에는 "왜 `user_guide:` cross-link 에 본 가드를 적용하지 않는가" 를 별도 R-N 으로 두지 않는다. R-10 이 SoT 라는 점은 본문에서 명기되어 있어 충돌은 없지만, 본 문서만 읽는 작성자가 `user_guide:` 가드 미적용 근거를 Rationale 절에서 찾지 못하고 §2.1 주석만 발견하는 탐색 불편이 있다.
  - 제안: `user-guide-evidence.md Rationale` 에 `R-6. user_guide: 경로 가드 미적용 — spec-impl-evidence R-10 위임` 항을 짧게 추가해, 본 문서의 Rationale 절이 가드 적용 범위 전체를 자기 완결적으로 설명하도록 보완. 또는 현 상태 유지(§2.1 인라인 참조로 충분)를 명시적 INFO 로 기록.

- **[INFO]** §5 (`i18n-userguide §Principle 7` 와의 관계) 가 Principle 7 의 기존 "자동 검출 불가" 선언을 번복하지 않음을 명시했으나, Rationale 에 해당 설계 동기가 누락
  - target 위치: `spec/conventions/user-guide-evidence.md §5`
  - 과거 결정 출처: `spec/conventions/i18n-userguide.md §Principle 7` — "page stale 자동 검출 불가" (manual 분류)
  - 상세: 본 컨벤션은 §5에서 "GUI 흐름 절 안의 약속은 본 가드가 검출해 Principle 7 을 부분 보완" 이라고 적는다. Principle 7 의 자동 가드 요약표(i18n-userguide.md)도 이미 이 관계를 반영했다. 그러나 user-guide-evidence.md 의 Rationale 절에는 "왜 개념 설명 절은 여전히 커버 대상 외인가" 에 대한 별도 R-N 이 없다. 현행 R-4 가 "integrations + triggers 만 coverage 가드 대상인 이유" 를 설명하지만, "GUI 흐름 절로 가드 범위를 제한한 이유" (개념 설명 절은 NLP 감지가 fragile 하고 Principle 7 이 reviewer 로 처리 중) 는 명시적으로 없다.
  - 제안: R-4 에 "개념 설명 절 커버 불포함 이유" 한 줄을 추가하거나, §5 에 인라인으로 보강. 합의된 원칙을 번복하지 않으므로 INFO.

### 요약

`spec/conventions/user-guide-evidence.md` 는 과거 spec 의 Rationale 에서 명시적으로 기각된 대안을 재도입하지 않으며, 합의된 설계 원칙(frontmatter vs 본문 안 컴포넌트 배치·`return null` 비렌더·symbol grep 분리·2개 카테고리 우선 가드·`user_guide:` 가드 미적용)을 일관되게 따른다. spec-impl-evidence 의 R-10 (`user_guide:` 가드 미적용)과의 교차 참조는 §2.1 인라인에서 명시적으로 위임하고 있어 암묵적 충돌이 없다. i18n-userguide Principle 7 ("page stale 자동 검출 불가")도 번복 없이 부분 보완 관계로만 정의한다. 발견된 항목은 모두 Rationale 절의 자기 완결성 보완 제안(INFO)이며 CRITICAL/WARNING 수준의 원칙 충돌·기각 대안 재도입은 없다.

### 위험도

NONE
