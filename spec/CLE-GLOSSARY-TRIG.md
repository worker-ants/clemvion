---
id: "CLE-GLOSSARY-TRIG"
title: "용어 사전 — 트리거"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-GLOSSARY"
ancestors: ["CLE-VISION", "CLE-GLOSSARY"]
area: null
content_hash: "be07975bc765b93459809c378e840f62743ec1e15fe826f246642c90ce894103"
read_as: "approved_fallback"
task: "CLE-T-SJAYNM"
source_paths: []
mirror_sha256: "f2d93d21f31fc2b0179b6940d7e301ed1ec291d2921c118d9fffb62d442c64ad"
etag: "sha256-b57a98449c88500e8caa381ac1216cdd75ba55b4d1aa3c3529a3695d682321ee"
---
## 개요

[용어 사전](CLE-GLOSSARY.md) 의 「트리거」 영역 용어다. 표기 원칙 · 약어 · 상태값 표기는 [용어 사전](CLE-GLOSSARY.md) 에 있고, 여러 영역에 걸친 같은 말은 [용어 사전 — 다의어 구분](CLE-GLOSSARY-POLY.md) 이 가른다.

표는 `표준 용어 · 영문과 코드 식별자 · 정의 · 쓰지 않는 표기 · 기준 문서` 순서다. "쓰지 않는 표기" 에 괄호로 붙은 조건은 그 뜻일 때만 쓰지 않는다는 뜻이다.

## 용어

| 표준 용어 | 영문 · 코드 식별자 | 정의 | 쓰지 않는 표기 | 기준 문서 |
| --- | --- | --- | --- | --- |
| 트리거 | Trigger, `trigger` | 워크플로우를 시작시키는 진입점. 웹훅·스케줄·수동 세 유형이 있다. 채팅 채널과 웹채팅은 웹훅 트리거의 변형이다. | Trigger(본문), 트리거(엔드포인트) | [트리거 관리](CLE-TRIG/CLE-TRIG-MANAGE.md) |
| 트리거 유형 | `Trigger.type` | `webhook`, `schedule`, `manual` 세 값. 만든 뒤 바꿀 수 없다. 화면 라벨은 웹훅·스케줄·수동이다. | 없음 | [트리거 관리](CLE-TRIG/CLE-TRIG-MANAGE.md) |
| 트리거 활성 상태 | `trigger.is_active` | 활성·비활성 두 값. 비활성 트리거는 호출을 받지 않는다. | 없음 | [트리거 관리](CLE-TRIG/CLE-TRIG-MANAGE.md) |
| 호출 이력 | trigger history, `GET /api/triggers/:id/history` | 트리거가 최근에 시작한 실행 목록. 인증 설정의 사용 내역과 다르다. | Recent Calls, 실행 이력(이 뜻으로) | [트리거 관리](CLE-TRIG/CLE-TRIG-MANAGE.md) |
| 웹훅 | Webhook | 외부 HTTP 요청으로 워크플로우를 시작하는 트리거. 밖으로 보내는 알림은 "EIA 알림 웹훅" 이라고 쓴다. | Webhook(본문) | [웹훅](CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| 웹훅 URL | webhook URL | 백엔드 주소 뒤에 `/api/hooks/` 와 엔드포인트 경로를 붙인 주소. | 전체 URL | [웹훅](CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| 엔드포인트 경로 | endpoint path, `endpointPath` | 웹훅 URL 끝의 경로 값. 클라이언트가 v4 UUID 로 만들고 전역에서 겹치지 않는다. | endpoint_path(본문), Webhook URL 경로 | [웹훅](CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| 엔드포인트 경로 예약 | `WebhookEndpointReservation` | 한 번 쓴 경로를 그 워크스페이스 소유로 영구히 남기는 기록. | 묘비, tombstone | [트리거 데이터와 흐름](CLE-TRIG/CLE-TRIG-DATA.md) |
| 공개 웹훅 | public webhook, `auth_config_id IS NULL` | 인증 없이 누구나 부를 수 있는 웹훅. 본문 크기와 IP 호출 수 제한이 더 걸린다. 웹채팅 트리거는 모두 공개 웹훅이다. | 공개 트리거, 공개 봇, 공개 챗봇 | [웹훅](CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| 웹훅 남용 방어 | abuse protection | 공개 웹훅에 거는 본문 크기·IP 호출 빈도 제한. | 없음 | [웹훅](CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| 인증 설정 | AuthConfig, `auth_config` | 외부 호출자가 웹훅을 부를 때 쓰는 워크스페이스 단위 인증 자격 증명. "인증" 메뉴에서 만든다. 로그인 인증이나 통합 자격 증명과 다르다. | Auth Config, Authentication(본문), 통합 자격증명 vault | [외부 호출 인증 설정](CLE-TRIG/CLE-TRIG-AUTHCFG.md) |
| 인증 설정 유형 | `AuthConfig.type` | `api_key`, `bearer_token`, `basic_auth`, `hmac` 네 값. 화면 라벨은 API 키·Bearer 토큰·Basic Auth·HMAC 이다. | 인증 방식(이 뜻으로) | [외부 호출 인증 설정](CLE-TRIG/CLE-TRIG-AUTHCFG.md) |
| IP 화이트리스트 | `ip_whitelist` | 인증 설정에 붙이는 허용 IP·CIDR 목록. | 없음 | [외부 호출 인증 설정](CLE-TRIG/CLE-TRIG-AUTHCFG.md) |
| 평문 보기 | Reveal, `POST /api/auth-configs/:id/reveal` | 관리자 이상이 비밀번호 재확인을 거쳐 인증 설정 비밀 값을 한 번 보는 기능. 화면은 30초 뒤 다시 가린다. | Reveal(본문), 평문 노출 | [외부 호출 인증 설정](CLE-TRIG/CLE-TRIG-AUTHCFG.md) |
| 키 재생성 | regenerate | 인증 설정의 비밀 값을 새로 발급하고 옛 값을 바로 무효로 만드는 동작. | 없음 | [외부 호출 인증 설정](CLE-TRIG/CLE-TRIG-AUTHCFG.md) |
| 사용 내역 | usage | 인증 설정을 쓴 최근 호출과 기간별 호출 수. | 호출 이력(이 뜻으로) | [외부 호출 인증 설정](CLE-TRIG/CLE-TRIG-AUTHCFG.md) |
| 필드 마스킹 | `***<last4>` | 인증 설정·모델 설정 응답에서 비밀 필드를 끝 네 글자만 보이게 가리는 방식. 응답 마스킹과 다르다. | 없음 | [외부 호출 인증 설정](CLE-TRIG/CLE-TRIG-AUTHCFG.md) |
| 스케줄 | Schedule, `schedule` | Cron 표현식으로 워크플로우를 주기 실행하는 설정. 스케줄 유형 트리거와 1:1 로 묶이고 이름은 트리거에 있다. | Cron Job, 스케줄 관리(개념 이름으로) | [스케줄](CLE-TRIG/CLE-TRIG-SCHEDULE.md) |
| Cron 표현식 | cron expression, `cron_expression` | 분·시·일·월·요일 다섯 필드로 주기를 적는 식. 표현식 언어와 다르다. | cronExpression(본문) | [스케줄](CLE-TRIG/CLE-TRIG-SCHEDULE.md) |
| 시각 편집 | visual editor | Cron 표현식을 빈도와 시각을 골라 만드는 편집 방식. 단순한 다섯 가지 패턴만 표현한다. | 시각적 편집기, Visual | [스케줄](CLE-TRIG/CLE-TRIG-SCHEDULE.md) |
| 시간대 | timezone | 스케줄이 쓰는 IANA 시간대. | 타임존 | [스케줄](CLE-TRIG/CLE-TRIG-SCHEDULE.md) |
| 다음 실행 | next run, `next_run_at` | 스케줄이 다음에 돌 예정 시각. 화면 표시용이고 실제 실행 시점은 BullMQ 스케줄러가 정한다. | 다음 실행 예정 시간, 다음 실행 시각 | [스케줄](CLE-TRIG/CLE-TRIG-SCHEDULE.md) |
| 지금 실행 | run now, `run-now` | 스케줄 주기와 상관없이 한 번 바로 실행하는 동작. 실행 출처는 수동 실행이 된다. | 즉시 실행 | [스케줄](CLE-TRIG/CLE-TRIG-SCHEDULE.md) |
| 파라미터 값 | `parameter_values` | 스케줄 실행이 수동 트리거 노드에 넘기는 JSON 값. 제한 표현식을 쓸 수 있다. | 없음 | [스케줄](CLE-TRIG/CLE-TRIG-SCHEDULE.md) |
| 트리거 외부 자원 정리 | teardown | 트리거를 지울 때 BullMQ 작업·채널 등록·시크릿을 함께 정리하는 절차. 자원 해제 순서는 [트리거 데이터와 흐름](CLE-TRIG/CLE-TRIG-DATA.md) 이 정한다. | 비밀 정리 | [트리거 관리](CLE-TRIG/CLE-TRIG-MANAGE.md) |
| 트리거 설정 잠금 | `trigger-config:<id>` | 트리거 `config` 를 다시 쓰는 경로가 한 번에 하나만 돌게 하는 DB 잠금. | 없음 | [트리거 관리](CLE-TRIG/CLE-TRIG-MANAGE.md) |

## Rationale

2026-10-02 까지 이 표는 [용어 사전](CLE-GLOSSARY.md) 한 문서의 「트리거」 절이었다. 그 문서가 약 195KB 가 되어 NERV 초안 저장 한 번에 담기지 않아 영역별 문서로 나눴다. 정의는 옮기기만 했다. 표준을 고른 기준과 검토한 다른 선택은 [용어 사전](CLE-GLOSSARY.md) 의 Rationale 에 있다.
