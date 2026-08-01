# 테스트(Testing) 리뷰 — scripts/check-override-floors.py (8차 라운드)

## 스코프 메모

이번 라운드(`04_58_18`)에 라우터가 넘긴 파일 31개 중 30개는 5~7차 `/ai-review` 세션
(`review/code/2026/08/01/{03_47_10,04_09_43,04_35_33}/`)의 산출물(정적 markdown/json)이고,
실 코드는 `scripts/check-override-floors.py` 1개뿐이다(diff는 프롬프트 크기 제한으로 생략돼
있어 `Read`로 직접 확인). 실제 변경분은 7차 라운드(`04_35_33`)의 WARNING 2건(`main()`의
`widened` 필터 무검증) + INFO 1건(진단 메시지 조립 중 `sorted()` TypeError)을 조치한 커밋
`fdc7ad801`("7차 리뷰 조치")이다. `.claude/tests/test_override_floors.py`는 이번 라운드도
라우팅 스코프 밖이지만(`.claude/**` 제외 정책, 5~7차 testing 리포트와 동일 판단)
`git show fdc7ad801`로 실제 델타(+34줄, `WidenedFilterTest` 신설)를 직접 대조하고, 아래
발견사항은 전부 **실제 뮤턴트 주입 + 원본 백업 `cp` 복원**으로 검증했다(검증 후 매번
`diff`로 바이트 단위 원복과 `git status` 클린, 40/40 GREEN을 재확인).

## 발견사항

- **[WARNING]** 7차 INFO(`sorted()` TypeError) 조치 — 프로덕션 코드는 고쳤지만 회귀 테스트가
  없다. 되돌려도 40/40 GREEN 유지.
  - 위치: `scripts/check-override-floors.py:140-146`(`load_override_targets()`의
    `_undecidable()` 호출부, 특히 `:145` `sorted(data, key=str)`). 대응 테스트는
    `.claude/tests/test_override_floors.py` 전체에 없음(`grep -n "key=str\|TypeError"` 0건).
  - 상세: 7차 testing.md가 INFO로 지적한 "PyYAML 1.1 리졸버가 `on`/`yes`/`no`를 불리언으로
    해석해 YAML 최상위 키에 타입이 섞이면(`overrides` 파싱 실패와 동시 충족 시)
    `sorted(data)`가 `TypeError`로 죽는다"는 결함을, 이번 커밋이 `sorted(data, key=str)` +
    근거 주석으로 정확히 고쳤다. **실측(뮤턴트)**: `sorted(data, key=str)`를 `sorted(data)`로
    되돌리고 `.claude/tests/test_override_floors.py` 40개 전부 재실행 — **40개 전부 GREEN
    유지**됨을 직접 확인했다. 이어서 되돌린 코드에 `run_with_stub_audit({}, 'overrides:
    "liquidjs"\non: true\n')`를 직접 호출해 재현 — 되돌린 상태: `returncode=1` + raw
    `Traceback`(이 스크립트 어휘로 1은 "침식 발견"과 같은 코드라 오분류), 현재(수정된) 상태:
    `returncode=2` + 깨끗한 진단 메시지(`실제: str · 최상위 키: [True, 'overrides']`). 즉
    "무엇을 고쳤는지"는 재현 가능하지만 "그 fix가 유지되는지"를 지키는 테스트가 하나도 없다.
    이 패턴(코드는 고쳤는데 회귀 테스트가 없어 되돌려도 스위트가 못 잡음)은 이 리뷰 체인이
    6차 라운드에서 동일한 형태에 WARNING을 준 전례(`run_audit()`의 `TimeoutExpired` 분기 —
    원 위험도는 낮은 우선순위였지만 "완전 무검증"이라는 이유로 WARNING, 다음 라운드에
    `AuditTimeoutTest`로 닫힘)와 같은 급이다.
  - 제안: `MissingOverridesKeyTest`(또는 인접 클래스)에 한 줄이면 충분하다 — 예:
    ```python
    def test_diagnostic_survives_mixed_type_top_level_keys(self):
        """PyYAML 1.1 리졸버가 on/yes/no 를 bool 로 만들면 sorted() 가 타입 혼합 키에서
        죽을 수 있었다."""
        r = run_with_stub_audit({}, 'overrides: "liquidjs"\non: true\n')
        self.assertEqual(r.returncode, 2, r.stdout + r.stderr)
        self.assertNotIn("Traceback", r.stderr)
    ```
    위 형태 그대로 직접 실행해 현재 코드에서 통과함을 확인했다(제안 자체가 검증된 상태).

- **[INFO]** (긍정 관측, mutation 검증) 신규 `WidenedFilterTest` 2건은 7차 WARNING 2건을
  정확히 겨냥해 닫는다 — 뮤턴트 재현 결과 각각 정확히 1건씩만 실패, vacuous 아님.
  - 위치: `.claude/tests/test_override_floors.py:390-421`(`WidenedFilterTest`), 대상 코드
    `scripts/check-override-floors.py:292`(`if module not in targets: continue`),
    `:295`(`EXPECTED_SUPPRESSED_PATHS.get(module, set())`)
  - 상세: 7차 리뷰가 지목한 두 뮤턴트를 직접 재현했다. (1) `:292`를 `if False:`로 무력화 →
    `test_unmanaged_module_is_not_widened` **단독** FAIL(나머지 39건 GREEN). (2) `:295`의
    기본값을 `EXPECTED_SUPPRESSED_PATHS.get(module, actual)`로 뒤집음(신규 억제가 항상
    "이미 수용됨"으로 처리되는 뮤턴트) → `test_managed_module_absent_from_baseline_always_widens`
    **단독** FAIL(나머지 39건 GREEN). 두 테스트 모두 겨냥한 뮤턴트만 정확히 잡고 다른 테스트를
    오염시키지 않는다 — 과녁이 정확하다.
  - 제안: 조치 불요. 검증 기록 목적.

- **[INFO]** `WidenedFilterTest`가 프로덕션 상수(`EXPECTED_SUPPRESSED_PATHS`)에 아직 없는
  것을 전제로 `"liquidjs"` 모듈을 픽스처로 재사용 — 낮은 확률의 미래 결합 리스크
  - 위치: `.claude/tests/test_override_floors.py:416-421`
    (`test_managed_module_absent_from_baseline_always_widens`)
  - 상세: 이 테스트는 "`liquidjs`가 `EXPECTED_SUPPRESSED_PATHS`에 아직 등록 안 됐다"는 현재
    사실(실측: `scripts/check-override-floors.py:62-68`에 `"brace-expansion"` 키만 존재)에
    의존한다. 향후 `EXPECTED_SUPPRESSED_PATHS`에 `"liquidjs"` 키가 추가되면(합성 경로
    `"codebase__backend>x>liquidjs"`와 우연히 겹치지 않는 한) 이 테스트의 전제가 깨져 실패할
    수 있다 — 다만 실패 방향이 "조용한 통과"가 아니라 "빨간불"이므로 자기진단적이라 심각도는
    낮다. 이 프로젝트가 기존에도 `"liquidjs"`/`"brace-expansion"`을 여러 테스트 클래스에 걸쳐
    공유 픽스처로 재사용해 온 기존 패턴과 같은 급의 결합이라 새로 도입된 문제는 아니다.
  - 제안: 조치 불요. 참고 기록 목적.

## 회귀 확인

`.claude/tests/test_override_floors.py` 40개 전체를 직접 재실행해 GREEN을 확인했다
(`python3 -m unittest discover -s .claude/tests -p 'test_override_floors.py'`).
`FailClosedSiteCountTest.EXPECTED_SITES = 9`가 이번 라운드에도 소스의 실제
`_undecidable(` 호출 수(9, 정의부 제외)와 일치함을 재확인했다 — 문서-코드 수치 drift 없음.
5~7차가 조치한 WARNING들(returncode 불변식·`overrides` 키 부재·`overrides` 값 타입·
`TimeoutExpired`·widened 필터 2건)은 이번 라운드에도 대응 테스트가 스위트에 그대로 남아
GREEN을 유지한다.

## 요약

이번 라운드의 실 코드 델타는 3줄(`sorted(data) → sorted(data, key=str)` + 근거 주석)과
테스트 34줄(`WidenedFilterTest` 2건)뿐인 작은 조치 커밋이다. `WidenedFilterTest`는 뮤턴트
검증 결과 7차가 지목한 두 WARNING을 정확히 겨냥해 닫는 잘 짜여진 회귀 테스트다(각 뮤턴트당
정확히 1건만 실패). 다만 같은 커밋이 함께 처리한 INFO 11(`sorted()` TypeError) 수정은
프로덕션 코드만 고쳤을 뿐 회귀 테스트가 없다 — 뮤턴트로 되돌려도 40/40 GREEN을 유지함을
직접 확인했다. 이 결함 자체는 "조용한 성공"이 아니라 항상 비-0 종료로 끝나 핵심 안전
불변식(취약점 0건과 구별 안 되는 성공)을 깨지는 않지만, 이 리뷰 체인이 6차 라운드에서
동일한 형태(위험도는 낮지만 완전 무검증)에 WARNING을 준 전례와 같은 급이라 이번에도
WARNING으로 판단한다. 한 줄짜리 테스트로 간단히 닫을 수 있음을 직접 검증해 제안에 포함했다.
그 외 테스트 격리(매 테스트 `tempfile.TemporaryDirectory()` + 복사 `env`)·가독성(docstring이
"왜"를 설명)·Mock 적절성(PATH 기반 `pnpm` 스텁, 서브프로세스 경계 유지)은 이번 라운드 신규
테스트에서도 기존 스위트와 동일하게 모범적이다.

## 위험도

MEDIUM — Critical 없음, WARNING 1건(직전 라운드가 고친 코드의 회귀 테스트 부재, mutation으로
검증). 이 리뷰 체인의 5~7차가 동일 패턴("최근 수정된 코드가 무검증")에 일관되게 부여해 온
등급과 같다. 다만 이번 결함은 실패해도 항상 비-0 종료(진단 품질 저하일 뿐 핵심 위험인
"조용한 성공"은 아님)라는 점에서 심각도 자체는 이전 라운드들보다 낮다.
