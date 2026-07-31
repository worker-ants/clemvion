# Maintainability Review — harness block-integrity backstop / retry_state 추출

## 발견사항

- **[WARNING]** `evaluate_review()` 의 Gate 2 "stale" 차단 분기가 직전에 계산한 `notes`(하향-모순 경고)를 버린다.
  - 위치: `.claude/hooks/_lib/review_guard.py:964-998` (문제 분기는 `979-986`, 대조 성공 분기는 `988-998`)
  - 상세: `notes: list[str] = []` (964) 이후 `_newest_resolved_impl_done_mtime(repo_root, dirty, notes)` (968) 가 채택된 세션이 자기 checker 의 `[CRITICAL]` 과 모순되면 `notes` 에 append 한다. 함수에는 Gate 2 의 조기 반환이 두 곳 있는데(969, 979), 969(`newest_impl_done <= 0.0`)는 이 시점에 `best_dir` 이 항상 빈 문자열이라 실제로 `notes` 손실이 없지만, 979(`newest_impl_done < newest_spec_code`)는 **`best_dir` 이 채워져 있고 `notes` 도 채워질 수 있는 상태에서** `ReviewDecision(True, f"...")` 를 `notes` 없이(디폴트 `()`) 반환한다 — 정확히 이 백스톱이 존재하는 이유(하향 신호를 조용히 잃지 않기)와 반대되는 경로가 이 함수 자신 안에 생겼다. `notes` 가 성공 경로(998번 줄)에만 실려 있고, 두 조기 반환 중 하나에는 실려 있고 하나엔 안 실려 있는 비대칭은 "여러 return 문에 걸쳐 로컬 accumulator 를 수동으로 threading" 하는 패턴의 전형적 실패 사례다. `test_block_integrity.py`/`test_review_guard.py` 어디에도 "차단 + notes 비어있지 않음" 조합을 검증하는 테스트가 없어 이 갭이 그대로 통과했다.
  - 제안: `notes` 를 클로저로 캡처하는 로컬 헬퍼(예: `def _blocked(reason): return ReviewDecision(True, reason, tuple(notes))`)를 만들어 Gate 2 의 모든 반환이 그 헬퍼를 거치게 하거나, 최소한 979 번 줄의 반환에 `tuple(notes)` 를 추가하고 "차단되어도 notes 는 보존된다"를 확인하는 회귀 테스트를 추가할 것.

- **[WARNING]** 동일한 "notes 출력" 책임이 두 자매 훅에서 예외 처리 수준이 다르다.
  - 위치: `.claude/hooks/guard_review_before_push.py:733-750` (`_report_notes`) vs `.claude/hooks/guard_review_before_stop.py:360-361`
  - 상세: push 훅의 `_report_notes` 는 출력 루프를 `try/except Exception: pass` 로 감싸 "관측이 가드 자체를 깨서는 안 된다"는 이 파일군의 반복된 원칙(`failopen_state.py` 모듈 docstring: "Nothing here may ever raise into a guard")을 지킨다. 반면 stop 훅에 새로 추가된 동일 책임의 코드는 `for note in (getattr(decision, "notes", ()) or ()) if decision else (): print(note, file=sys.stderr)` 로 인라인 작성되었고 예외 가드가 없다. `main()` 의 바깥 `try/except` 가 결국 잡아 `_allow()` 로 fail-open 되긴 하지만, 그 경로를 타면 `_run()` 이 이 지점에서 예외로 중단되어 **그 아래 PLAN-COMPLETE 게이트 점검이 이번 실행에서 통째로 스킵**된다 — push 훅에서는 같은 상황이 `_report_notes` 내부에서 흡수되어 다른 게이트 로직에 영향을 주지 않는 것과 대조적이다.
  - 제안: stop 훅 쪽도 `try/except Exception: pass` 로 감싸거나, 두 훅이 공유하는 `_lib/failopen_state.py` 에 "notes 출력" 헬퍼를 하나 추가해 두 훅이 동일 구현을 재사용하도록 통합할 것 (이 모듈은 이미 그런 목적으로 만들어졌다).

- **[INFO]** 신규 테스트가 이미 있는 "fresh-interpreter" 보일러플레이트를 재사용하지 않고 다섯 번째 사본을 추가했다.
  - 위치: `.claude/tests/test_block_integrity.py:66-86` (`test_orchestrator_derives_its_list_from_here`)
  - 상세: `_lib` 네임스페이스 충돌을 피하려고 서브프로세스에서 `importlib.util.spec_from_file_location` 로 동적 임포트하는 패턴은 이미 `test_consistency_context_budget.py` 등 4개 파일이 `_PREAMBLE`/`run_in_orchestrator` 형태로 공유하고 있고, 같은 PR 트리의 plan 문서(`plan/in-progress/harness-review-gate-ci-backstop.md` 신규 후속 #10)가 "4개 파일에 복제된 이 보일러플레이트를 `_harness.py` 로 추출" 하라고 이미 등재해 둔 상태다. 이번에 추가된 테스트는 그 패턴을 인라인으로 다시 손으로 짜서(더 단순한 형태이긴 하지만) 사본을 4개에서 5개로 늘렸다.
  - 제안: 지금 당장 통합할 필요는 없지만(범위 밖 후속 항목), 향후 `_harness.py` 추출 시 이 테스트도 함께 이관 대상에 포함해 둘 것. 당장은 최소한 plan 문서의 후속 #10 항목에 이 파일도 추가 대상으로 언급해 두는 편이 안전하다.

- **[INFO]** 같은 파일 안에서 이미 쓰는 공용 헬퍼를 두고 동일 로직을 인라인으로 재작성.
  - 위치: `.claude/tests/test_block_integrity.py:88-107` (`test_role_instructions_registers_the_same_checkers`)
  - 상세: 이 메서드는 `importlib.util.spec_from_file_location` → `module_from_spec` → `spec.loader.exec_module` 시퀀스를 손으로 다시 작성하는데, 바로 같은 파일 31-33번 줄에서 이미 `_harness.load_module_by_path("block_integrity", ...)` 로 동일 시퀀스를 캡슐화해 쓰고 있다. `role_instructions.py` 는 `_lib` 충돌이 없어 (프로세스 내 로드가 가능하므로) `_harness.load_module_by_path("role_instructions_probe", skill / "lib" / "role_instructions.py")` 로 대체 가능해 보인다.
  - 제안: `_harness.load_module_by_path` 호출로 교체해 한 파일 안에서의 두 가지 임포트 관용구를 하나로 통일할 것.

- **[INFO]** 방어적 분기가 이번 diff 로 인해 죽은 코드가 되었고, 그 근거 주석도 stale 해졌다.
  - 위치: `.claude/hooks/guard_review_before_push.py:850-856`
  - 상세: `_evaluate_over_targets` 안의 `notes = getattr(outcome, "notes", None); if notes is None: notes = []; outcome.notes = notes` 는 주석에서 "`_Outcome` may come from `failopen_state` (which predates this field) or from the local fallback" 라고 설명한다. 그런데 바로 이 diff 자신이 `failopen_state.Outcome.__init__`(`.claude/hooks/_lib/failopen_state.py:47-54`) 과 로컬 fallback `_Outcome.__init__`(`.claude/hooks/guard_review_before_push.py:794-799`) 양쪽 모두에 `self.notes: list = []` 를 추가했다 — 즉 두 `Outcome` 생성자 모두 이제 생성 시점에 무조건 `.notes` 를 갖는다. `outcome = _Outcome()` 한 곳에서만 생성되므로 `getattr(...) is None` 분기는 현재 어떤 실행 경로로도 도달할 수 없고, 그 근거였던 "한쪽 정의만 이 필드를 가진다"는 서술은 같은 커밋이 만든 사실과 이미 모순된다.
  - 제안: 방어 코드 자체를 남겨두는 것은 무해하지만, 주석을 "두 `Outcome` 정의 모두 `.notes` 를 갖도록 이번에 갱신했으므로 이 분기는 향후 세 번째 Outcome 구현이 생길 경우를 위한 방어" 정도로 정정해 stale 근거를 없앨 것.

- **[INFO]** 중첩 삼항식이 `for` 루프의 iterable 자리에 그대로 들어가 있어 가독성이 떨어진다.
  - 위치: `.claude/hooks/guard_review_before_stop.py:360`
  - 상세: `for note in (getattr(decision, "notes", ()) or ()) if decision else ():` 는 동작은 올바르지만 "decision 이 None 이 아니면 notes-or-empty, 아니면 empty" 라는 조건을 한 줄의 `for ... in (A) if C else (B):` 형태로 압축해 첫눈에 파싱하기 어렵다.
  - 제안: `notes = getattr(decision, "notes", ()) if decision else (); for note in notes or ():` 처럼 변수로 분리하면 동일 동작을 더 쉽게 읽을 수 있다.

- **[INFO]** `_shared/retry_state.py` 추출 배경 설명("AST 비교 결과, 4/5 함수 동일")이 4개 파일에 거의 동일한 문구로 반복된다.
  - 위치: `.claude/_shared/retry_state.py:1-29`(모듈 docstring), `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:184-189`, `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:87-92`, `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:99-112`
  - 상세: 코드 자체(다섯 함수)는 이번 PR 이 정확히 목표한 대로 한 곳(`_shared/retry_state.py`)으로 합쳐졌지만, 그 근거를 설명하는 산문 주석은 4곳에 비슷한 말로 다시 쓰여 있다. 이 PR 이 없애려는 "Change both" 클래스가 코드에서는 사라졌지만 설명 주석 차원에서 형태를 바꿔 남아 있다.
  - 제안: 시급하지 않음(주석이라 drift 위험이 코드 로직만큼 크지 않다) — 다만 향후 이 근거가 갱신될 때는 `_shared/retry_state.py` 한 곳만 갱신하고 각 호출부는 그 파일을 링크로 가리키는 편이 낫다는 점을 참고할 것.

## 요약

전체적으로 이번 변경은 유지보수성을 개선하는 방향의 리팩터다: 세 orchestrator 에 흩어져 "Change both" 주석으로만 동기화되던 5개 상태 관리 함수를 `_shared/retry_state.py` 하나로 옮기고(AST 비교로 실제 동일성을 사전 검증한 뒤 이관), `BLOCK:` 판정과 `[CRITICAL]` 태그 카운팅이라는 두 번 중복될 뻔한 정규식 로직을 `_shared/block_integrity.py` 하나로 단일화했다. 두 신규 모듈 모두 함수가 짧고 책임이 분명하며, 기존 코드베이스의 "왜" 를 상세히 남기는 주석 관례와 일관된다. 테스트(`test_block_integrity.py`, `test_retry_state_shared.py`)도 새 동작뿐 아니라 "무엇을 세면 안 되는가"(오탐 방지)까지 pin 하는 등 꼼꼼하다. 다만 신설된 `notes` advisory 배선에는 실제 결함(하나의 반환 분기에서 조용히 유실)과 두 훅 사이의 예외 처리 비대칭이 남아 있고, 신규 테스트 일부가 기존에 이미 있는 헬퍼(`_harness.load_module_by_path`, `run_in_orchestrator` 계열)를 재사용하지 않고 새 사본을 만들어 이 PR 이 줄이려던 것과 같은 종류의 중복을 미세하게 늘렸다. 모두 지역적이고 낮은 파급력의 이슈이며, 리팩터의 핵심 설계(단일 진실 원천으로의 이관)는 견고하다.

## 위험도
LOW
