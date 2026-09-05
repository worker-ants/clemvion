# 테스트(Testing) 리뷰

이 PR 은 이미 5라운드의 코드 리뷰(`18_23_02`·`19_08_18`·`20_45_37`·`21_40_37`·`22_24_58`)와
다수의 consistency 리뷰를 거쳤다. 그 라운드들이 지적한 테스트 갭(래칫 vacuity, `contractForDto`
메모이제이션 미검증, `allowMissing` 미검증, `findOneDetail`/`findAll` secret fixture 부재,
목록·PATCH 트리거 계약 미배선, PATCH 생략-필드 undefined 덮어쓰기 unit 회귀 부재 등)은 실제로
이번 코드에 반영되어 있음을 `Read`/`git diff`/`grep` 으로 직접 확인했다 — 특히
`triggers.service.spec.ts` 의 신규 3건(`PATCH 에서 생략된 필드는 로드된 값을 유지한다` ·
`응답에서 회전 secret 컬럼과 notification.signing 비밀이 제거된다` · `목록 응답에서도 회전
secret 컬럼과 workflow 가 좁혀진다`)과 `swagger-dto-contract.spec.ts` 의 §5.4 래칫(전수 78건
+ 양성/음성 대조군 4건)은 이전 라운드가 낸 vacuity 지적을 실제로 닫았다. 아래는 그 위에서
새로 발견한 갭이다.

## 발견사항

- **[WARNING]** `GET /api/triggers/:id`(단건 조회, `findOneDetail`)가 **HTTP/e2e 레벨로는
  한 번도 검증되지 않는다** — 이 PR 이 방금 넓힌 세 축(엔티티 컬럼 스트립·`config.notification
  .signing` 스트립·`workflow` 참조 좁힘)이 실제로 만나는 지점인데, 이 라운드도 이전 라운드
  (`21_40_37`)가 지목한 세 경로(목록·단건·PATCH) 중 **단건만 남겨 두고** 목록·PATCH 만 배선했다.
  - 위치: 컨트롤러 라우트는 `codebase/backend/src/modules/triggers/triggers.controller.ts:67-82`
    (`@Get(':id') findOne` → `this.triggersService.findOneDetail(...)`). 테스트 부재 확인:
    `grep -rn "\.get(\`/api/triggers/" codebase/backend/test/*.e2e-spec.ts` → 0건,
    `grep -rn "contractForDto(TriggerDto)" codebase/backend/test/*.e2e-spec.ts` → 3건
    전부 목록(`schedule-trigger.e2e-spec.ts:262`)·PATCH(`:365`)·생성(`chat-channel-trigger-create
    .e2e-spec.ts:110`)이고 단건 GET 은 없다.
  - 상세: `review/code/2026/09/05/21_40_37/testing.md` 는 *"`GET /api/triggers`(목록)와
    `GET /api/triggers/:id`(단건), `PATCH /api/triggers/:id` 는 실제 wire 응답이 `TriggerDto`
    선언과 일치하는지 한 번도 HTTP 레벨로 검증되지 않는다"* 고 세 경로를 함께 지목했다.
    그 뒤 커밋 `7e85da873`("계약 대조를 **목록·PATCH** 로 넓히자 drift 2건이 나왔다")이
    두 경로만 고쳤고, 커밋 메시지 자체가 "목록·PATCH" 라고 범위를 명시해 단건은 의도적으로
    남았다 — 그런데 그 사실이 CHANGELOG·plan 트래커·후속 항목 어디에도 등재돼 있지 않다.
    `sanitizeForResponse` 는 공유 private 메서드라 `findOneDetail` unit(`triggers.service.spec
    .ts` 의 두 신규 `it()`)이 스트립 로직 자체는 잠갔지만, 그것은 서비스 계층 mock 호출이라
    (1) 컨트롤러 라우팅, (2) Nest 직렬화/인터셉터 경계, (3) `TriggerDto` 선언과 실제 wire
    형태의 일치를 전혀 보지 않는다 — 정확히 이 PR 의 존재 이유(§5.4: "wire 레벨로 대조")가
    이 한 엔드포인트에서만 비어 있다. 목록·PATCH·생성이 전부 `assertMatchesContract` 로
    막힌 지금, 단건 GET 이 유일하게 뚫린 자리다.
  - 제안: `schedule-trigger.e2e-spec.ts` C-2 근처나 `chat-channel-trigger-create.e2e-spec.ts`
    에 `GET /api/triggers/:id` 호출 + `assertMatchesContract(res.body.data,
    await contractForDto(TriggerDto))` 1건을 추가한다. `workflow` 관계가 로드되는 조회
    경로이므로, 목록 경로처럼 `workflow` 참조가 2필드로 좁혀지는지도 함께 고정하면
    `sanitizeForResponse` 의 마지막 사각 경로가 닫힌다.

- **[WARNING]** `assertMatchesContract` 는 `TriggerDto.config`(선언: `type: 'object',
  additionalProperties: true`, `$ref` 없음)의 **내부를 구조적으로 보지 않는다** — 그래서
  이번에 새로 추가된 `config.notification.signing` 스트립(`secret`/`secretRef`)과
  `config.interaction` 스트립(`triggerToken`)은 **e2e/wire 레벨 회귀 방어가 전혀 없다**.
  mock 기반 unit 테스트 1건이 유일한 방어선이다.
  - 위치: 선언 `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:53-55`
    (`@ApiProperty({ type: 'object', additionalProperties: true }) config: Record<string,
    unknown>;`). 대조 메커니즘: `codebase/backend/src/shared/testing/response-contract.ts`
    의 `referencedNames()`(`:142-154`, `$ref`/`allOf`/`oneOf`/`anyOf` 없으면 `[]` 반환)와
    `descend()`(`:191-228`, `:210` `if (names.length === 0) return;` — 여기서 조기 return).
    스트립 상수: `codebase/backend/src/modules/triggers/triggers.service.ts:74`
    (`NOTIFICATION_SIGNING_STRIP_KEYS`), `:109`(`INTERACTION_RESPONSE_STRIP_KEYS`). e2e 부재
    확인: `grep -rln "per_trigger\|triggerToken" codebase/backend/test/*.e2e-spec.ts` → 0건,
    `notification.signing` 을 검사하는 e2e 도 0건.
  - 상세: `config` 는 `$ref` 를 쓰지 않는 열린 map 타입이라, `referencedNames(prop)` 이 빈
    배열을 반환하고 `descend()` 가 재귀 없이 바로 return 한다 — 즉 `config` 아래 어떤 키가
    있든 `assertMatchesContract` 는 "선언되지 않은 키"로도, "값 불일치"로도 잡지 못한다
    (코드로 직접 확인). 이 PR 이 같은 이유로 `config.chatChannel` 안의 비밀
    (`botToken`/`botTokenRef` 등)은 계약 대조 대신 **수기 `not.toHaveProperty()` 단언**으로
    `chat-channel-trigger-create.e2e-spec.ts` 에서 별도로 잠가 왔다 — 그 패턴 자체가 "config
    는 계약 대조로 못 잡는다"는 것을 이 저장소가 이미 알고 있다는 증거다. 그런데 이번에
    새로 넓힌 두 축(`notification.signing`, `interaction.triggerToken`)에는 그 수기 패턴이
    **e2e 어디에도 적용되지 않았다**. `triggerToken` 은 `secret-store.md §1.1` 이 이름으로
    금지한 세 필드 중 하나이자 직전 consistency 라운드(`review/consistency/2026/09/05/22_25_00`)
    가 Critical 로 잡았던 바로 그 필드다 — 그 정도 등급의 비밀이, 컨트롤러/인터셉터가
    `sanitizeForResponse` 호출을 실수로 건너뛰는 회귀(이 PR 이미 3차례 겪은 패턴: 조기
    return·목록 경로 누락·서비스만 고치고 컨트롤러 방치)를 일으켜도 실제 HTTP 응답으로는
    **아무 테스트도 잡지 못하는** 상태로 남는다.
  - 제안: `per_trigger` 토큰 전략 트리거를 만드는 e2e(있다면 재사용, 없다면
    `chat-channel-trigger-create.e2e-spec.ts` 옆에 신설)에 `expect(res.body.data.config
    .interaction).not.toHaveProperty('triggerToken')` 류의 수기 단언을 추가하고,
    `notification.signing` 을 구성하는 트리거(webhook 알림 서명)의 e2e 응답에도
    `not.toHaveProperty('secret')`/`not.toHaveProperty('secretRef')` 를 추가한다 —
    `chatChannel` 축이 이미 쓰는 패턴을 나머지 두 축에 맞춘다.

- **[INFO]** `contractForDto(IntegrationDto)` 를 실제로 부르는 e2e 는
  `ai-agent-tool-payload-warning.e2e-spec.ts` 한 곳뿐이고, 거기서 생성하는 통합은
  `service_type: 'http'` → `'makeshop'` 전환이라 `appUrl` 은 항상 `null` 이다 — cafe24
  Private(=non-null `appUrl`) 분기는 계약 대조로 exercise 되지 않는다.
  - 위치: `codebase/backend/test/ai-agent-tool-payload-warning.e2e-spec.ts:79-99`
    (`createConnectedMakeshop`), 선언은
    `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:134-135`
    (`@ApiProperty({ nullable: true, type: String, example: null }) appUrl: string | null;`).
  - 상세: 실질적 위험은 낮다 — `nullable: true, type: String` 스키마는 null 값과 문자열 값
    양쪽을 동일하게 통과시키므로, 설령 cafe24 Private 경로를 e2e 로 추가해도 계약 대조
    자체가 두 분기를 구분해서 잡아 줄 수는 없다(스키마가 애초에 이분법을 요구하지 않는다).
    `appUrl` 의 **값** 정확성(cafe24 Private 일 때 실제로 install URL 이 채워지는지)은
    이미 `integrations.service.spec.ts:275-446` 의 `describe('appUrl', …)` 가 별도로
    충분히 단언하고 있다(이번 diff 밖의 기존 테스트). 계약 대조와 값 대조가 책임을 나눠
    갖는 정상적인 분업이라 조치는 불요하지만, 참고로 남긴다.
  - 제안: 조치 불요.

## 요약

이 PR 은 이미 5라운드의 리뷰·수정을 거치며 vacuous 테스트(fixture 부재로 항상 그린이던 래칫
대조군), memoization/allowMissing 미검증, PATCH 생략-필드 덮어쓰기, findAll/findOneDetail
의 secret-strip mock 부재 같은 실질적 결함을 반복적으로 실측·수정해 왔고, 이번 라운드에서
그 수정들이 실제 코드에 반영돼 있음을 직접 확인했다 — 전반적으로 테스트 품질은 높고, 뮤테이션
근거·판별력 실측을 JSDoc/RESOLUTION 에 남기는 규율도 일관적이다. 다만 두 개의 새 갭이
남아 있다: (1) `GET /api/triggers/:id` 단건 조회가 목록·PATCH·생성과 달리 HTTP/e2e 계약
대조에서 유일하게 빠져 있고, 이는 이전 라운드가 세 경로를 함께 지목했는데 후속 커밋이
"목록·PATCH" 로 범위를 명시적으로 좁히면서 등재 없이 남은 잔여물이다. (2) 이번에 넓힌
`config.notification.signing`·`config.interaction.triggerToken` 스트립은 `config` 필드가
`$ref` 없는 열린 map 이라 `assertMatchesContract` 가 구조적으로 내부를 보지 못하는데(코드로
직접 확인), 이 저장소가 이미 알고 적용해 온 "config 는 수기 `not.toHaveProperty()` 로 잠근다"
패턴(`chatChannel` 축)이 새로 추가된 두 축에는 적용되지 않아 mock 기반 unit 하나가 유일한
방어선이다. `triggerToken` 은 secret-store.md §1.1 이 명시적으로 금지한 필드이자 직전
consistency 라운드가 Critical 로 잡았던 자리라, 이 클래스의 회귀(컨트롤러/서비스가
`sanitizeForResponse` 호출을 건너뛰는 패턴 — 이 PR 안에서 이미 세 번 재발한 형태)를 wire
레벨에서 잡을 수단이 없는 상태로 남기는 것은 이 PR 의 핵심 목적(§5.4: 정적 선언이 아니라
실제 응답을 wire 레벨로 검증)과 정확히 어긋난다.

## 위험도

MEDIUM
