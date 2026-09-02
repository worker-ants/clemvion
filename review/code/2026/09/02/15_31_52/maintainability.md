# 유지보수성(Maintainability) 코드 리뷰

## 리뷰 범위 메모

이 diff 는 이미 2라운드 코드 리뷰(`review/code/2026/09/02/11_27_26/`, `review/code/2026/09/02/15_04_04/`)를
거쳤고 각 라운드의 maintainability 담당도 LOW 위험도로 판정했다. 두 라운드 모두 확인한 INFO 2건
(`RatchetConfig` 리터럴 중복 — `.claude/tests/test_typecheck_ratchet.py:288-307`,
`sys.path.insert` 중복 삽입 — `scripts/check-backend-typecheck-ratchet.py:48` /
`scripts/check-frontend-typecheck-ratchet.py:51`)은 이번 라운드에서도 그대로 남아 있으나
두 번 모두 명시적으로 "조치 불요"로 판단된 트레이드오프라 재론하지 않는다. 이번 리뷰는 그
2라운드 수정(`da3394254`, 즉 `test_workflow_run_inputs_covered.py` 신설 + README/기존 테스트
보강)에서 **아직 독립적으로 유지보수성 검토를 받지 않은 부분**을 중심으로 확인했다.

## 발견사항

- **[WARNING]** `_tracked_files()` 헬퍼가 자매 테스트 모듈과 이름·목적이 같은 채로 다시
  구현됐다 — 이 PR이 다른 자리에서 정확히 막으려던 "동일 목적의 독립 사본이 조용히 갈린다"
  실패 클래스의 축소판이 새 파일 안에서 재현됐다.
  - 위치: `.claude/tests/test_workflow_run_inputs_covered.py:48-52`(신규 정의) — 기존 구현은
    `.claude/tests/test_harness_checks_paths_coverage.py:299-304`.
  - 상세: 신규 파일은 바로 옆 줄에서 같은 패키지의 `test_harness_checks_paths_coverage.py`로부터
    `filter_covers_file`을 정확히 import해 재사용한다(주석: "GitHub 의 segment-bounded `*` 를
    두 가드가 똑같이 모델링해야 한다. 사본을 만들면 이 PR 이 고친 바로 그 drift 다" —
    `review/code/2026/09/02/15_04_04/RESOLUTION.md` W2 서술). 그런데 바로 아래의
    `git ls-files` 래퍼 `_tracked_files()`는 재사용하지 않고 **같은 이름·같은 목적**으로
    독립적으로 다시 작성했다. 게다가 두 구현은 완전히 동일하지도 않다 —
    `test_harness_checks_paths_coverage.py:299-304`는
    `{line for line in out.split("\n") if line}`로 빈 줄을 명시적으로 걸러내는 반면, 신규
    파일은 `set(out.splitlines())`을 쓴다. `git ls-files` 출력에는 빈 줄이 나오지 않으므로
    지금은 두 함수의 결과가 우연히 같지만, 서로 다른 문자열 처리 방식을 쓰는 두 개의
    `_tracked_files`가 이제 이 저장소에 존재한다는 사실 자체가, 이 PR의 모듈 docstring이
    `plan_guard.py`↔`plan-stale-audit.sh` 사례로 직접 인용하며 경계하는 바로 그 실패
    클래스다. `filter_covers_file`은 import해 재사용하면서 바로 옆의 같은 성격 헬퍼는
    재사용하지 않은 비일관성이기도 하다.
  - 제안: `test_harness_checks_paths_coverage.py`의 `_tracked_files`를 import해 재사용할 것
    (`filter_covers_file`처럼 이미 모듈 간 import 선례가 있다). 혹은 두 곳 모두에서 쓰는
    `.claude/tests/_harness.py` 같은 공유 위치로 승격할 것.

- **[INFO]** `codebase/frontend/tsconfig.typecheck.json`의 `"//"` 주석 필드가 이 PR의 다른
  JSON 산출물과 다른 형태(문자열 배열)를 쓴다.
  - 위치: `codebase/frontend/tsconfig.typecheck.json:2-21` (`"//": [...]`)
  - 상세: 같은 PR이 생성/갱신하는 `scripts/frontend-typecheck-baseline.json:2`와
    `scripts/backend-typecheck-baseline.json`(둘 다 `scripts/_typecheck_ratchet.py`의
    `write_baseline()`이 생성하는 `"//": "<단일 문자열>"` 형태)은 긴 문자열 하나에 담는
    기존 관례를 따르는데, `tsconfig.typecheck.json`만 문자열 배열로 여러 "줄"을 표현한다.
    저장소 전체에서 `"//": [` 형태를 쓰는 JSON 파일은 이 파일이 유일하다(`grep -rl '"//": \['
    --include='*.json' .` 확인). 기능에는 영향 없다 — 이 필드를 읽는 코드는 없고 순수
    사람이 읽는 주석이다.
  - 제안: 조치 불요에 가까움(순수 서식). 다음에 이 파일을 만질 때 기존 baseline JSON 두
    곳과 같은 단일 문자열 형태로 맞추거나, 배열 형태가 더 낫다고 판단되면 그 결정을
    baseline JSON 쪽에도 반영해 저장소 전체 관례를 통일할 것.

- **[INFO]** `test_run_steps_reference_only_covered_files`가 4단 중첩 for 루프로 구성돼 있다.
  - 위치: `.claude/tests/test_workflow_run_inputs_covered.py:91-111`
  - 상세: workflow → job → step → token 4단계를 각각 for로 순회하며, 각 단계 시작부에
    `continue` 가드를 둬(`if job_name == "changes" or ...: continue`,
    `if not isinstance(run, str): continue`, `if token not in self.tracked: continue`) 실제
    조건 분기의 들여쓰기는 얕게 유지된다. 다만 자매 파일 `test_harness_checks_paths_coverage.py`의
    유사 순회 로직은 `_guarded_files`/`_extract_targets` 같은 헬퍼 함수로 한 단계씩 분리돼
    있어서, 이 테스트 메서드만 4단 순회를 한 함수 안에 통째로 담고 있는 점이 상대적으로
    눈에 띈다. 현재 라인 수·가독성은 여전히 준수할 만한 수준이라 즉각 조치가 필요한 결함은
    아니다.
  - 제안: 조치 불요. 이 파일을 다음에 확장할 일이 생기면 `for step in job.get("steps") or []:`
    이하를 `_tokens_in_step(step) -> Iterator[str]` 같은 제너레이터로 뽑아 3단으로 낮추는
    것을 고려.

## 요약

핵심 프로덕션 코드(`scripts/_typecheck_ratchet.py`, 두 엔트리포인트)는 이전 두 라운드에서
이미 함수 분리·네이밍·문서화·중첩 깊이 모두 양호하다고 확인됐고 이번 라운드에서도 변경이
없어 그 판정이 유효하다. 이번 라운드가 새로 확인한 부분은 2R 수정에서 신설된
`test_workflow_run_inputs_covered.py`와 `tsconfig.typecheck.json`인데, 전자에서 진짜 새
발견 — `_tracked_files()` 헬퍼가 자매 테스트 모듈의 동명 함수를 재사용하지 않고 미묘하게
다른 구현으로 다시 작성됐다 — 이 나왔다. 이 PR은 정확히 같은 클래스의 결함(코어 판정 로직
사본, `TEST_FILE_RULES` 사본, 모듈 이중 로드)을 세 번 고쳤고 `filter_covers_file`은 그
교훈대로 import해 재사용했으면서, 바로 옆 헬퍼는 같은 실수를 반복했다 — 기능 위험은
낮지만(현재 두 구현의 출력은 동일) 이 저장소가 반복해서 강조하는 원칙의 국소적 이탈이라
WARNING으로 남긴다. 나머지 두 건(JSON 주석 필드 형태 불일치, 4단 중첩 테스트 메서드)은
기능에 영향 없는 서식·가독성 수준의 INFO다.

## 위험도

LOW
