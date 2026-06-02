# Convention Compliance Review

**Target**: `plan/in-progress/spec-draft-spec-drift-resolve.md`
**Mode**: spec draft 검토 (--spec)
**Date**: 2026-06-03

---

## 발견사항

### [INFO] plan frontmatter `worktree` 값 형식 — 슬래시 없이 디렉토리 이름만 권장
- target 위치: frontmatter 1행 `worktree: spec-drift-resolve-efb608`
- 위반 규약: `.claude/docs/plan-lifecycle.md §4` — `worktree: <task_name>-<slug>` (디렉토리 이름만, 경로 아님)
- 상세: 현재 값 `spec-drift-resolve-efb608` 은 규약이 요구하는 `<task_name>-<slug>` 형식과 일치한다. 비교 대상 `spec-draft-auth-config-webhook-wiring.md` 는 전체 경로 `.claude/worktrees/auth-config-webhook-wiring` 을 기재하고 있어 기존 파일들 사이에서 표기 불일치가 존재한다. 본 target 파일의 값(이름만)이 규약 §4 문법 `<task_name>-<slug>` 에 더 부합한다. 위반 아님 — 기존 파일과의 형식 편차만 INFO 수준으로 기록.
- 제안: 현행 값 유지. 규약의 `worktree:` 예시를 전체 경로 vs 이름만 중 하나로 통일하도록 plan-lifecycle.md 를 명확화하는 것을 고려할 수 있다.

### [INFO] spec-draft plan 에 체크리스트(체크박스) 부재 — plan-lifecycle 분류 기준 명확화 권고
- target 위치: 문서 전체 (변경 1, 변경 2, Rationale 섹션)
- 위반 규약: `.claude/docs/plan-lifecycle.md §2` — "미체크 체크박스(`[ ]`), 'TODO', '남은 작업', ... 이 하나라도 있으면 `in-progress/`"
- 상세: 본 문서는 `plan/in-progress/`에 위치하나, 체크박스·TODO·"남은 작업" 항목이 전혀 없다. 내용 맥락상 "이미 spec/ 본문에 적용된 변경을 consistency-check 대상으로 기술한 것" (문서 서두)이므로 draft 기록 목적의 정적 문서에 가깝다. plan-lifecycle §2 기준으로는 체크박스가 없으면 `complete/` 로 이동해야 하는 상태이거나, 아직 `/consistency-check --spec` 통과 전이라 `in-progress/` 에 있는 상태 중 하나여야 한다. 어느 쪽인지 문서에서 명시적으로 드러나지 않는다.
- 제안: (a) `/consistency-check --spec` 이 아직 완료되지 않았다면 `[ ] consistency-check --spec 통과` 체크박스를 추가해 `in-progress/` 사유를 명확히 한다. (b) consistency-check 가 이미 완료됐다면 spec 반영 완료 후 `plan/complete/` 로 이동한다. 규약 위반 수준은 아니나 라이프사이클 상태의 모호함을 해소하는 것이 권장된다.

### [INFO] 문서 제목 prefix 불일치 — `spec-draft:` vs `Spec Draft:`
- target 위치: H1 제목 `# spec-draft: spec-drift 2건 해소 ...`
- 위반 규약: project-planner SKILL.md §작업 워크플로 3번 — `plan/in-progress/spec-draft-<name>.md` 파일 명명 언급. 비교: `spec-draft-auth-config-webhook-wiring.md` 는 `# Spec Draft:` (대문자 S, D) 를 사용.
- 상세: 규약이 H1 제목의 대소문자를 명시적으로 지정하지 않으므로 위반은 아니다. 그러나 `spec-draft-auth-config-webhook-wiring.md` 의 `# Spec Draft:` (대문자) 와 본 파일의 `# spec-draft:` (소문자) 가 불일치한다. 일관성 차원의 INFO 사항.
- 제안: `# Spec Draft:` 로 통일하거나, SKILL.md 의 draft 파일 명명 예시에 제목 형식도 명시한다.

---

## 요약

target 문서 `plan/in-progress/spec-draft-spec-drift-resolve.md` 는 정식 규약(`spec/conventions/**`, `.claude/docs/plan-lifecycle.md`, project-planner SKILL.md)을 실질적으로 위반하는 항목이 없다. frontmatter 3필드(worktree/started/owner) 가 plan-lifecycle §4 스키마를 충족하고, 문서 구조도 변경 내용 본문 + `## Rationale` 섹션을 갖춰 project-planner SKILL 의 3섹션 권장 패턴(본문 / Rationale)에 부합한다. 발견된 3건은 모두 INFO 수준 — plan `in-progress/` 잔류 사유가 문서 내에 명시되지 않은 점(체크박스 미표기), worktree 값 표기 형식의 기존 파일 간 불일치, 제목 대소문자 형식 차이다. API 문서 규약 또는 출력 포맷 규약 위반은 해당 없음 (plan draft 문서이므로 OpenAPI/스키마 규약 적용 대상 아님).

## 위험도

LOW
