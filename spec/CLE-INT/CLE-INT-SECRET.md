---
id: "CLE-INT-SECRET"
title: "시크릿 저장소"
type: "convention"
version: 18
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-INT"
ancestors: ["CLE-VISION", "CLE-INT"]
area: "CLE-INT"
content_hash: "1030e7657c2e4e0a2de2aeb3458a6dde89fb9be2f1d9f35211bfbbc0c1bd5b33"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/conventions/secret-store.md"]
mirror_sha256: "1566e80bbd40a0b0662a2e25b9278889473c01455bed0017c8af9a94dda8f1d9"
etag: "sha256-8c3c41380059ab0f83403377bf4602c6f0818a0447063ec2f15e057a70342777"
---
> 구현 상태: 구현됨 · 원문: `spec/conventions/secret-store.md` · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 규약은 외부 서비스 비밀(Telegram 봇 토큰, 웹훅 `secret_token`, EIA 알림 웹훅 HMAC 서명 시크릿 등)을 보관하는 추상화인 시크릿 저장소(SecretStore, `secret_store`)를 정한다. 비밀은 시크릿 참조(secret ref, `secret://<scope>/<resourceId>/<name>`)로 가리키고, 읽고 쓰기는 `SecretResolver` 한 곳으로만 한다. 저장 백엔드는 PostgreSQL 에 애플리케이션이 AES-256-GCM 으로 암호화한 값을 두는 방식이다.

도메인 모듈은 비밀을 이 규약의 `SecretResolver` 로 읽고 쓴다. 예외는 [저장소 예외 필드](CLE-INT-SECRET-EXPOSE.md#저장소-예외-필드) 에 이름을 올린 필드뿐이고, 예외마다 자기 근거를 따로 세운다. 한 예외의 근거를 다른 예외에 빌려 쓰지 않는다.

현재 통합 자격 증명(`Integration.credentials`)은 이 저장소를 쓰지 않는다. 통합 엔티티의 컬럼 transformer 가 직접 암호화한다([통합 데이터와 흐름](CLE-INT-DATA.md)). 이 필드를 저장소 예외로 올릴지는 [미결 사항](#미결-사항) 에 있다.

범위 밖:

- `secret_store` 테이블 컬럼 정의는 [통합 데이터와 흐름](CLE-INT-DATA.md) 이 소유한다.
- 사용자 민감 컬럼의 응답 노출 금지는 [계정과 워크스페이스 데이터 흐름](../CLE-ACCT/CLE-ACCT-DATA.md) 이 소유한다. 같은 금지와 같은 근거가 걸리지만 그 컬럼들은 외부 서비스 비밀이 아니고 `secret://` 에 살지 않는다. 이 규약의 관할을 그쪽으로 넓히지 않는다.
- 인증 설정(AuthConfig) 응답 마스킹은 [외부 호출 인증 설정](../CLE-TRIG/CLE-TRIG-AUTHCFG.md) 과 [트리거 데이터와 흐름](../CLE-TRIG/CLE-TRIG-DATA.md) 이 소유한다.
- 봇 토큰 재발급 동작은 [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md), 알림 서명 시크릿 교체 동작은 [EIA 알림 웹훅](../CLE-IX/CLE-EIA-NOTIFY.md) 이 소유한다.
- 트리거 행이 없어지는 경로 목록은 [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) 가 소유한다.
- 운영 환경 가드(`assertProductionConfig`)가 마스터키와 통합 암호화 키를 거부하는 기준은 [세션과 토큰 「암호화 키 검사」](../CLE-ACCT/CLE-ACCT-SESSION.md#암호화-키-검사) 가 소유한다.

## 하위 문서

이 규약에는 요구사항 줄이 없다. 그래서 아래 하위 문서가 맡는 요구사항 번호도 없다. 규칙(규칙 1~27)과 참조 예시는 이 문서에 있고 하위 문서는 그 규칙의 세부 · 근거를 맡는다.

- [시크릿 저장소 — 인터페이스와 저장 백엔드](CLE-INT-SECRET-BACKEND.md): `SecretResolver` 인터페이스와 함수별 부작용 · 멱등성, `secret_store` DB 가드, 암호화 형식, 마스터키, 다른 백엔드로 바꾸기. 규칙 12 · 15~17 · 19~21 · 26 · 27 의 세부와 R1 · R4~R6 · R8 · R13 · R17 · R18. 요구사항: 없음.
- [시크릿 저장소 — 저장소 예외 필드와 응답 노출](CLE-INT-SECRET-EXPOSE.md): 저장소 예외 필드 세 개와 각 근거, 응답 비노출(규칙 3~6 · 14)의 근거와 단언 테스트. R7 · R11 · R15 · R19. 요구사항: 없음.
- [시크릿 저장소 — 사용 패턴과 시크릿 발급](CLE-INT-SECRET-USAGE.md): 사용 패턴(트리거 생성 · PATCH 의 첫 발급, 외부 API 호출, 트리거 행 삭제, 봇 토큰 재발급, 인바운드 서명 자료 초기화). 규칙 7~11 의 세부와 R3 · R12 · R14 · R20. 요구사항: 없음.
- [시크릿 저장소 — 참조 소유와 교차 행](CLE-INT-SECRET-REFS.md): 리소스 설정 시크릿 참조의 소유(규칙 22~25)의 근거, 원시 `config` 거부, 교차 행 점검과 정리. R9 · R10 · R16. 요구사항: 없음.

## 규칙

1. 시크릿 참조는 `secret://<scope>/<resourceId>/<name>` 형식이다. `scope` 는 자원 namespace 로 lower-case kebab-case(예: `triggers`, `oauth-clients`)다. `resourceId` 는 UUID v4 또는 다른 스펙이 정한 ID 형식이다. `name` 은 자원 안 비밀 이름으로 lower-case kebab-case(예: `bot-token`, `inbound-signing`, `notification-signing`, `bot-token.v2`)다. DB 도 같은 형식을 CHECK 로 막는다([저장 백엔드](CLE-INT-SECRET-BACKEND.md#저장-백엔드)).
2. `name` 끝의 `.v2` 는 같은 자원의 24시간 유예용 변형이다. 현재 쓰는 곳은 채팅 채널 봇 토큰 재발급([채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md))뿐이다. EIA 알림 서명 시크릿 교체는 `.v2` 참조를 쓰지 않는다([저장소 예외 필드](CLE-INT-SECRET-EXPOSE.md#저장소-예외-필드)).
3. 도메인 모듈은 비밀을 `SecretResolver` 로 읽고 쓴다. 예외는 [저장소 예외 필드](CLE-INT-SECRET-EXPOSE.md#저장소-예외-필드) 에 올린 필드뿐이며, 예외를 올릴 때 그 필드만의 근거를 적는다.
4. 저장소 예외 필드는 **저장 위치**의 예외일 뿐 **노출**의 예외가 아니다. 저장소 밖에 사는 필드(`AuthConfig.config` 자격 증명의 평문, `Trigger.config.interaction.triggerToken`, `Trigger.notification_secret_v2`, 시크릿 저장소로 옮기기 전의 옛 평문 `Trigger.config.notification.signing.secret`)와 시크릿 참조(`Trigger.chat_channel_token_v2`, `config.*.botTokenRef`, `config.*.inboundSigningRef`, `config.notification.signing.secretRef`)는 응답 DTO 에 선언해서도, 응답 바디에 실어서도 안 된다. 참조도 대상이다. 평문은 아니지만 내부 저장 위치를 드러낸다. 인증 설정 응답이 싣는 마스킹된 값(`***<last4>`)은 평문이 아니므로 이 금지의 대상이 아니다. 그 응답 모양은 [외부 호출 인증 설정 「필드 마스킹과 평문 보기」](../CLE-TRIG/CLE-TRIG-AUTHCFG.md#필드-마스킹과-평문-보기) 가 정한다. 이 금지의 예외는 아래 응답뿐이다. 이 응답들은 이 규약이 이름 붙인 필드의 값이나 이름 붙인 참조가 가리키는 값의 평문을 한 번 싣는다. 평문 보기를 빼면 모두 그 값을 만든 바로 그 응답이다. 새 면제는 이 목록에 응답을 더해야 생긴다. 응답 모양은 각 응답을 소유한 문서가 정한다.
   - 트리거 생성 응답과 PATCH 응답 가운데 서버가 첫 알림 서명 시크릿을 발급한 응답은 그 평문을 `data.secrets.notificationSigningSecret` 에 싣는다([트리거 관리 「API」](../CLE-TRIG/CLE-TRIG-MANAGE.md#api)).
   - 트리거 생성 응답과 PATCH 응답 가운데 서버가 트리거 단위 토큰을 발급한 응답은 `Trigger.config.interaction.triggerToken` 에 들어가는 새 `itk_*` 를 `data.secrets.interactionToken` 에 싣는다([트리거 관리 「API」](../CLE-TRIG/CLE-TRIG-MANAGE.md#api)). 토큰은 지금처럼 `config.interaction.triggerToken` 에 두고 이 응답에만 한 번 싣는다.
   - 시크릿 교체(`rotate-secret`) 응답은 `Trigger.notification_secret_v2` 에 들어가는 새 알림 서명 시크릿을 `data.secret` 에 싣는다.
   - 트리거 단위 토큰 재발급(`revoke-token`) 응답은 `Trigger.config.interaction.triggerToken` 에 들어가는 새 `itk_*` 를 `data.token` 에 싣는다.
   - 인증 설정 생성 · 키 재생성 응답은 평문 `config` 를 싣는다([외부 호출 인증 설정 「필드 마스킹과 평문 보기」](../CLE-TRIG/CLE-TRIG-AUTHCFG.md#필드-마스킹과-평문-보기)).
   - 인증 설정 평문 보기(`POST /api/auth-configs/:id/reveal`) 응답은 평문 `config` 를 싣는다. 값을 만든 응답이 아닌 유일한 항목이다. 비밀번호 재확인과 감사 기록을 거친 요청에만 한 번 싣는다([외부 호출 인증 설정 「평문 보기 흐름」](../CLE-TRIG/CLE-TRIG-AUTHCFG.md#평문-보기-흐름)).
5. 규칙 4 는 두 축으로 시행한다. [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 의 응답-계약 검증(선언하지 않은 키를 위반으로 본다)과 [OpenAPI 문서화](../CLE-API/CLE-API-SWAGGER.md) 의 엔티티 패스스루 금지다. 규칙 4 의 예외 응답도 이 검증을 받는다. 그래서 평문을 싣는 필드는 그 응답의 DTO 에 선언한다. 같은 DTO 가 평문을 싣지 않는 응답에도 쓰이면 그 필드는 선택 필드로 선언하고 [HTTP API 규약 §5.5](../CLE-API/CLE-API-CONV.md#55-부재-표현-null-과-키-생략) 기준 (b) 사유를 적는다. 두 축 모두 열린 맵(`additionalProperties: true` 로 선언한 객체, 예: `TriggerDto.config`) 안의 키는 보지 않는다. 그래서 열린 맵 안에 두는 저장소 예외 필드와 시크릿 참조는 응답에 그 키가 없음을 단언하는 e2e 를 함께 둔다. 공개 API 로 더는 저장할 수 없는 옛 값은 단위 테스트로 단언한다([R19](CLE-INT-SECRET-EXPOSE.md#r19-열린-맵-안의-비밀은-응답-부재를-테스트로-단언한다-2026-11-07)).
6. 엔티티를 그대로 반환하는 경로에서는 응답 경계에서 지운다. 컬럼 수준 `select: false` 는 쓰지 않는다. 그 컬럼을 읽는 내부 경로(교체 승격, 정리 스윕)가 예외 없이 `undefined` 를 받아 조용히 오작동하기 때문이다.
7. 트리거를 만들 때(알림 웹훅·채팅 채널 설정 포함)와 PATCH 가 EIA 알림 웹훅 설정을 처음 붙일 때 비밀 저장은 `rotate(ref, workspaceId, plaintext)` 를 쓴다. PATCH 가 저장된 행의 옛 평문 `signing.secret` 을 시크릿 저장소로 옮길 때도 `rotate` 를 쓴다. UPSERT 라 같은 워크스페이스에서 설정을 다시 시도해도 안전하다(다른 워크스페이스의 행은 규칙 25). `store()` 도 결과는 같지만 같은 참조가 이미 있을 때의 동작(덮어쓰기 또는 throw)이 백엔드 구현에 따라 달라질 수 있다.
8. 트리거 행이 없어질 때(트리거·스케줄·워크플로우·워크스페이스 삭제) 그 트리거의 모든 참조를 `deleteByPrefix('secret://triggers/{id}/')` 로 한꺼번에 지운다. 행 삭제가 커밋된 **뒤에** 지운다. 채널 프로바이더 쪽 정리 작업이 이 비밀을 읽으므로 먼저 지울 수 없고, 행 삭제 전에 지우면 그 사이 커밋된 쓰기가 남긴 비밀을 아무도 지우지 않는다. DB FK 가 없으므로 애플리케이션 책임이다. 개별 `delete()` 보다 prefix 삭제를 쓴다.
9. 트리거 락 밖에서 비밀을 쓴 뒤 락 안 재기록이 행 부재로 실패하면 `deleteByPrefix('secret://triggers/{id}/')` 로 되돌린다. 채팅 채널 설정과 저장된 옛 평문을 옮기는 PATCH 정규화(`migrateLegacyPlaintext`)가 이 경우다. 트리거 락 안에서 비밀을 쓰는 경로(생성 · PATCH 의 첫 알림 서명 시크릿 발급과 옛 평문 옮기기, 시크릿 승격)는 그 락을 쥔 트랜잭션의 매니저로 쓴다. 그래서 풀 연결을 더 쓰지 않는다. 그 트랜잭션이 예외로 끝나면 비밀 쓰기도 함께 롤백되므로 따로 되돌릴 것이 없다. 생성은 행을 넣은 트랜잭션 안에서 쓴다. 커밋 전의 행은 다른 트랜잭션이 지우지 못하므로 행 부재가 생기지 않는다. 남는 것은 시크릿 승격이다. 워크플로우 · 워크스페이스 삭제의 FK CASCADE 는 이 락을 거치지 않아 락 안에서도 행이 사라질 수 있다. 그때 승격의 `config` 쓰기는 예외 없이 0행으로 끝나고 비밀 쓰기는 커밋된다. 그래서 커밋 뒤 같은 prefix 로 되돌린다. 규칙 8 과 짝이다. 행이 없으므로 prefix 전체를 지워도 안전하다([트리거 관리 「동시 쓰기 직렬화」](../CLE-TRIG/CLE-TRIG-MANAGE.md#동시-쓰기-직렬화)).
10. 외부 API 호출 직전(메시지 전송, HMAC 서명 등)에는 매번 `resolve(ref)` 로 값을 가져온다. 캐싱 여부는 `SecretResolver` 내부가 정한다.
11. 비밀 교체도 `rotate()`(UPSERT)로 쓴다. 채팅 채널 봇 토큰 재발급은 옛 토큰을 `bot-token.v2` 참조에 `rotate` 로 백업한 뒤 기본 참조(`bot-token`)를 새 토큰으로 `rotate` 한다([봇 토큰 재발급](CLE-INT-SECRET-USAGE.md#봇-토큰-재발급)). 저장된 옛 토큰이 비었거나 공백만 있으면(규칙 27 이 생기기 전에 저장된 옛 행) 백업을 건너뛴다. `.v2` 참조에 새 값을 쓰는 교체는 현재 없다.
12. `deleteByPrefix` 의 prefix 는 `secret://` 로 시작해야 한다. LIKE 메타문자(`%`·`_`·`\`)가 들어 있으면 throw 한다. 구현은 `ref LIKE :prefix` 에 `` `${prefix}%` `` 를 바인딩하고 `ESCAPE` 절을 두지 않는다. `ESCAPE` 절이 없다는 것도 계약의 일부다.
13. `secret_store.workspace_id` 를 조건으로 지우는 경로는 두지 않는다. 워크스페이스 삭제도 트리거 단위 prefix 로 정리한다. 인터페이스에 워크스페이스 단위 삭제가 없고, 백엔드를 규약 변경 없이 바꿀 수 있어야 하기 때문이다. 트리거 설정 잠금 안에서 시크릿 저장소에 쓰는 경로는 이 전제의 예외다([다른 백엔드로 바꾸기](CLE-INT-SECRET-BACKEND.md#다른-백엔드로-바꾸기)). 워크스페이스 삭제가 정리할 트리거를 빠짐없이 모으는 방법은 [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) 가 정한다. 사람이 돌리는 일회성 운영 SQL 은 이 규칙의 대상이 아니다(R10).
14. 평문과 마스터키는 애플리케이션 메모리 안에만 존재한다. DB 쿼리, SQL 파라미터, 로그, 메트릭에 절대 내보내지 않는다. DB 는 항상 암호문만 본다. 저장소 예외 필드(규칙 3) 밖에서 알려진 예외가 하나 남아 있다. 이미 저장된 행에 남은 옛 평문 `notification.signing.secret` 이다. 이 평문을 새로 받는 경로는 2026-10-31 에 닫혔다. 요청 본문의 `config` 키 아래(원시 `config`)는 `notification` 키를 받지 않는다([트리거 관리 「PATCH 본문 계약」](../CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약)). 그 전에 저장된 평문은 시크릿 저장소로 옮겨지거나 지워질 때까지 트리거 `config` JSONB 에 남는다(지우는 경로는 시크릿 교체 승격과 참조가 있는 행에 `notification` 을 실은 PATCH 다). 옮기다 실패해도 남는다. 옮기는 시점은 [EIA 알림 웹훅 「시크릿 교체」](../CLE-IX/CLE-EIA-NOTIFY.md#시크릿-교체) 와 [EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md) 이 정한다. 외부 API 호출이 실패해 호출한 모듈이 만든 실패 문장에 평문이 실리면 그 모듈이 문장을 만든 자리에서 지운다(알려진 비밀 치환). 지금은 채널 프로바이더 API 클라이언트(Slack · Discord · Telegram)가 한다([채팅 채널 어댑터 규약 「규칙」](../CLE-CHAT/CLE-CHAT-ADAPTER.md#규칙) 10). 평문으로 외부 API 를 부르는 모듈이 늘면 이 목록에 더한다. «DB 는 항상 암호문만 본다» 는 시크릿 저장소(`secret_store`)가 다루는 비밀에 적용된다. 통합 암호화 키로 암호화하는 컬럼에 평문이 남을 수 있는 범위는 [통합 데이터와 흐름 「암호화」](CLE-INT-DATA.md#암호화) 가 정한다. (원본: SS-SE-01)
15. `store`·`rotate` 를 부를 때마다 12바이트 IV 를 새로 발급한다. IV 재사용은 금지한다. AES-GCM 에서 nonce 재사용은 치명적이다. (원본: SS-SE-02)
16. AAD 는 `ref` 다(`setAAD(Buffer.from(ref))`). 다른 참조의 암호문을 이 행에 덮어쓰는 행 간 교체 공격은 복호화 실패로 끝나야 한다. (원본: SS-SE-03)
17. 마스터키가 설정되지 않았거나 빈 값이면 부팅을 멈춘다(`SecretResolver` 모듈 초기화에서 throw). `NODE_ENV=production` 에서는 운영 환경 가드(`assertProductionConfig`)가 키를 한 번 더 검사해 쓸 수 없는 키면 기동을 거부한다. 거부 기준은 [세션과 토큰 「암호화 키 검사」](../CLE-ACCT/CLE-ACCT-SESSION.md#암호화-키-검사) 에 있다. 예시 값 목록은 그 절이 가리키는 `production-guards.ts` 상수가 정본이다. `SecretResolver` 는 64-hex 가 아닌 값을 거부하지 않고 SHA-256 으로 키를 만든다([마스터키](CLE-INT-SECRET-BACKEND.md#마스터키)). (원본: SS-SE-04)
18. 1차 범위에서는 DB 행 단위 감사 로그를 지원하지 않는다. `resolve` 가 실패하면 애플리케이션 로거가 참조와 `workspaceId` 만 남기고 평문은 남기지 않는다. 규칙 24 의 참조 불일치와 규칙 25 의 거부도 애플리케이션 로거에만 남기고 평문은 남기지 않는다. `resolve` · `store` · `rotate` 가 던지는 예외 메시지는 참조를 싣지 않고 참조는 애플리케이션 로거에만 남긴다. 예외 메시지가 채널 어댑터 실패 원문으로 화면에 보이는 필드(`chat_channel_last_error`)에 저장될 수 있어서다. 미존재 분기에는 행이 없어 `workspaceId` 는 남기지 못한다. 응답 비노출 자체는 규칙 4 가 정한다. (원본: SS-SE-05)
19. `resolve(ref)` 결과는 호출자가 쓴 뒤 GC 에 맡긴다. `Buffer.fill(0)` 같은 강제 삭제는 1차 범위에 적용하지 않고 후속 범위의 선택지로 둔다(권장). (원본: SS-SE-06)
20. 소비 모듈은 원칙상 구체 클래스(`SecretResolverService`)가 아닌 추상 인터페이스에 의존한다. 1차 범위에서는 NestJS DI 편의를 위해 구체 클래스를 직접 주입해도 된다. 구현체가 하나뿐이라 바꿀 일이 없고, abstract class 를 쓰면 injection token 설정이 더 필요하며, `deleteByPrefix` 를 포함한 메서드 시그니처가 아직 안정되지 않았기 때문이다. 백엔드가 둘 이상이 되면 `ISecretResolver` 를 추출하고 소비 모듈의 injection token 과 테스트 mock 을 인터페이스 기반으로 바꾼다. 현재 구현의 소비 모듈은 `triggers`·`chat-channel`·`external-interaction`·`schedules` 다.
21. `SecretResolver` 인터페이스를 바꾸는 변경은 모든 호출 모듈을 같은 변경에서 함께 고친다.
22. 새 비밀 종류(예: `oauth-client-secret`)를 더할 때는 [참조 예시](#참조-예시) 표에 새 `name` 행을 더하고, 호출 모듈의 스펙 본문에 참조 형식을 적는다. 리소스 설정에 참조를 두는 슬롯이면 규칙 23 의 거부 대상과 규칙 24 의 읽기 관문(채팅 채널은 `chat-channel-secret-refs.ts`, 알림 서명은 `notification-signing-secret-ref.ts`)에도 더한다. 트리거 원시 `config` 의 경로 목록은 2026-10-31 부터 규칙 23 의 `secret://` 값 검사가 받쳐 준다. 목록에 빠뜨린 슬롯이라도 원시 `config` 로 참조 값을 실으면 400 이다.
23. 리소스 설정에 두는 시크릿 참조(예: `Trigger.config` 의 `chatChannel.botTokenRef` · `chatChannel.inboundSigningRef` · `notification.signing.secretRef`)는 서버가 그 리소스 id 로 만들어 쓴다. 요청 본문으로 받지 않는다. 값이 자기 리소스의 참조여도 거부한다. 저장된 참조로 비밀을 쓰는 경로도 저장값 대신 리소스 id 로 참조를 다시 만든다(규칙 24). 트리거에서는 요청 본문의 `config` 키(원시 `config`)를 세 가지 검사로 거른다. 먼저 서버가 소유하는 필드의 경로 목록(시크릿 참조 슬롯 포함)에 든 경로가 있으면 거부한다. 다음으로 원시 `config` 바로 아래에 `notification` · `interaction` · `chatChannel` 키가 있으면 값과 상관없이 거부한다. 마지막으로 원시 `config` 아래 어디든 `secret://` 로 시작하는 문자열 값이 있으면 거부한다. 뒤의 두 검사가 경로 목록을 보완한다. 타입 키 아래의 슬롯은 목록에 없어도 타입 키 거부에 걸린다. 다른 키 아래에 심은 참조는 값 검사에 걸린다. 트리거의 거부 대상 · 순서 · 응답 모양의 정본은 [트리거 관리 「PATCH 본문 계약」](../CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약) 이다. 근거는 [R9 「리소스 설정의 시크릿 참조는 요청 본문으로 받지 않는다」](CLE-INT-SECRET-REFS.md#r9-리소스-설정의-시크릿-참조는-요청-본문으로-받지-않는다-2026-10-04) 와 [R16 「원시 `config` 의 타입 키와 `secret://` 값을 막는다」](CLE-INT-SECRET-REFS.md#r16-원시-config-의-타입-키와-secret-값을-막는다-2026-10-31) 에 있다.
24. 저장된 리소스 설정의 시크릿 참조로 비밀을 읽거나 쓰는 경로는 저장값의 있음 · 없음만 읽고 참조는 그 리소스 id 로 다시 만든다. 트리거에서는 봇 토큰 재발급, 메시지 발송, 인바운드 서명 검증, 트리거 삭제 때의 채널 프로바이더 해제, 알림 서명이다. 채팅 채널 참조는 비어 있지 않은 값이면 있다고 본다. 알림 서명 참조는 `secret://` 형식의 문자열이면 있다고 본다. 트리거 생성과 PATCH 가 알림 서명 시크릿을 정할 때도 이 판정을 쓴다. 있으면 참조를 다시 만들고 없으면 옛 평문을 옮기거나 첫 시크릿을 발급한다. 이 분기의 기준은 [EIA 알림 웹훅 「시크릿 교체」](../CLE-IX/CLE-EIA-NOTIFY.md#시크릿-교체) 다. 저장값과 다시 만든 참조를 정확히 비교하는 것은 에러 로그를 남기려는 것이고 쓰는 참조는 저장값과 상관없이 다시 만든 값이다. 로그에 저장값은 싣지 않는다. 읽기 관문은 없는 참조를 붙이지 않고 있는 참조를 지우지 않는다. 봇 토큰 재발급은 새 토큰을 쓰므로 `botTokenRef` 를 늘 싣고 `inboundSigningRef` 는 저장된 행에 있을 때만 싣는다. 자기 비밀이 없으면 `resolve` 가 실패해 닫힌다. 그때의 응답은 채팅 채널과 EIA 알림 웹훅 문서가 정한 실패 경로(발송 실패, 인바운드 401, 알림 웹훅 발송 건강도 `degraded`)다. 알림 서명은 참조가 있으면 옛 평문 `signing.secret` 으로 내려가지 않는다. 근거는 [R10 「저장된 참조는 읽는 쪽도 다시 만들고 rotate 는 다른 워크스페이스의 행을 덮어쓰지 않는다」](CLE-INT-SECRET-REFS.md#r10-저장된-참조는-읽는-쪽도-다시-만들고-rotate-는-다른-워크스페이스의-행을-덮어쓰지-않는다-2026-10-04) 에 있다.
25. `rotate` 는 기존 행의 `workspace_id` 가 인자와 다르면 거부하고 값과 `workspace_id` 를 바꾸지 않는다. 대조는 행의 값과 인자만 본다. 이 거부 전용 에러 코드는 만들지 않는다. HTTP 응답은 일반 `INTERNAL_ERROR` 500 이고 메시지는 5xx 가림 문구다. 예외 메시지는 참조와 워크스페이스 id 가 없는 고정 문구라 화면에 보이는 필드에 저장돼도 내부 위치가 드러나지 않는다. 참조와 두 워크스페이스 id 는 서버 로그에만 남긴다. 반복 배치는 거부된 리소스만 건너뛰고 나머지를 처리한다. 교차 행이 있으면 그 비밀의 진짜 소유자가 하는 재발급도 이 거부로 막힌다. 그때의 처리는 [교차 행 점검과 정리](CLE-INT-SECRET-REFS.md#교차-행-점검과-정리) 에 있다. 근거는 R10 에 있다.
26. 통합 암호화 키(`INTEGRATION_ENCRYPTION_KEY`)는 [통합 데이터와 흐름 「암호화」](CLE-INT-DATA.md#암호화) 표의 컬럼을 암호화하는 키다. 통합 자격 증명과 인증 설정 자격 증명이 그 표에 든다. 이 키는 마스터키(`ENCRYPTION_KEY`)와 별개다. 키를 만드는 방식과 적용 컬럼의 규범은 그 절에 있다. 운영 환경 가드(`assertProductionConfig`)가 이 키를 거부하는 기준은 [세션과 토큰 「암호화 키 검사」](../CLE-ACCT/CLE-ACCT-SESSION.md#암호화-키-검사) 에 있다. 근거는 [R13 「통합 암호화 키를 마스터키와 따로 둔다」](CLE-INT-SECRET-BACKEND.md#r13-통합-암호화-키-integration_encryption_key-를-마스터키와-따로-두고-production-에서-키-없이-기동하지-않는다-2026-10-10) 에 있다.
27. `store` · `rotate` 는 평문이 문자열이 아니거나 빈 문자열이거나 공백만 있으면 거부(throw)하고 행을 만들거나 바꾸지 않는다. 이 거부 전용 에러 코드는 만들지 않는다. HTTP 응답으로 새면 일반 `INTERNAL_ERROR` 500 이고 메시지는 5xx 가림 문구다. 예외 메시지는 참조와 워크스페이스 id 가 없는 고정 문구이고 참조는 서버 로그에만 남긴다. 규칙 18 · 25 와 같은 방식이다. 빈 값을 받게 하는 옵션(`allowEmpty`)은 두지 않는다. 근거는 [R18 「store · rotate 는 빈 평문을 거부한다」](CLE-INT-SECRET-BACKEND.md#r18-store--rotate-는-빈-평문을-거부한다-2026-11-06) 에 있다.

## 참조 예시

| 참조 | 용도 |
| --- | --- |
| `secret://triggers/{triggerId}/bot-token` | 채팅 채널 어댑터의 봇 토큰. 채널 프로바이더 공통(Telegram bot token, Slack `xoxb-*`, Discord bot token 등) |
| `secret://triggers/{triggerId}/bot-token.v2` | 봇 토큰 재발급 24시간 유예용 |
| `secret://triggers/{triggerId}/inbound-signing` | 채팅 채널 인바운드 웹훅 출처 검증 자료(채널 프로바이더 공통 슬롯). Telegram 은 서버가 발급한 공유 비밀(`setWebhook.secret_token`, 채널 어댑터가 randomBytes 로 발급), Slack 은 Slack 이 발급한 HMAC-SHA256 Signing Secret(사용자 입력), Discord 는 Discord 가 발급한 ed25519 application public key(사용자 입력)다. 검증 알고리즘 분기는 백엔드의 채널 프로바이더별 책임이고 슬롯은 하나다. 기준은 [채팅 채널 어댑터 규약](../CLE-CHAT/CLE-CHAT-ADAPTER.md) |
| `secret://triggers/{triggerId}/notification-signing` | EIA 알림 웹훅 HMAC 서명 시크릿. 첫 값은 서버가 발급한 `wsk_*` 다(트리거 생성 때, PATCH 가 EIA 알림 웹훅 설정을 처음 붙일 때). 이미 저장된 행에 옛 키 `signing.secret` 의 평문이 있으면 발급하지 않고 그 평문을 옮겨 넣는다. 기준은 [EIA 알림 웹훅 「시크릿 교체」](../CLE-IX/CLE-EIA-NOTIFY.md#시크릿-교체) |
| `secret://triggers/{triggerId}/notification-signing.v2` | 예약만 된 참조다. 현재 구현은 쓰지 않는다. 유예 기간의 새 알림 서명 시크릿은 `Trigger.notification_secret_v2` 컬럼에 평문으로 두고, 승격할 때 기준 참조(`notification-signing`)를 교체한다 |

## 저장소 예외 필드

→ [시크릿 저장소 — 저장소 예외 필드와 응답 노출](CLE-INT-SECRET-EXPOSE.md#저장소-예외-필드)

## 저장 백엔드

PostgreSQL 에 애플리케이션이 AES-256-GCM 으로 암호화한 값을 둔다. 인터페이스 · 형식 · 키는 [시크릿 저장소 — 인터페이스와 저장 백엔드](CLE-INT-SECRET-BACKEND.md) 가 정한다.

### 마스터키

→ [시크릿 저장소 — 인터페이스와 저장 백엔드](CLE-INT-SECRET-BACKEND.md#마스터키)

### 다른 백엔드로 바꾸기

→ [시크릿 저장소 — 인터페이스와 저장 백엔드](CLE-INT-SECRET-BACKEND.md#다른-백엔드로-바꾸기)

## 교차 행 점검과 정리

→ [시크릿 저장소 — 참조 소유와 교차 행](CLE-INT-SECRET-REFS.md#교차-행-점검과-정리)

## 미결 사항

- **통합 자격 증명과 이 저장소의 관계**: 이 규약은 도메인 모듈이 `SecretResolver` 를 거치고 예외는 [저장소 예외 필드](CLE-INT-SECRET-EXPOSE.md#저장소-예외-필드) 뿐이라고 정한다. 그런데 통합 자격 증명(`Integration.credentials`, Cafe24·OAuth·MCP 토큰 포함)은 컬럼 transformer 로 저장하고 예외 목록에도 없다([통합 데이터와 흐름](CLE-INT-DATA.md)). 원문 서두는 «향후 cafe24·OAuth 등» 도 `SecretResolver` 를 거친다고 적고, Rationale R2 는 OAuth client secret 과 Cafe24 토큰을 옮겨 올 가능성을 적는다. 방향은 이관 쪽이지만 시점과 범위를 정한 계획은 원문에 없다. 예외로 올린다면 `AuthConfig.config` 처럼 «다른 메커니즘으로 암호화된다» 를 근거로 삼게 된다. 그 메커니즘이 암호화를 보장하는 범위는 [통합 데이터와 흐름 「암호화」](CLE-INT-DATA.md#암호화) 가 정한다. 근거를 적는다면 이 범위도 함께 적어야 한다. 예외로 올리고 근거를 적을지, 저장소로 옮길 계획을 세울지 결정이 필요하다.
- **`deleteByPrefix` 의 멱등성**: [`SecretResolver` 인터페이스](CLE-INT-SECRET-BACKEND.md#secretresolver-인터페이스) 표는 이 메서드의 멱등성을 정하지 않았다. 현재 PostgreSQL 구현(`SecretResolverService.deleteByPrefix`)은 지울 행이 없으면 0 을 돌려주고 예외를 던지지 않는다. 이 동작을 다른 백엔드도 지켜야 하는 인터페이스 계약으로 정할지 결정이 필요하다.

## 구현 위치

- `codebase/backend/src/modules/secret-store/**`
- 규칙별 시행 · 테스트 위치는 하위 문서마다 「구현 위치」 에 있다.

## Rationale

### R2. 참조에 `<scope>` 를 둔다

`secret://<scope>/<resourceId>/<name>` 형식을 쓰면 다른 도메인 자원(예: Cafe24 access token)도 같은 저장소를 namespace 충돌 없이 함께 쓸 수 있다. OAuth client secret 이나 Cafe24 토큰을 옮겨 올 가능성과 namespace 명확성을 함께 고려했다.

### R4. FK 를 두지 않는다

→ [시크릿 저장소 — 인터페이스와 저장 백엔드](CLE-INT-SECRET-BACKEND.md#r4-fk-를-두지-않는다)

### R5. `.env.example` 에는 형식 예시만 두고 production 에서 막는다

→ [시크릿 저장소 — 인터페이스와 저장 백엔드](CLE-INT-SECRET-BACKEND.md#r5-envexample-에는-형식-예시만-두고-production-에서-막는다)

### R6. 마스터키를 LLM API 키와 함께 쓴다

→ [시크릿 저장소 — 인터페이스와 저장 백엔드](CLE-INT-SECRET-BACKEND.md#r6-마스터키를-llm-api-키와-함께-쓴다)

### R9. 리소스 설정의 시크릿 참조는 요청 본문으로 받지 않는다 (2026-10-04)

→ [시크릿 저장소 — 참조 소유와 교차 행](CLE-INT-SECRET-REFS.md#r9-리소스-설정의-시크릿-참조는-요청-본문으로-받지-않는다-2026-10-04)

### R10. 저장된 참조는 읽는 쪽도 다시 만들고 rotate 는 다른 워크스페이스의 행을 덮어쓰지 않는다 (2026-10-04)

→ [시크릿 저장소 — 참조 소유와 교차 행](CLE-INT-SECRET-REFS.md#r10-저장된-참조는-읽는-쪽도-다시-만들고-rotate-는-다른-워크스페이스의-행을-덮어쓰지-않는다-2026-10-04)

### R13. 통합 암호화 키 `INTEGRATION_ENCRYPTION_KEY` 를 마스터키와 따로 두고 production 에서 키 없이 기동하지 않는다 (2026-10-10)

→ [시크릿 저장소 — 인터페이스와 저장 백엔드](CLE-INT-SECRET-BACKEND.md#r13-통합-암호화-키-integration_encryption_key-를-마스터키와-따로-두고-production-에서-키-없이-기동하지-않는다-2026-10-10)
