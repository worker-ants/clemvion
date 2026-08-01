# 문서화(Documentation) Review — harness-block-backstop (2026-08-01 02:25:18)

## 조사 방법 메모

프롬프트 번들에 실린 17개 파일 중 5개(`review_guard.py`, `guard_review_before_push.py`,
`code_review_orchestrator.py`, `consistency_orchestrator.py`, `.claude/tests/README.md`,
`test_block_integrity.py` 일부)가 프롬프트 크기 제한으로 생략/절단돼 있어 전부 `Read` 로 직접
열어 확인했다. `git diff origin/main...HEAD` 로 실제 변경분을 확인하고, 새로 추가된 서술은
`git blame`/`git log -p` 로 어느 라운드가 작성했는지까지 추적했다.

**번들 신선도 이상 1건 발견 (참고용, 발견사항 아님):** 파일 17 `plan/in-progress/harness-review-
gate-ci-backstop.md` 은 번들에 "전체 파일 컨텍스트"로 실려 있었지만(잘림 표시 없음), 실제 HEAD의
파일과 대조하니 번들 쪽이 **최신 커밋(`777680618`, 이 세션 준비 이후 커밋된 것으로 보임) 이전
버전**이었다(예: item 11의 "도달 불가능한 죽은 분기"/zsh 단어분할 관련 서술이 번들에 없음). 이
파일에 대한 아래 발견사항은 번들이 아니라 `Read` 로 직접 연 라이브 파일의 실제 줄 번호를 썼다.

또한 이 작업 디렉토리에는 `review/code/2026/08/01/{00_33_34,01_17_35,01_49_32}/documentation.md`
와 `01_49_32/RESOLUTION.md` 가 이미 존재해, 과거 라운드가 지적한 문서화 사항이 실제로 고쳐졌는지
교차 검증할 수 있었다(아래 "확인 완료" 절 참조). 이 방법으로 **2라운드 연속 미해결로 남아있는
항목 1건**을 확인했다.

## 발견사항

- **[WARNING]** 두 orchestrator 에 남은 옛 "Mirror" 섹션 헤더가 이번 PR 이 새로 추가한 "이제는
  위임" 설명과 나란히 모순되게 남아 있고, 테스트 docstring 은 그 헤더가 "이미 사라졌다"고 잘못
  서술한다 — **2라운드 연속(01_17_35 INFO→01_49_32 WARNING) 지적됐으나 아직 미해결**
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:79-81`,
    `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py:79-81`
    (양쪽 다 동일 텍스트) — 그리고 `.claude/tests/test_consistency_orchestrator_state.py:3-5`
  - 상세: 두 orchestrator 모두 여전히 `# --- State helpers (--summary-state / --update). Mirror
    code_review_orchestrator so main never has to Read _retry_state.json into its context. ---`
    3줄 블록을 갖고 있다. 이번 PR 은 다섯 함수 중 넷을 `_shared/retry_state.py` 위임으로 바꾸며
    그 사실을 정확히 설명하는 새 주석("State bookkeeping lives in `.claude/_shared/retry_state.py`
    — …")을 세 orchestrator 모두에 추가했는데, "Mirror 대상"이었던
    `code_review_orchestrator.py` 에서는 옛 3줄 블록을 **완전히 제거**하고 새 주석으로 교체한 반면
    (`git diff origin/main...HEAD -- .claude/skills/code-review-agents/scripts/
    code_review_orchestrator.py` 로 확인), 나머지 두 파일은 옛 헤더를 그대로 둔 채 새 주석을
    추가만 했다. 그 결과 "이건 다른 파일의 손 복제다"(옛 주석)와 "이건 손 복제가 아니라 공유
    모듈 위임이다"(새 주석)라는 반대 서술이 3줄 간격으로 공존한다.
    더 심각한 것은, 같은 PR 이 고친 `test_consistency_orchestrator_state.py` 의 모듈 docstring 이
    "they now delegate to `_shared/retry_state.py` **and those headers are gone**"라고
    명시적으로 서술하는데, 실제로는 두 파일 모두 그 헤더가 **그대로 남아 있어** 이 문장은 현재
    소스와 어긋난 사실 주장이다.
    이 항목은 `review/code/2026/08/01/01_17_35/documentation.md` 가 INFO 로(merge-coordinator
    한 곳만) 처음 지적했고, `01_49_32/documentation.md` 가 WARNING 으로 범위를 두 파일로 넓혀
    재지적했으나, `01_49_32/RESOLUTION.md` 의 처분 표(W7/W2/W4·W8)에는 포함되지 않아 그대로
    남았다 — 지금 이 라운드에서도 동일하게 재현된다.
  - 제안: 두 파일의 옛 3줄 "Mirror ..." 블록을 `code_review_orchestrator.py` 가 취한 것과 동일하게
    제거(또는 "이제 `_shared/retry_state.py` 에 위임" 으로 재작성)한다. 그러면
    `test_consistency_orchestrator_state.py` 의 "those headers are gone" 서술도 참이 된다.

- **[WARNING]** plan 문서 자신이 소개하는 목록의 항목 수를 스스로 잘못 셈
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:169`(요약 서술) 대
    `:171-187`(그 아래 목록, `git blame` 확인 결과 169-186행은 커�밋 `7dd4ad8c76`(5R)이 새로
    작성, 187행은 2026-07-25 원티켓부터 있던 문장)
  - 상세: 169행은 "**2026-08-01 실측으로 아래 3건 중 1건은 소멸, 1건은 이미 해결돼 있었다.**
    남은 것은 마찰 판단뿐."이라고 요약하지만, 바로 아래 목록(171-187행)은 최상위 불릿이
    **4개**다 — (1) 171-173행 `~~CI 가 "리뷰됨"…~~` **소멸**, (2) 174-177행 `~~CI 체크아웃은
    mtime…~~` **이미 해결돼 있음**, (3) 178-186행 `**남은 실질 결정: 이중 게이트의 마찰.**`
    (하위 불릿 2개 포함, 미해결), (4) 187행 `이 저장소가 이미 guard_review_before_push 를
    신뢰하는데, 두 번째 층의 비용 대비 이득.`(취소선도 "이미 해결" 표시도 없이 그대로 미해결).
    169행의 "3건"·"남은 것은 마찰 판단뿐"은 (4)를 계산에 넣지 않은 것으로 보이는데, (4)는 별도의
    독립적인 미해결 결정 항목(비용/이득 판단)이라 "마찰 판단"과 동일 질문이 아니다. 이 문서를
    나중에 참고하는 사람이 169행만 읽으면 남은 결정이 1개(마찰)뿐이라고 오인하기 쉽지만 실제로는
    2개(마찰 + 비용/이득)가 남아 있다.
  - 제안: "아래 3건"을 "아래 4건"으로 고치거나, (4)가 "3건"에 포함되지 않는 별도의 기존 항목임을
    명시하고 "남은 것은 마찰 판단뿐"을 "마찰 판단과 (4)의 비용/이득 판단이 남는다"로 정정한다.

- **[INFO]** (2라운드 연속 지적, 우선순위 낮음으로 이미 분류됨 — 신규 위험 아님, 재확인만)
  - `retry_state.load_state()` 에 여전히 docstring 없음 — 같은 파일의 형제 함수 4개
    (`save_state`:50행, `reconcile_state_with_disk`:94행, `emit_summary_state`:135행,
    `apply_status_update`:174행)는 모두 docstring 을 갖고 있는데 `load_state`(41행)만 없다.
    이 함수는 세션 디렉토리에 `_retry_state.json` 이 없으면 예외를 던지지 않고 stderr 메시지 후
    `sys.exit(1)` 로 하드 종료하는, 이름만으로는 드러나지 않는 계약을 갖고 있다. 위치:
    `.claude/_shared/retry_state.py:41`.
  - `guard_review_before_push.py`(1-41행)·`guard_review_before_stop.py`(1-27행)의 모듈 최상단
    docstring 이 이번 PR 이 추가한 non-blocking advisory(`notes`) 메커니즘을 여전히 언급하지 않음.
    `ReviewDecision.notes`/`_evaluate_over_targets`/`_report_notes`/`review_guard.py` 모듈
    docstring 등 실제 사용 지점에는 이미 잘 설명돼 있어 실질 위험은 낮지만, 두 훅의 "이 파일이
    하는 일" 요약만 읽는 독자는 이 책임을 놓친다.

- **[INFO]** `block_integrity.py` 모듈 주석의 표현이 자기 함수의 docstring 과 살짝 어긋나 보일
  수 있음
  - 위치: `.claude/_shared/block_integrity.py:56`(`# The banner wins when both exist, *whichever
    comes first in the file*.`)
  - 상세: 이 문장만 읽으면 "먼저 오는 쪽이 이긴다"는 위치 우선 규칙처럼 읽힐 수 있으나, 실제
    동작과 바로 아래 `summary_block_verdict()` 의 docstring(96-116행, "there the **last** wins")
    은 반대로 "동률일 때는 나중 것이 이긴다"고 정확히 설명한다. 실제 코드(`matches[-1]`)는 후자와
    일치하므로 버그는 아니고, 56행의 표현이 "밴드/서식 우선순위는 위치와 무관하다"는 취지를
    압축하다 모호해진 것으로 보인다. `test_block_integrity.py::VerdictIsAnchoredTest` 가 두 순서
    모두를 픽스처로 고정해 두었으므로 동작 자체는 안전하다.
  - 제안: 56행을 "밴드/오버라이드 형태가 START-only 형태를 이긴다(문서 내 위치와 무관); 동률일
    때만 마지막 매치가 이긴다(아래 함수 docstring 참조)"처럼 두 규칙을 명시적으로 분리해 적으면
    두 서술이 서로를 반증하는 것처럼 보이지 않는다.

- **[INFO]** `tests/README.md` 의 `test_block_integrity.py` 행이 파일의 절반(배선 검증)을
  언급하지 않음
  - 위치: `.claude/tests/README.md:60`
  - 상세: 이 행은 하향 탐지 predicate(카운팅·앵커링)만 설명하고, 파일 뒷부분의
    `GateSurfacesTheContradictionTest`(review_guard 가 실제로 이 체크를 호출하는지),
    `AdvisoryReachesTheModelTest`/`NotesReachBothHooksTest`(advisory 가 올바른 스트림으로 두
    훅 모두에 도달하는지), `StopThrottleKeysOnTextTest`(세션별 SHA1 스로틀이 다른 세션의 경고를
    삼키지 않는지), `NotesSurviveBlockingTest`(차단 경로에서도 notes 가 보존되는지),
    `PlanStubsMirrorTheRealInterfaceTest`(evaluate_plan 스텁 전체가 `push_blocks` 를 갖는지) 등
    600줄 중 상당 부분을 차지하는 "배선이 실제로 연결돼 있는가" 검증 클래스들은 언급이 없다.
  - 제안: 해당 행에 "또한 review_guard 가 실제로 이 체크를 호출하는지, advisory 가 두 훅 모두에
    올바른 스트림으로 도달하는지, 세션별 스로틀이 다른 세션의 경고를 삼키지 않는지도 pin 한다"
    한 문장 추가.

## 확인 완료 — 과거 라운드 지적사항 중 이번에도 정확히 유지되고 있는 것들

- `consistency-summary.md:47-55`, `SKILL.md:113-118` — "하향 경고는 `--impl-done` 세션이 게이트에
  채택될 때만 발화하며, 그 외에는 하향 금지 조항이 유일한 방어"라는 범위 한정 문장이 정확히
  들어있고, `review_guard.evaluate_review()` 의 실제 호출 조건(Gate 2, `spec_linked` 존재 시에만
  `_newest_resolved_impl_done_mtime` 호출)과 일치함을 코드로 직접 대조 확인.
- `732`/`24`/`3.3%` 수치가 `block_integrity.py` 모듈 docstring·`test_block_integrity.py` 모듈
  docstring·`tests/README.md:60`·plan 문서 4곳에서 서로 어긋남 없이 일치.
- `failopen_state.Outcome` docstring 의 `notes` 필드 설명과 실제 `guard_review_before_push.py`/
  `guard_review_before_stop.py` 양쪽의 fallback `_Outcome`/`_Fallback` 클래스가 동일하게
  `notes` 를 갖도록 배선돼 있음을 확인(하나만 갖고 있어 나중에 어긋났던 전례가 이번엔 없음).
- CHANGELOG.md — 저장소 관례상(`git log --oneline` 이력 전체 확인) `codebase/`+`spec/` 변경
  전용이며 `.claude/` 하네스 변경은 과거에도 기록 대상이 아니었다. 갱신 누락 아님.
- 신규 환경변수 — `git diff origin/main...HEAD -- '.claude/**/*.py'` 의 `os.environ` 사용을 전수
  확인한 결과 테스트 격리용(`CLAUDE_PROJECT_DIR` 전달)·테스트 픽스처용(`FAKE_NOTE`)뿐이고 실제
  신규 설정 표면은 없음.
- API 문서 — 이번 변경은 `codebase/` REST/GraphQL 엔드포인트를 전혀 건드리지 않는 순수
  `.claude/` 하네스 변경이라 해당 없음.

## 요약

이번 PR(하향-모순 백스톱 `block_integrity.py` 신설 + `retry_state.py` DRY 추출)은 문서화 수준이
전반적으로 매우 높다 — 신규 공유 모듈의 함수 docstring 이 "왜"를 실측치와 함께 설명하고, 그 수치가
독립적인 네 문서(모듈 docstring·테스트 docstring·README 카탈로그·plan 추적 문서)에서 어긋남 없이
일치하며, 정책 프롬프트(`consistency-summary.md`/`SKILL.md`)의 옛 부정확한 서술도 실제 코드에
맞게 정확한 범위 한정과 함께 갱신됐다. CHANGELOG·신규 설정·API 문서 관점에서 조치가 필요한 갭도
없다. 다만 두 가지는 짚고 넘어갈 필요가 있다. 하나는 **2라운드 연속 미해결로 남은 항목** —
`consistency_orchestrator.py`/`merge_coordinator_orchestrator.py` 에 남은 옛 "Mirror" 헤더가 이번
PR 이 넣은 정확한 위임 설명과 모순되게 공존하고, 심지어 관련 테스트 docstring 은 그 헤더가 "이미
사라졌다"고 사실과 다르게 서술한다 — 인데, 이건 앞선 두 라운드가 이미 정확히 진단했음에도 아직
처분 목록에 오르지 못했다. 다른 하나는 이번 라운드에서 새로 발견한 것으로, 5R 이 새로 작성한 plan
문서의 "결정이 필요한 지점" 요약 문장("아래 3건")이 바로 아래 목록의 실제 항목 수(4개)와 어긋나
남은 결정 사항을 과소 서술한다. 그 외에는 이미 낮은 우선순위로 분류된 재확인 항목들(`load_state`
docstring 공백, 두 훅 최상단 docstring 의 notes 미언급)과 사소한 완결성 개선 여지(모듈 주석 표현
모호성, README 행의 커버리지 서술 누락) 정도만 남아 있다.

## 위험도

LOW
