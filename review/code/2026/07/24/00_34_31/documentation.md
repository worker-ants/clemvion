# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `_GIT_PUSH` 정규식 옆의 "KNOWN DEFECT" 주석 블록이 이번 diff 로 무효화됐는데도 갱신되지 않음 (stale 주석)
  - 위치: `.claude/hooks/guard_review_before_push.py:97` (블록 전체는 97~106행)
  - 상세: 97~106행 주석은 다음과 같이 서술한다 — "KNOWN DEFECT (harness-guard-followups §J, fix pending **in its own PR**): the env-prefix group below uses `\S+`, which stops at the space INSIDE a quoted value ... The fix is `(?:'[^']*'|"[^"]*"|[^\s'"]\S*)` ... **hence the separate PR**." 그런데 바로 다음 줄(108행, 이번 diff 의 `+` 라인)에서 그 정확한 수정(`(?:'[^']*'|"[^"]*"|[^\s'"]\S*)`)이 이미 적용됐다. 즉 이 diff 가 "그 separate PR" 자신인데, 결함을 "아직 안 고쳐졌고 고치는 게 나중 PR 몫" 이라고 서술하는 주석은 그대로 남아 있다. 같은 PR 의 자매 파일(`.claude/tests/test_push_guard_allowlist.py`)에서는 정확히 같은 상황을(`KnownFalseNegativeTest` → `QuotedEnvPrefixTest` 로 리네임, docstring 을 "Until 2026-07-24 these commands were not detected ... " 과거형으로 재작성) 모범적으로 처리했다 — 이 파일만 빠졌다.
    이 훅의 모듈 docstring 은 스스로 "Read it there before changing anything here"(주석을 신뢰해 판단하라)를 강조하는 극도로 신중한 문서 문화를 가진 파일이라, 모순된 주석이 남으면 다음 사람이 (a) 결함이 아직 있다고 오판해 중복 수정을 시도하거나 (b) "DO NOT EDIT this pattern" 지시와 "결함이다"라는 서술이 충돌해 혼란스러워질 위험이 실질적이다.
  - 제안: 97~106행을 "§J FIXED (2026-07-24)"류 과거형 서술로 교체하거나, 결함 설명을 제거하고 현재 패턴이 `guard_default_branch_bash._MUTATING` 과 byte-identical 이유만 남긴다. 테스트 파일의 `QuotedEnvPrefixTest` docstring 재작성과 동일한 패턴을 따르는 것을 권장.

- **[INFO]** 같은 파일의 §J 참조 2번째 지점도 현재형 표현이라 위와 동일한 결로 약간 낡음
  - 위치: `.claude/hooks/guard_review_before_push.py:156` — "in view when either changes — but note the §J defect lives in `_GIT_PUSH` above, not here."
  - 상세: `_SEGMENT_SPLIT` 주석에서 `_GIT_PUSH` 를 가리키며 "§J defect **lives** in" 이라는 현재형을 쓴다. §J 가 해소된 지금은 오독 소지가 적지만("lives"가 과거 결함의 소재지를 가리키는 것으로도 읽히긴 함), 위 CRITICAL 항목과 함께 손보면 일관성이 좋아진다.
  - 제안: 위 항목과 함께 과거형("§J 이 있었던 자리")으로 정리, 또는 그대로 두어도 큰 문제는 아님(우선순위 낮음).

- **[INFO]** `.claude/tests/README.md` 의 `test_push_guard_allowlist.py` 카탈로그 엔트리가 이번 PR 이 도입한 "2단 핀" 구조(`_LEGACY_PATTERN`=불변 FN 바닥 vs `_BLIND_PATTERN`=현행 blind 핀)를 반영하지 않음
  - 위치: `.claude/tests/README.md:47`
  - 상세: 현재 문구는 "the blind first-pass regex (frozen byte-for-byte)" 라고만 서술해 마치 하나의 상수만 있는 것처럼 읽힌다. 이번 PR 로 `_LEGACY_PATTERN`(절대 안 바뀜, FN 회귀 바닥)과 `_BLIND_PATTERN`(§J 처럼 결함 수정 시 바뀔 수 있는 현재 blind 핀)이 분리됐고, 그 구분이 정확히 §J 를 "핀 갱신 불가" 문제로 만든 원인이었다는 것이 이 PR/plan 의 핵심 교훈이다. 카탈로그 설명이 이 nuance 를 담으면 다음에 유사한 결함(blind 패턴 자체의 버그)을 마주친 사람이 "두 패턴 다르다"는 걸 README 만 보고도 알 수 있다.
  - 제안: 필수는 아니나, 한 문장 추가("두 상수로 분리: 영구 고정 회귀 바닥 vs 현재 blind 핀, §J 참고")를 권장. 기존 문구가 틀린 것은 아니므로 차단 사유는 아님.

- **[INFO]** plan 문서(`plan/in-progress/harness-guard-followups.md`) 갱신은 양호 — 체크리스트 본문(§J 섹션)과 하단 `## 체크리스트` 양쪽 모두 `[x]` + "✅ 해소"로 동기화되어 있고, 테스트 파일의 `_LEGACY_PATTERN`/`_BLIND_PATTERN` 분리 근거·`_SEGMENT_IS_GIT` 전수 grep 결과·`ReleasePathNarrownessTest` 도입 이유가 정확히 코드와 일치한다. 별도 지적 없음.

## 요약

핵심 코드 수정(`_GIT_PUSH` 정규식에 3-대안 따옴표 처리 추가)과 테스트 갱신(`_BLIND_PATTERN`/`_LEGACY_PATTERN` 분리, `QuotedEnvPrefixTest`·`ReleasePathNarrownessTest` 신설, corpus 확장) 자체는 문서화 측면에서 모범적이다 — docstring 재작성, plan 체크리스트 동기화, 근거 기록이 전부 꼼꼼하다. 다만 정작 결함을 안고 있던 소스 파일(`guard_review_before_push.py`) 자신의 "KNOWN DEFECT ... fix pending in its own PR" 주석 블록이 갱신되지 않아, 같은 PR 안에서 "결함이 아직 안 고쳐졌다"는 주석과 "고쳐진" 코드가 두 줄 간격으로 공존하는 모순이 생겼다. 이 파일은 스스로 "주석을 신뢰해 판단하라"는 문화를 표방하므로 이 stale 주석을 놔두면 다음 변경자에게 실질적 혼란을 준다. README 카탈로그의 사소한 nuance 누락은 차단 사유가 아니다.

## 위험도

MEDIUM
