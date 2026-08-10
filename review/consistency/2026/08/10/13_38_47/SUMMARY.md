# Consistency 통합 보고서 — `--impl-done spec/7-channel-web-chat`

- 모드: `--impl-done` · target `spec/7-channel-web-chat` · diff-base `origin/main`
- 5 checker **전원** 리포트 확보.

## BLOCK: NO

Critical 0 · **경고 1(반영 완료)**.

## 전체 위험도

**LOW**.

## Critical / 경고

| # | checker | 발견사항 | 조치 |
|---|---|---|---|
| 1 | cross_spec | **`spec/0-overview.md:82` 이 "영역 spec 6문서 전부 `implemented`" 로 단정** — 이번 diff 가 `3-auth-session.md` 를 `partial` 로 내려 직접 모순 | **반영** (`bd76278ea`) — "5문서 `implemented`, `3-auth-session` 은 `partial`" 로 정정 + 사유·소유 plan·날짜 명기 |

> cross_spec 이 **"기존 build 가드가 검증하지 않는 사각지대"** 라고 짚었고 정확하다 —
> `spec-status-lifecycle.test.ts` 는 frontmatter 만 보고 **다른 문서의 산문이 그 status 를
> 뭐라고 말하는지는 보지 않는다.**

## 5 checker 결과

| checker | 위험도 | 비고 |
|---|---|---|
| cross_spec | LOW | 위 WARNING 1건. 그 외 데이터 모델·API 계약·요구사항 ID(EIA-RL-07/AU-04/IN-12 대조)·상태 전이·RBAC·계층 책임 이상 없음 |
| rationale_continuity | NONE | §R7 이 사전에 기각 이력("boot 세대 비교는 두 번 기각")을 명문화해 둔 정당한 결정 갱신. 코드 직접 확인 — 기각된 축 재도입 없음 |
| convention_compliance | NONE (INFO 1) | 6문서 × `spec/conventions/**` 대조. 절단된 번들은 워크트리에서 직접 Read 해 보완 |
| plan_coherence | LOW (INFO 1) | 앞선 두 라운드 지적 4건 중 3건 해소 확인. 잔여 INFO(형제 plan 상호 링크)는 **반영** (`d5f62bfc3`) |
| naming_collision | NONE | 신규 식별자 충돌 없음 |

## 이 라운드가 잡은 것 — "전수" 의 범위를 세 번 연속 좁게 잡았다

이 티켓에서 같은 뿌리의 결함이 **8번** 나왔다. 앞선 7건은 "구조를 바꾸고 설명 텍스트가
늦었다", 이번 건은 "**상태를 바꾸고 그 상태를 미러하는 문서가 늦었다**" — 축만 다르고
뿌리는 같다(**바꾼 것의 자매를 전수로 세지 않는다**).

특히 나쁜 것은 **매번 "이번엔 넓게 셌다" 고 선언한 직후에 다음 자리가 나왔다**는 점이다:

| 선언 | 실제로 센 집합 | 그래서 놓친 것 |
|---|---|---|
| "전수로 확인하라"(reviewer 에게 지시) | `use-widget.ts` 한 파일 | spec Rationale · plan 예시 (6·7번째) |
| "저장소 전체 × 용어로 셌다" | `짝 가드`·`=== "already_owned"` 두 용어 | **`status` 축** (8번째) |

지시도 옳았고 수행도 옳았는데 **범위가 틀려서 통과했다.** "전수로 세라" 는 처방은
어느 집합을 셀지 함께 정하지 않으면 매번 이렇게 조용히 빠져나간다.

## 처리 원칙 — 기록은 지우지 않았다

`plan/complete/web-chat-quality-backlog.md` 의 stale 문장은 **원문을 보존하고 날짜 있는
정정 주석**을 덧댔다. `review/**` 감사 기록의 옛 관용구를 고치지 않은 것과 같은 이유다 —
그때 무엇을 적었는지가 사실이고, 나중 문서가 그것을 정정한 이력 자체가 audit trail 이다.

## 검증

- 문서 가드 19파일 **2878 passed**
- 위젯 23파일 **409 passed** · `tsc --noEmit` **0 errors**
