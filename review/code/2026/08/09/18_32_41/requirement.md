STATUS=success requirement review complete — 0 CRITICAL, 2 WARNING, 2 INFO

===REPORT_MARKDOWN_BELOW===

# 요구사항(Requirement) 리뷰 — skip-job `changes` 잡의 reusable workflow 추출

## 점검 방법

7개 변경 파일(`.claude/tests/README.md`, `.claude/tests/test_changed_paths_reusable.py`(신설),
`.claude/tests/test_required_check_skip_jobs.py`, `.github/workflows/_changed-paths.yml`(신설),
`backend-checks.yml`/`deps-security-checks.yml`/`frontend-checks.yml`)를 전수로 읽고, 다음을
실측했다:

- `python3 -c "yaml.safe_load(...)"` 로 4개 워크플로 YAML 구문·잡 목록 검증 — 전부 OK.
- `python3 -m unittest discover -s .claude/tests -p 'test_changed_paths_reusable.py'` — 9/9 OK.
- `test_required_check_skip_jobs.py` — 10/10 OK.
- `test_workflow_yaml_structure.py` — 12/12 OK.
- `test_harness_checks_paths_coverage.py` — 26/26 OK.
- 전체 하니스 스위트(`test_*.py`) — **973 tests OK**.
- SoT 판정: `plan/in-progress/ci-required-check-skip-jobs.md`(§후속, line 187 "changes 잡을
  reusable workflow 로 추출 — 트리거 도달, 다음 PR")가 이 diff 의 근거 plan 이다. 이 diff 의
  HEAD 커밋(`1b0e7b313 refactor(ci): skip-job changes 잡을 reusable workflow 로 추출`)이 바로
  그 항목의 실행분이다.

## 기능 검증 (통과)

- `_changed-paths.yml` 의 `on.workflow_call.outputs.relevant.value` → `jobs.detect.outputs.relevant`
  → `steps.detect.outputs.relevant` 3단 참조 체인이 실제로 일치 (호출부의
  `needs.changes.outputs.relevant` 가 값을 받는다).
- 3개 호출부(`backend-checks.yml`/`deps-security-checks.yml`/`frontend-checks.yml`)가
  `changes: uses: ./.github/workflows/_changed-paths.yml` 로 정확히 전환됐고, 이전 `run:`
  블록에 하드코딩됐던 pathspec 목록이 **전량 보존**된 채(각각 8→9, 9→10, 6→7개) `with.pathspecs`
  블록 스칼라로 옮겨졌다 — 늘어난 1개는 신설된 `.github/workflows/_changed-paths.yml` 자기 참조로,
  "판정 wiring 이 바뀌면 그것에 기대는 워크플로가 재트리거돼야 한다"는 설계 의도와 일치한다.
  `test_converted_workflows_pass_the_script_its_own_path` 가 이를 고정한다.
- 여러 줄 문자열 → 인자 배열 변환(`while IFS= read -r spec; do if [ -n "$(... | tr -d
  '[:space:]')" ]; then FILTERED+=("$spec"); fi; done <<< "$PATHSPECS"`)이 `set -e` 아래에서도
  안전하고(`if` 형태로 마지막 커맨드가 실패 종료 코드를 반환하지 않음), 빈 줄/공백 줄을
  올바르게 걸러내며, 빈 입력 시 `exit 2`(fail-closed)로 끝난다 — 이 세 축을
  `test_changed_paths_reusable.py::ArgumentSplittingTest` 가 스텁 스크립트로 실행 검증하고
  실제로 통과함을 확인했다.
- `PATHSPECS` 를 `env:` 로 넘기고 `run:` 문자열에 `${{ }}` 를 직접 끼워 넣지 않는 인젝션 회피,
  `fetch-depth: 0`, SHA 4개 env 전달이 그대로 보존됐다(`WiringTest` 3건 통과).
- `README.md` 신설 행의 서술(스텁이 받은 `$#`/각 인자를 확인, `mapfile` 대신 `read` 루프 이유,
  빈 pathspec 이 "모든 경로"로 해석되는 위험, 빈 입력 fail-closed)이 실제 구현·테스트와
  line-level 로 일치한다.

## 발견사항

- **[WARNING]** SoT plan 체크리스트가 이미 반영된 작업을 미완료로 서술한다.
  - 위치: `plan/in-progress/ci-required-check-skip-jobs.md:187`
  - 상세: §후속 "changes 잡을 reusable workflow(workflow_call)로 추출 — 트리거 도달, 다음 PR"
    항목이 `- [ ]`(미완료)로 남아 있으나, 이 diff 의 HEAD 커밋(`1b0e7b313`)이 정확히 그 작업이다
    (`_changed-paths.yml` 신설 + 3개 호출부 전환). 저장소 컨벤션(CLAUDE.md 및 반복 지적된
    "plan 체크박스 = 실제 상태")상 커밋된 작업은 체크박스에 반영돼야 push 전 실제 상태와
    plan 문서가 어긋나지 않는다. 이 세션엔 `ci-changed-paths-reusable-5e21c8` 워크트리에 대응하는
    `plan/in-progress/<name>.md` 도 별도로 보이지 않는다(둘 다 developer 후속 조치가 필요).
  - 제안: 이 PR 을 머지하기 전(또는 같은 PR 에서) 187번째 줄을 `[x]` 로 체크하고 실제 PR
    번호를 덧붙인다.

- **[WARNING]** 자매 plan 문서의 후속 항목이 이 PR 로 부분적으로만 해소됐는데, 그 사실이
  기록돼 있지 않다.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:211`
  - 상세: 해당 §후속 항목은 "**`changes` 잡 + 셋업 보일러플레이트**를 reusable workflow 로
    추출 — 트리거 이미 도달" 로 적혀 있다. 이 diff 는 `changes`(→ `detect`) 잡만 추출했고,
    각 잡(`lint`/`unit`/`typecheck-ratchet`, `config-guard`/`audit`/`override-floors`,
    `test-and-build`)에 반복되는 `checkout`+`pnpm/action-setup`+`actions/setup-node` 셋업
    보일러플레이트는 여전히 워크플로마다 중복된 채다. `ci-required-check-skip-jobs.md:187`
    의 범위 서술("changes 잡을 reusable workflow 로 추출")과는 일치하지만, 더 넓게 적힌
    이 항목을 나중에 그대로 체크 처리하면 "셋업 보일러플레이트" 부분이 미착수 상태로
    조용히 닫힌 것처럼 보일 위험이 있다.
  - 제안: 코드를 되돌릴 필요는 없음(범위 축소가 의도적임을 `ci-required-check-skip-jobs.md`
    자체가 뒷받침) — 다만 `backend-lint-gate-broken-on-main.md:211` 항목을 "changes 잡 추출은
    완료, 셋업 보일러플레이트 추출은 별도 후속"으로 쪼개거나 문구를 갱신해 두 축의 완료
    상태를 구분할 것.

- **[INFO]** 관련 `spec/` 문서 없음 (spec 누락, 예상된 회색지대).
  - 위치: 해당 없음 (`spec/` 전역 검색 — grep 결과 harness/CI 패턴을 다루는 `spec/` 문서 부재)
  - 상세: CLAUDE.md 규약상 `spec/` 는 제품 정의만 다루고 하니스/CI 인프라는 대상이 아니다.
    이 변경 영역의 사실상 SoT 는 `plan/in-progress/ci-required-check-skip-jobs.md` 이며, 위
    두 WARNING 을 제외하면 코드가 그 문서의 서술(조건 방향 `!= 'false'`, fail-safe 방향,
    3번째 전환 시점 트리거, `needs: changes` 필수 등)과 정확히 일치한다.

- **[INFO]** README 신설 행이 `test_converted_workflows_pass_the_script_its_own_path` 의
  새 단언(공유 워크플로 자기참조 등재) 자체를 언급하지 않는다.
  - 위치: `.claude/tests/README.md:50` (신설 행), 비교 대상 `.claude/tests/test_required_check_skip_jobs.py`
    (`pathspecs_of` 도입 및 `.github/workflows/_changed-paths.yml` 등재 단언 — 실제 파일 라인
    75-83, 256-263)
  - 상세: 새 행은 `test_changed_paths_reusable.py` 자체는 정확히 설명하지만, 같은 diff 로
    바뀐 `test_required_check_skip_jobs.py` 의 신규 단언(호출부가 `uses:` 로 공유 워크플로를
    부르는지, 공유 워크플로가 자기 자신의 pathspec 목록에 등재됐는지)은 기존 51번째 행 서술
    범위 밖이다. 요약 문서라 모든 세부를 반영할 의무는 없으나, 리뷰어가 "다섯 번째 검증" 이라고
    부른 요구사항(`scripts/ci-paths-changed.sh` 자기 등재)에 짝을 이루는 "공유 워크플로 자기
    등재" 요구사항이 문서에 드러나지 않아 완전성 관점에서 참고할 만하다. 코드/테스트 자체는
    정확하다 — 순수 문서 커버리지 갭.
  - 제안: 선택 사항. 51번째 행(변경 없음)에 "및 공유 판정 워크플로 자신" 한 구절 추가 검토.

## 요약

핵심 로직(멀티라인 pathspec → 인자 배열 변환, blank-line 필터, fail-closed 빈 입력, 3단
output 체인, 각 호출부의 pathspec 보존 + 자기참조 추가, `needs`/`if` 게이팅 불변식)이
실행 검증(973/973 하니스 테스트 통과, 4개 워크플로 YAML 구문 확인)까지 마친 상태로 견고하게
구현돼 있고, 근거 plan(`ci-required-check-skip-jobs.md`)의 서술과 line-level 로 어긋나는 곳이
없다. 기능적 결함은 발견되지 않았다 — 남은 두 WARNING 은 코드 결함이 아니라 **이미 완료된
작업이 plan 체크리스트에 반영되지 않은** 문서 동기화 문제이며, push 전에 체크박스 갱신으로
해소 가능하다.

## 위험도

LOW
