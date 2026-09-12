# 신규 식별자 충돌 검토 — `spec-draft-setup-error-classification.md`

## 발견사항

- **[WARNING]** `code` 프로퍼티가 같은 어댑터 모듈 안에서 이미 두 개의 다른 의미로 쓰이고 있다 — 세 번째 의미(이 draft)가 더해진다
  - target 신규 식별자: `chat-channel-adapter.md` §1.1.2(신설)가 정의하는 **어댑터가 throw 하는 `Error` 객체의 `code` 프로퍼티**(`code: 'BOT_TOKEN_INVALID'`). "구현 위임" 항목 2·3·4가 이 프로퍼티를 `slack.adapter.ts`·`discord.adapter.ts`·`telegram.adapter.ts`(및 `telegram-client.ts`)에 부착하라고 지시한다.
  - 기존 사용처:
    - `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts:69,438` — 같은 파일 안에서 `'code' in app && app.code != null` / `'code' in res && res.code != null` 로 **Discord REST API 원본 응답 객체의 숫자형 `code` 필드**(Discord 자체 API 에러 코드, 예: `50035`)를 이미 검사해 실패 여부를 판정한다. 이 검사는 `setupChannel`/`sendMessage` 같은 함수 안, 즉 draft 가 새 `code` 를 부착하려는 바로 그 함수 스코프에 존재한다.
    - `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-client.ts:95` — `describeFetchError` 가 `(cause as { code?: unknown }).code` 로 **Node.js 시스템 에러 코드**(`ENOTFOUND`·`ECONNREFUSED`·`UND_ERR_SOCKET` 등)를 읽어 로그 문자열에 싣는다.
  - 상세: 세 곳 모두 프로퍼티 이름은 `code` 로 동일하지만 대상 객체·타입·값 도메인이 전부 다르다 — (a) Discord 원본 API 응답의 숫자 코드, (b) Node fetch 에러의 `cause.code` 시스템 문자열, (c) 이 draft 가 새로 정의하는, 우리가 직접 만든 `Error` 인스턴스에 부착하는 애플리케이션 레벨 문자열 열거값(`'BOT_TOKEN_INVALID'`). TypeScript 컴파일 충돌은 없다(서로 다른 객체 인스턴스이므로) 하지만, 구현 위임 항목 3(`discord.adapter.ts` — verify_key 불일치 message 접두를 `code` 로 교체)을 실제로 작업하는 developer 가 몇 줄 위/아래에 이미 있는 `app.code`/`res.code` (Discord 숫자 코드) 검사와 새 `err.code = 'BOT_TOKEN_INVALID'` 부착을 혼동해 숫자 코드를 그대로 실어 보내거나 검사 순서를 잘못 합칠 위험이 있다. §1.1.2 본문(이 draft 의 편집 대상)은 "그 `code` 로만 분류" 라고만 적어 이 구분을 명시하지 않는다.
  - 제안: §1.1.2 신설 문단에 "이 `code` 는 어댑터가 새로 생성해 throw 하는 `Error` 자체의 프로퍼티이며, provider 원본 API 응답에 실려 오는 `code` 필드(Discord 의 숫자 에러 코드 등)와는 다른 객체·다른 값 도메인이다" 를 한 줄 추가하거나, "구현 위임" 항목 3 에 "기존 `app.code`/`res.code` (Discord 숫자 코드) 판정 로직과 혼동하지 말 것" 각주를 남긴다.

## 확인했으나 충돌이 없는 항목 (근거 실측)

아래는 이 draft 가 새로 도입하는 식별자별로 저장소 전체를 grep 해 확인한 결과다 — 전부 **충돌 없음**으로 판정한다.

1. **요구사항 ID** — `R-CC-23`(`15-chat-channel.md`), `R-CCA-9`(`chat-channel-adapter.md`): 두 파일의 기존 `R-CC-`/`R-CCA-` ID 를 전수 grep 한 결과 최댓값이 각각 `R-CC-22`·`R-CCA-8` 이고(draft 의 Rationale 실측 문장과 일치), `R-CC-14`(결번)·`R-CC-23`·`R-CCA-9` 는 어디에도 기존 사용이 없다 — `plan/in-progress/spec-draft-setup-error-classification.md` 자기 자신 외 매치 0건.
2. **섹션 번호** — `chat-channel-adapter.md` §1.1.2: 현재 §1.1 아래에는 §1.1.1(`setupChannel` 멱등의 뜻) 하나뿐이라 §1.1.2 는 빈 번호다. 충돌 없음.
3. **상태 코드 `502`** — `2-api-convention.md §6` 표는 200/201/202/204/400/401/403/404/409/410/413/422/429/500/503 순서로 이미 오름차순이며 502 행이 없다(500 과 503 사이에 삽입 시 순서 유지). 코드 전체에서 `BadGatewayException`·`HttpStatus.BAD_GATEWAY`·`@ApiBadGatewayResponse` 사용 0건(draft 의 "저장소 최초 502" 주장과 일치). `@ApiBadGatewayResponse` 는 설치된 `@nestjs/swagger@11.4.5` 의 실제 내장 데코레이터 이름과 일치해 신조어가 아니다.
4. **에러 코드 재사용** — `BOT_TOKEN_INVALID`/`CHAT_CHANNEL_SETUP_FAILED`: `spec/` 전체에서 이 두 코드는 오직 `15-chat-channel.md §5.4`·`data-flow/14-chat-channel.md`·`2-navigation/2-trigger-list.md`·`providers/discord.md` 네 곳에만 등장하고 전부 같은 chat-channel rotate 실패 의미다(다른 도메인에서 재사용된 흔적 없음). `3-error-handling.md §1.11` 의 `AUTH_CONFIG_NOT_FOUND` 와는 이름·의미 모두 겹치지 않는다(§1.11 자체가 "별 코드다 — 혼동 말 것" 이라 이미 명시). frontend `backend-labels.ts`/i18n dict 의 라벨 매핑은 `code` 문자열 단독 키이고 HTTP status 에 의존하지 않아, `CHAT_CHANNEL_SETUP_FAILED` 의 status 재배선(400→502)이 frontend 표시 로직과 충돌하지 않는다.
5. **`§1.1.2` 의 `code` vs `§3.1` 의 `event.error.code`** — draft 본문이 이미 INFO 2 로 자체 인지하고 "§1.1.2 서두에 그 구분을 적는다" 는 처리 계획을 명시했다. `chat-channel-adapter.md §3.1`(Execution Failed 분류 알고리즘, EIA `event.error.code` 소비)과 이름은 같지만 네임스페이스가 다르며, draft 가 이미 해소 조치를 계획해 두었으므로 별도 CRITICAL/WARNING 으로 재등재하지 않는다.
6. **`providers/slack.md §3.1`** — 실제 헤딩은 `` `setupChannel` 구체 `` 로 draft 의 가정(성공 응답만 있는 절)과 일치한다. 새 섹션 번호를 만드는 것이 아니라 기존 절에 실패 형태 한 줄을 추가하는 편집이라 번호 충돌 없음.
7. **`swagger.md §2-4`** — 실제 헤딩 `상태 코드 응답 규칙` 의 표는 200/201/204/400/401/403/404/409 8행뿐이고 5xx 행이 전혀 없다. 신설 행이 기존 행과 겹치지 않는다.
8. **파일 경로** — 이 draft 는 새 spec 파일을 만들지 않는다(모두 기존 파일의 절 편집). 파일 경로 충돌 없음.
9. **API endpoint / 환경변수 / 이벤트명** — 이 draft 는 새 HTTP endpoint, 새 ENV var, 새 webhook/queue/sse 이벤트명을 도입하지 않는다. 해당 축은 대상 없음(N/A).

## 요약

이 draft 가 새로 부여하는 식별자(`R-CC-23`·`R-CCA-9`·`§1.1.2`·상태 코드 `502`·swagger 5xx 행)는 전수 grep 기준으로 기존 사용처와 충돌하지 않으며, 재사용하는 기존 코드(`BOT_TOKEN_INVALID`·`CHAT_CHANNEL_SETUP_FAILED`)도 다른 도메인과 이름이 겹치지 않는다. 다만 draft 가 "구현 위임"으로 넘기는 어댑터 레벨 작업에서, 새로 도입하는 `err.code` 프로퍼티 이름이 `discord.adapter.ts` 안에 이미 존재하는 **Discord 원본 API 응답의 숫자형 `code` 필드**와 이름이 겹쳐 구현 단계에서 혼동될 여지가 있다 — 이는 spec 문서 자체의 충돌이 아니라 spec 이 지시하는 구현 자리에서 이름이 부딪히는 경우라 WARNING 으로 등재한다. 그 외에는 충돌 위험이 낮다.

## 위험도

LOW
