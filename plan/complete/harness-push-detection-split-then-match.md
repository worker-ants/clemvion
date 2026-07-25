---
title: push 탐지를 split-then-match 로 뒤집을지 — 실측은 동등, 리스크는 release 경로
worktree: harness-split-then-match-7e2b
started: 2026-07-25
completed: 2026-07-25
owner: developer
priority: P2
status: complete
spec_impact: none
---

## ✅ 판정 결과 (2026-07-25): **전환** — 체크리스트의 "모두 안전" 조건 충족

핵심 우려("release 경로 상호작용이 미지수")를 **전체 스위트 실행**으로 판정했다. 프로토타입을
실제 훅에 넣고 656개를 돌리니 **652 passed / 4 failed**, 그 4건이 전부 이 파일 자신의
**패턴 문자열 pin·앵커 부기**였다(`_BLIND_PATTERN` 비교, `_env_value_subpatterns` 의 `.index`
앵커). 즉 동작 결함 **0**:

| 우려했던 축 | 결과 |
| --- | --- |
| release 경로(`ReleaseTest`·`ReleaseRefusedTest`·`InputSizeCapTest`) | **26 passed** |
| differential + floor(`DifferentialTest`·`GeneratedFloorTest`) | **12 passed** (277 subtests) |
| backtracking(§M b·c·e 회귀 pin 포함) | **14 passed** |

**순서가 유일한 실질 제약이었다**: `_commit_heredoc_spans` 는 전체 텍스트에서 opener 와
terminator 를 찾으므로 **redact 를 먼저** 하고 split 해야 한다. 이 계약을 테스트로 고정했다
(`test_redaction_runs_before_the_split`) — 뒤집으면 heredoc 이 release 되지 않아 커밋 메시지가
push 를 언급했다는 이유로 차단된다.

### §M 이 쫓던 세 형태가 이제 표현 불가

| 형태 | §M 초안 | §M 최종 | §N |
| --- | --- | --- | --- |
| (b) `A=v\n` 런 | 30,000 ms | 5 ms | **1.4 ms** (20k) |
| (c) 개행 런 | 62,000 ms | 4 ms | **1.1 ms** |
| (e) `git` 줄 런 | 14,717 ms | 2.4 ms | **8.9 ms** |
| (d) `&` 런 | — | — | **4.8 ms** |

네 형태 모두 20k→40k 에서 배율 **1.9~2.1x**(완전 선형). 수치 자체보다 중요한 것은 **줄에는
개행이 없어서 세 결함이 애초에 표현될 수 없다**는 점이다 — 네 번째 패치가 아니라 메커니즘 교체다.

### 부수 효과

`guard_default_branch_bash._MUTATING` 의 §M(b) 파생 narrowing(`[^\S\n]+`)도 **원복**했다.
그건 `_GIT_PUSH` 가 `\n` 을 품는 동안 byte-identical 을 유지하려고 넣은 것이라 §N 이후 존재
이유가 사라졌다(그 훅은 원래부터 split 기반이라 동작에는 무관했다).

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

- [x] release 경로 상호작용 실측 — **26 passed, 변경 없음**. 단 `redact → split` 순서가
      load-bearing 임을 발견하고 계약으로 고정(양쪽이 갈리는 fixture 로 비-vacuity 확인).
- [x] `_LEGACY_PATTERN` floor 대비 differential — floor 는 §N 이전을 답할 수 없으므로
      **§M 패턴을 옛 방식(전체 매칭)으로 재구성해 corpus 전수 비교**하는 테스트를 신설
      (`test_detection_matches_the_whole_command_form_it_replaced`, 57 subtests).
- [x] `BlindPassFrozenTest` 규약 — pin 은 유지하되 **적용 방식까지 미러**하도록 `blind_search`
      신설(패턴만 고정하면 훅이 그것을 어떻게 쓰는지를 더는 기술하지 못한다).
      "DO NOT EDIT" 는 "**`\n` 을 다시 넣지 말 것**" 으로 대체 — `test_the_pattern_does_not_mention_newline` 이 강제.
- [x] 셋 모두 안전 → **전환 완료**.

## Rationale

**왜 P2.** 활성 결함이 아니다(§M 이 셋 다 닫았다). 그러나 "같은 자리에서 세 번" 은 설계
신호이고, 네 번째 파생이 나오기 전에 판정해두는 값이 있다.

**왜 티켓으로 남기나.** split 대안이 **정확성·성능 모두 동등 이상임을 이미 실측했다**는 사실
자체가 유실되면, 다음 사람이 같은 프로토타입을 다시 만든다. 남은 것은 release 경로 검증뿐이다.
