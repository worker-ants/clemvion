# 부작용(Side Effect) Review

## 스코프 메모

프롬프트에 실린 15개 파일 중 4개(`.claude/hooks/_lib/review_guard.py`,
`.claude/hooks/guard_review_before_push.py`,
`.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`,
`.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`)는 프롬프트 크기
제한으로 내용이 실리지 않아 `Read`/`git diff origin/main...HEAD -- <path>` 로 직접 열어
확인했다. 아래 위치는 전부 실제 파일의 1-기준 줄 번호(gate 숫자와 일치)다.

## 발견사항

- **[INFO]** 세 orchestrator 의 상태 저장이 "직접 덮어쓰기"에서 "temp 파일 + `os.replace`"
  원자적 쓰기로 바뀌며 새로운 파일시스템 부작용(임시 파일 생성)이 생겼다.
  - 위치: `.claude/_shared/retry_state.py:65` (`save_state()` 내 `tmp = f"{state_file}.tmp.{os.getpid()}"`)
    — 호출부는 `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:194`,
    `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:95`,
    `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:118` 세 곳
    전부.
  - 상세: 기존 세 orchestrator는 각자 `open(state_file, "w")` 로 즉시 덮어썼다(truncate 후
    write). 이번 변경으로 셋 다 `_shared/retry_state.save_state()` 에 위임되어 세션
    디렉터리 안에 `{state_file}.tmp.<pid>` 임시 파일을 만든 뒤 `os.replace` 로 교체한다.
    "동시 reader 가 half-write 를 관측해 `json.load` 가 traceback 을 내는 창을 없앤다"는
    문서화된 의도(`retry_state.py:51-57`)는 타당하고, `finally` 블록이 정상 종료 시 temp
    파일을 지운다. 다만 `review/**` 는 `_prompts/` 하위만 gitignore 대상이고
    (`.gitignore:38`, `review/**/_prompts/`) `_retry_state.json` 자체는 커밋 대상이므로,
    프로세스가 cleanup 전에 `SIGKILL`/크래시로 죽는 드문 경우 `_retry_state.json.tmp.<pid>`
    잔여 파일이 세션 디렉터리에 남아 이후 `git add`/`git add -A` 로 커밋될 수 있다. 실제
    `_retry_state.json` 자체는 훼손되지 않으므로(교체가 성공 못 하면 원본 그대로) 영향은
    "무해한 clutter 파일이 커밋될 수 있다" 수준.
  - 제안: 현재 설계(atomic write)는 유지할 가치가 있는 개선이라 되돌릴 필요는 없다. 원한다면
    세션 정리/커밋 전 단계에 `*.tmp.*` glob 청소를 추가하거나 `.gitignore` 에
    `review/**/*.tmp.*` 패턴을 보태 잔여 파일이 커밋되는 경로 자체를 막을 수 있다.

- **[INFO]** 리뷰 게이트의 ALLOW 경로(push 통과·Stop 허용)에 이전엔 없던 stdout/stderr 출력이
  새로 생겨, 호출자(모델)의 context 로 주입되는 콘텐츠가 늘었다.
  - 위치: `.claude/hooks/_lib/review_guard.py:173` (`ReviewDecision.notes: tuple[str, ...] = ()`
    필드 신설) → `.claude/hooks/guard_review_before_push.py:733-750`(`_report_notes`)와
    `:847-859`(`_evaluate_over_targets` 의 notes 누적) / `.claude/hooks/guard_review_before_stop.py:360-361`.
  - 상세: 이전엔 두 게이트 모두 ALLOW 시 아무 것도 출력하지 않았다. 이번 변경으로
    `--impl-done` consistency 세션이 자기 checker 의 `[CRITICAL]` 태그와 모순되는
    `BLOCK: NO` 를 낸 경우, push 가 실제로 허용되는 순간에도(exit 0 → 하네스가 stdout 을
    모델 context 에 주입) 경고 줄이 함께 노출된다(Stop 훅은 항상 stderr). 의도된 핵심
    기능이고(하향 감지를 "아무도 안 읽는 자리"에서 꺼내는 것이 이 PR 의 목적), 오탐 방지를
    위해 732개 세션으로 실측한 패턴만 카운트하도록 설계돼 있어 잡음 위험은 낮다. 다만
    Stop nudge(`guard_review_before_stop.py` 의 `_marker_path`/`_mark_nudged`, 세션당 1회
    throttle)와 달리 이 advisory 에는 once-per-branch 마커가 없어서, 근본 세션이 새
    consistency 세션으로 교체되기 전까지는 **spec-linked 변경을 건드리는 모든 push/턴
    종료마다 반복 출력**된다. 의도(해소 전까지 계속 알려야 함)로 보이나 두 훅의 출력 계약
    자체가 바뀌었다는 사실은 side-effect 로 명시할 가치가 있다.
  - 제안: 현재로선 문제 없음. 반복 출력이 실제로 소음이 된다고 판단되면
    `review_stop_nudged/` 류의 once-per-session 마커를 이 advisory 에도 도입하는 안을 검토.

- **[INFO]** 신설/확장된 시그니처는 전부 하위호환 확인됨 — 문제 아님, 검증 근거만 기록.
  - 위치: `.claude/hooks/_lib/review_guard.py:173`(`notes` 필드 기본값 `()`),
    `:718-720`(`_newest_resolved_impl_done_mtime(repo_root, dirty=None, notes=None)`),
    `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:53`
    (`ALL_CHECKERS = list(_block_integrity.ALL_CHECKERS)`).
  - 상세: `notes` 필드 기본값이 불변 `tuple`이라 흔한 "mutable default argument" 함정이
    없고, 기존 `ReviewDecision(blocked, reason)` 2-positional 호출부
    (`review_guard.py:916/926/935/948/955/970/980`, `test_review_guard_hardening.py:530`)가
    전부 그대로 동작한다. `_newest_resolved_impl_done_mtime` 의 3번째 파라미터도 키워드
    기본값이라 기존 2-arg 호출은 영향 없고 새 3-arg 호출(`evaluate_review` 내부,
    `test_block_integrity.py:235`)만 채워진다. `ALL_CHECKERS` 는 tuple→list 복사이고 내용·순서
    동일함을 `.claude/_shared/block_integrity.py:72-78` 대비로 확인했으며, 이후 이 변수는
    `list(ALL_CHECKERS)` 로 재복사만 되고 in-place mutate 되지 않는다
    (`consistency_orchestrator.py:70`).
  - (참고용 기록 — 조치 불필요.)

## 확인했으나 문제 없음으로 판단한 항목 (기록만)

- `merge_coordinator_orchestrator.py` 는 `_load_state`/`_save_state`/`_apply_status_update`
  만 `_shared/retry_state.py` 로 위임되고 `_reconcile_state_with_disk`(자기치유)는 의도적으로
  이식하지 않았다 — 코드 주석(`merge_coordinator_orchestrator.py:100-112`)과
  `plan/in-progress/harness-review-gate-ci-backstop.md` §9 에 후속 작업으로 명시적으로
  등재돼 있어 "조용한 동작 변화"가 아니다.
- 환경변수 읽기/쓰기, 네트워크 호출, 전역 mutable 변수, 훅 등록(`.claude/settings.json`) 변경은
  diff 전체(`git diff origin/main...HEAD -- .claude/`)에서 새로 추가된 것이 없음을 확인.
  테스트 파일의 `subprocess.run`/`env={**os.environ, "CLAUDE_PROJECT_DIR": tmp}` 은 격리된
  하네스 실행이며 실제 상태 파일에 부작용을 남기지 않는다(`test_block_integrity.py`
  `NotesReachBothHooksTest._hook_env` — `copytree` 로 격리된 `tmp/hooks` 를 실행하고
  `CLAUDE_PROJECT_DIR=tmp` 로 상태 파일 경로까지 격리).
- `failopen_state.write_streak`(`.claude/hooks/_lib/failopen_state.py:73-84`)의 JSON
  스키마는 `notes` 를 직렬화하지 않아 `.claude/state/*.json` 온디스크 포맷은 변경되지
  않았다.

## 요약

이번 변경의 핵심 부작용은 두 가지로 요약된다: (1) 세 orchestrator 의 상태 저장이 원자적 쓰기로
바뀌며 세션 디렉터리에 임시 파일이 잠깐 생기는 새로운 FS 상호작용이 생겼고(정상 종료 시
정리되며, 비정상 종료 시에만 무해한 잔여 파일 위험이 있음), (2) 리뷰 게이트의 ALLOW 경로에
"하향 모순 감지" advisory 가 새로 노출되어 모델 context 에 주입되는 출력이 늘었다(의도된
기능, 오탐 방지 실측 근거 있음, 다만 once-per-branch throttle 은 없음). 두 항목 모두 문서화된
의도와 테스트(`test_retry_state_shared.py`, `test_block_integrity.py`)로 뒷받침되고, 기존
함수/클래스 시그니처 확장은 전부 기본값으로 하위호환을 유지해 호출자 회귀가 없다. 전역 변수
신설, 예상 밖 환경변수 접근, 신규 네트워크 호출, 콜백/이벤트 배선 변경은 발견되지 않았다.

## 위험도

LOW
