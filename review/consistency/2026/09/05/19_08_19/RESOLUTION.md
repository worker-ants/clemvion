# RESOLUTION — `review/consistency/2026/09/05/19_08_19`

**BLOCK: YES** · Critical **1** · WARNING **4** · INFO **3**.
**Critical 은 planner 인계 — developer 권한 밖이다. WARNING 중 내 범위 2건 조치 완료.**

## Critical — spec 이 "ref 만 보관" 이라 적는데 실제는 평문이다 (planner 인계)

| # | 지적 |
|---|---|
| 1 | `Trigger.notification_secret_v2` 가 rotation grace 24h 동안 **평문**으로 DB 에 있고 SecretResolver 를 우회하는데, `spec/5-system/14-external-interaction-api.md §7.1` 은 *"ref 만 보관"* 이라 반대로 적는다. `spec/conventions/secret-store.md §1` 예외 목록에도 미등재이며, 그 문서 자신이 경고한 *"세 번째 필드가 근거 없이 예외를 얻는 실패 모드"* 가 실현된 상태다 |

**지적이 맞다.** 이 PR 이 그 사실을 코드 주석·CHANGELOG 에 적으면서(`notificationSecretV2`
는 참조가 아니라 평문 서명 secret) 문서와의 모순이 드러났다. checker 둘이 독립 확인했다.

### 왜 내가 못 고치는가

developer 는 `spec/` 쓰기 권한이 없다. **자기-반증형 소정정 예외도 해당하지 않는다** —
그 예외는 *"developer 자신이 그 문서에 써 넣은 **예고·트리거** 문장"* 에 한정되는데,
문제의 문장은 2026-05-22 에 확정된 **저장 형태에 대한 보안 invariant**다. 조건 1(내가
썼다)과 조건 2(예고·트리거다) 둘 다 깨진다.

### 인계 내용

planner 가 택해야 할 것은 둘 중 하나다:

1. **사실로 정정 + 예외 등재** — `14-external-interaction-api.md §7.1` 의 "ref 만 보관" 을
   실측(24h grace 평문)으로 고치고, `secret-store.md §1` 예외 목록에 `notification_secret_v2`
   를 **독립 근거와 함께** 세 번째 항목으로 등재한다.
2. **코드측 ref 화를 요구** — 등재를 거부하고 그 컬럼을 실제 ref 저장으로 전환하는 설계
   변경을 별도 PR 로 지시한다.

`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목으로 등재했다.

> **이 PR 이 만든 결함이 아니다.** 그러나 게이트는 브랜치 단위로 막으므로, 이 인계가
> 해소되기 전에는 push 가 차단된다. 우회하지 않는다 — 그 판단은 planner 턴의 몫이다.

## WARNING 조치

| # | 지적 | 트랙 | 조치 |
|---|---|---|---|
| 2 | 정적 가드(`swagger-dto-contract*.ts`)가 `2-api-convention.md` `code:` 에 미등재 — 내가 세운 "양쪽 등재" 원칙을 자신이 못 지킴 | **planner** | 인계 항목에 묶어 등재 |
| 3 | `IntegrationDto` 신규 5필드가 nav-spec §9.1 표에 미등재 | **planner** | 〃 |
| 4 | 최신 커밋(`cb17f0870`)이 plan 트래커에 미반영 | developer | **반영.** 자기 반박 경위 · 78건 래칫이 **다른 모집단**임 · `ScheduleDto.trigger` 최종 wire 형태 |
| 5 | `EXPECTED_OPTIONAL_NULLABLE_DRIFT`(78) 와 `OPTIONAL_NULLABLE_DRIFT`(10) 가 상호 참조 없이 중복 추적 | developer | **양쪽에 상호 참조 추가.** 부분집합 관계와 "함께 줄여야 한다" 를 명시. 두 목록을 남기는 이유(전수 래칫은 키만, 후자는 형태까지)도 적었다 |

W2 는 특히 뼈아프다 — 바로 직전 planner 턴에서 *"한쪽만 등재하면 사각지대가 남는다"* 며
`response-contract.ts` 를 양쪽에 넣었는데, **그 원칙을 세운 문서가 자기 짝(정적 가드)을
빠뜨리고 있었다.**

## INFO 처분

| # | 지적 | 처분 |
|---|---|---|
| 1 | `consecutiveNetworkFailures` 중복 등재 방지 | 확인 기록 |
| 2 | 신규 DTO 클래스 JSDoc 에 보안사고 경위 서사 — `swagger.md §3` 관례상 `//` 권장 | **조치 불요.** checker 가 플러그인이 클래스 JSDoc 을 스키마로 승격하지 않음을 실측 확인했다(공개 OpenAPI 유출 없음) |
| 3 | "지금 2곳" 서술이 낡음 | **다음에 그 항목을 열 때** 실측치로 — 지금 고치면 또 낡는다 |

## TEST 결과

| 단계 | 결과 |
|---|---|
| lint | **PASS** (`19:24:20`) |
| unit | **PASS** (`19:25:35`) |
| build | **PASS** (`19:27:20`) |
| e2e | **PASS** — 295 통과 (`19:30:16`) |

## 보류·후속 항목

**planner 인계 3건**(Critical 1 · W2 · W3)을 트래커에 등재했다. 이 브랜치의 push 는 그
turn 이 끝나야 열린다.
