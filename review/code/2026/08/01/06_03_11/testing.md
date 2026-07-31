# 테스트(Testing) 리뷰 — scripts/check-override-floors.py (10차 라운드)

## 스코프 메모

router 가 이번 라운드(`06_03_11`)에 넘긴 파일은 2개다: (1) `review/code/2026/08/01/05_36_28/testing.md`
(9차 라운드 자신의 testing 리포트 — 신규 파일로 diff 에 포함) (2) `scripts/check-override-floors.py`
(현재 상태 = 9차 조치 커밋 `e18fc7227` 반영 후, `main` 대비 386줄 전체 신규 파일 diff). `git log`로
확인한 HEAD 는 `e18fc7227`("9차 리뷰 조치")이고 워킹 트리는 clean(리뷰 산출물 디렉터리 제외) —
즉 이번 라운드는 9차가 스스로 지적한 WARNING 을 **자신의 조치 커밋으로 닫은 뒤**의 상태를 본다.

`.claude/tests/test_override_floors.py`·`.claude/tests/README.md` 는 이번 라운드도 router 파일
목록 밖이지만(`.claude/**` 제외 정책 — 5~9차 testing 리포트와 동일 판단), `Read`/`Grep`으로 직접
열어 확인하고 아래 발견사항은 전부 **실제 뮤턴트 주입 + 원본 백업 `cp` 복원**으로 검증했다(매번
`git status`/`git diff --stat`로 클린 복원 확인).

## 발견사항

- **[WARNING]** `FailClosedSiteCountTest`가 `.claude/tests/README.md`의 수치 서술을 실제로는
  검증하지 않는다 — 6차·7차 리뷰가 "자동 검증된다"고 반복 명시했던 주장을 뮤턴트로 반증했다.
  - 위치: `.claude/tests/test_override_floors.py:638-659`(`FailClosedSiteCountTest`, 특히
    `:653-659`의 `test_docstring_count_matches_source`), `.claude/tests/README.md:39`(카탈로그
    행의 "**Eleven** sites exit 2..." 서술). 둘 다 router 파일 목록 밖이라 `Read`로 직접 확인.
  - 상세: `test_docstring_count_matches_source`는 두 가지만 검사한다 — (a) 소스에서 센
    `_undecidable(` 호출 수가 `EXPECTED_SITES`와 같은지, (b) 이 테스트 파일 자신의 모듈
    `__doc__`(테스트 파일 상단 docstring)에 "열하나"가 포함되는지. **`README.md`는 코드 어디서도
    읽지 않는다** — assertion 메시지 문자열에 "`.claude/tests/README.md` 는 {EXPECTED_SITES}곳으로
    서술한다"고 적혀 있을 뿐이다(`:656`). **실측(뮤턴트)**: `README.md:39`의 `"**Eleven** sites
    exit 2"`를 `"**Nine** sites exit 2"`로 바꾸고 (1) `test_override_floors.py` 45건 전체 재실행
    → 45건 전부 GREEN, (2) 카탈로그 가드 `test_tests_readme_catalog.py` 5건 재실행 → 5건 전부
    GREEN(이 가드는 자신의 docstring이 명시하듯 "행의 *존재*만 보고 *내용*은 안 본다"). 즉
    `README.md`가 실제 코드와 얼마나 벌어지든 어떤 테스트도 안 잡는다. 이 gap 은 이번 라운드가
    처음 만든 게 아니라 `FailClosedSiteCountTest` 도입(4차) 이후 한 번도 존재한 적이 없었다
    (`git log -p`로 파일 전체 이력에서 "README"를 검색한 결과, 매 라운드의 assertion 메시지
    문자열 안에만 등장하고 실제 read/parse 코드는 어느 커밋에도 없었다). 그런데도 6차
    문서화 리뷰(`review/code/2026/08/01/04_09_43/documentation.md:63-69`)는 "`FailClosedSiteCountTest`가
    설계대로 이 drift를 사전에 강제한 것으로 판단된다... `FailClosedSiteCountTest`가 유지되는 한
    향후 라운드에서도 자동 검증된다"고 명시적으로 결론지었고, 7차 testing 리뷰(`review/code/2026/08/01/04_35_33/testing.md:103-105`)도
    "`FailClosedSiteCountTest`가 ... docstring·README 수치 drift를 자동 차단하는 설계는 여전히
    유효하며, 실제로 두 라운드 연속(5차→6차) 문서 갱신을 강제한 실적이 있다"고 반복했다. 두
    주장 모두 코드를 읽고 내린 추론일 뿐 뮤턴트로 검증되지 않았고, 이번에 뮤턴트를 넣어보니
    거짓으로 드러난다 — "문서 갱신을 강제한 실적"은 실제로는 이 assertion 메시지를 읽은
    개발자가 매번 **손으로** README 도 함께 고친 결과이지, 테스트가 강제한 결과가 아니다(6→8→9→11
    네 번의 증가 모두 사람이 챙겼을 뿐이다). `scripts/check-override-floors.py` 자체의
    fail-closed 정확성(소스 호출 수 vs `EXPECTED_SITES`)은 내가 별도로 수행한 다른 두 뮤턴트에서
    정확히 잡혔으므로 **프로덕션 보안 게이트의 핵심 불변식은 이 gap 의 영향을 받지 않는다** — 위험은
    "README.md 카탈로그 설명이 조용히 낡는 것"에 국한된다. 다만 이 파일의 자체 docstring이 밝히듯
    "축 개수/실패 횟수/형태 수" 서술 drift 는 이 스크립트에서 **세 번** 리뷰가 수작업으로 잡아낸
    바로 그 결함 클래스이고, assertion 메시지가 검증 범위를 실제보다 넓게 주장한다는 점에서
    향후 무심코 이 테스트를 신뢰하는 개발자에게 거짓 안도감을 준다.
  - 제안: `test_docstring_count_matches_source`(또는 인접 신규 테스트)에 `README.md` 파일을 직접
    읽어 대조하는 assertion을 추가한다 — `test_tests_readme_catalog.py`가 이미 쓰는
    `_harness.CLAUDE_DIR` 패턴과 동일:
    ```python
    def test_readme_catalog_entry_matches_source(self):
        """`.claude/tests/README.md` 카탈로그 행의 수치 서술도 소스와 함께 검증한다.

        `EXPECTED_SITES`와 이 파일 자신의 docstring만 맞추고 `README.md`는 손대지 않아도
        위 테스트는 GREEN이다(직접 뮤턴트로 확인 — "Eleven"을 다른 말로 바꿔도 스위트
        전체가 GREEN 유지). assertion 메시지가 README도 검증한다고 주장하므로 실제로도
        검증한다.
        """
        from _harness import CLAUDE_DIR
        readme = (CLAUDE_DIR / "tests" / "README.md").read_text(encoding="utf-8")
        self.assertIn(
            "Eleven", readme,
            "README.md 카탈로그의 test_override_floors.py 행이 EXPECTED_SITES 와 어긋난다",
        )
    ```
    위 코드는 직접 실행해 현재 저장소 상태에서 통과함을 확인했다(제안 자체가 검증된 상태).

- **[INFO]** (긍정 관측, mutation 재검증) 9차 라운드 자신의 testing.md(`05_36_28`)가 지적한
  WARNING("`UnicodeDecodeError`/`OSError` 예외 확장에 회귀 테스트 부재")이 같은 라운드의 조치
  커밋 `e18fc7227`으로 완전히 해소됐다 — 더 이상 이월할 미해결 항목이 아니다.
  - 위치: `review/code/2026/08/01/05_36_28/testing.md:18-25`(원 WARNING, 이제 stale) /
    `scripts/check-override-floors.py:145`(`except (yaml.YAMLError, UnicodeDecodeError,
    OSError) as exc:`) / `.claude/tests/test_override_floors.py:563-589`(`WorkspaceReadFailureTest`)
  - 상세: `except (yaml.YAMLError, UnicodeDecodeError, OSError)`를 `except yaml.YAMLError`로
    되돌려 45개 전체 재실행 — `test_invalid_utf8_is_undecidable`·`test_unreadable_file_is_undecidable`
    정확히 2건만 ERROR, 나머지 43건 GREEN 유지(직접 실측, cp 백업으로 클린 복원 확인). 두 테스트는
    각각 `UnicodeDecodeError`(잘못된 UTF-8 바이트)와 `OSError`(경로에 디렉터리를 둬
    `IsADirectoryError` 유발 — `main()`의 존재 확인과 읽기 사이 TOCTOU 창을 모사)를 독립적으로
    겨냥해 3종 예외 전부를 개별 커버한다. 과녁이 정확하다.
  - 제안: 조치 불요. 검증 기록 목적 — 이 항목을 이번 라운드에 미해결로 재상정하지 않도록.

- **[INFO]** (긍정 관측, mutation 재검증) 같은 커밋의 나머지 두 회귀 수정(W1: `run_audit()`의
  `FileNotFoundError` 미포섭, W2: 공백 유령 대상)도 정확한 타겟의 테스트로 뒷받침된다.
  - 위치: `scripts/check-override-floors.py:207`(`run_audit()`의 `except OSError as exc:`),
    `:119-128`(`override_target()`의 공백 가드) / `.claude/tests/test_override_floors.py:245-259`,
    `:613-623`
  - 상세: (a) `run_audit()`에서 `except OSError as exc:` 블록을 제거하고 45건 재실행 —
    `test_missing_pnpm_binary_exits_2`가 ERROR, 부수적으로 `FailClosedSiteCountTest.
    test_docstring_count_matches_source`도 FAIL(호출 지점 수 11→10 불일치를 정확히 포착) — 2건만
    실패. (b) `override_target()`의 `_INNER_SPACE.search(name)` 가드 블록 전체를 제거하고
    재실행 — `test_whitespace_in_extracted_target_is_undecidable`의 subTest 3개 전부 FAIL + 같은
    site-count 테스트 FAIL, 총 4건만 실패. 두 뮤턴트 모두 무관한 테스트를 건드리지 않았다 —
    `FailClosedSiteCountTest`가 "소스 카운트 vs `EXPECTED_SITES`" 축에서는 실제로 작동하는
    안전망임을 재확인(위 WARNING 은 이 축이 아니라 `README.md` 축에 대한 것).
  - 제안: 조치 불요.

- **[INFO]** flaky 가드(`StubNotUsed`) 메커니즘 자체를 지키는 메타 테스트가 여전히 없다 — 9차
  testing.md 의 동일 지적이 이번 라운드에도 그대로 유효하다(조치되지 않았고 우선순위도 낮게 유지).
  - 위치: `review/code/2026/08/01/05_36_28/testing.md:64-79`(원 INFO) /
    `.claude/tests/test_override_floors.py:86-165`(`StubNotUsed`/`run_with_stub_audit`)
  - 상세: `e18fc7227`의 커밋 메시지는 W1~W3·INFO 3/4/5 조치만 언급하고 이 INFO 는 다루지 않는다.
    `grep -n "StubNotUsed"`로도 이 마커를 겨냥한 별도 테스트가 여전히 없음을 재확인했다. 이
    메커니즘이 깨지는 실패 방향은 "flaky 테스트가 다시 조용해짐"이지 프로덕션 가드의 취약점
    오탐이 아니므로, 9차와 동일하게 INFO로 유지한다.
  - 제안: 급하지 않음. 여유가 있으면 마커 미기록 스텁을 주입해 `StubNotUsed`가 실제로 발생하는지
    보는 메타 테스트를 별도 헬퍼 테스트 모듈에 추가.

- **[INFO]** (minor, optional) `_report_eroded()`가 출력하는 "필요 하한" 값 — advisory 에
  `patched_versions`가 없을 때의 `"?"` 폴백 경로가 테스트로 검증되지 않는다.
  - 위치: `scripts/check-override-floors.py:305-309`(`patched_by_module` 구성 —
    `adv.get("patched_versions") or "?"`), `:375`(`_report_eroded`의 출력)
  - 상세: `eroded`로 이어지는 모든 fixture(`ClassificationTest`·`ReturncodeInvariantTest`·
    `CombinedReportTest`·`MultipleMatchTest` 등, `grep -n "patched_versions"` 로 전수 확인)가
    `patched_versions`를 명시적으로 채운 advisory만 쓴다. `patched_versions`가 없는(미패치 CVE 등
    실제로 발생 가능한) advisory는 fixture에 없어 `"?"` 표시 경로가 한 번도 실행되지 않는다. 다만
    이 폴백이 깨져도 결과는 "필요 하한 : None" 같은 표시 차이일 뿐 — exit code·erosion 감지 자체
    (핵심 fail-closed 불변식)는 영향받지 않는다. 이 리뷰 체인이 우선순위를 매기는 축("조용한
    통과" 여부)과 무관해 WARNING 이 아닌 INFO로 판단한다.
  - 제안: 여유가 있으면 `ClassificationTest`에 `patched_versions`를 생략한 advisory fixture 1건을
    추가해 `"?"` 출력을 단언.

## 회귀 확인

`.claude/tests/test_override_floors.py` 45개 전체를 직접 재실행해 GREEN을 확인했다(9차의 41개
대비 +4 — 9차 자신의 조치 커밋이 추가한 4개 테스트가 반영된 수치). `FailClosedSiteCountTest.
EXPECTED_SITES = 11`이 소스의 실제 `_undecidable(` 호출 수(11, 정의부 제외)와 일치함을 재확인했고,
11곳 전체가 각각 최소 1개의 전담 테스트로 커버됨을 직접 대조했다(표 형태 1:1 매핑 확인 — 미커버
지점 0개). 8차의 `sorted(key=str)` 진단 회귀 테스트, `expect_stub_ran=False` 배선 등 이전 라운드가
검증한 긍정 항목들도 이번 뮤턴트 세션 동안 무관한 회귀 없이 그대로 유지됐다.

## 요약

이번 라운드가 review 대상으로 받은 두 파일(9차 자신의 testing.md, `scripts/check-override-floors.py`)은
모두 9차 조치 커밋 `e18fc7227` 반영 이후 상태다. 9차가 지적한 WARNING(예외 확장 회귀 테스트
부재)과 그 라운드의 나머지 두 수정(FileNotFoundError 미포섭·공백 유령 대상)은 전부 정밀 타겟
테스트로 닫혔음을 3종의 독립 뮤턴트로 직접 재검증했다 — 각 뮤턴트가 의도한 테스트만 정확히
깨뜨리고 무관한 테스트는 건드리지 않아 vacuous 가 아니다. 다만 이번 라운드에서 새로 발견한
WARNING 이 하나 있다: `FailClosedSiteCountTest`가 `.claude/tests/README.md`의 수치 서술을
검증한다고 assertion 메시지에 명시하면서도 실제로는 그 파일을 읽지 않는다 — 이는 6차 문서화
리뷰와 7차 테스트 리뷰가 각각 "자동 검증된다"/"자동 차단하는 설계"라고 명시적으로 결론지었던
주장을 뮤턴트로 반증한 것이다. `README.md`의 수치가 지금까지 정확했던 것은 테스트가 강제해서가
아니라, assertion 실패 메시지를 읽은 개발자가 매 라운드 손으로 함께 고쳐온 결과다. 이 gap 은
스크립트 자신의 fail-closed 정확성(소스 호출 수 vs `EXPECTED_SITES`)에는 영향이 없어 프로덕션
보안 게이트의 핵심 불변식("조용한 통과")을 위협하지 않지만, 이 스크립트의 테스트 스위트가 정확히
막으려 해온 "문서 수치 drift"(세 번 반복된 결함 클래스) 사각지대를 스스로 만들고 있고, 그
사각지대의 존재를 assertion 메시지가 오히려 숨긴다는 점에서 조치 권장 등급으로 판단한다. 제안한
수정은 `test_tests_readme_catalog.py`가 이미 쓰는 패턴 그대로 적용 가능함을 직접 실행해 확인했다.
그 외 StubNotUsed 메타 테스트 부재(INFO, 변화 없음)와 `patched_versions` "?" 폴백 미검증(INFO,
신규·cosmetic)은 낮은 우선순위로 남긴다. 테스트 격리(매 테스트 `tempfile.TemporaryDirectory()` +
fresh 모듈 로드 + 복사 `env`)·가독성(Korean docstring 이 "왜"를 설명)·Mock 적절성(PATH 기반 stub +
타임아웃/미존재 바이너리 분기만 `unittest.mock` 병용, 둘 다 실제 OS 동작과 일치 확인)은 10차
라운드에서도 기존 스위트와 동일하게 모범적이다.

## 위험도

MEDIUM — Critical 없음, WARNING 1건(신규: `README.md` 수치 검증 미실장 + 두 차례 반복된
과대주장의 뮤턴트 반증). 이 WARNING은 프로덕션 스크립트의 fail-closed 핵심 불변식이 아니라
테스트 스위트 자신의 문서-동기화 커버리지에 관한 것이라 심각도 자체는 이전 라운드들이
MEDIUM으로 판단한 "예외 처리 회귀 테스트 부재"류보다 낮은 쪽에 위치하지만, 같은 등급 구간
안에서는 "조치 권장"이 맞다 — 수정 비용이 매우 낮고(기존 패턴 재사용, 수 줄), 이 정확한 결함
클래스가 이 스크립트에서 세 번 반복된 전례가 있다.
