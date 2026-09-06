# RESOLUTION — `review/code/2026/09/06/00_24_34`

**원 리뷰 결과**: Critical 0 · WARNING 4 · 위험도 LOW · forced 7명 전원 산출물 확보
**처분**: WARNING 4건 전부 코드 수정. 그 과정에서 같은 반증 서술의 6번째 자매 1건 추가 발견·정정

## W1 (side_effect) — `toResponse` 의 미처리 `TypeError`

`schedule.trigger` 가 로드되지 않은 채 오면 `t.id` 에서 그대로 터졌다. 500 이 되는 것은
불변식상 맞지만 **왜인지가 스택트레이스에만** 남았다.

**수정** — 불변식을 이름으로 던진다.

```ts
if (!t) {
  throw new InternalServerErrorException(
    `Schedule ${schedule.id} has no loaded trigger — ` +
      'schedule.trigger_id is NOT NULL, so this means the query forgot ' +
      'the join/relation (or the row is orphaned).',
  );
}
```

**행을 건너뛰거나 키를 생략하지 않은 이유**: `ScheduleDto.trigger` 는 §5.4 **기본형**
(`@ApiProperty`)이라 키를 빼면 계약 위반이다. 명시적 throw 는 가용성을 바꾸지 않고
(어차피 500) **다음 사람이 방어 분기를 넣어 계약을 조용히 깨는 것**을 막는다 —
리뷰어가 제안한 방향 그대로다.

> 주석에 *"소비처는 옵셔널 체이닝 없이 읽는다"* 라고 쓰려다 **실측으로 반증했다** —
> `schedules/page.tsx` 는 `s.trigger?.name ?? ""` 로 방어한다. 근거를 *"방어가 부재를
> 정상으로 만들지는 않는다(이름 없는 행이 조용히 남는다)"* 로 바꿔 적었다.

## W2 (testing) — 서술이 실제 커버리지보다 넓었다

`ScheduleTriggerRefDto.workflow` JSDoc 이 *"세 형태를 e2e 가 각각 고정한다"* 고 주장하는데,
키-존재를 **양성으로** 단언하는 자리는 상세(`GET /:id`) 하나뿐이었다. 목록과 PATCH 는
`assertMatchesContract` 만 돌았고, §5.4 **키 생략형은 부재를 위반으로 보지 않으므로** 좁히기
로직이 통째로 사라져도 통과한다.

**주장을 낮추지 않고 커버리지를 넓혔다** — 문서한 보장이 구현보다 넓으면 안 되지만, 여기서는
보장이 옳고 테스트가 못 미쳤다.

| 경로 | 종전 | 지금 |
|---|---|---|
| `POST /api/schedules` (생성) | `['id','name','workflowId']` 양성 (부재 고정) | 그대로 |
| `GET /api/schedules/:id` | 4키 양성 | 그대로 |
| `GET /api/schedules` (목록) | 계약 대조만 | **4키 양성 추가** |
| `PATCH /api/schedules/:id` | 계약 대조만 | **4키 양성 추가** |

e2e 가 GREEN 이라는 것 자체가 **PATCH 응답에 `workflow` 가 실제로 실린다**는 실측이다
(`?? {}` 로 받으므로 부재면 키 0개가 되어 실패한다) — DTO JSDoc 의 *"수정에도 채워진다"* 를
독립적으로 확인한 셈이다.

## W3 (documentation) — CHANGELOG 가 23건을 통째로 "금지 조합" 이라 했다

같은 PR 의 plan 트래커는 이미 **17(금지 조합) + 6(과소 선언)** 으로 갈라 놓았는데 CHANGELOG
본문만 정정이 반영되지 않았다. 섞어 세면 **래칫이 무엇을 막는지가 흐려진다.**

**수정** — "23필드 중 17개" 로 바꾸고, 나머지 6개(`consecutiveNetworkFailures` ·
`documentCount` · `rerankMode` · `rerankCandidateK` · `chatChannelHealth` ·
`notificationHealth`)가 **다른 축**임을 blockquote 로 명시했다.

## W4 (documentation) — 검증 없이 쓴 인과가 거짓이었다

`schedules.service.ts` 주석이 `saved.trigger` 대입이 과거 `if (isActive)` 안에 있던 이유로
*"`registerJob` 이 필요로 하므로"* 를 들었다. **실측으로 반증** — `registerJob` 은
`id`·`cronExpression`·`timezone`·`workspaceId` 넷만 읽고 `trigger` 를 보지 않는다
(`schedule-runner.service.ts`).

**수정** — *"같은 `if` 블록 안에 함께 들어 있었을 뿐"* 으로 바꾸고, 종전 서술이 틀렸다는
사실과 반증 근거를 남겼다. 거짓 인과는 다음 사람에게 **있지도 않은 제약**을 전제시킨다.

## 추가 발견 — 같은 반증 서술의 6번째 자매

W2 를 고치며 `schedule-trigger.e2e-spec.ts` C-3 의 주석이 여전히
*"조회 경로(`GET /:id`)**에서만** 채워진다"* 라고 적고 있는 것을 봤다. 이 브랜치가 두 DTO 와
컨트롤러에서 이미 세 번 고친 바로 그 반증된 문장이다. **부재는 생성 응답에만** 있다로 정정.

## 검증

| 단계 | 결과 |
|---|---|
| lint | PASS (52s) |
| unit | PASS |
| build | PASS (142s) |
| e2e | PASS — 297 |

e2e 개수가 그대로인 것은 정상이다 — 신규 `it()` 없이 기존 두 테스트에 **단언을 추가**했다.
