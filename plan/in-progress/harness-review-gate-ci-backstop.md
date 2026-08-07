---
title: 리뷰 게이트의 훅-독립 CI 백스톱 — 정규식이 유일 판정자인 사각지대를 닫을지
worktree: harness-review-ci-backstop-91f379
started: 2026-07-25
owner: developer
priority: P2
---

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
> **신규 후속 (defer) — 아래 11건 + 기본 브랜치 해석 중복 1건**
>
> 1. **`build_files_section` 의 diff-only 예산 분기가 상한을 넘는다 (기존 결함)** —
>    headers+diffs 만으로 예산을 넘는 분기에서, 절단 루프가 `_truncated_note` 와
>    `"diff 생략"` placeholder 를 덧붙이면서 그 길이를 `cut` 에 계상하지 않는다. 실측:
>    같은 fixture 로 `origin/main` 판 **1,681자 vs cap 1,500** (이 브랜치 판은 1,678 —
>    이번에 추가한 안내는 `overflow` 에 계상했기에 오히려 3바이트 작다). 즉 **내가 만든 결함이
>    아니고 악화시키지도 않았다.** 다른 분기의 같은 계상 누락은 이번에 고쳤으므로, 이 분기도
>    같은 처방(노트 길이를 절단량에 포함)으로 닫으면 된다.
> 2. ~~**하향 금지 정책에 기계적 backstop 이 없다**~~ → **구현 완료 (2026-07-31, `30cc0f738`)**.
>    `.claude/_shared/block_integrity.py` 가 checker 리포트의 `[CRITICAL]` 태그를 세어 SUMMARY 의
>    `BLOCK:` 와 모순되면 경고한다. 착수 전 실측: consistency 세션 732개 중 24건(3.3%)이
>    `BLOCK: NO` 인데 `[CRITICAL]` 을 갖고 있었고, 표본의 SUMMARY 들이 하향을 스스로 서술한다.
>    게이트가 실제 채택하는 세션만 대조하며(전 이력 재경고는 +0.39초에 늘 우는 경고가 된다),
>    경고는 결정 객체의 `notes` 로 올라가 호출자가 자기 exit-code 계약에 맞는 스트림으로 낸다 —
>    ALLOW(exit 0)에서는 stdout 이 모델에 주입되므로 stderr 고정은 아무도 안 읽는 자리였다.
>    원래 항목 서술: — `.claude/agents/consistency-summary.md` 의
>    규약은 prompt 지시일 뿐이고, 게이트(`_BLOCK_LINE`)는 `BLOCK:` 값이 각 checker 의
>    `[CRITICAL]` 개수와 모순되는지 대조하지 않는다. 정확히 그 불변식이 깨진 사례가 이미
>    기록돼 있다(`review/code/2026/07/25/22_58_00`). 후보: orchestrator 가 checker 리포트의
>    `[CRITICAL]` 수를 세어 최종 `BLOCK:` 와 모순되면 stderr 경고 / 반환 플래그.
>    (사용자가 정책 자체는 "하향 금지 + planner 인계" 로 확정했으므로 이건 그 집행 수단이다.)
> 3. **`build_files_section` 이 예산 전략 3개를 한 함수(약 190줄)에 누적** — 무예산 /
>    header+diff 초과 / 콘텐츠 할당 세 경로가 "안내문 길이도 예산에 포함" 이라는 같은 불변식을
>    각자 손으로 재구현한다. 3R CRITICAL 이 정확히 이 구조에서 재발했다(한 경로를 고쳤는데
>    다른 규모에서 같은 클래스가 다시 나옴). `_render_unbounded` /
>    `_render_diff_only_overflow` / `_allocate_content_budget` 로 분리하고 예산 계상을 단일
>    헬퍼로 공유시킬 것.
> 4. **파일 수가 아주 많으면 헤더만으로 상한 초과** — n=3000 실측: 헤더+구분자만 157,887자
>    vs cap 141,557. 어느 분기도 **파일 섹션 자체를 버리는** 기능이 없어 구조적으로 준수 불가다
>    (origin/main 도 동일 — 이번 변경이 만든 것도 악화시킨 것도 아니다). 실제 리뷰 규모에서는
>    발생하지 않으므로 P3. 닫으려면 "N개 파일은 목록만" 같은 파일-단위 드롭이 필요하다.
> 5. **`evaluate_review` 의 boolean flag 구조** — push(hard block)/stop(soft nudge) 두 보증
>    수준을 `in_flight_ok` 하나로 스위칭한다. 현재는 fail-safe 기본값 + 양방향 seam 테스트로
>    봉쇄돼 있으나, 세 번째 호출부가 생기면 다시 기본값에 의존한다.
>    `evaluate_review_for_push()` / `_for_stop()` 얇은 wrapper 로 시그니처 레벨 차단 검토.
> 6. **git 브랜치-diff 헬퍼가 두 orchestrator 에 중복** — `_branch_changed_rels`(consistency)
>    와 `get_git_branch_diff_files`(code-review)가 같은 git 연산이다. 상호참조 주석은 넣었지만
>    구조적 중복은 남는다. 위 "기본 브랜치 해석 4곳" 과 같은 뿌리(= `_lib` 충돌 해소 선행).
> 7. **`_rank_plan_text` 이중 read (이번 PR 이 도입한 I/O 회귀)** — `collect_context` 가
>    랭킹 신호용으로 `plan/in-progress/` 전체를 한 번 읽고, 곧이어 `format_file_bundle` 이
>    같은 디렉터리를 처음부터 다시 읽는다. 세션당 2배 I/O. 실측 규모는 30개 430,929 bytes
>    (≈3.5ms 수준)라 현재는 무해하지만 **내가 만든 회귀**이고, `{path: text}` 맵을 한 번만
>    만들어 랭킹·번들 양쪽에서 재사용하면 닫힌다. 5R 에서 코드를 더 건드리지 않기로 해
>    등재만 한다.
> 8. **`_default_branch_ref()` 의 성공 경로 3갈래가 미검증** — 모든 테스트가 이 함수를 통째로
>    stub 하거나 실패-흡수 경로만 본다. 자매 함수 `_branch_changed_rels` 는 임시 git repo 로
>    성공 경로까지 고정돼 있어 비대칭이다. 같은 패턴으로 4케이스(symbolic-ref 적중 /
>    `origin/main` 만 / `origin/master` 만 / origin 없음) 고정할 것.
> 9. **`merge_coordinator_orchestrator.py` 에 `reconcile_state_with_disk` 자기치유가 없다** —
>    상태 helper 를 `_shared/` 로 옮기며 확인: 이 파일은 세 번째 사본인데 `_load_state`/
>    `_save_state`/`_apply_status_update` 가 다른 둘과 동일하고(전부 위임 완료),
>    `_emit_summary_state` 만 branch/base 를 다뤄 다르며, **`_reconcile_state_with_disk` 는
>    아예 없다.** (`_apply_status_update` 를 "다르다" 고 적었던 첫 서술은 틀렸다 — AST 차이가
>    이름 접두뿐인데 정규화를 안 하고 발산으로 읽었다.) 즉 Agent tool 로 직접 fan-out 한 세션이 prepare 시점 스냅샷에 멈춘 채
>    SUMMARY 는 실제 성공을 보고하는, 다른 두 orchestrator 가 이미 고친 모순을 그대로 겪는다.
>    다른 skill 의 동작 변경이라 별도 PR 로 분리한다.
> 10. **`_retry_state.json` 의 lost update — 잠금이 없다** — `apply_status_update` 는
>    read-modify-write 인데 파일 잠금이 없다. `save_state` 를 원자적으로 만든 것은 *찢어진 읽기*
>    만 닫는다. 수렴이 있는 필드는 `agents_success` **하나뿐**이다(디스크의 리포트 파일에서 매번
>    재도출). `agents_fatal` 은 이미 메모리에 있던 값을 필터링할 뿐이라 **한 번 유실되면 어떤
>    reconcile 로도 복구 불가** — `/loop` 가 영구 실패로 판정된 checker 를 다시 돌린다.
>    `agent_history` · `rate_limit_episodes` · `last_reset_hint_sec` 도 마찬가지.
>    `fcntl.flock` 은 모든 훅 경로에 블로킹 프리미티브를 놓는 것이라 채택 안 했고, 대안은
>    `<name>.fatal` sentinel 파일로 `agents_fatal` 도 디스크에서 재도출하는 것 — 새 설계라 분리.
>    (docstring 은 이번에 정정했다. 종전 서술이 "버킷들은 디스크에서 재도출된다" 로 읽혀
>    보장 범위를 과대하게 주장하고 있었다.)
> 11. **`--branch` 가 `--files` 를 조용히 덮어쓴다 (신규 발견, 2026-08-01 6R)** — 게이트 자체를
>    무력화할 수 있는 결함이라 우선순위 높음. 재현 실험:
>
>    | 명령 | `meta.json` files |
>    |---|---|
>    | `--prepare --files A B` | 2 (준 그대로) |
>    | `--prepare --branch origin/main --files A B` | **44 (전부 `review/**`, 내 목록 폐기)** |
>
>    `collect_change_infos` 가 `if/elif` 체인이고 `--branch` 분기가 `--files` 분기보다 앞에 있어,
>    `--files` 는 **도달 불가능한 죽은 분기**가 된다. 경고도 없다.
>    이 저장소의 표준 절차는 "명시 파일 + `--route=all`" 인데(증분 changeset 이 결함을 구조적으로
>    놓치므로), 커밋 후엔 `--branch` 를 함께 줘야 diff base 가 맞는다 — 정확히 그 조합에서 명시
>    목록이 통째로 버려진다.
>    1R~5R 이 무사했던 건 우연이다: 그때는 리뷰 산출물이 untracked 라 branch diff 가 소스만 담았다.
>    5R 산출물을 커밋한 순간 같은 명령이 리뷰 산출물만 담은 changeset 을 만들었고, 14명 전원이
>    자기 브랜치가 고친 소스를 **한 줄도 못 본 채** "CRITICAL 0" 을 냈다.
>
>    > **동반 발견 — 호출자(나) 쪽 결함이 더 컸다.** 위 진단은 절반만 맞다. 나는 매 라운드
>    > `--files $FILES` 로 호출했는데 **셸이 zsh 라 unquoted `$FILES` 가 단어 분할되지 않는다** —
>    > 17개 경로가 한 덩어리 문자열 하나로 전달됐다(`${=FILES}` 나 배열이라야 분할된다).
>    > 즉 `--branch` 가 없었더라도 내 명시 목록은 **애초에 전달된 적이 없다**. 실측:
>    > `python3 -c ... $V` → 인자 1개 `['a b c']` / `${=V}` → 인자 3개.
>    > 결론: 하네스 결함(위)과 호출 결함(이것)이 겹쳐 "명시 파일" 절차가 이 브랜치 전 라운드에서
>    > 무효였다. 소스가 리뷰된 것은 `--branch` 의 diff 가 마침 소스뿐이었기 때문이다.
>    > **bash 문법을 zsh 에서 쓰는 이 클래스는 재발하기 쉽다** — 파일 목록은 배열로 넘길 것.
>    - ~~최소 조치: 두 옵션이 같이 오면 `--files` 우선 + 무시되는 쪽을 stderr 로 경고(현재 침묵).~~
>      **구현 완료 (8R)** — 다만 **우선순위는 바꾸지 않았다.** 서술과 실제가 다르므로 정정한다:
>      scope 플래그(`--commit`/`--range`/`--branch`)가 계속 이긴다(다른 호출부가 그 의미에
>      의존한다). 바뀐 것은 폐기가 **더 이상 침묵하지 않는다**는 것뿐 —
>      `!! --files IGNORED (N path(s)) — --<flag> takes precedence …` 를 stderr 로 내고
>      무시된 경로를 최대 5개까지 이름으로 찍는다. 회귀 테스트 4개(
>      `ScopeFlagDiscardingFilesIsAnnouncedTest`)가 세 플래그 각각과 "경고하면 안 되는" 두 경우를
>      고정한다. 구조적 차단(`add_mutually_exclusive_group`)은 아래 동반 항목과 함께 남는다.
>    - 동반: `get_directory_files()` 가 `.gitignore` 를 안 보는 raw `os.walk` 이고,
>      `collect_change_infos` 의 `elif args.files:` 분기에는 기본 경로에 있는
>      `warn_if_committed_work_is_missing` 대칭 안전장치가 없다.
>    - 동반: changeset 이 `review/**` 로만 구성되면 그 자체가 오구성 신호 — advisory 경고 대상.
> 12. ~~**`_porcelain_path` 가 git 의 C-quoting 을 다루지 않는다**~~ → **처분 완료 (8R)** — `_run_git` 에 `-c core.quotePath=false` 를 걸어 관문에서 막았다. 8R 리뷰어가 **더 강한 영향**을 밝혔다: uncommitted 경로뿐 아니라 `_newest_commit_time` 이 인용된 경로를 그대로 `git log -- <path>` 에 넘겨 매칭 실패 → `newest_code = 0.0` → Gate 1 이 저장소의 **아무 오래된 resolved 리뷰로나** 통과한다. 실측: `codebase/**` 2,464개 중 인용 유발 경로 0개라 오늘은 도달 불가지만, 한 줄 플래그라 correctness 로 넣었다. 잔여: 따옴표·백슬래시·제어문자 경로는 여전히 인용된다(손으로 디코더를 짜지 않는다). 원 서술: —
>    7R 이 고친 선행-공백 결함과 **같은 클래스**다. `git status --porcelain` 은 비-ASCII 경로를
>    기본으로 인용해 `"\355\225\234..."` 형태로 낸다(`core.quotePath` 기본값 true). 파서는
>    `ln[3:].strip()` 후 그대로 돌려주므로 그 문자열은 실제 경로와 매칭되지 않는다.
>    - 영향 방향: `_dirty_set` 에 실제 경로가 안 들어가면 그 파일은 **clean 으로 취급**돼
>      편집 시각이 마지막 커밋 시각이 된다 → 방금 고친 파일이 오래돼 보이고, stale 한 리뷰가
>      fresh 로 읽힌다. 7R 결함과 같은 fail-open 방향이다.
>    - **미측정**: 이 저장소의 `codebase/**` 에 비-ASCII 경로가 실제로 있는지 확인하지 못했다
>      (측정 시도 시점에 Bash 도구가 일시 불가였다). 파서가 틀린 것은 코드 독해로 확정이지만,
>      **도달 가능성은 미확인**이므로 그것을 재기 전에는 고치지 않는다.
>    - 후보 처방 두 가지, 각각 트레이드오프가 있다: (a) `git -c core.quotePath=false` — git
>      자신의 스위치라 손으로 디코더를 짜지 않아도 되지만 따옴표·백슬래시·제어문자 경로는
>      여전히 인용된다. (b) `--porcelain -z` — 인용 자체가 사라지지만 rename 페이로드 순서가
>      바뀌어(`새\0옛`) 현재 `" -> "` 계약과 그 테스트를 다시 써야 한다.
>      **손으로 octal 디코더를 짜는 3안은 피한다** — 이 저장소가 반복해서 손해로 분류해 온 형태다.
> 13. **테스트 픽스처가 공유 `.git/config` 를 오염시킬 수 있다 (2026-08-06 실제 사고)** —
>    11R 에서 `actions/checkout` 위상을 재현하려 만든 픽스처의 `git remote add origin` 이
>    워크트리 쪽에서 실행돼 `origin` URL 이 임시 경로로 덮였다. 이 저장소는 워크트리 5개가
>    **같은 `.git/config` 를 공유**하므로 다른 세션의 `fetch`/`push` 까지 함께 깨졌고,
>    오염 시점엔 아무 신호가 없어 다음 `git fetch` 실패로 우연히 발견됐다.
>    복구: `origin` 을 정상 URL 로 되돌리고 `git ls-remote` 로 확인. 커밋·작업 손실 없음.
>    이 브랜치가 손댄 3개 픽스처는 즉시 경화했다 — 임시 트리 밖이면 단언으로 죽고,
>    `git -C` 로 cwd 를 명시하며, `GIT_CEILING_DIRECTORIES` 로 상위 탐색을 막는다.
>    - **잔여 (12R 재집계): pre-existing 4곳.** 최초 조사는 4곳이라 했는데 12R 리뷰어가
>      **내가 편집한 파일 안에도 3곳이 남아 있음**을 짚었다 — 그 3곳은 이번에 닫았고, 실제
>      잔여는 아래 4곳이다(전부 이 티켓 밖): — `test_consistency_bundle_priority.py`
>      `test_consistency_impl_done.py` · `test_line_anchors.py` ·
>      `test_push_guard_worktree_scope.py` (전부 `-C`/ceiling 없이 `init`/`config` 호출).
>      이 티켓 범위 밖이라 등재만 한다. 근본 처방은 `_harness.py` 에 공용
>      `make_temp_git_repo()` 를 두고 이 가드를 그 안에 한 번만 넣는 것이다.
> 14. **fresh-interpreter 테스트 보일러플레이트가 4개 파일에 복제** — `_lib` 네임스페이스 충돌을
>    피하는 `run_in_orchestrator` + `_PREAMBLE` (~35줄)이 `test_consistency_context_budget` ·
>    `test_consistency_bundle_priority` · `test_prompt_omission_notice` ·
>    `test_review_changeset_warning` 에 각각 있다. `_harness.py` 로 추출하면 한 곳만 고치면 된다
>    (이번에 timeout 을 3곳에 각각 넣어야 했던 것이 그 비용의 실례).
> 15. **`git_probe._default_branch` 의 Method 1 성공 경로가 실 저장소로 구동된 적이 없다** (12R
>    W3) — 유일한 실 저장소 픽스처(`ActionsCheckoutTopologyTest`)가 **정의상 그 ref 가 없는**
>    위상이라, `refs/remotes/origin/HEAD` 가 **있을** 때의 동작은 stub 으로만 고정돼 있다.
>    11R 이 닫은 결함이 바로 "이 함수가 위상에 따라 다르게 행동한다" 였는데, 두 위상 중
>    하나만 실물로 본다. `git clone` 픽스처가 필요해 별도 범위 — §8 과 같은 클래스이되
>    다른 함수다(§8 은 `code_review_orchestrator._default_branch_ref()`).
> 16. **`_run_git` 의 타임아웃 경로가 미검증** (12R W4) — `subprocess.TimeoutExpired` 를
>    삼키고 실패로 취급하는 분기가 어떤 테스트도 통과하지 않는다. 11R 이 드러냈듯 이 경로는
>    가설이 아니라 **CI 에서 매번 실제로 밟히던 경로**였다(네트워크 프로브 2.58초 → 상한).
>    지금은 그 호출을 최후로 밀어 평시엔 안 밟지만, 삼키는 방향이 fail-open 이라 고정이 필요하다.
>
> **신규 후속 (defer)** — "origin 기본 브랜치 해석" 이 4곳에 독립 구현돼 있다:
> `branch_guard._origin_default_branch()`(정본) · `review_guard._default_branch()` ·
> `code_review_orchestrator._default_branch_ref()`(이번 신설) ·
> `consistency_orchestrator` 의 `args.diff_base or "origin/main"` 리터럴. 반환 계약이 서로
> 달라(로컬 `main` vs `origin/main`) 단순 통합은 불가하고, 실제 코드 공유엔 **hooks/skills 의
> `_lib` 네임스페이스 충돌 해소가 선행**이라 별도 범위로 남긴다. 기본 브랜치 정책이 바뀌면
> 4곳을 모두 고쳐야 하는 drift 위험이 현재 상태다.

> **2026-08-01 — 본체 구현 완료 (관측 모드).** `review-gate.yml` + `check-review-gate.py`.
> 판정은 로컬 훅과 **같은** `evaluate_review()` 에 위임하고, 트리거만 훅 밖(GitHub PR
> 이벤트)에 둔다 — 이 층의 목적이 "push 탐지 정규식이 유일 판정자" 인 사각을 닫는 것이므로
> 필요한 독립성은 트리거뿐이고, 판정을 새로 구현하면 로컬/CI drift 를 만든다.
>
> **enforce 로 뒤집는 것은 별도 결정이다.** 위 §마찰 실측대로 지금 켜면 이력상 18% 를 막는데
> 그건 미리뷰가 아니라 산출물 미커밋이다. CI 에 쌓이는 실판정을 보고 정한다. 켤 때 바꿀 곳은
> 워크플로의 `run:` 한 줄과 `test_it_is_still_observation_only` 하나 — 조용히 뒤집히지 않게
> 테스트가 현재 상태를 고정해 뒀다.
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
- [ ] 대안: push 시 게이트 **통과 기록**(상태 파일 타임스탬프)을 남기고, 별도 감사에서
      "codebase 변경 push 인데 기록 없음" 을 탐지. 단 이것도 "codebase 변경 push" 판정에
      정규식이 끼면 부분적으로만 독립.

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
- [ ] 동일 커밋의 형제 파일이 부분만 뽑히는 원인 확인

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
