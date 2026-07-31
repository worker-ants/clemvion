# 문서화(Documentation) 리뷰 — deps-guard-hardening (7차 라운드)

## 스코프 메모

이번 라운드(`04_35_33`)에 할당된 델타는 두 갈래다.

1. 5차(`03_47_10`)·6차(`04_09_43`) `/ai-review` 세션 산출물 각 10개(총 20개, `SUMMARY.md`/
   `_retry_state.json`/`documentation.md`/`maintainability.md`/`meta.json`/`requirement.md`/
   `scope.md`/`security.md`/`side_effect.md`/`testing.md`)가 저장소에 신규 반영된 것.
2. `scripts/check-override-floors.py` 본체(361줄, 신규 파일 전체가 diff로 제시됨) — 6차 리뷰가
   지적한 WARNING 3건(`overrides` 값 타입 미검증·`yaml.safe_load` 예외 미처리·`TimeoutExpired`
   미검증)이 조치된 이후의 최종 상태.

`Read`/`grep`으로 저장소 현재 상태를 직접 대조해 문서화 관점에서 재검증했다 — 특히 6차 리뷰가
검토했던 코드(8곳 fail-closed, `"overrides" not in data` 형태 검사)와 이번에 주어진 코드(9곳,
`isinstance(overrides, dict)` 형태 검사)가 실제로 달라져 있어, 6차 라운드가 보지 못한 신규 상태를
문서화 축에서 처음 확인하는 라운드다.

## 발견사항

- **[INFO]** (재확인) fail-closed 지점 개수(9곳)가 코드·테스트·README·plan 4곳 모두 정확히 일치
  - 위치: `scripts/check-override-floors.py`(`_undecidable(` 호출 9곳 — `:133`, `:139-144`,
    `:184-187`, `:190-194`, `:198`, `:201-205`, `:254-257`, `:264-268`, `:274-275`; 정의부 `:151`
    제외)
  - 상세: `grep -n "_undecidable("`로 정의부를 제외하고 직접 세면 정확히 9곳이다.
    `.claude/tests/test_override_floors.py`의 `FailClosedSiteCountTest.EXPECTED_SITES = 9`(`:509`)와
    모듈 docstring의 "아홉"(`:30`), `.claude/tests/README.md:39`의 "**Nine**",
    `plan/in-progress/deps-guard-hardening.md:174`의 "fail-closed 지점 8곳 → 9곳" 서술이 전부 이
    숫자와 정확히 일치한다. `python3 -m unittest`로 `test_override_floors.py` 38건 전체를 직접
    실행해 통과(OK)함도 확인했다 — plan 문서의 "38건" 수치와도 일치. 이 파일이 과거 이 종류의
    수치 drift로 3·4차 리뷰에서 지적받은 이력이 있는데, 6차 이후 코드가 8→9로 다시 바뀐 이번
    델타에서도 재발하지 않았다.
  - 제안: 조치 불요. `FailClosedSiteCountTest`가 유지되는 한 향후 라운드에서도 자동 검증된다.

- **[INFO]** (재확인) `_AUDIT_TIMEOUT_SEC` 근거 주석의 "10분" 수치가 실제 CI 설정과 일치
  - 위치: `scripts/check-override-floors.py:75-77`
  - 상세: `.github/workflows/deps-security-checks.yml`을 직접 열어 확인한 결과 `override-floors`
    잡이 `timeout-minutes: 10`으로 선언돼 있어, 주석("`deps-security-checks.yml` 의 잡
    타임아웃(10분)보다 넉넉히 짧아야 잡이 죽는 대신 이 스크립트가 사유를 남기고 끝낸다")의 수치가
    정확하다(300초 vs 600초, "넉넉히 짧다"는 서술과 부합).
  - 제안: 조치 불요.

- **[INFO]** 6차 리뷰 WARNING 조치로 바뀐 `load_override_targets()`/`run_audit()`의 docstring·
  인라인 주석이 실제 동작과 정확히 일치 — 오래된 주석 없음
  - 위치: `scripts/check-override-floors.py:119-148`(`load_override_targets`), `:164-206`(`run_audit`)
  - 상세: `load_override_targets()`의 docstring(`:120-125`)은 "'빈 결과로 조용히 흘려보낼 수 있는'
    입력 형태를 하나씩 막지 않고 **한 자리에서** 가른다"고 서술한다. 실제 코드(`:134-135`)는
    `overrides = data.get("overrides") if isinstance(data, dict) else None` 뒤
    `if not isinstance(overrides, dict):` 단일 조건으로 키 부재·오타·값 없음(`None`)·비-매핑
    (문자열/리스트)을 전부 포괄한다 — 6차가 봤던 `"overrides" not in data`(키 존재만 검사) 형태에서
    바뀐 것인데, docstring도 그에 맞춰 "한 자리에서" 표현으로 갱신돼 있어 코드와 docstring이
    함께 움직였다. `run_audit()`의 함수 docstring(`:165-171`) 자체는 신규 `TimeoutExpired`
    분기(`:172-187`)를 명시적으로 언급하지 않지만, 그 분기 바로 위 인라인 주석(`:178-181`,
    "위 세 분기는 '응답은 왔는데 형태가 이상함' 만 다룬다. **응답이 안 오는** 경우가 남아
    있었다...")이 정확히 그 의도를 설명해 실질적 정보 손실은 없다. 이 지점은 6차 라운드
    문서화 리뷰(`review/code/2026/08/01/04_09_43/documentation.md:19-35`)가 이미 검토해 "갱신
    누락 아님"으로 판정한 바 있고, 이번 재확인에서도 동일 결론이다.
  - 제안: 조치 불요.

- **[INFO]** (carried-forward, 6라운드째 미해결·저우선순위) 모듈 docstring "실측 5건 → 위 4건"
  서술 순서가 여전히 한 문장 시점에서 잠깐 모호
  - 위치: `scripts/check-override-floors.py:6-14`(특히 `:14`)
  - 상세: 5차(`review/code/2026/08/01/03_47_10/documentation.md:28-47`)와
    6차(`review/code/2026/08/01/04_09_43/documentation.md:71-82`) 라운드가 동일하게 지적한 INFO
    항목이며, 이번 라운드의 코드 델타(YAML 예외 처리·`overrides` 타입 검사 통합)가 이 구간(모듈
    docstring 앞부분)을 건드리지 않아 문구가 그대로 남아 있다. `:6`이 "실측 5건
    (2026-07-31, `#1036`/`#1038`)"을 선언하고 `:8-12`에 5개 패키지를 나열하지만, `:14`("실제로
    위 4건은 audit 17건 중에 섞여 보고됐다")가 5건 중 어느 1건이 왜 "4건"으로 좁혀지는지 그 문장
    시점엔 밝히지 않는다. 사실관계 오류는 아니며(`:21`에서 "`#1038` 이 정확히 그 상태였다 —
    17건 중 4건"으로 뒤늦게 해소), 원커밋(`6b55b0f48`)부터 존재해 6개 라운드 내내 아무도
    조치하지 않을 만큼 실질적으로 낮은 우선순위임을 스스로 증명하고 있다.
  - 제안: 급하지 않음. `:14`를 "실제로 `#1038`의 4건은 audit 17건 중에 섞여 보고됐다"처럼 PR
    번호를 즉시 명시하는 쪽으로 바꾸면 근거가 그 자리에서 바로 선다.

- **[INFO]** `RESOLUTION.md` 부재 — 기존 관례(fresh clean review 대체) 범위 안으로 판단, 이번
  라운드 판정에 조건부
  - 위치: `review/code/2026/08/01/{01_12_24,01_56_46,02_38_45,03_16_51,03_47_10,04_09_43}/`
    (6개 세션 디렉터리 전체)
  - 상세: `developer` SKILL(`.claude/skills/developer/SKILL.md:94`)은 "수동 처리 시 SUMMARY 이슈
    해결 + `RESOLUTION.md` 기록. RESOLUTION.md 가 있어야 push 가드가 '해결됨' 으로 인정한다"고
    명시하나, 오늘의 6개 라운드 어디에도 `RESOLUTION.md`가 없다. 대신 각 라운드의 WARNING이 다음
    라운드 코드에서 실제로 조치됐음을 이번 세션에서 직접 코드 대조로 재확인했다(이 문서 상단
    "스코프 메모"·항목 1·3 참조 — 6차의 3개 WARNING 이 이번에 주어진 스크립트에 전부 반영돼
    있음을 실측). "fix 후 재실행한 fresh review 가 clean 이면 RESOLUTION 불요"라는 이 저장소의
    기존 관례(6차 문서화 리뷰 `review/code/2026/08/01/04_09_43/documentation.md:84-95`도 동일
    결론)와 일치하는 패턴이 이번까지 6회 연속 반복된다. 다만 이 결론이 실제로 성립하려면 이번
    7차 라운드 자체가(다른 8개 관점 reviewer 를 포함해) clean 으로 끝나야 하는데, 그 판정은 이
    문서화 리뷰 하나만으로 내릴 수 없다.
  - 제안: 문서화 관점에서는 조치 불요. 이번 라운드가 clean 으로 끝나지 않으면 그때는
    `RESOLUTION.md` 경로를 검토.

- **[INFO]** README/CHANGELOG/설정 문서 갱신 필요성 재점검 — 신규 갱신 대상 없음
  - 위치: `PROJECT.md:48`, `CHANGELOG.md`, `plan/in-progress/deps-guard-hardening.md`(frontmatter)
  - 상세: `PROJECT.md:48`은 이미 이 3번째 게이트(override-floors)의 존재·목적·2-place 편집 규약을
    게이트 추상화 수준에서 설명하고 있고, 이번 라운드의 구현 세부(YAML 예외 처리·`overrides`
    타입 검사 통합)는 그 문서가 다루는 수준 아래라 갱신 대상이 아니다(직접 대조로 재확인).
    `CHANGELOG.md`는 `spec/`에 연결된 제품 기능 변경만 다루는 저장소 관례(실제 항목들이 모두
    `SoT: spec/...`를 인용)이고, `plan/in-progress/deps-guard-hardening.md`의 frontmatter가
    `spec_impact: none`을 선언(및 본문 Rationale에 근거 명시)하고 있어 대상이 아니다. 새
    환경변수는 도입되지 않았고, 신규 모듈 상수 `_AUDIT_TIMEOUT_SEC`(`:77`)는 기존
    `_STDERR_PREVIEW`/`_STDOUT_PREVIEW`/`_KEY_PREVIEW`와 같은 패턴으로 근거 주석을 이미 갖췄다.
    API 엔드포인트 변경 없음(CLI/CI 스크립트). TODO/FIXME/HACK/XXX 마커도 0건(재확인).
  - 제안: 조치 불요.

- **[INFO]** 신규 반영된 리뷰 세션 산출물(20개 파일) 구조적 무결성 확인 — 결함 없음
  - 위치: `review/code/2026/08/01/03_47_10/*`, `review/code/2026/08/01/04_09_43/*`
  - 상세: 두 세션의 `_retry_state.json`/`meta.json`(총 4개) 모두 `json.load` 파싱 성공, 두 세션의
    `.md` 파일(각 8개, 총 16개) 전부 코드펜스(triple backtick) 짝이 맞고, `SUMMARY.md` 두 파일의
    마크다운 테이블(WARNING/INFO/에이전트별 위험도 요약)이 각 표 내에서 열 개수가 일관됨을
    확인했다. 5차 세션(`03_47_10`)은 6차 문서화 리뷰가 이미 이 점검을 수행했었고(`review/code/
    2026/08/01/04_09_43/documentation.md:84-95`), 6차 세션(`04_09_43`) 자체의 산출물은 그 이전
    라운드에는 존재하지 않았으므로 이번이 최초 점검이다. `CLAUDE.md`의 "코드 리뷰 산출물 →
    `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`" 저장 위치 규약과도 정확히 일치한다.
  - 제안: 조치 불요.

## 요약

이번 7차 라운드에서 문서화 리뷰어에게 주어진 델타는 5·6차 리뷰 세션 산출물 20개 파일의 저장소
반영과, 6차 리뷰의 WARNING 3건(`overrides` 값 타입 미검증·YAML 파싱 예외 미처리·
`TimeoutExpired` 미검증)이 조치된 `scripts/check-override-floors.py` 최종본(361줄, fail-closed
9곳)이다. 코드를 직접 열어 대조한 결과 fail-closed 지점 개수(9)가 테스트 docstring·
`FailClosedSiteCountTest`·README·plan 문서 4곳 모두와 정확히 일치했고, 신규/수정된
`load_override_targets()`·`run_audit()`의 docstring과 인라인 주석이 실제 코드 동작과 어긋나지
않음을 확인했다. `_AUDIT_TIMEOUT_SEC` 주석이 인용하는 CI 타임아웃(10분) 수치도 실제
워크플로 설정과 일치했다. 신규 반영된 리뷰 산출물 20개 파일은 JSON 파싱·코드펜스·마크다운
테이블 구조 모두 이상이 없었다. 이번 라운드에서 새로 낸 항목은 없고, 5·6차가 이미 저우선순위로
분류한 모듈 docstring 서술 순서 1건(INFO, 6라운드째 미해결이지만 사실관계 오류는 아님)만
이어진다. `RESOLUTION.md` 부재는 이 저장소의 기존 관례(fix 후 fresh clean review 로 대체)와
일치하는 패턴으로 판단했으나 이는 이번 라운드 전체가 clean 으로 끝난다는 전제에 조건부다.
CRITICAL·WARNING 수준의 문서화 결함은 발견되지 않았다.

## 위험도

LOW — 병합을 차단하거나 정확성에 실질적 영향을 주는 문서화 결함 없음. 긍정 재확인 다수와
carried-forward 선택적 다듬기 제안(INFO) 1건만 존재.
