# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 없음. 이 스크립트(`scripts/check-override-floors.py`)가 존재 이유로 삼는 실패 클래스("설정/파싱 실패가 취약점 0건과 구별 안 되는 조용한 성공")와 정확히 같은 계열의 잔여 사각지대가 `load_override_targets()`의 값 타입 미검증(3개 reviewer 가 독립적으로 수렴 확인)과, `run_audit()`/`load_override_targets()`의 예외 미처리 2곳(testing 이 mutation·직접 실행으로 실증)에 남아 WARNING 3건으로 판정. forced(router_safety) 화이트리스트 7명 전원 결과 확보 — 강제 목록 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/요구사항 | `load_override_targets()`의 fail-closed 가드가 `overrides` **키의 존재 여부만** 검사하고 **값의 타입**은 검사하지 않는다. `overrides:`가 값 없이 남거나(`None`), 매핑이 아닌 문자열/리스트로 손상되면 `data.get("overrides") or {}`가 조용히 `{}`로 축소되거나(값 부재) truthy 문자열/리스트를 그대로 순회해(값 타입 오류) 실제 override 대상 전체가 유실된 채 `OK: 취약 재유입 0건`(exit 0)을 출력한다. security·requirement·side_effect 3개 reviewer 가 독립적으로 동일 지점을 지적했고, side_effect 는 `overrides:\n`(None) 케이스를 `importlib`로 실제 모듈 로드해 `{}` 반환을 실행으로 재현했다. 이 스크립트 자신이 막으려는 정확한 실패 클래스("설정 파싱 실패가 취약점 0건과 구별 안 되는 성공")가 직전 라운드에 고친 것과 다른 트리거로 재현됨. | `scripts/check-override-floors.py:119-134`(`load_override_targets()`), 특히 `:122`(키 존재만 검사하는 가드)와 `:132`(`for key in data.get("overrides") or {}:`) | `:122`를 `if not isinstance(data, dict) or not isinstance(data.get("overrides"), dict): _undecidable(...)` 형태로 값 타입 검사까지 확장. 명시적 빈 매핑(`overrides: {}`)은 계속 허용. `overrides: null`/`overrides: "x"`/`overrides: [a, b]` 케이스를 `MissingOverridesKeyTest`에 회귀 테스트로 추가하고 `EXPECTED_SITES`(현재 8)·미러 문서 동반 갱신 |
| 2 | 테스트 | `run_audit()`의 `except subprocess.TimeoutExpired:` fail-closed 분기가 어떤 테스트로도 검증되지 않는다. mutation 테스트로 실증: 해당 except 절을 `except subprocess.CalledProcessError:`(`subprocess.run`이 `check=True` 없이는 결코 던지지 않는 타입)로 치환한 뒤 33개 테스트 전체 재실행 → **전부 GREEN 유지**. 실제 레지스트리 hang 시 이 분기가 깨지면 스크립트의 exit 코드 계약(1=발견, 2=판단불가)을 우회해 uncaught traceback(기본 exit 1)으로 죽는데도 테스트가 이를 잡지 못함. side_effect 리뷰도 같은 코드를 "안전하나 전용 회귀 테스트 없음"으로 독립적으로 확인(INFO). | `scripts/check-override-floors.py:169-173`(`run_audit()`) — 대응 테스트 `.claude/tests/test_override_floors.py` 전체에 "timeout" 0건 | `_load_module()` 패턴으로 모듈을 인프로세스 로드 후 `unittest.mock.patch("subprocess.run", side_effect=subprocess.TimeoutExpired(...))`로 `run_audit()`을 직접 호출해 `SystemExit` code 2 를 단언하는 테스트 추가(300초 실대기 불요) |
| 3 | 테스트 | `load_override_targets()`의 `yaml.safe_load()` 호출이 YAML 파싱 예외를 잡지 않는다. `run_audit()`의 JSON 파싱(`json.loads`)은 `JSONDecodeError`를 `_undecidable()`로 라우팅하는 대칭 방어가 있는데, YAML 입력 파싱에는 없다. 직접 프로브로 실증: 탭 들여쓰기가 섞인 잘못된 `pnpm-workspace.yaml`을 실제 서브프로세스로 실행 → `yaml.scanner.ScannerError` traceback과 함께 **exit code 1**로 종료(= 이 스크립트 어휘로 "침식/확장 발견"과 동일 코드) — 구문 오류로 인한 크래시가 정상 취약점 발견 신호와 구분되지 않아, exit 코드만 보는 자동화가 둘을 혼동할 수 있음. | `scripts/check-override-floors.py:121`(`load_override_targets()`의 `yaml.safe_load()` 호출) | `try/except yaml.YAMLError`로 감싸 `_undecidable()`로 라우팅(`EXPECTED_SITES` 8→9, 모듈 docstring·`FailClosedSiteCountTest`·`.claude/tests/README.md` 동반 갱신). 탭 들여쓰기 등 구문 오류 YAML 픽스처로 회귀 테스트 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `pnpm audit`의 raw stdout/stderr 미리보기(최대 2000/500자)를 CI 로그에 그대로 노출 — private registry 인증 실패 등 예외적 오류 출력에 토큰/Basic-Auth URL 포함 가능성을 코드 레벨에서 배제하지 않음(5차부터 이어지는 관찰) | `scripts/check-override-floors.py:179,184` | 필수 아님. 여유 있으면 알려진 토큰/URL 패턴 redaction 검토 |
| 2 | 보안 | `pnpm` 바이너리를 절대경로가 아닌 PATH 조회로 실행 — 리스트 인자 사용(`shell=True` 미사용)이라 인젝션은 없고 저장소 기존 관례와 일치(5차부터 이어지는 관찰) | `scripts/check-override-floors.py:160` | 조치 불요 |
| 3 | 유지보수성 | `classify_vulnerable()` 내 스키마 드리프트 가드 2곳(`advisories`/`actions`)이 구조적으로 동일한 모양 — 프로젝트가 채택한 "3회째까지 헬퍼 추출 보류" 기준에 아직 미달(2회) | `scripts/check-override-floors.py:239-244, 249-254` | 조치 불요. 3번째 유사 스키마 검사 추가 시 헬퍼로 통합 |
| 4 | 유지보수성 | `main()`의 `widened`/`eroded` 산출 로직이 이름 없이 인라인돼 있어, 파일의 나머지 "이름 있는 함수 + `_report_*` 대칭" 관례와 결이 다름 | `scripts/check-override-floors.py:274-282, 284-287` | 급하지 않음. 3번째 판정 축 추가 또는 블록이 길어질 때 `_compute_widened`/`_compute_eroded`로 분리 검토 |
| 5 | 유지보수성 | `REPO_ROOT`를 모듈 레벨 상수로 두는 방식이 자매 스크립트(`check-pnpm-security-config.py`, 지역변수 사용)와 다름 — 결함 아닌 스타일 편차 | `scripts/check-override-floors.py:53-54` | 조치 불요 |
| 6 | 유지보수성 | timeout 근거 설명 주석이 `subprocess.run()` 인자 목록 중간에 3줄로 끼워져 인자 나열의 읽기 리듬을 끊음 | `scripts/check-override-floors.py:164-166` | 급하지 않음. 호출 직전으로 이동하거나 한 줄로 축약 검토 |
| 7 | 테스트 | `MissingOverridesKeyTest.test_typo_key_is_undecidable`가 exit code만 단언하고 stderr 메시지 내용은 확인하지 않아, 오타 키 경로가 다른 `_undecidable()` 메시지로 잘못 합쳐져도 미검출 | `.claude/tests/test_override_floors.py:427-429` | 우선순위 낮음. `self.assertIn("overrides", r.stderr)` 보강 |
| 8 | 문서화 | 모듈 docstring의 "실측 5건 → 위 4건" 서술 순서가 한 문장 시점에 잠깐 모호 — 원커밋부터 1~5차 리뷰 내내 미해결인 저우선순위 항목(사실관계 오류는 아님, `:21`에서 뒤늦게 해소됨) | `scripts/check-override-floors.py:6-14` | 급하지 않음. `:14`에 PR 번호(`#1038`)를 즉시 명시하면 근거가 그 자리에서 바로 섬 |
| 9 | 확인(긍정) | 5차 리뷰 WARNING 2건(returncode 불변식 미검증, `overrides` 키 부재 fail-closed 누락)이 이번 라운드에서 전용 회귀 테스트(`ReturncodeInvariantTest`, `MissingOverridesKeyTest`) + mutation 재현으로 완전히 해소됨을 확인(직전 라운드는 뮤턴트에 28/28 GREEN, 이번은 동일 뮤턴트에 3건 FAIL) | `.claude/tests/test_override_floors.py:388-411, 414-434` | 조치 불요. 수렴 근거 기록 |
| 10 | 확인(긍정) | fail-closed 지점 수 "6곳 → 8곳" 전환이 모든 미러 문서(테스트 모듈 docstring "여덟", `.claude/tests/README.md` "Eight", `plan/in-progress/deps-guard-hardening.md` "6곳 → 8곳")에 정확히 반영 — 4차 리뷰가 심은 `FailClosedSiteCountTest` 결속 가드가 의도대로 drift 를 막음 | 코드 전체(`_undecidable(` 8회 호출 실측) 대 3개 미러 문서 | 조치 불요 |
| 11 | 부작용 | `_retry_state.json`(직전 5차 라운드 산출물)에 로컬 워크트리 절대경로가 다수 포함되나, orchestrator 코드(`code_review_orchestrator.py`) 추적 결과 `session_dir` 필드는 기록 전용이고 재-Read 되지 않는 dead field 확인 — 다른 머신/클론에서 잘못된 재실행을 유발할 경로 없음 | `review/code/2026/08/01/03_47_10/_retry_state.json:2,4,6,7,8,125-141` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | `load_override_targets()` 값 타입 미검증(WARNING #1 기여); 인젝션·시크릿·인증·정규식·의존성 전수 확인 결과 이상 없음; CI 로그 노출·PATH pnpm 은 기존 INFO 유지; 신규 timeout 처리는 안전 확인(긍정) |
| requirement | MEDIUM | 동일 값 타입 미검증(WARNING #1 기여) 재확인; 5차 W1/W2 해소를 커밋 diff·소스·33개 테스트·라이브 `pnpm audit`(대상 26개) 4중 실측; `spec_impact: none` 정상(spec 문서 대상 아님) |
| scope | LOW | `git show`로 실 델타 대조 결과 커밋 메시지 선언 항목(3곳)과 정확히 일치, 무관 리팩토링·포맷팅·임포트 변경 없음; 리뷰 산출물 동봉 커밋 패턴은 3차 라운드와 동일한 저장소 기존 관례 |
| side_effect | MEDIUM | WARNING #1 의 `overrides: null` 서브케이스를 `importlib` 실행으로 직접 재현(가장 강한 증거); 신규 timeout 처리는 프로세스 정리 관점에서 안전(WARNING #2 로 편입); 정적 리뷰 문서·`_retry_state.json` 의 로컬 경로는 dead field 확인 |
| maintainability | LOW | 신규 코드(timeout·overrides 가드)가 기존 named-constant·`_undecidable()` 단일 진입점 관용구를 그대로 따름; 매직넘버·깊은 중첩·순환복잡도 과다 없음; 전방주시형 INFO 5건(구조 비대칭·스타일 편차·주석 위치)만 |
| testing | MEDIUM | `run_audit()` TimeoutExpired 미검증(WARNING #2) + `load_override_targets()` YAML 파싱예외 미처리(WARNING #3) — 둘 다 mutation/직접 실행으로 실증; 5차 W1/W2 는 뮤턴트 재현으로 완전 해소 확인(긍정); 기존 테스트 스위트(33개, PATH 스텁 기반 격리)는 "이례적으로 견고"로 평가 |
| documentation | LOW | 신규 코드 주석이 CI `timeout-minutes: 10` 등 실제 설정과 정확히 부합; "6→8" 수치가 3개 미러 문서 전부에 정확히 반영, 잔여 drift 없음; CRITICAL·WARNING 없음, carried-forward INFO 1건만 미해결 |

## 발견 없는 에이전트

없음 — forced 7개 에이전트 전원이 최소 INFO 수준 이상의 실질 관찰을 보고했다(순수 "이상 없음" 확인만 낸 에이전트는 scope 이나, 그 확인 자체가 스코프 이탈 점검이라는 실질 작업의 결과이므로 "발견 없음"으로 분류하지 않음).

## 권장 조치사항

1. `load_override_targets()`의 `overrides` 값 존재/타입 검사를 `isinstance(data.get("overrides"), dict)`로 확장한다 — 이 스크립트가 막으려는 핵심 실패 클래스("설정 파싱 실패가 취약점 0건과 구별 안 되는 성공")가 재현되는 지점이므로 최우선(WARNING #1).
2. `load_override_targets()`의 `yaml.safe_load()` 호출을 `try/except yaml.YAMLError`로 감싸 `_undecidable()`로 라우팅한다 — 구문 오류 YAML이 exit 1(정상 발견 신호와 동일 코드)로 오분류되는 것을 방지(WARNING #3).
3. `run_audit()`의 `except subprocess.TimeoutExpired:` 분기에 대해 `mock.patch("subprocess.run", side_effect=subprocess.TimeoutExpired(...))` 기반 회귀 테스트를 추가한다(WARNING #2).
4. 위 1·2 조치 시 `EXPECTED_SITES`(현재 8)와 미러 문서(`test_override_floors.py` 모듈 docstring, `.claude/tests/README.md`, `plan/in-progress/deps-guard-hardening.md`)의 fail-closed 지점 수를 동반 갱신한다(YAML 예외 처리 추가로 8→9 예상) — `FailClosedSiteCountTest` 가 이 결속을 강제하므로 누락 시 즉시 RED.
5. (저우선순위, 여유 시) `MissingOverridesKeyTest.test_typo_key_is_undecidable`에 `assertIn("overrides", r.stderr)` 보강, 모듈 docstring `:14`에 PR 번호(`#1038`) 즉시 명시.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 표 (reviewer · 이유, 7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 — 이번 라운드 실행된 reviewer 전원이 forced 목록에 해당하며, 결과 전원 확보됨. 강제 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 이번 델타(CI 방어 스크립트 로직 보강)가 성능 특성과 무관 (router 가 개별 사유 문자열을 제공하지 않아 변경 내용에 근거해 추정) |
  | architecture | 라우터 판단 — 단일 스크립트 내부 함수 보강이며 아키텍처 영향 없음 (추정) |
  | dependency | 라우터 판단 — 신규 외부 의존성 추가 없음(기존 PyYAML 재사용) (추정) |
  | database | 라우터 판단 — DB 접근 코드 변경 없음 (추정) |
  | concurrency | 라우터 판단 — 동시성/병렬 처리 로직 변경 없음 (추정) |
  | api_contract | 라우터 판단 — API 엔드포인트/계약 변경 없음(CLI/CI 스크립트) (추정) |
  | user_guide_sync | 라우터 판단 — 사용자 대면 문서 변경 없음(CI 전용 스크립트) (추정) |