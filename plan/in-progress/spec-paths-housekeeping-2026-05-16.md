---
worktree: TBD
started: 2026-05-16
owner: project-planner
---

# Spec housekeeping — 옛 flat 경로 잔존 참조 일괄 교정

## 배경

`review/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` nested ISO 경로 전환 이후에도 일부 spec 파일이 옛 flat 경로 (`review/<YYYY>-<MM>-<DD>_<hh>-<mm>-<ss>/` 또는 `review/<YYYY>-<MM>-<DD>_<name>/`) 를 참조한다. cafe24 영역의 잔존분(2건) 은 `claude/spec-cafe24-private-followup-ae9995` 에서 함께 정리되었고, 본 plan 은 그 PR 범위 밖의 잔존 2건을 다룬다.

## 대상

```
spec/3-workflow-editor/4-ai-assistant.md:1273
  → `review/2026-04-24_18-27-09/`  →  `review/code/2026/04/24/18_27_09/`  (마이그레이션 확인 완료)

spec/5-system/_product-overview.md:83
  → `review/2026-05-05_a11y/voiceover-notes.md`  →  `review/code/2026/05/05/17_24_08/voiceover-notes.md`  (마이그레이션 확인 완료)
```

두 파일 모두 spec 본문이 아니라 변경 이력·참조 부주석 영역. 의미 변경은 없으며 경로 표기만 교정한다.

## 체크리스트

- [ ] 새 worktree 생성 (`spec-paths-housekeeping-<slug>`)
- [ ] `consistency-check --spec` 호출 (단순 경로 표기 변경 — BLOCK 가능성 낮음)
- [ ] 두 파일 교정
- [ ] PR + merge → complete 이동
