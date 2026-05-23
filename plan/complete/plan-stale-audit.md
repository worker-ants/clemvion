---
worktree: plan-stale-audit-81be6e
started: 2026-05-23
completed: 2026-05-23
owner: developer
---

# `plan-stale-audit.sh` 도구 실행 plan

> ✅ 완료 (2026-05-23). PR (TBD) 안에서 도구 작성·smoke test·complete 이동 한 turn 안에 완료.

## 배경

`plan/in-progress/spec-harness-impl-coverage.md` (spec PR) 의 **결정 C-1** 실행. SoT: [`.claude/docs/plan-lifecycle.md §6.1`](../../.claude/docs/plan-lifecycle.md).

## 작업 범위

신규 `.claude/tools/plan-stale-audit.sh` — bash 스크립트:

- 30일 이상 갱신 없는 `plan/in-progress/*.md` 목록
- 각 plan 의 checkbox 진행률 (예: `7/12 done`) — markdown `- [x]` / `- [ ]` 카운트
- 마지막 commit 일자 (`git log -1 --format=%ai`)
- 어느 spec frontmatter `pending_plans:` 에 등록됐는지 cross-link (frontmatter parse — `yq` 또는 awk 단순 파싱)
- stdout 표 출력 — fail 안 함 (정보 보고만)

## 의존

없음 (spec PR 머지 직후 진행 가능. spec frontmatter `pending_plans:` 가 채워지지 않은 상태에서는 cross-link 컬럼이 비어 있을 뿐 도구 자체는 동작).

## 체크리스트

- [x] spec PR 머지 확인
- [x] `.claude/tools/plan-stale-audit.sh` 작성 + chmod +x
- [x] 현재 `plan/in-progress/` 전수 실행해서 출력 정합성 검증
- [x] PROJECT.md 또는 README 에 사용법 한 줄 추가 (선택)
- [x] plan `complete/` 이동

## 검증 명령

bash 스크립트만 추가이므로 e2e 면제 (`.claude/tools/**` 는 `.claude/**` 화이트리스트 부분집합).
