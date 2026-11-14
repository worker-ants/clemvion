---
id: "CLE-INT-SECRET-EXPOSE"
title: "시크릿 저장소 — 저장소 예외 필드와 응답 노출"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-INT-SECRET"
ancestors: ["CLE-VISION", "CLE-INT", "CLE-INT-SECRET"]
area: "CLE-INT"
content_hash: "56b01f218f21d1ffe5dc5506db1251ca1bd336ff50329ad0edf2308cd83eb58b"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "e9ecaea0025d11a9c2d916e811b36095d4ac9a81f8771b46de3977d36e390aaa"
etag: "sha256-260a80ccc7eef62c368c5a618fa095b9ac59576d9851b60594f005f4a317770e"
---
## 개요

이 문서는 [시크릿 저장소](CLE-INT-SECRET.md) 의 하위 문서로 시크릿 저장소 밖에 두는 저장소 예외 필드와 각 예외의 근거, 그리고 비밀 · 참조의 응답 비노출(규칙 4~6)을 받치는 근거와 테스트를 정한다. 규칙 번호(규칙 N)는 부모 문서 [「규칙」](CLE-INT-SECRET.md#규칙) 의 번호다.

## 저장소 예외 필드

아래 세 필드는 시크릿 저장소 밖에 둔다. 근거가 서로 다르다.

### `AuthConfig.config`

인증 설정([외부 호출 인증 설정](../CLE-TRIG/CLE-TRIG-AUTHCFG.md))의 자격 증명은 통합 자격 증명과 같은 컬럼 transformer(`credentials-transformer.ts`, AES-256-GCM)가 직접 암호화·복호화한다. `secret://` 통합 대상이 아니다. 근거는 «다른 메커니즘으로 암호화된다» 이다. 두 메커니즘의 보호 수준이 같지는 않다. 시크릿 저장소는 AAD 로 암호문을 참조에 묶고(규칙 16) transformer 는 묶지 않는다. 키도 다르다. transformer 는 통합 암호화 키 `INTEGRATION_ENCRYPTION_KEY` 를 쓴다(규칙 26). 키 동작과 암호화가 보장되는 범위는 [통합 데이터와 흐름 「암호화」](CLE-INT-DATA.md#암호화) 가 정한다. 응답 마스킹 정책의 단일 기준은 이 규약이 아니라 [외부 호출 인증 설정 「필드 마스킹과 평문 보기」](../CLE-TRIG/CLE-TRIG-AUTHCFG.md#필드-마스킹과-평문-보기) 다.

### `Trigger.config.interaction.triggerToken` (2026-08-16 결정)

트리거 단위 인터랙션 토큰(`itk_*`)은 `Trigger.config` JSONB 에 평문으로 보관한다. 위 `AuthConfig.config` 와 같은 종류의 예외가 아니다. 이 필드에는 암호화 자체가 없다. 근거는 따로 세운다.

- (a) 요청마다 검증하는 hot-path bearer 토큰이다. 저장소를 거치면 매 요청 복호화나 별도 캐시 계층이 필요하다. 이것은 비용 근거이지 필요성 근거가 아니다.
- (b) 폐기는 값 교체로 즉시 무효화되므로 저장소의 버전 관리 이점이 작다.
- (c) 값 공간이 서버가 발급한 랜덤 hex(`itk_` + 32바이트)로 닫혀 있다. 발급 응답에 한 번만 보인다. 사용자가 입력한 외부 서비스 자격 증명과 위험 성격이 다르다. 새어도 영향 범위가 그 트리거 하나다. 원시 `config` 로 이 값을 보낼 수 있던 경로는 2026-10-17 에 닫혔다. 원시 `config` 에 `interaction.triggerToken` 이 실리면 400 으로 거부한다(NERV Task `CLE-T-EQDYC1`).

(a) 를 «평문이 필수» 로 읽으면 안 된다. 토큰을 해시로 저장하고 해시끼리 `crypto.timingSafeEqual` 로 비교하면 같은 성능과 타이밍 안전성을 얻는다. 평문 보관은 불가피한 것이 아니라 현재 구현의 선택이고, 이 예외를 지탱하는 실질 근거는 (c) 다. «해시 저장 + timing-safe 비교» 전환은 유효한 후속 개선안으로 열어 둔다.

이 항목을 «평문 보관 일반의 선례» 로 인용하면 안 된다. (a)~(c) 를 함께 만족하지 않는 필드가 이 문단을 근거로 예외를 얻는 것이 이 등재의 실패 모드다.

같은 `Trigger.config` 안의 `notification.signing.secretRef` 는 `SecretResolver` 를 거친다. 한 객체 안의 이 비대칭은 의도한 것이고 (a)~(c) 가 그 이유다. 알림 서명 시크릿의 첫 값은 서버가 발급한다(트리거를 만들 때와 PATCH 가 EIA 알림 웹훅 설정을 처음 붙일 때). 호출자가 원시 `config` 의 옛 키 `signing.secret` 으로 평문을 보내던 경로는 2026-10-31 에 닫혔다([R16](CLE-INT-SECRET-REFS.md#r16-원시-config-의-타입-키와-secret-값을-막는다-2026-10-31)). 다만 그 전에 호출자가 고른 평문은 그대로 쓰인다. 시크릿 저장소로 옮겨진 값도 있고 아직 행에 남은 값도 있다. 그래서 값 공간이 서버가 발급한 값으로 닫혀 있지 않아 (c) 를 만족하지 않는다. 표면 서술은 [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) 이 기준이다.

### `Trigger.notification_secret_v2` (2026-09-05 결정)

EIA 알림 웹훅 HMAC 서명 시크릿을 교체하는 24시간 유예 동안 **새 시크릿을 컬럼에 평문으로** 둔다. `secret://` 통합 대상이 아니다. 발송 측은 이 값을 보조 서명 키로 직접 쓴다. 기본 키는 `secretRef` 를 거친다. 표면 서술은 [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) 이 기준이다.

위 `itk_*` 항목의 (a)~(c) 를 근거로 삼지 않는다. 근거는 따로 세운다. 아래 3 은 (c) 를 인용하지 않고 이 필드의 값(`wsk_*`)에서 따로 확인했다.

1. **평문이 종착지가 아니라 경유지다.** 승격되면 값은 `secrets.rotate` 로 저장소에 들어가고 컬럼은 `null` 로 비운다([EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) 의 승격 경로). `AuthConfig.config`(영구·암호화)와 `itk_*`(영구·평문) 어느 쪽과도 다른 세 번째 형태다.
2. **노출 창이 정책으로 닫혀 있다.** 유예 종료 cron 이 컬럼을 비운다. EIA 알림 웹훅 설정이 없는 트리거도 승격하지 않고 컬럼만 비운다([EIA 데이터와 흐름 「서명 시크릿 교체와 승격」](../CLE-IX/CLE-EIA-DATA.md#서명-시크릿-교체와-승격)). 비우지 않고 건너뛰는 분기는 [R10](CLE-INT-SECRET-REFS.md#r10-저장된-참조는-읽는-쪽도-다시-만들고-rotate-는-다른-워크스페이스의-행을-덮어쓰지-않는다-2026-10-04) 의 워크스페이스 불일치 하나이고 방어용이다. 응답으로 새지 않도록 `TriggersService` 의 `TRIGGER_RESPONSE_STRIP_COLUMNS` 가 응답 경계에서 이 컬럼을 지운다. 부재는 두 자리에서 단언한다. 트리거 직접 응답은 `shared/testing/trigger-workflow-ref.ts`, 스케줄 조인 응답은 `shared/testing/schedule-trigger-ref.ts` 가 같은 컬럼 목록으로 확인한다.
3. **서버가 발급하고 영향 범위가 트리거 하나다.** `wsk_` + `randomBytes(32)` 이며 사용자가 입력한 외부 자격 증명이 아니다.
4. **기본 경로는 그대로다.** 이 예외는 유예 기간의 보조 키에만 적용되며 `signing.secretRef` 정책을 건드리지 않는다.

다음 필드가 이 항목을 근거로 삼으려면 (1) 을 만족해야 한다. 즉 «승격되어 저장소로 들어가고 컬럼이 비워지는가» 다. 이 조건 없이 이 항목을 평문 보관의 선례로 쓰는 것이 이 등재의 실패 모드다.

## 구현 위치

- 규칙 4 의 면제 응답 DTO: `codebase/backend/src/modules/triggers/dto/responses/trigger-secret-issue-response.dto.ts`(`TriggerIssuedSecretsDto`), `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts`(생성 · PATCH 응답의 `secrets`)
- 저장소 예외 필드의 응답 부재 단언(규칙 4 · 6, 최상위 컬럼): `codebase/backend/src/shared/testing/trigger-workflow-ref.ts`, `codebase/backend/src/shared/testing/schedule-trigger-ref.ts`
- 열린 맵 `config` 안 비밀의 응답 부재 단언(규칙 5 · R19): `codebase/backend/test/trigger-issued-secrets.e2e-spec.ts`, `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts`, `codebase/backend/src/modules/triggers/triggers.service.spec.ts`(옛 평문 `signing.secret`)
- 규칙 14 의 알려진 비밀 치환: `codebase/backend/src/shared/utils/sanitize-error-message.ts`(`replaceKnownSecret`), 채팅 채널 클라이언트 `codebase/backend/src/modules/chat-channel/providers/slack/slack-client.ts` · `codebase/backend/src/modules/chat-channel/providers/discord/discord-client.ts` · `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-client.ts`

## Rationale

### R7. 저장소 예외 필드도 응답에는 나가지 않는다고 규범으로 적는다

2026-09-05 전까지 «이 컬럼들이 응답에 나가면 안 된다» 는 요구가 스펙 어디에도 규범 문장으로 없었고(실측 0건), 실제로 두 엔드포인트에서 나가고 있었다. `notification_secret_v2` 예외를 올릴 때도 예외의 대상은 «컬럼에 평문으로 보관» 이지 «응답에 실어도 된다» 가 아니었다. 그래서 규칙 4~6 으로 경계를 규범으로 적었다. 이후 응답 경계 스트립을 세웠고 두 단언 자리가 부재를 고정한다. 같은 컬럼 목록이 EIA 문서에도 있으면 한쪽만 고쳐 다른 쪽이 낡으므로, 목록은 이 규약에 두고 EIA 문서는 링크한다. 값을 한 번 보여 주는 응답의 면제는 규칙 4 의 목록과 [R12](CLE-INT-SECRET-USAGE.md#r12-첫-알림-서명-시크릿을-서버가-발급한다-2026-10-09) · R15 가 정한다.

### R11. 실패 문장의 평문과 예외 메시지의 참조를 만든 자리에서 지운다 (2026-10-05)

NERV Task `CLE-T-H0GF4K` 가 채팅 채널의 마지막 에러 필드를 점검하다 두 경로를 찾았다. Slack 봇 토큰에 CR · LF · NUL 이 있으면 fetch 의 헤더 검증 에러가 토큰 전체를 원문에 실었고 그 원문이 `chat_channel_last_error` 와 로그로 갔다(규칙 14 위반). `resolve` 의 «없음» 에러가 참조를 실어 같은 필드에 저장될 수 있었다(규칙 4).

- 규칙 14 를 «평문을 내보내지 않는다» 에서 «실패 문장을 만든 자리에서 지운다» 는 의무까지 넓혔다. 저장된 뒤에 가리면 DB 와 로그의 유출이 남는다. 지우는 쪽은 그 호출에 쓴 평문을 들고 있는 모듈뿐이라 그 모듈에 의무를 둔다. 값을 알고 지우므로 패턴 오탐이 없다.
- 규칙 18 에 예외 메시지가 참조를 싣지 않는다는 문장을 더했다. `rotate` 의 거부(규칙 25)가 이미 그렇게 했고 `resolve` · `store` 를 맞췄다.
- 응답 쪽의 두 번째 층(값 패턴으로 가리기)은 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 이 정한다. 이 변경 전에 저장된 `chat_channel_last_error` 에 남은 값은 그 문서의 「트리거 응답의 마지막 오류」 한계가 다룬다.

### R15. 생성 · PATCH 응답이 발급한 `itk_*` 를 규칙 4 의 면제에 더한다 (2026-10-17)

사용자가 트리거 단위 토큰을 트리거 생성 때 발급하기로 정했다(2026-10-17, NERV Task `CLE-T-EMB0YG`). 인터랙션을 켜고 전략이 `per_trigger` 인 트리거를 만들면 서버가 `itk_*` 를 발급한다. PATCH 가 `per_trigger` 를 처음 켰는데 유효한 토큰이 없을 때도 발급한다. 이미 토큰이 있으면(끈 뒤 다시 켜는 경우 포함) 새로 발급하지 않는다. 발급 조건의 기준은 [External Interaction API 「트리거 등록과 웹훅 응답」](../CLE-IX/CLE-EIA.md#트리거-등록과-웹훅-응답) 과 [트리거 관리 「PATCH 본문 계약」](../CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약) 이다. 이 규약은 응답 면제만 정한다.

- 평문은 생성 · PATCH 응답의 `data.secrets.interactionToken` 에 한 번 싣는다. 첫 알림 서명 시크릿과 같은 묶음이고 그 응답이 발급했을 때만 키가 있다([HTTP API 규약 §5.5](../CLE-API/CLE-API-CONV.md#55-부재-표현-null-과-키-생략) 기준 (b)). 그 값을 만든 바로 그 응답이라 규칙 4 의 기준에 맞는다.
- 저장 위치는 그대로 `config.interaction.triggerToken` 이다. [저장소 예외 필드](#저장소-예외-필드) 의 근거 (a)~(c) 는 바뀌지 않는다. 응답에서는 지금처럼 이 필드를 빼고 보낸다.

기각한 대안:

- **생성 때 발급하지 않는다.** 지금까지의 동작이고 미결로 남아 있었다. 그러면 `per_trigger` 트리거를 만든 뒤 트리거 단위 토큰 재발급을 따로 불러야 토큰이 생긴다.
- **응답 필드를 따로 둔다**(예: 재발급 응답처럼 `data.token`). 생성 · PATCH 응답의 일회성 평문은 이미 `data.secrets` 묶음에 있다. 한 응답에 두 비밀이 함께 실릴 수 있어 같은 묶음의 선택 필드로 두었다.

### R19. 열린 맵 안의 비밀은 응답 부재를 테스트로 단언한다 (2026-11-07)

규칙 5 의 두 축은 DTO 에 선언한 스키마를 기준으로 본다. 응답-계약 검증(`codebase/backend/src/shared/testing/response-contract.ts`)은 `$ref` 로 이어진 스키마만 따라 내려간다. `TriggerDto.config` 처럼 `additionalProperties: true` 로 선언한 인라인 객체는 열어 보지 않으므로 그 안에 어떤 키가 실려도 위반이 아니다. 정적 가드는 선언끼리만 대조하므로 맵 안의 키를 모른다. 그런데 저장소 예외 필드 둘(`config.interaction.triggerToken`, 옛 평문 `config.notification.signing.secret`)과 시크릿 참조(`config.notification.signing.secretRef`, `config.*.botTokenRef`, `config.*.inboundSigningRef`)가 바로 이 맵 안에 있다. 응답 경계의 스트립(`TriggersService` 의 `INTERACTION_RESPONSE_STRIP_KEYS` · `NOTIFICATION_SIGNING_STRIP_KEYS` · `CHAT_CHANNEL_RESPONSE_STRIP_KEYS`)에서 키 하나가 빠져도 두 축은 알아채지 못한다. 보호는 손으로 쓴 부재 단언에만 기대고 같은 자리에 새 비밀을 넣는 사람이 그 사실을 알아야 이어진다.

그래서 열린 맵 안에 두는 비밀은 응답에 그 키가 없음을 단언하는 e2e 를 함께 둔다(규칙 5). 2026-11-07 에는 다음 테스트가 맡는다.

| 키 | 단언하는 테스트 |
| --- | --- |
| `config.interaction.triggerToken` · `config.notification.signing.secretRef` | `codebase/backend/test/trigger-issued-secrets.e2e-spec.ts` |
| `config.chatChannel.botTokenRef` · `config.chatChannel.inboundSigningRef` | `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts`. 응답-계약 검증(`assertMatchesContract`)을 통과한 같은 응답에서 두 키의 부재를 따로 단언한다 |
| 옛 평문 `config.notification.signing.secret` | `codebase/backend/src/modules/triggers/triggers.service.spec.ts`(단위). 2026-10-31 뒤로는 공개 API 로 이 키를 저장할 수 없다([R16](CLE-INT-SECRET-REFS.md#r16-원시-config-의-타입-키와-secret-값을-막는다-2026-10-31)). 그래서 e2e 대신 저장된 옛 값을 fixture 로 만든다 |

`## 구현 위치` 의 두 헬퍼(`trigger-workflow-ref.ts` · `schedule-trigger-ref.ts`)는 최상위 컬럼(`notificationSecretV2` · `chatChannelTokenV2`)의 부재를 본다. 맵 안의 키는 위 테스트가 맡는다.

이 규칙을 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 의 검증 층에 두는 안도 있었다(NERV Task `CLE-T-F7J4V4`). 지키려는 것이 비밀이라 노출 경계(규칙 4~6)를 정한 이 규약에 뒀다. 스트립을 선언으로 바꾸는 일은 이 결정에 들지 않는다.
