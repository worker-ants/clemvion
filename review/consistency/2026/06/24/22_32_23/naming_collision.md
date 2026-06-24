# 신규 식별자 충돌 검토 결과

검토 범위: 06-concurrency M-2 — ShutdownStateService `registerInFlight` early-return 제거 (Option A)

## 발견사항

충돌하는 신규 식별자 없음.

## 상세 분석

### 1. 요구사항 ID 충돌

M-2 는 기존 plan 문서(`plan/in-progress/refactor/06-concurrency.md §M-2`)에 이미 정의된 ID다. 본 구현이 새 요구사항 ID를 부여하지 않는다. 충돌 없음.

### 2. 엔티티/타입명 충돌

본 구현은 신규 클래스·인터페이스·DTO를 도입하지 않는다. 변경 대상은 기존 `ShutdownStateService.registerInFlight` 메서드의 내부 로직(early-return 제거)뿐이며, 모든 타입명은 기존 그대로다.

관련 식별자와 기존 정의:
- `ShutdownStateService` — `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts:42` 에 이미 존재
- `registerInFlight` — 동 파일 `:105` 에 이미 존재
- `inFlightNodeExecutions` — 동 파일 `:46` 에 이미 존재
- `SERVER_INTERRUPTED` — `spec/5-system/4-execution-engine.md:1199`, `spec/data-flow/3-execution.md:262`, `spec/1-data-model.md` error.code 어휘에 이미 정의

### 3. API endpoint 충돌

신규 endpoint 없음.

### 4. 이벤트/메시지명 충돌

신규 이벤트·큐명 없음.

### 5. 환경변수·설정키 충돌

신규 환경변수 또는 DI 토큰 없음. 연관 식별자 `SIGTERM_GRACE_MS`, `SHUTDOWN_GRACE_MS`, `SHUTDOWN_POLL_MS` 는 기존에 동일 의미로 이미 사용 중이며 본 구현이 추가하지 않는다.

### 6. 파일 경로 충돌

신규 파일 추가 없음. 변경 대상 파일:
- `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts` — 기존 파일 내 로직 수정
- `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.spec.ts` — 기존 테스트 파일 내 케이스 교체

## 요약

M-2 구현(Option A: `registerInFlight` early-return 제거)은 신규 식별자를 전혀 도입하지 않는다. 변경은 단일 서비스 파일 내 4줄 제거와 테스트 케이스 교체에 국한되며, 관련 모든 식별자(`ShutdownStateService`, `registerInFlight`, `SERVER_INTERRUPTED`, `SIGTERM_GRACE_MS`, `SHUTDOWN_GRACE_MS`, `SHUTDOWN_POLL_MS`)는 기존 spec 및 codebase에서 일관된 의미로 이미 사용 중이다. 명명 충돌 위험 없음.

## 위험도

NONE
