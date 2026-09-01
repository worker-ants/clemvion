# 정식 규약 준수 검토 — `spec/5-system/` (audit-record-factory, impl-done)

## 검토 범위

- **scope 델타**: `spec/5-system/_product-overview.md` (NF-OB-07 메트릭 카탈로그에 `clemvion.audit.write_failed` 행 추가)
- **연관 구현 diff** (`origin/main...HEAD`): `codebase/backend/src/modules/audit-logs/audit-logs.service.ts`, `.../metrics/business-metrics.service.ts`, `.../auth-configs/auth-configs.service.ts`, `codebase/backend/src/repo-guards/__tests__/audit-action-binding-{guard,fixture,spec}.ts` 등
- **대조한 정식 규약**: `spec/conventions/audit-actions.md` (액션 명명 규약), `spec/data-flow/9-observability.md`(라벨링 원칙, scope 밖이지만 target 과 동일 결정을 서술해 대조군으로 사용), CLAUDE.md 문서 구조 컨벤션

## 발견사항

- **[WARNING] "실측 12종" 라벨 카디널리티 주장이 실제 값과 다르다 — 정확한 값은 10종**
  - target 위치: `spec/5-system/_product-overview.md` §5 "NF-OB-07 메트릭 카탈로그" 표, `clemvion.audit.write_failed` 행 — "`resource_type` (감사 대상 리소스 종류 — 코드가 정하는 값, **실측 12종**. 소스 시그니처가 `string` 이라 64자 클램핑으로 방어)"
  - 위반 규약: `spec/conventions/audit-actions.md` §3 "도메인별 분류 레지스트리" (구현된 resource 카탈로그의 SoT) — 이 표와 실제 코드가 합의하는 resource 종류 수와 target 문서의 "실측" 주장이 불일치한다. 직접적으로는 명명 규약 조항이 아니라, target 문서 자신이 "구현이 실제로 지켜지는 방어"를 근거로 클램핑 방식을 정당화하면서 그 근거 수치(실측치)를 틀리게 적은 것 — 정식 문서에 **검증 가능한 서술을 틀리게 실은 것**이다.
  - 상세: `AuditLogsService.record()`/`recordAudit()` 를 호출하는 실제 호출부를 코드에서 전수 확인했다(`AuditLogsService` 를 참조하는 모든 파일에서 `resourceType` 인자를 추적).
    - 호출부: `auth.controller.ts`(user), `webauthn.controller.ts`(user), `users.controller.ts`(user), `triggers.service.ts`(trigger), `workflows.service.ts`(workflow), `schedules.service.ts`(schedule), `workspace-invitations.service.ts`(member), `workspaces.service.ts`(workspace, member), `integrations.service.ts`(integration), `model-config.service.ts`(model_config), `auth-configs.service.ts`(auth_config), `executions.service.ts`(execution) — **호출부 파일은 12개**이지만 **서로 다른 `resourceType` 값은 10개**(`user`/`trigger`/`workflow`/`schedule`/`member`/`workspace`/`integration`/`model_config`/`auth_config`/`execution`)다.
    - 이 10종은 `spec/conventions/audit-actions.md` §3 레지스트리 표(resource 컬럼: integration/user/auth_config/execution/workspace/member/workflow/trigger/schedule/model_config = 10개)와 `spec/5-system/1-auth.md §4.1` "현재 구현된 액션" 표(같은 10개 카테고리)에도 그대로 일치한다 — 즉 정식 규약·카탈로그 문서 두 곳 모두 10을 가리키는데, target 문서만 12를 주장한다.
    - "12" 는 `resourceType` 의 종류 수가 아니라 **`AuditLogsService.record()`/`recordAudit()` 를 호출하는 소스 파일 개수**와 우연히 일치한다 — 카운트 대상을 착각한 것으로 보인다(파일 수 vs 라벨 distinct 값 수).
    - 이 부정확한 "실측 12종" 문구는 target 문서 1곳에 그치지 않고 같은 PR 안에서 **4곳에 전파**됐다: `spec/5-system/_product-overview.md`(target, scope 내) · `codebase/backend/src/modules/metrics/business-metrics.service.ts:174`(JSDoc) · `plan/in-progress/spec-sync-auth-gaps.md`("실측 12종으로 유계") · `plan/complete/spec-draft-audit-write-failed-metric.md:48,122`. 네 곳 모두 같은 오기산을 반복하고 있어 단순 오탈자가 아니라 최초 산출 단계의 계산 오류가 그대로 복제된 것으로 보인다.
    - **invariant 파급은 제한적이다** — grep 결과 어떤 테스트도 `12` 라는 수치를 단언하지 않고, 클램핑(64자) 방어 메커니즘 자체는 종류 수와 무관하게 동작하므로 코드 동작에는 영향이 없다. 따라서 CRITICAL 이 아니라 WARNING 으로 분류한다 — 다만 "실측"이라는 표현이 검증 가능한 주장임을 스스로 강조하고 있어(및 이 문서군이 반복적으로 "측정 시점 재검증"을 규약화하고 있는 관례에 비추어) 방치하면 다음 사람이 이 수치를 근거로 다른 결정(예: 유니온 전환 시점 판단)을 내릴 수 있다.
  - 제안: target 문서의 "실측 12종"을 "실측 10종"으로 정정하고, 같은 문구가 실린 나머지 3곳(`business-metrics.service.ts` JSDoc, `spec-sync-auth-gaps.md`, `spec-draft-audit-write-failed-metric.md`)도 함께 정정한다. 정정 시 카운트 근거(호출부 10종 목록)를 주석/각주로 남기면 동일한 착오(파일 수 vs distinct 라벨 값 수)의 재발을 막을 수 있다.

## 그 외 확인한 항목 (위반 없음)

- **명명 규약**: `clemvion.audit.write_failed`(dot 표기, Prometheus `clemvion_*` sanitize 규칙), `resource_type` 라벨명(snake_case) 모두 기존 카탈로그 항목(`clemvion.redis.fail_open` 등)과 패턴이 일치한다. `AuditActionFor<P>` 제네릭 타입명, `PROMETHEUS_LABEL_MAX_LEN` 상수명도 기존 컨벤션과 충돌 없음.
- **출력 포맷 규약**: 새 테이블 행이 "메트릭 | 종류 | 라벨 | 의미" 4열 구조를 그대로 따르고, "라벨을 닫는 방법은 둘이다"(타입 유니온 vs 클램핑) 원칙은 `spec/data-flow/9-observability.md` Rationale 신설분과 상호 참조가 정확히 걸려 있다.
- **문서 구조 규약**: `_product-overview.md`(CLAUDE.md 지정 파일명), `0-` prefix 등 명명 컨벤션 위반 없음. 변경분은 기존 `### NF-OB-07 메트릭 카탈로그` 절 내부에 삽입되어 Overview/본문/Rationale 구조를 새로 어지럽히지 않는다.
- **API 문서 규약(swagger 등)**: 본 diff 는 신규 DTO·엔드포인트를 포함하지 않아 해당 없음.
- **금지 항목**: `AUDIT_ACTIONS` 인라인 문자열 금지 규약 위반 없음(신규 action 미추가). 매직넘버(64자 클램핑 상한)를 `PROMETHEUS_LABEL_MAX_LEN` 상수로 중앙화해 종전 산재 문제를 스스로 해소했다 — conventions 관점에서 개선.
- `auth-configs.service.ts` 의 `AuditAction`→`AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>` 전환은 `audit-actions.md` 가 요구하는 "resource 에 묶인 타입" 원칙을 더 엄격히 구현한 것으로, 규약 강화 방향과 일치한다.

## 요약

target 스코프(`spec/5-system/_product-overview.md`)의 델타는 NF-OB-07 메트릭 카탈로그에 `clemvion.audit.write_failed` 항목 하나를 추가하는 것으로, 메트릭 명명·테이블 포맷·클램핑 방어 원칙(`spec/data-flow/9-observability.md`)·감사 액션 명명 규약(`spec/conventions/audit-actions.md`) 모두와 정합적이다. 다만 그 표 항목이 근거로 내세우는 "`resource_type` 실측 12종"이라는 수치는 코드 전수 확인 결과 실제로는 10종이며, 동일한 오기산이 코드 JSDoc·in-progress plan·complete plan 등 3곳에 더 전파되어 있다. 규약 위반이라기보다 target 문서 자체의 검증 가능한 사실 진술 오류이지만, 어떤 테스트도 그 수치에 의존하지 않아 invariant 파급은 없다.

## 위험도
LOW
