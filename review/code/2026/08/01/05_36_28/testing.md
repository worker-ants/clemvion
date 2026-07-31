# 테스트(Testing) 리뷰 — scripts/check-override-floors.py (9차 라운드)

## 스코프 메모

이번 라운드(`05_36_28`)에 router 가 넘긴 파일 42개 중 41개는 5~8차 `/ai-review` 세션
(`review/code/2026/08/01/{03_47_10,04_09_43,04_35_33,04_58_18}/`)의 산출물(정적
markdown/json)이고, 실 코드는 `scripts/check-override-floors.py` 1개뿐이다(diff 는
프롬프트 크기 제한으로 생략돼 있어 `Read` 로 직접 확인). 실제 변경분은 8차 라운드
(`04_58_18`)의 WARNING 2건(flaky 가드, `sorted(key=str)` 회귀 테스트 부재)과 INFO 3건을
조치한 커밋 `614d72ba3`("8차 리뷰 조치")다. `.claude/tests/test_override_floors.py` 는
이번 라운드도 router 파일 목록 밖이지만(`.claude/**` 제외 정책 — 5~8차 testing 리포트와
동일 판단), `git show 614d72ba3`로 실제 델타를 직접 대조하고 아래 발견사항은 전부 **실제
뮤턴트 주입 + 원본 백업 `cp` 복원**으로 검증했다(검증 후 매번 `git status`/`git diff --stat`
로 클린 복원과 41/41 GREEN 을 재확인).

## 발견사항

- **[WARNING]** 이번 델타가 넓힌 예외 처리(`UnicodeDecodeError`/`OSError`)에 회귀 테스트가
  없다 — 되돌려도 41/41 GREEN 유지, 되돌린 상태를 실제로 실행하면 이 스크립트가 막으려는
  것과 같은 급의 오분류(exit 1 + raw Traceback)가 재현된다.
  - 위치: `scripts/check-override-floors.py:128-135`(`load_override_targets()`), 특히
    `:131`(`data = yaml.safe_load(path.read_text(encoding="utf-8"))`)와
    `:132`(`except (yaml.YAMLError, UnicodeDecodeError, OSError) as exc:`). 대응 테스트는
    `.claude/tests/test_override_floors.py` 전체에 없음
    (`grep -n "UnicodeDecodeError\|OSError\|invalid.*byte"` 0건).
  - 상세: 8차 조치 커밋(`614d72ba3`)은 `read_text()` 호출을 YAML 파싱과 같은 `try` 블록
    안으로 옮기고 예외 타입을 `yaml.YAMLError` 단독에서 `(yaml.YAMLError,
    UnicodeDecodeError, OSError)` 3종으로 넓혔다. 커밋 메시지 자체가 "유효하지 않은 UTF-8 이
    traceback+exit 1 로 죽던 것을 프로브로 확인 후 수정"이라고 밝혀 실제 버그였음을
    인정하는데, 그 수정을 지키는 회귀 테스트는 스위트에 하나도 없다.
    **실측(뮤턴트)**: 예외 타입을 `except yaml.YAMLError as exc:` 로 되돌리고
    `.claude/tests/test_override_floors.py` 41개 전부 재실행 — **41개 전부 GREEN 유지**됨을
    직접 확인했다. 이어서 되돌린 스크립트 사본에 잘못된 UTF-8 바이트(`b"overrides:\n
    liquid\xffjs: ^1.0.0\n"`)로 쓴 `pnpm-workspace.yaml` 을 직접 실행해 재현 — 되돌린 상태:
    `returncode=1` + raw `Traceback`(`UnicodeDecodeError: 'utf-8' codec can't decode byte
    0xff...`, 이 스크립트 어휘로 1 은 "침식 발견"과 같은 코드라 오분류), 현재(수정된) 상태:
    `returncode=2` + 깨끗한 진단 메시지(`ERROR: ... 를 읽거나 YAML 로 파싱하지 못했다: ...
    UnicodeDecodeError: ...`). 즉 "무엇을 고쳤는지"는 재현 가능하지만 "그 fix 가
    유지되는지"를 지키는 테스트가 없다 — 이 리뷰 체인이 5·6·7·8차에서 각각 동일한 형태
    (returncode 불변식, `TimeoutExpired` 분기, `sorted()` TypeError)에 WARNING 을 준 전례와
    정확히 같은 급이고, plan 문서(`plan/in-progress/deps-guard-hardening.md:196`)가 이
    항목을 "INFO 1 ... 모두 종결"로 적어 코드 수정만으로 완결된 것처럼 기록한 점도 과거
    라운드(7차 INFO 11 → 8차 WARNING)와 같은 패턴이다. `OSError` 쪽은 `WORKSPACE_YAML.exists()`
    확인과 `read_text()` 사이의 TOCTOU 경쟁(파일 삭제·권한 변경) 등 결정적 재현이 어려운
    형태라 우선순위를 `UnicodeDecodeError` 보다 낮게 보되, 같은 except 절을 공유하므로 함께
    비어 있다.
  - 제안: `MissingOverridesKeyTest`(또는 인접 클래스)에 `load_override_targets()` 를
    직접 호출하는 in-process 테스트를 추가한다 — 이미 `OverrideTargetExtractionTest.
    test_real_workspace_yaml_covers_scoped_range_keys` 가 쓰는 것과 같은 패턴:
    ```python
    def test_invalid_utf8_workspace_file_is_undecidable(self):
        with tempfile.TemporaryDirectory() as tmp:
            bad = Path(tmp) / "pnpm-workspace.yaml"
            bad.write_bytes(b"overrides:\n  liquid\xffjs: ^1.0.0\n")
            mod = _load_module()
            with self.assertRaises(SystemExit) as ctx:
                mod.load_override_targets(bad)
            self.assertEqual(ctx.exception.code, 2)
    ```
    `OSError` 는 `AuditTimeoutTest` 가 이미 쓰는 `unittest.mock.patch.object` 패턴으로
    `pathlib.Path.read_text` 에 `side_effect=OSError(...)` 를 주입해 결정적으로 닫을 수 있다.
    위 UTF-8 케이스는 직접 실행해 현재 코드에서 통과함을 확인했다(제안 자체가 검증된 상태).

- **[INFO]** flaky 가드 수정 자체(`StubNotUsed`/마커 메커니즘)를 지키는 자동화된 회귀
  테스트가 없다 — 커밋이 주장하는 뮤턴트 검증을 독립적으로 재현해 메커니즘은 실제로 작동함을
  확인했지만, 그 검증이 코드로 남아있지 않다.
  - 위치: `.claude/tests/test_override_floors.py:85-86`(`class StubNotUsed`),
    `:97-164`(`run_with_stub_audit()`, 특히 `:158-163` 의 마커 체크)
  - 상세: 커밋 메시지는 "뮤턴트(스텁 chmod 0644)로 마커 단언이 실제로 문다는 것을
    확인했다"고 밝히지만 이 검증은 개발 중 1회성 수작업이고 스위트에 남지 않았다. **직접
    재현**: `_PNPM_STUB` 소스에서 `open(os.environ["STUB_RAN_MARKER"], "w").close()` 줄을
    제거한 사본으로 `ClassificationTest` 5건을 재실행 → 5건 전부 `StubNotUsed` 로 FAIL(스텁이
    돌았는데도 마커가 없다고 정확히 감지)함을 확인해, 메커니즘 자체는 현재 유효하다. 다만 이는
    테스트 인프라(하네스 헬퍼)이지 `scripts/check-override-floors.py` 의 프로덕션 코드가
    아니므로, 이게 깨져도 실패 방향은 "flaky 테스트가 다시 조용해짐"이지 이 가드가 막으려는
    "취약점이 조용히 통과"는 아니다 — 우선순위를 WARNING 이 아닌 INFO 로 판단한다.
  - 제안: 급하지 않음. 여유가 있으면 `run_with_stub_audit` 자체를 대상으로 한 메타 테스트
    (마커 미기록 스텁을 주입해 `StubNotUsed` 가 실제로 발생하는지)를 별도 헬퍼 테스트
    모듈에 남기는 것을 고려.

- **[INFO]**(긍정 관측, mutation 검증) 8차 WARNING(`sorted(key=str)` 회귀 테스트 부재)을
  겨냥해 새로 추가된 테스트가 정확히 그 뮤턴트만 잡는다 — vacuous 아님.
  - 위치: `.claude/tests/test_override_floors.py:521-532`
    (`test_diagnostic_survives_mixed_type_top_level_keys`), 대상 코드
    `scripts/check-override-floors.py:147`(`sorted(data, key=str)`)
  - 상세: `sorted(data, key=str)` 를 `sorted(data)` 로 되돌려 41개 전체를 재실행한 결과
    **정확히 이 테스트 1건만** FAIL 하고 나머지 40건은 GREEN 을 유지함을 직접 확인했다 —
    과녁이 정확하다. 8차 라운드가 제안한 테스트 코드와 실제로 채택된 코드가 스텁 실행 여부
    파라미터(`expect_stub_ran=False`) 추가를 제외하면 동일하다.
  - 제안: 조치 불요. 검증 기록 목적.

- **[INFO]**(긍정 관측) `expect_stub_ran=False` 배선이 스크립트가 `pnpm` 호출 전에
  `_undecidable()` 로 끝나는 모든 시나리오에 정확히, 누락 없이 적용됐다.
  - 위치: `.claude/tests/test_override_floors.py:492,497,504,512,529,540`
    (`MissingOverridesKeyTest`/오버라이드 스키마 드리프트 계열 6곳)
  - 상세: `load_override_targets()` 가 `_undecidable()` 로 빠지는 6가지 입력(overrides 키
    부재·오타·값 없음·비-매핑 2종·타입 혼합 키·YAML 파싱 불가)은 전부 `expect_stub_ran=False`
    로 표시돼 있고, 실제로 `pnpm` 이 호출되는 나머지 시나리오(`ClassificationTest`,
    `SchemaDriftTest`, `FailClosedTest` 등 — audit 이후 단계에서 실패)는 전부 기본값
    `True` 를 그대로 쓴다. 프로덕션 코드의 제어 흐름(`main()` → `load_override_targets()`
    → `run_audit()` 순서)과 대조한 결과 어긋나는 배선을 찾지 못했다 — 새로 생긴 안전장치가
    기존 커버리지를 조용히 깨거나 스스로 오탐(`StubNotUsed`)을 내지 않는다.
  - 제안: 조치 불요.

## 회귀 확인

`.claude/tests/test_override_floors.py` 41개 전체를 직접 재실행해 GREEN 을 확인했다
(`python3 -m unittest discover -s .claude/tests -p 'test_override_floors.py'`).
`FailClosedSiteCountTest.EXPECTED_SITES = 9`가 소스의 실제 `_undecidable(` 호출 수(9,
정의부 제외)와 여전히 일치함을 재확인했다 — `_undecidable()` 호출 지점 개수 자체는 이번
델타로 늘지 않았다(예외 타입만 넓어짐). 5~8차가 조치한 WARNING 들(returncode 불변식·
`overrides` 키 부재·`overrides` 값 타입·`TimeoutExpired`·widened 필터 2건·`sorted()`
TypeError)은 이번 라운드에도 대응 테스트가 스위트에 그대로 남아 GREEN 을 유지한다.

## 요약

이번 라운드의 실 코드 델타(커밋 `614d72ba3`)는 8차 WARNING 2건을 정확히 겨냥해 닫는다 —
flaky 가드는 뮤턴트 재현으로 메커니즘이 실제로 작동함을 확인했고, `sorted(key=str)` 회귀
테스트는 정확히 그 뮤턴트 1건만 잡는 비-vacuous 테스트로 확인됐다. 다만 같은 커밋이 함께
처리한 INFO 항목(`read_text` 를 YAML 예외 처리 범위 안으로 옮기고 `UnicodeDecodeError`/
`OSError` 까지 포섭)은 프로덕션 코드만 고쳤을 뿐 회귀 테스트가 없다 — 뮤턴트로 되돌려도
41/41 GREEN 을 유지함을 직접 확인했고, 되돌린 코드를 실제 잘못된 UTF-8 파일로 실행하면 이
스크립트가 존재하는 이유(취약점 0건과 구별 안 되는 성공)와 같은 급인 "exit 1 + traceback"
오분류가 실제로 재현된다. 이 결함 자체는 "조용한 성공"이 아니라 항상 비-0 종료로 끝나
핵심 안전 불변식을 깨지는 않지만, 이 리뷰 체인이 5·6·7·8차 각각에서 동일한 형태(최근
수정된 코드가 회귀 테스트 없이 무검증)에 일관되게 WARNING 을 준 전례와 같은 급이라 이번에도
WARNING 으로 판단한다. 제안한 테스트는 기존 `load_override_targets()` 직접 호출 패턴
그대로 적용 가능함을 직접 검증했다. 그 외 새로 도입된 flaky-가드 메커니즘(`StubNotUsed`)
자체의 메타 테스트 부재는 테스트 인프라 영역이라 낮은 우선순위(INFO)로 남긴다. 테스트 격리
(매 테스트 `tempfile.TemporaryDirectory()` + 복사 `env`)·가독성(docstring 이 "왜"를
설명)·Mock 적절성(PATH 기반 `pnpm` 스텁 + 타임아웃 분기만 `unittest.mock` 병용)은 이번
라운드에서도 기존 스위트와 동일하게 모범적이다.

## 위험도

MEDIUM — Critical 없음, WARNING 1건(직전 라운드가 고친 코드의 회귀 테스트 부재, mutation
+ 실측으로 검증). 이 리뷰 체인의 5~8차가 동일 패턴에 일관되게 부여해 온 등급과 같다. 이번
결함도 실패해도 항상 비-0 종료(진단 품질 저하일 뿐 핵심 위험인 "조용한 성공"은 아님)라는
점에서 심각도 자체는 조용한 fail-open 류보다 낮다.
