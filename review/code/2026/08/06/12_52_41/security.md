# Security Review — 리뷰 게이트 CI 백스톱 (8R)

리뷰 대상: `.claude/hooks/_lib/review_guard.py`, `scripts/check-review-gate.py`,
`.github/workflows/review-gate.yml`, `.github/workflows/harness-checks.yml`,
`.claude/tests/test_review_gate_ci.py`(신규) 외 하네스 테스트 파일들,
`plan/in-progress/harness-review-gate-ci-backstop.md`.

CONTEXT 지시에 따라 (1) 실제 판정 코드의 살아있는 결함, (2) 테스트를 초록으로 둔 채 실제
PR 판정을 뒤집는 경로를 우선순위로 조사했다. 모든 재현은 `mktemp -d` 로 만든 별도 디렉터리에서
수행했고 저장소 작업 트리는 건드리지 않았다(`git status --porcelain` 재확인, 아래 참조).

---

## 발견사항

- **[CRITICAL]** 리뷰 커버리지 게이트(로컬 push 훅 + 이번에 추가된 CI 백스톱 둘 다)가
  "리뷰가 실제로 수행됐는가"를 전혀 검증하지 않는다 — `review/code/**/SUMMARY.md` /
  `review/consistency/**/SUMMARY.md` 의 **존재와 내용 형태**만으로 통과하며, 그 파일들은
  판정 대상인 바로 그 PR 안에서 PR 작성자가 직접 커밋할 수 있다. 즉 실제 `/ai-review` 를
  한 번도 돌리지 않고도, 코드 변경과 함께 몇 줄짜리 가짜 `SUMMARY.md` 를 같은 PR 에 커밋하면
  로컬 훅과 CI 백스톱이 **동시에** "통과"로 판정한다.
  - 위치: `.claude/hooks/_lib/review_guard.py`
    - `_summary_is_resolved` (475-539행) — 499-500행: `RESOLUTION.md` 가 **존재하기만 해도**
      내용과 무관하게 즉시 `True`(resolved) 반환. `RESOLUTION.md` 도 없으면 508-539행에서
      `SUMMARY.md` 자체의 `## 전체 위험도` 텍스트만 파싱하는데, 그 텍스트도 같은 PR 이 쓴 것이다.
    - `_path_session_time` (401-417행) — 세션 "완료 시각"의 유일한 근거가 **디렉터리 이름에
      박힌 날짜 문자열**이다. `time.time()` 대비 미래인지, 혹은 실제 그 시각에 무언가 일어났는지
      어떤 검증도 없다 — 아무 날짜나 골라 디렉터리를 만들면 그 값이 그대로 "신선도" 시계가 된다.
    - `_newest_resolved_review_mtime` (555-585행), `evaluate_review` (954-1064행) — 위 두
      함수가 계산한 "가장 최근의 resolved 리뷰 시각"이 코드 변경 시각보다 크면(Gate 1) 무조건
      통과. `_forced_coverage_missing` (437-472행)은 `_retry_state.json` 이 아예 없으면
      "검사할 매니페스트가 없다"며 **통과로 fail-open** 하므로, 강제 리뷰어 커버리지조차
      요구되지 않는 경로가 존재한다.
    - Gate 2(스펙-구현 일치, `_newest_resolved_impl_done_mtime`, 777-819행)도 동일한 클래스 —
      `review/consistency/**/SUMMARY.md` + `meta.json` 의 `mode` 필드 + `BLOCK:` 텍스트를
      그대로 신뢰한다.
  - 위치(호출부): `scripts/check-review-gate.py` 97행 `decision = evaluate(root)` — CI
    백스톱은 `evaluate_review()` 를 그대로 위임 호출하므로 위 결함을 고스란히 상속한다
    (이 파일이 "판정자는 하나"를 강제하는 것 자체가, 위조 취약점도 하나로 만든다는 뜻이기도 하다).
  - 상세(실측): 아래 명령을 그대로 실행한 결과다.

    ```bash
    WD="$(mktemp -d)"
    mkdir -p "$WD/.claude"
    cp -r <repo>/.claude/hooks "$WD/.claude/hooks"
    cp -r <repo>/.claude/_shared "$WD/.claude/_shared"
    mkdir -p "$WD/scripts"; cp <repo>/scripts/check-review-gate.py "$WD/scripts/"

    cd "$WD" && git init -q -b main && git config user.email t@t && git config user.name t
    git add -A && git commit -q -m base
    git checkout -q -b feature

    mkdir -p codebase/backend/src
    echo "export const backdoor = true;" > codebase/backend/src/evil.ts
    mkdir -p "review/code/2099/01/01/00_00_00"
    printf '## 전체 위험도\n\nNONE\n' > "review/code/2099/01/01/00_00_00/SUMMARY.md"
    git add -A && git commit -q -m "feat: add evil.ts + forged future-dated review"

    python3 scripts/check-review-gate.py --root "$WD" --enforce
    ```

    출력:

    ```
    review-gate: 통과 — 1 codebase/ change(s) covered by a fresh resolved review — allowed
    ```
    `echo $?` → `0`.

    "PR" 전체는 `codebase/backend/src/evil.ts` 1줄 + `review/code/2099/01/01/00_00_00/SUMMARY.md`
    3줄, 단 2개 파일이다(`git diff --stat main..HEAD` 로 확인). 같은 코드 변경에서 그
    `review/` 디렉터리만 지우면 즉시 `blocked: True`(`review-gate: 미커버 — … no resolved
    review … was found.`)로 뒤집힘을 확인했다 — 즉 판정을 가른 유일한 요인이 그 3줄짜리
    자기-서술 텍스트다.

    Gate 2(spec-impl)도 동일한 방식으로 위조 가능함을 별도로 확인했다(spec `code:` glob 에
    걸리는 파일 + `review/consistency/**/SUMMARY.md` 에 `**BLOCK: NO**` + `meta.json` 에
    `--impl-done` 문자열만 있으면 통과):

    ```
    blocked: False | push_blocks: False
    reason : 1 codebase/ change(s) covered by a fresh resolved review and a fresh
             --impl-done consistency report (1 spec-linked) — allowed
    ```

    또한 `2099` 라는 눈에 띄는 날짜가 필요조건이 아니다 — 커밋 직후 몇 초 뒤 시각의 세션
    디렉터리만으로도 충분하다(코드 쪽 "author date" 클록도 방금 만든 커밋이라 사실상 같은
    시각이므로). 즉 위조는 "미래 연도" 처럼 눈에 띄는 흔적을 남기지 않고도 성립한다 —
    실제 `/ai-review` 산출물과 구조적으로 구별되지 않는다.

  - **이 결함이 이번 라운드의 diff 로 새로 생긴 것은 아니다** — `_summary_is_resolved` /
    `_path_session_time` / Gate 1·2 판정 로직은 `origin/main` 의 `review_guard.py` 에 이미
    있었다(1052줄, 이번 diff 는 `_run_git`의 `.strip()→.rstrip()` 수정 12줄뿐). 하지만 이번
    라운드가 **정확히 그 판정 함수를, 정규식 사각지대와 무관한 PR-facing CI 백스톱으로 승격**
    시켰고("판정자는 하나다"가 이 branch 전체의 설계 원칙), 그 판정자의 입력(리뷰 아티팩트)
    자체가 판정 대상 PR 이 직접 쓸 수 있는 파일이라는 사실은 8라운드 동안 어느 정적 스캔·워크플로
    비교·행위 테스트(`OneJudgeTest`, `WorkflowWiringTest`, `VerdictComesFromTheGateTest`,
    `TheGateItselfDoesNotBranchOnCiEnvTest`, `TheRealGateIgnoresTheEnvironmentTest`)도 다루지
    않는다 — 전부 "스크립트/워크플로/게이트 본체가 변조됐는가"만 보고, "이 PR 이 제출한 리뷰
    산출물이 진짜인가"는 어느 테스트도 묻지 않는다. 그래서 **이 위조는 방금 만든 2개 파일짜리
    임시 저장소에서도, 실제 저장소에서도 하네스 스위트를 단 하나도 건드리지 않고 성립한다** —
    "테스트가 전부 초록인 채 실제 PR 판정을 뒤집는" 경로 그 자체다. 그리고 이미 **오늘
    시점에 로컬 push 훅이 이 판정으로 실제 하드 차단을 걸고 있으므로**(관측 모드인 것은
    CI 백스톱 쪽뿐), 이 위조는 "`--enforce` 켤 때 문제"가 아니라 **지금 이미 유효한 우회**다.
  - 제안: 이 티켓의 "결정이 필요한 지점" 섹션에 이 항목을 추가할 것을 권한다 — `--enforce`
    여부를 결정하기 전에 다뤄야 할 문제다. 근본 해법은 "리뷰 산출물의 존재"가 아니라 "리뷰가
    실제로 도는 과정에서 생성됐다는 근거"를 요구하는 것: 예) 실제 harness 실행이 CI 자신의
    시각/신원으로 서명한 커밋 트레일러나 체크섬을 남기고 게이트가 그것을 검증, 또는 리뷰 결과를
    파일이 아니라 CI 봇이 게시하는 PR check/label 로 이원화, 최소한 `_path_session_time` 이
    CI 자신의 `time.time()` 보다 미래인 세션은 무효로 거부(오늘 당장 막을 수 있는 가장 싼 방어
    한 줄이지만 "며칠 전 날짜로 위조" 는 여전히 통과하므로 근본 해법은 아님). 설계 변경이라
    범위가 크다는 점은 인지하고 있고, 그래서 CRITICAL 이되 이번 라운드의 fix 대상이라기보다
    티켓의 다음 결정 지점으로 등재를 제안한다.

- **[INFO]** fail-open 로그가 무인 상태다. `scripts/check-review-gate.py` 는 게이트를
  못 불러오거나 예외를 던지면 stderr 에 `게이트를 불러오지 못했습니다`/`예외를 던졌습니다`
  를 찍고 exit 0 으로 넘어간다(관측 모드 설계상 올바름). 그런데 이 문자열을 감시하는
  주체가 현재 없다 — Actions 로그는 초록으로 뜨고, PR 작성자가 `review_guard.py` import 를
  고의로 깨거나(관련 없는 파일이라 `.claude/hooks/_lib/**` paths 트리거가 걸리긴 한다) 예외를
  유발하면 "리뷰 없음"과 "게이트가 죽음"이 Actions UI 상 구분되지 않는다.
  - 위치: `scripts/check-review-gate.py` 63-74행(`_load_gate`), 96-106행(예외 처리).
  - 제안: `--enforce` 전환을 검토하는 시점에 이 stderr 신호를 집계하는 소비자(예: 실패율
    대시보드, PR 코멘트)도 함께 마련할 것. 지금 당장의 차단 사유는 아니다(설계상 fail-open은
    의도됨) — 관측 목적을 완성하기 위한 제안.

- **[INFO]** `_porcelain_path`/`_dirty_set`(`review_guard.py`)이 `git status --porcelain -z`
  (NUL 구분)를 쓰지 않는다. 파일명에 개행이 포함되거나 `core.quotepath` 로 인용/이스케이프되는
  드문 경우, 줄 단위 파싱이 그 파일의 경로를 온전히 복원하지 못해 "방금 편집됨" 신호를 잃을 수
  있다 — 이번에 고친 7R 결함(선행 공백 손실)과 같은 방향(과소검출 → fail-open)의 잔여 사례다.
  실측하지는 않았다(파일명에 실제 개행을 넣는 것은 대부분의 파일시스템에서 비현실적이라
  우선순위는 낮음).
  - 위치: `review_guard.py` `_porcelain_path` 281-296행, `_dirty_set` 306-316행.
  - 제안: 우선순위 낮음. `-z` 로 전환하면 근본적으로 닫히지만 파서를 다시 써야 해 범위가 크다 —
    당장 조치보다는 알려진 잔여 표면으로 기록해 두는 것을 제안.

- **[INFO — 양호한 부분]** 이번 라운드가 새로 추가한 워크플로/코드에서 다음은 올바르게
  구현돼 있다.
  - `review-gate.yml` "Fetch base ref" 스텝(67-70행)이 `${{ github.base_ref }}` 를 `run:`
    셸 문자열에 직접 보간하지 않고 `env: BASE_REF: ...` 로 우회한 뒤 `"$BASE_REF"` 로
    따옴표 처리 — GitHub Actions 의 expression-injection 표준 완화책을 정확히 적용했다.
  - `pull_request`(●`pull_request_target` 아님) 트리거 + `permissions: contents: read`
    만 — 시크릿 노출도 없고 fork PR 코드가 상승된 토큰으로 실행되는 전형적 "pwn request"
    패턴을 피했다.
  - `_run_git`(`review_guard.py` 206-229행)은 `subprocess.run(["git", *args], ...)` 리스트
    형태만 쓰고 `shell=True` 를 쓰지 않는다 — 브랜치명·경로에 셸 메타문자가 있어도 커맨드
    인젝션 표면이 없다.
  - 이번 라운드가 리뷰 대상으로 지정한 11개 파일 어디에도 하드코딩된 API 키/비밀번호/토큰이
    없다(`grep -niE "api[_-]?key|secret|password|token\s*="` 결과, `_IMPL_DONE_MODE_TOKEN`
    상수 이름의 오탐 1건 외 없음).
  - `_run_git` 의 이번 수정(`.strip()` → `.rstrip()`, 212-229행)은 round 7 이 찾은
    " M path" 선행 공백 손실 fail-open 을 정확히 닫는다. 다른 모든 `_run_git` 소비자
    (`rev-parse`, `merge-base`, `diff --name-only`, `log --format=%at`)는 선행 공백에
    의존하지 않으므로 이 변경이 회귀를 만들지 않음을 코드 경로별로 확인했다.

---

## 재현 확인 — 작업 트리 무결성

모든 실험은 `mktemp -d` 로 만든 별도 디렉터리에서 수행했다. 검토 종료 시점 저장소 상태:

```
$ git status --porcelain
 M plan/in-progress/harness-review-gate-ci-backstop.md
?? review/code/2026/08/06/12_52_41/
```

`plan/in-progress/harness-review-gate-ci-backstop.md` 의 미커밋 수정은 이 리뷰 세션이
시작되기 전부터 존재하던 상태이며(마지막 커밋 `cd38361ac`) 본 리뷰 작업으로 만든 변경이
아니다. `review/code/2026/08/06/12_52_41/` 는 이 리뷰 세션 자신의 산출물 디렉터리다.

---

## 요약

이번 라운드(8R)가 이 브랜치의 diff 로 실제로 손댄 부분(`_run_git` 의 `.strip()→.rstrip()`
수정, `test_review_gate_ci.py` 신규 823줄, 워크플로 배선 등재제 확장)은 견고하다 — 8라운드에
걸쳐 정적 우회를 네 번 반증하고 결국 "문서 전체 정확 일치 + 행위 비교"라는 유한한 형태로
수렴시킨 설계는 실제로 버틴다(위 INFO 항목들에서 인젝션·시크릿·권한 관점 결함을 찾지 못했다).
다만 이 라운드가 새로 CI 백스톱으로 승격시킨 판정 함수 `evaluate_review()` 자체는, "리뷰가
실제로 일어났는가"를 파일 존재/텍스트 형태로만 판단하고 그 파일을 판정 대상 PR 자신이 쓸 수
있다는 근본적 약점을 그대로 상속한다. 이 약점은 8라운드의 어떤 정적/행위 테스트도 다루지 않는
축(워크플로·스크립트의 변조가 아니라 리뷰 산출물의 진위)이고, 로컬 push 훅에서는 **오늘 이미**
유효한 하드-차단 우회이며, CI 백스톱은 그 위조를 그대로 "통과"로 보고한다 — 3줄짜리 가짜
`SUMMARY.md` 만으로 `scripts/check-review-gate.py --enforce` 가 exit 0 을 낸다는 것을
실측으로 확인했다. `--enforce` 전환을 결정하기 전에 반드시 논의돼야 할 항목으로 제안한다.

## 위험도

CRITICAL
