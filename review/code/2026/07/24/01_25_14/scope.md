# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** SoR 문서 경로 정정이 핵심 수정과 별개로 2개 파일에 섞여 있음
  - 위치: `.claude/hooks/guard_review_before_push.py` 91행(`# SoR: plan/complete/harness-push-guard-subcommand-detection.md`), `.claude/tests/test_push_guard_allowlist.py` 4행(동일 문구)
  - 상세: `plan/in-progress/…` → `plan/complete/…` 로 고친 주석/docstring 한 줄씩. `git log --follow`로 확인한 결과 해당 plan 문서는 #992(2026-07-23)에 이미 `plan/complete/`로 이동돼 있었고, 이 두 파일의 참조만 그 이후 갱신되지 않은 채 stale 로 남아 있던 것을 이번 커밋이 "부수"로 바로잡았다(커밋 메시지에 "SoR 경로가 `plan/in-progress/` 를 가리키던 것도 정정(#992 에서 complete/ 로 이관됨)"이라고 명시). 이번 작업의 본 목적(§J-후속 FN 재도입 수정)과는 무관한 리팩터링성 수정이지만, 1줄씩 두 곳뿐이고 커밋 메시지에 투명하게 고지돼 있어 실질 위험은 낮다.
  - 제안: 조치 불요. 사소하고 disclosed 된 변경이라 별도 분리할 실익이 없음.

- **[INFO]** §L(별개의 미해결 갭)에 대한 canary 테스트가 §J-후속 수정 커밋에 동반 포함됨
  - 위치: `.claude/tests/test_push_guard_allowlist.py` `KnownFalseNegativeTest` 클래스(diff 877~913행 부근, `#### 변경된 코드` 블록의 마지막 hunk)
  - 상세: 이번 작업의 핵심은 §J-후속(닫히지 않은 따옴표 값이 FN 을 재도입한 문제) 수정이다. 그런데 같은 커밋에 `A="a b"c git push` 처럼 **닫는 따옴표에 다른 문자가 붙는 값**이 여전히 미탐지되는 §L 이슈에 대한 canary 테스트(`KnownFalseNegativeTest`)가 함께 추가됐다. 이 테스트는 버그를 고치는 것이 아니라 "현재 버그 동작"을 고정하는 용도이며, plan 문서(`plan/in-progress/harness-guard-followups.md`)에도 §L 을 신규 미해결 항목(`- [ ]`)으로 등록하고 커밋 메시지에도 "부수: §L 등록 + 캐너리 고정"으로 명시돼 있어, 은닉된 확장이 아니라 조사 중 발견한 별개 갭을 투명하게 기록·고정한 것이다. 다만 엄밀히는 이번 작업의 스코프(§J-후속 FN 해소) 밖의 항목이 diff 에 섞여 들어간 것은 사실이다.
  - 제안: 조치 불요(이미 fixture-only, 실제 코드 변경 없음이고 plan 에 별도 항목으로 분리 등록돼 있어 향후 추적 가능). 팀 컨벤션상 "발견 즉시 canary 로 고정"이 정착된 패턴으로 보이므로 문제 삼지 않음.

## 점검 결과 (문제 없음으로 확인된 항목)

- **의도 이상의 변경/무관한 파일 수정**: `git diff --stat HEAD~1 HEAD` 로 대조한 결과 변경 파일은 정확히 리뷰 대상 5개(`guard_default_branch_bash.py`, `guard_review_before_push.py`, `test_guard_default_branch_bash_mutating.py`, `test_push_guard_allowlist.py`, `plan/in-progress/harness-guard-followups.md`)뿐이며, 프롬프트에 없는 파일 변경은 없음.
- **기능 확장(over-engineering)**: 두 훅의 정규식 변경(`[^\s'"]\S*` → `\S+`)은 §J-후속에서 실측(생성 입력 168건 중 28건 FN)으로 근거가 제시된 최소 수정이며, 새 기능이 아니라 기존 3-대안 구조의 마지막 대안만 원복하는 방식.
- **임포트 변경**: `test_guard_default_branch_bash_mutating.py` 에 추가된 `import re` 는 신규 `OldEnvPrefixSupersetTest._pre_quoted_is_mutating`(240행)에서 실제로 사용됨 — 미사용 임포트 아님.
- **포맷팅 변경**: 두 훅 파일의 코멘트 블록이 크게 다시 쓰였지만, 전부 이번 회귀(§J-후속)의 원인·수정 근거·상위집합 논증을 설명하는 실질적 서술 변경이며, 공백/줄바꿈만 바뀐 순수 포맷팅은 발견되지 않음. 이 저장소의 기존 컨벤션(모든 가드 정규식에 근거를 코멘트로 풀어씀)과 일치.
- **테스트 확장의 정당성**: `OldEnvPrefixSupersetTest`(넛지 훅) / `GeneratedFloorTest`(push 가드)는 plan 문서가 명시적으로 요구한 산출물("두 축으로 생성한 입력을 바닥에 통과")이며, 회귀를 놓친 근본 원인(큐레이션 코퍼스만 순회)에 대한 직접적 대응.
- **설정 변경**: `.claude/settings.json` 등 설정 파일 변경 없음.
- **plan 문서 갱신**: `harness-guard-followups.md` 의 Overview·체크리스트·신규 섹션(§J-후속, §L) 추가는 developer 워크플로 컨벤션(plan 동시 갱신 의무)에 부합하며 코드 변경 범위를 정확히 반영.

## 요약

핵심 diff(두 훅의 정규식 fallback 원복 + 대응 코멘트, 두 테스트 파일의 회귀 고정 테스트, plan 문서 갱신)는 §J-후속으로 명명된 단일 결함(닫히지 않은 따옴표 값이 env 접두 그룹을 붕괴시켜 push/mutating 탐지가 통째로 무력화되는 FN)의 수정과 재발 방지에 밀접하게 수렴돼 있으며, 변경 파일 목록도 실제 diff 와 정확히 일치한다. 다만 (1) 별개 plan 문서의 stale SoR 경로 참조를 바로잡은 2줄짜리 drive-by 정정과 (2) 조사 중 발견한 미해결 갭(§L)에 대한 canary 테스트가 같은 커밋에 섞여 있는데, 둘 다 커밋 메시지와 plan 문서에 "부수"로 투명하게 고지돼 있고 실질 코드 동작 변경이 없어(§L 은 버그를 고치지 않고 현재 동작만 고정) 위험도는 낮다.

## 위험도
LOW
