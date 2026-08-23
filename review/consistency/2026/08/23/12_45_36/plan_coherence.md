# Plan 정합성 검토 — `swagger-decisions-d24f77` (impl-done)

## 검토 범위 관해 먼저 밝힌다

payload 의 `target_path` 는 `spec/5-system/` 이지만, 실제 `git diff origin/main...HEAD` 는
`spec/5-system/` 를 **전혀 건드리지 않는다**. 실 변경분은:

- `spec/conventions/swagger.md` (§3 길이 규칙 개정 + Rationale 2절)
- `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` (`input` 필드
  `deprecated: true`)
- `codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts` (회귀 가드 1건)
- `plan/in-progress/swagger-decisions.md` (신규) · `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
  (트래커 3항목 `[ ]` → `[x]`)

`target_path=spec/5-system/` 지정은 이번 PR 의 실제 diff 와 스코프가 어긋난 것으로 보인다
(오케스트레이터의 scope 산정 오류 가능성). Plan 정합성 관점의 세 기준(미해결 결정 충돌·선행
plan 미해소·후속 항목 누락)은 "target 문서" 를 실제 diff 기준(`spec/conventions/swagger.md` +
관련 코드)으로 대체 적용해 검토했다 — 그렇지 않으면 `spec/5-system/` 안에 아무 변경이 없으므로
점검 자체가 공허(vacuous)해진다.

## 검토 방법
- 실제 diff 대상(`spec/conventions/swagger.md`, `execute-workflow.dto.ts`,
  `workflows-execute-body.spec.ts`)을 `plan/in-progress/swagger-decisions.md` 및 정본 트래커
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 대응 3개 항목(①~③)과 1:1 대조.
- `10~40자`/`swagger.md`/`길이` 키워드로 다른 `plan/in-progress/**` 전수(번들에 포함된
  `eia-context-schema-followups.md`·`harness-review-gate-followups.md`·
  `spec-sync-stop-editor-and-forbidden-routes.md`·`exec-intake-followups.md`·
  `webchat-spec-rationale-followup.md`·`harness-consistency-summary-downgrade-rule.md`) 를 확인 —
  §3 DTO 길이 규칙과 겹치는 항목 없음(전부 §5-1/§5-4/§2-4/§12-workspace 앵커 등 별도 절 참조).
- swagger.md Rationale 섹션 리네임(`§3 보안·정책 캐비엇 예외` → `§3 보안·정책 캐비엇`)에 따른
  앵커 변경이 다른 `spec/`·`plan/in-progress/` 문서에서 dangling reference 를 만드는지 grep —
  `plan/complete/spec-draft-swagger-401-drift.md` 에 옛 앵커 인용이 남아 있으나 이는 완료
  아카이브(historical archive)라 `plan/in-progress/**` 정합성 검토 대상 밖.

## 발견사항

없음 — CRITICAL/WARNING 급 불일치를 찾지 못했다.

### 대조 상세 (참고용, 비-발견)

1. **① `execute` 여분 키 400 거부 → (b) 현행 유지**: 트래커
   (`spec-sync-external-interaction-api-gaps.md:942`)의 `execute-body-dto` 이연 결정과 정확히
   대응하며, 트래커 항목이 이번 diff 로 `[x]` + "결정됨(2026-08-23)" 문구로 닫혔다. 코드
   무변경이라는 target 서술과 실제 diff(코드 변경 없음)가 일치한다.
2. **② `ExecuteWorkflowDto.input` 동명이의 → `deprecated: true`**: 트래커
   (`:984`)가 이미 "`legacyInput` 리네임은 `body?.input` 런타임 의존 때문에 성립 안 함"을
   기록해 뒀고, target 은 그 결론을 승계해 `deprecated` 플래그로 집행했다. 코드
   (`execute-workflow.dto.ts` `input?` 필드 `deprecated: true`)·회귀 테스트
   (`workflows-execute-body.spec.ts` `[결정] input 만 deprecated 로 표시된다`, `parameterValues`
   가 deprecated 아님을 함께 단언하는 대조군 포함)가 서술과 일치.
3. **③ `swagger.md §3` 길이 규칙 → (c) 강제 대상 아님 명문화**: 트래커(`:1004`)가 (a)/(b)/(c)
   세 대안을 미리 나열하며 "§3 예외 확장과는 별개 판단"이라 범위를 갈라 뒀다. target 은 (c)를
   택했고, 이는 이미 종결된 "§3 보안·정책 캐비엇 예외 확장"(2026-08-22)과 병존한다 —
   swagger.md 에 두 Rationale 절(`§3 DTO 길이는 왜 강제가 아닌가` / `§3 보안·정책 캐비엇`)이
   분리돼 있고, 두 절 사이 상호 링크(신규 표 안 "이 문서가 스스로 남겨 둔 유보를 해제")도
   정합적이다.
4. **다른 plan 과의 상충 여부**: 위 6개 관련 plan 전수 확인 결과, §3 DTO 길이 규칙(비강제화)
   또는 `ExecuteWorkflowDto.input` deprecated 결정에 의존하거나 반대 방향을 전제하는 항목 없음.
5. **선행 plan 미해소 여부**: target 이 가정하는 선행 조건(트래커 3건이 "사용자 판단 필요"로
   열려 있었다는 것, `execute-body-dto`·§3 예외 확장 선행 작업이 이미 머지됐다는 것)은 트래커
   본문(`:911`, `:920`)으로 확인되며 미해소 선행 plan 없음.
6. **후속 항목 반영 여부**: target 자신의 "작업" 체크리스트에 "트래커 3건 종결"이 포함돼 있고,
   실제 diff 에서 `spec-sync-external-interaction-api-gaps.md` 의 대응 3개 `[ ]` 가 `[x]` 로
   반영됐다(문서 서술 ≠ 실제 상태 이슈 없음). `deprecated` 패턴을 §1 로 일반화하지 않기로 한
   판단("사례 1건, rule of three 미달")도 근거를 Rationale 에 남겨 뒀고, 이를 추적할 별도 후속
   plan 항목이 필요하다는 서술은 없다 — 세 번째 사례가 나올 때 규칙화하겠다는 것 자체가 명시적
   defer 이므로 이번 라운드의 "후속 항목 누락"에 해당하지 않는다.
7. **앵커 drift 재확인**: swagger.md Rationale 절 리네임에 따른 신규 앵커
   (`#3-보안정책-캐비엇--왜-길이를-이유로-줄이지-않는가-그리고-왜-양방향인가`)를 본문
   콜아웃이 정확히 가리키고, 옛 앵커를 인용하는 `plan/in-progress/**` 문서는 없다(옛 앵커 인용은
   `plan/complete/` 아카이브 1건뿐 — historical, 갱신 대상 아님).

## 요약
실제 diff(`spec/conventions/swagger.md` §3 개정 + `ExecuteWorkflowDto.input` deprecated
+ 회귀 테스트)는 정본 트래커 `spec-sync-external-interaction-api-gaps.md` 가 "사용자 판단
필요"로 열어 둔 3개 항목과 1:1 대응하며, 각 결정이 트래커가 이미 기록해 둔 실측 근거·대안
목록·선행 결정과 충돌하지 않는다. 다른 6개 관련 `plan/in-progress/**` 문서 중 이 결정들에
의존하거나 반대를 전제하는 항목은 없고, 트래커 체크박스 동기화(후속 항목)도 이미 diff 에
반영돼 있다. 다만 이 검토 세션의 `target_path=spec/5-system/` 지정이 실제 diff 범위와 어긋나
있어(diff 는 `spec/conventions/`), 오케스트레이터의 scope 산정을 재확인할 필요가 있다 — 본
checker 는 그 갭을 실제 diff 기준으로 보정해 검토했다.

## 위험도
NONE
