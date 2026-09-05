# RESOLUTION — `review/code/2026/09/05/23_30_00`

**원 리뷰 결과**: Critical 0 · WARNING 5 · 위험도 LOW
**처분**: WARNING 3건 코드 수정 · WARNING 2건 후속 등재 · INFO 3건 함께 처리

## WARNING

### W1 (documentation) — 컨트롤러 주석이 이미 반증된 서술을 유지

`schedules.controller.ts` 의 인라인 주석이 *"생성·수정 경로에서는 로드되지 않는다"* 를
그대로 두고 있었다. 같은 PR 이 두 DTO 파일에서 정확히 이 문장을 고쳤는데 **세 번째 자매**를
빠뜨린 것이다 (이 브랜치에서 같은 형태의 "자매 누락" 이 반복됐다).

**수정**: 생성 응답에만 없고 조회·수정은 `findById` 를 타므로 채워진다는 실제 동작으로 정정.

```
// 반면 `trigger.workflow` 는 **키 생략형**이다 — **생성 응답에만** 없다
// (방금 저장한 트리거라 관계 미로드). 조회·수정은 `findById` 를 타므로 채워진다.
```

### W2 (maintainability) — 중복 strip 루프

`sanitizeForResponse` 안에 "키 집합에 있으면 건너뛰고 나머지를 복사" 하는 루프가 셋 있었다.
종전 라운드에서 *"후처리가 달라 접을 수 없다"* 고 유예했는데, 리뷰어가 **그 근거가 두 축에는
해당하지 않음**을 짚었다 — `interaction` 과 `notification.signing` 은 후처리가 없다.

**수정**: 모듈 레벨 `omitKeys(source, strip)` 헬퍼 추출. 세 축 모두 이 헬퍼를 쓰고,
`chatChannel` 만 호출부에서 `hasBotToken` 한 줄을 얹는다 (갈리는 지점을 주석으로 표시).

### W3 (side-effect) — 스케줄 응답 축소의 외부 소비자

리뷰어가 조치 불요로 두되 *"공개 API 문서·SDK 가 있다면 공지 여부를 확인할 가치"* 를 남겼다.

**실측 후 CHANGELOG 에 기록**:

- `/api/schedules` 를 호출하는 자리를 저장소 전수로 훑으면 프런트엔드
  `lib/api/schedules.ts` 의 `RawSchedule` **하나**뿐이고, 그 타입이 선언한 `trigger` 하위
  필드는 정확히 이번에 남긴 넷(`id`·`name`·`workflowId`·`workflow.name`)이다.
- 배포되는 `@workflow/sdk` 는 스케줄 API 를 다루지 않는다 — `packages/sdk/src` 에
  `schedule` 문자열 **0건** (webhook 트리거 호출 전용).

즉 이 축소를 맞는 소비자가 없다. 확인 결과를 CHANGELOG 본문에 blockquote 로 남겨,
다음 사람이 같은 질문을 다시 조사하지 않게 했다.

### W4 (security) — deny-list 4벌이 구조적으로 네 번째 재발을 허용

**후속 등재** (`plan/in-progress/spec-draft-nullable-notation-followups.md`).

이번 브랜치에서 고칠 수 없는 이유가 아니라, **고치면 안 되는 이유**가 있다: 제안된
`@Sensitive()` 데코레이터는 **엔티티 컬럼 축 하나만** 덮는다. 네 축 중 셋은 JSONB **안의
키**라 필드 데코레이터가 걸릴 자리가 없다. "데코레이터로 옮기면 다 해결" 이라는 서술을 그대로
집행하면 세 축이 열린 채로 "해결됨" 표시가 붙는다 — 등재 항목에 그 반증을 함께 적었다.

### W5 (security) — 열린 JSONB 맵은 두 검증자 모두의 사각지대

**후속 등재** (같은 파일). 규약 문서(`secret-store.md` §1.1 인접 또는 §5.4 "검증 층")에
*"열린 맵 안의 비밀은 부재를 단언하는 e2e 를 반드시 동반한다"* 를 한 문장으로 못 박는 항목.
W4 와 **같은 병의 다른 얼굴**이므로 한 턴에 같이 열도록 상호 참조를 걸었다.

## INFO (함께 처리)

| # | 항목 | 처분 |
|---|---|---|
| testing #1 | `saved.trigger` 보존이 e2e 로만 커버됨 | **unit 2건 추가** — 아래 |
| documentation #2 | `findOptionalNullableResponseFields` 무주석 | JSDoc 추가. 초안이 *"`field?: T \| null` 과의 결합"* 이라고 적었는데 구현은 **데코레이터만** 본다 — 쓰기 전에 본문을 읽어 정정했다 |
| maintainability #2 | 4축이 한 메서드에 뒤섞임 | `omitKeys` 추출로 축별 한 덩어리가 됐다. 전면 분해는 하지 않음 (INFO, 범위 밖) |

### `saved.trigger` 보존 unit 2건 — 뮤테이션 실측

같은 버그가 `create()` → `update()` 순으로 **두 번** 났으므로 e2e C-3 에 더해 unit 으로도
두 자매를 각각 물었다.

`update()` 쪽은 mock 을 그냥 두면 **vacuous** 하다 — `scheduleRepo.save` 가 인자를 그대로
돌려주면 `schedule.trigger` 가 이미 붙어 있어 대입 한 줄을 지워도 통과한다. 그래서 저장
결과에서 관계를 떨어뜨린 사본을 돌려주도록 mock 을 짰다.

| 뮤턴트 | 예측 | 실측 |
|---|---|---|
| M1 — `create()` 의 `saved.trigger = savedTrigger;` 삭제 | 생성 RED / 수정 GREEN | **생성만 RED** (`생성 — isActive:false 여도 응답에 trigger 가 실린다`) |
| M2 — `update()` 의 `saved.trigger = trigger ?? schedule.trigger;` 삭제 | 수정 RED / 생성 GREEN | **수정만 RED** (`수정 — isActive:false 로 비활성화해도 응답에 trigger 가 실린다`) |

원복은 `cp` + 절대 경로로 했고, 원복 후 `git diff --stat` 이 비었음을 확인했다.

## 검증

| 단계 | 결과 |
|---|---|
| lint | PASS (52s) |
| unit | PASS — backend 447 suites / 9,422 passed |
| build | PASS (129s) |
| e2e | PASS — 297 |
