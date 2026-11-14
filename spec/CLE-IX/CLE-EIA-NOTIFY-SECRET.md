---
id: "CLE-EIA-NOTIFY-SECRET"
title: "EIA 알림 웹훅 — 시크릿 교체"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-EIA-NOTIFY"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-EIA-NOTIFY"]
area: "CLE-IX"
content_hash: "32b0f5bd8f660b91f906167729b3f3be208f750b6699f71eccef1dec7f5525bc"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "86224851e46e58ac748e3eef510463c6d59b08f81a1a210397d24ea316479270"
etag: "sha256-ae14841f509c2963e77a30114b43b8ddb563199b76b3eeaad551e16843d81986"
---
## 개요

이 문서는 [EIA 알림 웹훅](CLE-EIA-NOTIFY.md) 의 하위 문서로 알림 서명 시크릿(notification signing secret, `wsk_*`)의 첫 발급, 옛 평문 옮기기, 교체와 승격, 발송 처리기의 주 시크릿 읽기를 정한다. 서명 계산과 헤더 형식은 [EIA 알림 웹훅 — 서명과 발송](CLE-EIA-NOTIFY-DELIVERY.md#헤더와-서명) 이 정한다.

## 시크릿 교체

`POST /api/triggers/:id/notification/rotate-secret` 은 알림 서명 시크릿을 새로 만든다.

- 새 시크릿 `wsk_<64hex>` 를 만들어 응답에 한 번만 평문으로 싣는다. 호출자는 이 값을 외부 검증 측에 배포한다.
- 24시간 유예 동안 옛 시크릿과 새 시크릿으로 모두 서명한다. 수신 측은 둘 다 시도한다.
- 평문을 한 번 돌려주는 특권 작업이라 누가 언제 했는지 남아야 한다. 감사 액션은 `trigger.notification_secret_rotated` 다([감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md)).
- 유예가 끝나면 매시 승격 작업이 새 시크릿을 시크릿 저장소 정식 참조로 승격한다. 저장 형태(`notification_secret_v2` 평문 컬럼)와 승격 흐름은 [EIA 데이터와 흐름](CLE-EIA-DATA.md), 저장 형태 예외의 기준은 [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 가 정한다.
- 유예 중에 `rotate-secret` 을 다시 부르면 앞서 만든 새 시크릿(`notification_secret_v2`)을 이번 값으로 덮어쓴다. 24시간 유예도 그 시각부터 다시 시작한다. 덮어쓴 값은 더는 서명에 쓰지 않는다. 수신 측은 주 시크릿과 마지막으로 받은 새 시크릿만 알면 된다.
- 교체와 승격은 같은 트리거 설정 잠금(`acquireTriggerConfigLock`)을 잡는다. 승격은 잠금 안에서 읽은 `notification_secret_v2` 가 처음 고른 값과 같을 때만 그 값을 정식 참조로 옮기고 비운다. 옮기기도 이 확인 뒤에 같은 잠금 안에서 한다. 먼저 옮기면 그사이 다시 교체해 덮인 옛 값이 주 시크릿이 된다. 값이 다르면 그 사이 다시 교체한 것이라 옮기지도 비우지도 않는다. 새 값은 다시 시작한 유예가 끝난 뒤에 승격한다. 잠금 자체의 규칙은 [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md#동시-쓰기-직렬화) 가 정한다. 승격 조건은 이 문서가 정하고 다른 문서는 여기를 가리킨다.
- 시크릿 저장소에 정식 참조의 행이 이미 있고 그 행의 워크스페이스가 트리거와 다르면 `rotate` 가 거부한다([시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 25). 승격은 그 트리거만 건너뛰고 에러 로그를 남긴다. `notification_secret_v2` 와 `notification_rotated_at` 은 그대로 둔다. 매시 승격 작업은 그 트리거를 다시 고르고 다시 건너뛴다. 정리하기 전까지 그 트리거는 주 시크릿과 새 시크릿 두 키로 서명한다. 처리 흐름은 [EIA 데이터와 흐름 「서명 시크릿 교체와 승격」](CLE-EIA-DATA.md#서명-시크릿-교체와-승격) 에 있다.
- 첫 시크릿은 서버가 발급한다. 발급하는 경우는 두 가지다. 하나는 EIA 알림 웹훅 설정(`config.notification`)이 있는 트리거를 만들 때다. 다른 하나는 PATCH 로 EIA 알림 웹훅 설정을 처음 붙일 때다. 트리거 설정 잠금 안에서 다시 읽은 행에 `signing.secretRef` 가 없으면 처음 붙이는 것으로 본다. 값이 있어도 [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md#규칙) 규칙 24 의 형식(`secret://` 문자열)이 아니면 없는 것으로 본다. 참조가 없어도 그 행에 옛 평문 `signing.secret` 이 있으면 처음 붙이는 것이 아니다. 서버는 발급하지 않고 그 평문을 시크릿 저장소로 옮긴다. 통째 교체로 옛 평문이 사라지면 수신 측이 쓰던 시크릿이 유예 없이 바뀌기 때문이다. 옛 평문이 있다는 것은 `signing.secret` 이 공백 말고 다른 문자가 있는 문자열이라는 뜻이다. 빈 문자열이거나 공백만 있으면 없는 것으로 보고 첫 시크릿을 발급한다. 시크릿 저장소가 그런 값을 거부하기 때문이다([시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 27). 값은 다듬지 않고 그대로 쓴다. 발송 처리기도 같은 기준으로 주 시크릿이 있는지 읽는다. 이 판정과 시크릿 저장소 쓰기(발급이나 옮기기)는 같은 잠금 안에서 한다. 서버는 `wsk_<64hex>` 를 만들어 시크릿 저장소에 넣는다. 참조는 트리거 id 로 정해진다(`secret://triggers/<triggerId>/notification-signing`). `config` 에는 시크릿 대신 참조(`signing.secretRef`)만 남는다.
- 트리거를 만들 때는 트리거 INSERT 와 위 판정 · 시크릿 저장소 쓰기를 한 트랜잭션에서 한다. 그래서 어느 단계가 실패해도 트리거 행과 시크릿이 남지 않는다. 트랜잭션 범위는 [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md#동시-쓰기-직렬화) 가 정한다.
- 발급한 평문은 그 요청의 응답에만 한 번 싣는다. 응답 안의 위치와 발급하지 않은 응답의 키 생략은 [트리거 관리 「API」](../CLE-TRIG/CLE-TRIG-MANAGE.md#api) 가 정한다. 발급한 요청은 감사 기록(`trigger.created` · `trigger.updated`)의 `details.issuedSecrets` 에 `"notificationSigningSecret"` 을 남긴다. 평문은 싣지 않는다([감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md)).
- 생성이나 PATCH 의 응답을 받지 못해 첫 시크릿의 평문을 모르면 `rotate-secret` 으로 새 시크릿을 받는다. 발급한 평문은 다시 볼 수 없기 때문이다. 새 시크릿은 유예 동안 두 번째 `v1=` 의 서명에도 쓰인다. 그래서 수신 측은 받은 즉시 그 값으로 검증할 수 있다.
- 원시 `config` 로는 `notification` 을 보낼 수 없다([트리거 관리 「PATCH 본문 계약」](../CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약)). 이미 저장된 행에 옛 평문 `signing.secret` 이 있으면 그 값을 옮기고 발급하지 않는다. 그 평문을 시크릿 저장소로 옮기는 처리는 [EIA 데이터와 흐름](CLE-EIA-DATA.md) 이 정한다.
- 참조가 이미 있으면 PATCH 로 EIA 알림 웹훅 설정을 바꿔도 서버는 새로 발급하지 않는다. `signing.secretRef` 는 PATCH 뒤에도 남는다. 서버는 행의 값을 복사하지 않고 트리거 id 로 참조를 다시 만들어 싣는다([트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약)).
- 발송 처리기도 주 시크릿을 저장된 `signing.secretRef` 값으로 읽지 않고 트리거 id 로 다시 만든 참조로 읽는다. 참조가 있으면 시크릿 저장소에서 읽지 못해도 옛 평문 `signing.secret` 으로 내려가지 않는다. 이때는 서명 없이 보내지 않고 발송 건강도를 `degraded` 로 바꾼다. 옛 평문은 참조가 없을 때만 주 시크릿으로 쓴다. 참조를 다시 만드는 규칙은 [시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 24 가 정한다.

## 구현 위치

- `codebase/backend/src/modules/triggers/triggers.service.ts` (`create` · `update` 가 첫 시크릿 판정을 부름, 교체 요청 `rotateNotificationSecret`, 승격 진입 `promoteRotatedNotificationSecrets`)
- `codebase/backend/src/modules/triggers/notification-signing-secret.service.ts` (`NotificationSigningSecretService`. 알림 서명 시크릿(`wsk_*`)을 발급하거나 옮겨 시크릿 저장소에 쓰는 서비스다. 첫 시크릿 발급이나 옛 평문 옮기기 `settle`, 저장된 옛 평문 정규화 `migrateLegacyPlaintext`, 교체 쓰기 `writeRotation`, 승격 `promoteRotated`)
- `codebase/backend/src/modules/triggers/notification-signing-secret.ts` (첫 시크릿 발급 판정 `decideNotificationSigning`, 발송 처리기와 함께 쓰는 «있음» 판정 `readStoredSigningSecret`, 그 판정과 `migrateLegacyPlaintext` 가 함께 쓰는 옛 평문 판정 `isUsableLegacyPlaintext`)
- `codebase/backend/src/modules/triggers/notification-signing-secret-ref.ts` (트리거 id 로 알림 서명 시크릿 참조를 만든다)
- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (`acquireTriggerConfigLock`, 교체와 승격이 함께 잡는 잠금)
- `codebase/backend/src/modules/triggers/notification-secret-rotator.service.ts` (`NotificationSecretRotatorService`. 유예가 끝난 시크릿의 승격을 매시 시작하는 스케줄러다. 승격 쓰기는 `NotificationSigningSecretService.promoteRotated` 가 한다)

## Rationale

### 첫 시크릿 발급 · 유예 중 재교체 (2026-10-09)

승인된 스펙의 일관성 재검토에서 이 문서가 정하지 않은 동작이 드러났다. 아래는 사용자 결정(2026-10-09, NERV Task `CLE-T-M6PERB`)이다. 같은 결정에서 정한 `retry.maxAttempts` 는 [서명과 발송](CLE-EIA-NOTIFY-DELIVERY.md#retrymaxattempts-를-발송-큐에-넘긴다-2026-10-09) 에 있다.

- **첫 시크릿은 서버가 발급한다.** 이전 판은 이 문제를 [External Interaction API](CLE-EIA.md#미결-사항) 의 미결 사항으로 미뤘다. [External Interaction API](CLE-EIA.md#트리거-등록과-웹훅-응답) 의 요구사항은 트리거를 만들면 `wsk_*` 를 생성 응답에서 한 번 평문으로 보여 준다고 적는다. 결정할 때 코드는 시크릿을 발급하지 않았다. 그래서 호출자가 시크릿을 보내지 않은 트리거는 발송할 때마다 발송 건강도가 `degraded` 가 됐고, `rotate-secret` 으로 받은 새 시크릿도 승격되는 24시간 뒤에야 서명에 쓰였다. 생성 뒤 PATCH 로 EIA 알림 웹훅 설정을 처음 붙인 트리거도 같았다.
  - 사용자는 그 요구사항대로 생성 때 서버가 발급하는 쪽을 골랐다. 함께 제시한 다른 안은 그 요구사항을 지금 동작에 맞춰 고치는 것이었다.
  - 이어서 PATCH 로 처음 붙일 때도 발급하는 쪽을 골랐다. 함께 제시한 다른 안은 «생성 때만» 과 «발급하지 않음(지금 동작을 스펙으로)» 이었다.
  - 저장된 행에 남은 옛 평문은 PATCH 가 발급하지 않고 시크릿 저장소로 옮긴다. 통째 교체로 그 평문이 사라지면 수신 측이 쓰던 시크릿이 유예 없이 바뀌기 때문이다.
  - PATCH 가 처음 붙이는지는 잠금 안에서 다시 읽은 행의 `signing.secretRef` 와 옛 평문으로 판정한다. 기준은 [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md#규칙) 규칙 24 와 같다. 형식이 틀린 옛 값을 있다고 읽으면 첫 시크릿을 발급하지 않아 발송 건강도가 계속 `degraded` 가 된다. 이 판정 기준, 옛 평문 옮기기, 잠금 안 발급은 사용자에게 묻지 않고 기본값으로 정해 알렸다.
  - 그때는 호출자가 원시 `config` 로 보낸 평문 `signing.secret` 을 그대로 썼다. 2026-10-31 에 NERV Task `CLE-T-EA7B5M` 이 이 경로를 막아 원시 `config` 는 `notification` 키를 받지 않는다([트리거 관리 「PATCH 본문 계약」](../CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약)). 그에 맞춰 [시크릿 교체](#시크릿-교체) 와 요구사항을 고쳤다. 이미 저장된 옛 평문은 지금처럼 읽고 시크릿 저장소로 옮긴다. 결정과 근거는 트리거 관리 Rationale 「원시 `config` 계약 (2026-10-31)」 에 있다.
- **발급한 평문은 `data.secrets.notificationSigningSecret` 에 싣는다.** 성공 응답은 [HTTP API 규약](../CLE-API/CLE-API-CONV.md) 의 응답 봉투(`{ data }`)를 따른다. 결정할 때 [External Interaction API](CLE-EIA.md#트리거-등록-페이로드-확장) 의 생성 응답 예시는 응답 봉투 없이 최상위 `secrets` 블록을 두고 키 이름도 `notification.secret` 으로 달랐다. 그 예시도 이 기준에 맞췄다(NERV Task `CLE-T-EMB0YG`). 발급하지 않은 응답에는 `secrets` 키를 싣지 않는다. 발급한 응답에서만 생기는 일회성 값이기 때문이다. 위치와 키 생략의 기준은 그 응답을 내는 [트리거 관리 「API」](../CLE-TRIG/CLE-TRIG-MANAGE.md#api) 한 곳에 두고 이 문서와 요구사항은 그곳을 가리킨다. 같은 위치를 두 문서에 적으면 한쪽만 고쳐 낡기 쉽다.
- **유예 중 재교체는 덮어쓴다.** 결정할 때 교체는 잠금 없이 `notification_secret_v2` 와 `notification_rotated_at` 만 바꿨다. 사용자는 앞의 새 시크릿을 덮어쓰고 24시간 유예를 다시 시작하는 쪽을 골랐다. 함께 제시한 다른 안은 유예 중 재교체를 409 로 거부하는 것이었다. 새 시크릿을 담는 컬럼은 하나라서 덮어써도 수신 측이 함께 시도하는 시크릿은 주 시크릿과 마지막 새 시크릿 둘이다.
  - 결정할 때 승격은 잠금 밖에서 대상을 골랐고, 잠금 안에서 `notification_secret_v2` 가 그대로인지 보지 않고 비웠다. 그 사이 교체가 끼면 호출자가 방금 받은 새 시크릿이 승격되지 않고 지워질 수 있었다. 그래서 교체와 승격이 같은 트리거 설정 잠금을 잡고, 승격은 잠금 안에서 읽은 값이 처음 고른 값과 같을 때만 비운다.
  - 승격 조건은 이 문서의 [시크릿 교체](#시크릿-교체) 한 곳에 둔다. [트리거 관리](../CLE-TRIG/CLE-TRIG-MANAGE.md) 는 교체도 같은 잠금을 잡는다는 것만 적고 이 조건을 가리킨다.

### 공백만 있는 옛 평문도 없는 것으로 본다 (2026-11-06)

NERV Task `CLE-T-94Z6A5` 에서 시크릿 저장소의 `store` · `rotate` 가 빈 평문과 공백만 있는 평문을 거부하게 됐다([시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 27). 그때 [시크릿 교체](#시크릿-교체) 의 옛 평문 판정은 «비어 있지 않은 문자열» 이었다. 그래서 옛 평문 `signing.secret` 이 공백만 있는 행에서는 두 경로가 그 값을 `rotate` 에 넘겼다.

- `notification` 이 실린 PATCH(`NotificationSigningSecretService.settle`)는 그 값을 옮기기로 판정한다. `rotate` 가 거부하면 트랜잭션이 롤백되고 응답은 500 이다. 그 트리거는 EIA 알림 웹훅 설정을 바꿀 수 없다.
- PATCH 저장 뒤 정규화(`migrateLegacyPlaintext`)도 그 값을 옮기려 한다. 저장은 이미 커밋됐으므로 응답만 500 이 된다.

2026-10-31 전에는 원시 `config` 를 `@IsObject` 로만 검사했다. 그래서 이런 행이 남아 있을 수 있다. 실제로 있는지는 DB 를 보지 못해 모른다.

사용자 결정(2026-11-06, NERV 질문 `01a1b089-f3a6-75e4-a4c5-50db1b0b6e87`)으로 공백만 있는 옛 평문도 없는 것으로 본다. `readStoredSigningSecret` 과 `migrateLegacyPlaintext` 는 같은 판정 함수 `isUsableLegacyPlaintext` 를 쓴다. 문자열이고 공백 말고 다른 문자가 있어야 옛 평문이다.

- 그런 행은 다음 `notification` PATCH 에서 새 `wsk_*` 를 발급받는다.
- 그 전까지 발송 처리기는 주 시크릿이 없는 것으로 보고 서명 없이 보내지 않는다. 발송 건강도는 `degraded` 가 된다. 빈 문자열과 같은 처리다.
- 저장 뒤 정규화는 그 값을 옮기지 않고 건너뛴다.
- 값은 다듬지 않는다. 앞뒤에 공백이 있어도 다른 문자가 있으면 그대로 옛 평문이다.

이 처리는 «옛 평문이 있으면 발급하지 않고 옮긴다» 원칙의 예외다. 그런 행의 수신 측 시크릿은 유예 없이 바뀌고, 다음 `notification` PATCH 로 새 `wsk_*` 를 받기 전까지는 알림 웹훅이 나가지 않는다. 그래도 «없음» 으로 본 이유는 셋이다. 공백만 있는 키는 짐작하기 쉬워 서명이 출처를 증명하지 못하므로 보존할 시크릿이 아니다. 빈 문자열은 이미 «없음» 이었고 같은 기준으로 맞췄다. 시크릿 저장소가 그 값을 받지 않으므로 옮길 수도 없다. 유예 원칙은 공백 말고 다른 문자가 있는 옛 평문에만 적용된다.

기각한 대안:

- **지금 동작을 두고 결함으로 적는다**: [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 의 Rationale 「store · rotate 는 빈 평문을 거부한다」 호출부 표에 결함으로 적고 후속 Task 로 넘기는 안이다. 그동안 그런 행은 EIA 알림 웹훅 설정 PATCH 가 계속 500 이 된다.
- **`rotate` 가드를 좁힌다**: 빈 문자열만 거부하고 공백만 있는 값은 받는 안이다. 이미 승인된 `CLE-T-94Z6A5` 계획과 다르다. 그 계획은 공백만 있는 평문도 거부한다.
