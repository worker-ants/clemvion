# 부작용(Side Effect) 리뷰 — push guard allowlist (fixed round, `guard_review_before_push.py` + `test_push_guard_allowlist.py`)

이 라운드는 직전 리뷰(`review/code/2026/07/23/14_23_23`)가 찾은 CRITICAL 3건(C1 홑따옴표 이스케이프
오판정 게이트 우회, C2 `_MESSAGE_ARG` catastrophic backtracking, C3 메시지 blanking 이 살아있는
`$(git push …)` 를 드러냄)을 수정한 이후의 diff 를 검토한다. 실제로 `.claude/tests -m unittest
test_push_guard_allowlist` 25건 전부 통과함을 재현 확인했고, C1/C2/C3 각각의 회귀 테스트
(`ReleaseRefusedTest.test_single_quoted_trailing_backslash_does_not_swallow_a_real_push`,
`BacktrackingTest`, `ReleaseRefusedTest.test_message_blanking_does_not_unmask_a_live_expansion`)가
현재 코드에서 정상 통과함을 확인했다.

## 발견사항

- **[WARNING]** 신규 함수 `_owns_heredoc_as_message`/`_COMMIT_STDIN_CMD` 에 회귀 미검증 상태의
  **다항식(O(n²)) catastrophic backtracking** — 이번 diff 가 새로 도입한 두 번째 hang 표면
  - 위치: `.claude/hooks/guard_review_before_push.py` `_COMMIT_STDIN_CMD` 정의(신규) 및
    `_owns_heredoc_as_message()` → `_blank_commit_heredocs()` → `_redact_inert_text()` →
    `_is_git_push()` 경로
  - 상세: `_COMMIT_STDIN_CMD` 는 `git\b[^\n]*\b(?:commit|tag)\b[^\n]*(?<![\w-])(?:-F|--file=?)\s*-…`
    형태로 **두 개의 `[^\n]*` 그리디 구간**을 갖는다. 세그먼트에 `commit`/`tag` 라는 단어가
    **여러 번** 등장하고 끝내 `-F -`/`--file` 를 찾지 못해 전체 매칭이 실패하면, 첫 번째 `[^\n]*`
    가 매 `\bcommit\b` 발생 위치로 하나씩 되돌아가며 그때마다 두 번째 `[^\n]*` 가 나머지 구간을
    다시 훑는다 — 반복(commit/tag) 개수에 비례해 매 시도 비용도 함께 커져 **O(n²)**.
    직접 실측(같은 워크트리, `guard._is_git_push()` 전체 경로 호출,
    `git commit -m "<commit 반복> done" <<'EOF'\nbody\nEOF\n&& git push` 형태):
    - `commit ` × 2,000 (커맨드 14KB) → **0.18초**
    - `commit ` × 4,000 (28KB) → **0.68초**
    - `commit ` × 8,000 (56KB) → **2.80초**
    - `commit ` × 12,000 (84KB) → **6.19초**
    (2배 입력마다 ~4배 시간 — 전형적 O(n²) 곡선. 대조군: `commit`/`tag` 를 포함하지 않는 동일
    길이의 일반 텍스트(`"x"×80000`)는 **0.017초** — 반복 배정 자체가 아니라 **"commit"/"tag" 단어
    반복**이 트리거임을 확인.) 12,000 반복 기준 추세를 외삽하면 5~10만 자 분량(장문 커밋
    메시지·changelog 등에서 드물지 않은 크기)에서 수십 초~수 분대 hang 이 예상된다.
    이 훅은 PreToolUse 로 **모든 Bash 호출을 동기 게이팅**하므로, 트리거되면 그 tool call(나아가
    세션)이 정지한다 — 바로 이 라운드의 CRITICAL #2(`_MESSAGE_ARG` ReDoS)와 **같은 피해 범주**다.
    다만 지수(2ⁿ)가 아닌 다항(n²)이고, 트리거 조건이 "임의의 홀수 개 트레일링 백슬래시"였던 C2보다
    좁다(세그먼트가 `git`로 시작 + `commit`/`tag` 단어가 다회 등장 + 끝내 `-F`/`--file` 없음 +
    같은 명령 뒤쪽에 heredoc 마커와 실제 `push` 존재) — 그래서 CRITICAL 이 아닌 WARNING 으로 판단.
    다만 커밋 메시지에 "commit"이라는 단어 자체가 여러 번 나오는 것은(예: "fix: commit hook 관련
    commit 서명·commit 메시지 린팅 개선" 류) 부자연스러운 입력이 아니다.
    `BacktrackingTest`(이번 diff 가 C2 재발 방지로 추가한 유일한 성능 회귀 테스트)는
    `_MESSAGE_ARG` 만 겨냥하며 `_COMMIT_STDIN_CMD`/heredoc-owner 판정 경로는 다루지 않는다 —
    이 표면은 회귀 테스트로 전혀 pin 되어 있지 않다.
  - 제안: `_COMMIT_STDIN_CMD` 의 두 `[^\n]*` 구간이 겹치는 실패 지점을 만들지 않도록 재작성한다
    (예: `\bcommit\b`/`\btag\b` 이후 구간을 `[^\n]*?`(lazy)로 바꾸거나, "마지막 `-F`/`--file` 위치를
    찾은 뒤 그 앞에 commit/tag 존재를 확인"하는 2단계 비-역추적 절차로 치환). 수정 후
    `BacktrackingTest` 에 "닫는 `-F -` 없이 `commit`/`tag` 단어가 대량 반복되는 세그먼트" 케이스를
    추가해 시간 상한을 회귀 고정할 것.

- **[INFO]** 나머지 판정 로직은 전역 상태·파일시스템·환경변수·네트워크·이벤트 콜백 관점에서 깨끗함
  - 위치: `.claude/hooks/guard_review_before_push.py` 전체(`_is_git_push`, `_redact_inert_text`,
    `_blank`, `_blank_commit_heredocs`, `_owns_heredoc_as_message`, `_is_inert`)
  - 상세: 모든 신규 함수는 문자열 입력 → 문자열/불리언 출력의 순수 연산이다. `_blank` 는 슬라이싱으로
    새 문자열을 만들 뿐 인자를 in-place mutate 하지 않는다(파이썬 str 자체가 불변이라 애초에
    불가능하기도 하다). 신규 모듈 전역(`_LIVE_EXPANSION`, `_ESCAPED_PIPE`, `_HEREDOC_START`,
    `_COMMIT_STDIN_CMD`, `_SEGMENT_SPLIT`, `_MESSAGE_ARG`)은 전부 컴파일된 정규식 또는 튜플로
    불변 객체이며 어디서도 재대입되지 않는다 — 공유 가변 전역 상태 도입 없음. `main()` 의 시그니처와
    `_is_git_push(command: str) -> bool` 시그니처도 변경 없음(`grep` 로 다른 훅/모듈에서
    `_is_git_push` 를 import 하는 곳이 없음을 확인 — blast radius 는 이 파일 자신과 신규 테스트로
    한정). `BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD` 환경변수 사용은 diff 밖(무변경). 파일 I/O,
    네트워크 호출, 이벤트 발행/콜백 등록 추가 없음.
  - 제안: 조치 불요.

- **[INFO]** 게이트 판정 범위 자체의 완화는 이번 PR 의 의도된 목적(재확인)
  - 위치: `.claude/hooks/guard_review_before_push.py::_is_git_push`
  - 상세: 이 함수는 `.claude/settings.json` Bash matcher 로 모든 worktree·세션에 전역 적용되는
    유일한 hard gate 이므로, 반환값이 조용히 뒤집히면(미검토 코드 push 통과) 파급력이 저장소
    전체에 미친다. 직전 라운드의 C1/C3 는 정확히 이 범주(gate bypass)였고 지금은 재현 테스트로
    막혀 있다. 이번 diff 는 "좁게 빗나가면 차단 유지" 라는 설계 불변식을 유지한 채 오탐만
    줄이는 것이 목적이며, 위 WARNING 항목을 제외하면 그 불변식이 실제로 지켜짐을 확인했다
    (예: `_owns_heredoc_as_message` 판정이 느려질 수는 있어도, 매칭 자체는 실패 시 여전히
    차단 유지로 귀결되어 오판정(false release)으로 이어지지는 않는다 — 순수 가용성 문제).
  - 제안: (조치 불요) 향후 `_redact_inert_text`/`_owns_heredoc_as_message` 변경 시
    `test_push_guard_allowlist.py` 의 차등 테스트(`test_no_new_false_negatives` 등) 재실행 필수.

- **[INFO]** 테스트 파일의 subprocess 사용은 격리·타임아웃 범위 내
  - 위치: `.claude/tests/test_push_guard_allowlist.py::BacktrackingTest._run_guard_out_of_process`
  - 상세: `subprocess.run([sys.executable, "-c", script], ..., timeout=self._TIMEOUT)` 는 훅의
    C-레벨 정규식 hang 이 시그널을 받지 않는다는 사실(문서화된 교훈)에 따라 의도적으로
    프로세스를 분리해 하드 타임아웃으로 fail-fast 하게 만든 것 — 테스트 실행 중에만 발생하는
    격리된 부작용이며 애플리케이션/훅 코드 경로에는 영향 없음.
  - 제안: 조치 불요.

- **[INFO]** plan·review 산출물 신규 생성은 프로젝트 컨벤션에 따른 예상된 파일시스템 쓰기
  - 위치: `plan/in-progress/harness-guard-followups.md`, `plan/in-progress/harness-push-guard-subcommand-detection.md`,
    `review/code/2026/07/23/14_23_23/{RESOLUTION.md,SUMMARY.md,_retry_state.json,meta.json,*.md}`
  - 상세: plan 문서 갱신(체크박스·서술)과 `review/` 하위 산출물(직전 라운드의 SUMMARY/RESOLUTION/
    reviewer 리포트)은 이 프로젝트 컨벤션상 커밋 대상이며(리뷰 산출물은 gitignore 되지 않음),
    애플리케이션 코드의 예상치 못한 파일시스템 부작용이 아니라 리뷰/plan 워크플로 자체의 정상
    출력이다. 런타임 동작에 영향 없음.
  - 제안: 조치 불요.

## 요약

직전 라운드에서 지적된 CRITICAL 3건(게이트 완전 우회 C1, `_MESSAGE_ARG` 지수적 ReDoS C2, 메시지
blanking 이 살아있는 확장을 드러내는 C3)은 실측 재현 결과 모두 올바르게 수정되었고 회귀 테스트로
고정되어 있다(25건 전체 통과, 별도 재현 스크립트로도 확인). 전역 상태·파일시스템·환경변수·네트워크·
이벤트 콜백·공개 시그니처 관점에서는 이번 diff 가 깨끗하다. 다만 검토 과정에서 이번 diff 가 새로
도입한 `_COMMIT_STDIN_CMD`/`_owns_heredoc_as_message` 에 **아직 회귀 테스트로 막히지 않은 O(n²)
백트래킹**을 직접 실측으로 발견했다(84KB 명령에서 6.2초, 추세상 더 긴 입력에서 수십 초~분대) — C2 와
동일한 "PreToolUse 동기 게이팅 hang" 피해 범주이지만 지수가 아닌 다항이고 트리거 조건이 더 좁아
WARNING 으로 분류했다. 이 항목을 제외하면 이번 diff 는 부작용 관점에서 안전하다.

## 위험도

WARNING
