# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `AUDIT_ACTIONS` 상수 객체 키 일관성 — 동사 형태 혼재
  - 위치: `/codebase/backend/src/modules/audit-logs/audit-action.const.ts` L50-59
  - 상세: `INTEGRATION_CREATED` / `INTEGRATION_UPDATED` / `INTEGRATION_DELETED` 등은 과거분사 동사를 사용하고, `WORKSPACE_TRANSFER_OWNERSHIP` 는 동사원형 명사구를 사용하며, `EXECUTION_RE_RUN` 은 동사 명사 조합이다. 키 네이밍에는 일관된 패턴(예: 모두 과거분사 `WORKSPACE_OWNERSHIP_TRANSFERRED`, `EXECUTION_RE_RUNNED` 대신 도메인 특수케이스로 주석 보강)이 바람직하다. 다만 파일 헤더 주석이 verb 시제가 도메인별로 다름을 명시적으로 기술하고 있어, 이 의도는 문서화되어 있다.
  - 제안: `WORKSPACE_TRANSFER_OWNERSHIP` → `WORKSPACE_OWNERSHIP_TRANSFERRED` 로 다른 키와 동사 형태를 맞추거나, 현행처럼 action 문자열(`workspace.transfer_ownership`)의 명사구 표현을 상수 키에 반영하는 것으로 일관성 근거를 JSDoc 에 보강.

- **[INFO]** `AuditLogDto` 의 `action` 필드 타입이 `string` 으로 남아 있음
  - 위치: `/codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts` L301
  - 상세: `AuditLogsService.record` 의 `action` 파라미터는 `AuditAction` union 으로 강제되었으나, 응답 DTO 인 `AuditLogDto.action` 은 `string` 이다. 읽기 경로(findAll)에서는 DB 에서 임의 문자열이 나올 수 있어 타입을 `AuditAction` 으로 좁히기 어렵지만, 추후 `AuditAction | string` 또는 광범위한 string 그대로 유지한다는 주석이 없어 의도가 불명확하다.
  - 제안: DTO 주석에 "응답 action 은 DB 원문 그대로 — 과거 레거시 action 값 포함 가능" 을 명시하거나, `AuditAction | (string & {})` 패턴으로 타입 힌트를 제공.

- **[INFO]** `auth-configs.service.ts` — `import * as crypto` 와 `import { randomBytes } from 'crypto'` 이중 임포트
  - 위치: `/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L362-363
  - 상세: `crypto` 네임스페이스 전체 임포트와 named import 가 동시에 존재한다. 이는 이 변경사항 이전부터 있던 패턴이지만, 유지보수 시 혼란을 줄 수 있다.
  - 제안: `import { randomBytes, createHmac, timingSafeEqual } from 'crypto'` 로 통일하거나 `import * as crypto` 단독 사용으로 정리(이번 PR 범위 외이므로 INFO 수준).

- **[INFO]** `executions-rerun.service.spec.ts` — `serviceWithRealAudit` 생성 시 `workspacesService` 인자 누락
  - 위치: `/codebase/backend/src/modules/executions/executions-rerun.service.spec.ts` L1243-1251
  - 상세: `re-run still resolves when the audit repo save fails` 테스트에서 `new ExecutionsService(...)` 호출 시 인자가 7개이고 `workspacesService` (8번째 인자, `getMemberRole`)가 없다. 이는 타입 에러를 일으키거나 런타임에서 getMemberRole undefined 로 실패할 수 있는데, 테스트가 admin path 를 거치지 않는 user-1/own-exec 경로를 쓰고 있어 현재 통과할 수 있지만, `ExecutionsService` 생성자 시그니처 변경 시 조용히 깨진다.
  - 제안: `{} as never` 또는 `{ getMemberRole: jest.fn().mockResolvedValue('editor') } as never` 를 8번째 인자로 추가해 생성자 아리티를 일치시킴.

- **[INFO]** `executions.module.ts` 주석의 action 문자열이 코드와 일치 업데이트됨 — 양호
  - 위치: `/codebase/backend/src/modules/executions/executions.module.ts` L1379
  - 상세: 주석이 `execution.re_run` 으로 정확히 갱신되어 코드와 일치한다.

- **[INFO]** `spec/5-system/1-auth.md` §4.1 테이블 — Planned 행에서 `auth_config.reveal` 중복 제거
  - 위치: `/Volumes/project/private/clemvion/spec/5-system/1-auth.md`
  - 상세: 이전 버전은 Planned 행에 `auth_config.reveal` 이 구현됨/미구현 양쪽에 있었는데, 이번 변경으로 구현된 액션 표에서 분리되어 일관성이 크게 향상됨.

## 요약

이번 변경의 핵심 목표인 audit action 인라인 문자열 제거와 `AUDIT_ACTIONS` 상수 중앙화는 유지보수성 관점에서 명확한 개선이다. 9개 call site 가 모두 상수 참조로 전환되어 오타 방지·IDE 자동완성·타입 강제가 가능해졌고, 헤더 JSDoc 이 naming 규약과 SoT 를 정확히 기술하고 있다. 발견된 사항 중 실질적인 유지보수 위험은 `executions-rerun.service.spec.ts` 의 `ExecutionsService` 생성자 아리티 불일치(8번째 인자 누락) 이며, 나머지는 스타일 일관성 수준의 INFO 이다. 전반적으로 코드는 읽기 쉽고 책임이 잘 분리되어 있으며 기존 코드베이스 스타일을 잘 준수한다.

## 위험도

LOW

STATUS: SUCCESS
