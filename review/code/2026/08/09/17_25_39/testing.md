# 테스트(Testing) 리뷰 — backend-typecheck-gap

## 검증 방법

- `.claude/tests/test_backend_typecheck_ratchet.py`, `test_required_check_skip_jobs.py`, `test_workflow_yaml_structure.py`, `test_harness_checks_paths_coverage.py`, `test_dependabot_npm_coverage.py`, `test_doc_sync_matrix.py` 를 로컬 실행 → 전부 통과.
- `.claude/tests` 전체 스위트 실행 → **958 passed, 963 subtests passed** (회귀 없음).
- 변경된 backend `*.spec.ts` 5개(`slack-message.renderer`, `execution-engine.service`, `executions-rerun.service`, `integration-expiry-scanner.service`, `workflows.service`) + `secret-resolver.service.spec.ts` 를 jest 로 직접 실행 → **190 tests passed**.
- `codebase/backend/jest.config.ts` 의 `testRegex: '.*\.spec\.ts$'` 및 `npx jest --listTests` 실측으로 `backend-checks.yml` "unit" 잡 주석의 "e2e(`*.e2e-spec.ts`)는 여기서 안 돈다" 주장을 검증 — 실측 0건, 주석과 일치.
- `harness-checks.yml` 에 `.github/workflows/**` glob 이 이미 있어 `backend-checks.yml` 신설이 `test_harness_checks_paths_coverage.py` 를 별도 등재 없이 통과함을 확인(갭 아님).

## 발견사항

- **[WARNING]** `run_tsc()` 의 fail-closed(exit 2) 분기 3곳이 전혀 테스트되지 않음
  - 위치: `.claude/tests/test_backend_typecheck_ratchet.py` `FailClosedTest` 클래스(게이트 107~135행) / `scripts/check-backend-typecheck-ratchet.py` `run_tsc()`(게이트 71~101행, `_undecidable` 호출부: `TimeoutExpired`, `OSError`, `returncode != 0 and not out.strip()`)
  - 상세: `FailClosedTest` 는 `load_baseline()` 이 만드는 4개 판단-불가 경로(baseline 부재/파싱실패/`files` 비-매핑/정수 아님)만 `MOD.load_baseline()` 을 직접 호출해 검증한다. 그런데 `VerdictTest` 는 `mock.patch.object(MOD, "run_tsc", lambda: fake_output)` 로 `run_tsc()` 자체를 항상 통째로 대체하므로, 이 스크립트가 실제로 subprocess 를 부르는 유일한 지점(`run_tsc()`) 안의 세 `_undecidable` 분기 — tsc timeout, `npx`/`tsc` 실행 실패(OSError), 비-zero exit 인데 stdout 이 비어 있는 경우(설정 오류로 추정) — 는 이 테스트 파일 어디서도 실행되지 않는다. 모듈 docstring 은 "tsc 를 못 돌리거나 출력을 못 읽으면 exit 2" 를 핵심 보장으로 명시하는데, 그 보장의 절반(7개 `_undecidable` 사이트 중 3개)이 무증거 상태다. `subprocess.run` 을 `mock.patch("subprocess.run", side_effect=subprocess.TimeoutExpired(...))` 등으로 스텁하면 검증 가능하다.
  - 제안: `run_tsc()` 를 대상으로 3개 케이스(timeout, OSError, "returncode!=0 & empty stdout")에 대해 exit 2 를 확정하는 테스트를 `FailClosedTest` 에 추가할 것. `test_override_floors.py` 가 이미 이 클래스의 실패(audit 미실행/hang/빈 stdout)를 어떻게 stub 했는지 참고 가능.

- **[WARNING]** `--update` 플래그 / `write_baseline()` 이 전혀 테스트되지 않음
  - 위치: `.claude/tests/test_backend_typecheck_ratchet.py` 전체(파일 내 "update" 문자열 0건) / `scripts/check-backend-typecheck-ratchet.py` `write_baseline()`(게이트 137~148행)·`main()` 의 `--update` 분기(게이트 162~165행)
  - 상세: README 신규 행과 스크립트 docstring 양쪽이 `--update` 를 "감소를 반영하는 정상 경로"로 명시하는데, 이 함수를 호출하는 테스트가 하나도 없다(`VerdictTest`/`FailClosedTest` 모두 `sys.argv`를 `["ratchet"]` 로 고정). `write_baseline` 의 정렬·JSON 포맷·`total` 재계산 로직에 결함이 생기면 개발자가 로컬에서 실제로 `--update` 를 실행해 diff 를 눈으로 봐야만 드러난다 — `test_committed_baseline_is_wellformed`/`test_baseline_only_lists_test_files` 는 이미 커밋된 baseline 의 **정적 형태**만 보증하지, 그것을 만들어내는 **생성기 로직**은 보증하지 않는다.
  - 제안: `mock.patch.object(MOD, "BASELINE", tmp)` + `mock.patch("sys.argv", ["ratchet", "--update"])` 조합으로 `main()` 을 실행해 (a) exit 0, (b) 파일에 쓰인 JSON 이 `count_by_file` 결과와 `total`·`files` 양쪽에서 일치, (c) 재실행 시 방금 쓴 baseline 으로 통과(round-trip)하는 테스트를 추가할 것.

- **[INFO]** `deleteByPrefix` 신규 가드 테스트의 mock 이 실제 SQL `LIKE` 와일드카드 의미론을 재현하지 않음
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.spec.ts` `createInMemoryRepository()` 의 `createQueryBuilder()`(43~66행)
  - 상세: mock 은 `params.prefix` 의 끝 `%` 만 잘라내고 나머지는 순수 JS `.startsWith()` 로 비교한다 — `%`/`_` 를 SQL 와일드카드로 해석하지 않는다. 신규 `it.each` 4건은 애플리케이션 레벨 정규식 검사(`/[%_\\]/`)에서 throw 되어 repository 에 도달하지 않으므로 이 자체는 각 테스트의 유효성을 해치지 않는다. 다만 그 결과로 "가드를 없애면 실제 Postgres LIKE 가 의도보다 넓게 지운다"는, 이 가드 전체의 존재 근거인 명제를 증명하는 테스트(unit이든 e2e든)가 스위트 어디에도 없다 — 근거는 서비스 파일 주석의 설명뿐이고 실행 가능한 회귀 테스트로 고정되어 있지 않다.
  - 제안: 급하지 않음(가드 자체는 정규식으로 충분히 안전). 여유가 있으면 별도 mock(와일드카드를 실제로 해석하는 stub) 이나 e2e 스위트에서 "가드를 우회했다면 과다 삭제가 일어났을 것"을 1회 증명해 두면 이 가드의 근거가 문서 주석이 아니라 테스트로 고정된다.

- **[INFO]** private 메서드 hand-mirror 타입이 같은 파일에 두 벌 존재 — 이번 fix 는 증상만 고침
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 게이트 5056~5061행(이번에 `opts` 인자 추가로 고친 엄격한 시그니처) vs 같은 파일 2047행 부근의 느슨한 `updateExecutionStatus: (...a: unknown[]) => Promise<boolean>` 미러
  - 상세: 5056행 주석이 스스로 "같은 drift 가 두 번째다" 라고 밝히듯, 프로덕션 시그니처가 바뀔 때마다 손으로 미러링한 타입이 다시 벌어질 수 있는 구조는 그대로 남았다. 같은 파일 안에 이미 인자 개수를 아예 검사하지 않는(따라서 이 클래스의 drift 에 면역인) 두 번째 미러가 존재한다는 것은, 이 시그니처도 `Parameters<...>` 류로 프로덕션 타입에서 파생시키면 수작업 동기화 자체를 없앨 수 있었음을 보여준다. 이번 PR 이 도입한 ratchet 이 다음 drift 를 잡아주긴 하겠지만, 그건 "느슨해졌다가 사후 발견"이지 "애초에 못 벌어짐" 보다 약하다.
  - 제안: 이번 PR 범위는 아님(ratchet 신설이 목적). 다음에 이 private-helper 타입을 만질 일이 있으면 `Parameters<(typeof service)['updateExecutionStatus']>` 형태로 프로덕션에서 파생시키는 리팩터를 고려할 것.

## 긍정적으로 확인된 점

- `test_required_check_skip_jobs.py` 의 `CONVERTED` 리스트 설계는 `"backend-checks.yml"` 한 줄 추가만으로 8개 불변식(paths 필터 부재·`changes` 잡 출력 배선·`needs: changes`·스텝별 게이팅·no-op 안내·스크립트 자기참조·레지스트리 상호일치)을 신규 워크플로에 자동으로 재적용한다 — 로컬 실행으로 전부 통과 확인. 과거 6번 반복된 "한쪽 가드만 갱신" 사고 클래스를 구조적으로 막는 좋은 설계.
- `test_backend_typecheck_ratchet.py::VerdictTest` 는 `count_by_file`/비교 로직을 낱개로 유닛 테스트하는 대신 `main()` 을 실제 baseline 파일 + mocked `run_tsc` 로 end-to-end 구동한다 — 검증 대상이 "대조 규칙"이라는 모듈 docstring 의도와 정확히 일치하는 좋은 테스트 경계 설정.
- `deleteByPrefix` 의 `it.each` 4개 실패 케이스 + 1개 "정상 경로가 안 막히는지" 통과 케이스는 방향(과다 거부 금지)까지 함께 고정해 두어, 가드가 정당한 호출부를 막는 회귀를 방지한다.
- 5개 backend `*.spec.ts` 의 시그니처 수정은 순수 타입 정합(인자 개수/누락 import)이며 jest(타입 strip) 로 190건 전부 통과 — 런타임 회귀 없음을 실측 확인.

## 요약

이번 변경의 핵심 산출물인 `check-backend-typecheck-ratchet.py` + `test_backend_typecheck_ratchet.py` 는 "판단 불가는 exit 2" 라는 fail-closed 설계를 잘 세웠지만, 그 설계 중 실제 subprocess 호출부(`run_tsc()`)의 3개 실패 분기와 baseline 갱신 정상 경로(`--update`/`write_baseline`)가 테스트로 뒷받침되지 않는다 — 둘 다 이 저장소가 반복해 겪은 "게이트가 조용히 무력화" 클래스에 정확히 속하는 지점이라 WARNING 으로 표시했다. `secret-resolver` LIKE 가드와 5개 backend spec 타입 정합 수정은 실측(pytest 전체 스위트 958건 + jest 190건 전부 통과) 결과 회귀 없이 안전하게 랜딩됐고, `test_required_check_skip_jobs.py`/`test_workflow_yaml_structure.py` 확장은 기존 파라미터화 설계를 그대로 재사용해 새 워크플로에 기존 불변식을 자동 적용하는 좋은 사례다. CRITICAL 은 없다.

## 위험도
MEDIUM
