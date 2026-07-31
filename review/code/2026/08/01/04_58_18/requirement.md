# 요구사항(Requirement) 리뷰 — deps-guard-hardening (8차 라운드, 04_58_18)

## 검토 방법

이번 라운드 페이로드 31개 중 30개는 5~7차 `/ai-review` 세션(`review/code/2026/08/01/
{03_47_10,04_09_43,04_35_33}/`)의 산출물(정적 markdown/JSON)이고, 실 코드는
`scripts/check-override-floors.py` 1개뿐이다. 프롬프트에는 이 파일의 diff/전체 내용이 크기
제한으로 실리지 않아 `Read`로 저장소 현재 파일(364줄)을 직접 열었다. `git log`로 확인한 결과
직전 라운드(7차, `04_35_33`) 이후의 실제 코드 델타는 커밋 `fdc7ad801`("7차 리뷰 조치") 하나이며,
`scripts/check-override-floors.py` 안의 순변경은 `sorted(data)` → `sorted(data, key=str)` +
근거 주석 2줄뿐이고, 7차 WARNING 2건(`main()`의 `widened` 필터 무검증)은 `.claude/tests/
test_override_floors.py`에 `WidenedFilterTest`(2개 테스트, 라우터 스코프 밖)를 신설하는 것으로
조치됐다.

다음을 직접 실행/대조로 검증했다: (1) 실제 저장소 상태로 `python3 scripts/check-override-floors.py`
라이브 실행(`OK: override 대상 26개 패키지 중 취약 재유입 0건`, exit 0 — `pnpm-workspace.yaml`을
스크립트 자신의 `load_override_targets()`로 직접 계산해 26개 일치 재확인), (2) `grep -n
"_undecidable("` 로 fail-closed 지점 9곳 재실측(정의부 제외) — `.claude/tests/
test_override_floors.py`의 `EXPECTED_SITES=9`/"아홉", `.claude/tests/README.md`의 "Nine",
`plan/in-progress/deps-guard-hardening.md:174`의 "8곳 → 9곳"과 전부 일치, (3) `spec/` 전체
grep(`override-floors`/`override_floors`/`check-override-floors`/`바닥 침식`) 0건 — `spec_impact:
none`과 일치, (4) `scripts/check-override-floors.py` 전체 `grep -inE "TODO|FIXME|HACK|XXX"` 0건,
(5) `.claude/tests/test_override_floors.py`(666줄, 40개 테스트)를 `python3 -m unittest discover`로
반복 실행.

## 발견사항

- **[WARNING]** 회귀 스위트가 전체 실행 시 간헐적으로(비결정적) FAIL 한다 — `WidenedFilterTest.
  test_managed_module_absent_from_baseline_always_widens`. 근본 원인 미확정.
  - 위치(게이트 스코프 밖, `.claude/**` — 5~8차 선행 라운드들과 동일하게 "요구사항 충족의 증거
    기반" 검증 목적으로 직접 확인): `.claude/tests/test_override_floors.py:416-421`
    (`WidenedFilterTest.test_managed_module_absent_from_baseline_always_widens`). 대상 프로덕션
    코드는 `scripts/check-override-floors.py:290-298`(`main()`의 `widened` 계산 루프).
  - 상세: `python3 -m unittest discover -s .claude/tests -p 'test_override_floors.py'`(저장소
    루트에서, 수정 없는 현재 코드 대상)를 총 **50회** 반복 실행한 결과 **1회** 다음과 같이
    실패했다 —

    ```
    FAIL: test_managed_module_absent_from_baseline_always_widens
    AssertionError: 0 != 1 : OK: override 대상 1개 패키지 중 취약 재유입 0건 ...
    ```

    이 테스트는 override 대상(`liquidjs`)이 `EXPECTED_SUPPRESSED_PATHS`에 등록되지 않은 채
    억제되면 **반드시** `widened`로 fail(returncode 1)해야 함을 고정하는데, 이 1회에서는 exit
    0("OK")로 끝났다 — 스텁이 정상 동작했다면 나올 수 없는 결과다. 이후 49회는 전부 GREEN이었다
    (≈2% 재현율). **같은 시나리오만 전체 스위트 없이 격리해 직접 60회 반복 호출**했을 때는 0/60로
    한 번도 재현되지 않아, 격리 실행보다는 전체 스위트 특유의 무언가(여러 테스트 클래스가 짧은
    시간에 `tempfile.TemporaryDirectory()`·서브프로세스를 연속 생성하는 패턴)와 관련 있을
    가능성을 시사하지만, 반복 시도(전체 스위트 49회 추가 + 격리 60회, 총 109회 추가 시도)로는
    조건을 다시 못 잡아 확정하지 못했다.

    가장 유력해 보였던 가설 — 이 개발 환경 PATH에 실제로 존재하는 시스템 `pnpm`(`which pnpm` →
    nvm 경유 바이너리 확인됨)이, 막 `chmod`된 스텁보다 먼저 실행되는 경합(TOCTOU) — 은 직접
    프로브로 **반증**했다: 락파일 없는 빈 임시 디렉터리에서 실제 `pnpm audit --json`을 실행하면
    `{"error": {"code": "ERR_PNPM_AUDIT_NO_LOCKFILE", ...}}`(exit 1, `actions` 키 없음)을 내어
    `run_audit()`의 스키마 검사(`scripts/check-override-floors.py:201`)에 걸려 **exit 2(판단
    불가)**가 됐을 것이다. 관측된 결과는 **exit 0("OK")**이므로 이 가설과 맞지 않는다 — 즉
    스텁이 아닌 다른 무언가가 실행됐다면 그것은 이 반증 사례와는 다른 경로다.

    CI 영향 범위는 제한적으로 보인다: `.github/workflows/harness-checks.yml`의 `unittest` 잡은
    `actions/setup-node`(pnpm 관련 설치 없음, 애초에 `pnpm`이 이 잡에 설치되지 않음)를 unittest
    실행 스텝(84-85행) **이후**에 두므로, 이 잡의 PATH에는 처음부터 경합할 실제 `pnpm` 바이너리가
    없다 — 위에서 반증한 경합 메커니즘은 최소한 이 형태로는 CI에서 재현되지 않을 것으로 판단한다.
    다만 근본 원인 자체를 확정하지 못했으므로 CI에 전혀 영향이 없다고 단정할 근거는 아니다.

    이 관측이 requirement 관점에서 의미를 갖는 이유: 이 리뷰 체인의 1~8차 전 라운드가 "뮤턴트
    주입 → 전체 스위트 재실행 → GREEN/RED 관찰"을 요구사항 충족(버그 수정, 회귀 방지)의 **1차
    증거**로 반복 사용해 왔다(이번 8차 testing.md도 동일 방법론). 이 스위트에 비결정적으로
    실패하는 실행 경로가 최소 1건 실재한다는 것은, 단발성 실행 결과("N/N GREEN")를 결정론적
    증명으로 계속 신뢰하기 전에 재현율을 한 번은 정밀 특정해 둘 필요가 있음을 뜻한다 — 특히 이번
    라운드가 `RESOLUTION.md`(라운드 1~7 통합, 이미 커밋됨)에 이어 push 직전 최종 검증 라운드로
    보이는 시점이라는 점에서 그렇다.
  - 제안: (1) `run_with_stub_audit()` 반복 호출(전체 discover가 아니라 Python 레벨에서 여러
    테스트 클래스의 tempdir 생성 패턴을 재현하는 형태)로 500회 이상 스트레스 실행해 재현율을
    더 정밀하게 특정한다. (2) 재현 시 실제로 어떤 바이너리가 실행됐는지 자체 진단이 가능하도록
    스텁 진입 시 마커 파일을 쓰게 임시 계측하거나 stdout/stderr를 전량 캡처한다. (3) 원인이
    파일시스템 I/O 타이밍(`fake.chmod(0o755)` 직후 실행 가능 여부 판정 경합)이라면
    `run_with_stub_audit()`에 `chmod` 직후 `os.access(fake, os.X_OK)`를 확인하는 assert를
    추가해 향후 회귀를 조기에 자체 진단하게 한다. 근본 원인이 이 개발 환경(네트워크 마운트
    볼륨 등)에 특유한 것으로 판명되면 CI 리스크는 낮다고 재확인하고 이 항목을 낮은 우선순위로
    재분류할 수 있다.

## 그 외 확인한 항목 (7차 조치 재검증, 이상 없음)

- **7차 WARNING 2건 조치 확인**: `WidenedFilterTest`의 두 테스트가 각각 지목된 뮤턴트를
  정확히 겨냥함을 코드 대조로 재확인했다 — `test_unmanaged_module_is_not_widened`은
  `scripts/check-override-floors.py:292`(`if module not in targets: continue`)가 없으면
  override 미관리 패키지가 거짓 fail을 유발하는 것을 잡고, `test_managed_module_absent_
  from_baseline_always_widens`는 `:295`(`EXPECTED_SUPPRESSED_PATHS.get(module, set())`)의
  기본값이 뒤집히면(신규 억제가 "이미 수용됨"으로 조용히 통과) 이를 잡도록 짜여 있다 — 이는
  위 WARNING과 별개로, 코드·테스트의 **의도된 로직 자체**는 정확함을 뜻한다(관측된 flake는
  하네스 실행 신뢰성 문제이지 이 로직의 결함이 아니다).
- **7차 INFO 11(`sorted()` TypeError) 조치 확인**: `scripts/check-override-floors.py:145`의
  `sorted(data, key=str)`가 `isinstance(data, dict)` 가드 안에서만 호출되고, 문자열 키만 있는
  통상 케이스에서는 `key=str` 적용 전후로 정렬 결과가 동일해 행동 보존적임을 코드 추적으로
  확인했다. (테스트 커버리지 부재는 이번 라운드 testing.md가 이미 WARNING으로 정확히 짚었으므로
  본 리뷰에서 중복 보고하지 않는다.)
- **기능 완전성**: `chain_segments`/`override_target`/`load_override_targets`/`run_audit`/
  `classify_vulnerable`/`main` 전체 흐름을 재추적 — widened(수용 범위 밖 재유입)/eroded(바닥
  침식) 2분류, 9곳 fail-closed가 plan §1 목적과 정확히 일치.
  `EXPECTED_SUPPRESSED_PATHS`(`brace-expansion` 1건)와 `pnpm-workspace.yaml`의
  `auditConfig.ignoreCves`(js-yaml, brace-expansion 2건) 대조 결과 정합 — js-yaml은 이론상
  `widened` 오탐 후보이나 lockfile상 이미 패치 버전으로 해소돼 `actions[]`에 나타나지 않음을
  이전 라운드가 실측했고 이번에도 동일 결론.
- **엣지 케이스**: `overrides: {}`/`null`/오타/비-매핑, YAML 파싱 실패, 레지스트리 타임아웃,
  advisories/actions 스키마 드리프트 2계열, 8가지 override 키 형태(체인·레인지·scope 조합) —
  전부 코드·테스트 양쪽으로 커버됨을 재확인.
- **TODO/FIXME/HACK/XXX**: `scripts/check-override-floors.py` 전체 0건(직접 재확인).
- **의도와 구현 간 괴리**: `_undecidable()`→`NoReturn`+`sys.exit(2)`, `classify_vulnerable()`→
  `(reported, suppressed)` 튜플 계약, `load_override_targets()`의 "한 자리에서 가른다"는
  docstring 서술과 `isinstance(overrides, dict)` 단일 조건이 정확히 일치.
- **에러 시나리오**: `_undecidable(` 호출 9곳(레지스트리 타임아웃·빈 출력·JSON 파싱 실패·
  `actions` 키 부재·`advisories`/`actions` 하위 필드 드리프트·워크스페이스 파일 부재·YAML 파싱
  실패·`overrides` 비매핑) 전부 exit 2로 고정, `FailClosedSiteCountTest`가 소스 실측과 결속.
- **데이터 유효성**: `load_override_targets()`가 키 부재·오타·값 없음(`None`)·비매핑(문자열/
  리스트)을 `isinstance(overrides, dict)` 단일 조건으로 fail-closed. `run_audit()`은 JSON 파싱
  실패·`actions` 키 부재를 별도 검증.
- **비즈니스 로직**: "override 대상+취약 → eroded(판단 불필요)" vs "override 미대상 취약 →
  audit 잡 담당(범위 밖)" vs "ignoreCves 억제분 중 경로 확대만 → widened" 3분류가 `main()`의
  계산과 정확히 일치. `suppressed`는 `reported`(eroded 대상)를 배제하고 구성되므로 한 모듈이
  widened와 eroded에 동시에 잡히는 구조적 충돌은 없음(교집합 없음, 코드 추적으로 확인).
  (참고: `classify_vulnerable()`이 억제/비억제 CVE가 같은 모듈에 공존할 때 `widened` 상세를
  해당 실행에서 누락시킬 수 있다는 점은 6·7차 requirement 라운드가 이미 INFO로 정확히 특정해
  둔 사안이며 이번 델타로 변화가 없어 재론하지 않는다 — core fail-closed 불변식은 훼손되지
  않는다는 그때의 판단에 동의한다.)
- **반환값**: `main()`의 모든 도달 경로가 명시적 `int`(0/1)를 반환하거나 그 전에
  `_undecidable()`(`NoReturn`)이 프로세스를 종료. widened/eroded 동시 발생 시 조기 return 없이
  둘 다 보고 후 `return 1`(`CombinedReportTest`로 고정, 로컬 재확인 GREEN).
- **spec fidelity**: `spec/` 전체 grep 재실행 결과 관련 문서 0건. `plan/in-progress/
  deps-guard-hardening.md`의 `spec_impact: none`과 Rationale("CI·스크립트·설정 변경으로 제품
  명세와 무관")이 실제와 일치 — line-level spec-코드 대조 대상 자체가 없음(정상, 8차 연속
  동일 결론).

## 요약

이번 라운드의 실 코드 델타(`fdc7ad801`, `sorted(data) → sorted(data, key=str)` + 근거 주석)는
7차 WARNING 2건과 INFO 1건을 정확히 조치했음을 라이브 실행·코드 추적·뮤턴트 대상 재확인으로
검증했다 — override 대상 26개·fail-closed 9곳·spec 무관 모두 8차 연속 drift 없이 일치한다.
이번 라운드에서 새로 발견한 것은 프로덕션 로직이 아니라 회귀 스위트(`.claude/tests/
test_override_floors.py`, 라우터 스코프 밖) 실행 신뢰성이다 — 전체 스위트를 50회 반복 실행 중
1회, `WidenedFilterTest`의 한 테스트가 원인 불명으로 실패했다(≈2%, 이후 49회 및 추가 재현
시도 109회에서는 재현되지 않음). 가장 유력했던 "로컬 시스템 pnpm과의 PATH 경합" 가설은 직접
프로브로 반증했고, CI(`harness-checks.yml`)는 이 잡에 애초 pnpm을 설치하지 않아 최소한 이
메커니즘으로는 위협받지 않는 것으로 보이지만, 근본 원인은 확정하지 못했다. 이 스위트는 8회
라운드 내내 "뮤턴트 GREEN/RED"가 요구사항 충족의 1차 증거로 쓰여 왔으므로, push 직전인 이
시점에 재현율을 한 번 더 정밀 특정해 두는 것을 권장한다. 프로덕션 스크립트(`scripts/
check-override-floors.py`) 자체의 기능 완전성·엣지 케이스·에러 시나리오·비즈니스 로직·반환값은
모두 이상 없음을 독립적으로 재확인했고, 적용 가능한 제품 spec 문서는 없다(정상).

## 위험도

MEDIUM — Critical 없음, WARNING 1건(회귀 스위트의 간헐적·비결정적 실패, 근본 원인 미확정).
프로덕션 코드 자체의 결함은 아니고 실패 방향도 "조용한 성공"이 아닌 fail-safe(spurious
failure)이며 현재 CI 배선상 위협 경로는 반증됐으나, 재현율·근본 원인이 불확실한 상태로
남아 있어 낙관적으로 LOW로 낮추지는 않는다.
