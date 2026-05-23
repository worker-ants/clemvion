# RESOLUTION — 22_29_35

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| C-1 (Critical) | false-positive | — | spec §6.2 step 2.c.bypass / §12.5 / Inv-7 / CT-S12~14 모두 commit 69262b9f 에서 반영됨. reviewer 가 검토 시점 이전 base spec 참조. |
| C-2 (Critical) | 코드 | f50aa21e | ai-agent.handler.spec.ts form_submitted 케이스에 appendPresentationInteraction + data.via === 'ai_render' assertion 추가. mock conversationThreadService 주입. |
| W-2 (Warning) | 노트 | — | spec §6.2 step 2.a reject 요구 vs bypass fallback — 의도된 설계. pending form 없는 form_submitted 를 plain ai_user 로 fallback 처리함은 spec §10.9 §Rationale 에 기반. 별도 수정 불필요. |
| W-3 (Warning) | 코드 | f50aa21e | node-handler.interface.ts 에 ResumableMessageOptions interface export. 인라인 리터럴 3곳 통일. |
| W-4 (Warning) | 코드 | f50aa21e | information-extractor.handler.ts _options 인라인 import() 타입 제거 → top-level named import ResumableMessageOptions. |
| W-5 (Warning) | 노트 | — | resumeFromAiRenderForm store action 의 spec §9.7.1 표 부재 — spec update 는 project-planner 위임 대상이나 코드는 이미 spec §9.9 Inv-7 (commit 69262b9f) 에 따라 구현됨. 코드 수정 불필요. |
| W-6 (Warning) | 노트 | — | ResumableMessageSource 타입 spec 미등재 — 내부 타입으로 코드 주석에 이미 명시됨. |
| W-7 (Warning) | 코드 | f50aa21e | ResumableMessageOptions JSDoc 에 구현체 _options 명시 지침 추가. |
| W-8 (Warning) | 코드 | f50aa21e | execution-store.ts resumeFromAiRenderForm shallow-spread 주석 명시. |
| W-9 (Warning) | 코드 | f50aa21e | selectPendingFormToolCallId selector 추출 → execution-store.ts export. page.tsx / run-results-drawer.tsx 중복 제거. Rules of Hooks 준수 위해 이른 return 이전 hook 호출 이동. |
| W-10 (Warning) | 코드 | f50aa21e | execution-engine.service.spec.ts ai_message source 전달 경로 검증 테스트 추가 (W10). |
| W-11 (Warning) | 코드 | f50aa21e | execution-store.test.ts waitingNodeId 를 setState 직접 주입으로 변경 — pauseForConversation 간접 의존 제거. |
| W-12 (Warning) | 코드 | f50aa21e | ai-agent.handler.spec.ts stubIndex < 0 fallback 케이스 추가 (ai_message + form_submitted 양쪽). |
| W-13 (Warning) | 코드 | f50aa21e | node-handler.interface.ts 고아 JSDoc 블록 정리 — ResumableNodeHandler 선언 직전으로 통합. |

## TEST 결과

- lint  : 통과
- unit  : 통과 (4572 passed)
- e2e   : 통과 (98/98)

## 보류·후속 항목

- INFO 항목 (requirement.md §6.1.d.ii, testing.md CT-S13 onSubmitForm 검증, result-detail.tsx prop drill 테스트, 하위 호환 옵션 미전달+pending 시나리오 등): 별도 PR 또는 다음 iteration 에서 처리 가능. 기능 회귀 위험 없음.
- W-2 (bypass fallback): spec §10.9 §Rationale 에 기록된 의도된 동작. spec update 는 project-planner 영역이나 현재 코드 행동이 충분히 안전.
- W-5 (resumeFromAiRenderForm spec §9.7.1 표): spec update 위임 항목. 구현은 §9.9 Inv-7 에 따라 이미 올바름.
- W-6 (ResumableMessageSource 타입 spec 미등재): 내부 타입으로 코드 주석에 명시됨. spec 등재 시 project-planner 위임.
