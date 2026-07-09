### 발견사항

- **[WARNING]** `plan/in-progress/manual-trigger-default-param.md` 의 §테스트/§워크플로 체크가 라운드 2·3 ai-review 수정 내역을 반영하지 못해 stale
  - 위치: `plan/in-progress/manual-trigger-default-param.md` §테스트(37-40행), §워크플로 체크(44-48행)
  - 상세: `git log -- plan/in-progress/manual-trigger-default-param.md` 확인 결과 이 plan 파일은 `06681073b`(최초 작성)·`0b185cc8c`(라운드1 ai-review 되돌림)·`d4742f4c8`(라운드1 이후 consistency-check + spec-update follow-up 생성)까지만 갱신됐다. 이후 두 커밋 — `7454a817c`("ai-review round 2": `reentryWorkflowInput` 헬퍼 추출 + 결정적 재진입 회귀 e2e 케이스 신설) 와 `41663bebd`("ai-review round 3": `reentryWorkflowInput` 단위 테스트 신설 + `triggers.mdx`/`triggers.en.mdx` 유저가이드 동기화 + CHANGELOG §태그 정정 + `workflows.service.ts` cast 복원) — 는 plan 에 전혀 반영되지 않았다. 그 결과 §테스트 체크리스트는 지금도 "`load-trigger-parameter-schema.spec.ts`/`workflows.service.spec.ts`/`trigger-configs.test.tsx`" 3건만 나열하고, 실제로 존재하는 `execution-engine.service.spec.ts` 의 `reentryWorkflowInput` 회귀 가드 unit 테스트나 e2e 의 결정적 재진입(worker 크래시 합성) 케이스는 언급이 없다. §워크플로 체크의 "`/ai-review` (CRITICAL 1 + WARNING 11) — fix 완료 ... RESOLUTION.md 기록" 항목도 라운드1 결과만 기술해, 이후 두 차례 추가 재검토·수정이 있었다는 사실이 plan 만 봐서는 드러나지 않는다. plan-lifecycle 규약상 `plan/in-progress/*` 는 진행 중 작업의 SoT 이며 `complete/` 이관 전 체크리스트가 실제 작업 상태를 반영해야 하는데, 지금 상태로는 이 plan 만 읽는 사람이 "1차 ai-review 이후 추가 라운드가 없었다"고 오판할 수 있다.
  - 제안: `complete/` 이관 전에 §테스트/§워크플로 체크에 라운드 2·3 항목(헬퍼 추출, 신규 unit/e2e 테스트, 유저가이드 동기화, 3차 `BLOCK:NO`/`0 Critical` 재확인)을 추가해 최신화.

- **[WARNING]** spec 문서(§6 에러코드 표 · `data-flow/11-workflow.md` 저장 시퀀스 · frontmatter `code:` glob · `## Rationale`)가 이번 diff 에서도 갱신되지 않아, 저장 시점 `INVALID_TRIGGER_PARAMETERS` 발행 경로가 여전히 미문서화 상태
  - 위치: `spec/4-nodes/7-trigger/1-manual-trigger.md` §6, `spec/data-flow/11-workflow.md` L44-45, `spec/5-system/3-error-handling.md` L155, `spec/data-flow/10-triggers.md` L44-47
  - 상세: `git diff origin/main...HEAD -- spec/` 결과가 비어 있어(재확인 완료) 코드가 §6·`workflows.service.ts` `validateManualTrigger()`(신규 저장 시점 `400 INVALID_TRIGGER_PARAMETERS`)로 새로 구현한 동작이 아직 어떤 spec 문서에도 반영되지 않았다. 이 gap 은 이미 라운드1 documentation/api_contract/requirement 리뷰와 consistency-check(cross_spec/convention_compliance/naming_collision) 4곳이 독립적으로 WARNING 으로 지적했고, `plan/in-progress/spec-update-manual-trigger-save-time-error-code.md` 라는 6개 구체 항목(라인 위치까지 명시) 체크리스트로 project-planner 에 위임돼 있으며, `consistency-check --impl-done` 이 이미 `BLOCK: NO`(Critical 0, 해당 WARNING 재확인)로 판정했다. 즉 이번 PR 을 막을 사유는 아니다.
  - 제안: 병합 후 follow-up plan(`spec-update-manual-trigger-save-time-error-code.md`)이 실제로 project-planner 손을 거쳐 착수되는지 추적. 참고로 사용자 메모리 지침("Plan must include spec updates" — 구현 plan 은 spec 갱신까지 정식 phase 로 포함, 외부 위임 한 줄로 묶지 말 것)과 비교하면, 현재 구조는 owning plan 에 위임 한 줄만 남기고 별도 follow-up plan 으로 분리한 형태다. follow-up 자체는 라인 단위로 구체적이라 순수 책임 회피는 아니지만, 메모리가 선호하는 "동일 plan 내 정식 phase" 패턴과는 다르다는 점은 기록해 둔다(선택적 개선, 차단 아님).

- **[INFO]** `workflows.service.ts` 저장 시점 검증 주석이 여전히 "(handler.validate)" 를 인용하지만 실제로는 handler 를 호출하지 않음 — 라운드1에서 이미 지적된 사항, 이번 라운드에도 미수정
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:603-610`
  - 상세: "spec 4-nodes/7-trigger/1-manual-trigger.md §6 places these structural checks at '저장 시점' (handler.validate)" 주석은 spec 문구를 그대로 인용하지만, 이 블록은 `ManualTriggerHandler.validate()` 를 호출하지 않고 같은 하위 함수(`validateTriggerParameterSchema`)를 서비스 레이어에서 직접 재호출한다(확인: 해당 파일에 `handler.validate` 호출 없음). 기능적 회귀는 아니고(동일 SoT 함수 공유) 라운드1 documentation 리뷰가 이미 INFO 로 남긴 항목이 그대로 남아있다는 사실만 재확인.
  - 제안: 우선순위 낮음. 다음에 이 블록을 만지는 김에 "handler.validate 와 동일한 검증 헬퍼를 서비스 레이어에서 직접 재사용" 식으로 정정 권장.

- **[INFO]** `POST /:id/save` 의 Swagger `@ApiBadRequestResponse` 설명이 신규 실패 사유를 명시하지 않음 — 라운드1에서 이미 지적, 이번 라운드에도 미수정
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:440-442`
  - 상세: `saveCanvas` 는 여전히 "Manual Trigger 누락/중복 또는 입력값 검증 실패"라는 포괄적 문구를 쓴다. 같은 컨트롤러의 `execute` 엔드포인트(242행)는 "트리거 파라미터 검증 실패"로 더 구체적이다. 필수는 아니나 OpenAPI 문서 완결성 관점에서 비대칭.
  - 제안: 낮은 우선순위. 필요 시 "입력값 검증 실패 (그래프 검증·중복 라벨·Manual Trigger 파라미터 스키마 등)" 식으로 보강.

- **[INFO]** `reentryWorkflowInput` 사설(private) 헬퍼 추출 + JSDoc — 라운드1 maintainability 리뷰가 지적한 "3곳 중복 설명·언어 불일치(한/영 혼재)" 문제를 해소
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1434-1460`(신규 `reentryWorkflowInput`), 호출부 3곳(2093/2103, 2434-2435, 3215-3217행)
  - 상세: JSDoc 이 인용하는 함수명(`driveResumeAwaited`/`driveResumeFrame`/`driveStuckRedrive`, `retry-turn.service.ts` 의 `resumeGraphAfterRetry`)을 `grep` 으로 실제 코드와 대조한 결과 모두 정확히 일치한다. 이전 라운드에서 두 번째/세 번째 호출부만 영어로 축약 서술돼 언어가 섞였던 문제도, 이번 추출로 3곳 모두 동일한 짧은 한국어 참조 주석("workflowInput 규칙은 `reentryWorkflowInput` 참조")으로 통일됐다. `retry-turn.service.ts` 의 의도적 예외(AI multi-turn retry) 경로도 이 헬퍼의 JSDoc "의도적 예외" 절과 교차 참조돼 정합성이 확보됐다. 신규 unit 테스트(`execution-engine.service.spec.ts` `reentryWorkflowInput` describe 블록)도 durable inputData verbatim / null·undefined 폴백 두 케이스를 정확히 커버한다.
  - 조치 불필요 — 우수 사례로 기록.

- **[INFO]** e2e 헤더 주석이 재작성되어 라운드1 documentation 리뷰가 지적한 "documented limit(`$input` 미해소) 오인용" 문제 해소
  - 위치: `codebase/backend/test/manual-trigger-default-param.e2e-spec.ts:8-20`
  - 상세: 라운드1에서는 trigger-only 대신 trigger→transform 그래프를 쓰는 이유로 AI Agent retry 전용 "documented limit" 을 잘못 인용해 혼란을 유발했다. 현재 헤더는 그 인용을 제거하고 "`_test/simulate-execution-run-redelivery` 훅으로 '트리거 실행 전 크래시'를 결정적으로 합성해 검증(타이밍 비의존)" 이라고 정확히 서술한다. 파일 전체에서 "documented limit"/`$input` 미해소 표현도 더 이상 남아있지 않음을 확인(grep 재확인).
  - 조치 불필요.

- **[INFO]** 유저가이드(`triggers.mdx`/`triggers.en.mdx`) 가 신규 동작(저장 시점 거부 + 인라인 에러)을 반영해 ko/en 동시 갱신됨 — `i18n-userguide.md` 관례 부합
  - 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx:62`, `triggers.en.mdx:51`
  - 상세: 두 언어 Callout 이 나란히 "위반 시 편집기가 인라인으로 표시 + Save 도 거부(실행 전에 막힘)" 로 갱신됐고, 이전 문구("실행도 거부돼요")가 남아있던 stale 서술(라운드1 spec-update follow-up plan 이 "user_guide_sync WARNING" 으로 추적하던 항목)도 함께 해소됐다.
  - 조치 불필요.

- **[INFO]** CHANGELOG.md 에 Unreleased 항목이 신규 추가되어 라운드1 documentation 리뷰의 W11(CHANGELOG 누락)을 해소
  - 위치: `CHANGELOG.md:9-13`
  - 상세: 근본원인 3가지(엔진 재진입 input 소실/트리거 조회 방식/저장 검증 부재)를 한 문단으로 요약하고 spec SoT(`spec/4-nodes/7-trigger/1-manual-trigger.md §4/§5.1/§6`)를 명시한다. 형식(제목 라인 + "### 변경 사항" + 번호 목록 + 굵게 강조 리드 문장)이 파일 내 기존 항목들과 일관된다.
  - 조치 불필요.

- **[INFO]** `trigger-configs.tsx` 의 `PARAM_NAME_RE` 주석이 백엔드 규칙과의 중복을 스스로 명시("Mirror of the backend identifier rule")
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/trigger-configs.tsx:14-17`
  - 상세: 아키텍처 관점의 중복(별도 리뷰어가 이미 WARNING 으로 지적) 자체는 이 리뷰 범위 밖이지만, 문서화 관점에서는 저자가 그 중복을 숨기지 않고 정확히 어느 백엔드 파일(`resolve-trigger-parameters.ts`)을 미러링하는지 명시해 향후 drift 시 추적이 쉽다는 점은 긍정적이다.
  - 조치 불필요.

### 요약

이번 diff(라운드 2·3 ai-review 수정분 포함)는 라운드1 documentation 리뷰에서 지적된 항목 대부분을 실제로 해소했다 — CHANGELOG 항목 신설, 3개 재진입 호출부의 중복·언어 불일치 주석을 `reentryWorkflowInput` 단일 헬퍼 + JSDoc 으로 통합(함수명 인용은 `grep` 대조로 전부 정확함을 확인), e2e 헤더의 오인용 "documented limit" 정정, 유저가이드(ko/en) 동기화까지 모두 확인됐다. 다만 두 가지는 여전히 열려 있다: (1) `plan/in-progress/manual-trigger-default-param.md` 가 라운드 2·3 에서 실제로 이뤄진 작업(헬퍼 추출, 신규 unit/e2e 테스트, 유저가이드 동기화)을 체크리스트에 반영하지 못해 stale 하다 — `complete/` 이관 전 최신화가 필요하다. (2) spec 문서(§6 에러코드 표, `data-flow/11-workflow.md`, frontmatter `code:` glob, `## Rationale`)는 이번 diff 로도 갱신되지 않았는데, 이는 이미 4개의 독립 리뷰어/체커가 지적했고 project-planner 위임 follow-up plan 으로 추적 중이며 `consistency-check --impl-done` 이 `BLOCK: NO` 로 확인한 사안이라 병합을 막을 사유는 아니다. 그 외 `handler.validate` 주석 인용 부정확·Swagger 설명 포괄성은 라운드1부터 남아있는 저위험 INFO 로 재확인만 했다. 이 중 어느 것도 신규 CRITICAL 이 아니다.

### 위험도

LOW
