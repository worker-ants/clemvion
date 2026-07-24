---
title: mermaid 설치 동시성 — 근거 생기면 추출 + fcntl.flock (§G, 조건부)
worktree: (unstarted)
started: 2026-07-24
owner: developer
status: blocked
priority: P4
---

## Overview

`harness-guard-followups.md` §G 에서 이관.

> 출처: `review/code/2026/07/18/00_59_56` W6 (architecture, 추출) +
> `02_06_42` C1 (동시성, 락 제거 결정).

**이 티켓은 조건부다.** 착수 조건이 충족되기 전에는 열지 않는다 — 현행 마커-only 유지가
기본값이며, 그것이 의식적 결정이다.

## 착수 조건

동시 첫-설치 오염이 **실제로 관측**될 것. 지금은 dev 툴 린터에 과설계라고 판단했다.
"이론적으로 가능하다" 는 착수 사유가 아니다 — 이 항목의 락은 4라운드 연속 손수 짠 버그를 냈다.

## 배경 — 왜 락을 뺐나

§A 는 **마커-only(락 없음)** 로 마감했다. 손수 짠 `mkdir` 락이 라운드마다 새 버그를 냈다:

| 라운드 | 실측 재현된 버그 |
| --- | --- |
| 20_06_45 W1 | 탈취가 "경과 시간" 만 봐서 *살아있는* 느린 설치의 락도 탈취 → 동시 install |
| 00_59_56 W1 | grace 를 `find -mmin` 분 변환하다 60초 미만이 `-mmin -0` 으로 truncate → age 게이트 무력화 |
| 02_06_42 **C1** | `_lock_is_dead && rm -rf; mkdir` 이 **check-then-act TOCTOU** — 두 세션이 같은 죽은 락을 보고 둘 다 rm+mkdir, 진 쪽이 이긴 쪽의 fresh 락을 지워 **둘 다 동시 install** |

## 착수하게 되면 — 올바른 형태

- bootstrap 책임 #2 를 **별도 스크립트/헬퍼로 추출**(W6 지적. reap 은 이미 분리된 선례).
  인라인 ~40줄이 파일의 SRP 를 흐리고, 테스트가 무관한 reap 섹션을 `REAP_MIN_INTERVAL` 로
  무력화해야 한다.
- 락이 필요하면 **`mkdir` 로 재발명하지 말고 `fcntl.flock`** (python 헬퍼). 커널이 홀더
  사망 시 자동 해제 → stale 락·steal·PID liveness·grace·TOCTOU 가 **애초에 없다**.
  macOS 에 없는 것은 `flock(1)` **명령**이지 `flock(2)`/`fcntl` **syscall** 이 아니다
  (python `fcntl.flock` 가용 확인함).

## 체크리스트

- [ ] (착수 조건 충족 시) `ensure-mermaid-lint-deps.py` 추출 + `fcntl.flock` 기반 동시성
- [ ] 아니면 현행 마커-only 유지 — 이 티켓을 won't-do 로 종결

## 관련

- `.claude/tools/bootstrap-session.sh` (책임 #2 — 인라인 설치 가드)
- `.claude/hooks/_lib/mermaid_lint_ready.py` (readiness SoT)
- `.claude/tests/test_bootstrap_mermaid_install.py`
- 부모: [`harness-guard-followups.md`](harness-guard-followups.md) §G
- 연관: §A 잔여 I1 (hung `npm install` 타임아웃 — flock 도입 시 함께 해소)
  → [`harness-guard-residual-hygiene.md`](harness-guard-residual-hygiene.md)

## Rationale

**왜 지금 안 하나.** 마커-only 로 실질 목표(부분 설치가 영속하지 않음)는 달성됐다.
락은 4라운드 연속 버그를 냈고, 진짜 동시성 보장이 필요하다는 근거가 생기기 전엔 과설계다.
이 티켓의 가치는 "하자" 가 아니라 **"하게 되면 이렇게 하라"** 를 기록해 둔 것 —
같은 `mkdir` 락을 다섯 번째로 재발명하는 걸 막는다.
