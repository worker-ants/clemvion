# Requirement Review — harness-block-backstop

대상: `origin/main` 대비 15개 파일(`.claude/_shared/block_integrity.py` 신설, `.claude/_shared/retry_state.py`
신설, 세 orchestrator/두 hook/`consistency-summary` agent/SKILL.md/테스트 2건/plan 문서). 이 세션은 3R
리뷰(`review/code/2026/08/01/00_03_38`)에서 rate-limit 으로 결과를 못 낸 8개 reviewer(그중 `requirement`
포함 forced 6명) 를 메우기 위한 전체 재실행이다. 3R 이후 적용된 수정(`b06982ec4`)까지 반영된 현재 상태를
기준으로 기능 충족 관점에서 재검토했다.

## 발견사항

- **[WARNING]** `evaluate_review()` Gate 2 의 "stale --impl-done 세션" 차단 분기가 직접 수집한 `notes` 를
  버린다.
  - 위치: `.claude/hooks/_lib/review_guard.py:979-986` (`if newest_impl_done < newest_spec_code:` 분기의
    `ReviewDecision(True, f"...spec-linked file(s) changed AFTER...")` 반환). 대조:
    `:964`(`notes: list[str] = []` 초기화), `:718`·`:756-759`(`_newest_resolved_impl_done_mtime` 이
    `best_dir` 이 채택된 세션에 하향 모순이 있으면 `notes.append(...)` 로 채움), `:998`(정상 ALLOW
    반환에만 `tuple(notes)` 전달).
  - 상세: Gate 2 가 채택하는 세션(`best_dir`)이 (a) `[CRITICAL]` 하향 모순도 있고 (b) spec-linked 코드보다
    stale 하기도 한 경우, `_newest_resolved_impl_done_mtime` 은 `notes` 리스트에 경고를 정상적으로
    추가하지만, 979-986 라인의 `ReviewDecision` 생성자는 `notes` 인자를 넘기지 않아(dataclass 기본값
    `()` 로 대체) 그 경고가 통째로 사라진다. 이 시나리오에서는 push/turn-종료가 어차피 차단되므로
    "잘못된 ALLOW" 는 아니지만, 모델이 받는 사유 문자열에는 "재실행하라" 는 안내만 있고 그 세션이
    하향까지 겪었다는 사실은 빠진다 — 이 backstop 이 존재하는 이유(하향을 "보이게" 만드는 것)가 바로 이
    경로에서 무효화된다. 첫 번째 차단 분기(`newest_impl_done <= 0.0`, :969-978)는 `best_dir` 자체가
    빈 문자열이라 애초에 잃을 note 가 없어 문제 없음 — 오직 두 번째 분기만 해당.
  - 검증: `test_review_guard.py::SpecConsistencyGateTest.test_spec_linked_with_stale_impl_done_blocks`
    는 `_newest_resolved_impl_done_mtime` 자체를 `mock.patch.object(..., return_value=impl_done_mtime)`
    로 통째로 대체해 `notes` 수집 로직을 우회하며, `d.notes` 를 단언하지도 않는다 — 이 경로는 현재
    테스트 스위트(738건 전부 통과)에서 검증되지 않는다. 3R SUMMARY(`review/code/2026/08/01/00_03_38`)의
    INFO #2 와 동일한 관측이며 아직 미수정 상태다 — "반환값: 모든 경로에서 적절한 값을 반환하는지" 가
    본 리뷰의 명시 관점이라 WARNING 으로 재기재한다.
  - 제안: `notes` 를 로컬 변수로 들고 있다가 마지막에만 붙이지 말고, Gate 2 의 두 차단 `ReviewDecision`
    생성자에도 `tuple(notes)` 를 전달할 것(세 번째 위치/키워드 인자로 균일하게).

- **[WARNING]** `plan/in-progress/harness-review-gate-ci-backstop.md` 의 `worktree:` frontmatter 가
  이미 사라진 worktree 를 가리킨 채로 이번 PR 이 그 문서 본문을 대폭 갱신한다.
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:1-7` (frontmatter, 특히 3번째 줄
    `worktree: harness-review-gate-fixes-1bd6aa`).
  - 상세: `.claude/docs/plan-lifecycle.md` 는 `worktree:` 를 "이 plan 이 살아있는 worktree 디렉토리
    이름" 으로 정의하고, push/plan 게이트의 "연결 판정" 이 바로 이 필드와 **현재 worktree** 를 매칭해
    이 plan 이 이 브랜치에 연결됐는지 결정한다(`plan-lifecycle.md` §연결 판정). 실측: `git worktree
    list` 에 `harness-review-gate-fixes-1bd6aa` 는 존재하지 않고, 로컬 브랜치 목록에도 없다 — 이미
    reap 됐거나 merge 됐다. 반면 이 문서는 `origin/main` 대비 19줄이 바뀌었고(§관측 처리 현황 배너,
    항목 2 취소선 처리, 신규 후속 10건 등재) 전부 **현재** worktree(`harness-block-backstop-b56163`,
    브랜치 `claude/harness-block-backstop-b56163`) 에서 작성됐다 — `worktree:` 필드는 이 diff 에서
    건드리지 않아 origin/main 과 동일한 stale 값 그대로다. 결과적으로 `plan-stale-audit.sh`/`plan_coherence`
    checker 류가 "이 plan 을 현재 이 worktree 가 살아 있게 유지 중" 이라는 사실을 인식하지 못한다.
  - 제안: `worktree: harness-block-backstop-b56163` 로 갱신(이 작업이 끝나고 다음 worktree 로 다시
    넘어간다면 그때 또 갱신).

- **[INFO]** `merge_coordinator_orchestrator.py` 가 상태 helper 추출 과정에서 "# Git / gh helpers"
  섹션 구분 주석을 유실했다 — 다른 두 orchestrator 에서 같은 원인으로 유실된 주석(router-trust
  근거·"File / corpus collection" 구분자)은 `b06982ec4`("3R 부분 리뷰 반영 — 리팩터가 무관한 근거
  주석을 삼킨 사고 포함")에서 원본 그대로 복원됐지만, 이 세 번째 인스턴스는 복원되지 않았다.
  - 위치: `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:100-125`
    (`_load_state`/`_save_state`/`_apply_status_update` 위임 함수들과 `_git`/`_gh` 사이). 원본
    위치는 `git show origin/main:.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py`
    143-145번째 줄("# ---" + "# Git / gh helpers" + "# ---").
  - 상세: 순수 레이블(정보 손실 없음)이라 기능·근거 손실인 router-trust 주석 건과 달리 실질적 영향은
    없으나, 같은 결함 클래스가 3곳 중 2곳만 고쳐진 비일관 상태다.
  - 제안: `_gh` 함수 앞에 동일한 3줄 구분자 복원(선택 사항, 낮은 우선순위).

- **[INFO]** `block_integrity.summary_block_verdict()` 의 END-우선 판정 규칙에 이론적 잔여 엣지 케이스가
  있다.
  - 위치: `.claude/_shared/block_integrity.py:60-65`(`_BLOCK_AT_LINE_START`/`_BLOCK_AT_LINE_END`),
    `:96-107`(`summary_block_verdict`).
  - 상세: 실제 732개 세션 표본에서는 안전하다 — 자동 생성 템플릿 줄은 `## 출력 형식` 규약상 항상
    `**BLOCK: {YES/NO}** — 설명` 처럼 검증문구가 뒤따르므로 END 패턴에 걸리지 않고, 사람이 다는 override
    배너만 그 줄 끝에서 끝나 END 에 걸리는 게 보통이다. 그러나 이 구분은 문서 관례일 뿐 코드로 강제되지
    않는다 — 만약 summary 가 트레일링 설명 없이 맨몸 `## BLOCK: YES` 를 쓰고, 그 **뒤에** 사람이
    override 배너(`**BLOCK: NO**`, 역시 END 매치)를 덧붙이면, `.search()` 는 텍스트에서 먼저 나오는
    END 매치(맨몸 stale 템플릿 줄)를 반환해 override 이전 판정을 채택한다 — "배너가 이긴다" 는 설계
    의도와 반대 결과. 측정된 4가지 실제 불일치 사례는 전부 override 가 물리적으로 앞서거나 superseded
    줄에 부연 설명이 붙어 있어 이 경로를 건드리지 않는다.
  - 제안: 낮은 우선순위(실측 코퍼스에 미관측). 필요 시 override 배너에만 있는 별도 마커(`✅`/`최종
    판정` 등 이미 쓰이는 관용구)를 앵커에 포함해 "맨몸 템플릿" 과 "배너" 를 구조적으로 구분.

- **[INFO]** `_shared/retry_state.load_state()` 는 파일이 없을 때는 우아하게 처리하지만(stderr 메시지 +
  `sys.exit(1)`), 파일은 있으나 JSON 이 손상된 경우 `json.load(f)` 가 그대로 raw traceback 과 함께
  크래시한다 — 3R 에서 고친 W7(`save_state` 를 tmp+`os.replace` 로 원자화)은 "쓰기 도중 읽어 잘린 JSON
  을 보는" 구체적 원인 하나만 구조적으로 제거했고, 다른 원인(수동 편집 손상 등)으로 인한 손상은 여전히
  비대칭 처리로 남는다.
  - 위치: `.claude/_shared/retry_state.py:41-47`(`load_state`).
  - 상세: 잔여 리스크이며 이번 PR 이 새로 만든 결함은 아니다(원본에도 있던 비대칭). atomic write 로
    가장 흔한 발생 경로는 이미 막혔으므로 심각도는 낮음.
  - 제안: 필요 시 `json.JSONDecodeError` 를 잡아 "파일 없음" 과 대칭적인 사용자 메시지로 변환(선택 사항).

## 확인된 사항 (양호 — 재확인 완료, 별도 조치 불요)

- 하향 금지 backstop 의 핵심 로직(`count_critical_tags`/`summary_block_verdict`/`downgraded_criticals`/
  `contradiction_note`)은 5개 checker 파일명·finding 태그 형식(`- **[CRITICAL]**`/`### [CRITICAL]`)이
  실제 5개 checker agent 정의(`cross-spec-checker.md` 등)의 출력 템플릿과 정확히 일치하고, 위험도 등급
  줄(`NONE/LOW/…/CRITICAL`)은 대괄호 없이 출력되도록 템플릿이 규정돼 있어 오탐(risk-scale 을 finding 으로
  오인)이 구조적으로 방지된다.
  `ALL_CHECKERS` 는 `consistency_orchestrator.py` 가 `_block_integrity.ALL_CHECKERS` 에서 파생하고
  (`consistency_orchestrator.py:53`), `test_block_integrity.py::CheckerListIsCanonicalTest` 가 이
  파생 관계 + `role_instructions.CHECKER_INSTRUCTIONS` 와의 동치성까지 3개 지점 모두 고정한다(3R
  WARNING #5 fix 확인).
- `_newest_resolved_impl_done_mtime` 이 게이트가 실제 채택하는 세션(가장 최근 것) 하나에만 모순 검사를
  적용하고 과거 세션 전체를 재경고하지 않는 설계는 plan 문서·테스트(`test_only_the_session_the_gate_adopts_is_checked`)
  와 일치하며, "매 push/turn-종료마다 우는 경고" 를 피하려는 의도가 정확히 반영됐다.
  `--spec`/`--plan`/`--impl-prep` 모드 consistency 세션에는 이 backstop 이 적용되지 않는데, 이는 범위
  누락이 아니라 설계 의도다 — push/stop 게이트가 신뢰(consume)하는 세션은 `--impl-done` 세션뿐이므로
  다른 모드에 경고를 달아도 아무 게이트도 그것을 읽지 않는다.
- `guard_review_before_push.py`/`guard_review_before_stop.py` 양쪽 모두 advisory `notes` 스트림
  선택이 각 훅의 프로토콜 제약과 정확히 일치한다 — push 는 exit code 로(`_report_notes`, exit 2→stderr /
  exit 0→stdout), stop 은 항상 stderr(stdout 이 `{"decision":...}` JSON 프로토콜이므로). 두 훅 다
  `finally` 블록에서 실행되어 차단 경로에서도 announce 된다. `failopen_state.Outcome.__init__` 과 push
  훅의 fallback `_Outcome` 양쪽에 `notes` 필드가 정식 선언돼 있어(3R WARNING #4 fix 확인) 두 "공식 필드
  목록" 이 일치한다.
- `_shared/retry_state.py` 로의 5개 함수 추출은 `code_review_orchestrator.py`/`consistency_orchestrator.py`
  양쪽에서 위임 형태로 정확히 재현됐고(`test_retry_state_shared.py` 로 CLI 계약 — stdout 라인·stderr
  "reconciled" 통지 — 양쪽 다 pin), `merge_coordinator_orchestrator.py` 는 3개 함수만 위임하고
  `reconcile_state_with_disk` 는 의도적으로 이관하지 않음(plan 후속 #9 로 별도 PR 결정, 실제 코드도
  그 결정과 일치). `code_review_orchestrator.py` 의 router-trust 근거 주석(2026-07-23 `selected=false`
  사건 + #244 폐기 이력)과 `consistency_orchestrator.py` 의 섹션 구분 주석은 3R 사고("함수 사이 주석까지
  삼킴")에서 실제로 복원됐음을 `grep` 으로 직접 확인.
- `.claude/agents/consistency-summary.md`/`.claude/skills/consistency-checker/SKILL.md` 의 갱신
  문구는 "게이트가 이제 checker `[CRITICAL]` 과 모순되면 경고하지만 차단은 아니다(하향 금지 조항이
  여전히 1차 방어)" 를 정확히 서술하며 실제 코드 동작(경고만, 차단 아님)과 일치.
  전체 harness 테스트 스위트 738건 실행 결과 전부 통과, TODO/FIXME/HACK/XXX 신규 추가 없음, 신규 CI
  워크플로 변경 없음(plan 의 "CI 백스톱 본체: 미착수" 서술과 일치).

## 요약

핵심 요구사항(§요약 지침 3 하향 금지에 대한 기계적 backstop 신설, `_retry_state.json` bookkeeping 5종의
`_shared/` 추출)은 line-level 로 문서(`plan/in-progress/harness-review-gate-ci-backstop.md`,
`consistency-summary.md`, `consistency-checker/SKILL.md`)와 정확히 일치하게 구현됐고, 이전 라운드
(1R~3R)에서 지적된 항목 대부분이 실제로 반영됐음을 코드·git 이력으로 직접 확인했다. 남은 결함은 모두
좁은 범위다: Gate 2 의 stale-session 차단 분기가 수집된 하향-모순 advisory 를 버리는 완결성 gap(이미
차단은 정상 발생하므로 안전 방향의 미스지만 이 backstop 의 존재 이유를 약화시킴, WARNING) 과, 이번
PR 이 대폭 편집한 plan 문서 자신의 `worktree:` frontmatter 가 이미 사라진 worktree 를 가리키는 프로세스
정합성 결함(WARNING) 이다. 나머지는 코스메틱(주석 유실 1건)이거나 실측 코퍼스 밖의 이론적 엣지 케이스,
혹은 이미 부분 완화된 잔여 리스크로 INFO 수준이다.

## 위험도

LOW
