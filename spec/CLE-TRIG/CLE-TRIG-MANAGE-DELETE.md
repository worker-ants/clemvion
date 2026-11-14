---
id: "CLE-TRIG-MANAGE-DELETE"
title: "트리거 관리 — 삭제"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-TRIG-MANAGE"
ancestors: ["CLE-VISION", "CLE-TRIG", "CLE-TRIG-MANAGE"]
area: "CLE-TRIG"
content_hash: "494a3b35c448ad9a04bc3b52e2babe8ea049ddb5f14555c9ca0b3ce4c7e8fd41"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "7e998433c624b950c23290334b74b770228937bacd55802967e97ade4d4d8fba"
etag: "sha256-1332f8f521152d865e3a75a2a74d088971bb240631e0589241a56f97398cdf43"
---
## 개요

이 문서는 [트리거 관리](CLE-TRIG-MANAGE.md) 의 하위 문서로 트리거를 지울 때의 권한 · 확인 대화상자 · 연쇄 영향 · 자원 정리 · 결과와 에러를 정한다. 삭제가 잡는 트리거 설정 잠금은 [트리거 관리 — 설정 쓰기와 비밀 발급](CLE-TRIG-MANAGE-WRITE.md#동시-쓰기-직렬화) 이 정한다.

## 권한

| 역할 | 트리거 삭제 |
|------|------------|
| 뷰어 | 불가. ⋮ 메뉴에 삭제 항목이 없다 |
| 편집자 | 가능(자기 워크스페이스 안) |
| 관리자 / 소유자 | 가능 |

API 는 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) 권한 매트릭스의 트리거 CRUD 권한으로 막는다. 삭제는 감사 로그에 `trigger.deleted` 로 남는다([감사 로그](../CLE-OBS/CLE-OBS-AUDIT.md)).

## 확인 대화상자

삭제를 누르면 모달이 뜬다. 본문 문구는 트리거 유형에 따라 다르다(i18n 키 `triggers.delete.confirm.*`).

| `Trigger.type` | 본문 문구 |
|---------------|-----------|
| `webhook` | "이 트리거를 삭제하면 `{{url}}` 로 들어오는 모든 호출이 즉시 404 가 돼요." |
| `schedule` | "이 트리거를 삭제하면 연결된 스케줄도 함께 삭제돼요 (Cron: `{{cron}}`). 다음 실행 예정: `{{nextRunAt}}`." |
| `manual` | "이 트리거에 연결된 워크플로우 (`{{workflowName}}`) 는 보존되며 트리거를 통한 외부 실행 진입점만 사라져요." |

스케줄 유형이면 본문 아래에 경고 상자를 하나 더 보인다. 문구는 "연결된 스케줄도 함께 삭제돼요" 다(i18n 키 `triggers.delete.cascadeWarning`).

오삭제를 막기 위해 사용자가 트리거 이름을 정확히 입력해야 "삭제" 버튼이 켜진다. 이 패턴은 트리거 화면이 처음 도입했다. 공통 UI 규약([레이아웃과 내비게이션](../CLE-UI/CLE-UI-LAYOUT.md))으로 올리는 일은 후속 과제다.

## 연쇄 영향

이 표는 트리거 삭제의 하류 영향과, 트리거를 지우게 만드는 상류 원인을 함께 담는다. 첫 행이 상류다.

| 연관 엔티티 | 동작 |
|------------|------|
| 상류: 워크플로우·워크스페이스 삭제 | 트리거도 FK CASCADE 로 함께 지워진다(`trigger.workflow_id`·`trigger.workspace_id` 모두 `ON DELETE CASCADE`). 스케줄 유형이면 아래 `schedule` 행까지 2차로 지워진다. DB 수준 삭제라 [동시 쓰기 직렬화](CLE-TRIG-MANAGE-WRITE.md#동시-쓰기-직렬화)의 트리거 단위 잠금을 거치지 않는다 |
| `schedule` | 스케줄 유형 트리거면 CASCADE 로 지워진다(`schedule.trigger_id` FK CASCADE) |
| `execution.trigger_id` | SET NULL. 실행 기록은 남는다. 트리거를 지워도 과거 실행 통계와 감사 추적이 끊기지 않게 하려는 것이다 |
| `auth_config_id` | 트리거 쪽 FK 만 끊긴다. 인증 설정 행은 지워지지 않는다(다른 트리거가 함께 쓸 수 있다) |
| EIA 알림 웹훅(`notification.*`) | 트리거에 딸린 것이라 다음 발송 시도부터 멈춘다. `notificationHealth` 는 행이 없어지므로 따로 정리할 필요가 없다([EIA 데이터와 흐름](../CLE-IX/CLE-EIA-DATA.md)) |
| 트리거 단위 인터랙션 토큰 | 트리거를 지우면 곧바로 무효가 된다. 그 토큰으로 연 SSE 스트림도 모든 서버 인스턴스에서 닫는다([EIA 데이터와 흐름 「트리거 단위 토큰」](../CLE-IX/CLE-EIA-DATA.md#트리거-단위-토큰)). 따로 재발급을 부를 필요가 없다 |

## 자원 정리

트리거 행을 없애는 모든 경로는 그 트리거의 자원을 정리한다(2026-09-17 결정). 경로는 트리거 화면 삭제, 스케줄 화면 삭제, 워크플로우 삭제, 워크스페이스 삭제다.

정리하는 자원은 셋이다. 외부 자원(스케줄 BullMQ 작업, 채널 프로바이더 등록, listener 레지스트리), `secret_store` 의 `secret://triggers/<id>/` 비밀, 트리거 단위 토큰(`itk_*`)으로 연 SSE 스트림이다. 자원별 정리 시점과 순서, 부모 삭제 때 대상 트리거를 고르는 방법, 정리가 닿지 않는 남은 창은 [트리거 데이터와 흐름 「트리거 삭제와 자원 해제」](CLE-TRIG-DATA.md#트리거-삭제와-자원-해제) 가 정한다.

외부 자원 해제가 실패했을 때의 정책은 다음과 같다.

- 채널 프로바이더 등록 해제는 best-effort 라 실패해도 삭제를 계속한다.
- listener 레지스트리 해제를 다른 서버 인스턴스에 알리는 변경 메시지(`chat-channel:listener`)는 best-effort 라 보내지 못해도 삭제를 계속한다. 근거는 [채팅 채널 「R-CC-30 트리거 단위 listener 레지스트리의 변경을 Redis pub/sub 로 모든 서버 인스턴스에 알린다」](../CLE-CHAT/CLE-CHAT-CORE.md#r-cc-30-트리거-단위-listener-레지스트리의-변경을-redis-pubsub-로-모든-서버-인스턴스에-알린다) 에 있다.
- 스케줄 작업 해제가 실패하면 삭제를 멈춘다.
- SSE 스트림 닫기는 best-effort 라 실패해도 삭제 결과는 그대로다. 닫는 범위는 모든 서버 인스턴스이고 닫는 방식은 [EIA 데이터와 흐름 「트리거 단위 토큰」](../CLE-IX/CLE-EIA-DATA.md#트리거-단위-토큰) 이 정한다.
- 여러 작업을 해제하는 워크플로우·워크스페이스 삭제는 전부 시도한 뒤, 이미 해제한 활성 작업을 다시 등록하고 멈춘다. 스케줄은 활성인데 발사하지 않는 상태를 남기지 않으려는 것이다.

## 결과와 에러

- 성공: `204 No Content`(본문 없음). 클라이언트는 목록·상세 query 를 무효화한다.
- 동시 삭제: 두 클라이언트가 같은 트리거를 동시에 지우면 두 번째는 `404 RESOURCE_NOT_FOUND` 다. 클라이언트는 무시해도 되고 사용자에게 토스트를 한 번 보인다.
- 스케줄 유형을 트리거 화면에서 지우는 경우: 연쇄 영향 표대로 스케줄도 함께 지워진다. 지우기 전에 `removeJob` 으로 BullMQ job scheduler 엔트리를 해제한다. 스케줄 화면에서 지워도 결과는 같다. 양방향 동기화 규칙은 [트리거 데이터와 흐름](CLE-TRIG-DATA.md) 이 정한다.
- 잠금 대기 상한 5초: 삭제는 [동시 쓰기 직렬화](CLE-TRIG-MANAGE-WRITE.md#동시-쓰기-직렬화)의 트리거 단위 잠금을 잡기 전에 되돌릴 수 없는 외부 자원 해제를 먼저 끝낸다. 트리거 화면 삭제는 스케줄 유형이면 BullMQ 작업 해제 다음에 채팅 채널 해제를 하고 스케줄 화면 삭제는 BullMQ 작업을 해제한다. 그래서 잠금을 5초 안에 못 잡으면 기다리지 않고 에러로 끝낸다. 이때 그 트리거가 "외부 등록은 해제됐는데 행은 남은" 상태라는 사실을 서버 로그에 남긴다. 비밀은 행 삭제가 커밋된 뒤에 지우므로 이때는 지워지지 않는다.
- 워크플로우·워크스페이스 삭제도 외부 해제를 먼저 끝내므로 그 트랜잭션의 모든 잠금 대기(부모 행, 멤버십, CASCADE 되는 트리거 행)에 같은 5초 상한을 건다. 넘기면 에러로 끝내고 "외부 해제는 이미 끝났다" 를 서버 로그에 남긴다.

## 구현 위치

- `codebase/backend/src/modules/triggers/trigger-resource-release.ts` (자원 정리의 순서·실패 정책. 네 삭제 경로와 쓰기 보상이 모두 지나는 순수 함수. 행 삭제 커밋 뒤의 비밀 삭제와 스트림 닫기는 `cleanUpDeletedTriggersAfterCommit` 하나로 모았다)
- `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts` (위 순수 함수의 배선. 스케줄 삭제는 모듈 순환 때문에 서비스를 거치지 않고 순수 함수를 직접 부른다)
- `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts` (네 삭제 경로의 비밀 삭제, 부모 삭제의 스케줄 작업 해제, 권한 없는 워크스페이스 삭제는 아무것도 정리하지 않음, 보상 합성)

## Rationale

### 삭제 확인 문구를 유형별로 나눈 이유

사용자는 트리거 삭제의 부수 효과를 유형마다 다르게 알아야 한다.

- 웹훅: 외부 호출자가 곧바로 404 를 받는다. 사용자에게 보이는 영향이다.
- 스케줄: 스케줄도 연쇄로 사라진다. 동기화 규칙이 정한 동작을 화면에 드러낸다.
- 수동: 워크플로우는 살아남고 트리거 진입점만 사라진다. 사용자를 안심시킨다.

세 경우를 한 문구로 묶으면 스케줄 연쇄 삭제 같은 중요한 사실이 묻힌다.

### 스케줄 삭제 문구의 보간 변수로 `{{cron}}` 을 쓴 이유

- Cron 표현식(`0 9 * * *` 등)을 보면 어떤 스케줄인지 바로 안다.
- 스케줄 id 는 내부 UUID 라 사용자에게 의미가 없다.
- 둘 다 같은 스케줄 행을 가리키지만 확인 문구의 목적은 "무엇을 지우는지" 알아보게 하는 것이라 사람이 읽기 쉬운 쪽을 고른다.
