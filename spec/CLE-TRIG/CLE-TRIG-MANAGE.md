---
id: "CLE-TRIG-MANAGE"
title: "트리거 관리"
type: "feature"
version: 11
status: "approved"
requirements: ["REQ-TRIG-001", "REQ-TRIG-002", "REQ-TRIG-003", "REQ-TRIG-004", "REQ-TRIG-005", "REQ-TRIG-006", "REQ-TRIG-007", "REQ-TRIG-008", "REQ-TRIG-009", "REQ-TRIG-010", "REQ-TRIG-011", "REQ-TRIG-012", "REQ-TRIG-013", "REQ-TRIG-014", "REQ-TRIG-015", "REQ-TRIG-016", "REQ-TRIG-017", "REQ-TRIG-018", "REQ-TRIG-019", "REQ-TRIG-020", "REQ-TRIG-021", "REQ-TRIG-022", "REQ-TRIG-023", "REQ-TRIG-024", "REQ-TRIG-025", "REQ-TRIG-026", "REQ-TRIG-027", "REQ-TRIG-028", "REQ-TRIG-029", "REQ-TRIG-030", "REQ-TRIG-031", "REQ-TRIG-032", "REQ-TRIG-033", "REQ-TRIG-034", "REQ-TRIG-035", "REQ-TRIG-036", "REQ-TRIG-037", "REQ-TRIG-038", "REQ-TRIG-039", "REQ-TRIG-040", "REQ-TRIG-041", "REQ-TRIG-042", "REQ-TRIG-043", "REQ-TRIG-044", "REQ-TRIG-045", "REQ-TRIG-046", "REQ-TRIG-047", "REQ-TRIG-048", "REQ-TRIG-049", "REQ-TRIG-050", "REQ-TRIG-051", "REQ-TRIG-052", "REQ-TRIG-053", "REQ-TRIG-054", "REQ-TRIG-055", "REQ-TRIG-056", "REQ-TRIG-057", "REQ-TRIG-058", "REQ-TRIG-059", "REQ-TRIG-061", "REQ-TRIG-062", "REQ-TRIG-063"]
basis_superseded: false
parent: "CLE-TRIG"
ancestors: ["CLE-VISION", "CLE-TRIG"]
area: "CLE-TRIG"
content_hash: "147a3b09d21a538e03af8f3e7459a64ca9e94d74120e3db7c6664b11938d2f07"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/2-navigation/2-trigger-list.md", "spec/2-navigation/_product-overview.md"]
mirror_sha256: "0efb82189f1b318d6f25bafa076087813530128cdf6e87355d27fcb47fe14a43"
etag: "sha256-1d62ac2586c31f2a524357cf9fc92841a1374d00e6a52414dfde3bc484599fe2"
---
> 구현 상태: 부분 구현 · 원문: `spec/2-navigation/2-trigger-list.md`, `spec/2-navigation/_product-overview.md` (§3.2 Trigger List) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

트리거(Trigger, `trigger`)는 워크플로우를 시작시키는 진입점이다. 트리거 유형(`Trigger.type`)은 웹훅(`webhook`)·스케줄(`schedule`)·수동(`manual`) 세 가지이고 만든 뒤에는 바꿀 수 없다. 채팅 채널과 웹채팅은 새 유형이 아니라 웹훅 트리거의 설정 변형이다.

이 문서는 트리거 화면(사이드바 "트리거", 경로 `/triggers`)의 목록·필터·상세 드로어·생성 흐름과 트리거 API(`/api/triggers`) 계약을 정한다. 트리거를 지울 때의 권한·확인 절차·연쇄 삭제·자원 정리 정책도 이 문서가 정한다.

트리거 `config` 를 다시 쓰는 모든 경로가 따르는 동시 쓰기 직렬화 규칙도 여기에 둔다. 이 규칙을 쓰는 곳이 채팅 채널·EIA·스케줄에 흩어져 있다. 그래서 트리거 PATCH·DELETE 계약을 정하는 이 문서가 기준이 된다.

범위 밖 주제는 다음 문서가 정한다.

- 웹훅 수신 엔드포인트·인증 검증·입력 구조·남용 방어: [웹훅](CLE-TRIG-WEBHOOK.md)
- 스케줄 화면·Cron 표현식·스케줄 API: [스케줄](CLE-TRIG-SCHEDULE.md)
- 인증 설정 발급·필드 마스킹·평문 보기: [외부 호출 인증 설정](CLE-TRIG-AUTHCFG.md)
- 엔티티 컬럼, 트리거와 스케줄의 동기화 표, 삭제 때 자원 해제 순서의 데이터 흐름: [트리거 데이터와 흐름](CLE-TRIG-DATA.md)
- 채팅 채널 설정(`config.chatChannel`) 필드의 정책: [채팅 채널](../CLE-CHAT/CLE-CHAT-CORE.md)
- EIA 알림 웹훅(`notification`)·인터랙션(`interaction`) 설정: [External Interaction API](../CLE-IX/CLE-EIA.md)
- 역할별 권한 매트릭스: [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md)

## 요구사항

- REQ-TRIG-001 WHEN 사용자가 트리거 화면을 열면 THE SYSTEM SHALL 워크스페이스의 트리거를 목록으로 표시한다. (원본: NAV-TR-01)
- REQ-TRIG-002 WHEN 목록 행을 그리면 THE SYSTEM SHALL 트리거 유형(웹훅·스케줄·수동)을 뱃지로 구분해 표시한다. (원본: NAV-TR-02)
- REQ-TRIG-003 WHEN 목록 행을 그리면 THE SYSTEM SHALL 연결된 워크플로우 이름을 표시하고 누르면 그 워크플로우 에디터로 이동한다. (원본: NAV-TR-03)
- REQ-TRIG-004 WHEN 사용자가 웹훅 트리거 행의 URL 복사 버튼을 누르면 THE SYSTEM SHALL 웹훅 URL 을 클립보드에 복사한다. (원본: NAV-TR-04, WH-MG-03)
- REQ-TRIG-005 WHEN 편집자 이상이 행의 더보기(⋮) 메뉴에서 활성/비활성 토글을 고르면 THE SYSTEM SHALL `PATCH /api/triggers/:id` 에 현재 값을 뒤집은 `{ isActive }` 를 보내 상태를 바꾼다. (원본: NAV-TR-05)
- REQ-TRIG-006 WHEN 사용자가 더보기(⋮) 메뉴에서 호출 이력을 고르면 THE SYSTEM SHALL 최근 호출만 담은 별도 대화상자를 열고 각 항목을 실행 상세 화면 링크로 표시한다. (원본: NAV-TR-06)
- REQ-TRIG-007 WHEN 스케줄 유형 트리거 행을 그리면 THE SYSTEM SHALL `[Schedule]` 태그와 Cron 표현식과 다음 실행(`nextRunAt`)을 표시한다. (원본: NAV-TR-07)
- REQ-TRIG-008 IF 트리거 화면이나 `POST /api/triggers` 로 스케줄 유형 트리거를 만들려 하면 THE SYSTEM SHALL 거부한다. (원본: NAV-TR-08)
- REQ-TRIG-009 WHEN 사용자가 더보기(⋮) 메뉴를 열면 THE SYSTEM SHALL 상세 보기·호출 이력 항목은 모든 역할에게 노출하고 활성/비활성 토글·삭제 항목은 편집자 이상에게만 노출한다. (원본: NAV-TR-09)
- REQ-TRIG-010 WHEN 스케줄 유형 트리거의 더보기(⋮) 메뉴를 열면 THE SYSTEM SHALL "스케줄 관리에서 편집" 항목을 더해 `/schedules?triggerId=…` 로 이동하게 한다.
- REQ-TRIG-011 WHEN 편집자 이상이 상세 드로어 카드의 편집 토글을 켜면 THE SYSTEM SHALL 이름·엔드포인트 경로·인증 설정 연결을 화면에서 수정하게 한다. (원본: NAV-TR-10)
- REQ-TRIG-012 WHILE 스케줄 유형 트리거의 상세 드로어를 보는 동안 THE SYSTEM SHALL Cron 표현식과 시간대를 읽기 전용으로 두고 "스케줄 관리에서 편집" 링크만 표시한다. (원본: NAV-TR-10)
- REQ-TRIG-013 WHEN 목록 행을 그리면 THE SYSTEM SHALL 연결된 인증 설정의 유형 뱃지(HMAC·Bearer·API Key·Basic Auth)를 표시한다. (원본: NAV-TR-11)
- REQ-TRIG-014 IF 웹훅 트리거에 인증 설정이 연결되지 않았으면 THE SYSTEM SHALL 경고 아이콘(⚠)과 "인증 없음" 을 표시하되 호출을 막지는 않는다. (원본: NAV-TR-11)
- REQ-TRIG-015 WHEN 스케줄·수동 트리거의 인증 칸을 그리면 THE SYSTEM SHALL 경고 없이 `-` 를 표시한다.
- REQ-TRIG-016 WHEN 사용자가 필터를 고르면 THE SYSTEM SHALL 유형(전체·웹훅·스케줄·수동)과 상태(전체·활성·비활성)로 목록을 좁힌다.
- REQ-TRIG-017 WHEN 트리거 화면이 `?triggerId=` 딥링크로 열리면 THE SYSTEM SHALL 그 트리거의 상세 드로어를 자동으로 열고 URL 파라미터는 마운트 때 한 번만 소비한다.
- REQ-TRIG-018 WHILE 상세 드로어가 열려 있는 동안 THE SYSTEM SHALL 호출 이력을 드로어에 싣지 않는다.
- REQ-TRIG-019 IF 사용자 역할이 편집자 미만이면 THE SYSTEM SHALL 상세 드로어의 편집 토글을 노출하지 않는다.
- REQ-TRIG-020 WHEN 인증 설정 셀렉터를 그리면 THE SYSTEM SHALL "+ 새 인증 설정 만들기" 항목을 관리자 이상에게만 노출한다.
- REQ-TRIG-021 WHEN 편집자 이상이 "웹훅 추가" 버튼을 누르면 THE SYSTEM SHALL 모달에서 이름·워크플로우·인증 설정·채팅 채널 입력을 받아 `POST /api/triggers` 로 웹훅 트리거를 만든다.
- REQ-TRIG-022 WHEN 클라이언트가 웹훅 트리거를 만들면 THE SYSTEM SHALL 엔드포인트 경로를 `crypto.randomUUID()` 로 만들어 보낸다.
- REQ-TRIG-023 WHEN 생성 모달이 Slack·Discord 채팅 채널의 `inboundSigningPlaintext` 를 보내기 전이면 THE SYSTEM SHALL `@workflow/chat-channel-validation` 패키지의 정규식으로 hex 형식을 검사한다.
- REQ-TRIG-024 WHEN `GET /api/triggers` 가 `interactionEnabled` 를 받으면 THE SYSTEM SHALL `config.interaction.enabled` 값이 일치하는 트리거만 반환한다.
- REQ-TRIG-025 WHEN `GET /api/triggers` 가 `sort`·`order` 를 받으면 THE SYSTEM SHALL 그 기준으로 정렬한다. (미구현)
- REQ-TRIG-026 WHEN `PATCH /api/triggers/:id` 가 `isActive` 를 받으면 THE SYSTEM SHALL 그 값으로 활성 상태를 바꾸고 별도 `/toggle` 경로는 두지 않는다.
- REQ-TRIG-027 IF `authConfigId` 가 호출자 워크스페이스의 인증 설정이 아니면 THE SYSTEM SHALL 400 `AUTH_CONFIG_NOT_FOUND`(`details.field='authConfigId'`)로 거부한다.
- REQ-TRIG-028 WHEN PATCH 본문에 `notification`·`interaction`·`chatChannel` 이 오면 THE SYSTEM SHALL 각 객체를 `config` 안의 같은 이름 키에 통째로 교체해 넣고 `interaction.triggerToken` 은 PATCH 결과의 `interaction.tokenStrategy` 가 `per_trigger` 일 때만 잠금 안에서 다시 읽은 행의 값을 이어받고 그 밖에는 지운다. `notification` 이 오면 알림 서명 시크릿 참조를 [EIA 알림 웹훅 「시크릿 교체」](../CLE-IX/CLE-EIA-NOTIFY.md#시크릿-교체) 대로 보존하거나 첫 시크릿을 발급한다.
- REQ-TRIG-029 IF PATCH 본문이 채팅 채널의 봇 토큰이나 inbound signing 값을 바꾸려 하면 THE SYSTEM SHALL 400 `VALIDATION_ERROR` 로 거부한다.
- REQ-TRIG-030 IF 채팅 채널이 없는 트리거에 PATCH 로 `chatChannel` 을 붙이려 하면 THE SYSTEM SHALL 400 `VALIDATION_ERROR`(`details.field='chatChannel'`)로 거부한다.
- REQ-TRIG-031 IF PATCH 가 채팅 채널 `provider` 를 바꾸려 하면 THE SYSTEM SHALL 400 `VALIDATION_ERROR`(`details.field='provider'`)로 거부한다.
- REQ-TRIG-032 IF 스케줄 유형 트리거 PATCH 에 `name`·`isActive` 밖의 키가 오면 THE SYSTEM SHALL 400 `VALIDATION_ERROR`(`details.field='type'`)로 거부한다.
- REQ-TRIG-033 IF 엔드포인트 경로가 다른 트리거와 겹치거나 다른 워크스페이스가 예약한 경로면 THE SYSTEM SHALL 두 경우를 구분하지 않고 409 `RESOURCE_CONFLICT`(`details.code=TRIGGER_ENDPOINT_PATH_CONFLICT`)로 거부한다.
- REQ-TRIG-034 WHEN 트리거를 응답하면 THE SYSTEM SHALL [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 규칙 4 가 정한 저장소 예외 필드와 시크릿 참조를 싣지 않고 봇 토큰은 `hasBotToken` 으로만 알린다. [시크릿 저장소](../CLE-INT/CLE-INT-SECRET.md) 규칙 4 의 목록에 오른 응답(알림 서명 시크릿이나 트리거 단위 토큰을 처음 발급한 생성 · PATCH 응답, `rotate-secret`, `revoke-token`)은 예외다.
- REQ-TRIG-035 WHEN 어떤 경로가 트리거 `config` 를 다시 쓰면 THE SYSTEM SHALL 트리거 단위 advisory lock 을 잡은 뒤 행을 다시 읽고 그 위에 병합한다.
- REQ-TRIG-036 WHILE 트리거 설정 잠금을 잡고 있는 동안 THE SYSTEM SHALL 채널 프로바이더 같은 외부 서비스를 호출하지 않는다.
- REQ-TRIG-037 IF 잠금 안에서 다시 읽은 트리거가 없거나 잠금 안의 쓰기가 0행에 매치되면 THE SYSTEM SHALL 쓰지 못한 것으로 처리하고 `rotate-bot-token`·`interaction/revoke-token`·`notification/rotate-secret` 은 404 `RESOURCE_NOT_FOUND` 로 응답하며 저장하지 못한 새 비밀을 응답에 싣지 않는다.
- REQ-TRIG-038 IF 비밀을 쓰거나 채널 프로바이더에 등록한 요청이 트리거 행을 쓰지 못하면 THE SYSTEM SHALL 채널 프로바이더 등록을 best-effort 로 해제한 뒤 그 트리거의 비밀(`secret://triggers/<id>/`)을 지운다.
- REQ-TRIG-039 WHEN PATCH 가 트리거를 저장하면 THE SYSTEM SHALL 그 요청이 바꾸는 필드만 저장한다.
- REQ-TRIG-040 WHEN 트리거 목록·상세·수정 응답을 보내면 THE SYSTEM SHALL `workflow` 참조(`id`, `name`)를 채운다.
- REQ-TRIG-041 WHEN `POST /api/triggers/:id/interaction/revoke-token` 이 호출되면 THE SYSTEM SHALL 기존 트리거 단위 토큰(`itk_*`)을 곧바로 무효로 하고 모든 서버 인스턴스에서 그 토큰으로 연 SSE 스트림을 닫으며 새 토큰을 평문으로 한 번 응답한다.
- REQ-TRIG-042 IF 뷰어가 트리거를 지우려 하면 THE SYSTEM SHALL 삭제 항목을 노출하지 않고 API 도 거부한다.
- REQ-TRIG-043 WHEN 사용자가 삭제를 고르면 THE SYSTEM SHALL 트리거 유형별 안내 문구가 담긴 확인 대화상자를 띄우고 트리거 이름을 정확히 입력해야 삭제 버튼을 활성화한다.
- REQ-TRIG-044 WHEN 트리거를 지우면 THE SYSTEM SHALL 연결된 스케줄을 함께 지우고 실행의 `trigger_id` 는 NULL 로 바꿔 실행 기록을 보존한다.
- REQ-TRIG-045 WHEN 트리거 행을 없애는 경로가 실행되면 THE SYSTEM SHALL 경로와 상관없이 그 트리거의 외부 자원과 비밀을 정리한다.
- REQ-TRIG-046 IF 스케줄 BullMQ 작업 해제가 실패하면 THE SYSTEM SHALL 삭제를 멈춘다.
- REQ-TRIG-047 IF 채널 프로바이더 등록 해제가 실패하면 THE SYSTEM SHALL 삭제를 계속한다.
- REQ-TRIG-048 IF 삭제가 트리거 설정 잠금을 5초 안에 잡지 못하면 THE SYSTEM SHALL 기다리지 않고 에러로 끝내며 외부 등록만 해제된 상태를 서버 로그에 남긴다.
- REQ-TRIG-049 WHEN 삭제가 성공하면 THE SYSTEM SHALL 본문 없이 `204 No Content` 로 응답한다.
- REQ-TRIG-050 IF 같은 트리거를 두 요청이 동시에 지우면 THE SYSTEM SHALL 두 번째 요청에 `404 RESOURCE_NOT_FOUND` 로 응답한다.
- REQ-TRIG-051 WHEN 트리거를 지우거나 활성 상태를 바꾸면 THE SYSTEM SHALL 감사 로그에 각각 `trigger.deleted`·`trigger.updated` 를 남긴다.
- REQ-TRIG-052 WHILE v1 인 동안 THE SYSTEM SHALL 트리거의 `type`·`workflowId`·`httpMethod`(POST)·`contentType`(`application/json`)을 바꾸지 못하게 한다.
- REQ-TRIG-053 IF 생성(`POST /api/triggers`)이나 수정(`PATCH /api/triggers/:id`) 본문의 `config` 키 아래에 `chatChannel` 의 차단 필드나 `notification.signing.secretRef` · `interaction.triggerToken` 이 있으면 THE SYSTEM SHALL 값과 상관없이 400 `VALIDATION_ERROR`(`details: { field: 'config.<경로>', code: 'INVALID_FIELD' }`)로 거부한다.
- REQ-TRIG-054 WHEN 시크릿 교체(`rotate-secret`)가 `notification_secret_v2` 를 쓰면 THE SYSTEM SHALL `config` 를 쓰지 않더라도 트리거 설정 잠금을 잡는다. (승격 조건: [EIA 알림 웹훅 「시크릿 교체」](../CLE-IX/CLE-EIA-NOTIFY.md#시크릿-교체))
- REQ-TRIG-055 WHEN 인터랙션이 켜져 있고(`interaction.enabled: true`) 전략이 `per_trigger` 인 트리거를 만들면 THE SYSTEM SHALL 트리거 단위 토큰(`itk_*`)을 발급해 `config.interaction.triggerToken` 에 저장하고 평문을 생성 응답의 `data.secrets.interactionToken` 에 한 번만 싣는다.
- REQ-TRIG-056 WHEN 최상위 필드 `interaction` 이 실린 PATCH 의 결과가 인터랙션이 켜져 있고 전략이 `per_trigger` 인데 잠금 안에서 다시 읽은 행에 트리거 단위 토큰이 없으면 THE SYSTEM SHALL 새 토큰을 발급해 저장하고 평문을 그 PATCH 응답의 `data.secrets.interactionToken` 에 한 번만 싣는다. 저장된 토큰이 있으면 인터랙션을 껐다 다시 켠 경우에도 새로 발급하지 않는다.
- REQ-TRIG-057 WHEN 생성이나 PATCH 가 알림 서명 시크릿이나 트리거 단위 토큰을 처음 발급하면 THE SYSTEM SHALL 그 요청의 감사 기록(`trigger.created` · `trigger.updated`)의 `details.issuedSecrets` 에 발급한 비밀의 종류 이름(`notificationSigningSecret` · `interactionToken`)을 싣고 평문은 싣지 않는다. 발급하지 않은 요청의 기록에는 이 키가 없다.
- REQ-TRIG-058 WHEN 트리거를 만들면 THE SYSTEM SHALL 행 INSERT · 시크릿 저장소 쓰기 · `config` 쓰기 · 첫 알림 서명 시크릿과 트리거 단위 토큰의 발급을 한 트랜잭션에서 하고 하나라도 실패하면 행을 남기지 않으며 감사 기록(`trigger.created`)은 커밋 직후 트랜잭션 밖에서 남긴다.
- REQ-TRIG-059 WHEN `interaction` 이 실린 PATCH 가 전략을 `per_trigger` 밖으로 바꿔 저장된 트리거 단위 토큰을 지우거나 인터랙션을 끄면 THE SYSTEM SHALL 커밋 뒤 그 토큰으로 연 SSE 스트림을 모든 서버 인스턴스에서 닫는다. 인터랙션만 끈 경우는 토큰 값을 남긴다. (출처: 2026-10-09, NERV Task `CLE-T-M6PERB` 구현 코드 리뷰 질문에 대한 사용자 답, finding `01a11f6b-cc1a-7129-a666-0fb29b2a4849`)
- REQ-TRIG-061 IF REQ-TRIG-053 에 걸리지 않는 요청에서 생성(`POST /api/triggers`)이나 수정(`PATCH /api/triggers/:id`) 본문의 원시 `config` 바로 아래에 `notification` · `interaction` · `chatChannel` 키가 있으면 THE SYSTEM SHALL 값과 상관없이 400 `VALIDATION_ERROR`(`details: { field: 'config.<키>', code: 'INVALID_FIELD' }`)로 거부한다. 세 키 가운데 둘 이상이 있으면 `notification`, `interaction`, `chatChannel` 순서로 따져 처음 걸린 키 하나만 보고한다.
- REQ-TRIG-062 IF REQ-TRIG-053 · 061 에 걸리지 않는 요청에서 생성이나 수정 본문의 원시 `config` 아래 어디에든 `secret://` 로 시작하는 문자열 값이 있으면 THE SYSTEM SHALL 400 `VALIDATION_ERROR`(`details: { field: 'config.<경로>', code: 'INVALID_FIELD' }`)로 거부한다.
- REQ-TRIG-063 WHEN PATCH 본문에 원시 `config` 가 있으면 THE SYSTEM SHALL 잠금 안에서 다시 읽은 행의 `config` 위에 `config` 바로 아래 키 단위로 병합한다. 보낸 키는 그 값으로 바꾸고 보내지 않은 키는 두고 값이 `null` 인 키는 지운다.

## 하위 문서

이 문서는 트리거 관리의 입구다. 요구사항은 모두 여기에 두고 주제별 본문은 아래 하위 문서가 맡는다.

- [트리거 관리 — 화면](CLE-TRIG-MANAGE-UI.md): 트리거 화면의 목록 · 필터 · 상세 드로어 · 필드 권한 매트릭스 · 생성 모달 · 웹훅 URL 표시. 요구사항 REQ-TRIG-001 · 002 · 003 · 004 · 005 · 006 · 007 · 009 · 010 · 011 · 012 · 013 · 014 · 015 · 016 · 017 · 018 · 019 · 020 · 021 · 022 · 023 · 052
- [트리거 관리 — API 와 PATCH 계약](CLE-TRIG-MANAGE-API.md): 트리거 API 목록, PATCH 본문 계약(타입 필드 · 원시 `config` · 서버가 만든 값), 응답 형태. 요구사항 REQ-TRIG-008 · 024 · 025 · 026 · 027 · 028 · 029 · 030 · 031 · 032 · 033 · 034 · 040 · 041 · 051 · 053 · 055 · 056 · 057 · 059 · 061 · 062 · 063
- [트리거 관리 — 설정 쓰기와 비밀 발급](CLE-TRIG-MANAGE-WRITE.md): 트리거 `config` 동시 쓰기 직렬화(advisory lock · 다시 읽기 · 병합 · 되돌리기), 생성 트랜잭션, 서버가 발급하는 알림 서명 시크릿과 트리거 단위 토큰의 결정 근거. 요구사항 REQ-TRIG-035 · 036 · 037 · 038 · 039 · 054 · 058
- [트리거 관리 — 삭제](CLE-TRIG-MANAGE-DELETE.md): 삭제 권한 · 확인 대화상자 · 연쇄 영향 · 자원 정리 · 결과와 에러. 요구사항 REQ-TRIG-042 · 043 · 044 · 045 · 046 · 047 · 048 · 049 · 050 · 051

## API

→ [트리거 관리 — API 와 PATCH 계약](CLE-TRIG-MANAGE-API.md#api)

### PATCH 본문 계약

→ [트리거 관리 — API 와 PATCH 계약](CLE-TRIG-MANAGE-API.md#patch-본문-계약)

### 동시 쓰기 직렬화

→ [트리거 관리 — 설정 쓰기와 비밀 발급](CLE-TRIG-MANAGE-WRITE.md#동시-쓰기-직렬화)

## 삭제 정책

### 자원 정리

→ [트리거 관리 — 삭제](CLE-TRIG-MANAGE-DELETE.md#자원-정리)

### 결과와 에러

→ [트리거 관리 — 삭제](CLE-TRIG-MANAGE-DELETE.md#결과와-에러)

## 미결 사항

- **트리거 이름의 길이 상한과 유일성**: 트리거 목록 원문은 이름을 1~120자로 제한하고 워크스페이스 안에서 유일해야 하며 충돌하면 409 라고 적는다. 데이터 모델에는 유일성 제약이 없다. 현재 구현은 요청 본문 검증 `MaxLength(255)`·DB `varchar(255)` 이고 이름 충돌 409 경로가 없다(409 는 엔드포인트 경로 충돌뿐이다). 스케줄 이름도 `trigger.name` 이라 유일성을 넣으면 스케줄에도 영향이 있다([스케줄](CLE-TRIG-SCHEDULE.md)). 구현에 맞춰 원문을 고칠지, 유일성을 새로 구현할지 결정해야 한다.

## Rationale

### 원시 `config` 계약 (2026-10-31)

→ [트리거 관리 — API 와 PATCH 계약](CLE-TRIG-MANAGE-API.md#원시-config-계약-2026-10-31)

- 이 결정이 REQ-TRIG-061 (타입 키 거부) · REQ-TRIG-062 (`secret://` 값 거부) · REQ-TRIG-063 (키 단위 병합)을 더했다.
- 이 결정으로 REQ-TRIG-060 을 지웠다. 그 요구사항은 원시 `config` 로 `interaction` 을 바꾼 PATCH 가 토큰을 없애거나 인터랙션을 끄면 스트림을 닫는다고 정했다. 원시 `config` 의 `interaction` 이 400 이 되어 그 경로가 없어졌다. 같은 동작은 top-level `interaction` 쪽 REQ-TRIG-059 가 맡는다. 번호는 다시 쓰지 않는다. 같은 이유로 REQ-TRIG-056 에서 원시 `config` 갈래를 지웠다.

### 채널 프로바이더 표기 (2026-11-12)

단독 영문 «provider» 는 용어 기준에 맞춰 «채널 프로바이더» 로 적는다. 요구사항의 뜻과 코드 식별자 `provider`, 화면 필드 목록, 절 제목은 바꾸지 않는다.
