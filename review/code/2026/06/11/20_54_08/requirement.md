# 요구사항(Requirement) 코드 리뷰

리뷰 대상: `AUDIT_ACTIONS` 상수 도입 + `re_run_initiated` → `execution.re_run` 개명 (cross-audit G-01·G-02)

---

## 발견사항

### - **[INFO]** `AUDIT_ACTIONS` 에 누락된 Planned action 은 의도된 상태
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/audit-logs/audit-action.const.ts` 전체
  - 상세: 파일 헤더 JSDoc 이 "Planned 액션(`workflow.*`·`trigger.*`·`schedule.*`·`member.*`·`llm_config.*`·`rerank_config.*`·`password_change`·`2fa_*`)은 미구현" 이라 명시하고, spec/5-system/1-auth.md §4.1 및 spec/data-flow/1-audit.md §1.1 도 동일 갭을 공식 추적 중이다. 현재 const 는 구현된 9종만 포함하며 spec 과 일치한다.
  - 제안: 변경 없음. Planned action 추가 시 이 파일에 추가하면 union 이 자동 확장된다.

### - **[INFO]** `AuditLogDto.action` 타입이 여전히 `string` (좁히지 않음)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts` L302
  - 상세: 응답 DTO 의 `action: string` 은 DB 에서 읽어오는 값이라 런타임에 `AuditAction` union 으로 좁히기 어렵고, OpenAPI 출력에서도 문자열이 자연스럽다. 타입 안전성 강화가 필요하다면 별도 티켓이나 `@IsIn(Object.values(AUDIT_ACTIONS))` 형태의 검증이 가능하지만, 현재 변경 범위(인라인 문자열 → 상수 교체)에서 벗어나므로 INFO 로 기록한다.
  - 제안: 즉각 수정 불필요. 향후 audit log 조회 API 검증 강화 시 `AuditAction` 좁히기 고려.

### - **[INFO]** `executions-rerun.service.spec.ts` L1244 — `warnSpy` 가 `console.warn` 을 spy 하나 서비스 내부는 `Logger.warn` 을 사용
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/executions/executions-rerun.service.spec.ts` L1243
  - 상세: `audit-logs.service.ts` 의 실패 swallow 경로는 `this.logger.warn(...)` (`NestJS Logger`)를 사용한다. 테스트는 `console.warn` 을 spy 하지만 `NestJS Logger` 는 내부적으로 `console` 을 래핑할 수 있어 환경에 따라 spy 가 검증을 못 할 수 있다. 단, 해당 spy 의 목적은 테스트 출력 억제일 뿐이며 `expect(warnSpy).toHaveBeenCalled()` 같은 검증 어서션은 없으므로 테스트 실패로 이어지지 않는다.
  - 제안: 변경 불필요. 출력 억제 목적이면 현재 코드 유지.

---

## Spec Fidelity 점검

### spec/5-system/1-auth.md §4.1 "현재 구현된 액션" 표

| spec 표 항목 | `AUDIT_ACTIONS` const 값 | 일치 |
|---|---|---|
| `integration.created` | `INTEGRATION_CREATED: 'integration.created'` | 일치 |
| `integration.updated` | `INTEGRATION_UPDATED: 'integration.updated'` | 일치 |
| `integration.deleted` | `INTEGRATION_DELETED: 'integration.deleted'` | 일치 |
| `integration.rotated` | `INTEGRATION_ROTATED: 'integration.rotated'` | 일치 |
| `integration.scope_changed` | `INTEGRATION_SCOPE_CHANGED: 'integration.scope_changed'` | 일치 |
| `integration.reauthorized` | `INTEGRATION_REAUTHORIZED: 'integration.reauthorized'` | 일치 |
| `workspace.transfer_ownership` | `WORKSPACE_TRANSFER_OWNERSHIP: 'workspace.transfer_ownership'` | 일치 |
| `execution.re_run` | `EXECUTION_RE_RUN: 'execution.re_run'` | 일치 |
| `auth_config.reveal` | `AUTH_CONFIG_REVEAL: 'auth_config.reveal'` | 일치 |

spec/data-flow/1-audit.md §1.1 작성자-모듈 × action 대조표도 코드 구현과 전수 일치한다.

---

## 요약

이번 변경은 두 가지 목표를 완전히 달성했다. (1) `AUDIT_ACTIONS` 상수 파일을 단일 SoT 로 신설하고 `AuditAction` union 타입으로 `AuditLogsService.record()` 의 `action` 인자를 타입 강제했다 (G-01). (2) 기존 `re_run_initiated` 를 `execution.re_run` 으로 개명해 dot-prefix 네이밍 규약을 준수했다 (G-02). 관련 4개 서비스(auth-configs, executions, integrations, workspaces)와 테스트, 모듈 주석이 모두 일관되게 갱신됐으며, spec/5-system/1-auth.md §4.1 및 spec/data-flow/1-audit.md §1.1 과 line-level 로 일치한다. 미구현 Planned action 의 누락은 의도된 상태로 헤더 JSDoc 에 명시돼 있다. Critical 또는 Warning 발견사항 없음.

## 위험도

NONE
