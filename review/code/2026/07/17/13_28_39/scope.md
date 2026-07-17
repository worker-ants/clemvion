# 변경 범위(Scope) 리뷰 — forced-coverage-gate

## 검토 대상

`plan/in-progress/forced-coverage-gate.md` 에 명시된 단일 커밋(`9b1228226`, base
`f562c04f6b`)의 8개 파일. plan 은 "사용자 결정: 범위 = **버그 fix + A + B**, 롤아웃 =
**전면 적용(grandfather 없음)**" 을 명시하고 있어 이를 기준선으로 각 diff hunk 를 대조했다.

- 버그 fix: `_retry_state.json` 의 `output_file` (워크트리 절대경로, 삭제되어 죽은 경로)이 아니라
  세션 디렉토리 상대경로로 산출물을 찾도록 수정
- A: `agents_forced` 화이트리스트 미충족 세션을 `review_guard` 가 "해소" 로 인정하지 않음
- B: `_retry_state.json` stale 문제를 "수동 호출 의무 추가" 대신 read-time 자가 reconcile 로 해결

## 발견사항

- **[WARNING]** 문서 변경이 실제 코드 변경 범위를 벗어남 — `consistency-checker` 의
  자가 reconcile(B) 을 실제로는 구현하지 않았는데 문서는 구현된 것처럼 서술
  - 위치:
    - `.claude/skills/consistency-checker/SKILL.md:94` — "**상태 기록은 자동이다** —
      `--summary-state`/`--resume` 가 읽을 때 디스크로 자가 reconcile 하므로 수동 호출
      의무는 없다."
    - `.claude/docs/subagent-call-contract.md:120-121` — "상태 기록(`_retry_state.json`)은
      신경 쓰지 않아도 된다: `--summary-state`/`--resume` 가 읽을 때 디스크로 자가
      reconcile 한다." (이 문서는 모든 sub-agent 가 공유하는 cross-cutting 규약이라
      `consistency-checker` SKILL 도 그대로 인용한다.)
  - 상세: 이번 diff 에서 자가 reconcile 로직(`_reconcile_state_with_disk()`,
    `_report_paths()`)이 **실제로 추가된 곳은 `.claude/skills/code-review-agents/scripts/
    code_review_orchestrator.py` 뿐**이다(`_emit_summary_state`/`_sync_from_disk`/
    `_verify_coverage`/`main()`'s `--resume` 네 지점 모두 이 헬퍼를 경유하도록 수정됨).
    반면 `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 는
    이번 커밋의 변경 파일 8개에 **포함되지 않았다** (`git diff --stat` 로 확인). 실측 결과:
    - `consistency_orchestrator.py:95-102` 의 `_emit_summary_state` 는 여전히
      `_load_state()` 결과를 그대로 출력할 뿐 disk 산출물과 대조하지 않는다(옛
      `code_review_orchestrator.py` 의 패치 전 코드와 동일한 형태).
    - `consistency_orchestrator.py:599-611` 의 `--resume` 분기는 `_retry_state.json`
      존재 여부만 확인하고 경로를 echo 할 뿐 reconcile 를 전혀 하지 않는다.
    - `agents_forced`/`router_safety`/`compute_forced_agents` 개념 자체가
      `consistency_orchestrator.py` 에 전혀 없다(grep 0건) — 애초에 A 에 대응하는
      화이트리스트 개념도 consistency 측엔 없다.
    - `consistency-checker/SKILL.md` 자신의 (수정 전부터 있던) 코드 블록도 여전히
      `code-review-agents/scripts/code_review_orchestrator.py --sync-from-disk` 를
      가리킨다 — `consistency_orchestrator.py` 에는 애초에 `--sync-from-disk` 서브커맨드가
      없다(grep 0건).
    이 PR의 실제 코드 스코프는 "code-review-agents 오케스트레이터" 로 한정돼 있는데,
    문서 수정은 그 경계를 넘어 "하네스 전반(또는 최소 consistency-checker 자신의
    `--summary-state`/`--resume`)이 자동으로 치유된다" 고 서술한다 — 구현이 뒷받침하지
    않는 약속이 문서에 남는, scope 상 실질적인 code-doc 불일치다.
  - 왜 문제인가: 이 작업 전체의 동기가 "산문으로만 존재하는 의무는 압력 속에 무너진다 →
    디스크 기준 기계적 자가치유로 대체" 는 것인데(plan §B), consistency-checker
    사용자가 이 새 문구를 믿고 커밋 전 수동 동기화를 생략하면, 같은 문단이 언급하는
    바로 그 실패 모드("5/5 성공" SUMMARY 인데 상태 파일은 0 성공, 2026-07-17 실측 사례)가
    consistency-checker 세션에서 재발할 수 있다 — 이번 작업이 근절하려는 문제를 문서
    차원에서 그대로 재도입하는 셈이다. plan 의 체크리스트 "6. DOCUMENTATION — 두
    SKILL·subagent-call-contract.md 를 '산문 의무' → '기계 강제 + 자동' 으로 정정"
    항목이 `[x]` 로 표시돼 있으나, consistency-checker 쪽은 "정정" 이 아니라 뒷받침되지
    않는 새 약속이 된 상태라 plan 의 self-report 와도 어긋난다.
  - 제안: 다음 중 하나로 코드-문서 스코프를 일치시킬 것.
    1. `consistency_orchestrator.py` 에도 동등한 `_reconcile_state_with_disk`/
       `_report_paths` (또는 공유 lib 로 추출)를 이식해 문서 서술을 실제로 충족시키거나,
    2. 이번 범위에 포함하지 않을 것이면 두 문서의 해당 문장을 "code-review-agents
       (`code_review_orchestrator.py`)에만 해당" 으로 명확히 스코프를 좁히고,
       consistency-checker 쪽 fallback 안내는 종전처럼 명시적 동기화(`--update` 수동
       호출, 또는 code-review 스크립트를 세션 디렉토리에 대해 명시 호출)를 요구하는
       문구로 되돌릴 것.

- **[INFO]** 소급 적용 범위가 넓음(스코프 위반은 아님, 참고용)
  - 위치: `.claude/hooks/_lib/review_guard.py` `_summary_is_resolved` / `plan/in-progress/
    forced-coverage-gate.md` "롤아웃: 전면 적용 (grandfather 없음)"
  - 상세: 이번 판정 함수 변경으로 커밋된 review 세션의 "resolved" 집합이 570→464(약 106건
    감소)로 소급 축소된다. plan 문서에 "사용자 결정" 으로 명시돼 있어 개발자가 임의로 확장한
    범위는 아니며, 가드는 "가장 최신의 resolved 리뷰" 만 보므로 과거 세션이 최신 코드보다
    항상 오래됐다는 논리로 소급 파괴가 없음을 plan 이 스스로 검증했다(§"전면 적용이 안전한
    이유"). scope 위반으로 분류하지 않으나, 판정 함수 하나의 변경이 575개 기존 세션의 게이트
    통과 여부에 광범위하게 영향을 준다는 blast radius 는 리뷰어가 인지할 가치가 있다.

- **[INFO]** 신규 함수 docstring 이 사고 경위·수치(160/575, 107건, 537/575 등)를 상세히
  서술 — `review_guard.py` 모듈 전체에 이미 존재하는 기존 컨벤션(모듈 최상단 docstring,
  `_newest_commit_time` 등)과 동일한 스타일이라 이번 diff 가 새로 들여온 관행이 아니다.
  scope 상 문제 없음.

## 그 외 확인한 사항 (문제 없음)

- `git diff --stat` 로 실제 변경 파일이 프롬프트에 기재된 8개와 **정확히 일치**함을
  확인(숨겨진 추가 변경 없음), 단일 커밋(`9b1228226`)이며 plan 체크리스트와 1:1 대응.
- `code_review_orchestrator.py` 의 `_sync_from_disk`/`_verify_coverage` 리팩터는
  독립적인 정리가 아니라, 동일한 경로 버그(`output_file` 신뢰)를 두 지점에서 동시에
  고치기 위한 최소한의 공통 헬퍼 추출(`_report_paths`, `_reconcile_state_with_disk`)이며
  plan 의 "선행 필수 버그 fix" 항목과 정확히 일치한다.
- `review_guard.py` 의 `_forced_coverage_missing`/`_summary_is_resolved` 변경은 plan
  §A("forced 전원 산출물 존재 ∧ (RESOLUTION.md ∨ 위험도 NONE/LOW+무행)", 판정은 디스크
  파일 기준, manifest 없거나 `agents_forced` 비면 fail-open)를 코드 그대로 구현한다.
  A 게이트는 `review/code/**` 세션(`_newest_resolved_review_mtime` 경유)에만 적용되고
  `review/consistency/**` 세션(`_newest_resolved_impl_done_mtime`)에는 관여하지
  않음을 확인 — consistency 쪽에 새 강제 게이트가 조용히 추가된 것은 아니다.
  (다만 이 비대칭이 위 WARNING 의 문서 서술과는 어긋난다.)
- 테스트 두 파일(`test_orchestrator_state.py` 7건, `test_review_guard.py` 7건 신설)은
  모두 이번 코드 변경(버그 fix + A + B)만 대상으로 하며, `import json` 추가 등 임포트
  변경도 실제 사용처가 있다. 불필요한 리팩토링·무관한 파일·포맷팅 전용 변경·설정 파일
  변경은 발견되지 않았다.
- `plan/in-progress/forced-coverage-gate.md` 는 frontmatter(`worktree`/`started`/
  `owner`/`status`) 를 갖춘 신규 plan 문서로 컨벤션에 부합한다.

## 요약

8개 변경 파일은 plan 이 명시한 "버그 fix + A + B" 범위와 커밋 단위까지 정확히 일치하며,
무관한 파일·포맷팅 전용 변경·불필요한 리팩토링·설정 변경은 발견되지 않았다(리팩터된
`_sync_from_disk`/`_verify_coverage` 도 동일 버그를 한 곳에서 고치기 위한 최소 추출이라
범위 내). 다만 한 가지 실질적 code-doc 스코프 불일치가 있다: `consistency-checker/
SKILL.md`(및 공유 문서 `subagent-call-contract.md`)가 "`--summary-state`/`--resume`
자가 reconcile" 을 서술하지만, 그 구현(`_reconcile_state_with_disk`)은 이번 diff 에서
`code_review_orchestrator.py` 에만 추가됐고 `consistency_orchestrator.py` 는 전혀 손대지
않아 실제로는 옛 동작(비-reconcile) 그대로다 — 문서가 구현보다 넓은 범위를 약속한다.
이 프로젝트가 이번 작업으로 없애려는 "산문뿐인 의무" 패턴을 문서 차원에서 재도입하는
셈이라 병합 전 정정이 필요하다.

## 위험도

MEDIUM
