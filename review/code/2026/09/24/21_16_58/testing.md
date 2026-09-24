# 테스트(Testing) 리뷰 — docs-guard-trigger

## 검증 방법 메모
- 저장소 파일은 뮤테이션하지 않았다. `Read`/`Grep`/`find`/`git status --short`/`python3 -m pytest` 만 사용했고 실행 후 `git status --short` 로 워킹트리가 깨끗함(`review/code/...` 산출물 외 변경 없음)을 재확인했다.
- 관련 하네스 테스트를 직접 재실행해 회귀 여부를 실측했다: `python3 -m pytest .claude/tests/test_workflow_yaml_structure.py .claude/tests/test_required_check_skip_jobs.py .claude/tests/test_workflow_run_inputs_covered.py .claude/tests/test_ci_paths_changed.py .claude/tests/test_doc_sync_matrix.py -q` → 전부 GREEN (53 passed / 551 subtests + 7 passed / 21 subtests). plan 체크리스트가 주장한 "1138 passed" 와 모순되지 않는다.
- `codebase/frontend/src/lib/docs/__tests__/*.test.ts` 파일 수를 직접 세어 plan 이 인용한 "23파일" 수치를 실측 대조 — **일치**.

## 발견사항

- **[WARNING]** 이번 수정이 막으려는 정확한 결함(플랜 `plan/**` 누락 · 단일 파일만 실행)을 고정하는 자동 회귀 테스트가 하나도 없다
  - 위치: `.github/workflows/spec-link-checks.yml:71`(pathspecs 블록의 `plan/**` 항목), `.github/workflows/spec-link-checks.yml:115`(디렉터리 전체 실행 `run:`) — 그리고 이를 검증해야 할 하네스 `.claude/tests/test_workflow_yaml_structure.py`
  - 상세: 이번 plan 의 동기 자체가 "이전 갭이 수동 관찰(#1387)로만 발견됐다" 는 것이다. 그런데 이번 수정도 똑같이 수동 검증(plan §D 의 1회성 `scripts/ci-paths-changed.sh` 로컬 실행 + prose 기록)으로만 확인됐고, 이를 반복 가능한 assertion 으로 남기지 않았다. 기존 하네스 3종을 직접 읽고 실행해 확인한 결과:
    1. `test_workflow_yaml_structure.py` 는 job 의 `if:` 조건만 등재표로 고정한다(`_JOB_CONDITIONS`) — `pathspecs:` 내용이나 `run:` 커맨드는 검사 범위 밖이다.
    2. `test_required_check_skip_jobs.py::test_no_pathspec_is_a_dead_filter` 는 "현재 있는 pathspec 하나하나가 tracked 파일과 매치하는가" 만 본다. `plan/**` 항목이 통째로 **삭제**돼도 이 테스트는 여전히 GREEN 이다(남은 pathspec 들이 각각 유효하므로) — 즉 "이 항목이 있어야 한다" 는 요구를 강제하지 않는다.
    3. `test_workflow_run_inputs_covered.py` 의 파일-토큰 정규식(`_PATH_TOKEN`)은 `scripts|\.github|codebase|\.claude` 접두 + 확장자를 요구한다. 이번 `run:` 값 `src/lib/docs/__tests__/` 는 `pnpm --filter frontend` 기준 상대경로라 접두 조건에 안 걸리고 확장자도 없어 애초에 이 가드의 관심 대상이 아니다(변경 전후 공통 — 이 자체는 새 회귀는 아니지만, "이 스텝이 실행하는 파일이 pathspecs 에 덮였는가" 를 검증하는 유일한 가드가 이 스텝에는 적용되지 않는다는 뜻이다).
  - 재현: `grep -n "plan/\*\*" .claude/tests/*.py` → `test_e2e_exemption_paths_sync.py`(무관한 e2e 화이트리스트 문서 테스트) 외 매치 없음. `spec-link-checks.yml` 의 `plan/**` 를 검증하는 테스트가 전무함을 확인.
  - 영향: 향후 누군가 `spec-link-checks.yml` 을 리팩터링하면서 `plan/**` 줄을 실수로 지우거나, "디렉터리 전체" 실행을 다시 특정 파일 하나로 되돌려도, 기존 하네스 테스트 스위트는 전부 GREEN 을 유지한다. 이번 plan 이 고치는 결함과 **완전히 같은 형태**의 재발이 다시 "누군가 우연히 발견"하는 방식으로만 잡히게 된다.
  - 제안: `test_workflow_yaml_structure.py` 류의 등재표 패턴을 본떠 `spec-link-checks.yml` 전용 assertion 을 하나 추가할 것 — 예: (a) `changes.pathspecs` 에 `plan/**` 이 리터럴로 존재하는지, (b) `spec-link-integrity` job 의 `run:` 문자열이 `src/lib/docs/__tests__/` 로 끝나는(단일 `.test.ts` 파일이 아닌) 디렉터리 실행 형태인지를 고정하는 좁은 테스트. `test_required_check_skip_jobs.py` 의 "등재 안 하면 fail" 스타일이 선례다.

- **[INFO]** no-op 안내 메시지가 새 트리거 표면(`plan/**`)을 반영하지 않음 — 가독성 문제, 기능 결함 아님
  - 위치: `.github/workflows/spec-link-checks.yml:99` (`echo "codebase 소스·spec 관련 경로 변경 없음 — 이 잡은 no-op 으로 통과한다."`)
  - 상세: 이 스텝은 `relevant == 'false'` 일 때만 도는 안내문으로, 디버깅 시 "왜 이 잡이 no-op 이었는가/아닌가" 를 사람이 읽는 유일한 텍스트다. `plan/**` 이 새 트리거 표면으로 추가됐는데 이 문구는 여전히 "codebase 소스·spec" 만 언급해, 나중에 이 잡이 plan-only PR 에서 도는 이유를 CI 로그만 보고 추론하기 어렵게 만든다. 테스트 실패는 아니지만 회귀 진단 시 신호 품질을 낮춘다.
  - 제안: 문구에 "plan" 을 추가(예: "codebase 소스·spec·plan 관련 경로 변경 없음"). 급하지 않음.

- **[INFO]** 실측 수치("23파일 3567개")는 plan 문서의 산문 기록일 뿐, 코드화된 assertion 이 아니다 — 다만 안전망은 이미 존재
  - 위치: `plan/in-progress/docs-guard-trigger.md` 체크리스트 2번째 항목("로컬에서 CI 와 같은 명령으로 23파일 3567개 확인")
  - 상세: 직접 `find codebase/frontend/src/lib/docs/__tests__ -name "*.test.ts" | wc -l` 로 대조해 23이 일치함을 확인했다. 이 수치 자체가 assertion 이 아니므로 향후 파일이 늘거나 줄어도 아무것도 이 문서를 갱신하라고 강제하지 않지만(그 자체가 결함은 아님 — 원래 목적이 "파일을 열거하지 않는" 것이었으므로 개수 고정은 오히려 설계 취지에 반한다), **경로 자체가 깨지는(0개 매칭)** 경우의 안전망은 확인해 뒀다: `codebase/frontend/vitest.config.ts` 에 `passWithNoTests` 가 설정돼 있지 않아(기본값 `false`) 디렉터리 경로 오타로 0개 파일이 매칭되면 vitest 는 비-zero 로 실패한다 — 즉 이 워크플로가 고치려는 "가드가 조용히 안 도는" 형태로 스스로 퇴화하지는 않는다. 조치 불요, 기록용.

## 요약

이번 변경은 애플리케이션 코드(TS/JS)를 건드리지 않는 CI 워크플로(`spec-link-checks.yml`)·문서(`PROJECT.md`)·plan/리뷰 산출물 변경이라 전통적 unit/mock/edge-case 축은 대부분 해당 사항이 없다. 실측(하네스 재실행 GREEN, 23파일 수 일치, `git status` 클린)으로 기존 회귀는 없음을 확인했다. 다만 이 plan 의 존재 이유 자체가 "이전 갭이 자동 테스트가 아니라 수동 관찰로만 드러났다" 는 것인데, 이번에 넣은 수정(`plan/**` pathspec, 디렉터리 전체 실행) 역시 반복 가능한 하네스 assertion 없이 1회성 수동 검증(plan §D)으로만 뒷받침된다 — `test_workflow_yaml_structure.py`/`test_required_check_skip_jobs.py`/`test_workflow_run_inputs_covered.py` 세 가드 모두 이 특정 사실(두 pathspec 항목의 존재, 디렉터리-vs-단일파일 실행 형태)을 강제하지 않음을 코드를 직접 읽고 실행해 확인했다. 이 갭을 메우는 좁은 회귀 테스트 하나를 추가하는 것이 이번 plan 의 취지("같은 갭의 셋째 판" 을 만들지 않는 것)와 정확히 일치한다.

## 위험도
LOW
