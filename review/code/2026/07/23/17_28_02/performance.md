# 성능 리뷰 — guard_review_before_push.py worktree 스코프 확장

## 발견사항

- **[INFO]** push 마다 `git worktree list --porcelain` 서브프로세스 1회 추가 (블로킹 I/O, 5s 타임아웃)
  - 위치: `.claude/hooks/guard_review_before_push.py:354-367` (`_worktree_branches`), 호출부 `:497-502` (`main`)
  - 상세: `_is_git_push()` 가 True 를 반환하면(`git push` 로 판정된 모든 Bash 호출) `main()` 이 무조건 `_push_targets()` → `_worktree_branches()` 를 거쳐 `subprocess.run(["git","worktree","list","--porcelain"], timeout=5.0)` 를 새로 스폰한다. 이 훅은 매 `git push` 호출마다 동기적으로 실행되어 도구 호출을 막는 PreToolUse 훅이므로, git 프로세스가 느려지거나(디스크 I/O 경합·NFS 등) 걸리면 최대 5초까지 세션이 지연될 수 있다. `evaluate_review`/`evaluate_plan` 내부에서도 이미 git 을 호출할 가능성이 높아 push 1회당 서브프로세스 스폰 수가 증가한다.
  - 제안: 정합성 수정에 필요한 트레이드오프이므로 되돌릴 필요는 없음. 다만 `_worktree_branches` 결과를 (동일 `main()` 호출 내에서) REVIEW/PLAN 두 게이트가 재사용하는 것처럼(현재도 `targets` 는 한 번만 계산돼 재사용됨 — 좋음) 이미 최소화돼 있다는 점을 확인. 타임아웃 5초가 이 훅의 "매 Bash 호출을 동기 게이팅"하는 성격과 부합하는지만 재검토 권장(다른 subprocess 호출들과 타임아웃 정책 일치 여부).

- **[INFO]** `_mentions_branch` / `_push_targets` 스캔이 이 파일의 다른 손수 작성 스캔들과 달리 입력 크기 상한(`_MAX_REDACTION_INPUT` = 16,384) 의 보호를 받지 않음
  - 위치: `.claude/hooks/guard_review_before_push.py:382-399` (`_mentions_branch`), `:429-441` (`_push_targets`), 호출부 `:494-502`
  - 상세: 이 파일은 손수 작성한 스캔(`_owns_heredoc_as_message`, `_commit_heredoc_spans`, `_redact_inert_text` 등)마다 "3 라운드 리뷰에서 매번 다른 초선형(super-linear) 코너를 찾아냈다"는 이유로 `_MAX_REDACTION_INPUT` 상한 + 단일 패스 설계를 명시적 방어선으로 두고 있다(주석 119-127행: "이 캡은 다음 인스턴스가 아니라 이 클래스 전체를 경계 짓는다"). 그런데 `_is_git_push()` 가 이 상한을 넘는 커맨드에 대해 조기 반환(`True`, 즉 "push 로 간주해 차단")할 때도 `main()` 은 원문 커맨드 그대로 `_push_targets(command, base_cwd)` 를 호출한다. 즉 `_mentions_branch` 는 커맨드 길이나 worktree 개수(현재 15개, 증가 추세)에 대한 명시적 상한 없이 `O(worktree 수 × command 길이)` 로 반복 스캔한다.
  - 실측(이 리뷰에서 벤치마크): `_mentions_branch` 를 CPython `str.find` 로 실측한 결과 인접(overlap) 반복 패턴·naive-search 최악 패턴(`"a"*200+"b"` 탐색) 모두 선형이었고, "2MB 커맨드 × worktree 15개" 시나리오도 총 0.9ms 로 실질적 병목은 아님(CPython 의 `str.find` 는 two-way 알고리즘 기반이라 이 파일이 겪은 과거 정규식 백트래킹·이중 스캔 부류의 초선형 위험과는 다름). 따라서 즉각적 위험은 낮음.
  - 제안: 실질 병목은 아니지만, 이 파일의 자체 방어 원칙("모든 손수 스캔은 상한을 갖는다")과의 일관성을 위해 `_push_targets` 호출 전(또는 `_mentions_branch` 진입 시) 동일한 `_MAX_REDACTION_INPUT` 캡을 적용해 두는 편이 향후 회귀(예: worktree 수가 수백 개로 늘거나, `_mentions_branch` 구현이 나중에 정규식 기반으로 바뀌는 경우)를 예방한다. 급하지 않음(INFO).

- **[INFO]** REVIEW/PLAN 게이트가 매칭된 worktree 수만큼 반복 호출됨 (설계상 필요, 배율 인지 필요)
  - 위치: `.claude/hooks/guard_review_before_push.py:505-520` (REVIEW 루프), `:523-540` (PLAN 루프)
  - 상세: 수정 전에는 `evaluate_review()`/`evaluate_plan()` 이 push 당 정확히 1회 호출됐다. 수정 후에는 `targets` (cwd + 커맨드가 언급한 worktree들, realpath 로 dedup) 만큼 반복 호출된다. 실사용 패턴상 `targets` 는 통상 1~2개로 제한되므로 큰 문제는 아니지만, `evaluate_review`/`evaluate_plan` 내부가 세션 디렉토리 스캔·git log 조회 등 비trivial I/O 를 수행한다면(harness 관례상 그럴 가능성 있음), 한 커맨드가 여러 branch 를 텍스트로 언급할수록(예: 여러 `git push` 가 `&&` 로 연결된 복합 커맨드) 게이트 평가 비용이 그 수만큼 선형 증가한다. dedup(realpath 기준 `seen` 집합)이 이미 있어 동일 worktree 중복 평가는 없음 — 이 부분은 적절히 구현됨.
  - 제안: 현재 스코프에서는 정합성 수정에 필요한 트레이드오프로 수용 가능. worktree 수가 앞으로 크게 늘어나거나 `evaluate_review` 가 무거워지면 재검토.

- **[INFO]** 데이터 구조 선택은 적절함 (참고용, 조치 불요)
  - 위치: `.claude/hooks/guard_review_before_push.py:432-433` (`_push_targets` 의 `seen = {os.path.realpath(cwd)}`)
  - 상세: worktree 중복 방지에 `list`(순서 보존) + `set`(O(1) 멤버십)을 병행 사용해 적절함. `_worktree_branches` 도 `git worktree list --porcelain` 출력을 단일 패스로 파싱해 O(worktree 수) — N+1 패턴 없음.

## 요약

이번 diff(교차-worktree push 가드 스코핑)는 성능 관점에서 심각한 문제는 없다. 새로 추가된 서브프로세스 호출(`git worktree list --porcelain`, 5s 타임아웃)과 게이트 함수의 반복 호출(worktree-target 수만큼)은 정합성 버그(false ALLOW)를 닫기 위한 의도적 트레이드오프이고, 둘 다 호출 빈도가 낮은 `git push` 경로에 한정되며 실사용 시 target 수가 작아(보통 1~2개) 실질적 영향은 미미하다. 유일하게 눈에 띄는 설계 불일치는 `_mentions_branch`/`_push_targets` 스캔이 이 파일의 다른 모든 손수 작성 스캔과 달리 `_MAX_REDACTION_INPUT` 크기 상한의 보호를 받지 않는다는 점인데, 실측 벤치마크(2MB 커맨드 × worktree 15개 ≈ 0.9ms)로는 현재 병목이 아니며 CPython `str.find` 의 효율적 구현 덕분에 이 파일이 과거 겪었던 정규식 기반 초선형 회귀류와는 성격이 다르다. 즉각 조치보다는 방어적 일관성 차원의 개선 제안(INFO)으로 남긴다.

## 위험도
LOW
