# 부작용(Side Effect) 리뷰

## 검토 범위와 방법

`codebase/**` 변경은 없다. 실질 코드 변경은 `.claude/tests/_harness.py`(신설 헬퍼
`make_temp_repo_copy`)와 그것을 사용하도록 고친 4개 테스트 파일
(`test_consistency_bundle_priority.py`, `test_consistency_spec_draft_snapshot.py`,
`test_consistency_target_validation.py`, `test_router_decision_trust.py`)이다. 나머지
(`CHANGELOG.md`, `plan/**`, `review/code/2026/09/25/10_27_27/**`,
`review/consistency/2026/09/25/09_56_00/**`)는 문서·이전 리뷰/검토 라운드 산출물이며
실행 코드가 아니라 부작용 표면이 없다.

핵심 소스를 직접 열어 확인했다(저장소 트리에 쓰기 없이, 읽기만):
- `.claude/tests/_harness.py` — `git_in`, `make_temp_git_repo`, `make_temp_repo_copy`,
  `run_in_orchestrator`, `orchestrator_preamble` 전문
- `.claude/tests/test_consistency_bundle_priority.py`, `test_consistency_spec_draft_snapshot.py`,
  `test_consistency_target_validation.py`, `test_router_decision_trust.py` 전문(관련 구간)
- `consistency_orchestrator.py` 에서 `CONSISTENCY_OUTPUT_DIR` 이 실제로 읽히는 기존
  환경변수인지 확인

뮤테이션은 하지 않았다(가설 확인이 필요 없었음). 리뷰 시작·종료 시 `git status --short`
는 이 세션 산출물 디렉터리(`review/code/2026/09/25/10_45_12/`) 하나만 보였다 — 저장소
트리 오염 없음.

## 발견사항

- **[INFO]** `make_temp_repo_copy` 는 git 객체가 아니라 `shutil.copytree` 로 **살아있는
  워킹트리**를 그 순간 복사한다. 복사 도중 같은 서브트리(`spec/5-system`)를 다른 프로세스가
  동시에 쓰고 있으면 이론상 torn read 가능성이 남는다.
  - 위치: `.claude/tests/_harness.py` — `make_temp_repo_copy` 함수(게이트 138~171행,
    특히 `shutil.copytree(REPO_ROOT / rel, repo / rel)` 줄, 게이트 167)
  - 상세: 이 PR 이 닫는 것은 **쓰기 측** 경쟁(여러 프로세스가 같은 실제 파일에 쓰는 것)이고,
    이 축은 그와 다른 축이다. 이미 직전 리뷰 라운드(`review/code/2026/09/25/10_27_27/SUMMARY.md`
    INFO 2)에서 지적·처분됐고 docstring 에 "git 객체가 아니라 워킹트리를 그 순간 복사한다 ·
    닫은 것은 쓰기 측" 이라고 명시됐다(게이트 154~156). 새로 제기하는 결함이 아니라 재확인.
  - 제안: 조치 불요(이미 문서화되고 위험도 낮음으로 처분됨). 재발 방지 목적으로만 기록.

- **[INFO]** 내부(파일-로컬) 헬퍼 시그니처 변경 4건 — `_prepare_over(self, *paths, cwd=REPO_ROOT)`,
  `_run(cwd, *args)`(spec_draft_snapshot), `_session_dir(proc, cwd)`, `_run(*args, env=None)`(target_validation).
  - 위치: `.claude/tests/test_router_decision_trust.py` `_prepare_over` 정의(게이트 335),
    `.claude/tests/test_consistency_spec_draft_snapshot.py` `_run`/`_session_dir` 정의(게이트 57, 70),
    `.claude/tests/test_consistency_target_validation.py` `_run` 정의(게이트 35)
  - 상세: 전부 모듈/클래스 로컬 prívate 헬퍼이고, 이 diff 안에서 모든 호출부가 함께 갱신됐다
    (grep 으로 각 파일 내 호출부 전수 확인 — 외부에서 import 하는 곳 없음). `_run(*args, env=None)`
    처럼 새 kwarg 가 기본값 `None` 인 경우 `subprocess.run(env=None)` 은 부모 환경을 그대로
    상속하므로 기존 5개 테스트 메서드(값을 안 넘기는 케이스)의 동작은 바뀌지 않는다. 공개 API 가
    아니므로 외부 호출자 영향 없음.
  - 제안: 조치 불요. 공개 인터페이스가 아님을 확인.

- **[INFO]** `test_consistency_target_validation.py::test_valid_target_still_prepares_a_session` 이
  `CONSISTENCY_OUTPUT_DIR` 환경변수를 새로 주입한다.
  - 위치: `.claude/tests/test_consistency_target_validation.py` 게이트 88~89
    (`env=dict(os.environ, CONSISTENCY_OUTPUT_DIR=str(out))`)
  - 상세: `consistency_orchestrator.py` 에서 `os.environ.get("CONSISTENCY_OUTPUT_DIR", "./review/consistency")`
    로 이미 읽는 기존 오케스트레이터 옵션이다(신규 side-channel 아님). 테스트가 세션을 임시
    디렉터리로 보내 이 체크아웃의 `review/consistency/` 에 산출물을 남기지 않도록 하는 것이
    목적이고, 실제로 그렇게 동작함을 `is_relative_to(out.resolve())` 로 확인한다.
  - 제안: 조치 불요.

## 확인한 안전장치 (긍정적 관찰)

- `make_temp_repo_copy` → `make_temp_git_repo` → `git_in` 경유로, `git_in` 이 `os.path.realpath(repo)`
  가 임시 디렉터리(`tempfile.gettempdir()` / `/tmp` / `/private/tmp`) 안인지 **assert** 한 뒤에만
  git 을 실행한다(게이트 96~103, `.claude/tests/_harness.py`). 실제 체크아웃 경로가 들어오면 그
  자리에서 죽는다 — 이번 PR 이 닫으려는 "체크아웃에 쓰기" 부작용의 회귀를 구조적으로 막는다.
- `make_temp_repo_copy` 는 `REPO_ROOT / rel` 을 **읽기만** 하고(`shutil.copytree` 의 소스), 쓰기는
  전부 `repo`(임시 디렉터리) 쪽에서 일어난다. 실제 체크아웃에 대한 쓰기 경로 없음.
- `test_router_decision_trust.py::test_long_source_list_is_truncated_with_an_accurate_remainder` 는
  기존에 `tempfile.mkdtemp(dir=str(REPO_ROOT))` 로 **저장소 루트 안에** untracked 파일 23개를
  만들었으나(이번 PR 이 고치는 바로 그 부작용), 이제 `tempfile.mkdtemp()`(시스템 temp)로 바뀌고
  `try/finally` 로 `shutil.rmtree` 정리도 유지된다(게이트 377~394).
- `run_in_orchestrator` 로 실행되는 스니펫들이 `orch._edited_rels` 등 오케스트레이터 모듈의
  전역을 몽키패치하지만, 이는 매번 새로 띄우는 **fresh 서브프로세스**(`python -c`) 안에서만
  유효하고 프로세스 종료와 함께 사라진다 — 테스트 간 전역 상태 누수 없음(`_harness.py`
  게이트 226~246 `run_in_orchestrator`).
- 네트워크 호출, 신규 전역 변수 도입, 이벤트/콜백 변경 없음. 기존 테스트가 기대하던 리턴값·예외
  동작(`returncode`, stdout 파싱)에도 변화 없음.

## 요약

이번 변경은 `.claude/tests/**` 하네스 코드에 한정되며(`codebase/**` 무변경), 목적 자체가 "테스트가
실제 저장소 트리에 쓰던 부작용"을 제거하는 것이다. 신설 헬퍼 `make_temp_repo_copy` 는 실제
체크아웃을 읽기만 하고 모든 쓰기를 `git_in` 의 임시-디렉터리 assert 로 보호된 사본 쪽으로
옮겼으며, 4개 테스트 파일의 내부 헬퍼 시그니처 변경은 전부 파일-로컬이고 이 diff 안에서
호출부가 동반 갱신됐다(공개 인터페이스·외부 호출자 영향 없음). 새로 쓰는 `CONSISTENCY_OUTPUT_DIR`
환경변수는 오케스트레이터가 이미 지원하던 기존 옵션이라 새로운 부작용 표면이 아니다. 직전
리뷰 라운드(`10_27_27`)에서 지적된 torn-read 가능성(INFO)은 이 라운드에서도 유효하지만 이미
문서화·처분된 저위험 항목으로 재확인 외 추가 조치가 필요하지 않다. Critical/Warning 급 부작용은
발견하지 못했다.

## 위험도
NONE
