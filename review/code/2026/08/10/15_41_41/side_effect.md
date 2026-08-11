# 부작용(Side Effect) Review

## 검증 방법

리뷰 대상 12개 실 코드/문서 파일(파일 1~12) 외 파일 13~34 는 이전 리뷰 라운드(`15_11_16`,
`15_23_40`)의 산출물(`RESOLUTION.md`/`SUMMARY.md`/`*.md`/`_retry_state.json`/`meta.json`)이
신규 파일로 이번 diff 에 실린 것이다 — 정적 텍스트/JSON 산출물이라 실행되지 않으며,
`review/code/**` 는 규약상 코드 리뷰어의 정상 쓰기 대상이므로 그 자체로는 부작용 관점 발견사항이
없다. 아래는 실제 실행 코드(파일 1, 3, 4, 6, 12)를 대상으로 분석했다.

호출자가 지시한 대로, `.claude/tests/test_install_gate_flags.py` 가 새로 도입한
"실 저장소에 대한 `git grep`" 이 세션·CI 환경에 따라 다르게 동작할 여지를 격리된 scratch git
저장소(`/private/tmp/.../scratchpad/gitgrep_test`, 이 워크트리 밖)에서 직접 실험으로 확인했다 —
이 리뷰 대상 워크트리는 전혀 건드리지 않았다.

## 발견사항

- **[WARNING]** `git grep` 이 **`git add` 이전(완전 untracked)** 신규 파일은 못 본다 — "등재되지 않은
  실행 지점이 생기면 알린다"는 이 가드의 존재 이유가 정확히 그 상태에서 무력화된다 (실험으로 검증)
  - 위치: `.claude/tests/test_install_gate_flags.py:109-125` (`test_no_unregistered_install_site_exists`,
    특히 `git grep` 호출부 110-112) 및 동일 패턴의 `:127-142`
    (`test_the_search_actually_finds_the_known_sites`, 호출부 129-131). 가드가 지키려는 약속의 진술은
    클래스 docstring `:88-89` (`"""등재되지 않은 \`pnpm install\` 실행 지점이 생기면 알린다."""`) — 여기엔
    "추적된" 이라는 한정이 없다.
  - 상세: scratch 저장소에서 직접 확인했다 — 커밋된 `tracked_site.sh` 옆에 `pnpm install
    --frozen-lockfile` 을 담은 `untracked_site.sh` 를 **`git add` 하지 않은 채** 두고
    `git grep -l "pnpm install" -- .` 를 실행하면 `tracked_site.sh` 만 나오고
    `untracked_site.sh` 는 결과에서 빠진다(exit 0, 매치 1건). 같은 파일을 `git add`(커밋은 아직 안 함)
    한 뒤 재실행하면 그제서야 두 파일 다 잡힌다. 즉 `git grep`(revision 인자 없이 호출)은 인덱스에 올라간
    내용만 보고, 디스크에만 있는 새 파일은 완전히 무시한다. 이 저장소의 전형적인 로컬 개발 루프 —
    새 파일을 만들고 `.claude/test-stages.sh` 로 유닛 테스트를 먼저 돌려 본 뒤 `git add` 하는 순서 —
    를 그대로 밟으면, 새 `pnpm install` 실행 지점을 담은 새 파일을 추가해도
    `test_no_unregistered_install_site_exists` 가 **조용히 초록**을 낸다. 이 저장소가 반복적으로
    맞닥뜨렸다고 스스로 기록한 실패 형태("게이트가 조용히 안 도는 것", `test_required_check_skip_jobs.py`
    카탈로그 서술과 동일 클래스)가 이 가드 자신에게도 좁은 창으로 남아 있다. CI(`harness-checks.yml`)는
    항상 이미 커밋된 콘텐츠를 checkout 하므로 이 창에 걸리지 않는다 — 순수하게 로컬 pre-stage 구간의
    맹점이다.
  - 제안: 최소한 클래스/메서드 docstring 에 "커밋되었거나 최소 `git add` 된 파일만 본다" 는 한정을
    명시해 독자가 잘못된 안전감을 갖지 않게 한다. 더 튼튼하게 하려면 `git grep` 대신(또는 그에 더해)
    `git status --porcelain --untracked-files=all` 로 얻은 untracked 경로도 합쳐 스캔 대상에 넣는 방법이
    있다 — 다만 이는 `test_review_guard_hardening.py` 의 `_REAL_REPO_READERS` 등재 사유("추적 파일에서
    …")와 스코프를 넓히는 결정이므로 별도 검토 필요.

- **[INFO]** 위 맹점과 결합해, 이 두 테스트의 판정이 **이 워크트리가 다른 세션과 공유된다**는 사실에
  결속된다 — 신뢰 경계는 "diff 코드" 가 아니라 "테스트 실행 시점의 실 워킹트리 상태" 다
  - 위치: `.claude/tests/test_install_gate_flags.py:110-113`, `:129-132` (`cwd=str(REPO_ROOT)`, 그리고
    `_harness.py` 의 `REPO_ROOT = Path(__file__).resolve().parents[2]` — 이 워크트리 자신을 가리킴)
  - 상세: `REPO_ROOT` 는 임시 격리 사본이 아니라 **이 세션이 실행 중인 실제 워크트리**이고, 이 저장소의
    운영 방식상 그 워크트리는 다른 세션과 동시에 편집될 수 있다(같은 PR 체인의
    `review/code/2026/08/10/15_11_16/side_effect.md` 가 실제로 리뷰 도중 다른 세션이 `pnpm-workspace.yaml`
    코멘트를 미커밋 상태로 고쳐 놓은 것을 발견한 바 있다 — 동일 파일 묶음에서 이미 한 번 관측된 현상).
    이 두 테스트는 그 살아있는 트리를 직접 읽으므로, 다른 세션이 마침 그 순간 새 `pnpm install`
    호출부를 담은 새(미-`git add`) 파일을 만들고 있다면 위 WARNING 맹점과 겹쳐 이 세션에서 그 사실을
    확인할 방법이 없다. 이는 설계상 받아들여진 트레이드오프다 — `test_review_guard_hardening.py:1000-1002`
    가 "임시 저장소로는 '등재 안 된 지점이 생겼다' 를 물을 수 없다" 고 정확히 그 이유를 등재해 뒀다 —
    하지만 그 등재 사유 자체가 언급하지 않는 잔여 창(정확히 위 WARNING)이 남아 있다는 점은 별도로
    기록해 둘 가치가 있다.
  - 제안: 새 조치 불요(트레이드오프가 의도적이고 문서화됨). 다만 이 클래스의 두 테스트가 실 워크트리
    상태에 의존한다는 사실을 인지하고, 향후 flaky 리포트가 나오면 "다른 세션의 동시 편집" 을 원인
    후보에 포함할 것.

- **[INFO]** shallow clone(CI 기본값)은 이 가드의 결과에 영향을 주지 않음을 확인 — 호출자가 지시한
  "shallow clone 등에서 다르게 동작할 여지" 확인 결과
  - 위치: `.github/workflows/harness-checks.yml:150`(이 신규 테스트가 도는 잡의 `actions/checkout@v7`,
    `fetch-depth` 미지정 → 기본값 `1`, shallow) 대비 `.claude/tests/test_install_gate_flags.py:110-113`
  - 상세: `git grep`(revision 인자 없이 호출 시 워킹트리 대상)은 히스토리 깊이가 아니라 **체크아웃된
    커밋의 블롭 내용**을 읽으므로 `fetch-depth: 1` 이든 `0` 이든 결과가 같다 — shallow clone 은 과거
    커밋을 생략할 뿐 현재 체크아웃된 트리의 파일 콘텐츠는 전부 갖고 있다. 이 저장소의 어떤
    `actions/checkout` 스텝도 `filter: blob:none` 류의 partial clone 을 쓰지 않으므로(전수 grep 확인,
    `filter:` 매치는 이 액션 자신의 `filter` input 뿐), `git grep` 이 결여된 블롭을 원격에서 지연 fetch
    하며 **의도치 않은 네트워크 호출**을 일으킬 경로도 없다. 실제로 다르게 동작하는 유일한 축은 위
    WARNING 의 "untracked vs staged" 상태였고, clone 깊이/방식은 아니었다.
  - 제안: 없음 — 확인 완료, 조치 불요.

- **[INFO]** `test_pnpm_workspace_action.py` 의 테스트 메서드 rename 은 외부 참조를 깨지 않음
  (시그니처 변경 영향 확인)
  - 위치: `.claude/tests/test_pnpm_workspace_action.py:107`
    (`test_pnpm_receives_frozen_lockfile_and_the_filter` → `test_pnpm_receives_both_gate_flags_and_the_filter`)
  - 상세: 저장소 전체를 재귀 검색한 결과, 옛 메서드명에 대한 참조는 `review/code/2026/08/09/21_53_16/**`,
    `review/code/2026/08/10/15_11_16/**`, `review/code/2026/08/10/15_23_40/**` 아래의 **과거 시점 리뷰
    산출물**(정적 로그) 뿐이었고, `pytest -k`/CI 워크플로 설정/다른 소스 파일에서 이 이름을 문자열로
    참조하는 곳은 없었다(`.github/workflows/harness-checks.yml:170` 은
    `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 로 이름 무관 discovery). 즉 이 rename
    이 CI 나 다른 코드의 동작을 바꾸지 않는다.
  - 제안: 없음.

- **[INFO]** `.claude/test-stages.sh:20` 의 `_ensure_deps()` 행동 변경(신규 워크트리에서 install 자체가
  peer 미충족 시 실패로 승격) 은 이미 앞선 두 라운드에서 11개 filter 스코프 + 전체 workspace 실행으로
  실측 검증됨 — 이번 라운드에서 재검증할 새로운 표면은 없음
  - 위치: `.claude/test-stages.sh:20`
  - 상세: `review/code/2026/08/10/15_11_16/RESOLUTION.md` §검증과
    `review/code/2026/08/10/15_23_40/RESOLUTION.md` §검증이 이미 이 diff 가 어떤 CI 잡도 새로 깨지
    않음을 격리 사본에서 11회+3회(Docker COPY 패턴 포함) 실행해 확인해 두었다. 이번 라운드의 diff(파일
    1, 6, 7, 9, 10)는 그 검증 결과를 반영한 최종 상태이고, 새로 추가된 로직이 없으므로 재실행할 필요는
    없다고 판단했다.
  - 제안: 없음(참고용 기록).

## 요약

이번 diff 의 핵심 부작용 표면은 신규 `.claude/tests/test_install_gate_flags.py` 가 도입한 "실 저장소에
대한 `git grep`" 이다. 호출자 지시대로 격리 scratch 저장소에서 직접 실험한 결과, shallow clone(이
가드가 실제로 도는 `harness-checks.yml` 의 CI 환경 그 자체)은 결과에 영향이 없었지만, **`git add`
되지 않은 완전 untracked 신규 파일은 git grep 이 아예 보지 못한다**는 실제 맹점을 확인했다 — 이
저장소의 전형적 로컬 개발 순서(새 파일 작성 → 테스트 실행 → `git add`)를 그대로 밟으면 새
`pnpm install` 호출부가 이 가드를 조용히 통과할 수 있다. CI 는 항상 커밋된 콘텐츠만 체크아웃하므로
이 창에 걸리지 않아 파급력은 로컬 pre-stage 구간으로 제한되지만, 이 가드 자신의 존재 이유("게이트가
조용히 안 도는 실패를 막는다")와 정확히 같은 클래스라 문서화(최소한 docstring 한정)는 권장한다. 그
외에는 새 전역 상태·파일시스템 부작용·시그니처/인터페이스 파괴·환경변수·네트워크 호출·이벤트/콜백
변경 어느 것도 발견되지 않았고, 실행 로직 변경(`--strict-peer-dependencies` 게이트 자체)의 안전성은
이미 선행 두 리뷰 라운드가 다수 filter 스코프 실측으로 검증해 둔 상태다.

## 위험도

LOW
