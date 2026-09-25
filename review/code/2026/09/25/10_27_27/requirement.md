# 요구사항(Requirement) 리뷰 — harness-probe-isolation

## 발견사항

- **[WARNING]** `make_temp_repo_copy(path)` 를 `subtrees` 없이 호출하면 예외로 죽는다 (빈 컬렉션 엣지 케이스 미검증)
  - 위치: `.claude/tests/_harness.py:138` (`def make_temp_repo_copy`), 특히 `164`행의 `git_in(repo, "commit", "-qm", "copy of this checkout")`
  - 상세: 시그니처는 `*subtrees: str` 로 0개 호출을 허용하지만, 실제로 0개를 넘기면 `make_temp_git_repo` 가 만든 초기 `.gitkeep` 커밋 이후 `git add -A` 로 새로 스테이징될 것이 없어 `git commit` 이 "nothing to commit" 으로 비영(非零) 종료하고, `git_in` 의 기본 `check=True` 때문에 `subprocess.CalledProcessError` 가 그대로 전파된다. 실측(스크래치 스크립트로 직접 호출):
    ```
    CalledProcessError: Command [...'commit', '-qm', 'copy of this checkout']' returned non-zero exit status 1.
    ```
    현재 이 저장소의 4개 호출부는 전부 `"spec/5-system"` 최소 1개를 넘기므로 오늘 당장 터지지는 않지만, docstring 은 이 제약을 언급하지 않고 오히려 "subtrees 를 committed 로 만든다" 는 일반적 계약처럼 읽힌다. 다음 사람이 "커밋 diff 만 비우면 되니 subtree 없이 부르자" 고 판단하면 관련 없어 보이는 git 에러로 실패한다.
  - 제안: `git commit --allow-empty` 로 바꾸거나, `subtrees` 가 비었을 때를 docstring 에 명시(또는 `assert subtrees`)해 실패 모드를 의도적으로 만든다.

- **[INFO]** 같은 헬퍼가 겹치는/중첩된 `subtrees` 를 받으면 `shutil.copytree` 가 `FileExistsError` 로 죽는다
  - 위치: `.claude/tests/_harness.py:161-162` (`for rel in subtrees: shutil.copytree(...)`)
  - 상세: 예컨대 `("spec", "spec/5-system")` 처럼 중첩 경로를 같이 넘기면 두 번째 `copytree` 의 목적지가 첫 번째 복사로 이미 존재해 실패한다. 현재 호출부는 모두 단일·비중첩 `subtree` 만 쓰므로 오늘은 무해하지만 방어 코드도 문서화도 없다. 조치 불요 수준(회색지대)이나 다음에 다중 subtree 를 넘기는 호출부가 생기면 재확인 필요.

- **[INFO]** spec fidelity — 이 변경 영역을 정의하는 product spec 문서 없음(harness-only, `spec_impact: none`)
  - 위치: `plan/in-progress/harness-probe-isolation.md:6` (frontmatter `spec_impact: none`), `.claude/tests/_harness.py`, `.claude/tests/test_consistency_*.py`, `.claude/tests/test_router_decision_trust.py`
  - 상세: 변경 전부가 `.claude/tests/**` pytest 하네스 자체의 fixture 격리이며 `codebase/**` 나 `spec/**` 이 정의하는 어떤 API·엔티티·상태 전이도 건드리지 않는다. 이미 커밋된 `review/consistency/2026/09/25/09_56_00/cross_spec.md` · `convention_compliance.md` 도 동일 결론(NONE)이다. spec 누락이 아니라 이 계층에 대응하는 spec 자체가 존재하지 않는 영역(harness 는 CLAUDE.md 상 governance 문서로만 규율됨) — 조치 불요.

## 기능 검증 (실측)

- 리뷰 대상 4개 테스트 파일만 격리 실행: `python3 -m pytest .claude/tests/test_consistency_bundle_priority.py .claude/tests/test_consistency_spec_draft_snapshot.py .claude/tests/test_consistency_target_validation.py .claude/tests/test_router_decision_trust.py -q` → `73 passed, 4 subtests passed`.
- 전체 하네스: `python3 -m pytest .claude/tests -q` → `1174 passed, 1 warning, 1326 subtests passed`(plan 의 "1173 passed" 와 근사 — 이번 PR 이 순net 테스트 1개(`TheRepoCopyFixtureTest`)를 추가했으므로 정합).
- 실행 후 `git status --short` 는 이 리뷰 세션이 만든 `review/code/2026/09/25/10_27_27/` 외에 변경 없음 — 실제 저장소 트리 오염 없음을 확인. `spec/5-system/7-llm-client.md` 에 `grep -n "uncommitted probe\|committed probe"` → 매치 없음(exit 1) — 목표한 "프로브가 실제 spec 을 건드리지 않는다" 는 계약이 실측으로 성립.
- `make_temp_repo_copy` 의 핵심 계약(커밋 diff 가 `origin/main` 을 사본 자신의 HEAD 로 고정한다)은 신설 `TheRepoCopyFixtureTest.test_a_commit_in_the_copy_is_in_the_branch_diff` 가 직접 pin 하고, `_edited_rels`/`_branch_changed_rels` 시그니처(`consistency_orchestrator.py:239,260`)와 실제 호출 인자 순서(`diff_base, root`)가 테스트 코드와 정확히 일치함을 소스에서 대조 확인했다.
- `test_router_decision_trust.py` 의 `cwd=tmp_src`(비-git 임시 디렉터리) 로 `--prepare` 를 도는 케이스는, `code_review_orchestrator.collect_change_infos` 의 `args.files`(positional) 분기가 git 를 전혀 요구하지 않음을 소스로 확인해 설계상 안전함을 검증했다(스코프 플래그 없이 명시 경로만 주면 git 미의존).

## 리뷰 프로세스 위생

뮤테이션 검증은 저장소 밖 scratch(`tempfile.mkdtemp()`) 에서만 수행했고 저장소 파일에는 쓰지 않았다. `git status --short` 로 확인된 잔여물 없음(위 "기능 검증" 참조). 이 변경 자체가 바로 이 위생 규약(프로브 격리)을 만드는 PR 이라는 점도 확인했다 — 리뷰 중 실제로 재발을 관측하지 않았다.

## 요약

`.claude/tests/_harness.py` 의 신설 `make_temp_repo_copy` 와 그 위에서 재작성된 4개 테스트 파일(`test_consistency_bundle_priority.py`, `test_consistency_spec_draft_snapshot.py`, `test_consistency_target_validation.py`, `test_router_decision_trust.py`)은 plan(`plan/in-progress/harness-probe-isolation.md`)이 서술한 목표 — "병렬 pytest 실행이 실제 저장소 트리(spec 파일·plan 고정 파일·review 세션·저장소 루트 임시 디렉터리)에 프로브를 남기지 않는다" — 를 실제로 달성한다. 실측(전체 하네스 1174 passed, 격리 대상 4파일 개별 실행 통과, 실행 후 `git status`/`grep` 로 확인한 무잔여)과 소스 대조(호출 시그니처·env var·git ref 계약)가 모두 plan 의 서술과 일치했다. 유일하게 남은 흠은 신설 헬퍼 `make_temp_repo_copy` 가 `subtrees` 0개 호출 시 불투명한 `git commit` 실패로 죽는 미문서화 엣지 케이스이며(현재 호출부 4곳 모두 안전), 이는 오늘의 정합성엔 영향 없는 WARNING 수준의 향후 함정이다. spec fidelity 관점에서는 이 변경이 어떤 product spec 표면도 건드리지 않아 해당 항목은 적용 대상 밖(NONE)이다. TODO/FIXME 류 미완성 표시는 없고, plan 체크리스트의 `pytest 전체`/`ai-review` 미체크 항목은 바로 이 리뷰 세션이 채우는 절차 그 자체로 확인된다.

## 위험도

LOW
