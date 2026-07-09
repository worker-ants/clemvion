### 발견사항

- **[WARNING]** `driveResumeFrame` 재진입 지점의 신규 주석이 `resumeGraphAfterRetry` 를 근거로 잘못 인용 — 그 함수는 정확히 반대 동작을 한다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2417-2419` (`driveResumeFrame` 내부 `runNodeDispatchLoop` 호출부)
  - 상세: 신규 주석은 `// Durable trigger input on re-entry (see runNodeDispatchLoop caller in resumeGraphAfterRetry) — keeps Manual Trigger output.parameters intact.` 라고 적어, `durable input(savedExecution.inputData ?? {})` 재사용 패턴의 근거를 `resumeGraphAfterRetry`(`retry-turn.service.ts`)에서 확인하라고 안내한다. 그러나 같은 diff 로 `retry-turn.service.ts:564-573`(`resumeGraphAfterRetry` 가 호출하는 `runNodeDispatchLoop` 지점)에 추가된 주석은 정확히 **그 반대**를 말한다 — "input 은 retry 경로엔 의미 없으므로 빈 객체 — **의도적으로** 다른 재진입 경로(`driveResumeAwaited`/`driveResumeFrame`/`driveStuckRedrive`)와 달리 `savedExecution.inputData` 를 쓰지 않는다." 즉 `resumeGraphAfterRetry` 는 이 PR 이 고친 3개 지점에서 명시적으로 **제외된** 4번째 지점이다. `driveResumeFrame` 주석을 따라가 `resumeGraphAfterRetry` 를 열어 본 유지보수자는 "durable input 재사용" 근거가 아니라 "왜 여기는 그렇게 하지 않는지"를 설명하는 정반대 텍스트를 만나 혼란을 겪는다. 문맥상 원래 의도한 참조 대상은 상세 설명이 실제로 존재하는 `driveResumeAwaited`(2067-2075행)로 보인다 — "resumeGraphAfterRetry" 는 오기(誤記)로 판단된다. 이 파일의 durable-input 불변식은 이번 PR 의 핵심 버그 수정 대상이므로, 잘못된 교차 참조가 향후 이 로직을 다시 건드릴 때 (3곳은 통일, 1곳은 의도적 예외라는) 불변식을 오인시켜 회귀를 재유발할 위험이 있다.
  - 제안: `resumeGraphAfterRetry` → `driveResumeAwaited` 로 정정하거나(가장 상세한 설명이 있는 지점), 아예 공유 헬퍼로 추출해 세 지점이 동일 문구/함수를 참조하도록 한다(마인테이너빌리티 리뷰가 이미 제안한 헬퍼 추출과 동일 방향).

- **[INFO]** spec 문서 동기화 갭이 여전히 열려 있음 — 단, 별도 plan 문서로 적절히 추적됨 (이전 라운드 대비 회귀 아님)
  - 위치: `spec/4-nodes/7-trigger/1-manual-trigger.md:161-179` (§6 에러코드 표 "시점"/"처리 위치" 컬럼), `spec/data-flow/11-workflow.md:44-45`(`POST /:id/save` 시퀀스 노트)
  - 상세: 이번 diff 로 신설된 저장 시점 게이트(`workflows.service.ts` `validateManualTrigger` → `400 INVALID_TRIGGER_PARAMETERS`)는 spec §6 표가 "handler.validate (저장 시점)" 이라는 개념적 시점만 언급할 뿐(실제로는 `handler.validate()` 를 호출하지 않고 같은 하위 헬퍼 `validateTriggerParameterSchema` 를 `WorkflowsService` 가 직접 재호출), 실제 HTTP 코드·엔드포인트·`restoreVersion` 예외를 명시하지 않는다. `data-flow/11-workflow.md` 의 저장 시퀀스도 이 400 분기를 반영하지 않는다. 다만 이번 라운드에서 `plan/in-progress/spec-update-manual-trigger-save-time-error-code.md` 가 신규 작성돼, 반영 대상 spec 위치·항목을 구체적으로 열거하는 정식 후속 plan 으로 격리됐고(단순 "project-planner 위임" 한 줄이 아니라 체크리스트를 갖춘 독립 문서), `RESOLUTION.md`/impl-done consistency-check 가 이를 비차단(WARNING, BLOCK:NO)으로 명시적으로 처분했다 — 이전 라운드의 documentation/requirement/cross_spec/convention_compliance 리뷰가 지적한 동일 갭이 반복 지적된 것일 뿐 새로 발생한 문제는 아니다.
  - 제안: 조치 불요(이미 추적됨). 해당 follow-up plan 실행 시 §6 표에 저장 시점 행 추가 + `data-flow/11-workflow.md`/`5-system/3-error-handling.md`/`data-flow/10-triggers.md` 동기화를 잊지 말 것.

- **[INFO]** e2e 헤더 주석의 "documented limit" 인용이 여전히 부정확 (이전 라운드 INFO, 미수정 상태 유지 — 우선순위상 방치 타당)
  - 위치: `codebase/backend/test/manual-trigger-default-param.e2e-spec.ts:17-20`
  - 상세: "재진입 경로에서 `$input` 미해소, documented limit" 이라는 인용은 실제로는 AI Agent multi-turn retry 전용 메커니즘(`resolveRetryNodeConfig`, `spec/5-system/4-execution-engine.md:1387`)을 가리키며, 이번 e2e 가 실측으로 우회하는 stalled-redelivery 재진입 이슈(`driveStuckRedrive`)와는 다른 코드 경로다. 게다가 이번 diff 의 세 번째 hunk가 바로 `driveStuckRedrive` 의 `input: {}` 문제 자체를 고쳤으므로, "documented limit" 이 이 PR 로 이미 해소된 대상인지 여전히 남아있는 별개의 e2e 인프라 타이밍 이슈인지 문장만으로는 불분명한 상태가 그대로 남아 있다.
  - 제안: 낮은 우선순위 — 다음에 이 파일을 건드릴 때 "AI Agent retry 의 `$input` 미해소(별개 메커니즘)" 로 명시하거나, trigger-only 워크플로가 e2e 인프라에서 실제로 겪는 현상(빠른 완료로 인한 BullMQ stalled 판정 타이밍)으로 재서술.

- **[INFO]** CHANGELOG 항목의 `(a)/(b)/(c)` 레터링이 plan 문서의 동일 레터링과 다른 항목을 가리켜 교차 대조 시 혼동 소지
  - 위치: `CHANGELOG.md:35-40` (신규 Unreleased 항목) vs `plan/in-progress/manual-trigger-default-param.md:19-21` ("## 수정" 섹션)
  - 상세: CHANGELOG 는 "(a) 엔진 재진입 input 소실 / (b) 트리거 조회 / (c) 저장 검증" 순서로 레터링하지만, plan 문서는 동일 알파벳을 "(c) 엔진 재진입 input [진짜 핵심] / (b) 조회 by type [PRIMARY] / (a) 프론트 영속(되돌림, ai-review CRITICAL)" 로 정반대로 배정했다(CHANGELOG 의 (a)가 plan 의 (c)). 두 문서 모두 독립적으로 읽으면 내용은 정확하지만, 같은 작업의 근본원인을 추적하려는 독자가 plan → CHANGELOG 순으로 넘어갈 때 레터링이 뒤집혀 있어 "어느 원인이 진짜 핵심이었는지" 재확인이 필요해진다.
  - 제안: 조치 불요(사소) — CHANGELOG 는 사용자 서술 순서, plan 은 조사 발견 순서로 서로 다른 관례를 따른 것으로 보이며, 각 문서가 자기완결적이라 실질적 혼란은 낮다. 향후 유사 항목 작성 시 레터링 재사용을 피하거나 plan 순서를 따르면 더 좋다.

- **[INFO]** CHANGELOG·JSDoc·spec §4/§5.1/§6 상호 인용의 실측 정확도는 양호
  - 위치: `CHANGELOG.md:35-40`, `codebase/backend/src/modules/execution-engine/utils/load-trigger-parameter-schema.ts:1-27`, `spec/4-nodes/7-trigger/1-manual-trigger.md:75-104,155-183`
  - 상세: CHANGELOG 가 인용하는 spec §4(실행 로직)·§5.1(Manual/Schedule 출력 구조)·§6(에러 코드) 섹션 번호·내용이 실제 spec 과 정확히 대응함을 확인했다(§4 는 사전 해석 5단계, §5.1 은 `output.parameters` shape, §6 은 `invalid_schema`/`missing_required` 표). `restoreVersion` 예외(`skipParamSchemaValidation`) 설명, AI multi-turn retry 제외 근거(spec `5-system/4-execution-engine.md:1387` "documented limitation")도 실제 spec 문구와 부합한다. `load-trigger-parameter-schema.ts` 의 JSDoc 은 "왜"(category 컬럼 누락 실데이터, 프론트 `is-trigger.ts` fallback 과의 대칭)를 정확하고 충분히 설명한다.
  - 제안: 조치 불필요.

- **[INFO]** 이전 라운드에서 지적된 CHANGELOG 누락·plan 체크리스트 stale 항목은 이번 라운드에서 해소 확인
  - 위치: `CHANGELOG.md`(신규 Unreleased 항목 추가됨), `plan/in-progress/manual-trigger-default-param.md:40`
  - 상세: 이전 라운드(11:08:21) documentation 리뷰가 지적한 두 WARNING — "CHANGELOG 미갱신"과 "plan 체크리스트가 완료된 프론트 테스트를 반영 못함" — 은 이번 라운드에서 각각 CHANGELOG 항목 추가, 그리고 해당 프론트 테스트/구현 자체가 spec(ED-SP-05) 위반으로 되돌려지면서 체크박스가 "미완료"로 남는 것이 오히려 정확한 상태가 되어 해소됐다. 새로 되돌려진 코드에 대한 stale 주석/문서 잔재는 발견되지 않았다(`node-settings-panel.tsx` 는 순수 revert로 diff 없음).
  - 제안: 조치 불필요. 참고 기록.

### 요약

이번 라운드(13:13:36)는 이전 ai-review(11:08:21) 의 Critical 1건(스펙 위반 즉시 커밋)을 되돌리고 Warning 다수(CHANGELOG 누락, plan stale, retry-turn 교차주석 등)를 반영한 결과물이다. 문서화 관점에서는 그 fix 들이 대체로 정확하고 실측(spec 대조)과 일치하나, 새로 추가된 주석 하나가 실제로 잘못된 대상을 가리킨다 — `driveResumeFrame` 의 durable-input 주석이 "resumeGraphAfterRetry" 를 근거로 인용하지만 그 함수는 이 PR 이 의도적으로 배제한, 정반대 동작을 하는 4번째 재진입 지점이다. 이는 이 PR 의 핵심 불변식(재진입 시 durable trigger input 재사용 여부)에 대한 향후 유지보수자의 오해로 직결될 수 있어 WARNING 으로 표시한다. 그 외에는 이미 별도 plan 문서로 적절히 격리·비차단 처리된 spec 동기화 갭(저장 시점 에러코드 문서화)과, 이전 라운드부터 남아있는 사소한 e2e 주석 부정확성(INFO, 우선순위 낮음) 정도이며, 신규 CHANGELOG 항목·JSDoc·spec 인용의 실측 정확도는 양호했다.

### 위험도

LOW
