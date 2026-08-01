# 테스트(Testing) 리뷰 — scripts/check-override-floors.py (7차 라운드)

## 스코프 메모

이번 라운드의 리뷰 대상 파일 목록(21개) 중 20개는 `review/code/2026/08/01/{03_47_10,04_09_43}/`
아래의 **직전 두 리뷰 세션 산출물**(SUMMARY.md·meta.json·_retry_state.json·에이전트별 리포트)이고,
실제 소스는 `scripts/check-override-floors.py` 1개뿐이다. 전자는 실행 가능한 코드가 아니므로
"테스트" 관점에서 다룰 대상이 아니다 — 직전 두 라운드의 testing 리포트가 이미 채택한 스코프
판단과 일치한다. JSON 4개(`meta.json`×2, `_retry_state.json`×2)는 구조 유효성만 `json.load`로
스팟체크했고 이상 없음을 확인했다.

`scripts/check-override-floors.py`의 실제 테스트는 `.claude/tests/test_override_floors.py`
(632줄, **38개** 테스트)에 있다. 이번 라운드 파일 목록에도 포함되지 않았지만
(`.claude/**`를 코드 리뷰 게이트 스코프에서 제외하고 `harness-checks.yml`로 별도 게이트하는
기존 정책과 일치 — `paths:`에 `scripts/check-override-floors.py` 명시 등재 확인 완료), 아래
발견사항은 그 테스트 파일을 직접 읽고 **실제 뮤턴트 주입**으로 검증한 결과다.

### 직전 두 라운드 WARNING 5건 — 재검증 결과: 전건 조치 확인

커밋 `68e9064d3`(5차 조치)·`1598f542f`(6차 조치)가 5건(returncode 불변식 미검증·`overrides` 키
부재 미검증·`overrides` 값 타입 미검증·`TimeoutExpired` 분기 미검증·`yaml.safe_load` 예외 미처리)을
각각 `ReturncodeInvariantTest`/`MissingOverridesKeyTest`/`AuditTimeoutTest`로 회귀 고정했음을
소스 대조로 확인했다. 베이스라인 스위트(38개)를 직접 재실행해 GREEN을 재확인했다 — 회귀 없음.

## 발견사항

- **[WARNING]** `main()`의 `widened` 계산에서 "override 미대상은 건너뛴다" 가드가 어떤 테스트로도 검증되지 않는다
  - 위치: `scripts/check-override-floors.py:290-291` (`if module not in targets: continue`,
    `main()`의 `widened` 계산 루프 288-296행 내부)
  - 상세: `suppressed`(= `actions_with_module` 중 `reported`에 없는 것)는 `ignoreCves`로 억제된
    항목의 module 목록인데, `ignoreCves`는 CVE-ID 단위 **전역** 억제라 override 로 관리 중이 아닌
    패키지도 얼마든지 여기 섞여 들어올 수 있다(스크립트 자신의 docstring, `main()` 249-252행
    주석 참조). 이 gate 는 override-미관리 패키지를 `main()`의 288-296행에서 건너뛰어야
    하는데, 이를 검증하는 테스트가 없다.
    **실측(mutation)**: `if module not in targets:` 를 `if False:`(가드 무력화)로 바꿔 넣고
    `.claude/tests/test_override_floors.py` 38개 테스트를 전부 재실행 — **38개 전부 GREEN
    유지**됨을 직접 확인했다. `SuppressedPathBaselineTest`/`CombinedReportTest` 등 `widened`
    경로를 건드리는 모든 테스트가 `actions[]`의 module 을 예외 없이 override-managed 패키지
    (`brace-expansion`)로만 고정해서, 이 가드가 실제로 "참"이 되는 입력(override 미관리 패키지가
    `actions[]`에 등장하는 경우)이 스위트 전체에 단 한 번도 없다. 이 가드가 깨지면 override
    와 무관한 패키지가 `EXPECTED_SUPPRESSED_PATHS.get(module, set())`(빈 집합 기본값)와
    대조되어 거의 항상 "신규 경로"로 오판되고, 본 가드의 명시된 범위("override 미대상 취약 →
    audit 잡 담당, 본 가드 범위 밖")를 벗어난 **거짓 실패**로 CI 를 붉게 만든다 — "취약점
    0건과 구별 안 되는 조용한 성공"의 핵심 위험은 아니지만, 스크립트 자신이 지키기로 선언한
    범위 경계를 조용히 넘어서는 회귀를 이 스위트가 못 잡는다는 점에서 사소하지 않다. 검증 후
    원본 파일은 백업에서 `cp`로 즉시 복원했고(`git checkout` 미사용), `git status` 클린 +
    38/38 GREEN 을 재확인했다.
  - 제안: `SuppressedPathBaselineTest`(또는 신규 클래스)에 override 미관리 모듈이
    `actions[]`에 (임의 경로로) 등장해도 `widened`에 포함되지 않는지(`returncode == 0` 또는
    최소한 그 모듈명이 stderr 에 없는지) 확인하는 케이스를 추가한다. `ClassificationTest`의
    `test_advisory_on_unmanaged_package_passes`(eroded 축의 동일 가드에 대한 대응 테스트)와
    대칭을 이루도록 짜면 된다.

- **[WARNING]** `EXPECTED_SUPPRESSED_PATHS`에 아직 등록되지 않은 override-대상 모듈이 처음 억제되는 경로가 검증되지 않는다
  - 위치: `scripts/check-override-floors.py:293` (`allowed = EXPECTED_SUPPRESSED_PATHS.get(module, set())`)
  - 상세: `SuppressedPathBaselineTest`(및 `widened`을 건드리는 다른 모든 테스트)는 예외 없이
    `EXPECTED_SUPPRESSED_PATHS`에 실제로 등록된 유일한 키인 `"brace-expansion"`만 사용한다.
    그 결과 `.get(module, set())`의 **기본값(`set()`) 분기** — 즉 "override 로 관리 중인데
    `EXPECTED_SUPPRESSED_PATHS`에는 아직 한 번도 등재되지 않은 모듈이 새로 억제된" 경우 — 는
    스위트에서 한 번도 관측되지 않는다.
    **실측(mutation)**: `EXPECTED_SUPPRESSED_PATHS.get(module, set())`를
    `EXPECTED_SUPPRESSED_PATHS.get(module, actual)`(미등록 모듈은 "이미 수용된 경로 = 지금
    들어온 경로 전부"로 기본 취급 — 즉 미등록 모듈에 대해 `widened`가 영원히 안 뜨게 만드는
    뮤턴트)로 바꿔 넣고 38개 테스트를 재실행 — **이번에도 38개 전부 GREEN 유지**됨을 확인했다.
    이 뮤턴트는 이 스크립트가 스스로 존재 이유로 꼽는 바로 그 실패 클래스("설정이 깨졌는데
    취약점 0건과 구별 안 되는 조용한 성공")의 정확한 재현이다 — override 로 관리 중인 패키지가
    사람이 아직 검토·등재하지 않은 새 `ignoreCves` 경로로 처음 억제돼도 아무도 모르게 통과한다.
    검증 후 `cp`로 원본 복원, `git status` 클린 + 38/38 GREEN 재확인.
  - 제안: `MANAGED_OVERRIDES`(예: `liquidjs`)처럼 override-관리 대상이지만
    `EXPECTED_SUPPRESSED_PATHS`에는 키가 없는 모듈을 `actions[]`에 넣어, 어떤 경로를 주든
    (baseline 이 없으므로) 항상 `widened`로 fail 하는지 확인하는 회귀 테스트를 추가한다. 위
    WARNING과 같은 9줄짜리 루프(288-296행)에서 나온 갭이므로 한 테스트 클래스에 두 케이스를
    같이 추가하는 것을 권장한다.

- **[INFO]** `load_override_targets()`의 진단 메시지 조립이 비-문자열 최상위 YAML 키가 섞이면 그 자체로 `TypeError`를 낼 수 있다 (좁은 이중 조건)
  - 위치: `scripts/check-override-floors.py:143` (`sorted(data)[:_KEY_PREVIEW] if isinstance(data, dict) else ...`)
  - 상세: `overrides`가 매핑이 아니어서 `_undecidable()`로 fail-closed 하는 그 진단 메시지 자체가
    `sorted(data)`를 호출한다. `data`(YAML 최상위 매핑)의 키가 전부 문자열이면 문제없지만,
    PyYAML 기본 리졸버는 YAML 1.1 규칙에 따라 `on`/`off`/`yes`/`no`/`true`/`false`(대소문자
    무관)를 unquoted 로 두면 불리언으로 해석한다 — 이런 키가 `overrides` 파싱 실패와 **동시에**
    존재하면 `sorted()`가 `bool`과 `str`을 비교하려다 `TypeError`로 죽는다.
    **실측(직접 프로브)**: `yaml.safe_load('overrides: "liquidjs"\\non: true\\n')` →
    `{'overrides': 'liquidjs', True: True}`, 이어서 `sorted(data)` 호출 시
    `TypeError: '<' not supported between instances of 'bool' and 'str'`를 직접 재현했다.
    핵심 위험("조용한 성공")은 아니다 — 어차피 exit 0 이 아니라 비정상 종료(파이썬 기본 exit 1,
    traceback 포함)로 끝나 CI 는 여전히 빨간불이다. 다만 이 스크립트가 다른 곳에서 반복적으로
    경계해 온 "exit 1 = 침식 발견"과 raw traceback 이 같은 코드로 섞이는 문제(이번 라운드
    이전에 YAML 파싱 실패에서 이미 한 번 지적·수정된 바로 그 종류)가 이 진단 메시지 조립
    지점에서 한 겹 더 남아 있다. 트리거 조건이 "overrides 파싱 실패"와 "비문자열 최상위 키
    동시 존재"라는 두 조건의 동시 충족이라 실무에서 마주칠 확률은 낮다.
  - 제안: 급하지 않음. 여유가 있으면 `sorted(data, key=str)`처럼 비교 가능한 키로 정규화하거나,
    `[str(k) for k in data][:_KEY_PREVIEW]`로 바꿔 타입 혼합 시에도 진단 메시지 자체가 죽지
    않게 만드는 정도로 충분하다.

## 기존 테스트 스위트에 대한 평가 (참고)

`.claude/tests/test_override_floors.py`는 7차 라운드에 이르러서도 이례적으로 견고하다. PATH
기반 `pnpm` 스텁(서브프로세스 경계는 유지한 채 외부 명령만 대체)은 실제 동작과의 괴리가 작고,
`AuditTimeoutTest`만 예외적으로 `unittest.mock.patch.object(mod.subprocess, "run", ...)`를
쓰는데 이는 클래스 docstring이 밝히듯 300초 실대기를 피하기 위한 의도된 예외이며 정당하다.
각 테스트가 `tempfile.TemporaryDirectory()`와 복사된 `env` dict로 완전히 격리돼 순서
의존성이 없고, `_load_module()`이 매 호출마다 스크립트를 다시 `exec`해 stale bytecode 캐시
문제도 없다. `FailClosedSiteCountTest`가 `_undecidable()` 호출 수(9)를 소스에서 직접 세어
docstring·README 수치 drift를 자동 차단하는 설계는 여전히 유효하며, 실제로 두 라운드
연속(5차→6차) 문서 갱신을 강제한 실적이 있다. 위 WARNING 2건은 이 견고한 스위트에 대한 반박이
아니라, 지금까지 6차례 리뷰가 집중해 온 `run_audit()`/`load_override_targets()`/
`classify_vulnerable()`의 fail-closed 경계와 달리, **`main()`의 `widened` 계산 루프
(288-296행) 자체의 필터 로직**은 이번이 처음으로 뮤턴트 검증을 받는 지점이라는 사실을 반영한다.

## 요약

`scripts/check-override-floors.py`는 6차에 걸친 리뷰-조치 사이클을 거치며 `_undecidable()` 9개
fail-closed 지점 전부와 returncode 불변식이 뮤턴트로 검증된 회귀 테스트로 고정된 상태이고,
이번 라운드에서 재실행한 베이스라인(38/38 GREEN)으로 5·6차 WARNING 5건이 전부 해소됐음을
재확인했다. 다만 지금까지의 리뷰가 손대지 않았던 `main()`의 `widened` 계산 루프(288-296행,
9줄)를 대상으로 직접 뮤턴트 2종을 주입한 결과 둘 다 38개 테스트 전부를 통과시켰다 — (1)
override 미관리 패키지를 건너뛰는 가드가 깨지면 무관한 패키지가 거짓으로 fail 되고, (2)
override-관리 대상이지만 `EXPECTED_SUPPRESSED_PATHS`에 아직 등록 안 된 모듈이 새로 억제되면
이 스크립트가 스스로 막으려는 "조용한 성공"이 그대로 재현된다. 두 갭 모두
`SuppressedPathBaselineTest`가 `EXPECTED_SUPPRESSED_PATHS`의 유일한 실제 등록 키
(`brace-expansion`)만 픽스처로 계속 재사용해 온 데서 비롯됐다. 추가로 `load_override_targets()`
진단 메시지 조립부에 비문자열 최상위 YAML 키가 동시에 섞이면 TypeError로 죽을 수 있는 좁은
이중 조건 결함을 직접 프로브로 확인했다(INFO, 핵심 불변식 위반은 아님). 테스트 격리·가독성·
Mock 적절성은 전반적으로 모범적이라 별도 우려가 없다.

## 위험도

MEDIUM
