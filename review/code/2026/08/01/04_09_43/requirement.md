# 요구사항(Requirement) 리뷰 — deps-guard-hardening (6차 라운드)

## 검토 방법

이번 라운드 diff 는 두 종류로 구성된다: (1) 5차 리뷰(`03_47_10`)의 산출물 9개 파일(신규 커밋에
편입된 리뷰 아카이브), (2) `scripts/check-override-floors.py` 자체(347줄, origin/main 대비
전체 신규). `git log`/`git show`로 실제 커밋 이력(`68e9064d3` "5차 리뷰 조치")을 대조해, 5차
SUMMARY.md 가 지적한 Warning 2건(returncode 불변식 미검증, `overrides` 키 부재 fail-closed
누락) 과 INFO 1건(timeout 부재)이 **이 라운드에서 실제로 코드+테스트로 해소됐음을 커밋
diff·현재 소스·`.claude/tests/test_override_floors.py` 33건 실행·`pnpm-workspace.yaml` 대상
26개로 라이브 `pnpm audit` 재실행까지 4중으로 실측 확인**했다. 5차 리뷰 아카이브 파일들(문서화·
유지보수성·요구사항·범위·보안·부작용·테스트 리뷰) 자체는 해당 시점 상태를 정확히 기술하는
역사적 스냅샷이며, 서로 간·plan 문서·현재 코드와 대조해 사실관계 불일치를 찾지 못했다(예:
`.claude/tests/README.md`/`test_override_floors.py` docstring 이 "Eight"/"여덟"으로 갱신되어
fail-closed 지점 6→8곳 증가와 정확히 일치, `FailClosedSiteCountTest.EXPECTED_SITES = 8` 로
코드 결속 확인).

## 발견사항

- **[WARNING]** `load_override_targets()`의 이번 라운드 fail-closed 보강이 "`overrides` 키
  자체의 부재"만 좁혀 다루고, "`overrides` 키는 있지만 값이 매핑이 아닌" 형태(YAML list·
  문자열)는 여전히 조용한 오탐 통과를 허용한다 — 5차 리뷰가 지적하고 이번 라운드가 고친 W2
  (`overrides` 키 부재)의 형제 사각지대다.
  - 위치: `scripts/check-override-floors.py:119-134` (`load_override_targets()`), 특히
    `:122`(`if not isinstance(data, dict) or "overrides" not in data:` — 키 부재만 검사)와
    `:132`(`for key in data.get("overrides") or {}:` — 값 타입을 검증하지 않고 바로 순회)
  - 상세: 실제로 Python 으로 재현해 확인했다. `pnpm-workspace.yaml` 의 `overrides:` 가 매핑이
    아니라 리스트(`overrides:\n  - foo\n  - bar\n`)나 문자열(`overrides: bogus`)로 잘못
    편집되면, `:122`의 검사는 "overrides" 키가 **존재**하므로 통과시키고, `:132`의
    `data.get("overrides") or {}`는 리스트/문자열이 truthy 이므로 그대로 순회 대상이 된다.
    크래시 없이 `override_target(str(key))`가 각 리스트 원소·문자를 패키지명으로 오인해
    (`{"foo": [...], "bar": [...]}` 또는 문자 단위 `{"b": [...], "o": [...], ...}`) **말이
    되는 것처럼 보이는 가짜 target 딕셔너리**를 만들고, 이후 `classify_vulnerable()`/`main()`
    은 정상 흐름을 그대로 타 `OK: override 대상 N개 패키지 중 취약 재유입 0건`(exit 0)을
    출력한다 — 실제로는 override 목록 전체가 깨져 있어 어떤 진짜 override 대상도 검사되지
    않는데도 그렇다. 이는 이 파일 전체가 막으려는 정확한 실패 형태("설정 파싱이 깨졌는데
    취약점 0건과 구별되지 않는 성공")이며, 방금 해소된 W2(키 자체 부재)와 인접한 코드 경로에서
    발생한다는 점에서 우선순위가 낮지 않다. `.github/workflows/deps-security-checks.yml`의
    `override-floors` 잡(`:78-98`)은 `pnpm install` 없이 바로 이 스크립트를 실행하므로, 같은
    잡 안에서 `pnpm-workspace.yaml` 형식을 검증해 줄 선행 스텝도 없다 — INFO 로 격하할 만한
    상위 backstop(예: timeout 부재에 대한 CI job timeout 같은)이 이 경로엔 없다. 참고로
    `overrides` 값이 리스트/문자열이 아니라 정수 등 비反복 스칼라(`overrides: 5`)이면
    `TypeError: 'int' object is not iterable`로 크래시하여(비-0 종료, 조용한 통과 아님) 이미
    받아들여진 INFO(다른 스키마 드리프트 지점의 `AttributeError`)와 같은 급이지만, 이 예외가
    `main()`을 거치지 않고 그대로 전파돼 종료 코드가 `main()`이 정상적으로 반환하는 "침식
    발견"(1)과 동일한 값(uncaught exception 의 기본 종료 코드 1)이 되어 진단 품질이 떨어진다.
    `MissingOverridesKeyTest`(`.claude/tests/test_override_floors.py:414-434`)에는 이 값-타입
    변형에 대한 케이스가 없다(키 부재·오타·빈 dict 세 가지만 커버).
  - 제안: `:122`의 검사를 값 타입까지 포함하도록 확장한다 — 예:
    `if not isinstance(data, dict) or not isinstance(data.get("overrides", {}), dict):`
    형태로 "키 부재"와 "값이 dict 아님"을 함께 fail-closed 처리(빈 `overrides: {}`는 여전히
    허용). `MissingOverridesKeyTest`에 리스트/문자열 값 케이스를 추가하고,
    `FailClosedSiteCountTest.EXPECTED_SITES`(현재 8)와 두 문서(모듈 docstring 은 미보유하나
    `.claude/tests/test_override_floors.py`/`README.md`)의 지점 수 서술을 9로 함께 갱신한다.

- **[INFO]** spec fidelity — 관련 제품 spec 문서 없음(재확인)
  - 위치: `spec/` 전체 grep 결과 `override-floors`/`override_floors`/`check-override-floors`
    매칭 0건(직접 재실행 확인).
  - 상세: `plan/in-progress/deps-guard-hardening.md` frontmatter 의 `spec_impact: none`과
    일치하며, 이 변경은 CI/의존성 보안 툴링으로 제품 동작 spec 대상이 아니다. line-level
    spec-코드 대조 대상 자체가 없다 — 정상.

## 그 외 확인한 항목 (이번 라운드 델타 기준, 이상 없음)

- **기능 완전성**: W1(returncode 불변식 미검증)·W2(overrides 키 부재)·INFO(timeout 부재) 3건
  모두 코드(`:77`, `:122-130`, `:158-173`)와 전용 회귀 테스트(`ReturncodeInvariantTest`,
  `MissingOverridesKeyTest`)로 구현됨을 확인. `.claude/tests/test_override_floors.py` 33개
  테스트 전체 로컬 실행 결과 33/33 통과(5차 대비 +5, W1 2건 + W2 3건).
- **엣지 케이스**: `overrides: {}`(명시적 빈 dict)는 의도로 간주해 정상 통과 처리됨을
  `test_present_but_empty_overrides_is_allowed`로 확인 — "빈 값은 의도일 수 있다"는 코드
  주석(`:124-125`)과 테스트가 일치. 레지스트리 응답 지연은 `_AUDIT_TIMEOUT_SEC=300`이 CI 잡
  타임아웃(`deps-security-checks.yml`의 `override-floors` 잡 `timeout-minutes: 10`)보다
  넉넉히 짧음을 실제 워크플로 파일 대조로 확인.
- **반환값**: `run_audit()`의 `subprocess.TimeoutExpired` 예외 경로가 `_undecidable()`(exit 2,
  `NoReturn`)로 정확히 라우팅됨을 코드 추적으로 확인.
- **비즈니스 로직**: `widened`/`eroded` 분류, `EXPECTED_SUPPRESSED_PATHS` 대조 로직은 이번
  라운드에서 미변경(4차 조치 이후 그대로) — 실제 `pnpm-workspace.yaml` 대상 26개로 라이브
  `python3 scripts/check-override-floors.py` 재실행 결과 `OK: override 대상 26개 패키지 중
  취약 재유입 0건`, exit 0 확인(5차 리뷰의 라이브 검증치와 동일).
- **TODO/FIXME/HACK/XXX**: 0건(`grep -iE` 재확인).
- **문서-코드 수치 결속**: fail-closed 지점 6→8곳 증가가 `FailClosedSiteCountTest.
  EXPECTED_SITES=8`·`test_override_floors.py` 모듈 docstring("여덟")·`.claude/tests/
  README.md`("Eight")·`plan/in-progress/deps-guard-hardening.md`("6곳 → 8곳") 4곳 모두
  일치함을 직접 대조로 확인 — 4차 리뷰가 심은 카탈로그 가드가 이번에도 의도대로 작동해 문서
  drift 재발을 막았다.

## 요약

`scripts/check-override-floors.py`는 5차 리뷰가 지적한 Warning 2건(returncode 불변식 미검증,
`overrides` 키 부재 시 fail-closed 누락)과 INFO 1건(subprocess timeout 부재)을 이번 라운드에서
정확히 조치했다 — 코드(`_AUDIT_TIMEOUT_SEC`/`TimeoutExpired` 라우팅, `overrides` 키 존재 검사)와
전용 회귀 테스트(`ReturncodeInvariantTest`, `MissingOverridesKeyTest`) 양쪽으로 구현되어 있고,
33개 테스트 전부 통과·라이브 `pnpm audit` 재실행(override 대상 26개, exit 0)으로 재확인했다.
다만 이번에 새로 짚은 한 가지는, 방금 고친 W2(overrides 키 **부재**)의 수정 범위가 좁아 "키는
있지만 값이 dict 가 아닌" 인접 사각지대(리스트/문자열 값)가 남아 있다는 점이다 — 이 경로는
크래시 없이 `OK: 취약 재유입 0건`을 조용히 출력하므로, 이 스크립트 전체의 존재 이유(설정 파싱
실패를 "취약점 0건"과 혼동하지 않는 것)와 정면으로 부딪힌다. Critical 은 없다. 적용 가능한 제품
spec 문서는 없다(`spec_impact: none`, 정상).

## 위험도

MEDIUM — Critical 없음, 신규 WARNING 1건. 5차에서 이미 같은 함수·같은 실패 클래스(설정 파싱
깨짐이 "취약점 0건"과 구별 안 됨)로 Warning 판정을 받은 사례의 인접 사각지대라는 점에서 이번
라운드에서도 동일 등급으로 판단한다.
