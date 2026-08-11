# RESOLUTION — `10_58_43` (종결)

Critical 0 / Warning 1. **코드는 고치지 않았다** — 이번 라운드의 처분 규칙이 그렇다.

## W1 (maintainability) — **plan 등재로 처분, 코드 무변경**

`use-widget-eager-start.test.ts:105` 의 `16_09_40` provenance 가 "security·side_effect 독립
수렴"(2명)으로 남아 있다. 실제로는 4명이고, 정본 앵커는 직전 라운드에 정정됐다.

`plan/in-progress/webchat-auth-session-status-reconcile.md` 에 **근거와 트리거와 함께** 등재했다 —
"다음에 그 파일을 편집할 때 정정하거나 앵커 포인터로 축약". 리뷰어 자신의 권고와 같다.

**왜 코드를 안 고치는가**: 리뷰 게이트는 `codebase/**` 변경을 세므로 이 주석 한 줄을 고치면
이 라운드가 무효화되고 확인 라운드를 한 번 더 돌아야 한다. 이 티켓은 13라운드를 돌았고 그중
넷은 **직전 라운드 fix 가 만든 결함** 때문이었다. 주석 한 줄의 정확도를 위해 그 비용을 다시
치르는 것은 균형이 맞지 않는다 — 그리고 그 판단이 이 라운드를 종결 가능하게 하는 유일한 길이다.

## 이 티켓의 전말 (13라운드)

| 라운드 | CRITICAL 의 출처 |
|---|---|
| 6 | **원 결함** — `refresh_deferred` 가 복구를 약속만 하고 배선이 없었다 |
| 7 | 내 fix — 낙관적 플래그 클리어가 새 고착 경로 |
| 8 | 내 테스트가 실행 환경에 따라 갈림 + 내 JSDoc 자기모순 |
| 9 | 내 redaction 이 `openStream` 진입점 셋 중 하나만 |
| 10 | 내 catch 가 부팅 실패를 삼킴 + `spec_impact` 누락(Gate C 실제 FAIL) |
| 11·12·13 | **CRITICAL 0** |

**라운드 7~10 의 CRITICAL 은 전부 직전 라운드 fix 가 만든 것이다.** 원 결함은 6에서 닫혔고
그 뒤 넷은 뒷정리였다. 공통 뿌리는 하나 — *고친 값·범위가 인접 표면을 보는지 확인하지 않았다*.
그 형태가 코드에서 네 번, 테스트에서 두 번, 문서·주석에서 네 번, 총 **열 번** 재발했다.

## 무엇이 남았고 어디에 있나

전부 `plan/in-progress/webchat-auth-session-status-reconcile.md` 에 **트리거 조건과 함께** 있다:

| 항목 | 재검토 트리거 |
|---|---|
| `start()` 경로 401 도달 가능성 | 실측 후 회귀 추가 또는 도달 불가 근거 확정 |
| refresh 동시 발화 경합 | 세 조건이 겹치는 창 재현 시 |
| `catch` 분기 세대 재검사 미검증 | 그 분기를 가르는 인터리빙을 찾으면 |
| 주기 갱신 terminal 시 storage 미정리 | `onTerminal` 통지 도입 여부 결정 시 |
| 꼬리 블록 중복 | **`SeedOutcome` 다섯 번째 갈래 추가 시** |
| `runApplyConfig` stale 가드 | **checkpoint 2 뒤에 `await` 추가 시** |
| `16_09_40` provenance 사본 | 그 테스트 파일을 다음에 편집할 때 |

## 검증 (이번 라운드 기준, 코드 무변경)

- 위젯 vitest **442 passed** (23 files).
- harness/doc guards **1032 passed / 1128 subtests**.
- `tsc --noEmit` **0 errors**.
- Gate C(frontend `spec-plan-completion`) **814 passed**.
- 뮤테이션 **누적 18종**.

## 종결

세 라운드 연속 CRITICAL 0, 6/7 이 NONE, scope 리뷰어가 독립적으로 종결을 권고했다.
남은 것은 전부 등재됐다. **이 티켓을 닫는다.**
