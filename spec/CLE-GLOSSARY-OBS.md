---
id: "CLE-GLOSSARY-OBS"
title: "용어 사전 — 관측과 운영"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-GLOSSARY"
ancestors: ["CLE-VISION", "CLE-GLOSSARY"]
area: null
content_hash: "a1848bffb5f0d1e98c46eabd1a6370d166d4f0546510ed88106c3d4afb4013ca"
read_as: "approved_fallback"
task: "CLE-T-SJAYNM"
source_paths: []
mirror_sha256: "8c42330f2f615a2ef1bf7d40ff45008a40ffa635060d17071877f3b4e8af7c58"
etag: "sha256-1c2fcceb3331eafda450e265bdf3fcdc3dc765f0f6d2660060738244d9f48c57"
---
## 개요

[용어 사전](CLE-GLOSSARY.md) 의 「관측과 운영」 영역 용어다. 표기 원칙 · 약어 · 상태값 표기는 [용어 사전](CLE-GLOSSARY.md) 에 있고, 여러 영역에 걸친 같은 말은 [용어 사전 — 다의어 구분](CLE-GLOSSARY-POLY.md) 이 가른다.

표는 `표준 용어 · 영문과 코드 식별자 · 정의 · 쓰지 않는 표기 · 기준 문서` 순서다. "쓰지 않는 표기" 에 괄호로 붙은 조건은 그 뜻일 때만 쓰지 않는다는 뜻이다.

## 용어

| 표준 용어 | 영문 · 코드 식별자 | 정의 | 쓰지 않는 표기 | 기준 문서 |
| --- | --- | --- | --- | --- |
| 대시보드 | Dashboard | 로그인 뒤 첫 화면. 요약 카드와 최근 워크플로우·실행을 보여 준다. | 홈 | [대시보드](CLE-OBS/CLE-OBS-DASHBOARD.md) |
| 통계 | Statistics | 실행·노드·토큰 통계 화면과 API. | 없음 | [통계](CLE-OBS/CLE-OBS-STATS.md) |
| 성공률 | success rate, `successRate` | 기간 안 전체 실행 중 완료 비율. 분모에 실행 중·대기 중·취소됨도 들어간다. | Success Rate(본문) | [통계](CLE-OBS/CLE-OBS-STATS.md) |
| 평균 실행 시간 | average duration | 완료된 실행의 평균 소요 시간. | Avg Time, Avg Duration | [통계](CLE-OBS/CLE-OBS-STATS.md) |
| 오류 분포 | Error Distribution | 실패 실행을 워크플로우별로 나눈 차트. 에러 코드별 분류가 아니다. | 에러 발생 빈도 및 유형별 분류 | [통계](CLE-OBS/CLE-OBS-STATS.md) |
| 노드 통계 | node statistics | 노드 유형별 실행 수·평균 시간·오류율과 병목 표시. | 없음 | [통계](CLE-OBS/CLE-OBS-STATS.md) |
| 시스템 상태 | System Status | 워크스페이스와 상관없이 BullMQ 큐 상태를 보여 주는 화면과 API. 헬스 체크와 다르다. | SysStatus | [시스템 상태](CLE-OBS/CLE-OBS-STATUS.md) |
| 큐 그룹 | queue group | 시스템 상태 화면이 큐를 묶는 네 그룹(실행, 지식 저장소, 알림·통합, 스케줄·시스템). "알림·통합" 의 알림은 EIA 알림 웹훅이다. | 없음 | [시스템 상태](CLE-OBS/CLE-OBS-STATUS.md) |
| 큐 건강도 | queue health, `healthy`, `degraded`, `down` | 큐 상태 판정. 화면 라벨은 정상·지연·점검 필요다. | 없음 | [시스템 상태](CLE-OBS/CLE-OBS-STATUS.md) |
| 최근 실패·누적 보관 | `recentFailed`, `failed` | 최근 윈도우(기본 60분) 안의 실패 수와 큐가 아직 보관 중인 실패 수. 누적 보관은 전체 기간 합계가 아니다. | 누적(단독) | [시스템 상태](CLE-OBS/CLE-OBS-STATUS.md) |
| 헬스 체크 | health check, `/api/health`, `/api/health/live` | DB·Redis 를 점검하는 준비 상태 API 와 늘 200 을 돌려주는 생존 확인 API. | Health check(본문) | [로깅과 헬스 체크](CLE-OBS/CLE-OBS-LOGGING.md) |
| 감사 로그 | Audit Log, `AuditLog` | 워크스페이스 안 변경 동작을 한 행씩 남기는 기록. 관리자 이상만 본다. | Audit Log(본문), 감사(단독) | [감사 로그](CLE-OBS/CLE-OBS-AUDIT.md) |
| 감사 액션 | audit action, `AuditLog.action` | `<resource>.<verb>` 형식의 동작 식별자(예: `integration.created`). | action(본문), audit action(본문) | [감사 action 명명](CLE-OBS/CLE-OBS-AUDITNAME.md) |
| 로그인 이력 | Login History, `LoginHistory` | 로그인 성공·실패·로그아웃 같은 인증 이벤트를 사용자별로 180일 남기는 기록. 본인만 본다. 감사 로그와 다른 기록이다. | Login History(본문) | [감사 로그](CLE-OBS/CLE-OBS-AUDIT.md) |
| 인앱 알림 | Notification, `notification` | 사용자에게 벨과 이메일로 보내는 알림. 본문에서 "알림" 은 이 뜻으로만 쓴다. | Notifications(본문), 벨 알림 | [알림](CLE-OBS/CLE-OBS-NOTIFY.md) |
| 알림 유형 | `Notification.type` | execution_failed, integration_expired, alert_failure_rate 등 열 가지 값. | 없음 | [알림](CLE-OBS/CLE-OBS-NOTIFY.md) |
| 알림 채널 | `Notification.channel`: in_app, email, both | 알림이 전달되는 경로. 채팅 채널·WebSocket 구독 채널과 다르다. | 채널(단독) | [알림](CLE-OBS/CLE-OBS-NOTIFY.md) |
| 알림 닫기 | dismiss, `dismissed_at` | 알림을 목록과 개수에서 숨기는 동작. 행을 지우지 않는다. 화면 버튼은 "닫기", "모두 지우기" 다. | 알림 삭제(이 동작을) | [알림](CLE-OBS/CLE-OBS-NOTIFY.md) |
| 알림 필터 | notification filter | 알림 팝오버의 분류 칩(전체, 일반, 통합 액션 필요). | 없음 | [알림](CLE-OBS/CLE-OBS-NOTIFY.md) |
| 알림 규칙 | Alert Rule, `AlertRule` | 실패율·평균 실행 시간·LLM 비용이 임계치를 넘으면 인앱 알림을 보내는 워크스페이스 규칙. | 알람, 알림 룰, Alert Rule(본문) | [알림](CLE-OBS/CLE-OBS-NOTIFY.md) |
| 평가 기간 | `window_iso` | 알림 규칙이 지표를 모으는 기간(ISO 8601, 기본 PT1H). 화면 라벨은 "기간", "윈도우" 다. | 없음 | [알림](CLE-OBS/CLE-OBS-NOTIFY.md) |
| 알림 설정 | notification preferences, `notification_preferences` | 알림 유형별 이메일 수신 여부. 실행·스케줄 실패 메일은 기본 켜짐, 통합 만료 메일은 기본 꺼짐이다. 알림 규칙과 다르다. | 없음 | [알림](CLE-OBS/CLE-OBS-NOTIFY.md) |
| 부수 기록 실패 흡수 | best-effort | 감사 로그·로그인 이력·사용량 기록이 실패해도 주 동작을 막지 않는 방식. | swallow, 삼킨다 | [로깅과 헬스 체크](CLE-OBS/CLE-OBS-LOGGING.md) |
| 보존 배치 | pruner | 로그인 이력(180일)과 활동 로그(90일)의 오래된 행을 지우는 반복 작업. 감사 로그에는 없다. | 없음 | [감사 로그](CLE-OBS/CLE-OBS-AUDIT.md) |
| 비즈니스 메트릭 | business metrics, `clemvion.*` | OTel 로 내보내는 운영 지표. | 없음 | [로깅과 헬스 체크](CLE-OBS/CLE-OBS-LOGGING.md) |
| 로그 마스킹 | log masking | 서버 로그에 자격 증명이 남지 않게 가리는 규칙. | 없음 | [로깅과 헬스 체크](CLE-OBS/CLE-OBS-LOGGING.md) |

## Rationale

2026-10-02 까지 이 표는 [용어 사전](CLE-GLOSSARY.md) 한 문서의 「관측과 운영」 절이었다. 그 문서가 약 195KB 가 되어 NERV 초안 저장 한 번에 담기지 않아 영역별 문서로 나눴다. 정의는 옮기기만 했다. 표준을 고른 기준과 검토한 다른 선택은 [용어 사전](CLE-GLOSSARY.md) 의 Rationale 에 있다.
