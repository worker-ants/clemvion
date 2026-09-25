# 부작용(Side Effect) 리뷰 — harness-probe-isolation

## 검토 범위 메모

변경분은 전부 `.claude/tests/**`(pytest 하네스) · `CHANGELOG.md` · `plan/in-progress/**` ·
`review/consistency/2026/09/25/09_56_00/**`(consistency-checker 산출물)로, `codebase/**` 제품
코드는 건드리지 않는다. 이 PR 의 목적 자체가 "하네스 테스트가 병렬 실행 중 실제 저장소 트리에
프로브를 써서 서로를 오염시키는" **기존 부작용을 제거**하는 것이므로, 통상의 "새 부작용 도입
여부" 관점과 함께 "제거를 표방한 부작용이 실제로 남아있지 않은가"도 확인했다. `.claude/tests/_harness.py`
전체 컨텍스트, `test_consistency_bundle_priority.py`(`grep ROOT`) 실제 파일, `consistency_orchestrator.py`
의 `CONSISTENCY_OUTPUT_DIR` 지원 여부를 직접 `Read`/`grep` 으로 대조했다. 저장소 파일은 전혀
수정하지 않았고(`git status --short` 확인, 리뷰 세션 디렉터리 외 변경 없음), 별도 뮤테이션도
수행하지 않았다 — target plan 문서(`plan/in-progress/harness-probe-isolation.md`) §D 에 이미
P1~P6 뮤턴트 예측/실측과 병렬 재현 전후 census(잔여 5/6→0/6, 감사훅 97행→0행)가 기록되어 있어
중복 검증하지 않았다.

## 발견사항

이번 diff 자체에서 새로 도입된 CRITICAL/WARNING 급 부작용은 발견하지 못했다. 오히려 아래가
확인된 사실이다.

- **[INFO]** 실제 체크아웃에 대한 쓰기가 전부 임시 사본으로 옮겨졌다 — 회귀 없음 확인
  - 위치: `.claude/tests/_harness.py:138`(`make_temp_repo_copy` 신설), `.claude/tests/test_consistency_bundle_priority.py`(`TheDocumentBeingEditedIsNeverOmittedTest`, `TheDiffOutranksTheFolderDumpTest`), `.claude/tests/test_consistency_spec_draft_snapshot.py`(`SpecDraftSnapshotTest.setUp`), `.claude/tests/test_consistency_target_validation.py:87`(`test_valid_target_still_prepares_a_session`), `.claude/tests/test_router_decision_trust.py`(`test_long_source_list_is_truncated_with_an_accurate_remainder`)
  - 상세: `grep -n "ROOT" .claude/tests/test_consistency_bundle_priority.py` 로 남은 `ROOT`(실제
    체크아웃) 참조를 전수 확인했는데, 전부 `collect_markdown_files`/`prioritize_bundle_files`/
    `collect_context` 에 **읽기 전용**으로만 쓰인다. 실제 쓰기(`open(..., "w"/"a")`, `os.makedirs`,
    `shutil.copytree` 목적지, `git commit`)는 전부 `make_temp_repo_copy` 가 만든 `root`(임시
    디렉터리 안 git 사본)를 향한다. `test_the_probe_runs_outside_this_checkout` 은 프로브 실행 후
    별도 `run_in_orchestrator` 로 실제 `ROOT/spec/5-system/7-llm-client.md` 를 다시 읽어 마커가
    없음을 재확인하는 캐너리까지 갖춰, "원복이 됐다고 믿는" 이 아니라 "실제로 안 남았다"를 잰다.
  - 결론: 부작용 없음. 조치 불요.

- **[INFO]** 테스트 헬퍼 시그니처 변경은 전부 파일-로컬(`_` 프리픽스) 헬퍼이고 호출부가 동일
  diff 안에서 함께 갱신됨 — 외부 영향 없음
  - 위치: `.claude/tests/test_consistency_spec_draft_snapshot.py`(`_run(*args)` → `_run(cwd, *args)`,
    `_session_dir(proc)` → `_session_dir(proc, cwd)`), `.claude/tests/test_consistency_target_validation.py:35`(`_run(*args)` → `_run(*args, env=None)`),
    `.claude/tests/test_router_decision_trust.py:335`(`_prepare_over(self, *paths)` → `_prepare_over(self, *paths, cwd=REPO_ROOT)`)
  - 상세: `_run`/`_session_dir`/`_prepare_over` 는 모두 그 테스트 모듈/클래스 안에서만 쓰이는
    private 헬퍼다. `test_consistency_target_validation.py`의 `env` 파라미터는 기본값 `None`
    이라 기존 호출부(`env=` 미지정) 는 `subprocess.run(env=None)` 로 이전과 동일하게 부모 프로세스
    환경을 상속한다 — 동작 변화 없음. `_prepare_over` 의 `cwd` 도 기본값이 `REPO_ROOT`라 다른
    호출부(`test_mixed_changeset_is_declared_not_doc_only` 등)는 그대로다. 공개 API(오케스트레이터
    CLI, `_harness.py` 의 기존 공개 함수 `make_temp_git_repo`/`git_in`/`load_module_by_path`)는
    시그니처가 그대로다.
  - 결론: 부작용 없음. 조치 불요.

- **[INFO]** `CONSISTENCY_OUTPUT_DIR`/`REVIEW_OUTPUT_DIR` 환경변수 오버라이드는 이 PR 이 새로
  도입한 게 아니라 기존 오케스트레이터가 이미 지원하던 기능을 테스트가 처음 활용하는 것
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:81`(`os.environ.get("CONSISTENCY_OUTPUT_DIR", "./review/consistency")`, 이 diff 밖 기존 코드)
  - 상세: `test_consistency_target_validation.py`의 `env=dict(os.environ, CONSISTENCY_OUTPUT_DIR=str(out))`
    가 실제로 오케스트레이터에 반영되는지 직접 `grep` 으로 대조했다 — 반영된다. `test_consistency_spec_draft_snapshot.py`
    의 `_run` 은 반대로 부모 환경에서 `CONSISTENCY_OUTPUT_DIR` 를 **제거**해 세션이 항상 cwd(테스트별
    임시 저장소) 상대 기본 경로에 생기게 강제한다 — 병렬 실행 중 우연히 공유 env var 가 설정돼
    있어도 격리가 깨지지 않도록 하는 방어적 설계다. 두 경우 모두 `os.environ` 자체(부모 프로세스의
    전역 환경)를 변경하지 않고, `subprocess.run` 에 넘기는 딕셔너리 사본만 조작한다.
  - 결론: 부작용 없음. 조치 불요.

- **[INFO]** `review/consistency/2026/09/25/09_56_00/**` 신규 파일들은 developer 워크플로가
  요구하는 사전 `--plan` consistency-check 산출물이며, `CLAUDE.md` "정보 저장 위치" 표의
  `review/consistency/**` 규약과 일치한다 — 예상치 못한 파일시스템 부작용이 아니라 의도된
  절차 증거물이다.
  - 위치: `review/consistency/2026/09/25/09_56_00/{SUMMARY.md, meta.json, _retry_state.json, cross_spec.md, convention_compliance.md, naming_collision.md, plan_coherence.md, rationale_continuity.md}`
  - 결론: 조치 불요.

네트워크 호출, 새 전역 변수, 이벤트/콜백 변경에 해당하는 요소는 diff 전체에서 발견되지 않았다
(순수 파일시스템 격리 리팩터링).

## 요약

이번 변경은 "부작용을 없애는" 것이 목적인 하네스 리팩터링으로, 실제 저장소 트리에 대한 쓰기를
전부 임시 git 사본(`_harness.make_temp_repo_copy`) 또는 `tempfile`/env var 오버라이드로 옮겼다.
diff 에 표시된 코드와 전체 파일 컨텍스트를 대조한 결과 남은 쓰기 경로는 없었고, 변경된 헬퍼
시그니처는 전부 파일-로컬 private 헬퍼로 같은 diff 안에서 모든 호출부가 갱신되어 하위 호환이
깨지지 않는다. 공개 API·프로덕션 코드(`codebase/**`)·전역 상태·네트워크 호출에는 어떤 영향도
없다. 리뷰 중 저장소 파일은 전혀 수정하지 않았다.

## 위험도

NONE
