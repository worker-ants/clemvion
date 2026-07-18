# Requirement Review — mermaid-lint 설치 가드 자기리뷰 보강 (bbf72268e, d31f99a11)

리뷰 대상: `.claude/hooks/_lib/mermaid_lint_ready.py`, `.claude/hooks/lint_mermaid_posttooluse.py`,
`.claude/tools/bootstrap-session.sh`, `.githooks/pre-commit`,
`.claude/tests/test_bootstrap_mermaid_install.py`, `.claude/tests/test_mermaid_lint_ready.py`
(diff base `origin/main`=`cdad5a1ec` → HEAD `d31f99a11`, 두 커밋 누적).

검증 방법: 코드 라인 단위 대조 + `plan/in-progress/harness-guard-followups.md` §A ·
`review/code/2026/07/17/20_06_45/{SUMMARY,RESOLUTION}.md`(조작적 spec 역할, 아래 근거) 대조 +
`python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 실제 실행(304/304 통과) +
`_lock_is_dead()`의 `find -mmin` 정수 나눗셈 가설을 별도 bash 재현으로 실측.

## 발견사항

- **[WARNING]** `MERMAID_INSTALL_LOCK_GRACE_SEC`(grace 값) 이 정수-분 단위로만 처리되어 60초
  미만 값에서 "방금 재획득한 락은 항상 young 하다"는 코드 자신의 불변식이 무력화될 수 있고,
  이 경로를 실제 값으로 행사하는 테스트가 하나도 없다.
  - 위치: `.claude/tools/bootstrap-session.sh:74`(env 선언), `:98`(`_lock_is_dead`의
    `find "$lock" -maxdepth 0 -mmin "-$(( lock_grace / 60 ))"`); 관련 불변식 서술은
    `:86-92`("a just-reacquired lock is always young and thus safe from a second stealer,
    which is what stops steals from cascading"). 테스트 쪽 배선: 
    `.claude/tests/test_bootstrap_mermaid_install.py:86`(`_env(... lock_grace=None)`),
    `:99-100`(`if lock_grace is not None: env["MERMAID_INSTALL_LOCK_GRACE_SEC"] = ...`),
    `:107,109`(`_run`이 동일 파라미터를 그대로 통과) — 파일 전체에서 이 파라미터가 `None` 아닌
    값으로 호출되는 곳은 없음(`grep -n lock_grace` 결과 4곳 전부 배선/시그니처뿐).
  - 상세: bash 정수 나눗셈은 `lock_grace`가 1~59 인 값을 `0`으로 truncate 한다. 직접 재현
    (`find <dir> -maxdepth 0 -mmin -0`)한 결과 방금 생성한(수 초 전) 디렉터리조차 매칭되지
    않는다 — 즉 `-mmin -0`은 어떤 mtime 도 "young"으로 인정하지 않는다. 결과적으로
    `MERMAID_INSTALL_LOCK_GRACE_SEC`를 60 미만 값으로 설정하면 `_lock_is_dead()`의 나이 게이트가
    사실상 상시 통과 상태가 되어, 스틸러가 `mkdir` 로 락을 갓 재획득한 순간에도 바로 다음
    프로세스가 (owner PID 가 우연히 아직 안 쓰였거나 unlabelled 라면) 즉시 다시 훔칠 수 있는
    캐스케이드 창이 열린다 — 정확히 86-92행 주석이 "일어나지 않는다"고 단언하는 시나리오다.
    기본값(600)은 60 의 배수라 이 경로에서 안전하고, 현재 어떤 코드도 60 미만 값을 설정하지
    않으므로 오늘 시점의 실질 위험은 낮다. 부수: 같은 줄의 산술 확장은 `retry_after` 비교
    (82행, `2>/dev/null` 로 방어됨)와 달리 무방비라, 공백이 섞인 비-숫자 값을 주면 bash 산술
    문법 오류가 stderr 로 그대로 유출됨을 실측 확인함(`bash: line 2: 30 seconds: syntax error
    in expression (error token is "seconds")`) — "항상 조용히 fail-open"이라는 파일의 설계
    원칙과 어긋나는 비대칭이다(같은 커밋에서 도입된 두 신규 env 노브 중 하나만 방어됨).
  - 제안: `lock_grace`를 초 단위로 직접 비교하는 방식(예: `$(( $(date +%s) - $(_file_mtime
    "$lock") ))` 을 `_install_throttled`와 동일한 패턴으로 재사용, 또는 최소 1분 하한 clamp +
    숫자 검증 추가)으로 바꾸고, `_env()`/`_run()`의 `lock_grace` 파라미터를 실제 non-default
    값(예: 5초)으로 호출해 이 경로를 검증하는 테스트를 최소 1개 추가.

- **[WARNING]** `test_marker_without_node_modules_dir_is_not_ready` 가 테스트명·주석이 약속하는
  시나리오를 실제로 검증하지 않는 공허한(vacuous) 중복 테스트다.
  - 위치: `.claude/tests/test_mermaid_lint_ready.py:61-63`.
  - 상세: 테스트명과 주석("marker path implies node_modules/, but guard the isdir check
    anyway")은 "마커 파일은 존재하지만 `node_modules`가 디렉터리가 아닌" 케이스를 검증한다고
    약속한다. 그러나 실제 바디는 아무 파일도 만들지 않고 `ready.is_ready(self.tool_dir)`만
    호출한다 — 이는 `:47-49`의 `test_no_tool_dir_is_not_ready`의 두 번째 assertion(`# nothing
    created yet`)과 완전히 동일한 입력(빈 tool_dir)을 재확인할 뿐이다. `is_ready()`(
    `mermaid_lint_ready.py:41-46`)의 `os.path.isdir(node_modules) and
    os.path.isfile(marker_path(...))` 중 앞의 방어적 `isdir` 체크는 여전히 실제로 의도한
    엣지 케이스로는 검증되지 않은 채 남는다(다만 정상적 파일시스템 조작만으로는 "마커 파일은
    있는데 부모가 디렉터리가 아닌" 상태를 만들기 어렵다는 점도 사실 — `isfile(marker_path)`가
    참이려면 `node_modules`가 이미 디렉터리여야 하므로, 이 방어 코드는 mock 없이는 근본적으로
    테스트 불가능한 조합일 가능성이 높다).
  - 제안: mock(`unittest.mock.patch("os.path.isdir", return_value=False)`)으로 `isdir`만
    강제로 False 로 만든 채 마커 파일이 실재하는 상태를 구성해 방어 로직 자체를 검증하거나,
    실질적으로 커버 불가능한 케이스라면 이 테스트를 제거하고 코드 주석("guard the isdir check
    anyway")에 "구조적으로 항상 참이라 테스트로 표현하기 어려운 방어적 이중 체크"라는 취지를
    남긴다.

- **[INFO]** 이 변경 영역을 정의하는 `spec/` 문서는 없다 — 저장소 자체 규약상 정상.
  - 위치: 전체 `spec/`(grep 결과 "mermaid" 히트는 전부 spec 문서 내 다이어그램용 ```mermaid
    펜스이며 이 하네스 기능과 무관).
  - 상세: 리뷰 대상 6개 파일은 `codebase/`(제품 코드)가 아니라 `.claude/`(개발 하네스
    인프라)이므로, CLAUDE.md의 정보 저장 규약상 `spec/`이 아니라 `plan/in-progress/*.md` +
    코드 주석이 SoT다. 조작적 spec 역할을 하는
    `plan/in-progress/harness-guard-followups.md` §A 및 직전 라운드
    `review/code/2026/07/17/20_06_45/{SUMMARY,RESOLUTION}.md`의 WARNING #1/#2/#3 각각을
    코드와 라인 단위로 대조 검증했다:
    - WARNING #1(stale-lock 탈취가 생존이 아닌 경과시간만 봄) → `bootstrap-session.sh:96-104`
      `_lock_is_dead()`가 owner PID 기록 + grace-age AND `kill -0` 생존 확인으로 교체됨.
      `test_live_but_slow_lock_is_not_stolen_even_when_aged`(살아있는 홀더는 아무리 늙어도
      보존)·`test_dead_pid_lock_is_stolen`(죽은 홀더만 탈취) 양쪽으로 실제 서브프로세스
      PID 를 써서 검증 — 실행 확인.
    - WARNING #2(세 소비처 판정 불일치) → `_lib/mermaid_lint_ready.py` 신설, PostToolUse 는
      import(`lint_mermaid_posttooluse.py:39,104`), pre-commit 은 CLI 호출
      (`.githooks/pre-commit:57-58`), bootstrap 은 마커명 하드코딩 + drift 테스트
      (`test_mermaid_lint_ready.py:81-96` `ConsumerBindingTest`)로 결속. 전체 `.claude/`
      트리 grep 으로 mermaid-lint 관련 bare `[ -d node_modules ]` 잔존이 없음을 직접 확인.
    - WARNING #3(무한 재시도) → `_install_throttled()`(`bootstrap-session.sh:80-84`) +
      `MERMAID_INSTALL_RETRY_SEC`(기본 1800초=30분) 쿨다운. throttle/재시도 재개 양쪽 테스트
      통과 확인.
    - `python3 -m unittest discover -s .claude/tests -p 'test_*.py'`를 직접 실행해
      **304/304 통과**를 확인함(RESOLUTION.md의 "harness 304건 통과" 주장과 일치, stale
      claim 아님). plan 체크리스트 "A — [x] 완료" 표기도 실제 상태와 정확히 부합한다.
  - 제안: 조치 불요 — 확인성 기록.

- **[INFO]** `npm install` 서브프로세스에 실행 timeout 이 없음 (diff 밖, pre-existing —
  이번 두 커밋의 회귀 아님).
  - 위치: `.claude/tools/bootstrap-session.sh:115`.
  - 상세: 파일 헤더(`:6-7`)는 "Always exits 0 — bootstrap must never block a session"이라
    단언하고, 같은 기능 영역의 자매 파일 `lint_mermaid_posttooluse.py`는 git 서브프로세스
    (`:76`, `timeout=5.0`)·node 서브프로세스(`:120`, `timeout=_NODE_TIMEOUT`=20초) 모두에
    "a hung X must never wedge Y" 원칙에 따라 명시적 timeout 을 건다. 그러나 정작 가장
    네트워크 hang 위험이 큰 `npm install` 호출 자체엔 timeout 이 없다. `git diff
    cdad5a1ec..bbf72268e`로 대조한 결과 이 gap 은 이번 두 커밋 이전(#970 merge 시점)부터 있던
    코드라 이번 diff 의 신규 회귀는 아니다. 다만 이번 PR 전체의 주제가 "설치 라이프사이클
    신뢰성"이고 이번에 실제로 여러 subprocess 호출에 timeout 을 추가/검증했으므로(테스트 쪽
    `_run(... timeout=60)`, `Popen(...).wait(timeout=60)` 등), 같은 주제 안에서 다뤄질 가치가
    있는 잔여 항목이다.
  - 제안: `npm install`에도 상한을 두는 후속 항목을(예: `timeout 300 npm install ...`)
    `plan/in-progress/harness-guard-followups.md`에 등록 검토. 이번 PR 의 차단 사유는 아님.

- **[INFO]** pre-commit 이 매 커밋마다 python3 서브프로세스를 하나 더 스폰(의도된 트레이드오프).
  - 위치: `.githooks/pre-commit:58`.
  - 상세: 기존엔 `[ -d "$mermaid_tool_dir/node_modules" ]` 순수 bash 테스트였으나, 공유 SoT
    도입으로 매 커밋마다 `python3 mermaid_lint_ready.py <tool_dir>` 서브프로세스가 추가된다
    (branch guard 용 python3 스폰은 이미 있었으므로 완전히 새로운 의존성은 아님). 파이썬
    시작 비용(수십 ms) 수준의 미미한 트레이드오프이며 SoT 일치성 확보를 위한 의도된 선택.
  - 제안: 조치 불요.

- **[INFO]** 상위 rationale 주석의 낱말 선택이 실제 구현과 다름(기능 영향 없음).
  - 위치: `.claude/tools/bootstrap-session.sh:61-63`(요약 주석) vs `:108-110,126`(실제 코드).
  - 상세: 헤더 요약 주석은 "a session only rmdir's a lock it still owns"라고 쓰지만, 실제
    릴리스 코드(`:126`)와 그 지역 주석(`:108-110`, "`rm -rf`, not rmdir: the lock dir holds
    an `owner` file...")은 명시적으로 `rm -rf`를 쓴다(owner 파일이 든 비어있지 않은 디렉터리라
    `rmdir` 자체가 실패하기 때문 — 이 이유는 지역 주석에 정확히 설명돼 있음). 상위 요약
    주석만 관용적으로 낡은 동사를 쓴 것으로 보이며 동작에는 영향 없음.
  - 제안: 조치 불요(선택 시 61-63행의 "rmdir's"를 "removes"로 정밀화).

## 요약

이번 diff(`cdad5a1ec`→`d31f99a11`, 2개 커밋)는 직전 라운드(`review/code/2026/07/17/20_06_45`)가
지적한 세 가지 핵심 결함 — stale-lock 탈취가 생존이 아닌 경과시간만 검사하던 문제(실측
재현됨, WARNING #1), 세 소비처(bootstrap/pre-commit/PostToolUse)의 판정 기준 불일치(WARNING
#2), 실패한 install 의 무한 재시도(WARNING #3) — 를 각각 owner-PID `kill -0` 생존 판정,
`_lib/mermaid_lint_ready.py` 공유 SoT, `MERMAID_INSTALL_RETRY_SEC` 쿨다운으로 정확하고 라인
단위로 충실하게 구현했다. 직접 테스트를 실행해 304/304 통과를 확인했고(RESOLUTION.md 의 주장과
부합), 세 소비처 전수 grep 으로 bare `[ -d node_modules ]` 판정 잔존이 없음도 직접 확인했다.
`spec/`에는 이 하네스 툴링을 정의하는 문서가 없으나 이는 저장소 자체 정보-저장 규약(제품 spec 은
`codebase/`, 하네스는 `plan/`+코드 주석) 과 부합하는 정상 상태이며, 조작적 spec 역할을 하는
plan 문서·직전 리뷰 문서와 대조했을 때 체크리스트("A — 완료")는 실제 상태와 정확히 일치한다(stale
checkbox 아님). 다만 이번에 새로 도입된 `MERMAID_INSTALL_LOCK_GRACE_SEC` grace 값 처리는
정수-분 truncation 으로 60초 미만 설정 시 코드 자신이 명시한 "young lock 은 절대 안전하다"는
불변식을 조용히 무력화할 수 있는 latent 결함이며(기본값 사용 시 무해, 이 경로를 실제 값으로
행사하는 테스트도 전무), 신규 테스트 하나(`test_marker_without_node_modules_dir_is_not_ready`)는
이름이 약속하는 엣지 케이스를 실제로 검증하지 않는 공허한 중복이다. 이 두 건을 제외하면
비즈니스 로직·에러 처리·반환값·spec/plan 정합성 모두 견고하며, 나머지는 diff 밖 pre-existing
잔여 항목이거나 의도된 트레이드오프다.

## 위험도

LOW
