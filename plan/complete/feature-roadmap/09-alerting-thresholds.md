# Stage 9 · 알림 임계값

## 배경

`NF-OB-05` — 실패율·지연 임계값 초과 시 알림. notifications 모듈이 존재하지만 임계값 기반 자동 알림이 없다.

## 설계

### 범위

- 사용자는 `/profile/alerts`에서 룰 생성:
  - **실패율**: 최근 24h 중 실패율 X% 초과 시 (범위는 워크스페이스 전체 또는 특정 워크플로우)
  - **지연**: 최근 1h 중 평균 duration Y초 초과 시
  - **LLM 비용**: 일 Z USD 초과 시 (Stage 1 의존)
- 트리거되면 **앱 내 알림** + (옵션) 이메일
- 룰은 워크스페이스 소유, Admin+만 생성

### 데이터 모델

`alert_rules` 테이블:
- id, workspace_id, type (failure_rate | duration | llm_cost), scope (workflow_id? NULL 전체), threshold, window (ISO8601 duration), channel (in_app | email), enabled, created_at

평가 스케줄: 백엔드 cron(기존 schedules 모듈과 별개)으로 5분마다 평가.

### 영향받는 파일

- 신규: `backend/src/modules/alerts/**` (module·service·cron·entity)
- 수정: `backend/src/modules/notifications/**` (type 확장)
- 신규: `frontend/src/app/(main)/profile/alerts/page.tsx`
- 수정: PRD `NF-OB-05` → ✅

### 테스트

- backend: 각 룰 타입 평가 로직 단위 테스트, cron 통합 테스트
- frontend: 룰 CRUD 페이지

### 검증

- 실패율 룰 작동 확인(일부러 실패 유도)
- LLM 비용 룰은 Stage 1의 usage 로그 기반으로 동작
