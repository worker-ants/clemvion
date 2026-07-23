---
worktree: harness-guard-followups-f7140c
started: 2026-07-17
owner: developer
---

# 하네스 가드 후속 — #970 리뷰 3라운드가 defer 한 항목들

> 출처: `review/code/2026/07/17/{17_09_10,18_04_20,19_15_56}`. PR #970(세션 앵커 reap)
> 리뷰에서 나왔으나 그 PR 범위 밖으로 defer 된 것들이다. **어느 plan 에도 등록되지 않아
> 리뷰 산출물에만 남아 있었다** — 그대로 두면 증발하므로 여기에 모은다.
>
> 각 항목은 SUMMARY 자신이 "후속"·"급하지 않음"·"범위 밖"·"팀 판단 필요"로 표기한 것이며,
> **차단 사유는 아니다**. 서로 독립이라 개별 PR 로 처리 가능.

## Overview

`.claude/` 하네스 가드 계열의 개선 모음. 최초 등록은 #970 리뷰가 defer 한 5건 + won't-do 1건
(우선순위 **A > B > C > D > E**) 이었고, 이후 각 항목의 리뷰가 같은 계열의 후속을 낳으면서
**F~L 이 추가**됐다. 섹션 목록이 실제 범위이며, 종결 상태는 하단 `## 체크리스트` 가 정본이다.
J·J-후속·L 이 **차단성**(게이트 우회) 계열 — 앞의 둘은 해소, L 은 캐너리로 고정된 선재 갭이다.
나머지는 비차단 개선.

---

## A. bootstrap `npm install` 경쟁 + 부분 설치 영속 — ✅ 완료 (이 워크트리)

> 출처: 18_04_20 WARNING #7 (concurrency)

**결함 2개가 겹쳐 있었다:**

1. **경쟁**: `[ ! -d node_modules ]` check-then-act 에 락이 없어, 병렬 worktree 세션(이 저장소의
   **정석 워크플로**)이 cold checkout 에서 동시에 SessionStart 하면 같은 트리에 동시 `npm install`.
2. **영속**(진짜 비용): 중단된 설치가 남긴 **부분 node_modules 를 디렉토리 존재 체크가 영원히
   "설치됨"으로 오판** → mermaid lint 가 **아무 신호 없이 무력화된 채 남는다**.

**최종 설계 (마커-only, 락 없음)**: 완료 마커 + 실패 throttle + 공유 판정 SoT. **락은 없다.**

- 마커(`node_modules/.bootstrap-install-complete`)는 node_modules **안**에 둔다 — 트리를 지우면
  마커도 함께 죽어 `rm -rf node_modules` 가 곧 복구다. 마커 없는 부분 트리는 다음 세션이 재설치.
  마커는 npm exit 0 뒤에만 쓰인다.
- 실패 throttle: 지속 실패(네트워크 down)면 cooldown 파일 stamp, `MERMAID_INSTALL_RETRY_SEC`(기본
  30분) 내 재시도 skip. reaper `REAP_MIN_INTERVAL` 과 같은 계열.
- 공유 SoT `_lib/mermaid_lint_ready.py`: bootstrap(마커 writer)·`pre-commit`(CLI)·`PostToolUse`(import)
  세 소비처가 같은 판정을 쓰도록 결속(drift 테스트 有). 이게 없으면 두 훅이 bare `[ -d node_modules ]`
  로 부분 트리를 "설치됨"으로 오판한다.

**왜 락을 뺐나 (사용자 결정 2026-07-18)**: 초판은 `mkdir` 락 + owner PID + grace + stale-lock steal
을 손으로 짰다. `/ai-review` 가 그 steal 경로에서 **매 라운드 새로운 동시성 버그**를 실측 재현했다:

| 라운드 | steal 경로의 버그 (전부 실측 재현) |
| --- | --- |
| 20_06_45 W1 | 탈취가 "경과 시간"만 봐서 *살아있는* 느린 설치의 락도 탈취 → 동시 install |
| 00_59_56 W1 | grace 를 `find -mmin` 분 변환하다 60초 미만이 `-mmin -0` 으로 truncate → age 게이트 무력화 |
| 02_06_42 **C1** | `_lock_is_dead && rm -rf; mkdir` 이 **check-then-act TOCTOU** — 두 세션이 같은 죽은 락을 보고 둘 다 rm+mkdir, 진 쪽이 이긴 쪽의 fresh 락을 지워 **둘 다 동시 install**(내가 직접 3-way 재현) |

**근본 원인은 개별 버그가 아니라 설계다** — `mkdir` 로 advisory locking 을 재발명하면 stale-lock
reclaim 이 본질적으로 TOCTOU 다. 올바른 primitive 는 OS advisory lock(`fcntl.flock`, 홀더 사망 시
커널이 자동 해제 → stale 락·steal·PID liveness·grace·TOCTOU 전부 소거)이다. 매번 주석에 "안전하다"고
쓴 논증이 다음 라운드에 반증됐다(#970 push 가드 `_is_segment_boundary` 와 같은 계열).

→ **락을 계속 하드닝하는 대신 아예 뺐다.** 마커가 이미 진짜 목표(부분/실패 설치가 "완료"로
안 세지고 자가 치유)를 달성한다. **수용한 잔여 리스크**: 여러 세션이 *첫* cold 설치를 같은 순간에
치면 동시 `npm install` 이 가능하고(npm 은 단일 디렉토리 동시 설치에 안전하지 않음) 드물게 트리가
오염될 수 있다 — 최악은 corrupt-but-marked 라 `rm -rf node_modules` 수동 복구. dev 툴 린터의 첫
설치에 한한 좁은 창이라, 안전 논증이 계속 틀리는 손수 짠 락보다 낫다고 판단. 진짜 필요해지면
`fcntl.flock` — plan §G.

**테스트**: `test_bootstrap_mermaid_install.py`(마커·부분트리·실패·throttle·동시 수렴) +
`test_mermaid_lint_ready.py`(공유 SoT + 세 소비처 drift + 실행 기반 gate 회귀). 동시 테스트는
exactly-once 가 아니라 **수렴**(마커 존재 + 이후 세션 skip)을 단언한다 — 락을 뺐으니 직렬화는
보장하지 않는다. 마커-미기록 뮤턴트로 비-vacuity 확인.

- [x] 구현 + 테스트 (마커-only 최종)

### A 후속 (이 PR 범위 밖, 별건 — 02_06_42 잔여)

락을 빼며 대부분의 잔여 WARNING(락 correctness 관련)이 moot 됐다. 남은 것:

- [ ] **W1 — "main 체크아웃 루트" 해석이 3곳(bootstrap·pre-commit·PostToolUse) 중복 + bootstrap 실패
      경로 무신호.** 선재(이 PR 이 도입 아님). 공유 스니펫 추출 또는 3구현 pin 테스트 + bootstrap
      실패 경로에 stderr 진단. (I4 계열 — reaper/이 파일에 반복 등장하는 git-common-dir 중복.)
- [x] **W4 — import fail-open(`is_ready is None`) 분기가 실행 기반 테스트 없음.** ✅ 완료 (테스트
      커버리지 PR). `PostToolUseImportFailOpenTest` — 훅을 임시 디렉토리에 복사하고 그 옆
      `_lib/mermaid_lint_ready.py` 가 **import 시 예외**를 던지게 해(훅이 `_lib` 를 자기 위치에서
      해석하므로 복사본이 깨진 것을 집는다) 분기를 실제로 태운다. 단언: exit 0(skip) + stderr 에
      traceback(삼킨 오류가 조용히 죽지 않음) + **node 미호출**. 비-vacuity 는 뮤턴트가 아니라
      **짝 테스트**로 — 같은 fixture 에 정상 헬퍼를 넣으면 린터가 실제로 1회 호출된다(즉 위 skip 이
      깨진 import 때문임이 고정된다).
- [x] **(신규) `.claude/tests/README.md` "What's covered" 카탈로그 drift.** ✅ 완료 (같은 PR).
      D 리뷰 INFO #7·§F 리뷰 W4 가 각각 지적. 실측 27개 중 **9개 미등재**(그 주에 추가된 3개 포함)
      였다 — 무엇을 지키는지 아무도 기록하지 않은 테스트가 조용히 쌓인 것. `test_tests_readme_catalog.py`
      로 **양방향**(미등재 / 존재하지 않는 파일을 가리키는 행) 검사 + 누락 10행 등재. 파서는 텍스트
      주입 가능하게 짜고 sanity 테스트로 "빈 결과 → 항진명제" 차단. 뮤턴트 양방향 포착 확인.
- [ ] **W3 — 테스트 헬퍼 `_node_calls`/`_run` 도입부가 `test_mermaid_lint_ready.py` 내 중복.** 순수
      위생, 동작 무관.
- [ ] **W8 — `harness-checks.yml` 만 node 22 / setup-python 사용(다른 워크플로는 node 24).** 선재 CI
      설정, diff 밖.

**10_55_35 라운드(마커-only 전환 리뷰) 잔여:**

- [x] **W1(10_55_35) — `lint-mermaid.mjs` 를 import 크래시에 fail-OPEN 시켜라.** ✅ 완료 (§A-1 PR).
      `await import("mermaid")`/`("jsdom")` 가 가드 없어(75·93행), corrupt-but-marked 트리에서
      `ERR_MODULE_NOT_FOUND` 로 크래시하면 pre-commit(`exit 1`)·PostToolUse(`exit 2`)가 이를 "진짜
      malformed mermaid" 로 오판해 **매 markdown 커밋을 가짜 메시지로 차단** — 두 파일이 명시한
      fail-open 계약과 정반대(리뷰어 실측 재현). **선재 결함**(어떤 원인의 corrupt node_modules 든
      트리거; 락 제거가 도달성만 넓힘)이고 이 change 밖 파일 3곳(mjs+2 소비처)을 건드려 별건.
      **구현**: 두 dynamic import 를 try/catch 로 감싸 로드 실패를 파싱 에러(exit 1)와 다른
      exit 3(tooling broken)으로 분리, 소비처(pre-commit·PostToolUse)가 그 코드를 fail-open(skip)으로
      처리. 테스트: `test_lint_mermaid_exit_codes.py`(real node, 두 catch 블록 각각 + fast-path/usage
      구분) + `test_mermaid_lint_ready.py` 소비처 exit-3 매핑 + exit-code cross-language pinning.
- [ ] **W3(10_55_35) — bash mtime/cooldown 헬퍼가 `reap-merged-worktrees.sh` 와 중복**(`_file_mtime` vs
      `file_mtime`). python 은 `_lib/mermaid_lint_ready.py` 로 SoT 통합했는데 bash 는 안 됨. `.claude/tools/_lib/*.sh`
      공유 또는 최소 네이밍 통일. 저우선.
- [ ] **I1(10_55_35) — hung `npm install`(타임아웃 없음)의 blast radius 가 락 제거로 세션 1개 → 동시
      콜드스타트 전체로 확대.** 기존 W2(00_59_56) 한계의 도달성 변화. fcntl.flock(§G) 또는 timeout 래핑 시
      함께 해소. track 목적.

---

## B. reaper `gh pr view` 순차 N+1 — SessionStart 블로킹

> 출처: 18_04_20 WARNING #5 (performance)

`gh_state()` 가 후보 worktree/branch 마다 `gh pr view` 를 **순차 호출**한다(배치·병렬 없음).
`REAP_MIN_INTERVAL`(6h) throttle 덕에 매 세션은 아니지만, throttle 만료 세션에 후보가 쌓이면
`bootstrap-session.sh`(SessionStart, **동기**)가 수 초 블로킹될 수 있다.

- [x] `gh pr list --state all --json headRefName,state` 로 배치 조회해 branch→state 맵 선구성,
      또는 후보별 호출을 동시성 상한(`xargs -P4`)으로 병렬화 → **배치 채택** (B PR).
      `--limit`(`REAP_GH_PR_LIMIT`, 기본 200) 밖의 PR 은 **단건 `gh pr view` 로 폴백**해
      "배치가 reaper 의 판정 범위를 조용히 좁히는" 회귀를 막는다. 맵은 bash 3.2 호환을 위해
      연관배열이 아닌 `branch<TAB>state` 개행 문자열.
      **함정(테스트가 실측으로 잡음)**: 호출부가 전부 `state=$(gh_state …)` = **command
      substitution → 서브셸**이라, 지연 로드를 `gh_state` 안에 두면 메모가 서브셸과 함께
      버려져 후보마다 재조회된다(배치 의미 소멸). 그래서 **메인 셸에서 1회 선로드**하고
      서브셸은 상속된 변수를 읽기만 한다. `claude/*` 브랜치가 0개면 로드 자체를 건너뛴다.
- [x] 회귀: 기존 `test_reap_merged_worktrees.py` 의 gh stub 이 배치 형태도 흉내내도록 갱신
      → stub 이 `pr list`(배치)·`pr view`(폴백) 양쪽을 모델링하고 **모든 gh 호출을 로깅**해
      호출 횟수를 단언 가능하게 함. 신규 5건: 후보 3개에 배치 1회·`pr view` 0회 /
      두 pass 가 fetch 1회 공유 / 배치 누락 시 폴백 reap 유지 / 배치 실패 시 폴백 /
      후보 0개면 gh 미호출. 비-vacuity: 배치를 되돌린 뮤턴트에서 두 테스트 모두 실패 확인.

---

## C. `guard_default_branch_bash.py` 가 같은 판정을 독립 재구현

> 출처: 19_15_56 WARNING #3 (architecture)

**"이 Bash 명령이 어떤 git 서브커맨드를 실행하는가"** 라는 동일 질문을 두 훅이 따로 푼다 —
`guard_review_before_push.py` 와 `guard_default_branch_bash.py:60-81`(`_MUTATING`, 셸 인용·간접실행을
전혀 모르는 단순 정규식). 후자는 **soft-fail**(never blocks, 오분류해도 reminder 만)이라 당장 위험은
낮다.

**[[harness-push-guard-subcommand-detection]] 과 묶어서 처리하는 것이 자연스럽다** — 거기서 판정
로직을 재설계하면 `_lib/git_command_detection.py` 로 추출해 양쪽이 공유할 수 있다. 단독 선행은
비권장(재설계 결과에 따라 추출 대상이 바뀐다).

**선행 해소 (2026-07-23, ② PR)**: 재설계가 확정됐다 — blind 1차 정규식 + 열거된 allowlist
(`_redact_inert_text`). 추출 대상이 정해졌으므로 C 는 착수 가능하다. 다만 형태는 애초 구상과
다르다: `guard_default_branch_bash.py` 는 push 가 아니라 *mutating* 서브커맨드를 보므로 **1차
패턴은 각자 두고, 오탐 해제(redaction) 만 공유**하는 것이 맞다 — 커밋 메시지 속 단어가 오분류를
만드는 문제는 두 훅에 공통이기 때문.

### 결론: won't-do (2026-07-23) — 공유 이득이 0 으로 실측됨

바로 위 문단의 마지막 문장("오탐 문제는 두 훅에 공통")은 **내가 ② PR 중 실측 없이 단정한 것이고,
측정해보니 거짓이다.** 그 전제가 C 전체를 지탱하고 있었으므로 항목을 닫는다.

- **실측**: `_MUTATING` 은 `^\s*` 로 **앵커**돼 (세그먼트의) 첫 토큰만 본다. 인용문·grep 패턴·
  커밋 메시지 속 단어는 분류되지 않는다 — 근거 코퍼스는
  `test_guard_default_branch_bash_mutating.py::NoFalsePositiveClassTest` 가 그대로 들고 있다
  (숫자 대신 파일을 가리킨다 — 숫자는 케이스가 늘면 낡는다). push 가드가 `_redact_inert_text` 로
  막아야 했던 **오탐 클래스가 여기엔 없다** — 공유해도 얻는 게 없다.
- 남은 오탐 2종(인용된 구분자·heredoc 본문 줄)은 `AcknowledgedFalsePositiveTest` 가 고정한다.
  둘 다 `_redact_inert_text` 가 다루는 대상이 아니므로(그건 git commit/tag 가 **소유한** 메시지·
  heredoc 만 blank 한다) 공유해도 여전히 해소되지 않는다 — won't-do 결론을 바꾸지 않는다.
- **두 훅은 다른 질문에 답한다**: push 가드는 *차단*하므로 오탐 1건이 작업을 막는다(정밀도 필수).
  이 훅은 훅 자신의 docstring 이 밝히듯 *"intentionally conservative … never blocks"* 이고 목적은
  **"worktree 결정을 이르게 표면화"** 하는 세션당 1회 넛지다. 설계가 다른 게 정상이며, 공유는
  차단용 정밀도 비용을 넛지에 전가한다.
- 이 판정의 근거는 `.claude/tests/test_guard_default_branch_bash_mutating.py`
  `NoFalsePositiveClassTest` 로 **고정**했다. 앵커를 제거한 뮤턴트에서 RED 임을 확인 — 전제가
  깨지면 테스트가 먼저 알려주므로, 그때 C 를 재개하면 된다.

- [x] ~~② 재설계 확정 후 `_lib/` 추출 + 두 훅이 공유~~ → **won't-do** (근거 위)

### 대신 발견한 진짜 결함 (반대 부호: false negative) — 해소

앵커가 **명령 전체의 첫 토큰**만 보던 탓에 `git add -A && git commit -m "x"`,
`cd /tmp && rm -rf build`, `git status; git commit -m "x"`, `GIT_EDITOR=vim git commit -m "x"` 가
전부 무반응이었다. 체인은 흔한 형태라, 훅이 **존재 이유인 그 순간**(이른 넛지)을 놓치고 있었다.

- [x] `&&`/`||`/`;`/`|`/개행으로 세그먼트 분할 후 **각 세그먼트의 첫 토큰**에 기존 앵커 패턴 적용
      + `VAR=value` 접두 허용. 명령 단위 보수성은 그대로 유지한다.
- [x] `VAR=value` 접두 건너뛰기. 리뷰에서 잡힌 잔여 갭 반영: 값이 `\S+` 뿐이면
      `GIT_SSH_COMMAND="ssh -i ~/.key" git commit` 처럼 **따옴표 안에 공백이 있는 흔한 형태**에서
      값이 중간에 끊겨 명령이 `~/.key"` 로 시작하는 것처럼 보이고 넛지가 사라진다 → 따옴표 형태
      허용(첫 글자로 서로소).
- [x] 단일 `&`(백그라운드) 도 구분자에 포함 — `sleep 5 & rm -rf x` 가 같은 이유로 새고 있었다.
- [x] `_is_mutating` 은 그동안 **테스트 0건**이었다 → 신규 `test_guard_default_branch_bash_mutating.py`
      12건으로 현행 동작(FP 클래스 없음·read-only 침묵·간접실행 미분류)과 갭 회귀를 함께 고정.
      비-vacuity: 뮤턴트 7종(분할 원복/split 무력화/env 접두 제거/앵커 제거/env 값 `\S+` 원복/
      `&` 제거/개행 제거) 전부 RED.
- 분할은 인용을 모른다 → 오탐 **2종**(인용된 구분자 `echo "a && rm -rf x"`, heredoc 본문 줄)이
  생긴다. **의도된 수용**이며 `AcknowledgedFalsePositiveTest` 로 고정했다: 인용을 아는 분할은 ②
  가 이미 포기한 "정밀 셸 파서" 경로(무한 표면)이고, 개행은 구분자를 그만둘 수 없다(멀티라인
  체인이 실제 사용 형태). 대가는 *이미 default branch 에 있을 때만 뜨는 세션 1회 소프트 넛지* 뿐.
- ReDoS: 적대적 입력 선형 확인(subprocess+timeout). 다만 **"서로소 alternation 이 ReDoS 를
  막는다" 는 주장은 하지 않는다** — 모호한 형태도 여기선 선형임을 실측했다(반복마다 `^`+`IDENT=`
  가 강제돼 탐색할 분할이 없음). 미측정 단정은 애초에 §C 를 백로그에 올린 그 실수다.

---

## D. push 훅 `main()` 무테스트

> 출처: 19_15_56 WARNING #6 (testing)

`guard_review_before_push.py:main()` — exit code 0/2, REVIEW/PLAN 게이트 순서,
`BYPASS_*` 환경변수 우회, import 실패·호출 예외 시 fail-open, stdin JSON 파싱 실패 — 가
`.claude/tests/` 어디서도 실행되지 않는다. `_is_git_push` 는 두텁게 테스트됐지만 **그 결과를
소비하는 최종 진입점은 무검증**이다.

- [x] `subprocess.run([sys.executable, "guard_review_before_push.py"], input=json.dumps(payload))`
      형태의 e2e, 또는 `evaluate_review`/`evaluate_plan` 을 mock 주입해 exit code·stderr 문구 검증
      → **완료** (D PR). `test_guard_review_before_push_main.py` 20건: 훅을 임시 디렉토리에
      복사하고 그 옆에 env 구동 stub `_lib/{review_guard,plan_guard}.py` 를 주입해 실제
      프로세스로 실행. 커버 — exit 0/2, push 미탐지 통과, `input` 별칭 키, REVIEW→PLAN 순서
      단락(short-circuit), `BYPASS_*` **게이트별** 격리(한쪽 우회가 다른 쪽에 누출 안 됨),
      `evaluate_*()` 예외 fail-open, 게이트 모듈 **import 실패** 시 해당 게이트만 비활성,
      stdin malformed/빈/command 부재. 뮤테이션 검증: 게이트 순서 스왑·bypass 공유·예외
      미포착 3종 모두 테스트 실패로 포착(스크래치 복사본에서 확인).

---

## G. mermaid 설치에 진짜 동시성 보장이 필요해지면 — 별도 스크립트 + `fcntl.flock`

> 출처: 00_59_56 W6 (architecture, 추출) + 02_06_42 C1 (동시성, 락 제거 결정).

A 는 **마커-only(락 없음)** 로 마감했다(§A 참고). 동시 첫-설치 오염이라는 좁은 잔여 리스크가 실제로
문제가 되면(현재는 dev 툴 린터에 과하다고 판단), 이 항목에서 **올바르게** 해결한다:

- bootstrap 책임#2 를 별도 스크립트/헬퍼로 추출(W6 이 지적한 선례 — reap 은 이미 분리됨). 인라인
  ~40줄이 파일의 SRP 를 흐리고, 테스트가 무관한 reap 섹션을 `REAP_MIN_INTERVAL` 로 무력화해야 한다.
- 락이 필요하면 **`mkdir` 로 재발명하지 말고 `fcntl.flock`** 을 쓴다(python 헬퍼). 커널이 홀더
  사망 시 자동 해제 → stale 락·steal·PID liveness·grace·TOCTOU 가 애초에 없다. macOS 에 없는 것은
  `flock(1)` **명령**이지 `flock(2)`/`fcntl` **syscall** 이 아니다(python `fcntl.flock` 가용 확인함).

**왜 지금 안 하나**: 마커-only 로 실질 목표는 달성됐고, 락은 4라운드 연속 손수 짠 버그를 냈다.
진짜 동시성 보장이 필요하다는 근거가 생기기 전엔 과설계다.

- [ ] (필요 시) `ensure-mermaid-lint-deps.py` 추출 + `fcntl.flock` 기반 동시성. 아니면 현행 마커-only 유지.

---

## E. REVIEW/PLAN 게이트 fail-open 정책 — **사용자/팀 판단 필요**

> 출처: 18_04_20 WARNING #4 · 19_15_56 WARNING #2 (security)

모듈이 스스로 *"리뷰 없는 push 를 막는 유일한 hard gate"* 라 서술하면서, 내부적으로 **3중
fail-open** 경로를 갖는다: ① `_lib` import 실패 ② `evaluate_review`/`evaluate_plan` 호출 중 예외
③ `main()` 미처리 예외. 코드 주석상 **의도된 트레이드오프**지만 그 존재 목적과 긴장 관계다.

**이건 코드 결함이 아니라 정책 선택이다** — 착수 전 사용자 결정 필요:

- 그대로 둔다(가드 오류가 작업을 막는 것보다 낫다) — 현행
- fail-closed 로 뒤집는다
- fail-open 은 유지하되 **관측 가능하게** 한다(발동 시 로그/알림, "연속 N회 fail-open 시 경고")

**사용자 결정 (2026-07-23): 3안 — fail-open 유지 + 관측 가능하게.** 판단 근거로 ② 작업이
제공한 실측이 있었다: 그 훅이 **조용히 무력화될 수 있는 경로**(홑따옴표 우회로 실행되는
push 를 놓침 / ReDoS hang → 하네스 타임아웃 → fail-open)를 세 라운드에 걸쳐 실제로 찾았다.
즉 "게이트가 꺼져 있는데 아무도 모른다" 는 가설이 아니라 관측된 형태였다. fail-closed 는
훅 버그·환경 문제로 작업이 멈추고 BYPASS 학습을 유도하므로 기각.

- [x] 사용자 결정 → 구현 (E PR)
  - `_run_gates()` 분리 — 게이트가 **답하지 못한** 경우(모듈 import 실패 / `evaluate_*()` 예외)를
    `degraded` 로 수집. **BYPASS_\* 는 degraded 아님** — 의식적 우회이지 조용한 실패가 아니다
    (섞으면 이 신호가 묻힌다).
  - `main()` 이 `finally` 로 `_report_fail_open()` 호출 — **차단 경로에서도** 보고된다(한 게이트가
    막는 동안 다른 게이트가 fail-open 일 수 있고, 그때가 가장 조용해지면 안 된다).
  - 발동 시 stderr 에 명시 경고("이 push 는 검사를 받지 않았습니다") + **연속** 횟수를
    `.claude/state/push_guard_failopen.json` 에 기록, 정상 판정 1회면 리셋. 3회 연속이면
    "사실상 꺼져 있다" 로 에스컬레이션.
  - 보고 전체가 try/except — **관측이 관측 대상을 깨뜨리면 안 된다**(state 디렉토리 자리에
    파일이 있어 쓰기가 실패해도 판정은 불변임을 테스트로 고정).
  - **리셋 술어를 세 번 틀렸고 매번 리뷰/테스트가 잡았다** — 전부 "모든 게이트가 답했다"보다
    약한 증거를 받아준 것이다: v1 = `degraded` 만 비면 리셋(BYPASS 가 지움) → v2 = *아무*
    게이트나 답하면 리셋(bypass 된 REVIEW + clean PLAN 이 지움) → v3(**CRITICAL**) = REVIEW
    차단이 PLAN 실행 전에 `return 2` 하므로 평범한 차단 push 가 PLAN streak 를 경고 없이 지움.
    REVIEW 차단은 이 훅의 **가장 흔한 이벤트**라 에스컬레이션이 사실상 영영 안 뜬다.
    → `set(answered) != _ALL_GATES` 로 **명시적 집합 비교**. truthiness 검사 금지.
  - **배너 채널은 exit code 를 따른다** — exit 0 은 stdout(하네스가 모델 컨텍스트에 주입하는
    채널, `guard_default_branch_bash.py` 가 같은 근거를 문서화), exit 2 는 stderr. 초판은 항상
    stderr 라 가장 흔한 경로에서 신호가 모델에 안 닿을 수 있었다.
  - **배너를 state 쓰기보다 먼저** 출력한다. 초판은 쓰기가 먼저라, state 디렉토리가 쓰기 불가면
    예외가 print 도달을 막아 **완전 침묵**했다 — 이 장치가 막으려던 실패가 장치 안에서 재현.
  - 테스트 35건(`test_guard_review_before_push_main.py`, 그중 관측성 15건): import 실패·evaluate
    예외 각각 계수 / 연속 누적·에스컬레이션(1·2회 미발동 포함) / 전 게이트 응답 시에만 리셋 /
    BYPASS 미계수·미리셋(실제 고장 게이트 bypass 정밀 경계 포함) / 비-push 미리셋 / 차단 push 가
    타 게이트 streak 를 안 지움 / 양 게이트 동시 degraded 는 1회만 계수 / DETECTION 예외 관측 /
    채널 계약 / 쓰기 실패해도 배너·판정 불변.
    비-vacuity: 보고 호출 제거·DETECTION catch 제거·리셋 술어 되돌림·배너/쓰기 순서 되돌림 뮤턴트 포착.
  - 부수: 기존 `_run` 헬퍼에 `CLAUDE_PROJECT_DIR` 격리 추가 — 없으면 fail-open 테스트들이
    **실제 저장소** `.claude/state/` 에 쓰고 서로 간섭한다.

**후속 완료 (#1000, 다른 세션)**: Stop 게이트에도 같은 fail-open 3경로가 있었는데 여전히 침묵이라
"세션이 리뷰 넛지가 꺼진 채로 끝날 수 있는" 갭이 남아 있었다. 보고 로직을 `_lib/failopen_state.py`
로 추출해 push/stop 이 공유하고, Stop 쪽은 **stdout 이 `{"decision": …}` 프로토콜**이라 배너를 항상
stderr 로 보낸다는 차이를 테스트로 고정했다(`test_stop_guard_failopen.py`).
그 PR 은 plan 을 갱신하지 않았으므로 §E 소유자인 이 문서에 여기서 기록해 둔다 — 이 절만 읽고
"§E 는 push 게이트에서 끝났다" 고 오해하는 걸 막기 위함이다.

---

## F. mermaid-lint npm 트리 취약점 + 보안 스캔 갭 — 별건 (A 리뷰 20_06_45→00_59_56 발견)

> 출처: 00_59_56 W4·W5 (dependency·security). **A 의 diff 밖**이라 별 항목으로 분리.

`npm audit` 실측: `.claude/tools/mermaid-lint` 트리에 실제 취약점 2건 —
`undici@7.27.0` **HIGH**(TLS 인증서 검증 우회 등), `dompurify@3.4.7` moderate. 둘 다
`fixAvailable`(breaking 없이 lockfile 갱신만). 실사용(parse-only, jsdom 정적)상 직접 트리거
가능성은 낮다.

더 근본은 **이 npm 트리가 저장소 보안 스캔에서 통째로 빠져 있다** — `deps-security-checks.yml`
은 pnpm 워크스페이스만, Dependabot 은 `github-actions` ecosystem 만. 즉 W4 두 CVE 뿐 아니라
향후 신규 CVE 도 영구 무신호다. `bootstrap-session.sh` 의 `npm install --no-audit`(이 PR 이전부터
있던 플래그)가 설치 시점 신호도 은폐한다.

**왜 A 에서 안 고쳤나**: `--no-audit` 는 A 가 만든 게 아니고, 취약점 해소는 lockfile 갱신이라
A 의 주제(설치 경쟁·부분설치·판정 SoT)와 무관하다. 같이 넣으면 scope 오염이고 scope-reviewer
가 정당하게 지적한다.

- [x] `cd .claude/tools/mermaid-lint && npm audit fix` — undici 7.27.0→7.28.0(HIGH 7건),
      dompurify 3.4.7→3.4.12(moderate 3건) → **0 vulnerabilities**. lockfile 만 변경(package.json
      range 불변), lint 도구 실동작 확인(good→exit 0, malformed→exit 1). (별건 PR)
- [x] **Dependabot npm ecosystem 등록** (`/.claude/tools/mermaid-lint`) — pnpm 워크스페이스 밖
      독립 트리를 security update 자동 PR 대상으로. deps-security-checks.yml(pnpm audit) 확장 대신
      Dependabot 을 택한 이유: 기존 github-actions 엔트리와 같은 패턴, security update 가 신규 CVE 를
      자동 PR 화(= "silent forever" 근본 해소), CI job 복잡도 없음.
- [x] **마커를 lockfile 해시에 결속** (F 리뷰 12_06_58 W1) — bootstrap 마커가 존재 여부만 봐서,
      이미 bootstrap 된 checkout 은 이 보안 픽스(및 **모든 미래 Dependabot 보안 PR** = lockfile-only)가
      머지돼도 재설치 안 돼 취약 버전 잔존하던 구조적 갭. 마커 **content = package-lock.json 해시**,
      불일치 시 재설치. 해시 도구 부재 시 presence-only 폴백(구 동작 보존). 테스트 2건(변경→재설치,
      불변→skip) + presence-only 뮤턴트로 비-vacuity. PROJECT.md 거버넌스 절에 Dependabot npm 경로
      명시(W2), dependabot 주석 정밀화(I2).

**§F 잔여 defer (12_06_58 · 12_31_29 리뷰):**

- [x] **I3 — `.github/workflows/e2e.yml` 의 `paths-ignore` 에 `.github/**` 누락.** ✅ 완료 (§F 잔여 PR).
      PROJECT.md e2e 면제 화이트리스트(`.github/**`)와 실제 CI 트리거가 drift 였다. **부수 결정**: 이걸
      더하면 e2e.yml 자신을 고친 PR 이 e2e 를 못 돌리는데 이 워크플로엔 수동 트리거가 없었다 →
      `workflow_dispatch` 를 함께 추가해 CI 정의 변경 시 Actions 탭에서 수동 실행 가능하게 했다
      (GitHub 은 paths-ignore 에서 특정 경로만 예외 처리하는 문법을 제공하지 않는다).
- [x] **W5(12_31_29) — 커버리지 매트릭스 무결성 가드 부재.** ✅ 완료 (§F 잔여 PR).
      `test_dependabot_npm_coverage.py` — `git ls-files` 의 package.json 을 pnpm-workspace `packages:`
      글롭과 대조해 **워크스페이스 밖 트리**를 뽑고, 각각이 dependabot.yml 의 npm `directory:` 에
      등재됐는지 단언. 역방향(stale 등록 = 존재하지 않는 경로) 도 검사. 손수 짠 YAML 파서라
      **파서 sanity 테스트 3건**(globs 파싱·npm dirs 파싱·알려진 독립 트리 탐지)으로 "빈 결과 →
      항진명제" 를 차단. 비-vacuity: 미등록 트리 추가·등록 삭제·stale 경로 3종 뮤턴트 전부 포착.
      **harness-checks.yml paths 에 `dependabot.yml`·`pnpm-workspace.yaml` 동반 등재** — 없으면
      그 파일만 고친 PR 에서 가드가 안 돈다(저장소가 반복해서 겪은 실패 클래스).
- [x] **W3(16_02_39, 신규) — I3 에 상응하는 회귀 가드 부재.** ✅ 완료 — `test_e2e_exemption_paths_sync.py`.
      화이트리스트 밖 `paths-ignore` 는 hard fail(CI 가 미검증 코드를 통과시키는 방향), 화이트리스트에만
      있는 항목은 `UNMIRRORED_WHITELIST_ENTRIES` 에 사유 기재 강제(낭비 방향은 허용하되 침묵 금지).
      push/pull_request 블록 동일성도 고정. 파서는 텍스트 주입식 + fixture 로 경계 선고정(계획대로).
      **실측**: mutation 8/8 killed — M1 이 원 결함(I3, `.github/**` 제거)을 그대로 재현. 그 외
      화이트리스트 밖 패턴 추가·화이트리스트에서만 삭제·트리거 간 drift·예외목록 stale·사유 공란·
      파서 빈 결과·escape 침묵 절단.
      **부수(리뷰 CRITICAL)**: `harness-checks.yml` `paths:` 에 `.github/workflows/e2e.yml` 이
      없어, **paths-ignore 를 넓히는 PR**(가드가 막으려는 바로 그 방향)이 e2e.yml 만 건드리면
      가드가 안 돌았다. 등재 완료. 이 파일이 이미 4번(.githooks·_shared·workflows·dependabot)
      주석으로 남긴 실패 클래스의 5번째 재발 — **아래 I 항목으로 체계적 가드 신설 검토**.
      원 지적: W5 는 전용 가드를 만들었는데 I3
      (e2e.yml `paths-ignore`)는 값만 고쳤다. PROJECT.md §e2e 면제 화이트리스트 ↔ 실제 워크플로
      `paths-ignore` 의 drift 가 재발해도 잡을 자동 테스트가 없다(저장소가 반복해서 겪은
      "SoT 문서 ↔ 설정 파일 수동 동기화" 클래스). **같은 PR 에 넣지 않은 이유**: 그 PR 이 이미
      손수 짠 YAML 파서 2개로 지적(fnmatch 의미론·인라인 주석)을 받은 상태라, 세 번째 파서
      (PROJECT.md 목록 파싱)를 같은 diff 에 얹는 건 같은 실패 클래스를 늘리는 선택이다.
      별건으로 분리해 `test_dependabot_npm_coverage.py` 처럼 **파서를 텍스트 주입 가능하게 짜고
      fixture 로 경계를 먼저 고정**한 뒤 붙인다.
- [ ] **W6(12_31_29) — `mermaid-lint/package.json` 의 `jsdom`·`mermaid` `"*"` range.** Dependabot 활성화로
      major bump 도 lockfile-only diff 로 와서 리뷰어가 patch/major 구분 신호 상실. PROJECT.md "기본 caret"
      정책과도 어긋남. resolved major 에 맞춰 `^` 로 좁히기. 선재 `"*"`(PR #410~), diff 밖.

---

## H. consistency-checker 번들러가 target spec 을 대용량 카탈로그 덤프로 100% 치환

> 출처: `interaction-type-guard-comment-false-negative` 후속 ④ — impl-prep `review/consistency/2026/07/18/12_04_53`,
> impl-done `review/consistency/2026/07/18/12_34_30`, ai-review `review/code/2026/07/18/12_31_58` 이 공통 재현.

`consistency_orchestrator.py` 가 `spec/conventions/` 를 alphabetical 순회하며 target 문서를 번들링하다가
`cafe24-api-catalog/**`(222개 field-level 파일) 대용량 덤프에 컨텍스트 예산이 소진되어, **실제 target
spec 본문을 프롬프트에서 완전히 밀어낸다**. 여러 세션에서 "일부 누락"으로 관측되다가 2026-07-18 에는
**100% 치환**(target 0건)까지 심화 재현됐다. checker 들이 워크트리 파일 직접 조사(`git diff`/`git merge-base`/
`Read`)로 매번 우회하므로 BLOCK 판정 자체는 유효하나, 번들러는 미수정이라 재발한다.

- [ ] `consistency_orchestrator.py` 의 target 파일 선택/컨텍스트 예산 로직에 `cafe24-api-catalog/**`
      서브트리 파일수·depth 상한(cap) 도입 — target 본문이 항상 예산 우선순위를 갖도록
      (`CONSISTENCY_MAX_CONTEXT_SIZE` 배분 재설계).
- [ ] (부수) `origin/main` 이 fork-point 보다 앞설 때 `git diff origin/main` 의 reverse-diff 오염 —
      기본 diff-base 를 `git merge-base HEAD origin/main` 로 고정하는 옵션. 이미 checker 들이 수동
      재계산으로 우회 중이나 기본값 개선 여지.

---

## I. "가드 대상 파일이 harness-checks paths 에 미등재" — 5회 재발한 클래스

> 출처: 17_26_20 CRITICAL (documentation·requirement 독립 지적)

`harness-checks.yml` 의 `paths:` 는 "이 테스트가 지키는 파일" 을 손으로 등재한다. 누락되면 그
파일만 고친 PR 에서 **정작 그것을 지키는 테스트가 안 돈다**. 지금까지 `.githooks/**` ·
`.claude/_shared/**` · `.claude/workflows/**` · `.github/dependabot.yml` · `.github/workflows/e2e.yml`
— **5번** 같은 방식으로 새고 그때마다 주석으로 사후 기록했다.

체계적 가드가 가능한가? `.claude/tests/*.py` 의 **모듈 레벨** `REPO_ROOT / ...` 상수를 뽑아
harness-checks `paths:` 커버 여부를 대조하는 형태가 유력하다. 다만 일부 테스트는 의도적으로
`codebase/**` · `spec/**` 를 참조하고(doc-sync-matrix 등) 그것들은 등재 대상이 아니므로,
**대상/비대상 경계를 먼저 정의**해야 한다 — 그 경계 없이 만들면 오탐으로 무력화된다.

- [ ] 등재 대상 경계 정의 → 모듈 레벨 상수 추출 가드 신설

---

## J. push 가드 detection 이 따옴표 env 접두에서 뚫린다 — **차단성, 최우선**

> 출처: C(넛지 FN) PR 리뷰 20_02_29 WARNING #1 을 추적하다 실측 발견. 원 리뷰는 넛지 훅의
> 동일 패턴만 지적했고, 같은 결함이 **차단형** 가드에도 살아있다는 건 여기서 확인했다.

`guard_review_before_push.py` 의 `_GIT_PUSH` 는 env 접두를 `(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*`
로 건너뛴다. `\S+` 는 공백에서 끊기므로 **따옴표 안에 공백이 든 값**이면 그룹이 성립하지 않고,
`git\b` 앵커도 맞지 않아 **push 자체가 탐지되지 않는다**. 탐지가 안 되면 훅은 그대로 통과시킨다
— 즉 리뷰-before-push 게이트 **전체가 조용히 우회**된다. 실측(`_is_git_push`):

| 명령 | 결과 |
| --- | --- |
| `GIT_SSH_COMMAND="ssh -i ~/.key" git push origin main` | **MISSED** |
| `GIT_SSH_COMMAND='ssh -i ~/.key' git push origin main` | **MISSED** |
| `GIT_AUTHOR_NAME="John Doe" git push --force origin main` | **MISSED** |
| `GIT_SSH_COMMAND=ssh git push origin main` | detected |
| `git push origin main` | detected |

첫 두 줄은 지어낸 형태가 아니라 SSH 키를 지정해 push 하는 **일상적인 명령**이다.

- 이 결함은 blind 1차 정규식 **자체**에 있다(allowlist 해제 이전 단계) — ② 의 "차단은 무지하게,
  해제만 정밀하게" 설계는 멀쩡하고, 무지해야 할 쪽이 **덜 무지해서** 생긴 문제다.
- `_SEGMENT_IS_GIT`(release 경로)에도 같은 `\S+` 가 있으나 그쪽은 미매치 = **해제 안 함** =
  안전 방향이라 별개다.
- [x] ✅ `_GIT_PUSH` env 값에 따옴표 형태 허용 (+ **이스케이프된 `\"` 까지** — 첫 수정의
      `"[^"]*"` 는 이스케이프 앞에서 끊겨 우회가 그대로 남았다. 같은 파일 `_MESSAGE_ARG`
      가 이미 쓰던 escape-aware 바디를 재사용) — 넛지 훅과 **byte-identical** 한 3-대안
      (`'[^']*'|"[^"]*"|[^\s'"]\S*`). 핀 구조도 분리: `_LEGACY_PATTERN`(불변 FN 바닥)
      과 `_BLIND_PATTERN`(현행 blind 핀)이 서로 다른 질문에 답하는데 한 상수가 겸하고
      있어서 "패턴을 바꾸지 말라" 는 테스트와 "패턴이 결함" 이라는 사실이 충돌했다.
      `test_no_new_blocks` 의 "오직 빼기만" 기준도 legacy → 현행 blind 로 교정.
- [x] ✅ 전수 grep 결과 남은 것은 `_SEGMENT_IS_GIT` 하나뿐. **해제(release) 경로**라
      미매치 = 해제 안 함 = 차단 유지로 안전 방향임을 실측 확인했고,
      `ReleasePathNarrownessTest` 로 그 측정을 고정했다(주장 대신 검증). 해제 경로를
      넓히는 건 진짜 push 를 통과시키는 방향이라 별도 정당화가 필요 — 이 PR 범위 밖.

---

## J-후속. §J 수정이 되레 FN 을 들여왔다 — 후행 `\S+` 폴백 누락 (해소)

> 출처: 병렬 세션이 §J 를 독립 작업하며 조합 전수 비교로 발견. #1002 머지 후 실측.

#1002 은 env 값을 `(?:'[^']*'|"(?:\\.|[^"\\])*"|[^\s'"]\S*)` 로 고쳤는데, 세 대안 모두
**따옴표로 시작해 닫히지 않는 값**을 못 맞춘다(`A='x git push`). 그러면 접두 그룹이 0회로
떨어지고 `git\b` 앵커도 안 맞아 **push 가 통째로 미탐지**된다. 생성 입력 168건 실측:

| 패턴 | pre-§J 대비 잃음 | 얻음 |
| --- | --- | --- |
| #1002 현행 | **28건** | 12건 |
| 후행 `\S+` 폴백 추가 | **0건** | 12건 |

즉 §J 를 고치면서 §J 와 같은 클래스를 다시 들여왔다. `\S+` 를 **마지막 대안**으로 두면 잘
형성된 값은 앞선 따옴표 분기가 먼저 소비하고 `\S+` 는 그것들이 못 잡는 것만 받으므로, 신규
패턴이 pre-§J 의 **엄밀한 상위집합**이 된다. #1002 이 잡던 것도 하나도 안 잃는다(0건).

**왜 #1002 의 방어가 이걸 못 잡았나** — floor 는 옳았다. `_LEGACY_PATTERN`(불변 FN 바닥)도
`test_no_new_false_negatives` 도 정확히 이 질문을 한다. 문제는 그 비교가 **손으로 고른
`CORPUS` 만 순회**한다는 것이다. 회귀한 형태가 아무의 머릿속에도 없었으니 코퍼스에 없었고,
바닥은 판정할 기회를 얻지 못했다. **큐레이션은 기억한 것을 증명하고, 생성은 불변식을 증명한다.**

- [x] 총 3곳(훅 2 + 테스트 미러 1)의 env 값에 후행 `\S+` 폴백 추가(이스케이프 인식 바디는 #1002 것 유지).
- [x] `GeneratedFloorTest`(push 가드)·`OldEnvPrefixSupersetTest`(넛지 훅) — 값 형태 × 할당 개수
      두 축으로 **생성**한 입력을 바닥에 통과시킨다. 두 회귀 모두 이 두 축의 상호작용이었다.
- [x] 넛지 훅도 같은 회귀를 갖고 있었다(#1001 도입, #1002 가 이월). 게다가 #1001 의 테스트가
      그 손실을 **"의도된 수용 가능한 갭"으로 고정**하고 있었다 — 새 패턴을 옛 패턴이 무엇을
      분류했는지와 비교하지 않고 판단한 결과다. 테스트를 교체했다.

---

## L. env 값의 닫는 따옴표에 다른 문자가 붙으면 여전히 미탐지

> 출처: §J PR 리뷰 00_46_34 WARNING #2. **선재 갭** — pre-§J 패턴도 못 잡는다.

`A="a b"c git push` 는 정상 셸 할당(값 = `a bc`)인데 어떤 대안도 못 맞춘다: 따옴표 분기는 닫는
따옴표에서 멈춘 뒤 공백을 요구하고, `\S+` 는 따옴표 **안** 공백을 못 넘는다. 접두 그룹이 무너져
**push 가 미탐지**된다 — §J 와 같은 조용한 게이트 우회가 한 걸음 더 간 형태.

- [ ] 값을 "따옴표/비따옴표 조각의 **연속**" 으로 확장.
      **선행 조건**: 자연스러운 형태 `(?:'[^']*'|"[^"]*"|[^\s'"])+` 는 대안이 각각 1글자를
      맞출 수 있는 **반복 그룹**이라 `BacktrackingTest` 가 잡으려는 파국적 형태 그 자체다
      (실측: 유사 형태가 14회에서 5.2초, 18회에서 >8초). 넣기 전에 반드시 측정할 것.
- [x] 캐너리 `KnownFalseNegativeTest` 로 현재 버그 동작 고정(§J 에서 이 장치가 실제로
      작동했으므로 재사용) + `GeneratedFloorTest._VALUES` 에 해당 형태 추가 — 오늘은 커버리지를
      늘리지 않지만 §L 수정이 같은 축에서 측정되게 한다.
- 넛지 훅 `_MUTATING` 도 같은 갭을 공유한다(넛지라 영향은 작음).

---

## K. 게이트 실행 제어 흐름이 훅 2개 × 게이트 2개 = 4중 복제

> 출처: 17_57_42 WARNING #5. 한 번 §J 로 등재됐다가 브랜치 리셋(#1000 재구성) 때 유실됐고,
> 그 뒤 §J 번호가 다른 항목(push detection 우회)에 재사용돼 되돌릴 자리가 없어졌다 — §K 로 재등재.

`if bypass / elif <gate> is None / try-except-else` 약 10~12줄이 `guard_review_before_push.py`
(REVIEW·PLAN)와 `guard_review_before_stop.py`(REVIEW·PLAN nudge)에 네 번 반복된다.
보고 로직은 `_lib/failopen_state.py` 로 이미 공유했지만 **제어 흐름은 그대로**다.
`_run_gate(name, evaluate_fn, import_failed, import_error, import_tb, bypass_env)` 로 추출 가능.

**미뤄둔 이유**: push 훅은 리뷰 없는 push 를 막는 hard gate 이고, §E 라운드에 그 배선이 실제로
두 번 결함을 냈다(`is None` 오독 → 스위트가 실제 상태 오염 / telemetry 예외가 exit 0→1 전파).
행동 고정 테스트를 먼저 깐 뒤 추출한다.

- [ ] 4개 블록의 현재 동작을 실행 기반으로 고정 → `_run_gate()` 추출

---

## won't-do — 다른 세션의 앵커는 보호 못 한다

> 출처: #970 ① 의 알려진 한계 (`worktree-policy.md §7` 에 명시됨)

reaper 는 **자기 세션의 앵커만** 안다(`bootstrap` 이 `BASH_SOURCE` 로 넘긴다). 동시에 열린 다른
세션이 앵커로 쓰는 워크트리의 PR 이 머지되면 **그 세션은 여전히 죽는다**.

**won't-do 사유**: 근본 해결엔 "살아있는 세션의 앵커 레지스트리"가 필요하고(세션 생명주기 추적 +
crash 시 stale 엔트리 회수), 하네스가 워크트리를 recycle 해 복구시켜 주는 것이 관측됐다. 비용 대비
과하다. 재발 시 복구 절차는 `worktree-policy.md §7` + 메모리에 있다.

---

## 체크리스트

- [x] A — bootstrap mermaid 설치 가드: **마커-only + throttle + 공유 SoT** (락은 4라운드 회귀 후 제거) (이 PR)
- [x] B — reaper gh N+1 배치화 (별건 PR)
- [x] C — ~~`_lib/git_command_detection.py` 추출~~ **won't-do** (앵커 덕에 오탐 클래스가 없어
      공유 이득 0 으로 실측). 대신 반대 부호로 드러난 **세그먼트 미검사 FN** 을 좁게 해소
- [x] D — push 훅 `main()` 테스트 (별건 PR)
- [x] E — fail-open 정책 사용자 결정 → **3안(유지 + 관측가능화) 구현 완료** (별건 PR)
- [x] F — mermaid-lint npm 취약점 fix(undici HIGH·dompurify moderate → 0) + Dependabot npm 등록 (별건 PR)
- [x] **J — push 가드 `_GIT_PUSH` 따옴표 env 접두 우회 ✅ 해소
      (차단성 — 최우선, 별건 PR)**
- [x] **J-후속 — §J 수정이 후행 `\S+` 폴백을 빼며 FN 28건을 재도입** → 해소. 바닥은 옳았는데
      큐레이션 코퍼스만 순회해 판정 기회를 못 얻었다 → **생성 입력** 차등으로 교체
- [ ] **L — env 값의 닫는 따옴표에 문자가 붙으면 여전히 미탐지**(`A="a b"c git push`). 선재 갭,
      캐너리로 고정. 자연스러운 수정형이 파국적 정규식이라 **측정 선행 필수**
- [ ] K — 게이트 제어 흐름 4중 복제 → `_run_gate()` 추출 (행동 고정 선행, §J 리셋 때 유실 후 재등재)
- [ ] G — (필요 시) mermaid 설치 추출 + `fcntl.flock` 동시성 (별건)
- [ ] I — harness-checks `paths:` 미등재 클래스 체계 가드 (5회 재발, 경계 정의 선행)
- [ ] H — consistency-checker 번들러 target 치환 (cafe24 카탈로그 예산 소진) + reverse-diff diff-base (별건)

## Rationale

**왜 모아서 등록하나**: 5건 전부 #970 리뷰가 찾았지만 **plan 이 없어 `review/` 산출물에만
남아 있었다**. 리뷰 산출물은 시점 기록이라 아무도 다시 읽지 않는다 — 실제로 확인해보니 기존
`harness-*` plan(`report-contract-followups`·`workflow-contract-fix`) 도, 다른 어떤 plan 도 이
항목들을 커버하지 않았다(`gh pr view`·`git_command_detection`·`N+1` 언급 0건).

**왜 A 만 지금 하나**: A 는 유일하게 **실질 위험**이다(병렬 세션이 정석 워크플로인데 lint 가
조용히 죽는다). 작고 독립적이며 #970 에서 이미 만진 파일이다. B·D 는 독립이라 언제든,
C 는 ② 재설계 후행, E 는 사용자 결정 선행.

**왜 C 를 단독 선행하지 않나**: 추출 대상(판정 로직)이 [[harness-push-guard-subcommand-detection]]
의 설계 반전 결과에 따라 달라진다. 지금 추출하면 곧 다시 뜯는다.
