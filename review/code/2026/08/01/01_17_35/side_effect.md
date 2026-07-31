# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** Stop 훅의 note throttle 마커가 "내용"이 아니라 "위치(idx)"로만 키잉되어, 자신의 주석이 보장한다는 이벤트 전달을 깨뜨린다 — 실제 재현 확인
  - 위치: `.claude/hooks/guard_review_before_stop.py:369-373` (주석은 369-370행, 마커 키 구성은 373행)
  - 상세:
    `_run()` 은 `decision.notes` 를 순회하며 `f"note{idx}"` 로 마커 파일 경로를 만들고 (`session_id`, git-branch `token`, `note{idx}` 조합), 이미 그 마커가 있으면(`_already_nudged`) 해당 note 를 **출력하지 않고 건너뛴다**. 바로 위 주석은 "마커는 note 텍스트를 키로 삼으므로, 다른 모순이면 여전히 통과한다(`The marker keys on the note text, so a DIFFERENT contradiction still gets through`)" 라고 명시하지만, 실제 `_marker_path(session_id, token, f"note{idx}")` 호출에는 `note` 의 실제 텍스트가 전혀 들어가지 않는다 — 오직 **위치(index)** 로만 키가 결정된다.

    직접 재현: 동일 `session_id`/branch(token) 에서 1회차 note(`SESSION-A-DOWNGRADE`, idx=0)를 먼저 출력시켜 마커를 기록한 뒤, 2회차 호출에서 **완전히 다른** note(`SESSION-B-DOWNGRADE`, 역시 idx=0)를 주면 — 2회차 stderr 에 아무것도 찍히지 않는다(전체 hook 을 subprocess 로 실제 구동해 확인, 두 호출 모두 정상 종료).

    이 기능 자체가 "`consistency-summary.md` §요약 지침 3 하향 금지"를 실제로 지키는지 감시하는 backstop 인데, 그 backstop 의 **알림 전달 경로**가 세션이 바뀌어 완전히 다른 하향 사례가 생겨도 같은 인덱스에 이미 마커가 있으면 침묵한다 — 이 PR 이 고치려는 "침묵" 실패 모드를 알림 계층에서 재현한 것이다. 코드 자신의 주석도 이 경로가 왜 필요한지 이렇게 설명한다: "이 훅은 push 보다 먼저 실행되며, 게이트가 더 이상 신뢰하지 않게 된 세션은 그 사이에 자신의 advisory 를 함께 가지고 사라진다 — 경고가 늦게 오는 게 아니라 아예 사라지는 것이다" — 즉 Stop 훅에서 놓치면 이후 push 시점에도 (그 사이 다른 세션이 채택되면) 다시는 보이지 않을 수 있는 경로임을 스스로 인정하고 있다.

    다만 push 훅(`guard_review_before_push.py`)의 `_report_notes` 는 인덱스/내용 기반 억제 없이 매 push 마다 현재 outcome 의 notes 를 전부 출력하므로(§below 참고), "채택된 세션이 바뀌지 않은 채 계속 push 를 시도"하는 흔한 경로에서는 결국 노출될 여지가 있다 — 그래서 CRITICAL 이 아니라 WARNING 으로 판단했다. 하지만 그 백스톱은 "채택 세션이 바뀌는 그 사이"의 케이스(코드 자신이 존재 이유로 든 바로 그 케이스)는 커버하지 못한다.
  - 제안: 마커 키에 note 텍스트 자체(또는 그 해시)를 포함시킨다. 예:
    ```python
    import hashlib
    for idx, note in enumerate(...):
        digest = hashlib.sha1(note.encode("utf-8")).hexdigest()[:10]
        marker = _marker_path(session_id, token, f"note-{digest}")
        ...
    ```
    이러면 "같은 내용 재출력 억제"와 "다른 내용은 통과" 두 속성을 함께 만족한다. 현재 코드는 전자만(그것도 위치 기준으로) 만족한다. 이 시나리오(같은 세션/브랜치 내에서 서로 다른 두 note 가 같은 인덱스에 순차적으로 나타나는 경우)를 pin 하는 테스트가 `test_block_integrity.py` 에 없다 — `NotesReachBothHooksTest`/`AdvisoryReachesTheModelTest` 는 모두 단일-note, 단일-호출 시나리오만 검증한다.

- **[INFO]** `save_state` 의 원자적 쓰기가 git 추적 대상 세션 디렉토리에 새로운 파일시스템 부작용(임시 파일)을 들여온다
  - 위치: `.claude/_shared/retry_state.py:50-83` (특히 73행 `tmp = f"{state_file}.tmp.{os.getpid()}"`, 79-83행 cleanup)
  - 상세:
    기존 3개 orchestrator 의 `_save_state` 는 `open(state_file, "w")` 로 바로 덮어썼다(중간 산출물 없음). 이제 공유 구현은 `<state_file>.tmp.<pid>` 를 만들고 `os.replace` 로 원자적으로 교체한다 — 문서화된 대로 half-write 노출을 막는 명백한 개선이다. 다만 이 변경은 **새로운 실패 모드**를 하나 추가한다: 프로세스가 `open(tmp, ...)` 이후 ~ `finally` 의 `os.unlink(tmp)` 이전에 강제 종료(SIGKILL, OOM 등)되면 `.tmp.<pid>` 잔여 파일이 세션 디렉토리에 남는다. `os.unlink` 실패 시에도 `except OSError: pass` 로 조용히 넘어간다.
    이 세션 디렉토리들(`review/code/**`, `review/consistency/**`)은 `.gitignore` 대상이 아니다(`review/**/_prompts/` 만 무시됨, `_retry_state.json` 류는 추적 대상) — 확인: `git check-ignore` 로 매치 안 됨. 즉 잔여 `.tmp.<pid>` 파일은 `git status` 에 untracked 로 잡히고, `git add -A`/`git add .` 를 쓰는 워크플로가 있다면 커밋에 섞여 들어갈 수 있다. 프로젝트 커밋 프로토콜이 이미 `git add -A` 지양을 명시하고 있어 완화되긴 하지만, 이번 변경 이전에는 애초에 이런 중간 산출물 자체가 없었다.
  - 제안: 심각도는 낮음(강제 종료 + 이후 broad `git add` 가 겹쳐야 발생) — 지금 막을 필요는 없어 보이지만, 세션 디렉토리를 다루는 정리 스크립트(있다면)에 `*.tmp.*` 청소를 추가하거나, 최소한 후속 백로그에 등록해 둘 만하다.

- **[INFO]** 시그니처/인터페이스 변경 감사 — 하위호환 확인, 문제 없음
  - 위치: `.claude/hooks/_lib/review_guard.py:718-720` (`_newest_resolved_impl_done_mtime` 에 `notes` 파라미터 추가), `:173` (`ReviewDecision` 에 `notes: tuple[str, ...] = ()` 필드 추가)
  - 상세: 두 변경 모두 **끝에 기본값 있는 신규 파라미터/필드**를 추가하는 형태라 기존 호출자와 하위호환이다. 실제로 저장소 전역에서 `ReviewDecision(...)` 생성 호출부 8곳(`review_guard.py:916,926,935,948,955,970,981,994`)과 테스트의 생성/키워드 호출부(`test_review_guard_hardening.py:530`, `test_push_guard_worktree_scope.py:621-623` 등)를 모두 확인했고, `notes` 를 안 넘기는 곳은 전부 기존 2-positional-arg 형태를 그대로 쓰고 있어 깨지지 않는다. `_newest_resolved_impl_done_mtime` 는 `evaluate_review` 내부의 유일한 실호출부 1곳 + 테스트 keyword-arg 호출뿐이라 영향 범위가 닫혀 있다. `_BLOCK_LINE` 제거(구 정규식)도 잔여 참조 없음을 grep 으로 확인했다. `failopen_state.Outcome`/`guard_review_before_push._Outcome`/`guard_review_before_stop._Fallback` 세 클래스 모두 신규 `notes` 필드를 동일하게 추가했고, `Outcome()` 생성 호출부(2곳)는 인자 없이 호출하므로 영향 없음.
  - 제안: 없음 — 감사 결과 기록 목적의 항목.

## 요약

이번 diff 는 "checker 의 `[CRITICAL]` 과 SUMMARY 의 `BLOCK: NO` 가 모순되면 경고" 기능(`block_integrity.py` 신설)과 3개 orchestrator 의 `_retry_state.json` bookkeeping 중복 제거(`retry_state.py` 신설, atomic write 도입)를 중심으로 한다. 새로 추가된 `ReviewDecision.notes`/`Outcome.notes` 필드와 `_newest_resolved_impl_done_mtime` 의 신규 파라미터는 모두 끝에 기본값을 붙인 하위호환 확장이며, 전체 호출부를 추적한 결과 깨지는 곳은 없었다. `save_state` 의 원자적 쓰기 전환은 의도된 개선이지만 세션 디렉토리(git 추적 대상)에 임시 파일이라는 새 부작용 표면을 열었다 — 강제 종료 시 잔여 파일이 남을 수 있으나 심각도는 낮다. 가장 실질적인 발견은 Stop 훅의 note throttle 마커가 note 의 **내용이 아니라 인덱스**로만 키잉되어, "다른 모순이면 통과시킨다"는 스스로의 주석 및 설계 의도를 위반한다는 점이다 — 실제 subprocess 재현으로 같은 세션/브랜치에서 서로 다른 두 note 가 같은 인덱스에 오면 두 번째 note 가 완전히 침묵함을 확인했다. push 훅 쪽 `_report_notes` 는 억제 없이 매번 전체 notes 를 출력하므로 부분적 백스톱이 되지만, 코드 자신이 명시한 "채택 세션이 교체되는 사이" 케이스는 그 백스톱으로 커버되지 않는다.

## 위험도

MEDIUM
