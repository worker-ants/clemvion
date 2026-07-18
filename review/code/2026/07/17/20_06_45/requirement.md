# 요구사항(Requirement) 리뷰 — mermaid-lint 설치 경쟁 + 부분 설치 영속 (bbf72268e)

## 검증 방법

정적 분석 외에 실제 실행으로 핵심 주장을 검증했다:

- `python3 -m unittest discover -s .claude/tests -p 'test_bootstrap_mermaid_install.py'` → **신규 코드에서 9/9 통과**.
- 동일 스위트를 **fix 이전 버전**(`git show cdad5a1ec:.claude/tools/bootstrap-session.sh`, 커밋 bbf72268e 의 부모)에 대해 실행 → **6/9 실패**(`test_installs_once_and_writes_completion_marker`,
  `test_partial_node_modules_without_marker_is_retried`, `test_failed_install_leaves_no_marker_so_it_retries`,
  `test_held_lock_makes_this_session_skip_rather_than_race`, `test_stale_lock_is_stolen_so_it_cannot_wedge_forever`,
  `test_concurrent_sessions_install_at_most_once`) — 커밋 메시지의 "구 코드에서 6건 실패 확인(비-vacuity)" 주장과
  **정확히 일치**. 테스트가 실제로 회귀를 핀 것이지 vacuous 하지 않음을 실측으로 확인.
- `.claude/tests/` 전체(`unittest discover -p 'test_*.py'`) → **291 passed** — 커밋 메시지의 "harness 291건 통과(282 baseline + 9)" 주장과 일치.

## 발견사항

- **[WARNING] 기능 완전성 — "부분 node_modules 오판" 결함의 실제 소비처(consumer) 두 곳은 그대로 bare 디렉토리 체크를 쓴다**
  - 위치: `.claude/hooks/lint_mermaid_posttooluse.py:101` (`os.path.isdir(os.path.join(tool_dir, "node_modules"))`),
    `.githooks/pre-commit:50` (`[ -d "$mermaid_tool_dir/node_modules" ]`)
  - 상세: 이번 커밋(및 신규 테스트 docstring)이 명시적으로 겨냥한 결함은 "부분 node_modules 를 **디렉토리 존재 체크가** 영원히
    '설치됨'으로 오판 → mermaid lint 가 아무 신호 없이 무력화된 채 남는다"이다. 그런데 이 "디렉토리 존재만으로 완료 판정"
    패턴은 `bootstrap-session.sh`(설치 여부 결정)에서만 마커(`.bootstrap-install-complete`) 기반으로 교체됐고, **실제로
    mermaid lint 를 구동할지 말지를 결정하는 두 소비처**(`PostToolUse` 훅, `pre-commit` 훅)는 여전히 신규 주석이 "the flawed
    approach" 라고 직접 지목한 그 패턴(`node_modules` 디렉토리 존재만 확인)을 그대로 쓴다. 실제 영향:
    ① 락을 쥔 세션이 `npm install` 을 진행 중인 짧은 창(node_modules 는 이미 존재하지만 아직 불완전)에, **다른** 세션이
    그 시각에 markdown 을 편집하거나 커밋하면 두 소비처 모두 "설치 완료"로 오판해 불완전한 `node_modules` 로 `node
    lint-mermaid.mjs` 를 구동한다 — `jsdom`/`mermaid` require 실패 시 `pre-commit` 은 "malformed mermaid block" 이라는
    **잘못된 진단**으로 커밋을 막고(`if ! node ...; then` exit 1), `PostToolUse` 훅은 "mermaid syntax error" 로 오인해
    Claude 에게 존재하지 않는 구문 오류를 고치라고 요구한다(exit 2). ② 이번 fix 로 이 창은 "영원"에서 "락이 쥐어진
    수초~수분"으로 **좁아졌을 뿐** 사라지지 않았다.
  - 이번 diff 의 회귀는 아니다(두 파일 모두 이 PR 의 변경 대상이 아니며 기존 상태 그대로) — 다만 plan 체크리스트가
    이 항목을 "✅ 완료" 로 표시하고 커밋 메시지가 "결함 2개... 수정" 이라 서술하는 것에 비하면, 그 결함의 소비자 측
    증상(정확히 "mermaid lint 가 무력화된 채 남는다")은 **완전히 닫히지 않았다** — 마커 도입으로 "포화 상태가 영구화되는
    시나리오"만 없앴고, "일시적으로 불완전한 상태에서 소비되는" 시나리오는 여전히 열려 있다.
  - 제안: 두 소비처도 `.bootstrap-install-complete` 마커를 확인하도록 통일하거나(가장 견고), 최소한 이 잔여 창을
    plan 문서(`plan/in-progress/harness-guard-followups.md`)에 알려진 한계로 명시(이 PR 의 "won't-do" 섹션과 같은 방식) —
    지금은 완료로만 기록돼 있어 다음 사람이 이 잔여 갭을 모르고 넘어간다.

- **[WARNING] `.claude/tests/README.md` "What's covered" 표에 신규 테스트 파일이 등재되지 않음**
  - 위치: `.claude/tests/README.md` (본 diff 에 미포함 — 갱신 누락)
  - 상세: 이 harness self-test 스위트는 파일마다 표에 한 줄(무엇을 가드하는지)을 다는 것이 확립된 컨벤션이다. 바로 직전의
    자매 plan(`plan/complete/harness-session-anchor-guards.md`, PR #970)이 `test_reap_merged_worktrees.py` 를 추가하며
    체크리스트에 명시적으로 "① 문서 동기화 — `worktree-policy.md §7` 불변식 정정 + `.claude/tests/README.md` 행 추가"
    를 `[x]` 로 남긴 선례가 있다(즉 이 프로젝트 스스로 세운 절차). 이번 PR 은 같은 패턴(신규 harness 테스트 파일 추가)임에도
    README 표에 `test_bootstrap_mermaid_install.py` 행이 없다 — 확인 결과 실제로 누락돼 있다.
  - 제안: README 표에 한 행 추가(가드 대상: 설치 완료 마커·mkdir 락·경쟁/부분설치/실패/stale-lock 시나리오).

- **[INFO] `.gitignore` 주석의 "크래시로 남으면 10분 뒤 다음 세션이 회수" 서술이 성립하지 않는 좁은 창이 있음**
  - 위치: `.gitignore:7-8`, `bootstrap-session.sh:58` (`[ ! -f "$marker" ]` 가 스텔 로직 전체를 게이팅)
  - 상세: stale-lock 탈취 로직은 `[ -f package.json ] && [ ! -f "$marker" ] && command -v npm` 블록 **안에서만** 실행된다.
    마커가 이미 쓰인 뒤(`npm install` 성공) `rmdir "$lock"` 직전에 프로세스가 죽는 극히 좁은 창(두 개의 인접한 셸
    명령 사이)에서는, 다음 세션이 `[ ! -f "$marker" ]` 를 평가하는 순간 이미 FALSE(마커 존재)이므로 이 블록 자체에
    재진입하지 않고, 탈취 로직도 다시는 실행되지 않는다 — 그 lock 디렉토리는 영구히 잔존한다. 기능적으로는 무해하다
    (마커+node_modules 는 이미 정상 완료 상태이므로 lint 자체는 정상 동작) — 다만 `.gitignore` 주석의 "10분 뒤 회수"라는
    절대적 표현은 이 케이스에 한해 정확하지 않다. 확률상 무시 가능한 수준(연속 두 셸 명령 사이의 crash)이라 실무 영향은
    낮음.
  - 제안: 문서 표현을 "일반적으로 harmless — 마커 작성 후~락 해제 전 크래시라는 예외적 케이스에서만 영구 잔존, 그 경우도
    node_modules 자체는 온전하므로 lint 동작에 지장 없음" 정도로 정밀화(선택 사항, 낮은 우선순위).

- **[INFO] spec 문서 부재 (해당 없음이 정상)**
  - 상세: 본 변경은 `spec/` 가 다루는 product 영역이 아니라 `.claude/` 하네스 인프라(SessionStart bootstrap)이므로 대응하는
    `spec/*.md` 문서가 없다. 가장 근접한 문서는 `.claude/docs/worktree-policy.md` §7(GC reaper)이지만 이는 워크트리
    reap 규칙만 다루고 mermaid-lint 설치 락 자체는 다루지 않는다 — 코드 주석(`bootstrap-session.sh:34-54`)이 사실상
    유일한 "spec" 이며, 그 서술과 실제 구현은 (위 WARNING 을 제외하면) line-level 로 일치한다.

## 상세 검증 결과 (문제 없음 확인)

- **테스트 9건 각각이 실제 회귀를 핀다** — 각 테스트를 구코드 동작과 대조 추적하고 실제 실행으로 재확인(위 "검증 방법").
  `test_lock_is_released_after_a_successful_install`/`_failed_install` 은 구코드에서도 우연히 통과(락 개념 자체가
  없어 "부재"가 항상 참)하지만 나머지 assertion(마커 파일 존재)이 함께 있어 실제로는 구코드에서 실패 — vacuous 아님.
- **동시성 정확성** — `mkdir` 원자성에 의존한 락 획득/스틸 경쟁을 추적: 두 세션이 동시에 stale-lock 을 "훔치려" 시도해도
  최종 `mkdir "$lock"` 단계에서 단 하나만 성공(rmdir 실패는 `|| true` 로 무해) → 중복 설치 없음. 5-세션 동시 실행 테스트로
  실측 확인(신규 코드 통과, 구코드 실패).
- **항상 exit 0** — `set -u` 이지만 `set -e` 없음, 모든 실패 분기(install 실패, mkdir 실패, marker write 실패)가
  echo 후 계속 진행하며 스크립트 마지막 `exit 0` 로 수렴 — "bootstrap must never block a session" 의도와 구현이 일치.
  테스트로 실측(`test_failed_install_leaves_no_marker_so_it_retries` 의 `returncode == 0` 단언).
- **엣지 케이스** — 빈 저장소(마커/락/노드모듈 전무), 부분 node_modules(하위 디렉토리만 존재), 실패한 설치(node_modules
  미생성 — NPM stub 이 실패 시 `mkdir` 이전에 `exit 1`), fresh lock(스틸 금지), stale lock(스틸 허용, 경계값 10분)
  모두 커버. `find -mmin -10`/`-mmin +10` 경계 판정도 BSD find(macOS, 본 실행 환경)에서 실측 통과.
- **TODO/FIXME/HACK/XXX** — diff 전체에 0건(grep 확인).
- **`.gitignore` 패턴** — `.claude/tools/mermaid-lint/.install.lock/` 은 스크립트가 실제로 만드는 정확한 경로와 일치,
  같은 커밋에 포함돼 있어 lock 도입과 ignore 등록 사이의 미보호 커밋 창이 없음.
- **plan frontmatter** — `worktree`/`started`/`owner` 3필드 모두 존재(in-progress 단계 필수 요건 충족). `spec_impact`
  는 완료(`complete/`) 시점에만 요구되므로 해당 없음. Rationale 섹션의 "왜 A 만 지금 하나" 등 서술은 실제 관련 plan
  (`harness-push-guard-subcommand-detection.md`)·직전 완료 plan(`harness-session-anchor-guards.md`) 내용과 대조해도
  사실과 부합(가공된 서술 아님).

## 요약

핵심 결함(병렬 worktree 세션의 `npm install` 경쟁)과 그 1차 증상(중단된 설치가 디렉토리 존재 체크에 의해 영구히
"설치됨"으로 오판되는 것)은 완료 마커 + `mkdir` 락으로 견고하게 수정됐고, 9건의 신규 테스트가 구코드 대비 6건 실패
(비-vacuity)·신코드 9/9 통과로 실측 검증됐다(harness 전체 291건도 회귀 없이 통과). 다만 이 결함이 최초에 서술한
"mermaid lint 가 아무 신호 없이 무력화된 채 남는다"는 증상은 설치 판정(installer) 쪽만 고쳐졌고, 그 증상을 실제로
만들어내는 두 소비처(`lint_mermaid_posttooluse.py`, `.githooks/pre-commit`)의 동일한 bare 디렉토리 체크는 그대로 남아
있어, 완료 범위가 plan 체크리스트의 "완료" 표기보다 좁다 — 영구적 무력화에서 "락이 쥐어진 짧은 창 동안의 오판"으로
축소됐을 뿐 범주 자체는 남아 있다. 이는 이번 diff 가 만든 회귀가 아니라 기존 갭이 그대로 이월된 것이며, 코드 정확성
자체에는 결함이 없으나 완결성 주장과 실제 구현 범위 사이에 괴리가 있다. 추가로 harness 자체 컨벤션(신규 테스트 파일마다
`.claude/tests/README.md` 행 추가 — 직전 자매 PR 이 명시적으로 지킨 절차)이 이번엔 지켜지지 않았다.

## 위험도

MEDIUM
