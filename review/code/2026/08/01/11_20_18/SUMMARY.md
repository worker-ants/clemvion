# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 이 PR(리뷰 게이트 CI 백스톱, round 2)의 실질 산출물은 코드 자체보다 **그 코드가 지키려는 불변식을 검증하는 테스트**이다. 5개 리뷰어(architecture/requirement/side_effect/maintainability/testing)가 각자 독립적으로 **실제 뮤테이션을 실행**해, 이 PR이 존재하는 이유인 "판정자는 하나다"(`OneJudgeTest`)와 "여전히 관측 모드다"(`test_it_is_still_observation_only`) 두 핵심 가드가 이미 3~4회 재작성된 것과 같은 클래스로 다시 뚫림을 재현했다. **오늘 당장 활성 결함은 아니다** — `scripts/check-review-gate.py`/`review-gate.yml` 본체는 이 우회 형태를 쓰지 않고, fail-open·관측 전용 설계가 실피해 반경을 제한한다. 그러나 이 가드들이 지키는 불변식이 이번 라운드에도 다시 새면 다음 우회가 조용히 미끄러질 방어선이 취약하다는 뜻이라 우선순위를 높게 잡는다.

**참고(risk 판정에 영향 없음, 세션 위생 관측)**: security/performance/architecture/requirement/scope/documentation 6개 리뷰어가 독립적으로, 리뷰 도중 **같은 공유 워크트리**에서 `scripts/check-review-gate.py`/`review-gate.yml`이 커밋되지 않은 상태로 실시간으로 변형됐다가 원복되는 것을 관측했다(다른 리뷰어/뮤테이션 세션이 동시에 같은 파일을 만지는 것으로 추정). 전원 `git diff`/`git status`로 이 changeset의 결함이 아님을 확인했고, documentation 리뷰어는 관측한 잔여 변형을 `git checkout --`로 직접 원복까지 했다. 코드 결함은 아니나, 향후 뮤테이션 기반 검증은 별도 워크트리/워커로 격리할 것을 권고(architecture 제안).

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | TESTING | `OneJudgeTest`("판정자는 하나다") 금지-호출 탐지가 **호출 표현식의 형태**만 인식(`ast.Name` 또는 `ast.Attribute(value=ast.Name)` 1단)해, ① 2단 속성 체인(`os.path.isdir`/`os.path.getmtime`), ② 지역 변수 별칭(`walk = os.walk`), ③ `getattr(os,'walk')(...)` 간접 호출, ④ `__import__('os').walk(...)`/`subprocess = __import__('subprocess')` 동적 임포트, ⑤ `os.popen`/`os.system`(애초에 금지목록 4개에 미포함) 를 전부 놓친다. import는 허용목록으로 막혀 있으나 **호출 축은 여전히 금지목록**이라 "판정자가 스크립트 안에 재구현되지 않는다"는 이 파일의 존재 이유가 부분적으로만 강제된다. architecture/requirement/side_effect/maintainability/testing 5개 리뷰어가 각자 실제 AST/테스트 클래스를 로드해 실행 재현(`OK`/통과 확인), security/performance/dependency는 같은 갭을 WARNING/MEDIUM으로 별도 보고. 이미 3회 재작성된(전문 grep→문구검사→연산 금지목록) 실패 클래스의 4번째 재발. | `.claude/tests/test_review_gate_ci.py:224`(`_ALLOWED_IMPORTS`), `:268-283`(banned-call 대조, 특히 `276`행 `isinstance(f, ast.Attribute) and isinstance(f.value, ast.Name)`) | 호출 탐지를 "금지목록"에서 "허용목록"으로 대칭 전환(import 축과 동일 원칙) — 스크립트가 실제로 호출하는 이름 전체(`review_guard.evaluate_review`, `os.path.join/dirname/abspath`, `sys.path.insert`, `print` 등)만 화이트리스트로 못박고 그 밖 전부 거부. 또는 `ast.Call`의 `func`가 인식 가능한 두 형태(Name/Attribute(Name)) 중 하나가 아니면 그 자체를 즉시 실패시킨다. 근본적으로는 정적 AST 검사 대신 `unittest.mock.patch`로 `os.walk`/`os.scandir`/`os.listdir`/`open`/`os.popen` 등을 실제 spy로 감싸 "한 번도 안 불렸다"를 단언하는 행위 기반(behavioral) 검증으로 전환 검토(architecture 제안). |
| 2 | TESTING | `test_it_is_still_observation_only`가 `run:` 필드의 리터럴 문자열만 검사(`assertNotIn("--enforce", cmd)`)해, `--enforce`를 `env:` 변수로 옮기고 `run:`에서 `$GATE_FLAG`로 참조하면 GitHub Actions 런타임에서는 실제로 하드 차단(enforce)으로 전환되는데도 이 회귀 테스트는 계속 "관측 모드 그대로"라고 통과시킨다. 라운드 1이 이미 고친 것(`if:`→`env:` 우회)과 **정확히 동일한 클래스**가 같은 파일의 다른 테스트에서 재발 — 대조되는 `test_the_job_condition_exempts_dependabot`은 이미 이 클래스를 정확히 막도록 고쳐져 있어 비대칭이 뚜렷하다. requirement/testing 2개 리뷰어가 실제 워크플로 파일을 백업→변조→테스트 실행→원복으로 직접 재현(둘 다 `OK`로 통과 확인), architecture(저확신·미실행 이론)와 dependency(WARNING)도 같은 갭 보고. | `.claude/tests/test_review_gate_ci.py:368-374`(`self.assertNotIn("--enforce", cmd)`) | `job["steps"]`의 `env:` 값까지 함께 스캔하거나, `run:` 문자열에 `${{`/`$`로 시작하는 미해석 참조가 있으면 그 자체를 실패시켜 "리터럴이 아닌 값으로 플래그를 조립하는 것" 자체를 금지. `test_the_job_condition_exempts_dependabot`이 이미 채택한 "값이 아니라 그 필드 자체가 셸 치환을 거치는지"를 판단 기준으로 이식. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | TESTING | `WorkflowWiringTest.test_a_step_actually_runs_the_script`가 "구조로 판정한다"고 주장하지만 `run:` 값이 여러 줄 셸 스크립트일 때 그 **본문 텍스트**(주석 줄 포함)에 대해서는 여전히 substring 검사라, 스크립트를 실행하지 않고 주석에만 경로를 언급하는 decoy step도 통과시킨다(실제 재현: `run: |\n  # NOTE: ... 비활성화\n  echo "temporarily disabled"` → `OK`). | `.claude/tests/test_review_gate_ci.py:325-333` | `run:` 값에서 `#`로 시작하는 줄(따옴표 밖)을 제거한 뒤 검사하거나, 각 줄을 개별 처리해 "주석이 아닌 줄에 명령으로 나타나는지"를 확인. `shlex` 파싱 재사용 가능(`test_e2e_exemption_paths_sync.py` 류가 유사 패턴 보유). |
| 2 | TESTING | `test_the_job_condition_exempts_dependabot`가 `"dependabot[bot]" in cond`와 `"!=" in cond`를 **독립적으로** 검사해, 두 서브스트링이 실제로 하나의 비교식으로 결합돼 있는지 확인하지 않는다 — `cond = "(github.actor == 'dependabot[bot]') != false"`(의미상 정반대: 봇일 때만 실행) 도 두 assertIn 모두 통과함을 실행으로 확인. | `.claude/tests/test_review_gate_ci.py:334-340` | 정규식 1개(`actor\s*!=\s*['\"]dependabot\[bot\]['\"]`)로 두 피연산자 사이의 부정 비교임을 직접 확인하거나 알려진 정상 형태와 정확 일치 대조. |
| 3 | TESTING | `test_it_is_still_observation_only`가 `argparse`의 기본 `allow_abbrev=True`로 인한 플래그 축약 매칭(`--enf`가 `--enforce`의 유일한 접두 일치)을 고려하지 않는다 — `run:`이 미래에 `--enf`로 축약되면 실제로는 enforce 모드인데 이 테스트는 리터럴 `"--enforce"` 부재만 보고 계속 관측 모드라고 보고한다(실행으로 재현: `ap.parse_args(["--enf"]).enforce == True`). | `scripts/check-review-gate.py:79`(플래그 정의), `.claude/tests/test_review_gate_ci.py:367-374` | `argparse.ArgumentParser(..., allow_abbrev=False)` 추가(가장 저렴), 또는 테스트 쪽에서 `shlex.split(cmd)` 토큰화 후 `--enforce`로 시작하는 토큰 부재를 확인. |
| 4 | REQUIREMENT | `scripts/check-review-gate.py`의 fail-open 보장이 `evaluate(root)` **호출**만 감싸고, 반환값에 대한 이후 속성 접근(`decision.blocked`)은 try 밖에 있다 — `evaluate_review`가 예외 없이 형태가 다른 값(`None` 등)을 반환하면 처리되지 않은 예외로 exit 1(재현: 스텁 `review_guard.py`로 `AttributeError` 확인). 오늘 `review_guard.evaluate_review`는 항상 정상 형태를 반환하므로 활성 결함 아님, 다만 이 계약을 지키는 테스트가 없다. | `scripts/check-review-gate.py:89-100` | `try` 블록을 `decision.blocked`/`getattr(decision, "notes", ())` 접근까지 확장하거나 `hasattr` 가드 추가. "예외 없이 형태만 깨진 반환값" 케이스를 회귀 테스트로 고정. |
| 5 | TESTING | `test_review_gate_ci.py`가 명시적으로 근거로 삼는 교차 파일 안전망(`test_block_integrity.py`의 `PlanStubsMirrorTheRealInterfaceTest.test_every_plan_stub_defines_push_blocks`)이 **파일 단위 집계**(모든 stub 리터럴을 join 후 `push_blocks` 포함 여부 확인)라서, 한 파일에 stub이 둘 이상 있을 때 하나가 `push_blocks`를 잃어도 다른 하나가 갖고 있으면 통과한다(실측 확인 — `_R` stub에서 `push_blocks` 제거해도 여전히 `OK`). 오늘 당장 위험은 없음(스크립트가 `push_blocks`를 읽지 않음). | `.claude/tests/test_block_integrity.py:653-689`, `.claude/tests/test_review_gate_ci.py:174,191` | `stubs` 수집을 파일 전체 join이 아니라 stub 리터럴(개별 `ast.Constant` 문자열) 단위로 바꿔 개별 검사. |
| 6 | DOCUMENTATION | `.claude/tests/README.md`(19-27줄)와 `.github/workflows/harness-checks.yml`(1-5줄) 상단 주석이 PyYAML 예외 소비자를 "둘"(`test_override_floors.py`, `test_workflow_yaml_structure.py`)로 못박아, 이번 변경으로 `import yaml`을 쓰는 세 번째 소비자(`test_review_gate_ci.py`의 `WorkflowWiringTest`)가 생겼는데도 갱신되지 않았다(같은 README 44줄 카탈로그 행은 이미 이 사실을 언급해 상단-하단이 서로 어긋남). | `.claude/tests/README.md:19-27,44`, `.github/workflows/harness-checks.yml:1-5` | "두 파일"→"세 파일"로 갱신하거나 개수에 의존하지 않는 서술로 변경. |
| 7 | DOCUMENTATION | 신설 테스트(`test_the_default_root_resolves_to_this_repository`) docstring의 "13개 테스트가 전부 `--root <tempdir>`를 명시로 넘겨서"라는 하드코딩된 개수가, **같은 커밋**(`fb463845d`)의 커밋 메시지가 말하는 "15개"와도 다르고, 실측(`git show`로 `def test_` 카운트) 결과 자기 자신 포함 15, 제외 14, `ReviewGateCliTest`만 8 — 어느 셈법으로도 "13"이 안 나온다. 문서 작성 시점에 즉시 stale해진 사례. | `.claude/tests/test_review_gate_ci.py`(해당 docstring) | 개수를 세지 않는 서술("이 파일의 다른 모든 테스트")로 변경하거나 커밋 메시지와 동일한 정확한 수치로 정정. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SECURITY | `harness-checks.yml`이 임의 PR 제공 Python/Node 테스트를 실행하면서 top-level `permissions:`를 선언하지 않음(신규 `review-gate.yml`은 명시함) — 저장소 전반 8개 워크플로가 같은 관행이라 이번 PR만의 문제는 아니나 최소권한 원칙상 정리 가치 있음. | `.github/workflows/harness-checks.yml` 전체 | `permissions: contents: read` 추가. |
| 2 | SECURITY | `check-review-gate.py`의 fail-open 예외 처리가 `{type(exc).__name__}: {exc}`를 stderr에 그대로 출력 — 내부 경로 노출 가능하나 자격증명 등 민감정보는 아니며 fail-open 진단성 의도로 합리적 절충 판단, 조치 불요. | `scripts/check-review-gate.py:68-74,89-94` | 조치 불요(기록용). |
| 3 | SECURITY | `${{ github.base_ref }}` → `env.BASE_REF` 간접화(GH Actions expression-injection 방어)를 지키는 회귀 테스트가 없음 — `base_ref`는 실질 공격자 통제가 어려워(git ref 형식 제약 실측 확인) 현재 위험 낮음. | `.github/workflows/review-gate.yml:67-70` | `WorkflowWiringTest`에 "Fetch base ref" 스텝 `run:`이 `${{`를 포함하지 않는지 단언하는 케이스 추가. |
| 4 | SECURITY | GitHub Actions를 가변 메이저 태그(`@v7`)로 참조 — 공급망 리스크 낮음, 저장소 기존 관행과 일치. | 워크플로 전체 | 방어심화 참고 사항. |
| 5 | PERFORMANCE | `ReviewGateCliTest`의 `setUp`이 테스트 메서드마다 `.claude/hooks`+`.claude/_shared` 전체를 tempdir로 복사 + git init 서브프로세스 재생성(실측: 15개/2.4s, 스위트 전체 827개/125s). | `.claude/tests/test_review_gate_ci.py:40,46-49,78-86` | `setUpClass`로 승격해 1회만 생성, 모듈을 덮어쓰는 2개 테스트만 별도 격리. |
| 6 | PERFORMANCE | `WorkflowWiringTest`가 바뀌지 않는 정적 YAML을 테스트 메서드마다 재파싱(5회). | `.claude/tests/test_review_gate_ci.py:317-323` | 파싱을 `setUpClass`로 승격. |
| 7 | PERFORMANCE | `fetch-depth: 0` 체크아웃 직후의 명시적 `git fetch`가 중복 네트워크 I/O일 가능성(CI 환경에서만 확정 가능, 저장소 크기 작아 절대 비용 낮음). | `.github/workflows/review-gate.yml:55-57,67-70` | 다음 CI 실행에서 `git rev-parse origin/$BASE_REF` 선행 성공 여부 로그 확인 후 중복이면 제거 검토. |
| 8 | PERFORMANCE | 하네스 스위트 누적 실행시간(로컬 실측 827개/125.3s) 대비 `timeout-minutes: 5` 여유폭이 CI 실측 없이 로컬 수치만으로는 단정 불가, 스위트가 계속 커지는 추세. | `.github/workflows/harness-checks.yml:70,87-88` | 이번 및 향후 CI 실행 wall-clock 관찰, 여유 감소 시 무거운 서브프로세스 테스트 별도 job 분리 검토. |
| 9 | ARCHITECTURE | 기본 브랜치 해석 로직이 4곳(`branch_guard`, `review_guard`, `code_review_orchestrator`, consistency orchestrator)에 독립 구현 — 이미 추적·defer 확정, 이번 PR이 결합을 악화시키지 않음. | `.github/workflows/review-gate.yml:28-31`, plan 문서 "후속(defer)" 절 | 추가 조치 불요(이미 문서화·추적됨), 5번째 소비자 생기기 전 통합 우선순위 재확인. |
| 10 | ARCHITECTURE | `_load_gate()`가 `sys.path.insert(0, lib)`로 전역 가변 상태 수정 — 저장소 전반 기존 패턴(`_lib` 네임스페이스 충돌 회피), 단발 CLI 프로세스라 실질 위험 낮음. | `scripts/check-review-gate.py:63-67` | 현행 유지 가능, `_lib` 통합 시 자연 해소. |
| 11 | REQUIREMENT | 관련 spec 문서 없음 — 이 변경은 harness/CI 도구 계층으로 spec/ 밖이 정상 컨벤션, 단일 진실은 plan 문서. | `spec/` 전체 grep 결과 매치 없음 | 조치 불요(정상). |
| 12 | MAINTAINABILITY | `OneJudgeTest.test_the_script_performs_no_judgement_operations_of_its_own` 하나가 3가지 성질(import 허용목록/금지 호출 부재/`evaluate_review` 실사용)을 63줄 한 메서드에 몰아넣어 자매 파일(`test_harness_checks_paths_coverage.py`) 컨벤션(성질당 작은 메서드 1개)과 스타일이 다름 — 앞쪽 assert 실패 시 나머지 성질은 그 실행에서 미검사. | `.claude/tests/test_review_gate_ci.py:225-287` | 3개 메서드로 분리(`test_imports_are_allowlisted`/`test_no_indirect_filesystem_walk`/`test_gate_function_is_actually_imported`). |
| 13 | MAINTAINABILITY | "435건 중 80건(18%)" 등 실측치가 4개 파일(README/plan/워크플로/스크립트)에 산문으로 중복 기재 — SoT 없음, `router_safety.py` 확장자 개수 stale 사례와 동일 drift 클래스이나 일회성 결정 근거이지 불변식은 아님. | `.claude/tests/README.md:44`, plan 문서 다수 행, `review-gate.yml:16,49`, `check-review-gate.py:33` | 즉시 조치 불요, 하나를 정본으로 표시하고 나머지는 참조만 하도록 정리 권장. |
| 14 | MAINTAINABILITY | 리터럴 중복 2건 — 가짜 세션 경로 문자열(2곳), `timeout=120`(2곳, 스위트 관행은 `timeout=30`). | `.claude/tests/test_review_gate_ci.py:116,135` / `:84,153` | 클래스 레벨 상수로 추출. |
| 15 | MAINTAINABILITY | `argparse.ArgumentParser()` 결과 변수명이 이 파일만 `ap`, 나머지 `scripts/check-*.py` 3개는 `parser`. | `scripts/check-review-gate.py:78` | `parser`로 통일(동작 영향 없음). |
| 16 | DOCUMENTATION | 인접 아키텍처 문서(`.claude/docs/orchestrator-workflow-migration.md` "Teeth" 절)가 리뷰 커버리지 게이트 컴포넌트 인벤토리에 이번 신규 CI 계층(`review-gate.yml`+`check-review-gate.py`+테스트)을 아직 반영하지 않음. | `.claude/docs/orchestrator-workflow-migration.md:219-231` | 인벤토리에 항목 추가(선택 사항, 완전성 위해 권장). |
| 17 | CONCURRENCY | `review-gate.yml`의 `concurrency:`(그룹 키+`cancel-in-progress`) 블록을 고정하는 회귀 테스트가 이번 라운드에도 추가되지 않음 — 실패 모드는 정확성 문제가 아니라 러너 큐 낭비뿐이라 심각도 낮음(1R부터 이어진 항목). | `.github/workflows/review-gate.yml:36-38` | 낮은 우선순위, `WorkflowWiringTest`에 `assertIn("cancel-in-progress: true", self.text)` 한 줄로 고정 가능. |
| 18 | SCOPE | 작업 트리에 미커밋 로컬 수정 1건(docstring 일반화 "13개 테스트"→"형제 테스트", 경로 리터럴을 `self.gate_module` 재사용으로 교체) — 스코프 내이나 push 전 커밋 필요. | `.claude/tests/test_review_gate_ci.py`(148행·176행 부근) | push 전에 커밋해 반영. |

## 확인된 정상 동작 (문제 없음)

- 1R이 지적한 두 우회(`if:`를 지우고 `env:`에 문자열 남기기, `run:`을 `true`로 치환)는 이번 라운드에서 **정확히 잡힘**을 다수 리뷰어(scope/testing/security/requirement 등)가 라이브 상태 및 격리 재현 양쪽으로 확인.
- `OneJudgeTest`의 두 역사적 우회(`pathlib.Path(...).rglob`, `from os import walk as _w`)도 여전히 FAIL(정상) — 3번째 형태(동적 디스패치)만 뚫림.
- 1R WARNING이던 `branch_guard.py` trigger-path 누락, `.claude/hooks` 불필요 `sys.path` 추가는 이번 diff에서 해소 확인(dependency).
- 1R WARNING이던 `in_flight_ok` opt-in 회귀 무방비는 `test_an_unfinished_review_session_does_not_open_the_gate` 신설로 실제 해소 — mutate-and-revert로 직접 재현 확인(concurrency).
- `test_checkout_fetches_full_history`, `test_trigger_paths_cover_the_logic_it_depends_on`, `test_the_default_root_resolves_to_this_repository`는 진짜 구조적 검사로 확인(architecture/testing).
- 커스텀 YAML `_Loader`는 `yaml.SafeLoader` 상속(안전), dependabot 면제는 `github.actor` 기반이라 스푸핑 불가, secrets 미참조 + `pull_request`(not `pull_request_target`) 트리거 확인(security).
- 새 서드파티 의존성 없음 — PyYAML 설치 스텝은 merge-base(origin/main)에 이미 존재, 핀/로더 안전 확인(dependency).
- CHANGELOG 미갱신은 컨벤션과 일치(하네스 전용 변경은 기존에도 비대상), 실측치("435건 중 80건" 등)는 4개 문서 간 상호 일관성 확인(documentation).
- diff는 origin/main 대비 정확히 6개 파일로 좁혀져 있고 프롬프트에 섞여 보이는 PyYAML/override-floors 서술은 이 브랜치 산출물이 아니라 기존 origin/main 내용임을 확인(scope).
- 데이터베이스 표면(database), API 엔드포인트/스키마 표면(api_contract), 유저 가이드 동반 갱신 trigger(user_guide_sync) 전부 해당 없음.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | OneJudgeTest 2단 속성체인 갭(WARNING) + permissions:/base_ref 회귀테스트 부재 등 INFO 다수, 활성 취약점 없음 |
| performance | LOW | CRITICAL/HIGH급 성능 결함 없음, setUp 픽스처/YAML 재파싱 등 미시 비효율(INFO), 부가로 OneJudgeTest 갭 실측(WARNING) |
| architecture | HIGH | OneJudgeTest getattr/alias 우회 CRITICAL(실제 mutation 재현), WorkflowWiringTest substring 잔존 2건(WARNING) |
| requirement | HIGH | test_it_is_still_observation_only env: 우회 CRITICAL, OneJudgeTest 2단 속성체인 CRITICAL, fail-open 속성접근 미보호(WARNING) |
| scope | NONE | diff 정확히 6개 파일, 부가발견 전부 명시적 defer, 미커밋 로컬 정리 커밋 필요(INFO) |
| side_effect | HIGH | OneJudgeTest __import__ 동적 임포트 CRITICAL, os.popen 미포함(WARNING), run: 주석 위장(WARNING) |
| maintainability | HIGH | OneJudgeTest 지역변수 별칭 CRITICAL, dependabot 조건 역전(WARNING), argparse 약어매칭(WARNING) |
| testing | HIGH | OneJudgeTest getattr/__import__ CRITICAL, test_it_is_still_observation_only env: CRITICAL, stub 파일단위 집계(WARNING) |
| documentation | LOW | PyYAML 소비자 "둘" stale(WARNING), "13개 테스트" 하드코딩 오기(WARNING), 그 외 확인 다수 |
| dependency | MEDIUM | OneJudgeTest os.popen/__import__(WARNING), WorkflowWiringTest 필드내 substring 잔존(WARNING), 신규 의존성 없음 확인 |
| database | NONE | 해당 없음 — DB 관련 표면 없음 |
| concurrency | LOW | 1R in_flight_ok 회귀 실제 해소 확인(INFO), concurrency: 블록 회귀테스트 부재(INFO), 활성 결함 없음 |
| api_contract | NONE | 해당 없음 — API 엔드포인트/스키마 표면 없음 |
| user_guide_sync | NONE | 해당 없음 — doc-sync-matrix 22개 trigger 매칭 0건 |

## 발견 없는 에이전트

- database — 해당 없음(DB 연결/쿼리/스키마/마이그레이션 표면 없음)
- api_contract — 해당 없음(HTTP/REST/GraphQL 엔드포인트·스키마 표면 없음)
- user_guide_sync — 해당 없음(doc-sync-matrix trigger 매칭 0건)

## 권장 조치사항

1. `OneJudgeTest` 금지-호출 탐지를 허용목록(allowlist) 방식으로 전면 전환하거나, 최소한 `ast.Attribute` 체인을 루트까지 재귀적으로 풀어 dotted-path 전체를 정규화 — 2단 속성체인/별칭/`getattr`/`__import__`/`os.popen` 우회를 한 번에 닫는다. 근본 해법은 정적 AST 검사 대신 `unittest.mock.patch` 기반 행위(behavioral) 검증 전환 (Critical #1).
2. `test_it_is_still_observation_only`를 `env:` 값까지 포함해 스캔하거나 `run:` 안의 미해석 `${{ }}`/`$` 참조 자체를 실패시키도록 강화 (Critical #2).
3. `test_a_step_actually_runs_the_script`의 주석 위장 우회, `test_the_job_condition_exempts_dependabot`의 조건 역전 우회, `argparse allow_abbrev` 축약 우회 3건을 함께 닫는다(Warning #1~#3) — 모두 "구조를 파싱했지만 값은 substring"이라는 동일 근본 원인.
4. `check-review-gate.py`의 fail-open `try` 범위를 `decision.blocked` 등 반환값 속성 접근까지 확장(Warning #4).
5. `test_block_integrity.py`의 stub 검사를 파일 단위 join이 아닌 stub 리터럴 단위로 세분화(Warning #5).
6. README/harness-checks.yml의 PyYAML 예외 소비자 서술("둘"→"세 파일") 및 신설 docstring의 "13개 테스트" 하드코딩 오기를 정정(Warning #6, #7).
7. (낮은 우선순위) INFO 항목 — `harness-checks.yml`에 `permissions: contents: read` 명시, `concurrency:` 블록 회귀 테스트 추가, 통계치("435건 중 80건") SoT 일원화, `setUpClass` 승격을 통한 픽스처/파싱 중복 제거 — 여유 있을 때 처리.
8. 세션 위생: 코드 리뷰 중 뮤테이션 기반 검증(가드 우회 실증)은 공유 워크트리가 아닌 격리된 워크트리/워커에서 수행하도록 orchestrator 프로세스 개선 검토(여러 리뷰어가 독립적으로 동일 오염을 관측).

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용 — 사유: `--route=all`. 전체 14개 reviewer(security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync) 실행. (`agents_forced` 필드에 7개 reviewer의 강제 사유가 기록돼 있으나 `--route=all`로 이미 전원 실행되어 라우팅 스킵과 무관한 정보성 기록.)

---

관련 파일 경로:
- `/Volumes/project/private/clemvion/.claude/worktrees/harness-review-ci-backstop-91f379/review/code/2026/08/01/11_20_18/{security,performance,architecture,requirement,scope,side_effect,maintainability,testing,documentation,dependency,database,concurrency,api_contract,user_guide_sync}.md` (전체 Read 완료)
- `/Volumes/project/private/clemvion/.claude/worktrees/harness-review-ci-backstop-91f379/review/code/2026/08/01/11_20_18/_retry_state.json`, `meta.json` (Read 완료 — `_retry_state.json`의 `agents_pending`/`agents_success`/`agents_fatal` 필드는 stale해 보이나(14개 전부 pending으로 남음) 실제 디스크에 14개 리포트 파일이 모두 존재하고 각각 STATUS 라인을 포함하므로 이를 신뢰함)
- `/Volumes/project/private/clemvion/.claude/worktrees/harness-review-ci-backstop-91f379/review/code/2026/08/01/11_20_18/SUMMARY.md` (Write 시도, 예상대로 차단됨)