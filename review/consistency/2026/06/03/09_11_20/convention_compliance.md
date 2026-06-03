# 정식 규약 준수 검토 결과

**검토 대상**: `plan/in-progress/spec-draft-conventions-code-data.md`
**검토 모드**: spec draft 검토 (--spec)
**검토일**: 2026-06-03

---

## 발견사항

### [INFO] 체크박스 또는 완료 추적 항목 부재
- target 위치: 문서 전체 (본문 `## 변경` 섹션)
- 위반 규약: `.claude/docs/plan-lifecycle.md §2` — "미체크 체크박스(`[ ]`), TODO, 남은 작업, 다음 단계, 결정 필요, 미해결 follow-up 항목이 하나라도 있으면 `in-progress/`"
- 상세: plan-lifecycle 은 plan 문서가 작업의 완료 여부를 체크박스로 추적해 `in-progress/` vs `complete/` 이동 판단 기준으로 삼는 구조다. 본 문서는 `## 변경` 아래 항목들이 "이미 worktree spec/ 에 적용"됐다고 서술하지만, 각 항목에 `[x]` 체크박스가 없다. `in-progress/` 에 위치한 plan 이 "완료 완료 여부 추적"을 체크박스 없이 산문으로만 기술하면 완료 이동 판단(plan-lifecycle §5 자가 점검)이 불명확해진다.
- 제안: `## 변경` 의 각 항목(1~6번)을 `- [x]` 형태로 변경하거나, 적어도 "이미 적용됨" 상태를 체크박스로 표시해 lifecycle 이동 판단을 명확히 할 것.

### [INFO] `## 잔여` 항목에 체크박스 또는 별도 plan 링크 없음
- target 위치: `## 잔여 (별도 추적 — 본 PR scope 밖 INFO)` 섹션
- 위반 규약: `.claude/docs/plan-lifecycle.md §2` — "미해결 follow-up 항목이 하나라도 있으면 `in-progress/`"
- 상세: "별도 추적"이라고 명시했지만 해당 follow-up 항목을 추적할 plan 경로가 없고, `[ ]` 체크박스도 없다. plan-lifecycle 에 따르면 이 문서가 `complete/` 로 이동하려면 이 잔여 항목의 처리 방침(별 plan 으로 이관 완료 여부 또는 명시적 "scope 밖으로 drop" 확인)이 체크박스로 표현돼야 한다.
- 제안: 잔여 항목 각각을 `- [ ]` 로 표시해 scope 밖 별 plan 생성 여부를 명시적으로 추적하거나, "INFO — 차후 별 plan 생성 예정" 이라는 구분을 `[ ]` 체크박스로 남겨 lifecycle 이동 조건을 충족시킬 것.

---

## 요약

`plan/in-progress/spec-draft-conventions-code-data.md` 는 frontmatter 스키마(`worktree`, `started`, `owner`)를 정확히 준수하고, 문서 제목·본문·Rationale 의 3섹션 구성도 CLAUDE.md 에서 권장하는 패턴과 일치한다. 또한 spec 파일(`node-output.md`, `0-common.md`, `0-overview.md`, `2-code.md`)의 어느 항목을 어떤 규약 위반(Principle 7/8.2 drift)을 근거로 변경했는지를 명시해 추적 가능성이 양호하다. 다만 plan-lifecycle 의 핵심 규약인 **체크박스 기반 완료 추적**이 적용돼 있지 않아, `in-progress/` → `complete/` 이동 판단 기준(plan-lifecycle §5 자가 점검)이 산문 서술만으로는 불명확하다는 점이 INFO 수준의 개선 사항으로 확인된다. CRITICAL 또는 WARNING 수준의 정식 규약 직접 위반은 없다.

## 위험도

LOW
