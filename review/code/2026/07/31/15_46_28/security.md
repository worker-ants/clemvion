## 발견사항

- **[WARNING]** git 리비전 문자열을 `--` 구분 없이 subprocess 인자로 전달 — argument injection (CWE-88) 가능성
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:974`(`get_git_commit_files`), `:984`(`get_git_commit_diff`), `:997`(`get_git_range_files`), `:1007`(`get_git_range_diff`), `:1020`(`get_git_branch_diff_files`), `:1030`(`get_git_branch_diff`), `:1043`(`get_file_at_commit`) / `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:273`(`_branch_changed_rels`), `:355`(`_collect_code_diff`)
  - 상세: `--commit`/`--range`/`--branch`(code-review 쪽) 및 `--diff-base`(consistency 쪽) 로 받은 문자열이 `git diff`/`git show` 호출의 리비전 자리에 별도 검증·`--` 구분자 없이 그대로 들어간다. 예: `cmd = ["git", "diff", f"{branch}..."]`, `cmd = ["git", "show", commit]`, `cmd = ["git", "diff", f"{diff_base}...HEAD", "--"]`(`--` 는 이 뒤에 오는 pathspec 만 보호하고 리비전 자리는 보호 못함). 값이 `-` 로 시작하면 git 은 이를 리비전이 아니라 옵션으로 해석한다 — 예컨대 `branch = "--output=/some/path"` 이면 실제 인자는 `--output=/some/path...` 가 되어 `git diff` 결과를 표준출력 대신 임의 경로에 쓸 수 있다(`git diff` 는 `--output=<file>` 옵션을 지원). `subprocess.run` 이 리스트 형태(`shell=True` 아님)로 호출되므로 쉘 인젝션은 아니지만, 리비전 문자열이 옵션으로 둔갑하는 고전적 git argument-injection 패턴이다. 두 orchestrator 전수(`shell=True`, `startswith("-")`, `--end-of-options` 모두 grep 0건)에 동일 패턴이 반복된다. `--commit`/`--range`/`--branch`/`--diff-base` 는 오케스트레이팅 Claude 세션이 채우는 CLI 플래그라 외부 익명 사용자가 직접 주입하긴 어렵지만, 방어 코드가 전혀 없다는 점은 사실이다.
  - 제안: subprocess 인자로 넘기기 전 `if value.startswith("-"): reject/raise` 가드를 추가하거나, 리비전 인자 앞에 `--end-of-options`(git 2.24+) 를 삽입해 옵션 파싱을 명시적으로 끊을 것.

- **[WARNING]** `--spec`/`--plan`/`--impl-prep`/`--impl-done`(consistency) 및 `--files`/positional 인자(code-review) 가 저장소 루트로 경로를 제한하지 않음 — 임의 로컬 파일이 git 커밋되는 review 산출물에 실릴 수 있음
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:493`-`529`(`_require_target`) / `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1339`(`elif args.files:`)
  - 상세: `_require_target` 은 `os.path.isfile`/`os.path.isdir` 로 존재 여부만 확인하고, 그 경로가 저장소 `root` 하위인지는 검사하지 않는다(확장자 제한도 없음 — `.md` 가 아니어도 통과). 즉 `--spec ~/.ssh/id_rsa` 같은 호출이 그대로 통과해 `read_text_file` 로 파일 내용을 읽고, 5개 checker 프롬프트(`_prompts/<checker>.md`) 전원에 verbatim 삽입한다. `code_review_orchestrator.py` 의 `--files`/positional 인자도 동일 패턴(`os.path.isdir(f)` 검사 후 그 외엔 그대로 파일 경로로 취급, 저장소 밖 여부 미검사). 본 프로젝트 관례상 `review/**` 산출물은 gitignore 되지 않고 커밋되므로, 실수 또는 (prompt-injection 등으로 조작된) 호출로 저장소 밖 민감 경로가 이 인자에 들어가면 그 내용이 영구적으로 git 이력에 남는 유출 경로가 된다.
  - 제안: 두 orchestrator 모두 대상 경로 확정 시 `os.path.realpath(path).startswith(os.path.realpath(root) + os.sep)` 검사를 추가해 저장소 밖 경로를 거부(또는 최소한 명시적 경고) 할 것.

- **[WARNING]** 신규 `_BUNDLE_FILE_SENTINEL` 경계 마커가 정적 리터럴이라 동일 클래스의 경계-오인이 재발할 수 있고, 그 케이스에 대한 회귀 테스트가 없음
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:662`-`679`(`_BUNDLE_FILE_SENTINEL` 정의 및 docstring), `:699`-`740`(`truncate_file_bundle`) / 테스트: `.claude/tests/test_consistency_context_budget.py:100`-`153`(`ContentCannotForgeAFileBoundaryTest`)
  - 상세: 이번 변경은 "본문이 우연히 만들 수 없는" 경계로 기존 `#### \`...\`` 대신 `<!-- @bundle-file -->` 를 도입했다(레벨-4 헤딩과의 충돌을 막기 위함). 그런데 이 문자열은 이제 코드 docstring 뿐 아니라 `plan/in-progress/harness-consistency-summary-downgrade-rule.md:124` 에도 실제로 인용되어 있다 — 즉 이미 공개적으로 문서화된 값이다. corpus 로 수집되는 `.md` 파일(spec/plan) 이 이 값을 앞뒤 빈 줄과 함께 그대로 인용하면(이 메커니즘을 설명하는 향후 spec/plan 문서에서 충분히 있을 법한 형태), `truncate_file_bundle` 의 `text.partition(_BUNDLE_FILE_SENTINEL)`/`rest.split(_BUNDLE_FILE_SENTINEL)` 이 그 지점을 진짜 파일 경계로 오인해 문서를 조각내거나, `rel_of()` 가 그 다음 백틱 사이 문자열을 "파일 경로"로 오인해 생략 목록(`OMITTED_FILES_HEADING`)에 엉뚱한 이름을 올릴 수 있다. 이는 이번 변경이 고치려던 결함(파일이 조용히 조각나 반쪽만 보이는 것, "파일 단위로 버린다"는 보장 붕괴)과 정확히 같은 실패 형태를 한 단계 아래에서 재현하는 셈이다. 현재 `ContentCannotForgeAFileBoundaryTest` 는 구(舊) 마커(`#### \`...\``) 충돌만 검증하고, 신규 sentinel 리터럴 자체가 파일 본문에 등장하는 경우는 어떤 테스트도 다루지 않는다.
  - 제안: (a) 각 파일을 감싸기 전 원문에 이미 존재하는 sentinel 리터럴을 이스케이프/치환하거나, (b) 세션마다 랜덤 nonce 를 sentinel 에 섞어 예측 불가능하게 만들 것. 최소한 "`_BUNDLE_FILE_SENTINEL` 이 파일 본문에 그대로 포함된 경우" 를 다루는 회귀 테스트를 `test_consistency_context_budget.py` 에 추가할 것.

- **[INFO]** 디버그 로그 경로가 공유 `/tmp` 에 고정 — symlink 공격 표면 (CWE-377)
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:49`, `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:46` (둘 다 `DEBUG_LOG_FILE`) — 실제 open 은 `.claude/skills/code-review-agents/lib/session.py:16`(`make_debug_logger` 내부 `open(log_file_path, "a")`)
  - 상세: 파일명이 고정·예측 가능하며 world-writable 인 `/tmp` 아래 위치하고, append 오픈 시 `O_NOFOLLOW` 등 심링크 방지 옵션이 없다. 다중 사용자 시스템에서 다른 사용자가 이 경로를 미리 심링크로 만들어두면 로그 append 가 그 대상 파일로 향한다. 이번 diff 의 핵심 변경 대상은 아니고 기존 코드로 보이나, 전체 파일 컨텍스트로 리뷰 범위에 포함되어 기재한다.
  - 제안: `tempfile.gettempdir()` 기반 사용자별 경로 또는 프로젝트 로컬 로그 경로 사용. 불가피하면 `os.open(path, os.O_APPEND|os.O_CREAT|os.O_WRONLY|os.O_NOFOLLOW, 0o600)` 로 오픈.

- **[참고 — 긍정적 통제]** `agents_forced`/`_routing_distrust_reason` 화이트리스트(`code_review_orchestrator.py:402`-`435`)는 review-router 가 `security` reviewer 를 조용히 누락시키지 못하도록 강제하는 견고한 설계다. 2026-07-17 에 실제로 `security` 가 open-redirect 방어 코드 diff 에서 스킵됐던 사고에 대한 타당한 대응이며, 이번 리뷰에서 별도 결함을 발견하지 못했다.

## 요약

이번 세션의 리뷰 대상 5개 파일은 모두 개발 하네스(코드-리뷰/일관성-체크 오케스트레이터 2종, 그 테스트 2종, 관련 plan 문서 1종)로, 최종 사용자에게 노출되는 애플리케이션 코드(`codebase/**`)가 아니다. 그 결과 SQL 인젝션·XSS·세션/인증 우회 같은 고전적 OWASP 공격면 자체가 이 diff 에 존재하지 않고, 하드코딩된 시크릿, `shell=True`, `eval`/`exec`/`pickle`, 안전하지 않은 암호화 등 즉각적인 실행형 취약점도 발견되지 않았다(전수 grep 확인). 다만 세 가지 방어적 갭이 실재한다: (1) git 리비전 문자열이 `--` 경계 없이 subprocess 인자로 들어가는 고전적 argument-injection 패턴이 두 orchestrator 전반에 반복되고, (2) `--spec`/`--plan`/`--impl-prep`/`--impl-done`/`--files` 가 저장소 루트로 경로를 제한하지 않아 임의 로컬 파일 내용이 git 커밋되는 review 산출물에 실릴 수 있으며, (3) 이번 PR 이 새로 도입한 `_BUNDLE_FILE_SENTINEL` 경계 마커가 정적 리터럴이라 스스로 문서화되는 과정에서(이 PR 의 plan 문서 자신이 그 값을 인용) 원래 고치려던 "파일 경계 오인" 결함을 다른 리터럴로 재현할 여지를 남긴다. 세 항목 모두 공격자가 이 내부 CLI 의 호출 인자 또는 corpus 문서 내용 자체에 영향력을 가져야 성립하는 제한된 위협모델이라 즉각적인 원격 취약점은 아니지만, 저비용으로 고칠 수 있는 실질적 방어 결함이다. 부가로 고정된 `/tmp` 디버그 로그 경로는 다중 사용자 환경의 전형적 symlink 공격 표면이며 기존 코드로 보인다. 반대로 `agents_forced` 화이트리스트는 router 가 security reviewer 를 조용히 누락시키지 못하게 막는 견고한 통제로 확인된다.

## 위험도

LOW
