# Cross-Spec 일관성 검토 결과

**검토 모드**: --impl-done  
**Target**: `spec/3-workflow-editor/4-ai-assistant.md` (구현 변경: `workflow-assistant` 모듈 리팩토링)  
**Diff-base**: origin/main

---

## 발견사항

### [WARNING] spec §10 `shouldSkipReview` 조건 목록이 구현과 불일치

- **target 위치**: `spec/3-workflow-editor/4-ai-assistant.md` — Part B Rationale "review skip 조건 (`shouldSkipReview`)" 항목 (line 958)
- **충돌 대상**: 동일 파일 내 "5. Review guard 항상 발동" 섹션 (line 1078) 및 구현 `assistant-finish-guard.service.ts`의 `shouldSkipReview`
- **상세**: spec §10 의 `shouldSkipReview` 명세 목록은 여전히 `state.finishBlockCount > 0` 을 skip 조건으로 열거하고 있다. 그러나 같은 파일 Rationale §5 "Review guard 항상 발동" 에서 이 조건을 **제거**한다고 명시하고, 구현(`assistant-finish-guard.service.ts` `shouldSkipReview`) 도 `finishBlockCount` 체크를 포함하지 않는다. 두 서술이 동일 문서 내에 공존해 canonical 상태가 모호하다. spec §10 본문 테이블을 읽는 독자는 여전히 `finishBlockCount > 0` 이 skip 조건인 것으로 오해할 수 있으며, 유지보수 체크리스트(line 992 "Review skip 조건 변경 시: 시스템 프롬프트 동기화")가 의미하는 '현재 skip 조건 목록'도 §10 본문 기준인지 §5 Rationale 기준인지 불분명하다.
- **제안**: `spec/3-workflow-editor/4-ai-assistant.md` §10 "review skip 조건" 목록에서 `state.finishBlockCount > 0` 항목을 제거하고, Rationale §5 의 "남은 skip 조건" 목록을 canonical 로 명시한다.

---

### [INFO] `AssistantFinishGuard` 클래스 분리가 spec 코드 참조에 미기재

- **target 위치**: `spec/3-workflow-editor/4-ai-assistant.md` frontmatter `code:` 목록 및 §10 "평가 흐름" 서술
- **충돌 대상**: 해당 없음 (다른 spec 과의 모순이 아닌 누락)
- **상세**: 구현에서 `evaluateFinishGuard`/`evaluateReviewGuard` 가 `WorkflowAssistantStreamService` 의 private 메서드에서 `AssistantFinishGuard` `@Injectable()` 클래스로 분리됐다. spec frontmatter의 `code:` 글로브 `codebase/backend/src/modules/workflow-assistant/**/*.ts` 가 신규 파일을 커버하므로 범위 이탈은 없다. 그러나 spec §10 Part B 흐름 기술이 여전히 `this.evaluateFinishGuard`/`this.evaluateReviewGuard` 인라인 메서드처럼 암시되어 있어, 실제 collaborator 객체(`AssistantFinishGuard`)로의 위임 사실이 명시되지 않는다. 다른 spec 과의 충돌은 없음.
- **제안**: 필수 수정 아님. 필요시 §10 Rationale 에 "M-3 2단계: 가드 로직이 `AssistantFinishGuard` collaborator 로 추출됨" 한 줄 추가로 동기화 권장.

---

### [INFO] `isPlanPendingApproval` 함수의 위치 이동 — spec 서술 위치와 미일치

- **target 위치**: 구현 `active-plan-context.ts` (신규 export: `isPlanPendingApproval`)
- **충돌 대상**: 해당 없음
- **상세**: `isPlanPendingApproval` 은 이전에 `workflow-assistant-stream.service.ts` 의 module-scope 함수였으나, 이번 diff 에서 `tools/active-plan-context.ts` 로 이동·export 됐다. spec §10 Rationale §6 "Plan-only 턴의 핑퐁 루프 차단" 은 `planProposedPendingApproval` 판정을 stream.service 의 루프 제어와 함께 설명한다. 함수 위치 이동이 동작을 바꾸지는 않으나, spec 설명이 구현 모듈 위치를 암시하는 부분에서 독자 혼란이 가능하다.
- **제안**: 동작 변경 없음. spec 수정 불필요.

---

## 요약

이번 구현 변경은 `WorkflowAssistantStreamService` 에 인라인으로 존재하던 finish/review 가드 로직을 `AssistantFinishGuard` collaborator 로 분리하고, `collectPendingUserConfig`를 독립 함수로 추출하며, `isPlanPendingApproval`을 `active-plan-context` 모듈로 이동한 순수 내부 리팩토링이다. 다른 spec 영역(데이터 모델, API 계약, RBAC, 상태 전이)과의 충돌은 없다. 유일한 실질적 문제는 `spec/3-workflow-editor/4-ai-assistant.md` 내부에서 `shouldSkipReview` 조건 목록이 두 곳에 다르게 기술되어 있어(§10 본문 vs Rationale §5) canonical 상태가 불명확한 점이다. 이 불일치는 spec 내부 문제이며 다른 spec 과의 교차 충돌은 발생하지 않는다.

---

## 위험도

LOW

STATUS: OK
