# 보안(Security) 리뷰 결과

## 발견사항

- **[INFO]** `branch_diff_files`/`get_git_branch_diff_files`/`_branch_changed_rels` 가 호출자로부터 받은 `base_ref`/`branch` 값을 검증 없이 git revision-range 인자에 직접 보간한다 (git argument injection 표면).
  - 위치: `.claude/_shared/git_probe.py:168`(`branch_diff_files` 정의) — 실제 조합은 `.claude/_shared/git_probe.py:203-206` (`["diff", "--no-renames", "--name-only", f"{base_ref}...HEAD"]`). 호출부는 `code_review_orchestrator.py:1501`(`--branch` argparse) 와 `consistency_orchestrator.py:884`(`--diff-base` argparse).
  - 상세: `subprocess.run([...], ...)` 이 리스트 형태(`shell=True` 아님)라 셸 인젝션은 없다. 다만 `f"{base_ref}...HEAD"` 문자열은 `git diff` 의 위치 인자로 그대로 전달되고, `base_ref` 가 `-`로 시작하는 값(예: `--upload-pack=...`, `--output=<path>`)이면 결합 문자열이 그 옵션의 값으로 파싱될 여지가 있다(`git diff --output=<file>` 는 임의 경로에 파일을 쓸 수 있는 실제 git 옵션). 다만 이 값은 원격/외부 사용자가 아니라 같은 세션을 구동하는 로컬 CLI 인자(`--branch`, `--diff-base`)로만 들어오므로 신뢰 경계 밖에서 도달 가능한 입력은 아니며, 이번 diff 가 새로 만든 패턴도 아니다 — 기존 `get_git_branch_diff_files`/`_branch_changed_rels` 에 있던 동일한 조합 방식을 `_shared/git_probe.py` 로 그대로 옮긴 것이다(문자열 보간 자체는 변경 전/후 동일). 다만 이번 변경으로 이 조합 로직이 **단일 공유 지점**이 되어 향후 다른 호출자가 검증 없이 재사용할 가능성이 커졌다.
  - 제안: 신규 결함은 아니므로 이번 PR 을 막을 사유는 아니지만, `_run_git_raw`/`branch_diff_files` 에 "인자가 `-`로 시작하면 거부" 같은 방어적 체크를 추가하거나, `git diff ... -- <base_ref>...HEAD` 형태 대신 revision 앞에 옵션 종료를 명확히 하는 처리를 백로그에 등록할 만하다.

- **[INFO]** `_fatal/<name>` sentinel 디렉토리 생성 시 명시적 권한 지정이 없다.
  - 위치: `.claude/_shared/retry_state.py:158` (`os.makedirs(os.path.dirname(path), exist_ok=True)`, `_record_fatal` 내부).
  - 상세: 프로세스 umask 를 따르므로 공유 다중 사용자 환경이라면 그룹/전체 쓰기 권한이 남을 수 있다. 다만 이 세션 디렉토리(`review/**`)는 단일 사용자 로컬 워크트리 전제라 실질 위험은 낮다.
  - 제안: 특별한 조치 불요. 다중 테넌트 환경으로 확장될 경우에만 재검토.

## 긍정적으로 확인된 보안 통제

- **경로 탐색 방어**: `fatal_sentinel_path` (`.claude/_shared/retry_state.py:107-119`) 가 `name != os.path.basename(name)` 및 `name in (".", "..")` 를 명시적으로 거부해, `agent`/`name` 값에 `../` 등이 섞여도 `_fatal/` 밖으로 쓰기가 불가능하다. 이 가드는 `test_a_name_that_is_not_a_path_component_gets_no_sentinel` 로 직접 테스트돼 있다.
- **셸 인젝션 없음**: `git_probe.py`, `code_review_orchestrator.py`, `consistency_orchestrator.py`, `merge_coordinator_orchestrator.py`, `retry_state.py` 전체에서 `shell=True`, `os.system`, `eval`, `exec`, `pickle`, `yaml.load` 사용이 0건이다(grep 확인). `subprocess.run` 은 전부 리스트 인자 형태.
- **타임아웃**: 모든 `git` 서브프로세스 호출에 `timeout` 이 지정돼 있어(`_run_git_raw` 기본 5.0s, `branch_diff_files` 30.0s), 응답 없는 원격/훅으로 인한 무한 대기(DoS) 를 방지한다.
- **원자적 쓰기**: `save_state` (`.claude/_shared/retry_state.py`) 가 `os.replace` 기반 temp-then-rename 을 사용해 동시 읽기가 반쯤 쓰인 JSON 을 읽는 상황(정보 손상)을 막는다.
- **에러 노출 최소화**: `on_error` 콜백에 넘기는 git stderr 를 `err.strip()[:200]` 로 절단해(`.claude/_shared/git_probe.py:209`) 과도한 원문 노출을 제한한다. 예외는 `except OSError: pass` 로 조용히 흡수되며 스택트레이스나 내부 경로가 사용자 대면 출력에 노출되지 않는다.
- **하드코딩 시크릿 없음**: 변경분 전체(코드/테스트/문서/plan)에 API 키·비밀번호·토큰·인증서 패턴이 없다.
- **동시성 레이스 수정이 보안적으로도 유효**: `_record_fatal`/`reconcile_state_with_disk` 의 "JSON ∪ sentinel" 합집합 설계는 lost-update 로 인해 영구 실패(`fatal`) 판정이 조용히 `pending` 으로 되돌아가는 것을 막는다 — 직접적인 인증/인가 이슈는 아니지만, 상태 무결성이 깨지면 `/loop` 가 이미 실패로 판정된 checker 를 재실행하는 등 게이트 신뢰성에 영향을 줄 수 있었던 부분이 이번 변경으로 보강됐다.

## 요약

이번 변경은 내부 개발 하네스(코드 리뷰/일관성 검사/머지 조율 orchestrator)의 git 프로브 중복 제거(`_shared/git_probe.py` 신설)와 `_retry_state.json` 의 lost-update 복구(`_fatal/<name>` sentinel) 를 다루는 리팩터링이다. 웹 요청·DB 쿼리·인증 흐름 등 전형적 OWASP Top 10 공격면(SQLi, XSS, 인증 우회 등)은 해당 코드 경로에 존재하지 않는다. `subprocess` 호출은 전부 리스트 인자 + 명시적 timeout 으로 셸 인젝션·행(hang) 위험이 없고, 새로 추가된 `fatal_sentinel_path` 는 경로 탐색을 명시적으로 차단하며 테스트로 고정돼 있다. 유일하게 언급할 만한 점은 git revision-range 문자열 보간에 인자 검증이 없다는 것인데, 이는 이번 diff 가 새로 만든 패턴이 아니라 기존 두 orchestrator 사본에 있던 동일 로직을 공유 모듈로 옮긴 것이며, 입력 출처가 로컬 CLI 인자(같은 신뢰 경계)라 실질 공격 표면은 낮다. 하드코딩된 시크릿, 안전하지 않은 암호화, 민감정보 노출 에러 처리 문제도 발견되지 않았다.

## 위험도

LOW
