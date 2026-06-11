# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [INFO] 파일 1 — `audit-log-response.dto.ts`: action 설명 열거 완전성
- 위치: `AuditLogDto.action` @ApiProperty description (lines 39-46)
- 상세: description 에 `integration.*` / `auth_config.*` / `workspace.transfer_ownership` / `execution.re_run` 이 정확히 나열되어 있다. spec/5-system/1-auth.md §4.1 "현재 구현된 액션" 표와 완전히 일치. DB 가 자유 문자열 컬럼이므로 레거시 값(`re_run_initiated`) 존재 가능성을 클라이언트에 경고하는 문구도 포함돼 있어 향후 호환성 위험을 명시적으로 안내한다.
- 제안: 이상 없음.

---

### [INFO] 파일 2 — `auth-configs.controller.spec.ts`: `req.ip=undefined` 전파 커버리지
- 위치: `'req.ip 미설정(trust proxy off) 시 undefined 를 그대로 전파'` 테스트 (lines 193-203)
- 상세: trust proxy 미설정 시 `req.ip` 가 `undefined` 인 경우를 테스트하고, `service.create` 에 `undefined` 가 전달됨을 검증한다. `create` 만 검증하고 `update`/`regenerate`/`remove`/`reveal` 에 대한 동일 경계값 케이스는 테스트하지 않으나, 핸들러 로직이 동일(`req.ip` 직접 전달)하므로 대표 케이스로 충분하다.
- 제안: 이상 없음 (coverage 확장은 선택적 강화 사항).

---

### [INFO] 파일 3 — `auth-configs.service.spec.ts`: 리팩토링 후 `AUDIT_ACTIONS` const 일관 사용
- 위치: 모든 `action:` 비교 assertion (lines 354, 363, 372, 381, 390, 421, 426)
- 상세: 인라인 문자열 리터럴(`'auth_config.create'` 등)에서 `AUDIT_ACTIONS.AUTH_CONFIG_CREATE` 등 const 참조로 교체됐다. spec §4.1 naming 규약("인라인 문자열 금지 — `AUDIT_ACTIONS` union 강제")과 일치. 또한 `remove` 테스트에 `workspaceId: WS` 검증이 추가된 것은 다른 CRUD action 테스트와 일관성을 맞춘 정당한 강화다.
- 제안: 이상 없음.

---

### [INFO] 파일 4 — `auth-configs.service.ts`: `recordAudit` 내부 헬퍼 도입
- 위치: `private recordAudit(...)` (lines 1366-1381)
- 상세: 5개 CRUD 경로가 공유하는 `auditLogsService.record(...)` 호출을 단일 private 메서드로 추상화했다. `resourceType: AUTH_CONFIG_RESOURCE_TYPE` 고정 및 best-effort 계약을 주석으로 명시했고, 파라미터 순서(`action`, `workspaceId`, `userId`, `resourceId`, `ipAddress?`)가 모든 호출 site 에서 일관되게 사용된다. `USAGE_RECENT_CALLS_LIMIT = 20` 상수 도입도 하드코딩 제거로 가독성 개선.
- 제안: 이상 없음.

---

### [INFO] 파일 5 — `integrations.service.spec.ts`: `update` + `reauthorize` 테스트 추가
- 위치: `describe('update', ...)` (lines 2893-2959), `'records integration.reauthorized audit on non-OAuth reset'` (lines 2867-2887)
- 상세:
  - `update`: name 변경 시 `integration.updated` + `details: { name: { from, to } }` 검증, 변경 없으면 audit 미기록, 통합 미존재 시 `NotFoundException` 검증 — 세 경로 모두 커버됨.
  - `reauthorize`: non-OAuth reset 시 `integration.reauthorized` + `details: { mode: 'reset' }` 검증 추가됨. OAuth 경로(audit 미기록)는 기존 테스트가 커버 중이므로 별도 추가 불필요.
  - 기존 인라인 문자열(`'integration.deleted'`, `'integration.rotated'`, `'integration.scope_changed'`, `'integration.created'`)도 `AUDIT_ACTIONS.*` const 로 교체됨.
- 제안: 이상 없음.

---

### [INFO] 파일 6 — `workspaces.service.spec.ts`: `WORKSPACE_TRANSFER_OWNERSHIP` const 교체
- 위치: `'records an audit log entry after a successful transfer'` 테스트 (line 3122)
- 상세: `'workspace.transfer_ownership'` 인라인 → `AUDIT_ACTIONS.WORKSPACE_TRANSFER_OWNERSHIP` const 참조로 교체. spec §4.1 인라인 문자열 금지 규약과 일치.
- 제안: 이상 없음.

---

### [WARNING] 파일 5 — `integrations.service.ts` `update` 메서드: `save`가 변경 없을 때도 호출됨
- 위치: `integrations.service.ts` lines 671 (실제 서비스 구현 — 이번 diff 에 포함된 파일은 아니나, 추가된 테스트 `'does not record audit when nothing changes'` 가 이 동작을 검증)
- 상세: 테스트 `'does not record audit when nothing changes'` 는 빈 `body({})` 를 전달했을 때 audit 가 기록되지 않음만 검증한다. 그러나 서비스 구현(`update` 메서드 lines 671)을 보면 `changes` 가 비어도 `save()` 는 항상 호출된다. 불필요한 DB write 가 발생하지만 기능 요구사항(audit 미기록) 은 충족하므로 CRITICAL 은 아니다. 요구사항 관점에서 "변경 없으면 아무 동작 없음"을 spec 이 명시하지 않으므로 위험도는 LOW.
- 제안: `save()` 호출을 `Object.keys(changes).length > 0` 조건으로 guard 하거나, 현 동작(항상 save + 변경 있을 때만 audit)을 의도적으로 문서화한다. spec 변경이 아닌 코드 개선 사항.

---

## 요약

6개 파일의 변경이 의도한 기능(auth_config CRUD 감사 로그 기록, integration/workspace audit const 통일, API 문서화 개선)을 모두 충족한다. spec/5-system/1-auth.md §4.1 에 정의된 action 식별자 5종(`auth_config.create/update/delete/regenerate/reveal`)이 코드와 테스트에 정확히 반영됐고, `AUDIT_ACTIONS` const SoT 규약(인라인 문자열 금지)도 전 파일에 걸쳐 일관되게 준수됐다. controller 의 userId/req.ip 전파 경로, service 의 best-effort audit 계약, OAuth/non-OAuth 분기에서의 audit 기록 동작 모두 spec 요구사항과 일치한다. `integrations.service.ts update` 에서 변경이 없어도 `save()` 가 호출되는 사소한 비효율이 있으나 기능 요구사항 위반은 아니다.

## 위험도

LOW
