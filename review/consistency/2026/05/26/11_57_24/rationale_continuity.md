# Rationale 연속성 검토 결과

검토 모드: spec draft (--spec)
대상: `plan/in-progress/spec-update-user-guide-mobile.md`
기준 Rationale 원본: `spec/2-navigation/13-user-guide.md`, `spec/2-navigation/_layout.md`, `spec/0-overview.md`

---

## 발견사항

- **[INFO]** `§10 검색` 행 — "현재는 미포함" 표기를 DocsSearch 구현 사실로 정정
  - target 위치: plan §정정 후보 / `spec/2-navigation/13-user-guide.md §10` 검색 행
  - 과거 결정 출처: `spec/2-navigation/13-user-guide.md §10` 의 기존 표기 "현재는 미포함. 콘텐츠 증가 시 별도 추가"
  - 상세: 기존 표기는 "별도 추가"를 예정하는 수사적 표현이므로 DocsSearch 가 실제 구현된 현 시점에 해당 표현을 현실에 맞게 갱신하는 것은 Rationale 상 기각된 대안의 재도입이 아니다. "미포함" 은 당시 구현 미완 사실의 기술이며, 이를 이유로 채택/기각 결정이 존재하지 않는다. 따라서 번복이 아닌 사실 갱신에 해당한다.
  - 제안: 현 plan 의 정정 방향은 정합. 단, plan 에 "기존 '미포함' 표기는 구현 완료 전 사실 기술이므로 결정 번복이 아님" 한 줄을 명시하면 후속 Rationale 연속성 검토에서 불필요한 의문이 생기지 않는다.

- **[INFO]** `§10 모바일 진입` 행 신설 — 기존 spec 에 없는 항목 추가
  - target 위치: plan §정정 후보 / `spec/2-navigation/13-user-guide.md §10` 모바일 진입 행 (신설)
  - 과거 결정 출처: 해당 없음 — `13-user-guide.md` 에는 `## Rationale` 섹션 자체가 존재하지 않으며, 모바일 진입에 대한 어떠한 기각 결정도 기록되어 있지 않다.
  - 상세: 기존 §10 표에 모바일 진입 행이 부재했던 것은 구현이 없었기 때문이므로 이 추가는 공백 채움이다. 기각된 대안의 재도입에 해당하지 않는다.
  - 제안: 이슈 없음. plan 이 의도한 대로 신설 행 + 신규 Rationale R-x 를 함께 작성하는 구조가 올바르다.

- **[INFO]** 신규 `## Rationale` 항목 `R-x` — breakpoint 분리 근거 최초 작성
  - target 위치: plan `## 정정 후보 / spec/2-navigation/13-user-guide.md 신규 ## Rationale 항목`
  - 과거 결정 출처: `spec/2-navigation/_layout.md §2.4` (글로벌 사이드바 breakpoint 1280px 정의) + 동 문서 `## Rationale` (R-1, R-2 — 로고 관련만 존재, breakpoint 근거는 없음)
  - 상세: `_layout.md §2.4` 는 `< 1280px` 에서 글로벌 사이드바가 햄버거로 전환된다고 정의하지만 이 breakpoint 의 선택 근거를 Rationale 에 기록하지 않았다. target plan 이 13-user-guide.md 에 R-x 를 작성하여 `/docs` 내 breakpoint(1024px) 가 글로벌(1280px) 과 다른 이유를 설명하는 것은 신규 Rationale 생성이지 기존 결정 번복이 아니다. 두 Rationale 가 존재하는 서로 다른 spec 파일에 독립적으로 위치하므로 충돌이 없다.
  - 제안: R-x 의 내용(`별 컨텍스트(전역 vs 페이지 내부) 이므로 breakpoint 도 별도`) 은 `_layout.md §2.4` 의 글로벌 breakpoint 정의와 수평 참조(cross-reference)를 추가하면 명확도가 높아진다. 예: "글로벌 사이드바 breakpoint 는 `_layout.md §2.4` 의 단일 진실을 따름."

---

## 요약

target plan `spec-update-user-guide-mobile.md` 가 제안하는 세 가지 변경 — (1) §10 검색 행 갱신, (2) §10 모바일 진입 행 신설, (3) `13-user-guide.md` 에 신규 Rationale R-x 추가 — 은 기존 spec Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 위반하는 요소를 포함하지 않는다. 기존 `13-user-guide.md` 에 `## Rationale` 섹션 자체가 없었고, `_layout.md §2.4` 의 breakpoint 정의도 이에 대한 기각 근거를 적시하지 않았다. 모든 변경은 구현 완료 사실 반영(검색) 과 공백 채움(모바일 진입 + Rationale 신설) 이며, 결정 번복은 없다.

---

## 위험도

NONE
