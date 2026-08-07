# Requirement Review — 리뷰 게이트 백로그 §6·§9·§10 처분 (git_probe / retry_state / merge-coordinator)

## 발견사항

- **[WARNING]** `branch_diff_files` 통합 후 예외 처리 범위가 좁아져 자신의 계약("실패 시 빈 값")을 어길 수 있음
  - 위치: `.claude/_shared/git_probe.py:146` (`_run_git_raw`의 `except (subprocess.TimeoutExpired, FileNotFoundError, OSError)`), `.claude/_shared/git_probe.py:201` (`branch_diff_files` docstring "Failure is otherwise silent and empty, as before."), 호출부 `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:1048`(docstring "`[]` on any failure") 및 `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:240`(docstring "Empty on any failure")
  - 상세: 통합 전 두 orchestrator 는 각자 git 호출 전체를 **넓은 `except Exception`** 으로 감싸고 있었다(`code_review_orchestrator.get_git_branch_diff_files`/`consistency_orchestrator._branch_changed_rels` 원본, 이 diff 의 `-` 라인들). 통합 후에는 `_shared/git_probe._run_git_raw` 의 **좁은** `except (subprocess.TimeoutExpired, FileNotFoundError, OSError)` 만 남았고, 두 호출부는 더 이상 자체 `try/except` 를 갖지 않는다(`return _git_probe.branch_diff_files(...)` 를 바로 반환). `subprocess.run(..., text=True)` 는 git 이 내놓은 바이트를 디코드하다 실패하면 `UnicodeDecodeError`(→`ValueError` 서브클래스, `OSError` 아님)를 던지는데, 이는 새 좁은 catch 에 걸리지 않아 `branch_diff_files` 를 뚫고 두 호출부까지 그대로 전파돼 orchestrator 프로세스가 **처리되지 않은 예외로 크래시**한다. 직접 재현(몽키패치로 `subprocess.run` 이 `UnicodeDecodeError` 를 던지게 함): `RAISED (uncaught): UnicodeDecodeError` — 반면 이 모듈 자신의 다른 함수(`_default_branch`)는 정확히 이 문제를 피하려고 호출부에서 `except Exception: pass`/`except Exception: return None` 을 별도로 두고 있다(같은 파일 222-255행). 이 함수는 `core.quotePath=false` 를 켜서 git 이 비-ASCII 바이트를 C-quote 하지 않고 그대로 내보내게 만드는데, 그 원본 바이트가 유효하지 않은 UTF-8(예: 리눅스 ext4 에서 만들어진 legacy-encoding 파일명 — 이 프로젝트의 CI 가 실제로 GitHub Actions/리눅스에서 돈다)이면 정확히 이 실패를 유발한다. 세 곳의 docstring 모두 "`[]`/빈 값/silent" 을 실패 시 계약으로 명시하고 있어, 의도(계약 문구)와 구현(좁은 catch) 간 괴리이자 에러 시나리오 처리 누락이다.
  - 제안: `branch_diff_files` 자체(또는 그 두 호출부)에 `except (UnicodeDecodeError, Exception)` 수준의 방어를 추가해 "on any failure → `[]`" 계약을 실제로 지키게 할 것. 혹은 `subprocess.run` 호출에 `errors="replace"`(또는 `surrogateescape`) 를 지정해 디코드 실패 자체를 없앨 것. 어느 쪽이든 새 테스트로 "디코드 실패 시에도 빈 값 반환 + `on_error` 호출" 을 고정해야 한다(현재 `test_branch_diff_shared.py` 는 `rc != 0` 실패만 다루고 예외 경로는 다루지 않음).

- **[INFO]** 관련 spec 문서 없음 (spec 누락, 예상된 것)
  - 위치: `spec/` 전체 grep 0건 (`retry_state`, `git_probe`, `agents_fatal`, `_fatal` 등)
  - 상세: 이번 변경은 전부 `.claude/` 하위 하네스/오케스트레이터 인프라이며, 프로젝트 컨벤션상 `spec/` 은 제품(`codebase/`) 정의만 다룬다. 대신 `.claude/docs/subagent-call-contract.md`, `.claude/skills/code-review-agents/README.md`, `plan/in-progress/harness-review-gate-followups.md` 가 사실상의 계약 문서 역할을 하며, 이번 diff 는 그 세 문서를 코드 변경과 함께 동반 갱신했다(README 의 `_fatal/` 섹션·스키마 주석·"디스크가 심판이다" 박스, plan 문서의 §6/§9/§10 처분 기록). 대조 결과 코드 구현과 문서 서술이 일치한다 — 별도 조치 불요.

- **[INFO]** `_fatal/<name>` sentinel 이 성공 이후에도 청소되지 않고 남을 수 있음 (기능적으로는 무해)
  - 위치: `.claude/_shared/retry_state.py:167`(`reconcile_state_with_disk`), `:137`(`_record_fatal`)
  - 상세: sentinel 삭제는 `apply_status_update`(`--update` CLI)를 통할 때만 일어난다(`_record_fatal(sd, agent, status == "fatal")`). `--update` 를 거치지 않는 경로(Agent tool 로 직접 fan-out 후 `reconcile_state_with_disk`/`--summary-state`/`--sync-from-disk` 로만 수렴하는 흐름 — 이 프로젝트가 실제로 문서화한 fallback)에서는, 한 번 fatal 로 기록됐던 에이전트가 나중에 리포트를 남겨 성공으로 수렴해도 `_fatal/<name>` 파일 자체는 지워지지 않는다. `test_a_sentinel_does_not_outrank_a_report_that_arrived_later` 가 확인하듯 판정 로직(success 가 이긴다)은 정확하므로 오판은 없지만, 세션 디렉토리에 죽은 sentinel 파일이 영구히 남는 사소한 위생 문제다.
  - 제안: 우선순위 낮음 — `reconcile_state_with_disk` 가 `on_disk` 로 판정된 이름에 대해 남아있는 sentinel 을 함께 정리(unlink)하도록 확장하면 닫힌다. 현재 동작을 막을 필요는 없음(정보성 발견).

## 요약

`_shared/git_probe.branch_diff_files` 로의 통합(§6), `_fatal/<name>` sentinel 을 통한 `agents_fatal` lost-update 복구(§10), `merge_coordinator_orchestrator` 의 `reconcile_state_with_disk` 자기치유 추가(§9) 세 항목 모두 plan 문서가 서술한 목표와 실제 구현이 line-level 로 부합하며, 새로 추가된 unittest(`test_branch_diff_shared.py` 10건, `test_retry_state_shared.py` 신규 12건 포함)는 실제로 실행해 전부 통과했고 기존 hook 테스트(`test_branch_guard`/`test_plan_guard`/`test_review_guard*`) 145건도 회귀 없이 통과했다. 세 orchestrator(`code_review_orchestrator`, `consistency_orchestrator`, `merge_coordinator_orchestrator`)의 호출부·README·plan 문서가 서로 정합적이다. 다만 §6 통합 과정에서 두 orchestrator 가 원래 갖고 있던 넓은 `except Exception` 안전망이 사라지고 `_shared/git_probe._run_git_raw` 의 좁은 예외 처리만 남아, "실패 시 빈 값"이라는 세 곳의 명시적 docstring 계약이 `UnicodeDecodeError` 류 예외 앞에서 깨질 수 있음을 직접 재현으로 확인했다(WARNING). 이는 드문 입력(비-UTF8 바이트 경로)에서만 발현되고 沈묵 실패가 아니라 크래시로 나타나므로 이 모듈이 원래 막으려던 "fail-open" 계열 결함보다는 경하지만, 에러 시나리오 처리 관점에서 실질적 회귀다.

## 위험도
MEDIUM
