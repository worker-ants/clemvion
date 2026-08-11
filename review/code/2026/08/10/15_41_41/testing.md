# 테스트(Testing) Review

## 핵심 판정 — 신규 `test_install_gate_flags.py` 가드가 vacuous 한가, `.py` 제외가 사각지대를 만드는가

지시받은 대로 두 질문 모두 **직접 뮤테이션·프로브로 재현**했다(격리된 scratch 저장소를 만들어
검증 — 리뷰 대상 워크트리는 건드리지 않았고, 실행 후 `git status` 로 무변경을 확인했다).

### 1) vacuous 하지 않다 — 3종 뮤테이션 전부 독립 재현 성공

- **뮤테이션 A (Dockerfile 플래그 제거)**: `codebase/backend/Dockerfile` 사본에서
  `--strict-peer-dependencies` 를 지우고 재실행 →
  `test_every_known_install_site_carries_both_flags` **RED** (`AssertionError:
  '--strict-peer-dependencies' not found in 'RUN pnpm install --frozen-lockfile --filter
  "backend..."'`).
- **뮤테이션 B (등재 목록에서 site 삭제)**: `SITES` 튜플에서
  `("codebase/backend/Dockerfile", 1)` 항목을 지우고 재실행(파일 자체는 그대로) →
  `test_no_unregistered_install_site_exists` · `test_the_search_actually_finds_the_known_sites`
  **2건 RED**(`found - known = {'codebase/backend/Dockerfile'}`).
- **뮤테이션 C (주석 필터 무력화)**: `install_lines()` 의 `if line.startswith("#") or
  line.startswith("//"): continue` 를 제거하고 재실행 →
  `test_the_comment_filter_is_not_vacuous` 가 즉시 잡음(`3 != 1`), 부수적으로 실제 site
  파일들의 주석 줄이 실행 줄로 오분류되며 `test_every_known_install_site_carries_both_flags`
  도 2건 추가 RED.
- 추가로 저장소 전수 재계산(`git grep -l "pnpm install" -- .github .claude codebase Makefile
  scripts` 결과를 `_is_execution_site` + `install_lines` 로 직접 필터링)해 `found == known`
  (5곳, 정확히 일치)임을 코드 밖에서 재확인했다.

세 뮤테이션 모두 claim 그대로 RED 가 났다 — `RESOLUTION.md`/`SUMMARY.md` 의 "뮤테이션 3/3
RED" 주장은 **독립 재현으로 확인됨(신뢰 가능)**.

### 2) `.py` 제외 — 현재는 안전하지만 **코드로 강제되지 않는 전제**에 기대고 있다

`_is_execution_site` (`.claude/tests/test_install_gate_flags.py:100-107`) 의 `.py` 배제
근거(같은 파일 91-98줄 주석: "파이썬 가드는 문자열로만 인용하고, 실제로 돌린다면
`subprocess.run(["pnpm","install",…])` 형태라 이 연속 문자열과 매치되지 않는다")를
저장소 전체에서 실측했다:

- `git grep -n "pnpm install" -- '*.py'` 로 나온 모든 매치를 열어 확인 — 전부 사용자 대상
  메시지 문자열(`scripts/check-backend-typecheck-ratchet.py:98`, `check-override-floors.py:37`)
  이거나, 분류기에 넘기는 **테스트 데이터 리터럴**(`test_guard_default_branch_bash_mutating.py`
  의 `guard._is_mutating("pnpm install")` 류 — 실행이 아니라 분류 대상)이었다.
- `git grep -n '"pnpm"'/"'pnpm'"` 로 실제 `subprocess.run([...])` 호출부를 찾아보면
  `scripts/check-override-floors.py:182` 의 `["pnpm", "audit", ...]` 하나뿐이고, `install` 이
  아니라 `audit` 이다. → **현재 저장소에는 이 배제로 놓치는 실제 pnpm install 실행 지점이
  없다.**

다만 이 결론은 **전제이지 불변식이 아니다**. 만약 향후 어떤 `.py` 가드가
`subprocess.run("pnpm install --frozen-lockfile", shell=True)` 형태(단일 문자열 + `shell=True`)
로 실제 설치를 실행하면, 그 줄은 `"pnpm install"` 연속 문자열과 **매치되고**(주석 91-98줄의
근거가 틀리는 경우), 그럼에도 `.py` 확장자라는 이유만으로 무조건 배제된다 —
`_is_execution_site` 는 "문자열 인용인지 실제 실행인지"를 판별하지 않고 확장자만 본다.
즉 이 파일이 지키려는 바로 그 속성("등재 안 된 실행 지점이 생기면 잡는다")이 `.py` 한
카테고리에 한해서는 **어떤 테스트로도 고정돼 있지 않다** — 지금 참인 관찰을 근거로 영구
배제 규칙을 코드에 박아 둔 형태. `test_the_search_actually_finds_the_known_sites` 류의
"비-vacuity" 짝 테스트가 이 배제 자체에는 없다.

- 위치: `.claude/tests/test_install_gate_flags.py` `TheSiteListHasNotGoneStaleTest._is_execution_site` (gate 100-107), 근거 주석 (gate 91-98)
- 제안: 필수는 아니나, `.py` 파일 중 `subprocess.run(...)` 호출에 `shell=True` 가 있고 그
  문자열/포맷 인자에 `"pnpm install"` 이 등장하는 경우를 걸러내는 보조 assert 를 추가하면
  이 전제 자체가 캐너리로 고정된다(과한 방어라 판단되면 최소한 위 실측 근거를 주석에 "실측
  시점"과 함께 명시해 재검증 시점을 표시).

## 발견사항

- **[WARNING]** `test_no_unregistered_install_site_exists` / `test_the_search_actually_finds_the_known_sites` 가 **추적되지 않은(untracked) 새 install 지점을 못 본다** — 정확히 이 두 테스트가 막으려는 시나리오("모르는 곳이 생겼는지")의 사각지대를 직접 재현했다.
  - 위치: `.claude/tests/test_install_gate_flags.py` gate 111-112 (`["git", "grep", "-l", "pnpm install", "--", ...]`, `test_no_unregistered_install_site_exists` 내부) 및 gate 130-131 (동일 호출, `test_the_search_actually_finds_the_known_sites` 내부)
  - 상세: 프롬프트 diff 그대로의 코드(격리 scratch 저장소에 복제, 실제 워크트리는 미변경)에 새 파일 `codebase/newpkg/Dockerfile`(`RUN pnpm install --frozen-lockfile --filter "newpkg..."`, 실행 줄·플래그 정상)을 만들고 **`git add` 하지 않은 채** 재실행했다. `git grep` 은 기본적으로 추적되지 않은 파일을 검색하지 않으므로 두 테스트 모두 **그대로 OK** — 등재되지 않은 새 install 지점이 생겼는데도 가드가 침묵한다. `subTest`/`assertEqual(found, known)` 자체의 로직 결함이 아니라, 입력을 만드는 `git grep` 호출에 `--untracked` 가 없어서다.
  - **관찰**: 이 워크트리는 다른 세션과 공유 중이며, 리뷰 도중 확인해 보니 정확히 이 지점이 **이미 라이브로 패치되고 있었다**(`git diff -- .claude/tests/test_install_gate_flags.py` 미커밋 변경, 두 호출 모두 `["git", "grep", "-l", "--untracked", "pnpm install", ...]` 로 바뀌어 있고 새 주석이 "격리 저장소 실험으로 실측, `review/code/2026/08/10/15_41_41` side_effect WARNING" 을 근거로 든다 — 이 라운드의 side_effect reviewer 가 독립적으로 같은 결함을 잡은 것으로 보인다). 패치된 버전을 같은 scratch 저장소에서 재검증했더니 동일한 untracked 뮤테이션에 대해 **정확히 2건 RED** — 사각지대가 닫힘을 확인했다.
  - 제안: 이 정정판(`--untracked` 추가)이 최종 커밋에 그대로 실리는지만 확인. 되돌리거나 이 리뷰가 스냅샷 기준 문제를 다시 "고치는" 중복 조치는 불필요 — side_effect 라운드와 동일한 패턴.

- **[INFO]** `install_lines()` 의 주석 필터는 **줄 시작**의 `#`/`//` 만 제거하고, 트레일링/중간 위치의 `pnpm install` 언급은 걸러내지 못해 실행 줄로 오분류될 수 있다(fail-safe 방향의 false positive — 실행되지도 않는 것을 "실행 줄"로 잘못 세어 스퓨리어스 실패를 낼 뿐, 실제 미비를 놓치는 방향은 아니다).
  - 위치: `.claude/tests/test_install_gate_flags.py` `install_lines()` (gate 42-55), 특히 gate 51-52 (`if line.startswith("#") or line.startswith("//"): continue`)
  - 상세: 직접 프로브 — `install_lines('RUN echo hello  # see pnpm install --frozen-lockfile docs\n')` → 그 줄 전체가 그대로 반환된다(주석이 줄 시작이 아니라서 필터를 통과). 현재 5개 site 파일에는 이런 형태의 트레일링 주석이 없어(테스트 통과 확인됨) 지금 당장의 오탐은 없지만, 이 저장소 Dockerfile 들은 `RUN` 줄 위에 여러 줄 설명 주석을 다는 관례이지 같은 줄 트레일링 주석은 아니어서 우연히 피해가고 있을 뿐, `install_lines()` 자체가 그 형태를 구조적으로 방어하지는 않는다.
  - 제안: 우선순위 낮음(안전한 방향의 실패). 필요하면 `line.split("#", 1)[0]` / `line.split("//", 1)[0]` 로 트레일링 주석도 잘라내되, 문자열 리터럴 안의 `#`/`//` 오탐(반대 방향 위험)과 트레이드오프이므로 신중히 판단할 것 — 지금 상태를 "의도적 최소 구현"으로 남겨도 무방.

- **[INFO]** `git grep` 스캔 대상 pathspec(`.github .claude codebase Makefile scripts`, gate 111-112/130-131)이 하드코딩된 최상위 디렉터리 목록이라, 새 최상위 디렉터리에 실제 install 실행 지점이 생기면 애초에 스캔 밖이라 조용히 놓친다.
  - 상세: `git grep -l "pnpm install"`(pathspec 제한 없이 전체) 로 별도 검증한 결과, 현재는 위 5개 pathspec 밖에 실제 실행 지점이 없음을 확인했다(root `PROJECT.md`/`README.md`/`pnpm-workspace.yaml`, `plan/**`, `review/**` 매치는 전부 `.md` 이거나 주석/서술 인용뿐). 새 최상위 디렉터리(`packages/`, `infra/` 등) 추가는 그 자체로 눈에 띄는 구조 변경이라 리뷰에서 잡힐 가능성이 높지만, 이 가드 자신이 막으려는 것과 같은 클래스(고정 목록 stale화)가 스캔 범위 자체에도 한 단계 위에서 존재한다는 점은 기록해 둘 가치가 있다.
  - 제안: 필수 아님. 원한다면 pathspec 목록 자체를 `git ls-tree` 최상위 디렉터리 전체로 넓혀도 되지만, 그러면 `node_modules`/`.git` 등 제외 목록을 새로 관리해야 하니 실익이 크지 않다.

- **[INFO]** 회귀 테스트 유효성 — `test_pnpm_workspace_action.py` 개명(`test_pnpm_receives_frozen_lockfile_and_the_filter` → `test_pnpm_receives_both_gate_flags_and_the_filter`)과 `ARGC=4`→`ARGC=5` 갱신을 직접 실행해 확인했다. `argv(proc)` 리스트가 정확히 `["install", "--frozen-lockfile", "--strict-peer-dependencies", "--filter", "frontend..."]` 5개이므로 리터럴 갱신이 맞고, `len(argv(proc))` 유도를 되돌린 판단(주석 gate 137-140, `RESOLUTION.md` §5)도 타당하다 — `argv()` 는 같은 `proc.stdout` 을 파싱하므로 유도식으로 바꾸면 자기 자신과 비교하는 꼴이 되어 "필터가 한 인자로 도착했는가"를 검증하지 못하게 된다. 12개 테스트 전체 재실행 결과 `OK`.
  - 위치: `.claude/tests/test_pnpm_workspace_action.py` gate 107-127(테스트 본문), gate 135-141(`ARGC` 단언)
  - 제안: 없음 — 확인 완료.

- **[INFO]** `test_review_guard_hardening.py` 의 신규 레지스트리 항목이 실제로 필요한지 코드로 확인했다. `TempRepoFixturesGoThroughTheSharedHelperTest` 는 `subprocess.run(["git", ...], cwd=<REPO_ROOT 를 가리키는 표현식>)` 형태의 호출을 AST 로 찾아 `_REAL_REPO_READERS` 레지스트리에 없으면 실패시킨다. `test_install_gate_flags.py` 의 두 `git grep` 호출(`cwd=str(REPO_ROOT)`)이 정확히 이 패턴에 해당하므로, 이번에 추가된 등재(gate 1000-1002, 파일 5)가 없었다면 `test_every_temp_repo_git_call_pins_dir_and_ceiling` 이 이 파일을 즉시 위반으로 잡았을 것이다(로직을 직접 읽어 확인 — 코드 경로 상 다른 예외 분기 없음). `test_the_registry_has_no_dead_entries` 도 파일 실존을 확인하므로 등재 자체가 stale 해질 위험도 낮다.
  - 위치: `.claude/tests/test_review_guard_hardening.py` gate 1000-1002
  - 제안: 없음 — 필요한 등재였고 올바르게 이루어졌다.

- **[INFO]** `.claude/tests/README.md` 카탈로그 동기화 확인 — `CatalogCoverageTest`(`test_tests_readme_catalog.py`)를 실행해 신규 파일이 README 에 정확히 문서화됐는지 확인했다(`OK`, 5/5 통과). 프롬프트가 잘라 보여준 README 발췌(11/25줄)에도 `test_install_gate_flags.py` 행이 포함돼 있었고, 실제 저장소의 README 를 열어 그 행이 이번 diff 의 실제 테스트 동작(두 테스트로 분리한 이유, `.py` 제외 근거)과 일치함을 확인했다.
  - 제안: 없음.

## 테스트 격리 · Mock 적절성

새 파일들은 mock/stub 을 쓰지 않고 실제 파일 읽기 + 실제 `git grep` subprocess 호출로
검증한다 — 이 저장소의 기존 규율("받는 쪽이 실제로 무엇을 봤는지로 검증하라",
`test_pnpm_workspace_action.py` 도 같은 철학으로 실제 bash 실행)과 일관되고, 세 매체(composite
action / bash / Dockerfile)를 하나의 러너로 합치는 대신 **정적 대조**로 남긴 설계 판단도
근거가 명확하다(파일 3 docstring gate 13-16). 부작용 없는 읽기 전용 검사라 테스트 간
의존성·순서 민감성도 없다. `subprocess.run` 이 `REPO_ROOT` 기준으로 실행되므로 CWD 에
의존하지 않고, `TESTS_DIR.glob` 류의 상대경로 함정도 없다.

## 요약

지시받은 두 질문 모두 뮤테이션/프로브로 직접 재현해 답했다. (1) 신규
`test_install_gate_flags.py` 는 **vacuous 하지 않다** — Dockerfile 플래그 제거, SITES 목록
삭제, 주석 필터 무력화 3종 뮤테이션이 전부 독립적으로 RED 를 냈고, `found == known` 전수
재계산도 코드 밖에서 재확인했다. (2) `.py` 제외는 **현재는 안전하지만 코드로 강제되지 않는
전제**다 — 저장소 전체를 검색해 지금 이 배제로 놓치는 실제 pnpm install 실행 지점이 없음을
확인했지만, 그 안전성을 지키는 별도 가드는 없다. 그리고 뮤테이션 과정에서 **더 직접적인
사각지대**를 하나 발견했다 — 프롬프트 diff 그대로의 두 "미등재 지점" 테스트는 `git grep`
이 untracked 파일을 못 보는 특성 때문에 `git add` 전 상태의 새 install 지점을 놓친다. 이는
정확히 이 가드가 막으려는 시나리오의 사각지대이지만, 공유 워크트리 관찰 결과 이미 이 라운드의
다른 리뷰(side_effect, 같은 세션)가 잡아 `--untracked` 플래그로 라이브 패치되고 있었고, 패치판을
같은 방식으로 재검증해 사각지대가 닫힘도 확인했다 — 잔여 조치는 "정정판이 최종 커밋에 실리는지
확인" 뿐이다. 그 외 회귀 테스트(이름 변경·ARGC 리터럴), 기존 가드와의 결속(레지스트리 등재,
README 카탈로그)도 모두 코드를 직접 실행해 유효함을 확인했다.

## 위험도

MEDIUM
