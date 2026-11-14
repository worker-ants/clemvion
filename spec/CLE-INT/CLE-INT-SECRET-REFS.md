---
id: "CLE-INT-SECRET-REFS"
title: "시크릿 저장소 — 참조 소유와 교차 행"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-INT-SECRET"
ancestors: ["CLE-VISION", "CLE-INT", "CLE-INT-SECRET"]
area: "CLE-INT"
content_hash: "ebf11554b9bc3201d5719a0fc0632929647a31d29f4b895fa94438c87e1bc046"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "a7280f3ad93e18c694b7827ef8bc98b464e733ff9d4b0c9112d43a7cec8c856e"
etag: "sha256-4644684813fb6721c0e41399553c672d9ba2dd9953d294d130db71c2105236e0"
---
## 개요

이 문서는 [시크릿 저장소](CLE-INT-SECRET.md) 의 하위 문서로 리소스 설정에 두는 시크릿 참조를 서버가 리소스 id 로 만드는 규칙(규칙 22~25)의 근거, 원시 `config` 거부의 근거, 저장된 교차 행의 점검 · 정리 절차를 정한다. 규칙 번호(규칙 N)는 부모 문서 [「규칙」](CLE-INT-SECRET.md#규칙) 의 번호다.

## 교차 행 점검과 정리

규칙 23 이 생기기 전에 저장된 행에는 두 가지가 남아 있을 수 있었다. 다른 트리거의 참조가 든 트리거 설정과, 다른 워크스페이스의 요청이 `rotate` 로 덮어쓴 비밀 행이다. 이 문서는 둘을 «교차 행» 이라 부른다. id 참조 교차 행은 [데이터 모델 개요 「저장된 교차 행 점검」](../CLE-PLAT/CLE-PLAT-DATA.md#저장된-교차-행-점검) 이 따로 본다.

2026-10-05 운영 DB 에서 점검 SQL 이 0 행이어서 점검 · 정리 SQL 을 걷었다(R10). 알려진 경로는 막혀 있다. 다른 트리거의 참조를 심는 입력은 규칙 23 이 막고, 다른 워크스페이스의 행을 덮어쓰는 `rotate` 는 규칙 25 가 막는다. 새 비밀 슬롯이 규칙 22 를 빠뜨리면 교차 행이 다시 생길 수 있다(R9). 남은 행 가운데 다른 트리거의 참조가 든 설정은 규칙 24 의 읽기 관문이 그 비밀을 쓰지 못하게 하고 에러 로그를 남긴다. 이미 덮어써진 비밀 행은 정리 전까지 소유자의 발송 · 검증에서 그대로 쓰인다(R10).

트리거 `config` 안의 비밀 참조는 컬럼이 아니라서 FK 대상이 아니다([데이터 모델 개요](../CLE-PLAT/CLE-PLAT-DATA.md#워크스페이스-범위-참조를-복합-fk-로도-막는다-2026-10-05) 의 «막지 않는 것»). 비밀 저장소 행에도 FK 를 두지 않는다([R4](CLE-INT-SECRET-BACKEND.md#r4-fk-를-두지-않는다)). 그래서 DB 가 막지 않는다. 교차 행이 다시 생기면 서버 로그로 드러난다. 규칙 24 의 참조 불일치 에러 로그, 규칙 25 의 `rotate` 거부 로그, 같은 요청에서 남는 `resolve` 실패 경고가 그 신호다. 운영자가 그 로그를 보거나 백업 복원처럼 옛 데이터를 되살렸으면 아래 순서를 따른다(근거는 R10). 점검 SQL `2026-10-04-trigger-secret-ref-audit.sql` 과 정리 SQL `2026-10-04-trigger-secret-ref-cleanup.sql` 은 저장소에는 없고 커밋 `d5cb730ec` 의 `codebase/backend/scripts/ops/` 에서 꺼낸다. 두 SQL 은 그 커밋 시점의 스냅샷이다. 지금 스키마와 트리거 설정 잠금 키(`trigger-config-lock.ts` 의 `TRIGGER_CONFIG_LOCK_PREFIX`)에 맞는지는 검증하지 않았다. 되살릴 때는 같은 커밋의 e2e 케이스(`trigger-stored-secret-refs.e2e-spec.ts` 의 점검 · 정리 케이스)도 되살려 지금 스키마에서 돌려 본다.

1. 점검 SQL 로 찾는다. 다른 워크스페이스가 덮어쓴 비밀 행과 다른 트리거를 가리키는 참조가 나온다. 출력에 비밀 값과 평문은 없다.
2. 정리 SQL 로 덮어쓴 비밀 행을 지우고 어긋난 참조를 트리거 id 로 만든 값으로 맞춘다.
3. 지운 행의 트리거 소유자에게 봇 토큰 · 알림 서명 시크릿 재발급을 안내한다. 덮어쓰기 전의 토큰이 다른 워크스페이스로 새었을 수 있으므로 채널 프로바이더 쪽에서도 새로 발급받는다. 다른 트리거를 가리키던 행이 있으면 가리켜진 트리거의 소유자에게도 알린다.
4. 참조 자리에 `secret://` 가 아닌 값이 든 행은 정리 SQL 이 건드리지 않는다. 평문이 들어 있을 수 있으니 소유자와 확인한 뒤 손으로 지우거나 참조로 바꾼다.

사람이 결과를 보고 돌리는 일회성 운영 SQL 은 마이그레이션이 아니고 규칙 3 · 13 의 대상이 아니다(R10).

## 구현 위치

- 규칙 23 의 시행: `codebase/backend/src/modules/triggers/trigger-config-internal-fields.ts`(원시 `config` 거부. 내부 필드 경로 목록 · 타입 키 · `secret://` 값을 `assertRawConfigAccepted` 가 본다), `codebase/backend/src/modules/triggers/triggers.service.ts`(`rotateBotToken` 의 참조 유도)
- 규칙 24 의 시행: `codebase/backend/src/modules/chat-channel/chat-channel-secret-refs.ts`(참조 유도와 읽기 관문), `codebase/backend/src/modules/triggers/notification-signing-secret-ref.ts`(알림 서명 참조 유도. 생성 · PATCH 의 첫 발급과 옛 평문 옮기기도 이 유도를 쓴다), `codebase/backend/src/modules/triggers/notification-signing-secret.ts`(첫 알림 서명 시크릿의 판정 `decideNotificationSigning` 과 서명 참조 얹기. 참조를 만드는 위 파일과 역할이 다르다). 관문을 쓰는 곳: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`, `codebase/backend/src/modules/hooks/hooks.service.ts`, `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`, `codebase/backend/src/modules/triggers/triggers.service.ts`(봇 토큰 재발급), `codebase/backend/src/modules/triggers/notification-signing-secret.service.ts`(알림 서명 승격), `codebase/backend/src/modules/external-interaction/notification-webhook.processor.ts`(알림 서명)
- 규칙 24 의 읽기 관문과 규칙 25 의 `rotate` 대조(저장된 교차 행): `codebase/backend/test/trigger-stored-secret-refs.e2e-spec.ts`

## Rationale

### R9. 리소스 설정의 시크릿 참조는 요청 본문으로 받지 않는다 (2026-10-04)

트리거 생성 · 수정 본문의 `config` 는 `@IsObject` 만 검사했다. 타입 필드 `chatChannel` 은 시크릿 참조와 평문을 막았지만 원시 `config.chatChannel` 과 `config.notification.signing` 은 그대로 저장됐다. `resolve` · `rotate` 는 참조만 보고 소유 워크스페이스를 확인하지 않는다. 그래서 다른 워크스페이스 트리거의 id 를 아는 사용자가 자기 트리거 `config` 에 그 트리거의 `botTokenRef` 를 심고 봇 토큰을 재발급하면 상대 트리거의 토큰이 덮어써졌다. 그 행의 `workspace_id` 도 공격자의 워크스페이스로 바뀌었다. 생성과 수정 두 경로 모두 e2e 로 재현했다(NERV Task `CLE-T-M9QKKX`).

- **거부를 택했다.** 견준 안은 둘이었다. (a) 자기 리소스 접두의 참조면 받는다. 생성 요청에는 아직 리소스 id 가 없어 이 검사가 의미가 없다. 접두만 보면 `bot-token` 슬롯에 `inbound-signing` 참조를 넣는 혼동도 통과한다. 타입 필드는 값과 상관없이 막으므로 같은 필드가 위치에 따라 다르게 동작한다. (b) 받은 값을 버리고 리소스 id 로 다시 만든다. 사용자가 보낸 값을 말없이 바꾸는 것은 [채팅 채널 「R-CC-21 PATCH 는 비밀을 쓰지 않는다」](../CLE-CHAT/CLE-CHAT-CORE.md#r-cc-21-patch-는-비밀을-쓰지-않는다) 가 기각한 «무시» 와 같은 모양이다.
- **400 으로 거부하고 조용히 지우지 않는다.** 같은 원시 `config` 의 옛 인라인 인증 키는 구현(`stripInlineAuthKeys`)이 저장 전에 지운다. 그 입력은 폐기됐고 남은 행에 있어도 코드가 무시한다([웹훅 「트리거 필드와 config」](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#트리거-필드와-config)). 그래서 지워도 사용자가 잃는 것이 없다. 시크릿 참조와 평문은 사용자가 무언가를 설정했다고 믿게 만드는 값이라 지우면 같은 «무시» 가 된다. 전역 파이프의 `forbidNonWhitelisted`(모르는 키는 400)와도 같은 방향이다.
- **거부 대상은 경로 목록이 기본이다. R16 이 타입 키와 `secret://` 값 검사를 더했다.** 원시 `config` 의 `chatChannel` · `notification` · `interaction` 키를 통째로 막는 안도 있었다. 그 안은 원시 `config` 의 다른 계약(옛 평문 `notification.signing.secret` 입력 등)을 함께 바꾸므로 사람 결정으로 이번 범위에서 뺐다(NERV Task `CLE-T-EA7B5M`). `chatChannel` 쪽은 타입 필드의 차단 필드 단일 기준에서 유도한다. `notification.signing.secretRef` 는 목록에 직접 적었다. 새 참조 슬롯이 생기면 사람이 목록에 더해야 하고(규칙 22) 그것을 잡는 구조적 가드는 없다. 원시 `config` 아래의 `secret://` 값을 직접 거르는 안이 후보이고 같은 Task 가 검토한다. 2026-10-31 에 사람이 세 키를 통째로 막는 안과 `secret://` 값 검사를 채택했다. 경로 목록은 그대로 두고 두 검사보다 먼저 돈다([R16](#r16-원시-config-의-타입-키와-secret-값을-막는다-2026-10-31)).
- **다시 만드는 것은 쓰기 경로뿐이다.** 봇 토큰 재발급은 저장된 참조를 믿지 않고 리소스 id 로 참조를 만든다. 채널 프로바이더 재등록에 넘기는 설정도 같다. 단 저장된 행에 `inboundSigningRef` 가 없으면 전처럼 넣지 않는다. 구현(`chat-channel-inbound-authenticator.ts`)은 그 참조가 없는 행에서 인바운드 서명 검증을 건너뛰므로(현행 동작은 [채팅 채널 데이터 「인바운드 서명 자료 참조가 없는 행」](../CLE-CHAT/CLE-CHAT-DATA.md#인바운드-서명-자료-참조가-없는-행) 에 있다) 없는 행에 참조를 붙이면 검증 동작이 바뀐다. 정상 행의 참조는 같은 규칙으로 만든 값이라 결과가 같다. 저장 경계가 막기 전에 저장된 행에서 다른 리소스의 비밀을 읽거나 덮어쓰지 않게 하는 방어다. «쓰기 경로뿐» 은 이 결정 때의 범위다. 읽기 경로는 R10 이 같은 규칙으로 넓혔다.
- **막는 자리를 호출자로 두었다.** `resolve` 는 참조만 받으므로 소유 확인을 넣으려면 시그니처가 바뀌어 규칙 21 에 따라 네 소비 모듈을 같은 변경에서 고쳐야 한다. `rotate` 는 이미 `workspaceId` 를 받으므로 기존 행의 `workspace_id` 가 다르면 거부하는 확인은 시그니처를 바꾸지 않는다. 다만 지금 계약은 UPSERT 가 `workspace_id` 까지 덮어쓰는 것이고 호출자가 그 실패를 처리하지 않는다. 그 의미를 바꾸는 일은 읽기 경로 방어와 함께 정한다(아래 «남긴 것»). 이번에는 입력 경계와 쓰기 경로를 닫는 것으로 범위를 좁혔다. 그 의미는 R10 이 정했다.
- **채팅 채널의 PATCH 비밀 결정과 다른 축이다.** 원시 `config` 거부는 필드를 누가 소유하는가를 기준으로 한다. [채팅 채널 「R-CC-21 PATCH 는 비밀을 쓰지 않는다」](../CLE-CHAT/CLE-CHAT-CORE.md#r-cc-21-patch-는-비밀을-쓰지-않는다) 의 «PATCH 요청자가 자기 비밀로 값을 바꾸는가» 와 다른 축이라 그 결정(서명 자료 재발급 등)과 독립이다.
- **남긴 것**: 이미 저장된 행의 읽기 경로 방어, `rotate` 의 워크스페이스 대조, 운영 데이터 점검은 R10 이 정했다(NERV Task `CLE-T-XYR067`). 원시 `config` 의 다른 계약(타입 키를 원시 `config` 로 받는 경로, `config` 교체 의미, `interaction.triggerToken`)은 이 결정 밖이었다. `interaction.triggerToken` 경로는 2026-10-17 에(NERV Task `CLE-T-EQDYC1`), 나머지는 2026-10-31 에 [R16](#r16-원시-config-의-타입-키와-secret-값을-막는다-2026-10-31) 이(NERV Task `CLE-T-EA7B5M`) 닫았다.

### R10. 저장된 참조는 읽는 쪽도 다시 만들고 rotate 는 다른 워크스페이스의 행을 덮어쓰지 않는다 (2026-10-04)

R9 가 요청 본문을 막은 뒤에도 그 전에 저장된 행은 남는다. 다른 트리거의 참조가 든 행이 있으면 메시지 발송, 인바운드 서명 검증, 트리거 삭제 때의 채널 프로바이더 해제, 알림 서명이 그 트리거의 비밀로 동작했다. 피해자 Slack 서명 비밀로 서명한 요청이 교차 행이 있는 다른 워크스페이스 트리거의 인바운드 검증을 통과하는 것을 e2e 로 재현했다. `rotate` 는 다른 워크스페이스의 행을 덮어쓰며 `workspace_id` 까지 넘겼다(R9 의 재현, NERV Task `CLE-T-XYR067`).

- **저장 경계(규칙 23)가 1차 방어이고 이것은 이미 저장된 데이터를 위한 2차 방어다.** [데이터 모델 개요](../CLE-PLAT/CLE-PLAT-DATA.md) 의 «본문 참조 id 도 저장 전에 소속을 본다» 는 읽는 자리마다 필터를 두는 모양을 기각했다. 그 기각은 1차 방어를 그렇게 두는 안에 대한 것이다. 여기서는 1차 방어가 이미 저장 경계에 있고 남은 행을 위해 관문을 하나 둔다. 저장된 채팅 채널 설정을 채널 어댑터와 인바운드 인증기에 넘기는 곳(아웃바운드 발송, 인바운드 처리, 트리거 삭제의 해제)은 읽기 관문(`readTriggerChatChannelConfig`)을 지난다. 봇 토큰 재발급은 같은 규칙의 `pinChatChannelSecretRefs` 를 지난다. 두 참조를 만드는 곳은 `chatChannelSecretRef` 하나이고 알림 서명 참조를 만드는 곳은 `notificationSigningSecretRef` 하나다. 새 소비 지점이 관문을 지나는지 보는 정적 가드는 두지 않았다. 읽는 곳이 넷뿐이고 1차 방어가 저장 경계에 있기 때문이다. 새 슬롯은 규칙 22 가 관문에 더하게 하고 리뷰가 본다. 가드는 후속 Task 의 선택 항목으로 올렸다(NERV Task `CLE-T-VRBS51`).
- **견준 안은 셋이었다.** (a) 참조의 scope · resourceId 만 대조하고 다르면 쓰지 않는다. 이 Task 계획 초안의 안이다(구현하지 않은 `isSecretRefOwnedBy`, 알림 웹훅은 서명하지 않고 `degraded`). 접두 대조는 R9 의 (a) 가 지적한 슬롯 혼동을 못 막고 채팅 채널과 알림 웹훅이 다르게 동작한다. 다른 참조를 «없음» 으로 다루면 인바운드 서명 검증이 열린다. (b) `resolve` 가 소유 리소스를 인자로 받는다. R9 「막는 자리를 호출자로 두었다」 가 든 안이다. 규칙 21 에 따라 네 소비 모듈을 같은 변경에서 고쳐야 한다. 비밀을 푸는 채널 어댑터 함수는 트리거 id 를 받지 않으므로 [채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md) 의 인터페이스도 바뀐다. (c) 채널 어댑터 안에서 대조한다. 이 Task 의 착수 전 검토가 든 층이고 (b) 와 같은 이유로 인터페이스가 바뀐다. 그래서 «있음 · 없음만 읽고 값은 다시 만든다» 를 택했다. 봇 토큰 재발급(R9)과 같은 규칙이라 정본이 하나다.
- **R9 의 (b) 기각과 축이 다르다.** R9 가 기각한 «받은 값을 버리고 다시 만든다» 는 사용자가 보낸 입력을 말없이 바꾸는 일이다. 여기서 다시 만드는 것은 저장된 행이다. 정상 행은 같은 규칙으로 만든 값이라 결과가 같고 교차 행은 에러 로그로 드러난다.
- **있음 · 없음은 그대로 둔다.** 인증기는 `inboundSigningRef` 가 없으면 검증을 건너뛴다. R9 가 가리키는 현행 동작이고 [채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md) 은 이 필드를 필수라 적는다. 이 알려진 불일치는 이번에 바꾸지 않는다. 있는 참조를 지우면 검증이 열리고 없는 참조를 붙이면 검증 동작이 바뀌므로 둘 다 하지 않는다. 자기 비밀이 없는 교차 행은 `resolve` 실패로 닫힌다. «있음» 의 판정은 채팅 채널과 알림 서명이 다르다(규칙 24). 알림 서명은 종전부터 `secret://` 형식이 아닌 값을 무시하고 옛 평문으로 내려갔고 이번에 그 판정을 바꾸지 않았다.
- **`rotate` 는 행의 `workspace_id` 와 인자만 대조한다.** 리소스 테이블을 보지 않으므로 scope 와 무관하고 다른 백엔드도 같은 의미를 낼 수 있다(R2 · R4). 애플리케이션 경로에서는 한 번 들어간 행의 `workspace_id` 가 이제 바뀌지 않으므로 대조와 갱신 사이의 경합이 없다. 거부는 클라이언트가 분기할 조건이 아니라서 [에러 코드 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 의 «새 조건은 새 코드» 로 새 코드를 만들지 않았다. 고칠 수 있는 쪽이 운영자라 5xx 다([채팅 채널 「R-CC-23 setupChannel 실패는 전송 방식이 아니라 원인으로 분류한다」](../CLE-CHAT/CLE-CHAT-CORE.md#r-cc-23-setupchannel-실패는-전송-방식이-아니라-원인으로-분류한다) 의 기준). 다른 워크스페이스에 그 참조가 있다는 사실을 코드로 가르지 않는 것은 [데이터 모델 개요](../CLE-PLAT/CLE-PLAT-DATA.md) 의 «없는 id 와 다른 워크스페이스의 id 를 구분하지 않는다» 와 같은 방향이다. 예외 메시지에 참조와 «다른 워크스페이스» 를 싣지 않는 것은 채팅 채널 설정이 실패 메시지를 화면에 보이는 `chat_channel_last_error` 에 저장하기 때문이다(규칙 4).
- **교차 행의 소유자는 정리 뒤에 다시 쓴다.** 거부는 이미 교차 행이 된 비밀의 진짜 소유자도 막는다. 종전에는 소유자의 재발급이 행을 덮어써 소유가 돌아왔다. 그 행의 내용은 다른 워크스페이스의 요청이 쓴 값이라 `workspace_id` 만 되돌려서는 믿을 수 없다. 암호문의 AAD 가 참조라 다른 행으로 옮겨 살릴 수도 없다. 그래서 배포 전에 점검 SQL 로 찾고 정리 SQL 로 지운 뒤 소유자가 재발급하는 순서를 택했다(사람 결정, 2026-10-04). 이 Task 의 착수 전 검토는 마이그레이션으로 자동 보정하거나 마이그레이션을 멈추는 선례도 들었다. 택하지 않은 것은 덮어써진 비밀을 SQL 로 되살릴 수 없어 어느 쪽이든 소유자의 재발급이 필요하기 때문이다. 데이터를 지우는 판단은 사람이 점검 결과를 본 뒤에 하는 편이 맞다. 정리 전까지 교차 행이 된 비밀은 소유자의 발송 · 검증에서도 그대로 쓰인다. 이 상태를 닫는 것은 운영 정리다.
- **정리 SQL 은 규칙 3 · 13 밖의 일회성 절차다.** 규칙 3 은 도메인 모듈이 `SecretResolver` 로 읽고 쓰게 하고 규칙 13 은 워크스페이스 조건 삭제를 인터페이스에 두지 않게 한다. 둘 다 애플리케이션 경로의 규칙이다. 다른 워크스페이스 행을 열거하고 지우는 일을 인터페이스로 열면 규칙 21 에 따라 소비 모듈을 함께 고쳐야 한다. 한 번만 할 일이 계속 열린 표면으로 남는다. 그래서 사람이 돌리는 SQL 로 두고 점검이 모든 운영 환경에서 비면 걷는다. 2026-10-05 에 걷었다(아래).
- **거부가 채널 프로바이더 등록 뒤에 날 수 있다.** 봇 토큰 재발급, 최초 설정, Telegram 의 `chatChannel` PATCH 는 채널 프로바이더에 새 서명 자료를 등록한 뒤 `inbound-signing` 을 `rotate` 한다. [채팅 채널 「R-CC-21 PATCH 는 비밀을 쓰지 않는다」](../CLE-CHAT/CLE-CHAT-CORE.md#r-cc-21-patch-는-비밀을-쓰지-않는다) 이 이 저장을 등록과 한 동작으로 정한 이유(건너뛰면 인바운드가 모두 401)가 교차 행에서는 거부로 다시 생긴다. 등록 뒤에 거부되면 인바운드가 401 로 닫힌다. 재발급은 500 으로, 최초 설정과 PATCH 는 `degraded` 와 `chat_channel_last_error` 로 드러난다. 재발급은 [채팅 채널 데이터와 흐름 「봇 토큰 라이프사이클」](../CLE-CHAT/CLE-CHAT-DATA.md#봇-토큰-라이프사이클) 의 ⑤ 에서 거부되면 앞 단계에서 쓴 행을 재발급 전 값으로 되돌린다. 기본 참조는 재발급 전 토큰으로 돌아온다. `bot-token.v2` 행은 재발급 전에 없었으면 지워진다. 유예 중이었으면 그 옛 토큰으로 돌아온다. 거부된 `inbound-signing` 쓰기는 되돌리지 않으므로 다른 워크스페이스의 그 행은 그대로다. 채널 프로바이더 등록은 되돌리지 않는다. 쓰기 순서는 규칙 11 의 «백업한 뒤 기본 참조» 를 따르므로 바꾸지 않았다. 등록 전에 대조하려면 인터페이스에 메서드를 더해야 해서 이번에는 운영 정리를 먼저 하는 순서로 막는다. 남는 상태는 닫힌 쪽이다.
- **반복 배치는 거부된 리소스만 건너뛴다.** 알림 서명 시크릿 승격은 실패를 다시 던져 job 재시도에 맡긴다. 워크스페이스 불일치는 재시도해도 같으므로 그 트리거만 건너뛰고 에러 로그를 남긴다. 알림 서명 비밀 행은 쓰는 쪽(설정 정규화, 승격)이 늘 트리거 id 로 참조를 만들어 왔으므로 교차 행이 생긴 경로가 없고 이 분기는 방어용이다. 만나면 그 트리거의 `notification_secret_v2` 평문과 두 키 서명이 정리 뒤 다음 승격까지 남는다([저장소 예외 필드](CLE-INT-SECRET-EXPOSE.md#저장소-예외-필드) 근거 1 · 2 의 한계).
- **로그는 발생할 때마다 남긴다.** 교차 행이 인바운드를 받을 때마다 남지만 같은 요청이 이미 `resolve` 실패 경고를 남기므로 로그 양의 등급은 같다. 참조 불일치 로그에는 저장값을 싣지 않는다. 참조 자리에 평문이 들어 있을 수 있어서다.
- **이번에 정하지 않은 것.** [채팅 채널 「R-CC-21 PATCH 는 비밀을 쓰지 않는다」](../CLE-CHAT/CLE-CHAT-CORE.md#r-cc-21-patch-는-비밀을-쓰지-않는다) 이 따로 검토하기로 한 `rotate` 의 빈 값 가드는 이번에도 넣지 않는다. 대조하지 않는 소비 지점도 있다. 봇 토큰 유예 정리와 해지는 서버만 쓰는 `chat_channel_token_v2` 컬럼의 참조를 쓴다. `delete` · `exists` · `deleteByPrefix` 는 참조만 본다([`SecretResolver` 인터페이스](CLE-INT-SECRET-BACKEND.md#secretresolver-인터페이스)). 채팅 채널 활성화가 `setupChannel` 을 부르게 되면([채팅 채널 「봇 토큰 변경 단일 경로」](../CLE-CHAT/CLE-CHAT-CORE.md#봇-토큰-변경-단일-경로)) 그 경로도 읽기 관문을 지나야 한다. 실행 시점의 트리거 · 워크플로우 워크스페이스 대조는 [데이터 모델 개요 「저장된 교차 행 점검」](../CLE-PLAT/CLE-PLAT-DATA.md#저장된-교차-행-점검) 이 정했다(2026-10-05). 원시 `config` 의 나머지 계약은 [R16](#r16-원시-config-의-타입-키와-secret-값을-막는다-2026-10-31) 이 정했다.
- **점검과 정리를 걷었다 (2026-10-05).** 배포 뒤 운영 DB(운영 환경은 이 한 곳이고 셀프 호스팅 배포는 아직 없다, 사람 확인)에서 점검 SQL 이 0 행이었다. 위 순서는 배포 전에 점검하도록 정했지만 실제 점검은 배포 뒤였다. 정리할 행이 없어 정리 SQL 은 돌리지 않았고 재발급도 필요 없었다. 그래서 위 «정리 SQL 은 규칙 3 · 13 밖의 일회성 절차다» 의 걷는 조건이 채워져 두 SQL 과 그 SQL 을 돌리던 e2e 케이스를 걷었다(NERV Task `CLE-T-N0RHDZ`). 위 순서와 설계는 그대로이고 교차 행이 다시 나타나면 같은 순서를 따른다(「교차 행 점검과 정리」). «정리 뒤 소유자가 다시 재발급할 수 있다» 를 확인하는 테스트는 지금 없다.

### R16. 원시 `config` 의 타입 키와 `secret://` 값을 막는다 (2026-10-31)

R9 는 원시 `config`(트리거 생성 · 수정 본문의 `config` 키)에 실린 시크릿 참조를 경로 목록으로 막았다. 세 타입 키를 통째로 막는 안은 원시 `config` 의 다른 계약을 함께 바꾸므로 NERV Task `CLE-T-EA7B5M` 으로 넘겼다. 2026-10-31 에 사용자가 그 Task 의 질문에 답해 아래를 정했다. 결정 전체와 기각안 · 근거의 정본은 [트리거 관리 「원시 `config` 계약 (2026-10-31)」](../CLE-TRIG/CLE-TRIG-MANAGE.md#원시-config-계약-2026-10-31) 이다. 이 규약에는 시크릿에 닿는 부분만 적는다.

- **타입 키를 받지 않는다.** 원시 `config` 바로 아래에 `notification` · `interaction` · `chatChannel` 키가 있으면 값과 상관없이 400 이다. R9 가 범위에서 뺀 안이다. 기각이 아니라 유보였고 이번에 채택했다. 이 결정으로 옛 평문 `notification.signing.secret` 을 새로 받는 경로가 닫혔다. 그 키는 원시 `config` 로만 들어왔기 때문이다. 견준 두 안은 `notification` 만 계속 받는 안과 세 키를 받되 요청 본문의 최상위 타입 필드와 같은 검사를 거치게 하는 안이었다. 둘 다 옛 평문 입력 경로를 남긴다.
- **`secret://` 값은 위치와 상관없이 거부한다.** 원시 `config` 아래 어디든(중첩 객체 · 배열 원소 포함) `secret://` 로 시작하는 문자열 값이 있으면 400 이다. 경로 목록은 사람이 더하는 목록이라 새 참조 슬롯을 빠뜨려도 테스트가 실패하지 않는다. R9 가 남긴 위험이고 규칙 22 가 사람에게 맡긴 일이다. 타입 키 거부로 그 아래 슬롯은 모두 막히지만 다른 키 아래에 참조를 심는 경로는 남는다. 값 검사는 슬롯 이름과 상관없이 잡는다. 경로 목록 거부는 그대로 두고 먼저 돈다. 견준 안은 값 검사를 더하지 않고 경로 목록만 두는 것이었다.
- **이미 저장된 옛 평문은 계속 읽고 옮긴다.** 닫은 것은 새로 받는 경로뿐이다. 저장된 행의 옛 평문 `signing.secret` 은 발송 때 서명에 쓰고 PATCH 가 시크릿 저장소로 옮긴다. 지우면 수신 측이 쓰던 시크릿이 유예 없이 바뀐다. 그래서 규칙 14 의 알려진 예외는 그런 행으로 좁혀졌고, [저장소 예외 필드 「`Trigger.config.interaction.triggerToken`」](CLE-INT-SECRET-EXPOSE.md#triggerconfiginteractiontriggertoken-2026-08-16-결정) 끝 단락의 비대칭 근거는 그 전에 호출자가 고른 평문이 남아 있다는 사실로 바뀌었다. 규칙 9 의 되돌리기 경우는 «저장된 옛 평문을 옮기는 PATCH 정규화» 가 되었다. 그런 행에 남은 옛 평문은 저장소 밖에 사는 필드라 규칙 4 의 응답 비노출 목록에 더했다(구현은 전부터 `triggers.service.ts` 의 `NOTIFICATION_SIGNING_STRIP_KEYS` 로 걷어 냈다).
- **원시 `config` 는 `config` 바로 아래 키 단위로 병합한다.** 종전 구현은 `config ?? fresh.config` 라 원시 `config` 를 보낸 PATCH 가 저장된 `config` 를 통째로 바꿨다. 그래서 저장된 `chatChannel.inboundSigningRef` · `notification.signing.secretRef` 가 지워질 수 있었다. 이제 타입 키는 원시 `config` 로 바뀌지 않아 저장값이 남는다. 통째 교체를 계약으로 남기는 안은 `inboundSigningRef` 가 사라지면 인바운드 서명 검증이 열리므로 택하지 않았다. 병합 규칙은 [트리거 관리 「PATCH 본문 계약」](../CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약) 이 정한다.

R9 「남긴 것」 과 R10 「이번에 정하지 않은 것」 이 이 Task 로 넘긴 원시 `config` 계약은 여기서 닫혔다.
