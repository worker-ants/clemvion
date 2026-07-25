---
title: push 탐지를 split-then-match 로 뒤집을지 — 시도했고 **won't-do 로 종결**
worktree: harness-split-then-match-7e2b
started: 2026-07-25
completed: 2026-07-25
owner: developer
priority: P2
status: complete
spec_impact: none
---

## ❌ 결론 (2026-07-25): **won't-do**. 구현·검증까지 갔다가 되돌렸다

체크리스트가 정한 "셋 모두 안전이면 전환, **하나라도 새 표면이면 won't-do**" 에서 **새 표면이
나왔다**. 전환을 커밋한 뒤 `/ai-review` 가 CRITICAL 로 잡았고 실측으로 확증돼 revert 했다.

### 무엇이 깨졌나 — split 은 따옴표를 모른다

```
A="line1
line2" git push
```

평범한 shell 이고(`bash -n` exit 0) push 가 **실제로 실행된다**. 그런데 `text.split("\n")` 은
이 개행이 따옴표 **안**이라는 걸 알 수 없어 값을 두 조각으로 찢는다:

| 줄 | 내용 | 판정 |
| --- | --- | --- |
| 0 | `A="line1` | push 없음 |
| 1 | `line2" git push` | `git` 앞에 separator 가 없어 **미탐지** |

→ `_is_git_push` = False → 두 게이트 skip. **false negative = 게이트 우회**이고, 과차단 같은
안전 방향이 아니다. 전체 명령을 훑는 패턴은 이걸 공짜로 처리한다 — 따옴표 alternative
(`'[^']*'`, `"(?:\\.|[^"\\])*"`)가 개행을 포함한 **모든 문자**를 값으로 흡수하기 때문이다.

실측 (4 케이스 전부): §N **False** / §M **True** / `bash -n` **exit 0**.

### 왜 고치지 않고 되돌렸나

고치려면 split 이 "이 개행이 따옴표 안인가" 를 알아야 한다 = **quote 파서**. 이 파일이 두 번
거부한 바로 그 길이다(2026-07-17 shlex 재작성 REVERT — 매 라운드 새 false-negative 클래스).
§M 은 **유한하고 측정된** 상태다(네 형태 전부 선형, 회귀 pin 완비). 그것을 무한 표면과 바꾸는
거래라 되돌리는 쪽이 맞다.

### 내가 "정확성 10/10 동일" 이라 한 것이 왜 틀렸나

프로토타입 판정 때 **내가 손으로 고른 10개**에 "따옴표 값 안의 개행" 이 없었다. 656개 테스트도
그 축을 갖고 있지 않았다(그래서 전부 통과했다). 큐레이션한 입력 집합이 커버리지의 상한이라는
것을 또 한 번 확인한 셈이다 — 이번엔 **테스트 스위트 전체 통과**가 안전의 증거로 보였기에 더
설득력 있게 틀렸다.

### 부수 수확 — §M(e) 가 만든 또 다른 회귀를 발견했다

리뷰가 INFO 로 넘긴 "백슬래시 line continuation 미탐지(기존 갭)" 를 실측하니 **기존 갭이
아니었다**: legacy floor 는 `git \\<개행>  push origin main` 을 **잡는다**. §M(e) 가 tail 에서
개행을 제외하면서 잃은 것 — 즉 **differential floor 위반**이고, `test_no_new_false_negatives`
가 corpus 만 순회하는데 아무도 continuation 을 적어두지 않아 아무 테스트도 울지 않았다.

shell 이 실제로 하는 일(`\` + 개행 삭제 후 줄 잇기)을 탐지 전에 똑같이 하도록 고쳤다
(`_LINE_CONTINUATION` unfold). tail 은 개행 제외를 유지하므로 §M(e) 의 선형성도 그대로다
(네 형태 전부 배율 1.9~2.0x 재확인, replace 비용 50k 에서 0.5ms).

첫 수정(pre-fold)은 **세 번 틀렸다** — parity 무시, 치환 문자/위치, 그리고 결정적으로
**heredoc 종료 delimiter 를 삼켜** 그 뒤의 진짜 push 를 숨겼다. 세 번째는 이 저장소가 매
커밋마다 쓰는 형태라, 전처리 접근 자체를 폐기하고 **tail 이 백슬래시-이스케이프된 개행만
넘도록**(§O) 바꿨다. 텍스트를 재작성하지 않으므로 heredoc·redact 와 상호작용이 원천적으로 없다.

이하는 그 첫 수정의 기록이다 — **또 틀렸다** — `\\` + 개행을 무조건 접어서(parity 무시) 짝수 백슬래시일 때
진짜 개행 구분자를 지웠고, 치환을 공백으로 해서 `git pu\\<개행>sh` 가 `pu sh` 로 남았다.
둘 다 리뷰가 CRITICAL 로 잡았고 실측(`bash` 실행 대조)으로 확증됐다. `_ESCAPED_PIPE` 가 쓰는
parity 패턴 + 빈 문자열 치환 + early-return 이전 이동으로 고쳤다.

`LineContinuationTest` 가 이것을 **회귀로** 고정한다 — "legacy 는 잡았다" 를 함께 단언하므로,
누가 나중에 "알려진 갭" 으로 오분류하면 그 자리에서 반증된다.

### 남긴 것 — 이번 작업의 진짜 산출물

`QuotedNewlineValueTest` + corpus 4건. **누가 다시 line-oriented 탐지를 시도하면 여기서 먼저
깨진다**(mut 확인: split 재주입 → 5 failed). 전제가 "실행 가능한 shell 인가" 도 함께 단언한다
(`bash -n`) — 앞서 같은 작업에서 bash 가 거부하는 입력으로 단언을 세웠다가 27건 오탐을 낸 적이
있어서다.

## Overview

[`harness-push-gate-did-not-fire`](../complete/harness-push-gate-did-not-fire.md) §M 작업 중
관찰에서 분리. **설계 반전 후보이지 버그 티켓이 아니다.**

## 관찰 — 한 결정이 세 개의 결함을 낳았다

§M(a) 가 `\n` 을 `_GIT_PUSH` 의 separator 클래스에 넣자, 그 하나의 결정에서 **성능 결함 3개**가
연쇄로 나왔다:

| | 무엇 | 발견 |
| --- | --- | --- |
| §M(b) | env-value 반복의 `\s+` 가 `\n` 을 먹어 rival parse → 지수 ReDoS(30s) | 내가 착수 중 |
| §M(c) | separator 직후 `\s*` 가 개행 런을 재분할 → O(n²)(62s) | 1회차 리뷰 CRITICAL |
| §M(e) | tail `[^&;|]*` 가 개행을 건너 모든 git 줄이 시작점 → O(n²)(14.7s) | 2회차 리뷰 CRITICAL |

셋 다 **같은 뿌리**다: 정규식이 개행을 "그냥 또 하나의 문자" 로 보는데, 개행은 구조적 경계다.

## 대안 — 자매 훅이 이미 쓰는 방식

`guard_default_branch_bash` 는 `_SEGMENT_SPLIT`(개행 포함)으로 **먼저 쪼갠 뒤** 각 세그먼트에
앵커된 패턴을 적용한다. 그러면 세그먼트에 개행이 없으므로 위 세 결함 클래스가 **구조적으로
불가능**해진다(`\s` vs `[^\S\n]` 구분 자체가 불필요해진다).

**실측 (2026-07-25, 프로토타입)**: 정확성 10/10 현행과 동일(불일치 0), 성능도 동등 이상 —
개행런 20k: 현행 1.7ms / split 1.0ms · git줄 20k: 8.3 / 8.4 · env런 20k: 4.8 / 1.1.

## 왜 §M 에서 바로 하지 않았나 (착수 전 반드시 읽을 것)

**release 경로와의 상호작용이 미지수이고, 그 상호작용이 정확히 3개 CRITICAL 을 낸 자리다.**

`_redact_inert_text` 는 heredoc 본문·commit 메시지를 blank 처리해 false positive 를 푸는데,
그 판정(`_owns_heredoc_as_message`)은 **명령 전체 텍스트의 구조**에 의존한다. 개행으로 먼저
쪼개면 heredoc 본문이 여러 세그먼트로 흩어져 소유권 판정이 달라진다 — 그 결과가
`review/code/2026/07/23/14_23_23` 의 C1·C2·C3(전부 release 경로 결함)와 같은 클래스의 새
표면을 열 수 있다.

즉 **유한하고 측정된 현재 문제**(세 결함 모두 수정·회귀 테스트·mutation 검증 완료)를
**미지의 표면**과 바꾸는 거래다. 이 저장소가 `reaper`·push-guard 재작성에서 두 번 학습한
"blind 정규식은 무지해서 안전, 정밀 파서는 무한 표면" 과 같은 판단 축이다.

## 체크리스트

- [x] release 경로 상호작용 실측 — **통과했다**(26 passed). 이 축은 §N 을 막지 않았다.
      막은 것은 **아무도 이 축을 의심하지 않던 곳**(따옴표 값 안의 개행)이었다.
- [x] `_LEGACY_PATTERN` floor 대비 differential 재정의 — §N 용으로 신설했다가 revert 와 함께 제거.
- [x] `BlindPassFrozenTest` 규약 — §N 이 폐기됐으므로 **기존 규약 유지**(변경 없음).
- [x] 판정 → **won't-do**. "하나라도 새 표면" 조건에 해당(위 §결론).

## Rationale

**왜 P2.** 활성 결함이 아니다(§M 이 셋 다 닫았다). 그러나 "같은 자리에서 세 번" 은 설계
신호이고, 네 번째 파생이 나오기 전에 판정해두는 값이 있다.

**왜 티켓으로 남기나.** split 대안이 **정확성·성능 모두 동등 이상임을 이미 실측했다**는 사실
자체가 유실되면, 다음 사람이 같은 프로토타입을 다시 만든다. 남은 것은 release 경로 검증뿐이다.
