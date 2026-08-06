# 유지보수성(Maintainability) Review — round 2

대상: `.claude/tests/README.md`, `.claude/tests/test_review_gate_ci.py`,
`.github/workflows/harness-checks.yml`, `.github/workflows/review-gate.yml`,
`plan/in-progress/harness-review-gate-ci-backstop.md`, `scripts/check-review-gate.py`.

라운드 2 지시(가드/테스트마다 "이 성질이 거짓인데도 통과하려면 무엇이 필요한가"를 실제로 시도)에
따라 아래는 전부 실제로 실행/작성해 확인한 결과다. 실행 로그 요약은 각 항목에 붙였다.

## 방법론 메모 (위치 표기 정합성)

`test_review_gate_ci.py`에 한해 프롬프트가 보여준 "전체 파일 컨텍스트"가 현재 워크트리 파일과
정확히 1커밋 어긋나 있다 (`diff` 로 직접 확인: `self.gate_module` DRY 정리와 "13개 테스트가
전부" → "형제 테스트가 전부" 문구 교체, 2곳). 그 결과 프롬프트 게이트 번호는 176번째 줄부터
실제 파일보다 **+1** 밀려 있다. 아래 위치는 전부 `Read`/`grep`으로 실제 파일을 직접 열어 확인한
**실제 줄 번호**다 (프롬프트 게이트 번호가 아니다). 다른 5개 파일은 바이트 단위로 프롬프트와
동일함을 `diff`로 확인했다.

---

## 발견사항

- **[CRITICAL]** `OneJudgeTest`의 "금지 호출" 검사가 지역 변수 별칭(alias) 한 줄로 완전히
  무력화된다 — 이 파일이 "판정자가 하나다"를 지키기 위해 이미 3번 재작성한 바로 그 검사의
  4번째 우회.
  - 위치: `.claude/tests/test_review_gate_ci.py:268-282` (특히 273-277의 호출-이름 수집 로직)
  - 상세: import는 허용목록(`_ALLOWED_IMPORTS`)으로 막혀 있어 안전하지만, "금지 호출"
    (`os.walk`/`os.scandir`/`os.listdir`/`open`) 탐지는 `ast.Call.func`가 `ast.Name`이거나
    `ast.Attribute(value=ast.Name)`인 경우만 보고, import 시점의 별칭만 되돌린다. **지역 변수
    대입으로 만든 별칭은 전혀 추적하지 않는다.** 아래 두 가지를 실제 AST로 돌려 확인했다 —
    둘 다 "판정자가 하나다"라는 성질이 거짓(스크립트가 스스로 트리를 걷는다)인데도 테스트는
    green이다.
    ```python
    # (1) 단순 지역 변수 별칭 — 흔한 리팩터 형태
    import os
    def _walk_reviews(root):
        walk = os.walk
        for dirpath, dirs, files in walk(root):
            pass
    # → called = {'walk'} , "os.walk" not in called → 통과

    # (2) getattr 간접 호출
    import os
    def _walk_reviews(root):
        walker = getattr(os, "walk")
        for entry in walker(root):
            pass
    # → called = {'walker', 'getattr', '_walk_reviews'} → 통과
    ```
    실제로 `ast.parse`에 두 스니펫을 넣고 이 테스트가 쓰는 것과 동일한 alias-해석 루프를
    그대로 재현해 `os.walk`가 `called` 집합에 전혀 나타나지 않음을 확인했다(위 출력 그대로).
    이 검사는 정확히 그 클래스(금지 목록은 상상한 우회만 막는다)를 자기 docstring에서
    3번 겪었다고 적어 두고도, "호출 탐지" 절반은 여전히 금지 목록 방식이라 같은 취약점이
    남아 있다.
  - 제안: "허용 목록" 원칙을 호출 탐지에도 대칭적으로 적용한다 — 스크립트가 실제로 호출하는
    이름 전체(`ap.add_argument`, `ap.parse_args`, `argparse.ArgumentParser`,
    `os.path.join/dirname/abspath/realpath`, `sys.path.insert`, `print`,
    `review_guard.evaluate_review`, `main`)를 화이트리스트로 못 박고 그 밖의 모든 호출을
    거부하는 편이, "금지된 이름 몇 개"를 나열하는 것보다 강하다(이미 import 축에서 검증된
    설계를 그대로 재사용). 최소한 지역 대입(`x = os.walk`)도 import 별칭과 같은 방식으로
    해석해 alias_of에 편입시켜야 한다.

- **[WARNING]** `test_the_job_condition_exempts_dependabot`이 `if:` 조건문을 substring
  2개(`"dependabot[bot]"`, `"!="`) 존재 여부로만 판정해, 논리가 완전히 뒤집힌 조건도 통과한다.
  - 위치: `.claude/tests/test_review_gate_ci.py:334-339`
  - 상세: 실제 검증 코드:
    ```python
    cond = self.job.get("if", "")
    self.assertIn("dependabot[bot]", cond, ...)
    self.assertIn("!=", cond, "면제는 부정 비교여야 한다 — 봇만 돌리면 정반대다")
    ```
    `cond = "(github.actor == 'dependabot[bot]') != false"` 를 넣고 두 `assertIn`을 그대로
    실행해 둘 다 통과함을 확인했다. 그런데 이 식은 불리언적으로 `github.actor ==
    'dependabot[bot]'`과 동치다 — 즉 **오직 dependabot일 때만 job이 돈다**, 정확히 테스트
    이름이 말하는 "dependabot을 면제한다"의 **반대**. 같은 파일의 `OneJudgeTest`가 이미
    "단어가 아니라 연산으로 판정하라"는 교훈을 얻었는데, 이 테스트는 YAML을 구조적으로 파싱한
    뒤에도 그 필드의 **의미**는 substring으로만 본다.
  - 제안: PyYAML로 구조는 이미 파싱했으니, `cond`를 GitHub Actions 식으로 완전히 재현
    평가하기보다는 최소한 알려진 정상 형태(`github.actor != 'dependabot[bot]'`, 부분식 순서
    무관)와 **정확히 일치**하는지 확인하거나, `!=`가 `github.actor`와 `'dependabot[bot]'`
    사이에 직접 위치하는지(정규식 1개로 충분) 확인해 "부정 비교가 존재한다"가 아니라
    "그 두 피연산자 사이의 부정 비교"임을 못박을 것.

- **[WARNING]** `test_it_is_still_observation_only`이 `"--enforce" not in cmd`만 보므로,
  argparse의 기본 약어 매칭(`allow_abbrev=True`)으로 우회된다.
  - 위치: `.claude/tests/test_review_gate_ci.py:367-374` (검사 대상 플래그 정의는
    `scripts/check-review-gate.py:79`)
  - 상세: 직접 실행해 확인:
    ```python
    >>> ap = argparse.ArgumentParser(); ap.add_argument("--enforce", action="store_true")
    >>> ap.add_argument("--root", default=".")
    >>> ap.parse_args(["--enf"]).enforce
    True
    ```
    `--enf`는 `--enforce`의 유일한 접두 일치라 argparse가 그대로 받아들인다. 워크플로의
    `run:` 한 줄이 미래에 `python3 scripts/check-review-gate.py --enf`처럼 축약형으로
    바뀌면(오타·습관적 축약 어느 쪽으로도 가능) 실제로는 enforce 모드로 전환되는데,
    `cmd`에는 리터럴 `"--enforce"`가 없으므로 이 회귀 테스트는 계속 "관측 모드 그대로"라고
    보고한다 — 정확히 이 테스트가 막으려는 "조용한 전환"이 재발하는데 테스트만 green.
    현재 `review-gate.yml`의 실제 `run:`은 플래그가 아예 없어 지금 당장 발현하는 결함은
    아니다(관측된 사실 그대로 기록).
  - 제안: `argparse.ArgumentParser(..., allow_abbrev=False)`를 스크립트 쪽에 추가해 애초에
    축약 매칭을 봉쇄하거나(제일 싼 수정), 테스트 쪽에서 `shlex.split(cmd)`로 토큰화한 뒤
    `--enforce`로 시작하는 토큰이 없는지 확인 + 스크립트가 `allow_abbrev=False`임을 별도로
    고정.

- **[INFO]** `OneJudgeTest.test_the_script_performs_no_judgement_operations_of_its_own` 하나가
  서로 다른 세 가지 성질(import 허용목록 / 금지 호출 부재 / `evaluate_review` 실제 사용)을
  63줄 한 테스트 메서드에 몰아넣어, 같은 스위트의 자매 파일과 스타일이 다르다.
  - 위치: `.claude/tests/test_review_gate_ci.py:225-287`
  - 상세: 같은 종류의 AST 경계 검사를 먼저 도입한
    `test_harness_checks_paths_coverage.py`(`ExtractorBoundaryTest`,
    `PathsCoverageTest` 등)는 성질 하나당 이름 있는 작은 테스트 메서드 하나로 쪼갠다
    (`grep -n "def test_" test_harness_checks_paths_coverage.py`로 확인, 평균 4~10줄).
    이 파일만 세 성질을 한 메서드에 순차 assert로 이어 붙여, 앞쪽 assert가 실패하면 뒤쪽
    두 성질은 그 실행에서 아예 검사되지 않는다(리포트에 "무엇이 실패했는지"는 나오지만
    "나머지가 통과했는지"는 안 나온다).
  - 제안: `test_imports_are_allowlisted` / `test_no_indirect_filesystem_walk` /
    `test_gate_function_is_actually_imported` 세 메서드로 분리해 실패 격리와 가독성을
    자매 파일 컨벤션에 맞출 것.

- **[INFO]** "435건 중 80건(18%)" 측정치가 서로 다른 4개 파일에 산문으로 중복 기재돼 있고,
  이를 하나로 묶는 테스트나 SoT가 없다 — 이 저장소가 `router_safety.py`의 확장자 개수(24 vs
  44, 2개월 stale)로 이미 겪은 것과 같은 drift 클래스.
  - 위치: `.claude/tests/README.md:44`, `plan/in-progress/harness-review-gate-ci-backstop.md:150,208,210,212`,
    `.github/workflows/review-gate.yml:16,49`, `scripts/check-review-gate.py:33`
  - 상세: `grep -rn "435\|18%" .claude/tests/README.md plan/in-progress/harness-review-gate-ci-backstop.md
    .github/workflows/review-gate.yml scripts/check-review-gate.py`로 4개 파일 전부에서 매치를
    확인했다. `--enforce` 전환을 결정할 때 이 숫자를 재측정하면, 네 곳을 전부 손으로 찾아
    고쳐야 하고 하나라도 놓치면 조용히 stale해진다 — `test_router_safety_policy_doc.py`가
    이미 겪은 실패를 막기 위해 도입한 "문서마다 개별 대조" 가드가 여기엔 없다.
  - 제안: 지금 당장 테스트로 묶으라는 요구는 아니다(이 수치는 일회성 결정 근거이지 불변식이
    아니다). 다만 이 중 하나(예: plan 문서)를 "정본"으로 표시하고 나머지 세 곳은 "출처: plan
    문서" 식으로 참조만 하도록 정리하면, 나중에 재측정 시 갱신 대상이 명확해진다.

- **[INFO]** 사소한 리터럴 중복 2건 — 같은 파일 안에서 반복.
  - 위치: `.claude/tests/test_review_gate_ci.py:116,135` (`"review/code/2099/01/01/00_00_00"`),
    `.claude/tests/test_review_gate_ci.py:84,153` (`timeout=120`)
  - 상세: 가짜 세션 경로 문자열이 두 테스트 메서드에 그대로 복붙돼 있다. 스위트의 다른
    subprocess 기반 테스트들은 대체로 `timeout=30`/`30.0`을 쓰는데(`grep -rn "timeout="
    .claude/tests/*.py`로 확인) 이 파일만 `timeout=120`을 두 곳에 반복한다 — 버그는 아니지만
    상수 하나로 뽑으면 두 인스턴스 중 하나만 고치는 실패를 원천 차단한다.
  - 제안: 클래스 레벨 상수(`_FUTURE_SESSION = "review/code/2099/01/01/00_00_00"`, 필요하면
    `_SUBPROCESS_TIMEOUT = 120`)로 추출.

- **[INFO]** `argparse.ArgumentParser()` 결과 변수명이 이 파일만 `ap`이고, 나머지
  `scripts/check-*.py` 세 파일은 전부 `parser`.
  - 위치: `scripts/check-review-gate.py:78`
  - 상세: `grep -rn "= argparse.ArgumentParser" scripts/*.py`로 확인 —
    `check-e2e-playwright-config.py`, `check-doc-links.py`, `check-migration-versions.py`
    셋 다 `parser`, 신규 파일만 `ap`.
  - 제안: `parser`로 통일해 같은 디렉터리 스크립트 사이의 사소한 이름 불일치를 없앨 것
    (동작에는 영향 없음, 순수 일관성).

---

## 요약

핵심 코드(`scripts/check-review-gate.py`)는 40줄 남짓의 선형 흐름이라 함수 길이·중첩·복잡도
모두 문제없고, 기존 관행(`_lib` 충돌 회피, allowlist 우선 설계, fail-open 주석)도 잘 따른다.
그러나 이 PR의 실질적 산출물은 코드 자체보다 **그 코드를 지키는 테스트**이고, 라운드 2가 명시적으로
요구한 "가드마다 우회를 실제로 시도"를 적용한 결과, `OneJudgeTest`의 "금지 호출" 탐지가 지역 변수
별칭 한 줄(`walk = os.walk`)로 완전히 무력화됨을 실제 AST 실행으로 확인했다 — 이 파일이 같은 검사를
이미 3번 재작성한 정확히 그 실패 클래스의 4번째 재발이며, import 축은 허용목록으로 옮겨 막았지만
호출 축은 여전히 금지목록이라 비대칭이 남았다. YAML 구조 검증 두 곳(dependabot 조건, `--enforce`
부재)도 "구조는 파싱하되 값은 substring"이라는 절반짜리 수정이라, 조건식이 논리적으로 뒤집히거나
플래그가 축약되면 green인 채 성질이 거짓이 될 수 있음을 각각 실행으로 재현했다. 이 세 건 모두
실제 프로덕션 결함이 아니라 "가드가 가드로서 실패할 수 있는 지점"이라 당장 머지를 막을 정도는
아니지만, 이 파일의 존재 이유가 바로 "판정자가 하나"라는 불변식이므로 CRITICAL로 표시했다. 그
외에는 테스트 메서드 하나가 세 책임을 지는 구조적 사소함, 통계치의 4파일 중복, 리터럴 중복 등
저위험 항목뿐이다.

## 위험도

HIGH
