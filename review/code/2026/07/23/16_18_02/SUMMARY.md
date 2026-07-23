# Code Review 통합 보고서

## 전체 위험도
**HIGH** — requirement 리뷰어가 CRITICAL 2건을 발견: 이번 diff(순수 spec/plan 문서 정정)가 `previousOutput` "완전 폐기" 오기재를 바로잡으려다 **Form 노드에 대해 정반대의 새로운 사실 오류를 도입**했다. Form 의 resumed 출력은 `previousOutput` 을 전혀 주입하지 않는데도, 새 캐비어는 "지금도 주입한다"고 단정해 코드 실태 및 이 diff 자신이 인용하는 SoT(`node-output.md:194`, 애초에 form 을 스코프에서 배제)와 정면 모순된다. 코드 diff 는 없으므로 실행 시 즉각적인 런타임 영향은 없지만, spec 문서 자체의 정확성이 훼손되는 CRITICAL 등급 결함이다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement/정확성 | `4-form.md` 의 신규 `previousOutput` 캐비어가 Form 노드 실제 구현과 모순. Form 의 resumed 출력을 만드는 유일한 코드 경로 `FormInteractionService.waitForFormSubmission()`(`form-interaction.service.ts:254-266`)은 `previousOutput` 키를 갖지 않는다. `previousOutput` 주입은 `ButtonInteractionService.buildResumedStructuredOutput()` 전용이며 Form 은 `config` 에 buttons 필드가 없어 이 경로에 도달 불가. 이 diff 가 인용하는 SoT `node-output.md:194` 도 애초에 carousel/chart/table/template 로만 스코프를 한정, form 을 배제 | `spec/4-nodes/6-presentation/4-form.md:260-262` | 원문("previousOutput 은 금지 필드")으로 되돌리거나, "Form 은 ButtonInteractionService 경로를 타지 않아 이 필드가 실제로 등장하지 않는다(carousel/chart/table/template 전용 과도기 예외)" 처럼 명시적 배제를 추가. `spec/` 편집이므로 project-planner 담당(developer 는 spec read-only) |
| 2 | Requirement/정확성 | 동일 오류가 sibling plan 에도 동기 반영되어 전파됨 | `plan/in-progress/node-output-redesign/form.md:77-79` | 위 #1 과 함께 되돌리거나 "Form 은 해당 안 됨"으로 재정정. `chart.md:46-49` (Chart 는 실제로 buttons 지원 → 정확) 와 대조해 패턴 확인 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화/일관성 | 정정 문구가 문장 내부에서 자기모순 — "폐기(단 미완 — … 신규 소비 금지)"라는 인라인 캐비어와 같은 문장의 결론부 "…등 1차 초안의 핵심 정리 항목은 **모두** spec 본문에 **반영 완료**"가 상충. plan 체크리스트는 이 항목을 이미 `[x]` 완료로 표기해 육안 검수 없이 그대로 머지될 위험. sibling `chart.md`/`form.md` 는 같은 배치에서 `previousOutput` 을 열거 목록에서 분리해 별도 각주로 처리해 자기모순이 없음 | `plan/in-progress/node-output-redesign/README.md:263` | `chart.md`/`form.md` 와 동일하게 열거 목록에서 분리하거나, 결론부를 "…(`previousOutput` 예외 제외) spec 본문에 반영 완료" 식으로 수정 |
| 2 | Requirement/스코프 | `0-common.md` 의 공통 캐비어는 서비스명(`ButtonInteractionService`)을 명시해 그 자체로는 정확하지만, `4-form.md:261` 이 이를 참조하며 "resume 경로가"라고만 쓰고 서비스명을 생략해 스코프 정보가 소실됨 — 위 CRITICAL #1 의 직접 원인 | `spec/4-nodes/6-presentation/0-common.md:138-143` | 공통 캐비어 자체에 "(Form 의 `FormInteractionService` 경로는 해당 없음)" 같은 명시적 배제 문구를 추가해 하위 문서 저자의 실수 전파를 방지 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | plan draft 본문의 예시 상대경로가 2단계(`../../`)로 얕음 — 실제 적용본(`chart.md:48`, `form.md:78`)은 정확한 3단계 경로(`../../../spec/...`)+anchor 사용, 실 커밋 파일에는 전파 안 됨 | `plan/in-progress/presentation-previousoutput-spec-drift.md:92` | 예시 문구를 `../../../spec/conventions/node-output.md#42-폐기할-필드--구조` 로 정정해 향후 재작업 시 오탈 복사 방지 |
| 2 | 문서화 | 동일 개념("전환기 보존 필드")에 대한 표현이 코드 주석("legacy transitional field")·`node-output.md`("transitional legacy 필드")·`3-chart.md`("과도기 legacy") 3곳에서 조금씩 다름 — grep 검색성 저하, 강제 규약 위반 아님 | `button-interaction.service.ts` 주석, `spec/conventions/node-output.md:194`, `spec/4-nodes/6-presentation/3-chart.md:275` | 필수 아님. SoT anchor 로 이미 값 도메인이 일원화되어 실질 혼선 위험 낮음 |

## 확인됨 — 문제 없음 (참고용, 조치 불요)

- `0-common.md` 캐비어, `3-chart.md:230-232`/`3-chart.md:275`, `node-output.md:194`(§4.2), `execution-engine.md:893,1162`(Continuation Bus 6종 표기), `ai-turn-orchestrator.service.ts` 의 `processAiResumeTurn`/`PARK_RELEASED` no-op park 패턴("동반 정정 A/B")은 실측 코드와 line-level 로 일치함을 확인 — Chart 는 실제로 `config.buttons` 지원 + `ButtonInteractionService` 경로를 타므로 previousOutput 주장이 정확.
- `/consistency-check` 5개 서브에이전트가 제기했던 WARNING 2건(plan_coherence sibling 동기화 누락, convention_compliance dangling 트리거 링크)은 이번 커밋에서 실질적으로 해소됨을 확인(단 form.md 동기화 과정에서 위 CRITICAL #2 가 새로 도입됨).
- CHANGELOG·README·API 문서·설정 문서 관점에서 이번 diff(순수 spec/plan 서술 정정, 동작 변경 없음)에 추가로 필요한 항목 없음.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| documentation | LOW | `README.md:263` 문장 내 자기모순 WARNING 1건, plan draft 상대경로/용어 drift INFO 2건 |
| requirement | HIGH | `4-form.md`(및 sibling `form.md`) 의 신규 `previousOutput` 캐비어가 Form 노드 실제 구현·SoT 와 정면 모순되는 CRITICAL 2건 |

## 발견 없는 에이전트

없음 — 실행된 2개 에이전트(documentation, requirement) 모두 실질 발견사항을 보고함.

## 권장 조치사항
1. **[CRITICAL]** `spec/4-nodes/6-presentation/4-form.md:260-262` 를 원문("previousOutput 은 금지 필드")으로 되돌리거나 Form 제외를 명시 — project-planner 담당 (`spec/` 편집).
2. **[CRITICAL]** `plan/in-progress/node-output-redesign/form.md:77-79` 를 동일하게 수정해 sibling plan 이 spec 과 어긋나지 않도록 동기화.
3. **[WARNING]** `plan/in-progress/node-output-redesign/README.md:263` 의 자기모순 문장을 `chart.md`/`form.md` 패턴에 맞춰 정정.
4. **[WARNING]** `spec/4-nodes/6-presentation/0-common.md:138-143` 공통 캐비어에 Form 배제를 명시적으로 추가해 재발 방지.
5. **[INFO, 선택]** `plan/in-progress/presentation-previousoutput-spec-drift.md:92` 의 예시 상대경로를 3단계로 정정.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `documentation, requirement` (2명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: `documentation, requirement` (전원 결과 확보됨 — forced 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | scope | router 판단 — 순수 spec/plan 문서 정정으로 스코프 확장 리스크 낮음(개별 사유는 prompt 에 미제공) |
  | architecture | router 판단 — 코드 diff 없음, 아키텍처 영향 없음(개별 사유는 prompt 에 미제공) |
  | maintainability | router 판단 — 코드 diff 없음, 유지보수성 영향 없음(개별 사유는 prompt 에 미제공) |
  | side_effect | router 판단 — 코드 diff 없음, 부작용 리스크 없음(개별 사유는 prompt 에 미제공) |