# 유지보수성(Maintainability) 리뷰 — deps-guard-hardening (8차 라운드, `04_58_18`)

## 스코프 메모

리뷰 대상 31개 파일 중 실질 코드는 `scripts/check-override-floors.py` 1개뿐이다(363줄). 나머지
30개(`review/code/2026/08/01/{03_47_10,04_09_43,04_35_33}/*`)는 5~7차 리뷰 세션의 harness 자동
생성 산출물(SUMMARY/`_retry_state.json`/`meta.json`/에이전트별 `.md`)이며, CLAUDE.md 규약대로
`review/code/**`에 커밋되는 것이 정상 동작이다. 코드 지표(함수 길이·중첩·매직넘버 등)를 적용할
대상이 아니므로, JSON 2건(`04_35_33/meta.json`, `04_35_33/_retry_state.json`)을 `python3 -c
"json.load(...)"`로 직접 파싱해 유효성을 확인하고 마크다운 8건(`04_35_33/*.md`)의 코드펜스(```)
짝을 세어 구조 손상이 없음을 확인했다 — 이상 없음.

이번 프롬프트 페이로드에는 `scripts/check-override-floors.py`의 diff/전체 컨텍스트가 크기 제한으로
실리지 않아, 파일을 직접 `Read`하고 `git show fdc7ad801 -- scripts/check-override-floors.py`로
직전 유지보수성 리뷰(`review/code/2026/08/01/04_35_33/maintainability.md`, 커밋 `1598f542f` 기준
상태 검토)이후의 실 델타를 대조했다. 델타는 `load_override_targets()`의 진단 메시지 한 곳
(`sorted(data)` → `sorted(data, key=str)` + 설명 주석 2줄, 순증 2줄)뿐이다 — 커밋 메시지가 언급하는
"widened 필터 회귀 고정"은 `WidenedFilterTest`(`.claude/tests/**`, 코드 리뷰 게이트 스코프 밖) 전용
테스트 추가일 뿐 스크립트 자체의 로직 변경은 없음을 `git show --stat`으로 확인했다.

## 발견사항

- **[INFO]** 신규 설명 주석이 이 함수 자신의 기존 관례(주석은 호출 직전)를 깨고 암묵적 문자열 연결
  중간에 끼어든다
  - 위치: `scripts/check-override-floors.py:139-146`(`_undecidable(` 호출), 특히 `:142`-`:145`
  - 상세: 이번 델타가 추가한 2줄 주석(`:143-144`, "`key=str` — PyYAML 1.1 리졸버가...")이 `:142`의
    `f"  실제: {type(overrides).__name__}"`와 `:145`의 `f" · 최상위 키:
    {sorted(data, key=str)[...]}"` 사이 — 즉 두 개의 인접 f-string 리터럴이 **암묵적으로 하나의
    문자열로 연결**되는 지점 한가운데 — 에 놓인다. 문법적으로는 무해하다(주석은 토큰화 단계에서
    제거되므로 두 STRING 토큰은 그대로 인접해 연결된다. `python3 -m py_compile` +
    `ast.parse()`로 직접 재확인). 다만 같은 함수 안에서 불과 6~11줄 위(`:131-133`,
    `yaml.YAMLError` 처리 / `:136-138`, `overrides` 타입 검사)에 있는 — **바로 이 파일이 이미 쓰고
    있는 동일 패턴**(`_undecidable()` 호출 하나를 설명하는 여러 줄 주석) — 은 예외 없이 호출
    **직전**에 배치된다. 인자 목록이나 값 조립식 내부에 끼어들지 않는다. 이번 주석만 그 지역
    컨벤션을 깨고 두 f-string을 시각적으로 갈라 놓아, 빠르게 훑는 독자가 `:142`를 완결된 인자로
    오인하기 쉽다(뒤에 콤마가 없다는 것을 보고서야 연결됨을 알아챈다). 6차 라운드 리뷰
    (`review/code/2026/08/01/04_09_43/maintainability.md`)가 `run_audit()`의 `subprocess.run()`
    인자 목록 중간에 낀 주석에 대해 지적한 것과 같은 성격의 문제가, 이번 델타로 다른 위치
    (`load_override_targets()`의 문자열 연결식)에 새로 생겼다.
  - 제안: `:143-144` 주석을 `:136-138`에 이미 있는 설명 블록에 한 줄로 합치거나(둘 다 같은
    `_undecidable(` 호출의 `detail` 인자를 다루므로), 최소한 호출 시작(`:139`) 바로 앞으로 옮겨 이
    함수의 기존 관례와 맞춘다. 급하지 않은 선택적 정리.

- **[INFO]** (긍정 관측) `key=str` 선택은 직전 라운드가 제안했던 두 대안보다 더 견고하다
  - 위치: `scripts/check-override-floors.py:145`
  - 상세: 직전 라운드(`review/code/2026/08/01/04_35_33/maintainability.md`)는 이 자리의
    `sorted(data)`가 YAML 최상위 키에 `bool`/`str`이 섞이면 `TypeError`로 죽는다는 것을 지적하며
    `list(data)`(정렬 제거) 또는 `sorted(data, key=repr)` 둘 중 하나를 저비용 대안으로 제시했다.
    실제 조치는 제3의 선택지인 `key=str`을 택했는데, 이는 두 대안보다 일반적이다 — `key=repr`은
    `repr()` 결과가 타입마다 형식이 달라(`"'x'"` vs `True`) 여전히 낯선 대소 관계가 나올 수 있는
    반면, `key=str`은 어떤 해시 가능한 키 타입이 섞여도(정수·`None`·튜플 등) 항상 비교 가능한
    문자열로 통일해 `TypeError` 가능성을 구조적으로 없앤다. `run_audit()`의 자매 삼항식(`:206`,
    `list(data)`, 정렬 없음)과는 여전히 모양이 다르지만, 그 차이 자체는 직전 라운드가 이미
    "발생 2회, 3번째 발생 전까지 헬퍼 추출 보류" 기준 아래 INFO로 분류해 둔 것이라 이번 라운드에서
    새로 지적할 사안은 아니다.
  - 제안: 조치 불요.

- **[INFO]** (재확인, 이번 델타로 변화 없음) 직전 3개 라운드가 이미 보고한 항목은 이번 델타
  (`load_override_targets()` 국소 3줄)가 건드리지 않은 영역이라 그대로 유효하다 — 반복 서술 대신
  참조만 남긴다.
  - `classify_vulnerable()` 내 스키마 드리프트 가드 2곳(`:255-260`, `:265-270`)의 구조적 중복 —
    발생 2회, "3번째 발생 전 보류" 기준 미달(`03_47_10`/`04_09_43`/`04_35_33` maintainability.md
    3회 연속 확인).
  - `classify_vulnerable()`가 파일 내 최장 함수(`:211-271`, 61줄, `main` 46줄·`run_audit` 43줄보다
    김)이나 단일 응집 책임("advisories/actions 를 reported/suppressed 로 분류 + 스키마 가정 2곳
    검증") 유지 — 분리 불요.
  - `main()`의 `widened`/`eroded` 산출(`:288-298`, `:300-303`)이 이름 없이 인라인돼 있어 파일의
    "이름 있는 함수 + `_report_*` 대칭" 관례와 결이 다름 — 급하지 않음.
  - 위치: 상기 각 줄 범위(`scripts/check-override-floors.py`)
  - 상세: 이번 라운드가 대조한 유일한 실 코드 델타(`git show fdc7ad801 --
    scripts/check-override-floors.py`, 3줄 순증)는 `load_override_targets()`의 진단 메시지 한
    줄에 국한되어, 위 세 항목이 위치한 `classify_vulnerable()`/`main()`은 전혀 변경되지 않았다.
  - 제안: 조치 불요(이미 3개 라운드에 걸쳐 동일 결론).

## 요약

이번 8차 라운드가 실제로 검토할 신규 코드 델타는 `scripts/check-override-floors.py`의 진단 메시지
한 곳(`sorted(data)` → `sorted(data, key=str)`, 설명 주석 2줄 포함 순증 3줄)뿐이며, 이는 직전 라운드
(`04_35_33`)의 유지보수성 리뷰가 지적한 YAML 최상위 키 `TypeError` 취약점을 그 라운드가 제안한 두
대안보다 더 견고한 방식(`key=str`)으로 해소했다 — 긍정적 조치다. 다만 새로 추가된 설명 주석이 같은
함수 안에서 이미 확립된 "주석은 호출 직전에" 관례를 깨고 두 개의 암묵적으로 연결되는 f-string 리터럴
사이에 끼어들어, 문법적으로는 무해하지만(직접 `py_compile`/`ast.parse`로 재확인) 국소적 일관성을
약화시킨다 — 급하지 않은 INFO. 나머지 파일 전체(스키마 드리프트 가드 중복, `classify_vulnerable`
함수 길이, `main()`의 인라인 계산 비대칭)는 3개 라운드에 걸쳐 이미 검증된 대로 이번 델타의 영향을
받지 않아 그대로 유효하며 전부 조치 불필요 수준이다. 나머지 30개 리뷰 산출물 파일은 코드가 아니라
harness 가 생성한 리포트/상태 파일로, JSON 유효성과 마크다운 코드펜스 짝을 확인한 결과 구조적 결함이
없다. CRITICAL·WARNING 수준의 유지보수성 결함은 발견되지 않았다.

## 위험도

LOW
