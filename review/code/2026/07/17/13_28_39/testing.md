# 테스트(Testing) 리뷰 — forced-coverage-gate

## 검증 방법

- `.claude/tests/test_review_guard.py`, `.claude/tests/test_orchestrator_state.py` 전체 파일(diff 아닌 실 파일)을 읽고 대응하는 실 소스(`review_guard.py`, `code_review_orchestrator.py`, `consistency_orchestrator.py`)와 대조.
- `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` 로 하네스 전체 스위트(232건) 재실행 — **OK, 회귀 없음** (plan 체크리스트 §7 의 "232 OK" 주장과 일치).
- 의심 지점 2건은 실제 `code_review_orchestrator.py --resume` / `consistency_orchestrator.py --summary-state` 를 임시 세션에 직접 실행해 재현 확인(아래 WARNING 참조). 재현에 쓴 임시 디렉토리는 정리함.

## 발견사항

- **[WARNING]** `consistency-checker/SKILL.md` 의 신규 "자동 self-heal" 서술이 실제 `consistency_orchestrator.py` 동작과 불일치 — 실측으로 반증됨, 대응 테스트 0건
  - 위치: `.claude/skills/consistency-checker/SKILL.md` (diff 의 "**상태 기록은 자동이다**" 문단) vs `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:95-102`(`_emit_summary_state`), `:600-616`(`--resume`/`--summary-state` 핸들러)
  - 상세: 이번 diff 는 code-review-agents SKILL.md 에 넣은 문구를 consistency-checker SKILL.md 에도 그대로 복사해 "`--summary-state`/`--resume` 가 읽을 때 디스크로 자가 reconcile 하므로 수동 호출 의무는 없다" 라고 서술한다. 그런데 self-heal 함수(`_reconcile_state_with_disk`)는 이번 diff 에서 **오직 `code_review_orchestrator.py` 에만** 추가됐고, `consistency_orchestrator.py` 의 `_emit_summary_state`/`--resume`/`--update` 는 전혀 수정되지 않았다(그대로 `_load_state` 만 호출하는 구코드). 직접 재현:
    ```
    # cross_spec.md 가 디스크에 이미 존재하는데도
    $ python3 consistency_orchestrator.py --summary-state <sd>
    pending=2 success=0 fatal=0 last_reset=null   # 산출물 무시, 그대로 stale
    ```
    `_retry_state.json` 도 변경되지 않았다 — 문서 서술과 정반대. `.claude/tests/` 에는 `consistency_orchestrator.py` 의 `--resume`/`--summary-state`/`--update` 상태 머신을 검증하는 테스트가 **아예 없다**(코드-리뷰 쪽만 `test_orchestrator_state.py` 로 커버되고, README.md 의 커버리지 표에도 consistency 쪽 상태-머신 행이 없음). 이 불일치를 잡아낼 안전망이 없었던 것이 근본 원인이다. 이 문서는 향후 세션이 "수동 호출 의무 없음" 을 그대로 믿고 따르는 운영 지침이라, 정확히 이 PR 이 없애려는 "산문 의무가 압력 아래 무너진다" 패턴을 consistency-checker 쪽에 새로 심는 셈이다.
  - 제안: (a) `consistency_orchestrator.py` 에도 `_reconcile_state_with_disk`/`_report_paths` 를 이식해 SKILL.md 서술을 코드로 뒷받침하거나, (b) 서술을 되돌려 "완료 후에는 `code_review_orchestrator.py --sync-from-disk <session_dir>` 를 명시 호출해야 한다" 로 정정. 어느 쪽이든 `test_orchestrator_state.py` 에 대응하는 `consistency_orchestrator.py` 상태-머신 테스트(최소 self-heal 여부를 확정하는 1건)를 추가할 것.

- **[WARNING]** `_reconcile_state_with_disk` 가 `agents_fatal` 버킷과 상호작용할 때의 동작이 미검증 — "fatal" 리뷰어가 매 읽기(`--resume`/`--summary-state`)마다 `agents_pending` 으로 부활하며 동시에 `agents_fatal` 에도 잔류(이중 멤버십)
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:158-186`(`_reconcile_state_with_disk`)
  - 상세: `missing = [n for n in known if n not in on_disk and n not in skipped]` 는 `agents_fatal` 을 제외 목록에 넣지 않는다. 재현:
    ```
    # agents_fatal=["security"], 산출물 없음 상태에서
    $ python3 code_review_orchestrator.py --resume <sd>
    # 결과: agents_pending=["security"] (부활) 이면서 agents_fatal=["security"] 도 그대로 — 모순된 이중 상태
    ```
    이 로직 자체(`_sync_from_disk` 원본)는 이번 diff 이전부터 있었지만, 그때는 사람이 명시적으로 `--sync-from-disk` 를 호출할 때만 실행되는 "가끔 쓰는" 경로였다. 이번 diff 로 `--resume`/`--summary-state` 라는 **상시 읽기 경로**에 자동 연결되면서 이 잠재 결함의 노출 빈도가 크게 늘었는데, 새로 추가된 테스트(`test_reconcile_on_read_preserves_rate_limit_bookkeeping` 등)는 `rate_limit_episodes`/`last_reset_hint_sec` 보존만 검증하고 `agents_fatal` 케이스는 다루지 않는다 — 정확히 대칭되는 자리에 테스트가 빠져 있다.
  - 제안: `agents_fatal` 이었던 에이전트를 reconcile 후에도 fatal 로 유지(=`missing`/`agents_pending` 에서 제외)할지, 의도적으로 pending 재시도 대상으로 되돌릴지(그렇다면 `agents_fatal` 에서 제거) 결정하고 그 결정을 고정하는 회귀 테스트 추가.

- **[INFO]** `_newest_resolved_review_mtime`/`_iter_summaries` 의 교차 세션(cross-session) "가장 최신의 resolved 리뷰 선택" 로직이 실 파일 기반 통합 테스트 없이 전부 mock 처리됨
  - 위치: `.claude/tests/test_review_guard.py` `EvaluateDecisionTableTest`/`SpecConsistencyGateTest` (둘 다 `_newest_resolved_review_mtime` 를 `mock.patch.object` 로 대체); `grep` 결과 스위트 전체에서 `rg._newest_resolved_review_mtime(` 직접 호출은 0건.
  - 상세: `plan/in-progress/forced-coverage-gate.md` 는 "교차 세션 커버리지 자연 처리: 더 최신의 완전한 세션이 있으면 통과 (내 `01_27_10`(미충족) → `08_17_35`(충족) 사례가 정확히 이 모양)" 을 동작 근거로 든다. 그러나 이 시나리오(세션 A: forced 미충족 → skip 돼야 함, 세션 B: forced 충족 & 더 최신 → 채택돼야 함)를 실 파일 2개 세션으로 구성해 `_newest_resolved_review_mtime` 가 세션 B 시각을 반환하는지 검증하는 자동화 테스트는 없다 — 검증은 저자의 1회성 수동 관찰뿐이다. (참고: 이 통합 지점은 이번 diff 이전부터 항상 mock 되어 온 기존 관례라, 이번 diff 가 새로 만든 gap 이라기보다 고위험 신규 게이트가 의존하게 된 지점인데도 메워지지 않은 기존 공백에 가깝다.)
  - 제안: `_iter_summaries`+`_summary_is_resolved`+`_newest_resolved_review_mtime` 을 실 tempdir 세션 2개(미충족·충족, 서로 다른 세션 타임스탬프 경로)로 구성해 최신 충족 세션 시각이 채택되는지 확인하는 통합 테스트 1건 추가 권장.

- **[INFO]** `_forced_coverage_missing` 의 fallback 분기(`agents_forced` 이름이 `subagent_invocations` 에 없는 경우 `f"{inv_name}.md"` 기본값) 미검증
  - 위치: `.claude/hooks/_lib/review_guard.py:662-670`
  - 상세: 모든 `ForcedCoverageTest._session()` 헬퍼가 `subagent_invocations` 를 `forced` 리스트와 정확히 1:1 로 생성하므로, `next(..., None)` 이 `None` 을 반환해 `or f"{inv_name}.md"` fallback 으로 빠지는 경로가 스위트 전체에서 한 번도 실행되지 않는다. 실무에서는 `agents_forced` 가 항상 prepare 시점의 전체 roster(`subagent_invocations`) 부분집합이라 잘 발생하지 않지만, 방어 코드로 명시 존재하는 이상 의도를 문서화하는 테스트가 있는 편이 안전하다.
  - 제안: forced 이름이 `subagent_invocations` 에 없는 케이스 1건 추가(경량, 우선순위 낮음).

- **[INFO]** 신규 `ForcedCoverageTest` 의 임시 디렉토리가 정리되지 않음(격리 자체는 문제 없음)
  - 위치: `.claude/tests/test_review_guard.py:120-141`(`ForcedCoverageTest._session`)
  - 상세: `tempfile.mkdtemp()` 를 호출하고 `tearDown`/`addCleanup` 이 없어 스위트 1회 실행마다 OS temp 에 세션 디렉토리가 최대 7개 누적된다. 각 테스트가 독립된 디렉토리를 새로 만들기 때문에 테스트 간 상호오염(정확성 문제)은 없다 — 순수 위생(hygiene) 문제다. 같은 파일의 기존 `SummaryResolvedTest._write` 도 동일 패턴이라 이번 diff 가 새로 도입한 스타일은 아니다.
  - 제안: 다음에 이 파일을 만질 때 `test_orchestrator_state.py` 처럼 `tempfile.TemporaryDirectory()` 로 통일하거나 `self.addCleanup(shutil.rmtree, d, ignore_errors=True)` 추가.

- **[INFO]** reconcile 후 `agents_skipped` 와 `agents_success` 의 중복 가능성 미검증
  - 위치: `_reconcile_state_with_disk` — `on_disk = [n for n in known if os.path.isfile(outputs[n])]` 가 `skipped` 를 걸러내지 않음.
  - 상세: 라우터가 스킵한 에이전트가 어떤 이유로든(예: 라우팅 전에 이미 실행된 잔여 파일) 산출물을 갖게 되면 `agents_success` 와 `agents_skipped` 양쪽에 동시에 나타날 수 있다. 기존 `_sync_from_disk` 에도 있던 동작이라 회귀는 아니며, 실무 발생 가능성도 낮다.
  - 제안: 낮은 우선순위 — 참고만.

## 긍정적으로 평가할 점

- **경로-오탐 버그(선행 fix)에 대한 테스트가 정확히 사고 재현 형태로 작성됨**: `test_verify_coverage_finds_reports_when_the_recorded_worktree_is_gone` / `test_sync_from_disk_finds_reports_when_the_recorded_worktree_is_gone` / `test_reports_are_found_when_the_recorded_worktree_is_gone` 모두 실제 삭제된 워크트리 절대경로(`/Volumes/gone/...`)를 그대로 `output_file` 에 넣어 재현한다. 이 부분이 이번 diff 에서 가장 위험한 지점(게이트를 승격하면 거의 모든 push 를 막을 뻔한 버그)인데 정확히 그 형태로 검증됐다.
- **Mock 을 과용하지 않음**: 경로 해석이 핵심인 로직이라 git/파일시스템을 몽땅 mock 했다면 지금 고치는 버그 자체를 테스트가 놓쳤을 것이다 — 실 `tempfile` 기반 파일로 검증한 선택이 적절하다. 순수 정책 판단표(`EvaluateDecisionTableTest`, `SpecConsistencyGateTest`)만 기존 관례대로 hermetic 하게 mock 처리해 계층을 잘 분리했다.
- **"꾸며진 성공"(fake success) 케이스가 review_guard·orchestrator 양쪽에서 대칭적으로 커버됨**: `test_a_claimed_success_without_a_report_does_not_count`(guard) / `test_sync_from_disk_demotes_a_success_that_left_no_file`(orchestrator) — 이 PR 전체가 막으려는 결함 유형의 핵심 시나리오다.
- **fail-open 경로(매니페스트 없음/빈 forced/손상 JSON)가 명시적으로 테스트됨**: 게이트가 과거 세션·수기 세션을 소급 차단하지 않는다는 설계 원칙을 코드가 실제로 지키는지 검증.
- **테스트 이름·주석이 사고 내러티브(160/575, 107건 RESOLUTION 보유, open-redirect 경계 스킵)를 그대로 인용**해 향후 유지보수자가 "왜 이 테스트가 존재하는지" 를 코드만 보고 알 수 있다 — 가독성이 우수하다.
- 하네스 전체 232 테스트 재실행 결과 회귀 없음(plan 체크리스트 §7 주장과 독립적으로 재확인).

## 요약

이번 PR 이 새로 만든 핵심 로직(`_forced_coverage_missing`/`_summary_is_resolved` 의 forced-coverage 게이트, `_report_paths` 의 세션-상대 경로 해석, `--verify-coverage`/`--sync-from-disk`)은 테스트가 촘촘하고 특히 이 작업의 도화선이었던 "경로 오탐"·"꾸며진 성공"·"forced 미충족인데 RESOLUTION 만으로 통과" 세 가지 실측 결함을 정확히 겨냥한 재현 테스트로 구성돼 있어 신뢰도가 높다. 다만 두 가지 실측 가능한 갭을 발견했다: (1) `consistency-checker/SKILL.md` 에 추가된 "자동 self-heal" 서술이 실제로는 코드 변경이 따라가지 않은 채 consistency-checker SKILL.md 에만 복사돼 실측으로 반증되며(재현함), 대응 테스트가 전무하다는 점, (2) 신규 self-heal 로직(`_reconcile_state_with_disk`)이 `--resume`/`--summary-state` 라는 상시 경로에 연결되면서 기존에 잠재해 있던 `agents_fatal` 부활/이중 멤버십 결함의 노출 빈도가 크게 늘었는데 이에 대한 회귀 테스트가 빠져 있다는 점(재현함)이다. 두 갭 모두 review_guard.py 의 실제 push/stop 차단 판정(핵심 보안 속성)을 무력화하지는 않지만, 운영 문서의 신뢰성과 `/loop` 재시도 상태의 정확성에 영향을 준다. 그 외에는 cross-session 통합 지점이 전부 mock 처리돼 있다는 점과 소소한 방어분기 미검증·temp dir 미정리 등 경미한 개선 여지가 남아 있다.

## 위험도

MEDIUM
