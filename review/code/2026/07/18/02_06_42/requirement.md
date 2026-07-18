# Requirement Review — bootstrap mermaid-lint install guard (item A)

## 컨텍스트

리뷰 대상 7개 파일은 `plan/in-progress/harness-guard-followups.md` §A(bootstrap `npm install` 경쟁 +
부분 설치 영속 수정)의 최종 상태다. `git log`/`review/code/2026/07/18/00_59_56/` 대조 결과, 이 7개
파일은 직전 리뷰 라운드(00_59_56, 14-reviewer 전수)가 찾은 W1·W3·W7·W8·W9·W10·W11·W13 을 이미
코드/테스트로 수정하고 W2·W12 를 "알려진 한계"로 문서화한 **이후의 상태**이며, HEAD 까지의 나머지
커밋은 CI `paths` 보강(`8308515c4`, W3)과 plan 전용 문서 커밋(`7459ec16a`, W6 를 별건 G 로 등록)뿐이다
— 즉 이번 라운드는 "수정 후 fresh 재검증" 성격이다. 아래는 그 전제 위에서 수행한 **독립** 요구사항
충족 검토다(이미 알려진 항목은 재확인만 하고 새로 escalate 하지 않았다).

## 검증한 사항 (요약, 발견사항 아님)

- W1(grace truncation)·W7(fail-open import 정렬)·W8(실행 기반 회귀 테스트)·W9(`assertEqual(1)`)·
  W10(`rmdir's`→실제 명령 정정)·W11(docstring 축 반영)·W12(known-limitation 주석)·W13(mock 기반
  실제 검증) 수정이 코드에 실제로 반영되어 있고 서로 정합함을 라인 단위로 확인.
- `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 직접 실행 — **310/310 통과**.
- `TODO|FIXME|HACK|XXX` grep — 7개 파일 전체 0건.
- `bootstrap-session.sh`·`.githooks/pre-commit`·`lint_mermaid_posttooluse.py` 3개 소비처 모두
  익셉션/실패 경로에서 명시적 값(0/1/2 exit 또는 bool)을 반환하며 암묵적 falls-through 없음.
- `plan/in-progress/harness-guard-followups.md` 체크리스트(`[x] A`, 나머지 `[ ]`)가 실제 diff 상태와
  일치.

## 발견사항

- **[WARNING]** `_lock_is_dead()` 가 `$MERMAID_INSTALL_LOCK_GRACE_SEC` 을 비수치 입력에 대해
  무방비로 산술 비교해, 같은 파일의 자매 함수 `_install_throttled()` 가 `$MERMAID_INSTALL_RETRY_SEC`
  에 대해 갖춘 방어와 비대칭이다.
  - 위치: `.claude/tools/bootstrap-session.sh` — `_lock_is_dead()` (`[ $(( $(date +%s) - $(_file_mtime "$lock") )) -ge "$lock_grace" ] || return 1`) 대 `_install_throttled()` (`[ "$retry_after" -gt 0 ] 2>/dev/null || return 1`, 이후 산술 비교는 이미 검증된 값에만 수행).
  - 상세: 직접 재현 확인 — `lock_grace`가 비수치(예: 빈 문자열/가비지)일 때 `[ ... -ge "$lock_grace" ]`
    가 `bash: [: <값>: integer expression expected`(exit 2)를 **stderr 로 그대로 흘려보내고**(SessionStart
    실행 시 사용자에게 노출), `|| return 1` 로 인해 "죽지 않음(steal 안 함)"으로 안전하게 수렴하긴
    하지만, 이는 우연한 안전 방향일 뿐 의도적 가드가 아니다. 반면 `_install_throttled` 는 정확히 같은
    클래스의 문제를 `2>/dev/null` 로 명시적으로 방어한다 — 같은 파일 안에서 구조적으로 대칭인 두
    "초 단위 설정값" 이 한쪽만 가드됐다. 결과적으로 `MERMAID_INSTALL_LOCK_GRACE_SEC` 오설정 시
    (오탈자·CI 스크립트 오류 등) 진짜 죽은 락도 영원히 stale 로 인지되지 못하는(=이 PR 전체가 없애려는
    "무신호 영구 비활성화" 와 같은 계열의) 좁은 경로가 생긴다. 00_59_56 SUMMARY 의 I14("lock_grace=0/비-60배수... 행동 차이 없음 확인")는 유효한 수치 경계값만 다뤘고, 이 "비수치 입력" 케이스는
    다루지 않아 신규 관찰이다.
  - 제안: `_lock_is_dead()` 진입부에 `[ "$lock_grace" -ge 0 ] 2>/dev/null || return 1`(또는 동일 효과의
    사전 검증)을 추가해 `_install_throttled` 와 같은 방어 패턴으로 정렬.

- **[INFO]** 락 탈취(steal) 경로의 이론적 동시-탈취자 TOCTOU — 신규 아님, 이미 추적/평가된 리스크.
  - 위치: `.claude/tools/bootstrap-session.sh:150-155` (`_lock_is_dead && rm -rf "$lock" ...` 다음
    `mkdir "$lock"`).
  - 상세: 두 세션이 동일한 "죽은" 락을 동시에 관찰하면, 한쪽이 stale 락을 steal(`rm -rf`+`mkdir`)한
    직후 다른 쪽이 (자신이 이전에 평가한 "죽었다"는 판정에 따라) 새로 생성된 락을 다시 `rm -rf` 로
    지우고 자신의 `mkdir` 을 성공시켜, 두 세션이 모두 락을 쥐었다고 믿고 `npm install` 을 동시 실행할
    이론적 여지가 있다 — `_lock_is_dead` 판정과 `rm -rf`+`mkdir` 실행 사이의 check-then-act 비원자성.
    이는 **신규 발견이 아니다**: `review/code/2026/07/17/20_06_45`(WARNING #7, "600회 스트레스로도
    재현 못 함" 근거로 미조치) → `review/code/2026/07/18/00_59_56`(I10, "이번 커밋도 형태 불변"으로
    재확인 후 동일 결정 유지)으로 이미 두 라운드에 걸쳐 평가·수용됐다. 실패 방향도 안전(설치 skip 만
    되는 게 아니라 오히려 "두 설치가 동시 진입"이므로 자매 W12 보다 이론적으로는 더 무겁지만, 동일하게
    "크래시 후 근접-동시 재시작"이라는 이중 조건이 필요해 확률은 낮음). 코드 자체·테스트 스위트에
    변경이 없어 기존 결정을 뒤집을 새 근거는 없음 — 참고용으로만 재기재.
  - 제안: 조치 불요(기존 결정 유지). 재조치가 필요해지면 `plan/in-progress/harness-guard-followups.md`
    §A 알려진 한계 목록에 W12 옆에 병기 권장.

- **[INFO]** 관련 spec 본문 없음 — 정상.
  - 위치: 7개 파일 전체(`.claude/tools/bootstrap-session.sh` 등).
  - 상세: `.claude/`는 CLAUDE.md 의 정보 저장 위치 표상 `spec/` 대상(제품 정의·기술 명세)이 아니라
    하네스/자동화 인프라이므로 관련 spec 문서가 없는 것이 정상(00_59_56 SUMMARY I6 와 동일 결론).
    가장 가까운 대응 문서는 `.claude/docs/worktree-policy.md §7`(GC reaper·세션 앵커)인데, 이는 이번
    diff 범위 밖(PR #970, 섹션 4 "Reap worktrees")의 기존 코드이고, 대조 결과 문서 서술("앵커는
    BASH_SOURCE 로 유도한다")과 `bootstrap-session.sh:205-210` 의 실제 구현이 정확히 일치함을 확인—
    drift 없음.
  - 제안: 조치 불요.

- **[INFO]** `.githooks/pre-commit` 상단 "Both guards delegate to shared logic..." 주석이 이번 diff
  로 신설된 세 번째 공유 SoT(`mermaid_lint_ready.py`, readiness 판정)를 나열하지 않는다.
  - 위치: `.githooks/pre-commit:475-478`(파일 상단 요약) 대 `:514-519`(guard 2 인라인 주석).
  - 상세: 파일 최상단 요약은 "branch policy in branch_guard.py, mermaid parsing in
    lint-mermaid.mjs" 두 개만 shared SoT 로 언급한다. 반면 guard 2 바로 위 인라인 주석은
    `mermaid_lint_ready.py` 를 readiness 의 SoT 로 정확히 설명한다 — 실제 동작은 맞고 인라인 설명도
    맞지만, 새 기여자가 맨 위 요약만 훑을 경우 이번 diff 가 추가한 세 번째 공유 모듈의 존재를 놓칠 수
    있다.
  - 제안: 최상단 요약에 "readiness in `.claude/hooks/_lib/mermaid_lint_ready.py`" 한 구절 추가.

- **[INFO]** `.claude/tests/README.md`(diff 밖)의 `test_mermaid_lint_ready.py` 카탈로그 설명이 이번
  라운드(W8)로 신설된 실행-기반 회귀 테스트 클래스(`PostToolUseExecutionTest`, `PreCommitExecutionTest`)
  를 언급하지 않는다.
  - 위치: `.claude/tests/README.md`(리뷰 대상 7파일에는 없음) 대 `.claude/tests/test_mermaid_lint_ready.py:1103-1173`.
  - 상세: README 카탈로그 한 줄 요약은 `IsReadyTest`/`ConsumerBindingTest`(소스-텍스트 검사)만 서술하고,
    실제 서브프로세스로 동작을 재현하는 두 신규 실행-기반 테스트 클래스는 언급이 없다. 리뷰 대상
    파일셋 밖이라 이번 diff 의 결함은 아니며 차단 사유 아님.
  - 제안: 후속 편집 시 README 엔트리에 한 문장 추가(우선순위 낮음).

## 요약

리뷰 대상 7개 파일은 `harness-guard-followups.md` §A 가 명시한 목표(bootstrap npm install 경쟁·부분
설치 영속·판정 SoT 분산)를 완전하게 구현하고 있으며, 직전 00_59_56 라운드가 지적한 13개
Critical/Warning(W1~W13) 은 코드·테스트·주석 라인 단위로 정확히 반영되어 durable 함을 재확인했다.
310/310 유닛테스트 통과, TODO/FIXME 류 잔존 0건, 모든 함수가 전 경로에서 명시적 값을 반환함을
확인했다. 이번 라운드에서 새로 발견한 것은 `_lock_is_dead()` 가 `MERMAID_INSTALL_LOCK_GRACE_SEC`
비수치 입력을 자매 함수 `_install_throttled()` 와 달리 가드하지 않는 좁은 비대칭 1건(WARNING)뿐이며,
나머지는 이미 두 차례 리뷰(20_06_45→00_59_56)를 거쳐 평가·수용된 이론적 TOCTOU 재확인과 diff 범위
밖 문서 완결성 관찰(INFO) 이다. 관련 `spec/` 문서는 이 영역의 성격상 존재하지 않는 것이 정상이며,
유일하게 존재하는 인접 spec-급 문서(`worktree-policy.md §7`)는 이번 diff 밖 코드와 정확히 일치한다.
차단 사유 없음.

## 위험도

LOW
