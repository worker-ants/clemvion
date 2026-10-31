---
id: "CLE-INT-SECRET"
title: "시크릿 저장소"
type: "convention"
version: 11
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-INT"
ancestors: ["CLE-VISION", "CLE-INT"]
area: "CLE-INT"
content_hash: "b4196fb2e56f033899881ad8616fda934ac9abe026cfaa4579bf3cb5150d7658"
read_as: "approved_fallback"
task: "CLE-T-EA7B5M"
source_paths: ["spec/conventions/secret-store.md"]
mirror_sha256: "14dc7b8ad1269b03edc87f9dcacf4338fd468f156802daff87b4648802ab0f55"
etag: "sha256-110ea7796fa1aa087cbbdccb27e363a7aec433672b27fa481ef5419e1e920c6c"
---
> 구현 상태: 구현됨 · 원문: `spec/conventions/secret-store.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 규약은 외부 provider 비밀(텔레그램 봇 토큰, 웹훅 `secret_token`, EIA 알림 웹훅 HMAC 서명 시크릿 등)을 보관하는 추상화인 시크릿 저장소(SecretStore, `secret_store`)를 정한다. 비밀은 시크릿 참조(secret ref, `secret://<scope>/<resourceId>/<name>`)로 가리키고, 읽고 쓰기는 `SecretResolver` 한 곳으로만 한다. 저장 백엔드는 PostgreSQL 에 애플리케이션이 AES-256-GCM 으로 암호화한 값을 두는 방식이다.

도메인 모듈은 비밀을 이 규약의 `SecretResolver` 로 읽고 쓴다. 예외는 [저장소 예외 필드](#저장소-예외-필드) 에 이름을 올린 필드뿐이고, 예외마다 자기 근거를 따로 세운다. 한 예외의 근거를 다른 예외에 빌려 쓰지 않는다.

현재 통합 자격 증명(`Integration.credentials`)은 이 저장소를 쓰지 않는다. 통합 엔티티의 컬럼 transformer 가 직접 암호화한다([통합 데이터와 흐름](CLE-INT-DATA.md)). 이 필드를 저장소 예외로 올릴지는 [미결 사항](#미결-사항) 에 있다.

범위 밖:

- `secret_store` 테이블 컬럼 정의는 [통합 데이터와 흐름](CLE-INT-DATA.md) 이 소유한다.
- 사용자 민감 컬럼의 응답 노출 금지는 [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) 이 소유한다. 같은 금지와 같은 근거가 걸리지만 그 컬럼들은 provider 비밀이 아니고 `secret://` 에 살지 않는다. 이 규약의 관할을 그쪽으로 넓히지 않는다.
- 인증 설정(AuthConfig) 응답 마스킹은 [외부 호출 인증 설정](../CLE-TRIG/CLE-TRIG-AUTHCFG.md) 과 [트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md) 이 소유한다.
- 봇 토큰 재발급 동작은 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md), 알림 서명 시크릿 교체 동작은 [EIA 알림 웹훅](../CLE-IX/CLE-EIA-NOTIFY.md) 이 소유한다.
- 트리거 행이 없어지는 경로 목록은 [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) 가 소유한다.

## 규칙

1. 시크릿 참조는 `secret://<scope>/<resourceId>/<name>` 형식이다. `scope` 는 자원 namespace 로 lower-case kebab-case(예: `triggers`, `oauth-clients`)다. `resourceId` 는 UUID v4 또는 다른 스펙이 정한 ID 형식이다. `name` 은 자원 안 비밀 이름으로 lower-case kebab-case(예: `bot-token`, `inbound-signing`, `notification-signing`, `bot-token.v2`)다. DB 도 같은 형식을 CHECK 로 막는다([저장 백엔드](#저장-백엔드)).
2. `name` 끝의 `.v2` 는 같은 자원의 24시간 유예용 변형이다. 현재 쓰는 곳은 채팅 채널 봇 토큰 재발급([채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) CCH-SE-04)뿐이다. EIA 알림 서명 시크릿 교체는 `.v2` 참조를 쓰지 않는다([저장소 예외 필드](#저장소-예외-필드)).
3. 도메인 모듈은 비밀을 `SecretResolver` 로 읽고 쓴다. 예외는 [저장소 예외 필드](#저장소-예외-필드) 에 올린 필드뿐이며, 예외를 올릴 때 그 필드만의 근거를 적는다.
4. 저장소 예외 필드는 **저장 위치**의 예외일 뿐 **노출**의 예외가 아니다. 저장소 밖에 사는 필드(`AuthConfig.config` 자격 증명의 평문, `Trigger.config.interaction.triggerToken`, `Trigger.notification_secret_v2`, 시크릿 저장소로 옮기기 전의 옛 평문 `Trigger.config.notification.signing.secret`)와 시크릿 참조(`Trigger.chat_channel_token_v2`, `config.*.botTokenRef`, `config.*.inboundSigningRef`, `config.notification.signing.secretRef`)는 응답 DTO 에 선언해서도, 응답 바디에 실어서도 안 된다. 참조도 대상이다. 평문은 아니지만 내부 저장 위치를 드러낸다. 인증 설정 응답이 싣는 마스킹된 값(`***<last4>`)은 평문이 아니므로 이 금지의 대상이 아니다. 그 응답 모양은 [외부 호출 인증 설정 「필드 마스킹과 평문 보기」](../CLE-TRIG/CLE-TRIG-AUTHCFG.md#필드-마스킹과-평문-보기) 가 정한다. 이 금지의 예외는 아래 응답뿐이다. 이 응답들은 이 규약이 이름 붙인 필드의 값이나 이름 붙인 참조가 가리키는 값의 평문을 한 번 싣는다. 평문 보기를 빼면 모두 그 값을 만든 바로 그 응답이다. 새 면제는 이 목록에 응답을 더해야 생긴다. 응답 모양은 각 응답을 소유한 문서가 정한다.
   - 트리거 생성 응답과 PATCH 응답 가운데 서버가 첫 알림 서명 시크릿을 발급한 응답은 그 평문을 `data.secrets.notificationSigningSecret` 에 싣는다([트리거 관리 「API」](../CLE-TRIG/CLE-TRIG-MANAGE.md#api)).
   - 트리거 생성 응답과 PATCH 응답 가운데 서버가 트리거 단위 토큰을 발급한 응답은 `Trigger.config.interaction.triggerToken` 에 들어가는 새 `itk_*` 를 `data.secrets.interactionToken` 에 싣는다([트리거 관리 「API」](../CLE-TRIG/CLE-TRIG-MANAGE.md#api)). 토큰은 지금처럼 `config.interaction.triggerToken` 에 두고 이 응답에만 한 번 싣는다.
   - 시크릿 교체(`rotate-secret`) 응답은 `Trigger.notification_secret_v2` 에 들어가는 새 알림 서명 시크릿을 `data.secret` 에 싣는다.
   - 트리거 단위 토큰 재발급(`revoke-token`) 응답은 `Trigger.config.interaction.triggerToken` 에 들어가는 새 `itk_*` 를 `data.token` 에 싣는다.
   - 인증 설정 생성 · 키 재생성 응답은 평문 `config` 를 싣는다([외부 호출 인증 설정 「필드 마스킹과 평문 보기」](../CLE-TRIG/CLE-TRIG-AUTHCFG.md#필드-마스킹과-평문-보기)).
   - 인증 설정 평문 보기(`POST /api/auth-configs/:id/reveal`) 응답은 평문 `config` 를 싣는다. 값을 만든 응답이 아닌 유일한 항목이다. 비밀번호 재확인과 감사 기록을 거친 요청에만 한 번 싣는다([외부 호출 인증 설정 「평문 보기 흐름」](../CLE-TRIG/CLE-TRIG-AUTHCFG.md#평문-보기-흐름)).
5. 규칙 4 는 두 축으로 시행한다. [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 의 응답-계약 검증(선언하지 않은 키를 위반으로 본다)과 [OpenAPI 문서화](../CLE-API/CLE-API-SWAGGER.md) 의 엔티티 패스스루 금지다. 규칙 4 의 예외 응답도 이 검증을 받는다. 그래서 평문을 싣는 필드는 그 응답의 DTO 에 선언한다. 같은 DTO 가 평문을 싣지 않는 응답에도 쓰이면 그 필드는 선택 필드로 선언하고 [HTTP API 규약 §5.5](../CLE-API/CLE-API-CONV.md#55-부재-표현-null-과-키-생략) 기준 (b) 사유를 적는다.
6. 엔티티를 그대로 반환하는 경로에서는 응답 경계에서 지운다. 컬럼 수준 `select: false` 는 쓰지 않는다. 그 컬럼을 읽는 내부 경로(교체 승격, 정리 스윕)가 예외 없이 `undefined` 를 받아 조용히 오작동하기 때문이다.
7. 트리거를 만들 때(알림 웹훅·채팅 채널 설정 포함)와 PATCH 가 EIA 알림 웹훅 설정을 처음 붙일 때 비밀 저장은 `rotate(ref, workspaceId, plaintext)` 를 쓴다. PATCH 가 저장된 행의 옛 평문 `signing.secret` 을 시크릿 저장소로 옮길 때도 `rotate` 를 쓴다. UPSERT 라 같은 워크스페이스에서 설정을 다시 시도해도 안전하다(다른 워크스페이스의 행은 규칙 25). `store()` 도 결과는 같지만 같은 참조가 이미 있을 때의 동작(덮어쓰기 또는 throw)이 백엔드 구현에 따라 달라질 수 있다.
8. 트리거 행이 없어질 때(트리거·스케줄·워크플로우·워크스페이스 삭제) 그 트리거의 모든 참조를 `deleteByPrefix('secret://triggers/{id}/')` 로 한꺼번에 지운다. 행 삭제가 커밋된 **뒤에** 지운다. provider 정리 작업이 이 비밀을 읽으므로 먼저 지울 수 없고, 행 삭제 전에 지우면 그 사이 커밋된 쓰기가 남긴 비밀을 아무도 지우지 않는다. DB FK 가 없으므로 애플리케이션 책임이다. 개별 `delete()` 보다 prefix 삭제를 쓴다.
9. 트리거 락 밖에서 비밀을 쓴 뒤 락 안 재기록이 행 부재로 실패하면 `deleteByPrefix('secret://triggers/{id}/')` 로 되돌린다. 채팅 채널 설정과 저장된 옛 평문을 옮기는 PATCH 정규화(`migrateLegacyPlaintext`)가 이 경우다. 트리거 락 안에서 비밀을 쓰는 경로(생성 · PATCH 의 첫 알림 서명 시크릿 발급과 옛 평문 옮기기, 시크릿 승격)는 그 락을 쥔 트랜잭션의 매니저로 쓴다. 그래서 풀 연결을 더 쓰지 않는다. 그 트랜잭션이 예외로 끝나면 비밀 쓰기도 함께 롤백되므로 따로 되돌릴 것이 없다. 생성은 행을 넣은 트랜잭션 안에서 쓴다. 커밋 전의 행은 다른 트랜잭션이 지우지 못하므로 행 부재가 생기지 않는다. 남는 것은 시크릿 승격이다. 워크플로우 · 워크스페이스 삭제의 FK CASCADE 는 이 락을 거치지 않아 락 안에서도 행이 사라질 수 있다. 그때 승격의 `config` 쓰기는 예외 없이 0행으로 끝나고 비밀 쓰기는 커밋된다. 그래서 커밋 뒤 같은 prefix 로 되돌린다. 규칙 8 과 짝이다. 행이 없으므로 prefix 전체를 지워도 안전하다([트리거 관리 「동시 쓰기 직렬화」](../CLE-TRIG/CLE-TRIG-MANAGE.md#동시-쓰기-직렬화)).
10. 외부 API 호출 직전(메시지 전송, HMAC 서명 등)에는 매번 `resolve(ref)` 로 값을 가져온다. 캐싱 여부는 `SecretResolver` 내부가 정한다.
11. 비밀 교체도 `rotate()`(UPSERT)로 쓴다. 채팅 채널 봇 토큰 재발급은 옛 토큰을 `bot-token.v2` 참조에 `rotate` 로 백업한 뒤 기본 참조(`bot-token`)를 새 토큰으로 `rotate` 한다([봇 토큰 재발급](#봇-토큰-재발급)). `.v2` 참조에 새 값을 쓰는 교체는 현재 없다.
12. `deleteByPrefix` 의 prefix 는 `secret://` 로 시작해야 한다. LIKE 메타문자(`%`·`_`·`\`)가 들어 있으면 throw 한다. 구현은 `ref LIKE :prefix` 에 `` `${prefix}%` `` 를 바인딩하고 `ESCAPE` 절을 두지 않는다. `ESCAPE` 절이 없다는 것도 계약의 일부다.
13. `secret_store.workspace_id` 를 조건으로 지우는 경로는 두지 않는다. 워크스페이스 삭제도 트리거 단위 prefix 로 정리한다. 인터페이스에 워크스페이스 단위 삭제가 없고, 백엔드를 규약 변경 없이 바꿀 수 있어야 하기 때문이다. 트리거 설정 잠금 안에서 시크릿 저장소에 쓰는 경로는 이 전제의 예외다([다른 백엔드로 바꾸기](#다른-백엔드로-바꾸기)). 워크스페이스 삭제가 정리할 트리거를 빠짐없이 모으는 방법은 [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) 가 정한다. 사람이 돌리는 일회성 운영 SQL 은 이 규칙의 대상이 아니다(R10).
14. 평문과 마스터키는 애플리케이션 메모리 안에만 존재한다. DB 쿼리, SQL 파라미터, 로그, 메트릭에 절대 내보내지 않는다. DB 는 항상 암호문만 본다. 저장소 예외 필드(규칙 3) 밖에서 알려진 예외가 하나 남아 있다. 이미 저장된 행에 남은 옛 평문 `notification.signing.secret` 이다. 이 평문을 새로 받는 경로는 2026-10-31 에 닫혔다. 요청 본문의 `config` 키 아래(원시 `config`)는 `notification` 키를 받지 않는다([트리거 관리 「PATCH 본문 계약」](../CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약)). 그 전에 저장된 평문은 시크릿 저장소로 옮겨지거나 지워질 때까지 트리거 `config` JSONB 에 남는다(지우는 경로는 시크릿 교체 승격과 참조가 있는 행에 `notification` 을 실은 PATCH 다). 옮기다 실패해도 남는다. 옮기는 시점은 [EIA 알림 웹훅 「시크릿 교체」](../CLE-IX/CLE-EIA-NOTIFY.md#시크릿-교체) 와 [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) 이 정한다. 외부 API 호출이 실패해 호출한 모듈이 만든 실패 문장에 평문이 실리면 그 모듈이 문장을 만든 자리에서 지운다(알려진 비밀 치환). 지금은 채팅 채널의 프로바이더 API 클라이언트(Slack · Discord · Telegram)가 한다([채팅 채널 어댑터 규약 「규칙」](../CLE-CHAT/CLE-CHAT-ADAPTER.md#규칙) 10). 평문으로 외부 API 를 부르는 모듈이 늘면 이 목록에 더한다. «DB 는 항상 암호문만 본다» 는 시크릿 저장소(`secret_store`)가 다루는 비밀에 적용된다. 통합 암호화 키로 암호화하는 컬럼에 평문이 남을 수 있는 범위는 [통합 데이터와 흐름 「암호화」](CLE-INT-DATA.md#암호화) 가 정한다. (원본: SS-SE-01)
15. `store`·`rotate` 를 부를 때마다 12바이트 IV 를 새로 발급한다. IV 재사용은 금지한다. AES-GCM 에서 nonce 재사용은 치명적이다. (원본: SS-SE-02)
16. AAD 는 `ref` 다(`setAAD(Buffer.from(ref))`). 다른 참조의 암호문을 이 행에 덮어쓰는 행 간 교체 공격은 복호화 실패로 끝나야 한다. (원본: SS-SE-03)
17. 마스터키가 설정되지 않았거나 빈 값이면 부팅을 멈춘다(`SecretResolver` 모듈 초기화에서 throw). `NODE_ENV=production` 에서는 운영 환경 가드(`assertProductionConfig`)가 키가 없거나 공백뿐이거나 공개 예시 값이면 기동을 거부한다. 앞뒤에 공백이 붙은 공개 예시 값도 거부한다. 공개 예시 값 목록의 정본은 `production-guards.ts` 의 `KNOWN_EXAMPLE_ENCRYPTION_KEYS` 다. 64-hex 가 아닌 값은 거부하지 않고 SHA-256 으로 키를 만든다([마스터키](#마스터키)). (원본: SS-SE-04)
18. v1 은 DB 행 단위 감사 로그를 지원하지 않는다. `resolve` 가 실패하면 애플리케이션 로거가 참조와 `workspaceId` 만 남기고 평문은 남기지 않는다. 규칙 24 의 참조 불일치와 규칙 25 의 거부도 애플리케이션 로거에만 남기고 평문은 남기지 않는다. `resolve` · `store` · `rotate` 가 던지는 예외 메시지는 참조를 싣지 않고 참조는 애플리케이션 로거에만 남긴다. 예외 메시지가 어댑터 실패 원문으로 화면에 보이는 필드(`chat_channel_last_error`)에 저장될 수 있어서다. 미존재 분기에는 행이 없어 `workspaceId` 는 남기지 못한다. 응답 비노출 자체는 규칙 4 가 정한다. (원본: SS-SE-05)
19. `resolve(ref)` 결과는 호출자가 쓴 뒤 GC 에 맡긴다. `Buffer.fill(0)` 같은 강제 삭제는 v1 에 적용하지 않고 v2 선택지로 둔다(권장). (원본: SS-SE-06)
20. 소비 모듈은 원칙상 구체 클래스(`SecretResolverService`)가 아닌 추상 인터페이스에 의존한다. v1 은 NestJS DI 편의를 위해 구체 클래스를 직접 주입해도 된다. 구현체가 하나뿐이라 바꿀 일이 없고, abstract class 를 쓰면 injection token 설정이 더 필요하며, `deleteByPrefix` 를 포함한 메서드 시그니처가 아직 안정되지 않았기 때문이다. 백엔드가 둘 이상이 되면 `ISecretResolver` 를 추출하고 소비 모듈의 injection token 과 테스트 mock 을 인터페이스 기반으로 바꾼다. 현재 구현의 소비 모듈은 `triggers`·`chat-channel`·`external-interaction`·`schedules` 다.
21. `SecretResolver` 인터페이스를 바꾸는 변경은 모든 호출 모듈을 같은 변경에서 함께 고친다.
22. 새 비밀 종류(예: `oauth-client-secret`)를 더할 때는 [참조 예시](#참조-예시) 표에 새 `name` 행을 더하고, 호출 모듈의 스펙 본문에 참조 형식을 적는다. 리소스 설정에 참조를 두는 슬롯이면 규칙 23 의 거부 대상과 규칙 24 의 읽기 관문(채팅 채널은 `chat-channel-secret-refs.ts`, 알림 서명은 `notification-signing-secret-ref.ts`)에도 더한다. 트리거 원시 `config` 의 경로 목록은 2026-10-31 부터 규칙 23 의 `secret://` 값 검사가 받쳐 준다. 목록에 빠뜨린 슬롯이라도 원시 `config` 로 참조 값을 실으면 400 이다.
23. 리소스 설정에 두는 시크릿 참조(예: `Trigger.config` 의 `chatChannel.botTokenRef` · `chatChannel.inboundSigningRef` · `notification.signing.secretRef`)는 서버가 그 리소스 id 로 만들어 쓴다. 요청 본문으로 받지 않는다. 값이 자기 리소스의 참조여도 거부한다. 저장된 참조로 비밀을 쓰는 경로도 저장값 대신 리소스 id 로 참조를 다시 만든다(규칙 24). 트리거에서는 요청 본문의 `config` 키(원시 `config`)를 세 가지 검사로 거른다. 먼저 서버가 소유하는 필드의 경로 목록(시크릿 참조 슬롯 포함)에 든 경로가 있으면 거부한다. 다음으로 원시 `config` 바로 아래에 `notification` · `interaction` · `chatChannel` 키가 있으면 값과 상관없이 거부한다. 마지막으로 원시 `config` 아래 어디든 `secret://` 로 시작하는 문자열 값이 있으면 거부한다. 뒤의 두 검사가 경로 목록을 보완한다. 타입 키 아래의 슬롯은 목록에 없어도 타입 키 거부에 걸린다. 다른 키 아래에 심은 참조는 값 검사에 걸린다. 트리거의 거부 대상 · 순서 · 응답 모양의 정본은 [트리거 관리 「PATCH 본문 계약」](../CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약) 이다. 근거는 [R9 「리소스 설정의 시크릿 참조는 요청 본문으로 받지 않는다」](#r9-리소스-설정의-시크릿-참조는-요청-본문으로-받지-않는다-2026-10-04) 와 [R16 「원시 `config` 의 타입 키와 `secret://` 값을 막는다」](#r16-원시-config-의-타입-키와-secret-값을-막는다-2026-10-31) 에 있다.
24. 저장된 리소스 설정의 시크릿 참조로 비밀을 읽거나 쓰는 경로는 저장값의 있음 · 없음만 읽고 참조는 그 리소스 id 로 다시 만든다. 트리거에서는 봇 토큰 재발급, 메시지 발송, 인바운드 서명 검증, 트리거 삭제 때의 provider 해제, 알림 서명이다. 채팅 채널 참조는 비어 있지 않은 값이면 있다고 본다. 알림 서명 참조는 `secret://` 형식의 문자열이면 있다고 본다. 트리거 생성과 PATCH 가 알림 서명 시크릿을 정할 때도 이 판정을 쓴다. 있으면 참조를 다시 만들고 없으면 옛 평문을 옮기거나 첫 시크릿을 발급한다. 이 분기의 기준은 [EIA 알림 웹훅 「시크릿 교체」](../CLE-IX/CLE-EIA-NOTIFY.md#시크릿-교체) 다. 저장값과 다시 만든 참조를 정확히 비교하는 것은 에러 로그를 남기려는 것이고 쓰는 참조는 저장값과 상관없이 다시 만든 값이다. 로그에 저장값은 싣지 않는다. 읽기 관문은 없는 참조를 붙이지 않고 있는 참조를 지우지 않는다. 봇 토큰 재발급은 새 토큰을 쓰므로 `botTokenRef` 를 늘 싣고 `inboundSigningRef` 는 저장된 행에 있을 때만 싣는다. 자기 비밀이 없으면 `resolve` 가 실패해 닫힌다. 그때의 응답은 채팅 채널과 EIA 알림 웹훅 문서가 정한 실패 경로(발송 실패, 인바운드 401, 알림 `degraded`)다. 알림 서명은 참조가 있으면 옛 평문 `signing.secret` 으로 내려가지 않는다. 근거는 [R10 「저장된 참조는 읽는 쪽도 다시 만들고 rotate 는 다른 워크스페이스의 행을 덮어쓰지 않는다」](#r10-저장된-참조는-읽는-쪽도-다시-만들고-rotate-는-다른-워크스페이스의-행을-덮어쓰지-않는다-2026-10-04) 에 있다.
25. `rotate` 는 기존 행의 `workspace_id` 가 인자와 다르면 거부하고 값과 `workspace_id` 를 바꾸지 않는다. 대조는 행의 값과 인자만 본다. 이 거부 전용 에러 코드는 만들지 않는다. HTTP 응답은 일반 `INTERNAL_ERROR` 500 이고 메시지는 5xx 가림 문구다. 예외 메시지는 참조와 워크스페이스 id 가 없는 고정 문구라 화면에 보이는 필드에 저장돼도 내부 위치가 드러나지 않는다. 참조와 두 워크스페이스 id 는 서버 로그에만 남긴다. 반복 배치는 거부된 리소스만 건너뛰고 나머지를 처리한다. 교차 행이 있으면 그 비밀의 진짜 소유자가 하는 재발급도 이 거부로 막힌다. 그때의 처리는 [교차 행 점검과 정리](#교차-행-점검과-정리) 에 있다. 근거는 R10 에 있다.
26. 통합 암호화 키(`INTEGRATION_ENCRYPTION_KEY`)는 [통합 데이터와 흐름 「암호화」](CLE-INT-DATA.md#암호화) 표의 컬럼을 암호화하는 키다. 통합 자격 증명과 인증 설정 자격 증명이 그 표에 든다. 이 키는 마스터키(`ENCRYPTION_KEY`)와 별개다. 키를 만드는 방식, 운영 환경 가드(`assertProductionConfig`)의 검사, 적용 컬럼의 규범은 그 절에 있다. 근거는 [R13 「통합 암호화 키를 마스터키와 따로 둔다」](#r13-통합-암호화-키-integration_encryption_key-를-마스터키와-따로-두고-production-에서-키-없이-기동하지-않는다-2026-10-10) 에 있다.

## 참조 예시

| 참조 | 용도 |
| --- | --- |
| `secret://triggers/{triggerId}/bot-token` | 채팅 채널 어댑터의 봇 토큰. provider 공통(Telegram bot token, Slack `xoxb-*`, Discord bot token 등) |
| `secret://triggers/{triggerId}/bot-token.v2` | 봇 토큰 재발급 24시간 유예용 |
| `secret://triggers/{triggerId}/inbound-signing` | 채팅 채널 inbound 웹훅 출처 검증 자료(provider 공통 슬롯). Telegram 은 서버가 발급한 공유 비밀(`setWebhook.secret_token`, 어댑터가 randomBytes 로 발급), Slack 은 Slack 이 발급한 HMAC-SHA256 signing secret(사용자 입력), Discord 는 Discord 가 발급한 ed25519 application public key(사용자 입력)다. 검증 알고리즘 분기는 백엔드의 provider 별 책임이고 슬롯은 하나다. 기준은 [채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md) |
| `secret://triggers/{triggerId}/notification-signing` | EIA 알림 웹훅 HMAC 서명 시크릿. 첫 값은 서버가 발급한 `wsk_*` 다(트리거 생성 때, PATCH 가 EIA 알림 웹훅 설정을 처음 붙일 때). 이미 저장된 행에 옛 키 `signing.secret` 의 평문이 있으면 발급하지 않고 그 평문을 옮겨 넣는다. 기준은 [EIA 알림 웹훅 「시크릿 교체」](../CLE-IX/CLE-EIA-NOTIFY.md#시크릿-교체) |
| `secret://triggers/{triggerId}/notification-signing.v2` | 예약만 된 참조다. 현재 구현은 쓰지 않는다. 유예 기간의 새 알림 서명 시크릿은 `Trigger.notification_secret_v2` 컬럼에 평문으로 두고, 승격할 때 기준 참조(`notification-signing`)를 교체한다 |

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

같은 `Trigger.config` 안의 `notification.signing.secretRef` 는 `SecretResolver` 를 거친다. 한 객체 안의 이 비대칭은 의도한 것이고 (a)~(c) 가 그 이유다. 알림 서명 시크릿의 첫 값은 서버가 발급한다(트리거를 만들 때와 PATCH 가 EIA 알림 웹훅 설정을 처음 붙일 때). 호출자가 원시 `config` 의 옛 키 `signing.secret` 으로 평문을 보내던 경로는 2026-10-31 에 닫혔다([R16](#r16-원시-config-의-타입-키와-secret-값을-막는다-2026-10-31)). 다만 그 전에 호출자가 고른 평문은 그대로 쓰인다. 시크릿 저장소로 옮겨진 값도 있고 아직 행에 남은 값도 있다. 그래서 값 공간이 서버가 발급한 값으로 닫혀 있지 않아 (c) 를 만족하지 않는다. 표면 서술은 [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) 이 기준이다.

### `Trigger.notification_secret_v2` (2026-09-05 결정)

EIA 알림 웹훅 HMAC 서명 시크릿을 교체하는 24시간 유예 동안 **새 시크릿을 컬럼에 평문으로** 둔다. `secret://` 통합 대상이 아니다. 발송 측은 이 값을 보조 서명 키로 직접 쓴다. 기본 키는 `secretRef` 를 거친다. 표면 서술은 [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) 이 기준이다.

위 `itk_*` 항목의 (a)~(c) 를 근거로 삼지 않는다. 근거는 따로 세운다.

1. **평문이 종착지가 아니라 경유지다.** 승격되면 값은 `secrets.rotate` 로 저장소에 들어가고 컬럼은 `null` 로 비운다([EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) 의 승격 경로). `AuthConfig.config`(영구·암호화)와 `itk_*`(영구·평문) 어느 쪽과도 다른 세 번째 형태다.
2. **노출 창이 정책으로 닫혀 있다.** 유예 종료 cron 이 컬럼을 비운다. EIA 알림 웹훅 설정이 없는 트리거도 승격하지 않고 컬럼만 비운다([EIA 데이터와 흐름 「서명 시크릿 교체와 승격」](../CLE-IX/CLE-EIA-DATA.md#서명-시크릿-교체와-승격)). 비우지 않고 건너뛰는 분기는 R10 의 워크스페이스 불일치 하나이고 방어용이다. 응답으로 새지 않도록 `TriggersService` 의 `TRIGGER_RESPONSE_STRIP_COLUMNS` 가 응답 경계에서 이 컬럼을 지운다. 부재는 두 자리에서 단언한다. 트리거 직접 응답은 `shared/testing/trigger-workflow-ref.ts`, 스케줄 조인 응답은 `shared/testing/schedule-trigger-ref.ts` 가 같은 컬럼 목록으로 확인한다.
3. **서버가 발급하고 영향 범위가 트리거 하나다.** `wsk_` + `randomBytes(32)` 이며 사용자가 입력한 외부 자격 증명이 아니다.
4. **기본 경로는 그대로다.** 이 예외는 유예 기간의 보조 키에만 적용되며 `signing.secretRef` 정책을 건드리지 않는다.

다음 필드가 이 항목을 근거로 삼으려면 (1) 을 만족해야 한다. 즉 «승격되어 저장소로 들어가고 컬럼이 비워지는가» 다. 이 조건 없이 이 항목을 평문 보관의 선례로 쓰는 것이 이 등재의 실패 모드다.

## `SecretResolver` 인터페이스

```typescript
interface SecretResolver {
  /** ref 로 plaintext 조회. 미존재 시 throw (메시지에 ref 를 싣지 않는다, 규칙 18). 정상 동작 경로에서만 호출 (config 가 ref 를 보유) */
  resolve(ref: string): Promise<string>;

  /** plaintext 를 ref 로 저장. 이미 존재하면 throw (메시지에 ref 를 싣지 않는다, 규칙 18. 대신 rotate 사용) */
  store(ref: string, workspaceId: string, plaintext: string): Promise<void>;

  /** ref 의 plaintext 를 newPlaintext 로 교체 (UPSERT 의미). 기존 행의 workspace_id 가 인자와 다르면 throw 하고 바꾸지 않는다 (규칙 25).
   *  manager 를 주면 그 트랜잭션에서 쓴다. 트리거 설정 잠금 안 쓰기가 이 인자를 쓴다 (규칙 9) */
  rotate(ref: string, workspaceId: string, newPlaintext: string, manager?: EntityManager): Promise<void>;

  /** ref 삭제. 미존재 ref 는 noop */
  delete(ref: string): Promise<void>;

  /** ref 존재 여부 확인 (validation 용) */
  exists(ref: string): Promise<boolean>;

  /** prefix 로 시작하는 ref 를 전부 삭제하고 삭제 행 수를 돌려준다. prefix 불변식은 규칙 12 */
  deleteByPrefix(prefix: string): Promise<number>;
}
```

| 함수 | 부작용 | 멱등성 |
| --- | --- | --- |
| `resolve` | DB SELECT 1회 | 순수(읽기 전용) |
| `store` | DB INSERT | 멱등이 아니다. 중복 참조는 throw |
| `rotate` | DB SELECT 뒤 UPSERT. `manager` 를 받으면 그 트랜잭션에서 한다. 기존 행의 `workspace_id` 가 인자와 다르면 throw 하고 쓰지 않는다 | 멱등. 같은 참조 · 워크스페이스 · 평문으로 다시 불러도 된다 |
| `delete` | DB DELETE | 멱등. 없는 참조는 아무것도 하지 않는다 |
| `exists` | DB SELECT 1회 | 순수 |
| `deleteByPrefix` | DB DELETE(prefix 로 시작하는 행 전부). 삭제 행 수를 돌려준다 | 이 규약에 정의 없음 |

## 저장 백엔드

v1 은 Node.js `crypto` 의 AES-256-GCM 으로 애플리케이션이 직접 암호화·복호화하고 PostgreSQL 은 암호문만 저장한다. 다른 인프라 없이 셀프 호스팅 PostgreSQL 하나로 동작한다.

```sql
CREATE TABLE secret_store (
  ref          TEXT PRIMARY KEY,                    -- secret://<scope>/<resourceId>/<name>
  workspace_id UUID NOT NULL,
  encrypted    BYTEA NOT NULL,                       -- [IV(12B) || ciphertext || authTag(16B)] concat
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ref 형식 DB 가드 (V063 migration) — application 검증과 별개로 corrupt row 방지.
ALTER TABLE secret_store
  ADD CONSTRAINT chk_secret_store_ref_format
  CHECK (ref ~ '^secret://[a-z][a-z0-9-]*/[^/]+/[a-z0-9][a-z0-9.-]*$');

CREATE INDEX idx_secret_store_workspace_id ON secret_store(workspace_id);
```

`secret_store` 는 `trigger` 테이블 FK 를 두지 않는다. 앞으로 다른 scope 를 같은 테이블에 둘 수 있도록 namespace 만 나눈다. 트리거 행이 없어질 때의 정리는 규칙 8 이 정한다.

### 암호화 형식

- 알고리즘: AES-256-GCM(AEAD, 변조 감지 내장).
- IV: `crypto.randomBytes(12)`. `store`·`rotate` 를 부를 때마다 새로 발급한다.
- AAD: `ref` 문자열. DB 에서 행을 다른 참조로 바꿔치기하는 공격을 막는다.
- 인코딩: `BYTEA` 컬럼에 `[IV(12B) ‖ ciphertext ‖ authTag(16B)]` 를 그대로 이어 붙인다.

```typescript
// 암호화
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
cipher.setAAD(Buffer.from(ref, 'utf8'));
const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
const tag = cipher.getAuthTag();
const encrypted = Buffer.concat([iv, ct, tag]);   // BYTEA 컬럼에 저장

// 복호화
const iv = encrypted.subarray(0, 12);
const tag = encrypted.subarray(encrypted.length - 16);
const ct = encrypted.subarray(12, encrypted.length - 16);
const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
decipher.setAAD(Buffer.from(ref, 'utf8'));
decipher.setAuthTag(tag);
const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
```

### 마스터키

- 환경 변수 `ENCRYPTION_KEY` 를 쓴다. LLM API 키 암호화(`crypto.util.ts`)와 같은 키다. 통합 자격 증명과 인증 설정 컬럼의 통합 암호화 키(`INTEGRATION_ENCRYPTION_KEY`)는 이 키와 별개다(규칙 26).
- 정확히 64자 hex 면 `Buffer.from(rawHex, 'hex')` 로 그대로 쓴다(`.env.example` 의 표준 형식).
- 그 밖의 문자열은 SHA-256 으로 키를 만든다. e2e 와 짧은 키도 받으려는 것이다. 통합 암호화 키의 transformer 는 64자 hex 도 SHA-256 으로 만들므로 이 방식과 다르다([통합 데이터와 흐름 「암호화」](CLE-INT-DATA.md#암호화)).
- 설정되지 않았거나 빈 문자열이면 부팅 때 `SecretResolver` 모듈 초기화에서 throw 한다.
- `.env.example` 의 값은 형식 예시(all-zero placeholder)일 뿐 실제 키가 아니다. 운영자는 `openssl rand -hex 32` 로 새로 만든다. `NODE_ENV=production` 에서 키가 없거나 공백뿐이거나 공개 예시 값이면 `main.ts` 가 부르는 운영 환경 가드(`assertProductionConfig`, `production-guards.ts`)가 기동을 거부한다. 앞뒤에 공백이 붙은 공개 예시 값도 거부한다. 공개 예시 값 목록의 정본은 `production-guards.ts` 의 `KNOWN_EXAMPLE_ENCRYPTION_KEYS` 다. dev·test·e2e 는 영향이 없다.
- 마스터키는 애플리케이션 메모리 안에만 있다. DB 쿼리, SQL 파라미터, 로그, 메트릭에 나가지 않는다.
- 셀프 호스팅 운영자가 키를 직접 보관한다(docker-compose `env_file`, kubernetes secret, AWS Parameter Store 등).

### 다른 백엔드로 바꾸기

`SecretResolver` 인터페이스는 PostgreSQL 과 묶여 있지 않다. AWS Secrets Manager 나 HashiCorp Vault 가 필요해지면 `AwsSecretsManagerResolver`·`VaultResolver` 같은 구현을 더하고 `ConfigModule` 에서 환경별로 바꾼다. 인터페이스와 이 규약의 규칙은 바뀌지 않는다. 다만 트리거 설정 잠금 안에서 시크릿 저장소에 쓰는 경로(생성 · PATCH 의 첫 알림 서명 시크릿 발급과 옛 평문 옮기기, 시크릿 승격)는 예외다. 이 경로들은 백엔드가 같은 DB 의 테이블이라는 전제에 기댄다. 잠금 안에서는 HTTP 호출을 하지 않고([트리거 관리 「동시 쓰기 직렬화」](../CLE-TRIG/CLE-TRIG-MANAGE.md#동시-쓰기-직렬화)) 비밀 쓰기를 잠금을 쥔 트랜잭션에 묶기 때문이다(`rotate` 의 `manager` 인자, 규칙 9). 외부 백엔드로 바꾸면 이 경로를 다시 설계한다.

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
      const ref = notificationSigningSecretRef(trigger.id);  // 참조를 만드는 곳은 하나다(R10)
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

어댑터는 받은 설정의 참조를 그대로 `resolve` 한다. 저장된 설정을 어댑터에 넘기기 전에 읽기 관문이 참조를 트리거 id 로 다시 만든다(규칙 24). 비밀을 푸는 어댑터 함수는 트리거 id 를 받지 않아 대조를 어댑터 안에 두지 않았다([R10 「저장된 참조는 읽는 쪽도 다시 만들고 rotate 는 다른 워크스페이스의 행을 덮어쓰지 않는다」](#r10-저장된-참조는-읽는-쪽도-다시-만들고-rotate-는-다른-워크스페이스의-행을-덮어쓰지-않는다-2026-10-04)).

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

봇 토큰 재발급은 기본 참조(`bot-token`)를 바로 새 토큰으로 바꾸고 `bot-token.v2` 에 옛 토큰을 24시간 보관한다. 별도 승격 단계는 없다. 재발급 순서와 유예 정리는 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md) 과 [채팅 채널 데이터와 흐름](../CLE-CHAT/CLE-CHAT-DATA.md) 이 정한다.

### 채팅 채널 inbound 서명 자료 초기화

`inbound-signing` 은 provider 에 따라 두 경로로 초기화한다. 서버가 발급하는 경우(Telegram)는 `setupChannel` 결과에서 받고, provider 가 발급하는 경우(Slack·Discord)는 사용자 입력에서 받는다. 둘 다 같은 슬롯 `secret://triggers/{id}/inbound-signing` 에 둔다. 한 슬롯을 백엔드의 provider 분기가 흡수한다는 뜻이다([채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md)).

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

### 교차 행 점검과 정리

규칙 23 이 생기기 전에 저장된 행에는 두 가지가 남아 있을 수 있었다. 다른 트리거의 참조가 든 트리거 설정과, 다른 워크스페이스의 요청이 `rotate` 로 덮어쓴 비밀 행이다. 이 문서는 둘을 «교차 행» 이라 부른다. id 참조 교차 행은 [데이터 모델 개요 「저장된 교차 행 점검」](../CLE-PLAT/CLE-PLAT-DATA.md#저장된-교차-행-점검) 이 따로 본다.

2026-10-05 운영 DB 에서 점검 SQL 이 0 행이어서 점검 · 정리 SQL 을 걷었다(R10). 알려진 경로는 막혀 있다. 다른 트리거의 참조를 심는 입력은 규칙 23 이 막고, 다른 워크스페이스의 행을 덮어쓰는 `rotate` 는 규칙 25 가 막는다. 새 비밀 슬롯이 규칙 22 를 빠뜨리면 교차 행이 다시 생길 수 있다(R9). 남은 행 가운데 다른 트리거의 참조가 든 설정은 규칙 24 의 읽기 관문이 그 비밀을 쓰지 못하게 하고 에러 로그를 남긴다. 이미 덮어써진 비밀 행은 정리 전까지 소유자의 발송 · 검증에서 그대로 쓰인다(R10).

트리거 `config` 안의 비밀 참조는 컬럼이 아니라서 FK 대상이 아니다([데이터 모델 개요](../CLE-PLAT/CLE-PLAT-DATA.md#워크스페이스-범위-참조를-복합-fk-로도-막는다-2026-10-05) 의 «막지 않는 것»). 비밀 저장소 행에도 FK 를 두지 않는다([R4](#r4-fk-를-두지-않는다)). 그래서 DB 가 막지 않는다. 교차 행이 다시 생기면 서버 로그로 드러난다. 규칙 24 의 참조 불일치 에러 로그, 규칙 25 의 `rotate` 거부 로그, 같은 요청에서 남는 `resolve` 실패 경고가 그 신호다. 운영자가 그 로그를 보거나 백업 복원처럼 옛 데이터를 되살렸으면 아래 순서를 따른다(근거는 R10). 점검 SQL `2026-10-04-trigger-secret-ref-audit.sql` 과 정리 SQL `2026-10-04-trigger-secret-ref-cleanup.sql` 은 저장소에는 없고 커밋 `d5cb730ec` 의 `codebase/backend/scripts/ops/` 에서 꺼낸다. 두 SQL 은 그 커밋 시점의 스냅샷이다. 지금 스키마와 트리거 설정 잠금 키(`trigger-config-lock.ts` 의 `TRIGGER_CONFIG_LOCK_PREFIX`)에 맞는지는 검증하지 않았다. 되살릴 때는 같은 커밋의 e2e 케이스(`trigger-stored-secret-refs.e2e-spec.ts` 의 점검 · 정리 케이스)도 되살려 지금 스키마에서 돌려 본다.

1. 점검 SQL 로 찾는다. 다른 워크스페이스가 덮어쓴 비밀 행과 다른 트리거를 가리키는 참조가 나온다. 출력에 비밀 값과 평문은 없다.
2. 정리 SQL 로 덮어쓴 비밀 행을 지우고 어긋난 참조를 트리거 id 로 만든 값으로 맞춘다.
3. 지운 행의 트리거 소유자에게 봇 토큰 · 알림 서명 시크릿 재발급을 안내한다. 덮어쓰기 전의 토큰이 다른 워크스페이스로 새었을 수 있으므로 provider 쪽에서도 새로 발급받는다. 다른 트리거를 가리키던 행이 있으면 가리켜진 트리거의 소유자에게도 알린다.
4. 참조 자리에 `secret://` 가 아닌 값이 든 행은 정리 SQL 이 건드리지 않는다. 평문이 들어 있을 수 있으니 소유자와 확인한 뒤 손으로 지우거나 참조로 바꾼다.

사람이 결과를 보고 돌리는 일회성 운영 SQL 은 마이그레이션이 아니고 규칙 3 · 13 의 대상이 아니다(R10).

## 미결 사항

- **통합 자격 증명과 이 저장소의 관계**: 이 규약은 도메인 모듈이 `SecretResolver` 를 거치고 예외는 [저장소 예외 필드](#저장소-예외-필드) 뿐이라고 정한다. 그런데 통합 자격 증명(`Integration.credentials`, Cafe24·OAuth·MCP 토큰 포함)은 컬럼 transformer 로 저장하고 예외 목록에도 없다([통합 데이터와 흐름](CLE-INT-DATA.md)). 원문 서두는 «향후 cafe24·OAuth 등» 도 `SecretResolver` 를 거친다고 적고, Rationale R2 는 OAuth client secret 과 Cafe24 토큰을 옮겨 올 가능성을 적는다. 방향은 이관 쪽이지만 시점과 범위를 정한 계획은 원문에 없다. 예외로 올린다면 `AuthConfig.config` 처럼 «다른 메커니즘으로 암호화된다» 를 근거로 삼게 된다. 그 메커니즘이 암호화를 보장하는 범위는 [통합 데이터와 흐름 「암호화」](CLE-INT-DATA.md#암호화) 가 정한다. 근거를 적는다면 이 범위도 함께 적어야 한다. 예외로 올리고 근거를 적을지, 저장소로 옮길 계획을 세울지 결정이 필요하다.

## 구현 위치

- `codebase/backend/src/modules/secret-store/**`
- 규칙 17 · 26 의 운영 환경 가드: `codebase/backend/src/common/config/production-guards.ts`(`assertProductionConfig`, 공개 예시 값 목록 `KNOWN_EXAMPLE_ENCRYPTION_KEYS`), 가드를 부르는 곳 `codebase/backend/src/main.ts`
- 규칙 14 의 알려진 비밀 치환: `codebase/backend/src/shared/utils/sanitize-error-message.ts`(`replaceKnownSecret`), 채팅 채널 클라이언트 `codebase/backend/src/modules/chat-channel/providers/slack/slack-client.ts` · `codebase/backend/src/modules/chat-channel/providers/discord/discord-client.ts` · `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-client.ts`
- 규칙 23 의 시행: `codebase/backend/src/modules/triggers/trigger-config-internal-fields.ts`(원시 `config` 거부. 내부 필드 경로 목록 · 타입 키 · `secret://` 값을 `assertRawConfigAccepted` 가 본다), `codebase/backend/src/modules/triggers/triggers.service.ts`(`rotateBotToken` 의 참조 유도)
- 규칙 4 의 면제 응답 DTO: `codebase/backend/src/modules/triggers/dto/responses/trigger-secret-issue-response.dto.ts`(`TriggerIssuedSecretsDto`), `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts`(생성 · PATCH 응답의 `secrets`)
- 저장소 예외 필드의 응답 부재 단언(규칙 4 · 6): `codebase/backend/src/shared/testing/trigger-workflow-ref.ts`, `codebase/backend/src/shared/testing/schedule-trigger-ref.ts`
- 규칙 8 · 9 의 커밋 뒤 정리와 되돌리기: `codebase/backend/src/modules/triggers/trigger-resource-release.ts`(`cleanUpDeletedTriggersAfterCommit`), `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts`(`undoAbsentWrite`). 잠금 안 쓰기의 트리거 설정 잠금: `codebase/backend/src/modules/triggers/trigger-config-lock.ts`
- 규칙 24 의 시행: `codebase/backend/src/modules/chat-channel/chat-channel-secret-refs.ts`(참조 유도와 읽기 관문), `codebase/backend/src/modules/triggers/notification-signing-secret-ref.ts`(알림 서명 참조 유도. 생성 · PATCH 의 첫 발급과 옛 평문 옮기기도 이 유도를 쓴다), `codebase/backend/src/modules/triggers/notification-signing-secret.ts`(첫 알림 서명 시크릿의 판정 `decideNotificationSigning` 과 서명 참조 얹기. 참조를 만드는 위 파일과 역할이 다르다). 관문을 쓰는 곳: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`, `codebase/backend/src/modules/hooks/hooks.service.ts`, `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`, `codebase/backend/src/modules/triggers/triggers.service.ts`(봇 토큰 재발급, 알림 서명 승격), `codebase/backend/src/modules/external-interaction/notification-webhook.processor.ts`(알림 서명)
- 규칙 24 의 읽기 관문과 규칙 25 의 `rotate` 대조(저장된 교차 행): `codebase/backend/test/trigger-stored-secret-refs.e2e-spec.ts`

## Rationale

### R1. 애플리케이션에서 AES-256-GCM 으로 암호화한다

Node `crypto` 의 AES-256-GCM 을 채택한다. 마스터키가 애플리케이션과 DB 의 경계를 넘지 않고, DB 는 암호문만 본다(DBA 도 복호화하지 못한다). PostgreSQL 확장 의존성이 없어 Heroku 같은 관리형 PG 에서도 쓸 수 있다. AEAD 의 인증 태그로 변조를 감지한다. 단위 테스트에 DB 가 필요 없다. 셀프 호스팅 환경에서는 마스터키가 애플리케이션 메모리 밖으로 나가지 않는 경계가 더 큰 보안 이득이다. PostgreSQL 운영 변경(확장 활성화, 재시작) 없이 도입할 수 있다. 기업 사용자가 요청하면 백엔드 교체로 넓힌다.

### R2. 참조에 `<scope>` 를 둔다

`secret://<scope>/<resourceId>/<name>` 형식을 쓰면 다른 도메인 자원(예: Cafe24 access token)도 같은 저장소를 namespace 충돌 없이 함께 쓸 수 있다. OAuth client secret 이나 Cafe24 토큰을 옮겨 올 가능성과 namespace 명확성을 함께 고려했다.

### R3. `.v2` 접미사로 유예 변형을 나타낸다

`name.v2` 로 같은 자원의 변형임을 이름 안에 적는다. `bot-token` 과 `bot-token.v2` 가 눈으로 묶이고, `resolve` 에 넘기는 참조 문자열만 봐도 무엇을 읽는지 분명하다.

`v2` 는 «같은 자원의 24시간 유예용 변형» 만 뜻하고 옛 값인지 새 값인지는 뜻하지 않는다. 실제로 두 v2 의 뜻은 반대다. 채팅 채널의 `bot-token.v2`(와 `Trigger.chat_channel_token_v2`)는 **옛** 봇 토큰 백업이고 유예가 끝나면 지운다. 승격 단계는 없다([채팅 채널 데이터와 흐름](../CLE-CHAT/CLE-CHAT-DATA.md)). EIA 알림 서명의 `Trigger.notification_secret_v2` 는 유예 기간의 **새** 알림 서명 시크릿이고 승격 때 기준 참조를 바꾼다([EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md)). 원문의 옛 봇 토큰 재발급 예시는 `rotate(refV2, newToken)` 뒤 배치가 v2 를 기준 참조로 올린다고 적어 알림 서명 쪽 뜻을 따랐는데, 채팅 채널 요구사항(CCH-SE-04-C)과 현재 구현(`rotateBotToken`)은 옛 토큰 백업이다. 그래서 [봇 토큰 재발급](#봇-토큰-재발급) 절과 규칙 11 은 채팅 채널 쪽을 따른다. 두 v2 를 읽을 때는 이름 패턴이 같다고 뜻이 같다고 보지 않는다.

### R4. FK 를 두지 않는다

`secret_store.workspace_id` 에 FK 를 둘 수는 있지만 이 규약은 애플리케이션 수준 정리만 정한다. 워크스페이스 밖의 시스템 전역 비밀 같은 다른 scope 도 같은 테이블에 두려면 FK 가 제약이 된다. 정리 책임은 트리거 행을 없애는 **모든 경로**가 진다. 트리거 삭제(`TriggersService.remove()`)뿐 아니라 스케줄 삭제, FK CASCADE 로 트리거를 지우는 워크플로우·워크스페이스 삭제도 정리한다. 애플리케이션 수준 정리를 택하면 DB 가 대신 지워 주지 않으므로, 책임을 한 경로에만 적으면 나머지 경로가 조용히 고아를 남긴다. 2026-09-17 실측에서 네 경로 중 한 곳만 정리하고 있었다. `ON DELETE CASCADE` 는 채택하지 않는다. 암묵적 DB 동작과 명시적 애플리케이션 동작이 섞이면 추적이 어렵다. 같은 날 «워크스페이스 삭제는 SQL 한 줄로 정리된다» 는 옛 서술도 바로잡았다. 그렇게 지우는 코드는 없었다.

### R5. `.env.example` 에는 형식 예시만 두고 production 에서 막는다

`.env.example` 의 `ENCRYPTION_KEY` 는 실제 키가 아니라 형식만 보이는 all-zero placeholder 다. 옛 버전은 복사해 쓸 수 있는 구체적인 64-hex 값을 실었고, 그 값을 그대로 운영에 옮긴 배포는 공개 저장소의 알려진 키로 저장소 전체를 암호화해 사실상 평문 상태였다. 그래서 두 겹으로 막는다. 눈에 띄는 all-zero placeholder 와 «MUST regenerate(`openssl rand -hex 32`)» 주석이 하나이고, `NODE_ENV=production` 에서 `main.ts` 가 부르는 운영 환경 가드(`assertProductionConfig`, `production-guards.ts`)가 키가 없거나 공백뿐이거나 공개 예시 값이면 기동을 거부하는 것이 둘이다. 빈 값만 막는 `SecretResolver` 초기화 검사를 보완해 «예시 값 복사» 운영 사고까지 막는다. `JWT_SECRET`·`MCP_ALLOW_INSECURE_URL` 과 함께 하나의 fail-closed 가드 블록으로 모았다([세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) 의 Rationale 「운영 환경 가드」). dev·test·e2e 는 영향이 없다(refactor 04 M-4).

### R6. 마스터키를 LLM API 키와 함께 쓴다

기존 `ENCRYPTION_KEY` 의 사용처(LLM API 키)와 이 저장소의 사용처(외부 provider 비밀)는 같은 신뢰 영역이다. 둘 다 외부 API 자격 증명 평문이다. 도메인을 나눠 얻는 이득보다 운영 단순화 이득이 크다. 도메인 분리가 필요해지면 별도 `ENCRYPTION_KEY_SECRET_STORE` 환경 변수를 검토한다. 이 이름은 아직 도입하지 않은 후보 이름이다. 통합 암호화 키는 구현 이력으로 이미 따로 있다. 두 키를 합치지 않은 이유는 [R13 「통합 암호화 키를 마스터키와 따로 둔다」](#r13-통합-암호화-키-integration_encryption_key-를-마스터키와-따로-두고-production-에서-키-없이-기동하지-않는다-2026-10-10) 에 있다.

### R7. 저장소 예외 필드도 응답에는 나가지 않는다고 규범으로 적는다

2026-09-05 전까지 «이 컬럼들이 응답에 나가면 안 된다» 는 요구가 스펙 어디에도 규범 문장으로 없었고(실측 0건), 실제로 두 엔드포인트에서 나가고 있었다. `notification_secret_v2` 예외를 올릴 때도 예외의 대상은 «컬럼에 평문으로 보관» 이지 «응답에 실어도 된다» 가 아니었다. 그래서 규칙 4~6 으로 경계를 규범으로 적었다. 이후 `#1291` 이 응답 경계 스트립을 세웠고 두 단언 자리가 부재를 고정한다. 같은 컬럼 목록이 EIA 문서에도 있으면 한쪽만 고쳐 다른 쪽이 낡으므로, 목록은 이 규약에 두고 EIA 문서는 링크한다. 값을 한 번 보여 주는 응답의 면제는 규칙 4 의 목록과 R12 · R15 가 정한다.

### R8. `deleteByPrefix` 는 LIKE 메타문자를 이스케이프하지 않고 거부한다 (2026-08-09)

구현이 prefix 를 `ref LIKE :prefix`(`` `${prefix}%` ``)로 쓴다. 파라미터 바인딩이라 SQL 인젝션은 아니지만, prefix 에 `%`(임의 문자열)나 `_`(임의 한 글자)가 섞이면 의도보다 넓게 지운다. 삭제는 되돌릴 수 없다. `\`(LIKE 이스케이프 문자)도 같은 이유로 막는다.

이스케이프(`\%` + `ESCAPE` 절)가 아니라 거부를 택한 이유는 이 API 의 prefix 가 내부에서 조립하는 식별자 경로라 메타문자가 정당하게 필요한 경우가 없어서다. 참조 형식 자체가 메타문자를 배제한다. 이스케이프는 없는 사용 사례를 위해 표면을 넓힌다.

«지금은 안전하다» 를 주석으로만 두지 않았다. 도입 시점의 운영 호출부는 `triggers.service.ts` 한 곳(`secret://triggers/${trigger.id}/`, `trigger.id` 는 UUID 라 메타문자가 없다)뿐이었다. 그러나 그 안전은 호출부 목록이 그대로일 때만 참이다. 사용자 입력이 섞인 prefix 를 넘기는 호출부가 하나 생기면 주석은 아무것도 막지 못한다. 기존 `secret://` 접두사 검사와 같은 형태로 입력 자체를 거부했다.

검증은 두 층으로 나눠 고정한다. 단위 테스트의 in-memory mock 은 `startsWith` 로 대상을 골라 와일드카드 패턴에서 실제보다 적게 지운다. 방향이 반대라 과다 삭제를 오히려 감춘다. mock 에 LIKE 해석기를 심으면 테스트가 DB 를 흉내 내다 틀릴 위험이 새로 생긴다. 그래서 와일드카드 의미는 실제 Postgres 로 고정하고(`codebase/backend/test/secret-store-like-prefix.e2e-spec.ts`, `_` 를 섞은 prefix 가 리터럴이면 0건, 실제로는 2건을 지운다고 단언), 그 의미가 이 API 에 적용된다는 사실은 단위 테스트의 쿼리 형태 단언(`secret-resolver.service.spec.ts`, `ref LIKE :prefix` 와 `` `${prefix}%` `` 바인딩과 `ESCAPE` 절 부재)으로 고정한다. 둘 중 하나가 깨지면 나머지의 전제도 다시 본다.

### R9. 리소스 설정의 시크릿 참조는 요청 본문으로 받지 않는다 (2026-10-04)

트리거 생성 · 수정 본문의 `config` 는 `@IsObject` 만 검사했다. 타입 필드 `chatChannel` 은 시크릿 참조와 평문을 막았지만 원시 `config.chatChannel` 과 `config.notification.signing` 은 그대로 저장됐다. `resolve` · `rotate` 는 참조만 보고 소유 워크스페이스를 확인하지 않는다. 그래서 다른 워크스페이스 트리거의 id 를 아는 사용자가 자기 트리거 `config` 에 그 트리거의 `botTokenRef` 를 심고 봇 토큰을 재발급하면 상대 트리거의 토큰이 덮어써졌다. 그 행의 `workspace_id` 도 공격자의 워크스페이스로 바뀌었다. 생성과 수정 두 경로 모두 e2e 로 재현했다(NERV Task `CLE-T-M9QKKX`).

- **거부를 택했다.** 견준 안은 둘이었다. (a) 자기 리소스 접두의 참조면 받는다. 생성 요청에는 아직 리소스 id 가 없어 이 검사가 의미가 없다. 접두만 보면 `bot-token` 슬롯에 `inbound-signing` 참조를 넣는 혼동도 통과한다. 타입 필드는 값과 상관없이 막으므로 같은 필드가 위치에 따라 다르게 동작한다. (b) 받은 값을 버리고 리소스 id 로 다시 만든다. 사용자가 보낸 값을 말없이 바꾸는 것은 [채팅 채널 「R-CC-21 PATCH 는 비밀을 쓰지 않는다」](../CLE-CHAT/CLE-CHAT-CORE.md#r-cc-21-patch-는-비밀을-쓰지-않는다) 가 기각한 «무시» 와 같은 모양이다.
- **400 으로 거부하고 조용히 지우지 않는다.** 같은 원시 `config` 의 옛 인라인 인증 키는 구현(`stripInlineAuthKeys`)이 저장 전에 지운다. 그 입력은 폐기됐고 남은 행에 있어도 코드가 무시한다([웹훅 「트리거 필드와 config」](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#트리거-필드와-config)). 그래서 지워도 사용자가 잃는 것이 없다. 시크릿 참조와 평문은 사용자가 무언가를 설정했다고 믿게 만드는 값이라 지우면 같은 «무시» 가 된다. 전역 파이프의 `forbidNonWhitelisted`(모르는 키는 400)와도 같은 방향이다.
- **거부 대상은 경로 목록이 기본이다. R16 이 타입 키와 `secret://` 값 검사를 더했다.** 원시 `config` 의 `chatChannel` · `notification` · `interaction` 키를 통째로 막는 안도 있었다. 그 안은 원시 `config` 의 다른 계약(옛 평문 `notification.signing.secret` 입력 등)을 함께 바꾸므로 사람 결정으로 이번 범위에서 뺐다(NERV Task `CLE-T-EA7B5M`). `chatChannel` 쪽은 타입 필드의 차단 필드 단일 기준에서 유도한다. `notification.signing.secretRef` 는 목록에 직접 적었다. 새 참조 슬롯이 생기면 사람이 목록에 더해야 하고(규칙 22) 그것을 잡는 구조적 가드는 없다. 원시 `config` 아래의 `secret://` 값을 직접 거르는 안이 후보이고 같은 Task 가 검토한다. 2026-10-31 에 사람이 세 키를 통째로 막는 안과 `secret://` 값 검사를 채택했다. 경로 목록은 그대로 두고 두 검사보다 먼저 돈다([R16](#r16-원시-config-의-타입-키와-secret-값을-막는다-2026-10-31)).
- **다시 만드는 것은 쓰기 경로뿐이다.** 봇 토큰 재발급은 저장된 참조를 믿지 않고 리소스 id 로 참조를 만든다. 프로바이더 재등록에 넘기는 설정도 같다. 단 저장된 행에 `inboundSigningRef` 가 없으면 전처럼 넣지 않는다. 구현(`chat-channel-inbound-authenticator.ts`)은 그 참조가 없는 행에서 인바운드 서명 검증을 건너뛰므로(현행 동작은 [채팅 채널 데이터 「인바운드 서명 자료 참조가 없는 행」](../CLE-CHAT/CLE-CHAT-DATA.md#인바운드-서명-자료-참조가-없는-행) 에 있다) 없는 행에 참조를 붙이면 검증 동작이 바뀐다. 정상 행의 참조는 같은 규칙으로 만든 값이라 결과가 같다. 저장 경계가 막기 전에 저장된 행에서 다른 리소스의 비밀을 읽거나 덮어쓰지 않게 하는 방어다. «쓰기 경로뿐» 은 이 결정 때의 범위다. 읽기 경로는 R10 이 같은 규칙으로 넓혔다.
- **막는 자리를 호출자로 두었다.** `resolve` 는 참조만 받으므로 소유 확인을 넣으려면 시그니처가 바뀌어 규칙 21 에 따라 네 소비 모듈을 같은 변경에서 고쳐야 한다. `rotate` 는 이미 `workspaceId` 를 받으므로 기존 행의 `workspace_id` 가 다르면 거부하는 확인은 시그니처를 바꾸지 않는다. 다만 지금 계약은 UPSERT 가 `workspace_id` 까지 덮어쓰는 것이고 호출자가 그 실패를 처리하지 않는다. 그 의미를 바꾸는 일은 읽기 경로 방어와 함께 정한다(아래 «남긴 것»). 이번에는 입력 경계와 쓰기 경로를 닫는 것으로 범위를 좁혔다. 그 의미는 R10 이 정했다.
- **R-CC-21 과 다른 축이다.** 원시 `config` 거부는 필드를 누가 소유하는가를 기준으로 한다. R-CC-21 의 «PATCH 요청자가 자기 비밀로 값을 바꾸는가» 와 다른 축이라 그 결정(서명 자료 회전 등)과 독립이다.
- **남긴 것**: 이미 저장된 행의 읽기 경로 방어, `rotate` 의 워크스페이스 대조, 운영 데이터 점검은 R10 이 정했다(NERV Task `CLE-T-XYR067`, 점검은 2026-10-05 에 걷었다). 원시 `config` 의 다른 계약(타입 키를 원시 `config` 로 받는 경로, `config` 교체 의미, `interaction.triggerToken`)은 이 결정 밖이고 `CLE-T-EA7B5M` 이 맡는다. `interaction.triggerToken` 경로는 2026-10-17 에 NERV Task `CLE-T-EQDYC1` 이 닫았다. 타입 키 경로와 `config` 교체 의미는 2026-10-31 에 `CLE-T-EA7B5M` 이 정했다([R16](#r16-원시-config-의-타입-키와-secret-값을-막는다-2026-10-31)).

### R10. 저장된 참조는 읽는 쪽도 다시 만들고 rotate 는 다른 워크스페이스의 행을 덮어쓰지 않는다 (2026-10-04)

R9 가 요청 본문을 막은 뒤에도 그 전에 저장된 행은 남는다. 다른 트리거의 참조가 든 행이 있으면 메시지 발송, 인바운드 서명 검증, 트리거 삭제 때의 provider 해제, 알림 서명이 그 트리거의 비밀로 동작했다. 피해자 Slack 서명 비밀로 서명한 요청이 교차 행이 있는 다른 워크스페이스 트리거의 인바운드 검증을 통과하는 것을 e2e 로 재현했다. `rotate` 는 다른 워크스페이스의 행을 덮어쓰며 `workspace_id` 까지 넘겼다(R9 의 재현, NERV Task `CLE-T-XYR067`).

- **저장 경계(규칙 23)가 1차 방어이고 이것은 이미 저장된 데이터를 위한 2차 방어다.** [데이터 모델 개요](../CLE-PLAT/CLE-PLAT-DATA.md) 의 «본문 참조 id 도 저장 전에 소속을 본다» 는 읽는 자리마다 필터를 두는 모양을 기각했다. 그 기각은 1차 방어를 그렇게 두는 안에 대한 것이다. 여기서는 1차 방어가 이미 저장 경계에 있고 남은 행을 위해 관문을 하나 둔다. 저장된 채팅 채널 설정을 어댑터와 인바운드 인증기에 넘기는 곳(아웃바운드 발송, 인바운드 처리, 트리거 삭제의 해제)은 읽기 관문(`readTriggerChatChannelConfig`)을 지난다. 봇 토큰 재발급은 같은 규칙의 `pinChatChannelSecretRefs` 를 지난다. 두 참조를 만드는 곳은 `chatChannelSecretRef` 하나이고 알림 서명 참조를 만드는 곳은 `notificationSigningSecretRef` 하나다. 새 소비 지점이 관문을 지나는지 보는 정적 가드는 두지 않았다. 읽는 곳이 넷뿐이고 1차 방어가 저장 경계에 있기 때문이다. 새 슬롯은 규칙 22 가 관문에 더하게 하고 리뷰가 본다. 가드는 후속 Task 의 선택 항목으로 올렸다(NERV Task `CLE-T-VRBS51`).
- **견준 안은 셋이었다.** (a) 참조의 scope · resourceId 만 대조하고 다르면 쓰지 않는다. 이 Task 계획 초안의 안이다(구현하지 않은 `isSecretRefOwnedBy`, 알림은 서명하지 않고 `degraded`). 접두 대조는 R9 의 (a) 가 지적한 슬롯 혼동을 못 막고 채팅 채널과 알림이 다르게 동작한다. 다른 참조를 «없음» 으로 다루면 인바운드 서명 검증이 열린다. (b) `resolve` 가 소유 리소스를 인자로 받는다. R9 「막는 자리를 호출자로 두었다」 가 든 안이다. 규칙 21 에 따라 네 소비 모듈을 같은 변경에서 고쳐야 한다. 비밀을 푸는 어댑터 함수는 트리거 id 를 받지 않으므로 [채팅 채널 어댑터](../CLE-CHAT/CLE-CHAT-ADAPTER.md) 인터페이스도 바뀐다. (c) 어댑터 안에서 대조한다. 이 Task 의 착수 전 검토가 든 층이고 (b) 와 같은 이유로 인터페이스가 바뀐다. 그래서 «있음 · 없음만 읽고 값은 다시 만든다» 를 택했다. 봇 토큰 재발급(R9)과 같은 규칙이라 정본이 하나다.
- **R9 의 (b) 기각과 축이 다르다.** R9 가 기각한 «받은 값을 버리고 다시 만든다» 는 사용자가 보낸 입력을 말없이 바꾸는 일이다. 여기서 다시 만드는 것은 저장된 행이다. 정상 행은 같은 규칙으로 만든 값이라 결과가 같고 교차 행은 에러 로그로 드러난다.
- **있음 · 없음은 그대로 둔다.** 인증기는 `inboundSigningRef` 가 없으면 검증을 건너뛴다. R9 가 가리키는 현행 동작이고 [채팅 채널 어댑터](../CLE-CHAT/CLE-CHAT-ADAPTER.md) 는 이 필드를 필수라 적는다. 이 알려진 불일치는 이번에 바꾸지 않는다. 있는 참조를 지우면 검증이 열리고 없는 참조를 붙이면 검증 동작이 바뀌므로 둘 다 하지 않는다. 자기 비밀이 없는 교차 행은 `resolve` 실패로 닫힌다. «있음» 의 판정은 채팅 채널과 알림이 다르다(규칙 24). 알림은 종전부터 `secret://` 형식이 아닌 값을 무시하고 옛 평문으로 내려갔고 이번에 그 판정을 바꾸지 않았다.
- **`rotate` 는 행의 `workspace_id` 와 인자만 대조한다.** 리소스 테이블을 보지 않으므로 scope 와 무관하고 다른 백엔드도 같은 의미를 낼 수 있다(R2 · R4). 애플리케이션 경로에서는 한 번 들어간 행의 `workspace_id` 가 이제 바뀌지 않으므로 대조와 갱신 사이의 경합이 없다. 거부는 클라이언트가 분기할 조건이 아니라서 [에러 코드 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 의 «새 조건은 새 코드» 로 새 코드를 만들지 않았다. 고칠 수 있는 쪽이 운영자라 5xx 다([채팅 채널 「R-CC-23 setupChannel 실패는 전송 방식이 아니라 원인으로 분류한다」](../CLE-CHAT/CLE-CHAT-CORE.md#r-cc-23-setupchannel-실패는-전송-방식이-아니라-원인으로-분류한다) 의 기준). 다른 워크스페이스에 그 참조가 있다는 사실을 코드로 가르지 않는 것은 [데이터 모델 개요](../CLE-PLAT/CLE-PLAT-DATA.md) 의 «없는 id 와 다른 워크스페이스의 id 를 구분하지 않는다» 와 같은 방향이다. 예외 메시지에 참조와 «다른 워크스페이스» 를 싣지 않는 것은 채팅 채널 설정이 실패 메시지를 화면에 보이는 `chat_channel_last_error` 에 저장하기 때문이다(규칙 4).
- **교차 행의 소유자는 정리 뒤에 다시 쓴다.** 거부는 이미 교차 행이 된 비밀의 진짜 소유자도 막는다. 종전에는 소유자의 재발급이 행을 덮어써 소유가 돌아왔다. 그 행의 내용은 다른 워크스페이스의 요청이 쓴 값이라 `workspace_id` 만 되돌려서는 믿을 수 없다. 암호문의 AAD 가 참조라 다른 행으로 옮겨 살릴 수도 없다. 그래서 배포 전에 점검 SQL 로 찾고 정리 SQL 로 지운 뒤 소유자가 재발급하는 순서를 택했다(사람 결정, 2026-10-04). 이 Task 의 착수 전 검토는 마이그레이션으로 자동 보정하거나 마이그레이션을 멈추는 선례도 들었다. 택하지 않은 것은 덮어써진 비밀을 SQL 로 되살릴 수 없어 어느 쪽이든 소유자의 재발급이 필요하기 때문이다. 데이터를 지우는 판단은 사람이 점검 결과를 본 뒤에 하는 편이 맞다. 정리 전까지 교차 행이 된 비밀은 소유자의 발송 · 검증에서도 그대로 쓰인다. 이 상태를 닫는 것은 운영 정리다.
- **정리 SQL 은 규칙 3 · 13 밖의 일회성 절차다.** 규칙 3 은 도메인 모듈이 `SecretResolver` 로 읽고 쓰게 하고 규칙 13 은 워크스페이스 조건 삭제를 인터페이스에 두지 않게 한다. 둘 다 애플리케이션 경로의 규칙이다. 다른 워크스페이스 행을 열거하고 지우는 일을 인터페이스로 열면 규칙 21 에 따라 소비 모듈을 함께 고쳐야 한다. 한 번만 할 일이 계속 열린 표면으로 남는다. 그래서 사람이 돌리는 SQL 로 두고 점검이 모든 운영 환경에서 비면 걷는다. 2026-10-05 에 걷었다(아래).
- **거부가 provider 등록 뒤에 날 수 있다.** 봇 토큰 재발급, 최초 설정, Telegram 의 `chatChannel` PATCH 는 provider 에 새 서명 자료를 등록한 뒤 `inbound-signing` 을 `rotate` 한다. [채팅 채널 「R-CC-21 PATCH 는 비밀을 쓰지 않는다」](../CLE-CHAT/CLE-CHAT-CORE.md#r-cc-21-patch-는-비밀을-쓰지-않는다) 이 이 저장을 등록과 한 동작으로 정한 이유(건너뛰면 인바운드가 모두 401)가 교차 행에서는 거부로 다시 생긴다. 등록 뒤에 거부되면 인바운드가 401 로 닫힌다. 재발급은 500 으로, 최초 설정과 PATCH 는 `degraded` 와 `chat_channel_last_error` 로 드러난다. 재발급은 그 앞에서 쓴 `bot-token.v2` 백업 행도 남긴다. ⑤ 에서 거부되면 ⑥ 이 일어나지 않아 그 백업이 유예 정리 대상이 되지 않는다(트리거 삭제 때 prefix 로 지워진다). 쓰기 순서는 규칙 11 의 «백업한 뒤 기본 참조» 를 따르므로 바꾸지 않았다. 등록 전에 대조하려면 인터페이스에 메서드를 더해야 해서 이번에는 운영 정리를 먼저 하는 순서로 막는다. 남는 상태는 닫힌 쪽이다. 채팅 채널 문서의 에러 표와 수명주기 반영은 NERV Task `CLE-T-VRBS51` 이 맡는다.
- **반복 배치는 거부된 리소스만 건너뛴다.** 알림 서명 시크릿 승격은 실패를 다시 던져 job 재시도에 맡긴다. 워크스페이스 불일치는 재시도해도 같으므로 그 트리거만 건너뛰고 에러 로그를 남긴다. 알림 서명 비밀 행은 쓰는 쪽(설정 정규화, 승격)이 늘 트리거 id 로 참조를 만들어 왔으므로 교차 행이 생긴 경로가 없고 이 분기는 방어용이다. 만나면 그 트리거의 `notification_secret_v2` 평문과 두 키 서명이 정리 뒤 다음 승격까지 남는다([저장소 예외 필드](#저장소-예외-필드) 근거 1 · 2 의 한계).
- **로그는 발생할 때마다 남긴다.** 교차 행이 인바운드를 받을 때마다 남지만 같은 요청이 이미 `resolve` 실패 경고를 남기므로 로그 양의 등급은 같다. 참조 불일치 로그에는 저장값을 싣지 않는다. 참조 자리에 평문이 들어 있을 수 있어서다.
- **이번에 정하지 않은 것.** [채팅 채널 「R-CC-21 PATCH 는 비밀을 쓰지 않는다」](../CLE-CHAT/CLE-CHAT-CORE.md#r-cc-21-patch-는-비밀을-쓰지-않는다) 이 따로 검토하기로 한 `rotate` 의 빈 값 가드는 이번에도 넣지 않는다. 대조하지 않는 소비 지점도 있다. 봇 토큰 유예 정리와 해지는 서버만 쓰는 `chat_channel_token_v2` 컬럼의 참조를 쓴다. `delete` · `exists` · `deleteByPrefix` 는 참조만 본다([`SecretResolver` 인터페이스](#secretresolver-인터페이스)). 채팅 채널 활성화가 `setupChannel` 을 부르게 되면([채팅 채널 「봇 토큰 변경 단일 경로」](../CLE-CHAT/CLE-CHAT-CORE.md#봇-토큰-변경-단일-경로)) 그 경로도 읽기 관문을 지나야 한다. 실행 시점의 트리거 · 워크플로우 워크스페이스 대조는 [데이터 모델 개요 「저장된 교차 행 점검」](../CLE-PLAT/CLE-PLAT-DATA.md#저장된-교차-행-점검) 이 정했다(2026-10-05). 원시 `config` 의 나머지 계약은 2026-10-31 에 [R16](#r16-원시-config-의-타입-키와-secret-값을-막는다-2026-10-31) 으로 정했다(NERV Task `CLE-T-EA7B5M`). `interaction.triggerToken` 예외의 전제 (c) 는 2026-10-17 에 정했다. 그날 원시 `config` 로 이 값을 보내는 경로를 닫았다(NERV Task `CLE-T-EQDYC1`).
- **점검과 정리를 걷었다 (2026-10-05).** PR #1493~#1495 를 배포한 뒤 운영 DB 에서 점검 SQL 이 0 행이었다(사람 보고). 운영 환경은 운영 DB 한 곳이고(사람 확인) 셀프 호스팅 배포는 아직 없다. 정리할 행이 없어 정리 SQL 은 돌리지 않았다. 위 순서는 배포 전에 점검하도록 정했지만 실제 점검은 배포 뒤였다. 0 행이어서 정리와 재발급이 필요 없었다. 위 «정리 SQL 은 규칙 3 · 13 밖의 일회성 절차다» 가 정한 걷는 조건(점검이 모든 운영 환경에서 비면 걷는다)이 채워져 두 SQL 과 그 SQL 을 돌리던 e2e 케이스를 걷었다(NERV Task `CLE-T-N0RHDZ`). 위 «교차 행의 소유자는 정리 뒤에 다시 쓴다» 와 «운영 정리를 먼저 하는 순서» 는 그때의 결정이고 설계는 바뀌지 않았다. 백업 복원 등으로 교차 행이 다시 나타나면 같은 순서를 따른다. 두 SQL(`2026-10-04-trigger-secret-ref-audit.sql` · `-cleanup.sql`)은 저장소에는 없고 커밋 `d5cb730ec` 에서 꺼낸다. «정리 뒤 소유자가 다시 재발급할 수 있다» 를 확인하던 e2e 케이스도 함께 걷었으므로 그 순서를 지금 확인하는 테스트는 없다. 다른 문서가 이 절 제목으로 링크하므로 절 이름 「교차 행 점검과 정리」 는 그대로 두었다.

### R11. 실패 문장의 평문과 예외 메시지의 참조를 만든 자리에서 지운다 (2026-10-05)

NERV Task `CLE-T-H0GF4K` 가 채팅 채널의 마지막 오류 필드를 점검하다 두 경로를 찾았다. Slack 봇 토큰에 CR · LF · NUL 이 있으면 fetch 의 헤더 검증 오류가 토큰 전체를 원문에 실었고 그 원문이 `chat_channel_last_error` 와 로그로 갔다(규칙 14 위반). `resolve` 의 «없음» 오류가 참조를 실어 같은 필드에 저장될 수 있었다(규칙 4).

- 규칙 14 를 «평문을 내보내지 않는다» 에서 «실패 문장을 만든 자리에서 지운다» 는 의무까지 넓혔다. 저장된 뒤에 가리면 DB 와 로그의 유출이 남는다. 지우는 쪽은 그 호출에 쓴 평문을 들고 있는 모듈뿐이라 그 모듈에 의무를 둔다. 값을 알고 지우므로 패턴 오탐이 없다.
- 규칙 18 에 예외 메시지가 참조를 싣지 않는다는 문장을 더했다. `rotate` 의 거부(규칙 25)가 이미 그렇게 했고 `resolve` · `store` 를 맞췄다.
- 응답 쪽의 두 번째 층(값 패턴으로 가리기)은 [응답 자격 증명 마스킹](../CLE-API/CLE-API-EGRESS.md) 이 정한다. 이 변경 전에 저장된 `chat_channel_last_error` 에 남은 값은 그 문서의 「트리거 응답의 마지막 오류」 한계가 다룬다.

### R12. 첫 알림 서명 시크릿을 서버가 발급한다 (2026-10-09)

NERV Task `CLE-T-M6PERB` 의 재검토에서 첫 알림 서명 시크릿을 언제 누가 만드는지 정했다(사용자 결정, 2026-10-09). 서버는 `config.notification` 이 있는 트리거를 만들 때와 PATCH 가 EIA 알림 웹훅 설정을 처음 붙일 때 `wsk_<64hex>` 를 발급한다. 호출자가 원시 `config` 로 평문 `signing.secret` 을 보냈으면 그 값을 쓰고 발급하지 않는다. 2026-10-31 부터 원시 `config` 로 새 평문을 받는 경로는 닫혔다([R16](#r16-원시-config-의-타입-키와-secret-값을-막는다-2026-10-31)). 이 결정은 [External Interaction API 「트리거 등록과 웹훅 응답」](../CLE-IX/CLE-EIA.md#트리거-등록과-웹훅-응답) 의 요구사항을 따른다. 발급 동작은 [EIA 알림 웹훅](../CLE-IX/CLE-EIA-NOTIFY.md) 이 정한다. 응답 모양은 [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) 가 정한다. 함께 제시한 다른 안과 결정 이력은 그 Task 의 결정 기록에 있다. 이 규약은 그 결정에 맞춰 아래를 고쳤다.

- **비대칭의 근거를 고쳤다.** 「`Trigger.config.interaction.triggerToken`」 끝 단락은 알림 서명 시크릿이 사용자가 입력하는 HMAC 비밀이라 (c) 를 만족하지 않는다고 적었다. 첫 값을 서버가 발급하면 이 이유는 맞지 않는다. 결론은 그대로다. 호출자 평문을 받는 원시 `config` 경로가 남아 있어 값 공간이 닫혀 있지 않기 때문이다. `itk_*` 에도 원시 `config` 경로가 있지만 그 경로는 NERV Task `CLE-T-EA7B5M` 이 닫기로 한 틈이다. 알림 서명 시크릿의 평문 경로는 R9 가 범위에서 뺀 원시 `config` 계약이고 바꿀지는 같은 Task 가 정한다. 그 계약이 바뀌면 이 근거를 다시 본다. `itk_*` 의 원시 `config` 경로는 2026-10-17 에 닫혔다(NERV Task `CLE-T-EQDYC1`). 이제 두 값 가운데 원시 `config` 로 호출자 평문을 받는 경로는 알림 서명 시크릿의 옛 키 `signing.secret` 에만 남아 있다. 2026-10-31 에 이 경로도 닫혔다. 결론은 그대로이고 근거는 그 전에 호출자가 고른 평문이 시크릿 저장소와 행에 남아 있다는 사실로 바뀌었다([R16](#r16-원시-config-의-타입-키와-secret-값을-막는다-2026-10-31)).
- **일회성 응답을 규칙 4 의 금지에서 목록으로 뺐다.** 규칙 4 를 문장대로 읽으면 저장소 밖에 사는 필드의 새 값을 한 번 보여 주는 응답도 금지에 걸린다. 시크릿 교체(`rotate-secret`) 응답의 새 시크릿은 `notification_secret_v2` 에 들어가는 값이다. 트리거 단위 토큰 재발급(`revoke-token`) 응답의 `itk_*` 는 `config.interaction.triggerToken` 에 들어가는 값이다. 인증 설정의 생성 · 키 재생성 · 평문 보기 응답은 `AuthConfig.config` 자격 증명의 평문을 싣는다([외부 호출 인증 설정](../CLE-TRIG/CLE-TRIG-AUTHCFG.md)). 이 응답들은 이번 결정 전부터 있었다. 이 규약에는 그 근거가 없었다. 생성 · PATCH 응답이 첫 알림 서명 시크릿을 싣게 되면서 이 경계를 적어 둘 필요가 생겼다. 면제를 «서버가 새 비밀을 만든 응답» 같은 일반형으로 적으면 다른 발급 응답까지 면제로 읽히고 응답-계약 검증(규칙 5)과도 이어지지 않는다(검토 경위는 NERV Task `CLE-T-M6PERB` 의 결정 기록). 그래서 면제를 «이 규약이 이름 붙인 값을 그 값을 만든 바로 그 응답에 한 번 싣는 것» 으로 좁히고 대상 응답을 열거했다. 새 면제는 목록에 응답을 더해야 생긴다. 평문 보기는 값을 만든 응답이 아니다. 그래도 [외부 호출 인증 설정](../CLE-TRIG/CLE-TRIG-AUTHCFG.md) 이 비밀번호 재확인과 감사 기록을 조건으로 정한 경로라 목록에 넣었다. 빼면 이 규칙이 그 문서와 부딪친다. 면제 응답도 응답-계약 검증을 받으므로 평문을 싣는 필드의 DTO 선언 방법을 규칙 5 에 적었다. 그 밖의 응답에 이 필드와 참조를 싣지 않는다는 금지는 그대로다.
- **규칙 14 에 알려진 예외를 적었다.** [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) 은 원시 `config` 의 평문 `signing.secret` 이 시크릿 저장소로 옮겨지기 전이나 옮기다 실패하면 JSONB 에 남는다고 적는다. 이 규약에는 그 예외가 없어 «DB 는 항상 암호문만 본다» 가 실제보다 넓게 읽혔다. 예외를 닫는 일은 NERV Task `CLE-T-EA7B5M` 이 맡는다. 2026-10-31 에 새 평문 입력 경로가 닫혀 예외는 이미 저장된 옛 평문 행으로 좁혀졌다([R16](#r16-원시-config-의-타입-키와-secret-값을-막는다-2026-10-31)).
- **사용 패턴 · 참조 표 · 규칙 7 을 맞췄다.** 「트리거 생성」 예시는 호출자가 보낸 평문이 있을 때만 참조를 만들었다. 서버 발급 분기를 더했다. 참조는 R10 이 정한 대로 `notificationSigningSecretRef` 로 만든다. 규칙 7 은 PATCH 가 처음 붙일 때의 저장도 `rotate` 로 하게 넓혔다. 알림 서명 비밀 행은 트리거가 없어질 때 prefix 로만 지우므로(규칙 8) 설정을 뗐다가 다시 붙이면 같은 참조에 옛 행이 남아 있을 수 있다.
- **PATCH 는 알림 서명 참조를 행에서 복사하지 않고 다시 만든다.** PATCH 는 트리거 설정 잠금 안에서 다시 읽은 행의 알림 서명 참조를 규칙 24 로 판정해 있음 · 없음만 쓴다. 있으면 참조를 트리거 id 로 다시 만들어 싣는다. 규칙 23 · 24 가 저장값 대신 리소스 id 로 참조를 만들게 하는 것과 같은 방식이다. 저장 경계가 막기 전의 행에는 다른 값이 있을 수 있다(R10). 판정이 규칙 24 와 다르면 `secret://` 형식이 아닌 값이 든 옛 행에서 PATCH 는 «있음» 으로 보고 발급하지 않는다. 발송 쪽은 같은 행을 «없음» 으로 보므로 주 시크릿이 없는 상태가 남는다. 판정과 발급 쓰기는 같은 잠금 안에서 한다. 동시 PATCH 두 건이 잠금 밖에서 각자 발급하면 한쪽 응답의 평문은 저장소에 남지 않는다. 잠금 안에서도 워크플로우 · 워크스페이스 삭제로 행이 사라질 수 있어서 규칙 9 의 되돌리기를 잠금 안 쓰기까지 넓혔다. 이 되돌리기는 R14 에서 시크릿 승격으로 좁혔다. 참조가 없는 행에 옛 평문 `signing.secret` 이 남아 있으면 PATCH 는 발급하지 않고 그 평문을 시크릿 저장소로 옮긴다. 통째 교체로 그 평문이 사라지면 수신 측이 쓰던 시크릿이 유예 없이 바뀌기 때문이다. 이 방식은 사용자에게 묻지 않고 기본값으로 정해 알렸다.
- **잠금 밖 쓰기 대신 잠금 안에서 쓴다.** 견준 안은 둘이었다. 하나는 잠금 밖에서 비밀을 쓰고 잠금 안 재기록이 행 부재로 실패하면 되돌리는 방식이다. 채팅 채널 설정이 쓰는 방식이다(규칙 9). 판정이 잠금 밖에 있으면 동시 PATCH 두 건이 각자 «없음» 으로 보고 발급한다. 나중 쓰기가 앞 쓰기를 덮어 먼저 나간 응답의 평문은 저장소에 남지 않는다. 되돌리기는 행 부재만 다루므로 이 덮어쓰기를 막지 못한다. 다른 하나는 `store()` 로 쓰고 같은 참조가 이미 있으면 throw 하게 해 늦은 요청을 실패시키는 방식이다. `store()` 의 «이미 있음» 동작은 백엔드 구현에 따라 다를 수 있다(규칙 7). 설정을 뗐다가 다시 붙이면 같은 참조에 옛 행이 남아 있어 정상 요청도 실패한다(규칙 8). 그래서 판정과 쓰기를 한 잠금 안에 두었다.
- **잠금 안 시크릿 저장소 쓰기는 백엔드 교체의 예외다.** PATCH 의 첫 알림 서명 시크릿 발급 · 옮기기와 시크릿 승격은 트리거 설정 잠금 안에서 시크릿 저장소에 쓴다. 잠금 안에서 HTTP 호출을 하지 않는다는 제약은 Cafe24 토큰 갱신이 같은 잠금을 기각한 이유에서 왔다. 잠금을 쥔 채 HTTP 요청을 하면 DB 커넥션 점유가 길어진다([트리거 관리 「동시 쓰기 직렬화」](../CLE-TRIG/CLE-TRIG-MANAGE.md#동시-쓰기-직렬화)). 지금 백엔드는 같은 DB 의 테이블이라 이 쓰기에 HTTP 호출이 없다. 외부 백엔드를 들이면 이 경로들은 잠금 밖 쓰기와 되돌리기(규칙 9)로 다시 설계한다. 그래서 규칙 13 이 기대는 «백엔드를 규약 변경 없이 바꿀 수 있다» 는 이 경로들에는 그대로 성립하지 않는다. 「다른 백엔드로 바꾸기」 에 이 예외를 적었다. 이 전제도 사용자에게 묻지 않고 기본값으로 정해 알렸다. 2026-10-17 에 생성 경로가 이 목록에 들었다(R14).

### R13. 통합 암호화 키 `INTEGRATION_ENCRYPTION_KEY` 를 마스터키와 따로 두고 production 에서 키 없이 기동하지 않는다 (2026-10-10)

이 규약과 통합 · 트리거 데이터 문서는 통합 자격 증명과 인증 설정의 암호화 키 이름을 서로 다르게 적었고 미결로 남겼다. 구현은 `INTEGRATION_ENCRYPTION_KEY` 를 읽었다. 키가 없으면 경고만 남기고 평문으로 저장했다. 운영 환경 가드(`assertProductionConfig`)는 이 키를 검사하지 않았다. 그래서 운영 환경에서도 OAuth 토큰과 API 키가 평문으로 쌓일 수 있었다(finding 01a0e59c-eea2-7590-953c-2899ba1c5ad4). NERV Task `CLE-T-2V7SBC` 에서 사용자가 아래와 같이 정했다(2026-10-10).

- 두 키를 그대로 둔다. `ENCRYPTION_KEY` 는 이 저장소와 LLM API 키를 암호화하는 마스터키다. `INTEGRATION_ENCRYPTION_KEY` 는 통합 자격 증명과 인증 설정 컬럼 transformer 의 키다(규칙 26).
- `NODE_ENV=production` 에서 통합 암호화 키가 없거나 공백뿐이거나 공개 예시 값이면 기동하지 않는다. 부팅 때 환경 변수를 검사하는 운영 환경 가드(`assertProductionConfig`)가 막는다. 요청 경로에서는 예외를 던지지 않는다.
- 운영 환경 밖에서는 지금처럼 키가 없으면 경고를 남기고 평문으로 저장한다. 평문 저장은 운영 환경 밖에서만 허용한다고 문서에 적는다.
- 이미 평문으로 저장된 행은 그대로 읽는다. 서버가 일괄로 다시 암호화하지 않는다.
- 키 길이에 하한을 두지 않는다. transformer 가 SHA-256 으로 키를 만들어 어떤 길이든 받는다. 32바이트 이상의 무작위 값은 권고로 둔다.

동작의 규범은 [통합 데이터와 흐름 「암호화」](CLE-INT-DATA.md#암호화) 한 곳에 둔다. 공개 예시 값 목록은 스펙에 옮기지 않는다. 정본은 `production-guards.ts` 의 `INSECURE_INTEGRATION_ENCRYPTION_KEYS` 이고 그 단위 테스트가 저장소의 예시 파일 값과 대조한다.

- **기동을 막는 기준과 배포 영향.** 운영 환경 가드는 정당한 용도가 없는 설정만 기동을 막는다([세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) 의 Rationale 「운영 환경 가드」). 키가 없는 운영 설정은 새로 쓰는 자격 증명을 평문으로 저장하므로 이 기준에 따라 막는다. 그래서 통합과 인증 설정을 쓰지 않는 운영 배포도 이 키를 설정해야 한다. `.env.example` 과 k8s 예시 Secret(`k8s/base/secret.example.yaml`)에는 이미 이 키 이름이 있다.
- **요구사항과의 관계.** [비기능 요구사항](../CLE-PLAT/CLE-PLAT-NFR.md) 의 REQ-NFR-009 와 [통합 관리](CLE-INT-MANAGE.md) 의 REQ-INTMGMT-012 가 요구하는 암호화는 지금 운영 환경에서 새로 쓰는 값에만 보장된다. 요구사항 문구의 범위를 좁히는 일은 후속 NERV Task `CLE-T-KQ37NJ` 가 맡는다.
- **키 길이에 하한을 두지 않는 이유.** 하한을 넣으면 짧은 키로 운영 중인 환경은 키를 바꿔야 한다. 키를 바꾸면 옛 키로 암호화한 행은 복호화되지 않는다. `JWT_SECRET` 은 서명에 쓰는 키라 하한을 둔다. 키 길이 계약은 NERV Task `CLE-T-C6GCKV` 가 정한다.
- **저장소 예외 근거를 고친 경위.** [저장소 예외 필드](#저장소-예외-필드) 의 `AuthConfig.config` 근거는 «동등하게 암호화된다» 였다. transformer 는 AAD 를 쓰지 않고 운영 환경 밖에서는 평문으로 저장하므로 «다른 메커니즘으로 암호화된다» 로 고쳤다.

견준 안과 택하지 않은 이유는 다음과 같다.

- **두 키를 하나로 합친다.** 두 키는 키를 만드는 방식이 다르다. `ENCRYPTION_KEY` 는 64자 hex 면 원시 32바이트로 쓰고 통합 암호화 키는 늘 SHA-256 으로 만든다. 그래서 64자 hex 문자열을 두 키에 함께 넣으면 실제 키가 다르다. 그 밖의 문자열이면 두 키 모두 SHA-256 으로 만들어 실제 키가 같다. 합치면 실제 키가 바뀌는 쪽의 기존 암호문을 모두 다시 암호화해야 한다. 이 재암호화 작업이 커서 택하지 않았다.
- **운영 환경에서도 평문 저장을 허용한다.** OAuth 토큰과 API 키가 평문으로 쌓인다(finding 01a0e59c-eea2-7590-953c-2899ba1c5ad4).

이번에 정하지 않은 것도 있다.

- 부팅이나 마이그레이션 때 평문 행을 자동으로 다시 암호화할지는 정하지 않는다. 방법과 키 길이 계약은 NERV Task `CLE-T-C6GCKV` 가 정한다.
- 운영 환경 밖에서도 키가 없으면 기동을 멈출지(규칙 17 의 마스터키 처리와 같게)는 결정 때 견주지 않았다. 운영 환경 밖은 지금 동작(경고 후 평문 저장)을 유지했다. 두 키의 처리가 다른 이유는 따로 정하지 않았다. transformer 는 키가 없어도 동작하도록 만들어져 있다.

### R14. 생성의 첫 발급을 INSERT 와 한 트랜잭션에 묶는다 (2026-10-17)

트리거 생성은 INSERT 와 감사 기록을 먼저 커밋하고 첫 알림 서명 시크릿을 그 뒤에 따로 정했다. 그 사이에 실패하면 `config.notification` 은 있고 `signing.secretRef` 는 없는 행이 남았다. 호출자가 다시 시도하면 `endpointPath` UNIQUE 충돌이 나거나 트리거가 둘 생겼다(NERV Task `CLE-T-EQDYC1`, finding 01a11f6b-ae23-737b-970b-1d9e3d0248ea · 01a11f6b-aa56-75c5-9767-01bd7663ab1a · 01a11f6b-a70a-7255-bd1b-670b6ce3b307 · 01a11f6b-d09a-747d-84f5-f7683b757f7d · 01a11f6b-c3aa-7197-acd5-b131e882c4f5). 2026-10-17 에 아래와 같이 정했다.

- 트리거 INSERT · 첫 알림 서명 시크릿의 발급이나 옮기기 · `itk_*` 발급(R15) · 시크릿 저장소 쓰기 · `config` 쓰기를 트리거 설정 잠금을 쥔 한 트랜잭션에서 한다. 어느 단계가 실패해도 행이 남지 않는다. 호출자는 같은 요청을 다시 보내면 된다.
- 시크릿 저장소 쓰기는 그 트랜잭션의 매니저로 한다(`rotate` 의 `manager` 인자). PATCH 와 시크릿 승격도 같다. 풀 연결을 하나 더 빌리지 않으므로 잠금을 쥔 요청이 연결 둘을 쥐지 않는다. 같은 트랜잭션이라 뒤따르는 `config` 쓰기가 실패하면 비밀 쓰기도 롤백된다(finding 01a11f6d-e219-7351-8323-78fee8e038ea · 01a11f6e-11e3-743e-a1fb-0a2830ecdbdd).
- 그래서 규칙 9 의 되돌리기가 줄었다. R12 는 잠금 안 쓰기에도 되돌리기를 두었다. 이제 예외로 끝나는 경우는 롤백이 맡는다. 남는 것은 FK CASCADE 로 행이 사라져 시크릿 승격의 `config` 쓰기가 예외 없이 0행으로 끝나는 경우다. 생성은 커밋 전의 자기 행에 쓰므로 이 경우가 없다.
- 감사 기록은 이 트랜잭션에 넣지 않고 커밋 직후 트랜잭션 밖에서 남긴다. 생성이 롤백되면 `trigger.created` 행은 남지 않는다. 옛 동작에서는 감사가 첫 발급보다 먼저였고 첫 발급은 커밋 뒤의 별도 단계였다. 이제는 첫 발급까지 한 트랜잭션으로 커밋한 뒤에 감사를 남긴다. 커밋과 감사 사이에 프로세스가 죽으면 감사 행 없는 트리거가 남을 수 있다. PATCH 도 커밋 직후에 감사를 남기므로 같은 위험으로 받아들였다. 감사 적재 실패는 지금처럼 흡수하고 생성을 실패시키지 않는다([감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md) REQ-AUDIT-003).
- 채팅 채널 설정은 이 트랜잭션에 넣지 않는다. provider 등록이 HTTP 호출이고 잠금 안에서는 HTTP 호출을 하지 않는다([트리거 관리 「동시 쓰기 직렬화」](../CLE-TRIG/CLE-TRIG-MANAGE.md#동시-쓰기-직렬화)). 채팅 채널의 비밀은 지금처럼 커밋 뒤 잠금 밖에서 쓰고 행이 없으면 되돌린다(규칙 9).
- 커밋 뒤 응답이 호출자에게 닿지 못하면 그 평문은 다시 받을 수 없다. 알림 서명 시크릿은 시크릿 교체(`rotate-secret`)로, `itk_*` 는 트리거 단위 토큰 재발급(`revoke-token`)으로 새로 받는다.

기각한 대안:

- **실패하면 만든 행을 지운다.** 지우는 일도 실패할 수 있다. 지우기 전까지 반쪽 행이 다른 요청에 보인다. 이미 커밋된 `trigger.created` 감사 행은 지운 트리거를 가리키게 된다.
- **커밋 뒤 단계로 두고 실패를 시크릿 교체로 복구하게 한다.** 반쪽 행이 남는 것은 그대로다. 호출자는 오류 응답만 보고 트리거가 생겼는지 알 수 없다. 다시 시도하면 위 충돌이 난다.
- **감사도 생성 트랜잭션 안에서 남긴다.** 같은 날의 첫 초안이 택한 안이다. `AuditLogsService.record` 는 매니저를 받지 않으므로 매니저 인자를 더해야 한다. 트랜잭션 안에서 감사 INSERT 가 실패하면 Postgres 트랜잭션 전체가 중단된다. 그러면 감사 실패를 흡수하는 계약(REQ-AUDIT-003)을 지키려고 savepoint 로 감싸야 한다. 얻는 것은 커밋과 감사 사이의 짧은 창을 닫는 것뿐이고 PATCH 경로와도 달라진다. 근거는 [감사 로그 「트리거 생성의 감사 행은 커밋 직후 트랜잭션 밖에서 남긴다」](../CLE-OBS/CLE-OBS-AUDIT.md#트리거-생성의-감사-행은-커밋-직후-트랜잭션-밖에서-남긴다) 에 있다.

### R15. 생성 · PATCH 응답이 발급한 `itk_*` 를 규칙 4 의 면제에 더한다 (2026-10-17)

사용자가 트리거 단위 토큰을 트리거 생성 때 발급하기로 정했다(2026-10-17, NERV Task `CLE-T-EMB0YG`). 인터랙션을 켜고 전략이 `per_trigger` 인 트리거를 만들면 서버가 `itk_*` 를 발급한다. PATCH 가 `per_trigger` 를 처음 켰는데 유효한 토큰이 없을 때도 발급한다. 이미 토큰이 있으면(끈 뒤 다시 켜는 경우 포함) 새로 발급하지 않는다. 발급 조건의 기준은 [External Interaction API 「트리거 등록과 웹훅 응답」](../CLE-IX/CLE-EIA.md#트리거-등록과-웹훅-응답) 과 [트리거 관리 「PATCH 본문 계약」](../CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약) 이다. 이 규약은 응답 면제만 정한다.

- 평문은 생성 · PATCH 응답의 `data.secrets.interactionToken` 에 한 번 싣는다. 첫 알림 서명 시크릿과 같은 묶음이고 그 응답이 발급했을 때만 키가 있다([HTTP API 규약 §5.5](../CLE-API/CLE-API-CONV.md#55-부재-표현-null-과-키-생략) 기준 (b)). 그 값을 만든 바로 그 응답이라 규칙 4 의 기준에 맞는다.
- 저장 위치는 그대로 `config.interaction.triggerToken` 이다. [저장소 예외 필드](#저장소-예외-필드) 의 근거 (a)~(c) 는 바뀌지 않는다. 응답에서는 지금처럼 이 필드를 빼고 보낸다.

기각한 대안:

- **생성 때 발급하지 않는다.** 지금까지의 동작이고 미결로 남아 있었다. 그러면 `per_trigger` 트리거를 만든 뒤 트리거 단위 토큰 재발급을 따로 불러야 토큰이 생긴다.
- **응답 필드를 따로 둔다**(예: 재발급 응답처럼 `data.token`). 생성 · PATCH 응답의 일회성 평문은 이미 `data.secrets` 묶음에 있다. 한 응답에 두 비밀이 함께 실릴 수 있어 같은 묶음의 선택 필드로 두었다.

### R16. 원시 `config` 의 타입 키와 `secret://` 값을 막는다 (2026-10-31)

R9 는 원시 `config`(트리거 생성 · 수정 본문의 `config` 키)에 실린 시크릿 참조를 경로 목록으로 막았다. 세 타입 키를 통째로 막는 안은 원시 `config` 의 다른 계약을 함께 바꾸므로 NERV Task `CLE-T-EA7B5M` 으로 넘겼다. 2026-10-31 에 사용자가 그 Task 의 질문에 답해 아래를 정했다. 결정 전체와 기각안 · 근거의 정본은 [트리거 관리 「원시 `config` 계약 (2026-10-31)」](../CLE-TRIG/CLE-TRIG-MANAGE.md#원시-config-계약-2026-10-31) 이다. 이 규약에는 시크릿에 닿는 부분만 적는다.

- **타입 키를 받지 않는다.** 원시 `config` 바로 아래에 `notification` · `interaction` · `chatChannel` 키가 있으면 값과 상관없이 400 이다. R9 가 범위에서 뺀 안이다. 기각이 아니라 유보였고 이번에 채택했다. 이 결정으로 옛 평문 `notification.signing.secret` 을 새로 받는 경로가 닫혔다. 그 키는 원시 `config` 로만 들어왔기 때문이다. 견준 두 안은 `notification` 만 계속 받는 안과 세 키를 받되 요청 본문의 최상위 타입 필드와 같은 검사를 거치게 하는 안이었다. 둘 다 옛 평문 입력 경로를 남긴다.
- **`secret://` 값은 위치와 상관없이 거부한다.** 원시 `config` 아래 어디든(중첩 객체 · 배열 원소 포함) `secret://` 로 시작하는 문자열 값이 있으면 400 이다. 경로 목록은 사람이 더하는 목록이라 새 참조 슬롯을 빠뜨려도 테스트가 실패하지 않는다. R9 가 남긴 위험이고 규칙 22 가 사람에게 맡긴 일이다. 타입 키 거부로 그 아래 슬롯은 모두 막히지만 다른 키 아래에 참조를 심는 경로는 남는다. 값 검사는 슬롯 이름과 상관없이 잡는다. 경로 목록 거부는 그대로 두고 먼저 돈다. 견준 안은 값 검사를 더하지 않고 경로 목록만 두는 것이었다.
- **이미 저장된 옛 평문은 계속 읽고 옮긴다.** 닫은 것은 새로 받는 경로뿐이다. 저장된 행의 옛 평문 `signing.secret` 은 발송 때 서명에 쓰고 PATCH 가 시크릿 저장소로 옮긴다. 지우면 수신 측이 쓰던 시크릿이 유예 없이 바뀐다. 그래서 규칙 14 의 알려진 예외는 그런 행으로 좁혀졌다. 「`Trigger.config.interaction.triggerToken`」 끝 단락의 비대칭 근거는 그 전에 호출자가 고른 평문이 남아 있다는 사실로 바뀌었다. 규칙 9 의 되돌리기 경우는 «원시 `config` PATCH» 에서 «저장된 옛 평문을 옮기는 PATCH 정규화» 로 고쳤다. 그런 행에 남은 옛 평문은 저장소 밖에 사는 필드라 규칙 4 의 응답 비노출 목록에 더했다. 구현은 전부터 응답에서 이 키를 걷어 냈지만(`triggers.service.ts` 의 `NOTIFICATION_SIGNING_STRIP_KEYS`) 규약 목록에는 없었다.
- **원시 `config` 는 `config` 바로 아래 키 단위로 병합한다.** 종전 구현은 `config ?? fresh.config` 라 원시 `config` 를 보낸 PATCH 가 저장된 `config` 를 통째로 바꿨다. 그래서 저장된 `chatChannel.inboundSigningRef` · `notification.signing.secretRef` 가 지워질 수 있었다. 이제 타입 키는 원시 `config` 로 바뀌지 않아 저장값이 남는다. 통째 교체를 계약으로 남기는 안은 `inboundSigningRef` 가 사라지면 인바운드 서명 검증이 열리므로 택하지 않았다. 병합 규칙은 [트리거 관리 「PATCH 본문 계약」](../CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약) 이 정한다.

R9 「남긴 것」 과 R10 「이번에 정하지 않은 것」 이 이 Task 로 넘긴 원시 `config` 계약은 여기서 닫혔다.
