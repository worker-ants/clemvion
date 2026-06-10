# 정식 규약 준수 검토 — `plan/in-progress/spec-update-ws-resumed-ack.md`

검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-06-10

---

## 발견사항

### [INFO] 검토 관점 4 (API 문서 규약) — 해당 없음
- target 위치: 전체 문서
- 위반 규약: 해당 없음
- 상세: target 은 plan 문서이므로 OpenAPI/Swagger 데코레이터·DTO 명명 패턴 규약 검토 대상이 아님. 이 관점은 적용 불가.
- 제안: 해당 없음.

---

### [INFO] 미완료 체크박스 없음 — 완료 기준 확인 필요
- target 위치: `## 검증·후속` 섹션 (line 56–62)
- 위반 규약: `.claude/docs/plan-lifecycle.md §2`
- 상세: `## 검증·후속` 섹션에 "없으면 본 항목으로 종결" 조건부 분기가 있다. 체크박스(`[ ]`) 는 존재하지 않고 서술형으로 기술돼 있어, plan-lifecycle §2 의 "미체크 체크박스 하나라도 있으면 in-progress" 기준상 형식 위반은 없다. 다만 "프론트 가드 확인(읽기)" 항목이 아직 실행되지 않은 작업으로 읽히는데, 이를 서술형이 아닌 `[ ]` 체크박스로 표현하지 않은 점은 plan-lifecycle §2 의 분류 기준 추적 가독성을 낮춘다.
- 제안: "프론트 가드 확인" 항목을 `- [ ] 프론트 가드 확인: ...` 형식의 체크박스로 변환하면 완료 이동 판단 자동화(가드) 및 인간 추적 모두 명확해진다. 현재 상태로도 규약 위반은 아님.

---

### [INFO] `## 배경 — 모순 2건` 절 — Overview 섹션 명명 비대칭
- target 위치: line 17 (`## 배경 — 모순 2건`)
- 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장
- 상세: 3섹션 권장(Overview / 본문 / Rationale)은 **spec** 문서에 대한 권장 구조이며, plan 문서에 대한 명시적 강제는 없다. plan 문서가 `## 배경`, `## 변경안`, `## 검증·후속`, `## Rationale` 로 구성된 것은 plan 내용 특성상 자연스러운 구조다. 기술적 위반은 아니나, `## 배경` 을 `## Overview` 로 통일하면 일관성이 높아진다.
- 제안: plan 문서이므로 현행 구조 유지 무방. 규약 갱신이 필요하다면 CLAUDE.md 에 "plan 문서의 섹션 권장 명칭" 을 별도로 명시하는 것을 고려.

---

### [INFO] `spec_impact` 관련 주석이 frontmatter 내부가 아닌 본문 상단 blockquote 로 배치
- target 위치: line 7–9 (blockquote `> **대상 spec** ...`)
- 위반 규약: `.claude/docs/plan-lifecycle.md §4` (spec_impact 는 완료 시점 frontmatter 선언)
- 상세: plan-lifecycle §4 는 `spec_impact` 를 완료 시점(`complete/` 이동 시) 에 frontmatter 에 선언하도록 규정하며, in-progress 단계엔 의무가 없다. target 문서는 이를 올바르게 인지하고 본문 상단 blockquote 로 "나중에 추가할 예정" 임을 메모해두고 있다. 규약 위반은 아님. 단, 이 메모가 frontmatter 필드가 아닌 본문에 위치하므로 `plan-frontmatter.test.ts` 가드는 이를 검증하지 않는다 — 완료 이동 시 실제 frontmatter 에 추가되는지 사람이 확인해야 한다.
- 제안: 현재 접근 방식은 허용 범위 내. 완료 이동(Gate C) 시 blockquote 를 제거하고 frontmatter 에 `spec_impact:` 를 실제 추가하도록 주의 필요.

---

## 요약

`plan/in-progress/spec-update-ws-resumed-ack.md` 는 정식 규약(`spec/conventions/`, `.claude/docs/plan-lifecycle.md`, `CLAUDE.md`)을 전반적으로 준수하고 있다. frontmatter 필수 3필드(`worktree`, `started`, `owner`)가 모두 정확하게 선언돼 있고, `started: 2026-06-10` 이 Gate C 적용 기준일(2026-06-04) 이후이므로 완료 이동 시 `spec_impact` 선언 의무가 적용된다는 점을 본문 blockquote 로 명시적으로 인지하고 있다. 명명 규약·출력 포맷 규약·API 문서 규약은 plan 문서 성격상 적용 대상이 아니거나 위반 없음. 발견된 사항은 모두 INFO 수준의 가독성 개선 제안으로, 채택 필수 항목은 없다. 규약에서 명시적으로 금지한 패턴(빈 `spec_impact`, 잘못된 frontmatter sentinel, `plan/` 루트 직배치 등)은 없음.

---

## 위험도

NONE
