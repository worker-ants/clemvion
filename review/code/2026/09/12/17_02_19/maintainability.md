# 유지보수성(Maintainability) 리뷰

## 검토 범위

`origin/main`(`c9bc5dca6`) 대비 `HEAD`(`e07521a27`)의 실제 diff 8개 애플리케이션 파일을
직접 `Read` 해 현재 상태 기준으로 리뷰했다(프롬프트 diff 가 파일 2 는 생략, 다른 여러 파일은
과거 리뷰 라운드(`16_17_57`·`16_39_18`)의 산출물이 신규 파일로 잡혀 있어 리뷰 대상에서 제외):

- `chat-channel-input-rules.ts` / `.spec.ts`
- `chat-channel-rejection-messages.const.ts`
- `dto/chat-channel-config.dto.ts`
- `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` (신규)
- `dto/trigger-dto-validation.spec.ts`
- `triggers.controller.ts` / `triggers.service.ts`

이 changeset 은 이미 같은 세션에서 2회 리뷰(`16_17_57`, `16_39_18`)를 거쳐 CRITICAL 1·WARNING
6건이 조치된 상태다. 이번 라운드는 그 조치 이후의 **현재 코드**를 독립적으로 다시 훑었다.

## 발견사항

- **[INFO]** `throwInvalidField(field: string, …)` 의 `field` 매개변수가 넓은 `string` 이라,
  `rejectBlockedField` 를 경유하지 않는 6개 직접 호출부는 `ChatChannelBlockedField` 유니언이
  주는 오타-컴파일에러 보호를 못 받는다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:56`(선언),
    직접 호출부 `:205`(`'chatChannel'`) · `:223`(`'provider'`) · `:270`·`:284`·`:294`·`:301`
    (`'inboundSigningPlaintext'` 리터럴 4회 반복).
  - 상세: `rejectBlockedField` 가 커버하는 5개 차단 필드는 리터럴 유니언으로 오타를 컴파일
    타임에 잡지만, 그 경로를 타지 않는 저수준 헬퍼 자체는 여전히 범용 `string` 이다.
    `'inboundSigningPlaintext'` 문자열이 4곳에서 손으로 반복되므로 오타가 나면 컴파일은
    통과하고 `details.field` 값만 틀린 채 400 이 나간다. 각 호출부에 `details.field` 를
    단언하는 테스트가 붙어 있어 런타임에는 즉시 RED 가 되므로 실질 위험은 낮다. 두 차례
    앞선 리뷰(`16_17_57`·`16_39_18` maintainability.md)가 이미 같은 지적을 남기고 "재발
    시 고려" 로 보류한 항목이라, 이번 라운드에서 새로 생긴 결함은 아니다.
  - 제안: 조치 불요(이미 유예된 트레이드오프). 호출부가 더 늘거나 실제 오타 사고가 나면
    `field: ChatChannelBlockedField | 'chatChannel' | 'provider'` 로 좁히는 것을 고려.

- **[INFO]** `null`/`빈 문자열` 두 값을 검증하는 `it.each` 블록이 `botToken` 용과
  `inboundSigningPlaintext` 용으로 거의 동일한 형태로 두 번 반복된다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts:94-106`
    (`botToken`) 와 `:108-125`(`inboundSigningPlaintext`) — 두 블록 모두 동일한 리터럴
    배열 `[['null', null], ['빈 문자열', '']]` 을 반복해 선언한다.
  - 상세: 두 블록은 대상 필드명과 기대 `details.field` 값만 다르고 구조(2-케이스 배열,
    `assertPatchCarriesNoSecrets` 호출, `toMatchObject` 단언)가 동일하다. 필드 배열
    `['botToken', 'inboundSigningPlaintext']` 을 바깥 루프로 두고 안쪽에서 `null`/`''` 를
    도는 이중 `it.each` (또는 `describe.each`)로 합치면 반복이 사라진다. 다만 각 블록이
    이 자리로 태어난 근거(`hasField` truthy-판별 뮤턴트가 조치 전 GREEN 이었다는 JSDoc)를
    한 블록 위에만 적어 뒀는데, 합치면 그 서사가 두 필드 모두를 가리킨다는 것도 함께
    명확히 해야 한다.
  - 제안: 급하지 않음 — 현재도 각자 무엇을 검증하는지 이름이 명확해 가독성 손실은 크지
    않다. 세 번째 필드가 생기는 시점에는 통합을 권장.

- **[INFO]** `rotateBotToken` 컨트롤러 메서드의 반환 타입 선택 근거 주석이 파라미터 목록
  안, 마지막 파라미터와 닫는 괄호 사이에 끼어 있어 시그니처를 눈으로 훑을 때 흐름이 끊긴다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:285-293`
    (`@CurrentUser('sub') userId: string,` 다음 줄부터 `): Promise<ChatChannelRotateBotTokenDto> {`
    사이에 3줄 주석).
  - 상세: 주석 내용 자체(`Awaited<ReturnType<...>>` 대신 DTO 를 명시해 `tsc` 가 드리프트를
    잡게 한다는 설명)는 유효하고 근거가 있다. 다만 위치가 파라미터 나열 도중이라, 처음
    읽는 사람은 마지막 파라미터(`userId`)와 반환 타입 사이에 다섯 번째 파라미터가 있는지
    순간 헷갈릴 수 있다. 메서드 데코레이터 블록 바로 위나 반환 타입 줄 앞(`  ):` 다음
    줄)에 두면 파라미터 목록의 시각적 연속성이 유지된다.
  - 제안: 급하지 않음(순수 스타일). 다음에 이 메서드를 만질 때 주석을 데코레이터 블록
    설명에 합치거나 반환 타입 줄 위로 옮기는 정도로 충분.

## 확인했으나 문제 없음

- `throwInvalidField`/`hasField`/`rejectBlockedField` 3개 헬퍼 추출 — 11곳의 거의 동일한
  `BadRequestException` 생성과 2곳의 `as unknown as Record<string, unknown>` 캐스팅 중복을
  실질적으로 제거했다. 각 헬퍼가 단일 책임을 가지며, JSDoc 이 "왜 세 번째 인자를 안 두는가"·
  "왜 `never` 인가"·"왜 필드명을 한 번만 쓰게 했는가" 를 실측 근거(11곳, 2곳)와 함께 남겨
  다음 사람이 트레이드오프를 재구성할 필요가 없다.
- 함수 길이·중첩 깊이 — 모든 함수가 최대 2단 중첩 이내이고, 가장 긴 함수(`assertInboundSigningPlaintextByProvider`)도 45줄 내외로 단일 관심사(provider 분기) 안에 머문다.
- 매직 넘버 — hex32/hex64 길이는 정규식(`@workflow/chat-channel-validation`)에 위임돼 이
  파일에 하드코딩된 숫자가 없다. 트래커가 지적했던 절단 길이 `256` 매직 넘버는 `#1324` 가
  `details.reason` 자체를 없애며 이미 소멸했음을 plan 문서가 실측(`grep "256"` 0건)으로
  확인했다.
- 네이밍 — `assertXxx`(불변식 검증) / `rejectXxx`(개별 필드 차단) / `throwXxx`(에러 봉투 생성)
  / `hasField`(존재 판정) 로 동사 접두사가 역할과 일관되게 대응한다.
- `chat-channel-rejection-messages.const.ts`, `dto/chat-channel-config.dto.ts` 의 stale
  `TriggersService` 귀속 주석 3곳 — `#1319` 이후 실제 구조(module-level 함수)에 맞게 정확히
  갱신됐다.
- `dto/responses/chat-channel-rotate-bot-token-response.dto.ts`(신규) — 클래스명이 기존
  `ChatChannelBotIdentityDto` 와의 이전 라운드 이름 충돌(CRITICAL)을 해소한 상태로
  `ChatChannelRotateBotIdentityDto`/`ChatChannelRotateBotTokenDto` 로 명확히 구분되고,
  `swagger.md §5-1` 자리 규약(`dto/responses/*-response.dto.ts`)도 준수한다.
- `chat-channel-input-rules.spec.ts` 의 신규/이동 테스트 블록 — 각 `it.each` 마다 "왜 이
  케이스가 필요한가"(어떤 뮤턴트가 이전엔 살아남았는지)를 JSDoc 으로 남겨 회귀 시 맥락을
  잃지 않게 했다. `it('PATCH 는 inboundSigningPlaintext 도 거부한다', …)` 앞 JSDoc 이 한때
  다른 테스트 위로 잘못 옮겨졌던 것(orphan JSDoc)도 `e07521a27` 에서 제자리로 되돌아왔다.

## 요약

이번 세 번째 리뷰 라운드 시점의 코드는 두 차례 앞선 라운드가 지적한 CRITICAL(스키마 이름
충돌)·WARNING(응답 계약이 실제보다 좁음·401 문서 누락·설계 근거 미고정)이 모두 조치된
상태다. 독립적으로 다시 훑은 결과 새로운 CRITICAL/WARNING 급 유지보수성 결함은 찾지
못했다. `chat-channel-input-rules.ts` 의 헬퍼 추출은 반복 코드를 실질적으로 줄였고 각
설계 판단에 실측 근거를 남겨 모범적이다. 남은 관찰 사항은 전부 INFO 수준이며, 그중
하나(`field: string` 타이핑 범위)는 이미 두 차례 보류된 항목이고, 나머지 둘(테스트
`it.each` 중복·주석 위치)은 이번 라운드에서 새로 관찰한 저위험 스타일 사안으로 즉각
조치를 요하지 않는다.

## 위험도

LOW
