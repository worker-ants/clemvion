# 정식 규약 준수 검토 — `plan/in-progress/spec-update-engine-split.md`

검토 모드: spec draft 검토 (--spec)
검토 기준: `spec/conventions/**`, `.claude/docs/plan-lifecycle.md`

---

## 발견사항

### **[CRITICAL]** `started` 필드 누락 — plan frontmatter build guard 위반
- **target 위치**: frontmatter (L1–L7)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — top-level `plan/in-progress/*.md` 에 `worktree`·`started`·`owner` 세 필드 **필수**. `plan-frontmatter.test.ts` build guard 가 강제.
- **상세**: target 문서는 `started:` 대신 `created: 2026-06-18` 를 사용하고 있다. `created` 는 규약 스키마에 없는 비표준 필드이며, `started` 는 ISO 날짜(YYYY-MM-DD) 형식으로 필수. `started` 누락 시 `plan-frontmatter.test.ts` 가 build fail 을 발생시킨다.
- **제안**: frontmatter 에 `started: 2026-06-18` 를 추가한다 (`created:` 는 추가 필드로 유지 허용이나 `started:` 는 반드시 존재해야 함).

---

### **[WARNING]** `worktree` 값이 full path — 스키마 권장 형식(디렉토리 이름만) 불일치
- **target 위치**: frontmatter `worktree: .claude/worktrees/engine-split`
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — `worktree: <task_name>-<slug>` (예: `engine-split`). 스키마 예시는 디렉토리 이름만, full path 가 아님.
- **상세**: `plan-stale-audit.sh` 나 `plan_coherence` 도구가 worktree 필드를 worktree 디렉토리 이름으로 매칭할 경우 full path 형식은 오매칭을 유발할 수 있다. build guard `plan-frontmatter.test.ts` 는 값 형식까지 강제하지 않으므로 build 차단은 없으나, 운용 도구와의 불일치 위험이 있다. 다른 in-progress plan 파일의 패턴을 보면 `engine-split` 과 같이 short name 을 쓰는 관행이 표준이다.
- **제안**: `worktree: engine-split` 으로 수정.

---

### **[INFO]** `parent:` 비표준 필드 — 허용되나 convention 스키마 외
- **target 위치**: frontmatter `parent: plan/in-progress/refactor/c1-engine-split.md …`
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — `priority`/`status`/`title` 등 추가 필드는 허용. `parent` 도 허용 범주에 해당하나 공식 스키마에 없는 비표준 필드.
- **상세**: build guard 에서 검증하지 않는 추가 필드이므로 기능상 문제없다. 단 `parent:` 필드가 다른 plan 에서도 일관성 있게 쓰이지 않으면 검색·추적 시 혼동을 줄 수 있다.
- **제안**: 현재대로 유지 가능. 향후 프로젝트 차원에서 plan 계층 추적이 표준화될 경우 규약 갱신을 검토.

---

### **[INFO]** `spec/conventions/interaction-type-registry.md` `code:` 갱신 지시 — 이미 반영 완료 상태
- **target 위치**: `## 변경 (spec 파일별)` → `spec/conventions/interaction-type-registry.md §1.1·§1.2` 섹션
- **위반 규약**: 위반 아님 — 관찰 사항.
- **상세**: target plan 이 "frontmatter `code:` 에 `ai-turn-orchestrator.service.ts`·`button-interaction.service.ts` 추가" 를 지시하나, 현재 `spec/conventions/interaction-type-registry.md` frontmatter 에 두 파일 모두 이미 등재돼 있다 (검토 시점 기준). plan 을 planner 가 실행하기 전 이미 반영된 상태이거나, PR4 완료 커밋에서 선행 적용된 것으로 보인다.
- **제안**: plan 실행 시 해당 항목은 no-op 임을 확인 후 체크.

---

## 요약

target 문서 `plan/in-progress/spec-update-engine-split.md` 는 정식 규약 관점에서 한 건의 CRITICAL 위반을 포함한다. `plan-lifecycle.md §4` 가 필수로 요구하는 `started:` 필드가 누락돼 있으며, `created:` 라는 비표준 키로 대체돼 있다. 이는 `plan-frontmatter.test.ts` build guard 를 직접 위반한다. `worktree:` 값의 full-path 형식은 WARNING 수준으로, build 차단은 없으나 운용 도구와의 불일치 위험이 있다. 본문 내용(spec 변경 지시 사항, 명명 패턴, 참조 경로) 은 규약과 잘 정렬돼 있다.

## 위험도

**CRITICAL**
