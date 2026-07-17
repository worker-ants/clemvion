### 발견사항

없음.

상세 근거:
- 실제 diff 는 `git merge-base HEAD origin/main` = `099f63ccadfdf9ce99d42c7dae0253d2557ae86d` 기준으로 `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts`(정규식 grep → TS AST 리터럴 수집으로 교체) 와 신규 `plan/in-progress/interaction-type-guard-comment-false-negative.md` 뿐이다. `spec/conventions/*.md` 는 이번 커밋에서 실제로 편집되지 않았다 (참고: payload 상의 "Target 문서" 덤프는 `spec/conventions/audit-actions.md`·`cafe24-api-catalog/**` 등 이 작업과 무관한 파일들이며 `interaction-type-registry.md` 자체는 덤프에 없었다 — payload 구성 이슈로 보이나, 워크트리에서 해당 spec 파일을 직접 절대경로로 읽어 검증했으므로 결론에 영향 없음).
- `spec/conventions/interaction-type-registry.md` §1.2 규칙3·§2.1 은 여전히 "grep 대상 파일"/"grep 검증 대상"/"grep 가드" 표현을 쓴다 — 코드가 AST 파싱으로 바뀐 뒤 남은 stale wording 이다. 그러나 plan 문서 자체의 "후속 (본 PR 범위 밖)" 섹션이 이 갭을 **이미 명시적으로 기록**했고 ("`interaction-type-registry.md` 의 '그렙 대상 파일'/'코드 grep 결과' 류 잔여 표현 → …로 다듬기 … developer 는 spec read-only 라 project-planner 몫"), 사유(개발자 spec 쓰기 권한 없음)도 정합적이다 — 이는 "후속 항목 누락"이 아니라 후속 항목을 정확히 식별·이월한 사례다.
- `plan/in-progress/**` 전체를 대상으로 `interaction-type-registry.md`/`WaitingInteractionType`/`ConversationTurnSource`/`REGISTRY_SITES`/`exhaustiveness.test`/`ai_form_render`/`ai_conversation` 등을 grep 했다. 유일하게 걸리는 타 plan 은:
  - `eia-context-schema-followups.md` — 이미 **완료 체크(`[x]`)**된 항목에서 DTO 경로 리팩터 시 `interaction-type-registry.md` 각주(경로 참조)를 동반 갱신했다는 기록뿐, 본 fix(가드 메커니즘 자체)와 무관.
  - `ai-agent-tool-connection-rewrite.md` — "도구 호출 시 실행 컨텍스트"(멀티턴 중 form/buttons/ai_conversation 블로킹 노드 처리)가 **미해결 결정**으로 열려 있으나, 이는 아키텍처/실행-컨텍스트 결정이지 가드 검증 메커니즘과는 다른 층위이며 본 fix 가 그 결정을 선점하거나 무효화하지 않는다.
  - `spec-sync-external-interaction-api-gaps.md` — 완료 항목의 배경 설명에서 `interactionType` 용어가 나오는 것뿐, 관련 결정 없음.
- 본 fix 가 가정하는 선행 조건("spec 이 이 가드를 'AST 가드'로 이미 호칭" — PR #272 이래)은 실제 spec 문서(§1.2 표제·본문 다수 위치에서 "AST 가드"로 지칭)와 일치하며, 별도 plan 이 이 명칭을 다르게 전제하고 있지 않다.
- mutation 실측·체크리스트가 plan 안에 실제 상태(checked 항목)와 부합하며, 9/9-4 단계(ai-review, impl-done consistency-check)가 미체크로 남아 있는 것도 지금 이 검토 자체가 그 9-4 단계의 일부이므로 정합적이다.

### 요약
이번 변경은 `interaction-type-registry.md` 가 규정한 AST 가드의 **구현 방식**(정규식 grep → TS 컴파일러 API 기반 코드 리터럴 수집)을 그 spec 명칭("AST 가드")에 맞게 교정한 좁은 범위의 fix이며, `spec/conventions/*.md` 자체는 편집되지 않았다. 이 fix 가 다른 `plan/in-progress/**` 문서의 미해결 결정을 우회하거나, 다른 plan 이 전제하는 선행 조건을 깨거나, 다른 plan 의 후속 항목을 무효화하는 사례는 발견되지 않았다. spec 문서에 남은 stale "grep" 표현은 plan 자체가 후속 항목으로 이미 정확히 식별·이월(project-planner 위임)해 두었으므로 별도 조치가 필요 없다.

### 위험도
NONE
