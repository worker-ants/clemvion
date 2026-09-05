# RESOLUTION — `review/code/2026/09/05/22_48_39`

전체 위험도 **MEDIUM** · Critical **0** · WARNING **6** · INFO **13**. **전건 조치 완료.**

## W1·W2 — 열린 map 은 두 검증자 모두의 사각지대다

| # | 지적 | 조치 |
|---|---|---|
| 1 | `TriggerDto.config` 가 `additionalProperties: true` 인 열린 map 이라 계약 대조가 안으로 못 내려간다 — 새로 넓힌 두 스트립 축이 **wire 레벨 방어 전무**, mock unit 하나가 유일 | **e2e 신설** (도달 가능한 축) |
| 2 | `GET /api/triggers/:id` 만 계약 대조에서 빠졌다 — 직전 라운드가 3경로를 지목했는데 후속 커밋이 "목록·PATCH" 로 좁히며 단건이 등재 없이 누락 | **같은 e2e 에서 함께** |

지적이 맞다. **응답-계약 검증자의 구조적 한계**다 — 열린 map 안은 스키마가 없으니 검증할
대상이 없다. 그래서 `chatChannel` 축이 이미 쓰던 수기 `not.toHaveProperty` 패턴을 가져왔다.

### vacuous 를 두 겹으로 막았다

이 테스트는 "무엇이 **없다**" 를 단언하므로 vacuity 위험이 크다. 둘로 막았다:

1. **토큰을 실제로 발급시킨다** — `POST /interaction/revoke-token` 을 부르고 응답에
   평문이 실렸는지 확인한다. 발급 없이 부재를 단언하면 아무 의미가 없다.
   실제로 이 단언이 **필드명 오류를 잡았다**(`triggerToken` 이 아니라 `token`).
2. **같은 블록의 비-비밀 필드를 양성으로 단언한다** — `tokenStrategy === 'per_trigger'`.
   `interaction` 이 통째로 없으면 이쪽이 먼저 깨지므로, 부재 단언이 공허해질 수 없다.

### 도달 못 하는 축은 그 사실을 적었다

`notification.signing.secret` 은 **공개 API 로 만들 수 없다** — `NotificationSigningDto` 에
선언된 필드가 아니라 `forbidNonWhitelisted` 가 400 을 낸다(레거시 config 마이그레이션 경로
전용). 400 을 받고서야 알았다. e2e 에서 그 축을 빼고, **unit 이 fixture 로 덮고 뮤턴트로
RED 를 확인해 뒀다**는 사실을 테스트 주석에 적었다.

## W3 — 내 JSDoc 이 `update()` 에 대해 틀렸다

*"생성·수정 응답에는 `workflow` 가 로드되지 않는다"* 고 적었는데, `update()` 는
`findById`(= `relations: ['trigger','trigger.workflow']`)로 시작한다. **생성만 맞고 수정은
틀렸다.** 두 DTO 의 주석을 실제 동작으로 고쳤다.

## W4 — 같은 실수 5번째, 이번엔 절차를 바꿨다

`TRIGGER_RESPONSE_STRIP_COLUMNS` JSDoc 이 `INTERACTION_RESPONSE_STRIP_KEYS` 삽입으로 또
분리됐다. 리뷰어의 지적이 정확하다 — *"다짐만으로는 3라운드 연속 재발 방지 실패"*.

**다짐 대신 배치 규칙으로 바꿨다**: 신규 상수를 상수 블록 **중간이 아니라 끝**에 추가한다.
지금 네 상수 모두 JSDoc 이 대상 바로 위에 있다(실측 확인). 중간 삽입이 없으면 이 실패
모드 자체가 성립하지 않는다.

## W5 — 내 plan 서술이 두 축을 합산했다

*"23필드 선언이 §5.4 금지 조합"* 이라 적었는데, 실제로는 **17개가 금지 조합**이고 **6개는
별개 축의 과소 선언**(상시 존재 + non-null 인데 `Optional`)이다. 같은 세션의 두 리뷰가 이미
갈라 놓은 것을 내가 합쳤다. 정정했다.

## W6 · INFO

W6(`formatVersion`)은 추적 중인 기존 갭이다. INFO 13건은 전부 이미 등재 / 이월 / 확인
기록이며, 특히 INFO#5 는 *"같은 diff 안에서 도입 후 스스로 수정"* 을 확인한 기록이다.

INFO#6(3축 strip 루프 중복)은 **하지 않는다** — 축마다 후처리가 다르다(`hasBotToken` 주입).
네 번째 축이 생기면 그때 헬퍼가 값을 한다.

## TEST 결과

| 단계 | 결과 |
|---|---|
| lint | **PASS** (`23:16:45`) |
| unit | **PASS** (`23:25:26`) |
| build | **PASS** (`23:26:46`) |
| e2e | **PASS** — **297** 통과 (`23:21:32`) |

## 보류·후속 항목

이 라운드가 새로 만든 후속은 없다.
