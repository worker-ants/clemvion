# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-m1-residual-sync.md`

검토 모드: spec draft (--spec)
검토일: 2026-06-24

---

## 발견사항

### WARNING: plan frontmatter 필수 필드 누락 — `started`, `owner`

- **target 위치**: frontmatter L1-6
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4 Frontmatter 스키마`
- **상세**: `plan/in-progress/` top-level plan 은 `worktree`·`started`·`owner` 세 필드가 모두 필수 (build guard `plan-frontmatter.test.ts` 강제). 본 문서의 frontmatter 는 `worktree` 와 추가 필드(`status`, `scope`, `note`)만 있고, **`started`(ISO YYYY-MM-DD)** 와 **`owner`(역할/이름)** 가 누락됐다.
- **제안**: frontmatter 에 `started: 2026-06-24` 와 `owner: project-planner` (또는 실제 역할/이름) 를 추가한다. 추가하지 않으면 `plan-frontmatter.test.ts` 가 build 차단을 발생시킨다.

---

### WARNING: `worktree` 필드 값이 full path 형식 — 규약 sentinel 형식과 불일치

- **target 위치**: frontmatter L2 (`worktree: .claude/worktrees/refactor-c2-circular-deps`)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — `worktree:` 필드는 "worktree 디렉토리 이름(`<task_name>-<slug>` 형식)" 을 담도록 정의됨. full path(`.claude/worktrees/<name>`) 가 아닌 디렉토리 이름(`refactor-c2-circular-deps`) 이 규약 예시 및 guard(`plan_guard.py`) 의 매칭 기준이다.
- **상세**: guard 는 `worktree:` 값을 현재 worktree 디렉토리 이름(또는 `claude/` 뗀 branch)과 매칭해 연결 plan 을 판정한다. full path 를 넣으면 매칭 실패 가능성이 있다 (실제 guard 구현에 따라 false-pass/false-fail 양방향 리스크). 실제 guard 내 파싱이 `basename` 까지 해소하는지 여부에 따라 오동작이 없을 수도 있으나, 규약 예시(`worktree: refactor-c2-circular-deps`)와의 불일치는 명확하다.
- **제안**: `worktree: refactor-c2-circular-deps` 로 디렉토리 이름만 기재한다.

---

### INFO: `status: draft` — plan frontmatter 에서 미정의 enum 값

- **target 위치**: frontmatter L3 (`status: draft`)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — `status` 필드 enum 이 명시적으로 정의되지 않음. 허용 추가 필드는 언급되지만, `status` 값 체계는 spec frontmatter 의 5-value enum(`backlog`/`spec-only`/`partial`/`implemented`/`archived`)과는 분리된 plan 고유 용도로 쓰이는 것으로 보인다. `draft` 는 규약에 예시로도 등장하지 않는다.
- **상세**: plan frontmatter 에서 `status`, `scope`, `note` 는 "추가 필드는 허용" 규약에 따라 허용된다. `draft` 값 자체는 plan lifecycle 에서 의미 있는 enum 이 아니나 informational label 로 쓰인 것으로 보여 규약 위반이 아닌 형식 비일관성 수준이다.
- **제안**: 사소한 수준이므로 필수 수정은 아니나, plan 문서 특성에 맞게 `status` 보다 `type: draft-edit-plan` 같은 명확한 label 을 쓰거나 제거해도 무방하다.

---

### INFO: 문서 제목 섹션 — Overview / 본문 / Rationale 3섹션 구조 미적용

- **target 위치**: 문서 전체 구조
- **위반 규약**: CLAUDE.md "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장"
- **상세**: 본 문서는 plan 의 편집안(draft)으로, spec 문서가 아닌 plan 작업 문서다. CLAUDE.md 에서 3섹션 구조는 spec 문서에 대한 권장이며 (`spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`), plan 문서에는 동일한 3섹션 구조 의무가 없다. 규약 위반이 아님을 확인.
- **제안**: 변경 불요. plan 작업 문서로서 현재 구조(편집 목록 + 각 편집의 근거/현재텍스트/제안텍스트)는 적절하다.

---

### INFO: `spec/3-workflow-editor/...` 경로 표기 — 정확 경로와 불일치

- **target 위치**: `## 파일 2:` 섹션 헤더 (`spec/3-workflow-editor/.../interaction-type-registry.md`)
- **위반 규약**: 명명 규약의 직접 위반은 아님. 하지만 정식 경로가 `spec/conventions/interaction-type-registry.md` 임을 본문에서 스스로 수정하고 있음 (헤더 바로 아래 `(정확 경로: ...)` 형식).
- **상세**: 편집안 문서이므로 헤더에 "잠정 경로" 표기 후 수정하는 방식은 기능상 문제 없으나, 헤더 자체가 틀린 경로를 담는 것은 링크 무결성 검사(`spec-link-integrity.test.ts`) 대상이 아니므로 build 차단은 없다. 단순 가독성 이슈.
- **제안**: 헤더를 `## 파일 2: spec/conventions/interaction-type-registry.md` 로 정정하면 더 명확하다. 강제 사항은 아님.

---

## 요약

`plan/in-progress/spec-draft-m1-residual-sync.md` 는 plan frontmatter 규약(`plan-lifecycle.md §4`)에서 **`started` 와 `owner` 두 필수 필드가 누락**돼 있고, `worktree` 값이 full path 형식으로 규약 예시(디렉토리 이름)와 불일치한다. 이 두 항목은 `plan-frontmatter.test.ts` build 가드가 강제하는 의무 필드이므로 수정이 필요하다. 문서 내용 자체(spec 편집안 서술, 섹션 구조, 파일 참조 경로, 3섹션 문서 구조 검토)는 정식 규약을 실질적으로 위반하지 않는다. spec 문서 규약(Overview/본문/Rationale 3섹션, `_product-overview.md`·`0-` prefix)은 이 문서의 대상 영역이 아니며, API 문서 규약·출력 포맷 규약의 직접 위반도 없다.

## 위험도

MEDIUM

(필수 frontmatter 필드 누락으로 build guard 가 차단할 수 있음. 수정은 2개 필드 추가 및 `worktree` 값 수정으로 즉시 해소 가능.)
