# 변경 범위(Scope) 리뷰 — push-guard-worktree-scope (4차, 18_22_56)

## 검증 방법

`git diff --name-only origin/main...HEAD`(triple-dot, merge-base 기준)로 39개 파일을 확정하고,
`.claude/hooks/guard_review_before_push.py` / `.claude/tests/test_push_guard_worktree_scope.py` /
`plan/in-progress/push-guard-worktree-scope.md` 전체 diff 를 직접 열어 대조했다. 또한 `git log
origin/main..HEAD` 로 4개 커밋(65e7626fb → 4a516b03a → 942412ea3 → 89c3870b4)을 확인하고, 가장
최근 커밋(`89c3870b4`, 이번에 처음 리뷰되는 증분)의 `git show --stat`/파일별 diff 를 별도로 열어
직전 3차 스코프 리뷰(`review/code/2026/07/23/18_06_41/scope.md`, 위험도 NONE) 이후 새로 추가된
부분만 따로 확인했다.

**주의(재확인)**: `git diff origin/main`(non-triple-dot)로 단순 비교하면 origin/main 이 이 branch
fork 이후 별도 PR 로 전진해 있어 무관한 파일이 reverse-diff 로 섞여 보일 수 있다(3차 스코프
리뷰가 이미 지적한 fork-point 오염). 이번에도 `...`(merge-base) 표기를 사용해 그 오염을 배제했고,
`--name-only` 결과에 `harness-checks.yml`/`test_e2e_exemption_paths_sync.py` 류의 무관 파일이
없음을 확인했다 — 이 PR 의 실제 변경은 아래 39개 파일뿐이다.

## 발견사항

없음 — 스코프 이탈로 지적할 항목이 없다.

## 점검 결과 상세

- **의도 이상의 변경**: 없음. 39개 파일 전부가 "push 가드가 cwd 단일 worktree 대신 실제 push
  대상 worktree(들)를 평가하도록" 라는 단일 정합성 fix 와 그 fix 에 대한 3라운드 `/ai-review`
  대응(및 그 감사 산출물 커밋)으로 수렴한다. `guard_review_before_push.py` 의 diff 는 신규 함수
  4개(`_worktree_branches`/`_mentions_branch`/`_accepts_cwd`/`_push_targets`), `_run_gate()`
  DRY 헬퍼, 메시지 포맷의 `worktree:` 필드, `main()` 의 target 순회 배선뿐이다. 기존
  `_is_git_push`/`_redact_inert_text` 등 push 탐지 로직은 무손(diff 밖).
- **불필요한 리팩토링**: `_run_gate()` 추출(커밋 `4a516b03a`)과 `base_cwd` 죽은 파라미터 제거·
  키워드 전용 인자 전환(커밋 `942412ea3`)은 임의 정리가 아니라 같은 작업 세션의 1·2차
  `/ai-review` WARNING(각각 architecture/maintainability 의 REVIEW·PLAN 루프 중복 지적, 3인
  독립 지적된 죽은 파라미터)에 대한 직접 대응이다. 각 커밋 메시지·RESOLUTION.md 가 근거를
  1:1 로 남기고 있어 "관련 없는 정리"로 보기 어렵다. 4차 대상 신규 증분(`89c3870b4`)도 3차
  WARNING 1("2차 RESOLUTION 의 커버리지 주장이 틀렸다")에 대한 회귀 테스트 1건
  (`test_push_targets_crash_falls_back_to_cwd`) + 기존 테스트 docstring 1곳 보강뿐, 별건
  리팩토링 없음.
- **기능 확장(over-engineering)**: `_accepts_cwd()` 시그니처 probe 는 plan 문서·3라운드
  mutation 실측(M3a/M3b)으로 "제거 시 실제로 silent fail-open 회귀"가 실증되어 있어 방어적
  과설계로 보기 어렵다. 이번 4차 증분에서 새로 추가된 기능도 없다 — 신규 함수·신규 동작 없이
  테스트·문서 정정뿐.
- **무관한 수정**: 없음. `--name-only` 39개 파일 = 코드 1 + 테스트 1 + README 카탈로그 1행 +
  plan 1 + `review/code/2026/07/23/{17_28_02,17_51_28,18_06_41}/**` 감사 산출물 35개. 코드베이스
  다른 영역(`codebase/**`)·다른 훅(`guard_review_before_stop.py` 등)·설정 파일 변경 없음.
- **포맷팅 변경**: 실질 변경과 무관한 공백/줄바꿈 재포맷 없음. `main()` 안 REVIEW/PLAN 블록이
  diff 상 큰 `-`/`+` 블록으로 보이지만 `_run_gate()` 호출로 실질 대체된 것이라 무의미한 재포맷이
  아니다(3차 스코프 리뷰가 이미 확인, 재확인 결과 동일).
- **주석 변경**: 기존 주석의 삭제·수정은 두 곳뿐이며 둘 다 근거가 있다 — (1) `_run_gate` 인접
  주석을 "legacy fallback 은 인자 없이 호출하므로 **프로세스 cwd** 를 평가한다"로 정정(2차
  WARNING 2 대응, `base_cwd` 죽은 파라미터 제거와 짝), (2) 4차 증분에서
  `test_worktree_listing_failure_degrades_to_cwd` docstring 에 "이건 `main()` 의 `except` 와는
  다른 fail-open 경로다"라는 구분 설명을 추가(3차 WARNING 1 이 지적한 오귀속 방지). 무관한
  주석 잡음은 없다.
- **임포트 변경**: `import subprocess`(`_worktree_branches`)·`import inspect`(`_accepts_cwd`)만
  추가됐고 둘 다 즉시 소비된다. 미사용 임포트·불필요한 정리 없음.
- **설정 변경**: 없음. `.claude/settings.json`, `.github/workflows/**` 등 미변경.
- **감사 기록 소급 수정 1건 (특기, 문제 아님)**: 4차 대상 증분(`89c3870b4`)이
  `review/code/2026/07/23/17_28_02/RESOLUTION.md`(1차 라운드에 이미 커밋된 감사 문서)의 WARNING
  3 행을 "반영" → "반영이 불완전했다 (3차 리뷰가 재지적)"로 수정한다. 과거 커밋된 리뷰 산출물을
  사후 편집한다는 점에서 통상적인 "새 코드만 추가" 패턴과 다르지만, (1) 실제로 잘못된 진술을
  정정하는 것이고 (2) 누가 언제 무엇을 근거로 정정했는지("3차 리뷰가 재지적") 그 자리에 명시돼
  있어 은폐가 아니라 투명한 감사 추적 보강이다. plan 문서의 명시적 원칙("교훈 — '커버된다'는
  추론이 아니라 실측이어야 한다")과도 일치한다. 스코프 이탈로 분류하지 않는다.
- **README.md**: `.claude/tests/README.md` 는 신규 테스트 파일 카탈로그 등재 1행 추가뿐(기존
  행 재정렬·서술 변경 없음) — 테스트 신설에 필수 수반되는 갱신.
- **plan 문서**: `plan/in-progress/push-guard-worktree-scope.md` 는 CLAUDE.md 관례(`plan/
  in-progress/<name>.md`, frontmatter `worktree` 포함)에 부합. 4차 증분에서 "3차 리뷰 반영"
  섹션이 추가됐는데, 이는 코드 변경 없는 별건 서술 확장이 아니라 같은 파일 안에 이미 있던
  "1차/2차 리뷰 반영" 섹션과 동일한 형식으로 감사 추적을 대칭화한 것(2차 리뷰 WARNING 2 의
  직접 대응)이다.
- **리뷰 산출물 커밋**: `review/code/2026/07/23/{17_28_02,17_51_28,18_06_41}/**`(35개 파일)은
  CLAUDE.md "코드 리뷰 산출물은 `review/code/**`에 커밋" 관례상 정상 버전관리 대상이며, 3개
  라운드 모두 같은 push-guard-worktree-scope 작업의 `/ai-review` 산출물이다. 무관한 다른
  작업의 리뷰 산출물이 섞여 들어온 흔적은 없다(각 폴더의 `meta.json`.`files` 가 동일한 4개
  핵심 파일 + 그 이전 라운드 산출물만 나열).

## 요약

39개 변경 파일은 전부 "push 가드가 cwd 단일 worktree 대신 실제 push 대상 worktree(들)를
평가하도록"이라는 단일 정합성 fix, 그리고 같은 작업 세션 안에서 진행된 3라운드 `/ai-review` →
fix 사이클의 직접 산물(코드/테스트 보강, DRY 리팩터, plan·감사 문서 갱신, 리뷰 산출물 커밋)에
밀접하게 종속된다. 4차 리뷰 대상으로 처음 노출되는 증분(`89c3870b4`)도 3차 리뷰 WARNING 2건에
대한 회귀 테스트 1건 + 문서 정정뿐으로, 새로운 기능·무관한 파일·리팩토링은 없다. 유일하게
눈에 띄는 비-표준 패턴은 과거 라운드(1차)의 이미 커밋된 RESOLUTION.md 를 소급 정정한 것인데,
정정 사유가 그 자리에 명시돼 있어 투명하고 plan 의 명시적 감사 원칙과 일치하므로 문제 삼지
않는다. 무관한 파일·불필요한 리팩토링·기능 확장(over-engineering)·포맷팅 잡음·주석 잡음·미사용
임포트·의도치 않은 설정 변경 — 어느 것도 발견되지 않았다.

## 위험도

NONE
