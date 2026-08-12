# 보안(Security) Review — 델타 17221ecb9

`wip(backend): lint warning 46→21 — 세 파일의 any 경계에 타입을 붙인다`

## 조사 방법

`git show 17221ecb9`로 실제 diff 전수를 확인하고, `SetupResult`/`adapter.setupChannel` 신뢰 경계를 추적하기 위해 `codebase/backend/src/modules/chat-channel/types.ts`, `providers/telegram/telegram.adapter.ts`, `providers/slack/slack.adapter.ts`를 직접 열어 대조했다. `execution-engine.service.ts`의 admission-control 사용부(`rows.length === 1`)도 실제 소스에서 확인했다.

## 발견사항

- **[INFO]** admission-control 경계에 런타임 shape 검증이 없다 (타입 애너테이션은 단언이지 검증이 아님)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2911`, `:2922`
  - 상세: `m.query<{ id: string }[]>(...)`는 `EntityManager.query()`가 실제로 그 shape을 반환한다는 컴파일 타임 **단언**일 뿐, TypeORM은 런타임에 이를 검증하지 않는다. `rows.length === 1` (2922행)이 동시 실행 상한(admission control) 판정의 유일한 근거이므로, 만약 드라이버/쿼리 변경으로 반환 shape이 어긋나면(예: 배열이 아닌 `{rows:[...]}` 래핑 객체로 바뀌는 등) 이 비교가 조용히 틀릴 수 있다는 우려는 원칙적으로 타당하다.
  - 다만 이번 커밋이 **새로 만든 위험은 아니다**: 수정 전 코드도 `const rows = await m.query(...)` (암묵적 `any`)였고 곧바로 `.length`에 접근했다 — 즉 "shape을 검증 없이 신뢰"하는 동작 자체는 이 커밋 이전부터 100% 동일했다. 이 커밋은 그 암묵적 가정을 명시적 제네릭으로 문서화했을 뿐 런타임 코드는 한 글자도 바뀌지 않았다(주석 2줄 추가 + 제네릭 인자 추가가 diff의 전부).
  - 또한 실패 모드가 비대칭적으로 안전한 방향이다: shape이 어긋나 `rows.length`가 `undefined`가 되면 `undefined === 1`은 `false`이므로 `admitted=false`가 되어 **cap 우회(fail-open)가 아니라 admission 거부(fail-closed, 재큐)** 로 귀결된다. 즉 "판정이 조용히 틀려 동시성 상한이 무너진다"는 시나리오는 이 비교 연산자의 구조상 가능성이 낮다.
  - 제안: 위 판단은 정성적 추론이므로, 방어 심층화 차원에서 `Array.isArray(rows)` 같은 최소 런타임 가드를 추가해 shape 불일치 시 명시적으로 throw(트랜잭션 롤백)하도록 하면 "조용한 오동작"의 여지를 원천 차단할 수 있다. 이번 커밋의 필수 수정 사항은 아니며, admission-control이라는 자리의 중요도를 감안한 하드닝 제안으로 남긴다.

- **[INFO]** `SetupResult`는 어댑터가 직접 구성하는 리터럴 객체이며, `issuedInboundSigning`은 자체 생성값 — "외부 응답을 검증 없이 신뢰"하는 사례로 보기 어려움
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1077` (`let result: SetupResult;`), `:1091`, `:1095` (`result.issuedInboundSigning`을 secret rotate 인자로 사용)
  - 상세: 우려한 대로 "`adapter.setupChannel`이 외부 채널 응답을 그대로 흘리는가"를 세 어댑터(Slack/Telegram/Discord) 구현에서 직접 확인했다. 세 곳 모두 외부 응답(`this.client.authTest(...)`, `this.client.getMe(...)` 등)의 필드를 `return { registeredAt, identity: {...}, configUpdates: {...} }` 형태로 **명시적으로 하나씩 매핑**해 리터럴 객체를 새로 구성한다 — 외부 JSON을 `as SetupResult`로 통째로 캐스팅해 통과시키는 패턴이 아니다.
  - 특히 `result.issuedInboundSigning`(secret rotate 인자로 쓰이는 필드)은 Telegram 어댑터에서만 채워지며, 그 값은 외부 응답이 아니라 어댑터 자신이 `randomBytes(24).toString('base64url')`로 **생성**한 값이다 (`providers/telegram/telegram.adapter.ts:73`). Slack/Discord는 provider-issued signing secret이라 이 필드를 항상 비워둔다는 것이 코드 주석(`triggers.service.ts` 부근, `slack.adapter.ts:33`)에도 명시돼 있다. 즉 "값이 예상과 다르면 secret rotate가 오염된다"는 우려의 핵심 입력값이 실제로는 외부에서 온 것이 아니라 우리 서버가 자체 생성한 랜덤 바이트다.
  - `let result: SetupResult;`는 `ChatChannelAdapter.setupChannel(): Promise<SetupResult>` 인터페이스가 이미 컴파일 타임에 보장하던 반환 타입을 로컬 변수에 명시한 것뿐이라, 이 diff 자체가 새로운 신뢰 경계를 만들지는 않는다 (수정 전 `let result;`는 무주석 선언이 `any`로 추론되어 이후 사용부에서 `no-unsafe-*`가 발동한 것이고, 실제 반환값의 타입은 이미 인터페이스로 고정돼 있었다).
  - 참고(이번 diff 범위 밖, 조치 불필요): `SlackClient`/`TelegramClient` 등 HTTP 클라이언트 내부에서 `fetch` 응답을 제네릭으로 캐스팅하는 지점(`call<T>()`)은 런타임 미검증이 맞다. 하지만 이는 이번 커밋이 건드리지 않은 기존 인프라이고, 그 위에서 각 adapter가 실제 사용하는 필드(`ok`, `user_id`/`bot_id` 등)만 골라 좁게 소비하므로 이번 판정과는 별개 사안이다.

- **[NONE]** `Object.getPrototypeOf(trigger) as object` — 무해한 기계적 단언
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:546` (`sanitizeChatChannelForResponse` 내부)
  - 상세: `trigger: T extends Trigger`는 항상 non-null 엔티티 인스턴스이므로 `Object.getPrototypeOf(trigger)`가 실제로 `null`을 반환할 일이 없고(클래스 인스턴스의 prototype 체인을 수동으로 끊지 않는 한), 설령 `null`이 나오더라도 `Object.create(null)`은 유효한 호출이라 예외를 던지지 않는다. `lib.es5.d.ts`상 `Object.getPrototypeOf`의 반환 타입이 `any`라서 발생한 `no-unsafe-argument`를 없애기 위한 캐스팅일 뿐, secret-sanitize 로직(`CHAT_CHANNEL_RESPONSE_STRIP_KEYS` allow-list 순회, `hasBotToken` derived 필드) 자체는 이 커밋에서 전혀 건드리지 않았다.

- **[NONE]** 기존 방어 제거 여부 — 확인 결과 없음
  - `git show 17221ecb9`로 3개 파일의 diff를 전수 대조했다. 변경은 타입 애너테이션 추가(제네릭 인자, 파라미터 타입, `as object`)와 설명 주석 2줄뿐이며, `typeof` 체크·조건문·early-return 등 어떤 런타임 가드도 삭제되지 않았다. `migrate-node-output-refs.ts`(파일 3, 마이그레이션 스크립트)의 변경도 `String.replace` 콜백 파라미터에 실제 정규식 캡처그룹 semantics(`string | undefined`)와 정확히 일치하는 타입을 붙인 것뿐이며, 기존 `(dbl ?? sgl) as string` 방어 로직은 그대로 유지된다.

## 요약

이 커밋은 `no-unsafe-*` lint 경고를 "검증이 아니라 단언으로" 지운 것 아니냐는 우려에 대해, 세 자리 모두 조사한 결과 **새로운 미검증 신뢰 경계를 만들지 않았다**고 판단한다. (1) execution-engine의 admission-control 판정은 이미 커밋 이전부터 TypeORM 반환 shape을 검증 없이 신뢰하고 있었고 이번 diff는 그 가정을 명시했을 뿐 실행 흐름을 전혀 바꾸지 않았으며, 설령 shape이 어긋나도 실패 방향은 fail-closed(과소 admit)라 상한 우회로 이어지기 어렵다. (2) triggers.service.ts의 `SetupResult`는 각 채널 어댑터가 외부 응답을 필드별로 명시 매핑해 구성하는 리터럴 객체이고, secret rotate에 쓰이는 `issuedInboundSigning`은 외부 입력이 아니라 서버가 자체 생성한 랜덤 값이라 "외부 응답을 그대로 흘려 신뢰"하는 사례가 아니다. (3) `Object.getPrototypeOf(trigger) as object`는 non-null 엔티티에 대한 무해한 기계적 캐스팅이다. `git show`로 diff 전수를 대조한 결과 기존 방어(런타임 가드·조건 검증)가 삭제된 곳도 없었다. 다만 admission-control 자리는 시스템의 핵심 불변식(동시 실행 상한)을 지키는 지점이므로, 향후 하드닝 차원에서 `rows`에 대한 최소 `Array.isArray` 런타임 가드를 추가하는 것을 권장(필수 아님, INFO)한다.

## 위험도

LOW

STATUS: OK
