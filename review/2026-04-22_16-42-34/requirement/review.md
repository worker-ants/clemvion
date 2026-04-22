### 발견사항

**[WARNING]** `spec/3-workflow-editor/4-ai-assistant.md` §2.3 — plan-only prose 제거 후 미갱신
- 위치: `spec/3-workflow-editor/4-ai-assistant.md` §2.3 "plan-only turn 강제" 단락
- 상세: §2.3는 여전히 "LLM 은 plan 을 만든 뒤 짧은 한국어 메시지로 사용자에게 approve 를 요청하고 턴을 종료해야 한다" 고 기술하지만, `system-prompt.ts`·`service.ts` 모두 plan-only 턴에서 prose 를 **금지**하는 방향으로 변경됐다. §4.3 `finish` guard 설명과 §10 성능 제약은 갱신됐으나 §2.3 만 이전 행동 방식으로 남아 있다.
- 제안: §2.3 를 "LLM 은 propose_plan 직후 prose 없이 즉시 finish 를 호출한다. 클라이언트가 `systemHint: planApproveConfirm` 을 자동 주입해 UX 를 담당한다." 로 갱신

---

**[WARNING]** `workflow-assistant-stream.service.ts` — 클래스/메서드 JSDoc 구식
- 위치: `streamMessage` 메서드 상단 JSDoc (전체 파일 컨텍스트 ~line 115–145 영역)
- 상세: JSDoc 에 "finishBlockCount 로 같은 턴 2회 block 을 막아 무한 루프를 방지하고, 두 번째 finish 는 정상 탈출로 허용한다." 가 그대로 남아 있다. 실제 구현은 `editsSinceLastFinishBlock` 기반 progress-aware 가드로 교체됐으므로 서술이 틀렸다.
- 제안: JSDoc 을 "block 후 LLM 이 진척(edit/plan 성공)을 만들면 가드가 재발동, 진척 없이 retry 하면 stuck 으로 간주해 탈출" 로 수정

---

**[WARNING]** `assistant-store.ts` — `openQuestions` 있는 plan-only 턴에서 conflicting hint
- 위치: `frontend/src/lib/stores/assistant-store.ts` planApprove 분기 (~line 532)
- 상세: 현재 조건이 `updated.plan && !updated.plan.approved && !hasEditThisTurn && !updated.content.trim()` 인데, plan 에 `openQuestions` 가 있어도 해당 hint 가 주입된다. plan 카드 내부엔 "아래 메시지 입력창에 답변을 적어 보내 주세요." 안내가 이미 노출되므로 "계획대로 진행해 주세요." hint 와 동시에 표시되어 사용자에게 상충하는 메시지를 전달한다.
- 제안:
  ```typescript
  } else if (
    updated.plan &&
    !updated.plan.approved &&
    !hasEditThisTurn &&
    !updated.content.trim() &&
    !(updated.plan.openQuestions?.length)  // 추가
  ) {
  ```

---

**[INFO]** `assistant-store.ts` — 주석 우선순위와 코드 실행 순서 불일치
- 위치: done 분기 상단 주석 ("힌트 우선순위: error > stalled > planApprove > completed")
- 상세: 코드 실행 순서는 stalled → completed → planApprove 이지만 주석은 planApprove 가 completed 보다 앞이라고 기술한다. 두 분기의 실행 조건(planApprove: status="none", completed: status="completed")이 상호 배타적이어서 기능 버그는 아니지만, 향후 조건 수정 시 혼란을 야기할 수 있다.
- 제안: 주석을 "error > stalled > completed > planApprove" 로 수정하거나, 코드 순서를 주석과 일치하도록 elif 순서를 교환

---

**[INFO]** `workflow-assistant-stream.service.spec.ts` — `propose_plan` 을 진척으로 인정하는 케이스 미테스트
- 위치: 새 테스트 파일 전체
- 상세: 서비스 코드는 `kind === 'plan' && ok === true` 인 경우(propose_plan 포함)도 `editsSinceLastFinishBlock` 을 카운트한다. LLM 이 block 이후 plan 을 수정(새 propose_plan)하고 finish 를 재호출하는 시나리오가 가드를 다시 발동시키는지 검증하는 테스트가 없다.
- 제안: `propose_plan` 후 finish → block, 이후 새 `propose_plan` 후 finish → 다시 block 되는 시나리오 테스트 추가

---

**[INFO]** `system-prompt.spec.ts` — 패턴 (c) 정규식 광범위성
- 위치: 새 테스트 `(c)` 단언 (~line 281)
- 상세: `/client[^\n]*(auto[- ]?inject|inject)|approval[^\n]*hint/` 는 "client" 또는 "approval"이 포함된 다른 문장에도 매칭될 수 있어 의도하지 않은 구절에서 통과할 가능성이 있다.
- 제안: 좀 더 구체적으로 `/client auto[- ]?injects? .*approval|approval[^\n]*hint.*auto/i` 처럼 두 키워드가 함께 등장해야 통과하도록 좁힐 것을 검토

---

### 요약

이번 변경의 핵심 요구사항(plan-only 턴에서 LLM prose 제거 + 클라이언트 hint 자동 주입, `finish` 가드의 progress-aware 반복 차단)은 백엔드 서비스·시스템 프롬프트·프론트 스토어에 걸쳐 일관되게 구현되어 있고 신규 테스트도 주요 시나리오를 잘 커버한다. 다만 §2.3 스펙 문서가 새 행동 방식과 여전히 상충하는 서술을 유지하고 있으며, `openQuestions` 보유 plan-only 턴에서 상충하는 UX hint 가 동시 노출될 수 있는 엣지 케이스와 클래스 JSDoc 구식 서술이 잠재적 혼란 요소로 남는다.

### 위험도

**LOW** — 기능 오작동보다는 문서 정합성 문제와 드문 UX 엣지 케이스가 주된 이슈이며, 핵심 비즈니스 로직은 스펙 의도에 부합하게 구현됨.