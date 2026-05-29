# 정식 규약 준수 검토 결과

검토 대상: `plan/in-progress/spec-draft-mail-send-status.md`
검토 모드: spec draft 검토 (--spec)
검토 일자: 2026-05-29

---

## 발견사항

### [INFO] 체크박스 항목 없음 — 진행 추적 불가
- target 위치: 문서 전체 (변경 1~6 + side-effect 점검 결과 섹션)
- 위반 규약: `.claude/docs/plan-lifecycle.md §2` — "미체크 체크박스(`[ ]`), 'TODO', '남은 작업' … 항목이 하나라도 있으면 `in-progress/`"
- 상세: `plan-lifecycle.md §2` 는 `in-progress/` 문서가 미완 항목을 체크박스로 추적할 것을 전제한다. `plan/complete/` 이동 자가 점검(§5)도 "모든 체크박스가 `[x]`인가"를 기준으로 한다. 본 문서는 변경 1~6 을 서술형으로만 나열하고 `[ ]` / `[x]` 체크박스가 전혀 없어, 어느 변경이 완료됐는지 추적 불가. 완료 시 `plan/complete/` 이동 기준이 모호해진다.
- 제안: 변경 1~6 을 `- [ ] 변경 1 — ...` 형태 체크박스로 변환. 완료된 항목은 즉시 `[x]` 로 표시.

### [INFO] `## Rationale (draft 자체)` — 비표준 섹션 제목
- target 위치: 문서 마지막 섹션 (`## Rationale (draft 자체)`)
- 위반 규약: `CLAUDE.md §정보 저장 위치` — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`". 각 SKILL.md 의 "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 패턴.
- 상세: 관용 섹션 제목은 `## Rationale` 이며, 괄호 부가어 `(draft 자체)` 는 표준 패턴과 다르다. plan 문서는 spec 문서와 달리 3섹션 패턴이 강제되지 않으나, 동일 규약이 있는 영역의 일관성을 위해 단순화가 바람직하다.
- 제안: `## Rationale` 로 단순화. 또는 plan 문서가 Rationale 섹션 제목을 달리 사용할 수 있다는 점이 의도라면 규약 변경 불필요(INFO 수준으로 무시 가능).

---

## 요약

`plan/in-progress/spec-draft-mail-send-status.md` 는 CLAUDE.md 의 plan frontmatter 스키마(`worktree`, `started`, `owner`) 를 모두 갖추고 있으며, 문서 구조(Overview / 본문 변경 서술 / Rationale) 도 대체로 규약에 부합한다. 에러 코드 형식(`UPPER_SNAKE_CASE`), namespace 구분(`IntegrationTestResult.code` vs 노드 런타임 `ErrorCode`), `node-output.md §3.2` error envelope 불변 준수 여부 등 출력 포맷 규약은 본 draft 가 제안하는 변경 내용 내에서 올바르게 기술되어 있다. 발견된 두 건은 모두 INFO 수준으로, CRITICAL·WARNING 에 해당하는 정식 규약 직접 위반은 없다.

---

## 위험도

LOW
