# 동시성(Concurrency) 리뷰 — review-gate CI 백스톱 (round 8)

## 범위 요약

이번 라운드 diff(`.claude/hooks/_lib/review_guard.py`, `.claude/tests/*`,
`.github/workflows/{review-gate,harness-checks}.yml`, `scripts/check-review-gate.py`,
`plan/in-progress/harness-review-gate-ci-backstop.md`)는 스레드/asyncio/락을 전혀 쓰지
않는 동기(synchronous) 서브프로세스 기반 CLI·훅 코드다. 따라서 전형적 데드락·뮤텍스·
스레드풀 항목(점검 관점 2·3·4·7·8)은 이 변경에 해당 없음. `review_guard.py` 는 프롬프트
크기 제한으로 잘려 있어 전체를 `Read` 로 직접 읽고 판단했다.

동시성 관점에서 남는 것은 "여러 프로세스/세션이 같은 파일시스템 자원을 동시에 보는가"
(경쟁 조건·원자성 항목, 1·6)이다. 그 관점으로 실제 결함/관찰 두 건을 찾았다 — 둘 다 verdict
를 직접 뒤집지는 않지만 실사용 흐름에서 도달 가능하다.

## 발견사항

- **[INFO]** `evaluate_review()` 가 단일 `git status` 스냅샷을 여러 차례의 뒤이은 `mtime`
  읽기에 재사용한다 — 스냅샷과 각 파일 읽기 사이의 비원자적(check-then-act) 창
  - 위치: `.claude/hooks/_lib/review_guard.py:1000` (`dirty = _dirty_set(repo_root)` 스냅샷)
    을 소비하는 지점들 — `.claude/hooks/_lib/review_guard.py:383-390`
    (`_authoritative_code_time` 의 `_mtime()` 호출), `.claude/hooks/_lib/review_guard.py:576-582`
    (`_newest_resolved_review_mtime` 의 재확인 `_mtime()`), `.claude/hooks/_lib/review_guard.py:798-799`
    (`_newest_resolved_impl_done_mtime`)
  - 상세: `evaluate_review()` 는 `git status --porcelain` 을 **한 번** 실행해 "dirty 경로
    집합"을 만들고(1000행), 그 집합을 코드 쪽·리뷰 쪽 여러 `_mtime()` 호출(각각 스냅샷보다
    나중 시점에 실행)에 그대로 전달한다. 스냅샷 시점과 개별 `_mtime()` 호출 시점 사이에
    (예: 같은 턴에서 배치로 함께 실행되는 병렬 Write/Edit 도구 호출이 `codebase/**` 또는
    `review/**` 파일을 건드리는 경우) 파일이 바뀌면, "dirty" 로 분류된 파일의 mtime 이 이미
    낡았거나 "clean" 으로 분류된 파일이 실제로는 방금 수정된 상태일 수 있어 신선도 비교가
    그 좁은 창 안에서 내적으로 어긋날 수 있다. 이는 결함이라기보다 check-then-act 패턴의
    구조적 특성이며, 게이트가 로컬 push/Stop 훅 두 곳 모두 짧고 동기적으로 실행되므로 실제
    관측 창은 매우 좁다.
  - 제안: 현재로선 영향이 작아 수정을 강제할 사안은 아니지만, 이 패턴이 "확인 후 사용"임을
    주석으로 명시하거나(현재 docstring 은 "checkout/rebase-immune" 만 설명하고 이 창은
    언급하지 않는다), 향후 강화 라운드에서 gate 판정을 하드 실패로 승격(`--enforce`)할 때는
    이 창을 재검토할 가치가 있다.

- **[WARNING]** `resolution-applier` in-flight 마커 디렉토리가 `CLAUDE_PROJECT_DIR` 단위로
  프로젝트 전역 공유되어, 서로 무관한 워크트리/세션 간 Stop-넛지 교차 억제가 가능하다
  (기존 설계, 이번 라운드 diff 밖이지만 `review_guard.py` 전체 컨텍스트 안에서 발견)
  - 위치: `.claude/hooks/_lib/review_guard.py:874-881` (`_resolution_marker_dir` —
    `CLAUDE_PROJECT_DIR` 기준, repo_root 아님), `.claude/hooks/_lib/review_guard.py:900-951`
    (`_resolution_in_flight`, 특히 signal 1 스캔 루프 926-938행); 호출부
    `.claude/hooks/guard_review_before_stop.py:257-261`
  - 상세: `_resolution_marker_dir()` 은 마커 위치를 `repo_root` 가 아니라 `CLAUDE_PROJECT_DIR`
    로 고정한다. docstring(875-879행)은 이를 "worktree-isolated session 과 main session 이
    한 위치에 합의하기 위함"이라 명시적으로 의도된 설계라 밝히지만, 이 저장소의 표준 작업
    방식(CLAUDE.md §0 — 모든 작업을 `.claude/worktrees/<task>-<slug>/` 에서, 여러 작업이
    동시에 진행됨. MEMORY 의 "백로그 착수 전 병렬 세션 머지 확인" 항목도 병렬 세션이 상시
    발생함을 확인)에서는, 서로 무관한 두 작업이 같은 `CLAUDE_PROJECT_DIR` 아래서 각자
    `resolution-applier` 를 디스패치하면 `_resolution_in_flight` 의 signal 1(926-938행)이
    어떤 세션/브랜치가 남긴 마커인지 구분하지 않고 디렉토리 안의 **모든** 마커 파일을 대상으로
    "in flight" 를 판정한다. 결과적으로 세션 B 의 Stop 훅이, 전혀 다른 워크트리에서 도는 세션
    A 의 resolution-applier 마커를 보고 자신의 "리뷰 필요" 넛지를 최대
    `_IN_FLIGHT_TTL_SECONDS`(30분) 동안 억제할 수 있다 — 공유 자원(마커 디렉토리)이 서로
    독립적인 행위자들 사이에서 파티션 없이 쓰이는 전형적 동시성 스코핑 결함이다.
  - 실질 영향은 제한적이다: 이 신호는 `guard_review_before_stop.py` 만 소비하고(위 호출부),
    push 하드게이트(`evaluate_review(in_flight_ok=False)`, 기본값)는 이 함수를 아예 부르지
    않으므로 실제 차단은 영향받지 않는다 — 억제되는 것은 Stop 시점의 안내 문구 한 번뿐이고,
    다음 push 시도에서 하드게이트가 여전히 정상 판정한다.
  - 제안: 마커 파일명 또는 서브디렉토리에 브랜치/세션 식별자를 포함시켜 스코프를 좁히면,
    병렬 워크트리 작업이 늘수록 커지는 "조용히 사라지는 리마인더" 표면을 없앨 수 있다.
    현재는 advisory-only + TTL-bound 라 우선순위는 낮지만, 프로젝트가 병렬 세션을 상시
    운용하는 만큼 재발 가능성은 낮지 않다.

- **[정보, 결함 아님]** `.github/workflows/review-gate.yml:36-38`, `.github/workflows/harness-checks.yml:66-69`
  의 `concurrency: {group: <name>-${{ github.ref }}, cancel-in-progress: true}` 는 PR
  단위(`github.ref`)로 올바르게 스코프돼 있어 같은 PR 에 대한 중복 실행이 서로 경쟁하지
  않는다. 이번 라운드가 추가한 `test_workflow_and_job_identities_are_unique`
  (`.claude/tests/test_workflow_yaml_structure.py`)는 서로 다른 워크플로 파일이 동일한
  `(name, job)` identity 를 참칭해 GitHub required-status-check 매칭에서 경쟁(하나가 다른
  하나를 가리는 always-green 스푸핑)을 유발하는 클래스를 정적으로 봉쇄한다 — 이 diff 안에서
  가장 concurrency 에 근접한 정당한 방어이며 결함이 아니다.

- `mark_resolution_in_flight.py` / `clear_resolution_in_flight.py` 의 파일 존재-확인 →
  삭제/쓰기(TOCTOU) 지점들(`os.path.isfile` → `os.remove`, `os.makedirs(..., exist_ok=True)`)은
  모두 넓은 `try/except Exception: pass` 로 감싸져 있고 실패 시 fail-open(마커 없음/유지)
  으로 안전하게 저하되므로 별도 결함으로 보지 않았다.

## 요약

이번 diff 는 스레드·비동기·락을 쓰지 않는 동기 CLI/훅 코드라 고전적 데드락·동기화·
스레드안전성 항목은 대부분 해당 없다. `review_guard.evaluate_review()` 전체를 훑어 파일시스템
공유 자원 관점에서 두 가지를 확인했다: (1) 단일 `git status` 스냅샷을 여러 차례의 후속
`mtime` 읽기에 재사용하는 비원자적 패턴(영향 작음, INFO), (2) `resolution-applier` in-flight
마커 디렉토리가 워크트리/세션 파티션 없이 프로젝트 전역으로 공유돼 병렬 작업 흐름에서
무관한 세션 간 Stop 넛지를 교차 억제할 수 있는 스코핑 결함(advisory-only, TTL-bound, push
하드게이트는 영향 없음 — WARNING). 둘 다 이번 라운드가 고정하려는 "판정자가 하나다 /
verdict 가 환경에 좌우되지 않는다" 라는 핵심 불변식을 깨지 않으며, GH Actions 의
`concurrency:` 그룹 설정과 새로 추가된 워크플로 identity 유일성 테스트는 올바르게 동작한다.

## 위험도

LOW
