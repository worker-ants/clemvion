# Cross-Spec 일관성 검토 결과

대상: `spec/2-navigation/6-config.md` (--impl-prep)
검토 시각: 2026-06-14

---

## 발견사항

- **[WARNING]** §A.3 `totalCalls` / `recentCalls` 의 데이터 모델 근거 누락
  - target 위치: `spec/2-navigation/6-config.md §A.3` — "총 호출 수 (`totalCalls`) ✅", "호출 이력 테이블 (`recentCalls`) ✅"
  - 충돌 대상: `spec/1-data-model.md §2.17 AuthConfig` — `last_used_at` 외 호출 집계용 컬럼·테이블 정의 없음. `spec/1-data-model.md §2.10.1 IntegrationUsageLog` — Integration 도메인은 전용 `IntegrationUsageLog` 엔티티를 두고 `totalCalls` / `recentCalls` 를 이 테이블 집계로 제공하는 반면, AuthConfig 도메인에는 동등한 로그 엔티티가 정의되지 않음
  - 상세: `§A.3` 표는 `totalCalls` 와 `recentCalls(triggerName/status/startedAt)` 를 구현됨(✅)으로 기술한다. 그런데 `spec/1-data-model.md` 에는 AuthConfig 호출 로그 전용 테이블이 없다. `Execution` / `NodeExecution` 은 워크플로 실행 단위이며 `auth_config_id` FK 가 없어 "이 인증 설정으로 실행된 트리거들의 실행 수"를 집계하려면 `trigger.auth_config_id → trigger_id → execution.trigger_id` 조인이 필요하다. 현재 구현은 이 조인으로 파생 집계하는 것으로 추정되지만, 데이터 모델 spec 에 집계 경로·보존 정책·인덱스가 기술되지 않아 구현과 spec 간 경계가 모호하다. `IntegrationUsageLog(§2.10.1)` 와 달리 AuthConfig 쪽은 SoT 엔티티가 없으므로, 향후 "소스 IP"·"기간별 호출 수" 등 추가 컬럼 결정 시 어느 테이블에 쓰는지 결정 근거가 없다.
  - 제안: `spec/1-data-model.md` 에 "AuthConfig 호출 집계 경로" 절을 추가하거나(`Execution.trigger_id → Trigger.auth_config_id` 조인 집계를 SoT 로 명시), 또는 `IntegrationUsageLog` 와 같은 전용 로그 엔티티(`AuthConfigCallLog` 등)를 도입해 §A.3 의 ✅ 항목이 참조할 수 있는 데이터 모델 근거를 확보한다. 구현이 이미 조인 집계로 동작 중이라면 그 계산식·쿼리 범위를 data-flow 또는 데이터 모델 Rationale 에 기록해 spec-impl 정합성을 유지한다.

- **[WARNING]** §A.3 미구현 항목(소스 IP·응답 코드·기간별 호출 수)의 데이터 모델이 data-model.md 에 부재
  - target 위치: `spec/2-navigation/6-config.md §A.3` — "소스 IP·응답 코드 컬럼은 미구현 / Planned", "기간별 호출 수 🚧 Planned"
  - 충돌 대상: `spec/1-data-model.md §2.13 Execution`, `§2.14 NodeExecution`, `§2.17 AuthConfig` — 소스 IP 저장 컬럼 없음. `plan/in-progress/spec-sync-config-gaps.md` — "스키마(컬럼/별도 call-log) + 캡처 경로 결정 선행"·"HTTP code vs status enum + 스키마 결정 선행"·"표시형식 결정 선행"으로 명시 미결
  - 상세: §A.3 이 "소스 IP" 컬럼·"응답 코드" 컬럼·"기간별 호출 수"를 'Planned' 로 기술하나, 이를 저장할 데이터 모델(신규 컬럼 또는 신규 테이블)이 `spec/1-data-model.md` 에 없다. 현재 `Execution` 테이블에는 `ip_address` 컬럼이 없고, `AuthConfig` 에도 `last_used_at` 만 있다. 구현 착수 전 스키마 결정이 필요한 상태가 spec 에만 '미구현' 태그로 기록돼 있고 데이터 모델 영역과 동기화되지 않았다.
  - 제안: `plan/in-progress/spec-sync-config-gaps.md` 에 기재된 3가지 미결 결정(소스 IP 스키마·응답 코드 의미·기간 표시형식)을 project-planner 를 통해 먼저 확정한 뒤, 그 결정을 `spec/1-data-model.md` 에 반영(신규 컬럼 또는 신규 로그 테이블 정의)하고 `6-config.md §A.3` 을 업데이트해야 한다. 현재 `spec/2-navigation/6-config.md` 의 `pending_plans` frontmatter 가 이미 `spec-sync-config-gaps.md` 를 참조하고 있어 추적은 올바르게 되어 있으나, 데이터 모델 동기화가 선행 조건임을 명시적으로 표시할 필요가 있다.

- **[INFO]** `GET /api/auth-configs/:id/usage` 엔드포인트 응답 shape 명세 부재
  - target 위치: `spec/2-navigation/6-config.md §3 Authentication API` — `GET /api/auth-configs/:id/usage` 행
  - 충돌 대상: `spec/2-navigation/4-integration.md §9 API` — `GET /api/integrations/:id/activity` 는 응답 shape `{ items: ActivityItem[], summary: { totalCalls, successRate, dailyCounts[] } }` 와 `ActivityItem` 필드를 명시. `spec/5-system/2-api-convention.md §5.2` — 목록 응답 형식 표준
  - 상세: Integration 도메인의 `/activity` 엔드포인트는 응답 shape 과 `ActivityItem` 필드 정의가 spec 에 상세히 기술된다. 반면 `auth-configs/:id/usage` 엔드포인트는 "사용량/이력 조회" 한 줄만 있고 응답 schema(`totalCalls`, `recentCalls` 각 필드 타입·페이지네이션 여부)가 명시되지 않았다. §A.3 표의 `recentCalls` 에서 `triggerName/status/startedAt` 만 언급되지만 이것이 응답 DTO 계약인지 현재 구현 상태 설명인지 불분명하다.
  - 제안: `6-config.md §3 Authentication API` 표에 `/usage` 응답 shape 를 `4-integration.md §9` 수준으로 명시하거나, §A.3 표에 현재 응답 DTO 필드를 명확히 기재한다. 특히 목록 형식인 경우 `§5.2` 페이지네이션 규약 준수 여부를 명시한다.

- **[INFO]** `spec/5-system/1-auth.md §5 API 엔드포인트` 표에 `/reveal` 행 누락
  - target 위치: `spec/2-navigation/6-config.md §3 Authentication API` — `POST /api/auth-configs/:id/reveal` 행
  - 충돌 대상: `spec/5-system/1-auth.md §5 API 엔드포인트` — `reveal` 이 §3.2 권한 매트릭스와 Rationale 에만 언급되고 §5 엔드포인트 표에 행이 없음. (이미 `plan/in-progress/auth-config-webhook-followups.md §3` 에서 planner 위임 사항으로 기록됨)
  - 상세: `6-config.md` 의 `/reveal` 은 `1-auth.md §3.2` 와 일관되게 Admin+ 권한·audit 기록이 기술돼 있다. 그러나 `1-auth.md §5 API 엔드포인트` 표에는 이 경로가 없어, auth spec 을 신규 개발자가 단독으로 읽으면 엔드포인트 존재를 모른다.
  - 제안: `1-auth.md §5` 표에 `POST /api/auth-configs/:id/reveal` 행을 추가한다 (`6-config.md` 를 SoT 로 참조하는 형태). `auth-config-webhook-followups.md §3` 의 기존 추적 항목에 포함돼 있으므로 중복 생성 불요.

---

## 요약

`spec/2-navigation/6-config.md` 는 전체적으로 다른 영역 spec 과 RBAC·API 계약 측면에서 일관성을 유지한다. `1-auth.md §3.2` 권한 매트릭스(Auth Config CRUD=Admin+, Reveal=Admin+, Model Config CRUD=Editor+)와 `6-config.md §3` 의 권한 기술이 일치하고, 마스킹 정책의 단일 진실도 `1-data-model.md §2.17.2` 로 올바르게 위임된다. 직접 기능 모순은 없다. 주요 갭은 **§A.3 의 '구현됨' 항목(`totalCalls`·`recentCalls`)의 데이터 모델 근거가 `spec/1-data-model.md` 에 없다**는 점이다 — Integration 도메인은 `IntegrationUsageLog` 엔티티로 명확히 SoT 를 두는 반면, AuthConfig 호출 집계는 어느 테이블/쿼리를 SoT 로 보는지 데이터 모델 spec 에 기술되지 않았다. 이것이 향후 "소스 IP"·"응답 코드"·"기간별 호출 수" Planned 항목 구현 시 스키마 결정을 어렵게 만드는 근본 원인이다. 구현 착수 전 이 집계 경로를 `spec/1-data-model.md` 에 명시하거나 전용 로그 엔티티 도입을 결정하는 것이 권장된다.

---

## 위험도

MEDIUM
