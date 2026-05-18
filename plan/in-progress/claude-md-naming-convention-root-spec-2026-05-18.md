---
worktree: TBD
started: 2026-05-18
owner: project-planner
---

# CLAUDE.md §명명 컨벤션 — 루트 레벨 `spec/0-overview.md` 항목 명시

## 배경

`spec-overview-ui-patterns-followup-2026-05-16` PR 의 consistency-check (`review/consistency/2026/05/18/17_22_08`) I-5 로 발견.

- `spec/0-overview.md` 가 `spec/` 루트에 위치 (영역 폴더 안이 아님).
- CLAUDE.md §명명 컨벤션 표는 **`spec/<영역>/0-overview.md`** 패턴만 명시 — 영역 안의 0-overview 자리만 다룸.
- 결과: 규약과 실제 파일 위치가 불일치. 새 작성자가 CLAUDE.md 만 보고는 루트 `spec/0-overview.md` 의 역할 (제품 전체 개요 + 시스템 아키텍처 개요) 을 모름.

## 작업 범위

- [ ] 새 worktree 생성 (`claude-md-naming-root-spec-<slug>`)
- [ ] `CLAUDE.md` §명명 컨벤션 표에 루트 레벨 행 추가:
  - `spec/0-overview.md` (루트, 0- prefix 동일) — "제품 전체 개요 + 시스템 아키텍처 개요. 영역 폴더 위 cross-cutting 진입 문서."
  - 영역 폴더 안의 `spec/<영역>/0-overview.md` 와 표기 일관성 유지
- [ ] 다른 루트 레벨 파일 (`spec/1-data-model.md`, `spec/6-brand.md` 등) 도 함께 검토 — 같은 미명시 패턴이 있으면 한 묶음으로 추가
- [ ] `spec/0-overview.md §8 문서 맵` 과 CLAUDE.md 사이의 정합성 확인 (한쪽에만 있는 항목 제거)
- [ ] PR + merge → complete 이동

## 비고

- 본 변경은 `CLAUDE.md` (프로젝트 규약) 수정이라 consistency-check 의 spec 검토 대상이 아님 — 직접 PR.
- scope 가 작아 spec 본문 변경 없음. CLAUDE.md 만 손댐.
