# 부작용(Side Effect) 리뷰

대상: `.claude/tools/bootstrap-session.sh`, `.claude/hooks/lint_mermaid_posttooluse.py`,
`.claude/hooks/_lib/mermaid_lint_ready.py`(신규), `.githooks/pre-commit`,
`.github/workflows/harness-checks.yml`, `.claude/tests/test_bootstrap_mermaid_install.py`(신규),
`.claude/tests/test_mermaid_lint_ready.py`(신규). Diff 기준선은 merge-base `cdad5a1ec`(origin/main
과의 fork point) — `git diff cdad5a1ec`로 실제 변경 범위(7파일, +837/-9)를 확인했다.

## 조사 방법

정적 코드 검토에 더해, `_lock_is_dead`(신규 stale-lock 탈취 판정) 주변의 동시성 부작용을
**실측으로 검증**했다: 리뷰 대상 `bootstrap-session.sh`를 스크래치패드에 원본 그대로 복사하고,
①죽은 owner PID + 1시간 경과 lock 을 미리 심어 둔 뒤 N개(5~30) 동시 프로세스로 부트스트랩을
기동하는 스크립트, ②동일 하네스에서 lock 을 전혀 심지 않은 대조군(콜드스타트) 스크립트를
작성해 npm 스텁 호출 횟수를 비교했다. 실행 결과는 아래 CRITICAL 항목에 그대로 인용한다.

## 발견사항

- **[CRITICAL]** stale-lock 탈취 경로(`_lock_is_dead` → `rm -rf`)의 check-then-act 비원자성이
  실측으로 재현됨 — 이 PR 이 없애려는 "동일 트리 동시 `npm install`"을 다른 경로로 재도입
  - 위치: `.claude/tools/bootstrap-session.sh:108-121`(`_lock_is_dead`), `:123-130`
    (`_lock_is_dead && rm -rf "$lock" 2>/dev/null` 직후 `if mkdir "$lock"`), 특히 `:125-127`
    주석("a genuinely dead+aged lock cannot also be a fresh re-acquisition ... so removing it
    here cannot clobber a live holder")
  - 상세:
    - `_lock_is_dead`는 `stat`(`_file_mtime`)·`date`·`cat`·`kill -0` 등 여러 서브프로세스를
      포크해 "이 락은 grace 경과 + 소유자 사망"이라는 **스냅샷 판정**을 만든다. 이 판정과
      바로 다음 줄의 `rm -rf "$lock"`(실행) 사이에는 프로세스 간 동기화가 전혀 없다 — 두
      세션이 **같은 죽은 락**을 거의 동시에 관찰하면, A 가 판정→삭제→`mkdir`(신선한 락
      재생성)까지 마친 **직후**에 B 가 (A 의 mkdir 이전 시점에 이미 내린) 자신의 "죽었다"
      판정을 근거로 `rm -rf`를 실행해 **A 의 살아있는 새 락을 지우고** 이어서 자신도
      `mkdir`에 성공한다 — 결과적으로 A·B 모두 같은 `node_modules`에 동시에 `npm install`.
      125-127행 주석의 "cannot clobber a live holder" 주장은 check 와 act 가 원자적이라는
      전제에서만 성립하는데, 실제로는 원자적이지 않다.
    - **실측 재현**(원본 스크립트 무수정, 스크래치패드 격리 실행): 1시간 경과 + 죽은 owner
      PID 를 가진 lock 을 미리 심고 N 개 동시 `bootstrap-session.sh`를 기동한 결과(npm 은
      호출 로그 + 0.3s sleep 스텁) —
      ```
      N=5   → 중복 없음 (1회, 2회 반복)
      N=10  → npm 호출 2회
      N=15  → npm 호출 6회
      N=20  → npm 호출 6회
      N=30  → npm 호출 13회 / 재실행 9회 / 재실행 4회 (매번 >1, 0회 재현 실패 없음)
      ```
      모든 호출의 시작 타임스탬프가 수 ms 이내로 겹치고 각 스텁은 300ms 간 "설치 중"이므로
      실제로 **동시에 실행**됨을 확인했다(순차적 중복 재설치가 아님). **대조군**(동일 하네스,
      사전 lock 없이 N=30 콜드스타트)은 정확히 1회만 호출 — 기존
      `test_concurrent_sessions_install_at_most_once`가 검증하는 속성과 일치하며, 결함이
      **stale-lock 탈취 경로에 한정**됨을 대조로 확인했다.
    - **기존에 알려진/조치된 것과의 구분이 중요하다.** 이 코드 인근에는 이미 두 개의 별도
      TOCTOU 가 검토된 이력이 있으나 **둘 다 이번 것과 다르다**:
      1. `review/code/2026/07/17/20_06_45/testing.md`가 지적하고 "30 라운드 × 20 동시 프로세스
         (600회) 스트레스로 재현 못 함"이라 결론 낸 TOCTOU는 **바깥 `[ ! -f "$marker" ]` 게이트**
         (사전 lock 없이, 살아있는 정상 완주 설치와 레이스)에 관한 것이었다 — 최악 영향도
         "중복 재설치 1회"(순차적, 안전)로 정확히 평가됐다. 이 시나리오는 lock 이 처음부터
         없으므로 `_lock_is_dead`가 `[ -d "$lock" ] || return 1`에서 즉시 반환해 포크가 전혀
         일어나지 않는다 — **stale lock 을 사전에 심지 않았으므로 이번 CRITICAL 이 겨냥하는
         경로 자체를 실행한 적이 없다.**
      2. `review/code/2026/07/18/00_59_56/concurrency.md`는 바로 이 줄(`_lock_is_dead && rm -rf`)
         을 "직전 라운드에서 이미 발견·평가·수용된 이론적 TOCTOU"로 재확인 처리했는데, 그
         근거로 인용한 것이 위 ①(바깥 마커 게이트) 스트레스 테스트였다 — **서로 다른 두 코드
         경로를 같은 결론으로 묶은 것으로 보인다.** 이번 라운드의 `testing.md`도 "죽은 owner
         PID 락 1개 + 동시 접근 N 프로세스" 조합(정확히 이번 CRITICAL 의 재현 조건)이
         `test_concurrent_sessions_install_at_most_once`(락 없음)·`test_dead_pid_lock_is_stolen`
         (단일 프로세스)의 "빈 교집합"이라고 **테스트 갭으로는 정확히 짚었으나**, 00_59_56
         라운드의 I13 이 이를 "조치 불요"로 낮게 매겼던 판단을 재확인만 했다 — 이번 실측은 그
         갭이 단순 "커버리지 부족"이 아니라 **실제로 깨지는 속성**이었음을 보여준다.
    - 영향 범위: `main_root/.claude/tools/mermaid-lint`는 설계상 모든 워크트리가 공유하는
      **단일** 트리이므로(node_modules gitignored), 이 손상은 그 세션 하나가 아니라 **현재
      열려 있는 모든 워크트리 세션의 mermaid lint 가용성**에 영향을 준다. 트리거 조건은
      "이전 세션의 크래시로 죽은 락이 남아 있는 상태에서 다수(실측상 대략 10개 이상) 세션이
      동시에 SessionStart"인데, 이 저장소 자신의 헤더 주석이 "여러 worktree 세션이 동시에
      cold checkout 에서 이 지점에 도달하는 것이 정석 워크플로"라고 명시하므로 전제 자체가
      비현실적이지 않다.
  - 제안:
    1. 회귀 테스트 추가 — `test_dead_pid_lock_is_stolen`(단일 프로세스)과
       `test_concurrent_sessions_install_at_most_once`(락 없는 콜드스타트)의 교집합, 즉 **죽은
       lock 을 미리 심고 N(≥15) 동시 프로세스로 기동해 `_npm_calls() == 1`을 단언**하는 테스트를
       추가할 것. 이번 라운드 `testing.md`의 I13 지적과 동일한 축이지만 이제는 "낮은 우선순위
       커버리지 갭"이 아니라 "실패하는 테스트를 추가해 회귀를 막는" 문제로 격상해야 한다.
    2. 근본 수정 — check(`_lock_is_dead`)와 act(`rm -rf`) 사이에 재검증 지점을 넣을 것. 예:
       owner 파일에 PID 뿐 아니라 1회성 난수/타임스탬프 nonce 도 함께 기록하고, `rm -rf` 직전에
       그 nonce 를 다시 읽어 애초에 관찰했던 값과 동일할 때만 삭제(다르면 그사이 누군가 이미
       재획득한 것이므로 손대지 않고 스킵)하거나, `rm -rf` 대신 `mv "$lock" "$lock.reclaim.$$"`로
       탈취 자체를 원자화해 오직 rename 에 성공한 프로세스만 그 사본을 지우게 할 것(잔여 창이
       완전히 사라지진 않지만 다중 fork 평가 구간 전체에서 단일 syscall 구간으로 좁아진다).
    3. 최소한 지금 당장 고치지 않는다면, 125-127행의 "cannot clobber a live holder" 주장을
       실측으로 반증됐다는 사실과 함께 W2/W12 와 같은 급의 "Known limitation"으로 명시하고
       `plan/in-progress/harness-guard-followups.md` §A 에도 추가할 것 — 현재는 코드 주석과
       plan 문서 어디에도 이 경로가 실제로 깨진다는 사실이 반영돼 있지 않다.

- **[INFO]** 신규 FS 아티팩트(lock 디렉터리·fail marker)는 `.gitignore`가 정확히 커버 — 저장소
  오염 위험 없음(확인됨)
  - 위치: `.gitignore:9`(`.claude/tools/mermaid-lint/.install.lock/`), `:23`(`.claude/state/`),
    `:5`(`node_modules/`, 완료 마커가 그 안에 위치)
  - 상세: 이번 diff 가 새로 만드는 세 가지 FS 아티팩트 — `.install.lock/`(+`owner` 파일),
    `.claude/state/mermaid_install_last_fail`, `node_modules/.bootstrap-install-complete` — 가
    모두 이미 gitignore 규칙에 정확히 포함돼 있음을 직접 대조 확인했다. `git status`로 실수로
    스테이징될 경로가 없다.
  - 제안: 없음 — 참고용 긍정 기록.

- **[INFO]** 마커 도입이 기존(사전 설치된) 체크아웃에 대해 일시적 "무신호 fail-open" 구간을
  만든다 — 의도된 트레이드오프이나 명시적으로 인지할 가치가 있음
  - 위치: `.claude/tools/bootstrap-session.sh:123`(`[ ! -f "$marker" ]`),
    `.claude/hooks/_lib/mermaid_lint_ready.py:is_ready`(node_modules 존재만으론 불충분, 마커
    필수), `.githooks/pre-commit`·`lint_mermaid_posttooluse.py`(둘 다 이 판정을 그대로 소비)
  - 상세: 이 PR 이 머지된 직후, 마커 개념이 없던 시절에 이미 정상적으로 설치를 마친 기존
    워크트리는 (node_modules 는 있지만 마커가 없으므로) `is_ready()`가 거짓을 반환한다. 그
    체크아웃에서 다음 bootstrap 이 재설치를 완료하기 전까지는 pre-commit·PostToolUse 양쪽 모두
    "설치 안 됨"으로 판단해 mermaid lint 를 **조용히 건너뛴다**(기존 설계 철학인 fail-open과
    일치하지만, "한 번은 재설치된다"고 주석에 명시된 대로 이 갭은 일시적이다). 버그는 아니고
    이미 주석(`bootstrap-session.sh` "(One-off: a good install from before the marker existed
    reinstalls once.)")에서 인지된 트레이드오프이지만, "린트가 잠깐 전면 무력화된다"는 실제
    동작을 명시적으로 짚어 둔다.
  - 제안: 없음(현행 트레이드오프 수용 권장). 롤아웃 공지가 필요하면 PR 설명에 "머지 후 첫
    SessionStart 는 재설치 1회"를 언급하는 정도로 충분.

- **[INFO]** `sys.path` 전역 변경 — 프로세스-로컬 스코프로 위험 없음
  - 위치: `.claude/hooks/lint_mermaid_posttooluse.py:265`
    (`sys.path.insert(0, os.path.join(..., "_lib"))`)
  - 상세: 체크리스트 항목 "전역 변수"에 해당하는 유일한 변경. `sys.path`는 프로세스 전역
    리스트를 앞쪽에서 변경하지만, 이 훅은 harness 가 매 호출마다 새로 띄우는 **일회성
    서브프로세스**이므로 변경이 그 프로세스 종료와 함께 소멸한다 — 다른 훅·세션으로 누수되지
    않는다. `_lib` 아래에 동일 이름의 다른 모듈이 없어 예기치 않은 셰도잉도 없음을 확인했다.
  - 제안: 없음.

- **[INFO]** 새 환경변수 표면은 additive·기본값 안전 — 쓰기 없음, 읽기만
  - 위치: `.claude/tools/bootstrap-session.sh:16-17`(`MERMAID_INSTALL_LOCK_GRACE_SEC`,
    `MERMAID_INSTALL_RETRY_SEC`)
  - 상세: 둘 다 `${VAR:-default}` 형태로만 읽히고(`export` 없음, 하위 프로세스로 전파되지
    않음), 미설정 시 기존 동작과 동치인 기본값(600s, 1800s)을 갖는다. 기존 `MERMAID_LINT_TOOL_DIR`
    오버라이드 패턴과 동일한 컨벤션. 새 쓰기·새 전역 노출 없음.
  - 제안: 없음.

- **[INFO]** 구버전 스크립트와의 과도기 교차 경합 — 이번 PR 이 만드는 문제는 아니나 배포 시점에
  한시적으로 존재
  - 위치: `.claude/tools/bootstrap-session.sh`(버전 관리 파일 자체)
  - 상세: 이 파일은 각 워크트리가 자신의 브랜치 체크아웃을 통해 실행한다. 이 PR 머지 직후 아직
    구버전(락/마커 개념이 없는, 단순 `[ ! -d node_modules ]` 체크)을 체크아웃 중인 워크트리와
    신버전을 체크아웃한 워크트리가 **동시에** SessionStart 하면, 신버전 세션이 `mkdir "$lock"`
    직전(아직 `node_modules` 디렉터리 자체가 없는 순간)에 구버전 세션의 `[ ! -d node_modules ]`
    체크가 끼어들어 구버전도 설치를 시도할 수 있다 — 락 메커니즘 자체를 모르는 구버전은 이를
    감지·회피할 방법이 없다. 이는 이 파일을 포함한 어떤 버전 관리된 락 매커니즘 도입에도 내재된
    일회성 롤아웃 리스크이며 이번 diff 의 설계 결함이 아니다.
  - 제안: 없음(구조적으로 이번 PR 범위에서 닫을 수 없음). 참고 기록 목적.

## 요약

이번 diff 는 신규 외부 인터페이스·시그니처 파괴적 변경·의도치 않은 네트워크/환경변수 부작용 없이
mermaid-lint 설치의 동시성 가드를 강화하며, 신규 FS 아티팩트는 `.gitignore`가 정확히 커버함을
직접 확인했다. 그러나 실측 검증 결과 **stale-lock 탈취 판정(`_lock_is_dead`)과 그 삭제
행위(`rm -rf`) 사이의 check-then-act 가 프로세스 간에 원자적이지 않아, "죽은 owner PID 락 1개 +
동시 접근 N(≥10) 프로세스" 조건에서 이 PR 이 없애려던 바로 그 결함(동일 `node_modules` 트리에
`npm install` 동시 실행)이 다른 경로로 재현됨을 확인**했다(N=10~30 반복 실행에서 매번 재현,
사전 lock 없는 콜드스타트 대조군은 매번 정확히 1회). 이 경로는 두 차례의 이전 리뷰 라운드에서
검토된 바 있지만, 그때 "600회 스트레스로도 재현 못 함"이라 결론 낸 대상은 **사전 lock 없이
바깥 마커 게이트만 경합하는 다른 코드 경로**였고 이번에 발견한 경로(사전에 죽은 lock 이 실제로
존재하는 상태에서의 탈취 레이스)는 그 스트레스 테스트가 애초에 실행조차 하지 않았던 분기다 —
이번 라운드의 `testing.md`가 정확히 이 조합을 "테스트 공백"으로 짚었지만 그 공백이 실제로는
"통과하는 채로 남겨진 결함"이었다는 점은 이번 실측으로 처음 확인됐다. 코드 주석(125-127행)의
"이 삭제는 살아있는 홀더를 지울 수 없다"는 명시적 안전성 서술은 이 실측으로 반증된다. 그 밖의
발견(마커 도입 과도기의 일시적 fail-open, `sys.path` 프로세스-로컬 변경, 신규 env 표면, 구버전
교차 경합)은 모두 INFO 수준으로 이미 인지되었거나 설계 목표와 정합한다.

## 위험도

HIGH
