# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `git push` 탐지 시 `git worktree list --porcelain` subprocess 가 항상(양쪽 게이트를 env override 로 bypass 한 경우까지) 무조건 1회 실행된다
  - 위치: `.claude/hooks/guard_review_before_push.py:800` (`main()` 의 `targets = _push_targets(command, base_cwd)`), 실제 subprocess 는 `.claude/hooks/guard_review_before_push.py:469-479` (`_worktree_branches`)
  - 상세: `main()` 은 `_run_gates()` 를 부르기 전에 `_push_targets()` 를 무조건 호출하고, `_push_targets` 는 매번 `_worktree_branches(cwd)` 를 호출해 `git worktree list --porcelain` 을 스폰한다. `BYPASS_REVIEW_GUARD=1` 와 `BYPASS_PLAN_GUARD=1` 을 동시에 준 경우에도(즉 두 게이트 모두 실질적으로 평가하지 않는 push 에도) 이 subprocess 는 여전히 실행된다. 로컬 read-only 명령이고 5s timeout·fail-open(예외 시 `[]`)으로 안전하게 감싸여 있어 정확성 문제는 아니지만, "이 push 를 게시할 worktree 목록"을 굳이 계산할 필요가 없는 경로에서도 매 `git push` 호출마다 새 프로세스를 fork 하는 부작용이 새로 생겼다.
  - 제안: 의도된 트레이드오프라면 문제 없음(현재 동작이 목적). 다만 두 BYPASS 가 모두 켜진 경우를 조기 스킵하고 싶다면 `_run_gates` 이전에 얕은 사전 체크를 추가하는 선택지가 있다 — 다만 이는 최적화이지 정합성 이슈는 아니므로 필수는 아니다.

- **[INFO]** `evaluate_review` / `evaluate_plan` 호출 빈도가 "1회" → "push target(worktree) 개수만큼" 으로 증폭됨
  - 위치: `.claude/hooks/guard_review_before_push.py:645-689` (`_evaluate_over_targets`), 호출부 `.claude/hooks/guard_review_before_push.py:692-738` (`_run_gates`)
  - 상세: worktree-scoping 수정 이전에는 각 게이트 함수가 프로세스당 최대 1회만 호출됐지만, 이번 변경으로 cwd + 커맨드가 언급하는 각 워크트리(브랜치/경로 매칭)마다 한 번씩 호출된다. `review_guard.evaluate_review` / `plan_guard.evaluate_plan` 은 내부적으로 자체 git subprocess 호출(`_repo_root`, `_default_branch`, `_merge_base`, `_committed_code_changes` 등)을 수행하므로, 타깃 워크트리 수에 비례해 하위 git 프로세스 호출 총량도 늘어난다. 두 함수 모두 파일시스템 write 는 하지 않는 것으로 확인했으므로(write-mode `open`/`os.makedirs`/`os.remove` grep 0건) 부작용의 성격은 "쓰기 증폭"이 아니라 "읽기·프로세스 스폰 증폭"이며, `_evaluate_over_targets` 는 §E 스트릭 카운트가 target 당이 아니라 gate 당 1회로만 기록되도록 이미 dedup 되어 있어(라인 684-688, 724-728) 관측 부작용(스트릭 파일)의 증폭은 없다. 문서화된 의도된 설계(false-ALLOW hole 을 닫기 위한 트레이드오프)이며 워크트리 수가 통상 1~2개로 bounded 되어 실질적 영향은 작다.
  - 제안: 별도 조치 불필요. 다만 향후 `evaluate_review`/`evaluate_plan` 에 비-멱등 부작용(예: 캐시 기록)이 추가된다면 이 호출 증폭이 문제가 될 수 있으므로, 두 함수의 "read-only" 불변식을 유지해야 한다는 점을 인지해 둘 필요가 있다.

- **[INFO]** 워크트리 스코프 결정이 harness 가 보낸 payload 의 `cwd` 필드에 새로 의존
  - 위치: `.claude/hooks/guard_review_before_push.py:798` (`base_cwd = payload.get("cwd") or os.getcwd()`)
  - 상세: 이전에는 훅이 자기 프로세스의 `os.getcwd()` 만을 신뢰했지만, 이번 변경은 PreToolUse payload 의 `cwd` 필드(Bash tool 이 그 커맨드를 실행할 디렉터리)를 1차 신뢰 소스로 사용하고, 없을 때만 `os.getcwd()` 로 폴백한다. 이는 이 PR 의 핵심 목적(다른 워크트리에서 push 할 때 그 워크트리를 실제로 평가)이므로 의도된 것이며, `cwd` 가 없거나 실제와 다르더라도 "cwd 자체는 항상 target 에 포함"(라인 512 `targets = [cwd]`)되고 브랜치/경로 매칭은 subtract 만 가능한 allowlist 설계라 안전한 방향으로만 열려 있다. 다만 이 훅이 신뢰하는 입력 표면이 "자기 프로세스 상태"에서 "harness 가 준 JSON payload 필드"로 넓어졌다는 사실은 side-effect 관점에서 기록할 가치가 있다(공격 벡터라기보다 fail-open 방향성 확인 목적).
  - 제안: 별도 조치 불필요 — 이미 설계 문서(라인 375-419 comment block)에서 이 트레이드오프를 상세히 설명하고 있음.

- **[INFO]** 신규 함수는 전부 module-private(`_` prefix)이며 공개 시그니처 변경 없음
  - 위치: `.claude/hooks/guard_review_before_push.py` 전체 — `_worktree_branches`(464), `_mentions_branch`(458), `_accepts_cwd`(478), `_push_targets`(503), `_evaluate_over_targets`(645)
  - 상세: 이번 diff 가 추가/변경한 함수는 모두 이 모듈 내부에서만 쓰이는 `_` 접두 함수이거나(`main()` 자체는 이미 `if __name__ == "__main__": sys.exit(main())` 진입점으로만 쓰임), 테스트 파일에서만 직접 import 해 검증한다. 외부(다른 훅·스크립트)가 이 모듈의 함수를 import 해서 쓰는 흔적은 없어 시그니처 변경으로 인한 호출자 파급은 없다.

## 요약
이번 diff(워크트리 스코핑 기능 + 그 회귀 테스트 + README 카탈로그 갱신)는 신규 전역 변수·환경 변수 오·남용·의도치 않은 파일 쓰기는 없다. `evaluate_review`/`evaluate_plan` 은 read-only 로 확인되어 호출 횟수 증폭이 쓰기 부작용으로 이어지지 않으며, §E fail-open 스트릭 카운트도 target 이 아니라 gate 단위로 정확히 dedup 되어 있다. 유일하게 새로 생긴 실질적 부작용은 "매 push 마다 `git worktree list` subprocess 를 무조건 1회 더 스폰"하고 "게이트 평가 함수를 워크트리 수만큼 반복 호출(→ 내부 git subprocess 도 비례 증가)"하는 것인데, 둘 다 타임아웃·fail-open·문서화가 갖춰진 의도된 설계이고 대상 워크트리 수가 실무적으로 작아 위험도가 낮다. 테스트 파일은 실제 서브프로세스·임시 git repo 만을 건드리며 `CLAUDE_PROJECT_DIR` 격리를 필요한 두 케이스에서 정확히 적용해 실제 저장소 상태(`.claude/state/push_guard_failopen.json`)를 오염시키지 않는다.

## 위험도
LOW
