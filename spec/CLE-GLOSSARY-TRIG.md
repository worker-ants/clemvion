---
id: "CLE-GLOSSARY-TRIG"
title: "용어 사전 — 트리거"
type: "convention"
version: 5
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-GLOSSARY"
ancestors: ["CLE-VISION", "CLE-GLOSSARY"]
area: null
content_hash: "cbf4195477e52dd4d9f03ba109f04b695d921943e8a1cdbe7418fdca0018ec55"
read_as: "approved_fallback"
task: "CLE-T-EA7B5M"
source_paths: []
mirror_sha256: "5b5741b49952aeb80ece3d4c35240e3388a784b14859c1cb2cfb1450761fd386"
etag: "sha256-a21621c31c4faaf007deb1e4ad217e45ccf5f12428d6142d746155d20cac30a3"
---
## 개요

[용어 사전](CLE-GLOSSARY.md) 의 「트리거」 영역 용어다. 표기 원칙 · 약어 · 상태값 표기와 표의 열 순서는 [용어 사전](CLE-GLOSSARY.md) 에 있다. 여러 영역에 걸친 같은 말은 [용어 사전 — 다의어 구분](CLE-GLOSSARY-POLY.md) 이 가른다.

## 용어

| 표준 용어 | 영문 · 코드 식별자 | 정의 | 쓰지 않는 표기 | 기준 문서 |
| --- | --- | --- | --- | --- |
| 트리거 | Trigger, `trigger` | 워크플로우를 시작시키는 진입점. 유형은 「트리거 유형」 행에 있다. 채팅 채널과 웹채팅은 웹훅 트리거의 변형이다. | Trigger(본문), 트리거(엔드포인트) | [트리거 관리](CLE-TRIG/CLE-TRIG-MANAGE.md) |
| 트리거 유형 | `Trigger.type` | 트리거의 종류. 만든 뒤 바꿀 수 없다. 값과 화면 라벨은 [용어 사전](CLE-GLOSSARY.md) 의 「상태값과 enum 표기」 에 있다. | 없음 | [트리거 관리](CLE-TRIG/CLE-TRIG-MANAGE.md) |
| 트리거 활성 상태 | `trigger.is_active` | 활성·비활성 두 값. 비활성 트리거는 호출을 받지 않는다. | 없음 | [트리거 관리](CLE-TRIG/CLE-TRIG-MANAGE.md) |
| 호출 이력 | trigger history, `GET /api/triggers/:id/history` | 트리거가 최근에 시작한 실행 목록. 인증 설정의 사용 내역과 다르다. | Recent Calls, 실행 이력(이 뜻으로) | [트리거 관리](CLE-TRIG/CLE-TRIG-MANAGE.md) |
| 웹훅 | Webhook | 외부 HTTP 요청으로 워크플로우를 시작하는 트리거. 밖으로 보내는 알림은 "EIA 알림 웹훅" 이라고 쓴다. | Webhook(본문) | [웹훅](CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| 웹훅 URL | webhook URL | 백엔드 주소 뒤에 `/api/hooks/` 와 엔드포인트 경로를 붙인 주소. | 전체 URL | [웹훅](CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| 엔드포인트 경로 | endpoint path, `endpointPath` | 웹훅 URL 끝의 경로 값. 클라이언트가 v4 UUID 로 만들고 전역에서 겹치지 않는다. | endpoint_path(본문), Webhook URL 경로 | [웹훅](CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| 엔드포인트 경로 예약 | `WebhookEndpointReservation` | 한 번 쓴 경로를 그 워크스페이스 소유로 영구히 남기는 기록. | 묘비, tombstone | [트리거 데이터와 흐름](CLE-TRIG/CLE-TRIG-DATA.md) |
| 공개 웹훅 | public webhook, `auth_config_id IS NULL` | 인증 없이 누구나 부를 수 있는 웹훅. 본문 크기와 IP 요청 빈도 제한이 더 걸린다. 웹채팅 트리거는 모두 공개 웹훅이다. | 공개 트리거, 공개 봇, 공개 챗봇 | [웹훅](CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| 웹훅 남용 방어 | abuse protection | 공개 웹훅에 거는 본문 크기·IP 요청 빈도 제한. | 없음 | [웹훅](CLE-TRIG/CLE-TRIG-WEBHOOK.md) |
| 인증 설정 | AuthConfig, `auth_config` | 외부 호출자가 웹훅을 부를 때 쓰는 워크스페이스 단위 인증 자격 증명. "인증" 메뉴에서 만든다. 로그인 인증이나 통합 자격 증명과 다르다. | Auth Config, Authentication(본문), 통합 자격증명 vault | [외부 호출 인증 설정](CLE-TRIG/CLE-TRIG-AUTHCFG.md) |
| 인증 설정 유형 | `AuthConfig.type` | `api_key`, `bearer_token`, `basic_auth`, `hmac` 네 값. 화면 라벨은 API 키·Bearer 토큰·Basic Auth·HMAC 이다. | 인증 방식(이 뜻으로) | [외부 호출 인증 설정](CLE-TRIG/CLE-TRIG-AUTHCFG.md) |
| IP 화이트리스트 | `ip_whitelist` | 인증 설정에 붙이는 허용 IP·CIDR 목록. | 없음 | [외부 호출 인증 설정](CLE-TRIG/CLE-TRIG-AUTHCFG.md) |
| 평문 보기 | Reveal, `POST /api/auth-configs/:id/reveal` | 관리자 이상이 비밀번호 재확인을 거쳐 인증 설정 비밀 값을 한 번 보는 기능. 화면은 잠시 뒤 다시 가린다. | Reveal(본문), 평문 노출 | [외부 호출 인증 설정](CLE-TRIG/CLE-TRIG-AUTHCFG.md) |
| 키 재생성 | regenerate | 인증 설정의 비밀 값을 새로 발급하고 옛 값을 바로 무효로 만드는 동작. | 없음 | [외부 호출 인증 설정](CLE-TRIG/CLE-TRIG-AUTHCFG.md) |
| 사용 내역 | usage | 인증 설정을 쓴 최근 호출과 기간별 호출 수. | 호출 이력(이 뜻으로) | [외부 호출 인증 설정](CLE-TRIG/CLE-TRIG-AUTHCFG.md) |
| 필드 마스킹 | `***<last4>` | 인증 설정·모델 설정 응답에서 비밀 필드를 끝 네 글자만 보이게 가리는 방식. 응답 마스킹과 다르다. | 없음 | [외부 호출 인증 설정](CLE-TRIG/CLE-TRIG-AUTHCFG.md) |
| 스케줄 | Schedule, `schedule` | Cron 표현식으로 워크플로우를 주기 실행하는 설정. 스케줄 유형 트리거와 1:1 로 묶이고 이름은 트리거에 있다. | Cron Job, 스케줄 관리(개념 이름으로) | [스케줄](CLE-TRIG/CLE-TRIG-SCHEDULE.md) |
| Cron 표현식 | cron expression, `cron_expression` | 분·시·일·월·요일 다섯 필드로 주기를 적는 식. 표현식 언어와 다르다. 본문과 화면 라벨은 «Cron» 으로 쓰고 코드 식별자는 백틱으로 쓴다. 일반 명사로서의 주기 작업(«정리 cron» 등)은 이 표기 밖이다. | cronExpression(본문), cron 표현식(소문자), 크론 | [스케줄](CLE-TRIG/CLE-TRIG-SCHEDULE.md) |
| 발사 | fire | 트리거 · 스케줄이 실행을 시작시키는 일. 밖으로 내보내는 «발송» 과 다르다. 알림 쪽 뜻은 [용어 사전 — 다의어 구분](CLE-GLOSSARY-POLY.md) 이 가른다. | 발화(트리거 · 스케줄 뜻으로) | [스케줄](CLE-TRIG/CLE-TRIG-SCHEDULE.md) |
| Cron 자동 발사 | scheduled run | 스케줄이 Cron 표현식에 따라 스스로 실행을 시작하는 일. 사용자가 누르는 «지금 실행» 과 다르다. | cron 발화, 자동 발화, 정기 실행(이 뜻으로) | [스케줄](CLE-TRIG/CLE-TRIG-SCHEDULE.md) |
| 시각 편집 | visual editor | Cron 표현식을 빈도와 시각을 골라 만드는 편집 방식. 단순한 다섯 가지 패턴만 표현한다. | 시각적 편집기, Visual | [스케줄](CLE-TRIG/CLE-TRIG-SCHEDULE.md) |
| 시간대 | timezone | 스케줄이 쓰는 IANA 시간대. | 타임존 | [스케줄](CLE-TRIG/CLE-TRIG-SCHEDULE.md) |
| 다음 실행 | next run, `next_run_at` | 스케줄이 다음에 돌 예정 시각. 화면 표시용이고 실제 실행 시점은 BullMQ 스케줄러가 정한다. | 다음 실행 예정 시간, 다음 실행 시각 | [스케줄](CLE-TRIG/CLE-TRIG-SCHEDULE.md) |
| 지금 실행 | run now, `run-now` | 스케줄 주기와 상관없이 한 번 바로 실행하는 동작. 실행 출처는 수동 실행이 된다. | 즉시 실행 | [스케줄](CLE-TRIG/CLE-TRIG-SCHEDULE.md) |
| 파라미터 값 | `parameter_values` | 스케줄 실행이 수동 트리거 노드에 넘기는 JSON 값. 제한 표현식을 쓸 수 있다. | 없음 | [스케줄](CLE-TRIG/CLE-TRIG-SCHEDULE.md) |
| 트리거 외부 자원 정리 | teardown | 트리거를 지울 때 그 트리거에 딸린 자원을 정리하는 절차. 정리 순서와 시점은 [트리거 데이터와 흐름 「트리거 삭제와 자원 해제」](CLE-TRIG/CLE-TRIG-DATA.md#트리거-삭제와-자원-해제) 가 정한다. | 비밀 정리 | [트리거 관리](CLE-TRIG/CLE-TRIG-MANAGE.md#자원-정리) |
| 트리거 설정 잠금 | `trigger-config:<id>` | 트리거 설정과 알림 서명 시크릿의 쓰기를 트리거마다 한 번에 하나만 돌게 하는 DB 잠금. 잠금을 잡는 시점은 [트리거 데이터와 흐름 「config 서브 필드」](CLE-TRIG/CLE-TRIG-DATA.md#config-서브-필드) 가 정한다. | 없음 | [트리거 관리](CLE-TRIG/CLE-TRIG-MANAGE.md#동시-쓰기-직렬화) |
| 원시 `config` | request body `config`, `CreateTriggerDto.config` · `UpdateTriggerDto.config` | 트리거 생성(`POST /api/triggers`) · 수정(`PATCH /api/triggers/:id`) 요청 본문의 `config` 필드. 저장 위치 `Trigger.config` 와 다르고 노드의 원본 설정(`rawConfig`)과도 다르다. | 원본 설정(이 뜻으로), raw config(이 뜻으로) | [트리거 관리](CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약) |
| 타입 필드 | top-level `notification` · `interaction` · `chatChannel` | 트리거 생성 · 수정 요청 본문 최상위의 `notification` · `interaction` · `chatChannel` 필드. 본문 검증 형식이 따로 정해져 있어 «타입» 이라 부른다. 트리거 유형(`Trigger.type`)과는 관계없다. | 없음 | [트리거 관리](CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약) |
| 타입 키 | `notification` · `interaction` · `chatChannel` directly under request body `config`, `RAW_CONFIG_TYPED_KEYS` | 원시 `config` 바로 아래에 온 `notification` · `interaction` · `chatChannel` 키. 저장된 `Trigger.config` 의 같은 이름 키와 다르다. 트리거 유형(`Trigger.type`)과도 관계없다. | 없음 | [트리거 관리](CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약) |

## Rationale

2026-10-02 에 [용어 사전](CLE-GLOSSARY.md) 한 문서의 「트리거」 절에서 옮겼다. 나눈 이유와 표준을 고른 기준은 그 문서의 Rationale 에 있다.

### 정의 보정 (2026-10-03)

NERV Task `CLE-T-V22XN8` 가 정한 정의 보정을 반영했다.

- 개요의 안내 문단(영역 소개 · 열 순서)과 Rationale 의 분할 설명을 색인을 가리키는 한 줄로 줄였다. 같은 문단이 하위 문서 열 곳에 복사돼 있었다.
- 「공개 웹훅」 · 「웹훅 남용 방어」 의 「IP 호출 수 제한」 · 「IP 호출 빈도 제한」 을 표준 「요청 빈도 제한」 으로 맞췄다.
- 「평문 보기」: 다시 가리는 시간을 정의에서 뺐다(색인 표기 원칙 14).
- 「트리거 유형」: 값 목록을 지우고 색인 「상태값과 enum 표기」 를 가리킨다. 「트리거」 의 유형 열거도 그 행을 가리킨다.

### 「발사」 와 「Cron」 표기를 정했다 (2026-10-05)

트리거 · 스케줄이 실행을 시작시키는 일을 문서마다 «발사» 와 «발화» 로 섞어 썼고 «Cron» 과 «cron» 도 섞였다(NERV Task `CLE-T-K9S0TE`). 2026-10-05 미러에서 «발사» 는 14편에 101번, «발화» 는 16편에 54번 나왔다. «발화» 가운데 상당수는 AI 영역의 «사용자 발화»(사람이 보낸 말)와 경고 규칙 · 포트가 걸리는 뜻이었다. 트리거 문서(트리거 관리 · 스케줄 · 트리거 데이터와 흐름)가 주로 «발사» 를 쓰고 «발화» 는 그 두 뜻과 겹치므로 «발사» 를 표준으로 정했다. 쓰지 않는 표기는 «발화(트리거 · 스케줄 뜻으로)» 로 조건을 달았다. 다른 뜻의 «발화»(사용자 발화, 경고 규칙 · 포트 · 타임아웃이 걸림, 발화 주체)는 그대로 쓴다. 본문의 «Cron» 은 [스케줄](CLE-TRIG/CLE-TRIG-SCHEDULE.md) 이 쓰는 대문자 표기를 따른다. 이번 Task 가 고친 문서([실행 컨텍스트](CLE-EXEC/CLE-EXEC-CONTEXT.md) · [데이터 모델 개요](CLE-PLAT/CLE-PLAT-DATA.md))는 함께 맞췄다. 남은 문서(실행 이력 · 실행 데이터 · 재실행 · 실행 상태 · AI 노드 공통)는 NERV Task `CLE-T-AGBPHW` 가 맞춘다.

### 「트리거 설정 잠금」 과 「트리거 외부 자원 정리」 의 정의를 넓혔다 (2026-10-17)

NERV Task `CLE-T-6YY7KY` 의 두 항목을 반영했다. 두 정의가 기준 문서가 정한 범위보다 좁았다.

- 「트리거 설정 잠금」: 옛 정의는 `config` 를 다시 쓰는 경로만 꼽았다. [트리거 관리 「동시 쓰기 직렬화」](CLE-TRIG/CLE-TRIG-MANAGE.md#동시-쓰기-직렬화) 는 시크릿 교체가 `config` 를 쓰지 않더라도 `notification_secret_v2` 를 쓸 때 이 잠금을 잡게 한다. 승격도 같은 잠금 안에서 그 값을 비운다([EIA 알림 웹훅 「시크릿 교체」](CLE-IX/CLE-EIA-NOTIFY.md#시크릿-교체)). 정의만 읽고 `notification_secret_v2` 를 쓰는 경로를 잠금 밖에 두는 일이 없도록 정의의 대상에 알림 서명 시크릿의 쓰기를 넣었다.
- 「트리거 외부 자원 정리」: 옛 정의가 꼽은 자원에는 트리거 단위 토큰으로 연 SSE 스트림 닫기가 빠져 있었다. [트리거 데이터와 흐름 「트리거 삭제와 자원 해제」](CLE-TRIG/CLE-TRIG-DATA.md#트리거-삭제와-자원-해제) 가 행 삭제 커밋 뒤에 정리하는 자원으로 이미 꼽는다. 닫는 방식은 [EIA 데이터와 흐름](CLE-IX/CLE-EIA-DATA.md) 이 정한다. 그래서 정의를 «그 트리거에 딸린 자원» 으로 넓혔다.
- 닫는 범위는 모든 서버 인스턴스다. 기각한 대안은 Task 본문의 원안대로 정의에 «같은 서버 인스턴스» 로 한정해 적는 것이다. 같은 묶음의 NERV Task `CLE-T-Z35F7P` 가 닫기 신호를 Redis 로 서버 인스턴스 사이에 전한다. 그래서 그 한정은 이 정의가 승인될 때 이미 사실이 아니다.
- 두 정의는 한 문장으로 줄이고 경로 · 자원 목록 · 시점 · 닫는 범위는 링크로 돌렸다. 이 초안의 첫 저장은 이것들을 정의에 적었다. 2026-10-17 스펙 초안 일관성 검토가 [용어 사전](CLE-GLOSSARY.md) 개요의 한 줄 정의 원칙과 표기 원칙 14 에 어긋난다고 짚었다. 자원 목록과 잠금을 잡는 경로는 기준 문서 칸이 가리키는 절에 있다. 순서와 시점은 정의의 링크가 가리키는 [트리거 데이터와 흐름](CLE-TRIG/CLE-TRIG-DATA.md) 의 절에 있다.
- 기각한 대안: 목록과 시점을 정의 칸에 그대로 두는 안. 기준 문서가 경로를 더하거나 순서를 바꾸면 이 표가 뒤처진다.

### 「원시 `config`」 · 「타입 필드」 · 「타입 키」 를 더했다 (2026-10-31)

NERV Task `CLE-T-EA7B5M` 이 트리거 생성 · 수정 요청 본문의 원시 `config` 계약을 정했다. 결정의 근거는 [트리거 관리](CLE-TRIG/CLE-TRIG-MANAGE.md) Rationale 의 「원시 `config` 계약 (2026-10-31)」 에 있다. 그 초안의 검토에서 세 말이 이 사전에 없다는 지적이 나와 행을 더했다. 정의에는 이름과 뜻만 적었다. 거부 조건 · 병합 · 검사 순서는 기준 문서 칸이 가리키는 [트리거 관리 「PATCH 본문 계약」](CLE-TRIG/CLE-TRIG-MANAGE.md#patch-본문-계약) 과 REQ-TRIG-061 ~ 063 이 정한다.

- 이 초안의 첫 저장은 거부 조건과 병합 단위를 정의 칸에 적고 기준 문서 칸이 날짜가 붙은 Rationale 소절을 가리켰다. 2026-10-31 스펙 초안 일관성 검토(NERV 리뷰 라운드 3, head `0e3c31ad4`)가 2026-10-17 에 기각한 «정의 칸에 규칙을 그대로 두는 안» 과 같다고 짚었다. 이미 어긋난 곳도 있었다. 정의는 거부 사유를 둘만 적었는데 기준 문서는 내부 필드 · 타입 키 · `secret://` 값 세 검사를 정한다. 그래서 정의를 줄이고 기준 문서 칸을 본문 절 `#patch-본문-계약` 으로 바꿨다. 이 앵커는 승인본에도 있어 트리거 관리 초안보다 이 문서가 먼저 승인돼도 링크가 끊기지 않는다.
- 기각한 대안: 「원시 `config`」 의 영문 칸에 «raw config» 를 쓰는 안. [용어 사전 — 노드](CLE-GLOSSARY-NODE.md) 의 「원본 설정」 이 이미 그 영문 이름을 쓴다. 두 말은 뜻이 다르다. 노드의 원본 설정은 표현식을 평가하기 전의 노드 설정이다. 그래서 정의에 둘이 다르다고 적고 «원본 설정» · «raw config» 를 이 뜻으로는 쓰지 않는 표기에 넣었다. 코드 함수 이름(`mergeRawConfig` · `assertRawConfigAccepted`)은 코드 식별자라 이 규칙 밖이다.
- 표준 용어 「원시 `config`」 에는 필드 이름 `config` 가 들어 있다. 표기 원칙 3 은 API 필드를 본문 용어로 쓰지 않게 하지만 이 말은 예외로 두었다. 2026-10-31 미러에 이미 85번(7편) 나오고 모두 같은 뜻이다. 한국어로만 부르면 [용어 사전 — 다의어 구분](CLE-GLOSSARY-POLY.md) 「설정(config)」 의 다른 뜻과 다시 겹친다.
- 문서에서 `config.<키>` 만 쓰면 저장된 `Trigger.config` 의 키를 가리킨다([용어 사전 — 외부 상호작용과 채널](CLE-GLOSSARY-IX.md) 「채팅 채널」, [용어 사전 — 다의어 구분](CLE-GLOSSARY-POLY.md) 「알림」). 거부 응답의 `details.field` 값(예: `config.chatChannel`)은 요청 본문의 경로인데 저장 위치와 글자가 같다. 그래서 문서는 요청 본문 쪽을 «원시 `config`» 라고 불러 둘을 가른다. 첫 저장은 「타입 키」 영문 칸에 `config.chatChannel`(요청 본문) 처럼 괄호로만 갈랐다. 검토가 괄호를 빼고 읽으면 저장 위치로 읽힌다고 짚어서 영문 칸에는 위치를 말로 적었다.
- «타입 필드» · «타입 키» 의 «타입» 은 본문 검증 형식이 따로 정해진 필드라는 뜻이다(구현 `RAW_CONFIG_TYPED_KEYS`). 이 사전은 type 을 «유형» 으로 쓰므로 트리거 유형과 섞이지 않도록 정의에 관계없다고 적었다. 이름을 «전용 필드» · «전용 키» 처럼 바꾸는 안은 이번 초안 묶음에서 두 말이 41번(«타입 필드» 8 · «타입 키» 33, 이 문서 제외) 쓰여 함께 고쳐야 한다. 그래서 후속 NERV Task `CLE-T-YQMP4N` 로 넘겼다.
- 요청 본문 최상위 세 필드는 «타입 필드» 말고도 «top-level `X`» · «최상위 `X`» · «최상위 필드» 로 불린다. 2026-10-31 에 이번 초안 묶음(이 문서 제외)에서 «top-level» 22번, «최상위 …» 13번이 나왔고 미러 전체에는 «top-level» 34번 · «최상위 필드» 16번이 있다(다른 뜻 포함). 이번에는 표준만 정하고 쓰지 않는 표기 칸은 비웠다. 지금 둘을 금지하면 같은 묶음의 초안이 바로 표기 원칙 6 에 어긋난다. 사용처를 맞추는 일과 [용어 사전 — 다의어 구분](CLE-GLOSSARY-POLY.md) 「설정(config)」 에 요청 본문 `config` 행을 더하는 일은 `CLE-T-YQMP4N` 이 한다.
