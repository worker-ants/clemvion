# 의존성(Dependency) Review

## 발견사항

- **[WARNING]** 신규 `PyYamlPinsAgreeTest` 는 세 pip-install 지점의 PyYAML 버전 **합의**만 지키고, **바닥(floor) 침식**은 못 잡는다
  - 위치: `.claude/tests/test_review_gate_ci.py:530-549` (클래스 `PyYamlPinsAgreeTest`, 특히 `test_every_workflow_pins_the_same_version` 의 `assertEqual(len(pins), 1, ...)`)
  - 상세: 이 테스트는 `.github/workflows/*.yml` 전체를 정규식 `pip install "(pyyaml[^"]*)"` 로 스캔해 서로 다른 pin 문자열이 섞이면(=드리프트) 실패시킨다. 그러나 **세 지점을 동시에 같은 값으로** 낮추면(예: `pyyaml>=5.3,<6` 처럼 오래된 취약 릴리스로) 여전히 `len(pins) == 1` 이라 통과한다 — "하나로 갈렸다" 만 보고 "그 하나가 안전한 하한인가" 는 안 본다. 이 pin 은 `requirements.txt`/`constraints.txt` 가 아니라 워크플로 YAML `run:` 안의 리터럴 문자열이라 `.github/dependabot.yml` 이 추적하는 두 생태계(`github-actions`, `npm`) 어디에도 안 걸리고, `scripts/check-override-floors.py` 의 침식 가드는 `pnpm-workspace.yaml` 의 `overrides` 만 본다(pip 무관). 즉 이 저장소에서 PyYAML 버전 하한을 지키는 자동화는 이 테스트 하나뿐이고, 그 테스트가 지키는 성질은 "합의" 이지 "안전한 하한 유지" 가 아니다. 테스트 자신의 docstring 도 "단일 진실화(`constraints.txt`)가 더 낫지만 범위 밖 — 최소한 갈렸다는 사실은 여기서 드러난다" 고 스스로 한계를 인정하고 있어, 새로 발견된 결함이라기보다 **의도적으로 남겨둔 갭**이지만 의존성 리뷰 관점에서는 여전히 유효한 노출이다.
  - 제안: 최소한의 보강으로 `pins` 의 유일 값에 대해 `>=6,<7` (또는 그 이상)인지 하한을 파싱해 `assertGreaterEqual` 하는 단언을 하나 추가하면, "셋이 같은 값으로 동시에 낮아지는" 경로도 막힌다. 근본 해결은 plan 에 이미 적힌 대로 `constraints.txt` 단일화(범위 밖으로 defer 된 상태 유지도 수용 가능하나, 그 경우 이 갭을 `plan/in-progress/harness-review-gate-ci-backstop.md` 후속 목록에 명시적으로 등재할 것을 권고).

- **[INFO]** PyYAML 재사용은 적절 — 신규 외부 의존 아님, 버전 고정·라이선스·안전 API 사용 모두 확인됨
  - 위치: `.github/workflows/harness-checks.yml:80-85` (`pip install "pyyaml>=6,<7"`), `.claude/tests/test_review_gate_ci.py:429-430` (`import yaml` 부재 시 `ImportError`로 클래스를 fail-closed 시키는 의도적 설계)
  - 상세: 이 PR 이 PyYAML 을 새로 도입하는 것이 아니라 2026-08-01 에 이미 예외로 허용된 의존을 `harness-checks.yml` 에 재사용(`deps-security-checks.yml` 과 동일 pin)한 것이다. `pyyaml>=6,<7` 은 주 버전 상한이 있는 합리적 고정이고, MIT 라이선스(로컬 확인: `pip show pyyaml` → `PyYAML 6.0.3`)라 프로젝트 라이선스(`LICENSE`, `LICENSE-COMMERCIAL.md`)와 충돌 소지가 없다. 파싱 코드 전부(`scripts/check-override-floors.py:129`, `test_review_gate_ci.py` 의 `WorkflowWiringTest.setUp` — `self._yaml.safe_load(...)`)가 `yaml.safe_load` 만 쓰고 `yaml.load`(임의 객체 역직렬화 RCE 벡터) 는 어디도 안 쓴다. 표준 라이브러리로 대체 불가한 이유(중복 키 검출 — stdlib 파서는 이를 지원하지 않음)도 `.claude/tests/README.md:59-71` 에 근거와 함께 기록돼 있다. 조치 불필요.

- **[INFO]** GitHub Actions 버전 — 신규 액션 없음, 기존 13개 워크플로와 완전히 동일한 pin
  - 위치: `.github/workflows/review-gate.yml:55-61` (`actions/checkout@v7`, `actions/setup-python@v7`)
  - 상세: 저장소 전체(`harness-checks.yml`, `e2e.yml`, `deps-security-checks.yml` 등 13개 워크플로) 를 grep 하면 `actions/checkout@v7` · `actions/setup-python@v7` · `actions/setup-node@v7` 로 전부 일치한다. `review-gate.yml` 은 이 관례를 그대로 따를 뿐 새 marketplace action 을 추가하지 않았고 버전 충돌도 없다. 다만 액션이 mutable 태그(`@v7`)로 고정돼 SHA pin 이 아닌 점은 저장소 전역 관례이며 이 PR 이 만든 것이 아니라 별도 범위. `pull_request` 트리거이고 `permissions: {contents: read}` 로 최소권한을 명시(다른 기존 워크플로 다수가 생략하고 있는 것을 이 신규 파일에서 명시적으로 넣음, `review-gate.yml:41-42`) — 오히려 개선.

- **[INFO]** 문서 주석 stale — 실제 pin(`@v7`)과 주석의 서술("v5/v6 line")이 어긋남 (이번 diff 대상 아님, pre-existing)
  - 위치: `.github/workflows/harness-checks.yml:74-76`
  - 상세: `# actions major policy consistent with the other workflows (v5/v6 line).` 주석 아래 실제 pin 은 `actions/setup-python@v7` 이다. `git log -S` 로 확인하면 이 주석은 `actions/setup-python` 이 6→7 로 bump 된 커밋(`#987`, `build actions/setup-python from 6 to 7`)보다 먼저 작성됐고, bump 이후 갱신되지 않았다. 이번 라운드(round 5)의 diff 에는 포함되지 않은 pre-existing 잔재이고 `harness-checks.yml` 자체의 이번 변경분(`git diff origin/main..HEAD`)은 paths 목록에 `scripts/check-review-gate.py` 한 줄을 더한 것과 docstring 주석 문구 조정뿐이라 이 결함을 만들거나 악화시키지 않았다. 다만 이 파일이 리뷰 번들에 포함돼 있어 명시: 향후 의존성 감사 시 주석만 보고 실제 pin major 를 오판할 수 있으므로, 다음에 이 파일을 건드릴 때 한 줄 정정을 권장(차단 사유 아님).

- **[INFO]** 내부 의존성 배선 — `scripts/check-review-gate.py` → `.claude/hooks/_lib/review_guard.py`(+ `branch_guard.py`) 결합이 트리거 경로에 명시적으로 반영됨
  - 위치: `.github/workflows/review-gate.yml:24-34`(`paths:`), `.github/workflows/harness-checks.yml:58-60`, `scripts/check-review-gate.py:51-74`(`_load_gate`)
  - 상세: 최상위 `scripts/` 유틸이 하네스 내부 디렉터리(`.claude/hooks/_lib`)의 구현을 직접 import 하는 구조는 통상적 레이어링과는 다르지만, 목적("판정자를 하나로 유지" — 로컬 훅과 CI 가 다른 판정 로직을 갖는 drift 를 `report_paths`/`retry_state` 로 이미 두 번 겪음)이 명시돼 있고 두 워크플로의 `paths:` 가 `review_guard.py`·`branch_guard.py`·`.claude/_shared/**`·`scripts/check-review-gate.py` 자신을 전부 등재해, 이 내부 의존 그래프 중 하나만 바뀌어도 대응 워크플로가 트리거되지 않는 사각(이 저장소가 같은 클래스로 6번 겪은 실패)을 닫았다. Import 표면은 `argparse`/`os`/`sys`/`review_guard` 로만 고정(`scripts/check-review-gate.py:51-53`, `_ALLOWED_IMPORTS`, `test_review_gate_ci.py:239`)돼 있어 숨은 신규 의존이 조용히 늘어나면 `OneJudgeTest` 가 걸린다. 결합 실패 시 방어(`_load_gate` 의 광범위 `except Exception`, `main()` 의 호출+속성접근 전체를 감싼 `try`)도 fail-open 으로 설계돼 있어, 이 내부 결합이 CI 를 새로 막는 장애점이 되지 않는다. 조치 불필요, 설계 의도대로 잘 봉쇄됨.

- **[INFO]** 공유 모듈 추출이 만든 신규 내부 의존(`_lib/failopen_state.py`)에 대한 결손 시나리오가 테스트로 고정됨
  - 위치: `.claude/tests/test_stop_guard_failopen.py:231-240`(`test_missing_shared_module_costs_the_counter_not_the_signal`)
  - 상세: push/stop 두 훅이 공유하는 fail-open 리포팅 로직이 `_lib/failopen_state.py` 로 추출되며 두 훅 모두에 새 내부 의존이 생겼다. 이 테스트는 그 모듈이 사라져도(`unlink()`) 훅이 exit 0 을 유지하면서 stderr 로 fail-open 을 알리되, 카운터(state 파일)만 못 쓰는 것으로 성질을 낮춘다 — "신호는 반드시 살아남고, 카운팅만 대가를 치른다" 는 원칙이 정확히 검증된다. 내부 모듈 추출 시 갖춰야 할 회귀 방어의 좋은 예시로, 이번 diff 의존성 관점에서 문제 없음.

- **[INFO]** 이번 라운드(round 5)의 실제 diff 에는 있지만 이 리뷰 번들에는 없는 파일 1개
  - 위치: `.claude/tests/test_workflow_yaml_structure.py` (현재 워킹트리에 uncommitted, `git diff origin/main..HEAD --stat` 기준 +60줄)
  - 상세: `_MAY_SWALLOW`/`test_no_guard_workflow_swallows_its_own_failure` 로 `continue-on-error` 체크를 `review-gate.yml` 하나에서 전체 워크플로로 일반화하는 변경인데, 이 dependency 프롬프트가 전달한 8개 파일 목록(README.md·test_block_integrity.py·test_review_gate_ci.py·test_stop_guard_failopen.py·harness-checks.yml·review-gate.yml·plan 문서·check-review-gate.py)에는 포함돼 있지 않다. 직접 열어 확인한 결과 이 파일은 기존에 이미 승인된 `import yaml`(파일 상단, 이번 변경 이전부터 존재) 외에 신규 의존을 추가하지 않으므로 본 리뷰의 의존성 판정에는 영향이 없다. 다만 오케스트레이터의 번들 완결성 관점에서 참고용으로 기록한다(다른 리뷰 관점의 결론에는 영향을 줄 수 있음).

## 요약

이번 라운드는 새 외부 패키지를 추가하지 않는다 — PyYAML 은 2026-08-01 에 이미 승인된 유일한 예외를 `harness-checks.yml` 에 재사용한 것뿐이고, 버전은 세 워크플로에서 동일하게 `pyyaml>=6,<7` 로 고정돼 있으며 MIT 라이선스로 충돌이 없고, 파싱은 전부 `yaml.safe_load` 만 사용해 알려진 취약점 벡터(임의 객체 역직렬화)를 피한다. GitHub Actions pin(`actions/checkout@v7`, `actions/setup-python@v7`)도 저장소 전역 관례와 완전히 일치해 신규 액션·버전 충돌이 없다. `scripts/check-review-gate.py` 가 하네스 내부 모듈(`review_guard.py`)에 직접 결합하는 구조는 이례적이지만 "판정자 하나" 라는 명시적 설계 목표에 따른 것으로, import/호출 표면이 허용목록으로 좁혀져 있고 두 워크플로의 `paths:` 가 그 결합 그래프 전체를 커버하며 fail-open 으로 봉쇄돼 있어 리스크가 낮다. 유일하게 실질적인 갭은 신규 `PyYamlPinsAgreeTest` 가 "세 지점의 버전 합의" 만 검증하고 "그 합의된 값이 안전한 하한인가" 는 검증하지 않는다는 점 — pip install 리터럴이라 Dependabot·override-floor 가드 어디에도 걸리지 않으므로, 셋을 동시에 낮추는 경로는 여전히 조용히 통과한다(테스트 자신도 이를 알고 "최소한 갈렸다는 사실만 드러낸다" 고 적어 스스로 한계를 인정). 이 외에는 pre-existing 하고 이번 diff 대상이 아닌 사소한 주석 stale(v5/v6 언급) 정도만 보인다.

## 위험도

LOW
