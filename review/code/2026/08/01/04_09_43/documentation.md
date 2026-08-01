# 문서화(Documentation) 리뷰 — deps-guard-hardening (6차 라운드)

## 스코프 메모

이번 6차 라운드(`04_09_43`)에 문서화 리뷰어에게 할당된 델타는 두 갈래다.

1. 5차 리뷰(`review/code/2026/08/01/03_47_10`) 산출물 10개 파일(`SUMMARY.md`/`_retry_state.json`/
   `documentation.md`/`maintainability.md`/`meta.json`/`requirement.md`/`scope.md`/`security.md`/
   `side_effect.md`/`testing.md`)이 저장소에 신규 반영된 것.
2. 5차 리뷰 조치 커밋(`68e9064d3`, "5차 리뷰 조치 — returncode 불변식 · overrides 키 부재 ·
   audit timeout")이 `scripts/check-override-floors.py`에 남긴 실 코드 델타(약 37줄 — 타임아웃
   처리 + `overrides` 키 부재 fail-closed).

`git show 68e9064d3 -- scripts/check-override-floors.py`로 정확한 델타를 확인하고, 저장소의
현재 스크립트 파일을 직접 `Read`해 문서화 관점에서 재검증했다.

## 발견사항

- **[INFO]** (긍정 관측) 신규 타임아웃 처리 코드가 기존 파일의 "근거 주석을 곁들인 fail-closed
  분기" 관례를 그대로 유지한다.
  - 위치: `scripts/check-override-floors.py:75-77`(`_AUDIT_TIMEOUT_SEC` 상수 + 주석),
    `:164-173`(`run_audit()`의 `subprocess.run(...)` timeout 인자 + `except
    subprocess.TimeoutExpired` 블록)
  - 상세: `_AUDIT_TIMEOUT_SEC = 300`(5분) 앞에 "레지스트리 조회 상한. `deps-security-checks.yml`
    의 잡 타임아웃(10분)보다 넉넉히 짧아야 잡이 죽는 대신 이 스크립트가 사유를 남기고 끝낸다"는
    근거 주석이 붙어 있다. `.github/workflows/deps-security-checks.yml`을 직접 확인해
    `override-floors` 잡이 실제로 `timeout-minutes: 10`임을 검증했다 — 주석의 "10분" 수치가
    정확하다. `subprocess.run` 호출부 안의 인라인 주석("위 세 분기는 '응답은 왔는데 형태가
    이상함' 만 다룬다. **응답이 안 오는** 경우가 남아 있었다...")도 정확하다 — `run_audit()`
    안에서 이 timeout 분기 이전에 존재하는 `_undecidable` 호출은 정확히 3곳(빈 출력·JSON 파싱
    실패·`actions` 키 없음, `:176`/`:184`/`:187`)이라 "세 분기"라는 서술과 실측이 일치한다.
    `run_audit()`의 함수 docstring(`:151-157`)은 이 새 분기를 언급하지 않지만, returncode 로
    판단하지 않는다는 기존 계약 자체는 바뀌지 않았고 세부 사유는 호출부 인라인 주석이 담당하는
    파일의 기존 문서화 스타일과 일관적이라 갱신 누락으로 보지 않는다.
  - 제안: 조치 불요.

- **[INFO]** (긍정 관측) `overrides` 키 부재 fail-closed 분기도 왜 필요한지·왜 빈 dict 케이스와
  구분하는지를 정확히 설명하는 주석을 갖춘다.
  - 위치: `scripts/check-override-floors.py:119-134`(`load_override_targets()`)
  - 상세: `if not isinstance(data, dict) or "overrides" not in data:` 분기 위 3줄 주석이
    "키가 통째로 없거나 오타(`override:`)면 `.get()` 이 빈 dict 를 돌려주고 대상이 0개가 되어
    **무엇도 걸리지 않는 채로 exit 0** 이 된다 — 파일 부재와 같은 부류인데 이쪽만 조용했다. 빈
    `overrides: {}` 는 의도일 수 있으므로 **키 자체의 부재**만 가른다"고 설계 의도까지 밝힌다.
    함수 자체의 docstring(`:120`, "대상 패키지명 → 그 패키지를 제약하는 override 키 목록.")은
    반환값 계약이 바뀌지 않았으므로 갱신 없이도 여전히 정확하다.
  - 제안: 조치 불요.

- **[INFO]** (긍정 관측, cross-file 검증) "fail-closed 지점 6곳→8곳" 수치 변경이 모든 미러
  문서에 정확히 반영됐고 잔여 drift가 없다.
  - 위치: `scripts/check-override-floors.py` 전체(`_undecidable(` 호출부 실측),
    `.claude/tests/test_override_floors.py:30,33,458`, `.claude/tests/README.md:39`,
    `plan/in-progress/deps-guard-hardening.md:161`
  - 상세: 이 파일은 정확히 이 종류의 수치 drift("몇 곳" 서술이 실제 코드와 어긋나는 것)로 4차
    리뷰에서 WARNING을 받은 이력이 있다(`review/code/2026/08/01/03_16_51`). 5차 조치 커밋은
    fail-closed 호출 지점을 6곳→8곳으로 늘렸는데(overrides 키 부재 1곳 + timeout 1곳 추가),
    `grep -n "_undecidable(" scripts/check-override-floors.py`로 실측하면 함수 정의(`:137`)를
    제외하고 정확히 8개 호출부(`:126,170,176,184,187,240,250,260`)가 확인된다. 이 숫자를
    서술하는 외부 미러 문서 두 곳 — `.claude/tests/test_override_floors.py`의 모듈
    docstring("여덟", `:30,33`)과 회귀 assertion(`:458`, `self.assertIn("여덟", __doc__, ...)`),
    `.claude/tests/README.md:39`("**Eight** sites") — 를 직접 열어 대조한 결과 모두 "8"/"여덟"로
    정확히 갱신돼 있다. 저장소 전역에서 이 주제에 대한 잔존 "6곳"/"Six" 서술은 찾지 못했다
    (`plan/in-progress/deps-guard-hardening.md:161`도 "6곳 → 8곳" 전환을 정확히 서술).
    `FailClosedSiteCountTest`(코드에서 호출 수를 직접 세어 문서 수치와 결속하는 회귀 테스트,
    4차 리뷰 조치로 도입)가 설계대로 이 drift를 사전에 강제한 것으로 판단된다. 인용된 세 파일
    (`.claude/tests/test_override_floors.py`, `.claude/tests/README.md`,
    `plan/in-progress/deps-guard-hardening.md`)은 이번 라운드의 공식 할당 범위 밖이지만, 이
    항목은 "주석 정확성"·문서-코드 수치 일치라는 문서화 리뷰 관점의 직접적 연장이라 확인했다.
  - 제안: 조치 불요. 참고 기록 목적 — `FailClosedSiteCountTest`가 유지되는 한 향후 라운드에서도
    자동 검증된다.

- **[INFO]** (carried-forward, 미해결·저우선순위) 모듈 docstring의 "실측 5건→위 4건" 서술 순서가
  여전히 한 문장 시점에서 잠깐 모호할 수 있다.
  - 위치: `scripts/check-override-floors.py:6-14`
  - 상세: 5차 라운드(`review/code/2026/08/01/03_47_10/documentation.md`)가 이미 지적한 INFO
    항목이며, 이번 라운드의 코드 델타(타임아웃·overrides 키 처리)가 이 구간(모듈 docstring)을
    건드리지 않아 그대로 남아 있다. `:6`이 "실측 5건 (2026-07-31, `#1036`/`#1038`)"을 선언하고
    `:8-12`에 5개 패키지를 나열하지만, `:14`("실제로 위 4건은 audit 17건 중에 섞여 보고됐다")가
    5건 중 어느 1건이 왜 "4건"으로 좁혀지는지 그 문장 시점엔 밝히지 않는다. 사실관계 오류는
    아니며(`:21`에서 "`#1038` 이 정확히 그 상태였다 — 17건 중 4건"으로 뒤늦게 해소), 원커밋
    (`6b55b0f48`)부터 존재해 1~5차 리뷰 내내 지적되지 않은 점에서 실질적으로 낮은 우선순위다.
  - 제안: 급하지 않음. `:14`를 "실제로 `#1038`의 4건은 audit 17건 중에 섞여 보고됐다"처럼 PR
    번호를 즉시 명시하는 쪽으로 바꾸면 근거가 그 자리에서 바로 선다.

- **[INFO]** 리뷰 산출물 파일(10개)의 저장 위치·구조는 프로젝트 컨벤션과 일치, 특이 사항 없음.
  - 위치: `review/code/2026/08/01/03_47_10/*` (`SUMMARY.md`/`_retry_state.json`/
    `documentation.md`/`maintainability.md`/`meta.json`/`requirement.md`/`scope.md`/
    `security.md`/`side_effect.md`/`testing.md`)
  - 상세: `CLAUDE.md`의 "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`" 규약과
    정확히 일치하는 경로에 생성됐다. `_retry_state.json`/`meta.json`은
    `.claude/docs/subagent-call-contract.md`가 명시하는 orchestrator 상태 추적용 표준 산출물로,
    우발적 디버그 잔재가 아니다. 10개 파일 전부(마크다운 테이블 열 수·헤딩 레벨·코드펜스 닫힘·
    JSON 구조) 깨짐 없이 직접 열어 확인했다. 이 라운드들(`01_12_24`~`03_47_10`) 어디에도
    `RESOLUTION.md`가 없으나, 6차인 본 라운드가 5차 발견사항에 대한 "fix 후 fresh review"에
    해당하고 재발 항목이 없어(이 문서 상단 참조) 프로젝트 관례상 결함으로 보지 않는다.
  - 제안: 조치 불요.

- **[INFO]** README/CHANGELOG/API 문서/설정 문서 갱신 필요성 재점검 — 이번 델타 범위에서 추가
  갱신 필요 없음.
  - 위치: N/A(누락 여부 점검)
  - 상세: `PROJECT.md:48`(의존성 취약점 절)은 이미 이 게이트를 다루고 있고 이번 델타(타임아웃 값
    5분·overrides 키 검사 추가)는 그 문서가 다루는 추상화 수준(게이트의 존재·목적) 아래의 구현
    세부라 별도 갱신이 필요하지 않다. `CHANGELOG.md`는 `plan/in-progress/deps-guard-hardening.md`
    의 `spec_impact: none` 선언대로 대상이 아니다. 새 환경변수는 도입되지 않았다(`_AUDIT_TIMEOUT_SEC`
    는 코드 내부 상수이며 기존 `_STDERR_PREVIEW`/`_STDOUT_PREVIEW`/`_KEY_PREVIEW`와 같은 패턴으로
    근거 주석을 갖춘다). API 엔드포인트 변경 없음(CLI/CI 스크립트).
  - 제안: 조치 불요.

## 요약

이번 6차 라운드(`04_09_43`)에서 문서화 리뷰어에게 할당된 델타는 5차 리뷰 산출물 10개 파일의
저장소 반영과, 5차 조치 커밋(`68e9064d3`)이 `scripts/check-override-floors.py`에 남긴 타임아웃
처리·`overrides` 키 부재 fail-closed 로직(약 37줄) 두 갈래다. 두 갈래 모두 실제 코드·연관 CI
설정(`deps-security-checks.yml`의 `timeout-minutes: 10`)·외부 미러 문서(`.claude/tests/README.md`,
`.claude/tests/test_override_floors.py`, `plan/in-progress/deps-guard-hardening.md`)를 직접
대조해 검증한 결과, 신규 코드는 기존 파일의 "근거 주석을 곁들인 fail-closed 분기" 관례를 그대로
유지하고, 4차 리뷰가 지적했던 것과 동일한 클래스의 수치 drift 위험("fail-closed 지점 6곳→8곳"
전환)도 `FailClosedSiteCountTest`의 강제 아래 모든 미러 문서에 정확히 반영되어 잔여 불일치가
없다. 리뷰 산출물 파일(SUMMARY/retry_state/meta 등)도 프로젝트 컨벤션과 정확히 일치하는 위치·
형식으로 생성됐다. 이번 라운드에서 새로 낸 항목은 없고, 5차 리뷰가 이미 저우선순위로 분류한 모듈
docstring 서술 순서 1건(INFO)만 미해결로 이어진다. CRITICAL·WARNING 수준의 문서화 결함은 발견되지
않았다.

## 위험도

LOW — 병합을 차단하거나 정확성에 실질적 영향을 주는 문서화 결함 없음. 긍정 관측 다수와
carried-forward 선택적 다듬기 제안(INFO) 1건만 존재.
