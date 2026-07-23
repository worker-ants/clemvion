# 요구사항(Requirement) 리뷰 — presentation `previousOutput` 폐기 서술 정정

대상: `plan/in-progress/presentation-previousoutput-spec-drift.md` (project-planner spec draft) +
`spec/4-nodes/6-presentation/{0-common,3-chart,4-form}.md` 실 편집 + sibling plan 동기화
(`plan/in-progress/node-output-redesign/{chart,form,README}.md`) + consistency-check 산출물 6종.
순수 문서(spec/plan/review) 변경 — 코드 diff 없음.

## 발견사항

- **[CRITICAL]** `4-form.md` 의 신규 캐비어가 Form 노드의 실제 구현과 정면 모순 — Form 의 resumed 출력은 `previousOutput` 을 **전혀 주입하지 않는다**
  - 위치: `spec/4-nodes/6-presentation/4-form.md:260-262` (diff 게이트 260-262, "전체 파일 컨텍스트" 게이트와 동일 — `git rev-parse HEAD:spec/4-nodes/6-presentation/4-form.md` = `d653e78831…`, diff 대상 해시와 일치 확인)
  - 상세: 새로 추가된 문구는 "`output.previousOutput` 은 위 금지 목록과 성격이 다르다 — 폐기 예정이나 resume 경로가 재개 출력에 **지금도 주입한다** ([node-output §4.2] 과도기 예외)" 라고 단정한다. 그러나 실측 결과:
    1. Form 의 resumed 출력을 만드는 **유일한** 코드 경로는 `codebase/backend/src/modules/execution-engine/form-interaction.service.ts` 의 `waitForFormSubmission()` 이며, 실제 반환 객체(`updatedStructured`, `form-interaction.service.ts:254-266`)는 `{ config, output: { interaction }, status, port, meta? }` 5개 키만 갖는다 — `previousOutput` 키가 코드 어디에도 없다.
    2. `previousOutput` 을 실제로 주입하는 코드는 `button-interaction.service.ts` 의 `buildResumedStructuredOutput()` 뿐이며(`:254-296`, 특히 `:294` `previousOutput: prevOutput`), 이 함수의 **유일한 호출부**는 같은 파일 `:520`(`resolveButtonInteraction` 경로) 로, `button_click`/`button_continue` 인터랙션 전용이다. Form 은 `config` 에 `buttons`/`ButtonDef` 필드 자체가 없다(`form.schema.ts:178` 주석: "Form has no buttons array on its config") — 따라서 Form 은 `ButtonInteractionService` 경로에 **도달할 수 없다**. `park-entry-dispatch.ts` 의 `form → buttons → ai` first-match-wins 우선순위도 노드 타입별로 form 과 buttons 를 상호 배타로 다룬다.
    3. 이 caveat 이 SoT 로 인용하는 `spec/conventions/node-output.md:194` 자체가 이미 "**carousel/chart/table/template**의 `output.previousOutput` → 제거 ... 단 Phase 3 완료 전 과도기 예외: presentation resume 경로(`ButtonInteractionService`)는 ..." 라고 **명시적으로 form 을 제외**한 채 스코프를 4종으로 한정하고 있다. 즉 이 diff 는 자신이 인용하는 SoT 와 직접 모순되는 캐비어를 만들었다.
    4. 원문(diff 이전 텍스트, `previousOutput` 을 "금지 필드" 목록에 그대로 둔 상태)이 오히려 Form 에 대해서는 **사실과 일치**했다 — Form 은 이 필드가 정말로 한 번도 나타나지 않는다. 이번 정정이 "완전 폐기 → 신규 소비 금지(과도기 보존)" 로 시제를 바로잡으려던 3개 노드(chart/carousel/table, 및 template)에는 옳지만, **Form 에 그대로 복사-적용**하면서 새로운 오류를 만들었다.
    5. 이 문서가 목표로 삼은 `/consistency-check` 5개 서브에이전트(cross_spec, rationale_continuity, convention_compliance, plan_coherence, naming_collision) 는 모두 `button-interaction.service.ts` 코드 주석과 `node-output.md §4.2` 문구까지는 실측했지만, `ButtonInteractionService` 가 **노드 타입별로 어디까지 적용되는지**(즉 Form 이 애초에 이 경로를 타지 않는다는 사실)는 검증하지 않아 이 오류를 놓쳤다.
  - 제안: `spec/4-nodes/6-presentation/4-form.md:258-262` 를 되돌려 `output.previousOutput` 을 원래대로 "금지 필드"(=Form 에는 존재하지 않는 필드) 목록에 유지한다. 굳이 각주를 달고 싶다면 "Form 은 `ButtonInteractionService` 경로를 타지 않으므로 이 필드가 실제로 등장하지 않는다(carousel/chart/table/template 전용 과도기 예외 — [node-output §4.2] 참조)" 처럼 **제외를 명시**하는 방향으로 수정해야 한다. 이 수정은 `spec/` 편집이므로 `project-planner` 담당.

- **[CRITICAL]** 동일 오류가 sibling plan `node-output-redesign/form.md` 에도 동기 반영되어 전파됨
  - 위치: `plan/in-progress/node-output-redesign/form.md:77-79`
  - 상세: `- ~~output.previousOutput~~ — 예외: 폐기 예정이나 resume 경로가 재개 출력에 지금도 주입한다 ([node-output §4.2] 과도기 예외). 신규 소비 금지, Phase 3 정리 시 제거.` 위와 동일한 근거로 Form 에는 사실이 아니다. 이 plan 문서는 원래 (`chart.md:46`, `form.md:73-77`, `README.md:263`) 를 "previousOutput 완전 폐기" 오기재로 지적한 `plan_coherence` WARNING #1 을 해소하려던 동기화 작업의 일부였는데, 정작 Form 항목만 새 오류로 교체됐다. `chart.md:46-49` 의 동일 패턴 정정(Chart 는 실제로 buttons 를 지원하므로 `ButtonInteractionService` 경로를 탐 — 정확)과 대조적이다.
  - 제안: 위 CRITICAL 과 함께 `node-output-redesign/form.md:77-79` 도 되돌리거나 "Form 은 해당 안 됨"으로 재정정.

- **[WARNING]** `0-common.md` 의 공통 캐비어는 `ButtonInteractionService` 를 명시해 기술적으로는 정확하지만, Form 문서에서 참조될 때 스코프가 재확인되지 않음
  - 위치: `spec/4-nodes/6-presentation/0-common.md:138-143`
  - 상세: "presentation resume 경로(`ButtonInteractionService`)가 재개 출력에 지금도 주입한다" 는 서비스명을 명시했으므로 정독하면 Form(=`FormInteractionService`)이 배제됨을 유추할 수 있어 위 CRITICAL 만큼 심각하지는 않다. 그러나 `0-common.md` 는 5개 presentation 노드 문서가 공통 참조하는 문서이고, `4-form.md:261` 은 이 공통 문서를 링크하면서 "resume 경로가" 라고만 쓰고 서비스명을 생략해 스코프 정보를 잃어버렸다 — 위 CRITICAL 의 직접 원인이다.
  - 제안: `0-common.md` 캐비어 자체에도 "(Form 의 `FormInteractionService` 경로는 해당 없음)" 같은 명시적 배제 문구를 추가하면 하위 문서 저자가 실수로 전체에 적용하는 것을 방지할 수 있다.

- **[INFO]** 그 외 4곳 중 3곳(`0-common.md` 캐비어, `3-chart.md:230-232`, `3-chart.md:275`)은 코드와 실측 대조 결과 정확함
  - 상세: Chart 는 `config.buttons`(ButtonDef[])를 지원하고 Blocking Mode 진입 시 `ButtonInteractionService.buildResumedStructuredOutput()` 경로를 실제로 타므로(§3.2/§4 step 6), `previousOutput` 여전히 주입 주장이 Chart 에는 정확하다. `node-output.md:194`(6종 vs `retry_last_turn` 관련 서술 아님, §4.2), `execution-engine.md:893,1162`(Continuation Bus "6종" 명시), `ai-turn-orchestrator.service.ts` 의 `processAiResumeTurn`/`PARK_RELEASED` no-op park 패턴("동반 정정 A/B")도 모두 실측 코드와 라인 단위로 일치함을 확인했다. 이 부분은 조치 불요.

- **[INFO]** consistency-check 5종 서브에이전트가 제기한 WARNING 2건(plan_coherence sibling 동기화 누락, convention_compliance dangling 트리거 링크)은 이번 커밋에서 실제로 해소됐음을 확인
  - 상세: `git log`(`ffaa5e506`) 기준 `node-output-redesign/{chart,form,README}.md` 3곳이 실제로 동기 정정됐고(위 CRITICAL 로 인해 form.md 만 오류를 재도입), 트리거 링크는 target 문서 상단에 판정 문구를 self-contained 인용해 두어 dangling 문제를 완화했다. 다만 `review/consistency/2026/07/23/15_33_52/` 자체는 여전히 이 worktree 에 존재하지 않아(재확인: `git log --all` 결과 없음) 링크로서는 여전히 dangling — 인용문으로 대체됐으므로 실질 영향은 낮음, 조치 불요.

## 요약

이 diff 는 `previousOutput` 필드에 대한 presentation spec 4곳의 "완전 폐기" 오기재를 "신규 소비 금지 — 과도기 보존" 으로 정정하려는 project-planner 작업이며, `0-common.md`·`3-chart.md`(2곳)·"동반 정정 A/B"(Continuation Bus 5종→6종, `processAiResumeTurn`/no-op park 함수명 정정) 는 코드·기존 SoT(`node-output.md §4.2`, `execution-engine.md §7.4/§9.3`) 와 line-level 로 정확히 일치함을 실측 확인했다. 그러나 **`4-form.md:260-262`(및 이를 그대로 복제한 sibling `node-output-redesign/form.md:77-79`)는 정반대의 새로운 오류를 도입한다** — Form 의 resumed 출력을 만드는 유일한 코드 경로(`FormInteractionService.waitForFormSubmission`, `form-interaction.service.ts:254-266`)는 `previousOutput` 을 전혀 주입하지 않으며, 이는 이 diff 가 인용하는 SoT(`node-output.md:194`)가 애초에 "carousel/chart/table/template" 로만 스코프를 한정하고 form 을 배제한 것과도 직접 모순된다. 즉 원래(수정 전) `4-form.md` 문구("previousOutput 은 금지 필드")가 Form 에 대해서는 정확했고, 이번 "정정" 이 그것을 부정확하게 바꿔놓았다. `/consistency-check` 5개 서브에이전트 전원이 이 노드 타입별 스코프 차이를 검증하지 못해 이 오류를 놓쳤다. `spec/` 편집이 필요하므로 조치는 `project-planner` 담당(developer 는 `spec/` read-only).

## 위험도
HIGH
