# 정식 규약 준수 검토 결과

검토 대상: `plan/in-progress/web-chat-preview-improvements.md`
검토 모드: `--impl-prep`
검토 시점: 2026-06-25

> 참고: orchestrator 가 prompt payload 에 target 내용을 `(없음)` 으로 전달했으나, 실제 파일은 worktree 경로
> `/Volumes/project/private/clemvion/.claude/worktrees/web-chat-preview-improvements-fa0488/plan/in-progress/web-chat-preview-improvements.md`
> 에 존재한다. 본 검토는 실제 파일 내용 기준으로 수행됐다.

---

## 발견사항

### [WARNING] `worktree` 필드 값이 실제 worktree 디렉토리 이름과 불일치

- **target 위치**: frontmatter 3번째 행 — `worktree: web-chat-preview-improvements`
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — `worktree:` 필드는 "이 plan 이 살아있는 worktree 디렉토리 이름" 이며, 포맷은 `<task_name>-<slug>` (hash suffix 포함한 전체 디렉토리명)
- **상세**: 실제 worktree 디렉토리는 `web-chat-preview-improvements-fa0488` (slug `-fa0488` 포함)이나 plan frontmatter 에는 `web-chat-preview-improvements` 로 slug 가 누락됐다. `plan_guard.py` 의 연결 판정은 `worktree:` 값으로 in-progress plan 과 worktree 를 매칭하므로, 값이 틀리면 push gate 가 이 plan 을 "연결 없음" 으로 취급해 plan 갱신 강제(push gate)가 무력화될 수 있다.
- **제안**: frontmatter 를 `worktree: web-chat-preview-improvements-fa0488` 로 수정한다.

---

### [INFO] `spec_impact` 를 in-progress 단계에 미리 선언

- **target 위치**: frontmatter — `spec_impact:` 목록
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — "`spec_impact` (완료 시점 필드, Gate C): in-progress 단계에선 의무 아님(완료 시점에만 `spec-plan-completion.test.ts` 가 강제)."
- **상세**: 규약이 금지하는 것은 아니며 완료 시점까지 미선언해도 무방하다. 다른 in-progress plan 들도 동일 패턴을 쓰고 있다(`fix-webchat-sse-field-map.md`, `webchat-eager-start.md` 등). 규약 위반이 아니므로 변경 불필요 — 완료 이동 시 목록을 실제 변경된 spec 파일과 비교·갱신하면 충분하다.
- **제안**: 현행 유지.

---

### [INFO] `related_spec` 항목에 파일이 아닌 디렉토리 경로 기재

- **target 위치**: frontmatter `related_spec:` — `spec/4-nodes/6-presentation`
- **위반 규약**: 규약 명시 금지 사항은 아니나 `spec-link-integrity.test.ts` 가 spec 파일 내 in-repo 링크의 타깃 존재를 검증할 때 디렉토리 경로는 파일로 해석되지 않는다. `related_spec` 은 plan guard 가 아닌 정보용 필드라 build 차단은 아님.
- **상세**: `spec/4-nodes/6-presentation` 은 디렉토리이며, 파일을 가리키는 경로가 아니다. `spec-link-integrity.test.ts` 의 검증 범위는 plan 파일이 아닌 spec `.md` 파일 안 링크이므로 직접 차단은 발생하지 않는다.
- **제안**: 현행 유지(정보용 비표준 필드). 명확성을 높이려면 `spec/4-nodes/6-presentation/_product-overview.md` 등 실제 파일 경로로 교체하는 것이 좋으나 차단 사안은 아님.

---

## 요약

`plan/in-progress/web-chat-preview-improvements.md` 는 필수 frontmatter 3필드(`worktree`/`started`/`owner`) 를 모두 갖추고, 문서 구조·명명·금지 패턴 위반은 없다. 유일한 실질적 우려는 `worktree:` 값이 실제 디렉토리 이름(`web-chat-preview-improvements-fa0488`)과 불일치하는 점(slug `-fa0488` 누락)으로, push gate 연결 판정 오동작으로 이어질 수 있어 구현 착수 전 수정을 권장한다(WARNING). 나머지 2건은 정보 수준이며 차단 사유가 아니다.

## 위험도

LOW
