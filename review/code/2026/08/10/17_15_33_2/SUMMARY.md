# Code Review 통합 보고서 — 재로드 REST 오류 분기 (5라운드, 수렴)

- 대상: `claude/webchat-reload-rest-branches` · diff-base `origin/main` · `--route=all`
- forced **7명 전원**. 세션 디렉터리가 `_2` 접미사인 것은 같은 초 충돌 —
  **PR #1125 의 원자적 세션 생성이 실전에서 작동**했다.

## BLOCK: NO

Critical 2 · WARNING 2 — **전부 처분** (`RESOLUTION.md`).

## 전체 위험도

**LOW** (처분 후).

## Critical

| # | reviewer | 발견 | 처분 |
|---|---|---|---|
| 1 | testing | **보강을 한쪽 케이스에만 했다** — `500` 케이스에서 같은 뮤턴트가 생존(scratch 사본 실측) | **반영** — 같은 보강 적용, 뮤테이션 **2건 RED**(이전 1건) |
| 2 | side_effect | **`refresh_deferred` 가 고착의 절반만 닫는다** — `openStream` 호출부 2곳이 모두 그 값에서 건너뛰고 주기 갱신은 스트림을 안 연다(grep 실측) | **plan 등재 + 범위 명시** — 처방이 설계 선택 3택이라 이 PR 에서 결정하지 않는다 |

## 경고

| reviewer | 발견 | 처분 |
|---|---|---|
| maintainability | 게이팅 관용구가 호출부 2곳에 리터럴 복제 | **반영** — `shouldAbortAfterSeed` 추출. **fail-closed 확정**(화이트리스트)·네 갈래 의미 구분 확인도 함께 받음 |
| documentation | 서술 정합 | 확인 |

## 0/0 을 낸 reviewer

| reviewer | 비고 |
|---|---|
| security | NONE — **`refresh_deferred` 배선이 HEAD 에 실렸음을 `git show` 로 확인**(두 번 유실 이력 때문에 요청한 검증) + 회귀 3건 직접 실행 |
| scope | NONE — 직전 CRITICAL(산출물 거짓 주장) 정정이 실제 커밋과 일치함을 `git show` 로 재판정. 교차-PR frontmatter 경합도 `hash-object` 로 실증 |
| requirement | 정합 확인 |

## 이 PR 이 닫은 것과 남긴 것 (정직하게)

**닫음**: `404` → 종료 · `401` → 낙관적 refresh 1회 · 재차 `401`/`410` → 종료 확정 ·
그 외 → 세션 보존 · 고착 원인 A(`scheduleRefresh` 소실).

**남김**: 고착 원인 B(스트림 부재). `refresh_deferred` 뒤 아무도 스트림을 열지 않는다.
**종전 대비 악화는 아니다** — 종전에도 그 경로는 죽은 토큰으로 SSE 를 열어 같은 스피너였고,
지금은 최소한 죽은 토큰을 쓰지 않는다. 처방 3택을 근거와 함께 plan 에 등재했다.

## 5라운드가 걸린 이유 — CRITICAL 이 연쇄했다

| 라운드 | CRITICAL | 출처 |
|---|---|---|
| `16_09_40` | 갱신 전 토큰으로 SSE | 원 구현 |
| `16_42_07` | `"continue"` 로 죽은 토큰 오픈 | 원 구현 |
| `16_56_39` | `"stale"` 로 갱신 예약 소실 | **직전 수정** |
| `16_56_39` | 커밋 산출물의 거짓 주장 | **내 기록** |
| `17_15_33_2` | 보강을 한쪽에만 | **직전 수정** |
| `17_15_33_2` | `refresh_deferred` 절반만 | **직전 수정** |

원 구현 결함은 2건이고 **나머지 4건은 고치는 과정에서 생겼다.** 공통점은 하나 —
**고친 값·범위가 인접 표면을 보는지 확인하지 않았다.**

## 검증

- 위젯 **417 passed** · `tsc --noEmit` **0 errors** · 문서 가드 **2876 passed**
- 뮤테이션 누적 **14종**
