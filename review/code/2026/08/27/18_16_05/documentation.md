# 문서화(Documentation) Review

## 발견사항

- **[INFO]** `PROJECT.md` §문서 링크 검증의 스코프 3 설명이 `node_modules` 제외 규칙을 빠뜨렸다
  - 위치: `PROJECT.md:350-351` (검사 스코프 3가지 목록, "거버넌스 문서" 항목)
  - 상세: 같은 스코프를 설명하는 SoT `spec/conventions/spec-impl-evidence.md:132` 와 구현
    `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:291`
    (`GOVERNANCE_SKIP_DIRS = new Set(["worktrees", "node_modules"])`)는 둘 다
    `worktrees`·`node_modules` 두 디렉터리를 함께 제외한다고 명시하는데, `PROJECT.md` 는
    "(`.claude/worktrees/` 는 저장소 사본이라 제외)"만 적고 `node_modules` 제외는 언급이
    없다. `PROJECT.md` 는 이 절 자체를 "SoT: `spec-impl-evidence.md` §4.2"로 명시해 요약
    문서임을 자인하고 있어 실질적 혼선 위험은 낮지만, 요약과 SoT 사이에 정보가 어긋나는
    작은 완성도 갭이다.
  - 제안: `PROJECT.md:351` 의 괄호에 `node_modules` 를 함께 언급 (`(.claude/worktrees/`·
    `node_modules` 는 저장소 사본/의존성이라 제외)`). 병합 차단 사유는 아님.

## 요약

이번 diff 는 직전 라운드(`17_52_44`) 코드 리뷰가 지적한 documentation WARNING(신규 scope 3 를
`spec/conventions/spec-impl-evidence.md §4.2` 표에 반영하지 않은 SPEC-DRIFT)과 testing WARNING
2건(`:(glob)` 매직의 판정-함수 boundary 테스트 부재, 실행 계층 `ci-paths-changed.sh` pin 테스트
부재)을 모두 실제로 반영한 후속 커밋 세트다. `spec/conventions/spec-impl-evidence.md:132` 를 직접
열어 확인한 결과 표 행에 "**및 (3) 거버넌스 문서**(2026-08-27 추가)"가 실제로 추가되어 코드·
`PROJECT.md`·spec SoT 세 곳의 서술이 다시 정합해졌다. `.claude/tests/test_harness_checks_paths_coverage.py`
에는 `:(glob)` 스트립을 직접 pin 하는 `test_git_glob_magic_is_stripped_and_keeps_segment_bounds`
가, `.claude/tests/test_ci_paths_changed.py` 에는 실행 계층 세그먼트 경계를 pin 하는 두 테스트
(양성 + 대조군)가 새로 생겨 이 PR 의 핵심 회귀 방지 로직이 상시 가드로 codify 됐다. 링크 수정
4건(`.claude/docs/test-wrapper.md:25`→`../test-stages.sh.example`, `.claude/skills/spec-coverage/SKILL.md:75`→
`plan/complete/knowledge-base-quality-improvements.md`, `PROJECT.md:50`→`.claude/docs/worktree-policy.md`,
`PROJECT.md:246`→`spec/conventions/user-guide-evidence.md`)을 전부 `ls`/`find` 로 대상 파일이 실제
그 경로에 존재함을 직접 확인했고, 옛 경로(`.claude/docs/test-stages.sh.example`,
`plan/in-progress/knowledge-base-quality-improvements.md`)는 존재하지 않음도 함께 확인해 수정
방향이 옳다. `scripts/check-doc-links.py` 삭제 후 전수 grep 결과 `.github/`·`.claude/`·`Makefile`·
`package.json` 등 활성 참조가 전무하고, 남은 언급은 전부 `plan/complete/**`·`review/**`(시점
기록, 수정 불요)뿐이라 "배선된 적이 없어 삭제해도 안전하다"는 PR 의 주장과 일치한다. 신규
함수 `collectGovernanceMarkdown`/`findBrokenGovernanceLinks`(`spec-links.ts:291-328`)에는 왜
비재귀인지·왜 `mkdtemp` 런타임 fixture 를 쓰는지·`.claude/worktrees/` 제외 사유까지 담긴 JSDoc이
붙어 있고, `MIN_CLAUDE_DOCS = 20`(`spec-link-integrity.test.ts:51`)의 "실측 52개" 근거는
`find .claude -name '*.md'`(worktrees/node_modules 제외)로 직접 재현해 정확함을 확인했다.
유일하게 남는 것은 `PROJECT.md` 요약절이 `node_modules` 제외를 빠뜨린 INFO 수준의 사소한 완성도
갭 하나뿐이며, CHANGELOG.md 갱신은 내부 CI/하네스 툴링 변경이라 이전 라운드 판단대로 불요로
유지한다.

## 위험도

NONE
