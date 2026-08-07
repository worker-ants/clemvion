# Requirement Review — `.claude/_shared/git_probe.py` + `.claude/_shared/retry_state.py` 등 (2026-08-07 20:05:23 세션)

## 검토 방법

- 프롬프트에서 잘려 실리지 않은 4개 `.py` 파일(`code_review_orchestrator.py`, `consistency_orchestrator.py`,
  `merge_coordinator_orchestrator.py`, `test_branch_diff_shared.py`, `test_retry_state_shared.py`)은 `Read`/`Grep` 으로 직접 열어 확인.
- `.claude/tests/` 전체 스위트를 `python3 -m unittest discover` 로 실행 — **911 tests, OK** (신규 테스트 `test_branch_diff_shared.py` 13건, `test_retry_state_shared.py` 신규분 포함 22건 모두 개별 확인).
- `spec/` 에 `retry_state`/`git_probe`/`_fatal/` 관련 문서가 있는지 grep — 0건. 이 변경은 `.claude/`(harness 자체) 범위이며 `codebase/`·`spec/` 어느 쪽도 건드리지 않으므로 관점 9(spec fidelity)는 대상 spec 문서 부재로 판단.

## 발견사항

- **[INFO]** spec 본문 부재 (spec fidelity 관점 9 해당 없음)
  - 위치: 전체 변경 (`.claude/_shared/git_probe.py`, `.claude/_shared/retry_state.py`, 3개 orchestrator)
  - 상세: 이 변경은 `.claude/` 하위의 harness/skill 오케스트레이션 코드로, `spec/` 는 `codebase/` 의 제품 요구사항만 다루고 이 영역을 규정하지 않는다 (`grep -rl "retry_state\|git_probe\|_fatal/" spec/` → 0건). 유사 역할을 하는 문서는 `.claude/skills/code-review-agents/README.md` 뿐이며, 그 문서는 이번 diff 에서 `_fatal/` 디렉터리·"디스크가 심판이다" 절·운영 함정 안내로 정확히 동반 갱신됐다 (스키마 예시의 `agents_success`/`agents_fatal` 주석, `--summary-state`/`--resume`/`--sync-from-disk` 언급 모두 실제 코드와 일치 확인).
  - 제안: 조치 불필요. spec 누락이 아니라 애초에 spec 관할 밖.

- **[INFO]** `_fatal/<name>` sentinel 이 "success 로 수렴한 뒤에도" 남는 경로가 있음 (문서화된 잔여, 신규 결함 아님)
  - 위치: `.claude/_shared/retry_state.py:192` (`reconcile_state_with_disk`) 및 `.claude/_shared/retry_state.py:145` (`_record_fatal`)
  - 상세: `reconcile_state_with_disk` 는 report 파일이 나중에 도착하면 `agents_success` 로 정확히 승격시키지만(`fatal = [n for n in missing if n in fatal_recorded]` 에서 on_disk 인 이름은 `missing` 에서 빠지므로 fatal 판정에서 제외됨 — `test_a_sentinel_does_not_outrank_a_report_that_arrived_later` 로 검증됨), 그 승격 경로는 `_fatal/<name>` **sentinel 파일 자체는 지우지 않는다**. `_record_fatal` 은 오직 `apply_status_update` 호출(`--update` CLI) 을 통해서만 sentinel 을 지운다. 따라서 report 파일이 나중에 삭제되는 경우(세션 아카이빙 등) 다음 reconcile 에서 stale sentinel 이 다시 fatal 로 되살릴 위험이 이론상 존재한다. 이는 개발자 스스로 plan 문서(`plan/in-progress/harness-review-gate-followups.md:238` "잔여 3")와 `_record_fatal` docstring 에 "위생 문제"로 명시 disclose 했고, 판정 우선순위(success > fatal)는 정확하다.
  - 제안: 신규 조치 불요 — 이미 알려지고 문서화된 트레이드오프. 다만 향후 세션 정리/아카이빙 기능이 report 파일만 지우고 `_fatal/` 은 남기는 형태로 구현된다면 이 잔여가 실제 버그로 표면화될 수 있으므로, 그 작업 착수 시 함께 정리하도록 plan 잔여 항목에 교차 참조를 남겨두면 좋다.

- **[INFO]** `fatal_sentinel_path` 의 경로-성분 검사가 POSIX 에서 백슬래시를 구분자로 보지 않음
  - 위치: `.claude/_shared/retry_state.py:125` (`if not name or name in (".", "..") or name != os.path.basename(name): return None`)
  - 상세: `os.path.basename("..\\x")` 는 POSIX 에서 백슬래시를 분리자로 취급하지 않으므로 `"..\\x" == os.path.basename("..\\x")` 가 참이 되어 검증을 통과한다 — 결과적으로 `_fatal/..\x` 라는 리터럴 백슬래시 파일명이 생성될 뿐 실제 경로 이탈(`../`)은 발생하지 않는다(슬래시 기반 이탈은 이미 정확히 차단됨: `test_a_name_that_is_not_a_path_component_gets_no_sentinel` 이 `"../escape"`, `"nested/name"` 을 커버). `name` 은 `subagent_invocations` 의 고정된 reviewer/analyzer 식별자 목록에서만 오므로(외부 입력이 아님) 실질적 공격 표면은 없다.
  - 제안: 현재 위협 모델에서는 조치 불요. 방어적으로 강화하려면 `\\` 도 거부 목록에 추가할 수 있으나 우선순위는 낮음.

## 정합성 확인 (문제 없음으로 판정된 항목)

- `git_probe._run_git_raw`/`_run_git`/`branch_diff_files` 3중 계약(스칼라 trim 유지, 리스트는 raw 유지, `errors="surrogateescape"` 로 왕복 불가 바이트 생존, 넓은 `except Exception` 으로 "실패 시 빈 값" 계약 복원)이 실제 코드·테스트(`test_branch_diff_shared.py` 13건: `UndecodableGitOutputTest`, `ThreeDotIsNotNegotiableTest`, `SharedProbeContractTest` 등) 와 line-level 로 일치. 전부 통과 확인.
- `code_review_orchestrator.get_git_branch_diff_files`(:1047)·`consistency_orchestrator._branch_changed_rels`(:239) 모두 `_git_probe.branch_diff_files` 로 위임하며 timeout 인자를 넘기지 않아 공유 기본값 30s 로 통일됨 — plan 문서가 주장한 "더 긴 상한이 이긴다" 와 일치.
- `retry_state.py` 의 `fatal_sentinel_path`/`fatal_on_disk`/`_record_fatal`/`reconcile_state_with_disk`(union 판정) 이 README(`_fatal/` 디렉터리 표기, "디스크가 심판이다"/"운영 함정" 절)·plan 문서 §10 처분 서술과 정확히 일치. `apply_status_update`(:277) 가 `save_state` **이전에** `_record_fatal` 을 호출해 "JSON 유실돼도 sentinel 로 복구" 계약을 지킴.
- `merge_coordinator_orchestrator.py` 가 `_reconcile_state_with_disk`(:114)/`_emit_summary_state`(:122, `extra_fields`로 `branches`/`base` 보존)/`--resume` 재조정(:547)을 갖춰 세 번째 orchestrator 도 자기치유를 얻었다는 plan §9 주장과 일치. `--summary-state` 출력 라인 순서(`pending= success= fatal= branches= base= last_reset=`)도 테스트(`test_summary_state_cli_reads_through_the_shared_helper`)와 일치.
- TODO/FIXME/HACK/XXX 신규 주석 0건 (diff 대상 5개 `.py` 파일 grep 확인).
- 반환값: 모든 신규/변경 함수(`_run_git_raw`, `branch_diff_files`, `fatal_sentinel_path`, `fatal_on_disk`, `_record_fatal`, `reconcile_state_with_disk`)가 실패 경로를 포함한 모든 분기에서 문서화된 타입(빈 리스트/`None`/`(state, bool)`)을 반환 — 반환값 누락 경로 없음.

## 요약

`.claude/_shared/git_probe.py`(`_run_git_raw`/`branch_diff_files` 신설)와 `.claude/_shared/retry_state.py`(`_fatal/<name>` sentinel + union 재도출)의 구현은 plan 문서(§6·§9·§10)가 서술한 의도·설계 근거와 line-level 로 정확히 일치하며, 세 orchestrator(`code_review_orchestrator`, `consistency_orchestrator`, `merge_coordinator_orchestrator`) 위임부도 동일하게 확인됐다. `.claude/tests/` 전체 911개 테스트(신규 `test_branch_diff_shared.py` 13건 포함)를 직접 실행해 전부 통과함을 확인했고, README.md 의 스키마·운영 가이드 갱신도 실제 동작과 어긋나지 않는다. `spec/` 는 이 harness 영역을 규정하지 않아 spec fidelity 관점은 해당 없음(INFO). CRITICAL/WARNING 급 결함은 발견되지 않았고, 남은 두 항목(성공 후 sentinel 잔존, 해제 방향 lost-update 미보호)은 개발자가 이미 코드·plan 문서에 명시적으로 disclose 하고 canary 테스트로 고정한 알려진 트레이드오프다.

## 위험도

LOW
