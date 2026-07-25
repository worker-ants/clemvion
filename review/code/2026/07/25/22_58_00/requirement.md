# 요구사항(Requirement) 리뷰 — review/consistency/2026/07/25/{19_13_33,21_35_11,21_58_52,22_28_51}/**

## 사전 확인 사항

이번 diff(`origin/main` 대비)는 `codebase/` 변경이 전혀 없다. 실제 코드 수정(Cafe24/MakeShop 노드
`abortSignal` cascade + handler `AbortError` 재throw 가드)은 이전 커밋들(`f4b2f9434`, `e22950713`,
`0cfd547a8`, `595924885` 등)에서 이미 완료·리뷰됐고, 그 코드는 실제로 직접 열어 대조한 결과
(`cafe24.handler.ts:262-272`, `makeshop.handler.ts` 동형, `cafe24-api.client.spec.ts:285` 등)
각 세션 문서가 주장하는 그대로 존재함을 확인했다. 이번 리뷰 대상 diff 는 순수하게
`review/consistency/2026/07/25/**` 하위에 새로 생성된 consistency-check 세션 산출물
(`_retry_state.json`/`meta.json`/checker `.md`/`SUMMARY.md`/`RESOLUTION.md`) 26개 파일뿐이다.
따라서 본 리뷰의 "기능"은 이 산출물 자체 — 즉 harness 가 자신의 governing 규약(consistency-summary
에이전트 정의, `_retry_state.json` 스키마)을 정확히 이행했는지, 그리고 리포트 내용이 실제 저장소
상태와 line-level 로 일치하는지 — 를 대상으로 한다.

## 발견사항

- **[CRITICAL]** `SUMMARY.md`(22_28_51)가 checker 의 `[CRITICAL]` 발견을 자체 판단으로 하향 재분류해
  `BLOCK: NO` 를 선언 — 자신을 생성하는 `consistency-summary` 에이전트의 명시적·예외 없는 규칙을
  위반하며, 이 위반은 `review_guard.py` 의 push 게이트를 실제로 무력화하는 결과로 이어진다.
  - 위치: `review/consistency/2026/07/25/22_28_51/SUMMARY.md:3`(`**BLOCK: NO** — Critical 로 원
    보고된 1건은...`), `:8-12`(`## Critical 위배 (BLOCK 사유)` 섹션이 `_해당 없음 — 아래 참고._` 로
    비워지고, 인용문에서 "cross_spec 은 ... **CRITICAL** 로 판정했다 ... 통합 판단에서는 **WARNING**
    으로 재분류해 ... **BLOCK 사유에서 제외**한다" 라고 명시적으로 하향 서술)
  - 근거(원 CRITICAL): 같은 세션의 `review/consistency/2026/07/25/22_28_51/cross_spec.md:15`
    (`### [CRITICAL] node-cancellation.md §6 구현 현황 표가 실제 코드·추적 plan 과 반대로 기술됨`) —
    이 checker 는 이를 명확히 `[CRITICAL]` 로 태깅했고 자신의 요약도 이 항목을 근거로 한다.
  - 위반 규약: `.claude/agents/consistency-summary.md` — line 20/35 "Critical 1건이라도 있으면
    상단 **`BLOCK: YES`**"(예외 조항 없음), line 44 "중복 제거 — 여러 checker 가 동일 위배를 다른
    각도로 지적한 경우 **가장 강한 등급**으로 통합"(SUMMARY 는 반대로 **가장 약한 등급**으로
    통합했다), line 45 "차단 결정 명시 — Critical 1건 이상 → BLOCK: YES". 프로젝트 전역에서 이
    규칙에 대한 "checker 간 이견 시 통합 판단으로 override 가능" 같은 예외 문서를 찾지 못했다
    (`.claude/docs/subagent-call-contract.md`, `.claude/skills/consistency-checker/SKILL.md` grep
    결과 관련 조항 없음).
  - 결과의 실질적 영향: `.claude/hooks/_lib/review_guard.py`(module docstring §2, `_BLOCK_LINE =
    re.compile(r"BLOCK:\s*(YES|NO)")`, `_iter_consistency_summaries`/`_impl_done_ok` 류 함수)는
    **`SUMMARY.md` 최상단 `BLOCK:` 한 줄만 파싱**해 "fresh `--impl-done` consistency report
    (BLOCK: NO)" 존재 여부로 SPEC-CONSISTENCY 게이트를 통과시킨다 — 개별 checker 파일의
    `[CRITICAL]` 태그는 게이트가 직접 재검사하지 않는다. 즉 이번 SUMMARY 의 하향 재분류는
    "문서상 표현"에 그치지 않고, **게이트가 실제로 통과되도록 만드는 효과**를 낸다. 내용 자체(§6
    표 stale = 이미 developer 가 `spec/` 쓰기 권한 부재로 `project-planner` 에 올바르게 위임한
    SPEC-DRIFT)는 실측상 타당해 보이지만, 그 판단을 "SUMMARY 가 재량으로 Critical→Warning
    전환 + BLOCK 제외" 형태로 내리는 것은 consistency-summary 에이전트 자신의 계약을 벗어난
    행동이며, 이 하네스가 이미 여러 차례(메모리: `feedback_workflow_disk_write_gap_false_counts`
    류) 겪은 "BLOCK 계산에서 진짜 Critical 이 조용히 빠지는" 패턴과 구조적으로 동일하다. 다음에
    이런 재분류 판단이 틀렸을 경우(진짜 blocking 사안을 "이미 위임됨"으로 오판) 게이트가 이를
    잡아낼 방법이 없다.
  - 제안: (a) 즉시 조치 — `consistency-summary.md` 규칙대로면 이 세션은 `BLOCK: YES` 여야 했다.
    이미 push 가 이뤄졌다면(git log 상 이 세션 이후에도 커밋이 이어짐) 사후적으로라도
    `project-planner` 가 §6 두 행을 실제로 갱신해 이 SPEC-DRIFT 를 종결하는 것이 최선이다.
    (b) 구조적 조치 — `consistency-summary.md` 에 "checker 간 등급 이견 시 하향 재분류를 허용하는
    조건"을 명문화(예: "다른 2개 이상 checker 가 동일 사실을 실사해 이미 올바르게 위임된 상태임을
    확인한 경우에 한해 WARNING 으로 재분류 가능, 단 원 checker 의 판정과 재분류 근거를 표에 그대로
    보존"). 이렇게 규칙을 갱신하지 않는 한, 앞으로도 이 하향 로직은 매번 규약 위반이다. 이 조치는
    `project-planner`/harness 관리자 몫이며 본 리뷰어는 `.claude/agents/` 를 직접 수정하지 않는다.

- **[WARNING]** `review/consistency/2026/07/25/21_35_11/` 세션이 실제 checker 실행 결과 없이(모든
  checker "pending", `SUMMARY.md` 부재) 영구 커밋됨 — 완료된 감사 기록인지 방치된 실패 시도인지
  구분할 수 없는 상태로 저장소에 남는다.
  - 위치: `review/consistency/2026/07/25/21_35_11/_retry_state.json` (파일 8, gate 37-43 —
    `"agents_pending": ["cross_spec", "rationale_continuity", "convention_compliance",
    "plan_coherence", "naming_collision"]`, `"agents_success": []`), 같은 디렉토리
    `meta.json`(파일 9) 만 존재.
  - 상세: 이 diff 에 포함된 26개 파일 중 이 세션만 `meta.json`+`_retry_state.json` 두 개뿐이고
    5개 checker `.md` 리포트도 `SUMMARY.md` 도 없다. 실제 워크트리에서
    `ls review/consistency/2026/07/25/21_35_11/` 로 직접 확인해도(스캐폴드 `_prompts/` 제외)
    이 두 파일만 존재한다 — diff 누락이 아니라 애초에 산출물이 생성되지 않았다. 반면 같은 타임스탬프의
    **코드 리뷰** 세션(`review/code/2026/07/25/21_35_11/`)은 8개 reviewer `.md` + `SUMMARY.md` 까지
    전부 정상 완료돼 있어, 대조적으로 이 consistency 세션만 방치됐음이 뚜렷하다. plan 문서
    (`node-cancellation-residual-signal-propagation.md`, `spec-update-node-cancellation-shutdown-
    classification.md`) 어디에도 이 세션의 존재나 중단 사유에 대한 언급이 없다(grep 0건) — 23분
    뒤 `21_58_52` 세션이 처음부터 다시 전체를 수행해 완결했으므로 기능적 영향은 없으나, 감사
    추적(review/ 산출물의 존재 이유)이라는 관점에서 "시도했으나 결과 없음"을 아무 표시 없이
    반영구 보존하는 것은 향후 이 디렉토리를 훑는 사람(사람이든 spec-coverage 류 자동 감사든)에게
    혼란을 준다 — 이 세션이 성공했는지, 무엇을 놓쳤는지 알 수 없다.
  - 제안: 이런 "0-output" 세션은 커밋 전에 정리하거나(harness 차원의 자동 정리 규칙 도입 검토),
    최소한 남기기로 한다면 어떤 사유로 중단됐는지 한 줄이라도 `meta.json` 에 남기는 관례를 고려.
    본 리뷰의 판단만으로는 코드 fix 가 필요한 결함은 아니라 WARNING 수준.

- **[INFO]** 그 외 리포트 본문의 사실관계는 실측 결과 정확함을 확인
  - `spec/conventions/node-cancellation.md` §5.1(`meta.success = false`, `code: 'AbortError'`),
    §6 표(137-139행, MakeShop/Cafe24 "— 미구현(Planned)")를 직접 열어 대조한 결과 각 세션의
    `cross_spec.md`/`convention_compliance.md` 인용이 정확했다(지어낸 문구 없음).
  - `cafe24.handler.ts:262-272`/`makeshop.handler.ts` 동형 위치에 `if (err instanceof Error &&
    err.name === 'AbortError') { throw err; }` 재throw 가드가 실제로 존재해, 21_58_52 라운드의
    CRITICAL(핸들러가 재throw 된 AbortError 를 다시 삼킴)이 이후 커밋(`0cfd547a8`)으로 실제
    해소됐다는 22_28_51 라운드의 주장과 일치했다.
  - `cafe24-api.client.spec.ts:285` 이 `'products'` 로 수정돼(커밋 `595924885`) 21_58_52
    `SUMMARY.md` INFO2/22_28_51 권장사항 5가 실제로 반영됐음을 확인했다.
  - `plan/in-progress/node-cancellation-residual-signal-propagation.md` 의 `worktree:` frontmatter
    가 `node-cancel-signal-b4d1` 로 갱신돼 있어(WARNING 해소 확인), `spec/conventions/` 자체는
    `git diff origin/main --stat -- spec/conventions/` 결과 0건으로 각 세션의 "target 미변경" 주장과
    일치했다. `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 도 실재하며
    developer 의 `spec/` 쓰기 권한 부재 위임 절차(CLAUDE.md 준수)가 서술대로 이행돼 있었다.
  - `_retry_state.json`/`meta.json` 스키마(session_dir/summary_subagent_type/summary_output_file/
    subagent_invocations/agents_pending·success·fatal/agent_history/rate_limit_episodes/
    total_wait_sec/wake_history/last_reset_hint_sec/loop_mode)는 `consistency_orchestrator.py:692-
    714` 의 초기 생성 로직과 필드 단위로 정확히 일치한다. `agents_success: []` 가 4개 세션 모두
    영구 고정된 것은 결함이 아니라 설계된 동작이다 — 같은 스크립트(line 143-154 주석)가 "main 이
    `--update`/`--summary-state` 를 호출하지 않는 수동 Agent fan-out 경로에서는 상태가 준비-시점
    스냅샷에 고정되고, 실제 완료 여부는 읽는 시점에 디스크 리포트로 재조정(self-heal)된다"고 명시한다.

## 요약

이번 diff 는 애플리케이션 코드가 아니라 4회의 consistency-check 세션 산출물이며, 그 내용이
주장하는 사실(spec 문구, 코드 라인, 커밋 이력, 이전 CRITICAL 해소 여부)은 전부 직접 대조한 결과
정확했다. 그러나 산출물 자체의 "기능"(harness 가 자신의 규약을 정확히 수행하는 것) 관점에서
CRITICAL 결함이 하나 있다 — `22_28_51/SUMMARY.md` 가 checker 의 `[CRITICAL]` 발견을 재량으로
`WARNING` 으로 하향하고 `BLOCK: NO` 를 선언했는데, 이는 `consistency-summary` 에이전트 자신의
예외 없는 규칙("Critical 1건이라도 있으면 BLOCK: YES", "동일 위배는 가장 강한 등급으로 통합")을
정면으로 위반하며, `review_guard.py` 의 SPEC-CONSISTENCY 게이트는 `SUMMARY.md` 최상단 `BLOCK:`
줄만 파싱하므로 이 하향은 게이트를 실제로 무력화한다. 내용상 판단(§6 표 stale 은 이미 올바르게
project-planner 에 위임된 SPEC-DRIFT)은 타당해 보이지만, 그 결론을 내리는 절차 자체가 harness
규약 밖의 임의 재량이라 재현 가능한 신뢰도 문제다. 부가적으로 `21_35_11` 세션이 아무 checker
결과도 없이(SUMMARY 부재) 영구 커밋된 점을 WARNING 으로 남긴다 — 기능적 영향은 없지만 감사
추적의 완전성을 해친다.

## 위험도
CRITICAL
