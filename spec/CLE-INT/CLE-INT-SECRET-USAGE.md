---
id: "CLE-INT-SECRET-USAGE"
title: "시크릿 저장소 — 사용 패턴과 시크릿 발급"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-INT-SECRET"
ancestors: ["CLE-VISION", "CLE-INT", "CLE-INT-SECRET"]
area: "CLE-INT"
content_hash: "4bfd1ff5ea99426d0a63aefe980c2fee6e6cbd8f8f4f28d22f3bcd7654e198f8"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "f16ae149ffdb5b565a69c940b88cdb727dd0e4a82076365390ca84cc2f074d6a"
etag: "sha256-8c1318d8e03235921f67d9a26547e8af1782de83cde5ea19718a8e3c4f0143df"
---
## 개요

이 문서는 [시크릿 저장소](CLE-INT-SECRET.md) 의 하위 문서로 도메인 모듈이 `SecretResolver` 를 쓰는 패턴(트리거 생성 · PATCH 의 첫 발급, 외부 API 호출, 트리거 행 삭제, 봇 토큰 재발급, 인바운드 서명 자료 초기화)과 그 근거를 정한다. 규칙 번호(규칙 N)는 부모 문서 [「규칙」](CLE-INT-SECRET.md#규칙) 의 번호다.

## 사용 패턴

### 트리거 생성

```typescript
async createTrigger(dto: CreateTriggerDto, workspaceId: string) {
  // INSERT · 첫 발급 · 시크릿 저장소 쓰기 · config 쓰기를 한 트랜잭션에서 한다. 어느 단계가 실패해도 행이 남지 않는다(규칙 9, R14).
  const { trigger, secrets } = await this.dataSource.transaction(async (manager) => {
    const trigger = await manager.save(Trigger, { ...dto, workspaceId });
    // PATCH · 시크릿 승격과 같은 트리거 설정 잠금을 잡는다.
    await acquireTriggerConfigLock(manager, trigger.id);
    const secrets: { notificationSigningSecret?: string; interactionToken?: string } = {};
    // top-level notification 으로 받은 EIA 알림 웹훅 설정. 원시 config 의 notification 키는 400 이다(규칙 23).
    const notification = trigger.config.notification;
    if (notification) {
      // 생성에는 옮길 옛 평문이 없으므로 늘 발급한다. 이미 저장된 옛 평문은 PATCH 가 옮긴다(아래 단락).
      secrets.notificationSigningSecret = `wsk_${randomBytes(32).toString('hex')}`;
      const ref = notificationSigningSecretRef(trigger.id);  // 참조를 만드는 곳은 하나다(CLE-INT-SECRET-REFS R10)
      // 잠금을 쥔 트랜잭션의 매니저로 쓴다. 풀 연결을 더 쓰지 않고 실패하면 함께 롤백된다(규칙 7 · 9).
      await this.secrets.rotate(ref, workspaceId, secrets.notificationSigningSecret, manager);
      // 평문은 config 에 남기지 않는다. secretRef 만 보관한다.
      trigger.config.notification.signing = { algorithm: notification.signing?.algorithm, secretRef: ref };
    }
    const interaction = trigger.config.interaction;
    if (interaction?.enabled === true && interaction.tokenStrategy === 'per_trigger') {
      // itk_* 는 시크릿 저장소가 아니라 config 에 둔다(저장소 예외 필드).
      secrets.interactionToken = `itk_${randomBytes(32).toString('hex')}`;
      trigger.config.interaction.triggerToken = secrets.interactionToken;
    }
    await manager.save(trigger);
    return { trigger, secrets };
  });
  // 감사는 커밋 직후 트랜잭션 밖에서 남긴다(R14). 발급한 비밀의 종류 이름만 싣고 평문은 싣지 않는다.
  await this.recordCreatedAudit(trigger, Object.keys(secrets));
  // secrets 의 평문은 이 생성 응답의 data.secrets 에만 한 번 싣는다(규칙 4). 응답 모양은 트리거 관리 문서가 정한다.
  if (dto.chatChannel?.botToken) {
    // 채팅 채널 설정은 provider 호출이 있어 커밋 뒤 잠금 밖에서 한다. 재기록이 행 부재로 실패하면 되돌린다(규칙 9).
    const ref = buildSecretRef({ scope: 'triggers', resourceId: trigger.id, name: 'bot-token' });
    // setup 경로는 재시도 안전성을 위해 rotate() (UPSERT) 사용 — 규칙 7.
    await this.secrets.rotate(ref, workspaceId, dto.chatChannel.botToken);
    // DTO 의 botToken plaintext 는 config 에 흘리지 않음 — botTokenRef 만 보관.
    trigger.config.chatChannel = {
      provider: dto.chatChannel.provider,
      botTokenRef: ref,
      uiMapping: dto.chatChannel.uiMapping,
      rateLimitPerMinute: dto.chatChannel.rateLimitPerMinute,
      languageHints: dto.chatChannel.languageHints,
    };
    await this.repo.save(trigger);
  }
}
```

PATCH 가 EIA 알림 웹훅 설정(`notification`)을 실으면 트리거 설정 잠금 안에서 다시 읽은 행의 `signing.secretRef` 를 규칙 24 로 판정한다. 있으면 행의 값을 복사하지 않고 `notificationSigningSecretRef(triggerId)` 로 다시 만들어 싣는다. 채팅 채널 `botTokenRef` 를 트리거 id 로 다시 만드는 것과 같은 방식이다. 없을 때 옛 평문을 옮길지 첫 시크릿을 발급할지는 [EIA 알림 웹훅 「시크릿 교체」](../CLE-IX/CLE-EIA-NOTIFY.md#시크릿-교체) 가 정한다. 판정과 시크릿 저장소 쓰기는 같은 잠금 안에서 그 트랜잭션의 매니저로 한다(규칙 9). 발급한 평문은 그 PATCH 응답에만 한 번 싣는다(규칙 4). PATCH 가 인터랙션을 `per_trigger` 로 처음 켰는데 유효한 토큰이 없으면 `itk_*` 도 발급해 같은 응답에 싣는다([트리거 관리 「PATCH 본문 계약」](../CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약)). 응답 모양은 [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) 가 정한다.

### 외부 API 호출

```typescript
async sendMessage(message: ChannelMessage, config: ChatChannelConfig) {
  // config 는 읽기 관문이 참조를 트리거 id 로 다시 만든 사본이다(규칙 24).
  const token = await this.secrets.resolve(config.botTokenRef);
  return this.client.sendMessage(token, message);
}
```

채널 어댑터는 받은 설정의 참조를 그대로 `resolve` 한다. 저장된 설정을 채널 어댑터에 넘기기 전에 읽기 관문이 참조를 트리거 id 로 다시 만든다(규칙 24). 비밀을 푸는 채널 어댑터 함수는 트리거 id 를 받지 않아 대조를 채널 어댑터 안에 두지 않았다([R10 「저장된 참조는 읽는 쪽도 다시 만들고 rotate 는 다른 워크스페이스의 행을 덮어쓰지 않는다」](CLE-INT-SECRET-REFS.md#r10-저장된-참조는-읽는-쪽도-다시-만들고-rotate-는-다른-워크스페이스의-행을-덮어쓰지-않는다-2026-10-04)).

### 트리거 행이 없어질 때

트리거 화면 삭제를 예로 든다. 스케줄·워크플로우·워크스페이스 삭제도 같은 순서다([트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md)).

```typescript
async removeTrigger(triggerId: string) {
  // 외부 provider teardown 은 이보다 앞에서 끝낸다 — teardown 이 비밀을 읽는다.
  await this.repo.delete(triggerId);
  // 행 삭제가 커밋된 뒤에 지운다. 그 사이 끼어든 쓰기는 락 안 재기록에서 행 부재를 보고 스스로
  // 되돌린다(규칙 9). 개별 ref delete 보다 prefix 패턴 권장 — 추가 secret 도 자동 정리.
  await this.secrets.deleteByPrefix(`secret://triggers/${triggerId}/`);
}
```

### 봇 토큰 재발급

봇 토큰 재발급은 기본 참조(`bot-token`)를 바로 새 토큰으로 바꾸고 `bot-token.v2` 에 옛 토큰을 24시간 보관한다. 저장된 옛 토큰이 비었거나 공백만 있으면 보관하지 않는다(규칙 11). 별도 승격 단계는 없다. 재발급 순서와 유예 정리는 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 과 [채팅 채널 데이터와 흐름](../CLE-CHAT/CLE-CHAT-DATA.md) 이 정한다.

### 채팅 채널 inbound 서명 자료 초기화

`inbound-signing` 은 채널 프로바이더에 따라 두 경로로 초기화한다. 서버가 발급하는 경우(Telegram)는 `setupChannel` 결과에서 받고, 채널 프로바이더가 발급하는 경우(Slack·Discord)는 사용자 입력에서 받는다. 둘 다 같은 슬롯 `secret://triggers/{id}/inbound-signing` 에 둔다. 한 슬롯을 백엔드의 채널 프로바이더 분기가 흡수한다는 뜻이다([채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md)).

```typescript
// (a) server-issued — Telegram 등 adapter 의 setupChannel 이 randomBytes 로 발급
async setupChatChannel(trigger: Trigger, workspaceId: string) {
  const adapter = this.registry.get(trigger.config.chatChannel.provider);
  const result = await adapter.setupChannel(trigger.config.chatChannel, callbackUrl);
  // configUpdates 안에 plaintext 흘리지 않고 issuedInboundSigning 으로 분리
  if (result.issuedInboundSigning) {
    const ref = buildSecretRef({ scope: 'triggers', resourceId: trigger.id, name: 'inbound-signing' });
    await this.secrets.rotate(ref, workspaceId, result.issuedInboundSigning);  // setup 재시도 안전성 (규칙 7)
    trigger.config.chatChannel.inboundSigningRef = ref;
  }
  Object.assign(trigger.config.chatChannel, result.configUpdates ?? {});
  await this.repo.save(trigger);
}

// (b) provider-issued — Slack signing secret / Discord public key, 사용자 manual 입력
async createChatChannelTrigger(dto: CreateTriggerDto, workspaceId: string) {
  const trigger = await this.repo.save({ ...dto, workspaceId });
  if (dto.chatChannel?.inboundSigningPlaintext) {  // DTO 한정 입력 필드 (plaintext)
    const ref = buildSecretRef({ scope: 'triggers', resourceId: trigger.id, name: 'inbound-signing' });
    await this.secrets.rotate(ref, workspaceId, dto.chatChannel.inboundSigningPlaintext);
    // DTO 의 plaintext 는 config 에 흘리지 않음 — inboundSigningRef 만 보관.
    trigger.config.chatChannel.inboundSigningRef = ref;
    await this.repo.save(trigger);
  }
  // 이어서 setupChatChannel(trigger) 호출 — (a) 경로의 issuedInboundSigning 은 비어 있음
}
```

## 구현 위치

- 규칙 8 · 9 의 커밋 뒤 정리와 되돌리기: `codebase/backend/src/modules/triggers/trigger-resource-release.ts`(`cleanUpDeletedTriggersAfterCommit`), `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts`(`undoAbsentWrite`). 잠금 안 쓰기의 트리거 설정 잠금: `codebase/backend/src/modules/triggers/trigger-config-lock.ts`
- 봇 토큰 재발급 실패 때 되돌리기([R10](CLE-INT-SECRET-REFS.md#r10-저장된-참조는-읽는-쪽도-다시-만들고-rotate-는-다른-워크스페이스의-행을-덮어쓰지-않는다-2026-10-04)): `codebase/backend/src/modules/triggers/secret-write-journal.ts`(`SecretWriteJournal`)

## Rationale

### R3. `.v2` 접미사로 유예 변형을 나타낸다

`name.v2` 로 같은 자원의 변형임을 이름 안에 적는다. `bot-token` 과 `bot-token.v2` 가 눈으로 묶이고, `resolve` 에 넘기는 참조 문자열만 봐도 무엇을 읽는지 분명하다.

`v2` 는 «같은 자원의 24시간 유예용 변형» 만 뜻하고 옛 값인지 새 값인지는 뜻하지 않는다. 실제로 두 v2 의 뜻은 반대다. 채팅 채널의 `bot-token.v2`(와 `Trigger.chat_channel_token_v2`)는 **옛** 봇 토큰 백업이고 유예가 끝나면 지운다. 승격 단계는 없다([채팅 채널 데이터와 흐름](../CLE-CHAT/CLE-CHAT-DATA.md)). EIA 알림 서명의 `Trigger.notification_secret_v2` 는 유예 기간의 **새** 알림 서명 시크릿이고 승격 때 기준 참조를 바꾼다([EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md)). 원문의 옛 봇 토큰 재발급 예시는 알림 서명 쪽 뜻(v2 를 기준 참조로 승격)을 따랐지만 채팅 채널 요구사항([채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md))과 구현(`rotateBotToken`)은 옛 토큰 백업이라 [봇 토큰 재발급](#봇-토큰-재발급) 절과 규칙 11 은 채팅 채널 쪽을 따른다. 이름 패턴이 같다고 뜻이 같다고 보지 않는다.

### R12. 첫 알림 서명 시크릿을 서버가 발급한다 (2026-10-09)

NERV Task `CLE-T-M6PERB` 의 재검토에서 첫 알림 서명 시크릿을 언제 누가 만드는지 정했다(사용자 결정, 2026-10-09). 서버는 `config.notification` 이 있는 트리거를 만들 때와 PATCH 가 EIA 알림 웹훅 설정을 처음 붙일 때 `wsk_<64hex>` 를 발급한다. 호출자가 원시 `config` 로 평문 `signing.secret` 을 보냈으면 그 값을 쓰고 발급하지 않는다. 2026-10-31 부터 원시 `config` 로 새 평문을 받는 경로는 닫혔다([R16](CLE-INT-SECRET-REFS.md#r16-원시-config-의-타입-키와-secret-값을-막는다-2026-10-31)). 이 결정은 [External Interaction API 「트리거 등록과 웹훅 응답」](../CLE-IX/CLE-EIA.md#트리거-등록과-웹훅-응답) 의 요구사항을 따른다. 발급 동작은 [EIA 알림 웹훅](../CLE-IX/CLE-EIA-NOTIFY.md) 이 정한다. 응답 모양은 [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) 가 정한다. 함께 제시한 다른 안과 결정 이력은 그 Task 의 결정 기록에 있다. 이 규약은 그 결정에 맞춰 아래를 고쳤다.

- **비대칭의 근거를 고쳤다.** [저장소 예외 필드 「`Trigger.config.interaction.triggerToken`」](CLE-INT-SECRET-EXPOSE.md#triggerconfiginteractiontriggertoken-2026-08-16-결정) 끝 단락은 알림 서명 시크릿이 사용자가 입력하는 HMAC 비밀이라 (c) 를 만족하지 않는다고 적었다. 첫 값을 서버가 발급하면 이 이유는 맞지 않는다. 결론은 그대로이고 근거를 «호출자 평문을 받는 원시 `config` 경로가 남아 값 공간이 닫혀 있지 않다» 로 바꿨다. `itk_*` 의 원시 `config` 경로는 2026-10-17 에(NERV Task `CLE-T-EQDYC1`), 알림 서명 시크릿의 옛 키 `signing.secret` 경로는 2026-10-31 에 닫혔다. 그 뒤 근거는 그 전에 호출자가 고른 평문이 시크릿 저장소와 행에 남아 있다는 사실로 바뀌었다([R16](CLE-INT-SECRET-REFS.md#r16-원시-config-의-타입-키와-secret-값을-막는다-2026-10-31)).
- **일회성 응답을 규칙 4 의 금지에서 목록으로 뺐다.** 규칙 4 를 문장대로 읽으면 저장소 밖에 사는 필드의 새 값을 한 번 보여 주는 응답(시크릿 교체 `rotate-secret` 의 `notification_secret_v2` 값, 트리거 단위 토큰 재발급 `revoke-token` 의 `itk_*`, 인증 설정 생성 · 키 재생성 · 평문 보기의 `AuthConfig.config` 평문)도 금지에 걸린다. 이 응답들은 전부터 있었지만 이 규약에 근거가 없었고, 생성 · PATCH 응답이 첫 알림 서명 시크릿을 싣게 되면서 경계를 적을 필요가 생겼다. 면제를 «서버가 새 비밀을 만든 응답» 같은 일반형으로 적으면 다른 발급 응답까지 면제로 읽히고 응답-계약 검증(규칙 5)과도 이어지지 않는다(NERV Task `CLE-T-M6PERB` 의 결정 기록). 그래서 면제를 «이 규약이 이름 붙인 값을 그 값을 만든 바로 그 응답에 한 번 싣는 것» 으로 좁히고 대상 응답을 열거했다. 새 면제는 목록에 응답을 더해야 생긴다. 평문 보기는 값을 만든 응답이 아니지만 [외부 호출 인증 설정](../CLE-TRIG/CLE-TRIG-AUTHCFG.md) 이 비밀번호 재확인과 감사 기록을 조건으로 정한 경로라 넣었다. 빼면 이 규칙이 그 문서와 부딪친다. 면제 응답도 응답-계약 검증을 받으므로 평문 필드의 DTO 선언 방법을 규칙 5 에 적었다. 그 밖의 응답에 이 필드와 참조를 싣지 않는다는 금지는 그대로다.
- **규칙 14 에 알려진 예외를 적었다.** [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) 은 원시 `config` 의 평문 `signing.secret` 이 시크릿 저장소로 옮겨지기 전이나 옮기다 실패하면 JSONB 에 남는다고 적는다. 이 예외가 없으면 «DB 는 항상 암호문만 본다» 가 실제보다 넓게 읽힌다. 2026-10-31 에 새 평문 입력 경로가 닫혀 예외는 이미 저장된 옛 평문 행으로 좁혀졌다([R16](CLE-INT-SECRET-REFS.md#r16-원시-config-의-타입-키와-secret-값을-막는다-2026-10-31)).
- **사용 패턴 · 참조 표 · 규칙 7 을 맞췄다.** 「트리거 생성」 예시에 서버 발급 분기를 더하고 참조는 [R10](CLE-INT-SECRET-REFS.md#r10-저장된-참조는-읽는-쪽도-다시-만들고-rotate-는-다른-워크스페이스의-행을-덮어쓰지-않는다-2026-10-04) 대로 `notificationSigningSecretRef` 로 만든다. 규칙 7 은 PATCH 가 처음 붙일 때의 저장도 `rotate` 로 하게 넓혔다. 알림 서명 비밀 행은 트리거가 없어질 때 prefix 로만 지우므로(규칙 8) 설정을 뗐다가 다시 붙이면 같은 참조에 옛 행이 남아 있을 수 있기 때문이다.
- **PATCH 는 알림 서명 참조를 행에서 복사하지 않고 다시 만든다.** PATCH 는 트리거 설정 잠금 안에서 다시 읽은 행의 알림 서명 참조를 규칙 24 로 판정해 있음 · 없음만 쓴다. 있으면 참조를 트리거 id 로 다시 만들어 싣는다. 규칙 23 · 24 가 저장값 대신 리소스 id 로 참조를 만들게 하는 것과 같은 방식이다. 저장 경계가 막기 전의 행에는 다른 값이 있을 수 있다([R10](CLE-INT-SECRET-REFS.md#r10-저장된-참조는-읽는-쪽도-다시-만들고-rotate-는-다른-워크스페이스의-행을-덮어쓰지-않는다-2026-10-04)). 판정이 규칙 24 와 다르면 `secret://` 형식이 아닌 값이 든 옛 행에서 PATCH 는 «있음» 으로 보고 발급하지 않는다. 발송 쪽은 같은 행을 «없음» 으로 보므로 주 시크릿이 없는 상태가 남는다. 판정과 발급 쓰기는 같은 잠금 안에서 한다. 동시 PATCH 두 건이 잠금 밖에서 각자 발급하면 한쪽 응답의 평문은 저장소에 남지 않는다. 잠금 안에서도 워크플로우 · 워크스페이스 삭제로 행이 사라질 수 있어서 규칙 9 의 되돌리기를 잠금 안 쓰기까지 넓혔다. 이 되돌리기는 R14 에서 시크릿 승격으로 좁혔다. 참조가 없는 행에 옛 평문 `signing.secret` 이 남아 있으면 PATCH 는 발급하지 않고 그 평문을 시크릿 저장소로 옮긴다. 통째 교체로 그 평문이 사라지면 수신 측이 쓰던 시크릿이 유예 없이 바뀌기 때문이다. 이 방식은 사용자에게 묻지 않고 기본값으로 정해 알렸다.
- **잠금 밖 쓰기 대신 잠금 안에서 쓴다.** 견준 안은 둘이었다. 하나는 잠금 밖에서 비밀을 쓰고 잠금 안 재기록이 행 부재로 실패하면 되돌리는 방식이다. 채팅 채널 설정이 쓰는 방식이다(규칙 9). 판정이 잠금 밖에 있으면 동시 PATCH 두 건이 각자 «없음» 으로 보고 발급한다. 나중 쓰기가 앞 쓰기를 덮어 먼저 나간 응답의 평문은 저장소에 남지 않는다. 되돌리기는 행 부재만 다루므로 이 덮어쓰기를 막지 못한다. 다른 하나는 `store()` 로 쓰고 같은 참조가 이미 있으면 throw 하게 해 늦은 요청을 실패시키는 방식이다. `store()` 의 «이미 있음» 동작은 백엔드 구현에 따라 다를 수 있다(규칙 7). 설정을 뗐다가 다시 붙이면 같은 참조에 옛 행이 남아 있어 정상 요청도 실패한다(규칙 8). 그래서 판정과 쓰기를 한 잠금 안에 두었다.
- **잠금 안 시크릿 저장소 쓰기는 백엔드 교체의 예외다.** 잠금 안에서 HTTP 호출을 하지 않는다는 제약은 Cafe24 토큰 갱신이 같은 잠금을 기각한 이유(잠금을 쥔 채 HTTP 요청을 하면 DB 커넥션 점유가 길어진다)에서 왔다([트리거 관리 「동시 쓰기 직렬화」](../CLE-TRIG/CLE-TRIG-MANAGE.md#동시-쓰기-직렬화)). 지금 백엔드는 같은 DB 의 테이블이라 이 쓰기에 HTTP 호출이 없다. 외부 백엔드를 들이면 이 경로들은 잠금 밖 쓰기와 되돌리기(규칙 9)로 다시 설계하므로 규칙 13 이 기대는 «백엔드를 규약 변경 없이 바꿀 수 있다» 는 여기에 그대로 성립하지 않는다([다른 백엔드로 바꾸기](CLE-INT-SECRET-BACKEND.md#다른-백엔드로-바꾸기)). 이 전제는 사용자에게 묻지 않고 기본값으로 정해 알렸다. 2026-10-17 에 생성 경로가 이 목록에 들었다(R14).

### R14. 생성의 첫 발급을 INSERT 와 한 트랜잭션에 묶는다 (2026-10-17)

트리거 생성은 INSERT 와 감사 기록을 먼저 커밋하고 첫 알림 서명 시크릿을 그 뒤에 따로 정했다. 그 사이에 실패하면 `config.notification` 은 있고 `signing.secretRef` 는 없는 행이 남았다. 호출자가 다시 시도하면 `endpointPath` UNIQUE 충돌이 나거나 트리거가 둘 생겼다(NERV Task `CLE-T-EQDYC1`). 2026-10-17 에 아래와 같이 정했다.

- 트리거 INSERT · 첫 알림 서명 시크릿의 발급이나 옮기기 · `itk_*` 발급([R15](CLE-INT-SECRET-EXPOSE.md#r15-생성--patch-응답이-발급한-itk_-를-규칙-4-의-면제에-더한다-2026-10-17)) · 시크릿 저장소 쓰기 · `config` 쓰기를 트리거 설정 잠금을 쥔 한 트랜잭션에서 한다. 어느 단계가 실패해도 행이 남지 않는다. 호출자는 같은 요청을 다시 보내면 된다.
- 시크릿 저장소 쓰기는 그 트랜잭션의 매니저로 한다(`rotate` 의 `manager` 인자). PATCH 와 시크릿 승격도 같다. 풀 연결을 하나 더 빌리지 않으므로 잠금을 쥔 요청이 연결 둘을 쥐지 않는다. 같은 트랜잭션이라 뒤따르는 `config` 쓰기가 실패하면 비밀 쓰기도 롤백된다.
- 그래서 규칙 9 의 되돌리기가 줄었다. R12 는 잠금 안 쓰기에도 되돌리기를 두었다. 이제 예외로 끝나는 경우는 롤백이 맡는다. 남는 것은 FK CASCADE 로 행이 사라져 시크릿 승격의 `config` 쓰기가 예외 없이 0행으로 끝나는 경우다. 생성은 커밋 전의 자기 행에 쓰므로 이 경우가 없다.
- 감사 기록은 이 트랜잭션에 넣지 않고 커밋 직후 트랜잭션 밖에서 남긴다. 생성이 롤백되면 `trigger.created` 행은 남지 않는다. 옛 동작에서는 감사가 첫 발급보다 먼저였고 첫 발급은 커밋 뒤의 별도 단계였다. 이제는 첫 발급까지 한 트랜잭션으로 커밋한 뒤에 감사를 남긴다. 커밋과 감사 사이에 프로세스가 죽으면 감사 행 없는 트리거가 남을 수 있다. PATCH 도 커밋 직후에 감사를 남기므로 같은 위험으로 받아들였다. 감사 적재 실패는 지금처럼 흡수하고 생성을 실패시키지 않는다([감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md) 의 감사 실패 흡수 요구사항).
- 채팅 채널 설정은 이 트랜잭션에 넣지 않는다. 채널 프로바이더 등록이 HTTP 호출이고 잠금 안에서는 HTTP 호출을 하지 않는다([트리거 관리 「동시 쓰기 직렬화」](../CLE-TRIG/CLE-TRIG-MANAGE.md#동시-쓰기-직렬화)). 채팅 채널의 비밀은 지금처럼 커밋 뒤 잠금 밖에서 쓰고 행이 없으면 되돌린다(규칙 9).
- 커밋 뒤 응답이 호출자에게 닿지 못하면 그 평문은 다시 받을 수 없다. 알림 서명 시크릿은 시크릿 교체(`rotate-secret`)로, `itk_*` 는 트리거 단위 토큰 재발급(`revoke-token`)으로 새로 받는다.

기각한 대안:

- **실패하면 만든 행을 지운다.** 지우는 일도 실패할 수 있다. 지우기 전까지 반쪽 행이 다른 요청에 보인다. 이미 커밋된 `trigger.created` 감사 행은 지운 트리거를 가리키게 된다.
- **커밋 뒤 단계로 두고 실패를 시크릿 교체로 복구하게 한다.** 반쪽 행이 남는 것은 그대로다. 호출자는 에러 응답만 보고 트리거가 생겼는지 알 수 없다. 다시 시도하면 위 충돌이 난다.
- **감사도 생성 트랜잭션 안에서 남긴다.** 같은 날의 첫 초안이 택한 안이다. `AuditLogsService.record` 는 매니저를 받지 않으므로 매니저 인자를 더해야 한다. 트랜잭션 안에서 감사 INSERT 가 실패하면 Postgres 트랜잭션 전체가 중단된다. 그러면 감사 실패를 흡수하는 계약을 지키려고 savepoint 로 감싸야 한다. 얻는 것은 커밋과 감사 사이의 짧은 창을 닫는 것뿐이고 PATCH 경로와도 달라진다. 근거는 [감사 로그 「트리거 생성의 감사 행은 커밋 직후 트랜잭션 밖에서 남긴다」](../CLE-OBS/CLE-OBS-AUDIT.md#트리거-생성의-감사-행은-커밋-직후-트랜잭션-밖에서-남긴다) 에 있다.

### R20. 재발급 실패 뒤 남는 행 서술을 롤백 구현에 맞췄다 (2026-11-12)

봇 토큰 재발급이 실패하면 그 요청이 시크릿 저장소에 쓴 행을 재발급 전 값으로 되돌리도록 구현이 바뀌었다(NERV Task `CLE-T-Q353Y4`). 그래서 [R10](CLE-INT-SECRET-REFS.md#r10-저장된-참조는-읽는-쪽도-다시-만들고-rotate-는-다른-워크스페이스의-행을-덮어쓰지-않는다-2026-10-04) 「거부가 채널 프로바이더 등록 뒤에 날 수 있다」 의 남는 행 서술을 정본 [채팅 채널 데이터와 흐름 「봇 토큰 라이프사이클」](../CLE-CHAT/CLE-CHAT-DATA.md#봇-토큰-라이프사이클) 에 맞췄다(NERV Task `CLE-T-X6WXFD`). 쓰기 순서와 «닫힌 쪽» 서술은 그대로 두었다.
