# 부작용(Side Effect) Review

## 발견사항

- **[WARNING]** `consistency-checker` SKILL.md 의 "자동 reconcile" 서술이 실제 구현과 불일치 (문서-코드 괴리로 인한 상태 부작용)
  - 위치: `.claude/skills/consistency-checker/SKILL.md` (diff 신규 문구 "**상태 기록은 자동이다** — `--summary-state`/`--resume` 가 읽을 때 디스크로 자가 reconcile 하므로 수동 호출 의무는 없다") vs `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:95-102`(`_emit_summary_state`), `:599-611`(`--resume` 처리)
  - 상세: 이번 PR 은 `_reconcile_state_with_disk()` 를 `code_review_orchestrator.py` 에만 추가하고 `_emit_summary_state`/`--resume` 에 연결했다. 그런데 `consistency-checker/SKILL.md` 는 같은 "자동 reconcile" 문구를 **자신의 orchestrator**(`consistency_orchestrator.py`, §1/§2 에서 실제 호출 대상으로 지목됨)에도 적용되는 것처럼 서술한다. 실측 결과 `consistency_orchestrator.py` 는 `code_review_orchestrator.py` 에서 `lib.session`/`lib.role_instructions`/`_lib.project_config` 만 재사용할 뿐, state 헬퍼(`_load_state`/`_save_state`/`_emit_summary_state`)는 파일 자체 주석대로 "Mirror code_review_orchestrator" — 즉 **손으로 복제된 별도 구현**이며 `_reconcile_state_with_disk`/`_report_paths` 상당의 코드가 전혀 없다. `grep -n "reconcile\|_report_paths" consistency_orchestrator.py` 0건, `git diff origin/main...HEAD -- .../consistency_orchestrator.py` 도 0건으로 이번 PR 이 그 파일을 전혀 건드리지 않았음을 확인했다. 즉 consistency-checker 세션을 direct Agent fan-out(`--update` 미호출) 으로 돌린 뒤 `--summary-state`/`--resume` 를 호출해도 여전히 prepare 스냅샷(`pending=전체, success=0`)이 그대로 보고된다 — 이 PR 이 "무너지는 산문 의무" 로 지목한 바로 그 실패 패턴이, 자매 SKILL 에서는 "문서상으로만 해결됨" 이라고 재도입된 셈이다. plan 체크리스트 6번("두 SKILL … 을 '기계 강제 + 자동' 으로 정정")이 실제로는 code-review-agents 쪽만 반영됐다.
  - 제안: `consistency_orchestrator.py` 에도 동일한 reconcile 로직(가급적 두 오케스트레이터가 공유하는 헬퍼로 추출)을 적용하거나, 당장 어렵다면 SKILL.md 문구에서 consistency-checker 쪽은 "자동 아님 — `--sync-from-disk` 수동 호출 여전히 필요" 로 되돌릴 것.

- **[WARNING]** `--summary-state`/`--resume` 가 "읽기" 명령인데도 디스크에 쓰는 부작용이 새로 생김
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:158-186`(`_reconcile_state_with_disk`), `:189-199`(`_emit_summary_state`), `:1017-1023`(`main()` 의 `--resume` 분기)
  - 상세: `_reconcile_state_with_disk()` 는 계산된 `agents_success`/`agents_pending`/`agents_fatal` 이 기존 저장값과 다르면 즉시 `_save_state()` 로 `_retry_state.json` 을 덮어쓴다. 이 함수가 `--summary-state`(원래 "one-line summary … kept terse", 순수 조회)와 `--resume`(원래 "validate + echo path", 검증+echo)에 연결되면서 두 서브커맨드가 더 이상 부작용 없는 조회가 아니게 됐다. 예컨대 이미 git 커밋된 과거 세션을 감사·디버깅 목적으로 `--summary-state <old_session_dir>` 로 들여다보기만 해도, disk 상의 리포트 파일 유무에 따라 그 커밋된 `_retry_state.json` 내용이 실제로 재작성되어 워킹트리를 dirty 하게 만들 수 있다. 이를 피할 조회 전용(dry-run) 옵션은 현재 없다. (push/stop 훅(`review_guard.py`)은 이 CLI 를 호출하지 않고 순수 읽기만 하므로 자동 게이트 경로에는 이 부작용이 전파되지 않음을 확인했다 — 영향은 사람/에이전트가 직접 CLI 를 호출하는 경우로 국한.)
  - 제안: 실제로 파일이 변경될 때 stderr 에 가시적 로그(예: "reconciled N discrepancies, _retry_state.json rewritten")를 남기거나, 이미 커밋된 세션을 순수 조회만 하려는 호출자를 위해 `--no-write`/dry-run 옵션 추가를 고려.

- **[INFO]** report-path 해석 로직이 두 파일에 중복 구현됨
  - 위치: `.claude/hooks/_lib/review_guard.py:355-390`(`_forced_coverage_missing` 내부의 `os.path.join(session_dir, os.path.basename(recorded))`) vs `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:213-232`(`_report_paths`)
  - 상세: "세션 디렉토리 기준 + manifest 의 basename" 이라는 동일한 경로 해석 규칙이 훅 모듈과 오케스트레이터 스크립트에 각각 독립적으로(비-import) 구현돼 있다. `review_guard.py` 는 `.claude/hooks/_lib`, 오케스트레이터는 `.claude/skills/code-review-agents/scripts` 로 sys.path 트리가 달라 직접 import 가 번거롭다는 사정은 있으나, 향후 리포트 파일명 규칙이나 하위 디렉토리 배치가 바뀌면 한쪽만 갱신되어 push/stop 가드의 판정과 `--verify-coverage` CLI 의 판정이 서로 어긋날 위험이 있다.
  - 제안: 급하지 않음. 두 로직을 공유 헬퍼로 추출하는 리팩터링을 백로그로 남길 만하다.

- **[INFO]** `_summary_is_resolved` 강화가 저장소 전역 판정에 소급 적용됨 (의도된 설계로 보임)
  - 위치: `.claude/hooks/_lib/review_guard.py:405-458`(`_summary_is_resolved`) 및 이를 소비하는 `evaluate_review()`(`git push`/Stop 훅 경로)
  - 상세: 함수 시그니처는 그대로지만, 이제 `agents_forced` 커버리지를 요구하면서 과거 "해소됨" 으로 집계되던 세션 다수(plan 문서 자체 실측: 570 → 464, 106건 감소)가 더 이상 "해소" 로 카운트되지 않는다. `evaluate_review()` 는 "가장 최신의 resolved 리뷰" 만 보므로 최신 브랜치 기준으로는 게이트가 통과된다는 점이 저자 실측(`guard_review_before_stop.py` exit 0)으로 이미 검증되어 있고, 이 모듈 자체가 "fail-open, nudge 이지 oracle 아님" 을 표방하므로 정책성 변경 자체는 결함이 아니라 설계 의도다. 다만 저장소 전역 판정 기준이 사후적으로 엄격해진다는 점은 부작용 리뷰 관점에서 기록해 둘 가치가 있다(예: 이번 diff 를 아직 반영하지 않은 다른 활성 브랜치가 리베이스/재실행 시 "전엔 통과였는데 막힌다" 고 체감할 수 있음).
  - 제안: 조치 불필요(설계 의도). 필요하다면 롤아웃 공지 정도만 고려.

- **[INFO]** `_load_state`/`_save_state` read-modify-write 에 잠금이 없고, 이번 PR 로 그 경로가 넓어짐
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:144-186`
  - 상세: `_reconcile_state_with_disk` 가 `--summary-state`/`--resume` 에도 연결되면서, `_retry_state.json` 에 대해 잠금 없는 read-modify-write 를 수행하는 커맨드 표면이 늘었다(기존 `--update`/`--apply-routing`/`--sync-from-disk` + 신규 `--summary-state`/`--resume`). 동일 `session_dir` 에 대한 동시 호출이 있다면 나중에 쓰는 프로세스가 이전 갱신을 덮어쓸 수 있다. 다만 이 패턴 자체는 기존에도 존재했고, 이 하네스에서 실제 동시 호출은 흔치 않아 보인다(단일 Claude 세션이 CLI 를 순차 호출).
  - 제안: 조치 불필요, 참고 기록.

## 그 외 확인한 사항 (문제 없음)

- `review_guard.py::_forced_coverage_missing`/`_summary_is_resolved` 는 순수 읽기(파일 오픈 read-only, `os.path.isfile`)만 수행하며 새 전역 변수·환경 변수 읽기/쓰기·네트워크 호출이 없다. `guard_review_before_push.py`/`guard_review_before_stop.py` 두 훅 모두 `evaluate_review()` 만 호출하므로, 신규 disk-write 부작용(`_reconcile_state_with_disk`)은 자동 게이트 경로에 전파되지 않고 사람이 명시적으로 CLI 를 호출하는 경로로 국한된다.
- `_forced_coverage_missing`/`_summary_is_resolved` 는 시그니처 변경 없음, 외부(다른 모듈) 소비자 없음(테스트 제외) — 영향 범위가 `review_guard.py` 내부로 잘 캡슐화되어 있다.
- `code_review_orchestrator.py` 의 CLI 인자(argparse) 표면은 변경 없음 — 기존 서브커맨드의 내부 구현만 바뀜.
- 신규 전역 변수·이벤트/콜백 변경·네트워크 호출 없음.
- 테스트 신규 추가분(`test_orchestrator_state.py`, `test_review_guard.py`)은 `tempfile.TemporaryDirectory`/`tempfile.mkdtemp` 기반이며 기존 파일 스타일(정리 없는 `mkdtemp` 포함)과 일관되어 새로운 회귀는 아니다.

## 요약

핵심 변경(`review_guard.py` 의 forced-coverage 게이트, `code_review_orchestrator.py` 의 세션-상대 경로 해소 + 자가 reconcile)은 읽기 전용 훅 경로에는 부작용을 전파하지 않고 잘 캡슐화되어 있으며, 시그니처·공개 인터페이스·환경변수·네트워크 호출 측면에서는 안전하다. 다만 (1) `consistency-checker` SKILL.md 가 실제로 구현되지 않은 자동 reconcile 을 "구현됨" 으로 서술해 자매 스크립트(`consistency_orchestrator.py`)에 대해 잘못된 안전 신호를 주는 문서-코드 불일치, (2) 원래 부작용 없는 조회로 여겨지던 `--summary-state`/`--resume` 가 이제 조건부로 `_retry_state.json` 을 재작성하는 새로운 쓰기 부작용을 갖게 된 점이 실질적인 주의 사항이다. 나머지(경로 해석 로직 중복, 전역 판정 소급 강화, 락 없는 RMW 확대)는 설계상 의도되었거나 저위험이다.

## 위험도

MEDIUM
