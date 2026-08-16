# 신규 식별자 충돌 검토 — `plan/in-progress/eia-fanout-and-internal-data-masking.md` (impl-prep, scope `spec/5-system/`)

## 검토 범위에 대한 메모

target 은 단일 diff 가 아니라 `spec/5-system/` 번들(주로 `2-api-convention.md`·`3-error-handling.md`·
`6-websocket-protocol.md`·`12-webhook.md`·`14-external-interaction-api.md`) + 실제 착수 대상인
`plan/in-progress/eia-fanout-and-internal-data-masking.md` 다. 이 plan 은 아직 코드/spec 본문을
전혀 건드리지 않은 순수 계획 단계(worktree `git status` 상 plan 파일 자체만 신규)이며, 체크리스트
A/B/D 전항목이 미착수(`- [ ]`)다. 따라서 "새로 도입되는 식별자" 는 대부분 **아직 이름이 확정되지
않았다** — 이 문서는 확정된 식별자의 충돌보다는 **명명 결정 시점에 참고해야 할 기존 네임스페이스**를
정리하는 데 무게를 뒀다.

## 발견사항

- **[WARNING]** 신설될 "두 fanout 브랜치 공유 헬퍼"의 이름이 아직 없다 — 기존 `redact*/strip*/sanitize*` 패밀리와 사전 대조 필요
  - target 신규 식별자: 체크리스트 `- [ ] A — 두 fanout 브랜치가 공유하는 단일 헬퍼 + deepRedactSecrets`(plan §작업 체크리스트) — 이름 미정
  - 기존 사용처: `codebase/backend/src/shared/utils/`
    - `redact-stored-error.ts:28` `export function redactStoredErrorForResponse(...)`
    - `terminal-error-payload.ts:122` `export function toTerminalErrorPayload(...)`
    - `sanitize-error-message.ts:67/127/183/200` `redactSecrets` / `deepRedactSecrets` / `redactSecretsInJsonString` / `sanitizeLastErrorMessage`
    - `strip-external-only-fields.ts:101` `stripExternalOnlyFields`
    - `codebase/backend/src/modules/external-interaction/interaction.service.ts:99` **모듈-로컬**(비-export) `function stripAndRedact(value): Record<string, unknown> | null` — EIA 외부 `getStatus()` 가 `outputData` 에 strip+deepRedactSecrets 를 함께 거는 데 쓰는, target 이 하려는 일(§R17 잔여 ①②)과 **개념적으로 거의 동일한 선례**
  - 상세: A 항목은 `emitExecutionEvent`/`emitNodeEvent` 두 곳이 공유할 새 헬퍼를 만든다고만 적혀 있고 이름을 정하지 않았다. 이 저장소의 마스킹 계열 함수는 `redact*ForResponse` / `toTerminal*Payload` / `deepRedactSecrets` / `strip*OnlyFields` 네 가지 명명 패턴이 이미 자리 잡았고, 그 중 `stripAndRedact` 는 정확히 "strip 다음 deepRedactSecrets" 조합을 가리키는 이름으로 **이미 다른 모듈에 존재**한다(단 `interaction.service.ts` 안에서 비-export). 신규 헬퍼가 우연히 같은 이름(`stripAndRedact` 등)을 다른 모듈에 다시 만들면, 같은 이름의 서로 다른 구현체가 두 개 생겨 코드 리뷰·검색 시 혼동될 위험이 있다 — 이 저장소가 반복적으로 겪은 "자매 함수 미적용/불일치" 패턴(방어가 한 곳에만 좁게 적용되고 자매 위치가 다른 이름·다른 동작으로 따로 존재)과 같은 형태다.
  - 제안: 구현 착수 시 헬퍼 이름을 spec/plan 에 명시하고, (a) 기존 `deepRedactSecrets` 계열과 동일 명명 규칙(`redact*` 접두)을 따르거나 (b) `interaction.service.ts` 의 `stripAndRedact` 를 `export` 해 재사용하는 방안을 우선 검토할 것. 새 이름을 쓰더라도 `stripAndRedact` 재사용은 아니되 **동일 이름 재사용은 피할 것**.

- **[INFO]** 신설될 §R17 카탈로그 항목이 세 번째 "`error`" 마스킹 표면이 된다 — 표제에 대상 필드 명시 권장
  - target 신규 식별자: 체크리스트 `- [ ] spec — 14-external-interaction-api.md §R17 카탈로그 등재 + 잔여 ① flip`(plan §작업 체크리스트) — WS `execution.node.*` emit 의 `error` 마스킹을 새 R17 불릿으로 등재 예정
  - 기존 사용처: `spec/5-system/14-external-interaction-api.md` §R17 이 이미 `error` 를 이름으로 쓰는 두 개의 구분된 불릿을 갖고 있다 — ① `nodeOutput.conversationConfig` + terminal `result`/`error` 불릿(`getStatus` 가 `Execution.outputData` 로 조립하는 값), ② `execution.failed` payload 의 `error.message`/`error.details` — DB `Execution.error` 원문 불릿(2026-08-16 추가, "이름이 같아 혼동하기 쉽다" 라고 스스로 명시)
  - 상세: 이번에 추가될 세 번째 불릿(WS `execution.node.*` emit 의 `error`)은 위 두 표면과 또 다른 소스(런타임 `error` 필드, 노드 레벨 emit)를 가리킨다. 세 표면 모두 "`error`" 라는 동일 필드명을 공유하지만 소스 컬럼·표면·이미 결정된 마스킹 여부가 전부 다르므로, 새 불릿 표제에서 반드시 대상을 명시적으로 특정해야 한다(기존 ② 불릿이 이미 이 패턴을 따르고 있음 — 그대로 답습하면 됨).
  - 제안: 새 불릿 표제를 `execution.node.completed`/`execution.node.failed` **emit** 의 `error`(node-level, WS/SSE fanout) 처럼 필드 경로 + 표면을 함께 명시해, 기존 ①②와 나란히 놓였을 때 세 가지가 구분되게 작성할 것.

- **[INFO]** `spec/5-system/6-websocket-protocol.md` 의 기존 `### 4.4` 절 번호 중복(신규 아님, 이미 알려진 이연 항목) — target 이 같은 파일을 편집하므로 참고
  - target 신규 식별자: 해당 없음(target 이 새로 만드는 충돌이 아님)
  - 기존 사용처: `spec/5-system/6-websocket-protocol.md` — `### 4.4 사용자 입력 대기 이벤트 상세` (line ~1406, `execution.waiting_for_input` 상세, `§4.4.5`/`§4.4.6` 하위 인용 다수) 와 `### 4.4 알림 이벤트 (Server → Client)` (line ~1775, `notification.new`) 가 **같은 절 번호를 공유**한다. `plan/complete/spec-draft-ws-types-canonical-location.md:120` 이 "이번 diff 무관 기존 상태"로 이미 범위 밖 처리해 둔 항목이다.
  - 상세: target 체크리스트가 "spec — `6-websocket-protocol.md` fanout 마스킹 규정" 추가를 계획하고 있어(§4 부근에 내용이 들어갈 가능성이 높음), 이미 중복된 `§4.4` 라벨 공간에 세 번째 모호한 인용을 보태지 않도록 주의가 필요하다. 이는 target 이 새로 일으키는 충돌이 아니라 **기존에 이미 인지·이연된 결함**이므로 등급을 CRITICAL/WARNING 이 아닌 INFO 로 둔다.
  - 제안: 새 마스킹 규정 문단은 (기존 관행대로) `### 4.4 사용자 입력 대기 이벤트 상세` 안에 **캐비엇 문단**으로 붙이거나 `## Rationale` 항목으로 추가하고, 링크 인용 시 앵커 전체 슬러그(`#44-사용자-입력-대기-이벤트-상세-...`)를 써서 어느 4.4 인지 명확히 할 것. 절 번호 자체를 고치는 것은 이 plan 의 스코프가 아니다(기존 이연 결정 유지).

## 충돌 없음으로 확인된 항목

- **API endpoint**: target 은 신규 endpoint 를 추가하지 않는다(기존 `GET /api/executions/:id` 등 내부 REST 표면의 응답 필드만 마스킹). 충돌 없음.
- **파일 경로**: 체크리스트가 언급하는 `spec/5-system/6-websocket-protocol.md`, `spec/5-system/14-external-interaction-api.md` 는 실제 번들 파일 경로와 정확히 일치한다(오기 없음 — `4-execution-engine.md`/`5-expression-language.md` 사이 번호가 맞음).
- **환경변수**: target 은 신규 ENV var 를 도입하지 않는다.
- **요구사항 ID(EIA-XX-NN)**: target 은 신규 `EIA-*` 코드를 발급하지 않는다(§R17 은 번호형 요구사항 ID 가 아니라 산문 카탈로그이므로 코드 네임스페이스 충돌 대상이 아니다).
- **엔티티/함수명 재사용**: B 항목이 손대는 `toExecutionDto`/`toResponseExecution` 은 `codebase/backend/src/modules/executions/executions.service.ts` 에만 존재하는 private 메서드로 저장소 전역에 동명 충돌 없음.

## 요약

이번 followup plan(`eia-fanout-and-internal-data-masking.md`)은 순수 계획 단계이고 신규 endpoint·이벤트명·환경변수·요구사항 ID 를 전혀 도입하지 않는다 — 기존 마스킹 함수(`deepRedactSecrets`/`toTerminalErrorPayload`/`redactStoredErrorForResponse`/`stripExternalOnlyFields`)를 새 호출부(node/execution emit, `toExecutionDto`/`toResponseExecution`)에 적용하는 작업이라 endpoint·ID 축에서는 충돌 위험이 낮다. 다만 (1) 두 fanout 브랜치가 공유할 신규 헬퍼의 이름이 아직 정해지지 않아 기존 `redact*/strip*/sanitize*` 패밀리, 특히 개념이 거의 동일한 모듈-로컬 `stripAndRedact`(`interaction.service.ts`)와 동명 재사용을 피해야 하고, (2) §R17 카탈로그에 추가될 새 `error` 마스킹 불릿이 기존 두 개의 `error` 불릿과 나란히 놓이므로 표제에서 대상(필드 경로·표면)을 명시적으로 구분해야 하며, (3) target 이 편집할 `6-websocket-protocol.md` 에는 이미 알려진 `### 4.4` 절 번호 중복이 있어(기존에 범위 밖으로 이연됨) 새 내용을 그 주변에 보탤 때 참조 모호성을 늘리지 않도록 주의가 필요하다. 셋 다 착수 전에 결정/확인하면 되는 낮은 비용의 항목이며 CRITICAL 은 발견되지 않았다.

## 위험도

LOW
