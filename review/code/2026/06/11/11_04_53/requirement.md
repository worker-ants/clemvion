# 요구사항(Requirement) 리뷰

## 발견사항

### [INFO] `auth-configs.service.spec.ts` — 테스트 action 문자열이 상수 미사용 (인라인 리터럴)
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` line 472
- **상세**: 프로덕션 코드(`auth-configs.service.ts`)는 `AUDIT_ACTIONS.AUTH_CONFIG_REVEAL`로 상수화됐으나, 해당 테스트 파일의 `expect(audit.record).toHaveBeenCalledWith(...)` assertion 은 여전히 `action: 'auth_config.reveal'` 인라인 리터럴을 사용한다. G-01 의 인라인 문자열 금지 규약이 테스트 파일에도 적용되면 불일치. 단, 이 파일은 이번 PR 의 리뷰 대상 diff 에 포함되지 않았으므로 본 PR scope 외의 잔여 항목이다. 기능에는 영향 없다.
- **제안**: 후속 정리로 `expect.objectContaining({ action: AUDIT_ACTIONS.AUTH_CONFIG_REVEAL })` 로 변경하면 상수 rename 시 테스트도 자동 추적. 본 PR 에서는 비차단.

### [INFO] spec §4.1 "구현된 액션" 표와 `AUDIT_ACTIONS` const 간 완전 일치 확인
- **위치**: `spec/5-system/1-auth.md §4.1` 구현됨 표 vs `audit-action.const.ts` AUDIT_ACTIONS 9개 항목
- **상세**: spec §4.1 "현재 구현된 액션" 표는 4개 카테고리(Integration 6개, 워크스페이스 1개, 실행 1개, 설정 1개) = 총 9개 action 을 나열한다. `AUDIT_ACTIONS` const 도 정확히 9개 항목이며 값이 1:1 일치한다. spec 명세와 코드 구현 간 불일치 없음.

### [INFO] `data-flow/1-audit.md §1.1` SoT 표와 call site 일치 확인
- **위치**: `spec/data-flow/1-audit.md §1.1` writer 표 (9개 call site) vs 실제 서비스 코드
- **상세**: spec 표는 9개 call site (integrations 6, workspaces 1, executions 1, auth-configs 1)를 기술한다. 실제 서비스 파일에서 grep 확인한 바 모든 call site 가 `AUDIT_ACTIONS.*` 상수로 전환됐으며 spec 표의 action 값과 일치한다. 커버리지 갭(workflow.* / trigger.* 등 미구현)도 spec 에 명시적으로 "Planned" 로 분리 기술돼 있어 의도 명확.

### [INFO] `spec/5-system/13-replay-rerun.md §11` — `event_type` 논리 필드명 잔존
- **위치**: `spec/5-system/13-replay-rerun.md` §11 매핑 표 (`event_type` → `action` 컬럼)
- **상세**: 이번 diff 에서 action 값은 `execution.re_run` 으로 정정됐다. 매핑 표에서 논리 필드명이 `event_type` 으로 표기되어 있는데, 실제 `AuditLogsService.record` 파라미터 이름은 `action` 이다. 이는 이번 변경 전부터 존재하던 기존 표기이며 기능에는 영향 없다(논리 이름 vs 파라미터 이름 차이). 매우 경미한 명칭 불일치.
- **제안**: 논리 필드명을 `action` 으로 정렬하면 혼동 감소. 비차단.

---

## 요약

이번 변경의 핵심 두 가지 — G-01(`audit-action.const.ts` + `AuditAction` union 도입으로 `record({ action })` 타입 강제) 과 G-02(`re_run_initiated` → `execution.re_run` 개명) — 는 모두 의도한 기능을 완전히 구현하고 있다. 9개 call site 전부 `AUDIT_ACTIONS.*` 상수로 전환됐고 인라인 문자열이 잔존하지 않는다. spec §4.1 의 "현재 구현된 액션" 표, `data-flow/1-audit.md §1.1` SoT 표, `spec/5-system/13-replay-rerun.md §11` 매핑 표 모두 코드와 line-level 로 일치한다. 엣지 케이스(audit record 실패 swallow 계약, legacy row 불변 원칙)도 spec 및 코드 주석·테스트가 명시적으로 처리한다. TODO/FIXME 없음. 테스트 파일 중 `auth-configs.service.spec.ts` 한 곳이 아직 인라인 리터럴을 사용하나 이번 PR diff 외 파일로 기능 영향 없다.

## 위험도

NONE

---

STATUS: SUCCESS
