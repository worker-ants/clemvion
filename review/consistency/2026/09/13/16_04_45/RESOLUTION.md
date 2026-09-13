# RESOLUTION — `--impl-done` 라운드 5 (`review/consistency/2026/09/13/16_04_45`)

**BLOCK: NO · Critical 0 · WARNING 1 · INFO 8.** **developer 추가 조치 없음.**

checker 의 결론: *"이번 PR 은 CRITICAL 없이 5개 checker 전원 수렴 — developer 턴에서 추가로
취할 조치 없음. push/turn-end 게이트 통과 가능."*

## WARNING 1건 — 5라운드 연속, 그리고 그게 정상이다

`user-guide-evidence.md` SoT 미갱신(§2 표 3→5 · §2.1 관계표 · frontmatter · `## Rationale`).
**라운드 1~5 내내 같은 항목이 떴다.**

> **반복 자체는 결함이 아니다.** 이 항목은 `spec/` 쓰기가 필요해 **planner 턴에서만** 닫히고,
> 매 라운드 checker 는 *현재 상태*를 본다. 중요한 것은 두 가지이고 둘 다 유지됐다 —
> (1) **developer 쪽 잔여가 0**, (2) 초안이 트래커에 **복붙 수준**으로 준비돼 있다.
>
> checker 가 권한 판정까지 독립으로 확인했다: *"developer 는 자기-반증형 소정정 예외(조건 2:
> 설계 원칙 문장은 «예고 문장»에 해당 안 함)에도 해당하지 않음을 스스로 판정해 spec 을 직접
> 고치지 않았다 — 권한 경계는 정확히 지켜졌다."*

네 조각(§2 표 · §2.1 관계표 · frontmatter · Rationale)을 **한 planner 턴**에 묶으라는 조건이
등재 문구에 있다. 나눠 처리하면 표가 여러 번 미완결이 된다.

## INFO 8건 — 전부 양성 확인

| # | 확인된 것 |
|---|---|
| 1 | 코드 주석의 `3-error-handling.md §1.4` 인용이 실제 문서와 **정확히 일치** |
| 2 | `GUIDE_EXTERNAL_VOCABULARY` 와 `error-codes.md §3` Historical-artifact 예외는 **별개 메커니즘** — 충돌 아님 |
| 3 | frontend 테스트가 backend 소스를 `fs` 로 읽는 것은 `frontend-layering.md §1` 의 import 축 대상이 **아님**(리네임 전부터의 패턴) |
| 4 | 이번 번복이 **부분적** — 전수 열거는 채택하되 frontend 자기증명 오염 축은 계속 거부 |
| 5 | `review-citations.md §2` 전수 준수, **bare `hh_mm_ss` 0건**(라운드 2 CRITICAL 해소 재확인) |
| 6 | `cafe24` Principle 오인용은 선재·별도 등재분 — **중복 등재 아님** |
| 7 | 모듈-private `UPPER_SNAKE` 동명 상수는 둘 다 비-export — 충돌 아님 |
| 8 | `GUIDE_EXTERNAL_VOCABULARY` 접두 분리가 의도대로 — 실측 재확인 |

## 검증

`spec/conventions/**` 델타 0 · 라운드 1~5 내내 developer 잔여 0 유지 ·
라운드 2 CRITICAL(bare 인용) 해소가 라운드 3·5 에서 두 번 재확인됨.
