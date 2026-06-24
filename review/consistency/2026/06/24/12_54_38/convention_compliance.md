# 정식 규약 준수 검토 — convention_compliance

**대상 문서**: `plan/in-progress/spec-draft-m3-m1-ai-assistant-sync.md`
**검토 모드**: spec draft (--spec)
**검토일**: 2026-06-24

---

## 발견사항

### [WARNING] plan frontmatter 에 `started` 필드 누락
- **target 위치**: 파일 상단 frontmatter (L1–6)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §4.2 → `plan-frontmatter.test.ts` 가드 / `.claude/docs/plan-lifecycle.md` §4 Frontmatter 스키마
- **상세**: 현재 frontmatter 에는 `worktree`, `status`, `kind`, `scope` 만 있고 **`started`(ISO 날짜) 와 `owner` 가 없다**. `plan-lifecycle.md §4` 는 top-level `plan/in-progress/*.md` 에 `worktree`·`started`·`owner` 세 필드를 **필수**로 규정하며 `plan-frontmatter.test.ts` build 가드가 강제한다. 본 파일은 top-level `plan/in-progress/` 직속 파일이므로 면제 사유(하위 그룹 부속 문서)에 해당하지 않는다.
- **제안**: frontmatter 에 `started: 2026-06-24`(또는 실제 착수일)와 `owner: developer`(또는 담당자)를 추가한다.

```yaml
---
worktree: refactor-c2-circular-deps
started: 2026-06-24
owner: developer
status: draft
kind: spec-sync-edit-list
scope: behavior-invariant doc-sync (M-3 god-service split #670/#680/#683, M-1 god-handler split #665/#668 + AiTurnExecutor)
---
```

---

### [INFO] `status: draft` 는 plan-lifecycle 정의 enum 외 값
- **target 위치**: frontmatter L3 `status: draft`
- **위반 규약**: `.claude/docs/plan-lifecycle.md` §4 — `status` 는 plan frontmatter 의 optional 확장 필드이나, spec frontmatter `status` 의 5-값 enum(`backlog`/`spec-only`/`partial`/`implemented`/`archived`, `spec/conventions/spec-impl-evidence.md §3`)과 혼동 여지가 있음
- **상세**: plan 문서의 frontmatter `status` 는 `plan-lifecycle.md` 에서 별도 enum 을 강제하지 않으므로 `draft` 사용 자체는 허용된다(`priority`/`status`/`title` 등 추가 필드는 허용). 단 `spec-impl-evidence.md §3` 의 spec 라이프사이클 enum 과 이름이 같아 혼동 가능성이 있다. plan 전용임을 명확히 하거나 `phase: draft` 같은 다른 키로 구분하면 의미 도메인이 명확해진다.
- **제안**: 현재 상태 유지 가능(위반 아님). 다만 plan 문서 전용 의미임을 명확히 하려면 `phase: draft` 또는 `plan_status: draft` 로 키를 달리하는 것을 권장.

---

### [INFO] 문서 구조 — 본문은 spec 편집 지침이지 spec 문서 자체가 아님 (구조 규약 적용 범위 확인)
- **target 위치**: 문서 전체 구조
- **위반 규약**: CLAUDE.md "정보 저장 위치" 표 — `plan/in-progress/` 는 "진행 중 작업" 위치
- **상세**: 이 파일은 `kind: spec-sync-edit-list` 로 스스로를 plan 문서로 선언하고 있으며, CLAUDE.md 의 "정보 저장 위치" 분류와 일치한다(`plan/in-progress/`). spec 문서 3섹션(Overview/본문/Rationale) 규약은 `spec/` 하위 문서에 적용되는 것이고 plan 문서에는 적용 의무가 없으므로 현재 구조는 정상.
- **제안**: 현 구조 유지 적절.

---

### [INFO] `확인 필요 항목` 섹션의 미결 체크리스트 — 완료 이동 시 Gate C 의무
- **target 위치**: 문서 말미 "확인 필요 항목" 섹션 (L258–263)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4.2` Gate C / `.claude/docs/plan-lifecycle.md §4 Gate C`
- **상세**: 완료(`plan/complete/` 이동) 시 frontmatter 에 `spec_impact` 를 선언해야 한다. 이 plan 의 `scope` 가 `spec/` 편집을 명시적으로 다루므로(`spec/3-workflow-editor/4-ai-assistant.md` 등 3개 파일), 완료 이동 시 `spec_impact` 에 해당 spec 경로를 목록으로 등재해야 한다. 현재 in-progress 단계에서는 의무 아님 — 완료 시 누락하지 않도록 메모.
- **제안**: plan 완료 이동 commit 시 frontmatter 에 아래를 추가:
```yaml
spec_impact:
  - spec/3-workflow-editor/4-ai-assistant.md
  - spec/4-nodes/3-ai/1-ai-agent.md
  - spec/data-flow/7-llm-usage.md
```

---

## 요약

`plan/in-progress/spec-draft-m3-m1-ai-assistant-sync.md` 는 plan 문서로서의 역할(spec 편집 지침 목록)을 명확히 하고 있으며, 편집 쌍(old_string/new_string)의 형식과 근거 서술은 정식 규약에서 요구하는 명명·출력 포맷 규약과 충돌하지 않는다. 주요 규약 위반은 **plan frontmatter 필수 필드(`started`·`owner`) 누락** 1건이다. 이는 `plan-frontmatter.test.ts` build 가드의 검증 대상이므로 빌드 차단으로 이어질 수 있다. 나머지 발견사항은 사소한 일관성 제안(INFO) 수준이다.

## 위험도

LOW
