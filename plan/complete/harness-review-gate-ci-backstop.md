---
title: 리뷰 게이트의 훅-독립 CI 백스톱 — 정규식이 유일 판정자인 사각지대를 닫을지
worktree: harness-review-ci-backstop-91f379
started: 2026-07-25
completed: 2026-08-07
owner: developer
priority: P2
---

> **2026-08-07 — 완료.** 본체(관측 모드, 2026-08-01) → `--enforce` 전환(2026-08-07)까지
> 끝났고 CI 에서 실판정이 돌고 있다. 진행 중 발견한 미해결 후속 14건과 조사 1건은
> [`harness-review-gate-followups.md`](../in-progress/harness-review-gate-followups.md)
> 로 분리했다 — 이 티켓의 주제와 별개라 함께 종결할 수 없다.
>
> **남긴 한계 (닫지 못한 채 켰다)**: 게이트는 "리뷰가 수행됐는가" 가 아니라 산출물의
> 존재와 텍스트 형태만 본다. 막는 것은 "리뷰 없음"·"stale 리뷰" 이지 "형식만 갖춘
> 가짜" 가 아니다. 그 축은 별도 설계다.
>
> **2026-07-31 진행** — 아래 §관측 2건을 처리했다. 한 건은 **전제가 반증**됐고 그 자리에 다른
> 진짜 결함이 있었다. 본 티켓의 **주제(CI 백스톱)는 여전히 미착수**이며 설계 결정이 선행이다.
>
> | 항목 | 결과 |
> |---|---|
> | §관측(1) changeset 증분 산정 | **전제 반증** → 다른 결함으로 대체 수정 (아래) |
> | §관측(2) `SUMMARY pending` push 허용 | **수정 완료** (아래) |
> | §재발 관측 8번째 (번들 누락) | **수정 완료** — `harness-consistency-summary-downgrade-rule.md` 쪽에 기록 |
> | CI 백스톱 본체 | ~~**미착수**~~ → **2026-08-01 구현 완료 (관측 모드)** — 아래 배너 참조 |
> | 배선 가드 경화 | **1R~12R — 12R 에서 CRITICAL 0** — 아래 §배선 가드 참조 |
> | CI 재활성화 후 누적 결함 | **7건 드러남** — 5건 처리 완료·2건 PR 진행 중. 의존성 override 침식은 `deps-guard-hardening.md` 에 기록 |
>
> **§배선 가드 — 라운드를 거듭한 경화 이력.** 본체는 얇다(게이트에 위임하는 어댑터).
> 실제 어려움은 전부 "이 배선이 조용히 꺼지지 않음" 을 어떻게 강제하느냐였고, 매 라운드
> 뚫렸다:
>
> | 라운드 | 가드 형태 | 무엇에 뚫렸나 |
> |---|---|---|
> | 1R | 파일 전체 substring | `if:` 를 지우고 같은 문자열을 `env:` 에 남기면 통과 |
> | 2R | 구조 파싱 + 부분 정규식 | `(actor == 'dependabot[bot]') != false` (의미 정반대) |
> | 3R | 앵커 없는 정규식 | `if: … && false` — 백스톱이 모든 PR 에서 영구히 꺼져도 통과 |
> | 4R | **필드별** 정확 일치 | `jobs.gate.continue-on-error` · `on.pull_request.branches` ·
>   `types: [closed]` · step 목록에 스텁 삽입 — **내가 고정한 필드만 안전했다** |
>
> | 5R | 문서 전체 정확 일치(review-gate.yml) | **그 파일 밖으로** — `harness-checks.yml` 을 무력화(job `if: false`/`continue-on-error`), discovery 패턴을 한 글자 좁혀 가드 11개를 안 돌게, `os.environ` 을 비-Call 문법으로 읽어 판정 우회 |
> | 6R | 위 전부 | **또 한 층 밖** — `on.pull_request` 형제 키(`types`/`branches`), **step** 레벨 `if:`, `from os import environ as _E`, **게이트 본체**(`review_guard.py`)의 env 분기, 같은 `name:`/job id 를 참칭하는 워크플로 추가 |
> | 7R | 위 전부 | **위임 대상과 문법 축** — 게이트가 위임하는 `_shared/**` 의 env 분기, `os.environ.items()` 류 미인식 문법, GitHub 이 실제로 쓰는 job `name:` override 로 identity 참칭, 필터 없는 bare `pull_request:`. 그리고 **가드 우회가 아닌 살아있는 결함 1건** — `_run_git` 의 `.strip()` 이 porcelain 선행 공백을 지워 경로 첫 글자가 깎였고, 이미 enforce 중인 로컬 훅이 "파일 하나 고치고 push" 에서 fail-open 했다 |
>
> | 8R | 위 전부 | **우회 0건.** 대신 자매 훅 `plan_guard` 가 7R 이 고친 `.strip()` 을 그대로
>   갖고 있었다 — 이번엔 fail-open 이 아니라 **거짓 차단**(갱신한 plan 이 미갱신으로 읽혀 push 가
>   막힘). 이 저장소 작업 트리에서 재현. 그리고 게이트가 "리뷰 수행" 이 아니라 **산출물의 형태**만
>   본다는 신뢰 모델 — `--enforce` 선행 조건으로 등재(아래 §결정) |
> | 9R | 위 전부 | **우회 0건.** 같은 git 프로브 5개가 **세** 모듈에 복제돼 있었고(7R·8R 이 두 번 다
>   빠뜨린 `branch_guard` 가 셋째), 열 개 넘는 사본을 **어떤 테스트도 실행하지 않았다**(mock 우회).
>   `_shared/git_probe.py` 로 통합. 더해 `_summary_is_resolved` 의 무조건 `break` 로 헛매치 한 줄이면
>   CRITICAL 리포트가 "해결됨" 이 되는 잠복 경로 |
> | 10R | 위 전부 | **우회 0건, CRITICAL 1.** 9R 통합이 여섯 번째 `_current_branch` 를 빠뜨렸다 —
>   통합도 그것을 지키는 가드도 **손으로 쓴 목록**이었기 때문이다. 가드를 열거에서 **도출**로
>   바꿨다(세 모듈 AST 를 비교해 본문 동일 함수가 남아 있으면 실패) |
>
> | 11R | 위 전부 | **우회 0.** 이 층이 **정작 목표 환경에서 무력**이었다 — `actions/checkout`
>   위상(`init`+`remote add`+`fetch`, `remote set-head` 없음)에는 `refs/remotes/origin/HEAD` 도
>   로컬 `refs/heads/main` 도 없어 base 해석이 네트워크 호출로 떨어지고, 그게 실패하면
>   "codebase 변경 없음 — 허용". 관측 로그가 전부 거짓 통과로 쌓일 뻔했다.
>   `refs/remotes/origin/<name>` 을 보게 해 닫았다(`ActionsCheckoutTopologyTest`) |
> | 12R | 위 전부 | **CRITICAL 0.** WARNING 은 (a) 내 경화 감사가 불완전했고(미경화 7곳 중
>   3곳이 내가 "경화했다" 고 말한 그 파일), (b) 11R 이 "네트워크 경로에 도달 안 한다" 고
>   적은 것이 CI 위상에서 거짓이었다 — 매 PR 마다 2초를 태우고 있었다. 둘 다 처분 |
>
> 4R 에서 결론: **부분집합에 대한 정확 일치는 여전히 부분 일치다.** 파싱된 워크플로
> **문서 전체**를 하나의 기대값과 비교하도록 바꿨다 — 어디에 무엇을 더하든 빼든 실패하고,
> 남는 열린 필드가 없다. 판정자 단일성은 별개로 **행위**(스텁 게이트 판정 × `--enforce`
> 네 조합에 대한 종료 코드)로 고정한다. 정적으로 부정을 증명하려는 시도는 4세대에 걸쳐
> 전부 반증됐다.
>
> 5R·6R 에서 다시: **한 파일을 닫으면 우회는 그 파일 밖으로 간다.** 지금까지 닫은 층은
> 워크플로 문서 → 그것을 실어 나르는 CI 배선(job/step 조건 등재제, 스위트 호출 명령 고정,
> `continue-on-error` 전역 금지, PR 트리거 키 집합 등재제, 워크플로 identity 유일성) →
> 스크립트 입력 축(환경 접근 정적 금지 + 최소·적대적 환경 행위 테스트) → **게이트 본체의
> env 등재제** → 그리고 이 층 전체가 서 있는 전제(`review/**` 가 추적된다는 사실).
>
> 열린 질문: `Fetch base ref` step 이 `fetch-depth: 0` 위에서 실제로 필요한지는
> GH Actions 러너 없이 실측할 수 없어 판정하지 못했다. 문서 전체 고정으로 **삭제는
> 막히지만** 필요성 자체는 미확인이다.
>
> **작업 중 발견된 신규 결함 1건 (수정 완료)** — `code_review_orchestrator.build_files_section`
> 이 프롬프트 예산 초과 파일을 **아무 표시 없이** 통째로 누락시켰다. 내용을 작은 파일부터
> 담고 안 들어가는 첫 파일에서 `break` 하므로, 그 뒤 더 큰 파일들은 헤더만 남는다(명시 파일
> 리뷰에는 diff 도 없어 메타데이터 2줄이 전부). **이 PR 의 리뷰 세션에서 실제로 발현** —
> `review_guard.py`·`code_review_orchestrator.py` 가 14개 프롬프트 전원에서 31바이트 섹션으로
> 나왔고 그 둘이 이 PR 의 핵심 파일이었다. 즉 §재발 관측이 consistency 쪽에서 8회 기록한
> 결함 클래스의 **code-review 쪽 쌍둥이**다. 생략 사실 + 읽을 경로를 명시하도록 수정.
>
> **신규 후속 (defer)** — 이 티켓을 진행하며 발견한 미해결 항목 14건은
> [`harness-review-gate-followups.md`](harness-review-gate-followups.md) 로 옮겼다.
> 전부 이 티켓의 **주제(CI 백스톱)와 별개**로 발견된 것이고, 여기 남겨 두면 이 plan 이
> 영원히 완료되지 않는다 — lifecycle §3 은 완료 조건을 "체크박스 전부 `[x]` + 미해결
> follow-up 0건" 으로 정의한다. 원문(발견 경위·실측치·처방 후보)은 그대로 옮겼다.

> **2026-08-01 — 본체 구현 완료 (관측 모드).** `review-gate.yml` + `check-review-gate.py`.
> 판정은 로컬 훅과 **같은** `evaluate_review()` 에 위임하고, 트리거만 훅 밖(GitHub PR
> 이벤트)에 둔다 — 이 층의 목적이 "push 탐지 정규식이 유일 판정자" 인 사각을 닫는 것이므로
> 필요한 독립성은 트리거뿐이고, 판정을 새로 구현하면 로컬/CI drift 를 만든다.
>
> ~~**enforce 로 뒤집는 것은 별도 결정이다.**~~ → **2026-08-07 전환 완료.**
>
> **전환 전 재측정 (18% 는 낡은 값이었다).** 종전 근거는 "지금 켜면 이력상 18% 를 막는데 그건
> 미리뷰가 아니라 산출물 미커밋" 이었다. 그 수치는 옛 merge-commit 시절 표본이라 지금은
> 성립하지 않는다 — 이 저장소는 **squash 머지**라 `--first-parent --merges` 로는 최근 9주
> 대상이 **0건**으로 잡힌다(그래서 옛 표본만 걸렸다). 커밋 단위로 다시 재고, 워크플로가
> `github.actor` 로 이미 제외하는 dependabot 을 뺀 값:
>
> | 구간 | dependabot 제외 `codebase/**` 커밋 | 리뷰 산출물 미동반 |
> |---|---|---|
> | 최근 5주 | 158건 | **20건 (12.7%)** |
> | 최근 9주 | 409건 | **41건 (10.0%)** |
>
> (dependabot 을 포함하면 5주 27%·9주 16% 로 뛴다 — 미동반 52건 중 32건이 `build(deps): Bump`
> 였다. 워크플로가 그들을 이미 건너뛰므로 그 몫은 마찰이 아니다.)
>
> 즉 남는 마찰은 실제 기능·수정 PR 의 **약 1/8** 이고, 해소 방법은 리뷰 산출물을 그 PR 에 함께
> 커밋하는 것 — 이 저장소가 이미 규약으로 요구하는 절차다.
>
> **관측 실판정**: 전환 직전까지 `review-gate` 는 3회 실행돼 전부 success 였다
> (`packages-prepare-stale-dist` · `spec-link-guard-missing-deps` · `deps-override-floors-eroded`).
> 표본이 작고 전부 같은 세션의 PR 이라 "마찰 없음" 의 근거로는 약하다 — 위 이력 실측이 더 신뢰
> 가능한 예측치다.
>
> **⛔ 전환해도 닫히지 않는 축 (8R 선행조건, 유효)**: 게이트는 "리뷰가 수행됐는가" 가 아니라
> **산출물의 존재와 텍스트 형태**만 본다. `codebase/` 1줄 + 손으로 쓴 3줄 `SUMMARY.md` 로
> `--enforce` 가 통과함이 격리 저장소에서 실증됐다. 따라서 이 층이 막는 것은 **"리뷰 없음" 과
> "stale 리뷰"** 이지 **"형식만 갖춘 가짜"** 가 아니다. 그 축을 닫으려면 산출물이 실제 리뷰에서
> 나왔음을 증명할 무언가(예: reviewer 리포트 14종의 동반 존재·형태 검증)가 필요하고, 그건 별도
> 설계다. **전환은 이 한계를 알고 내린 결정이다.**
>
> 바꾼 곳은 예고대로 둘 — 워크플로의 `run:` 한 줄과 그것을 고정하는 단언. 단언은 방향을 뒤집어
> (`assertNotIn` → `assertIn`) 이제 **꺼지는 쪽**을 막는다. 뮤테이션 확인: 워크플로를 관측
> 모드로 되돌리면 `test_the_whole_workflow_matches_the_expected_wiring` 이 RED.
>
> **2026-08-06 — 이 계획이 서 있던 전제가 거짓이었다: 저장소의 Actions 가 꺼져 있었다.**
> 머지(#1089) 직후 실행을 확인하려다 발견했다. `GET /actions/permissions` 가
> `{"enabled": false}` 였고, `pull_request` 이벤트로 실행된 마지막 워크플로가 **2026-05-16**
> 이다(약 12주). 머지 커밋 `de784a4ba` 에 등록된 check-run 수도 **0** 이라 설정 플래그가 아니라
> 실행 부재로 확인된다.
>
> 즉 11R 이 닫은 결함 — "이 층이 정작 목표 환경에서 무력" — **의 한 층 바깥이 그대로 있었다.**
> 11R 은 게이트가 `actions/checkout` 위상에서 base 를 못 잡는 것을 고쳤는데, 그 위상 자체가
> 생성되지 않고 있었다. 관측 모드로 시작해 로그를 보고 `--enforce` 를 정한다는 위 문단은,
> Actions 가 꺼진 채로는 **로그가 0건이라 판단 시점에 영원히 도달하지 못한다.**
>
> 범위는 이 티켓보다 넓다. `harness-checks`(현재 854 테스트) · `frontend-checks` ·
> `spec-link-checks` · `packages-checks` 는 **한 번도 실행된 적이 없다** — 넷 다 Actions 가
> 꺼진 뒤에 추가됐다(`harness-checks` 는 2026-05-30). 두 달간 하네스에 쌓은 가드 전부가
> CI 에서 실행된 적 없이 로컬 훅만을 유일 집행자로 두고 있었고, 이는 이 티켓이 없애려던
> 상태 그 자체다.
>
> 2026-08-06 사용자가 활성화(`enabled: true`, `allowed_actions: all`). **다만 `review-gate.yml`
> 은 `pull_request` 트리거라 이미 머지된 #1089 로는 소급 실행되지 않는다** — 다음 PR 이
> 처음이다.
>
> **켠 뒤 실제로 걸린 결함 (관측 기록).** 이 계획이 예견한 "CI 를 켜면 누적분이 나온다" 의
> 실례. 전부 이 티켓 밖 기존 결함이고, CI 가 꺼져 있던 동안 아무도 못 본 것들이다.
>
> | # | 결함 | 드러난 경로 |
> |---|---|---|
> | 1 | `playwright-runner` 의 `./codebase` 통마운트가 이미지의 `packages/*/dist` 를 덮어 `next build` 가 `Module not found: '@workflow/*'` 로 죽음 | e2e-frontend 첫 실행 (#1091) |
> | 2 | `_file_mtime` 의 `stat -f %m \|\| stat -c %Y` 가 GNU 에서 `?` 를 반환 — 쿨다운이 영영 만료되지 않음 | harness-checks 첫 완주 (#1091) |
> | 3 | line-anchor 테스트가 PNG blob 을 UTF-8 로 디코드하다 `UnicodeDecodeError` | harness-checks 첫 완주 (#1091) |
> | 4 | `harness-checks` 의 `timeout-minutes: 5` 가 실측 job 566초의 53% — 한 번도 안 돌려보고 정한 값 | harness-checks 첫 실행 (#1091) |
> | 5 | 내부 패키지 `prepare` 가 `[ -d dist ]` 로 디렉터리 존재만 봐 stale dist 를 재빌드하지 않음 | 위 1번을 진단하다 발견 |
>
> 1~4 는 #1091 로 종결. 5 는 별도 PR.

> **교훈 — 배선의 마지막 한 칸은 저장소 설정이고, 그것만은 코드가 관측할 수 없다.**
> 이 브랜치는 12라운드에 걸쳐 "가드가 실제로 도는가" 를 반복해서 물었고 트리거 paths·
> 실패 삼킴·step 조건·base 해석까지 전부 고정했는데, 정작 **Actions 스위치**는 리포지토리
> 밖 상태라 어떤 테스트도 볼 수 없었다. 새 워크플로를 추가할 때는 머지 후 그 PR 의
> check-run 수를 **한 번은 실측**할 것 — 파일이 착지한 것과 그것이 도는 것은 다르다.

## Overview

[`harness-push-gate-did-not-fire`](../complete/harness-push-gate-did-not-fire.md) §M 에서 분리.
그 티켓은 push 탐지 정규식의 결함(newline separator 누락)을 고쳤다. 이 티켓은 그 근본 수정이
**닫지 못하는** 층을 다룬다.

## 문제 — 사후 탐지가 같은 사각지대를 공유한다

§M 이 고친 결함은 "`_GIT_PUSH` 가 여러 줄 push 를 못 잡아 게이트가 조용히 skip" 이었다.
자연스러운 방어책은 "게이트가 안 돌았음을 사후에 기록/탐지" 인데, **그게 성립하지 않는다**:

- push 가 실제 push 인지 판정하는 게 **바로 그 정규식**이다.
- 정규식이 push 를 놓치면, "게이트를 돌려야 했는데 안 돌았다" 는 사실 자체를 인지할 주체가 없다.
  fail-open 배너조차 `_is_git_push` 가 True 여야 찍힌다("not a push" 는 조기 return).
- 즉 사후 탐지 로직을 훅 안에 두면 **같은 판정자에 의존**해 같은 구멍으로 샌다.

## 후보 — 훅에 의존하지 않는 층

- [x] **CI 게이트**: PR 에 `codebase/**` diff 가 있는데 그 변경을 커버하는 *해결된* 리뷰
      산출물이 없으면 CI 가 보고한다. 훅(로컬 PreToolUse)과 **독립**이라 정규식 사각지대를
      공유하지 않는다. → **구현 완료** — `.github/workflows/review-gate.yml` +
      `scripts/check-review-gate.py`. **관측 모드로 시작한다**(아래 §마찰 참조).
      - ~~리뷰 산출물(`review/code/**`)은 gitignored 라 PR 에 없다 → CI 가 무엇으로 "리뷰됨" 을
        판정할지 설계 필요(커밋 trailer? PR label? 별도 signed marker?).~~
        **전제 반증 (2026-08-01 실측)**. `.gitignore` 가 제외하는 것은 `review/**/_prompts/`
        뿐이고, `origin/main` 이 `review/code` 아래 **8,851개**(`review/` 전체 14,517개)를
        추적한다. 산출물은 PR 에 그대로 들어있다 → 별도 marker 설계가 필요 없다.
- [x] ~~대안: push 시 게이트 **통과 기록**(상태 파일 타임스탬프)을 남기고, 별도 감사에서
      "codebase 변경 push 인데 기록 없음" 을 탐지.~~ → **소멸 (설계 불요).** 바로 위 항목이
      실측으로 보였듯 리뷰 산출물은 이미 PR 에 커밋돼 있다(`origin/main` 이 `review/code`
      아래 8,851개 추적). 별도 marker 를 만들 이유가 없어졌고, 실제 구현은 그 산출물을 그대로
      읽는 쪽으로 갔다. **수행해서 체크한 것이 아니라 필요 자체가 사라진 항목**이다.

## 결정이 필요한 지점 (그래서 P2, 사용자/설계 판단)

> **2026-08-01 실측으로 아래 3건 중 1건은 소멸, 1건은 이미 해결돼 있었다.** 남은 것은 마찰 판단뿐.

- ~~CI 가 "리뷰됨" 을 무엇으로 인식하는가 — gitignored 산출물을 CI 에 어떻게 노출하나.~~
  **소멸** — 산출물이 커밋돼 있다(위 §후보 참조). CI 는 로컬 훅과 **같은** `evaluate_review()` 를
  그대로 호출하면 된다. 판정자가 하나라 로컬/CI 판정이 갈릴 여지도 없다.
- ~~CI 체크아웃은 mtime 을 뭉개니 신선도 판정이 불가할 것~~ — **이미 해결돼 있음**(적어둔 적
  없는 암묵 전제였다). `review_guard` 는 fs mtime 을 신뢰하지 않는다: clean 파일은 마지막 커밋
  시각을 쓰고, "리뷰가 언제 돌았나" 의 정본 시계는 세션 **디렉토리 이름**이다 — 둘 다
  checkout-immune. 즉 CI 백스톱은 판정 메커니즘 설계가 아니라 **배선** 작업이다.
- ⛔ **`--enforce` 전환의 선행 조건 (2026-08-06 8R, 실증)** — 게이트는 "리뷰가 실제로 수행됐는가"
  가 아니라 **산출물의 존재와 텍스트 형태**만 본다. 그 산출물은 판정 대상 PR 안에서 작성자가
  직접 커밋한다. 격리 저장소 실증: `codebase/` 1줄 + 손으로 쓴 3줄짜리 `SUMMARY.md` 만으로
  `--enforce` 가 `통과`, exit 0.

  이 결함은 이 브랜치가 만든 것이 아니다(`origin/main` 의 판정 로직이고 **로컬 push 훅에서는
  오늘 이미 유효한 우회**다). 다만 이 브랜치가 그 판정을 PR-facing 게이트로 승격시키므로,
  **`--enforce` 로 뒤집기 전에 반드시 결론이 나야 한다.**

  ⚠️ **날짜 검사는 해결책이 아니다.** 실측으로 갈렸다 — 미래 날짜(`2099/…`) 세션은 통과하고
  과거 날짜는 막힌다. 그래서 "미래 세션 거부" 를 넣고 싶어지지만, 공격자는 **지금 날짜**로
  만들면 그만이라 아무것도 닫지 못한다. 닫히는 것처럼 보이는 반쪽 조치를 넣지 않는다.

  실제 선택지는 신뢰의 뿌리를 옮기는 것이고, 전부 사용자/설계 결정이다:
  (a) harness 실행이 CI 자신의 시각·신원으로 서명한 커밋 트레일러/체크섬을 남기고 게이트가 검증,
  (b) 리뷰 결과를 파일이 아니라 **CI 봇이 게시하는 PR check/label** 로 이원화,
  (c) 위조 가능성을 명시적으로 수용하고 이 층을 "정직한 실수 방지" 로만 규정.
  관측 모드로 출시하는 현재 상태에서는 (c) 가 사실상의 기본값이며, 그 사실을 여기 적어둔다.

- **남은 실질 결정: 이중 게이트의 마찰.** 실측(게이트 도입 `fa3cf81ad` 이후 main first-parent
  666 커밋): `codebase/**` 를 건드린 427건 중 61건(14%)이 같은 커밋에 SUMMARY.md 가 없다.
  분해 = dependabot/build(deps) 3 · lockfile-only 1 · 그 외 진짜 소스 변경 57.
  - ⚠️ **위 57 은 거친 프록시였다. 착수하며 PR 단위로 재측정했다.**
    "rebase-merge 라 코드/리뷰 커밋이 갈린다" 는 내 추정은 **틀렸다** — 이 저장소는
    squash merge 이고 PR 당 커밋이 정확히 1개다(게이트 이후 676건 중 664건이 `(#N)` 로
    끝나고 675건이 단일 부모). 즉 커밋 단위 = PR 단위다.
    게이트의 실제 술어(SUMMARY + RESOLUTION 또는 위험도 NONE/LOW)로 재집계:

    | | |
    |---|---|
    | `codebase/**` PR | 435 |
    | 해결된 리뷰 동반 | 355 (81%) |
    | **미커버** | **80 (18%)** — dependabot 11 + 그 외 69 |

    월별 비봇 차단율: 2026-06 **9%**, 2026-07 **18%**, 2026-08 0%(9건 중 8건이 봇).

  - **결정적 발견 — 이건 "미리뷰" 가 아니라 "산출물 미커밋" 이다.** 차단 표본 8건을 추적하니
    전부 PR 날짜 ±1일에 저장소 어딘가 리뷰 세션이 있었다. 한 건을 끝까지 파보면:
    `e96ef1b45`(webhook 민감 헤더 마스킹)는 review/ 파일을 **0개** 커밋했고, 같은 날 code
    세션 7개는 **전부 다른 PR** 이 커밋했다.
    로컬 훅은 **미커밋** 파일도 보고(working tree) CI 는 커밋된 것만 보므로, 하드 차단으로
    켜면 "리뷰를 안 했다" 가 아니라 **"산출물을 이 PR 에 안 담았다"** 를 막게 된다 —
    워크플로 계약 변경이다.
  - **확실한 마찰 1건: dependabot** → **처리 완료.** 봇 PR 은 로컬 훅을 아예 안 거치므로
    리뷰 산출물이 있을 수 없다. `if: github.actor != 'dependabot[bot]'` 로 면제했다 —
    없으면 이 워크플로는 사실상 dependabot 전용 알람이 된다(2026-08 미커버 9건 중 8건이 봇).
- 이 저장소가 이미 `guard_review_before_push` 를 신뢰하는데, 두 번째 층의 비용 대비 이득.

## Rationale

**왜 P2 (즉시 아님).** §M 이 활성 결함(가장 흔한 push 형태 우회)을 이미 닫았다. 이 티켓은
"방어 심화" 이지 활성 구멍이 아니다. 그리고 CI 층은 설계 결정(리뷰됨 판정 메커니즘)이 선행이라
독립 범위다.

**왜 훅 안에서 안 닫나.** 위 §문제 — 자기 판정자에 의존하는 사후 탐지는 사각지대를 공유한다.
이 통찰 자체가 §M 조사의 산물이라 유실되지 않게 티켓으로 고정한다.

## 관측 — 리뷰 게이트를 거짓 통과시킬 수 있는 경로 2건 (2026-07-27, 실측)

`ie-resume-turn-boundary-cancel` PR 진행 중 **둘 다 실제로 발생**했다. 하나는 리뷰 자체를
무의미하게 만들고, 다른 하나는 그 상태로 push 를 허용한다. 위 CI backstop 논의의 직접 근거 사례.

### (1) changeset 산정이 증분이라 직전 fix 가 통째로 리뷰에서 빠진다

5라운드 리뷰의 changeset 이 **`testing.md` 1건**뿐이었다. 그런데 직전 라운드 fix 는
`codebase/backend/src/modules/execution-engine/` 아래 **5개 파일**을 바꿨다(개명 + 헬퍼 추출).
즉 그 코드는 **한 번도 리뷰되지 않은 채** "Critical 0 / LOW" 라는 수렴 신호만 나왔다.

- `--prepare --branch origin/main` 도, `--prepare --range origin/main..HEAD` 도 결과가 같았다
  (둘 다 1건) — **changeset 은 "직전 리뷰 세션 이후 변경분" 증분으로 산정되고 `--branch`/
  `--range` 는 그 산정에 쓰이지 않는 것으로 보인다.**
- 게다가 그 1건조차 동일 원자 커밋(`75967fab3`)에 함께 들어간 16개 형제 파일 중 하나만
  뽑힌 것이었다(리뷰어 scope 도 독립 지적).
- **우회(실측 성공)**: 파일을 positional 인자로 **명시** + `--route=all`
  → changeset 5건, router skip, 전수 14명 실행 확인.

- [x] ~~`--branch`/`--range` 가 changeset 산정에 실제로 반영되도록 수정~~ → **전제 반증**.
      실측하면 완전히 반영된다: raw `git diff --name-only origin/main~5...` 189건 =
      `get_git_branch_diff_files()` 189건 = `collect_change_infos(--branch)` 189건.
      `prepare_session` 도 받은 `change_infos` 를 그대로 쓰고 증분 필터가 없으며,
      `loop_mode` 는 config 에 저장만 되고 어디서도 읽히지 않는다(dead field).
      **진짜 결함은 기본 경로였다** — 인자 없는 `--prepare` 는 staged+unstaged+untracked,
      즉 "아직 커밋 안 된 것" 만 모은다. 리뷰 워크플로는 커밋을 먼저 하므로(push 게이트가
      커밋이 리뷰보다 앞서기를 요구) 그 시점 집합은 비거나 한두 개뿐이고, 리뷰어는 거의 빈
      코퍼스를 받는데 요약은 "Critical 0" 을 낸다. 실측(2026-07-31, 이 브랜치): 기본 **0건**
      vs `--branch origin/main` **6건**. 위 관측의 "1건" 도 이 경로였을 것이다.
      → **[x] 경고 구현**: 기본 경로에서 브랜치 diff 미포함분을 감지해 빠진 파일을 이름으로
      나열하고 `--branch <base>` 를 안내. changeset 자체는 불변(조용히 넓히면 호출자가 요청하지
      않은 파일을 리뷰하게 되고, 명시 모드는 이미 올바르다). git 실패 시 침묵.
      테스트 `test_review_changeset_warning.py` 12건 + mutation 4종 RED (라운드마다 증가 — 정확한 수는 파일이 SoT).

> 교훈: **"우회(파일 명시 + `--route=all`)가 통했다"는 사실이 원인 진단을 보증하지 않는다.**
> 우회가 통한 이유는 `--branch` 가 고장나서가 아니라 기본 경로가 커밋된 작업을 안 담아서였다.
> 두 설명 모두 같은 우회로 해결되므로 관측만으로는 갈리지 않는다 — 코드를 읽고 실측해야 갈린다.
- [x] ~~동일 커밋의 형제 파일이 부분만 뽑히는 원인 확인~~ → **이관.**
      [`harness-review-gate-followups.md`](../in-progress/harness-review-gate-followups.md)
      에서 계속한다 (이 티켓의 주제와 별개인 조사라 함께 종결할 수 없다).

### (2) `SUMMARY pending` 세션이 push 를 허용한다

리뷰 Workflow 가 끝났지만 main 이 아직 `SUMMARY.md` 를 디스크에 쓰기 전 상태에서
`evaluate_review()` 가 이렇게 답한다:

```text
blocked: False
reason : a code review session is in flight (started, SUMMARY pending) — allowed
```

`SUMMARY.md` 를 기록한 직후 재판정하면 정확히 차단된다
(`8 codebase/ file(s) changed AFTER the most recent resolved review`).
즉 **세션 디렉토리만 만들어 두면 그 사이 push 가 열린다.** 메모리의 "빈 세션 디렉토리가
게이트를 거짓 통과시킴 — `blocked=False` 여도 reason 을 읽어라" 와 같은 클래스이며,
이번엔 정상 워크플로 진행 중에 자연 발생했다.

- [x] ~~in-flight 허용을 **시간 상한**으로 제한~~ → **시간 상한은 이미 있었다**
      (`_IN_FLIGHT_TTL_SECONDS = 1800`, checkout-immune 세션 디렉토리 타임스탬프 기준,
      `meta.json` 파싱 검증까지 포함). "무기한" 이라는 서술은 부정확했다.
- [x] **진짜 결함은 스코프였다 — 수정 완료.** push 가드(`guard_review_before_push.py:846`)와
      stop 가드(`guard_review_before_stop.py:340`)가 **같은 `evaluate_review()`** 를 부르는데,
      in-flight 억제가 그 함수 안에서 **무조건** 적용됐다. 그 억제의 목적은 Stop nudge 전용
      ("모델이 지금 돌리는 중인 리뷰를 두고 턴 종료를 막지 말 것")인데, 같은 함수를 쓰는
      push 까지 TTL(30분) 동안 열어 준 것이다.
      **자기 불변식이 거짓이었다**: `_IN_FLIGHT_TTL_SECONDS` 주석과 `_code_review_in_flight`
      docstring 이 둘 다 "the push guard still hard-gates" 라고 적어 뒀는데, 억제가 무조건인
      동안 그 문장은 참일 수 없었다.
      → `evaluate_review(cwd=None, *, in_flight_ok=False)` 로 opt-in 화하고 Stop 가드만
      `True` 를 넘긴다. push 호출부 무변경. 주석 2곳은 "opt-in 이라서 참" 이라는 근거를 붙여
      정정. 테스트: 양방향 분리 + Stop→evaluate_review seam 이 실제로 kwarg 를 넘기는지 단언
      (seam 단언이 없으면 kwarg 를 떨어뜨려도 결정 객체가 동일해 전부 통과한다). mutation 3종 RED.

> 부수 교훈: `evaluate_review()` 는 `blocked` 만 보지 말고 **`reason` 을 읽어야** 한다.

### 재발 관측 (2026-07-30 `19_00_25`) — 8번째

`--impl-done spec/5-system/` 에서 실제 target(`4-execution-engine.md`·`6-websocket-protocol.md`)이
5개 checker 프롬프트 **전원**에서 누락되고 무관 파일 3개(`1-auth.md`/`10-graph-rag.md`/
`11-mcp-client.md`)만 실렸다. 사전순 정렬 + 예산초과 조합, 같은 패턴 8번째.

완화 확인: 이번엔 checker **5명 전원**이 워크트리 직접 Read + `git diff` 로 우회해 결론 신뢰성에는
영향이 없었다. 다만 7번째 재발(`17_21_27`) 때는 5명 중 1명만 우회했고 **나머지 3명은 그 영역을
전혀 검토하지 못했다** — 우회는 checker 별로 불균등하므로 완화책으로 신뢰할 수 없다.

## 부록 — CI 를 켠 뒤 드러난 기존 결함 (2026-08-06, 이 티켓 밖)

이 계획이 예견한 "Actions 를 켜면 두 달치 누적분이 나온다" 의 실례. 전부 `origin/main` 에
이미 있던 것이고 이 티켓의 코드가 만든 것이 아니다.

| # | 결함 | 상태 |
| --- | --- | --- |
| 1 | `playwright-runner` 통마운트가 이미지의 `packages/*/dist` 를 덮음 | #1091 종결 |
| 2 | `_file_mtime` 의 `stat -f` 가 GNU 에서 `?` 반환 → 쿨다운 영구 미만료 | #1091 종결 |
| 3 | line-anchor 테스트가 PNG blob 을 UTF-8 디코드 → `UnicodeDecodeError` | #1091 종결 |
| 4 | `harness-checks` 의 `timeout-minutes: 5` 가 실측 job 566초의 53% | #1091 종결 |
| 5 | 내부 패키지 `prepare` 가 디렉터리 존재만 봐 stale dist 미재빌드 | PR #1093 (`claude/packages-prepare-stale-dist`, `1ac458d07`) |
| 6 | `spec-link-integrity` 가 **미선언 의존**으로 CI 에서만 실패 | 본 PR (`claude/spec-link-guard-missing-deps`) — 최종 확인은 CI 그린 |
| 7 | `check-override-floors.py` 가 `origin/main` 에서도 exit 1 (override 바닥 침식) | **미처분** — 별도 브랜치 진행 예정 |

**#6 이 특히 오래 숨은 이유 — 워크트리 중첩이 `node-linker=isolated` 를 무력화한다.**
`spec-links.ts` 가 `mdast-util-from-markdown`·`mdast-util-to-string`·`github-slugger`·
`mdast`(타입) 를 import 하는데 **어느 매니페스트에도 선언이 없었다.** 그런데 로컬에서는
13 tests 가 통과한다. 해소 경로를 추적하니

```
/Volumes/project/private/clemvion/node_modules/mdast-util-from-markdown/index.js
                                  ↑ 메인 체크아웃 (워크트리의 부모)
```

워크트리가 `<repo>/.claude/worktrees/` 아래 **중첩**이라 node 가 상위로 걸어 올라가 부모의
`node_modules` 를 찾는다. `.npmrc` 의 `node-linker=isolated` 가 "선언한 의존만 해소" 를
강제하는 취지인데, 그 강제가 **로컬에서만 조용히 뚫린다**. CI 는 평평한 체크아웃이라 없다.

→ **미선언 의존은 로컬 실행으로 검출되지 않는다.** 같은 클래스가 다른 파일에도 있는지는
미확인이다(전수 조사 미수행). `deps-security-checks` 나 lint 단계에서 import-vs-manifest
대조를 두는 것이 근본 처방이다.

**#7 은 별도 트랙이다.** `fast-uri`(GHSA-7p8r-x3mc-p8w7)·`undici` 의 override 하한이 낡아
취약 버전이 다시 해소된다. 값 갱신은 `pnpm-workspace.yaml` + `check-pnpm-security-config.py`
의 **2곳 동시 갱신** 규약이 있어 의존성 거버넌스 턴으로 분리한다.

**부수 관측 — push 가드가 `git stash push` 를 `git push` 로 잡는다.** 이 조사 중 실제로
차단됐다. 가드는 의도적으로 blind 정규식(`A='x git push` 도 매치)이라 이 오탐은 그 설계의
알려진 대가일 수 있으나, `git stash push` 는 흔한 명령이라 등재해 둔다.
