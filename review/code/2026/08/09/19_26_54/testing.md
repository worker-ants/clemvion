STATUS=success testing review complete — 1 WARNING (verified via direct execution), 1 INFO
===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `pathspecs` 블록 스칼라의 각 줄에서 **내용이 있는 줄의 앞뒤 공백**이 트리밍되지 않고 그대로 인자로 전달되는데, 이 경로가 테스트로 커버되지 않는다
  - 위치: `.github/workflows/_changed-paths.yml:85-90` (`FILTERED+=("$spec")` — 공백-only 판정에만 `tr -d '[:space:]'` 를 쓰고, `FILTERED` 에 넣는 값은 원본 `$spec` 그대로), 테스트 갭: `.claude/tests/test_changed_paths_reusable.py` `ArgumentSplittingTest` (공백-only 줄 드롭 테스트 `test_whitespace_only_lines_are_dropped`, 줄 포함 pathspec 테스트 `test_a_pathspec_containing_spaces_stays_one_argument` 는 있으나 "줄 앞뒤에 불필요한 공백이 붙은 실 pathspec" 케이스는 없음)
  - 상세: 직접 실행해 확인함 — `PATHSPECS="  a.yaml\nb.yaml  \n"` 를 실제 `run:` 블록(YAML 에서 파싱해 그대로 bash 실행)에 흘리면 스텁이 받는 인자가 `["  a.yaml", "b.yaml  "]`로, 앞뒤 공백이 그대로 보존된다. git pathspec 문법에서 `"  a.yaml"` 은 `"a.yaml"` 과 다른 문자열이라 실제 파일과 매치되지 않으므로, 그 한 줄의 pathspec 은 조용히 무효화된다 — 이 PR 전체가 막으려는 "판정 대상이 조용히 사라지는" 클래스와 동일한 모양이며, 워크플로 헤더 주석이 이미 이 클래스를 명시적으로 경고하고 있다. 더 문제적인 것은 `.claude/tests/test_required_check_skip_jobs.py:75-83` 의 `pathspecs_of()` 헬퍼가 YAML 을 파싱할 때 `line.strip()` 으로 **정규화**해서 비교한다는 점이다 — 즉 실제 워크플로 파일의 `pathspecs:` 항목에 실수로 선행/후행 공백이 들어가도(예: 정렬을 맞추려다 실수로), `test_converted_workflows_pass_the_script_its_own_path` 같은 Python 테스트는 `.strip()` 덕분에 여전히 통과하지만, 실제 bash 런타임은 트리밍하지 않으므로 그 pathspec 은 프로덕션에서 매치 실패로 조용히 무력화된다 — **테스트가 보는 것과 런타임이 보는 것이 갈라지는** 지점이다. 현재 세 워크플로의 `pathspecs:` 는 모두 들여쓰기가 일관돼 우연히 이 문제를 트리거하지 않지만("지금 저장소에 없다는 사실이 이 코드가 견딘다는 증거는 아니다" — 이 저장소 자신의 `test_a_pathspec_containing_spaces_stays_one_argument` 주석과 동일한 논리), YAML 블록 스칼라(`|`)는 그 문서의 기준 들여쓰기보다 깊은 부분은 그대로 보존하므로 향후 편집(정렬용 공백 추가 등)으로 충분히 재현 가능하다.
  - 제안: (1) `_changed-paths.yml` 의 루프에서 `FILTERED+=("$spec")` 전에 `spec`를 트리밍(`spec="${spec#"${spec%%[![:space:]]*}"}"; spec="${spec%"${spec##*[![:space:]]}"}"` 또는 `sed`)하거나, 최소한 트리밍하지 않는 것이 의도라면 그 사실을 헤더 주석에 명시. (2) `test_changed_paths_reusable.py` 에 `run_with("  a.yaml\nb.yaml  \n")` 케이스를 추가해 실제 동작(트리밍 여부)을 단언으로 고정. (3) `pathspecs_of()` 의 `.strip()` 이 실제 런타임과 다르게 동작한다는 점을 주석으로 밝히거나, 트리밍 없이 원본 비교로 바꿔 테스트-런타임 간극을 없앤다.

- **[INFO]** `http-request.handler.spec.ts` 의 수정된 테스트에 죽은(no-op) mock 스캐폴딩이 남아 있어, 이번에 고친 것과 같은 클래스의 향후 flake 를 디버깅할 때 오해를 유발할 수 있다
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts` — `upstream abort fired during fetch cascades to the fetch controller` 테스트(1674행 부근)의 `const fetchPromise = new Promise<Response>(() => { /* never resolves */ })` 및 `observedSignal!.addEventListener('abort', () => { (fetchPromise as unknown as { _reject?: () => void })._reject?.(); })` 블록(1676-1686행대, 이번 diff 의 문맥 줄에 포함되어 있으나 diff 자체가 수정한 부분은 아님)
  - 상세: `fetchPromise` 는 resolve/reject 콜백을 executor 에서 아예 버리므로(`() => {}`) 절대 정착되지 않고, 어디에도 await/반환되지 않아 테스트 결과에 영향을 주지 않는다. `_reject?.()` 호출도 `fetchPromise` 에 `_reject` 프로퍼티가 존재한 적이 없어 항상 no-op 이다. 실제로 테스트를 통과/실패시키는 것은 이번 diff 가 고친 두 번째 `return new Promise((_, reject) => {...})` 블록뿐이다. 기능적 영향은 없지만, 이번에 겪은 것과 같은 "mock 이 실제 fetch 동작을 안 따른다" 류 회귀를 다음에 디버깅하는 사람이 이 죽은 코드를 실제 동작 경로로 오인할 위험이 있다.
  - 제안: 이번 PR 의 필수 조치는 아님(fix 자체와 무관). 여유가 있을 때 `fetchPromise`/`_reject` 블록 제거해 테스트가 실제로 무엇으로 통과하는지를 명확히 할 것.

## 회귀·검증 (직접 실행 확인)

- `python3 -m pytest .claude/tests/test_changed_paths_reusable.py .claude/tests/test_required_check_skip_jobs.py -q` → **21 passed, 31 subtests passed**.
- `python3 -m pytest .claude/tests/test_workflow_yaml_structure.py -q` → **12 passed, 281 subtests passed** — `_SKIP_JOB_WORKFLOWS`/`_PULL_REQUEST_KEYS`/`CONVERTED` 3중 레지스트리가 여전히 일치하고, 신설된 `_changed-paths.yml` 도 `_workflow_files()` 의 glob(`*.y*ml`)에 자동으로 걸려 등록 누락 없이 스캔된다(직접 확인).
- `npx jest http-request.handler.spec.ts -t "cancellation"` (codebase/backend) → **3 passed** — 수정된 mock 이 로컬에서도 즉시(0.3s) 통과하며, "already-aborted" 케이스(동기 abort)와 "no upstream signal" 케이스는 원래 레이스 조건의 영향을 받지 않는 별도 코드 경로임을 확인해 이번 fix 가 다른 두 테스트를 깨뜨리지 않는다.
- 직접 실행으로 재현: `PATHSPECS="  a.yaml\nb.yaml  \n"` 를 `_changed-paths.yml` 의 실제 `run:` 블록에 흘려 스텁이 `["  a.yaml", "b.yaml  "]`(공백 보존)을 받는 것을 확인 — 위 WARNING 의 근거.
- 이전 리뷰 라운드(`review/code/2026/08/09/18_32_41/RESOLUTION.md`)가 지적한 두 테스트 WARNING(#3 공백 포함 pathspec 미고정, #4 `${{ }}` 인젝션 불변식 미고정)은 이번 diff 의 `test_a_pathspec_containing_spaces_stays_one_argument`(118-127행)와 `test_run_block_never_interpolates_expressions`(151-162행)로 실제 추가되어 있음을 확인.

## 긍정적 관찰

- 정적 grep 대신 워크플로 YAML 의 `run:` 블록을 실제 파싱해 bash 로 실행하고 스텁이 받은 `$#`/인자를 검증하는 방식(`test_changed_paths_reusable.py`)은 "코드가 있다"와 "동작한다"를 정확히 분리하며, 실제로 초판의 `mapfile`(bash 4+ 전용) 버그를 CI 도달 전에 잡았다고 문서화돼 있고 이 저장소의 bash 3.2 로컬 환경에서 그 특성이 재확인된다.
- `test_required_check_skip_jobs.py::test_changes_job_publishes_relevant` 가 호출부의 `uses:` 만 보고 멈추지 않고 공유 워크플로(`_changed-paths.yml`) 내부의 `outputs.relevant`/`id: detect`/`workflow_call.outputs.relevant.value` 배선까지 따라 들어가 검증하는 것은, "한 파일만 바뀌어도 세 스위트가 초록으로 남는" 인다이렉션 특유의 사각지대를 정확히 겨냥한 설계다.
- 빈 줄·공백-only 줄·단일 pathspec·빈 입력(fail-closed) 등 실제 도달 가능한 입력 경계를 폭넓게 커버하고, RESOLUTION.md 에 뮤테이션 3건(따옴표 제거·wiring 오타·자기등재 제거)이 실제로 RED 를 낸 기록까지 남아 있어 가드의 유효성이 실측돼 있다.

## 요약

CI reusable workflow 추출에 대한 새 테스트(`test_changed_paths_reusable.py`)와 갱신된 배선 가드(`test_required_check_skip_jobs.py`)는 정적 검사가 아닌 실행 검증과 인다이렉션 추적을 택해 이 패턴의 실제 위험(조용한 게이팅 상실)을 정확히 겨냥하고 있으며, 직접 재실행으로 21/21(+12/12 교차 레지스트리) 통과를 확인했다. 다만 한 가지 실측 가능한 갭이 남아 있다 — pathspec 줄 내부의 선행/후행 공백이 bash 런타임에서는 보존되는데 Python 테스트 헬퍼(`pathspecs_of`)는 `.strip()` 으로 정규화해 비교하므로, 향후 워크플로 편집에서 실수로 공백이 섞여도 테스트는 통과하고 런타임만 조용히 그 pathspec 을 무력화할 수 있다. `http-request.handler.spec.ts` 의 flaky-mock 수정은 근본 원인(mock 이 already-aborted signal 을 안 따름)을 정확히 짚었고 로컬 재실행으로 회귀가 없음을 확인했다.

## 위험도
LOW
