# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-port-id-uuid-slug.md`

검토 일시: 2026-06-20  
검토 모드: spec draft (--spec)  
대상 파일: `/Volumes/project/private/clemvion/.claude/worktrees/spec-port-id-slug-drift/plan/in-progress/spec-draft-port-id-uuid-slug.md`

---

## 발견사항

### [INFO] frontmatter 에 비필수 `spec_area` 필드 사용 — 무해하나 비표준
- **target 위치**: frontmatter (line 5)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4 Frontmatter 스키마` — 필수 3필드(`worktree`·`started`·`owner`) 명시. `priority`/`status`/`title` 등 추가 필드는 허용된다고 명시됨.
- **상세**: `spec_area: spec/4-nodes` 는 plan-lifecycle §4 의 허용 추가 필드 예시(priority/status/title)에 없는 커스텀 필드다. 규약은 "추가 필드는 허용"하므로 build guard 차단 대상은 아니다. 단, 규약 문서에 열거되지 않은 필드라 다른 plan 작성자가 이 패턴을 정규 관례로 오인할 가능성이 있다.
- **제안**: 무해하므로 그대로 유지 가능. 이 필드를 정규화하려면 plan-lifecycle §4 에 "spec_area: (spec 영역 경로, planner 편의 메타)" 예시를 추가하거나, 불필요하면 삭제.

### [INFO] 문서 구조 — Overview / 본문 / Rationale 3섹션 권장 형식 부분 이탈
- **target 위치**: 문서 전체 섹션 구성
- **위반 규약**: CLAUDE.md §정보 저장 위치 — "Spec 문서 3섹션 구성(Overview / 본문 / Rationale): 각 SKILL.md 참고"
- **상세**: 대상 문서는 plan 문서(`plan/in-progress/`)이며 spec 문서(`spec/`)가 아니다. plan-lifecycle §4 의 frontmatter 스키마에 섹션 구조 강제는 없고, 3섹션 요건은 spec 문서에만 적용된다. 따라서 이는 plan 성격의 문서로서 정상이다.
- **제안**: 조치 불요. 다만 `## Rationale` 섹션이 plan 본문에 포함되어 있는데(`## Rationale (0-overview.md …에 등재할 내용)`), 이 섹션은 대상 spec 파일(`4-nodes/0-overview.md`)에 등재할 내용을 초안으로 정리한 것이라 plan 문서의 본문 내용으로 자연스럽다.

### [INFO] plan 파일 `spec-draft-port-id-uuid-slug.md` — 명명 컨벤션 확인
- **target 위치**: 파일명 자체
- **위반 규약**: CLAUDE.md §정보 저장 위치 — plan 파일은 `plan/in-progress/<name>.md` 형식
- **상세**: `spec-draft-port-id-uuid-slug.md` 는 kebab-case 로 작성됐고 경로도 `plan/in-progress/` 정상. plan-lifecycle 은 파일명 구조에 추가 규칙(예: prefix 강제 등)을 두지 않는다. 명명 자체는 내용(spec draft 작업 식별)을 충분히 표현하며 규약 위반 없음.
- **제안**: 조치 불요.

---

## 요약

`plan/in-progress/spec-draft-port-id-uuid-slug.md` 는 plan-lifecycle 의 필수 frontmatter 3필드(`worktree: spec-port-id-slug-drift`, `started: 2026-06-20`, `owner: project-planner`)를 모두 정확히 보유하고 있다. 비필수 `spec_area` 필드는 plan-lifecycle §4 의 "추가 필드 허용" 규칙에 따라 build guard 통과 대상이며 정식 규약 위반이 아니다. 문서 구조(배경 / 변경안 / 제외 / Rationale / 영향)는 spec 문서가 아닌 plan 작업 기술 문서로서 적절하다. 정식 규약(`spec/conventions/**`) 직접 위반 사항은 없으며, spec 변경 제안(4건 + Rationale 신설)의 내용 자체도 `spec/conventions/spec-impl-evidence.md` 의 문서 구조 규약(Overview / 본문 / Rationale 3섹션 권장) 및 CLAUDE.md 의 `_product-overview.md`·`0-overview.md` 명명 패턴과 정합한다.

---

## 위험도

NONE
