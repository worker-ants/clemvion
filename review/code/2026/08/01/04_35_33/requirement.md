# 요구사항(Requirement) 리뷰 — deps-guard-hardening (7차 라운드)

## 검토 방법

이번 라운드 페이로드는 두 갈래다: (1) 5차(`03_47_10`)·6차(`04_09_43`) 리뷰 산출물 20개 파일(신규
커밋 편입), (2) `scripts/check-override-floors.py`(361줄, origin/main 대비 전체 신규 — 이 브랜치가
아직 머지되지 않아 누적 diff로 잡힘). `git log`로 커밋 이력(`68e9064d3` 5차 조치, `1598f542f`
6차 조치)을 확인하고, 저장소의 **현재 실제 파일**을 직접 `Read`해 6차 SUMMARY.md가 보고한
WARNING 3건(overrides 값 타입 미검증·YAML 파싱 예외 미처리·TimeoutExpired 미검증)이 실제로
해소됐는지 코드+테스트 양쪽으로 재검증했다. `.claude/tests/test_override_floors.py`를
`python3 -m unittest discover`로 직접 실행(38/38 PASS)했고, `.github/workflows/
{deps-security-checks,harness-checks}.yml`·`plan/in-progress/deps-guard-hardening.md`·
`pnpm-workspace.yaml`·`spec/` 전체를 대조해 배선·spec 정합을 확인했다. `.claude/**`는 코드 리뷰
게이트 스코프 밖(기존 정책, 6차 testing.md 및 이번 라운드 router 파일 목록과 일치)이라 이 리뷰의
발견사항 위치 인용은 게이트 대상 파일(`scripts/check-override-floors.py`)로 한정했다.

## 발견사항

- **[INFO]** (재확인) 6차 WARNING 3건이 모두 현재 코드+전용 회귀 테스트로 해소됨을 직접 실행으로 검증
  - 위치: `scripts/check-override-floors.py:128-144`(`load_override_targets()`의 YAML 예외 처리 +
    `isinstance(overrides, dict)` 검사), `:181,183-187`(`run_audit()`의 `timeout=_AUDIT_TIMEOUT_SEC`
    + `except subprocess.TimeoutExpired`)
  - 상세: (1) `overrides` 값 타입 미검증(6차 WARNING #1, security/requirement/side_effect 3인
    독립 발견) → `overrides = data.get("overrides") if isinstance(data, dict) else None` 후
    `if not isinstance(overrides, dict): _undecidable(...)`로 키 부재·오타·값 없음(`None`)·
    비-매핑(문자열/리스트)을 한 조건으로 통합, `overrides: {}`는 계속 허용. (2) `yaml.safe_load`
    예외 미처리(6차 WARNING #3, testing 발견) → `try/except yaml.YAMLError`로 `_undecidable()`
    라우팅. (3) `TimeoutExpired` 미검증(6차 WARNING #2, testing 발견) → `timeout=300` 인자 +
    except 절 추가. `_undecidable(` 호출부를 직접 세면 정확히 9곳(정의부 제외)이고,
    `.claude/tests/test_override_floors.py`(`EXPECTED_SITES=9`, docstring "아홉")·
    `.claude/tests/README.md`("Nine")와 일치한다. `MissingOverridesKeyTest`(값 없음·비매핑·빈
    매핑·오타 키 4가지 분기)·`AuditTimeoutTest`(SystemExit code 2 단언 + `timeout=` 인자가 실제
    전달되는지 별도 단언)·`test_unparseable_yaml_is_undecidable_not_exit_1` 등 전용 회귀 테스트를
    포함해 38개 전체를 로컬 실행해 통과를 확인했다(신규 발견 아님 — 6차에서 지적된 항목이 이번
    라운드에서 정확히 조치됐음을 확인하는 목적).
  - 제안: 조치 불요. 수렴 근거 기록.

- **[INFO]** `classify_vulnerable()`의 `suppressed` 판정이 모듈 단위로 이뤄져, 같은 모듈에 "억제되지
  않은 CVE"와 "억제된 CVE"가 동시에 존재하면 후자의 `widened` 상세가 그 실행의 보고에서 누락될 수
  있다 (핵심 fail-closed 불변식은 깨지지 않음)
  - 위치: `scripts/check-override-floors.py:234-239`(`reported` 구성), `:241-247`(`suppressed`
    구성, 특히 `:245` `if module not in reported:`)
  - 상세: `suppressed`는 `action["module"]`이 `reported`에 없는 경우에만 채워진다. 만약 한 모듈이
    CVE-A(‵ignoreCves`로 억제, `advisories`에서 사라졌지만 `actions[]`엔 경로가 남음)와 CVE-B(억제
    안 됨, `advisories`에 살아있어 그 모듈을 `reported`에 포함)를 동시에 가지면, `actions[]`을
    순회할 때 그 모듈에 해당하는 모든 `resolves[].path`(CVE-A분 포함)가 `module not in reported`
    조건에서 걸러져 `suppressed`에 전혀 기록되지 않는다 — 결과적으로 CVE-A의 경로가
    `EXPECTED_SUPPRESSED_PATHS` 대비 늘어났어도(수용 범위 밖 재유입) 이번 실행의 `widened` 보고에는
    나타나지 않는다. 다만 이 시나리오에서 해당 모듈은 CVE-B 때문에 이미 `reported`→`eroded`로
    분류돼 `main()`이 exit 1로 fail하므로(둘 다 계산 후 한 번에 보고하는 기존 설계, `:303-317`),
    이 스크립트가 막으려는 핵심 실패 클래스인 "취약점이 있는데 조용히 통과"는 재현되지 않는다 —
    CI는 정확히 빨간불이 된다. 영향받는 것은 그 특정 실행에서 진단 메시지가 "widened" 상세를 함께
    보여주지 못한다는 완결성뿐이며, `eroded`(CVE-B) 문제가 먼저 해소되고 CVE-A만 남은 다음 실행에서는
    `module not in reported`가 참이 되어 `widened` 검사가 정상 작동한다(영구적 회피가 아니라 일시적
    은닉). `.claude/tests/test_override_floors.py`에 이 "한 모듈에 억제+비억제 CVE 동시 존재" 조합을
    겨냥한 테스트는 없다(`test_actions_all_overlapping_reported_is_not_drift`는 **같은** CVE가
    advisories/actions 양쪽에 겹치는 정상 케이스만 다룬다).
  - 제안: 우선순위 낮음(fail-closed 불변식 미훼손). 여유가 있으면 `suppressed`를 모듈이 아니라
    (module, advisory 경로 집합) 단위로 분리하거나, `reported`와 무관하게 `actions[]`의 모든 경로를
    수집한 뒤 `widened` 계산 시점에 "이미 eroded로 분류된 모듈은 별도 표시"하는 식으로 두 축을
    독립시키는 것을 검토. 급한 조치는 아니며 회귀 테스트 케이스로 문서화해두는 정도로 충분.

- **[INFO]** spec fidelity — 관련 제품 spec 문서 없음 (재확인)
  - 위치: `spec/` 전체 grep 결과 `override-floors`/`override_floors`/`check-override-floors`/
    `바닥 침식` 매칭 0건.
  - 상세: `plan/in-progress/deps-guard-hardening.md` frontmatter의 `spec_impact: none`과
    Rationale("CI·스크립트·설정 변경으로 제품 명세와 무관")이 실제와 일치한다. line-level
    spec-코드 대조 대상 자체가 없다 — 정상.
  - 제안: 없음.

## 그 외 확인한 항목 (이상 없음)

- **기능 완전성**: plan 체크리스트 §1(override-floors 스크립트+CI 잡 배선)·§2(`ignoreCves` 근거
  규약, `pnpm-workspace.yaml:71-85` 3종 요구사항 명문화 확인)·§3(dependabot 루트 등록) 전부 `[x]`
  이며 실제 파일 상태와 일치. `.github/workflows/deps-security-checks.yml`의 `override-floors` 잡이
  `python3 scripts/check-override-floors.py`를 정확히 호출하고(`timeout-minutes: 10` >
  `_AUDIT_TIMEOUT_SEC=300`), `harness-checks.yml`의 `paths:`에 `scripts/check-override-floors.py`가
  명시 등재돼 있다.
- **엣지 케이스**: `overrides: {}`(명시적 빈 매핑, 정상 통과) vs `overrides:`/`overrides: null`/
  비매핑(fail-closed) 경계가 `MissingOverridesKeyTest` 5종으로 정확히 갈라짐을 확인. 다단 체인·
  scope·레인지가 섞인 8가지 override 키 형태는 `OverrideTargetExtractionTest`(실제
  `pnpm-workspace.yaml` 대조 포함)로 커버.
- **TODO/FIXME/HACK/XXX**: `scripts/check-override-floors.py`에서 0건(직접 `grep -inE` 재확인).
- **의도와 구현 간 괴리**: `_undecidable()`→`NoReturn`+`sys.exit(2)`, `classify_vulnerable()`→
  `(reported, suppressed)` 튜플 계약, 각 함수 docstring과 실제 동작 일치.
- **에러 시나리오**: `_undecidable()` 호출 9곳(레지스트리 타임아웃·빈 출력·JSON 파싱 실패·`actions`
  키 부재·`advisories`/`actions` 하위 필드 드리프트·워크스페이스 파일 부재·YAML 파싱 실패·`overrides`
  비매핑) 전부 exit 2로 고정되고 `FailClosedSiteCountTest`가 소스의 호출 횟수를 세어 문서(docstring·
  `.claude/tests/README.md`)와의 drift를 자동 차단.
- **반환값**: `main()`의 모든 도달 경로가 명시적으로 `int`(0/1)를 반환하거나 그 전에
  `_undecidable()`이 `NoReturn`으로 프로세스를 종료. `widened`/`eroded`가 동시에 있어도 조기
  return 없이 둘 다 보고 후 return 1(`CombinedReportTest`로 고정).
- **비즈니스 로직**: "override 대상+취약 → eroded(판단 불필요)" vs "override 미대상 취약 →
  audit 잡 담당(범위 밖)" vs "ignoreCves 억제분 중 경로 확대만 → widened" 3분류가 `main()`의
  `widened`/`eroded` 계산과 정확히 일치. `EXPECTED_SUPPRESSED_PATHS`(`brace-expansion` 1건)와
  `pnpm-workspace.yaml`의 `auditConfig.ignoreCves`(js-yaml·brace-expansion 2건) 대조 결과 정합.
- **2-place 편집 규약**: `EXPECTED_SUPPRESSED_PATHS`(본 파일) ↔ `auditConfig.ignoreCves`,
  `_report_eroded()`가 가리키는 `check-pnpm-security-config.py`의 `EXPECTED_OVERRIDES` — 세 지점
  모두 현재 정합.
- **리뷰 산출물 파일 20개(5차·6차 라운드)**: 각 문서가 인용하는 라인 번호·발견사항·수치(`_undecidable`
  6→8→9곳, "여섯/Six"→"여덟/Eight"→"아홉/Nine")를 실제 코드·테스트와 교차 대조한 결과 사실관계
  불일치를 찾지 못했다. `_retry_state.json`의 stale 로컬 경로·`pending` 스냅샷은 이전 라운드가 이미
  dead field로 확인한 사항으로 재확인 불필요.

## 요약

`scripts/check-override-floors.py`는 7차례 리뷰-조치 사이클을 거치며 6차 라운드가 보고한 WARNING
3건(overrides 값 타입 미검증·YAML 파싱 예외 미처리·TimeoutExpired 분기 미검증)을 커밋
`1598f542f`에서 정확히 조치했음을 코드 직접 대조와 38개 회귀 테스트 실행(전부 PASS)으로
재검증했다. plan 체크리스트 §1~§3이 실제 코드·CI 배선과 일치하고, `spec_impact: none`이 legitimate함을
`spec/` 전체 grep으로 재확인했다. 이번 라운드에서 새로 찾은 것은 `classify_vulnerable()`의
모듈 단위 `reported`/`suppressed` 배타 처리가 "한 모듈에 억제된 CVE와 억제 안 된 CVE가 동시에
있는" 드문 조합에서 그 실행의 `widened` 진단 상세를 누락시킬 수 있다는 점 하나뿐이며, 이 경우도
같은 모듈이 이미 `eroded`로 분류돼 CI가 정확히 fail하므로 이 스크립트가 방어하는 핵심 불변식
("취약점이 있는데 조용히 통과")은 재현되지 않는다 — 완결성 수준의 INFO다. Critical·Warning은
발견되지 않았다.

## 위험도

LOW — Critical 0, Warning 0. 6차까지의 기능적 결함(fail-closed 우회 경로)이 전부 해소·테스트로
고정됐고, 이번 라운드가 새로 찾은 항목은 핵심 안전 불변식을 훼손하지 않는 진단 완결성 수준의 INFO
1건뿐이다.
