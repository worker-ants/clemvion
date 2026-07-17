STATUS=success requirement review complete — 0 Critical, 1 Warning, 3 Info
===REPORT_MARKDOWN_BELOW===
# Requirement Review — 하네스 가드 2건 (세션 앵커 reap + push 가드 오탐)

검토 범위: `git diff origin/main...HEAD` (merge-base `14bc86a53`), 7개 리뷰 대상 파일
전부. `python3 -m unittest discover -s .claude/tests` 270건 전수 통과, 대상 두 스위트
(`test_push_detection.py` 12건, `test_reap_merged_worktrees.py` 18건) 개별 확인, frontend
`plan-frontmatter.test.ts` 93건 통과(plan frontmatter 유효성)까지 직접 실행해 확인했다.
추가로 두 항목의 "회귀 테스트가 fix 이전 코드에서 실제로 실패하는지"(비-vacuity)를
독립적으로 재현했다(아래 참고) — plan 문서의 자기-신고 수치와 정확히 일치.

## 발견사항

- **[WARNING]** `_GIT_OPTS_WITH_VALUE` 화이트리스트 중 `--exec-path`·`--super-prefix` 두
  항목이 "분리 토큰 값을 가지므로 서브커맨드가 될 수 없다"는 주석의 확언과 실제 git
  동작이 다르다(9개 중 7개는 실측 확인, 2개는 반증됨) — 이번 세션 마지막 커밋
  (`f4489d314`)이 고친 `_is_segment_boundary` 의 "인용이 보호한다" 반증 사례와 **정확히
  같은 계열**의 결함(주석의 메커니즘 서술이 실측 없이 확신에 차 있음).
  - 위치: `.claude/hooks/guard_review_before_push.py:68-70`(`_GIT_OPTS_WITH_VALUE` 정의),
    `:175-176`(스킵 로직), 근거 주석은 `_git_subcommand` 독스트링 전체("The token after
    each is that value, so it can never be the subcommand"). 테스트는
    `.claude/tests/test_push_detection.py:148-161`(`test_all_value_taking_global_options_skip_their_value`).
  - 상세: 실제 `git 2.50.1 (Apple Git-155)` 로 직접 재현.
    1) `git --exec-path /any/path status` → **status 는 실행되지 않고** 현재 exec-path 를
       출력하고 즉시 종료(exit 0). `man git`: "If no path is given, git will print the
       current setting and then exit." — `--exec-path` 는 `=` 형태(`--exec-path=<path>`)
       로만 값을 받고, 공백 분리 형태는 애초에 "값이 주어지지 않은" 조회-후-종료 플래그다.
       분리 토큰을 소비한다는 전제 자체가 틀렸다.
    2) `git --super-prefix foo status`, `git --super-prefix=foo/ status` 모두
       `unknown option: --super-prefix`(exit 129)로 즉시 거부됨 — `man git` OPTIONS 절
       전체를 훑어도 `--super-prefix` 자체가 없다. 이 git 빌드에서는 전역 옵션으로
       존재하지 않는다.
    나머지 7개(`-C`, `-c`, `--git-dir`, `--work-tree`, `--namespace`, `--config-env`,
    `--attr-source`)는 모두 공백-분리 값 형태가 실제로 다음 토큰을 소비함을 개별
    서브프로세스로 확인했다(`--config-env foo=bar status` 는 `foo=bar` 를 자기 값으로
    파싱하다 env 변수 부재로 fatal — status 로 진행 못한 것도 "토큰을 소비했다"는 증거).
    해당 unit 테스트(`test_all_value_taking_global_options_skip_their_value`)는 코드
    자신의 스킵 로직만 되짚는 self-referential 테스트라(실제 git 서브프로세스 호출 없음)
    이 오류를 원리적으로 잡을 수 없다 — 직전 리뷰 라운드(`review/code/2026/07/17/17_09_10`)
    의 security reviewer 도 `--attr-source` 하나만 "git 2.50.1 실측 확인"했고 나머지
    8개는 실측하지 않은 채 구조만 파라미터화했다.
  - **실제 위험은 없음**: 두 경우 모두 실제 git 이 서브커맨드에 도달하기 전에
    스스로 종료/에러하므로(조회-후-종료, 또는 unknown-option 거부), 어떤 뒤따르는
    토큰이 오든 진짜 `push` 는 결코 실행되지 않는다. 훅이 이 두 옵션을 "값 소비"로
    오판해도 결과는 과차단(over-block, 안전 방향) 아니면 우연히 정확한 무차단 — 어느
    쪽도 "미검토 push 가 게이트를 통과"하는 위험 방향은 아니다(Critical #4 가 이미
    이 화이트리스트를 fail-closed 구조로 감싸놓아, 여기 개별 오류가 안전망을 뚫지
    못한다). CRITICAL 이 아니라 WARNING 인 이유.
  - 제안: (a) 독스트링의 "each is that value, so it can never be the subcommand"라는
    전항목 대상 확언을 완화하고 `--exec-path`(공백형은 값 미소비, print-and-exit)·
    `--super-prefix`(이 git 빌드에서 미인식)에 각주를 단다. (b) 선택: 이번 리뷰가 한
    것처럼 실제 git 서브프로세스로 9개 전항목의 "분리 토큰 소비" 가정을 pin 하는
    테스트를 추가하면, 향후 git 버전이 옵션 의미를 바꿔도(또는 애초 잘못된 항목이
    섞여도) 감지된다 — 코드 변경은 불필요(안전 방향이라 기능 수정 자체는 급하지 않음).

- **[INFO]** git alias 를 경유한 push 호출(`git config alias.p push` 후 `git p` 실행)이
  여전히 미탐지 — `_git_subcommand` 는 리터럴 서브커맨드 토큰만 보고 `.git/config`/
  `~/.gitconfig` 의 alias 해석을 하지 않는다(`guard._is_git_push("git p")` → `False`,
  직접 재현). 이는 직전 리뷰 라운드의 INFO #1(`eval "git push"`/`bash -c "git push"`
  등 "인터프리터로 감싸 실행" 계열 전체 미탐지, "정적 토큰 기반 가드의 구조적 한계"로
  조치 없음 처리)과 **같은 계열의 새 사례**다. 이번 diff 의 회귀가 아니다 — 구 정규식도
  alias 이름 자체에 "push" 문자열이 없으면 못 잡았다(예: `git p`). 급한 조치는 불필요.
  - 위치: `.claude/hooks/guard_review_before_push.py:213`(`_git_subcommand` 의
    `return token` — 별도 alias 해석 없음).
  - 제안: plan 문서(`plan/in-progress/harness-session-anchor-guards.md`)의 "잔여 한계"
    절(`eval "git push"` 언급 부분)에 alias 케이스를 병기하는 정도로 충분, 코드 변경
    불요.

- **[INFO]** `.claude/tests/README.md` 커버리지 표에 `test_reap_merged_worktrees.py`
  행이 이번 diff(테스트 8~10건 신규 추가로 대폭 확장)에도 불구하고 여전히 없다
  (`test_push_detection.py` 행만 신규 추가됨, `README.md:32`). 이미 직전 리뷰 라운드에서
  INFO #14로 식별되어 "이 PR 이전부터의 pre-existing 누락...미반영, 전체 감사는 별도
  후속 권장"으로 명시적으로 보류된 사항이라 **새 발견이 아니라 재확인**이며 차단 사유
  아니다.
  - 위치: `.claude/tests/README.md` (표 전체, `test_reap_merged_worktrees.py` 행 부재).

- **[INFO]** `.claude/docs/worktree-policy.md:117` "**세션 앵커** — `bootstrap-session.sh`
  가 `--keep` 으로 전달하는 `$CLAUDE_PROJECT_DIR`" 라는 첫 문장은 코드가 그 환경변수를
  직접 읽는다는 인상을 줄 수 있으나(선택 안 A 를 가리킴), 실제 구현은 plan 문서가
  명시적으로 채택한 **안 B**로 `BASH_SOURCE[0]` 에서 유도한 동일 경로를 전달한다
  (`bootstrap-session.sh:52`: `anchor=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." ...)`).
  같은 문장의 뒷부분("앵커는 `BASH_SOURCE` 로 유도한다 — `git rev-parse` 는 cwd 기반이라
  같은 오답을 낸다")이 정확히 정정하고 있어 실질 오해 소지는 낮지만, 첫 문장만 보면
  오도 가능. 사소한 표현 이슈, 기능 결함 아님.

## 검증 근거 (요약)

- `.claude/hooks/guard_review_before_push.py`: 실제 `git 2.50.1` 서브프로세스로
  `_GIT_OPTS_WITH_VALUE` 9개 전항목 실측(위 WARNING 참고), `eval`/`bash -c`/alias 미탐지
  재현, `_is_git_push` 의 timing 주장(6-24us) 을 `timeit` 으로 재현(7.6~19.9us, 주장과
  일치), unbalanced-quote 폴백이 실제로 `ValueError` 를 유발하는지 직접 확인.
- `.claude/tools/reap-merged-worktrees.sh` + `bootstrap-session.sh`: `--keep` 관련
  신규 테스트 8건을 pre-fix 버전(`9c7818c06^`)에 대해 재실행 → 6건 FAIL + 2건 우연한
  PASS, plan 문서의 자기-신고("6건 실패 + 2건은 구 파서의 unknown-arg exit 2 로 통과")와
  **정확히 일치** — 비-vacuity 독립 재확인. `.claude/settings.json` 이 실제로
  `bash "$CLAUDE_PROJECT_DIR/.claude/tools/bootstrap-session.sh"` 로 호출한다는, 안 B
  설계 전체가 의존하는 전제도 직접 확인.
- `.claude/tests/test_push_detection.py`: 신규 "review 후속" 회귀 케이스 6건(Critical
  #1~#4 해당)을 pre-regression-fix 버전(`2c4e96eb4^` == `9c7818c06`)에 대해 재실행 →
  전부 FAIL(비-vacuity 확인).
  bash/python 문법 검사(`bash -n`, macOS 시스템 bash 3.2 포함)도 통과.
- spec 대응: 이 변경은 `codebase/`(제품 코드)가 아니라 `.claude/`(하네스 도구)
  영역이라 `spec/` 문서가 governing 하지 않는다(`grep -rl` 로 `spec/` 어디에도 이
  세 스크립트에 대한 참조 없음 확인, CLAUDE.md 문서맵과도 일치). 실질적 "spec" 대응물인
  `.claude/docs/worktree-policy.md` §7 은 이번 diff 에서 코드와 함께 갱신되어 있고
  본문 내용도 실제 동작과 대체로 일치한다(위 마지막 INFO 제외).
- TODO/FIXME/HACK/XXX 주석: 전체 7개 파일에서 0건.
- plan 체크리스트: 마지막 항목 `[ ] /ai-review → RESOLUTION → PR` 만 미체크 — 본 리뷰가
  바로 그 단계이므로 정상.

## 요약

두 결함(① 세션 앵커 reap, ② push 가드 문자열매칭 오탐) 모두 "대리 지표 대신 진짜
대상을 본다"는 plan 의 진단대로 정확히 구현됐고, 두 항목 모두 fix-이전 코드에서
신규 테스트가 실제로 실패함을 독립적으로 재현해 비-vacuity 를 확인했다(6/8, 6/6).
전체 하네스 테스트(270건)와 plan-frontmatter vitest(93건)가 모두 통과한다. 유일한
WARNING은 push 게이트의 `_GIT_OPTS_WITH_VALUE` 화이트리스트 중 2개 옵션
(`--exec-path`, `--super-prefix`)에 대한 주석의 "분리 토큰 값을 반드시 소비한다"는
확언이 실제 git 동작과 다르다는 것인데, 실측 결과 두 경우 모두 실제 git 이 서브커맨드
도달 전에 스스로 종료/거부하므로 실질적인 미검토-push 위험은 없다(fail-closed 구조가
이미 안전망 역할) — 다만 이 프로젝트가 바로 이번 세션 마지막 커밋에서 고친 "메커니즘
서술이 실측과 다르다"는 결함과 같은 계열이라는 점에서 정정 가치가 있다. 나머지는
전부 이미 직전 리뷰 라운드에서 식별·보류된 사항의 재확인이거나(README 커버리지 표
공백, `eval`류 미탐지와 동일 계열의 alias 미탐지) 표현 수준의 INFO다. Critical 없음.

## 위험도

LOW
