---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# spec-sync 후속 — 구조 정규화 + 동기화 중 발견된 코드 갭

> 출처: 2026-06-03 spec 전수 코드정합성 동기화 (review/spec-coverage/2026/06/03/08_05_49). origin/main(#429~#437) rebase 후 재분석 반영.
> 본 문서는 (A) 구조 정규화 처리 결과/보류 결정, (B) 단일-파일 범위 밖 cross-spec 정리, (C) 동기화 중 발견한 **코드 측 갭/버그**(developer 영역) 를 추적한다.
> **§C 는 developer 가 다른 세션에서 이 문서만 보고 처리할 수 있도록 항목별로 위치(file:line)·증상·기대동작·수정힌트·근거를 self-contained 하게 정리했다.** 각 항목 위치/라인은 2026-06-03 rebase 후 현재 코드 기준이며, upstream 최근 커밋(#429~#437)이 이미 고친 항목은 제외했다(전수 재검증 결과 §C 19건 중 18건 open, 1건 partial).

---

## A. 구조 정규화 — 처리 결과

- [x] **version-history 재배치 (완료)** — `spec/2-navigation/12-workflow-version-history.md` → `spec/3-workflow-editor/5-version-history.md` 로 이동. 동반 갱신: 이동 파일 헤더 상대링크, `3-workflow-editor/_product-overview.md` 관련문서, `0-overview.md` §8 문서맵 2곳, user-guide MDX `codebase/frontend/src/content/docs/05-run-and-debug/version-history.mdx` 의 `spec:` frontmatter. docs 가드(registry/route/spec) 통과. **2-navigation 12 번은 빈칸으로 유지** (연번 체계는 향후 일괄 폐지 예정이라 cascade 재넘버링 미수행 — 사용자 결정 2026-06-03).
- [x] **parallel 스텁 폐기 (완료)** — upstream #432 가 parallel `count` 복원 + `done` 포트 allSettled-shape 를 구현해 audit 의 severe(parallel) 가 해소됨. 내 partial 강등을 폐기(upstream `implemented` 채택)하고 `spec-sync-parallel-gaps.md` 스텁 삭제.
- [ ] **5-system/0-overview.md 신설 — 스킵 (결정)** — `_product-overview.md`(비기능 요구사항 PRD) + `spec/0-overview.md`(시스템 아키텍처) 가 이미 진입 역할을 함. 신규 0-overview 는 중복(doc-bloat) 이라 미신설 (사용자 결정 2026-06-03).
- [ ] **노드 카테고리 `_product-overview.md` 대칭화 — 스킵 (결정)** — `1-logic`/`2-flow`/`5-data`/`6-presentation`/`7-trigger` 의 `0-common.md` 가 공통 규약+인덱스를 겸하므로 현 패턴이 내부 일관. 강제 추가는 doc-bloat 라 미수행 (사용자 결정 2026-06-03).
- [ ] **4-nodes/0-overview.md frontmatter — 스킵** — basename `0-overview.md` 는 spec-impl-evidence 가드 면제 대상이라 의무 아님. 추적성 이득 대비 가치 낮아 보류.

## B. cross-spec 정리 (단일-파일 동기화 범위 밖, planner)

- [ ] **3-workflow-editor/3-execution §10.13** — 노드 이벤트 명칭이 §8.1 의 권위 표(`execution.node.*`)와 톤 정렬 필요 (rebase 후 §8.1·§10.13 본문은 `execution.node.*` 로 정정 완료, 잔여 서술 정렬만).
- [ ] **data-flow/9-observability** — System Status SoT 참조가 5-system/16 과 2-navigation/15 두 갈래 — 정식 `/consistency-check` 로 정리 권장.
- [ ] **/docs 단일언어 cross-ref 점검** — 13-user-guide(현 2-navigation) 는 이중언어로 정정했으나 다른 곳의 `/docs` 단일언어 cross-ref 잔존 가능 — 점검 필요.

## C. 동기화 중 발견된 코드 측 갭/버그 (developer 영역)

> spec 은 모두 "코드 현실 + (Planned) 표기" 로 정직하게 맞췄다. 아래는 **코드를 고쳐야 spec 의 원래 의도에 도달**하는 항목. 각 항목은 개별 `plan/in-progress/spec-sync-*-gaps.md` 스텁에도 분산 기재돼 있다(근거 줄 참조). status: 🔴 OPEN = 현재 코드에 실재, 🟡 PARTIAL = 일부만.

### C 처리 결과 (2026-06-03, developer)

**19건 전부 구현·단위테스트·커밋 완료.** 결정 분기(C-4/C-6/C-16/C-16.4)는 사용자 권장안 채택. TEST WORKFLOW (lint·unit·build·e2e) 통과 + `/ai-review` 후속.

| 그룹 | 항목 | commit |
| --- | --- | --- |
| frontend | C-1, C-3, C-17, C-18 | `f72732cc` |
| statistics/dashboard/schedule | C-8, C-9, C-10, C-15 | `87d26c96` |
| nodes/exec/migration/dead-code | C-4, C-6, C-7, C-13, C-14, C-16, C-19 | `7f413725` |
| hooks/telegram | C-2, C-5 | `50eaec3c` |
| Discord (C-11) † | C-11 | `3450b6ce` |
| Slack (C-12) † | C-12 | `7a324a89` |

> † C-11/C-12 는 **코드 구현·단위테스트 완료**이나, 외부 Discord/Slack 프로토콜 정확성은 mock 기반 e2e 로 검증 불가(PROJECT.md: outbound 3rd-party stub 인프라 부재 = 구조적 한계). spec 의 "Planned" 해제는 실 provider 검증/통합 테스트 확보 후 — `spec-update-c-sync-promotions.md §1` 참조.

처리 시 결정·비고:
- **C-4** — If/Else regex 정상 동작 구현 채택. ⚠ spec `4-nodes/1-logic/1-if-else.md §6` 의 "regex no-op" 경고 문단은 If/Else 한정으로 **stale** 가 됐다 (정정은 planner — §스펙 승격 위임). **Switch expression mode 의 regex 는 본 PR 범위 밖** (여전히 no-op) — 후속 필요 시 별도 plan.
- **C-6** — V070 마이그레이션 채택. Flyway placeholder(`${...}`) 회피 위해 주석은 `alert_<rule.type>` 표기.
- **C-16.2** — `chartOutputSchema` 는 audit hint 오보(실사용 중, `chart.component.ts`). **No action** — 코드 정상.
- **C-16.4** — @Unique 데코레이터 제거 채택. spec(`5-system/5-expression-language.md §8.3.2`)이 이미 앱-레이어 유니크로 기술하므로 spec 변경 불필요.
- **사전 결함(별건)** — cafe24 `catalog-sync.spec` 가 `[^seed]` footnote 파싱으로 실패하던 main 사전 결함을 함께 수정 (`896ec0be`). §C 와 무관하나 unit stage 차단 해소.

#### 스펙 승격 위임 (planner — developer 는 spec/ read-only)

C 항목 구현 완료로 대응 spec frontmatter `status: partial → implemented` 승격 + `pending_plans` 정리 + 일부 본문 정정이 필요하다. developer 는 spec 직접 수정 불가 → `plan/in-progress/spec-update-c-sync-promotions.md` 에 위임 노트 작성. 대상: 각 `spec-sync-*-gaps.md` 가 가리키는 spec + C-4 의 if-else §6 경고 정정.

### C-1. 상태 필터 파라미터 불일치 - isActive vs status  — ✅ FIXED (this PR)

- **위치**: `codebase/frontend/src/app/(main)/workflows/page.tsx:112-113 / codebase/backend/src/modules/workflows/dto/query-workflow.dto.ts:19 / codebase/backend/src/modules/workflows/workflows.service.ts:64, 77-81`
- **증상**: 클라이언트(frontend/workflows/page.tsx)가 상태 필터 선택 시 ?isActive=true 또는 ?isActive=false를 서버로 전송. 그러나 서버는 query-workflow.dto.ts에서 ?status=active|inactive 만 수용하고 workflows.service.ts의 findAll 메서드는 status 파라미터만 처리(line 77-81에서 status === 'active'|'inactive' 체크). 따라서 클라이언트가 보낸 isActive 파라미터는 완전히 무시되며, 상태 필터 기능이 end-to-end 동작하지 않음.
- **기대 동작**: spec/2-navigation/1-workflow-list.md §3(API) 및 §2.3(필터)에 정의된 대로 클라이언트와 서버가 동일한 파라미터 계약(?status=active|inactive)을 사용. 사용자가 "Active"/"Inactive" 버튼 클릭 시 서버로 올바른 파라미터가 전달되고, 서버가 이를 처리하여 활성/비활성 워크플로우를 필터링함.
- **수정 힌트**: 클라이언트 수정(developer 담당): frontend/workflows/page.tsx line 112-113의 params.isActive를 params.status로 변경. filter === 'active'일 때 params.status = 'active', filter === 'inactive'일 때 params.status = 'inactive'로 변경. 서버 쪽(query-workflow.dto.ts, workflows.service.ts)은 현재 spec 의도대로 정확히 구현되어 있으므로 수정 불필요.
- **근거(spec/plan)**: spec/2-navigation/1-workflow-list.md §2.3 (필터 정의, 경고 문단에서 버그 명시), §3 (API 계약에서 status 파라미터 명시). 관련 plan: plan/in-progress/spec-sync-workflow-list-gaps.md 라인 20 (코드 버그 항목).

### C-2. 비활성 chatChannel 트리거 응답이 410 Gone 대신 202 Accepted 여야 함  — ✅ FIXED (this PR)

- **위치**: `codebase/backend/src/modules/hooks/hooks.service.ts:92-111`
- **증상**: handleWebhook 메서드에서 trigger.isActive 검사(92-97줄)가 chatChannel 분기(103-111줄)보다 먼저 실행되어, 비활성 chatChannel 트리거 요청도 410 Gone(GoneException)을 반환함. spec과 달리 202 Accepted + { executionId: 'ignored' }를 반환해야 함.
- **기대 동작**: 비활성 chatChannel 트리거 요청 시: 202 Accepted + JSON { executionId: 'ignored' } 반환. (비활성 일반 webhook 트리거는 여전히 410 Gone - WH-EP-07)
- **수정 힌트**: isActive 검사를 chatChannel 조건 검사 뒤로 옮기되, chatChannel 트리거면 202 + ignored 반환, 일반 webhook 트리거면 410 GoneException 발생. 구체적으로: (1) readChatChannelConfig() 호출하여 chatChannelCfg 판정, (2) chatChannelCfg 있으면 isActive 검사 후 202 ignored 반환, (3) chatChannelCfg 없으면 isActive 검사 후 410 throw.
- **근거(spec/plan)**: spec/5-system/15-chat-channel.md: R-CC-12 (line 605-622), §5.5 매트릭스 (line 410 비활성 trigger 행), caveat (line 616); spec/5-system/12-webhook.md: WH-EP-07 (line 57, chatChannel 예외 명시)

### C-3. Variable Modification UI 에 무효한 set_field/delete_field 옵션 잔존  — ✅ FIXED (this PR)

- **위치**: `codebase/frontend/src/components/editor/settings-panel/node-configs/logic-configs.tsx:352-353`
- **증상**: VariableModificationConfig 컴포넌트의 operation select 태그에 set_field 와 delete_field 옵션이 포함되어 있다. 사용자가 이 옵션을 선택하면 backend modOperationSchema 의 whitelist 미일치로 validateVariableModificationConfig 에서 reject 되어 "modifications[i].operation must be one of: set, increment, decrement, append, push, pop" 에러를 발생시킨다 (codebase/backend/src/nodes/logic/variable-modification/variable-modification.schema.ts:115-122, 테스트: variable-modification.schema.spec.ts:74-85).
- **기대 동작**: Backend modOperationSchema (codebase/backend/src/nodes/logic/variable-modification/variable-modification.schema.ts:7-14) 는 6개 operation 만 허용한다: set, increment, decrement, append, push, pop. spec/4-nodes/1-logic/5-variable-modification.md 의 §1.2 "지원 연산" 표도 이 6종만 명시한다. 따라서 frontend select 의 option 도 이 6개만 포함해야 한다. set_field 와 delete_field 는 과거 구현되지 않은 채 제거된 legacy operation 이며, backend 테스트에서 명시적으로 거부하도록 설계되었다 (variable-modification.schema.spec.ts 라인 74-85의 "rejects legacy operations removed from the enum" 케이스).
- **수정 힌트**: VariableModificationConfig 함수(라인 307-377) 의 select element (라인 341-354) 에서 라인 352-353 의 두 option 요소를 제거한다. 동시에 i18n 번역 문자열도 정리 필요:
- codebase/frontend/src/lib/i18n/dict/ko/nodeConfigs.ts 라인 267-268 의 opSetField / opDeleteField 제거
- codebase/frontend/src/lib/i18n/dict/en/nodeConfigs.ts 라인 269-270 의 opSetField / opDeleteField 제거
- **근거(spec/plan)**: spec/4-nodes/1-logic/5-variable-modification.md §1.2 "지원 연산" (라인 32-41) — 6개 operation 만 명시. 근거 comment (라인 45): "Source of truth: codebase/backend/src/nodes/logic/variable-modification/variable-modification.schema.ts (export `variableModificationNodeConfigSchema`)". 관련 plan: plan/in-progress/spec-sync-structural-followups.md §C 라인 34 "variable-modification UI 무효 옵션".

### C-4. If/Else regex 연산자가 항상 false를 반환하는 no-op  — ✅ FIXED (this PR)

- **위치**: `codebase/backend/src/nodes/logic/if-else/if-else.handler.ts:40-86 (evaluateCondition 호출 시 regex 옵션 미전달) 및 codebase/backend/src/nodes/core/condition-evaluator.util.ts:80-86 (EvaluateOptions.regex 미설정 상태)`
- **증상**: If/Else 노드 schema (if-else.schema.ts:7-23)는 conditionOperatorSchema enum에 'regex'를 포함하고 있어 UI에서 regex 연산자를 선택할 수 있게 노출하고 있으나, if-else.handler.ts의 execute() 메서드 (line 40-86)가 evaluateCondition() 호출 시 (line 53) options 매개변수로 {strict: strictComparison === true}만 전달하고 options.regex를 제공하지 않는다. 그 결과 condition-evaluator.util.ts의 evaluateResolvedCondition() 함수 (line 150-154)에서 regex case에서 'if (!compiledRegex) return false'로 항상 false를 반환하는 무조건적 no-op가 되어 사용자가 regex 조건을 아무리 정확히 작성해도 항상 거짓으로 평가된다.
- **기대 동작**: If/Else 노드도 Filter/Transform.array_filter (filter.handler.ts)처럼 regex 패턴을 컴파일해서 options.regex를 전달하거나, UI 차원에서 regex 옵션을 선택 불가능하게 막아야 한다. Spec 4-nodes/1-logic/1-if-else.md §6 "regex 연산자 주의" 박스(line 164)에 "If/Else (와 Switch expression mode) 핸들러는 컴파일된 정규식을 평가기에 전달하지 않으므로 regex는 현재 항상 false를 반환하는 no-op이다"라고 명시되어 있으므로, spec 의도는 If/Else에서 regex 선택을 허용하되 표현식으로 우회하라는 것이다. 따라서 (1) regex 옵션을 UI에서 숨기거나, (2) regex 조건 입력 시 runtime에 무시하면서 warning을 표시하거나, (3) 정상적으로 컴파일/평가하도록 수정해야 한다.
- **수정 힌트**: (1) 가장 간단한 fix: if-else.handler.ts 의 execute() 메서드에서 if-else.schema.ts의 조건처럼 compileRegexCache (condition-evaluator.util.ts 에서 export)를 호출해서 regex 패턴을 미리 컴파일하고, evaluateCondition() 호출 시 options.regex를 포함시키면 된다. Filter 구현(filter.handler.ts ~line 580-600)을 참고. (2) 보수적 fix: if-else.schema.ts 의 conditionOperatorSchema enum에서 'regex'를 제거하거나, UI schema metadata에 regex를 제외시킨다. (3) spec 반영 fix: 현재 spec 의도대로 유지하되, metadata 에 regex가 no-op임을 명시하는 warningRule 추가.
- **근거(spec/plan)**: Spec 4-nodes/1-logic/1-if-else.md §6 "regex 연산자 주의" (line 164-164) + spec 4-nodes/1-logic/0-common.md §2 지원 연산자 (line 65에 regex 명시) + plan/in-progress/spec-sync-structural-followups.md §C "if-else regex 연산자 no-op" (line 35) + core/condition-evaluator.util.ts 설계 의도(line 80-86 주석 "If/Else and Switch leave this unset")

### C-5. Telegram /help 정적 안내가 도달 불가(dead code)  — ✅ FIXED (this PR)

- **위치**: `codebase/backend/src/modules/hooks/hooks.service.ts:249-267 / codebase/backend/src/modules/chat-channel/providers/telegram/telegram-update.parser.ts:117-120`
- **증상**: 사용자가 텔레그램에서 /help 명령을 입력하면, parseTelegramUpdate 의 readCommand 함수가 /start·/cancel 외 모든 / 프리픽스 텍스트를 null로 반환하여(라인 117-120), parseUpdate 가 null → update가 없음 → 라인 249의 /help 정적 안내 분기는 절대 실행되지 않음. 대신 maybeNotifyIgnored 가 "지원하지 않는 메시지 형식입니다" 안내를 발송.
- **기대 동작**: spec 4-nodes/7-trigger/providers/telegram.md §7 의 의도: 사용자가 /help 를 입력하면 "v1 정적 도움말(languageHints.help 또는 기본 문구)" 안내를 발송. 현재 hooks.service.ts 라인 249-267 의 분기 코드는 올바르나, 입력이 도달하지 않음.
- **수정 힌트**: telegram-update.parser.ts 의 readCommand 함수(라인 107-161)에서 라인 117의 일반 / 프리픽스 check 직전에 /help 명령을 명시적으로 처리해야 함. 예: readCommand 라인 115 뒤(cancel 처리 후)에 아래 조건 추가: if (trimmed === '/help') { return { kind: 'help' }; } 그리고 hooks.service.ts 의 /help 정적 안내 분기(라인 250-267)를 update.command.kind === 'text_message' && text === '/help' 에서 update.command.kind === 'help' 로 변경. 또는 간단히: readCommand 에서 /help 를 text_message 처럼 통과시키되, 라인 251 의 조건을 update.command.kind === 'text_message' && trimmed === '/help' 로 명시적 검사(현재 라인 252 는 이미 이 조건 구현했으나 command 가 도달하지 않음).
- **근거(spec/plan)**: spec/4-nodes/7-trigger/providers/telegram.md §7 (라인 207-216) "명령 처리" 테이블 및 라인 214 설명: /help 는 v1 정적 텍스트 (languageHints.help 또는 default) 목표. Plan: plan/in-progress/spec-sync-telegram-gaps.md 라인 17 미구현 항목 목록.

### C-6. AlertsEvaluatorService가 발사하는 `alert_<rule.type>` 동적 값이 notification.type CHECK 제약 밖  — ✅ FIXED (this PR)

- **위치**: `codebase/backend/src/modules/alerts/alerts-evaluator.service.ts:213`
- **증상**: AlertsEvaluatorService.dispatchBreach() 메서드가 197줄부터 225줄의 범위에서, 209줄의 await this.notificationsService.createMany() 호출 시 213번 줄에 type을 동적으로 `alert_${rule.type}` 형태로 생성하여 전달합니다. rule.type은 evaluateRule() 메서드(105~130줄)에서 switch 문으로 'failure_rate', 'duration', 'llm_cost' 중 하나가 됩니다. 따라서 실제 전달되는 type 값은 'alert_failure_rate', 'alert_duration', 'alert_llm_cost' 패턴입니다. 그러나 V052 마이그레이션(codebase/backend/migrations/V052__notification_type_integration_action_required.sql:48~56줄)의 CHECK 제약은 다음 7가지만 허용합니다: execution_failed, background_failed, schedule_failed, integration_expired, integration_action_required, marketplace_update, team_invite. 'alert_*' 패턴의 값들이 완전히 누락되어 있어, 알림 규칙이 위반되면 INSERT 시 CHECK 제약 위반 에러가 발생합니다.
- **기대 동작**: spec/data-flow/8-notifications.md의 72줄에 명시된 대로, `alert_<rule.type>` 타입의 notification 행을 데이터베이스에 성공적으로 INSERT할 수 있어야 합니다. 즉, V052의 CHECK 제약 허용 목록에 'alert_failure_rate', 'alert_duration', 'alert_llm_cost' 값들이 포함되거나, 또는 AlertsEvaluatorService의 type 생성 로직을 spec과 일치하도록 수정해야 합니다.
- **수정 힌트**: 다음 두 가지 해결 방안 중 선택: (1) **마이그레이션 추가** — 새 V0xx 마이그레이션을 생성해 notification.type CHECK 제약을 확대하여 'alert_failure_rate', 'alert_duration', 'alert_llm_cost'를 추가. 유사하게 V052 구조(DROP, ADD CONSTRAINT ... NOT VALID, VALIDATE)를 따릅니다. (2) **코드 수정** — AlertsEvaluatorService.dispatchBreach()의 213줄에서 type을 고정 값으로 변경 (예: 'alert_breach' 또는 rule.type에 따른 매핑). 이 경우 spec 8-notifications.md 72줄의 type 값 기술을 동시에 수정해야 합니다. 방안 (1)을 권장 (spec이 이미 동적 type을 약속하고 있고, rule.type별 분류가 의미 있음).
- **근거(spec/plan)**: spec/data-flow/8-notifications.md §1.1 (72줄): `| alert_<rule.type> | 구현됨 | AlertsEvaluatorService.dispatchBreach ... (※ type 값이 동적 alert_<type> 라 V052 CHECK 제약 목록 밖 — 코드/마이그레이션 정합성은 본 spec 범위 밖 별도 추적)` + plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md 25줄: `별도(코드 버그) 추적 필요: AlertsEvaluatorService 가 발사하는 alert_<rule.type> 동적 type 값이 V052 의 notification.type CHECK 제약 허용 목록에 없음`

### C-7. 실행 목록 "Nodes" 열이 nodeExecutions 부재로 항상 —로 표시  — ✅ FIXED (this PR)

- **위치**: `codebase/backend/src/modules/executions/executions.service.ts:648-682 (toExecutionDto 메서드)`
- **증상**: frontend executions/page.tsx (line 252-258)에서 execution.nodeExecutions 필드를 기반으로 완료/전체 노드 수를 집계해 표시하려 하나, 목록 API 응답 ExecutionDto에 nodeExecutions 필드가 전혀 없으므로 항상 undefined → 항상 0 → Nodes 열이 "—" 표시됨. 현재 toExecutionDto는 executionPath만 [] 로 채우고 nodeExecutions는 필드 자체를 응답하지 않음.
- **기대 동작**: spec/2-navigation/14-execution-history.md §2.4 테이블: Nodes 열에 "완료 수/전체 수" 또는 실패 시 "(N failed)" 추가 표시. 목록 API(GET /api/executions/workflow/:workflowId)의 ExecutionDto 응답에 nodesExecutions 배열을 포함하거나 completedNodeCount/totalNodeCount 같은 집계 컬럼을 추가해야 함.
- **수정 힌트**: 두 가지 방안: (1) ExecutionDto에 nodeExecutions 배열 직접 포함 (N+1 성능 우려) 또는 (2) completedNodeCount, totalNodeCount, failedNodeCount 같은 집계 컬럼 3개를 toExecutionDto에서 계산해 응답. plan/in-progress/spec-sync-execution-history-gaps.md 에서 N+1 회피 관점 언급했으므로, 방안 (2)가 권장: NodeExecution 관계를 로드하지 않고 execution_node_executions 테이블의 status로 집계하거나, 별도 집계 쿼리. 응답 형식 또는 DTO 확장 후 frontend 집계 로직(현재 page.tsx 252-258)이 자동으로 작동하도록 조정.
- **근거(spec/plan)**: spec/2-navigation/14-execution-history.md: §2.4 Nodes 열 + 위 경고 문단(line 162-163 주석). plan/in-progress/spec-sync-execution-history-gaps.md 미구현 항목(line 13). 

### C-8. Dashboard Success Rate 분모 및 최근 워크플로우 정렬 컬럼 불일치  — ✅ FIXED (this PR)

- **위치**: `codebase/backend/src/modules/dashboard/dashboard.service.ts:104-107, 138`
- **증상**: 
1. Success Rate 분모 (line 104-107): `successRate = successCount / runs7dResult × 100` 에서 `runs7dResult` 는 전체 7일 실행건수이므로 이론상 정확하지만, spec 2-navigation/0-dashboard.md §3 에서 명명법 혼동 위험: spec 은 "status 무관 7일 내 전체 실행 건수(running·pending·cancelled 포함)" 로 명시했으나, 코드 변수명 `runs7dResult` 의 의도가 불명확. 초기 감지: 분모가 completed/(completed+failed) 가 아닌 전체 실행건수인지 명시적 검증 필요.

2. 최근 워크플로우 정렬 (line 138): `orderBy('w.updatedAt', 'DESC')` — 정렬이 'updatedAt 내림차순'으로 spec 의도와 일치. 초기 힌트("max(updatedAt,lastExecutedAt) 아닌 w.updatedAt 단일") 는 misattribution 으로 보임: spec 은 실제로 'updatedAt 내림차순' 만 명시(§4), 복합 기준 미수립.

- **기대 동작**: 
1. Success Rate 분모: spec 2-navigation/0-dashboard.md §3 테이블 및 §7 필드 설명에 따르면 "최근 7일 성공률(%) = completed / runs7d × 100" 로 명시. runs7d 는 'status 무관 7일 내 전체 실행 건수(running·pending·cancelled 포함)'를 뜻함. 현재 코드 line 104-107 에서 `successCount / runs7dResult` 계산은 수학적으로 정확하나, spec 원문의 의도(분자: completed 만, 분모: 모든 status 의 실행건수) 가 코드 변수명으로 명확하지 않음. 분명한 가독성 개선 또는 명시적 검증 필요.

2. 최근 워크플로우 정렬: spec §4 "정렬 기준: updatedAt 내림차순" 로 명시. 현재 line 138 은 정확.

- **수정 힌트**: 
1. Success Rate 분모 명확화 (코드 수정 관점):
   - line 96-102: successCount 정의는 정확 (status=COMPLETED 인 7일 내 실행건수).
   - line 104-107: 분모 변수명 을 `runs7dResult` (혼동유발) → `total7dExecutions` 등으로 명칭 일관화. 또는 주석 추가: "분모는 모든 status 의 7일 실행건수 (running/pending/cancelled/completed/failed)".
   - 검증: 현재 line 73-79 의 쿼리(`.andWhere('e.started_at >= :sevenDaysAgo', { sevenDaysAgo }).getCount()`) 는 status 필터 없음 → 의도대로 전체 7일 실행건수 집계하므로 로직 정확. 변수명만 개선.

2. 최근 워크플로우 정렬: 이미 정확 (수정 불필요).

   구체 순서:
   a) line 96 `const successCount` → 명칭 명확 유지(단, 주석 강화): "// 최근 7일 COMPLETED 상태 실행건수"
   b) line 104 의 `successRate` 계산 직전에 주석: "// 분모: 모든 status 의 7일 실행건수"
   c) 또는 line 73 의 `runs7dResult` 변수명 → `total7dExecutions` 로 전역 명칭화.

- **근거(spec/plan)**: 
spec/2-navigation/0-dashboard.md:
- §3 테이블 (line 60): "Success Rate | 최근 7일 성공률 (%) | `completed / (최근 7일 전체 실행 건수) × 100`. 분모는 status 무관 7일 내 전체 실행 건수(running·pending·cancelled 포함)."
- §7 응답 필드 (line 138): "`successRate` | 최근 7일 성공률(%) = completed / runs7d × 100"

관련 plan:
- plan/in-progress/spec-sync-structural-followups.md (line 39): "dashboard/statistics/schedule — Success Rate 분모·정렬 컬럼·/toggle 부재·기간 enum(1d vs custom) 등 (각 spec-sync gaps 스텁 참조)."

원인: 2026-06-03 spec-sync audit 중 발견 — spec 원문과 코드 로직은 일치하나, 변수명 혼동(runs7dResult 가 semantically 불명확) 으로 오해 초래. 초기 힌트("분모가 completed/(completed+failed) 가 아닌 7일 전체 실행건수") 는 실제로는 코드가 정확함을 의미.


### C-9. 백엔드 QueryStatisticsDto enum 이 프론트 '1d' 프리셋을 거부 (validation 에러)  — ✅ FIXED (this PR)

- **위치**: `codebase/backend/src/modules/statistics/dto/query-statistics.dto.ts:15`
- **증상**: 프론트엔드가 기간 필터 '오늘' 버튼 선택 시 period=1d 를 API 요청에 포함하여 전송하지만, 백엔드 QueryStatisticsDto 의 @IsIn(['7d', '30d', '90d', 'custom']) 검증으로 인해 400 Bad Request (class-validator 실패) 반환. 통계 페이지의 '오늘' 프리셋이 모든 API 호출에서 검증 거부됨.
- **기대 동작**: spec/2-navigation/7-statistics.md 2.1 필터 표 명시: "기간 | 오늘(1d) / 최근 7일(7d, 기본) / 최근 30일(30d) / 최근 90일(90d)" — 1d 는 지원되는 period 값. 백엔드 QueryStatisticsDto 가 프론트 page.tsx 와 동일하게 1d 를 허용 enum 에 포함.
- **수정 힌트**: codebase/backend/src/modules/statistics/dto/query-statistics.dto.ts:15 의 @IsIn 배열에 '1d' 추가: @IsIn(['1d', '7d', '30d', '90d', 'custom']). 동시에 line 10 ApiPropertyOptional description 의 enum 예시 배열도 ['1d', '7d', '30d', '90d', 'custom'] 로 갱신 (line 10). 추가로 statistics.service.ts 에서 period=1d 에 대한 date 범위 계산 로직(예: now.setDate(now.getDate() - 1) 등) 확인 필요.
- **근거(spec/plan)**: spec/2-navigation/7-statistics.md §2.1 필터 표 (line 59-62) — "오늘(1d)" 명시. plan/in-progress/spec-sync-statistics-gaps.md 항목 3번 (line 15): "프리셋 1d(오늘)는 프론트에만 있고 백엔드 enum(7d/30d/90d/custom)에는 없음"

### C-10. GET /api/schedules 의 sort/order 쿼리 파라미터 무시 (created_at DESC 고정)  — ✅ FIXED (this PR)

- **위치**: `codebase/backend/src/modules/schedules/schedules.service.ts:29-54`
- **증상**: findAll 메서드가 PaginationQueryDto에서 받은 sort, order 파라미터를 추출하지 않고 라인 45에서 'created_at DESC' 로 정렬을 하드코딩. 클라이언트가 다른 필드로 정렬을 요청해도 무시됨.
- **기대 동작**: PaginationQueryDto의 sort(기본: created_at) 및 order(기본: desc) 파라미터를 동적으로 적용하여, 사용자가 스케줄 목록을 다양한 필드(예: created_at, updated_at, name)로 정렬할 수 있어야 함. spec/2-navigation/3-schedule.md §4 에 명시된 대로 sort/order 쿼리 지원.
- **수정 힌트**: 라인 33의 구조 분해에 sort, order 추가 (현재는 page, limit, search만 추출). 라인 45의 orderBy 호출 전에 getSortColumn(sort) 메서드로 화이트리스트 검증 후 'w.' 접두사와 함께 적용. 다른 서비스(WorkflowsService:102-103, ExecutionsService, AuditLogsService)의 패턴 참조. 허용 컬럼: created_at, updated_at, name 등.
- **근거(spec/plan)**: spec/2-navigation/3-schedule.md §4 라인 126 (GET /api/schedules의 sort/order 미구현/Planned 명시). plan/in-progress/spec-sync-schedule-gaps.md 라인 17 (미구현 항목 명시). PaginationQueryDto가 이미 sort:string(패턴 검증)와 order:'asc'|'desc'를 정의함.

### C-11. Discord AI Multi Turn reply modal 진입점 및 setupChannel verify_key 검증 미구현  — ✅ FIXED (코드 구현 완료, 실 Discord 프로토콜 검증 대기)

- **위치**: `codebase/backend/src/modules/chat-channel/providers/discord/discord-message.renderer.ts:76-88, discord-update.parser.ts:81-116, discord.adapter.ts:63-123`
- **증상**: 1) renderAiMessage (line 76-88) 는 AI 응답 텍스트와 presentations 만 발송하며, "Reply" 버튼을 메시지에 첨부하지 않는다. 2) parseDiscordUpdate (line 81-116) 의 MESSAGE_COMPONENT 분기 (type=3) 에서 custom_id === "__open_form__" 는 처리하지만 custom_id === "__reply__" 분기는 없어서 Reply 버튼 클릭 진입점이 없다. 3) setupChannel (line 63-123) 에서 GET /applications/@me 응답의 verify_key 를 수신하지만(line 77), 사용자 입력 public key 와의 일치 검증이 없고, 검증 실패 시 BOT_TOKEN_INVALID 에러 분기가 없다.
- **기대 동작**: Spec §5.1(b) 및 spec §3.1 약속: 1) renderAiMessage 는 ai_message 텍스트 청크 발송 후 "Reply" 버튼(custom_id="__reply__", style=2 SECONDARY)을 마지막 메시지의 components 에 첨부해야 한다. 2) parseDiscordUpdate 의 MESSAGE_COMPONENT (type=3) 분기에서 custom_id === "__reply__" 경우를 처리하여 openContext(interactionId, interactionToken)를 담은 open_form_modal command 를 반환한다. 3) HooksService 가 open_form_modal 에 응답하여 MODAL (custom_id="clemvion_reply", 단일 TEXT_INPUT custom_id="message") 을 interaction HTTP 응답으로 열고, 사용자 제출 후 MODAL_SUBMIT (custom_id="clemvion_reply")는 parseDiscordUpdate 의 일반 TEXT_INPUT normalize 경로(line 144-156)로 text_message 로 변환된다. 4) setupChannel 에서 GET /applications/@me 응답의 verify_key(application public key)를 사용자 입력 inboundSigningPlaintext 와 비교·검증하고, 불일치 시 BOT_TOKEN_INVALID 에러를 throw 한다.
- **수정 힌트**: 1) renderAiMessage 함수 내 chunkText(event.message) 이후 마지막 텍스트 청크에 Reply 버튼(custom_id="__reply__", style=2)을 추가하는 로직을 구현한다. 또는 별도 ChannelMessage 로 버튼만 발송하는 분기를 추가한다. 2) parseDiscordUpdate 의 MESSAGE_COMPONENT (type=3) 분기에서 __open_form__ 처리 다음(line 84-98)에 custom_id === "__reply__" 케이스를 추가하여, open_form_modal 과 동일한 구조의 openContext(interactionId, interactionToken) 를 담은 command 를 반환한다. 3) setupChannel 에서 botToken 으로 config.inboundSigningRef 의 public key 를 resolve 한 후, 응답 verify_key 와 정확히 비교(===)한다. 불일치 시 throw new Error('BOT_TOKEN_INVALID: verify_key mismatch')
- **근거(spec/plan)**: spec/4-nodes/7-trigger/providers/discord.md §3.1 (line 67-100, verify_key 검증), §5.1 (line 180-197, AI Multi Turn reply 경로 (b) Button-Modal), §4 (line 150-175, MODAL_SUBMIT 분기). 근거: spec §3.1 (56행) "응답 verify_key 와 사용자 입력 public key 의 일치 검증은 **미구현 Planned**" 및 (76행) "불일치 시 BOT_TOKEN_INVALID error 분기". spec §5.1 (192행) "어댑터가 AI 응답 메시지 끝에 'Reply' 버튼...첨부", (193행) "현재 구현 상태: renderAiMessage 는 응답 텍스트(+presentations)만 발송하고 'Reply' 버튼을 첨부하지 않으며, parseUpdate 에 __reply__ 버튼 분기가 없다". 관련 plan: plan/in-progress/spec-sync-discord-gaps.md (§3.1 setupChannel public key cross-verify 14-15행, §5.1(b) AI Multi Turn reply button-modal 경로 15-16행).

### C-12. Slack file_shared → files.info → submit_form 및 response_url 비동기 갱신 미구현  — ✅ FIXED (코드 구현 완료, 실 Slack 프로토콜 검증 대기)

- **위치**: `codebase/backend/src/modules/chat-channel/providers/slack/slack-client.ts:73-87, codebase/backend/src/modules/hooks/hooks.service.ts:586, codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.ts:214, codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.ts:200-206`
- **증상**: spec/4-nodes/7-trigger/providers/slack.md 의 §4.1 (line 129) 및 §5.2 (line 145), §5.3 (line 206) 에서 약속한 3가지 기능이 Phase 3/4 스텁으로 남아있음: (1) file_shared 이벤트 수신 후 HooksService 가 SlackClient.filesInfo(fileId) 를 호출하여 mimeType/filename/url_private 을 보강하고 EIA submit_form 을 호출하는 경로가 없음 (HooksService line 586 에 "Phase 4 에서 처리" 주석만 존재). (2) SlackClient.filesUploadV2(line 73-87) 가 Promise.reject() 로 항상 실패하므로 image/chart/table 등 시각형 노드 의 PNG 업로드 불가능 (현재 text fallback 으로 동작). (3) ackInteraction(line 214) 이 noop 이며, Slack Interactivity payload 의 response_url 을 사용한 비동기 갱신(replace_original/update) POST 경로가 없음 (slack.types.ts 에는 response_url 필드 정의만 존재하고 사용처 없음)
- **기대 동작**: spec 정의 대로: (1) parseUpdate 가 file_upload command 반환 (현재 동작) → HooksService 의 handleChatChannelUpdate → 동기적으로 SlackClient.filesInfo(fileId) 호출 → mimeType/filename/url_private 으로 ChannelUpdate 갱신 → form 필드 allowedMimeTypes 검증 → submit_form(data.{fileId, filename, mimeType, urlPrivate}) 호출 흐름 완성. (2) sendMessage(image body) 시 SlackClient.filesUploadV2 로 실제 PNG 업로드 수행 (현재는 text fallback). (3) button_callback 처리 후 ackInteraction(response_url) 을 통해 비동기로 response_url 로 POST 하여 replace_original: true, text: "선택 완료" 등으로 UI 갱신.
- **수정 힌트**: 3가지 항목을 Phase 4 (Form 입력 시퀀스) 로 분류된 PR 에서 구현: (1) HooksService.handleChatChannelUpdate 에서 update.command.kind === 'file_upload' 케이스를 추가하여 botToken resolve → SlackClient.filesInfo(fileId) → response 에서 mimeType/filename/mimetype 추출 → ChannelUpdate 보강 → form 검증 로직 거쳐 submit_form 호출. (2) SlackClient.filesUploadV2 구현 — fetch('https://slack.com/api/files.uploadV2') with multipart/form-data (file buffer), slack-adapter.ts 의 sendMessage(image) 에서 SlackClient.filesUploadV2 호출로 변경 (현재 text fallback 제거). (3) ackInteraction 구현 — update.command.kind === 'button_callback' 시 response_url 저장 → 비동기 태스크로 response_url 로 POST({ replace_original: true, text: "선택 완료: {label}" }).
- **근거(spec/plan)**: spec/4-nodes/7-trigger/providers/slack.md R-S-7 (line 341-357) / §4.1 file_shared 매핑 (line 129) / §5.2 button response_url (line 145, 188) / §5.3 form file 필드 (line 206). 관련 plan: plan/in-progress/spec-sync-slack-gaps.md 의 3개 미구현 항목. 최근 upstream: commit #429~#436 (file_upload/form 관련 변경 없음, 스텁 상태 유지)

### C-13. Manual Trigger: meta.source 필드가 schema에 명시 선언 부재  — ✅ FIXED (this PR)

- **위치**: `codebase/backend/src/nodes/trigger/manual-trigger/manual-trigger.schema.ts:29-47`
- **증상**: manualTriggerOutputSchema에서 meta 필드 구조가 명시되지 않음. object의 자식 필드(meta.source)를 선언하지 않고, 스키마 전체에 .passthrough()만 적용. 핸들러는 실제로 meta: { source: 'manual'|'webhook'|'schedule' }를 반환하지만 스키마는 이를 타입 선언하지 않음.
- **기대 동작**: manualTriggerOutputSchema는 메인 object 아래에 명시적인 meta 필드를 선언해야 함. 구조: { config?, output?, meta?: { source: z.enum(['manual', 'webhook', 'schedule']) }, port?, status? }. CONVENTIONS Principle 11(출력 예시 문서화)에서 meta는 5필드 중 하나로 정식 선언되어야 함.
- **수정 힌트**: manualTriggerOutputSchema의 object 정의에 다음 필드를 추가: meta: z.object({ source: z.enum(['manual', 'webhook', 'schedule']) }).optional() — config, output 필드 사이 또는 port 앞에 삽입. 그 다음 passthrough()는 여전히 유효하므로 유지. 테스트는 기존 manual-trigger.handler.spec.ts의 meta.source 검증들이 이미 커버.
- **근거(spec/plan)**: spec/4-nodes/7-trigger/1-manual-trigger.md §4.6(meta 채움), §5.1(Case JSON 예시 meta.source), §5.2(Case JSON 예시 meta.source). 근거: spec/conventions/node-output.md Principle 0(5필드 invariant), Principle 2(meta 실행 메트릭). 관련: plan/in-progress/code-node-handlers.md 또는 최근 spec-sync-audit 리포트의 schema completeness 항목

### C-14. DTO 의 dryRun 필드 description 이 stale — v1 완전 구현 됨  — ✅ FIXED (this PR)

- **위치**: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:29`
- **증상**: ReRunRequestDto 의 dryRun 필드 @ApiPropertyOptional description 이 'v1 미지원 — RERUN_DRY_RUN_NOT_APPLICABLE' 로 명시되어 있으나, 실제로는 dry-run 이 v1 에서 완전 구현됨 (2026-05-31 커밋 ebbfcf5e, feat(re-run): dry-run 완전 구현). HTTP Request / Send Email / Database Query / Cafe24 노드 모두 supportsDryRun: true 로 설정되어 있고, 엔진이 createContext 시점에 variables.__dryRun 을 주입하며, 핸들러가 isDryRun(context) 로 분기해 mock 출력을 반환. 그러나 DTO 문서는 여전히 "미지원" 이라 표기해 개발자/API 문서 사용자가 오도됨.
- **기대 동작**: DTO description 을 spec/5-system/13-replay-rerun.md §7/§8.1 에 부합하게 업데이트: 'dry-run 모드 실행 여부 (외부 부수효과 skip, mock 출력 반환). 기본 false' 정도로 명확히 표기. 또는 더 상세히: 'dry-run 모드로 실행할지. true 면 HTTP Request/Send Email/Database Query/Cafe24 같은 외부 부수효과 노드는 실제 호출 대신 mock 출력(_dryRun: true)을 반환. 기본 false'
- **수정 힌트**: line 29 의 description string 을 단순히 stale comment 제거하고 현재 spec 문구로 교체. 또는 swagger @ApiPropertyOptional 옵션에 example: false, deprecated: false 명시해 swagger UI 에서도 확실히 보이도록. spec 참조는 유지 (§8.1 POST /executions/:id/re-run 의 dryRun 매개변수).
- **근거(spec/plan)**: spec/5-system/13-replay-rerun.md §7 (dry-run 모드 정의 — 외부 부수효과 노드의 mock 동작) / §8.1 (POST /executions/:id/re-run 의 dryRun 요청 매개변수: '기본 false' 명시) / plan/complete/spec-draft-spec-drift-resolve.md 또는 최근 커밋 ebbfcf5e (feat(re-run): dry-run 완전 구현)

### C-15. LlmUsageSummaryDto 누락 필드 3개 — spec "Input/Output 토큰 구분" 미충족  — ✅ FIXED (this PR)

- **위치**: `codebase/backend/src/modules/statistics/dto/responses/statistics-response.dto.ts:117-126`
- **증상**: LlmUsageSummaryDto (DTO/Swagger) 가 service 메서드 getLlmUsageSummary() 실제 반환 interface LlmUsageSummary 보다 필드 3개가 누락됨: totalPromptTokens, totalCompletionTokens, topProvider. 결과적으로 Swagger 문서가 실제 응답 형식을 정확히 기술하지 못함.
- **기대 동작**: LlmUsageSummaryDto 에 다음 3개 필드 추가: (1) @ApiProperty() totalPromptTokens: number — 전체 input 토큰 합계. (2) @ApiProperty() totalCompletionTokens: number — 전체 output 토큰 합계. (3) @ApiPropertyOptional() topProvider?: string | null — 토큰 사용량 최다 프로바이더명 또는 null. 이를 통해 spec 요구 "Input/Output 토큰 구분" (spec 2.5 LLM 토큰 사용량 항목)을 충족하고 Swagger 문서를 실제 구현과 정합화함.
- **수정 힌트**: statistics-response.dto.ts 의 LlmUsageSummaryDto 클래스(현 line 117-126)에 3개 필드를 추가. service.ts 의 getLlmUsageSummary() 구현 (line 295-379)에서 이미 계산·반환하는 totalPromptTokens (line 372), totalCompletionTokens (line 373), topProvider (line 376)와 동일한 이름/타입으로 DTO 필드 정의 후 @ApiProperty/@ApiPropertyOptional 데코레이터 추가. controller 의 getLlmUsageSummary() 는 이미 LlmUsageSummaryDto 를 response 타입으로 선언했으므로 추가 변경 불필요 (line 122).
- **근거(spec/plan)**: spec/2-navigation/7-statistics.md §2.5 "LLM 토큰 사용량" 테이블 "프로바이더별 토큰 사용량 | Input/Output 토큰 구분" + plan/in-progress/spec-sync-statistics-gaps.md (초기 미구현 추적 문서) — 단, 이 건은 gaps 문서에 미기재됨(spec-vs-code audit 당시 DTO 누락 심화 검출)

### C-16. 코드가 spec 의도와 어긋나는 dead export/declaration 4건 중 1건 fixed, 3건 open  — ✅ FIXED (this PR)

- **위치**: `codebase/backend/src/nodes/integration/cafe24/metadata/types.ts:199; codebase/backend/src/nodes/presentation/chart/chart.schema.ts:128-133; codebase/backend/src/modules/websocket/websocket.service.ts:288-300; codebase/backend/src/modules/nodes/entities/node.entity.ts:25-27`
- **증상**: (1) CAFE24_RESOURCE_LABELS (types.ts:199) 는 한국어 resource 라벨을 hardcoded 하는 export 인데 소비처가 0개. spec conventions/cafe24-api-metadata.md §7.5 는 "backend 가 라벨 직접 보유 안 함" 을 기술했으나 이 상수가 잔존. (2) chartOutputSchema (chart.schema.ts:128-133) 는 spec 당 진짜 사용되고 있으나 audit hint 에 포함된 오보. (3) websocket.service.ts:298 의 KbEventType union 에 'document:graph_error' 정의되었으나 실제 emit 호출은 모두 다른 이벤트만 방출 (graph_started/progress/completed/retry/failed only — graph-extraction.service.ts:157,177,195,218,244,261). (4) node.entity.ts:27 의 @Unique('UQ_node_workflow_label') 데코레이터는 선언되나 마이그레이션 파일 부재 + app.module.ts:177 에서 synchronize:false 이므로 DB 에는 적용 안 됨.
- **기대 동작**: (1) CAFE24_RESOURCE_LABELS 는 사용하지 않으면 제거하거나, spec §7.5 를 "frontend i18n dict 로 이주됨" 으로 정정 + 비고 추가. (2) chartOutputSchema 는 정상 유지(spec 의 기술 오류). (3) document:graph_error 를 KbEventType union 에서 제거하거나, graph-extraction.service 에서 실제로 emit 하도록 구현. (4) UQ_node_workflow_label 을 DB 제약으로 강제하려면 마이그레이션 파일 신규 또는 existing 마이그레이션에 추가; 또는 spec/conventions/migrations.md 에 '미적용 제약' 으로 기술 + synchronize:true 검토.
- **수정 힌트**: (1) grep -r 'CAFE24_RESOURCE_LABELS' 재확인 후 제거 또는 spec 수정. (2) No action required. (3) websocket.service.ts:298 에서 'document:graph_error' 라인 제거 하거나, graph-extraction.service.ts 의 emitEvent 호출에 'document:graph_error' 케이스 추가(예: catch 블록이나 별도 에러 경로). (4) V069 이상 마이그레이션에 `ALTER TABLE node ADD CONSTRAINT UQ_node_workflow_label UNIQUE (workflow_id, label);` 추가 하거나, node.entity.ts 데코레이터 제거 + spec 명시.
- **근거(spec/plan)**: spec/conventions/cafe24-api-metadata.md §7.5 (라벨 제거), spec/conventions/migrations.md §1-6 (마이그레이션 규약), plan/in-progress/spec-sync-structural-followups.md §C (동기화 중 발견된 코드 갭, 42번 항목 'dead export/declaration')

### C-17. demo-host.tsx 의 show/hide/updateProfile 주석이 stale — 구현 완료되었으나 "미구현"이라 기술  — ✅ FIXED (this PR)

- **위치**: `codebase/channel-web-chat/src/app/demo/demo-host.tsx:16-17, 260-261`
- **증상**: demo-host.tsx 에서 show/hide/updateProfile 을 "위젯 SPA 미구현"이라 기술하고 있으나, 실제로는 #436 에서 use-widget.ts 의 show() (L260), hide() (L261), updateProfile() (L264-270) 및 widget-state.ts 의 SHOW/HIDE 액션으로 이미 구현 완료됨. 또한 widget-state.ts 의 WidgetState 인터페이스에 hidden 속성(L31)도 추가되어 있고, spec 7-channel-web-chat/1-widget-app.md §3.2 에서 명시적으로 정의됨.
- **기대 동작**: demo-host.tsx 의 주석 및 설명이 현재 구현 상태를 정확히 반영해야 함. (1) 라인 16-17 의 주석에서 "미구현"을 제거하거나 정정. (2) 라인 260-261 의 주석을 제거하거나, demo 가 의도적으로 show/hide/updateProfile 명령을 노출하지 않는 이유가 있다면 그 사유를 명시. (3) 선택적: DemoCommand 타입에 show/hide/updateProfile 을 추가해 데모에서도 테스트 가능하도록 확장(spec §R5 에서 공개 계약이라 명시).
- **수정 힌트**: 현재 demo-host.tsx 는 (a) 의도적으로 show/hide/updateProfile 을 제외한 것인지, (b) 미완성인지 명확하게 구분. (a) 라면 주석을 "host 제어(show/hide/updateProfile)는 시뮌레이션 단순화를 위해 데모에서 제외하며, 실제 SDK 에서는 구현됨(use-widget.ts L260-270, widget-state.ts)" 로 정정. (b) 라면 DemoCommand 타입에 "show" | "hide" | "updateProfile" 추가 후, 관련 UI 버튼/폼 필드 추가(라인 231-262 근처의 명령 섹션).
- **근거(spec/plan)**: spec/7-channel-web-chat/1-widget-app.md §3.2 (라인 86-102) — show/hide/updateProfile 명시적 정의 및 host 명령으로 공개 계약. R5(라인 111-117) — show/hide 와 open/close 의 직교성 재설명. 관련 plan: plan/in-progress/channel-web-chat-followups.md (spec frontmatter line 8). 최근 #436 커밋에서 show/hide/updateProfile 구현 완료.

### C-18. ResultTimeline 분모 maxTurns 항상 0 fallback — 읽기 경로 불일치  — ✅ FIXED (this PR)

- **위치**: `codebase/frontend/src/components/editor/run-results/result-timeline.tsx:169`
- **증상**: result-timeline.tsx 169번 줄에서 maxTurns를 `convPayload?.conversationConfig?.maxTurns`에서 읽으나, backend ai-agent.handler.ts의 buildMultiTurnConfigEcho는 모든 종결 분기에서 maxTurns를 top-level `config.maxTurns`에만 echo 한다. 따라서 `output.conversationConfig` 는 존재하지 않아 항상 `?? 0` fallback으로 빠진다. 결과적으로 "Turn N/M" 표기에서 분모 M이 항상 0이 되어 "Turn 3/" 처럼 표시되거나 `maxTurns > 0` 조건(line 240)을 만족하지 못해 "/M" 표기가 완전히 숨겨진다.
- **기대 동작**: backend가 buildMultiTurnConfigEcho에서 echo한 top-level config.maxTurns를 frontend result-timeline.tsx가 읽어야 한다. 구조는 `{ config: { maxTurns: 5, ... }, output: { result: { turnCount: 2, ... }, ... } }` 이므로, result-timeline.tsx는 result.outputData 의 "config" 필드(= top-level config)에서 maxTurns를 읽어야 한다. 또는 applyExecutionSnapshot.ts의 buildConvConfigFromStructured 패턴(line 340)을 따라 config와 output.result 를 병합한 conversationConfig 를 outputData에 포함시켜야 한다.
- **수정 힌트**: result-timeline.tsx line 162-169 의 maxTurns 도출 로직을 수정. 현재 `convPayload?.conversationConfig?.maxTurns` 대신, outputData의 top-level `config?.maxTurns` 를 읽도록 변경. 또는 outputData가 structured envelope 형태인 경우 applyExecutionSnapshot.ts:buildConvConfigFromStructured(outputData) 패턴을 재사용해 merged convConfig 를 구성한 후 그곳에서 maxTurns를 읽는다. 구현 시 rawForConv의 조건 분기(158-161줄)와 일관성 있게 refactor 필요.
- **근거(spec/plan)**: spec/conventions/data-hydration-surfaces.md §1.1 표 "output.result.turnCount (+ config.maxTurns)" 행 — "현재 코드는 분모를 `output.conversationConfig.maxTurns` 에서 읽으나 handler는 어떤 종결 분기에서도 `output.conversationConfig` 를 echo 하지 않아(top-level `config.maxTurns` 에만 존재) `ResultTimeline` 분모는 `0` fallback으로 빠진다(별도 추적)". 관련 backend: codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts line 2529 buildMultiTurnConfigEcho + line 2488-2550 buildMultiTurnFinalOutput. 동일 문제 해결 선례: spec §D6 (apply-execution-snapshot.ts line 329-343 buildConvConfigFromStructured)

### C-19. KB 삭제 시 S3 정리 루프가 workspace 필터 없이 문서 조회  — ✅ FIXED (this PR)

- **위치**: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:647-648`
- **증상**: remove() 메서드가 KB 소유권은 workspace로 검증한 뒤(findById line 645), S3 정리 루프에서만 documentRepository.find({where: {knowledgeBaseId: id}})로 workspace 필터 없이 document들을 조회. 코드는 동작하나(FK 제약으로 인해 DB 레벨에서 관련 문서만 존재), 설계의도(defense-in-depth 명시적 workspace 권한검증)와 불일치.
- **기대 동작**: documentRepository.find() 호출이 knowledgeBaseId뿐 아니라 workspace 권한 검증도 포함해야 함. 최소한 JOIN을 통해 KB→Workspace 관계를 명시적으로 선언하거나, 쿼리 조건에 workspace_id를 포함. spec/data-flow/4-file-storage.md의 Rationale "workspace 격리는 DB 권한 검증으로 보장"의 취지와 정합.
- **수정 힌트**: 1) KB 소유권 검증 후에도 document 조회 시 workspace 필터 추가: documentRepository.find({where: {knowledgeBaseId: id, knowledge_base: {workspaceId}}}) 또는 raw query로 JOIN 포함. 2) 또는 findDocument(docId, kbId, workspaceId) 헬퍼(라인 687-703)처럼 명시적 workspace 검증 로직 적용. 3) 코드 주석에 "workspace 격리는 findById pre-check로 보장"임을 명시하거나, 명확한 필터 추가.
- **근거(spec/plan)**: spec/data-flow/4-file-storage.md §3 'KB 삭제 시 S3 cleanup' + Rationale '워크스페이스 격리는 DB 권한 검증으로 보장'; review/spec-coverage/2026/06/03/08_05_49/findings/data-flow.md lines 131-141 (major finding: spec states orphan cleanup미구현이나 실제는 구현됨 vs doc 쿼리 workspace 필터 미기재)

---

## 비고
- A/B 는 planner, C 는 developer 가 picking. C 항목 처리 시 대응 spec 의 `partial` status·`pending_plans`(spec-sync-*-gaps.md)를 함께 정리(구현 완료 시 implemented 승격).
- 전체 근거: `review/spec-coverage/2026/06/03/08_05_49/SUMMARY.md` + `findings/<area>.md` + 각 `plan/in-progress/spec-sync-*-gaps.md` 스텁.
