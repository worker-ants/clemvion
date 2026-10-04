---
id: "CLE-PLAT-NFR"
title: "비기능 요구사항"
type: "feature"
version: 1
status: "approved"
requirements: ["REQ-NFR-001", "REQ-NFR-002", "REQ-NFR-003", "REQ-NFR-004", "REQ-NFR-005", "REQ-NFR-006", "REQ-NFR-007", "REQ-NFR-008", "REQ-NFR-009", "REQ-NFR-010", "REQ-NFR-011", "REQ-NFR-012", "REQ-NFR-013", "REQ-NFR-014", "REQ-NFR-015", "REQ-NFR-016", "REQ-NFR-017", "REQ-NFR-018", "REQ-NFR-019", "REQ-NFR-020", "REQ-NFR-021", "REQ-NFR-022", "REQ-NFR-023", "REQ-NFR-024", "REQ-NFR-025", "REQ-NFR-026", "REQ-NFR-027", "REQ-NFR-028", "REQ-NFR-029", "REQ-NFR-030", "REQ-NFR-031", "REQ-NFR-032", "REQ-NFR-033", "REQ-NFR-034", "REQ-NFR-035", "REQ-NFR-036", "REQ-NFR-037", "REQ-NFR-038", "REQ-NFR-039", "REQ-NFR-040", "REQ-NFR-041", "REQ-NFR-042", "REQ-NFR-043", "REQ-NFR-044", "REQ-NFR-045", "REQ-NFR-046", "REQ-NFR-047"]
basis_superseded: false
parent: "CLE-PLAT"
ancestors: ["CLE-VISION", "CLE-PLAT"]
area: "CLE-PLAT"
content_hash: "bf78d7541e39adc43eb85ec5e15bd9d1babe1e7514f4f20c68b7db2e954f285f"
read_as: "approved_fallback"
task: "CLE-T-RGZBCQ"
source_paths: ["spec/5-system/_product-overview.md"]
mirror_sha256: "f85cd8c41acad9bfb69ab1baeedacb26eaadc601f1e2d7e35ac8126d88468a62"
etag: "sha256-65375bfeb26ab6dd246d1c4e728a8d1f10259c6fecce6a00ccda77cc09dee3b5"
---
> 구현 상태: 부분 구현 · 원문: `spec/5-system/_product-overview.md` (§1~§7) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 기능 하나에 속하지 않고 제품 전체가 지켜야 하는 품질 목표를 정한다. 성능·보안·확장성·가용성·관측성·국제화와 접근성·배포와 운영의 일곱 갈래다. 각 요구사항은 원문 ID(`NF-*`)를 함께 적는다.

요구사항 줄 끝의 괄호에는 원문 ID 와 우선순위(필수·권장)를 적는다. 구현하지 않은 요구는 `(미구현)`, 일부만 구현한 요구는 `(부분 구현)` 을 붙인다. 표시가 없는 요구는 원문에서 구현 완료(✅)다. 소유 문서에 구현 여부를 다시 확인해야 한다고 적힌 요구는 줄 끝에 그 문서 링크를 단다.

범위 밖:

- 에이전트 메모리 요구사항(원문 §8, `AGM-*`)은 [에이전트 메모리](../CLE-AI/CLE-AI-MEMORY.md) 가 소유한다.
- OTel 메트릭 카탈로그와 라벨 규칙, 운영 메트릭과 통계 API 의 역할 분리는 [로깅과 헬스 체크](../CLE-OBS/CLE-OBS-LOGGING.md) 가 소유한다.
- 화면 문구 다국어 규칙은 [다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md) 가 소유한다.
- 시스템 구성은 [시스템 아키텍처](CLE-PLAT-ARCH.md) 에 있다.

## 요구사항

### 성능

- REQ-NFR-001 WHILE 워크플로우 에디터 캔버스에 노드가 100개 이상 있는 동안 THE SYSTEM SHALL 60fps 로 부드럽게 렌더링한다. (원본: NF-PF-01, 필수)
- REQ-NFR-002 WHEN 사용자가 워크플로우를 저장하거나 불러오면 THE SYSTEM SHALL 2초 안에 응답한다. (원본: NF-PF-02, 필수)
- REQ-NFR-003 WHEN 실행 엔진이 한 노드에서 다음 노드로 넘어가면 THE SYSTEM SHALL 노드 사이 핸드오프를 100ms 안에 마친다. (원본: NF-PF-03, 필수)
- REQ-NFR-004 WHILE 10,000건 이상의 데이터를 처리하는 동안 THE SYSTEM SHALL 메모리 사용량을 안정적으로 유지한다. (원본: NF-PF-04, 필수)
- REQ-NFR-005 WHILE 여러 워크플로우가 동시에 실행되는 동안 THE SYSTEM SHALL 실행 사이의 성능을 서로 격리한다. (원본: NF-PF-05, 필수)
- REQ-NFR-006 WHEN CRUD API 요청을 받으면 THE SYSTEM SHALL p95 500ms 미만으로 응답한다. (원본: NF-PF-06, 필수)

### 보안

- REQ-NFR-007 WHEN 사용자가 로그인하면 THE SYSTEM SHALL 이메일·비밀번호 또는 OAuth 소셜 로그인으로 인증한다. (원본: NF-SC-01, 필수)
- REQ-NFR-008 WHEN 워크스페이스 리소스에 접근하면 THE SYSTEM SHALL 소유자·관리자·편집자·뷰어 네 역할로 접근을 제어한다. (원본: NF-SC-02, 필수)
- REQ-NFR-009 WHEN API Key·OAuth 토큰 같은 민감 정보를 저장하면 THE SYSTEM SHALL AES-256 이상으로 암호화한다. (원본: NF-SC-03, 필수)
- REQ-NFR-010 WHEN 데이터를 주고받으면 THE SYSTEM SHALL TLS 1.2 이상으로 전송 구간을 암호화한다. (원본: NF-SC-04, 필수)
- REQ-NFR-011 WHEN 요청을 처리하면 THE SYSTEM SHALL CSRF·XSS·SQL Injection 등 OWASP Top 10 위협에 대응한다. (원본: NF-SC-05, 필수)
- REQ-NFR-012 WHEN 주요 액션이 일어나면 THE SYSTEM SHALL 감사 로그에 기록한다. (원본: NF-SC-06, 필수)
- REQ-NFR-013 WHILE 로그인 세션이 유지되는 동안 THE SYSTEM SHALL 세션 유효 기간과 동시 세션 수를 제한한다. (원본: NF-SC-07, 필수) (동시 세션 제한은 구현 여부 미확인: [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) 미결 사항)
- REQ-NFR-014 WHEN 운영자가 셀프 호스팅으로 배포하면 THE SYSTEM SHALL 셀프 호스팅 보안 가이드를 제공한다. (원본: NF-SC-08, 필수) (미구현)
- REQ-NFR-015 WHEN 워크플로우를 실행하면 THE SYSTEM SHALL 악의적인 노드로부터 시스템을 보호하도록 실행을 샌드박싱한다. (원본: NF-SC-09, 필수)
- REQ-NFR-016 WHEN 사용자가 2단계 인증을 켜면 THE SYSTEM SHALL TOTP 와 Passkey·보안 키 두 방식을 지원한다. (원본: NF-SC-10, 권장)

### 확장성

- REQ-NFR-017 WHEN 실행 부하가 늘면 THE SYSTEM SHALL 워커를 늘려 실행 엔진을 수평 확장한다. (원본: NF-EX-01, 필수)
- REQ-NFR-018 WHILE SaaS 로 운영하는 동안 THE SYSTEM SHALL 테넌트 사이의 데이터를 격리한다. (원본: NF-EX-02, 필수)
- REQ-NFR-019 WHEN 운영자가 셀프 호스팅으로 배포하면 THE SYSTEM SHALL 단일 인스턴스부터 클러스터 배포까지 지원한다. (원본: NF-EX-03, 필수) (미구현)
- REQ-NFR-020 WHEN 기능을 확장하면 THE SYSTEM SHALL 노드 플러그인 시스템으로 노드를 더할 수 있게 한다. (원본: NF-EX-04, 필수) (미구현)
- REQ-NFR-021 WHEN 새 외부 서비스를 연동하면 THE SYSTEM SHALL 통합 플러그인 구조로 쉽게 추가할 수 있게 한다. (원본: NF-EX-05, 필수)
- REQ-NFR-022 WHEN 버전을 올리면 THE SYSTEM SHALL 정해진 데이터베이스 마이그레이션 전략으로 스키마를 옮긴다. (원본: NF-EX-06, 필수)

### 가용성과 안정성

- REQ-NFR-023 WHILE SaaS 로 운영하는 동안 THE SYSTEM SHALL 99.9% 가용성을 목표로 한다. (원본: NF-AV-01, 필수)
- REQ-NFR-024 IF 워크플로우 실행이 실패하면 THE SYSTEM SHALL 설정 가능한 자동 재시도 정책을 적용한다. (원본: NF-AV-02, 필수) (부분 구현: 워크플로우 수준 재시도는 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md) 미결 사항)
- REQ-NFR-025 IF 실행 중 시스템 장애가 나면 THE SYSTEM SHALL 진행 상태를 복구한다. (원본: NF-AV-03, 필수)
- REQ-NFR-026 WHEN 헬스 체크 요청을 받으면 THE SYSTEM SHALL 헬스 체크 엔드포인트로 상태를 응답한다. (원본: NF-AV-04, 필수)
- REQ-NFR-027 WHEN 운영자가 데이터를 백업하거나 복원하면 THE SYSTEM SHALL 백업과 복원 수단을 제공한다. (원본: NF-AV-05, 필수)
- REQ-NFR-028 WHEN 서버가 종료 신호를 받으면 THE SYSTEM SHALL 실행 중인 워크플로우를 마친 뒤 종료한다. (원본: NF-AV-06, 필수)

### 관측성

- REQ-NFR-029 WHEN 서버가 로그를 남기면 THE SYSTEM SHALL JSON 형식의 구조화 로그로 남긴다. (원본: NF-OB-01, 필수)
- REQ-NFR-030 WHEN `OTEL_ENABLED=true` 로 켜면 THE SYSTEM SHALL Prometheus 호환 형식으로 메트릭을 노출한다. (원본: NF-OB-02, 필수)
- REQ-NFR-031 WHEN `OTEL_ENABLED=true` 로 켜면 THE SYSTEM SHALL OpenTelemetry 호환 분산 트레이스를 내보낸다. (원본: NF-OB-03, 권장)
- REQ-NFR-032 WHEN 워크플로우를 실행하면 THE SYSTEM SHALL 노드마다 실행 시간과 입출력 크기를 기록한다. (원본: NF-OB-04, 필수)
- REQ-NFR-033 WHEN 실패율이나 지연이 알림 규칙의 임계치를 넘으면 THE SYSTEM SHALL 인앱 알림을 보낸다. (원본: NF-OB-05, 권장)
- REQ-NFR-034 WHEN 사용자가 시스템 상태를 열면 THE SYSTEM SHALL 큐 적체·실패·포화도를 집계로만 보이고 개별 작업은 보이지 않는다. (원본: NF-OB-06, 권장)
- REQ-NFR-035 WHEN 시스템 상태에 실패 지표를 보이면 THE SYSTEM SHALL 최근 윈도우 기준 실패를 주 지표로, 누적 보관 실패를 부 지표로 함께 보인다. (원본: NF-OB-06, 권장)
- REQ-NFR-036 WHEN `OTEL_ENABLED=true` 로 켜면 THE SYSTEM SHALL 워크플로우 실행·큐·LLM·노드 지연·Redis fail-open 강등·감사 적재 실패를 OTel 커스텀 메트릭으로 노출한다. (원본: NF-OB-07, 권장)

### 국제화와 접근성

- REQ-NFR-037 WHEN 화면을 그리면 THE SYSTEM SHALL 한국어와 영어를 기본으로 하는 다국어 구조로 문구를 보인다. (원본: NF-I18N-01, 필수)
- REQ-NFR-038 WHEN 날짜·시간·숫자를 보이면 THE SYSTEM SHALL 로케일에 맞는 형식으로 보인다. (원본: NF-I18N-02, 필수)
- REQ-NFR-039 WHEN 화면을 그리면 THE SYSTEM SHALL WCAG 2.1 AA 수준의 접근성을 지킨다. (원본: NF-A11Y-01, 권장)
- REQ-NFR-040 WHEN 사용자가 키보드만 쓰면 THE SYSTEM SHALL 키보드로 모든 화면을 탐색할 수 있게 한다. (원본: NF-A11Y-02, 필수)
- REQ-NFR-041 WHEN 사용자가 스크린 리더로 화면을 읽으면 THE SYSTEM SHALL 스크린 리더와 호환되는 마크업을 제공한다. (원본: NF-A11Y-03, 권장) (부분 구현)

### 배포와 운영

- REQ-NFR-042 WHEN 서비스를 배포하면 THE SYSTEM SHALL Docker 컨테이너 이미지로 배포한다. (원본: NF-DP-01, 필수)
- REQ-NFR-043 WHEN 운영자가 셀프 호스팅으로 설치하면 THE SYSTEM SHALL Docker Compose 로 간편하게 배포할 수 있게 한다. (원본: NF-DP-02, 필수) (미구현)
- REQ-NFR-044 WHEN 운영자가 클러스터에 배포하면 THE SYSTEM SHALL Kubernetes Helm Chart 를 제공한다. (원본: NF-DP-03, 권장) (미구현)
- REQ-NFR-045 WHEN 운영자가 설정을 바꾸면 THE SYSTEM SHALL 환경 변수로 설정을 관리한다. (원본: NF-DP-04, 필수)
- REQ-NFR-046 WHEN 코드를 배포하면 THE SYSTEM SHALL CI/CD 파이프라인으로 빌드와 배포를 진행한다. (원본: NF-DP-05, 필수) (부분 구현)
- REQ-NFR-047 WHEN 운영자가 셀프 호스팅으로 설치하고 운영하면 THE SYSTEM SHALL 설치·운영 문서를 제공한다. (원본: NF-DP-06, 필수) (미구현)

## 요구사항별 구현 메모

원문 표의 상태 칸에 적힌 구현 사실을 요구사항별로 옮긴다.

### 보안

- **역할 기반 접근 제어(NF-SC-02)**: 워크플로우·트리거·스케줄·통합·모델 설정·지식 저장소·인증 설정·폴더에 역할 가드를 적용했다. 워크스페이스 멤버 관리는 관리자와 소유자로 나눴고, 소유자 이양을 지원한다. 권한 매트릭스는 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) 가 정한다.
- **동시 세션 제한(NF-SC-07)**: 세션 정책은 [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) 이 정한다. 구현 여부는 [미결 사항](#미결-사항) 을 본다.
- **2단계 인증(NF-SC-10)**: TOTP 와 Passkey·보안 키(WebAuthn, 여러 개 등록 가능)를 지원한다. 방식마다 복구 코드 10개를 따로 발급한다. Passkey·보안 키를 우선하고 TOTP 로 자동 전환하지 않는다. 규칙은 [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) 이 정한다.
- **샌드박싱(NF-SC-09)**: 샌드박싱 정책은 [노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md) 와 [Code 노드](../CLE-NODE-DATA/CLE-NODE-CODE.md) 가 정한다.

### 가용성

- **자동 재시도(NF-AV-02)**: 재시도 규칙은 [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md) 이 정한다. 원문 표는 구현 완료(✅)로 적지만 이 문서는 부분 구현으로 적는다. 노드 재시도(`retryConfig`)는 설정 가능한 재시도로 구현돼 있다. 그러나 소유 문서는 워크플로우 수준 자동 재시도를 미구현으로 표시한다. 이 요구를 노드 재시도 기준으로 다시 쓸지는 [미결 사항](#미결-사항) 을 본다.
- **장애 복구와 안전 종료(NF-AV-03·06)**: [장애 복구와 안전 종료](../CLE-EXEC/CLE-EXEC-RECOVERY.md) 가 정한다.
- **헬스 체크(NF-AV-04)**: [로깅과 헬스 체크](../CLE-OBS/CLE-OBS-LOGGING.md) 가 정한다.

### 관측성

- **메트릭(NF-OB-02)**: `OTEL_ENABLED=true` 일 때 켜진다. OTel MeterProvider 와 `@opentelemetry/exporter-prometheus`(`instrumentation.ts`)가 Prometheus scrape 서버의 `/metrics` 로 노출한다. 주소는 `OTEL_PROMETHEUS_HOST`·`OTEL_PROMETHEUS_PORT` 이고 기본값은 `127.0.0.1:9464` 다. 자동 계측이 HTTP 서버 메트릭을, `instrumentation-runtime-node` 가 런타임(event loop·GC·heap) 메트릭을 모은다.
- **분산 트레이싱(NF-OB-03)**: `OTEL_ENABLED=true` 일 때 켜진다. OTLP HTTP exporter 의 기본 엔드포인트는 `/v1/traces` 다.
- **알림 규칙(NF-OB-05)**: 규칙 CRUD API, `/profile/alerts` 화면, `AlertsEvaluatorService` 로 구현했다. BullMQ 반복 작업이 `*/5 * * * *`(UTC)로 5분마다 평가하고, 규칙 윈도우 단위 cooldown 으로 알림 폭주를 막는다. 규칙과 평가는 [알림 §알림 규칙](../CLE-OBS/CLE-OBS-NOTIFY.md#알림-규칙) 이 정한다. 관측 흐름 전체의 개요는 [로깅과 헬스 체크](../CLE-OBS/CLE-OBS-LOGGING.md) 에 있다.
- **시스템 상태(NF-OB-06)**: `GET /api/system-status/overview` 와 `/system-status` 화면으로 구현했다([시스템 상태](../CLE-OBS/CLE-OBS-STATUS.md)).
- **커스텀 메트릭(NF-OB-07)**: `OTEL_ENABLED=true` 일 때 `BusinessMetricsService` 가 `metrics.getMeter('clemvion.business')` 로 계측한다. 메트릭 카탈로그와 라벨 규칙은 [로깅과 헬스 체크](../CLE-OBS/CLE-OBS-LOGGING.md) 에 있다. OTel 메트릭은 실시간 운영 감시와 알람용이고, 제품 분석과 과거 추세의 기준은 [통계](../CLE-OBS/CLE-OBS-STATS.md) API 다.

### 국제화와 접근성

- **다국어(NF-I18N-01)**: 화면 문구 사전과 백엔드 라벨 매핑 규칙은 [다국어와 화면 문구](../CLE-UI/CLE-UI-I18N.md) 가 정한다.
- **WCAG 2.1 AA(NF-A11Y-01)**: `codebase/frontend/e2e/a11y/smoke.spec.ts` 가 axe 위반 0건을 회귀 테스트로 강제한다. 시맨틱 랜드마크, 본문 바로가기(skip-to-main), 페이지마다 h1, 색 대비(라이트·다크 `--muted-foreground` 4.5:1 이상)를 모두 맞췄다.
- **스크린 리더(NF-A11Y-03)**: 폼 입력의 `aria-invalid` 와 `aria-describedby` 연결, 아이콘만 있는 버튼의 `aria-label`, 장식 아이콘의 `aria-hidden`, 상세 드로어(`SlideDrawer`)의 Radix `FocusScope` 포커스 가두기, 실행 상태의 `aria-live="polite"` 안내를 적용했다. macOS VoiceOver 수동 점검 체크리스트는 사용자가 진행할 차례다. 점검을 마치면 구현 완료로 바꾼다.

### 배포와 운영

- 배포 환경별 차이는 [시스템 아키텍처](CLE-PLAT-ARCH.md) 의 배포 환경 분리 절에 있다.
- **CI/CD(NF-DP-05)**: CI 빌드 검증(backend · frontend 검사 워크플로)만 있다. 저장소에 배포 워크플로가 없어서 이 문서는 부분 구현으로 적는다(2026-10-03 실측).
- 마이그레이션 전략(NF-EX-06)은 [DB 마이그레이션 규약](../CLE-ENG/CLE-ENG-MIGRATION.md) 이 정한다.

## 미결 사항

- **동시 세션 제한의 구현 여부(NF-SC-07)**: 원문 요구사항 표는 구현 완료(✅)로 적는다. [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md) 의 세션 정책은 동시 세션 기본 5개(관리자 설정 가능), 초과 시 가장 오래된 세션 종료, 30일 비활동 만료를 약속한다. 분석 단계에서 인증·세션 서비스 코드에서 세션 수 제한과 비활동 만료 로직을 찾지 못했다(실행 확인은 하지 않았다). 리프레시 토큰 수명이 7일(로그인 유지 시 30일)이라 30일 비활동 만료는 뜻이 거의 없다. 구현 여부를 확인하고, 미구현이면 이 요구의 상태와 세션 정책을 함께 고쳐야 한다. "관리자 설정" 의 주체(운영자 환경 변수인지 워크스페이스 관리자인지)도 정해야 한다.
- **워크플로우 수준 자동 재시도의 근거(NF-AV-02)**: 원문 요구사항 표는 구현 완료(✅)로 적는다. [노드 에러 처리 정책](../CLE-NODE/CLE-NODE-ERROR.md) 은 트리거·스케줄 자동 실행에 워크플로우 설정의 재시도(기본 0, 최대 5)를 약속한다. 그러나 워크플로우 설정(`Workflow.settings`)에는 재시도 키가 없고, 시작 큐(`execution-run`)는 `attempts:1` 이라 애플리케이션 수준 재시도를 하지 않는다([비동기 큐와 Redis 키 목록](CLE-PLAT-QUEUE.md)). 분석 단계에서 워크플로우 수준 재시도 구현을 찾지 못했다. 소유 문서가 이 기능을 미구현으로 표시하므로 이 문서도 요구 상태를 부분 구현으로 낮췄다. 이 요구를 노드 수준 재시도 기준으로 다시 쓸지 워크플로우 수준 재시도를 구현할지 결정 필요.

## 구현 위치

요구사항 대부분은 그 표면을 정한 문서(요구사항별 구현 메모의 링크)의 구현 위치가 맡는다. 아래는 이 문서만 근거로 삼는 표면이다.

- `codebase/frontend/e2e/a11y/smoke.spec.ts` (NF-A11Y-01 접근성 위반 0건 회귀)
- `codebase/frontend/src/components/ui/skip-to-main.tsx` (NF-A11Y-01 본문 바로가기)
- `codebase/frontend/src/components/ui/slide-drawer.tsx` (NF-A11Y-03 상세 드로어 포커스 가두기)
- `codebase/frontend/src/components/__tests__/accessibility.test.tsx` (UI 기본 컴포넌트의 접근성 회귀)
- `codebase/{backend,frontend}/Dockerfile` (NF-DP-01 컨테이너 이미지)
- `.github/workflows/backend-checks.yml`, `.github/workflows/frontend-checks.yml` (NF-DP-05 CI 빌드 검증. 배포 워크플로가 없어 부분 구현이다)

## Rationale

### 관측 대상을 둘로 나눈 이유

실행 수와 LLM 사용량은 OTel 메트릭과 DB 집계 기반 통계 API 양쪽에서 볼 수 있다. 둘은 역할이 다르다. OTel·Prometheus 는 Grafana 대시보드와 알람 규칙에 쓰는 실시간 rate·gauge 지표이고, 통계 API 는 워크스페이스 단위 정확 집계·기간 필터·차트를 주는 제품 분석과 과거 추세의 기준이다. OTel 메트릭은 운영 관측을 돕는 보조 노출이며 제품 데이터의 기준이 아니다. 자세한 근거는 [로깅과 헬스 체크](../CLE-OBS/CLE-OBS-LOGGING.md) 에 있다.
