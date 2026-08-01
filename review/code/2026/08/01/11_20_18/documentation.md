# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** README·워크플로 상단 주석이 PyYAML 예외 소비자를 "둘"로 못박아 이제 stale
  - 위치: `.claude/tests/README.md:19-27` (특히 22줄 "Both guard YAML the repo depends on"), `.github/workflows/harness-checks.yml:1-5`
  - 상세: 두 곳 모두 PyYAML 예외의 소비자를 `test_override_floors.py`·`test_workflow_yaml_structure.py` **정확히 둘**로 서술한다("Both guard YAML..."). 그러나 이번 변경으로 추가된 `test_review_gate_ci.py`의 `WorkflowWiringTest`도 `import yaml`로 `.github/workflows/review-gate.yml`을 구조 파싱한다 — 실측: `grep -rln "import yaml" .claude/tests/*.py` → `test_review_gate_ci.py`, `test_workflow_yaml_structure.py` 2개 파일 히트(2번째는 별개 파일). 세 번째 소비자가 생겼는데 "Both"라는 배타적 서술은 갱신되지 않았다. 같은 README 파일 안에서도 44줄의 카탈로그 행("The workflow half is parsed with PyYAML **structurally**")은 이 사실을 이미 언급하고 있어, 상단 요약 문단과 하단 카탈로그 행이 서로 어긋난다.
  - 제안: README 19-27줄과 harness-checks.yml 1-5줄을 "두 파일"→"세 파일"로 갱신하거나, 파일을 나열하는 대신 "이 예외를 쓰는 파일들"처럼 개수에 의존하지 않는 서술로 바꾼다.

- **[WARNING]** 신설 테스트 docstring의 하드코딩된 테스트 개수가 같은 커밋 안에서 이미 틀렸다
  - 위치: `.claude/tests/test_review_gate_ci.py` — `test_the_default_root_resolves_to_this_repository`의 docstring (해당 메서드 내부, 파일 내 "13개 테스트가 전부 `--root <tempdir>` 를 명시로 넘겨서" 문장)
  - 상세: 이 메서드와 docstring은 커밋 `fb463845d`("CI 백스톱 1R 리뷰 반영")에서 신설됐다. 그런데 **같은 커밋의 커밋 메시지**는 정확히 같은 사실을 "15개 테스트가 전부 `--root <tempdir>` 를 명시로 넘겨서"라고 적어, 커밋 메시지와 코드에 박힌 문서 문자열이 서로 다른 숫자를 말한다. 실측: `git show fb463845d:.claude/tests/test_review_gate_ci.py | grep -c "^    def test_"` → **15** (자기 자신 포함). 자기 자신을 빼면 14, `ReviewGateCliTest`만 세면 8 — 어느 쪽으로도 "13"은 안 나온다. `git log -p -S"13개 테스트"`로 도입 이력을 추적하면 이 숫자는 이 커밋에서 **신규 작성**된 것이지 이전 값이 남은 게 아니다 — 즉 "리뷰 발견을 고치며 새로 쓴 설명"이 그 자리에서 바로 틀렸다. `test_router_safety_policy_doc.py`가 겪은 것과 같은 클래스(문서 안 하드코딩된 개수가 코드 변경과 함께 드리프트)가 이번엔 **작성 시점부터** 발생한 사례다.
  - 제안: 숫자를 세지 않는 서술("이 파일의 다른 모든 테스트")로 바꾸거나, 최소한 커밋 메시지와 동일한 수치로 정정한다. (참고: 본 리뷰 세션 진행 중 워크트리에서 이 문장이 "형제 테스트가 전부…"로 고쳐진 상태를 순간적으로 관측했다 — 정확히 이 방향의 수정이나, 커밋되지 않은 상태였고 본 보고서 작성 시점엔 다시 원문("13개 테스트")으로 남아 있다. 아래 "부기" 참조.)

- **[INFO]** 새 CI 백스톱 계층이 리뷰-게이트 아키텍처 인벤토리 문서에 반영되지 않음
  - 위치: `.claude/docs/orchestrator-workflow-migration.md:219-231` (review payload 6개 파일 밖이지만 Read로 직접 확인)
  - 상세: 이 문서의 "Teeth (remedy 4)" 절은 리뷰 커버리지 게이트를 구성하는 컴포넌트를 `review_guard.py` / `guard_review_before_push.py` / `guard_review_before_stop.py` / `test_review_guard.py`로 명시 나열한다. 이번 변경은 같은 아키텍처에 훅-독립 네 번째 층(`review-gate.yml` + `check-review-gate.py` + `test_review_gate_ci.py`)을 추가하는데, 이 인벤토리 문서는 갱신되지 않았다 — plan 문서(`plan/in-progress/harness-review-gate-ci-backstop.md`)의 Overview는 이 CI 계층을 "그 근본 수정이 닫지 못하는 층"으로 명시적으로 이 아키텍처의 연장으로 프레이밍하고 있어, 이 문서가 "review-gate 방어의 전체 목록"으로 읽히는 한 지금은 불완전하다.
  - 제안: `orchestrator-workflow-migration.md`의 Teeth 목록에 `review-gate.yml`/`check-review-gate.py` 항목을 추가(선택 사항 — 강제는 아니나 아키텍처 문서의 완전성을 위해 권장).

- **[INFO]** CHANGELOG.md 미갱신은 정합 — 컨벤션 확인
  - 상세: `CHANGELOG.md`(643줄)를 훑어본 결과 모든 항목이 `codebase/`+`spec/` 참조 제품 변경이고, 하네스 전용 변경(`review_guard`, push gate 등)은 과거에도 CHANGELOG에 실린 적이 없다. 이번 변경(`.claude/`+`.github/workflows/`+`scripts/`)도 같은 범주라 CHANGELOG 갱신 누락은 컨벤션 위반이 아니다 — 발견사항 아님, 확인 차 기재.

- **[INFO]** 수치 상호일관성 확인(양호) — 착수 전 실측치가 4개 문서에서 동일
  - 상세: "435건 중 80건(18%)", "dependabot 11/80", "2026-08 9건 중 8건"이 `scripts/check-review-gate.py` docstring, `.github/workflows/review-gate.yml` 주석(잡 조건 및 헤더), `plan/in-progress/harness-review-gate-ci-backstop.md`, `.claude/tests/README.md` 네 곳에서 모두 동일하게 인용된다 — 크로스체크 결과 드리프트 없음. (참고용 — 시간이 지나면 이 수치들은 자연히 stale해지나, 전부 "실측"으로 명시돼 시점 고정 값임이 이미 표시돼 있어 별도 조치 불필요.)

## 부기 — 측정 중 발견한 프로세스 관측 (문서화 범위 밖이나 보고 의무)

라운드2 지시("가드마다 그 성질이 거짓인 채로 통과하려면 무엇이 필요한지 실제로 시도하라")에 따라 `review-gate.yml`·`check-review-gate.py`·`harness-checks.yml`에 대해 백업→변이→테스트→복구 사이클을 3회 수행했다(`if:` 삭제 후 `env:`에 같은 문자열 남기기, `run:`을 `true`로 치환, `harness-checks.yml`의 `scripts/check-review-gate.py` 항목 제거). 세 경우 모두 해당 가드/테스트가 **정확히 회귀를 잡았다**(구조 파싱이 substring을 이겼고, paths-coverage 가드가 누락을 잡았다) — 이 부분은 문서(README·docstring)가 주장하는 성질과 실측이 일치한다.

그런데 이 과정에서 **내가 작성하지 않은** 변이가 파일에 나타난 것을 관측했다: 복구 직후 `git diff --stat`이 곧바로 `.github/workflows/review-gate.yml`에서 `env: GATE_FLAG: --enforce` / `run: true $GATE_FLAG` 변경을, 이어서 `scripts/check-review-gate.py`에서 "second judge"(os.path.getmtime 기반 재판정 시도) 삽입을 보였다 — 둘 다 내 스크립트가 만든 텍스트와 다르다. 이 worktree(`review/code/2026/08/01/11_20_18/`)에는 이미 architecture/database/performance/requirement/scope/security/side_effect 리포트가 함께 존재해, 같은 세션의 다른 reviewer sub-agent가 같은 종류의(가드 무력화 시도) 실측을 **같은 비격리 worktree**에서 동시에 수행 중이었을 가능성이 높다. 두 파일은 세션 시작 시점엔 클린했음을 확인했고, 지금은 `git checkout -- .github/workflows/review-gate.yml scripts/check-review-gate.py`로 HEAD 상태로 복구해 뒀다. `.claude/tests/test_review_gate_ci.py`는 내가 직접 편집한 적이 없어 손대지 않았다(세션 시작 시점부터 있던 `self.gate_module` 리팩터 diff 외에, 위에서 언급한 "13개 테스트"→"형제 테스트" 변경이 세션 도중 추가로 나타났다 — 다른 프로세스의 것으로 보여 되돌리지 않았다).

이것은 코드 문서화 결함이 아니라 **리뷰 인프라 관측**이다: 코드 리뷰어의 쓰기 권한은 `review/code/**`로 제한돼 있는데(CLAUDE.md), Bash를 통한 임시 변이 실험이 공유 worktree의 추적 파일에 실제로 쓰기를 남길 수 있고, 동시에 도는 다른 reviewer의 변이와 충돌할 수 있음을 실측으로 확인했다. 문서 리뷰 범위 밖이라 별도 심각도를 매기지 않지만, 실행한 것을 그대로 보고한다.

## 요약

리뷰 대상 6개 파일(README 카탈로그, 신규 CI 백스톱 테스트, 신규 워크플로 2개, plan 문서, 게이트 스크립트)은 문서화 수준이 전반적으로 높다 — docstring·YAML 주석·plan 문서가 "왜"를 촘촘히 남기고, 핵심 수치(435건 중 80건 등)는 네 문서에 걸쳐 정확히 일치한다(실측 확인). 다만 두 군데에서 자기 서술의 정확성이 이미 깨져 있다: (1) PyYAML 예외 소비자를 "둘"로 못박은 문구가 이번 변경으로 생긴 세 번째 소비자(`test_review_gate_ci.py`)를 반영하지 못했고, (2) 신설 테스트 docstring의 "13개 테스트"라는 하드코딩된 개수가 **같은 커밋**의 커밋 메시지가 말하는 "15개"와 다르며 실측 결과 어느 쪽 셈법으로도 13이 나오지 않는다 — 리뷰 발견을 문서화하는 과정에서 새로 쓴 문장이 작성 즉시 stale해진 사례다. 추가로 인접 아키텍처 문서(`orchestrator-workflow-migration.md`)가 새 CI 계층을 아직 인벤토리에 담지 않아 완전성이 떨어진다. CHANGELOG 미갱신은 이 저장소의 기존 컨벤션(하네스 전용 변경은 CHANGELOG 비대상)과 일치해 결함이 아니다. 코드/가드 자체의 정확성(3개 실측 회귀 테스트)은 문서가 주장하는 대로 동작했다.

## 위험도

LOW
