# RESOLUTION — `19_36_17` (`/ai-review`, forced 7/7)

RISK=LOW · **CRITICAL 0** · WARNING 2 → **둘 다 반영**. INFO 2·3 도 반영, 나머지는 사유 기록.

## W1·W2 — **둘 다 내 리팩터가 JSDoc 을 대상에서 떼어 놓았다**

리뷰어가 짚은 아이러니가 정확하다 — 이 PR 의 항목 ②·③ 이 *"주석이 가리키는 대상과 실제가
어긋난다"* 를 고치는 것이었는데, **그 과정에서 같은 결함을 두 개 만들었다.**

### W1 — JSDoc 3개가 겹쳐 쌓이고 `schemaOf` 는 설명을 잃었다

`schemasOf` 를 나중에 끼워 넣으면서 두 단계로 편집했고, 그 결과 `schemasOf` 선언 위에
블록이 셋 쌓였다 — 그중 가운데는 `schemaOf`(단수) 설명이다. 정작 `schemaOf` 선언 위는
비었다. **네 reviewer 가 독립적으로 지목**했다(2 WARNING + 2 INFO).

중복 2개를 지우고 `schemaOf` 설명을 제자리로 돌렸다.

### W2 — `it(` 경계에서 잘라 그 앞의 JSDoc 을 두고 왔다

describe 분리에서 여덟 테스트를 옮겼는데, **첫 캐너리의 JSDoc 이 잘라낸 범위 바로 위**에
있었다. 그래서 그 설명(`_retryState` 를 고른 이유 · `#1205` 배경)이 남아, 지금은 뒤이어
붙은 `llmCalls 없는 이벤트는 그대로 fanout` 을 설명하는 것처럼 보였다.

**원인이 구체적이다**: 나는 `it(` 줄을 경계로 삼았는데, 실제 단위는 **doc-comment 를 포함한
블록**이다. 옮긴 여덟 중 나머지 일곱은 JSDoc 이 잘라낸 범위 *안*에 있어 함께 갔고, 첫 번째만
경계 밖이었다.

JSDoc 을 실제 대상(첫 캐너리) 위로 옮겼다.

### 같은 클래스를 전수로 훑었다

두 축으로 스크립트를 돌렸다 — (A) JSDoc 블록이 연속으로 쌓인 자리, (B) 이 PR 이 건드린
15개 `.ts` 에서 JSDoc 직후 선언 전수 나열(육안 대조).

**축 A 적출 2건은 둘 다 오탐**이었다: `swagger-probe.ts:29` 는 파일 헤더 뒤 첫 멤버,
`websocket.service.ts:260` 은 인접한 두 프로퍼티 주석이고 **내 diff 4줄 밖**이다.
축 B 목록도 대조해 W1·W2 외 추가 고아는 없음을 확인했다.

## INFO 2 — 내가 쓴 수치가 실측과 달랐다

`buildSwaggerDocument` JSDoc 에 *"넷 중 둘은 `controllers`, 둘은 `imports`"* 라 적었는데
실측은 **3:1** 이다(`re-run.dto.spec.ts` 만 `imports`). 정정했다.

작은 오차지만 **이 헬퍼가 metadata 를 그대로 받는 이유를 설명하는 문장**이라, 틀린 비율은
다음 사람이 "왜 이렇게 일반화했지" 를 오해하게 만든다.

## INFO 3 — 이동한 경로가 plan 미완료 항목에 남았다

`spec-sync-…md` 의 collapsed 항목이 구 경로(`shared/utils/node-output-allowlist.ts`)를
안내하고 있었다. `nodes/core/…` 로 정정. (실행 영향은 없다 — 착수하면 import 에러로 바로
드러난다. 그래도 착수자가 헛걸음할 이유가 없다.)

## 넘김 (사유)

- **INFO 1** `buildSwaggerDocument` 의 `finally { app.close() }` 회귀 테스트 —
  그 JSDoc 은 *"이 보장을 테스트한다"* 가 아니라 **왜 `finally` 인지**를 설명한다.
  과대 주장이 아니므로 지금 닫아야 할 갭이 아니다. 테스트하려면 `SwaggerModule` 을
  spy 로 던지게 하고 `NestApplication.prototype.close` 를 감시해야 하는데, **Nest 내부에
  결합**되어 프레임워크 업그레이드 때 깨진다. 그 비용이 이 방어의 값보다 크다.
- **INFO 4** 5개 항목 번들 — plan 에 사전 등재된 관례(*"이 파일을 다른 이유로 여는 순간
  함께 처리"*)이고 리뷰어도 조치 불요로 판정. 각 항목이 실측과 함께 트래커에서 종결됐다.
- **INFO 5** `node-output-allowlist.ts` 의 조건부 타입 관용구 — 이 PR 이 만든 것이 아니라
  **옮겨 온 코드**다. 주석이 의도를 이미 설명하고, 이동 PR 에서 내용을 손대면 diff 가
  "순수 이동" 이 아니게 된다.

## e2e 재실행 (코드 무관)

첫 e2e 가 `initdb: could not create directory … No space left on device` 로 죽었다.
`docker builder prune -af` + `image prune -f` 로 **13.16GB** 회수 후 재실행 285 PASS.
**볼륨은 건드리지 않았다.**

TEST WORKFLOW 4단계 PASS — backend **9,027 passed** / 434 suites · e2e 285 · ratchet 199/38.
