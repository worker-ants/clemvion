### 발견사항

- **[WARNING]** 이 PR 의 핵심 동작 주장("backend-only 변경에서도 `repo-guards.yml` 이 relevant=true 로 돈다")이 자동 회귀 테스트로 고정되지 않고 plan 문서의 수동 "실측" 서술에만 남아 있다
  - 위치: `.github/workflows/repo-guards.yml` (changes 잡의 `pathspecs: codebase/**` — 전체 파일 컨텍스트 52번째 줄), 대응 회귀 스위트 `.claude/tests/test_required_check_skip_jobs.py` 의 `DeadFilterTest.test_no_pathspec_is_a_dead_filter`(171행)
  - 상세: `plan/in-progress/mirror-guard-single-copy.md` §검증 기준에 "실증: backend 파일 하나만 바꾼 diff 에서 `repo-guards` = relevant=true, 대조군 `frontend-checks` = relevant=false" 라고 적혀 있는데, 이는 개발자가 로컬에서 한 번 확인한 결과이지 CI 스위트에 남는 assertion 이 아니다. `test_no_pathspec_is_a_dead_filter`(CONVERTED 전체에 제네릭 적용)는 "pathspec 이 tracked 파일과 하나라도 매치하는가"만 확인하므로, 누군가 실수로 `codebase/**` 를 `codebase/frontend/**` 로 좁혀도(또는 되돌려도) 이 테스트는 여전히 GREEN 이다 — 좁혀진 pathspec 도 다수의 tracked 프런트 파일과 매치하기 때문이다. 이 저장소가 "paths 커버리지 갭"을 반복 겪었다는 사실 자체가 이 PR 의 존재 이유인데, 정작 이 PR 이 만든 새 불변식("codebase 전 스택을 커버해야 한다")은 스택별 tracked 파일(backend/frontend/packages 각각 최소 1개)과 매치하는지를 직접 묻는 전용 assertion 이 없다.
  - 제안: `test_required_check_skip_jobs.py` 에 `repo-guards.yml`(또는 "저장소 전체 스캔" 성격의 워크플로) 전용으로 "pathspec 이 `codebase/backend/**`·`codebase/frontend/**`·`codebase/packages/**` 각각에서 최소 1개 tracked 파일과 매치해야 한다"는 assertion 을 추가하거나, `test_ci_paths_changed.py` 패턴(임시 git 저장소 + subprocess)으로 "backend 파일만 바꾼 diff → relevant=true" 를 직접 재현하는 케이스를 하나 추가한다.

- **[INFO]** backend 사본 삭제 시 "9종 테스트 제목 전수 대조" 근거가 diff 로 기계 검증되지 않고 plan 문서 텍스트로만 남는다
  - 위치: `plan/in-progress/mirror-guard-single-copy.md` §검증 기준 ("캐너리를 잃지 않는다 — 대조 완료(실측)")
  - 상세: 삭제된 `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts` 의 `it` 9종이 `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror.test.ts` 에 전부 있다는 주장은 이 PR 안에서 사람이 한 번 대조한 결과다. 실제로 두 파일의 `it(...)` 제목을 diff 로 대조해 보면 문구가 완전히 동일(`"SoT 패키지 밖에서 마커 심볼을 재선언하지 않는다"` 등)해 이번 건은 근거가 맞다. 다만 이 방식은 일회성 전환에서만 유효하고, 앞으로 유사한 "사본 통합" PR 이 또 생기면 같은 수동 대조가 반복돼야 한다 — 삭제 전 자동 diff(`grep -o 'it(".*"' file_a file_b` 류)로 제목 집합 동치를 확인하는 절차를 남겨두면 재발 방지에 도움이 된다. 지금 당장의 리스크는 낮다(백엔드 사본이 이미 사라졌으므로 향후 드리프트 표면 자체가 없음).

- **[INFO]** (긍정적 관찰) 신규 워크플로가 기존 계약 테스트 스위트를 온전히 상속받는 구조
  - 위치: `.claude/tests/test_required_check_skip_jobs.py:60`(`CONVERTED` 리스트에 `"repo-guards.yml"` 추가), `.claude/tests/test_workflow_yaml_structure.py:260,294,365,418`(4곳 레지스트리 동반 등록)
  - 상세: `repo-guards.yml` 을 `CONVERTED` 리스트 한 곳에 추가하는 것만으로 `test_pull_request_has_no_paths_filter`·`test_push_has_no_paths_filter_either`·`test_changes_job_publishes_relevant`·`test_every_other_job_needs_changes`·`test_every_step_is_gated`·`test_each_job_announces_the_no_op_path`·`test_converted_workflows_pass_the_script_its_own_path`·`test_each_workflow_registers_its_own_path`·`test_the_two_registries_agree` 등 9개 이상의 제네릭 계약 테스트를 자동으로 상속한다. 새 워크플로 추가 시 등록 표면이 좁고(하네스 레지스트리 4곳) 전부 하드 강제된다는 점에서 테스트 용이성이 좋다. 실제로 diff 를 확인해도 `repo-guards.yml` 의 job 조건(`if: ${{ !cancelled() }}`)·스텝 게이팅(`if: needs.changes.outputs.relevant != 'false'`)·no-op 안내 스텝·자기 경로 등록(`.github/workflows/repo-guards.yml`)이 모두 기존 패턴과 정확히 일치해 이 테스트들이 실제로 통과할 것으로 판단된다.

- **[INFO]** backend 사본 삭제 후 잔존 참조 없음 — 회귀 위험 낮음
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts`, `masked-marker-mirror.spec.ts` (둘 다 삭제)
  - 상세: `grep -rn "masked-marker-mirror"` 로 `.ts`/`.json`/`.sh`/`.yml` 전체를 훑어도 삭제된 두 파일을 가리키는 import·경로 문자열이 codebase/.github/.claude 어디에도 남아 있지 않다(테스트 자기 자신들의 상호 import 제외). CI 하네스 등록부(`test-stages.sh`·`packages-checks.yml` matrix 등)도 이 파일들을 개별 등재하지 않았으므로 dangling 참조가 생기지 않는다.

### 요약

변경의 실질은 (1) `codebase/**` 전체를 훑는 전용 CI 워크플로 `repo-guards.yml` 신설, (2) 그 워크플로를 기존 하네스 계약 테스트(`test_required_check_skip_jobs.py`/`test_workflow_yaml_structure.py`)의 `CONVERTED`/레지스트리에 등록, (3) 중복이던 backend 미러 가드 사본 2파일 삭제, (4) frontend 쪽 미러 가드/테스트 파일은 헤더 주석만 갱신(로직·assertion 무변경)이다. 삭제된 backend 사본이 검사하던 불변식(마커 심볼 재선언 탐지)은 frontend 쪽 동일 spec 이 그대로 보유하고 있어 즉각적인 커버리지 손실은 없고, 신규 워크플로는 기존 CONVERTED 리스트 패턴에 올라타 다수의 제네릭 계약 테스트(경로 필터 부재·changes wiring·step 게이팅·자기 경로 등록 등)를 자동으로 상속받는 좋은 구조다. 다만 이 PR 이 실제로 없애려던 결함 클래스("경로 게이팅이 가드를 무력화한다")의 반증이 되는 핵심 주장 — `codebase/**` 가 backend/frontend/packages 전 스택을 실제로 커버한다는 것 — 은 자동화된 스택별 assertion 없이 개발자의 1회성 수동 실측으로만 뒷받침되며, 기존 제네릭 dead-filter 테스트는 "pathspec 이 어떤 스택으로 좁혀져도" 여전히 GREEN 을 낼 수 있는 형태라 이 불변식을 지키지 못한다. 이 저장소가 같은 클래스의 갭을 반복 겪어 왔다는 배경(코드 주석·plan 문서에 명시)을 고려하면, 이 지점에 전용 회귀 테스트를 하나 추가하는 것이 이 PR 의 의도를 완결시킨다.

### 위험도
LOW
