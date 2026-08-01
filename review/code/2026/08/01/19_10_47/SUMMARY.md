# Code Review 통합 보고서

## 전체 위험도
**LOW** — 이번 라운드(커밋 `8f4bcc378`+`b77c62bbd`, 타입가드/주석 조치분)의 실제 diff 는 CRITICAL/WARNING 급 신규 결함이 없다. 다만 6개 reviewer 전원(전원 forced, 전원 결과 확보됨)이 공통으로 지목한 **기존 갭 1건**(트리거 시크릿/토큰 회전 3종의 감사 로깅 누락)과 requirement reviewer 가 지적한 **SPEC-DRIFT 4건**(코드가 spec 을 앞서가 spec 문서가 낡음)이 WARNING 으로 잔존하며, 전부 `plan/in-progress/spec-sync-auth-gaps.md` 가 이미 추적 중인 항목이라 이번 diff 가 만든 회귀는 아니다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/기능완전성 | 트리거 시크릿/토큰 회전 3종(`rotateNotificationSecret`, `revokePerTriggerToken`, `rotateBotToken`)이 여전히 감사 로그에 기록되지 않는다. 자격증명 회전은 감사 추적이 가장 필요한 이벤트 클래스(계정 탈취 후 봇 토큰 바꿔치기 등)임에도 흔적이 없다. 이번 PR 스코프(CRUD 카탈로그) 밖이며 diff 가 만든 회귀는 아니고, 대응 audit action 이 spec 카탈로그에 아직 없어 developer 단독 착수는 불가하다. | `codebase/backend/src/modules/triggers/triggers.service.ts:902`(`rotateNotificationSecret`), `:938`(`revokePerTriggerToken`), `:983`(`rotateBotToken`) | 코드 변경 불필요(이번 PR 범위 밖). `plan/in-progress/spec-sync-auth-gaps.md:34-41` 이 이미 추적 중 — `trigger.notification_secret_rotated` 등 신규 action 을 spec(`1-auth.md §4.1`, `conventions/audit-actions.md`)에 먼저 정의하는 planner 턴 선행 후 developer 턴에서 `recordAudit` 배선. |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/1-auth.md` §4.1 "현재 구현된 액션" 표에 이번 PR 이 구현한 13개 액션(workflow/trigger/schedule/model_config 의 created/updated/deleted 등)이 없고 오히려 "Planned(미구현)" 표에 그대로 남아 있다. "`model_config.service` 는 `AuditLogsService` 를 호출하지 않는다"는 서술도 사실과 다르다(`model-config.service.ts:58` 에서 실제 주입·호출). 코드가 spec 이 예고한 명명 규약대로 정확히 구현됐고 spec 의 "구현 상태" 표만 갱신되지 않은 케이스. | `spec/5-system/1-auth.md:414`(구현된 액션 표), `:429`(Planned 표) / 코드 근거 `audit-action.const.ts:32` | 코드 유지. 13개 액션을 "현재 구현된 액션" 표로 이동, `workflow.executed` 만 Planned 잔류. `plan/in-progress/spec-sync-auth-gaps.md:18-22` 가 이미 추적 중이므로 기존 항목 재확인. |
| 3 | SPEC-DRIFT | [SPEC-DRIFT] `spec/data-flow/1-audit.md` §1.1 writer 표에 4개 리소스(13개 액션) 행이 없고, 커버리지 갭 문단이 "workflows/triggers/alerts/schedules 모듈에는 `AuditLogsService` import 가 전혀 없다"고 서술하나 실제로는 4개 서비스 모두 생성자에서 주입해 사용 중이다. | `spec/data-flow/1-audit.md:82`(갭 문단), `:85` / 코드 근거 `model-config.service.ts:58`, `schedules.service.ts:37`, `triggers.service.ts:83`, `workflows.service.ts:82` | 코드 유지. writer 표에 13행 추가, 갭 문단을 "workflow.executed·saveCanvas/restoreVersion(및 트리거 회전 3종)만 잔여 갭"으로 재작성. 동일 planner 트랙. |
| 4 | SPEC-DRIFT | [SPEC-DRIFT] `spec/conventions/audit-actions.md` §3 "도메인별 분류 레지스트리" 표에서 workflow/trigger/schedule/model_config 4행이 전부 "미구현" 으로 남아 있다. 특히 `workflow` 행은 `created/updated/deleted`(구현됨)와 `executed`(의도적 미구현)를 한 셀에 묶어, 향후 "구현"으로 전환 시 `executed` 까지 구현된 것으로 오독할 위험이 있다. | `spec/conventions/audit-actions.md:56`(workflow), `:57`(trigger), `:58`(schedule), `:59`(model_config) | 코드 유지, planner 턴. `workflow` 행을 구현/미구현으로 분리하고 나머지 3행을 "구현"으로 갱신. |
| 5 | SPEC-DRIFT | [SPEC-DRIFT] `spec/2-navigation/2-trigger-list.md` 가 audit action 명을 오기 — 실제 action 은 `trigger.deleted`/`trigger.updated`(과거분사, `audit-action.const.ts:80-81` 및 `audit-actions.md §2.1` 규약과 일치)인데 문서는 `trigger.delete`/`trigger.update`(현재형)로 적어 RBAC permission 문자열과 audit action 문자열을 혼동하고 있다. | `spec/2-navigation/2-trigger-list.md:182`(`trigger.delete`), `:252`(`trigger.update`) | 코드 유지, planner 턴. 두 위치를 `trigger.deleted`/`trigger.updated` 로 정정. `plan/in-progress/spec-sync-auth-gaps.md:20-21` 이 이미 이 두 줄을 지목해 추적 중. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 스코프/부작용 | 이번 라운드 실제 diff(커밋 `8f4bcc378`+`b77c62bbd`)는 직전 리뷰(`18_44_56`)의 WARNING #6(`AuditActionFor` 리터럴-`*_RESOURCE_TYPE` 상수 이중 하드코딩)·INFO #11(narrowing 회귀 가드 부재)·INFO #12(`ModelConfigService.create()` 주석 누락) 3항목을 정확히, 그리고 그것만 조치했다. 리터럴→`typeof *_RESOURCE_TYPE` 치환 4곳, append-only `_NoCrossDomain` 컴파일타임 가드, 주석 1줄 추가 — 넷 다 컴파일 결과물(런타임 동작)에 영향 없음. scope·side_effect 두 reviewer 가 각각 독립 확인. | `model-config.service.ts:245`, `schedules.service.ts:147`, `triggers.service.ts:215`, `workflows.service.ts:180-184`, `audit-action.const.ts:121-124` | 조치 불요. |
| 2 | 보안 | 어댑터 실패 메시지가 검증 없이 최대 1024자 truncate 후 `chat_channel_last_error` 에 저장·API 노출된다. HTTP client 가 URL/헤더를 에러 메시지에 포함시키는 경우 시크릿 노출 여지를 완전히 배제하기 어렵다(기존 패턴, 이번 diff 신규 아님). | `triggers.service.ts:804`(`setupChatChannel` catch, `message.slice(0, 1024)`) | redaction 필터 추가 또는 provider 에러를 정형 코드로만 매핑하는 방향 검토(`translateSetupChannelError` 참고). |
| 3 | 보안 | `recordAudit` 를 try/catch 없이 await 하므로 `AuditLogsService.record` 실패 시 이미 커밋된 mutation 임에도 응답이 500 이 된다. 감사 로그를 조용히 누락시키는 fail-open 보다 안전한 fail-closed 설계라 취약점 아님(신뢰성 참고용). | `workflows.service.ts:223`, `triggers.service.ts:265`, `schedules.service.ts:191`, `model-config.service.ts:289` | 참고만. |
| 4 | 보안 | `AuditActionFor<P>` 컴파일타임 가드가 리소스-액션 교차 오염을 실제로 빌드에서 차단함을 확인. `recordAudit` named-parameter 설계도 4개 서비스 전부 일관. | `audit-action.const.ts:103-124` | 조치 불요. |
| 5 | 요구사항 | `WorkflowsService.saveCanvas`/`restoreVersion` 은 여전히 감사를 기록하지 않으나, 고빈도 캔버스 편집 이벤트라 카디널리티 논점(감사 로그 보존 정책 미정)으로 명시적으로 범위 밖에 둔 결정이며 근거가 일관됨(`plan/in-progress/spec-sync-auth-gaps.md:26-29`). | `workflows.service.ts` `saveCanvas`(~605), `restoreVersion`(~672) | 조치 불요. |
| 6 | 요구사항 | 컨트롤러→서비스 `userId` 배선 전수 확인 — 4개 서비스 12개 지점 모두 `@CurrentUser('sub')` 로 획득한 `userId` 를 정확히 전달. "1:1 결합 리소스는 주 리소스만 기록" 정책도 코드와 일치. | `model-config.controller.ts` 등 4개 controller 전체 | 조치 불요(정상 동작 확인). |
| 7 | 유지보수성 | `recordAudit` private 헬퍼가 5개 서비스(auth-configs 포함)에서 거의 동일한 형태로 반복. 기존 컨벤션의 의도적 답습이며 `AuditActionFor` 제네릭이 이미 컴파일 타임 안전성을 제공해 긴급하지 않음. | `model-config.service.ts:242`, `schedules.service.ts:144`, `triggers.service.ts:212`, `workflows.service.ts:177` | 액션 강제 아님 — 6번째 리소스 추가 시 공용 베이스(`AuditRecorder<P>` 등) 추출 재평가. |
| 8 | 테스트 | `remove()`(4개 모듈)와 `update()`(schedules·workflows)의 "저장 실패 시 감사 미기록" 대칭 테스트가 여전히 없다. 순수 순차 호출(분기·트랜잭션 재배치 위험 없음)이라 구조적으로 저위험이며, 2라운드 전 이미 "의도된 defer" 로 명시 판정됨 — 이번 diff 는 해당 지점을 건드리지 않아 재상향 근거 없음. | `model-config.service.ts:399`, `schedules.service.ts:207,267`, `triggers.service.ts:857`, `workflows.service.ts:232,257` | 조치 불요(旣 defer). 여력 시 6곳에 단언 1줄씩 추가. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 트리거 시크릿/토큰 회전 3종 감사 로깅 누락(기존 갭, PR 스코프 밖) + adapter 에러 메시지 truncate 노출(INFO) |
| requirement | LOW | SPEC-DRIFT 4건(코드가 spec 을 앞섬, 이미 planner 트랙 추적 중) + 트리거 회전 감사 갭 재확인 |
| scope | NONE | 변경분(`8f4bcc378`+`b77c62bbd`)이 직전 리뷰 권고 3건과 1:1 일치, 범위 이탈 없음 |
| side_effect | NONE | 타입 인자 치환/주석/append-only 가드만, 런타임 영향 없음 |
| maintainability | NONE | 직전 WARNING(리터럴-상수 이중화) 해소 확인, 신규 결함 없음 |
| testing | NONE | `tsc --noEmit` + 289개 단위 테스트 재현 통과, `_NoCrossDomain` 가드 뮤턴트(타입 widening) 검증으로 RED 확인 |

## 발견 없는 에이전트

없음 — 6개 reviewer 전원이 최소 1건 이상의 발견(WARNING 또는 INFO)을 보고했다. 단, scope/side_effect/maintainability/testing 4개 reviewer 는 위험도 NONE 으로, 보고 내용이 전부 "직전 조치 확인" 또는 "낮은 우선순위 참고"에 해당한다.

## 권장 조치사항

1. (해당 없음 — 이번 diff 자체에 즉시 코드 조치가 필요한 CRITICAL/WARNING 신규 결함 없음)
2. `plan/in-progress/spec-sync-auth-gaps.md` 트랙의 다음 planner 턴에서 SPEC-DRIFT 4건(`1-auth.md §4.1`, `data-flow/1-audit.md §1.1`, `conventions/audit-actions.md §3`, `2-navigation/2-trigger-list.md` L182/L252)을 코드에 맞게 일괄 갱신.
3. 같은 planner 턴에서 트리거 시크릿/토큰 회전 3종(`rotateNotificationSecret`/`revokePerTriggerToken`/`rotateBotToken`)에 대응할 신규 audit action(`trigger.notification_secret_rotated` 등)을 spec 카탈로그에 정의 → 후속 developer 턴에서 `recordAudit` 배선.
4. (낮은 우선순위) `remove()`/일부 `update()` 의 "저장 실패 시 감사 미기록" 대칭 테스트 6곳 보강 — 필수 아님.
5. (낮은 우선순위) 5개 서비스에 반복되는 `recordAudit` 보일러플레이트는 6번째 감사 대상 리소스가 추가되는 시점에 공용 베이스 추출 재평가.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 사유: 명시 안 됨(prompt 상 `routing: skipped`). 전체 reviewer(security, requirement, scope, side_effect, maintainability, testing) 실행.
- **실행**: security, requirement, scope, side_effect, maintainability, testing (6명, 전원 forced)
- **제외**: 없음
- **강제 포함(router_safety)**: maintainability, requirement, scope, security, side_effect, testing — 전원 강제 포함이며 전원 결과 확보됨(누락 없음).

| 제외된 reviewer | 이유 |
|------------------|------|
| (없음) | — |