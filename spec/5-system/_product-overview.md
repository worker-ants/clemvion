# PRD: 비기능 요구사항

> 관련 문서: [제품 개요](../0-overview.md)
>
> **시스템 영역 spec 맵**: [인증/인가](./1-auth.md) · [API 설계 규칙](./2-api-convention.md) · [에러 처리](./3-error-handling.md) · [실행 엔진](./4-execution-engine.md) · [표현식 언어](./5-expression-language.md) · [WebSocket 프로토콜](./6-websocket-protocol.md) · [LLM 클라이언트](./7-llm-client.md) · [임베딩 파이프라인](./8-embedding-pipeline.md) · [RAG 검색](./9-rag-search.md) · [Graph RAG](./10-graph-rag.md) · [MCP Client](./11-mcp-client.md) · [Webhook 트리거](./12-webhook.md) · [Re-run](./13-replay-rerun.md) · [External Interaction API](./14-external-interaction-api.md) · [Chat Channel](./15-chat-channel.md) · [시스템 상태 API](./16-system-status-api.md)

---

## 1. 성능

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| NF-PF-01 | 워크플로우 에디터 캔버스는 100개 이상의 노드가 있어도 부드러운 렌더링(60fps) 유지 | 필수 | ✅ |
| NF-PF-02 | 워크플로우 저장/로드 응답 시간 2초 이내 | 필수 | ✅ |
| NF-PF-03 | 노드 실행 시작 지연(Latency) 최소화 — 실행 엔진 노드 간 핸드오프 100ms 이내 | 필수 | ✅ |
| NF-PF-04 | 대량 데이터(10,000건 이상) 처리 시에도 메모리 사용량 안정적 유지 | 필수 | ✅ |
| NF-PF-05 | 동시 실행 중인 워크플로우 간 성능 격리 | 필수 | ✅ |
| NF-PF-06 | API 응답 시간 p95 < 500ms (CRUD 기준) | 필수 | ✅ |

---

## 2. 보안

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| NF-SC-01 | 사용자 인증 (이메일/비밀번호, OAuth 소셜 로그인) | 필수 | ✅ |
| NF-SC-02 | 역할 기반 접근 제어 (RBAC) — Owner, Admin, Editor, Viewer | 필수 | ✅ (Workflows·Triggers·Schedules·Integrations·LLM Config·KB·Auth Configs·Folders 가드 적용 · 워크스페이스 멤버 관리는 Admin/Owner 분리 · Owner 이양 지원) |
| NF-SC-03 | API Key, OAuth Token 등 민감 정보 암호화 저장 (AES-256 이상) | 필수 | ✅ |
| NF-SC-04 | 전송 중 데이터 암호화 (TLS 1.2+) | 필수 | ✅ |
| NF-SC-05 | CSRF, XSS, SQL Injection 등 OWASP Top 10 대응 | 필수 | ✅ |
| NF-SC-06 | 감사 로그 (Audit Log) — 주요 액션 기록 | 필수 | ✅ |
| NF-SC-07 | 세션 관리 — 유효 기간, 동시 세션 제한 | 필수 | ✅ |
| NF-SC-08 | 셀프 호스팅 환경에서의 보안 가이드 제공 | 필수 | ❌ |
| NF-SC-09 | 워크플로우 실행 샌드박싱 — 악의적 노드로부터 시스템 보호 | 필수 | ✅ |
| NF-SC-10 | 2FA(Two-Factor Authentication) 지원 | 권장 | ✅ TOTP + WebAuthn (Passkey · 보안 키, 다중 등록). 각 방식 별도 복구 코드 10개. WebAuthn 우선·TOTP fallback 자동 금지 — [인증 spec §1.4](./1-auth.md#14-2fa-two-factor-authentication) |

---

## 3. 확장성

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| NF-EX-01 | 수평 확장 가능한 워크플로우 실행 엔진 (Worker 기반) | 필수 | ✅ |
| NF-EX-02 | SaaS 멀티 테넌트 아키텍처 — 테넌트 간 데이터 격리 | 필수 | ✅ |
| NF-EX-03 | 셀프 호스팅 시 단일 인스턴스부터 클러스터 배포까지 지원 | 필수 | ❌ |
| NF-EX-04 | 노드 플러그인 시스템을 통한 기능 확장 | 필수 | ❌ |
| NF-EX-05 | Integration 플러그인 아키텍처 — 새 서비스 연동 추가 용이 | 필수 | ✅ |
| NF-EX-06 | 데이터베이스 마이그레이션 전략 (버전 업그레이드 시) | 필수 | ✅ |

---

## 4. 가용성 및 안정성

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| NF-AV-01 | SaaS 서비스 가용성 목표: 99.9% uptime | 필수 | ✅ |
| NF-AV-02 | 워크플로우 실행 실패 시 자동 재시도 정책 (설정 가능) | 필수 | ✅ |
| NF-AV-03 | 실행 중 시스템 장애 발생 시 진행 상태 복구 | 필수 | ✅ |
| NF-AV-04 | 헬스 체크 엔드포인트 제공 | 필수 | ✅ |
| NF-AV-05 | 데이터 백업 및 복원 메커니즘 | 필수 | ✅ |
| NF-AV-06 | Graceful Shutdown — 실행 중인 워크플로우 완료 후 종료 | 필수 | ✅ |

---

## 5. 관측성(Observability)

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| NF-OB-01 | 구조화된 로깅 (JSON 형식) | 필수 | ✅ |
| NF-OB-02 | 메트릭 수집 및 모니터링 (Prometheus 호환) | 필수 | ❌ 미구현 (Planned) — 현 백엔드는 OTel **traces-only** (`@opentelemetry/exporter-trace-otlp-http`, `instrumentation.ts`). 메트릭 파이프라인(`@opentelemetry/sdk-metrics`·Prometheus exporter·`prom-client`·`/metrics` 엔드포인트·`MeterProvider`) 부재. 추적: [`plan/in-progress/spec-sync-5-system-metrics-gap.md`](../../plan/in-progress/spec-sync-5-system-metrics-gap.md) |
| NF-OB-03 | 분산 트레이싱 (OpenTelemetry 호환) | 권장 | ✅ (`OTEL_ENABLED=true`로 활성, OTLP HTTP exporter 기본 endpoint `/v1/traces`) |
| NF-OB-04 | 워크플로우 실행 추적 — 각 노드별 실행 시간, 입출력 크기 기록 | 필수 | ✅ |
| NF-OB-05 | 알림(Alert) 설정 — 실패율, 지연 임계값 초과 시 | 권장 | ✅ (룰 CRUD API + `/profile/alerts` UI + `AlertsEvaluatorService` 가 BullMQ repeatable scheduler `*/5 * * * *` (UTC) 로 5분마다 평가 + rule window 단위 cooldown 으로 노티 스팸 방지) |
| NF-OB-06 | 시스템 상태 가시화 — 큐 적체/실패/포화도를 집계 UI 로 노출 (개별 job 미노출). 실패는 최근 윈도우 기준 주 지표 + 누적 보관 부 지표로 병기 | 권장 | ✅ (구현 완료 — `GET /api/system-status/overview` + `/system-status` 페이지. 상세 [16-system-status-api](./16-system-status-api.md), [2-navigation/15-system-status](../2-navigation/15-system-status.md)) |

---

## 6. 국제화 및 접근성

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| NF-I18N-01 | UI 다국어 지원 구조 (i18n) — 한국어, 영어 기본 | 필수 | ✅ |
| NF-I18N-02 | 날짜/시간/숫자 형식의 로케일별 표시 | 필수 | ✅ |
| NF-A11Y-01 | WCAG 2.1 AA 수준 접근성 준수 | 권장 | ✅ — `codebase/frontend/e2e/a11y/smoke.spec.ts` 가 axe 위반 0 을 회귀 강제. semantic landmark, skip-to-main, 페이지 h1, 색 대비 (light/dark `--muted-foreground` 4.5:1+) 모두 정합. |
| NF-A11Y-02 | 키보드 네비게이션 지원 | 필수 | ✅ |
| NF-A11Y-03 | 스크린 리더 호환 | 권장 | 🚧 — 폼 입력 `aria-invalid` + `aria-describedby` 연결, icon-only 버튼 `aria-label`, 장식 아이콘 `aria-hidden`, SlideDrawer Radix `FocusScope` 트랩, 실행 상태 `aria-live="polite"` announce 모두 적용 ✅. macOS VoiceOver 수동 검증 체크리스트는 사용자 수행 대기 — 완료 시 ✅ 로 전환. |

---

## 7. 배포 및 운영

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| NF-DP-01 | Docker 기반 컨테이너화 | 필수 | ✅ |
| NF-DP-02 | Docker Compose를 통한 간편 셀프 호스팅 배포 | 필수 | ❌ |
| NF-DP-03 | Kubernetes Helm Chart 제공 (클러스터 배포) | 권장 | ❌ |
| NF-DP-04 | 환경 변수 기반 설정 관리 | 필수 | ✅ |
| NF-DP-05 | CI/CD 파이프라인 구성 | 필수 | ✅ |
| NF-DP-06 | 셀프 호스팅 설치/운영 문서 | 필수 | ❌ |

---

## 8. AI Agent 영속 메모리 (Agent Memory)

AI Agent 노드 `memoryStrategy: 'persistent'` 의 세션 간 추출/회수 메모리 요구사항. 정의·파이프라인의 단일 진실은 [Spec Agent Memory](./17-agent-memory.md), 노드 설정 필드는 [Spec AI Agent §1](../4-nodes/3-ai/1-ai-agent.md#1-설정-config).

| ID | 요구사항 | 우선순위 | 상태 |
|----|----------|----------|-------|
| AGM-01 | `agent_memory` 테이블 — pgvector 재사용, KnowledgeBase 와 분리된 별도 테이블 ([§1](./17-agent-memory.md#1-데이터-모델)) | 필수 | ✅ |
| AGM-02 | `(workspace_id, scope_key)` 인덱스 + pgvector partial 유사도 인덱스 ([§1](./17-agent-memory.md#1-데이터-모델)) | 필수 | ✅ |
| AGM-03 | 스코프 키 resolve — `memoryKey ?? execution_id`, 항상 `workspace_id` 와 결합 ([§2](./17-agent-memory.md#2-스코프-키)) | 필수 | ✅ |
| AGM-04 | 턴 경계 비동기 추출 — `scheduleBackgroundBody` snapshot 격리 준수, 노드 model 재사용 ([§3](./17-agent-memory.md#3-추출-파이프라인-턴-경계-비동기)) | 필수 | ✅ |
| AGM-05 | 동기 top-k 회수 — `memoryTopK`/`memoryThreshold` (KB 검색과 독립), 안정 프리픽스 주입 ([§4](./17-agent-memory.md#4-회수-top-k-동기--forgetting)) | 필수 | ✅ |
| AGM-06 | Forgetting — scope 당 최신 `N=1000` FIFO/LRU evict (TTL 만료는 v2) ([§4](./17-agent-memory.md#4-회수-top-k-동기--forgetting)) | 필수 | ✅ |
| AGM-07 | 워크스페이스 격리 — 모든 회수·추출·evict 가 `workspace_id` 필터 강제 (cross-workspace 누수 차단) ([§5](./17-agent-memory.md#5-격리-의무)) | 필수 | ✅ |
