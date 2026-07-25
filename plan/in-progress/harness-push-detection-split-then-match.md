---
title: push 탐지를 split-then-match 로 뒤집을지 — 실측은 동등, 리스크는 release 경로
worktree: (unstarted)
started: 2026-07-25
owner: developer
priority: P2
---

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

- [ ] release 경로 상호작용 실측 — heredoc 소유권 판정이 세그먼트 분할 후에도 동일한가
      (`ReleaseTest`·`ReleaseRefusedTest`·`InputSizeCapTest` 전수를 split 프로토타입으로)
- [ ] `_LEGACY_PATTERN` floor 대비 differential 재정의 — floor 는 "전체 텍스트 스캔" 전제다
- [ ] `BlindPassFrozenTest`/"DO NOT EDIT this pattern" 규약을 어떻게 바꿀지 결정
- [ ] 위 셋이 모두 안전으로 나오면 전환, 하나라도 새 표면이면 **won't-do 로 종결**하고
      근거를 두 훅 주석에 고정

## Rationale

**왜 P2.** 활성 결함이 아니다(§M 이 셋 다 닫았다). 그러나 "같은 자리에서 세 번" 은 설계
신호이고, 네 번째 파생이 나오기 전에 판정해두는 값이 있다.

**왜 티켓으로 남기나.** split 대안이 **정확성·성능 모두 동등 이상임을 이미 실측했다**는 사실
자체가 유실되면, 다음 사람이 같은 프로토타입을 다시 만든다. 남은 것은 release 경로 검증뿐이다.
