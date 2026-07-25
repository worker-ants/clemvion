# RESOLUTION — §O 도 철회. 갭을 **수용**하고 이유를 고정했다

CRITICAL 2 / WARNING 3. §O(continuation-aware tail)가 §M(e)보다 **명백히 나빴고**, 실측으로
확인한 뒤 되돌렸다. 이로써 line-continuation 갭을 메우려는 시도는 2회 · CRITICAL 5개로 끝났다.

## 조치 — §O revert

| # | 실측 | 판정 |
|---|---|---|
| C1 | `git \push`(개행 없는 평범한 이스케이프): §O **False** / §M(e) **True** | §O 가 만든 회귀. 메우려던 갭보다 **더 넓은 미탐지** |
| C2 | 반복 `git` 줄 + 각 줄이 continuation: 1600줄에서 §O **504ms** / §M(e) **0.55ms** (×2 → ×4) | §M(e) 가 고친 O(n²) 재도입 |

두 시도의 전체 기록:

| 접근 | 무엇이 깨졌나 |
|---|---|
| pre-fold (텍스트 재작성) | ① backslash parity 무시 ② 공백 치환 + 조기 return 뒤 배치 ③ **heredoc 종료 delimiter 를 삼켜 그 뒤 push 를 전부 blank** |
| continuation-aware tail | ④ `git \push` 미탐지 ⑤ O(n²) 재도입 |

`_commit_heredoc_spans`·`_redact_inert_text` 가 **원본 텍스트 오프셋** 기준이라 재작성 pre-pass
는 구조적으로 안전할 수 없고, tail 을 넓히면 백슬래시 페어링이 평범한 이스케이프를 깨뜨린다.

## 갭을 수용하고 **이유와 함께** 등재했다

`git \<개행> push` 는 legacy 가 잡고 이 가드는 못 잡는다 — **진짜 differential-floor 위반**이다.
숨기지 않고 CORPUS 에 `release_reason` 을 달아 등재했다(그 필드가 정확히 이 용도다):

> ACCEPTED GAP … 두 방법 모두 더 나빴다. heredoc terminator 파손 / `git \push` 유실 + O(n²).

`LineContinuationTest` 는 이제 **현재 동작을 단언**한다 — 갭이 닫히면 실패해서, 닫은 사람이
§O 기록(두 목록)을 먼저 읽게 만든다. 함께 pin 한 것:

- `test_the_gap_is_a_floor_violation_and_we_know_it` — legacy 가 잡는다는 **전제**를 단언
  (corpus reason 이 그 전제에 의존하므로).
- `test_escaped_push_without_a_newline_still_matches` — §O 가 깨뜨린 경계(`git \push`).
- `test_heredoc_body_ending_in_a_backslash_keeps_the_push_visible` — pre-fold 가 깨뜨린 경계.

## WARNING

- W1(stale docstring): §O 철회로 fold 서술이 전부 사라짐 — 클래스를 통째로 재작성했다.
- W2(vacuous 테스트): `test_unfolding_does_not_invent_a_push` 는 fixture 에 "push" 가 없어
  조기 return 만 태우고 있었다. **§O 철회와 함께 삭제** — 검증 대상 메커니즘 자체가 없어졌다.
- W3(RESOLUTION 부정확 기록): 직전 문서가 "자매 훅 판단을 주석에 남겼다" 고 적었으나 실제로는
  없었다. §O 철회로 그 항목 자체가 무의미해졌고, 본 문서가 사실 기록을 대신한다.

## 이 PR 이 남기는 것 — 코드 0줄, 지식 3건

`git diff origin/main -- .claude/hooks/` 의 **비-주석 변경은 0줄**이다. 두 시도가 모두
되돌아갔으므로 당연하다. 남는 것은:

1. **split-then-match won't-do** — 프로토타입이 656 테스트를 통과했는데도 따옴표 안 개행에서
   우회를 만든다는 실측(`QuotedNewlineValueTest` 가 tripwire).
2. **line-continuation 갭 수용** — 두 접근이 왜 더 나쁜지 측정과 함께(`LineContinuationTest`).
3. **경계 3종 pin** — heredoc terminator · `git \push` · 선형성.

## TEST 결과

- lint: 해당 없음(Python 훅 — harness 스위트가 검증)
- unit: **harness 663 passed, 565 subtests**
- build: 해당 없음(`codebase/**` 변경 0)
- e2e: **면제** — diff 가 `.claude/**` + `plan/**` + `review/**` 뿐

## 보류·후속 항목

없음. 두 개선안 모두 won't-do 로 종결하고 근거를 코드 주석·corpus·plan 세 곳에 고정했다.
