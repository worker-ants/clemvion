# RESOLUTION — consistency `--impl-done` 라운드 2 (09_05_51)

판정 기준: 이 세션의 SUMMARY.md(**BLOCK: NO**, Critical 0 · 경고 7 · 참고 13). 검토 기준은 개발 브랜치 HEAD `b37c43b8f` 와 짝 planner 브랜치(`claude/nerv-cutover-1-docs-c46df0`)를 합친 상태다.

- 수정 커밋: 개발 브랜치 `0286a684e`(루브릭 · README 템플릿 · PROJECT.md 포인터), `edec5c56c`(미러 README, `pull.py --all` 출력). planner 브랜치 `d85482e55`(거버넌스 문서 · 에이전트 정의).
- 검증: 개발 브랜치 `test_nerv_mirror_pull` · `test_agent_consistency` 86 passed, `pull.py --check` 미러 169편 · 문제 0. planner 브랜치 `pytest .claude/tests` 1214 passed, docs 가드 3709 passed.
- `codebase/**` 는 이번에도 바꾸지 않았다. 코드 주석 쪽 제안은 아래 표대로 미뤘다.
- 미룬 항목은 그 단계 NERV Task 본문에 적었다: 단계 3 `CLE-T-FN2JWK`, 4e `CLE-T-VP5KDJ`, 5 `CLE-T-7M4C4X`.

## 경고

| # | 처분 | 근거 |
|---|------|------|
| 1 | 일부 fixed `0286a684e` | `PROJECT.md` 의 미러 제외 문장에 "근거는 동결된 옛 SoT 가 아니라 NERV `CLE-ENG-SPECEVIDENCE` R-12" 를 적었다. 가드 테스트 · `spec-links.ts` 주석(`codebase/**`)은 고치지 않았다. 주석 한 줄 때문에 코드 리뷰 전수 라운드와 e2e 를 다시 돌리게 되고, 그 가드들은 단계 4f · 5 에서 다시 쓴다(`CLE-T-7M4C4X` 본문에 정리 대상으로 적었다). R-12 는 미승인 초안이다. 승인은 사람이 한다(PR 본문에 적는다) |
| 2 | 머지 순서로 해소 | 짝 planner PR [#1432](https://github.com/worker-ants/clemvion/pull/1432) 를 먼저 머지한다. 두 PR 본문 첫 줄에 순서를 적었다. checker 가 본 "CLAUDE.md · SKILL 이 NERV 를 언급하지 않음" 은 개발 브랜치 HEAD 만 본 결과이고 짝 브랜치가 고친다 |
| 3 | fixed `d85482e55` | plan-lifecycle §3 · worktree-policy §5.1: 허용 경우를 셋으로 열거(plan 링크 · `pending_plans` 정리 · `status` 승격), 우회 변수를 켜 둔 동안 막는 경로 전체가 열린다는 사실, 새 `status: partial` · `pending_plans` 등록 금지. developer SKILL §4 의 partial 표면은 NERV Task 로 |
| 4 | fixed `d85482e55` | "스펙 정정이 우회보다 쌌다(3줄)" 를 옛 흐름의 실측으로 한정하고 새 흐름은 아직 재지 않았다고 적었다 |
| 5 | Task 로 이관 | 열린 항목이 옛 `spec/` 편집을 전제하는 plan 12개(전수 `grep`)와 이관 방침을 단계 3 Task `CLE-T-FN2JWK` 본문에 적었다. plan 머리말 표지는 달지 않았다. `plan/` 은 단계 3 이 지우고 남은 항목은 Task 로 옮긴다 |
| 6 | fixed `0286a684e` · `edec5c56c` | README 템플릿에 "미러의 `status` 는 NERV 문서 상태이고 옛 트리의 구현 상태와 다르다. 구현 상태는 본문 머리 줄" 을 더하고 테스트가 단언한다 |
| 7 | fixed `0286a684e` · `d85482e55` | `role_instructions.py` 두 곳과 에이전트 정의 두 개의 "명명 컨벤션" 을 NERV 키 규칙과 미러 경로로 바꿨다. 두 쪽 문구가 같다(`test_agent_consistency` 는 문구를 대조하지 않는다) |

## 참고

| # | 처분 | 근거 |
|---|------|------|
| 1 | 일부 fixed `d85482e55` | consistency SKILL 각주에 "4e 전까지 NERV 에서 새로 쓴 스펙 · Rationale 과의 연속성은 `nerv_spec_check` 가 맡는다" 를 더했다. 재측정과 `spec_impact` 처방은 4e Task `CLE-T-VP5KDJ` 본문에 적었다 |
| 2 | Task 로 이관 | 정리 시점 표현(단계 5 vs 4f/5) 통일을 단계 5 Task 본문에 적었다 |
| 3 | wont_fix | 최상위 `spec/CLE-*.md` 존재 전제는 지금 성립한다(`CLE-VISION` · `CLE-GLOSSARY`). 가드 자체가 단계 5 에서 사라진다 |
| 4 | wont_fix | 결정 D1~D12 의 정의는 각 전환 Task 본문의 "결정" 줄에 있다. 저장소 문서에 목록을 복제하지 않는다 |
| 5 | fixed `0286a684e` · `d85482e55` | "구현할 때 받은 스펙 버전의 스냅샷" 으로 고쳤다(README 템플릿 · CLAUDE.md) |
| 6 | fixed `d85482e55` | `.claude/docs/README.md` 색인 행에 §5.1 |
| 7 | Task 로 이관 | `stray-tool-tags` 의 `spec` 하한은 단계 5, `plan` 하한은 단계 3 Task 본문에 적었다 |
| 8 | wont_fix | `harness-review-gate-followups.md` §O 사례 추가는 plan 편집이다. `plan/` 은 단계 3 에서 사라지고, 이 사례는 이 RESOLUTION 에 남는다 |
| 9 | 이미 범위에 있음 | 4b Task `CLE-T-BDRZVX` 의 산출물에 "`no-internal-refs` 에 `CLE-*` · `REQ-*` 노출 금지 추가" 가 이미 있다. `spec/CLE-` 경로도 `CLE-` 패턴에 걸린다 |
| 10 | wont_fix | `BYPASS_NERV_OWNED_PATHS` 는 이미 훅 · 테스트 · 문서가 같은 이름을 쓴다. 이름이 겹치는 곳은 없다 |
| 11 | fixed `d85482e55` | worktree-policy §8 의 `.nerv/` 행에 미러 도구 캐시(지워도 된다)를 적었다 |
| 12 | wont_fix | `area` 는 docstring 이 "미러 폴더" 라고 밝힌다(코드 리뷰 라운드 3 에서 더했다) |
| 13 | wont_fix | 새 이름은 모두 `spec-` · `nerv-` 한정어가 붙어 실행 충돌이 없다 |
