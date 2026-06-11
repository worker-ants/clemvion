# 요구사항(Requirement) 리뷰

## 발견사항

### [INFO] AuditLogsService.record — best-effort swallow 테스트 파일명 변경
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L1417 (docstring 내)
- 상세: docstring 에 `audit-logs.service.spec` 으로 기술됐던 swallow 검증 파일명이 `audit-logs.spec` 으로 변경됐다. `audit-logs.spec.ts` 파일이 실제로 존재하고 `AuditLogsService.record — best-effort (swallow)` describe 블록이 해당 파일에 추가됐으므로, 참조 파일명과 실제 파일이 일치한다. 기능 완전성에 문제없음.

### [INFO] OAuth reauthorize 경로 — audit 미기록 동작 근거
- 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts` L2069-L2070
- 상세: 테스트 주석은 "OAuth 경로는 `begin()` 으로 위임만 하고 audit 를 남기지 않는다"고 기술한다. 실제 `integrations.service.ts` L1168-1196 의 구현에서 `service?.oauthProvider` 가 존재하면 `auditLogsService.record` 호출 없이 `oauthService.begin(...)` 을 return 한다. `integration.reauthorized` 는 non-OAuth reset 전용으로 동작하는 설계다. spec/2-navigation/4-integration.md §14.3은 "재인증 이벤트를 `integration.reauthorized`로 기록한다"고 명시하나 OAuth 경로(callback 완료 시점) vs non-OAuth reset(즉시 기록) 사이의 분기 기록 방식을 별도로 명문화하지 않았다. 기존 non-OAuth reset 케이스 테스트(`records integration.reauthorized audit on non-OAuth reset`)는 통과 가능하고, OAuth 경로는 실제 콜백 핸들러에서 기록해야 함 — 테스트 주석의 설명은 합리적. 이 부분은 spec의 기술 부재이며, 구현 동작이 의도적이다.
- 제안: INFO 수준. 코드 동작이 올바르나 spec/2-navigation/4-integration.md §14.3 에 OAuth reauthorize 는 callback 완료 시점에 기록되며 begin() 에서는 기록하지 않음을 명문화하는 것이 향후 spec fidelity 검증 시 혼란을 줄인다.

### [WARNING] [SPEC-DRIFT] AuditLogDto.action 설명 확장 — spec §4.1 표와 불일치
- 위치: `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts` L291-L301
- 상세: `AuditLogDto.action` 의 `@ApiProperty` description 이 확장됐다. 설명 중 "DB 는 자유 문자열 컬럼이므로 위 union 밖의 레거시 값(예: `re_run_initiated`)이 과거 row 에 존재할 수 있다 — 클라이언트는 enum 으로 단정하지 말 것"이 추가됐다. 이는 코드 버그가 아닌 API 문서화 개선(클라이언트 사용 계약 명문화)이다. 코드를 되돌리는 것이 오답이다. 다만 spec/5-system/1-auth.md §4.1 의 "현재 구현된 액션" 표와 "Action naming 규약" 섹션에는 클라이언트의 open-ended 처리 계약(레거시 값 존재 가능, enum 단정 금지)이 기술돼 있지 않다.
- 제안: 코드 유지 + spec 반영. spec/5-system/1-auth.md §4.1 또는 §4.2 에 "DB 는 자유 문자열 컬럼이며 action 필드에 위 union 밖의 레거시 값이 존재할 수 있으므로 클라이언트는 enum 으로 단정하지 말 것"을 추가해야 한다.

### [INFO] `USAGE_RECENT_CALLS_LIMIT = 20` 상수화
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L1376/L1536
- 상세: 인라인 리터럴 `20`을 `USAGE_RECENT_CALLS_LIMIT` 상수로 추출한 변경이다. 코멘트에 "목록 API 기본 페이지 크기와 동일"이라 명시됐으나 spec에 `getUsage` 반환 건수가 정의된 곳은 없다. 기능에 영향 없는 가독성 개선이다.

### [INFO] `private recordAudit()` 래퍼 도입
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L1566-L1583
- 상세: CRUD 5개 경로(create/update/regenerate/remove/reveal)가 `auditLogsService.record(...)` 를 직접 호출하던 것을 `recordAudit(params)` 라는 private 래퍼로 통합했다. `resourceType: AUTH_CONFIG_RESOURCE_TYPE` 를 래퍼 내에서 고정하여 중복 제거. named params 사용으로 동일 타입(string) 인자의 순서 스왑 위험을 타입 시스템이 잡을 수 있게 됐다. 구현 방식 변경이나 spec 약속(`auth_config.*` action, resourceType 필드)과 완전 일치한다.

### [INFO] `auth-configs.service.spec.ts` — reveal 테스트에서 지역 변수 `userId` 제거
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` L615 영역
- 상세: `describe('reveal')` 내의 `const userId = 'user-1'` 지역 변수가 제거되고 모듈 최상단의 `const USER = 'user-1'`로 통일됐다. 값은 동일하므로 기능 변화 없음. 테스트 내 일관성 개선이다.

### [INFO] `auth-configs.service.spec.ts` — `remove` audit 검증에 `workspaceId` 추가
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` L263-L270 diff 영역
- 상세: `remove → auth_config.delete 기록` 테스트의 `expect.objectContaining(...)` 에 `workspaceId: WS` 가 추가됐다. 이전에는 `workspaceId` 검증이 없었다. 구현 `recordAudit({ workspaceId, ... })` 에 `workspaceId` 가 포함되므로 추가된 검증은 정확하고, 기존 코드의 검증 미비를 메운 것이다.

### [INFO] `integrations.service.spec.ts` — `update` describe 블록 신규 추가
- 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts` diff L2104-L2143
- 상세: `update` describe 블록이 새로 추가됐다. 검증 내용: (1) name 변경 시 `integration.updated` audit 기록 + diff(`{ name: { from, to } }`) 검증, (2) 변경사항 없으면 audit 미기록, (3) integration 미존재 시 NotFoundException. 실제 서비스(`integrations.service.ts` L650-687) 의 구현과 테스트가 일치한다. spec/5-system/1-auth.md §4.1 에 `integration.updated` 가 "현재 구현된 액션"으로 명시돼 있어 spec 부합.

### [WARNING] `integrations.service.spec.ts` — `update` 테스트가 검증하지 않는 엣지 케이스
- 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts` 신규 `update` describe
- 상세: 현재 `update` describe는 `body.name` 변경 케이스만 검증한다. 그러나 실제 서비스(`integrations.service.ts` L665-668)에서는 `body.name`이 동일 값이어도 `save`를 호출한다 (`changes`에 name이 추가되지 않을 뿐, save는 무조건 실행됨). "변경사항 없으면 audit 미기록" 테스트는 통과하나, 빈 body(`{}`)로 호출 시 `save`는 여전히 실행됨(불필요한 DB 쓰기)이 테스트로 드러나지 않는다. 이는 성능 관련 이슈이며 기능 버그는 아니다. spec에서 save 최적화를 요구하지 않으므로 WARNING 수준.

### [INFO] `workspaces.service.spec.ts` — `WORKSPACE_TRANSFER_OWNERSHIP` 상수 참조 전환
- 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` L717
- 상세: 인라인 문자열 `'workspace.transfer_ownership'`에서 `AUDIT_ACTIONS.WORKSPACE_TRANSFER_OWNERSHIP` 상수 참조로 전환됐다. 값은 동일하고(`audit-action.const.ts` L25 에서 `'workspace.transfer_ownership'`로 정의). 인라인 문자열 금지 규약(spec §4.1, audit-action.const.ts docstring)에 부합한다.

## 요약

이번 변경은 audit log 관련 테스트 강화 및 코드 품질 개선이 목적이다. 핵심 기능 요구사항(spec/5-system/1-auth.md §4.1의 감사 액션 목록 — `auth_config.create/update/delete/regenerate/reveal`, `integration.reauthorized`, `workspace.transfer_ownership`)이 모두 테스트로 검증되며, `AUDIT_ACTIONS` 상수 참조로 인라인 문자열 금지 규약을 충족한다. `AuditLogsService.record` 의 best-effort(swallow) 계약이 별도 describe로 명시적으로 검증되고, `recordAudit()` 래퍼 도입으로 auth_config 도메인의 audit 호출이 named params 기반으로 통일됐다. OAuth reauthorize 경로에서 audit 미기록 동작은 서비스 구현과 일치하나 spec §14.3에 분기 기록 방식이 미명문화된 SPEC-DRIFT가 있다. `AuditLogDto.action`의 open-ended 처리 계약(레거시 값 가능, enum 단정 금지)이 API 문서에 추가됐으나 이에 상응하는 spec 갱신이 필요하다. 기능 구현에 치명적인 결함은 없다.

## 위험도

LOW
