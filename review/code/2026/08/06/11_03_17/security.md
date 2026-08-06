# 보안(Security) 리뷰 — review-gate CI 백스톱 (Round 5)

## 발견사항

- **[CRITICAL]** `harness-checks.yml` 이 자신을 지키는 **테스트 선택 명령 자체**를 어떤 가드도
  고정하지 않는다 — round 1~5 전체가 그렇게 힘들게 고정한 `review-gate.yml` /
  `check-review-gate.py` / `test_review_gate_ci.py` 방어 전체를, 이 파일 한 줄만 바꿔서 CI
  차원에서 통째로 무력화할 수 있고, **그러고도 기존 테스트는 전부 초록이다.**
  - 위치: `.github/workflows/harness-checks.yml:88`
    (`run: python3 -m unittest discover -s .claude/tests -p 'test_*.py'` — "Run harness unit
    tests" step, 87번째 줄의 `name:` 바로 아래)
  - 상세:
    이 PR 이 4라운드에 걸쳐 고정한 것은 전부 `review-gate.yml` **자기 자신**의 배선이다
    (`WorkflowWiringTest` 의 전체-문서 정확 일치, `OneJudgeTest`/`VerdictComesFromTheGateTest`
    의 `check-review-gate.py` 호출 표면·행위 고정). 그런데 이 방어들이 실제로 CI 에서 도는지는
    `harness-checks.yml` 의 `python3 -m unittest discover -s .claude/tests -p 'test_*.py'`
    한 줄이 결정한다 — 그리고 **이 문자열의 내용을 검사하는 테스트가 하나도 없다.**
    `test_workflow_yaml_structure.py` 는 이 파일을 포함한 모든 워크플로에서 중복 키·
    `run`/`uses` 상호배타·`continue-on-error` 를 검사하지만 셋 다 `run:` 문자열의 **의미**
    (어떤 파일이 선택되는가)는 보지 않는다. `test_harness_checks_paths_coverage.py` 는
    `paths:` 트리거 목록만 검사하지 `run:` 내용은 보지 않는다. README 와
    `test_workflow_yaml_structure.py` 의 `BROKEN_SAMPLE` 안에 `python3 -m unittest
    discover -s .claude/tests -p 'test_*.py'` 라는 리터럴이 등장하지만, 전자는 문서고
    후자는 2026-08-01 사고를 재현하는 **고정 문자열 fixture** 일 뿐 실제
    `harness-checks.yml` 파일과 비교되지 않는다(grep 으로 직접 확인).

    즉 `-p 'test_*.py'` 를 예컨대 `-p 'test_[!r]*.py'` (문자 하나만 다름) 로 좁히면 —
    - `test_review_gate_ci.py` (이 PR 이 새로 추가한, `review-gate.yml` 을 지키는 바로 그
      파일) 를 포함해 `test_review_guard.py`, `test_review_guard_hardening.py`,
      `test_router_decision_trust.py`, `test_router_safety_policy_doc.py` 등 **11개 파일이
      CI 에서 영원히 안 돈다**,
    - 그런데도 `test_workflow_yaml_structure.py` 를 그 자리에서 실행하면 7/7 그대로
      통과하고, `test_review_gate_ci.py` 자체를 직접 실행해도 (discover 밖에서) 14/14
      그대로 통과한다 — **"파일이 옳다"와 "CI 가 그 파일을 부른다"가 분리돼 있고, 후자를
      고정하는 것이 없다.**
    - 이건 우연한 취약점이 아니라 이 PR 이 여섯 번 겪었다고 스스로 기록한 바로 그 실패
      클래스("가드가 present-but-silent")의 **일곱 번째 사례**이고, 하필 그 대상이 이번
      round 5 가 지킨 파일 자신이다.

    **재현 (작업 트리는 건드리지 않음 — `mktemp -d` 격리 사본에서 수행):**

    ```bash
    TMP=$(mktemp -d)
    cp -R .claude/tests   "$TMP/.claude/tests"
    cp -R .claude/hooks   "$TMP/.claude/hooks"
    cp -R .claude/_shared "$TMP/.claude/_shared"
    cp -R .github/workflows "$TMP/.github/workflows"
    cp scripts/check-review-gate.py "$TMP/scripts/check-review-gate.py"

    # 베이스라인 — 뮤테이션 전, 개별 실행 둘 다 초록
    python3 "$TMP/.claude/tests/test_workflow_yaml_structure.py" -v 2>&1 | tail -3
    python3 "$TMP/.claude/tests/test_review_gate_ci.py" -v 2>&1 | tail -3

    # harness-checks.yml 한 줄만 뮤테이션
    python3 - "$TMP/.github/workflows/harness-checks.yml" <<'PY'
import sys
p = sys.argv[1]; s = open(p, encoding="utf-8").read()
old = "run: python3 -m unittest discover -s .claude/tests -p 'test_*.py'"
new = "run: python3 -m unittest discover -s .claude/tests -p 'test_[!r]*.py'"
open(p, "w", encoding="utf-8").write(s.replace(old, new))
PY

    # 뮤테이션 후 — 같은 두 파일, 여전히 초록
    python3 "$TMP/.claude/tests/test_workflow_yaml_structure.py" -v 2>&1 | tail -3
    python3 "$TMP/.claude/tests/test_review_gate_ci.py" -v 2>&1 | tail -3

    # 실질 영향 — CI 가 실제로 고르는 파일 집합이 줄어든다
    python3 - "$TMP/.claude/tests" <<'PY'
import fnmatch, os, sys
d = sys.argv[1]
shipped = sorted(f for f in os.listdir(d) if fnmatch.fnmatch(f, "test_*.py"))
mutated = sorted(f for f in os.listdir(d) if fnmatch.fnmatch(f, "test_[!r]*.py"))
print(len(shipped), "files (shipped pattern) →", len(mutated), "files (mutated pattern)")
print("EXCLUDED:", *sorted(set(shipped) - set(mutated)), sep="\n  - ")
PY
    rm -rf "$TMP"
    ```

    **실제 출력:**

    ```
    (베이스라인, 뮤테이션 전)
    Ran 7 tests in 0.053s
    OK
    Ran 14 tests in 2.344s
    OK

    (뮤테이션 후 — 동일 두 파일을 그대로 재실행)
    Ran 7 tests in 0.053s
    OK
    Ran 14 tests in 2.300s
    OK

    (실질 영향)
    43 files (shipped pattern) → 32 files (mutated pattern)
    EXCLUDED:
      - test_reap_merged_worktrees.py
      - test_report_paths_shared.py
      - test_report_playwright_flaky.py
      - test_retry_state_shared.py
      - test_review_changeset_warning.py
      - test_review_gate_ci.py
      - test_review_guard.py
      - test_review_guard_hardening.py
      - test_router_decision_trust.py
      - test_router_safety_policy_doc.py
      - test_run_test_watchdog.py
    ```

    `harness-checks.yml` 은 `pull_request` 트리거이므로(`pull_request_target` 아님) PR 이
    자기 자신의 `.github/workflows/harness-checks.yml` 을 이 뮤테이션과 함께 고치면, 바로 그
    PR 을 검사하는 CI 실행 자체가 이미 이 뮤테이션된 버전으로 돈다 — "Run harness unit
    tests" 스텝은 초록 체크로 끝나고, 그 안에서 `test_review_gate_ci.py` 를 포함한 11개
    파일이 조용히 한 번도 실행되지 않는다.
  - 제안: `harness-checks.yml` 의 `run:` 문자열이 실제로 `.claude/tests/` 아래 존재하는
    **모든** `test_*.py` 를 고르는지 검사하는 메타 테스트를 추가한다 — 예:
    `run:` 문자열을 파싱해 `-p` 값을 뽑고, 그 glob 이 디렉터리의 실제 파일 목록과
    `fnmatch` 결과로 완전히 일치하는지 (부분집합이 아니라 **전체집합**) 비교. 이 클래스를
    막는 게 목적이라면 `WorkflowWiringTest` 방식(파싱된 문서 전체를 기대값과 정확 일치)을
    `harness-checks.yml` 에도 적용하거나, 최소한 `-p` 값 하나만이라도 README 의 문서화된
    명령과 실제 파일 목록 양쪽에 고정해야 한다.

- **[INFO]** `harness-checks.yml` 에 명시적 `permissions:` 블록이 없다 (이 PR 이 만든 갭은
  아님 — 기존부터 없었고, 이번 diff 는 이 파일에 경로 한 줄과 주석만 추가함, `git log -p`
  로 확인).
  - 위치: `.github/workflows/harness-checks.yml` (파일 전체 — `permissions:` 키 부재.
    새로 추가된 `.github/workflows/review-gate.yml:41-42` 는 `permissions: {contents:
    read}` 를 명시하며 41번 줄 위 주석에서 "기존 파일 다수가 생략하고 있지만" 이라고
    스스로 이 갭을 인지하고 있다).
  - 상세: 명시가 없으면 리포지토리/조직의 기본 `GITHUB_TOKEN` 권한을 그대로 물려받는다.
    `pull_request` 트리거이고 fork 에서 온 PR 이면 GitHub 이 자동으로 read-only 로
    낮추지만, 같은 저장소 내부 브랜치에서 여는 PR 이면 조직 기본값(더 넓을 수 있음)이 그대로
    적용된다. 이 워크플로는 PR 브랜치의 테스트 코드를 그대로 실행하므로(신뢰 경계가 PR
    작성자까지 넓어짐), least-privilege 명시가 방어 심화로 유효하다.
  - 제안: `review-gate.yml` 과 동일하게 `permissions: {contents: read}` 를 명시. 이 PR
    범위 밖(pre-existing) 이므로 차단 사유는 아니고 후속 정리로 제안.

- **[INFO]** `scripts/check-review-gate.py` 의 fail-open 예외 처리기(71-74행, 103-106행)가
  `{type(exc).__name__}: {exc}` 형태로 예외 메시지를 그대로 stderr 에 출력한다.
  - 위치: `scripts/check-review-gate.py:72`, `scripts/check-review-gate.py:104`
  - 상세: 내부 파일 경로 등 예외 문자열 일부가 CI 로그에 노출될 수 있다. 시크릿·자격증명은
    아니며, 이 스크립트가 다루는 값은 로컬 경로/파이썬 예외뿐이라 실질 위험은 낮다. 오히려
    이 PR 의 설계 의도(관측성 — "백스톱이 자기 부재로 CI 를 막으면 안 되고, 대신 왜
    fail-open 했는지 남겨야 한다")와 정확히 부합하는 트레이드오프이므로 수정 요구가
    아니라 참고 사항으로만 남긴다.
  - 제안: 조치 불필요. CI 로그 접근 범위가 넓어지는 경우(퍼블릭 리포지토리로 전환 등)에만
    재검토.

- **[INFO]** `review-gate.yml:51` 의 `if: github.actor != 'dependabot[bot]'` 는 문자열
  비교 기반 신뢰 판단이다.
  - 위치: `.github/workflows/review-gate.yml:51`
  - 상세: `[bot]` 접미사 계정은 GitHub App/Bot 전용으로 예약돼 있어 일반 외부 기여자가
    자기 계정명을 이걸로 가장할 수 없고, 설령 우회되더라도 이 워크플로는 현재 관측
    모드(`--enforce` 없음, fail-open)라 우회의 실질 효과가 없다. 조치 불필요, 완전성을
    위해 기록.

## 항목별 점검 결과 요약

- **인젝션**: `Fetch base ref` 스텝(`review-gate.yml:67-70`)이 `${{ github.base_ref }}`
  를 `run:` 에 직접 보간하지 않고 `env:` 경유로 넘기고 `"$BASE_REF"` 로 인용한다 — GitHub
  Actions expression-injection 의 표준 방어이며 올바르게 구현돼 있다. 이 형태는
  `WorkflowWiringTest` 의 전체-문서 정확 일치로 바이트 단위 고정돼, 향후 누군가 이걸
  `run: git fetch --no-tags origin "${{ github.base_ref }}"` 형태로 되돌리면 테스트가
  즉시 깨진다. 발견 없음.
- **하드코딩된 시크릿**: 8개 리뷰 대상 파일 전체에서 API 키/비밀번호/토큰 패턴 없음
  (grep 확인).
- **인증/인가**: `review-gate.yml` 은 `permissions: {contents: read}` 를 명시해
  최소권한을 지킨다. `harness-checks.yml` 은 위 INFO 항목 참고. 이 PR 이 다루는 게이트
  자체는 "누가 무엇을 할 수 있는가"가 아니라 "리뷰가 커버됐는가"를 판정하는 관측성 계층이라
  전통적 인증/인가 취약점 표면은 작다.
- **입력 검증**: `check-review-gate.py` 의 `--root`/`--enforce` 는 CI 에서 고정 인자로만
  호출되고, `argparse(allow_abbrev=False)` 로 축약형 오인도 막았다. 사용자 제어 입력을
  받는 표면이 사실상 없다.
- **OWASP Top 10 / CI 파이프라인 보안**: 위 CRITICAL 항목이 이 범주 — "보이는 보안 통제가
  조용히 무력화될 수 있다"(Security Misconfiguration / 방어 계층의 무결성 결여)에 해당한다.
  그 외에는 `pull_request`(≠ `pull_request_target`) 사용, 시크릿 미사용, 명시적
  `permissions` (신규 파일) 등 견고하게 구성돼 있다.
- **암호화**: 해당 사항 없음 (암호화/해시 로직 없음).
- **에러 처리**: 위 INFO 항목(`check-review-gate.py` 예외 메시지) 외 특이사항 없음.
- **의존성 보안**: `pip install "pyyaml>=6,<7"` — `deps-security-checks.yml` 과 동일 pin,
  `test_review_gate_ci.py::PyYamlPinsAgreeTest` 가 워크플로 간 drift 를 잡는다.
  `actions/checkout@v7` 등은 커밋 SHA 가 아닌 메이저 태그 고정이라 서플라이체인 관점에서는
  더 강하게 할 여지가 있지만, 저장소 전역 컨벤션과 일치하고 이 diff 가 만든 회귀가
  아니다.

## 요약

새로 추가된 `review-gate.yml` / `check-review-gate.py` / `test_review_gate_ci.py` 자체는
견고하다: expression-injection 은 `env:` 경유로 올바르게 막혀 있고, `permissions` 은
최소권한이며, 시크릿 노출이나 인젝션 표면이 없고, round 1~4 에서 뚫렸던 네 가지 우회
(부분 문자열, 부분 정규식, 앵커 없는 정규식, 필드별 부분 고정)는 이번 라운드의 전체-문서
정확 일치 + 행위 기반(4-조합) 테스트로 실제로 막혀 있음을 직접 뮤테이션 실험으로
확인했다(문서 구조·호출 표면·attribute 재바인딩 경로 시도 — 전부 기존 가드에 걸림). 다만
"이 라운드가 지킨 방어들이 실제로 CI 에서 실행되는가"를 결정하는 **한 단계 위의 계층**
(`harness-checks.yml` 의 테스트 discovery 명령)은 이번 PR 이 손대지 않았고 어떤 테스트도
그 문자열의 의미를 검사하지 않는다는 것을 위 재현 실험으로 확인했다 — `-p` 값의 문자 하나만
바꾸면 `test_review_gate_ci.py` 를 포함한 11개 가드 파일이 CI 에서 조용히 실행되지 않게
되고, 그러면서도 남아 있는 모든 테스트(그 11개를 제외한 나머지, 그리고 그 11개를 discover
밖에서 개별 실행한 결과)는 여전히 초록이다. 이는 이 PR 이 스스로 반복해서 명명한 실패
클래스("present-but-silent guard")의 재발이며, 하필 이번 라운드가 고정하려던 대상 자체를
무력화할 수 있는 자리라는 점에서 위험도가 높다. 나머지는 사전 존재하는(이 diff 가 만들지
않은) 소소한 하드닝 기회(명시적 permissions 부재, 예외 메시지 상세도)로 INFO 수준이다.

## 위험도

CRITICAL — `harness-checks.yml` 의 테스트-선택 명령이 어떤 가드에도 고정돼 있지 않아,
이번 라운드가 통째로 방어한 `review-gate.yml`/`check-review-gate.py` 자체를 CI 에서
조용히, 전체 테스트 초록 상태로 무력화할 수 있음을 재현 확인했다. 그 외 항목은 INFO.

STATUS: SUCCESS
