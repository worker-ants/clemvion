# Cross-Spec 일관성 검토 — `spec/5-system/**` (impl-done, diff-base=`origin/main`)

## 검토 범위 확정

`git diff origin/main..HEAD` 를 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-followups-1464c0`)에서 직접 재산출해 target 범위를 확정했다(11개 커밋, 최신 `2534438dd`). 실제 spec 변경 파일 6개:

- `spec/5-system/14-external-interaction-api.md` — §7.1 caveat(`triggerToken` 평문 예외 등재) + §R17 "내부 읽기 경로도 같은 마스킹을 적용한다" 신규 서브불릿
- `spec/5-system/6-websocket-protocol.md` — `execution.snapshot` 행에 마스킹 상속 캐비엇 추가
- `spec/1-data-model.md` — §2.14 "Execution.error ↔ NodeExecution.error 관계" 표에 "응답 마스킹" 행 신설
- `spec/2-navigation/14-execution-history.md` — R-5 위에 "R-5 의 대상 범위" 캐비엇 추가
- `spec/4-nodes/1-logic/12-background.md` — §8.2 `nodeExecutions.data[].error` 마스킹 명시 + frontmatter `code` 갱신
- `spec/conventions/secret-store.md` — `Trigger.config.interaction.triggerToken` 비대상 예외 신설

코드 대조(`ExecutionsService.findById`/`toExecutionDto`/`getChain`/`stop`→`toResponseExecution`, `BackgroundRunsService.toNodeExecutionDto`, `shared/utils/redact-stored-error.ts`, `websocket.gateway.ts` 의 `emitExecutionSnapshot`, `executions.controller.ts` 의 `@Roles` 유무, `triggers.service.ts` 의 `triggerToken` 평문 대입)를 절대경로로 직접 열어 spec 서술과 실제 구현이 정확히 일치함을 확인했다 — impl-done CRITICAL(선언 vs 미구현) 후보는 없다.

이 target 은 같은 세션 안에서 이미 7라운드 `/ai-review` + 다수 `--spec`/`--impl-done` `cross_spec` 라운드를 거쳐 수렴한 PR 이다. 직전 두 라운드(`18_33_59`, `18_58_29`)의 cross_spec 이 지적한 WARNING 2건 — (1) `spec/1-data-model.md` "응답 마스킹" 행의 무조건문(스코프 없는 일반화), (2) EIA §R17 "잔여 ③" 의 "같은 두 컬럼" 모호성(workflow-assistant 가 실제로 마스킹하는 필드 수) — 은 각각 커밋 `9f870fb00`(19:16:01, "data-model 무조건문 정정")과 `e88ac4bdf`(18:58:10, "R17 총칭 정정")로 이미 수정되어 현재 HEAD 에 반영돼 있음을 재확인했다(두 파일을 직접 읽어 caveat 문구·"세 필드" 정정이 존재함을 확인).

## 발견사항

없음 — 새로 발견된 CRITICAL/WARNING 급 cross-spec 충돌 없음.

### 점검 관점별 확인 내역 (참고 — 충돌 아님)

- **데이터 모델 충돌**: `Execution.error`/`NodeExecution.error` "복사" 관계(§2.14) ↔ EIA §R17 "내부 읽기 경로" 불릿 — 두 필드가 함께 마스킹돼야 하는 이유(형제 필드 우회 방지)가 양쪽에서 동일하게 서술되고, `nodeExecutions[].error` 마스킹 라인(`executions.service.ts:643`)과 `background-runs.service.ts:302`(자매 표면 코멘트 포함) 코드로 확인. data-model.md 의 "응답 마스킹" 행은 이제 "열거된 읽기 경로에서만"·"WS `execution.node.*` emit 은 미포함" 캐비엇을 갖춰 EIA §R17 의 "총칭 아닌 열거" 원칙과 정합.
- **API 계약 충돌**: `GET /api/executions/:id` 가 `@Roles` 게이트 없음(컨트롤러 `@Get(':id')` 확인) ↔ R17 이 이를 근거로 드는 서술 일치. `POST /executions/:id/re-run`(`reRun` → `findById` 재사용, `executions.service.ts:493`) · WS `execution.snapshot`(`emitExecutionSnapshot` → `findById`) 이 마스킹을 상속한다는 두 문서(EIA §R17, WS §4.1)의 서술이 코드와 일치. `GET /executions/:id/background-runs/:id`(§8.1) 의 URL 축약 인용(EIA 쪽은 `/api` prefix·파라미터명을 생략)이 있으나 문서 계약을 바꾸는 수준은 아니라 정보성 이상은 아님.
- **요구사항 ID 충돌**: 신규 요구사항 ID 발급 없음(모두 기존 R17/R-5/§8.2 캐비엇 삽입) — 충돌 대상 없음.
- **상태 전이 충돌**: 이번 diff 는 상태 머신을 변경하지 않음(egress 마스킹만) — 해당 없음.
- **권한·RBAC 모델 충돌**: `stop` 은 `@Roles('editor')`, `findById`/`getChain`(re-run chain 조회, RR-PL-06 별도 소유자/관리자 검증)/목록 조회는 역할 게이트 없이 workspace 멤버 전원 — 이 비대칭이 마스킹 필요성의 근거로 정확히 인용되며 `conventions/node-cancellation.md` 의 "Editor+ 전용 Stop" 서술과도 모순 없음.
- **계층 책임 충돌**: `redactStoredErrorForResponse` 를 `ExecutionsService`/`BackgroundRunsService` 양쪽이 각자 호출(공유 leaf 유틸, 서비스 계층 경계 유지) — 기존 "leaf 유틸 공유, 서비스는 각자 호출" 패턴과 일치하고 새 계층 침범 없음. `secret-store.md` 의 `triggerToken` 비대상 예외도 `AuthConfig.config` 기존 예외 패턴(자기 근거 보유, 타 예외 근거 재사용 금지 명시)을 그대로 따름.

## 요약

이번 target(spec 6개 파일, 내부 REST/WS 읽기 경로에 대한 `Execution.error`/`nodeExecutions[].error` egress 마스킹 확장 + `Trigger.config.interaction.triggerToken` 평문 보관 비대상 예외 등재)은 코드(`redact-stored-error.ts`, `ExecutionsService` 4개 반환 경로, `BackgroundRunsService.toNodeExecutionDto`, `websocket.gateway.ts`, `executions.controller.ts`)를 워킹트리에서 직접 대조한 결과 spec 서술과 정확히 일치했고, 데이터 모델·WS 프로토콜·실행 내역·Background 노드·secret-store 컨벤션·API 규약·AI Assistant 문서 사이의 상호 참조에서 새로운 CRITICAL/WARNING 급 모순을 찾지 못했다. 이 세션 안의 직전 두 cross_spec 라운드가 지적한 두 WARNING(데이터모델 무조건문, R17 "같은 두 컬럼" 모호성)은 이후 커밋에서 이미 수정되어 현재 HEAD 에는 남아 있지 않다. 다수 라운드에 걸친 재검증이 같은 결론(코드-스펙 완전 일치, cross-spec 충돌 없음)에 수렴하고 있다.

## 위험도

NONE
