# 정식 규약 준수 검토 — spec-draft-triggers-auth-column.md

검토 대상: `plan/in-progress/spec-draft-triggers-auth-column.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-05-29

---

## 발견사항

### [CRITICAL] plan 파일에 frontmatter 없음 — plan-lifecycle 스키마 위반
- target 위치: 파일 최상단 (1번 라인 — `# Spec draft ...` 로 바로 시작)
- 위반 규약: `.claude/docs/plan-lifecycle.md §4 Frontmatter 스키마`
- 상세: `plan/in-progress/*.md` 는 `worktree`, `started`, `owner` 세 필드를 포함한 YAML frontmatter 를 의무적으로 가져야 한다. 현재 파일에는 frontmatter 블록 자체가 없다. `consistency-checker` 의 `plan_coherence` checker 가 `worktree` 필드를 읽어 동시 작업 충돌을 검출하는데, 본 파일이 누락되면 해당 checker 가 이 plan 을 감지하지 못한다.
- 제안: 파일 최상단에 아래를 추가한다.
  ```yaml
  ---
  worktree: triggers-auth-column-a80393
  started: 2026-05-29
  owner: project-planner
  ---
  ```

### [WARNING] spec 변경 제안의 frontmatter 처리 방식이 plan 본문에 인라인 기술됨
- target 위치: `## frontmatter` 섹션 (35번 라인)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `status: spec-only` 유지 결정은 plan 이 아닌 대상 spec 파일(`spec/2-navigation/2-trigger-list.md`) 에 직접 반영되어야 한다. plan 문서는 "무엇을 변경할지"를 기술하되, spec 파일의 frontmatter 를 plan 본문 안에 "기존 유지"라고 설명만 하는 형태는 실제 spec 파일 갱신과 disjoint 해진다.
- 상세: plan 문서 내 `## frontmatter` 섹션은 spec 파일의 frontmatter 처리 방침을 텍스트로 설명하고 있다. 이는 plan 을 읽은 사람이 직접 spec 파일을 가서 확인해야 하는 구조다. 규약 위반은 아니나, spec-impl-evidence 컨벤션의 의도 ("plan 이 complete 로 이동하면 spec pending_plans 자동 정합")를 따르려면 spec 파일에 `pending_plans:` 로 이 plan 을 등록하는 절차도 plan 안에 체크리스트 항목으로 명시해야 한다.
- 제안: plan 본문에 `## 체크리스트` 또는 `## 작업 항목` 섹션을 추가하고, "spec 파일 frontmatter 에 pending_plans 등록" 을 항목으로 포함시킨다. 또는 현재 구조가 의도적이라면 이 plan 은 orchestrator 가 즉시 적용 후 complete 로 이동시킬 단순 draft 임을 명시한다.

### [WARNING] plan 문서 구조 — Overview / 본문 / Rationale 3섹션 권장 미적용
- target 위치: 문서 전체 구조
- 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale): 각 SKILL.md 참고"
- 상세: 이 규약은 spec 문서에 대한 권장이므로 plan 문서에 직접 적용되지는 않는다. 그러나 본 plan 문서는 spec draft 제안서의 성격이고, 제안 내용 자체(변경 1, 변경 2)는 잘 구조화되어 있다. 다만 "왜 이 변경이 필요한가(Overview)"에 해당하는 도입부 설명이 `대상:` 한 줄뿐이라 맥락이 부족하다.
- 제안: 이 항목은 plan 파일에 엄격히 적용되는 규약이 아니므로 강제 수정 대상은 아니다. 단, 이 draft 가 spec 파일에 합쳐질 때 변경 1의 표 내용(변경 2의 R-15 Rationale 구조는 양호)은 대상 spec 파일의 Overview 섹션과 연계되어야 한다.

### [INFO] 대안 목록 번호 매김 — 규약 이슈 아님, 일관성 제안
- target 위치: `## 변경 2 — Rationale 신규 R-15` 내 `대안:` 섹션
- 위반 규약: 없음 (정식 규약에 Rationale 대안 포맷 규정 없음)
- 상세: R-14 등 기존 Rationale 항목과 대안 서술 형식이 일치하는지 확인이 필요하다. 기존 Rationale 항목(`spec/2-navigation/2-trigger-list.md`) 과 비교해 표기 방식을 통일하는 것을 권장한다.
- 제안: 기존 Rationale 의 대안 포맷을 따른다 (INFO 수준, 차단 불필요).

---

## 요약

target 문서(`plan/in-progress/spec-draft-triggers-auth-column.md`)는 spec 변경 내용(§2.1 표 행 추가 + R-15 Rationale) 자체는 정식 규약과 충돌하지 않으며, 내용의 완성도(근거·대안 비교·참조 링크)는 양호하다. 그러나 plan 파일로서 필수인 frontmatter(`worktree`/`started`/`owner`)가 완전히 누락되어 있어 `.claude/docs/plan-lifecycle.md §4` 를 직접 위반한다 — 이는 `plan_coherence` checker 가 이 plan 을 추적하지 못하게 하는 구조적 결함이다. 추가로, 대상 spec 파일에 `pending_plans:` 등록 절차가 plan 체크리스트에 포함되어 있지 않아 `spec-impl-evidence.md` 의 역방향 링크 의도가 이행되지 않을 위험이 있다 (WARNING).

---

## 위험도

MEDIUM
