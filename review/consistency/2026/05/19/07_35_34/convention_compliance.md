# 정식 규약 준수 검토 — convention_compliance

검토 대상: `plan/in-progress/loop-count-policy.md`
검토 모드: plan draft 검토 (--plan)

---

## 발견사항

### [WARNING] frontmatter `worktree` 필드에 slug 누락
- target 위치: frontmatter `worktree: loop-count-policy`
- 위반 규약: `CLAUDE.md §Worktree 기반 작업 정책 §명명 규칙` — `worktree: <task_name>-<slug>` 형식 명시
- 상세: CLAUDE.md 는 worktree 이름을 `<task_name>-<slug>` (예: `nav-redesign-c41f58`) 로 규정하며, plan frontmatter 의 `worktree` 필드도 동일 형식을 가이드한다. 그러나 현재 plan 의 `worktree: loop-count-policy` 는 slug 없이 task_name 만 존재한다. 실제 worktree 디렉토리명이 `loop-count-policy` 라면 worktree 생성 자체가 컨벤션을 벗어난 것이며, plan 의 frontmatter 는 실제 디렉토리명을 그대로 반영해야 하므로 plan 단독으로는 수정할 수 없다.
- 제안: worktree 생성 시 `loop-count-policy-<slug>` 형식(예: `loop-count-policy-a1b2c3`)으로 이름을 부여하고, frontmatter 를 `worktree: loop-count-policy-<slug>` 로 갱신한다. 단, 이미 생성된 worktree 를 재생성하기 어려운 상황이라면 CLAUDE.md 의 slug 컨벤션이 "충돌 회피용" 이라는 취지임을 감안해 INFO 로 강등 가능 — 단 consistency-checker `plan_coherence` 가 이 필드로 worktree 를 대조하므로, 실제 디렉토리명과 반드시 일치해야 한다.

### [INFO] 제공된 정식 규약(`spec/conventions/`)과 target 문서 간 교집합 없음
- target 위치: 문서 전체
- 위반 규약: 해당 없음
- 상세: prompt 에 첨부된 `spec/conventions/` 규약은 전부 Cafe24 API Catalog 관련(`_overview.md`, `application.md`, `category.md`, `collection.md` 등)이며, 이 규약들이 정의하는 컬럼 형식·status enum·동기 테스트 정책 등은 plan 문서(`loop-count-policy.md`)와 교집합이 없다. target 문서를 Cafe24 카탈로그 규약으로 평가할 수 있는 항목이 존재하지 않는다.
- 제안: orchestrator 가 향후 plan 문서 검토 시 Cafe24 카탈로그 규약 대신 CLAUDE.md `§PLAN 문서 라이프사이클` 관련 규약을 첨부해 전달하면 더 정확한 검토가 가능하다. 현 검토는 CLAUDE.md 를 기준으로만 수행했다.

### [INFO] spec 변경 작업 항목에서 Rationale 섹션 신설 명시 — 규약 부합
- target 위치: `## 작업 항목` — `spec/4-nodes/1-logic/3-loop.md` 항목 `§8 Rationale 섹션 신설`
- 위반 규약: 해당 없음 (규약 부합 확인)
- 상세: CLAUDE.md 는 `spec/<영역>/N-name.md` 형식 문서 끝에 `## Rationale` 섹션을 권장한다. 이 plan 이 `spec/4-nodes/1-logic/3-loop.md` 에 `§8 Rationale` 를 신설하기로 명시한 것은 규약과 정확히 부합한다.
- 제안: 없음 — 현재 계획이 규약을 올바르게 따른다.

### [INFO] plan 문서 완료 후 `git mv` 체크리스트 포함 — 규약 부합
- target 위치: `## 작업 항목` 마지막 항목 `git mv plan/in-progress/loop-count-policy.md plan/complete/`
- 위반 규약: 해당 없음 (규약 부합 확인)
- 상세: CLAUDE.md `§PLAN 문서 라이프사이클` 은 모든 항목 완료 시 `git mv` 로 `complete/` 로 이동하고 history 를 보존할 것을 요구한다. 해당 항목이 체크리스트에 명시된 것은 적절하다.
- 제안: 없음.

---

## 요약

`plan/in-progress/loop-count-policy.md` 는 CLAUDE.md 의 plan 문서 규약을 전반적으로 준수하고 있다. frontmatter 에 `worktree`, `started`, `owner` 세 필드가 모두 존재하고, 미완료 항목을 포함해 `in-progress/` 에 위치하며, 완료 시 `git mv` 를 예정하는 등 라이프사이클 규약을 따른다. 다만 `worktree` 값이 CLAUDE.md 가 요구하는 `<task_name>-<slug>` 형식을 따르지 않고 slug 가 누락된 상태이며, 실제 worktree 디렉토리명 자체가 slug 없는 이름으로 생성된 것으로 보인다. 제공된 `spec/conventions/` 규약(Cafe24 API 카탈로그 관련)은 이 plan 문서와 교집합이 없어 해당 규약 관점의 위반 사항은 없다.

---

## 위험도

LOW
