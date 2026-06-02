# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/system-status-page.md` (spec draft — 변경 A~E)
검토 모드: `--spec`
검토일: 2026-06-03

---

## 발견사항

### 발견사항 없음 (NONE)

분석 범위의 모든 관련 spec Rationale 을 대조한 결과, target draft 가 기존에 명시적으로 기각된 대안을 재도입하거나 합의된 설계 원칙을 무시하는 사례를 발견하지 못했다.

세부 검토 내용은 아래와 같다.

---

### 1. 개별 job 미노출 — Rationale 신규 작성 정합 확인

target spec `spec/5-system/16-system-status.md § Rationale R-1` 은 개별 job 을 노출하지 않는 이유를 명시적으로 기술한다. 이는 기존 어떤 spec Rationale 과도 충돌하지 않으며 신규 결정의 근거 기술이 올바르게 이루어졌다.

### 2. throughput 시계열 v1 제외 — 기존 Rationale 와 정합 확인

spec draft `R-2` 는 throughput 시계열을 v1 에서 제외하는 이유로 `BullMQ metrics`(per-job 오버헤드)·샘플링 cron(별도 구성요소)을 명시했다. 기존 spec 에 throughput 시계열에 관한 결정이 없었으므로 새 Rationale 을 작성한 것은 올바른 절차다.

기존 `spec/5-system/4-execution-engine.md Rationale "DLQ 모니터링 — 로그 기반 알람 선택"` 에서 OTel metrics SDK 도입을 현 단계에서 과도하다고 기각한 원칙과 방향이 일치한다 (metrics 파이프라인 부재 상태에서 추가 수집 인프라를 도입하지 않음).

### 3. admin role 가드 불필요 판단 — 기존 RBAC 원칙 정합 확인

target draft 는 "집계 카운트만 반환하므로 워크스페이스 식별 불가 → admin role 가드 불필요" 를 명시하고, NAV-UG-05(User Guide 전원 노출)와 같은 노출 모델임을 기술한다.

`spec/5-system/1-auth.md §3.1 RBAC` 의 역할별 권한 매트릭스에는 Statistics 가 모든 역할(Owner/Admin/Editor/Viewer)에 R 로 허용되어 있다. 시스템 집계 카운트는 Statistics 보다 더 민감하지 않은 집계 데이터이므로 로그인 사용자 전원 노출 판단이 기존 RBAC 정책 방향과 부합한다.

`spec/2-navigation/_product-overview.md NAV-UG-05` 는 "모든 로그인 사용자에게 사이드바 메뉴로 노출" 이 이미 확립된 패턴이므로, 이를 System Status 의 동일 노출 근거로 인용하는 것은 올바른 선례 적용이다.

### 4. `/queue-monitor` 경로 명명 — API 컨벤션 Rationale 충돌 없음

`spec/5-system/2-api-convention.md` 의 Rationale 는 케밥 케이스·복수형 명사·중첩 2단계 이하 원칙을 정의하며, `/api/queue-monitor/overview` 는 이 원칙 범위 안에 있다. 과거 기각된 경로 명명 결정은 없다.

명명 관련 보완 제안: `queue-monitor` 는 리소스가 아닌 관리 기능 명칭이라 api-convention §2.2 "리소스는 복수형 명사" 원칙과 의미적 거리가 있다. 그러나 이는 기존 Rationale 에서 명시 기각된 사항이 아니며, `/api/health`, `/api/statistics` 등 기존 선례들이 동일하게 기능 명칭을 경로로 사용하는 관행 안에서 일관성이 유지된다. 충돌 아님.

### 5. React Query 폴링 패턴 — 기존 통계 화면 패턴 상속 확인

target spec `spec/2-navigation/15-system-status.md Rationale` 는 "구조·인증·`{data}` 추출·폴링 패턴은 기존 통계 화면(7-statistics.md)을 그대로 따른다" 고 명시한다. `spec/2-navigation/7-statistics.md` 에는 별도 Rationale 절이 없으나 구현된 패턴을 재사용하는 것은 일관성 원칙에 부합한다.

### 6. `{data}` 래핑 컨벤션 준수 확인

`spec/5-system/2-api-convention.md §5.1 단일 리소스` 와 api-convention Rationale §11 이 전역 `TransformInterceptor` 의 `{ data: ... }` 래핑을 명확히 정의한다. target draft API 응답 형식 `{ data: SystemStatusOverviewDto }` 가 이를 준수한다.

### 7. 메뉴 순서 변경 (C·D) — 기존 번호 계획 충돌 없음

target draft 변경 C 는 Statistics(9)와 User Guide(10) 사이에 System Status(10)를 삽입하고 기존 10·11·12번을 재번호한다. `spec/2-navigation/_layout.md §2.2` 의 Rationale 에는 메뉴 순서 삽입을 기각한 결정이 없으며, 기존 NAV-MP-*, NAV-UG-* 등 ID 는 변경 없이 섹션 번호만 이동함을 명시해 Rationale 연속성이 유지된다.

---

## 요약

target draft(system-status-page plan 의 spec 변경 A~E)는 기존 spec Rationale 에서 명시적으로 기각된 대안을 재도입하거나, 합의된 설계 원칙(RBAC, API 컨벤션, `{data}` 래핑, BullMQ/Redis 채택 원칙, 메뉴 구조 원칙)을 위반하지 않는다. 신규 결정(개별 job 미노출, throughput 시계열 v1 제외, health 파생 휴리스틱)에 대한 Rationale 이 spec draft 내에 각각 R-1·R-2·R-3 으로 작성되어 있어 결정의 무근거 번복 또는 암묵적 가정 충돌도 발견되지 않는다. Rationale 연속성 관점에서 위험도는 NONE 이다.

---

## 위험도

NONE
