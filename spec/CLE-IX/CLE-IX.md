---
id: "CLE-IX"
title: "외부 상호작용"
type: "area"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-VISION"
ancestors: ["CLE-VISION"]
area: null
content_hash: "54cd8b3d402537289f0a269a58574a9114c37612285d87f49a7de2dab787ae86"
read_as: "approved"
task: null
source_paths: []
mirror_sha256: "fb7e2c5baa8b4802b6b03caa19693b2463db77dbaa7cef612b74221a323fef2f"
etag: "sha256-51b5a042dc2b22f8f392bf09d527d207fd6e9ad3c104abff8413a3cef17da7eb"
---
> 구현 상태: 부분 구현 · 원문: 없음(자식 문서 요약) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 영역은 실행 중인 워크플로우가 제품 밖의 시스템·사용자와 주고받는 부분을 다룬다. 외부 시스템이 웹훅으로 워크플로우를 시작하면, 실행 도중 Form·버튼·AI 멀티턴처럼 사용자 입력이 필요한 노드에서 실행이 입력 대기로 멈춘다. 내부 WebSocket 채널은 워크스페이스 JWT 로만 인증하므로 외부 호출자는 그 사실을 알 수도, 응답할 수도 없다.

External Interaction API(EIA)가 이 간극을 메운다. 서버가 실행 이벤트를 외부 URL 로 보내는 EIA 알림 웹훅과, 외부 클라이언트가 REST 로 명령을 보내고 SSE 로 이벤트를 받는 인바운드 인터랙션 두 채널로 되어 있다. 두 채널은 트리거마다 선택해서 켠다.

EIA 위에는 두 소비자가 있다. [채팅 채널](../CLE-CHAT/CLE-CHAT.md) 은 Telegram·Slack·Discord 봇을 웹훅 트리거에 붙여 서버 안에서 EIA 를 부르는 어댑터이고, [웹채팅](../CLE-WEBCHAT/CLE-WEBCHAT.md) 은 고객 사이트에 넣는 임베드 위젯이 EIA HTTP·SSE 를 직접 부르는 기능이다.

여러 계층이 함께 쓰는 인터랙션 값의 목록과, 실행 동안 인터랙션과 AI 대화를 쌓는 대화 스레드도 이 영역에 있다.

## 문서

| 문서 | 내용 |
|---|---|
| [External Interaction API](CLE-EIA.md) | 두 채널 개요, 사용 시나리오, 채널 공통 요구사항, 트리거 등록·웹훅 응답 확장, 인터랙션 토큰, 레이트 리밋·CORS, 처리 흐름, 호환성 |
| [EIA 수신 API와 SSE](CLE-EIA-INBOUND.md) | 인터랙션 명령 REST, SSE 스트림과 재전송 버퍼, 상태 조회, 취소, 토큰 갱신, 멱등 키, WebSocket 명령·이벤트와의 대응 |
| [EIA 알림 웹훅](CLE-EIA-NOTIFY.md) | 알림 이벤트, 헤더와 HMAC 서명, 이벤트 봉투, 종결 이벤트 필드 집합, 재시도·폭주 감지·SSRF·시크릿 교체 |
| [EIA 데이터와 흐름](CLE-EIA-DATA.md) | 트리거 확장 컬럼·설정, 실행 토큰 테이블, 토큰 발급·인바운드·SSE·알림 발송 데이터 흐름, 저장소 매핑, 토큰 상태 전이 |
| [인터랙션 타입 레지스트리](CLE-IX-TYPES.md) | 대기 표면·항목 출처·표시물 종류·AI 노드 종료 사유의 단일 목록과 코드 분기 위치 매트릭스 |
| [대화 스레드](CLE-IX-THREAD.md) | 대화 기록 항목과 항목 출처, 자동 누적, 유지 범위, 영속화, AI 노드 주입 |
| [채팅 채널](../CLE-CHAT/CLE-CHAT.md) | Telegram·Slack·Discord 봇으로 워크플로우를 돌리는 서버 어댑터 |
| [웹채팅](../CLE-WEBCHAT/CLE-WEBCHAT.md) | 임베드형 웹채팅 위젯·SDK·운영 콘솔 |

관련 영역: 웹훅 진입과 트리거 관리는 [트리거](../CLE-TRIG/CLE-TRIG.md), 입력 대기와 재개는 [실행](../CLE-EXEC/CLE-EXEC.md), 내부 WebSocket 이벤트와 응답 자격 증명 가리기는 [API 공통 규약](../CLE-API/CLE-API.md) 이 다룬다.
