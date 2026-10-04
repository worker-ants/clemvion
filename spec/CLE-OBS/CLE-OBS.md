---
id: "CLE-OBS"
title: "관측과 운영"
type: "area"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-VISION"
ancestors: ["CLE-VISION"]
area: null
content_hash: "eba9724105b942302957516b55ddad6710e2e8e350606af9acde7c3440e4c94b"
read_as: "approved_fallback"
task: "CLE-T-52JYHM"
source_paths: []
mirror_sha256: "65354d9691b0ada64722b31cb762d4f57b83185ee63d674a518ab4dde54b5d0c"
etag: "sha256-1784603185a2743c8d50f7ae08721c74f1f0a875d3d28dc08f6d9f133e4f8dbf"
---
> 구현 상태: 부분 구현 · 원문: 없음(영역 문서) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

관측과 운영 영역은 제품이 지금 어떻게 돌고 있는지 사용자와 운영자에게 보여 주는 기능을 모은다. 두 부류로 나뉜다.

- **사용자가 보는 화면**: 로그인 뒤 첫 화면인 대시보드, 기간별 실행 통계, 시스템 전역 큐 상태, 인앱 알림과 알림 규칙, 워크스페이스 감사 로그와 본인 로그인 이력
- **운영자가 보는 신호**: 서버 로그, 헬스 체크, OTel 메트릭과 트레이스

이 영역은 대부분 읽기 위주다. 새 행을 만드는 쪽은 실행·통합·인증 같은 다른 도메인이고 이 영역은 그 행을 집계하거나 평가해 보여 준다. 예외는 알림(발사원이 저장을 요청한다)과 감사 로그·로그인 이력(각 도메인이 기록을 요청한다)이다. 관측 영역 전체의 데이터 흐름은 [로깅과 헬스 체크](CLE-OBS-LOGGING.md) 에 있다.

"건강도" 라는 말은 이 영역 안에서도 표면마다 값 집합이 다르다. 헬스 체크는 `healthy`·`unhealthy`, 큐 건강도는 `healthy`·`degraded`·`down` 이다. 섞어 쓰지 않는다([용어 사전 — 다의어 구분](../CLE-GLOSSARY-POLY.md) 의 「건강도」, [용어 사전 — 결정이 필요한 표기](../CLE-GLOSSARY-OPEN.md) 의 「건강도 값 집합」 항목(D58)).

## 문서

- [대시보드](CLE-OBS-DASHBOARD.md): 로그인 뒤 첫 화면. 요약 카드 4개, 최근 워크플로우 5개, 최근 실행 10건, 새 워크플로우 만들기.
- [통계](CLE-OBS-STATS.md): 기간·워크플로우 필터로 실행 횟수·성공률·평균 실행 시간·오류 분포·상위 워크플로우·노드 통계·LLM 토큰 사용량을 보여 주는 화면과 API. 대시보드와 함께 쓰는 지표 정의를 둔다.
- [시스템 상태](CLE-OBS-STATUS.md): 워크스페이스와 상관없이 BullMQ 큐의 적체·실패·포화도와 큐 건강도를 보여 주는 읽기 전용 화면과 API.
- [감사 로그](CLE-OBS-AUDIT.md): 워크스페이스 변경을 남기는 감사 로그와 사용자별 로그인 이력의 적재·조회·보존, 감사 액션 카탈로그.
- [감사 action 명명](CLE-OBS-AUDITNAME.md): 감사 액션 식별자의 `<resource>.<verb>` 구조와 동사 시제 세 갈래.
- [알림](CLE-OBS-NOTIFY.md): 인앱 알림의 유형·저장·전달, 알림 벨과 팝오버, 읽음과 닫기, 알림 설정, 알림 규칙과 그 평가.
- [로깅과 헬스 체크](CLE-OBS-LOGGING.md): 서버 로그의 레벨·형식·마스킹, 부수 기록 실패 흡수, 헬스 체크, OTel 메트릭 카탈로그, 관측 영역의 데이터 흐름.

관련 문서:

- 관측성 요구사항(NF-OB-*): [비기능 요구사항](../CLE-PLAT/CLE-PLAT-NFR.md)
- 큐 카탈로그: [비동기 큐와 Redis 키 목록](../CLE-PLAT/CLE-PLAT-QUEUE.md)
- 통합 만료 알림의 발사 조건: [통합 상태와 만료 알림](../CLE-INT/CLE-INT-STATUS.md)
- 외부 URL 로 보내는 실행 이벤트(인앱 알림과 다른 기능): [EIA 알림 웹훅](../CLE-IX/CLE-EIA-NOTIFY.md)
