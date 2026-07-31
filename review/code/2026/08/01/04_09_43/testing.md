# 테스트(Testing) 리뷰 — scripts/check-override-floors.py (5차 리뷰조치 이후)

## 스코프 메모

이번 라운드의 리뷰 대상 파일 목록(11개)은 `scripts/check-override-floors.py` 1개 소스 파일과,
그 스크립트를 다룬 **직전** 코드 리뷰 세션(`review/code/2026/08/01/03_47_10/`)의 산출물
10개(SUMMARY.md·meta.json·_retry_state.json·에이전트별 리포트 9종)로 구성된다. 후자는 실행
가능한 코드가 아니라 리뷰 기록이므로 "테스트" 관점에서 다룰 대상이 아니다(JSON 2개는 구조
유효성만 확인 — 이상 없음).

`scripts/check-override-floors.py`의 실제 테스트는 `.claude/tests/test_override_floors.py`
(569줄, 33개 테스트)에 있다. `git diff origin/main --stat` 기준으로는 이 테스트 파일도 이번
브랜치 델타(916줄 중 569줄)에 포함되지만, 이번 라운드의 파일 목록에는 포함되지 않았다 —
직전 라운드(03_47_10)의 testing 리포트가 이미 확인한 대로 `.claude/**`를 코드 리뷰 게이트
스코프에서 제외하고 `harness-checks.yml`로 별도 게이트하는 기존 정책과 일치하므로 누락이
아니라 정상 동작이다(`.github/workflows/harness-checks.yml`의 `paths:`에
`scripts/check-override-floors.py` 명시 등재 확인, PyYAML 설치 스텝 확인, `python3 -m
unittest discover -s .claude/tests -p 'test_*.py'` 스텝 확인 — 모두 실제로 CI에 연결돼 있음).
아래 발견사항은 그 테스트 파일을 직접 읽고 **실제 뮤턴트 주입 + 직접 프로브**로 검증한
결과다.

## 발견사항

- **[WARNING]** `run_audit()`의 타임아웃 fail-closed 분기(`except subprocess.TimeoutExpired:`)가 어떤 테스트로도 검증되지 않는다
  - 위치: `scripts/check-override-floors.py:169-173` (`run_audit()`) — 대응 테스트는
    `.claude/tests/test_override_floors.py`에 없음(전체 파일 grep 결과 "timeout" 0건)
  - 상세: 이 스크립트의 `_undecidable()` 호출 8곳 중 7곳(빈 출력·파싱 실패·`actions` 키
    부재·`advisories`/`actions` 하위 필드 드리프트·워크스페이스 파일 부재·`overrides` 키
    부재)은 각각 `FailClosedTest`/`SchemaDriftTest`/`MissingOverridesKeyTest`가 실행-후-단언
    방식으로 직접 검증한다. 유일한 예외가 "레지스트리 타임아웃"이다. `FailClosedSiteCountTest`는
    소스의 `_undecidable(` 호출 **횟수**(8)만 세어 문서-코드 drift를 막을 뿐, 그 분기가 실제로
    옳게 동작하는지는 보지 않는다.
    **실측(mutation)**: `except subprocess.TimeoutExpired:`(:169)를
    `except subprocess.CalledProcessError:`(`subprocess.run`이 `check=True` 없이는 결코
    던지지 않는 예외 타입)로 바꿔치기한 뒤 `.claude/tests/test_override_floors.py`의 33개
    테스트 전체를 재실행 — **33개 전부 GREEN 유지**. 이 뮤턴트는 실제 레지스트리 hang 시
    `TimeoutExpired`가 더 이상 잡히지 않아, 스크립트가 다른 7곳에서 일관되게 지키는 exit 코드
    계약(1=침식/확장 발견, 2=판단 불가)을 깨고 처리되지 않은 예외(traceback, Python 기본
    exit 1)로 죽는다는 뜻이다 — 아무 테스트도 이를 잡지 못한다. 검증 후 원본 파일은 백업에서
    `cp`로 즉시 복원했고(`git checkout` 미사용), `git status`로 클린 상태와 33/33 GREEN을
    재확인했다.
  - 제안: 이미 `OverrideTargetExtractionTest`가 쓰는 `_load_module()` 패턴으로 모듈을
    인프로세스 로드한 뒤, `unittest.mock.patch("subprocess.run", side_effect=
    subprocess.TimeoutExpired(cmd=["pnpm", "audit"], timeout=300))`로 `run_audit()`을 직접
    호출해 `SystemExit`가 code 2로 발생하는지 단언하는 테스트를 추가. 실제 300초 대기 없이
    분기를 직접 때릴 수 있다.

- **[WARNING]** `load_override_targets()`의 `yaml.safe_load()` 호출이 파싱 예외를 잡지 않아, 구문이 깨진 `pnpm-workspace.yaml`이 스크립트 자신의 fail-closed 계약을 우회한다
  - 위치: `scripts/check-override-floors.py:121` (`load_override_targets()`)
  - 상세: 같은 함수 안에서 "`overrides` 키 부재"는 직전 라운드 조치로 `_undecidable()`
    fail-closed 처리됐고(:122-130), `run_audit()`의 JSON 파싱(`json.loads`)도
    `JSONDecodeError`를 잡아 `_undecidable()`로 라우팅한다(:181-184) — 그러나 대칭적으로
    있어야 할 **YAML 파싱 실패** 방어가 이 함수에는 없다. `data = yaml.safe_load(path.
    read_text(encoding="utf-8")) or {}`가 어떤 try/except로도 감싸이지 않아, 문법이 깨진
    YAML(예: 탭 들여쓰기 혼용)을 주면 `yaml.scanner.ScannerError`(또는 `ParserError`)가
    처리되지 않은 채 그대로 전파된다.
    **실측(직접 프로브)**: 스크립트 사본을 임시 디렉터리에 배치하고 탭 문자가 섞인 잘못된
    `pnpm-workspace.yaml`을 준 뒤 실제로 서브프로세스 실행 — `yaml.scanner.ScannerError`
    traceback과 함께 **exit code 1**로 종료됨을 직접 확인했다. 이 스크립트 자신의 어휘로
    1은 "침식/확장 발견"을 의미하므로, 구문 오류로 인한 크래시가 정상적인 취약점 발견 신호와
    같은 exit 코드로 관측된다 — exit 코드만 보는 자동화(예: 알림 라우팅)는 두 경우를 구분할
    수 없다. `.claude/tests/test_override_floors.py`에도 이 입력 형태(문법 오류가 있는
    YAML)를 겨냥한 테스트가 없다 — `MissingOverridesKeyTest`는 문법적으로는 유효하지만 키가
    없거나 오타인 YAML만 다룬다.
  - 제안: `load_override_targets()`에서 `yaml.safe_load(...)` 호출을
    `try/except yaml.YAMLError`로 감싸 `_undecidable()`로 라우팅하고(`EXPECTED_SITES`를
    8→9로, `FailClosedSiteCountTest`와 모듈 docstring도 함께 갱신 필요), 탭 들여쓰기 등
    구문 오류가 있는 YAML 픽스처로 `MissingOverridesKeyTest`류에 회귀 테스트를 추가할 것을
    권장한다.

- **[INFO]** (긍정 관측) 직전 라운드(03_47_10)의 WARNING 2건은 이번 델타에서 전용 회귀 테스트로 닫혔다 — 뮤턴트 재현으로 직접 재검증
  - 위치: `.claude/tests/test_override_floors.py:388-411` (`ReturncodeInvariantTest`),
    `:414-434` (`MissingOverridesKeyTest`)
  - 상세: 커밋 `68e9064d3`("fix(harness): 5차 리뷰 조치 — returncode 불변식 · overrides 키
    부재 · audit timeout")가 두 WARNING을 모두 조치했다. `ReturncodeInvariantTest`는
    `run_with_stub_audit(..., stub_exit=1)` 파라미터를 새로 도입해, 스텁이 비-0으로 끝나도
    (a) 실제 취약점이 있으면 정상 분류(exit 1)되고 (b) 결과가 없으면 정상 통과(exit 0)함을
    양방향으로 고정한다. `MissingOverridesKeyTest`는 `overrides` 키 완전 부재·오타
    (`override:`)·존재하지만 빈 `overrides: {}`(허용돼야 함, 경계값) 세 케이스를 갈라 고정한다.
    **직접 검증**: 직전 라운드가 보고했던 것과 동일한 뮤턴트(`if proc.returncode != 0:
    _undecidable(...)`를 `out = proc.stdout.strip()` 앞에 삽입)를 재현해 33개 테스트를
    재실행 — 이번에는 `ReturncodeInvariantTest`의 두 테스트와 `FailClosedSiteCountTest`
    (호출 지점 수가 8→9로 늘어난 부수 효과)에서 정확히 FAIL, 총 3건 실패로 뮤턴트가 잡힘을
    확인했다(직전 라운드는 28개 전부 GREEN이었던 것과 대비). 검증 후 원본 복원.
  - 제안: 조치 불요. 수렴 근거 기록 목적.

- **[INFO]** `MissingOverridesKeyTest.test_typo_key_is_undecidable`가 반환 코드만 단언하고 stderr 메시지 내용은 확인하지 않는다
  - 위치: `.claude/tests/test_override_floors.py:427-429`
  - 상세: 같은 클래스의 `test_missing_overrides_key_is_undecidable`(:422-425)는
    `self.assertIn("overrides", r.stderr)`까지 확인하는데, 오타 키(`override:`) 케이스는
    `self.assertEqual(r.returncode, 2, ...)`만 있다. exit 코드만 보면, 이 오타 경로가 실수로
    다른 `_undecidable()` 호출(예: 워크스페이스 파일 부재용 메시지)로 잘못 합쳐져도 이 테스트는
    여전히 통과한다 — 진단 메시지 정확성의 회귀는 못 잡는다.
  - 제안: 우선순위 낮음. `self.assertIn("overrides", r.stderr)` 한 줄 추가로 보강 가능.

## 기존 테스트 스위트에 대한 평가 (참고)

`.claude/tests/test_override_floors.py`는 여전히 이례적으로 견고하다. PATH 기반 `pnpm` 스텁
(실제 서브프로세스 경계는 유지한 채 외부 명령만 대체)은 `unittest.mock`으로 내부 함수를
모킹하는 것보다 실제 동작과의 괴리가 작고, 각 테스트가 `tempfile.TemporaryDirectory()`와
복사된 `env` dict로 완전히 격리돼 순서 의존성이 없다(실행 순서를 바꿔도 안전).
`_load_module()`은 매 호출마다 스크립트를 다시 `exec`하므로 stale bytecode 캐시 문제도 없다.
클래스·메서드 docstring이 "왜"(실측된 어떤 버그를 막는지, 몇 번 틀렸는지)를 구체적으로
서술해 가독성도 높다. 위 WARNING 2건은 이 견고한 스위트에 대한 반박이 아니라, 그 스위트가
아직 닿지 않은 두 개의 구체적 사각지대(둘 다 "예외가 `_undecidable()` 계약을 우회한다"는
동일 계열)다.

## 요약

`scripts/check-override-floors.py`는 5차에 걸친 리뷰-조치 사이클로 커버리지 밀도가 이례적으로
높아졌다(33개 실측-근거 테스트, 8개 fail-closed 지점 중 7개가 직접 실행-단언으로 검증됨).
이번 라운드에서 뮤턴트 재현으로 검증한 결과 직전 라운드의 WARNING 2건(returncode 불변식·
overrides 키 부재)은 완전히 닫혔다. 그러나 같은 방법론을 8번째 fail-closed 지점(레지스트리
타임아웃)에 적용하자 동일한 실패 클래스가 재현됐다 — 33개 테스트 전부가 타임아웃 예외 처리의
파손을 감지하지 못했다. 추가로 직접 프로브를 통해, JSON 출력 파싱(`run_audit`)에는 있는 파싱
실패 방어가 대칭 위치인 YAML 입력 파싱(`load_override_targets`)에는 없음을 실제 크래시
(uncaught `yaml.scanner.ScannerError`, exit 1)로 확인했다. 두 갭 모두 이 스크립트가 스스로
막으려는 핵심 실패 클래스인 "취약점 0건과 구별 안 되는 조용한 성공"은 **아니다** — 둘 다
결국 비-0으로 종료돼 CI는 빨간불이 된다. 다만 스크립트가 나머지 모든 곳에서 정교하게 지키는
exit 코드 분류(1=침식/확장 발견, 2=판단 불가) 계약을 이 두 지점에서만 우회해, 오분류 또는
raw traceback 노출로 진단 가치가 떨어진다는 점에서 사소하지 않다. 테스트 격리·가독성·모킹
적절성은 전반적으로 모범적이라 별도 우려가 없다.

## 위험도

MEDIUM
