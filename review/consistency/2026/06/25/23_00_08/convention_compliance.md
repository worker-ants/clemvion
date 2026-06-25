# Convention Compliance Review

**Target**: `plan/in-progress/web-chat-ai-presentation-render.md`
**Mode**: `--impl-prep` (구현 착수 전 검토)
**Date**: 2026-06-25

---

## 발견사항

### [INFO] frontmatter 에 `status` 필드 사용 — plan 규약 미언급 필드
- **target 위치**: frontmatter `status: in-progress`
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — 필수 3필드는 `worktree`·`started`·`owner`. `status` 는 명시적 필수·선택 필드 목록에 없음.
- **상세**: `plan-lifecycle.md §4` 는 top-level `plan/in-progress/*.md` 의 의무 필드를 `worktree`·`started`·`owner` 셋으로 정의하고 "추가 필드는 허용" 이라 명시. `status: in-progress` 는 추가 필드로서 허용 범위 내이나, in-progress 폴더에 있는 문서에 `status: in-progress` 를 추가하는 것은 중복 정보(위치 자체가 상태를 의미)이며 실익이 없다. `spec/conventions/spec-impl-evidence.md` 의 `status` enum(`backlog`·`spec-only`·`partial`·`implemented`·`archived`)과 다른 의미의 필드가 같은 `status` 키를 쓰는 점도 혼동 위험이 있음.
- **제안**: `status: in-progress` 필드 제거. in-progress 폴더에 있다는 사실이 이미 상태를 나타내므로 중복. (필수 3필드 `worktree`·`started`·`owner` 는 모두 올바르게 작성됨.)

### [INFO] frontmatter 에 `title` 필드 — 규약 미언급 필드
- **target 위치**: frontmatter `title: 웹채팅 위젯 — AI 에이전트 render_* presentation(PresentationPayload) 렌더 버그 수정`
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4`
- **상세**: `plan-lifecycle.md §4` 는 추가 필드 허용을 명시하므로 `title` 자체가 위반은 아님. 그러나 파일명·문서 본문 섹션 제목·frontmatter title 세 곳에 설명이 분산됨. 규약에 권장/금지 표기 없으므로 INFO 수준.
- **제안**: 허용이나 일관성을 위해 생략 고려. 파일명 `web-chat-ai-presentation-render` 가 이미 식별자 역할을 함.

### [INFO] `related_spec`·`related_plans` 필드 — 규약 미언급 필드
- **target 위치**: frontmatter `related_spec:`, `related_plans:`
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4`
- **상세**: plan-lifecycle §4 는 추가 필드를 허용하므로 위반 아님. `related_spec` 의 경로들(`spec/7-channel-web-chat/1-widget-app.md`, `spec/4-nodes/3-ai/1-ai-agent.md`)은 관련 문서 링크로 유용한 정보. 허용 범위.
- **제안**: 현행 유지. 다만 향후 규약 문서에 선택 필드로 등재되면 일관성 확보에 유리.

### [INFO] 문서 구조 — Overview / 본문 / Rationale 3섹션 미적용
- **target 위치**: 문서 전체 구조 (`# 배경`, `# 수정`, `# 테스트`, `# spec`, `# 리뷰`, `# 주의`)
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)"
- **상세**: CLAUDE.md 는 "Spec 문서 3섹션 구성" 을 권장하나, 이 권장은 `spec/` 문서에 적용되는 규약이다(각 SKILL.md 참조). `plan/in-progress/` 문서는 plan-lifecycle.md 가 SoT 이며, 동 문서는 plan 에 3섹션을 요구하지 않는다. 따라서 plan 문서에 Rationale 섹션이 없어도 규약 위반 아님. 확인 차원 INFO 기록.
- **제안**: 해당 없음 — plan 문서에는 3섹션 구조 의무 없음.

---

## 요약

`plan/in-progress/web-chat-ai-presentation-render.md` 는 plan-lifecycle.md §4 의 필수 3필드(`worktree`·`started`·`owner`)를 모두 정확히 포함하고 있으며, 파일 경로 명명(`plan/in-progress/<name>.md`)도 규약에 일치한다. CRITICAL 또는 WARNING 수준의 정식 규약 위반은 발견되지 않았다. 발견된 항목은 모두 INFO — 추가 frontmatter 필드(`status`·`title`·`related_spec`·`related_plans`)의 중복성·혼동 가능성에 관한 사소한 형식 일관성 제안이다. plan 문서에 spec 3섹션(Overview/본문/Rationale) 구조가 적용되지 않는 것은 의도된 규약이므로 지적 대상이 아니다. 구현 착수를 차단하는 Critical 발견사항 없음.

---

## 위험도

NONE
