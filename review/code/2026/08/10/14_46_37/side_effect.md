# 부작용(Side Effect) Review

## 조사 방법

프롬프트가 diff 를 생략한 파일(`code_review_orchestrator.py`, `test_line_anchors.py`,
`test_review_prepare_single_session.py` 등)은 `git diff origin/main..HEAD -- <path>` 와
`Read` 로 실제 소스를 직접 열어 확인했다. `review/code/2026/08/10/{08_32_48,10_54_59,
11_08_01,11_15_05,11_44_32,14_09_31,14_32_02}/**` · `review/consistency/2026/08/10/**`
(파일 10~96)는 전부 이전 리뷰/일관성 라운드가 이미 만든 `.md`/`.json` 산출물이 이번에
git 에 추가되는 것으로, 실행 코드가 아니라 정적 텍스트 추가라 부작용 관점에서 다룰 대상이
없다(콘텐츠 확인만 하고 아래 발견사항에서는 제외).

지시받은 대로, 신규 `_make_deletion_only_repo` 픽스처가 워크트리 5개가 공유하는
`.git/config` 를 오염시킬 여지가 있는지를 별도로 추적했다(아래 WARNING 항목).

## 발견사항

- **[WARNING]** 신규 `_make_deletion_only_repo` 픽스처가, 공유 `.git/config` 오염 사고(2026-08-06)를
  막기 위해 만들어진 하드닝된 헬퍼(`_harness.git_in()`)를 쓰지 않고 그 사고를 낸 것과 같은 계열의
  미보호 패턴을 재사용한다.
  - 위치: `.claude/tests/test_line_anchors.py:656-680` (`_make_deletion_only_repo` 본문),
    호출하는 `_git` staticmethod 는 `.claude/tests/test_line_anchors.py:564-566`
    (`CommitFixtureSelectionTest._git`, 이번 diff 이전부터 존재)
  - 상세: `.claude/tests/_harness.py:73-116` 의 `git_in()` docstring 은 정확히 이 클래스의
    임시 저장소 픽스처가 낸 실사고를 서술한다 — "2026-08-06 이 모양의 픽스처가 cwd 는 워크트리에
    둔 채 `git remote add origin …` 을 실행해 **공유** `.git/config` 를 덮어썼고, 5개 워크트리가
    그 파일을 읽어 다른 세션의 `git fetch` 가 깨졌다." 그 사고를 막기 위해 `git_in()` 은 세 겹
    방어를 건다: (1) `git -C <repo>` 로 대상 디렉터리를 argv 자체에 고정, (2)
    `GIT_CEILING_DIRECTORIES` 로 상위 탐색 차단, (3) `repo` 가 임시 디렉터리 트리 안인지
    realpath 로 선-단언.

    그런데 신규 `_make_deletion_only_repo` (그리고 이미 존재하던 형제 픽스처
    `_make_repo`, `:568-603`)는 이 세 방어를 전혀 쓰지 않는 `_git(repo, *args)` →
    `subprocess.run(["git", *args], cwd=str(cwd or REPO_ROOT))` 경로만 쓴다 —
    `-C` 없음, `GIT_CEILING_DIRECTORIES` 없음, tmpdir 소속 단언 없음. `git_in()` 의 docstring
    이 "이런 모양의 픽스처는 이렇게 깨졌었다" 고 명시적으로 경고해 둔 바로 그 모양을,
    같은 테스트 파일 안에서 세 번째로 복제한 것이다(첫 번째는 사고를 낸 원 코드, 두 번째는
    이미 있던 `_make_repo`, 이번이 세 번째).

    **다만 지금 이 특정 픽스처가 즉시 사고를 재현하는 것은 아니다.** `_make_deletion_only_repo`
    가 `repo` 에 대해 실행하는 첫 명령이 `git("init", "-q", "-b", "main", ".")` 이고(:669),
    이후 명령(`add -A` / `commit` / `rm` / `commit`)도 원 사고의 트리거였던
    `remote add`·설정류 명령이 아니다. 즉 "아직 저장소가 아닌 디렉터리에서 상위로 새는" 창은
    `init` 이 즉시 닫고, `remote`/`config --global` 류를 호출하지 않으므로 이번 diff 자체가
    `.git/config` 를 건드릴 구체적인 실행 경로는 확인되지 않았다. 위험은 **지금** 이 아니라
    "이 패턴이 세 번째로 정당화됐으니 다음 사람이 순서를 바꾸거나 `remote`/`config` 호출을
    추가해도 아무 방어가 없다"는 재발 여지다 — 정확히 이 저장소가 반복 지적하는
    "하드닝을 자매 함수/픽스처에 적용하지 않는" 결함 클래스([memory:
    feedback_defense_defined_one_notch_narrow.md] 참고).
  - 제안: `_make_deletion_only_repo`(및 기존 `_make_repo`)를 `_harness.git_in()` 기반으로
    옮긴다. `git_in()` 은 `git -C <repo> <args>` 형태라 `def git(*args): return
    _harness.git_in(repo, *args)` 로 얇게 감싸면 되고, `-c user.email=…` 같은 env 오버라이드는
    `git_in` 이 이미 `env=dict(os.environ)` 위에 얹으므로 `git_in(repo, "-c", "user.email=t@t",
    ..., "init", "-q", "-b", "main")` 형태로 그대로 이관 가능하다. 최소한 후속 plan 항목으로
    남겨, 다음에 이 클래스를 만질 때 세 헬퍼(`_git`, `_make_repo`, `_make_deletion_only_repo`)를
    한 번에 `git_in()` 으로 옮기는 것을 권장한다.

- **[INFO]** `build_router_prompt_body` 가 특정 분기에서 새로 subprocess(`git`) I/O 를 갖게 됐다
  — 이전에는 순수 문자열 조립 함수였다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:932`
    (`unseen = _source_files_missing_from_changeset(all_paths)` 호출부),
    `:1342-1372` (`_source_files_missing_from_changeset` 정의, 내부에서
    `get_git_branch_diff_files(base)` 호출)
  - 상세: changeset 에 감지된 소스 파일이 0개인 분기(`else`, `:929` 부근)에서만 호출되므로
    발동 범위는 좁고, `_default_branch_ref()` 가 base 를 못 찾거나 git 호출이 실패하면
    `except Exception: return []` 로 조용히 흡수해(`:1367-1370`) 리뷰 자체를 절대 깨지
    않는다는 점도 docstring 에 명시돼 있다(`:1360-1362`). 부작용이라기보다는 "판단 함수가
    조건부로 I/O 를 갖게 됐다"는 인터페이스 성격 변화이며, 신규 테스트
    `DocsOnlyFramingIsCrossCheckedTest`(`test_review_prepare_single_session.py:219-304`)가
    `orch._default_branch_ref`/`orch.get_git_branch_diff_files` 를 몽키패치해 이 호출부를
    직접 겨냥하고 있어 저자가 이 변화를 인지하고 있다.
  - 제안: 조치 불요 — 실패 흡수·좁은 발동 조건·전용 테스트가 이미 갖춰져 있다. 참고로만 기재.

- **[INFO]** `--prepare` 의 stdout 계약이 변경됨(N줄 → 정확히 1줄) — 의도된 인터페이스 변경이며
  유일한 소비자와 정합함을 확인했다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1687-1694`
    (`main()` 의 배치 루프 제거), `:1142-1176` (`_warn_large_changeset` 신설, stderr 안내만)
  - 상세: 이전에는 `REVIEW_BATCH_SIZE` 단위로 세션을 쪼개 배치마다 한 줄씩 stdout 에 찍었는데,
    이번 diff 는 그 루프를 없애고 `prepare_session(change_infos, config)` 를 changeset 전체로
    단 한 번 호출해 세션 경로 한 줄만 찍는다(`:1690-1694`). `--prepare` 출력을 소비하는 곳을
    저장소 전체에서 찾아봤다(`grep -rl -- "--prepare"`) — 실제로 stdout 라인을 파싱하는
    유일한 소비자는 `.claude/commands/ai-review.md` 의 1단계이고, 그 문서는 원래부터
    "stdout 마지막 줄 = 세션 디렉토리" 라고만 읽었으므로(마지막 줄만 소비) 다중 줄이든
    단일 줄이든 그 호출부 동작 자체는 바뀌지 않는다 — 오히려 이 변경 전에는 그 문서의
    "마지막 줄만 읽는다"는 계약과 실제 "배치별 한 줄씩 찍는다"는 동작이 어긋나 앞선 배치들이
    조용히 미리뷰로 남는 결함이 있었고(관련 plan 서술·`_warn_large_changeset` docstring),
    이번 diff 가 그 어긋남을 코드 쪽에서 닫은 것이다. `.claude/workflows/ai-review.js`,
    `.claude/hooks/_lib/review_guard.py` 등 다른 `--prepare` 언급 위치도 확인했으나 stdout
    다중 줄을 가정하는 파싱 로직은 없었다.
  - 제안: 조치 불요. `.claude/commands/ai-review.md`(파일 1)·`README.md`(파일 2)·`SKILL.md`(파일 3)
    가 같은 커밋에서 문구를 동반 갱신했음을 확인했다.

- **[INFO]** `session.py` 는 이번 diff 에서 주석/docstring 만 바뀌었고 실행 코드는 동일하다.
  - 위치: `.claude/skills/code-review-agents/lib/session.py:8-13`(`_MAX_SESSION_NAME_ATTEMPTS`
    위 주석), `:41-49`(`create_session_dir` docstring)
  - 상세: `git diff origin/main..HEAD -- .claude/skills/code-review-agents/lib/session.py` 로
    직접 대조한 결과, 원자적 재시도 루프(`os.makedirs(..., exist_ok=False)` + 접미사 재시도)
    자체는 이번 diff 이전부터 이미 존재하는 코드이며, 이번 변경은 배치 분할 제거를 반영해
    주석의 근거 서술("배치 분할이 같은-초 충돌의 다른 생산자였다 → 제거됐다")만 갱신한다.
    부작용 관점에서 상태 변경 없음.
  - 제안: 없음.

## 요약

이번 changeset 의 실질 코드 변경은 `.claude/skills/code-review-agents/scripts/
code_review_orchestrator.py` 의 배치 분할 제거 + router fail-closed 교차검사 추가, 그리고
`.claude/tests/test_line_anchors.py`/`test_review_prepare_single_session.py` 의 대응 테스트다.
`--prepare` 의 stdout 계약(N줄→1줄)은 의도된 인터페이스 변경이고 유일한 실 소비자
(`ai-review.md`)와 문서 3종이 같은 changeset 에서 동반 갱신되어 있어 하위 호환 문제가 없다.
`build_router_prompt_body` 가 doc-only 오판 분기에서 조건부로 git subprocess 를 새로 호출하게
됐지만 실패를 완전히 흡수하고 발동 범위가 좁아 부작용으로서 위험은 낮다. 전역 변수·환경 변수
읽기/쓰기·네트워크 호출·공개 함수 시그니처 변경은 발견되지 않았다. 유일하게 무게를 실어야 할
항목은 신규 `_make_deletion_only_repo` 테스트 픽스처(및 그 픽스처가 재사용하는 기존
`CommitFixtureSelectionTest._git`/`_make_repo`)가, 워크트리 5개가 공유하는 `.git/config` 오염
사고(2026-08-06)를 막으려고 만들어진 `_harness.git_in()` 의 3중 방어(`-C`·
`GIT_CEILING_DIRECTORIES`·tmpdir 단언)를 전혀 쓰지 않는다는 점이다. 이번 diff 가 실행하는
git 명령 순서(`init` 이 항상 첫 명령, `remote`/전역 `config` 호출 없음)를 보면 **당장** 공유
config 를 오염시키는 구체적 경로는 확인되지 않았지만, 이 패턴이 같은 파일 안에서 세 번째로
복제된 것이고 사고 당시의 헬퍼도 겉보기엔 "cwd 를 넘겼으니 안전하다"고 보였다는 점에서
방어를 자매 픽스처로 넓히지 않은 채 남겨두는 것은 재발 여지가 있다.

## 위험도

MEDIUM
