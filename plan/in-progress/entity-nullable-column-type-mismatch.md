---
worktree: plan-in-progress-items-b0c80b
started: 2026-09-03
owner: developer
status: in-progress
priority: P3
spec_impact: none
---

# `nullable: true` 컬럼인데 TS 타입은 non-null — 엔티티 전반

> 출처: `#1269`(`change-password` 코드 정렬) 작업 중 발견. `User.passwordHash` 하나를 고치려다
> **같은 형태가 46건**임을 실측했다. 그 PR 은 캐스트를 fixture 팩토리 한 곳으로 모으는 선에서
> 멈췄고(backend ratchet **199/38 → 198/37**), 타입 자체는 여기로 이월한다.

## 무엇이 문제인가

DB 컬럼은 `nullable: true` 인데 TS 필드는 `string`·`Date` 같은 **non-null** 로 선언돼 있다.
런타임에는 `null` 이 실제로 들어오므로 **타입이 실제보다 좁다** — 컴파일러가 막아 줄 것 같은
자리에서 막아 주지 않고, `null` 을 다루는 테스트 fixture 는 캐스트 없이는 타입체크를 통과하지
못한다.

`User.passwordHash` 가 전형적이다 — 엔티티 **자신의** `validatePasswordHashFormat` 이
`this.passwordHash === null` 을 검사한다. 즉 코드가 null 을 전제하는데 타입만 아니라고 한다.

## 실측 (2026-09-03)

| 항목 | 값 |
|---|---|
| `nullable: true` 직후 필드가 non-null 로 선언된 자리 | **46건** |
| `User.passwordHash` 사용처(비테스트) | **33곳** |

> **휴리스틱 계수다.** `*.entity.ts` 에서 `nullable: true` 다음 3줄 안의 필드 선언을 정규식으로
> 봤다. 데코레이터가 여러 줄이거나 타입이 별칭이면 놓칠 수 있으니 **하한**으로 읽어라.

## 선례 — 이 저장소는 같은 클래스를 이미 두 번 고쳤다

- `Execution.error` → `Record<string, unknown> | null` (CHANGELOG: *"DB 는 처음부터
  `nullable: true` 였는데 타입만 그것을 안 적고 있었다"*)
- `llm-usage-log.workflowId` · `executionId` → `string | null`

즉 **처방은 확립돼 있고**, 남은 것은 범위 판단이다.

## 왜 `#1269` 에서 안 했나

`passwordHash` 하나만 넓혀도 **33 사용처**에 파급되고, 그 PR 의 승인 범위는
"`change-password` 실패 코드 정렬" 이었다. 타입 확장은 그 범위 밖이고, 섞으면 리뷰가
둘 다 흐려진다.

## 할 일

- [ ] 46건을 **일괄 vs 점진** 판단 — 일괄이면 한 PR 이 크고, 점진이면 새 코드가 계속 추가된다.
      ratchet 이 새 진단을 막아 주므로 점진이 안전한 쪽으로 보인다
- [ ] 점진이면 **우선순위 기준**을 정한다 (제안: `null` 분기를 실제로 쓰는 필드 우선 —
      `passwordHash` 처럼 코드가 이미 null 을 검사하는 자리)
- [ ] 각 확장마다 사용처 파급을 확인하고 ratchet baseline 을 **낮추는 방향**으로만 갱신
