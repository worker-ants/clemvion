# Scope Review — CI 백스톱 (review-gate.yml + check-review-gate.py) — Round 4

## 방법

`git diff origin/main...HEAD --stat` 로 이 브랜치 전체(4라운드 누적 커밋: `a8138aafd`
feat → `9d8b517e0` 1R → `3f10ddfbe` 2R → `02138a898` 3R → `864b71a7b` 4R)의 변경 파일
목록을 코드 리뷰 번들의 8개 파일(README.md, test_block_integrity.py, test_review_gate_ci.py,
test_stop_guard_failopen.py, harness-checks.yml, review-gate.yml,
plan/in-progress/harness-review-gate-ci-backstop.md, check-review-gate.py)과 대조했다.
번들은 "Review"(전체 파일 컨텍스트)로만 왔고 unified diff 섹션이 없어, 각 파일을
`git diff origin/main...HEAD -- <file>` 로 개별 대조하고 각 커밋 메시지([1R][2R][3R][4R])의
변경 근거를 확인했다. `test_block_integrity.py` 는 번들이 "프롬프트 크기 제한으로 555/844줄만
표시" 라고 잘라 알렸으므로 지시대로 `Read` 로 실제 파일(650~703행)을 직접 열어 확인했다.

라운드 4(`864b71a7b`) 자체의 diff는 `.claude/tests/test_review_gate_ci.py` 한 파일,
23줄(19+/4-)뿐이다 — `test_the_gate_step_is_unconditional`(`if:` 키 하나만 검사)을
`test_the_gate_step_cannot_be_skipped_or_have_its_failure_swallowed`(`if`/`continue-on-error`/
`timeout-minutes` 세 키를 모두 검사)로 대체한 것이 전부다.

## 발견사항

발견사항 없음. 이번 라운드 및 이 브랜치가 누적한 8개 파일 전부, 검토한 범위 안에서 의도된
범위(리뷰 게이트의 훅-독립 CI 백스톱, 관측 모드)를 벗어나지 않는다.

- **라운드 4 diff는 정확히 커밋 메시지가 말하는 것만 한다.** `if`/`continue-on-error`/
  `timeout-minutes` 세 키 검사 확장 — 커밋 메시지가 명시한 "실행을 막는 축(if) · 실패를
  삼키는 축(continue-on-error) · 즉시 끝내는 축(timeout-minutes: 0)" 그대로다. 프로덕션
  코드(`review-gate.yml`, `check-review-gate.py`) 변경 없음 — 이 세 키가 현재 워크플로에
  없으므로 순수 회귀 방지 테스트다. 무관한 리팩토링·포맷팅·주석·임포트 변경 없음.
- **누적 4라운드 전체가 "이전 라운드 리뷰의 발견 → 그 라운드에서만 수정"의 사슬이다.**
  각 fix 커밋 메시지가 어떤 리뷰 발견([C1]/[C2]/[W1]…)이 어떤 코드 변경을 낳았는지 1:1로
  대응시킨다. 예: `test_block_integrity.py` 의 24줄 변경(per-stub 검사로 전환 + 마커 문자열
  자기매칭 필터)은 2R 커밋의 [W5]가 명시적으로 근거를 댄다("PlanStubsMirror 가 파일 단위
  join 이라 한 파일의 두 stub 중 하나가 push_blocks 를 잃어도 통과했다"). `test_stop_guard_
  failopen.py` 의 `push_blocks = False` 두 곳 추가도 같은 [W5]가 발견한 실제 누락이다.
  `harness-checks.yml` 의 `scripts/check-review-gate.py` 경로 추가는 이 스위트 자신의
  README 관행("이 클래스가 6번 샜다")과 harness-checks 커버리지 규약을 CI 백스톱 스크립트
  자신에게 적용한 것 — 기능 확장이 아니라 새로 생긴 파일을 기존 규약에 편입시킨 것이다.
- **범위 밖 항목은 실행하지 않고 명시적으로 유보했다.** 3R 커밋 메시지: "[W1·W5] evaluate
  중복호출 가드와 훅 사본 보일러플레이트 통합은 별도 범위로 미처분" — 발견됐지만 이번 PR의
  범위가 아니라고 판단해 손대지 않았다. 스코프 규율 관점에서는 이것이 바람직한 방향(불필요한
  확장을 하지 않음)이다.
- **plan 프론트매터의 `worktree:` 필드 변경**(`harness-block-backstop-b56163` →
  `harness-review-ci-backstop-91f379`)은 라운드마다 새 worktree 에서 재개하는 이 프로젝트의
  표준 관행을 반영한 메타데이터 갱신이며, 본문 내용 변경이 아니다.
- README.md 의 PyYAML 예외 단락 재서술("두 파일" → 개수를 안 세는 서술)과 신규 행 추가는
  실제로 파일이 3개로 늘어난 사실을 반영한다 — 3R 커밋의 [W3]가 "재작성 세대 서술 stale"을
  지적한 것과 결이 같은, 문서 사실성 유지이지 무관한 리라이트가 아니다.
- 작업 트리는 검토 시작·종료 시점 모두 `git status` 상 clean(이 리뷰 세션 자신의 출력 디렉터리
  제외)이었고, 어떤 파일도 수정하지 않았다.

## 요약

라운드 4의 실제 diff는 커밋 메시지가 예고한 범위(게이트 step 의 실패-무력화 키 3종을 함께
차단)와 정확히 일치하는 단일 파일·단일 테스트 변경이며, 프로덕션 코드·워크플로 파일은
건드리지 않았다. 브랜치 전체(4라운드 누적)를 origin/main 대비로 넓혀 봐도, 모든 변경이
직전 라운드 리뷰가 지목한 구체적 결함에 1:1로 대응하고, 범위 밖으로 식별된 항목(evaluate
중복호출 가드, 훅 사본 통합)은 실행하지 않고 명시적으로 유보 기록만 남겼다. 무관한 리팩토링·
포맷팅·주석·임포트·설정 변경, 요청하지 않은 기능 확장의 징후는 발견되지 않았다.

## 위험도

NONE
