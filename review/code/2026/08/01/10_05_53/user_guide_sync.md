# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 검토 방법

`.claude/config/doc-sync-matrix.json`(rows[] 21개) 을 SSOT 로 Read 하고 `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문(prose 표 21행, JSON 과 1:1) 을 보조로 Read 했다. 변경 파일 목록은 orchestrator prompt 번들(28개 파일) + `git diff --stat origin/main...HEAD`(실제 코드 diff, 20개 backend 파일 + `review/consistency/2026/08/01/09_11_58/` 8개 산출물)로 교차 확인했다. `codebase/frontend/**`, `codebase/channel-web-chat/**`, `spec/**`, `plan/**` 는 이 diff 에 **0건** 포함된다(`git diff --stat origin/main...HEAD -- spec/ plan/ codebase/frontend/ codebase/channel-web-chat/` 전부 공백 출력으로 확인).

## 매트릭스 매칭 결과

21개 행 전수 대조:

- glob 매칭 대상(`new-node`/`node-schema-change`: `codebase/backend/src/nodes/**`, `new-ui-string`: `frontend/**/*.tsx`, `new-widget-chrome-string`: `channel-web-chat/**/*.tsx`, `new-userguide-section-dir`: `content/docs/*/`, `new-bullmq-queue`: `system-status.constants.ts`, `new-error-code`: `error-codes.ts`, `expression-language-change`: `packages/expression-engine/**`, `spec-major-change`: `spec/{2,3,4,5}-*/**`+`conventions/**`, `userguide-gui-flow-section`: `docs/{02-nodes,06-integrations-and-config}/**.mdx`) — **전부 미매칭**. 이번 변경은 `codebase/backend/src/modules/{audit-logs,model-config,schedules,triggers,workflows}/**` 20개 파일에 한정된다.
- semantic 행(`integration-provider-change`, `new-warning-code`, `new-cross-cutting-enum`, `new-backend-ui-zod-value`, `new-handler-output-field`, `auth-session-flow-change`(glob `backend/src/modules/auth/**` 포함, 미매칭), `auth-config-type-enum-change`, `run-debug-flow-change`, `env-runtime-change`) — 코드 성격상 **전부 미매칭**. 특히 `auth-session-flow-change` 는 glob 이 `codebase/backend/src/modules/auth/**` 인데 이번 변경은 `audit-logs`/`model-config`/`schedules`/`triggers`/`workflows` 모듈이라 미매칭이며, `@CurrentUser` 데코레이터는 신설이 아니라 기존 것을 import 해 재사용(코드 주석이 "auth-configs W-1 과 동일 근거"로 기존 선례를 명시 인용)한 것이라 의미상으로도 "인증·권한·세션 흐름 변경"이 아니다.
- `backend-api-change`(glob: `**/*.controller.ts`, `**/dto/**`, match: semantic) — **glob 은 매칭**(`model-config.controller.ts`/`schedules.controller.ts`/`triggers.controller.ts`/`workflows.controller.ts`/`triggers/dto/notification-config.dto.ts`) 되었으나 판단 결과 **적용 대상 아님**으로 결론. 모든 컨트롤러 변경은 `@CurrentUser('sub') userId: string` 파라미터 추가뿐이며 이는 JWT 세션에서 파생되는 값이라 `@Body`/`@Query`/`@Param` 로 노출되지 않아 swagger 문서에 나타나지 않는다(NestJS Swagger 는 인식된 데코레이터만 문서화). 응답 스키마 확인 결과 `AuditLogResponseDto.action`(`codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts:39`)도 `string` 타입이라 enum 갱신도 불필요. `notification-config.dto.ts` 의 `@IsIn` 변경은 타입캐스팅 제거일 뿐 `NOTIFICATION_EVENT_TYPES` 값 자체는 무변경. 즉 client-visible API 계약 변화가 없어 swagger jsdoc·user-guide 페이지 갱신 불요.
- `spec-defect-found`(semantic, glob 없음) — **매칭**. 아래 발견사항 참조.

## 발견사항

### [WARNING] 감사 로깅 커버리지 갭 해소(13개 액션 구현)가 이를 "Planned(미구현)"으로 서술한 4개 spec SoT 를 동일 PR 에서 갱신하지 않음 — PR 자체가 번들한 impl-prep consistency-check 의 명시적 사전 권고를 이행하지 않음

- **변경 파일**: `codebase/backend/src/modules/audit-logs/audit-action.const.ts`(`AUDIT_ACTIONS` 에 `workflow.created/updated/deleted`, `trigger.created/updated/deleted`, `schedule.created/updated/deleted`, `model_config.create/update/delete/set_default` 13개 신설) + `model-config`/`schedules`/`triggers`/`workflows` 4개 모듈의 `.service.ts`/`.controller.ts`/`.module.ts`(`recordAudit()` 실배선, `AuditLogsModule` import)
- **매트릭스 항목**: `spec-defect-found` — change_type "spec 자체에 누락·오류가 있다고 판단됨" → targets: `"plan/in-progress/spec-update-<name>.md 에 제안 노트 작성 후 project-planner 위임"` (JSON `rows[]` 마지막 행 / PROJECT.md 표 마지막 행 원문 동일)
- **누락된 동반 갱신** (아래 4개 spec SoT — 전부 여전히 "미구현" 서술을 유지 중임을 직접 Read 로 확인):
  - `spec/data-flow/1-audit.md:83-85` — "`workflow.*` / `trigger.*` / `schedule.*` / `model_config.*` … 액션은 **여전히 미구현**이다 — workflows / triggers / alerts / schedules 모듈에는 `AuditLogsService` import 가 전혀 없다."(이제 사실이 아님 — 4개 모듈 모두 import 됨)
  - `spec/5-system/1-auth.md:429-436` — §4.1 "Planned (미구현 — 목표 커버리지)" 표에 `workflow.created/updated/deleted`, `trigger.created/updated/deleted`, `schedule.created/updated/deleted`, `model_config.*`(create/update/delete/set_default) 가 그대로 등재(`workflow.executed` 만 여전히 정확히 Planned)
  - `spec/conventions/audit-actions.md:56-59` — 레지스트리 상태 컬럼이 `workflow`/`trigger`/`schedule`/`model_config` 4행 모두 "미구현"
  - `spec/2-navigation/2-trigger-list.md:182,252` — (부수) `trigger.delete`/`trigger.update` 라는 현재형 표기가 실제 구현된 과거분사 액션명(`AUDIT_ACTIONS.TRIGGER_DELETED = 'trigger.deleted'`, `TRIGGER_UPDATED = 'trigger.updated'`)과도 문자열 층위에서 어긋남
  - (부수, plan 측) `plan/in-progress/spec-sync-auth-gaps.md:15` 의 `- [ ] §4.1 감사 로깅 커버리지 갭` 체크박스 미체크
- **상세**: 3개 커밋(`646a0bad4` feat, `24d0db60a` test, `65087584b` style)의 diff 는 `spec/**`·`plan/**` 어디도 건드리지 않는다(`git diff --stat origin/main...HEAD -- spec/ plan/` 공백 확인). 그런데 `646a0bad4` 커밋 메시지가 스스로 "spec/5-system/1-auth.md §4.1 이 Planned 로 약속한 액션 중 CRUD 13개를 구현한다"고 명시하고, 같은 메시지가 "impl-prep consistency (2026/08/01 09_11_58) INFO 6 이 독립적으로 같은 결론"이라며 이 PR 이 번들한 `review/consistency/2026/08/01/09_11_58/SUMMARY.md` 를 실제로 읽었음을 보여준다. 바로 그 SUMMARY.md WARNING #3 · `cross_spec.md` 는 "이번 audit-logging 작업이 `trigger.created/updated/deleted` 구현까지 포함한다면, 완료 후 `data-flow/1-audit.md §1.1` + `5-system/1-auth.md §4.1`(Planned→구현 이동) + `conventions/audit-actions.md §3`(상태 컬럼) + `2-navigation/2-trigger-list.md` L182/L252 를 **한 커밋에서 동시 갱신**해야 함(SoT 가 4곳에 흩어져 있어 하나만 고치면 다시 drift)"이라고 정확히 이 시나리오를 사전 경고했다. 즉 이 PR 은 그 경고가 예견한 코드 변경을 정확히 실행하면서 같은 경고의 spec 갱신 요구만 이행하지 않았다. developer 는 `spec/` write 권한이 없으므로(CLAUDE.md skill 표: "개발자 | `codebase/**`, `plan/**`, `review/**/RESOLUTION.md`. `spec/` read-only") 직접 고칠 수는 없지만, 최소한 `plan/in-progress/spec-update-<name>.md` 라우팅 노트를 남기거나 `spec-sync-auth-gaps.md` §4.1 체크박스를 갱신해 project-planner 턴을 유도했어야 한다(매트릭스 `spec-defect-found` 행이 정확히 이 절차를 요구). 이 상태로 머지되면 이 4개 spec 문서를 다음에 읽는 사람(project-planner·다른 developer·차기 consistency-check)이 방금 구현된 13개 액션을 "아직 구현 안 됨"으로 오인한다 — `2-trigger-list.md` 가 정반대 방향(미구현인데 구현됐다고 서술)으로 이미 겪었던 것과 같은 부류의 SoT drift 재생산이다.
- **제안**: 같은 turn 안에서 (a) `plan/in-progress/spec-update-audit-logging-coverage.md`(가칭) 에 "workflow/trigger/schedule/model_config CRUD 13개 구현 완료(`workflow.executed` 만 보존정책 미정으로 의도적 제외), 4개 spec SoT 갱신 필요" 제안 노트를 작성해 `project-planner` 위임하거나, (b) 바로 project-planner 턴을 열어 `spec/data-flow/1-audit.md §1.1`(커버리지 갭 서술 정정) · `spec/5-system/1-auth.md §4.1`(해당 13개 행을 "Planned" 표에서 "구현된 액션" 표로 이동, `workflow.executed` 만 Planned 잔류) · `spec/conventions/audit-actions.md §3`(상태 컬럼 "미구현"→"구현") · `spec/2-navigation/2-trigger-list.md`(L182/L252 를 실제 구현된 액션명(`trigger.deleted`/`trigger.updated`)과 정합화)를 갱신. 부수로 `plan/in-progress/spec-sync-auth-gaps.md` §4.1 체크박스도 "CRUD 13개 완료, `workflow.executed` 는 보존정책 결정 대기로 잔류"로 갱신 권장.

## 그 외 확인 — 갭 없음

- **i18n / dict / backend-labels.ts**: 이번 변경에 `codebase/frontend/**` 파일이 0건이라 `dict/{ko,en}/*.ts` parity·`backend-labels.ts` 의 `WARNING_KO`/`ERROR_KO`/`LABEL_KO` 등 매핑 갱신 대상 자체가 없다. `AUDIT_ACTIONS` 문자열(`workflow.created` 등)은 노드 warningRule/errorCode/zod ui 값이 아니라 `audit_log.action` 컬럼 값이며, 이를 노출하는 frontend UI 를 `grep -rln "audit-logs\|auditLog\|AuditLog" codebase/frontend/src` 로 확인한 결과 **0건** — 열람 UI 자체가 없어 CRITICAL 급 "영문 그대로 노출" 리스크는 없다.
- **신규 노드/섹션 디렉토리/제공자**: 해당 없음 (`codebase/backend/src/nodes/**`, `content/docs/*/`, provider 관련 변경 0건).
- **실행·디버깅/표현식 언어**: 해당 없음 (`execution-engine`, `packages/expression-engine/**` 변경 0건 — 이번 변경은 관리(CRUD) 엔드포인트의 감사 로깅이지 실행·디버그 흐름이 아님).

## 요약

매트릭스(JSON `rows[]`) 21개 행 전수를 대조한 결과, 이 PR(`codebase/backend/src/modules/{audit-logs,model-config,schedules,triggers,workflows}/**` 20개 파일, 감사 로깅 커버리지 확장)은 `codebase/frontend/**`·`spec/**`·`plan/**` 를 전혀 건드리지 않아 glob 매칭 10행·semantic 매칭 9행 중 **직접 매칭 0건**이며, `backend-api-change`(glob 매칭)는 client-visible 계약 변화가 없어 실질 적용 대상이 아니라고 판단했다. 반면 semantic 행 `spec-defect-found` 는 매칭되었다 — 이번에 구현한 13개 감사 액션이 spec 4곳(`1-audit.md §1.1`, `1-auth.md §4.1`, `audit-actions.md §3`, `2-trigger-list.md`)에서 여전히 "Planned/미구현"으로 서술돼 있고, 이 PR 이 번들한 자체 impl-prep consistency-check(같은 세션 산출물)가 정확히 이 동반 갱신을 사전 권고했음에도 이행되지 않은 WARNING 1건을 발견했다. 사용자 대상 UI·i18n 영향은 0(열람 UI 부재 확인)이라 CRITICAL 급 리스크는 없다.

## 위험도

MEDIUM
