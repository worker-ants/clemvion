# Rationale 연속성 검토 — `spec/5-system/` (impl-done, diff-base `origin/main`)

## 발견사항

없음.

본 델타(`spec/5-system/_product-overview.md` NF-OB-07 카탈로그 확장 + `spec/data-flow/1-audit.md`·`spec/data-flow/9-observability.md` 동반 갱신 + 구현 `AuditLogsService`/`BusinessMetricsService`/`auth-configs.service.ts`/AST 가드 3종)을 아래 관점으로 조사했으나 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 어느 것도 발견되지 않았다.

### 확인한 사항 (참고용, 발견사항 아님)

- **이전 라운드(`--spec`, `review/consistency/2026/09/01/15_00_54/rationale_continuity.md`) WARNING 이 이번 diff 에서 해소됨.** 그 WARNING 은 "`resource_type` 라벨의 open-string+clamp 설계가 `9-observability.md` Rationale 의 '닫힌 집합 유지' 원칙과 문면상 어긋나는데, 그 예외가 원칙의 출처 문서(`9-observability.md`)가 아니라 파생 카탈로그(`_product-overview.md`)에만 적혀 있다"는 것이었다. 실제 diff(`git diff origin/main...HEAD -- spec/data-flow/9-observability.md`)를 확인한 결과, `9-observability.md` 의 `## Rationale` § "`clemvion.redis.fail_open` 의 `component` 를 실제 배선된 값만 열거하는 이유" 바로 뒤에 "이 원칙은 코드 유니온이 있는 라벨에 적용된다. 소스 시그니처가 이미 `string` 인 라벨은 … 64자로 클램핑해 같은 목적을 달성한다 — `clemvion.execution.errors` 의 `error_code`, `clemvion.audit.write_failed` 의 `resource_type` 이 그 경우다" 라는 단락이 신규 추가되어 원칙-예외 관계가 원 출처 문서 안에서 완결됐다. 제안된 수정이 실제로 반영된 것을 확인.
- **`AuditActionFor<T>` 로의 타입 강화**(`auth-configs.service.ts`: `AuditAction` → `AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>`)는 `spec/data-flow/1-audit.md` Rationale § "Action 은 application union 으로 강제" 원칙(action 오표기를 application 타입으로 막는다)을 약화가 아니라 강화하는 방향이다. 자매 helper 4개(triggers/workflows/schedules/model-config)가 이미 `AuditActionFor<T>` 를 쓰고 있음을 실측 확인(`grep "action: AuditActionFor"`) — "auth_config 만 예외였다"는 diff 내 주석의 주장과 일치.
- **`recordAudit` 공통 팩토리 추출 won't-do 결정**(`plan/in-progress/spec-sync-auth-gaps.md`, `CHANGELOG.md`)은 spec 의 `## Rationale`이나 `spec/conventions/audit-actions.md` 어디에도 "공통 팩토리를 추출해야 한다"는 합의 원칙이 없어, 번복이 아니라 최초 결정이다. 결정 자체에 새 근거(판별 프로브 tsc 0-error vs TS2322 대조군, AST 가드 대체)가 함께 기록되어 있어 원칙 §3(무근거 번복 금지) 기준을 충족.
- **"실측 12종" `resource_type` 값 주장**(`business-metrics.service.ts` JSDoc, `spec/5-system/_product-overview.md` NF-OB-07 표)을 코드 전수 grep 으로 검증 — `workflow/execution/user/trigger/workspace/member/workspace_invitation/integration/schedule/alert_rule/model_config/auth_config` 12종으로 정확히 일치.
- **swallow 계약**(`spec/data-flow/1-audit.md` Rationale § "기록 실패는 삼키고, 호출은 await 한다")은 이번 diff 에서 그대로 유지된다 — 카운터 도입 이후에도 `record()` 는 throw 하지 않고, 관측 호출(`this.metrics?.recordAuditWriteFailed`) 자체도 `try/catch` 로 삼켜 "관측이 새 실패 경로가 되면 안 된다"는 동일 chokepoint 원칙을 스스로 재천명·준수한다.
- **`login_history` vs `audit_log` 관측 비대칭**을 `spec/data-flow/1-audit.md` 에 명시적으로 드러내고("이 비대칭은 의도적으로 드러내 둔다") `plan/in-progress/spec-sync-auth-gaps.md` 에 후속 트랙으로 등재한 처리는, MEMORY 의 "Rationale 기각된 대안은 실제 이력 필수" 원칙과 부합 — `plan/complete/spec-draft-audit-write-failed-metric.md` §Rationale "기각한 대안"에 "login_history 도 카운터를 붙여 서술을 다시 묶는다"를 실제로 검토 후 범위 밖으로 명시 기각한 이력이 존재.

## 요약

이번 델타는 `clemvion.audit.write_failed` 카운터 신설과 `auth-configs.service.ts` 의 audit action 타입 강화, 그리고 이를 검사하는 AST 가드 도입을 다룬다. 세 spec 문서(`5-system/_product-overview.md`, `data-flow/1-audit.md`, `data-flow/9-observability.md`) 모두 기존 Rationale의 핵심 원칙(swallow 계약 유지, action union 강제, 카탈로그 표 동시 확장 규칙, 닫힌 라벨 vs 클램핑 방어 구분)을 그대로 따르거나 강화하며, 특히 직전 `--spec` 라운드에서 지적된 "원칙-예외 교차 참조 누락" WARNING이 이번 diff의 `9-observability.md` Rationale 갱신으로 실제 해소되었음을 확인했다. `recordAudit` 공통 팩토리 won't-do 전환은 스스로 합의를 뒤집을 만한 선행 spec 원칙이 없었던 최초 결정이며 충분한 근거(프로브 대조군)를 남겼다. Rationale 연속성 관점에서 CRITICAL·WARNING 성격의 결함은 발견되지 않았다.

## 위험도
NONE
