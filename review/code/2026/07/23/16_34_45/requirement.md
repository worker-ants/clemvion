# 요구사항(Requirement) 리뷰 — presentation `previousOutput` 폐기 서술 정정 (2차, RESOLUTION 반영 후)

대상: `spec/4-nodes/6-presentation/{0-common,3-chart,4-form}.md` (spec 본문, 이번 diff 의 SoT) +
sibling plan `plan/in-progress/node-output-redesign/{chart,form,README}.md` +
신규 plan draft `plan/in-progress/presentation-previousoutput-spec-drift.md` +
1차 리뷰 산출물 `review/code/2026/07/23/16_18_02/{SUMMARY,RESOLUTION,requirement,documentation,meta,_retry_state}` +
`review/consistency/2026/07/23/15_59_12/**`. 순수 문서(spec/plan/review) 변경 — 코드 diff 없음.

## 검토 방법

1차 리뷰(`16_18_02`)에서 발견된 CRITICAL 2건·WARNING 2건이 `RESOLUTION.md` 주장대로 실제로 고쳐졌는지
diff 가 아니라 **현재 워크트리의 실제 파일**(`git log` 최신 커밋 `df8325862`)을 직접 Read/grep 하여
line-level 로 재검증했다. 아울러 이번 diff 가 인용하는 SoT(`node-output.md §4.2`,
`execution-engine.md §7.4/§9.3`)와 실제 코드(`button-interaction.service.ts`,
`form-interaction.service.ts`, `ai-turn-orchestrator.service.ts`, `table.handler.ts`,
`template.handler.ts`)를 대조했다.

## 발견사항

- **[WARNING]** `README.md:263` 자기모순 — 1차 리뷰 WARNING #1 이 `RESOLUTION.md` 에서 "반영" 으로
  표기됐으나, 실제 코드는 그 서술대로 고쳐지지 않았다
  - 위치: `plan/in-progress/node-output-redesign/README.md:263`
  - 상세: `RESOLUTION.md`(`review/code/2026/07/23/16_18_02/RESOLUTION.md:35`)는 이 WARNING 을
    "인라인 캐비어를 제거해 목록을 원상 복구하고, 결론부 뒤에 예외를 별도 문장으로 분리 …
    `chart.md`/`form.md` 와 같은 **'목록 분리 + 각주'** 패턴으로 통일" 했다고 주장한다. 그러나
    실제 `README.md:263` 문면은:

    > "...`output.view` 래퍼 폐기, `output.previousOutput` **폐기**, Switch `meta.value` ... 등
    > 1차 초안의 핵심 정리 항목은 **모두** spec 본문에 **반영 완료**. 단 `output.previousOutput` 은
    > 예외 — `ButtonInteractionService` 재개 경로(carousel/chart/table/template)가 **지금도
    > 주입**하며 `node-output.md §4.2` 의 과도기 예외로 Phase 3 까지 보존된다(신규 소비 금지).
    > Form 은 해당 없음."

    `chart.md:46-49`/`form.md:77-78` 는 `previousOutput` 을 "폐기" 열거 목록에서 **완전히 제거**하고
    별도 블록으로 뺐다(진짜 "목록 분리"). 반면 `README.md:263` 는 `output.previousOutput` **폐기**
    라는 문구를 열거 목록 안에 **그대로 남긴 채** 뒤에 예외 문장만 덧붙였다 — 목록에서 분리되지
    않았다. 그 결과 한 문장 안에서 "previousOutput 폐기"(완료된 사실) → "모두 반영 완료"(전부 끝났다)
    → "단, previousOutput 은 예외 — 지금도 주입한다"(사실 안 끝났다) 로 이어지는 자기모순이 형태만
    바뀐 채(인라인 괄호 → 별도 문장) 그대로 남아 있다. 1차 리뷰가 지적한 핵심 결함
    ("이미 제거된 것처럼 읽히는 문서")이 실질적으로 해소되지 않았다. `RESOLUTION.md` 의 "반영" 표기와
    실제 diff 사이에 괴리가 있다 — WARNING 을 처리했다는 서술 자체가 부정확하다.
  - 제안: `previousOutput` 을 열거 목록(`output.previousOutput 폐기` 부분)에서 실제로 제거하고
    `chart.md`/`form.md` 와 동일하게 별도 각주 블록으로 완전히 분리한다. 예:
    `"... output.view 래퍼 폐기, Switch meta.value ... 등 핵심 정리 항목은 spec 본문에 반영
    완료(단 previousOutput 은 별도 — 아래 참조)."` + 별도 줄에 "`previousOutput` 은 위 목록과 다르다
    — ..." 블록.

- **[INFO]** 나머지 spec 본문(`spec/4-nodes/6-presentation/{0-common,3-chart,4-form}.md`) 및
  sibling `chart.md`/`form.md` 는 code-level 로 정확함을 실측 확인 — CRITICAL 없음
  - 상세: 1차 리뷰의 CRITICAL 2건(Form 에 `previousOutput` 이 지금도 주입된다는 오기재)은 이번
    커밋(`df8325862 fix(spec): Form 은 previousOutput 과도기 예외 대상이 아님`)에서 정확히 원복됐다.
    line-level 대조 결과:
    - `spec/4-nodes/6-presentation/4-form.md:260-264` — "Form 은 해당하지 않는다 … 완전한 금지
      필드가 맞다" 로 정정. `codebase/backend/.../form-interaction.service.ts:254-266`
      (`updatedStructured` 는 `{config, output:{interaction}, status, port, meta?}` 뿐,
      `previousOutput` 키 부재) 와 실측 일치.
    - `plan/in-progress/node-output-redesign/form.md:77-78` — sibling 도 동일하게 정정, spec 과
      동기.
    - `spec/4-nodes/6-presentation/0-common.md:138-149` — `ButtonInteractionService` 적용 범위를
      "carousel / chart / table / template" 로 명시하고 "Form 은 해당 없음" 을 별도로 못박음(1차
      WARNING #2 반영). `codebase/backend/.../button-interaction.service.ts:254-299`
      (`buildResumedStructuredOutput`, `:294` `previousOutput: prevOutput`)의 유일 호출부가
      `resolveButtonInteraction`(`button_click`/`button_continue` 전용) 임과 일치. `table.handler.ts:179`,
      `template.handler.ts:54` 에서 `config.buttons` 를 실제로 지원함을 확인해 스코프 열거가 정확함을
      재확인.
    - `spec/conventions/node-output.md:194` — "현재 carousel/chart/table/template 의
      `output.previousOutput` → 제거 … 단 Phase 3 완료 전 과도기 예외: `ButtonInteractionService`
      는 … 보존" 문구가 이번 diff 가 인용하는 그대로 존재 — SoT 인용 정확.
    - `spec/4-nodes/6-presentation/3-chart.md:225-232`, `:272-275` — Chart 는 실제로 `config.buttons`
      지원(`3-ai` 무관, `table.handler.ts`/`template.handler.ts` 와 동형 패턴) → `previousOutput`
      "지금도 주입" 주장이 Chart 에는 정확.
    - `0-common.md:406-409, 441` — Continuation Bus 메시지 타입 "5종→6종"(`retry_last_turn` 추가)
      정정은 `spec/5-system/4-execution-engine.md:893,1162` 가 이미 "6종" 으로 명시(§7.4/§9.3, 앵커
      `#93-bullmq-큐-목록` 실제 헤딩과 일치)와 대조해 정확. `0-common.md:14` 의 무관 앵커
      (`#9-presentation-노드-5종`, PRD 노드 종류 수)는 미변경 확인.
    - `0-common.md:585-587` — `waitForAiConversation` → `processAiResumeTurn`, "loop 재진입" →
      "no-op park(재파킹)" 함수명/동작 정정은 `ai-turn-orchestrator.service.ts:211`
      (`async processAiResumeTurn`)·`:312-321`(미매칭 `action.type` → `logger.warn` + `reparkAiResumeTurn`
      → `PARK_RELEASED`, "silent skip 회피" 주석)과 정확히 일치.
  - 조치 불요 — 참고용 확인.

- **[INFO]** 비목표로 명시한 "`1-carousel.md`/`2-table.md`/`5-template.md` 에 `previousOutput`
  언급 없음" 주장도 실측 확인
  - 상세: `grep -n previousOutput` 결과 세 파일 모두 0건 — plan draft §비목표의 전제가 정확하다.
  - 조치 불요.

## 요약

이번 diff 는 1차 코드 리뷰(`16_18_02`)의 CRITICAL 2건(Form 에 대한 `previousOutput` 오기재)을 정확히
원복하고, WARNING #2(`0-common.md` 스코프 명시 누락)도 정확히 반영했다 — spec 본문
(`0-common.md`/`3-chart.md`/`4-form.md`)과 이를 미러링한 sibling plan(`chart.md`/`form.md`)은
`ButtonInteractionService`/`FormInteractionService`/`table.handler.ts`/`template.handler.ts`/
`ai-turn-orchestrator.service.ts`/`execution-engine.md §7.4·§9.3` 실제 코드·SoT 와 line-level 로
빠짐없이 일치함을 재확인했다. 다만 **WARNING #1(`README.md:263` 문장 내 자기모순)은
`RESOLUTION.md` 가 "반영" 으로 표기했음에도 실제로는 고쳐지지 않았다** — `chart.md`/`form.md` 처럼
`previousOutput` 을 열거 목록에서 완전히 분리하지 않고, "폐기" 문구를 목록에 그대로 둔 채 뒤에
예외 문장만 덧붙여 동일한 유형의 자기모순이 형태만 바뀌어 남아 있다. 이 항목의 plan 체크리스트는
이미 `[x]` 로 표기돼 있어 육안 검수 없이는 미해결 상태로 머지될 위험이 있다. 이는 spec 본문(SoT)의
정확성 문제는 아니고 plan 추적 문서 한 문장의 잔여 defect 이므로 기능적 영향은 없다.

## 위험도
LOW
