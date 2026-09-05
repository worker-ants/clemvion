# RESOLUTION — `review/consistency/2026/09/05/18_23_03`

**BLOCK: YES** · Critical **2** · WARNING **2** · INFO **3**. **전건 조치 완료.**

## Critical — 지적이 맞다. 내가 동결한다고 적은 drift 를 내가 넓혔다

| # | 지적 | 조치 |
|---|---|---|
| 1 | 신규 선언 필드가 §5.4 가 **응답 바디에서 금지**한 `@ApiPropertyOptional({nullable:true})` + `field?: T \| null` 조합 | **정정.** 전부 §5.4 기본형으로 |
| 2 | `ScheduleDto.trigger` 는 반대 방향 — 순수 키 생략형인데 `nullable: true` | **정정.** 선언에서 `\| null` 제거 + 컨트롤러가 `null` 대신 **키를 생략** |

### 이 지적의 무게

같은 PR 의 `execution-response.dto.spec.ts` 가 그 조합을 `OPTIONAL_NULLABLE_DRIFT` 로
묶으며 *"이 가드는 고치는 것이 아니라 고정한다"* 고 적어 두었다. **그 문장을 쓴 커밋이
같은 조합을 23개 필드로 넓혔다.** checker 둘(`rationale_continuity`·`convention_compliance`)이
독립적으로 잡았다.

규약 원문을 확인했고 예외 여지가 없다 — §5.4 는 **"앞으로 도입·변경되는 필드에 적용"** 이라
명시하고, 내 신규 선언이 정확히 그 대상이다. 요청 바디 예외도 적용되지 않는다(응답 DTO다).

### 각 필드의 올바른 형태를 실측으로 정했다

컬럼이 nullable 이면 `@ApiProperty({ nullable: true })` + `T | null`, 아니면 `@ApiProperty()`.
**내 첫 측정 스크립트가 `tokenExpiresAt` 을 non-nullable 로 오판**해 엔티티 원문
(`@Column({ ..., nullable: true }) tokenExpiresAt: Date | null`)으로 재확인했다 — 도구보다
정본이 우선이다.

`appUrl` 은 엔티티 컬럼이 아니라 별도 판단이 필요했다. 키 생략형으로 적었더니 **e2e 계약
대조가 내 선언을 반증했다**: `appUrl [null] 키 생략형인데 null 이 왔다`.
`IntegrationsService.toPublic` 이 `{ appType: null, appUrl: null }` 기저값 위에 얹으므로
**상시 존재**였다 → 기본형으로 재정정.

## WARNING

| # | 지적 | 조치 |
|---|---|---|
| 1 | 6필드가 "항상 존재 + non-null" 인데 `@ApiPropertyOptional()` — 제3의 과소선언 | **정정.** Critical 1 과 같은 배치에서 `@ApiProperty()` 로 |
| 2 | `## 종결 조건` 표가 stale 수치 유지 — 문서 자신이 두 번 경고한 패턴의 3번째 재현 | **정정.** 수치를 빼고 본문 포인터로 대체 |

W2 는 특히 뼈아프다 — 그 표 바로 위에 *"아래 표에 개수를 적지 않는다 … 두 번 연속 낡았다"*
는 경고가 있는데 내가 **세 번째로** 어겼다.

## 구조적 조치 — 권고 3을 그대로 집행했다

checker 가 *"두 검증기 어느 쪽도 이 축을 구조적으로 검출하지 못한다"* 고 적었다. 사실이고,
그래서 조용히 넓어졌다:

- **런타임 검증자**(`response-contract.ts`)는 **값**을 본다. 이 조합은 키가 없어도 `null`
  이어도 선언에 맞으므로 어떤 값이 와도 통과한다.
- **정적 가드**의 presence/null 축은 **선언과 TS 타입이 서로 맞는가**를 본다. 이 조합은
  선언과 타입이 **일관되게 틀려** 있어 두 축을 모두 통과한다.

`swagger-dto-contract-guard.ts` 에 세 번째 축(`findOptionalNullableResponseFields`)을 더해
응답 DTO 전수를 훑고, 현재 **78건**을 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 로 고정했다.
새로 생기면 목록에 없어 실패하고, 갚아서 줄이면 목록에서 빼야 통과한다 — **양방향 래칫**이다.

> **78 은 종전에 알려져 있던 10건보다 훨씬 크다.** 트래커는 `ExecutionDto` 10곳만 세고
> 있었다. 전수 술어를 세우기 전에는 이 축의 실제 규모를 아무도 몰랐다.

요청 DTO 는 §5.4 자신이 제외하므로(`PATCH` tri-state 계약) `dto/responses/` 아래만 본다.

**판별력 실측**: 금지 조합을 1건 되돌린 뮤턴트에 그 필드를 이름으로 지목하며 RED
(`alert-rule-response.dto.ts:AlertRuleDto.createdBy`).

## INFO 처분

| # | 지적 | 처분 |
|---|---|---|
| 1 | CHANGELOG 가 optional/nullable 정밀도 축을 안 적음 | **반영.** 래칫 절을 추가하고 첫 판의 실수를 그대로 적었다 |
| 2 | `User select:false` 미해결 항목과 이번 결정이 같은 근거 구조인데 상호 참조 없음 | **반영.** 트래커에 선례 링크 |
| 3 | 응답 변환 메서드 명명이 서비스마다 다름 | 조치 불요(선택) — 세 번째 재발 시 convention 승격 |

## TEST 결과

| 단계 | 결과 |
|---|---|
| lint | **PASS** |
| unit | **PASS** — 447 스위트 / 9,414 통과 |
| build | **PASS** |
| e2e | **PASS** — 51 스위트 / 295 통과 |

**e2e 면제 아님** — 코드 변경이므로 수행했다. 중간에 `appUrl` 위반으로 1회 RED 가 났고,
그것이 위 재정정의 근거다.

## 보류·후속 항목

없음. 78건의 기존 drift 는 래칫이 고정하고, 갚는 것은 별도 항목이다.
