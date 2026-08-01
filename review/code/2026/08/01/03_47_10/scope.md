# 변경 범위(Scope) 리뷰 — scripts/check-override-floors.py

## 검토 맥락

- `plan/in-progress/deps-guard-hardening.md` §1 ("오버라이드 바닥이 조용히 낮아지는 것을 검출한다")
  구현. 신규 파일 325줄, 5차 리뷰 라운드(4차까지 Critical 5건·Warning 16건 조치 완료 후 상태).
- 현재 작업트리 파일과 프롬프트 페이로드 diff/컨텍스트가 바이트 단위로 동일함을 확인
  (`diff <(git show HEAD:scripts/check-override-floors.py) scripts/check-override-floors.py` → 무차이).
- 이번 라운드에 넘겨진 리뷰 대상은 이 파일 1개뿐이라, 다른 파일(워크플로 YAML·테스트·
  `pnpm-workspace.yaml` 등)과의 번들 여부는 이 리뷰의 범위 밖으로 두고 파일 내부 구성만 평가했다.

## 발견사항

- **[INFO]** 파일이 두 개의 판정 축(`eroded`/`widened`)을 갖는다 — plan §1 원문은
  "오버라이드 하한 < 알려진 패치 하한" 한 축만 명시했다.
  - 위치: `classify_vulnerable()` (전체 파일 컨텍스트 173~233행), `main()` 의 `widened` 계산
    (250~261행) 및 `_report_widened()` (284~302행)
  - 상세: `eroded` 축(`main()` 262~265행, `_report_eroded()` 305~321행)은 plan §1 문구와
    정확히 일치한다. 반면 `widened`/`EXPECTED_SUPPRESSED_PATHS`(전체 파일 컨텍스트 56~68행) 축은
    `ignoreCves` 전역 억제가 신규 가드 자신의 사각(억제된 CVE 가 재유입해도 `advisories` 에
    안 잡힘)을 만든다는 것을 구현 중 실측으로 발견해 추가한 방어 로직이다
    (`plan/in-progress/deps-guard-hardening.md` "개발 중 실측으로 드러난 것" 절, "가드가 자기
    실패 모드를 그대로 재현하고 있었다" 단락에 근거 기록됨). plan §2 Rationale 이 명시적으로
    거부한 "기계 검사"(주석 문자열 존재 검사)와는 성격이 다르다 — 이건 실제 관측 데이터
    (`actions[].resolves[].path`)를 대조하는 것이라 §1 가드가 스스로의 목적(침식 검출)을
    달성하기 위해 필요한 보강이지, §2 영역으로의 기능 확장이 아니다.
  - 제안: 조치 불필요. plan 문서에 근거가 이미 기록돼 있고 1~4차 리뷰를 거쳐 안정화된 설계라
    범위 이탈로 보지 않는다. 다만 향후 리뷰어가 "왜 축이 두 개인가"를 되물을 수 있어 기록해 둔다.

## 범위 내 확인 사항 (문제 없음)

- **임포트**: `json`/`pathlib`/`re`/`subprocess`/`sys`/`NoReturn`/`yaml` 전부 사용처가 있다
  (미사용 임포트 없음). `yaml` 은 형제 스크립트 `check-pnpm-security-config.py` 도 이미 쓰는
  의존성이라 신규 외부 의존 추가가 아니다.
- **무관한 파일 수정 없음**: 이번 리뷰 페이로드는 신규 파일 1개(`/dev/null` → 325줄)뿐이고,
  기존 스크립트(`check-pnpm-security-config.py`)나 다른 무관 코드 영역을 건드리지 않았다.
- **설정 변경 없음**: 이 파일 자체는 `.yml`/`pnpm-workspace.yaml` 을 수정하지 않는다
  (워크플로 배선은 `.github/workflows/deps-security-checks.yml` 쪽 별도 diff — 확인 결과
  `override-floors` 잡이 이 스크립트를 정확히 호출하도록 배선돼 있어 orphan 코드가 아님).
- **주석/문서화**: docstring 이 상당히 길지만(모듈 docstring 36줄, 함수별 rationale 다수)
  이 저장소의 가드 스크립트 관례(같은 패턴을 쓰는 `check-pnpm-security-config.py`)와 일치하고,
  전부 "왜 이렇게 짰는가"(fail-closed 사유·`>` 파싱 3회 실패 이력·`ignoreCves` 사각) 설명이라
  코드와 무관한 잡담이 아니다.
- **불필요한 리팩토링·기능 확장 없음**: CLI 플래그·설정 파일 인터페이스·범용화 시도가 없고,
  `pnpm-workspace.yaml` 하나만 입력으로 받는 최소 footprint. `_STDERR_PREVIEW`/`_STDOUT_PREVIEW`/
  `_KEY_PREVIEW` 상수(전체 파일 컨텍스트 71~73행)도 진단 출력 절단용으로 실사용처가 있다.
- **죽은 코드 없음**: `chain_segments`→`override_target`→`load_override_targets`,
  `_report_widened`/`_report_eroded`→`main()` 전부 호출 경로가 있다.

## 요약

리뷰 대상 파일은 plan §1 이 요청한 "오버라이드 바닥 침식 검출" 목적에 집중된 신규 스크립트다.
핵심 판정 축(`eroded`)은 plan 문구와 정확히 일치하고, 보조 축(`widened`)은 구현 중 실측으로
드러난 자기 사각(§1 가드가 `ignoreCves` 로 인해 스스로 무력화되는 문제)을 막기 위한 필수 보강으로
plan 문서에 근거가 남아 있어 범위 이탈로 보기 어렵다. 무관한 파일·설정 변경, 미사용 임포트,
포맷팅과 뒤섞인 실질 변경, 목적 없는 주석/리팩토링은 발견되지 않았다.

## 위험도

LOW
