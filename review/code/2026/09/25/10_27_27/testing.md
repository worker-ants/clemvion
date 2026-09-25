# 테스트(Testing) 리뷰 — harness-probe-isolation

## 검증 절차

리포트를 쓰기 전에 직접 실행해 확인했다(저장소 트리에는 아무것도 쓰지 않음 — 대상 4개
테스트 파일을 이 워크트리에서 그대로 실행):

```
python3 -m pytest .claude/tests/test_consistency_bundle_priority.py \
  .claude/tests/test_consistency_spec_draft_snapshot.py \
  .claude/tests/test_consistency_target_validation.py \
  .claude/tests/test_router_decision_trust.py -q
→ 73 passed, 4 subtests passed in 11.10s
```

실행 후 `git status --short` 는 이 리뷰 세션이 만든 `review/code/2026/09/25/10_27_27/` 외에
아무 변경도 남기지 않았음을 확인했다(테스트가 실제로 임시 디렉터리 밖으로 쓰지 않는다는
정성적 증거).

또한 두 핵심 docstring 주장을 소스에서 직접 대조했다 — 둘 다 정확하다:
- `consistency_orchestrator.repo_root()` → `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:122` `return os.getcwd()`. `_harness.py` docstring 의 인용과 일치.
- `code_review_orchestrator.py` 의 git 헬퍼들도 `os.getcwd()` 기준(`:1118,1124`) — `--prepare` 가 cwd 상대로 동작한다는 plan §C 주장과 일치.

## 발견사항

- **[INFO]** 이번 PR 이 고친 4개 파일 자체는 뮤테이션 테스트로 검증됐지만(plan §D, P1~P6 전부
  KILLED — `_edited_rels` 합집합/교집합, `_n_on_topic` tier 1 절, 프로브 루트 되돌림,
  `update-ref` 제거 등), **"다섯 번째 테스트 파일이 같은 안티패턴(체크아웃에 직접 쓰기)을
  재도입하는 것"을 자동으로 막는 회귀 가드가 이번 변경에 포함되지 않았다.**
  - 위치: `.claude/tests/README.md` 신설 항목("Never write into this checkout") 전체 — 함수/클래스 없이 산문 규약뿐.
  - 상세: plan(`plan/in-progress/harness-probe-isolation.md` §A)은 `sys.addaudithook` 기반
    감사 훅 census 를 만들어 전체 하네스(1173 passed)를 훑어 "쓰기 0행"을 검증했고, 이 과정에서
    `dir_fd` 인자 처리 버그까지 두 번 고쳐가며 오탐/누락을 없앤 정밀한 도구로 발전시켰다(§A 각주).
    이 도구는 이번 문제 계열을 네 번째로 겪은 뒤 처음으로 "전수 확인"에 성공한 사례인데,
    `find . -iname sitecustomize.py` / `find . -iname race_repro*` 로 확인한 결과 저장소에
    커밋되지 않고 `scratchpad/`(세션 스크래치)에만 남아 있다. `.claude/tests/` 에 이 훅을
    fixture 로 상시 걸어 "이 테스트 스위트 실행 동안 워크트리에 쓰기 이벤트가 0이어야 한다"를
    검사하는 표준 pytest 테스트(예: `test_harness_never_writes_into_checkout.py`)로 남겼다면,
    같은 클래스의 버그가 다섯 번째로 재발했을 때 `/ai-review` 대기 없이 `pytest` 한 번으로
    바로 잡혔을 것이다. 지금은 README 의 산문 규약 + 사람의 코드 리뷰에만 의존한다 — 이
    프로젝트 자체가 "병렬 리뷰어가 저장소를 뮤테이션해 서로를 오염시킨" 사고를 이미 4라운드
    겪은 이력이 있는 영역이라 재발 위험이 낮지 않다.
  - 제안: 감사 훅 스크립트를 `scratchpad` 에서 `.claude/tests/_harness.py` 나 별도 fixture 모듈로
    승격해, 전체 하네스 실행(혹은 최소한 `.claude/tests/test_*.py` 전수)에 대해 "워크트리 쓰기
    이벤트 0" 을 assert 하는 표준 회귀 테스트를 추가할 것. 비용이 크면(예: 전체 스위트에 걸면
    느려질 수 있음) 최소 이번에 고친 4개 파일 + 앞으로 추가되는 파일이 자동으로 포함되도록
    `.claude/tests/` 디렉터리 전체를 대상으로 하는 하나의 가벼운 감시 테스트만이라도 남기는
    것을 권한다.

- **[INFO]** `_harness.make_temp_repo_copy(path, *subtrees)` 는 `subtrees` 가 빈 경우(0개 인자)의
  동작이 테스트되지 않는다.
  - 위치: `.claude/tests/_harness.py:138-166` (`make_temp_repo_copy`)
  - 상세: `subtrees` 를 하나도 안 주면 `make_temp_git_repo` 가 만든 초기 `.gitkeep` 커밋 이후
    `git add -A` 가 스테이징할 변경이 없어 `git commit -qm "copy of this checkout"` 이 빈 커밋
    시도로 실패하고(`git_in` 은 기본 `check=True`), `CalledProcessError` 로 죽는다. 현재 4개 호출부
    모두 `"spec/5-system"` 하나씩 주므로 실제로 이 경로를 타지 않지만, 헬퍼의 시그니처(`*subtrees`)
    자체는 0개를 허용하는 것처럼 보여 향후 호출자가 실수로 빈 튜플을 넘기면 스택트레이스만 보고
    원인을 추적해야 한다.
  - 제안: 필수 인자로 강제하거나(`path, first: str, *rest: str`), 최소한 docstring 에 "subtrees
    는 최소 1개 필요 — 아니면 커밋할 변경이 없어 실패한다"를 한 줄 남기면 다음 호출자의 디버깅
    비용을 줄인다. 우선순위는 낮음(현재 호출부 4곳 모두 안전).

- **[INFO]** `TheDiffOutranksTheFolderDumpTest.test_the_diff_sits_right_after_the_on_topic_files` 와
  달리, 같은 클래스의 `test_a_branch_plan_named_file_also_counts_as_on_topic` 만 `make_temp_repo_copy`
  로 옮겨졌고, 전자는 여전히 실제 `ROOT`(이 체크아웃)의 `spec/5-system` 을 대상으로 `collect_context`
  를 호출한다.
  - 위치: `.claude/tests/test_consistency_bundle_priority.py` `TheDiffOutranksTheFolderDumpTest.test_the_diff_sits_right_after_the_on_topic_files`
  - 상세: 이 테스트는 파일을 쓰지 않고 `orch._edited_rels` 를 람다로 스텁만 하므로(§A 표의 "실제
    트리에 쓰는 것"에는 해당 없음) 이번 PR 의 격리 문제(쓰기 경합)와는 무관하고 실측(§A 감사 훅
    census, 97→0행)도 이 테스트를 포함해 0행을 확인했으니 실제 결함은 아니다. 다만 두 자매
    테스트가 나란히 있는데 하나는 사본, 하나는 실제 체크아웃을 대상으로 해 코드를 처음 읽는
    사람에게는 "왜 이 테스트만 사본을 안 쓰는가"가 즉시 설명되지 않는다(주석에 "쓰지 않아서
    안전하다"는 명시가 없다).
  - 제안: 조치 불요(정합성 문제 아님) — 다만 근처에 "이 테스트는 파일을 쓰지 않아 사본이 필요
    없다" 한 줄을 남기면 향후 리뷰어가 재차 이 질문을 던지는 것을 막는다. 우선순위 최하.

## 요약

핵심 변경(`_harness.make_temp_repo_copy` 신설 + 4개 테스트 파일의 프로브를 임시 git 사본/임시
디렉터리로 이전)은 테스트 관점에서 견고하다. plan 문서(§D)에 실린 뮤테이션 테이블은 P1~P6
전부 예측-실측 일치로 KILLED 를 기록했고, 그중 P5(생존 뮤턴트 → `origin/main` update-ref 를
지워도 미검출)는 실제로 발견되어 `TheRepoCopyFixtureTest.test_a_commit_in_the_copy_is_in_the_branch_diff`
라는 새 계약 테스트로 곧바로 메워졌다 — 이는 이 프로젝트가 요구하는 "설계 근거를 뮤턴트로
반증해 본다"는 기준을 그대로 충족한다. 직접 재실행한 73개 테스트(+ 4 서브테스트)가 전부
통과했고, 실행 후 저장소에 잔여물이 없어 "격리됐다"는 핵심 주장이 재현됐다. 새로 추가된
`test_the_probe_runs_outside_this_checkout` 은 프로브 루트가 이 체크아웃 밖에 있는지를
직접 단언해, 향후 실수로 프로브 루트를 실제 `ROOT` 로 되돌리는 회귀(뮤턴트 P4 로 검증됨)를
정확히 잡는다. 유일하게 아쉬운 지점은, 이번에 만든 정밀한 감사 훅 기반 census 도구가 스크래치로만
쓰이고 상시 회귀 가드로 승격되지 않아 "다섯 번째 파일의 재발"을 막을 자동화된 안전망이 없다는
점이다(INFO) — 지금까지 이 클래스의 문제가 같은 워크트리에서 네 번 반복된 이력을 감안하면 이
갭은 낮은 확률이라도 반복될 잠재력이 있다. 그 외에는 mock 사용(오케스트레이터 함수를 서브프로세스
내부에서만 몽키패치), 테스트 격리(각 테스트가 고유 `tempfile.TemporaryDirectory`/`mkdtemp` 사용),
가독성(각 테스트 docstring 에 실측·근거 명시) 모두 이 리포지토리의 높은 기준에 부합한다.

## 위험도

LOW
