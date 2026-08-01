# 유지보수성(Maintainability) 코드 리뷰

대상: `harness-block-backstop` 브랜치 (`origin/main` 대비 14개 파일, +940/-305). 핵심은 (1) Critical 하향 금지 정책의 기계적 backstop 신설(`_shared/block_integrity.py`) 과 (2) 두 orchestrator 에 중복돼 있던 상태 bookkeeping 5종을 `_shared/retry_state.py` 로 추출하는 리팩터. 프롬프트에 전체가 실리지 못한 4개 파일(`review_guard.py`, `guard_review_before_push.py`, `code_review_orchestrator.py`, `consistency_orchestrator.py`)은 `git diff origin/main...HEAD` 로 직접 대조했다.

## 발견사항

- **[WARNING]** 동일 근거를 두 번 설명하는 중복 주석 블록
  - 위치: `.claude/_shared/retry_state.py:124-133`
  - 상세: `emit_summary_state()` 안, `extra_fields` 를 매핑이 아니라 callable 로 받는 이유를 설명하는 주석이 **같은 자리에 두 블록 연달아** 있다(124-129번째 줄 "A callable, not a dict: … Measured: the notice vanished for code-review and survived for consistency." / 130-133번째 줄 "Callable only. A pre-built mapping would force the caller to reconcile … which is precisely how the '(reconciled …)' notice went missing on one side"). 두 블록은 표현만 다를 뿐 정확히 같은 근거(사전 계산된 dict 를 넘기면 caller 가 먼저 reconcile 해야 하고, 그러면 이 함수의 reconcile 이 할 일이 없어져 "(reconciled …)" 안내가 사라진다)를 반복한다. 이 함수가 옮겨지기 전 두 orchestrator 각각에 있던 버전에는 이런 중복이 없었던 것으로 보아, 통합 과정에서 초안 주석을 지우지 않고 다시 쓴 편집 잔재로 보인다.
  - 제안: 두 블록 중 하나를 삭제하고 한 블록으로 통합. (내용 자체는 정확하고 근거도 충실하므로 삭제 대상 선택만 하면 됨 — 예: 130-133번째 줄을 지우고 124-129번째 줄만 남기는 편이 "Measured: …" 문장이 있어 더 구체적.)

- **[WARNING]** 리팩터 부산물로 남은 미사용 import
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:44`
  - 상세: `from _shared import report_paths as _report_paths_lib` 를 import 하지만, 파일 전체에서 `_report_paths_lib` 를 참조하는 코드는 이제 없다(주석에서만 이름이 언급됨). 리팩터 이전에는 로컬 `_reconcile_state_with_disk()` 가 `_report_paths_lib.has_report(...)` 를 직접 호출했으나, 그 로직이 `_shared/retry_state.py` 로 옮겨가면서(그쪽은 자체적으로 `report_paths` 를 import) 이 파일의 import 는 죽은 코드가 됐다. `code_review_orchestrator.py` 는 같은 리팩터를 거쳤지만 `_verify_coverage()` 안에서 `_report_paths_lib.missing_reports(...)` 를 여전히 직접 쓰므로 대응 없음(정상). 저장소에 flake8/ruff 같은 자동 lint 게이트가 안 보여(레포 루트에 관련 설정 파일 없음) 이런 잔재가 CI 로 걸러지지 않는다.
  - 제안: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:44` 의 import 를 제거.

- **[WARNING]** 무관한 근거 주석(라우터 강제목록 위반 사건 기록)이 이번 diff 에서 삭제됨
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:277` (`_routing_distrust_reason` 정의부 — 삭제된 줄은 diff 상 게이트가 없어 git 이력으로 확인: `git show 7b54b088a -- .claude/skills/code-review-agents/scripts/code_review_orchestrator.py`)
  - 상세: 이번 브랜치의 `7b54b088a` 커밋("상태 bookkeeping 5종을 `_shared/retry_state.py` 로 — 'Change both' 주석 제거")이 상태 bookkeeping 함수들을 지우는 것과 **같은 diff hunk 에서**, `_routing_distrust_reason` 바로 위에 있던 20줄짜리 근거 주석(2026-07-23 14_47_40 세션에서 router 가 강제 reviewer 7명을 포함해 전원 `selected=false` 를 낸 실제 사건, "0/1명 선택 시 전체 fallback" 규칙이 6cd7376fc(#244)에서 의도적으로 폐기됐다는 사실, count 기반이 아니라 contract 기반 판정이어야 하는 이유)도 함께 삭제됐다. 커밋 메시지 어디에도 이 삭제가 언급되지 않아 의도된 정리인지 우발적 삭제인지 diff 만으로는 판별 불가능하다. 다행히 내용 자체는 `.claude/tests/README.md` 의 `test_router_decision_trust.py` 행에 거의 동일한 문구로 이미 중복 보존돼 있어(README 쪽은 이번 diff 로 변경되지 않음) 정보가 저장소에서 완전히 소실되지는 않았지만, `_routing_distrust_reason()` 의 docstring 은 "Shared shape with `.claude/workflows/ai-review.js`…" 라고만 적혀 있어 **정작 이 함수를 읽는 사람에게는 그 근거를 어디서 찾아야 하는지 아무 단서가 없다** — 삭제 전에는 함수 바로 위에 있어 즉시 보였던 정보다.
  - 제안: 삭제가 의도적(중복 제거)이었다면 커밋 메시지에 그 사실과 이관 위치(README)를 남기고, `_routing_distrust_reason()` docstring 에 "근거: `.claude/tests/README.md` 의 `test_router_decision_trust.py` 항목 참고" 정도의 포인터를 추가. 우발적 삭제였다면 원복 검토.

- **[WARNING]** 공유 `Outcome` 클래스가 새 `notes` 필드를 선언하지 않은 채 동적으로 부착됨
  - 위치: `.claude/hooks/_lib/failopen_state.py:36-49` (`class Outcome` / `__init__`), 사용부 `.claude/hooks/guard_review_before_push.py:850-856`
  - 상세: `failopen_state.Outcome.__init__` 은 여전히 `answered`/`bypassed`/`degraded` 세 필드만 선언하고 클래스 docstring 도 정확히 이 세 개만 나열한다. 반면 `guard_review_before_push.py._evaluate_over_targets()` 는 `getattr(outcome, "notes", None)` 이 `None` 이면 `outcome.notes = []` 를 즉석에서 부착하는 방식으로 4번째 필드를 런타임에 얹는다(주석에 "attach on first use rather than requiring both definitions to carry it" 라고 명시 — 인지된 선택임). 반면 같은 파일의 로컬 fallback 클래스(`failopen_state` import 실패 시 쓰는 `_Outcome`)에는 `self.notes: list = []` 가 `__init__` 에 정식으로 선언돼 있어, **정상 경로와 fallback 경로에서 같은 객체의 "공식 필드 목록"이 서로 다르다.** `failopen_state.report()` 자신은 `.notes` 를 읽지 않아 오늘 당장 동작에 문제는 없지만, 이 클래스는 push/stop 두 훅이 공유하는 클래스라 이후 `__slots__` 도입이나 `Outcome` 을 직접 다루는 새 소비자가 생기면 "3개 필드만 있다"는 클래스 자신의 정의를 믿고 깨질 수 있는 자리다.
  - 제안: `failopen_state.Outcome.__init__` 에 `self.notes: list[str] = []` 를 정식으로 추가하고 docstring 의 필드 나열에도 반영 — `guard_review_before_push.py` 쪽의 `getattr`/lazy-attach 코드는 그대로 두거나(양쪽 다 있어도 무해) 단순화.

- **[INFO]** `_evaluate_over_targets` 의 docstring 이 "두 불변식" 이라고 서술하지만 실제로는 세 번째 책임(notes 수집)이 추가됨
  - 위치: `.claude/hooks/guard_review_before_push.py:809-827`
  - 상세: 함수 docstring 은 "Bridges two invariants that arrived from different directions" 라며 fail-open observability 와 per-target fail-open 두 가지만 설명한다. 이번 diff 로 847-859번째 줄에 세 번째 책임(여러 target 의 `result.notes` 를 `outcome.notes` 로 중복 제거하며 누적)이 추가됐는데 docstring 의 "두 가지" 서술은 갱신되지 않았다. 코드 자체는 인접 인라인 주석으로 잘 설명돼 있어 이해에 지장은 없지만, 함수 상단 개요와 실제 책임 수가 어긋난다.
  - 제안: docstring 도입부를 "세 가지" 로 갱신하거나 notes 수집을 세 번째 항목으로 나열.

- **[INFO]** `evaluate_review()` 에서 수집된 `notes` 가 Gate 2 의 두 차단(blocked) 경로에서는 전달되지 않음
  - 위치: `.claude/hooks/_lib/review_guard.py:964-998` (특히 969-978번째 줄, 979-985번째 줄의 `ReviewDecision(True, …)` vs 988-998번째 줄의 `ReviewDecision(False, …, tuple(notes))`)
  - 상세: `notes` 리스트는 968번째 줄 `_newest_resolved_impl_done_mtime(repo_root, dirty, notes)` 호출로 채워지지만, 그 뒤 `newest_impl_done <= 0.0`(969번째 줄) 또는 `newest_impl_done < newest_spec_code`(979번째 줄) 로 **차단(blocked=True)** 되는 두 경로는 `tuple(notes)` 를 넘기지 않아 채워졌더라도 버려진다. 최종 ALLOW 반환(998번째 줄)에만 붙는다. 첫 번째 경로(969번째 줄)는 `best_dir` 가 애초에 비어 있을 때만 도달하므로 실질적으로 `notes` 가 비어 있어 무해하지만, 두 번째 경로(stale 세션 — 이미 채택된 세션은 있었으나 이후 spec-linked 코드가 더 바뀐 경우)는 `notes` 가 실제로 채워져 있을 수 있는데도 버려진다. 이 자체가 의도적 설계(어차피 차단돼 재실행을 안내하므로 그 시점 옛 세션의 모순은 부수적)로 보이지만, 이 모듈은 다른 모든 설계 판단에 대해 "왜" 를 조목조목 남기는 스타일인데 이 지점만 그 설명이 없다.
  - 제안: 의도적이라면 969-985번째 줄 부근에 한 줄 코멘트("notes 는 ALLOW 경로에서만 의미가 있음 — 차단 시엔 재실행 안내가 이미 나가므로 옛 세션의 모순은 별도로 알릴 필요 없음")를 추가해 이 모듈의 나머지 부분과 설명 밀도를 맞출 것.

- **[INFO]** 스트림 선택 로직의 사소한 중복
  - 위치: `.claude/hooks/guard_review_before_push.py:745`, `:768`
  - 상세: `_report_notes()`(745번째 줄)와 `_report_fail_open()`(768번째 줄) 모두 `stream = sys.stderr if exit_code == 2 else sys.stdout` 를 각자 계산한다. 두 함수 모두 docstring 에서 "같은 규칙" 이라고 서로를 인용하고 있어 의도는 명확하지만, 정확히 이 한 줄을 공유 헬퍼(`_stream_for_exit_code(exit_code)`)로 뽑으면 표현 자체가 사라져 "두 곳이 같은 규칙을 따른다"는 사실을 코드로도 보장하게 된다. 영향은 미미(1줄, 두 곳).
  - 제안: 필요 시에만 — 우선순위는 낮음.

- **[INFO]** 동일 근거 주석이 파일 간에도 거의 그대로 반복됨
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:184-189`(대략, `_load_state` 위), `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:82-87`(대략, `_load_state` 위), `.claude/_shared/retry_state.py:1-29`(모듈 docstring)
  - 상세: "AST 비교로 4/5 함수가 동일했고 `_emit_summary_state` 만 달랐다" 는 동일한 측정 근거가 위 세 위치에 문구만 살짝 바꿔 반복 서술돼 있다. 코드 중복과 달리 주석 중복은 "따로 움직이다 어긋날" 위험은 없지만(동작에 영향 없음), 정확히 이 PR 이 "중복 제거" 를 목표로 하는 만큼 근거 설명 자체가 세 벌 복제된 점은 다소 아이러니하다.
  - 제안: 각 orchestrator 쪽 주석은 한 줄 요약 + "측정 근거는 `_shared/retry_state.py` 모듈 docstring 참고" 로 축약 검토(선택 사항, 낮은 우선순위).

- **[INFO]** 매직 넘버 스타일 사소한 지점
  - 위치: `.claude/_shared/block_integrity.py:138`
  - 상세: `contradiction_note()` 의 `k[:-3] if k.endswith(".md") else k` 에서 `-3` 은 `".md"` 의 길이를 하드코딩한 값이다. 바로 위 주석(133-136번째 줄)이 `removesuffix` 를 안 쓰는 이유(Python 3.9 요구, 하네스 최소 버전 상향 문제)를 이미 충실히 설명하고 있어 실질적 위험은 없지만, `-len(".md")` 로 쓰면 "3" 이라는 숫자와 ".md" 문자열 사이의 연결이 코드만 보고도 자명해진다.
  - 제안: `k[:-len(".md")]` 로 치환(선택 사항).

## 요약

이번 diff 의 핵심 리팩터(상태 bookkeeping 5종 → `_shared/retry_state.py`, Critical 하향 금지 backstop → `_shared/block_integrity.py`) 자체는 목적에 맞게 잘 추출됐고, 각 함수가 짧고 단일 책임을 유지하며 중첩도 낮다. 다만 리팩터 과정에서 흔히 생기는 "청소 잔재" 3건이 실제로 남았다 — 미사용 import 1건(`consistency_orchestrator.py`), 같은 자리에 중복 서술된 주석 블록 1건(`retry_state.py`), 그리고 이번 diff 의 목적과 무관한 근거 주석 하나가 조용히 삭제된 건(`code_review_orchestrator.py`, 다행히 README 에 사본이 남아 정보 자체는 보존됨). 여기에 새로 추가된 `notes`(advisory) 기능이 공유 `Outcome` 클래스의 정식 필드 목록에는 반영되지 않아 클래스 정의와 실제 사용이 어긋나는 지점도 있다. 모두 국소적이고 동작을 깨뜨리지는 않지만, 이 코드베이스 자체가 "왜" 를 남기는 데 유독 엄격한 컨벤션을 갖고 있는 만큼 같은 잣대로 보면 눈에 띄는 항목들이다.

## 위험도
LOW
