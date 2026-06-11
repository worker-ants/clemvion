# Code Review 통합 보고서

## 전체 위험도
**LOW** — audit action 상수화·타입 강화·명칭 개명 리팩터링. 기능 로직 변경 없음. 차단급 결함 없음. WARNING 2건은 테스트 커버리지 갭과 controller 인가 게이트 확인 필요 수준.

## Critical 발견사항

_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | IDOR 방어가 서비스 레이어에만 존재 — controller 레이어의 `@Roles` / `JwtAuthGuard` + `WorkspaceGuard` 적용 여부가 이번 diff 에서 확인되지 않음. controller 가 가드 없이 호출될 경우 우회 가능. | `executions.service.ts` `reRun()`, `ExecutionsController.reRun()` 핸들러 | 별도 리뷰 턴에서 `ExecutionsController.reRun()`에 `@Roles()` 또는 `JwtAuthGuard` + `WorkspaceGuard` 적용 여부 확인 |
| 2 | Testing | `integrations.service.spec.ts` 에서 `integration.updated` · `integration.reauthorized` audit action 호출 경로가 테스트에서 검증되지 않음 — 변경 전후 모두 커버리지 갭 존재 | `integrations.service.spec.ts` | `update` / `reauthorize` 경로에 `audit.record` 가 `AUDIT_ACTIONS.INTEGRATION_UPDATED` / `AUDIT_ACTIONS.INTEGRATION_REAUTHORIZED` 로 호출되는지 검증 케이스 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 감사 로그 기록 실패 swallow 설계 — DB 장애 시 high-risk 액션(`auth_config.reveal`, `workspace.transfer_ownership`) 누락 가능 | `audit-logs.service.ts` L213-228 | CRITICAL 레벨 액션 실패 시 별도 알람 채널(Slack 등) best-effort 발송 고려 |
| 2 | Security | `SECRET_CONFIG_KEYS` 미래 config type 추가 시 갱신 누락 가능 | `auth-configs.service.ts` L380, L742-750 | 코드 주석으로 신규 config type 추가 시 `SECRET_CONFIG_KEYS` 갱신 의무화 안내 |
| 3 | Requirement | `auth-configs.service.spec.ts` action assert 가 인라인 리터럴 사용 (이번 PR 범위 외 파일) | `auth-configs.service.spec.ts` L472 | 후속 정리로 `AUDIT_ACTIONS.AUTH_CONFIG_REVEAL` 상수 참조로 전환 (비차단) |
| 4 | Requirement | `spec/5-system/13-replay-rerun.md §11` 매핑 표의 논리 필드명이 `event_type` — 실제 파라미터명 `action` 과 불일치 | `spec/5-system/13-replay-rerun.md §11` | 논리 필드명을 `action` 으로 정렬해 혼동 감소 |
| 5 | Side Effect | DB `audit_log.action` 컬럼에 `re_run_initiated`(과거) · `execution.re_run`(신규) 두 값 혼재 — 외부 관찰 가능한 행동 변화 | `executions.service.ts` L419 | `GET /audit-logs?action=re_run_initiated` 필터링 클라이언트·BI 쿼리·알림 규칙 확인 필요. 프론트엔드 하드코딩 여부 별도 확인 |
| 6 | Maintainability | `AUDIT_ACTIONS` 상수 키 네이밍 동사 형태 혼재 — `WORKSPACE_TRANSFER_OWNERSHIP` 이 다른 과거분사형 키들과 불일치 | `audit-action.const.ts` L50-59 | `WORKSPACE_OWNERSHIP_TRANSFERRED` 로 변경하거나 현행 의도를 JSDoc 에 명시 |
| 7 | Maintainability | `AuditLogDto.action` 필드가 `string` 으로 남아 있어 타입 의도 불명확 | `audit-log-response.dto.ts` L301 | "응답 action 은 DB 원문 그대로 — 레거시 action 값 포함 가능" 주석 추가 또는 `AuditAction \| (string & {})` 패턴 적용 |
| 8 | Maintainability | `auth-configs.service.ts` `import * as crypto` + `import { randomBytes }` 이중 임포트 (기존 코드) | `auth-configs.service.ts` L362-363 | named import 또는 네임스페이스 import 중 하나로 통일 (이번 PR 범위 외, 후속 정리) |
| 9 | Maintainability | `executions-rerun.service.spec.ts` `serviceWithRealAudit` 생성 시 `workspacesService` 8번째 인자 누락 — 생성자 아리티 불일치 | `executions-rerun.service.spec.ts` L1243-1251 | `{} as never` 또는 mock 객체를 8번째 인자로 추가해 생성자 시그니처 일치 |
| 10 | Testing | 테스트 파일 action assert 가 `AUDIT_ACTIONS` 상수 대신 문자열 리터럴 사용 — 향후 상수 값 변경 시 false green 가능 | `integrations.service.spec.ts` L920,1054,1236,1282,1437; `workspaces.service.spec.ts` L719; `auth-configs.service.spec.ts` L472; `executions-rerun.service.spec.ts`; `executions.service.spec.ts` | `import { AUDIT_ACTIONS }` 후 `action: AUDIT_ACTIONS.XXX` 상수 참조로 전환 |
| 11 | Testing | `audit-logs.spec.ts` 에 `record()` swallow 계약 직접 단위 테스트 없음 (executions-rerun 간접 검증 존재) | `audit-logs.spec.ts` | `record()` swallow 계약(save 실패 시 resolve, warn 출력) 케이스를 `audit-logs.spec.ts` 에 중앙화 (선택적) |
| 12 | Documentation | 테스트 expect 가 `AUDIT_ACTIONS` 상수 대신 리터럴 `'execution.re_run'` 사용 — 향후 명칭 변경 시 테스트 자동 동기화 불가 | `executions-rerun.service.spec.ts`, `executions.service.spec.ts` | `expect.objectContaining({ action: AUDIT_ACTIONS.EXECUTION_RE_RUN })` 형태로 상수 직접 참조 |
| 13 | Documentation | `spec/5-system/1-auth.md §4.1` Planned 표에서 `auth_config.reveal` 이 구현됨 표로 이동했음을 독자가 직관적으로 찾기 어려울 수 있음 | `spec/5-system/1-auth.md §4.1` | Planned 설정 행에 `(reveal 은 구현됨 표 참조)` 주석 선택적 추가 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | IDOR controller 레이어 게이트 확인 필요(WARNING), 나머지 보안 항목 전반 양호 |
| requirement | NONE | spec §4.1 · data-flow §1.1 · 13-replay-rerun.md §11 모두 코드와 1:1 일치. 9개 call site 전환 완료 |
| scope | NONE | 14개 파일 전체가 G-01(상수화) · G-02(개명) 두 목표에만 귀속, 범위 일탈 없음 |
| side_effect | LOW | DB action 값 혼재(re_run_initiated / execution.re_run) — 의도된 trade-off, 외부 필터/쿼리 클라이언트 확인 권장 |
| maintainability | LOW | 생성자 아리티 불일치 1건(INFO), 키 네이밍 동사 혼재 · DTO 타입 주석 부재(INFO) |
| testing | LOW | integration.updated · integration.reauthorized audit 검증 갭(WARNING), 테스트 리터럴 상수 미참조(INFO) |
| documentation | LOW | 문서화 전반 우수. 테스트 expect 리터럴 미전환(INFO) |

## 발견 없는 에이전트

- **scope**: 범위 이탈 없음 — 전 발견사항 "없음"
- **requirement**: 요구사항 불일치 없음 (INFO만 존재)

## 권장 조치사항

1. **[W-1 확인]** `ExecutionsController.reRun()` 핸들러에 `@Roles()` / `JwtAuthGuard` + `WorkspaceGuard` 적용 여부를 별도 리뷰 턴에서 확인 — controller 레이어 인가 게이트 누락 시 IDOR 우회 가능.
2. **[W-2 테스트 보강]** `integrations.service.spec.ts` 에 `integration.updated` · `integration.reauthorized` 경로의 audit record 호출 검증 케이스 추가.
3. **[INFO-5 운영]** `re_run_initiated` → `execution.re_run` 전환으로 DB 값이 혼재 — 프론트엔드·BI·알림 규칙에서 `re_run_initiated` 구독 여부 확인 및 필요 시 dual-query 대응.
4. **[INFO-9 테스트 아리티]** `executions-rerun.service.spec.ts` `serviceWithRealAudit` 생성 시 8번째 인자(`workspacesService`) 추가.
5. **[INFO-10 테스트 위생]** 테스트 파일들의 action assert 를 `AUDIT_ACTIONS` 상수 참조로 전환 (상수 값 rename 시 자동 추적).
6. **[INFO-6 네이밍]** `WORKSPACE_TRANSFER_OWNERSHIP` 키를 `WORKSPACE_OWNERSHIP_TRANSFERRED` 로 일치시키거나 현행 의도를 JSDoc 에 명시.
7. **[INFO-7 DTO 주석]** `AuditLogDto.action` 필드에 "DB 원문 — 레거시 값 포함 가능" 주석 추가.
8. **[INFO-1 알람]** 고위험 액션(`auth_config.reveal`, `workspace.transfer_ownership`) 감사 로그 실패 시 별도 알람 채널 발송 중장기 검토.

## 라우터 결정

라우터가 선별 실행함 (`routing_status=done`).

- **실행(강제 포함)**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명) — 전부 `router_safety` 강제 포함
- **제외**: 7명

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | router 에 의해 생략 |
| architecture | router 에 의해 생략 |
| dependency | router 에 의해 생략 |
| database | router 에 의해 생략 |
| concurrency | router 에 의해 생략 |
| api_contract | router 에 의해 생략 |
| user_guide_sync | router 에 의해 생략 |

- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)