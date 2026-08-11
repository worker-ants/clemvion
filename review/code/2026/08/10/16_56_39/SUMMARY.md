# Code Review 통합 보고서 — 재로드 REST 오류 분기 (4라운드)

- 대상: `claude/webchat-reload-rest-branches` · diff-base `origin/main` · `--route=all`
- forced **7명 전원**.

## BLOCK: NO

**Critical 2 · WARNING 8** — 전부 반영 (`RESOLUTION.md`).

## 전체 위험도

**LOW** (반영 후).

## Critical

| # | reviewer | 발견사항 | 조치 |
|---|---|---|---|
| 1 | **security · side_effect · requirement (3명 독립)** | **`"stale"` 이 `scheduleRefresh` 까지 건너뛴다** — 세션의 **유일한** 갱신 예약 지점이라 복구 사이클이 사라져 스피너 영구 고착. **내가 직전 CRITICAL 을 고치며 만든 것** | **반영** — 전용 갈래 `"refresh_deferred"`(스트림만 건너뛰고 갱신은 예약) |
| 2 | **scope** | **커밋된 산출물이 거짓을 주장** — `16_42_07` SUMMARY/RESOLUTION 이 "반영 완료" 라 적었는데 `git show` 실측상 그 커밋에 없었다 | **반영** — 산출물 정정(원 서술은 이력 보존) |

## 경고 (요약)

| reviewer | 발견 | 조치 |
|---|---|---|
| **testing** | **`phase !== "ended"` 로는 정상 streaming 과 고착 streaming 을 못 가른다** | **반영** — 만료를 넘겨 refresh 가 다시 나가는지로 측정. 뮤테이션 RED |
| maintainability | JSDoc 복원 정확 확인 + REST 분기 표가 중간 판 기준 | **반영** |
| documentation | `refresh_deferred` 도입으로 서술 재-stale | **반영** |
| requirement | §3.1-2 ↔ §R4 정합 확인(410 포함) | 확인 |

## 이 라운드의 성격 — 6명이 같은 CRITICAL 에

security · side_effect · scope · requirement · documentation 은 **코드 추적**으로,
testing 은 **"테스트가 그걸 못 잡는다"** 는 각도로 도달했다. 여섯 번째 관점이 없었다면
결함은 고쳤어도 **회귀는 여전히 비어 있었을 것이다.**

## 같은 수정을 세 번 했다

`refresh_deferred` 배선이 **두 번 유실**됐다 — 검증(tsc 0 / 417 통과) 뒤 커밋 전에 사라졌고,
타입 선언과 JSDoc 만 남았다.

원인은 **공유 워크트리에서 리뷰어의 뮤테이션 하네스**다(`cp` 백업 → 뮤테이션 → `cp` 원복).
내가 그 창 안에서 편집하면 원복이 덮는다. scope 의 CRITICAL 도 **정확히 같은 뿌리**다 —
"검증했다" 를 "반영됐다" 로 읽은 것.

**검증은 커밋되기 전까지 잠정이다.** 이후로는 검증 직후 즉시 커밋하고 `git show --stat` 으로
확인했다.

## 반환값이 한 티켓에서 세 번 바뀌었다

| 값 | 왜 버렸나 |
|---|---|
| `"continue"` | 거부된 토큰으로 SSE 오픈 (`16_42_07`) |
| `"stale"` | 갱신 예약 소실 → 영구 고착 (`16_56_39`) |
| **`"refresh_deferred"`** | 두 부작용이 **반대 방향**이라 전용 갈래가 필요했다 |

## 검증

- 위젯 **417 passed** · `tsc --noEmit` **0 errors** · 문서 가드 **2876 passed**
- 뮤테이션 누적 **13종**
