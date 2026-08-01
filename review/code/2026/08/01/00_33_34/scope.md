# 변경 범위(Scope) Review

## 조사 방법

프롬프트의 15개 대상 파일 중 3개(`_lib/review_guard.py`, `guard_review_before_push.py`,
`consistency_orchestrator.py`)는 크기 제한으로 "전체 파일 컨텍스트"가 실리지 않아, 해당 파일과
나머지 전부를 `git diff origin/main...HEAD`(6 커밋: `30cc0f738`→`7b54b088a`→`e364b4159`→
`a0dcebea2`→`780e0837e`→`b06982ec4`, 15 files, `+990/-281`)로 직접 대조했다.

이 worktree(`harness-block-backstop-b56163`)는 이미 두 차례 scope 리뷰를 거쳤다
(`review/code/2026/07/31/18_16_48` WARNING → `19_03_11` INFO로 하향, 근거: retry_state.py
추출이 사전 실측·전용 테스트·인접 확장 defer 를 모두 갖춤). 이번 세션은 그 이후 커밋
`780e0837e`(2R 반영)·`b06982ec4`(3R 부분 반영, 방금 커밋됨— 세션 타임스탬프가 그 커밋 시각과
거의 일치)까지 포함한 전체 diff 를 다시 본다. 특히 `b06982ec4` 커밋 메시지가 스스로 "리팩터가
무관한 근거 주석을 삼킨 사고"를 자백하고 2개 파일(`code_review_orchestrator.py` 27줄,
`consistency_orchestrator.py` 3줄)을 복원했다고 밝히므로, 그 복원이 **완전한지**를 별도로
검증했다 — 정규식 기반 함수 추출이 "다음 def 까지"를 함수로 착각해 사이의 주석을 삼키는 클래스는
기계적으로 재현 가능한 결함이라, 같은 추출을 거친 세 번째 파일(`merge_coordinator_orchestrator.py`)
도 같은 사고를 겪었는지 `origin/main`/`HEAD` 두 버전의 `# ---` 구분 주석을 전수 대조했다.

## 발견사항

- **[WARNING]** `merge_coordinator_orchestrator.py` 의 구분 주석 유실이 "3R 사고 복구" 커밋에서 누락됨 — 같은 결함 클래스의 세 번째 사례가 미수정으로 남음
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:121-125` (`_apply_status_update` delegate 직후, `_git(args, timeout=15)` 시작 직전)
  - 상세: `b06982ec4`(3R 부분 반영)는 상태 helper 추출 스크립트가 정규식 `^def name\(.*?(?=^def |\Z)` 으로 함수를 잘라내며 **함수 사이 주석까지 삼켰다**고 밝히고, `code_review_orchestrator.py`(router-trust 근거 27줄)와 `consistency_orchestrator.py`(섹션 구분 주석 3줄) 두 곳을 원본에서 복원했다. 그런데 같은 추출(`7b54b088a`→`780e0837e`)이 세 번째 파일 `merge_coordinator_orchestrator.py` 도 건드렸고, 이 파일에서만 유실이 복원되지 않았다. `git show origin/main:<path> | grep -n '^# ---' -A1`로 두 버전의 전체 구분 주석 목록을 전수 대조한 결과:
    - `origin/main`: `Config` / `State helpers …` / **`Git / gh helpers`** / `Prompt body builders` / `Session preparation` / `Input collection` / `Main` — 7개.
    - `HEAD`: `Config` / `State helpers …` / `Prompt body builders` / `Session preparation` / `Input collection` / `Main` — 6개. `Git / gh helpers`(3줄 구분 주석, `_git`/`_gh` subprocess 헬퍼 앞)가 사라졌다.
    - 현재 `HEAD` 파일은 121번째 줄 `_apply_status_update` delegate 바로 다음 125번째 줄에 `_git(args, timeout=15)` 이 아무 구분 없이 이어진다 — state bookkeeping 5종(이번 PR 의 실제 관심사)과 git/gh subprocess 헬퍼(무관 영역)의 경계가 지워졌다.
    - 이 저장소는 이번 라운드에 동일 결함 클래스 두 건을 이미 "복원 완료"로 커밋했고 커밋 메시지가 "실측 28줄"이라 적었지만(27+3=30, 게다가 이 세 번째 건 3줄을 더하면 최소 33줄), 세 번째 발생분은 그 실측에서 아예 빠져 있었다 — 감사 자체가 불완전했다는 신호다.
  - 제안: `origin/main` 의 해당 3줄(`# ---...--- / # Git / gh helpers / # ---...---`)을 `_apply_status_update` delegate 와 `_git` 정의 사이에 그대로 복원. 동일 정규식 추출을 거친 다른 위치에도 이 클래스가 더 있는지 한 번 더 훑는 것을 권장(이번 검증은 `# ---` 스타일 구분 주석에 한정했고, 그 외 스타일의 module-level 주석/상수 유실 가능성은 배제하지 못함).

- **[INFO]** retry_state.py 추출 자체는 재확인 결과 기존 판정(LOW/INFO)과 동일 — 새 이슈 없음
  - 위치: `.claude/_shared/retry_state.py` 전체, `code_review_orchestrator.py`/`consistency_orchestrator.py`/`merge_coordinator_orchestrator.py` 의 delegate 치환부
  - 상세: `18_16_48`(WARNING: "무관한 리팩토링이 plan 에 미등재") → `19_03_11`(INFO: `a0dcebea2` 가 plan 항목 추가·defer 명시로 해소)의 판정 이후 추가된 `780e0837e`/`b06982ec4` 두 커밋을 전수 대조했다. 두 커밋의 모든 변경분(`_apply_status_update` 완전 위임, `summary_block_verdict` 순서 무관화, Stop 가드 notes 배선, atomic write, 죽은 import 제거, checker 목록 3중 동치성 테스트)이 전부 자체 커밋 메시지의 `[W#]` 항목과 1:1 대응하는 리뷰 응답형 수정이며, 리뷰에서 요청되지 않은 새 파일·새 CLI 옵션·설정 변경은 없었다. `codebase/`·`spec/`·`.github/`·`.claude.project.json` 등 이 PR 범위 밖 영역은 전혀 건드리지 않았다(diff --stat 전수 확인, 15개 파일 모두 `.claude/`+`plan/` 내부).
  - 제안: 조치 불요(기존 판정 유지).

- **[INFO]** `save_state` 의 atomic write 전환(W7)은 "그대로 이동"을 넘어선 신규 하드닝이지만 근거가 diff 안에 있어 허용 범위
  - 위치: `.claude/_shared/retry_state.py:50-75`(`save_state` 함수, `docstring` 포함)
  - 상세: 모듈 docstring 은 "AST 비교로 5개 중 4개가 동일했다"고 주장하지만, 그 동일했던 원본 `_save_state`(`open(..., "w")` 후 `json.dump`)는 이번에 temp-file + `os.replace` 로 바뀌어 더 이상 "그대로 옮긴 것"이 아니라 신규 동작(동시 reader 의 torn-read 방지)이 됐다. 다만 이는 커밋 메시지에 W7 로 명시되고, docstring 에도 "왜"와 "무엇은 아직 안 풀렸는지(agent_history/rate_limit 는 여전히 lost-update 가능)"가 함께 적혀 있어 은닉된 확장은 아니다. `test_retry_state_shared.py` 는 이 커밋에서 갱신되지 않아 atomic write 자체를 겨냥한 회귀 테스트는 없다(harness 스위트 738 통과라는 진술은 기존 테스트가 여전히 통과한다는 뜻이지, 새 동작을 검증했다는 뜻은 아니다) — 이 부분은 스코프 문제라기보다 테스트 커버리지 문제라 별도 리뷰어 영역으로 남긴다.
  - 제안: 조치 불요(스코프 관점에서는 문제 아님). 테스트 보강 여부는 다른 리뷰 관점에 위임.

## 점검한 다른 항목 (문제 없음)

- **무관한 파일/영역 수정**: 없음. `git diff origin/main...HEAD --stat` 15개 파일 전부 `.claude/`(하네스)·`plan/in-progress/` 뿐이고 `codebase/`·`spec/`·`.github/`·`.claude.project.json` 변경 없음 — plan 문서 자신이 "CI 백스톱 본체는 미착수"라 명시한 것과 정합.
- **기능 확장(over-engineering)**: 없음. `block_integrity.py`/`retry_state.py` export 함수 전부 실사용처 존재, CLI 플래그·설정 옵션 신설 없음.
- **포맷팅/공백 변경**: 실질 변경과 뒤섞인 무의미한 재포맷팅 hunk 없음(각 diff 전수 확인).
- **주석 변경(위 WARNING 제외)**: `consistency-summary.md`/`SKILL.md`/`tests/README.md` 의 프로즈 수정은 전부 "게이트가 이제 `[CRITICAL]` 모순을 감지한다"는 실제 동작 변경을 반영하는 정정이지, 근거 없는 주석 손질이 아님.
- **임포트 변경**: `consistency_orchestrator.py` 의 `_report_paths_lib` 제거(W2)는 실사용처 0건 확인 후 제거된 죽은 import — 정당. 나머지 신규 import(`retry_state`/`block_integrity`) 전부 사용처 존재. `datetime`/`json` 은 세 orchestrator 모두 delegate 로 옮겨진 함수 밖에서 여전히 쓰여 고아 임포트 없음.
- **설정 변경**: 없음.

## 요약

브랜치 전체(6 커밋, 15 파일)는 표제 기능(Critical 하향 금지 기계적 backstop)과 그에 결부된
DRY 리팩토링(`retry_state.py` 추출)으로 구성되고, 후자는 이전 두 차례 scope 리뷰에서 이미
근거·테스트·명시적 defer 를 갖춘 허용 범위로 판정됐으며 이번에 추가된 2R/3R 커밋도 전부 그
판정을 흔들 새 이슈 없이 리뷰 응답형 수정(각 커밋 메시지의 `[W#]`와 1:1 대응)이었다. 다만
`b06982ec4` 스스로 자백한 "리팩터가 무관한 주석을 삼킨 사고"의 복구가 불완전했다 —
`merge_coordinator_orchestrator.py` 의 "Git / gh helpers" 구분 주석은 같은 결함 클래스인데도
복원 대상에서 빠져 아직 유실 상태다. 기능적 영향은 없는 cosmetic 유실이지만, 이 라운드가 정확히
그 결함 클래스를 겨냥해 만들어졌다는 점에서 감사 완결성 문제로 짚어 둔다. 그 외 무관 파일·설정
변경, 포맷팅 뒤섞임, 근거 없는 주석, 죽은 임포트, 요청되지 않은 기능 확장은 발견되지 않았다.

## 위험도

LOW
