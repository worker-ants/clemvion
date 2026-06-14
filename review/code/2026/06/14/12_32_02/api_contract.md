# API 계약(API Contract) 리뷰 결과

## 발견사항

이번 변경은 내부 메트릭 계측 인프라(NF-OB-07) 추가가 핵심이다. 신규 HTTP 엔드포인트·라우트·요청/응답 스키마는 없다. 분석은 해당 변경이 기존 API 계약에 미치는 간접 영향에 집중한다.

### 1. 하위 호환성

- **[INFO]** MetricsModule을 @Global로 AppModule에 등록
  - 위치: `codebase/backend/src/app.module.ts` L47
  - 상세: MetricsModule 추가는 서버 내부 DI 그래프 변경으로, 외부 API 클라이언트에게는 완전히 투명하다. 기존 API 응답 구조·엔드포인트·계약에 변화 없음.
  - 제안: 해당 없음.

### 2. 버전 관리

- **[INFO]** 신규 메트릭 엔드포인트 없음
  - 위치: 전 파일 범위
  - 상세: `/metrics` Prometheus 스크레이프 엔드포인트는 OTel instrumentation.ts 파이프라인 레벨에서 노출되며, 이번 변경이 그 경로를 새로 추가하거나 변경하지 않는다. API 버전 관리 문제 없음.
  - 제안: 해당 없음.

### 3. 응답 형식

- **[INFO]** 기존 REST API 응답 구조 변경 없음
  - 위치: 전 파일 범위
  - 상세: BusinessMetricsService는 내부 계측 전용 서비스로, 클라이언트에 반환되는 응답 스키마와 무관하다. `LlmUsageLogService.record()`는 `void`를 반환하며 변경 전후 동일하다.
  - 제안: 해당 없음.

### 4. 에러 응답

- **[INFO]** 에러 응답 형식 영향 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L9261
  - 상세: `emitTerminalExecutionMetrics`는 실행 경로에서 fire-and-forget으로 호출되며, 메트릭 실패가 HTTP 응답 에러로 노출되지 않도록 swallow 처리되어 있다.
  - 제안: 해당 없음.

### 5. 요청 검증

- **[INFO]** 요청 검증 로직 변경 없음
  - 위치: 전 파일 범위
  - 상세: 이번 변경은 계측 추가만이며, 요청 파라미터·바디 유효성 검증 로직에 영향을 주지 않는다.
  - 제안: 해당 없음.

### 6. URL/경로 설계

- **[INFO]** 신규 URL 경로 없음
  - 위치: 전 파일 범위
  - 상세: 신규 Controller·Route가 없다.
  - 제안: 해당 없음.

### 7. 페이지네이션

- **[INFO]** 목록 API 변경 없음
  - 위치: 전 파일 범위
  - 상세: 페이지네이션 대상 엔드포인트 변경 없음.
  - 제안: 해당 없음.

### 8. 인증/인가

- **[INFO]** 인증/인가 적용 영향 없음
  - 위치: 전 파일 범위
  - 상세: BusinessMetricsService는 내부 전용 서비스로 외부 엔드포인트를 신규 노출하지 않는다. AppModule의 JwtAuthGuard·RolesGuard 전역 가드 구성은 변경되지 않았다.
  - 제안: 해당 없음.

## 요약

이번 변경 세트(NF-OB-07 도메인 메트릭 파이프라인)는 신규 HTTP 엔드포인트·요청/응답 스키마·인증 경계·URL 경로를 전혀 추가하지 않는다. BusinessMetricsService는 OTel no-op 패턴을 활용해 OTEL 미설정 환경에서도 안전하고, 메트릭 수집 실패가 실행 경로나 API 응답 형식에 영향을 주지 않도록 전부 무동작-안전하게 처리된다. 기존 API 계약에 대한 하위 호환성 파괴 요인이 없다.

## 위험도

NONE
