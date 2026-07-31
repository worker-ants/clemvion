# 성능(Performance) 리뷰 — round 8

방법론: 라운드 7이 "정적 형태 검사"로 두 번 놓친 뒤 벤치마크로만 잡힌 O(n²) 회귀였다는 경고에 따라,
정규식이 있는 모든 곳은 실제로 실행해 시간을 쟀다(추측·형태 판단 금지). 아래 CRITICAL 은 전부
`Read` 로 원본을 직접 연 뒤, 별도 Python 프로세스(백그라운드 + watchdog kill 또는 짧은 스크립트)로
재현한 결과다. truncate 되어 프롬프트에 안 실린 3개 대형 파일(`review_guard.py`,
`guard_review_before_push.py`, `code_review_orchestrator.py`)도 전문을 Read 했다.

## 발견사항

- **[CRITICAL]** `_BLOCK_AT_LINE_START` / `_BLOCK_AT_LINE_END` 가 공유하는 내부 부분식
  `\s*\**\s*(YES|NO)` 가 라운드 7이 고친 것과 **별개의 O(n²) catastrophic backtracking** 을
  그대로 갖고 있다 — 실측으로 재현.
  - 위치: `.claude/_shared/block_integrity.py:79-84` (두 정규식 정의), `:115-139`
    (`summary_block_verdict`, 실제 검색은 136-138줄), `.claude/hooks/_lib/review_guard.py:710-726`
    (`_summary_block_is_no`), `:729-771` (`_newest_resolved_impl_done_mtime` — 744·746줄에서 세션마다
    무조건 호출). 테스트 갭: `.claude/tests/test_block_integrity.py:470-517`
    (`VerdictParserStaysLinearTest`), 특히 어드버서리얼 입력을 만드는 503줄.
  - 상세:
    라운드 7 커밋(`5526fc8f8`)은 `_BLOCK_AT_LINE_START` 의 **선두** 문자 클래스
    `[\s>#*_\`-]*` 를 `[ \t>#*_\`-]*` 로 좁혀 "MULTILINE `^` 이 줄을 넘어 재스캔" 문제를 고쳤다.
    그런데 그 줄 바로 뒤, "BLOCK:" 리터럴 다음에 오는 `\s*\**\s*(YES|NO)` 부분식은 **두 정규식
    모두**에서 손대지 않은 채 남아 있다. 이 부분식 자체가 독립적인 이차 패턴이다 — 서로소인
    문자집합(`\s` vs `*`)이라도 **두 개의 인접한 무제한 quantifier 가 그 사이 alternation 이 끝내
    성공하지 못하는 상황**에서는 각 quantifier 가 서로의 실패를 반복 재시도하게 되어, MULTILINE 이나
    개행 유무와 무관하게 quadratic 이 된다. 직접 검증(격리 프로세스, watchdog):

      - 개행 섞인 입력(`"BLOCK:" + " \n"*k`, 원 버그 재현에 쓰인 것과 같은 스타일)으로
        `_BLOCK_AT_LINE_START`·`_BLOCK_AT_LINE_END` 둘 다 측정 — 배가마다 시간이 **정확히 ×4**:
        ```
        k        20      40      80     160     320     640    1280    2560    5120
        START  0.00002 0.00005 0.00020 0.00078 0.00309 0.01281 0.04948 0.19823 0.80014 (초)
        END    0.00002 0.00006 0.00020 0.00079 0.00311 0.01293 0.05238 0.21506 0.87840 (초)
        ```
      - **개행이 전혀 없는 한 줄** (`"BLOCK:" + " "*k`, pure space)으로도 동일 재현 — 즉 이 결함은
        `\s` 의 개행-횡단과 무관한, MULTILINE 과도 무관한 별개 매커니즘임을 확인:
        ```
        k       500    1000    2000    4000    8000   16000
        END   0.00243 0.00884 0.03260 0.12196 0.52002 1.98816 (초)  (×3.6~4.3/배가)
        ```
      - **실제 공개 함수** `summary_block_verdict()` 를 모듈에서 그대로 import 해, 이 파일 자신의
        docstring 이 인정하는 실제 패턴("BLOCK: 이 서사문에 한 번 언급되고 실제 판정은 그 근처에
        없음")으로 종단 재현 — 24KB(실제 커밋된 SUMMARY 최대 크기 16.5KB 와 같은 자릿수)에서 **5.7초**:
        ```python
        body = "그 결과 이전 세션은 BLOCK:" + ("  \n" * k) + "그 뒤로도 판정은 없었다."
        summary_block_verdict(body)
        # k=2000 (6KB)  → 0.357s
        # k=4000 (12KB) → 1.430s  (×4.0)
        # k=8000 (24KB) → 5.707s  (×4.0)  ← 실제 커밋 파일 크기대(최대 16,513B) 수준
        ```
      - 이전에 더 넓은 범위(`"*\n"*k` 반복, k=2000~128000)로 돌린 최초 시도는 **2분 이상, CPU
        94.8% 로 응답 없이 멈춰** SIGKILL 로 강제 종료해야 했다 — 실제 hang 을 직접 관측했다.

    회귀 테스트 갭도 확인했다: `test_block_integrity.py:493`
    (`test_no_verdict_in_a_large_document_returns_fast`)의 어드버서리얼 텍스트(503줄,
    `('> '*3+chr(10))*20000`)에는 **"BLOCK:" 리터럴이 단 한 번도 등장하지 않는다.** 두 정규식 모두
    `search`/`finditer` 진입 즉시(리터럴 프리픽스가 아예 없음) 실패해 순식간에 끝나므로, 이 테스트는
    라운드 7이 고친 "선두 클래스가 줄을 넘는" 경로만 재확인할 뿐, 위에서 재현한 "BLOCK: 이 존재하되
    그 뒤로 판정이 없는" 경로는 **한 번도 실행하지 않는다.** 즉 스위트가 초록인 채로 쌍둥이 결함이
    살아 있다 — 이번 라운드의 핵심 교훈("주석의 주장이 모든 배치를 커버하는지 확인")이 바로 이
    파일 안에서 재발한 사례다.

    도달 가능성도 확인: `_summary_block_is_no`(review_guard.py:726)는
    `_newest_resolved_impl_done_mtime`(729줄)의 루프 안에서 **채택되는 세션 하나가 아니라
    `--impl-done` 세션 전부**에 대해 무조건 호출된다(744·746줄) — "채택된 세션만 검사"라는 최적화는
    그 뒤에 이어지는 `contradiction_note` 호출(768줄, best_dir 로 한정)에만 적용되고, 판정 파싱
    자체는 한정되지 않는다. `origin/main` 실측: 커밋된 consistency 세션 729개 중 **386개가
    `--impl-done` 세션**이다 — 즉 spec-linked 코드 변경이 있는 매 push·매 turn-end 마다 이 취약한
    정규식이 최대 386회 호출된다. 이 파일 자신의 주석("SUMMARY 는 LLM 이 쓰는 markdown 이라 크기
    강제가 없다")이 이미 지적하듯, 386개 중 단 하나가 우연히(혹은 악의적으로) 이 모양을 갖는 순간
    그 이후 모든 push/turn-end 가 멈춘다 — 훅이 타임아웃하면 fail-open 되어, 이 PR 전체가 강화하려는
    바로 그 게이트를 무력화한다(라운드 7 커밋 메시지가 명시한 위험과 동일 구조).
  - 제안: 두 정규식의 `\s*\**\s*` 를 **단일 quantifier** 로 합쳐 split-point 모호성 자체를
    제거할 것 — 예: `BLOCK:[ \t*]*(YES|NO)[ \t*]*$` (END), 대응되는 START 도 동일 원리. 검증:
    이 대안으로 위 24KB~64000자 케이스 전부 **선형**(64,000자에서 0.00123초)이었고, 기존 5개
    검증 케이스(`"**BLOCK: NO** — …"`, `"## BLOCK: NO"`, override 배너, `"BLOCK:  YES"`, 한국어
    프리픽스)에서 원본과 **동일한 group(1) 결과**를 냈다. 다만 이 파일의 다른 정규식들이 받은 것과
    같은 수준의 정밀 검토(`guard_review_before_push.py` 의 `_GIT_PUSH` 처럼 여러 라운드 벤치마크)
    없이 그대로 채택하지는 말 것 — 위 대안은 "이런 방향이 통한다"는 검증이지 처방은 아니다. 회귀
    테스트는 반드시 **"BLOCK:" 가 실제로 등장하는** 어드버서리얼 케이스를 추가해야 한다(현재
    테스트는 이 축을 커버하지 않는다).

- **[INFO]** `_evaluate_over_targets` 의 라운드 7 수정(조기 return 제거) 자체는 재검증 결과 정상 —
  다만 그 트레이드오프의 경계 하나를 기록.
  - 위치: `.claude/hooks/guard_review_before_push.py:809-883` (`_evaluate_over_targets`),
    `:886-930` (`_run_gates`).
  - 상세: `_evaluate_over_targets` 는 이제 블로킹 target 을 만나도 루프를 끝까지 돈다(875-880줄) —
    "이후 target 의 notes 를 잃지 않기 위해"라는 주석대로 동작 확인. 성능 비용은 미미하다: target
    수는 보통 1(cwd)이고 많아야 push 커맨드가 언급하는 워크트리 수만큼만 늘어나므로(`_push_targets`),
    반복돼도 evaluate_review() 자체 비용의 작은 배수다. 다만 `_run_gates`(886-930줄)는 REVIEW
    게이트가 막히면 **PLAN 게이트를 아예 평가하지 않고 그 자리에서 `return 2`** 한다(907줄). 지금은
    `PlanDecision` 에 `notes` 필드가 없어 당장 유실되는 정보는 없지만, `ReviewDecision` 처럼 notes 가
    추가되는 순간 "먼저 막는 게이트만 최대한 target 을 순회하고, 이후 게이트는 통째로 스킵"되는 같은
    계열의 사각지대가 된다 — 이번 라운드가 고친 것과 "게이트 간" 축에서의 거울상이다. 지금 당장
    액션은 불필요(현재는 참인 무해함), 다음에 PlanDecision 이 notes 를 얻을 때 이 지점을 함께
    검토할 것.

- **[INFO]** `_spec_code_patterns()` — 캐시 없이 매 push target 마다 `spec/` 전체 재파싱
  (이번 diff 가 만든 회귀 아님, 기존 동작).
  - 위치: `.claude/hooks/_lib/review_guard.py:653-672` (`_spec_code_patterns`), 호출부는
    `:675-686` (`_spec_linked_changes`), `:976-979` (`evaluate_review` Gate 2).
  - 상세: 매 `evaluate_review()` 호출(= target 하나당 한 번)마다 `spec/` 전체를 `os.walk` 하고
    모든 `.md` 파일의 frontmatter 를 다시 파싱한다. 실측(이 저장소, `spec/` 383개 `.md`,
    505개 glob 패턴): 콜드 0.069초, 웜 0.015초/call. target 이 여러 개(멀티 워크트리 push)면
    그 배수로 반복된다. 절대 비용은 작지만(수십 ms), 이번 라운드에서 target 순회가 다중화된 만큼
    `functools.lru_cache` 등으로 프로세스 수명 동안 1회만 계산하도록 캐싱할 후보로 남긴다 — 시급도는
    낮음.

## 그 밖에 확인한 것 (문제 아님, 근거만 기록)

- `guard_review_before_push.py` 의 `_GIT_PUSH`/`_redact_inert_text`/`_commit_heredoc_spans`
  정규식 뭉치는 이번 diff 가 건드리지 않았다(변경분은 `_evaluate_over_targets`/`_report_notes`
  뿐). 그럼에도 회귀 여부를 실측으로 스팟체크(각 최대 46만자 어드버서리얼 입력 5종) — 전부
  0.0003초 이내, hang 없음.
- `review_guard.py` 의 `_newest_resolved_impl_done_mtime` 자체는 이미 측정 기반 최적화를 담고
  있다 — "채택된 세션 하나만 `contradiction_note` 계산"(758-760줄 주석, +0.39초 실측 회피)과
  `evaluate_review()` 안에서 `git status` 를 한 번만 불러 재사용하는 `dirty` 공유(950-952줄)가
  그 예다. `retry_state.py` 로의 함수 이동(3개 오케스트레이터가 공유)도 AST 비교로 실제 동일함을
  확인한 뒤 이뤄졌다(문서화된 근거 그대로). `save_state` 의 temp-file + `os.replace` 원자적 쓰기는
  세 소비자 모두에서 그대로 재사용되며 추가 비용이 없다. `build_files_section`/`_rank_plan_text`
  이중 I/O 등 이미 알려진 항목들은 `plan/in-progress/harness-review-gate-ci-backstop.md` 에
  실측치와 함께 이미 등재·defer 되어 있어 재론하지 않았다(항목 1, 3, 4, 7, 12).

## 요약

이번 라운드의 핵심은 라운드 7이 고쳤다고 선언한 바로 그 클래스의 결함이 **같은 파일, 두 정규식
모두에 형태만 다르게 살아남아 있다**는 것이다. `_BLOCK_AT_LINE_START`/`_BLOCK_AT_LINE_END` 가
공유하는 `\s*\**\s*(YES|NO)` 부분식은 MULTILINE 이나 개행 유무와 무관한 독립적 O(n²)
catastrophic-backtracking 이며, 실제 공개 함수 `summary_block_verdict()` 에 현실적인 입력
모양(한국어 서사문 중 "BLOCK:" 한 번 언급 + 공백 많은 markdown)을 먹였을 때 24KB(실제 커밋된
SUMMARY 최대 크기와 같은 자릿수)에서 5.7초가 걸렸고, 더 큰 입력에서는 실제로 프로세스가 멈춰
SIGKILL 해야 했다. 이 경로는 `--impl-done` 세션(현재 386개 커밋됨) 전부에 대해 매 push·매
turn-end 마다 무조건 실행되므로, 그중 하나라도 이 모양을 가지면 게이트 전체가 얼어붙는다 — 훅의
fail-open 특성상 결과는 "리뷰 게이트 무력화"다. 기존 회귀 테스트는 "BLOCK:" 리터럴이 아예 없는
입력만 재현해 이 경로를 한 번도 밟지 않으므로, 스위트가 초록인 채로 결함이 남아 있다. 이번 diff
의 다른 부분(조기 return 제거, 상태 통합, 세션당 1회 note 계산 등)은 실측에 기반한 견실한 선택이었고
회귀도 없었다 — 문제는 정확히 이 두 정규식으로 국한된다.

## 위험도
CRITICAL
