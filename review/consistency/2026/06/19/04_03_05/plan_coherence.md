# Plan 정합성 검토 결과

**검토 모드**: --impl-done (scope: spec/5-system/4-execution-engine.md)
**대상**: `button-interaction.service.ts` / `button-interaction.service.spec.ts` 변경
**분석 기준**: `plan/in-progress/**` 진행 중 문서

---

## 발견사항

### 발견사항 1
- **[INFO]** SPEC-DRIFT 후속 항목이 plan 에 등재됐으나 현재 spec 파일에 미반영 상태
  - target 위치: `button-interaction.service.ts` — `resolveButtonInteraction`, `buildResumedStructuredOutput`, `ButtonClickPayload`, `StructuredInteraction` 신규 익스포트
  - 관련 plan: `plan/in-progress/refactor/c1-engine-split.md` §"ButtonInteractionService 타입·분해" (L143–145)
  - 상세: c1-engine-split plan 의 "SPEC-DRIFT 후속(planner)" 항목이 두 가지 spec 갱신을 명시한다 — (a) 순수함수 추출(`resolveButtonInteraction`/`buildResumedStructuredOutput`)을 `spec/5-system/4-execution-engine.md §Rationale C-1` 에 등재, (b) `spec/conventions/node-output.md §4.2` 코드 블록의 `interaction.type` 열거에 `button_continue` 추가(현재 `"form_submitted" | "button_click" | "message_received"` — `button_continue` 누락), `spec/4-nodes/6-presentation/0-common.md §4` `button_continue` `url?` 조건부 정정. 이는 **planner 위임 후속**으로 명시돼 있어 현재 worktree (developer 트랙)에서 처리를 요구하지 않으며, impl-done 기준으로도 BLOCK:NO 가 이미 확인됐다. 단 추적 메모로 등재한다.
  - 제안: 별도 조치 불요. plan 이 이미 (a)(b) 를 planner 후속으로 명시·추적 중이므로 현 state 는 일관. planner 가 별도 commit 으로 두 spec 파일을 갱신할 때 이 항목을 닫으면 된다.

### 발견사항 2
- **[INFO]** `node-output-redesign` plan 의 `previousOutput` Phase 3 제거 항목과의 경계
  - target 위치: `button-interaction.service.ts` `buildResumedStructuredOutput` — `previousOutput` 필드 유지 + nested chain strip 로직
  - 관련 plan: `plan/in-progress/node-output-redesign/README.md` §8 (잔여 Phase 3 목록) + `plan/in-progress/refactor/c1-engine-split.md` L146–148 `previousOutput Phase 3 완전 제거` INFO
  - 상세: 본 diff 의 `buildResumedStructuredOutput` 은 `previousOutput` 를 여전히 생성(nested chain strip 포함)하며, `spec/conventions/node-output.md §4.2` 에도 "Phase 3 완료 전 과도기 예외" 로 명시돼 있다. c1-engine-split plan 이 이를 "현재 충돌 없음, 기존 행위 verbatim" 으로 분류하고 `node-output-redesign` 재개 시 함께 처리하도록 위임했다. 미해결 결정은 아니며 충돌도 없다.
  - 제안: 현 상태 유지. `previousOutput` 제거 결정이 실제로 내려질 때는 `node-output-redesign` plan 및 spec §4.2 예외 조항을 동시에 갱신해야 한다.

---

## 요약

target 변경(`ButtonClickPayload` 판별유니온·`isButtonClickPayload` 타입가드·`resolveButtonInteraction`·`buildResumedStructuredOutput` 순수함수 추출 + 대응 단위 테스트)은 `plan/in-progress/refactor/c1-engine-split.md` 의 "후속 ⑤ ButtonInteractionService 타입·분해" 항목에 명시된 완료 작업과 완전히 일치한다. 미해결 결정을 우회하거나 선행 plan 이 미해소된 상태에서 전제를 가정하는 충돌은 없다. 유일한 후속 항목(SPEC-DRIFT planner 갱신 2건)은 plan 에 이미 등재돼 있고 developer 트랙 밖임이 명시됐다. 위험도는 NONE이다.

## 위험도

NONE
