---
id: "CLE-API"
title: "API 공통 규약"
type: "area"
version: 1
status: "draft"
requirements: []
basis_superseded: false
parent: "CLE-VISION"
ancestors: ["CLE-VISION"]
area: null
content_hash: "a78da244b71cd6c99af67699db8b716b194e82d908340302efdffa23fef48e03"
read_as: "approved"
task: null
source_paths: []
mirror_sha256: "4ae37d123de1eaf85765052003100301b8b8d7ba8d4e5bada40c396df9cc4cc7"
etag: "sha256-fcfebe9b3ed9389b04d0eae7618f6f59aa96329636a140cd96362ee936bb704f"
---
> 구현 상태: 구현됨 · 원문: 영역 문서 (자식 문서의 원문을 따른다) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 영역은 Clemvion 의 모든 외부 표면이 함께 따르는 규약을 모은다. HTTP API 의 URL·응답 봉투·부재 표현·상태 코드·요청 빈도 제한, 에러 응답 봉투와 에러 코드, `@nestjs/swagger` 로 만드는 OpenAPI 문서, 서버와 화면 사이의 WebSocket 채널, 나가는 페이로드의 자격 증명 마스킹이 대상이다.

API 를 읽는 쪽은 웹 프론트엔드 하나가 아니다. External Interaction API(EIA)·웹훅·생성된 SDK 가 같은 계약을 읽는다. 그래서 이 영역의 규약은 "무엇을 보내는가" 와 함께 "문서에 적은 것과 실제로 보내는 것이 같은가" 를 다룬다. OpenAPI 가 wire 와 어긋나면 그 차이가 소비자 코드로 그대로 번지기 때문이다.

같은 실행을 여러 표면이 보고한다는 점도 이 영역의 축이다. 내부 WebSocket 과 외부 EIA(REST·SSE·EIA 알림 웹훅)는 같은 실행 이벤트를 선택적으로 매핑해 보내고 디버그 필드와 자격 증명은 표면에 따라 빼거나 가린다. 이 비대칭은 누락이 아니라 보안을 위한 결정이다.

범위 밖: 개별 도메인 API 의 엔드포인트 계약은 각 영역 문서가 정한다. EIA 표면 자체는 [외부 상호작용](../CLE-IX/CLE-IX.md) 영역, 웹훅 수신은 [트리거](../CLE-TRIG/CLE-TRIG.md) 영역에 있다.

## 문서

| 문서 | 다루는 것 |
|---|---|
| [HTTP API 규약](CLE-API-CONV.md) | URL 구조, 워크스페이스 스코핑, 요청 형식, 응답 봉투, 부재 표현(`null` 과 키 생략), HTTP 상태 코드, 요청 빈도 제한 수치, 페이지네이션, 파일 업로드, 웹훅 수신 요약 |
| [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) | 에러 분류 체계, 에러 응답 봉투, 상태 코드별 기본 에러 코드, `details` 규칙, 실행 에러 응답, 클라이언트의 상태 코드별 처리와 토스트 |
| [에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md) | 에러 코드 이름 규칙과 안정성, 예외 등록 코드, 내부 분류 코드 정규화, 은퇴 코드, 도메인별 전체 코드 카탈로그 |
| [OpenAPI 문서화](CLE-API-SWAGGER.md) | Swagger UI 노출 정책, DTO·컨트롤러 데코레이터 패턴, 응답 DTO 규약, 설명 톤과 길이, 광고한 성공 코드·403 설명·요청 본문을 세는 가드 |
| [응답 자격 증명 마스킹](CLE-API-EGRESS.md) | 나가는 페이로드의 자격 증명 마스킹 원칙, 적용 표면 열거, 재제출 거부, 외부 `nodeOutput` 허용 목록, 마스커 좌표계와 호출 순서 |
| [WebSocket 연결과 채널 구독](CLE-API-WS.md) | Socket.IO 전송, 인증과 토큰 만료, 메시지 형식과 이벤트 봉투, 구독 채널과 인가, heartbeat, 재연결과 놓친 이벤트 복구, 전송 계층 에러, 클라이언트 구현 지침 |
| [WebSocket 이벤트와 명령](CLE-API-WS-EVENTS.md) | 실행·지식 저장소·인앱 알림·시스템 이벤트 목록, 실행 제어 명령과 ack, 입력 대기 이벤트 상세, EIA 표면 매핑 권위 표 |
