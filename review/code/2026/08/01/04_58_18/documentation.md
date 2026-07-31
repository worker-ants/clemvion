# 문서화(Documentation) 리뷰 — deps-guard-hardening (8차 라운드)

## 스코프 메모

이번 라운드(`04_58_18`)에 할당된 델타는 두 갈래다.

1. 5차(`03_47_10`)·6차(`04_09_43`)·7차(`04_35_33`) `/ai-review` 세션 산출물 총 30개
   (`SUMMARY.md`/`_retry_state.json`/`documentation.md`/`maintainability.md`/`meta.json`/
   `requirement.md`/`scope.md`/`security.md`/`side_effect.md`/`testing.md` × 3세션)가 저장소에
   신규 반영된 것.
2. `scripts/check-override-floors.py` 본체 — 7차 리뷰가 지적한 WARNING 2건(`main()`의 `widened`
   계산 루프 필터 2곳 무검증)과 INFO 1건(`sorted()` 의 `TypeError` 가능성)이 조치된 커밋
   (`fdc7ad801`, "7차 리뷰 조치") 이후의 최종 상태.

프롬프트에는 파일 31(`scripts/check-override-floors.py`)의 diff/전체 내용이 크기 제한으로 실리지
않아 `Read`로 저장소 현재 파일(363줄)을 직접 열어 확인했다. `git show fdc7ad801`로 실제 델타(진단
메시지 조립부 `sorted(data)` → `sorted(data, key=str)` + 2줄 주석, `.claude/tests/test_override_floors.py`
에 `WidenedFilterTest` 신설)를 대조하고, PyYAML 동작·CI 타임아웃 설정·fail-closed 지점 개수를 직접
재현/재측정해 문서화 관점에서 재검증했다.

## 발견사항

- **[INFO]** (긍정 관측) 이번 델타의 신규 인라인 주석(`key=str` 근거)이 실제 PyYAML 동작과 정확히
  일치함을 재현으로 확인
  - 위치: `scripts/check-override-floors.py:143-145` (`load_override_targets()` 내
    `_undecidable()` 진단 메시지 조립부)
  - 상세: 7차 라운드가 지적한 "PyYAML 1.1 리졸버가 `on`/`yes`/`no` 를 불리언으로 해석해
    `sorted(data)` 가 `TypeError` 로 죽을 수 있다"를 이번 델타(`fdc7ad801`)가
    `sorted(data, key=str)` 로 고치며 2줄 근거 주석을 남겼다. 직접
    `yaml.safe_load('overrides: x\non: true\n')` 를 실행해 `{'overrides': 'x', True: True}` 를
    확인했고, `sorted(data)` 는 실제로 `TypeError: '<' not supported between instances of 'bool'
    and 'str'` 를 던지는 반면 `sorted(data, key=str)` 는 예외 없이 `[True, 'overrides']` 를
    반환함을 재현했다 — 주석의 주장이 코드·실제 동작과 정확히 일치한다.
  - 제안: 조치 불요.

- **[INFO]** `.claude/tests/test_override_floors.py` 모듈 docstring의 "축 3"·"나머지 두 클래스"
  서술이 이번 라운드에 추가된 `WidenedFilterTest` 를 반영하지 않아, "축 4" 서술과 상세도 비대칭이
  생겼다 (게이트 스코프 밖 — 선행 라운드들의 전례를 따른 문서화 관점 확장 점검)
  - 위치: `.claude/tests/test_override_floors.py:22-25`(축 3 문단), `:40-43`("나머지 두 클래스"
    서술), `:390-399`(`WidenedFilterTest` 정의부, 신규), 대조 축 4 문단 `:27-38`
  - 상세: 모듈 docstring 은 "네 축"을 설명한 뒤 "나머지 두 클래스는 축이 아니라 **회귀 고정**이다:
    `CombinedReportTest`(...), `SchemaDriftTest`(...)"로 마무리한다. 이 문장은 4차 리뷰 조치
    커밋(`652f6cc78`, `git log -S"나머지 두 클래스"`로 도입 시점 확인)에서 처음 쓰였고 그
    시점엔 정확했다 — `ReturncodeInvariantTest`/`MissingOverridesKeyTest`/`AuditTimeoutTest`/
    `WidenedFilterTest` 는 전부 그 이후(5·6·7차) 라운드에서 review-driven 뮤턴트 검증으로
    추가됐다. 이 중 `ReturncodeInvariantTest` 는 축-4 문단(`:37-38`, "`ReturncodeInvariantTest`
    가 스텁을 exit 1 로 돌려 그 불변식을 고정한다")에, `MissingOverridesKeyTest`/
    `AuditTimeoutTest` 의 시나리오도 같은 문단(`:30-33`, "타임아웃 / ... / 워크스페이스 파일
    부재 / YAML 파싱 불가 / overrides 가 매핑이 아님")에 흡수돼 축-4 서술은 신설 클래스가 생길
    때마다 갱신되는 관례를 유지해 왔다. 반면 이번에 추가된 `WidenedFilterTest`(자신의 클래스
    docstring: "뮤턴트로 무검증이 실증됐던 자리다" — `CombinedReportTest`/`SchemaDriftTest` 와
    거의 동일한 "리뷰가 뮤턴트로 무검증을 실증해 추가" 프레이밍)는 축-3 문단(`:22-25`,
    "actions[]에 남는 경로를 baseline과 대조해 경로가 늘면 fail시킨다"만 서술)에 전혀 반영되지
    않았다 — 그 필터의 두 세부 판단("override 미관리 모듈은 건너뛴다", "baseline에 없는 모듈은
    허용 경로 0개로 취급한다")도, 클래스명도 언급되지 않는다. `FailClosedSiteCountTest`는
    `_undecidable()` 호출 **횟수**만 세므로 이런 클래스-로스터 서술의 drift는 자동으로 잡히지
    않는다. 사실관계 오류는 아니다(적힌 내용 중 틀린 말은 없다) — 다만 축-4가 유지해 온 "신설
    회귀 클래스는 해당 축 문단에 흡수해 서술한다"는 관례에서 이번 한 곳만 비켜났다.
    `.claude/tests/**` 는 이번 라운드 router 가 코드 리뷰 게이트 스코프 밖으로 분류한 파일이지만
    (5차 `testing.md` 가 이미 확인한 기존 정책), 이 파일이 서술하는 숫자·클래스 로스터의 사실
    정확성은 5·6·7차 documentation/side_effect 리뷰가 반복적으로 "문서화 리뷰의 연장"으로
    확인해 온 전례를 따라 확인했다.
  - 제안: 급하지 않음. 축-3 문단 끝에 `WidenedFilterTest`가 다루는 두 경계 조건(override 미관리
    스킵, baseline 부재 시 fail-closed 기본값)을 한두 문장 추가하거나, "나머지 두 클래스"를
    "나머지 클래스들"로 일반화하는 정도로 충분하다.

- **[INFO]** (carried-forward, 5·6·7차에 이어 이번까지 4연속) 모듈 docstring "실측 5건 → 위 4건"
  서술 순서가 여전히 한 문장 시점에서 잠깐 모호
  - 위치: `scripts/check-override-floors.py:6-14`(특히 `:14`)
  - 상세: 이번 라운드의 코드 델타(`sorted(data, key=str)`, `WidenedFilterTest` 신설)가 모듈
    docstring 도입부를 건드리지 않아 5·6·7차가 동일하게 지적한 문구가 그대로 남아 있다.
    사실관계 오류는 아니다(`:21`에서 "`#1038` 이 정확히 그 상태였다 — 17건 중 4건"으로 뒤늦게
    해소) — 원커밋(`6b55b0f48`)부터 존재해 4개 라운드 연속 "낮은 우선순위"로 판정되고 있다.
    수정 비용이 한 줄 문구 교체 수준으로 매우 낮은 점을 고려하면, 다음 조치 라운드에서 함께
    정리하거나 이번 기회에 "의도적으로 조치하지 않음"으로 명시적으로 닫아 매 라운드 재언급되는
    것을 멈추는 편이 낫다.
  - 제안: 급하지 않음. `:14`를 "실제로 `#1038`의 4건은 audit 17건 중에 섞여 보고됐다"처럼 PR
    번호를 즉시 명시하는 쪽으로 바꾸거나, 이번 기회에 최종적으로 "조치 안 함"으로 확정.

- **[INFO]** fail-closed 지점 개수(9)·CI 잡 타임아웃(10분) 근거 주석 — 이번 델타 이후에도 drift
  없음 재확인
  - 위치: `scripts/check-override-floors.py` 전체(`_undecidable(` 9곳 — `:133,139,186,192,200,
    203,256,266,276`, 정의부 `:153` 제외), `:75-77`(`_AUDIT_TIMEOUT_SEC` 근거 주석)
  - 상세: 이번 델타는 `_undecidable()` 호출부를 추가/제거하지 않고(진단 메시지 조립 로직만
    수정) 카운트를 9로 유지한다. `grep -n "_undecidable("` 재실측 결과 정의부 제외 정확히
    9곳이며, `.claude/tests/test_override_floors.py`(`EXPECTED_SITES=9`, "아홉")·
    `.claude/tests/README.md`("Nine")·`plan/in-progress/deps-guard-hardening.md:174`("8곳 →
    9곳") 4곳 모두 일치한다(`FailClosedSiteCountTest`도 로컬 재실행으로 통과 확인). 40개
    테스트 전체 재실행 결과 PASS. `.github/workflows/deps-security-checks.yml:81`의
    `override-floors` 잡 `timeout-minutes: 10` 도 재확인, 주석의 "10분" 수치·`_AUDIT_TIMEOUT_SEC=300`
    (5분, "넉넉히 짧다")과 여전히 부합한다.
  - 제안: 조치 불요.

- **[INFO]** 7차 라운드 리뷰 산출물(`testing.md` 등)의 줄번호 인용이 이번 델타로 +2 shift됨 — 이
  저장소의 기존 확립된 패턴과 일치, 신규 결함 아님
  - 위치: `review/code/2026/08/01/04_35_33/testing.md:28-29,33,55,72,108,115`(예: "290-291",
    "288-296행", ":293" 등 인용)
  - 상세: 이번 라운드의 실 코드 델타가 `load_override_targets()` 진단 메시지 조립부에 주석 2줄을
    추가하면서, 그 아래 있는 `main()`의 `widened` 계산 루프가 종전 288-296행에서 현재 290-298행
    으로 밀렸다(직접 `Read`로 확인). 7차 `testing.md`가 인용한 "290-291"/"288-296행"/":293"은
    지금은 각각 292-293/290-298/295에 해당한다. 이는 "리뷰 스냅샷을 다음 라운드 수정과 같은
    커밋에 함께 넣는" 이 저장소의 기존 워크플로에서, 6차 라운드(`review/code/2026/08/01/
    04_09_43/side_effect.md`)가 5차 산출물에 대해 이미 "정적 텍스트라 실행 시 문제를 일으키지
    않는다"고 판정한 것과 동일한 성격의 예상된 drift다.
  - 제안: 조치 불요(기존 판정 유지).

- **[INFO]** `RESOLUTION.md` 부재 — 문서화 관점에서는 이번 라운드도 clean, 7차가 조건부로 남긴
  전제가 충족되는 방향
  - 위치: `review/code/2026/08/01/{01_12_24,01_56_46,02_38_45,03_16_51,03_47_10,04_09_43,
    04_35_33}/` (7개 세션 디렉터리 전체 — `RESOLUTION.md` 없음)
  - 상세: 7차 문서화 리뷰(`review/code/2026/08/01/04_35_33/documentation.md:75-90`)는 "이번
    라운드가 clean 으로 끝나지 않으면 RESOLUTION.md 경로를 검토"라는 조건부 결론을 남겼다.
    7차는 실제로 testing 리뷰어가 WARNING 2건을 발견해 clean 이 아니었으나, 그 WARNING 2건은
    이번 델타(`fdc7ad801`, `WidenedFilterTest` 2개 테스트)에서 코드+회귀 테스트로 조치됐음을
    위에서 직접 확인했다. 문서화 관점에서 이번(8차) 라운드는 Critical·Warning 없이 clean이다 —
    다만 이 저장소의 관례("fix 후 fresh clean review 가 전원 clean 이면 RESOLUTION 불요")가
    실제로 성립하려면 이번 라운드 나머지 6개 관점 reviewer 도 clean 이어야 하며, 그 최종 판정은
    이 문서화 리뷰 하나만으로 내릴 수 없다(SUMMARY 집계 몫).
  - 제안: 문서화 관점에서는 조치 불요.

- **[INFO]** README/CHANGELOG/설정 문서 갱신 필요성 재점검 — 신규 갱신 대상 없음
  - 위치: `PROJECT.md:48`, `CHANGELOG.md`, `plan/in-progress/deps-guard-hardening.md`
    (frontmatter `spec_impact: none`)
  - 상세: 이번 델타(진단 메시지 `key=str` 수정, `WidenedFilterTest` 추가)는 `PROJECT.md:48`이
    이미 다루는 게이트 추상화 수준(override-floors 게이트의 존재·목적·2-place 편집 규약) 아래의
    구현 세부라 갱신 대상이 아니다. 신규 환경변수·API 엔드포인트 변경 없음. `CHANGELOG.md`는
    `spec/`에 연결된 제품 기능 변경만 다루는 저장소 관례이고, `spec_impact: none`이 실제와
    일치함을 `spec/` 전체 grep(`override-floors`/`override_floors`/`check-override-floors`
    매칭 0건)으로 재확인했다.
  - 제안: 조치 불요.

- **[INFO]** 신규 반영된 리뷰 세션 산출물(7차분 10개) 구조적 무결성 확인 — 결함 없음
  - 위치: `review/code/2026/08/01/04_35_33/{_retry_state.json,meta.json}` (JSON 2개),
    `review/code/2026/08/01/04_35_33/*.md` (마크다운 8개)
  - 상세: `python3 -c "json.load(...)"`로 두 JSON 파일 모두 파싱 성공을 직접 확인했다. 8개
    마크다운 파일은 이미 앞서(파일 21~30) 전문을 직접 읽어 코드펜스·표 구조 이상을 발견하지
    못했다. `CLAUDE.md`의 "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`"
    저장 위치 규약과도 정확히 일치한다.
  - 제안: 조치 불요.

## 요약

`scripts/check-override-floors.py`는 8차례 리뷰-조치 사이클을 거치며 문서화 수준이 이미 매우
높은 상태를 유지하고 있다. 이번 라운드는 7차가 지적한 WARNING 2건(`widened` 필터 무검증)과
INFO 1건(`sorted()` TypeError)을 조치한 커밋(`fdc7ad801`)을 재검증했다 — 신규 인라인 주석의
PyYAML 관련 주장을 직접 재현해 정확함을 확인했고, fail-closed 지점 개수(9)·CI 타임아웃(10분)
근거 주석은 코드·테스트·README·plan 문서 4곳 모두와 여전히 일치한다(drift 없음). 이번 라운드에서
새로 찾은 항목은 두 가지다: (1) `.claude/tests/test_override_floors.py` 모듈 docstring의 "축 3"
서술과 "나머지 두 클래스" 문구가 신설된 `WidenedFilterTest`를 반영하지 않아, 신설 클래스를 해당
축 문단에 흡수해 온 축-4의 관례에서 이번 한 곳만 비켜난 완결성 갭(사실 오류는 아님, 게이트
스코프 밖의 확장 점검), (2) 4개 라운드 연속(5·6·7차 및 이번) 이월되고 있는 모듈 docstring
"5건→4건" 서술 순서 모호함 — 수정 비용이 낮은 점을 고려해 이번엔 최종 정리를 권장한다. 7차
리뷰 산출물(`testing.md` 등)의 줄번호 인용이 이번 델타로 +2 shift된 것은 이 저장소가 이미
확립한 "리뷰 스냅샷 동봉" 워크플로의 예상된 결과로, 신규 결함이 아니다. 문서화 관점에서 이번
라운드는 Critical·Warning 없이 clean이며, 7차가 조건부로 남긴 "RESOLUTION.md 불요" 전제를
충족하는 방향이다(단 최종 판정은 SUMMARY 집계 몫).

## 위험도

LOW — 병합을 차단하거나 정확성에 실질적 영향을 주는 문서화 결함 없음. 긍정 재확인 다수와
선택적 다듬기 제안(INFO) 2건(신규 1건 + carried-forward 1건)만 존재.
