# 유지보수성(Maintainability) 코드 리뷰

대상: `.claude/tools/bootstrap-session.sh` · `.claude/hooks/lint_mermaid_posttooluse.py` ·
`.claude/hooks/_lib/mermaid_lint_ready.py` · `.githooks/pre-commit` ·
`.github/workflows/harness-checks.yml` · `.claude/tests/test_bootstrap_mermaid_install.py` ·
`.claude/tests/test_mermaid_lint_ready.py`

리뷰 범위 확인: 직전 라운드(`review/code/2026/07/18/00_59_56`)가 `bbf72268e`+`d31f99a11`까지
검토했고, 이번 세션의 실질 diff는 그 이후 3개 fix 커밋 — `441820b89`(락 grace 초단위 통일 +
동시성 테스트), `e8a056fec`(mermaid 소비처 fail-open 정렬 + 실행 기반 회귀 테스트),
`8308515c4`(CI paths 추가) — 이다. `.githooks/pre-commit`과 `.claude/hooks/_lib/mermaid_lint_ready.py`는
이번 3개 커밋에서 변경되지 않았고(마지막 변경은 이미 리뷰된 `d31f99a11`), 아래는 그 둘을
제외한 나머지 파일들의 신규 diff에 집중한다.

## 발견사항

- **[WARNING]** 신규 실행-기반 테스트 두 클래스가 같은 파일·같은 커밋 안에서 헬퍼 메서드를 바이트 단위로 중복 정의
  - 위치: `.claude/tests/test_mermaid_lint_ready.py:164-168`(`PostToolUseExecutionTest._node_calls`)
    vs `:261-265`(`PreCommitExecutionTest._node_calls`, 완전 동일); `_run`의 도입부
    `:170-179` vs `:267-276`(ready_state 처리 + env 4개 세팅 블록도 동일, 이후 서브프로세스
    호출 방식만 갈라짐). 둘 다 이번 라운드 커밋 `e8a056fec`(WARNING #8 수정)에서 신설됨.
  - 상세: "call-log 파일에서 공백 아닌 줄 수를 센다"는 `_node_calls`는 두 클래스에 완전히
    똑같은 4줄짜리 몸체로 두 번 등장한다 — 같은 파일, 같은 커밋에서 나란히 추가됐으므로
    cross-file 관례 차이 같은 변명의 여지가 없는 가장 직접적인 사례다. 여기에 더해
    `PreCommitExecutionTest._git`(`:252-254`)/`_write`(`:256-259`)는 이미 존재하는
    `test_bootstrap_mermaid_install.py:90-97`의 동일한 헬퍼를 그대로 재작성한 것이다(다만
    이 저장소는 `test_reap_merged_worktrees.py`·`test_review_guard_hardening.py`·
    `test_consistency_impl_done.py` 등 이미 5개 테스트 파일이 각자 `_git`/`_write`를
    재정의하는 기존 관례가 있어, 이 cross-file 부분은 완전히 새로 도입한 패턴은 아니다).
    "call-log 파일의 공백 아닌 줄 수 세기" 개념까지 넓히면 `test_bootstrap_mermaid_install.py:126-129`의
    `_npm_calls`와 합쳐 스위트 전체에 사실상 동일한 로직이 3벌 존재한다. 두 파일 모두
    이미 `import _harness`로 공유 모듈을 쓰고 있어 통합 지점은 이미 있다.
  - 제안: 최소한 같은 파일 안의 `_node_calls`(+ `_run` 공통 도입부)는 모듈 레벨 함수나 두
    클래스가 상속하는 믹스인으로 추출. `_harness.py`에 `count_log_lines(path)` 같은 유틸을
    추가해 `_node_calls`/`_npm_calls`를 대체하는 것도 고려할 만하다. 테스트 전용 코드라
    동작 영향은 없어 급하지 않음.

- **[INFO]** `_lock_is_dead`가 수정 후에도 `_install_throttled`와 "mtime 이후 경과초" 계산을
  별도 인라인 식으로 반복
  - 위치: `.claude/tools/bootstrap-session.sh:84`(`_install_throttled`) 대 `:115`
    (`_lock_is_dead`, 이번 라운드 수정분)
  - 상세: 이번 라운드의 수정 방향 자체는 정확하다 — 이전엔 `_lock_is_dead`만 `find -mmin`
    분단위 변환을 써서 60의 배수가 아닌 grace 값에서 절삭 버그가 났고(00_59_56 W1), 지금은
    두 함수가 `$(( $(date +%s) - $(_file_mtime "$X") ))` 형태로 완전히 같은 산술을 쓰도록
    통일됐다. 다만 그 산술 자체는 여전히 두 곳에 나란히 복붙돼 있고 공유 헬퍼로 뽑히지는
    않았다 — `_file_mtime`은 이미 포터빌리티 헬퍼로 추출돼 있으니, "mtime 이후 경과초"까지
    `_age_seconds() { echo $(( $(date +%s) - $(_file_mtime "$1") )); }` 정도로 한 단계 더
    추출하면 두 곳이 진짜 한 곳이 된다.
  - 제안: (선택) `_age_seconds` 헬퍼 추출. 버그 자체는 이미 해소됐고 두 식이 이제 구조적으로
    동일해 향후 drift 위험은 낮음 — 급하지 않음.

- **[INFO]** section 2(mermaid 설치 시퀀스)가 여전히 top-level 인라인 블록 — 이미 별건
  백로그로 추적 중, 이번 라운드가 그 블록에 주석만 더 얹음
  - 위치: `.claude/tools/bootstrap-session.sh:123-154`
  - 상세: 직전 리뷰(00_59_56)가 이미 "함수로 안 뽑힌 유일한 section"으로 지적했고(당시
    INFO), 이후 `plan/in-progress/harness-guard-followups.md`에 별건 아키텍처 개선(W6,
    "결함 아닌 개선 여지"로 명시, 미조치)으로 등록되었다. 이번 라운드가 새로 추가한 두
    "Known limitation" 주석 블록(W2/`:132-140`, W12/`:98-107`, 각 8~10줄)이 이 블록/그
    직전 함수에 더해지면서 인라인 블록 주변의 주석 비중이 한층 커졌다 — 결함은 아니지만
    이미 트래킹 중인 함수 추출의 필요성을 강화하는 방향이다.
  - 제안: 조치 불요(이미 트래킹됨, W6/별건 G). 다음에 이 섹션을 만질 일이 생기면 함수 추출
    고려.

- **[INFO]** `lint_mermaid_posttooluse.py`의 `sys.path.insert` 인라인 계산이 형제 훅들의
  `THIS_DIR` 명명 관례를 여전히 따르지 않음 — 직전 리뷰가 이미 지적, 조치 불요로 남김
  - 위치: `.claude/hooks/lint_mermaid_posttooluse.py:39` 대
    `.claude/hooks/guard_review_before_push.py:34-35`(동일 패턴이 `guard_default_branch_edit.py`에도)
  - 상세: `guard_review_before_push.py`/`guard_default_branch_edit.py`는
    `THIS_DIR = os.path.dirname(os.path.abspath(__file__))`를 상수로 선언한 뒤
    `sys.path.insert(0, os.path.join(THIS_DIR, "_lib"))`로 재사용하는데, 이 파일은 같은
    계산을 한 줄에 인라인한다(`sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "_lib"))`).
    이번 라운드(`e8a056fec`)가 바로 아래(신규 try/except fail-open 블록)를 손봤음에도 이
    줄 자체는 그대로 남았다. 동작 차이는 없다.
  - 제안: 조치 불요(이미 알려짐, 순수 스타일). 이 근방을 다시 만질 기회에 `THIS_DIR` 상수로
    정리하는 정도.

- **[INFO]** `.github/workflows/harness-checks.yml`의 `paths:` 리스트가 리뷰 라운드마다
  개별 배경 주석을 계속 누적
  - 위치: `.github/workflows/harness-checks.yml:15-18`(이번에 추가된 `.githooks/**` 항목)
  - 상세: 각 항목이 "왜 필요한지"를 과거 리뷰(예: 00_59_56 W3)를 인용해 설명하는 것은
    실수로 삭제되는 것을 막는 좋은 관행이지만, 리스트가 라운드마다 한 줄씩 늘어나는
    패턴이라 항목 수 대비 가독성이 점차 낮아질 여지가 있다. 현재 12개 항목 중 다수가
    멀티라인 주석을 달고 있으나 아직은 무리 없는 수준.
  - 제안: 조치 불요. 항목이 계속 늘면 상단에 "이 리스트의 각 항목이 왜 개별 주석을 갖는지"
    요약을 한 줄 강화하는 정도로 충분.

## 요약

이번 세션의 실질 diff(`441820b89`+`e8a056fec`+`8308515c4`)는 직전 `/ai-review`(00_59_56)가
지적한 Warning 들을 정확하고 꼼꼼하게 반영했다 — 특히 `_lock_is_dead`의 분단위 truncation
버그(W1)를 기존 `_file_mtime` 포터빌리티 헬퍼와 같은 초단위 산술로 통일한 수정, 동시성
테스트를 `assertLessEqual`에서 `assertEqual`로 강화해 "전원 skip"도 통과시키던 구멍을
막은 수정(W9), `lint_mermaid_posttooluse.py`의 import를 형제 훅과 동일한 명시적 fail-open
관례로 정렬한 수정(W7)이 모두 근거가 분명하고 실제로 정확한 위치를 고쳤다. 유일하게 새로
발견된 실질적 지점은 이번 라운드가 신설한 `test_mermaid_lint_ready.py`의 두 실행-기반 테스트
클래스(`PostToolUseExecutionTest`/`PreCommitExecutionTest`)가 같은 파일·같은 커밋 안에서
`_node_calls` 헬퍼를 바이트 단위로 복붙한 것 — 사소하지만 변명의 여지가 가장 적은 형태의
중복이며, 두 파일이 이미 공유하는 `_harness` 모듈로 손쉽게 추출 가능하다. 나머지는 모두
이미 이전 라운드에서 지적되고 "조치 불요"로 의식적으로 남겨진 스타일 항목(THIS_DIR 관례,
bootstrap 함수 추출 — 별건 백로그 등록됨)이거나 diff 규모 대비 사소한 관찰(CI paths 리스트
누적)이다. 가독성·네이밍·중첩 깊이·순환 복잡도는 전 파일에 걸쳐 양호하고(가드절 스타일의
early-return, 3단 이내 중첩), 매직 넘버는 대부분 이름 붙거나 env override가 가능한 형태로
관리된다. 병합을 막을 사유는 없다.

## 위험도

LOW
