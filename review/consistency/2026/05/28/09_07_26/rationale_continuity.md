# Rationale 연속성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전, scope=`spec/`)
검토 일시: 2026-05-28
대상 변경: `integration-activity-api-label` — `IntegrationUsageLog` 에 `api_label`/`api_method`/`api_path` 3컬럼 추가 + `GET /api/integrations/services/:type/catalog` 신설 + §4.6 Recent activity 탭 재구성

---

## 발견사항

### [WARNING] §4.6 테이블에서 `Workflow`/`Node` 컬럼 제거 — Rationale 부재

- **target 위치**: `spec/2-navigation/4-integration.md §4.6 Recent activity 탭` (diff 의 테이블 교체 부분)
- **과거 결정 출처**: `spec/2-navigation/4-integration.md §4.6` 기존 본문 (main 브랜치). 기존 table schema 는 `At | Workflow | Node | ✓/✗ | ms` 5컬럼이었으며 실제 호출된 워크플로우 이름과 노드 이름을 명시적으로 노출하는 것이 설계의 일부였다.
- **상세**: 신규 table schema 는 `At | API | Status | Duration | Error` 로 재편되어 `Workflow` 와 `Node` 컬럼이 완전히 제거되었다. 이 두 컬럼은 이전 spec 에서 의도적으로 포함된 항목이고, 해당 컬럼을 제거하기로 결정한 Rationale 가 어디에도 서술되어 있지 않다. 신규 Rationale (`### 활동 로그 API 식별 — 3컬럼 (label/method/path) + catalog endpoint 신설`) 은 3컬럼 추가의 이유만 설명할 뿐 기존 `Workflow`/`Node` 컬럼 제거의 trade-off 를 다루지 않는다.
  - `ActivityItem` shape (§9.3) 에 `workflowId: UUID?` 는 포함되어 있으나, 테이블 UI 상에서 Workflow 이름을 표시하는 컬럼이 사라졌다는 사실은 "어느 워크플로우에서 이 통합이 호출됐는가" 라는 진단 정보를 사용자가 잃는다는 의미다.
  - `data-flow/5-integration.md §2.1` 의 schema 매핑 표는 `workflow_id` 를 `integration_usage_log` 의 기록 컬럼으로 열거하는데, UI 상 노출이 사라진 경위는 본 PR 어느 spec 파일에도 설명되지 않는다.
- **제안**: `spec/2-navigation/4-integration.md ## Rationale` 의 `활동 로그 API 식별` 항에 "기존 `Workflow | Node` 컬럼 제거 이유 (예: 공간 제약, 새 `API` 컬럼과의 우선순위 충돌, `Execution detail →` 링크로 충분한지 여부)"를 명시적으로 추가한다. 또는 `Workflow`/`Node` 정보를 `API` 컬럼 subtext 나 팝오버에 보조 노출하는 방안을 검토해 기존 진단 정보의 접근성을 보전한다.

---

### [WARNING] `data-flow/5-integration.md` 의 `integration_usage_log` INSERT 명세가 갱신되지 않음

- **target 위치**: `spec/data-flow/5-integration.md §1.3 sequence diagram` (변경 없음 — 본 PR diff 에 미포함) 및 `§2.1 Schema 매핑 표`
- **과거 결정 출처**: `spec/data-flow/5-integration.md §1.3` — 현재 diagram 은 `INSERT integration_usage_log (integration_id, node_execution_id, workflow_id, status='success', duration_ms, at)` 로 3 신규 컬럼 (`api_label`, `api_method`, `api_path`) 를 포함하지 않는다. `§2.1 Schema 매핑 표` 역시 `integration_usage_log` 의 `read/write 컬럼` 열이 갱신되지 않아 기존 컬럼 목록만 나열한다.
- **상세**: 본 PR 는 `spec/1-data-model.md §2.10.1` 과 `spec/4-nodes/4-integration/0-common.md §4.1`, 각 노드 spec 의 Usage 로깅 절, `spec/2-navigation/4-integration.md §9.3` 를 정합화했다. 그러나 `spec/data-flow/5-integration.md` 는 수정 대상에서 빠졌다. `data-flow/5-integration.md` 는 이 프로젝트의 SoT 중 하나(sequence diagram + schema 매핑)로서 `integration_usage_log` INSERT 명세를 독자적으로 정의하고 있어, 신규 3컬럼이 반영되지 않으면 data-flow spec 과 data-model spec 이 drift 상태가 된다.
  - 과거 결정: 데이터 흐름을 한 곳에서 진실로 관리한다는 `spec/data-flow/` 의 단일 진실 원칙이 CLAUDE.md 에 명시되어 있다.
- **제안**: `spec/data-flow/5-integration.md §1.3` 의 sequence diagram INSERT 줄에 `api_label?, api_method?, api_path?` 를 추가하고, `§2.1 Schema 매핑 표` 의 `integration_usage_log` 행 `read/write 컬럼` 열에 세 컬럼을 보강한다. 본 PR 범위에 포함하거나 follow-up 항목으로 등록한다.

---

### [INFO] `http_request` 노드의 `authentication === 'integration'` 조건과 `api_method`/`api_path` 채우기 정책 간 간극

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md §4.3 활동 로그 API 식별 정보`
- **과거 결정 출처**: `spec/2-navigation/4-integration.md §14.1 핸들러별 usage 기록 시점` — "`http_request`: `authentication === 'integration'`인 경우에만 기록 (None/Custom은 Usage 대상 아님)"
- **상세**: 기존 결정은 http-request 의 logUsage 호출 자체를 `authentication === 'integration'` 조건에 한정한다. 신규 §4.3 은 이 조건 언급 없이 `api_method`/`api_path` 채우기 정책을 서술한다. 논리적으로는 이미 logUsage 를 호출하지 않는 케이스에선 `api_*` 도 기록되지 않으니 충돌은 없지만, 독자가 §4.3 만 보면 "모든 HTTP Request 호출에서 `api_method`/`api_path` 가 기록된다" 고 오해할 여지가 있다.
- **제안**: `spec/4-nodes/4-integration/1-http-request.md §4.3` 도입부에 "logUsage 가 호출되는 경우(`authentication === 'integration'`) 에 한해 아래 `api` 식별 정보도 동반한다" 는 한 줄 조건을 명시한다.

---

### [INFO] catalog endpoint 의 workspace 격리 없음 — 기존 API 격리 원칙과의 관계 미서술

- **target 위치**: `spec/2-navigation/4-integration.md §9.3` 신규 `GET /api/integrations/services/:type/catalog` 항목 — "모든 인증된 요청에서 접근 가능, workspace 격리 없음 (메타데이터는 동일 응답)"
- **과거 결정 출처**: `spec/5-system/2-api-convention.md` (general API convention) 및 `spec/0-overview.md §5 배포 환경 분리` — 멀티 테넌트 SaaS 환경에서 workspace 격리는 API 레벨의 기본 원칙으로 취급된다.
- **상세**: catalog endpoint 는 메타데이터라는 이유로 workspace 격리를 명시적으로 면제한다. 이 결정 자체는 합리적이나 기존 격리 원칙과의 관계 및 "workspace 격리 면제를 허용하는 조건"이 spec 어디에도 명문화되어 있지 않다. 예를 들어 미래에 workspace별 커스텀 catalog 나 통합별 ACL 이 요구될 때, 이 면제 결정이 재검토 없이 그대로 남을 위험이 있다.
- **제안**: 신규 Rationale 항목 또는 §9.3 footnote 에 "catalog 는 시스템 전역 정적 메타데이터이므로 workspace 격리 불필요 — 향후 workspace별 커스텀 catalog 요구 시 본 면제는 재검토 대상"을 한 줄 덧붙인다.

---

## 요약

본 PR 의 핵심 설계 결정 (3컬럼 분리, i18n 책임 frontend 이전, catalog key 영속화, PII 보호 정책) 은 모두 신규 Rationale 에 충실히 서술되어 있고, 기존 Rationale 에서 명시적으로 기각된 대안을 무근거로 재도입하거나 합의된 invariant 를 직접 위반하는 사례는 발견되지 않았다. 다만 기존 §4.6 테이블에 있던 `Workflow`/`Node` 컬럼이 제거되면서 그 결정의 trade-off 가 Rationale 에 기록되지 않아 — 의도적 번복인지 단순 누락인지 — 독자 입장에서 불명확하다. 또한 `spec/data-flow/5-integration.md` 의 sequence diagram 과 schema 매핑이 갱신되지 않아 data-flow spec 과 data-model spec 사이에 drift 가 발생한다. 두 사항 모두 구현 착수 전 Rationale 보강 또는 data-flow spec 갱신으로 해소하는 것이 바람직하다.

---

## 위험도

MEDIUM
