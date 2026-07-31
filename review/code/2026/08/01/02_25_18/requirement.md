# 요구사항(Requirement) Review

리뷰 대상: `.claude/_shared/block_integrity.py`(신규) · `.claude/_shared/retry_state.py`(신규) ·
`.claude/agents/consistency-summary.md` · `.claude/hooks/_lib/failopen_state.py` ·
`.claude/hooks/_lib/review_guard.py` · `.claude/hooks/guard_review_before_push.py` ·
`.claude/hooks/guard_review_before_stop.py` ·
`.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` ·
`.claude/skills/consistency-checker/SKILL.md` ·
`.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` ·
`.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py` ·
`.claude/tests/test_block_integrity.py`(신규) · `.claude/tests/test_consistency_orchestrator_state.py` ·
`.claude/tests/test_retry_state_shared.py`(신규) · `.claude/tests/test_stop_guard_failopen.py` ·
`.claude/tests/README.md` · `plan/in-progress/harness-review-gate-ci-backstop.md`
(`git diff origin/main...HEAD` 로 실제 델타 확인, 17개 파일 1,511+/291-. 5개 대형 파일은 프롬프트에서
잘려 `Read` 로 직접 전문 확인함. `python3 -m unittest discover -s .claude/tests` 750건 전수 실행,
`__pycache__` 제거 후 재실행까지 확인 — 전부 OK.)

## 발견사항

- **[CRITICAL]** `_BLOCK_AT_LINE_START` 정규식이 O(n²) — 대형/장식적 SUMMARY.md 로 push·turn-end 게이트가 통째로 멎을 수 있다
  - 위치: `.claude/_shared/block_integrity.py:60-62` (정규식 정의), 소비 경로는 `:117-119`
    (`summary_block_verdict`) → `.claude/hooks/_lib/review_guard.py`
    `_summary_block_is_no`(신규 위임 지점, 리뷰 대상 diff) → `evaluate_review()` → 두 훅
    (`guard_review_before_push.py`, `guard_review_before_stop.py`) 가 매 `git push` / 매
    turn-end 마다 동기 호출.
  - 상세:
    ```python
    _BLOCK_AT_LINE_START = re.compile(
        r"^[\s>#*_`-]*BLOCK:\s*\**\s*(YES|NO)", re.IGNORECASE | re.MULTILINE
    )
    ```
    선두 문자 클래스 `[\s>#*_\`-]` 안의 `\s` 가 개행(`\n`)까지 포함한다. `re.MULTILINE` 의 `^` 는
    모든 줄 시작에서 매치를 시도하는데, 매 줄 시작에서 이 탐욕적 문자 클래스가 **다음 줄들까지
    개행을 건너뛰며 흡수**했다가 "BLOCK:" 을 못 찾고 한 글자씩 되돌아오는 과정을, 문서 안의
    **모든** 줄 시작 위치에서 반복한다 — 줄 수 × 문서 길이로 스케일하는 전형적인 O(n²).
    측정(동일 프로세스에서 3회 배증, 리뷰 세션이 실제로 생성할 법한 형태 — 인용/장식 기호로
    이뤄진 블록쿼트 줄 반복, `BLOCK:` 없음):
    ```
    n_lines=1000  len=64,000    time=0.167s
    n_lines=2000  len=128,000   time=0.654s   (×2 입력 → ×3.91 시간)
    n_lines=4000  len=256,000   time=2.650s   (×2 입력 → ×4.06 시간)
    n_lines=8000  len=512,000   time=10.449s  (×2 입력 → ×3.94 시간)
    n_lines=16000 len=1,024,000 time=43.934s
    ```
    ×2 입력마다 시간이 ~×4 로 뛰는 것을 3회 연속 재현 — 잡음이 아니라 확정적 이차 스케일링이다.
    반면 짝 함수 `_BLOCK_AT_LINE_END` 는 같은 입력에서 선형(1,024,000자에서 4ms)이라 END 쪽엔
    이 결함이 없다. 소비 경로에 크기 상한이 전혀 없다는 점이 이를 실제로 도달 가능하게 만든다 —
    `block_integrity._read()` 와 `review_guard._summary_block_is_no()` 둘 다 "전체를 읽는다"
    (후자는 주석으로 명시: "Read the whole file: a 4 KB cap could miss a BLOCK: line…"). 오늘
    커밋된 실제 `review/consistency/**/SUMMARY.md` 732개는 최대 10,998바이트·p99 9,457바이트,
    이 규모에서는 0.135ms 로 무해함을 직접 측정 확인했다 — 즉 **현재는 실제로 발현하지 않는다.**
    다만 (a) 이 함수의 입력(SUMMARY.md)은 LLM 이 생성하는 자유 형식 markdown 이라 크기 상한이
    강제돼 있지 않고, (b) 같은 저장소의 자매 파일 `guard_review_before_push.py` 의 `_GIT_PUSH`
    정규식은 정확히 이 클래스(이차/파국적 backtracking)로 §J·§L·§M·§O 에 걸쳐 여러 차례 CRITICAL
    로 재발·수정된 이력이 있고, 그 교훈으로 `_MAX_REDACTION_INPUT = 16_384` 같은 명시적 입력
    상한을 이미 두고 있다 — 이번 신규 정규식(`_shared/block_integrity.py`, 바로 이 PR 이 신설)은
    그 교훈이 적용되지 않은 채 같은 위험 클래스를 되풀이했다. 훅이 오래 멎으면(하네스의 훅 타임아웃
    도달 시) fail-open 으로 게이트 자체가 열릴 수 있어, "느림" 을 넘어 리뷰-커버리지 게이트 우회
    벡터가 될 가능성도 있다(하네스의 정확한 훅 타임아웃 처리는 이 저장소 밖이라 단정은 아님).
    수정 검증: 선두 클래스에서 `\s` 를 줄내 공백만 남기도록 좁히면(`[ \t>#*_\`-]*`) 동일 적대적
    입력(1,024,000자, n_lines=1600 기준)이 0.063초로 선형화됨을 직접 확인했고, 이 변경을 적용한
    채 `.claude/tests` 전수(750건)를 재실행해 회귀 없음(전부 OK)도 확인했다(검증 후 원본으로
    복원, 저장소에는 미반영).
  - 제안: `_BLOCK_AT_LINE_START` 의 선두 문자 클래스에서 `\s` 를 같은 줄 공백류(`[ \t]` 등,
    개행 제외)로 좁힌다 — 의도(같은 줄 위의 들여쓰기/장식 기호 허용)는 그대로 유지되고 교차-줄
    이차 스캔만 제거된다. 추가로 `guard_review_before_push.py._MAX_REDACTION_INPUT` 과 같은
    선례를 따라 `_read()`/`summary_block_verdict()` 경로에도 입력 크기 상한(및 초과 시의 안전한
    폴백)을 두는 것을 권한다 — SUMMARY.md 는 항상 작다는 전제가 지금은 참이지만 강제되지 않는다.
    (참고: 같은 세션의 `performance.md` 리뷰는 "이번에 추가된 코드는 성능 문제가 없다" 로
    결론지었는데, 위 실측이 이와 상충한다 — 재현 스크립트를 그대로 실행해 대조 확인 가능.)

- **[INFO]** spec fidelity — 이 변경 영역을 규정하는 `spec/` 문서 없음 (정상)
  - 위치: 해당 없음 (영역 전체)
  - 상세: `spec/` 전 트리에서 `review_guard`·`block_integrity`·`retry_state`·
    `consistency-summary`·`guard_review_before_*` 를 grep 했으나 0건. `CLAUDE.md` 의 정보 저장
    위치 표에 따르면 `spec/` 은 "제품 정의·기술 명세"(= `codebase/` 가 구현하는 제품 표면) 전용이고,
    `.claude/` 하네스 자체의 규약은 `plan/in-progress/harness-review-gate-ci-backstop.md` 와
    각 모듈 docstring 이 SoT 다 — 실제로 이번 PR 의 각 파일이 매우 상세한 근거·측정치 포함
    docstring 을 갖추고 있어 이 구조와 일치한다. spec 누락이 아니라 애초에 spec 대상이 아닌
    영역이다.

- **[INFO]** `summary_block_verdict` 의 END-anchor 절대 우선 설계 — 이미 문서화된 잔여 엣지케이스
  - 위치: `.claude/_shared/block_integrity.py:96-120` (`summary_block_verdict`)
  - 상세: END-anchor 매치가 하나라도 있으면 START-anchor 매치는 전혀 고려되지 않는다. 함수
    자신의 docstring 이 "Among several *equally* end-anchored verdicts the anchor cannot
    choose, and there the **last** wins… That tiebreak is a judgement call, not something
    the corpus demonstrates" 라고 스스로 한계를 명시하고 1,504개 실제 문서로 검증(충돌 2건,
    둘 다 안 뒤집힘)까지 마쳤다. 이론적으로는 "실제 판정 위 어딘가에 있는, 마침표 없이
    'BLOCK: NO/YES' 로 줄이 끝나는 서술문"이 END-anchor 로 오인되어 진짜 START-anchor 판정을
    무시할 잔여 가능성이 있으나, 실측 근거가 이미 충분히 제시돼 있고 저자도 "corpus 가 증명하지
    않는 판단"이라고 스스로 표시해 뒀다. 새로운 결함이 아니라 이미 인지·측정된 트레이드오프라
    INFO 로만 남긴다.

- **[INFO]** `merge_coordinator_orchestrator.py` 는 여전히 `reconcile_state_with_disk` 자기치유가 없음 — 이미 추적된 후속(#9), 이번 diff 의 회귀 아님
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:85`
    (`_emit_summary_state` — reconcile 호출 없이 바로 상태를 읽음), `:113-124`
    (`_load_state`/`_save_state`/`_apply_status_update` 는 `_shared/retry_state.py` 로 위임됐지만
    `_reconcile_state_with_disk` 동급 함수 자체가 이 파일에 없음).
  - 상세: 다른 두 orchestrator(`code_review_orchestrator.py`, `consistency_orchestrator.py`) 는
    이번에 `_shared/retry_state.reconcile_state_with_disk` 로 자기치유를 갖췄지만
    merge-coordinator 는 원래도 이 함수가 없어 위임할 대상이 없었다. Agent tool 로 직접 fan-out 한
    세션이 prepare 시점 스냅샷에 멈춘 채 SUMMARY 는 실제 성공을 보고하는 모순을 그대로 겪는다.
    코드 주석과 `plan/in-progress/harness-review-gate-ci-backstop.md` 항목 9 양쪽에 "다른 skill
    의 동작 변경이라 별도 PR 로 분리한다" 로 명시적으로 defer 돼 있어 이번 diff 의 새 회귀가
    아니다 — 참고로만 남긴다.

- **[INFO]** plan 항목 #11(`--branch` 가 `--files` 를 조용히 덮어씀)은 실재하는 게이트 결함이지만 이번 17개 파일 diff 밖
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`
    (`collect_change_infos` 의 if/elif 체인 — 이번 diff 에서 미변경, `git diff origin/main...HEAD`
    로 확인)
  - 상세: 이 리뷰가 대상으로 받은 17개 파일에는 포함돼 있지 않다(순수 `_shared/retry_state.py`
    위임 리팩터만 존재). `plan/in-progress/harness-review-gate-ci-backstop.md` 항목 11 에 재현
    표·근본 원인(if/elif 도달 불가 분기 + 호출자 zsh unquoted 변수 word-splitting 미발생이 겹친
    것)·최소 조치안이 이미 상세히 기록돼 있고, 실제로 이 리뷰 세션 진행 중에도 원인 서술이 한 번
    더 정정되는 것(커밋 `777680618`)을 직접 관측했다 — 살아있는 문서다. 이번 diff 의 결함으로
    새로 지목하지 않고 컨텍스트로만 남긴다.

## 기타 확인 사항 (결함 아님, 검증 근거)

- TODO/FIXME/HACK/XXX 주석: 17개 파일 전체 grep 0건.
- `datetime.utcnow()`(`retry_state.apply_status_update`) 는 Python 3.12+ 에서 deprecated 이지만
  리팩터 이전 코드를 AST 동일성 검증 후 그대로 옮긴 것(신규 도입 아님) — 환경의 Python 3.11 에서는
  경고조차 없음. 지적하지 않음.
  `removesuffix` 회피 주석("이 트리의 첫 사용이 될 것")도 `grep -rn removesuffix .claude` 로 사실
  확인(실제로 0건) — 근거가 정확하다.
- `count_critical_tags`/`ALL_CHECKERS`/`CHECKER_REPORTS`/`downgraded_criticals`/`contradiction_note`
  의 비즈니스 규칙("BLOCK: NO + 어떤 checker 든 [CRITICAL] 1개 이상 → 경고, 근거 불문 — §요약
  지침 3 의 무조건 하향 금지와 정확히 대응")과 스코프 제한("--impl-done 세션에만 적용, 세 문서
  `consistency-summary.md`/`consistency-checker/SKILL.md`/`review_guard.py` docstring 이 동일한
  문구로 동기화돼 있음을 3자 대조 확인")을 코드로 직접 추적해 일치를 확인.
  `--impl-prep`/`--spec`/`--plan` 세션이나 spec-linked 변경이 없는 경우는 이 백스톱이 적용되지
  않는다는 제약도 세 문서 모두 동일하게 명시돼 있어 drift 없음.
  `_newest_resolved_impl_done_mtime` 이 "게이트가 실제로 채택한 세션 하나만" 검사하도록 설계된
  것도 `test_only_the_session_the_gate_adopts_is_checked` 로 고정돼 있고 의도와 일치.
- `_shared/retry_state.py` 로의 이관: `_load_state`/`_save_state`/`_reconcile_state_with_disk`/
  `_apply_status_update` 4종은 두 orchestrator(code-review, consistency) 원본과 AST 동일성이
  선행 검증됐고(docstring 자체가 그 근거를 명시), 위임 후 동작도 `test_retry_state_shared.py` +
  `test_consistency_orchestrator_state.py` + 기존 `test_orchestrator_state.py` 로 3면 교차
  검증됨. `save_state` 의 임시파일+`os.replace` 원자적 쓰기와 실패 시 원본 보존을
  `AtomicWriteTest` 로 직접 확인(성공 시 temp 잔존 0, 실패 시 원본 불변 + temp 정리).
- notes(하향 경고) 배선: `evaluate_review()` 의 Gate 2 세 반환 경로 전부가 `notes` 를 실어
  나르는지(AST 로 3곳 확인), push 훅이 exit code 에 따라 stdout/stderr 를 올바르게 고르는지,
  stop 훅이 세션+branch+**노트 텍스트 해시**로 스로틀(직전 라운드에 `enumerate` 인덱스로
  스로틀해 첫 경고 이후 모든 경고가 영구 억제되던 CRITICAL 을 이미 수정)하는지를 코드 추적 +
  `test_block_integrity.py` 의 `NotesReachBothHooksTest`/`StopThrottleKeysOnTextTest`/
  `NotesSurviveBlockingTest` 로 교차 확인 — 전부 일치.
- 전체 테스트: `python3 -m unittest discover -s .claude/tests -p "test_*.py"` 750건, 두 번
  (원본 1회 + `__pycache__` 삭제 후 재실행 1회) 전부 `OK`. 실행 후 `.claude/state/` 에 잔존
  fail-open 상태 파일 없음(하네스 스스로의 격리 테스트 `SuiteLeavesNoRealStateTest` 포함) 확인.
  `git status --porcelain` 로 리뷰 중 발생시킨 부작용 없음(위 CRITICAL 검증용 임시 수정은
  스크래치패드 백업 후 원복, diff 없음)도 확인.

## 요약

이번 라운드(7R)의 실제 소스 diff(17개 파일, `_shared/block_integrity.py`·`_shared/retry_state.py`
신설 + 세 orchestrator 의 상태 bookkeeping 위임 + 하향-모순 advisory 배선)는 기능적으로는 의도한
대로 동작한다 — 비즈니스 규칙(하향 금지 백스톱의 발동 조건·스코프 제한), 세 문서 간 서술 동기화,
notes 배선의 모든 반환 경로, 상태 위임의 동작 동일성을 전부 코드 추적과 750건 테스트 전수 실행으로
직접 검증했고 불일치를 찾지 못했다. 다만 이 리뷰가 능동적으로 성능/엣지케이스 스트레스 테스트를
수행한 결과, 신규 도입된 `_BLOCK_AT_LINE_START` 정규식이 개행을 포함하는 문자 클래스와
`re.MULTILINE` `^` 앵커의 상호작용으로 실제 O(n²) 동작(2배 입력마다 약 4배 시간, 3회 연속 재현)을
갖고 있음을 확인했다 — 이 정규식은 push/turn-end 를 게이트하는 동기 경로에서 크기 상한 없이 임의
길이의 SUMMARY.md 를 처리하며, 같은 저장소의 자매 파일이 정확히 이 클래스의 버그를 여러 차례
CRITICAL 로 다뤄온 전례와 대비된다. 오늘 커밋된 실제 데이터(최대 11KB)에서는 발현하지 않지만,
크기를 강제하는 장치가 없어 향후 트리거 가능성이 남아 있고 수정은 한 줄(문자 클래스를 줄내 공백으로
좁히기)로 검증까지 마쳤다. 그 외에는 spec 문서 부재(정상), 이미 추적된 두 건의 별도 후속(#9
merge-coordinator 자기치유 부재, #11 `--branch`/`--files` 상호작용)만 컨텍스트로 남긴다.

## 위험도

HIGH
