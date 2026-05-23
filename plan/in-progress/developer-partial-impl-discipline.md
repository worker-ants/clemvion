---
worktree: pending
started: pending
owner: developer
---

# Developer §4 partial-implementation discipline 실행 plan

> Stub. 실착수 시 worktree·started 채움.

## 배경

`plan/in-progress/spec-harness-impl-coverage.md` (spec PR) 의 **결정 D**. 본 plan 은 그 결정의 *코드/문서 반영* 단계.

본 spec PR 안에서 이미:
- `.claude/skills/developer/SKILL.md §4` 본문 한 줄 추가 (partial-impl 분리 의무)
- `PROJECT.md §DOCUMENTATION 단계 종료 사전 체크리스트` 신규 체크박스 1건

→ **본 plan 은 실착수 시점에 갱신 사실 재확인 + 사용자 가시 영향 부재 확인 + plan complete 이동**. 추가 코드 변경 없음.

## 의존

없음 (spec PR 머지 직후 진행 가능).

## 체크리스트

- [ ] spec PR 머지 확인 (PR 번호 본 plan 갱신 시 기록)
- [ ] developer/SKILL.md + PROJECT.md 의 한 줄 변경이 main 에 반영됐는지 확인
- [ ] 사용자 가시 영향 (developer 호출 시 partial-impl 분리 의무 인지) 검증
- [ ] plan `complete/` 이동 (`chore(plan): mark developer-partial-impl-discipline complete`)

## 검증 명령

본 plan 은 문서/skill 정의 변경만이므로 e2e 면제 (PROJECT.md §e2e 면제 화이트리스트 - `.claude/**`).
