# Code Review 통합 보고서

세션: `review/code/2026/08/01/12_06_49/` (round 3 — `harness-review-gate-ci-backstop`, diff `origin/main...HEAD` = 8개 파일, 881줄)

## 전체 위험도

**CRITICAL** — 이번 라운드가 새로 도입한 두 핵심 회귀 가드(`OneJudgeTest`="판정자는 하나", `WorkflowWiringTest`="구조로 판정한다")가 **거의 모든 리뷰어(14명 중 11명)에 의해 독립적으로, 각기 다른 최소 변경(1~5줄)으로 실측 반증**됐다. 특히 `test_the_job_condition_exempts_dependabot`은 `if:` 조건에 `&& false`만 추가하면 **CI 백스톱 전체가 영구적으로 모든 PR에서 조용히 비활성화**되는데도 15개 테스트 전원 GREEN — 이는 이 백스톱이 존재하는 핵심 이유를 정면으로 무효화한다(side_effect·testing 리뷰어가 각각 독립적으로 CRITICAL 판정, 실행 로그로 실증). 현재 게이트가 관측 모드(`--enforce` 없음)라 즉각적인 PR 차단 오작동은 없지만, 이 가드들 자체가 "자기 보증 실패"를 스스로 감지하지 못하는 상태다.

또한 리뷰 도중 **실제 작업트리의 `scripts/check-review-gate.py`가 일시적으로 뮤테이션됐다가 자체 원복**되는 것을 6개 리뷰어가 독립적으로 관측했다(현재는 clean). 근본 원인은 security 리뷰어가 명시: 여러 리뷰 에이전트가 공유하는 스크래치패드 디렉터리에서 `cd`가 조용히 실패해 뮤테이션 스크립트가 실제 경로에 쓰였다(즉시 발견·복원). Round 2에서 "이제 멈췄다"고 기록된 것과 동일 클래스가 Round 3에서도 재발했다 — 코드 결함은 아니지만 리뷰 파이프라인 신뢰성 이슈로 상단에 명시한다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트/보안/부작용/아키텍처 | `OneJudgeTest`("판정자는 하나")의 정적 import+호출 allowlist가 **Attribute-타깃 대입/재바인딩**(`sys.exit = os.system`, `module.attr = other_object` 등)을 전혀 스캔하지 않는다 — 새 import·새 호출 0개로 판정 로직을 완전히 오염시켜도 GREEN. 실측(security): `os.system` 재바인딩 후 실제 셸 명령 실행까지 물증(파일 생성) 확보. 이 방어선은 이미 4차례 뚫린 이력이 있고 이번이 5~6번째 재발. | `.claude/tests/test_review_gate_ci.py:220-329`(`OneJudgeTest`, 별칭추적 `288-293`, 호출검사 `295-311`) / 공격표면 `scripts/check-review-gate.py` | Attribute를 대입 타깃으로 갖는 문장 전체를 무조건 위반 처리(이 스크립트는 그런 대입을 할 정당한 이유가 없음). 화이트리스트 확장 대신 스크립트 텍스트 자체를 golden/구조 diff로 고정하는 근본 전환 검토. |
| 2 | 요구사항 | `OneJudgeTest`의 getattr 전용 우회탐지가 **첫 인자가 정확히 `ast.Name`일 때만** 동작 — `getattr(sys.modules['os'], 'system')`처럼 `Subscript`를 쓰면 검사가 조용히 스킵된다. `print = getattr(sys.modules['os'],'system')`으로 실제 셸 실행(`os.system`)까지 실증(PWNED_MARKER 파일 생성). | `test_review_gate_ci.py:291-293`(별칭추적), `:313-322`(getattr 우회탐지) | getattr 검사의 `Name` 조건을 제거해 모든 표현식으로 확장하거나, 스크립트 내 `getattr` 사용 자체를 전면 금지(유일한 정당 용도 1곳만 예외 처리). |
| 3 | 부작용/테스트/유지보수성 | `OneJudgeTest`가 `evaluate_review`의 **호출 여부(dataflow)**가 아니라 **이름의 정적 존재(attrs)**만 확인 — `review_guard.evaluate_review`를 죽은 참조로 한 번 언급만 하고 실제로는 호출하지 않는 "항상 allow" 두 번째 판정자를, 허용된 호출 이름만으로 구성해도 `OneJudgeTest` 자체는 GREEN(형제 클래스 `ReviewGateCliTest`가 우연히 잡아줄 뿐 — 가드 자체의 보장은 아님). | `test_review_gate_ci.py:220-234`(`_ALLOWED_CALLS`), `:253`, `:283-285`, `:325-327`(`attrs` 존재 단언) | `evaluate_review` 참조가 실제 `Call` 노드로 등장하고 그 반환값이 `blocked`/`reason`에 데이터플로로 연결되는지까지 AST로 확인. |
| 4 | 요구사항/부작용/테스트 | `test_a_step_actually_runs_the_script`가 **substring 매치**만 해 게이트 호출 `run:`을 `echo "..."`로 바꾸거나 그 스텝에 `if: ${{ false }}`를 붙여도(게이트가 실제로 전혀 실행되지 않아도) GREEN. 관측 모드가 위반 시에도 항상 exit 0이라 GitHub Actions 로그의 초록 체크로도 실행 여부가 구분되지 않는다. | `test_review_gate_ci.py:385-390` 대상 `.github/workflows/review-gate.yml:73-74` | 선두 토큰이 `python3 ... scripts/check-review-gate.py`인지 구조적으로 확인(예: 정규식 선두 앵커) + 해당 스텝에 `if:` 키가 없음을 별도 단언. |
| 5 | 부작용/테스트 | `test_the_job_condition_exempts_dependabot`가 `assertRegex`(부분일치, 앵커 없음)만 사용 — `if:` 조건에 `|| <참>`을 붙이면 봇 예외가 무력화(항상 실행)되고, **`&& false`를 붙이면 게이트가 영구적으로 모든 PR에서 비활성화**되는데도 GREEN. | `test_review_gate_ci.py:392-402` 대상 `.github/workflows/review-gate.yml:51` | `if:` 문자열 전체를 `re.fullmatch`(공백 차이만 허용) 또는 파스트리 동치 비교로 검증하고, `||`/`&&` 등 추가 결합 연산자 부재를 별도로 단언. |
| 6 | 보안/부작용/스코프 | `test_it_is_still_observation_only`가 `--enforce`/`$`/`${{` **리터럴 문자열**만 검사 — 인접 따옴표 분리(`--enfor""ce`, bash가 토큰 결합)나 백틱 명령 치환으로 실제로는 `--enforce`가 켜지거나 값이 조립돼도 통과. 관측 전용 계약이 조용히 하드 차단으로 뒤집힐 수 있다(미커밋 리뷰 435건 중 80건 즉시 실패 전환 실측치 인용). | `test_review_gate_ci.py:430-454` 대상 `.github/workflows/review-gate.yml:74` | `run:` 문자열을 `shlex.split()`으로 실제 셸 토큰화한 뒤 파싱된 인자 리스트로 판정(단, 백틱/`$()` 명령치환 자체를 막으려면 별도 검사 추가 필요 — shlex는 치환을 평가하지 않음). |
| 7 | 테스트 (요구사항과 결합 시 심각도 상승) | `test_checkout_fetches_full_history`가 "job 내 **어느** checkout이든 `fetch-depth:0`이 있으면" 통과 — 실제로 실행되는(순서상 나중/유효한) checkout이 shallow이고 미사용 checkout만 deep이어도 GREEN, merge-base 실패 시 조용한 fail-open 재발 가능. 스텝 레벨 `if:` 미검증(#4)과 결합하면 디코이 스텝으로 완전히 봉쇄 가능. | `test_review_gate_ci.py:404-411` 대상 `review-gate.yml:55-57` | 게이트 실행 스텝 직전의 마지막 checkout만 스텝 순서로 특정해 그 스텝의 `fetch-depth`만 확인. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능 | "판정자는 하나(정확히 1회 호출)"를 강제하는 테스트가 없다 — `evaluate(root)`를 중복 호출하도록 만들어도(비용 2배: git 서브프로세스 재실행 + `review/` 트리 전체 mtime 스캔 재실행, 저장소 실측 8,851~14,517개 파일) 15개 테스트 전부 GREEN. 값이 아니라 CI 비용만 두 배로 만드는 조용한 회귀. | `scripts/check-review-gate.py:97`(`decision = evaluate(root)`), 회귀 스위트 `test_review_gate_ci.py` 전체 | `evaluate` 호출이 정확히 1회임을 pin(스텁에서 호출 카운터 assert, 또는 AST상 Call 노드 정확히 1개 확인). |
| 2 | 동시성 | `concurrency:` 지시자(그룹 키의 `${{ github.ref }}` 포함 여부, `cancel-in-progress` 값)를 검증하는 테스트가 전무 — 스탠자 전체 삭제 또는 그룹 키에서 `github.ref` 제거 + `cancel-in-progress: false`로 실측 변경해도 관련 스위트 15개 GREEN 유지. 현재는 관측 하나 누락 정도지만 `--enforce` 전환 후엔 "차단해야 할 PR이 무관한 PR에 의해 조용히 취소"되는 위험으로 격상. 저장소 10개 워크플로 전체가 이 갭을 공유. | `.github/workflows/review-gate.yml:36-38`(및 `harness-checks.yml:63-65`) | `WorkflowWiringTest`에 `concurrency.group`이 `${{ github.ref }}`를 포함하고 `cancel-in-progress`가 `true`인지 구조적으로 단언하는 테스트 추가. |
| 3 | 문서화 | `.claude/tests/README.md`의 `test_review_gate_ci.py` 재작성 이력 서술이 실제보다 적다 — 2세대(grep, denylist)만 언급하고 실제 4세대(+4차의 5가지 우회 기법: 2단 속성체인·지역별칭·`getattr(os,"walk")`·`__import__`·`os.popen/system`)를 통째로 누락. 정확히 "call 축도 허용목록화해야 했던 이유"를 설명하는 세대가 요약에서 빠짐. | `README.md:88` vs `test_review_gate_ci.py:256-263` | README 행을 "4세대가 순차로 뚫렸다"로 갱신하거나 최소 4차 세대+기법 목록을 한 문장이라도 포함. |
| 4 | 문서화 | `plan/in-progress/harness-review-gate-ci-backstop.md` 최상단 배너("CI 백스톱 본체 \| 미착수")와 145행 배너("본체 구현 완료")가 취소선/포인터 없이 정면으로 모순된 채 공존 — 문서를 위에서부터 읽는 독자가 "아직 시작 안 됐다"고 오도되기 쉽다(100줄 넘게 읽어야 최신 배너를 만남). | `plan/in-progress/harness-review-gate-ci-backstop.md:17` vs `:145` | 구 배너 표 셀에 취소선 + "08-01 구현 완료(관측 모드), §145 참조" 포인터 추가. |
| 5 | 유지보수성 | "훅 사본을 만들고 `review_guard.py`/`plan_guard.py`를 최소 스텁으로 덮어써 서브프로세스 실행" 보일러플레이트가 서로 다른 2개 파일, 3곳에 손으로 반복돼 있다 — 저장소 자신이 같은 파일들의 docstring에서 "중복 대신 `_lib/failopen_state.py`로 추출했다"고 중복 제거를 가치로 명시하는데도 세 번째 사본이 합쳐지지 않았다. | `test_block_integrity.py:390`(`_hook_env`), `:735`(`setUp`), `test_stop_guard_failopen.py:66`(`setUp`) | `_harness.py`에 `build_hook_sandbox(review_guard_src=None, plan_guard_src=None)` 류 공용 헬퍼 추가, 넷째 사본이 생기기 전에 닫을 것. |
| 6 | 다수(위생) | `OneJudgeTest._ALLOWED_IMPORTS` 클래스 속성이 동일 값+동일 주석으로 **두 번** 선언돼 있다(둘째가 첫째를 덮어씀, 기능 영향 없음) — 8/9개 리뷰어가 공통 지적한 편집 잔재. 허용 목록 하나의 정확성이 이 파일 전체의 주제인데 그 목록 정의 자체가 중복돼 있어 향후 한쪽만 고치는 drift의 소재. | `.claude/tests/test_review_gate_ci.py:224`, `:227` | 중복 블록(주석+대입) 중 하나 삭제. |
| 7 | 프로세스(리뷰 파이프라인) | 리뷰 세션 도중 **공유 스크래치패드 디렉터리 레이스**로 security 리뷰어의 `cd`가 조용히 실패해, 이어진 heredoc 스크립트가 실제 작업트리 `scripts/check-review-gate.py`에 4줄(`join = os.walk; join('review')`)을 실제로 기록했다가 발견 즉시 원복. 6개 리뷰어(documentation/performance/side_effect/testing/api_contract/user_guide_sync)가 이 파일의 일시적 변경을 서로 다른 시점에 독립적으로 관측 — round 2에서 "이제 멈췄다"던 것과 동일 클래스가 round 3에서도 재발. 재확인 시점엔 clean, 조치할 diff는 없음. | `scripts/check-review-gate.py`(현재 clean) | fan-out 프롬프트/`code-review-agents` SKILL 공통 지시문에 "뮤테이션 실험은 반드시 자기 소유 절대경로 스크래치 디렉터리에서만 수행하고, `cd` 실패를 침묵시키지 말 것(절대경로 사용 또는 `cd ... && ...` 대신 `set -e`)"을 명시. 최종 push 직전 관련 파일 `git status`/`git diff` 재확인 권고. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 의존성 | 신규 의존성 PyYAML(`pyyaml>=6,<7`) — 라이선스(MIT) 호환, `safe_load`/`SafeLoader`만 사용(위험한 `Loader` 없음), 기존 3개 워크플로와 버전 핀 일치, 게이트 스크립트 자체는 미의존(테스트만 의존). 결함 아님, 건전성 확인. | `.github/workflows/harness-checks.yml:84-85` | 조치 불필요. |
| 2 | 의존성 | `harness-checks.yml`의 "v5/v6 line" 주석이 실제 핀(`actions/setup-python@v7`, 저장소 전체 `@v7` 통일)과 어긋난 stale 주석(이번 diff 범위 밖, 기존 drift). | `.github/workflows/harness-checks.yml:75-76` | 다음 편집 시 주석을 실제 정책(v7)로 정정. |
| 3 | 아키텍처/의존성 | `_lib` 네임스페이스 충돌(`.claude/hooks/_lib` vs `.claude/skills/_lib`) 회피용 `sys.path.insert` + bare import 패턴이 이번 PR로 세 번째 소비자(`scripts/check-review-gate.py`)까지 확산(근본 해소는 plan에 이미 defer 등재). | `scripts/check-review-gate.py:60-70` | plan의 defer 항목대로 `_lib` 충돌 근본 해소 선행, 그 전까지 우회 패턴 자체를 공용 헬퍼로 추출. |
| 4 | 유지보수성 | `OneJudgeTest`의 단일 테스트 메서드가 4가지 상이한 구문 점검(모듈 import/별칭 역추적/호출 대상/getattr 우회 탐지)을 순서대로 수행 — 실패 시 어느 하위 점검이 깨졌는지 트레이스백을 끝까지 읽어야 함. | `test_review_gate_ci.py:253` | 필수 아님. private 헬퍼 또는 `subTest`/개별 메서드로 분리하면 실패 지점 특정이 빨라짐. |
| 5 | 유지보수성 | `timeout=120` 매직넘버가 파일 내 2곳에 하드코딩. | `test_review_gate_ci.py:85`, `:154` | 모듈 레벨 `_SUBPROCESS_TIMEOUT = 120` 상수로 추출. |
| 6 | 동시성 | `_retry_state.json`의 lost-update(락 없음) — 이미 plan에 defer로 등재된 기존 이슈(저자가 `fcntl.flock` 기각 근거까지 기록), 이번 diff의 신규 결함 아님. 재오픈하지 않음. | `plan/in-progress/harness-review-gate-ci-backstop.md:84-93` | 없음(이미 트래킹됨). |
| 7 | 성능 | `code_review_orchestrator.py`의 `_rank_plan_text` 이중 read(I/O 2배) — 이번 diff 8개 파일에 없는 별도 파일 이야기지만 plan 문서에 이미 자기-보고돼 있음(30파일/430KB 기준 ~3.5ms, 현재 무해, 다음 라운드로 defer). | `plan/in-progress/harness-review-gate-ci-backstop.md` §후속 항목 7 | 없음(이미 defer). |
| 8 | 문서화 | `WorkflowWiringTest._env_values()`가 job/step의 `env:`만 스캔하고 워크플로 최상위 `env:` 블록은 대상이 아님(현재 무해, 향후 최상위 `env:` 추가 시 대비 필요). | `test_review_gate_ci.py:379-383` | docstring에 스코프 한 줄 추가 권고. |
| 9 | 테스트 | 동일한 "substring만으로 실행 여부 판정" 결함 클래스가 `harness-checks.yml`의 "Run harness unit tests" 스텝에도 존재(이번 PR 범위 밖, 회귀 아님). | `.github/workflows/harness-checks.yml:87-88` | 별도 후속으로 검토. |
| 10 | 성능 | `block_integrity.py`의 ReDoS/복잡도 가드(정규식 trailing 매치, glob wildcard 캡) — 과거 버그 형태로 되돌리는 값싼 뮤턴트를 실제로 만들어 타이밍 실측했으나 재현되지 않음(문제 없음, 확인 완료). | `.claude/_shared/block_integrity.py` | 조치 불필요. |
| 11 | 스코프 | `test_block_integrity.py`의 `PlanStubsMirrorTheRealInterfaceTest` 변경(24줄)은 이번 PR 표제 주제와 무관해 보이지만 실제로는 이번 라운드가 추가한 새 스텁이 드러낸 결함(파일 단위 join)의 정당한 부수 수정 — 범위 이탈 아님. | `test_block_integrity.py:672-700` | 없음(정당한 수정). |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| api_contract | NONE | REST/HTTP API 표면 없음 — 해당 없음 |
| architecture | HIGH | OneJudgeTest Attribute-대입 우회(구조적 CRITICAL급), observation-only/dependabot 우회 WARNING, 긍정 설계요소(SSOT 위임·fail-open) 확인 |
| concurrency | LOW | 동시성 코드 없음. concurrency: 지시자 미검증 WARNING 1건 |
| database | NONE | DB 엔진 접촉 코드 없음 — 해당 없음 |
| dependency | LOW | OneJudgeTest 우회(Attribute 대입) WARNING, PyYAML 신규 의존성은 건전 |
| documentation | HIGH | 데코레이터(`@repr`) 통한 OneJudgeTest 우회 CRITICAL, README/plan 문서 불일치 WARNING 3건 |
| maintainability | MEDIUM | OneJudgeTest 과대주장(구문만 검증, dataflow 없음) WARNING, 중복선언/보일러플레이트 반복 WARNING |
| performance | LOW | evaluate() 1회 호출 미강제 WARNING(비용 회귀), 그 외 알고리즘적 신규 위험 없음, ReDoS 가드 실측 견고 확인 |
| requirement | HIGH | getattr 우회(CRITICAL) + WorkflowWiringTest 스텝 `if:` 미검증(CRITICAL), 실행까지 실증(파일 생성) |
| scope | HIGH | 코드 변경 범위 자체는 clean, 그러나 "네 번째로 완전히 닫았다"는 완료 선언이 실측으로 반증(CRITICAL 2건) — 완료 선언과 실제 구현 범위 간극 |
| security | HIGH | Attribute 재바인딩(`sys.exit = os.system`) + observation-only 우회, 셸 실행까지 실증. 작업 중 스크래치패드 레이스로 실제 워크트리 오염 1건 자체 발견·원복 |
| side_effect | CRITICAL | dependabot 영구비활성화/observation-only 우회/스크립트 미실행/OneJudgeTest 죽은참조 — 4건 CRITICAL, 실행 로그 전부 실증 |
| testing | CRITICAL | 스크립트 미실행 substring 우회 + dependabot 영구비활성화 — 2건 CRITICAL, fetch-depth/OneJudgeTest dataflow WARNING 2건 |
| user_guide_sync | NONE | doc-sync-matrix 21개 trigger 매칭 0건 — 해당 없음 |

## 발견 없는 에이전트

api_contract, database, user_guide_sync — 대상 코드/트리거가 이번 diff 범위에 존재하지 않아 "해당 없음(NONE)"으로 판정.

## 권장 조치사항

1. **`WorkflowWiringTest`에 "스텝이 실제로 실행되는가"를 구조적으로 강제** — `run:` 선두 토큰 파싱 + 해당 스텝에 `if:` 키가 없음을 단언(Critical #4, #7). 게이트가 조용히 영구 비활성화되는 경로(Critical #5)와 직결되는 최우선 조치.
2. **`test_the_job_condition_exempts_dependabot`을 `re.fullmatch`/파스트리 동치 검사로 재작성** — tautology(`|| true`)와 상시-거짓(`&& false`) 변형을 모두 차단(Critical #5). 방치 시 CI 백스톱 전체가 조용히 영구 무력화될 수 있는 가장 심각한 항목.
3. **`test_it_is_still_observation_only`를 `shlex.split()` 기반 실제 토큰 비교로 재작성** — 인접 따옴표 분리·백틱 명령치환 우회 차단(Critical #6).
4. **`OneJudgeTest`를 Attribute-타깃 대입 전면 금지 + getattr 조건 확장(또는 getattr 전면 금지) + `evaluate_review` 호출의 dataflow 검증**으로 강화(Critical #1, #2, #3) — 화이트리스트 확장이 아니라 스크립트 형태 자체를 golden diff로 고정하는 구조 전환을 우선 검토(이 클래스가 이미 5~6차례 재발했으므로).
5. `test_checkout_fetches_full_history`를 "게이트 실행 스텝 직전 마지막 checkout"만 특정하도록 수정(Critical #7), `evaluate()` 1회 호출 pin(Warning #1), `concurrency:` 그룹 키/cancel-in-progress 구조적 검증 추가(Warning #2).
6. `_ALLOWED_IMPORTS` 중복 선언 삭제, README 재작성 이력 갱신, plan 문서 배너 모순 정정(Warning #3, #4, #6).
7. **공유 스크래치패드 디렉터리 레이스 재발 방지** — fan-out 프롬프트/SKILL 지시문에 절대경로 강제 및 `cd` 실패 침묵 방지 명시(Warning #7). Round 2, 3 연속 재발이므로 다음 라운드 전에 반드시 처리.
8. 훅 사본 스텁 보일러플레이트를 `_harness.py` 공용 헬퍼로 추출(Warning #5) — 넷째 사본이 생기기 전에.

## 라우터 결정

`routing_status=skipped` — 사유: `--route=all`. 전체 14개 reviewer 실행(`agents_forced`로 표시된 7개는 route=all 하에서는 참고 정보이며 결과에 영향 없음).