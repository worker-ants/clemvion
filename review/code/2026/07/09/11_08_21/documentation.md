### 발견사항

- **[WARNING]** `spec/data-flow/11-workflow.md` §1(`POST /:id/save` 시퀀스 노트)이 신규 저장 시점 파라미터 스키마 검증을 반영하지 못함
  - 위치: `spec/data-flow/11-workflow.md:45`, 대응 구현 `codebase/backend/src/modules/workflows/workflows.service.ts:576-608` (`validateManualTrigger`)
  - 상세: `11-workflow.md:45` 는 `POST /:id/save` 의 "DTO 사전 검증" 항목으로 "Manual Trigger 정확히 1개(누락/중복 시 400)"·"노드 label 중복 거부(`DUPLICATE_NODE_LABEL`)" 두 가지만 나열한다. 이번 diff 는 바로 그 `validateManualTrigger` 함수(=이 노트가 가리키는 함수 그 자체)에 파라미터 스키마 구조 검증을 추가해 `400 INVALID_TRIGGER_PARAMETERS`(신규 응답)를 던지지만, 시퀀스 다이어그램 노트는 갱신되지 않았다. `spec/4-nodes/7-trigger/1-manual-trigger.md §6` 은 "handler.validate(저장 시점)"이라는 개념적 시점만 언급할 뿐 실제 엔드포인트/코드/위치를 명시하지 않으므로, 유일하게 이 흐름을 구체적으로 문서화하는 지점은 `11-workflow.md:45`인데 거기가 stale 해졌다.
  - 제안: `11-workflow.md:45` 노트에 "Manual Trigger `config.parameters` 구조 검증(빈 이름/식별자 위반/중복/타입 오류 시 400 `INVALID_TRIGGER_PARAMETERS`)" 항목을 추가.

- **[WARNING]** `INVALID_TRIGGER_PARAMETERS` 코드가 두 개의 서로 다른 엔드포인트·실패 사유에 재사용되는데 spec 이 이를 구분해 문서화하지 않음
  - 위치: `spec/4-nodes/7-trigger/1-manual-trigger.md:176`(§6 표, `workflows.controller.ts` — 실행 시점 `missing_required`), `spec/data-flow/10-triggers.md:47`(execute 시퀀스) vs. 신규 `codebase/backend/src/modules/workflows/workflows.service.ts:605`(저장 시점 `invalid_schema`, `saveCanvas`)
  - 상세: 기존 spec 은 `INVALID_TRIGGER_PARAMETERS` 를 오직 "Manual 실행(`POST /:id/execute`) 시 필수 파라미터 누락"의 응답 코드로만 문서화한다(§6 표 + `10-triggers.md` 시퀀스). 이번 diff 는 완전히 다른 엔드포인트(`POST /:id/save`)·다른 실패 조건(구조 위반, 실행 전)에 **동일한 top-level `code`** 를 재사용한다. `details[]` 의 필드 코드(`INVALID_SCHEMA` vs `MISSING_REQUIRED_FIELD`)로는 구분 가능하지만, 최상위 `code` 하나만 보는 클라이언트/문서 독자는 두 경로를 혼동할 수 있다.
  - 제안: spec §6 표에 "저장 시점(`POST /:id/save`, `saveCanvas`)에서도 동일 코드가 구조 위반(`invalid_schema`→`INVALID_SCHEMA`)에 재사용됨" 을 각주로 명시하거나, `data-flow/11-workflow.md` 저장 시퀀스에 별도 행을 추가.

- **[INFO]** save-time 검증 코드 주석이 "handler.validate" 를 인용하지만 실제로는 handler 를 호출하지 않음
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:590-597`
  - 상세: 신규 주석 "spec ... §6 places these structural checks at 저장 시점 (handler.validate)" 는 spec 문구를 그대로 인용한 것이지만, 실제 이 블록은 `ManualTriggerHandler.validate()` 를 호출하는 게 아니라 같은 하위 함수(`validateTriggerParameterSchema`)를 서비스 레이어에서 직접 재호출한다. 기능적으로는 동일 검증 로직을 공유해 정합성 문제는 없지만, "(handler.validate)" 라는 괄호가 향후 코드를 검색하는 개발자에게 "이 게이트는 노드 handler 의 validate() 를 거친다"는 오해를 줄 수 있다.
  - 제안: 주석을 "spec ... 이 규정한 저장 시점 게이트(handler.validate 와 동일한 `validateTriggerParameterSchema` 를 서비스 레이어에서 직접 재사용)" 처럼 명확히.

- **[WARNING]** `plan/in-progress/manual-trigger-default-param.md` 체크리스트가 같은 커밋에 포함된 테스트를 반영하지 못해 stale
  - 위치: `plan/in-progress/manual-trigger-default-param.md:40`
  - 상세: "`[ ] frontend: node-settings-panel config 편집 → store 커밋 + isDirty (해당 테스트 있으면 보강)`" 이 미체크 상태로 남아 있지만, 같은 diff(파일 8) 에 정확히 이 시나리오를 검증하는 `node-settings-panel-config-commit.test.tsx` 가 신규 추가되어 있다. plan 문서가 실제 작업 완료 상태를 반영하지 못해 다음 리뷰어/스스로가 "테스트 없음"으로 오판할 위험.
  - 제안: 해당 항목을 `[x]` 로 갱신하고 테스트 파일명을 명시.

- **[INFO]** `spec/4-nodes/7-trigger/1-manual-trigger.md` frontmatter `code:` 목록이 이번 fix 의 핵심 파일들을 누락
  - 위치: `spec/4-nodes/7-trigger/1-manual-trigger.md:3-8`
  - 상세: `code:` 글로브는 4개 파일(`manual-trigger.handler.ts`/`manual-trigger.schema.ts`/`resolve-trigger-parameters.ts`/`trigger-configs.tsx`)만 등재돼 있다. spec-impl-evidence 가드는 "≥1 매치"만 요구하므로 빌드는 통과하지만, 이번 diff 가 spec §4/§6 이 기술하는 동작(트리거 재진입 input 해소, 조회 방식, 저장 시점 검증)을 구현하는 `execution-engine.service.ts`, `load-trigger-parameter-schema.ts`, `workflows.service.ts` 는 목록에 없어 "spec 이 약속한 구현 surface"로서의 추적성이 약하다.
  - 제안: 위 3개 경로를 `code:` 에 추가 (선택, 강제 아님).

- **[INFO]** e2e 헤더 주석의 "documented limit" 인용이 실제로 이번 fix 가 해소한 대상과 다른 코드경로를 가리켜 혼란 소지
  - 위치: `codebase/backend/test/manual-trigger-default-param.e2e-spec.ts:14-20`
  - 상세: 주석은 "단일 노드 워크플로우는 실행이 너무 빨라 e2e 인프라의 stalled-redelivery 를 유발(재진입 경로에서 `$input` 미해소, documented limit)"이라고 trigger-only 대신 trigger→transform 그래프를 쓰는 이유를 설명한다. 그런데 코드베이스에서 "documented limit"/"$input 미해소" 로 실제 문서화된 지점은 `execution-engine.service.ts:5055`(`resolveRetryNodeConfig`, AI Agent retry-turn 의 config 재평가 전용 — `_retryState` 가 원본 nodeInput 을 보존하지 않는 별개 메커니즘)과 `spec/5-system/4-execution-engine.md:1387`/`spec/4-nodes/3-ai/1-ai-agent.md:951` 뿐이며, 이는 이번 diff 가 고친 `driveStuckRedrive`(§7.5 case B, stalled-redelivery 재구동)의 `input: {}` 문제와는 다른 코드 경로다. 오히려 이번 diff 의 세 번째 hunk(`execution-engine.service.ts` 3196행 부근, `driveStuckRedrive`)가 바로 "stalled-redelivery 재진입 시 Manual Trigger 의 input 이 사라지는" 문제 자체를 고쳤으므로, e2e 주석이 인용하는 "documented limit" 이 이 PR로 이미 해소된 대상인지 아니면 정말 별개의(여전히 남아있는) e2e 인프라 타이밍 이슈인지 불분명하다.
  - 제안: 주석을 "AI Agent retry 재진입의 `$input` 미해소(별개 메커니즘, `resolveRetryNodeConfig`)"를 인용하는 대신, trigger-only 워크플로가 e2e 인프라에서 실제로 겪는 현상(예: 완료가 너무 빨라 BullMQ stalled 판정 타이밍과 충돌)을 직접 서술하거나, 정확히 같은 이슈라면 이번 PR의 fix로 인해 더 이상 해당되지 않는지 재확인 후 갱신.

- **[WARNING]** CHANGELOG.md 미갱신 — 사용자 영향이 큰 버그 수정임에도 항목 없음
  - 위치: `CHANGELOG.md` (루트)
  - 상세: 저장소 관례상(`git log -- CHANGELOG.md`) "severe" 등급 사용자 영향 버그 수정(예: `9958f918b fix(editor): AI 노드 설정 UI 필드 누락 해소 (V-02, severe)`, `001561ef9 fix(invitations)`, `a8d63264e fix(web-chat)`)은 CHANGELOG "Unreleased" 항목을 동반해왔다. 이번 fix 는 Manual Trigger `defaultValue` 가 3중 독립 결함(엔진 재진입 input 소실·category 기반 조회 누락·프론트 미영속)으로 인해 **조용히** 전부 무시되던 문제로, 사용자 체감 영향이 크고 회귀 성격이 짙다. 그럼에도 이번 커밋(`5fd886a1f`)은 CHANGELOG.md 를 건드리지 않았다.
  - 제안: "Manual Trigger 파라미터 `defaultValue` 가 무시되던 버그" 를 요약한 Unreleased 항목 추가 (근본원인 3가지 + spec §6 저장 검증 hardening 요약).

- **[INFO]** `execution-engine.service.ts` 재진입 3개 지점의 주석 상세도가 서로 다름
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (2073행대 vs 2414행대 vs 3196행대)
  - 상세: 첫 번째 지점(2073행)은 근본원인·영향범위를 상세히 설명하는 반면, 두 번째(2414행)는 "see runNodeDispatchLoop caller in resumeGraphAfterRetry" 로 첫 지점을 참조하도록 축약, 세 번째(3196행)는 중간 분량으로 독립 서술한다. 세 지점 모두 정확하고 상호 모순은 없으나, 두 번째 주석의 "resumeGraphAfterRetry" 참조가 실제로 첫 번째 지점이 속한 함수명과 일치하는지 재확인 권장(리팩터 시 함수명이 바뀌면 참조가 stale 해질 위험).
  - 제안: 우선순위 낮음 — 특별한 조치 불필요, 향후 근처 코드 리팩터링 시 참조 정확성만 재확인.

- **[INFO]** 문서화 자체 품질은 양호
  - 위치: `codebase/backend/src/modules/execution-engine/utils/load-trigger-parameter-schema.ts:1-27`
  - 상세: JSDoc 이 이번 변경의 "왜"(category 컬럼 누락 실데이터, 프론트 `is-trigger.ts` fallback 과의 대칭)를 정확하고 충분히 설명한다. `resolve-trigger-parameters.spec.ts`/`load-trigger-parameter-schema.spec.ts` 회귀 테스트 이름도 의도를 잘 드러낸다. 특별한 조치 불필요.

### 요약

이번 diff 는 Manual Trigger `defaultValue` 미적용 버그의 3개 근본원인(엔진 재진입 input 소실·조회 방식·프론트 미영속) 수정과 hardening(저장 시점 스키마 검증, 프론트 인라인 이름 검증)을 다루며, 코드 주석·JSDoc 자체의 정확도는 대체로 높다(특히 `load-trigger-parameter-schema.ts` JSDoc 과 `execution-engine.service.ts` 재진입 지점 주석). 다만 spec 문서 갱신이 코드 변경을 완전히 따라가지 못한 지점이 있다 — `data-flow/11-workflow.md` 의 저장 시퀀스 노트가 신규 `INVALID_TRIGGER_PARAMETERS`(저장 시점) 경로를 반영하지 않고, 같은 에러 코드가 실행 시점과 저장 시점 두 곳에서 서로 다른 의미로 재사용되는데도 spec 이 이를 명시적으로 구분하지 않는다. plan 문서의 체크리스트도 이미 완료된 프론트 테스트 항목이 미체크로 남아 있어 self-tracking 이 stale 하다. CHANGELOG 는 저장소 관례(severe 버그 수정에 대한 Unreleased 항목)에 비추어 누락으로 보인다. 이 중 어느 것도 기능적 결함은 아니며 모두 문서·주석 정합성 개선 권고 수준이다.

### 위험도

LOW
