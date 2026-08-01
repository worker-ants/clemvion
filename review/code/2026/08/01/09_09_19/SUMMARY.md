# Documentation Review — harness-block-backstop (round 9 / 09_09_19)

## 검증 방법 (요약보다 먼저 기록)

- `git diff origin/main...HEAD --stat` 로 이 PR 이 실제 건드린 17개 파일을 확정하고, 프롬프트에서 잘려 있던 6개(`review_guard.py`, `guard_review_before_push.py`, `code_review_orchestrator.py`, `consistency_orchestrator.py`, `.claude/tests/README.md`, `test_block_integrity.py`)와 부분 절단된 1개(`merge_coordinator_orchestrator.py`)를 전부 `Read`/`git diff`로 직접 열어 확인했다. 판단은 전체 파일이 아니라 **이 PR 이 실제로 바꾼 줄**을 기준으로 했다.
- 이전 라운드들의 문서화 리뷰 산출물(`review/code/2026/08/01/00_33_34`, `08_11_19`)과 5R RESOLUTION(`review/code/2026/08/01/01_17_35/RESOLUTION.md`)을 대조해, 과거에 지적된 항목이 **현재 코드에서 실제로 해소됐는지**를 재확인했다(뒤에서 재확인한 것만 "확인됨"으로 적었다).
- `.claude/_shared/block_integrity.py`·`test_block_integrity.py`의 수치 주장(732/698/24/10, 400/242/72, 1,506/1,507)을 서로, 그리고 `.claude/tests/README.md`·`plan/in-progress/harness-review-gate-ci-backstop.md`와 대조해 산술 일치를 확인했다(698+24+10=732, 24/732≈3.3% 등 — 일치).
- `grep -n "^class "`로 `test_block_integrity.py`(13개 클래스)·`test_retry_state_shared.py`(3개 클래스)의 실제 클래스 목록을 뽑아 README 카탈로그 행의 서술과 1:1 대조했다(아래 WARNING 근거).
- diff 전역의 `os.environ` 신규 사용을 grep(테스트 전용 `FAKE_NOTE` 1건만 확인) → 설정 문서 갱신 대상 없음을 확인. `CHANGELOG.md`의 기존 섹션 헤더를 전수 grep(전부 `codebase/`+`spec/` 제품 변경) → 이 diff(하네스 전용)는 관례상 CHANGELOG 대상 아님을 재확인.
- 라운드 컨텍스트가 지목한 "이차식 정규식 결함이 완전히 닫혔는가" 서사를, docstring↔코드↔테스트 세 지점을 직접 대조해 추적했다 — 아래 "확인했으나 문제 없음" 참고.

## 발견사항

- **[WARNING]** `.claude/tests/README.md`의 `test_block_integrity.py` 카탈로그 행이 실제 파일 규모의 4분의 1 이하만 서술한다 — 이번 PR(7R/8R)이 이 라운드의 핵심 주제(이차식 정규식 재발)를 막으려 추가한 회귀 테스트가 카탈로그에서 빠져 있다
  - 위치: `.claude/tests/README.md:60` (`test_block_integrity.py` 행)
  - 상세: 현재 `test_block_integrity.py`는 13개 테스트 클래스를 갖는다(`grep -n "^class "` 확인: `CountCriticalTagsTest`(36) · `CheckerListIsCanonicalTest`(57) · `VerdictIsAnchoredTest`(114) · `DowngradedCriticalsTest`(177) · `GateSurfacesTheContradictionTest`(235) · `AdvisoryReachesTheModelTest`(294) · `NotesReachBothHooksTest`(334) · `NotesFromLaterTargetsSurviveAnEarlierBlockTest`(416) · `VerdictParserStaysLinearTest`(470) · `SpecGlobCompilationIsBoundedTest`(549) · `PlanStubsMirrorTheRealInterfaceTest`(612) · `StopThrottleKeysOnTextTest`(664) · `NotesSurviveBlockingTest`(732)). README 의 한 문단짜리 서술은 이 중 처음 3개(태그 카운팅·verdict 앵커링·downgraded 판정)만 다루고, 나머지 10개는 전혀 언급하지 않는다. 특히 이번 라운드가 주목하라고 명시한 바로 그 결함 클래스를 막는 `VerdictParserStaysLinearTest`(라인 470 — "7R 이 이차식 하나를 고치고 몇 글자 뒤의 두 번째를 놓쳤다"는 이 세션 전체의 서사를 정확히 막는 3개 회귀 테스트)와 `SpecGlobCompilationIsBoundedTest`(라인 549 — `review_guard._glob_to_regex`의 지수적 백트래킹 방어, 8R 의 C2)가 완전히 빠져 있다. 두 클래스 모두 이번 PR 이 겪은 CRITICAL 재발의 유일한 기계적 방어선인데, 이 파일이 그 방어를 담고 있다는 사실 자체를 README 만 보고는 알 수 없다. `NotesReachBothHooksTest`(334)·`NotesFromLaterTargetsSurviveAnEarlierBlockTest`(416) 같은 "배선이 실제로 연결됐는가" 테스트(4R/5R 이 새로 발견한 결함들의 회귀 가드)도 마찬가지로 누락. 이 저장소의 `test_tests_readme_catalog.py`는 "행이 있는지/가리키는 파일이 존재하는지"만 강제하고 행의 **내용 완결성**은 검사하지 않으므로, 이 드리프트를 잡아줄 기계적 backstop이 없다.
  - 제안: 행을 확장해 최소 다음 세 축을 한 문장씩 추가: (1) 두 이차식 회귀 가드가 서로 다른 크기의 적대적 입력으로 서로 다른 하위식(선두 클래스/리터럴-판정 사이 gap/판정-뒤 tail)을 겨냥한다는 것, (2) `_glob_to_regex`의 와일드카드 상한(지수적 백트래킹 방어)도 이 파일이 지킨다는 것, (3) advisory 가 두 훅(push/stop) 모두에 배선돼 있고 target 순서·차단 경로에서도 유실되지 않음을 이 파일이 검증한다는 것.

- **[INFO]** 같은 성격의 더 작은 드리프트 2건 — `test_retry_state_shared.py` 행과 `test_review_guard.py` 행
  - 위치: `.claude/tests/README.md:61` (`test_retry_state_shared.py` 행), `.claude/tests/README.md:32` (`test_review_guard.py` 행)
  - 상세: (a) `test_retry_state_shared.py`는 3개 클래스(`SummaryStateCliTest`(38) · `AtomicWriteTest`(98) · `MergeCoordinatorUsesTheSharedStateTest`(142))를 갖는데, README 행은 앞의 둘(stdout 형식·"reconciled" 알림·원자적 쓰기)만 서술하고 세 번째를 언급하지 않는다. 이 클래스는 그 파일 자신의 docstring 이 "The third consumer, which had no test of its own... the migration was unguarded on the one orchestrator with no other coverage" 로 스스로 강조하는 항목이라 누락이 더 눈에 띈다. (b) `test_review_guard.py` 행(라인 32)은 "spec `code:` glob → regex" 를 이 파일이 다룬다고 서술하지만, 그 함수(`_glob_to_regex`)의 ReDoS 방어 회귀 테스트(`SpecGlobCompilationIsBoundedTest`)는 실제로는 **다른 파일**(`test_block_integrity.py`)에 있다 — README 어디에도 이 분리를 알리는 상호 참조가 없어, "`_glob_to_regex`가 안전한지"를 확인하려는 사람이 `test_review_guard.py` 행만 보고는 그 답을 찾지 못한다.
  - 제안: (a)에 "및 merge-coordinator의 `--summary-state`/`--update` 위임(이 orchestrator의 유일한 자체 테스트)" 한 구절 추가. (b)에 "ReDoS 상한 테스트는 `test_block_integrity.py` 참고" 각주 추가.

- **[INFO]** `retry_state.load_state()` 에 여전히 docstring 이 없음 — 같은 파일의 형제 함수 4개는 모두 있음 (이전 라운드에서 이미 지적된 항목, 아직 미해소)
  - 위치: `.claude/_shared/retry_state.py:41` (`load_state` 함수 정의)
  - 상세: `save_state`(50) · `reconcile_state_with_disk`(94) · `emit_summary_state`(135) · `apply_status_update`(174) 는 모두 근거·계약을 설명하는 docstring 을 갖췄는데 `load_state` 만 없다. 이 함수는 `_retry_state.json` 이 없으면 stderr 메시지 후 `sys.exit(1)` 로 하드 실패하는, 호출자가 알아야 할 계약을 갖고 있어 이름만으로는 그 계약이 드러나지 않는다. 이 항목은 이전 문서화 리뷰 라운드에서 이미 보고됐고(같은 파일, 같은 함수) 여러 차례의 후속 수정(4R/5R/8R)에서도 손대지 않은 채 남아 있다 — 트리비얼해서 우선순위가 낮게 유지되는 것으로 보이나, 사실 관계는 변하지 않았다.
  - 제안: 한 줄 docstring 추가. 예: `"""Load _retry_state.json, or exit(1) with a stderr message if the session directory has none yet."""`

- **[INFO]** `block_integrity.py` 안에서 인접한 두 "전수 검증" 주석이 서로 다른 파일 수를 인용한다 (1,506 vs 1,507) — 근거 불명, 실제 결함은 아닐 가능성이 높음
  - 위치: `.claude/_shared/block_integrity.py:77-78` (leading-class 수정 옆 "1,506"), `.claude/_shared/block_integrity.py:95-96` (gap 수정 옆 "1,507")
  - 상세: 두 주석 모두 "Verified against/across all N committed SUMMARY files: 0 verdicts differ" 형태로 같은 대상(커밋된 `review/consistency/**/SUMMARY.md`)을 가리키는데 N 이 1 다르다. `git show`로 대조하면 전자는 7R 커밋(`5526fc8f8`)에서, 후자는 8R 커밋(`54fff611f`)에서 각각 독립적으로 실측된 값이라 — 두 커밋 사이(같은 날 새벽 03:13→08:50)에 커밋된 다른 consistency 세션이 하나 늘었을 가능성이 높다. 즉 진짜 오류라기보다 "같은 모집단을 가리키는 것처럼 보이지만 실제로는 서로 다른 시점의 스냅샷"이라 발생한 자연스러운 드리프트로 보인다. 다만 이 저장소가 수치 정확성에 두는 비중을 감안하면, 같은 파일 안에서 "committed SUMMARY files" 라는 동일 표현이 인접한 두 곳에서 다른 숫자로 등장하는 것은 세심한 독자에게 "어느 쪽이 맞는가"라는 불필요한 의문을 남긴다.
  - 제안: 조치 불요에 가까움(둘 다 그 시점 실측이라는 이 저장소의 기존 관례와 일치). 다듬는다면 한쪽에 "(7R 시점)"/"(8R 재측정, 그 사이 커밋된 세션 +1)" 한 구절만 추가해도 혼동이 사라짐.

## 확인했으나 문제 없음 (참고)

- **이전 라운드 WARNING 해소 확인**: `review/code/2026/08/01/00_33_34/documentation.md`가 지적한 "하향-모순 백스톱의 적용 범위(--impl-done 세션 한정)가 정책 문서에 명시되지 않음" 문제는 현재 `.claude/agents/consistency-summary.md`(§요약 지침 3 인용문, "그 경고는 현재 `--impl-done` 세션이... 채택될 때만 발화하므로...")와 `.claude/skills/consistency-checker/SKILL.md`(§4, 동일 범위 한정 절)에 모두 반영돼 있음을 직접 확인했다(4R 커밋 `179263dd2`의 [W8]). 재발 아님.
- **이차식 정규식 서사의 완결성**: 이번 라운드 컨텍스트가 요구한 "고친 이차식이 같은 클래스의 다른 인스턴스를 놓치지 않았는가"를 코드로 직접 추적했다. `_BLOCK_AT_LINE_START`(leading class)·리터럴-판정 사이 gap·`_BLOCK_AT_LINE_END`의 tail gap, 세 지점 모두 `[ \t*]`류의 개행-제외 클래스로 통일돼 있고, `VerdictParserStaysLinearTest`(라인 470)의 세 테스트 메서드가 정확히 그 세 지점을 서로 다른 크기(20,000줄 vs 45,000자)로 각각 겨냥한다 — 그 크기 분리 자체가 "한 결함에 맞춘 크기를 다른 결함에 재사용하면 vacuous 해진다"는, 이 라운드의 컨텍스트가 경고한 바로 그 실수를 8R 커밋 메시지가 스스로 서술하며 고친 결과다. docstring 의 주장과 실제 정규식·테스트가 정합함을 확인했다.
- **CHANGELOG.md**: 전체 섹션 헤더를 grep 한 결과 예외 없이 `codebase/`+`spec/` 제품 변경만 기록돼 있고 `.claude/` 하네스 변경은 이력 전체에 없다. 이번 diff 는 하네스 전용이므로 갱신 누락이 아니다.
- **환경변수/설정**: diff 전역에서 `os.environ` 신규 사용은 테스트 전용 `FAKE_NOTE` 1건뿐. 실제 설정 옵션 추가 없음 — 설정 문서 갱신 대상 아님.
- **API 문서**: REST 엔드포인트 변경 없음(훅/오케스트레이터 내부 로직) — 대상 아님.
- **plan 문서 위생**: `plan/in-progress/harness-review-gate-ci-backstop.md` 는 frontmatter 필수 3필드(`worktree`/`started`/`owner`)를 갖추고(`spec_impact`는 완료 시점 필드라 in-progress 단계 의무 아님 — `plan-lifecycle.md` §4 확인), 상단 진행 요약 표가 이번 라운드까지의 처분을 정확히 반영하며, 항목 9의 자기 정정 각주("`_apply_status_update`가 다르다던 첫 서술은 틀렸다")를 실제 `merge_coordinator_orchestrator.py:91-100` 주석과 대조해 정확함을 확인했다. 번호 체계(1~12 + 비고 항목)에 누락/중복 없음.
- **자기 정정형 주석**: `retry_state.save_state` docstring(재도출 보장 범위를 `agents_success` 로 좁힌 정정)과 `merge_coordinator_orchestrator.py`의 `_apply_status_update` 서술 정정 모두 실제 코드와 대조해 정확함을 재확인했다.
- **`.claude/README.md` / skill README 상호참조**: 이번 diff 가 바꾼 훅 내부 동작(advisory `notes` 배선)을 상위 인덱스 문서(`.claude/README.md`)가 미러링할 필요는 없음 — 그 문서는 훅 구현 세부사항이 아니라 디렉토리 의미/역할 인덱스이고, 기존에도 개별 훅의 내부 로직을 서술하지 않는 관례였다.
- **예제 코드**: 신규 공유 모듈(`block_integrity.py`, `retry_state.py`)은 다른 하네스 코드만 소비하는 내부 배관이라 별도 사용 예제가 필요한 공개 API 가 아니다. CLI 사용 예시가 필요한 `consistency_orchestrator.py`는 SKILL.md 에 기존 bash 블록으로 이미 제공됨.

## 요약

이번 diff는 문서화 관점에서 여전히 높은 수준이다 — 신규 모듈(`block_integrity.py`, `retry_state.py`)의 모든 공개 함수(단 하나 제외)가 "왜"를 실측치와 함께 설명하는 docstring 을 갖췄고, 이전 라운드가 지적한 정책 문서의 범위-한정 누락은 이미 해소됐으며, 이차식 정규식 재발을 막는 서사(docstring↔코드↔테스트)를 직접 추적한 결과 세 지점(선두 클래스/리터럴-판정 gap/tail gap) 모두 서로 다른 크기의 적대적 입력으로 개별 고정돼 있어 이 라운드가 우려한 "한 인스턴스만 고치고 같은 클래스의 다른 인스턴스를 놓치는" 패턴은 발견되지 않았다. 다만 `.claude/tests/README.md` 의 테스트 카탈로그가 여러 라운드에 걸쳐 커진 `test_block_integrity.py`(13개 클래스)와 `test_retry_state_shared.py`(3개 클래스)의 실제 내용을 따라가지 못해, 정작 이번 세션의 핵심 방어선(이차식 회귀 가드 2건, glob 지수 백트래킹 가드 1건, advisory 배선 검증 2건)이 카탈로그 어디에도 서술되지 않는 완결성 갭이 남아 있다(WARNING). 나머지는 이전부터 남아 있던 사소한 docstring 누락 1건과, 실제 결함이라기보다 두 시점 측정치가 자연스럽게 1건 어긋난 것으로 보이는 매우 낮은 심각도의 숫자 드리프트 1건이다.

## 위험도

LOW

---

Full report written to `/Volumes/project/private/clemvion/.claude/worktrees/harness-block-backstop-b56163/review/code/2026/08/01/09_09_19/documentation.md`.

Files inspected directly (beyond the prompt bundle, due to truncation or to verify current HEAD state): `/Volumes/project/private/clemvion/.claude/worktrees/harness-block-backstop-b56163/.claude/hooks/_lib/review_guard.py`, `/Volumes/project/private/clemvion/.claude/worktrees/harness-block-backstop-b56163/.claude/hooks/guard_review_before_push.py`, `/Volumes/project/private/clemvion/.claude/worktrees/harness-block-backstop-b56163/.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`, `/Volumes/project/private/clemvion/.claude/worktrees/harness-block-backstop-b56163/.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`, `/Volumes/project/private/clemvion/.claude/worktrees/harness-block-backstop-b56163/.claude/tests/README.md`, `/Volumes/project/private/clemvion/.claude/worktrees/harness-block-backstop-b56163/.claude/tests/test_block_integrity.py`, `/Volumes/project/private/clemvion/.claude/worktrees/harness-block-backstop-b56163/.claude/tests/test_retry_state_shared.py`, `/Volumes/project/private/clemvion/.claude/worktrees/harness-block-backstop-b56163/.claude/_shared/retry_state.py`, `/Volumes/project/private/clemvion/.claude/worktrees/harness-block-backstop-b56163/.claude/_shared/block_integrity.py`, `/Volumes/project/private/clemvion/.claude/worktrees/harness-block-backstop-b56163/plan/in-progress/harness-review-gate-ci-backstop.md`.

STATUS: SUCCESS