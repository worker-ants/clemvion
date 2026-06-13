# 요구사항(Requirement) Review

**리뷰 대상**: spec-sync-s-batch — spec doc-sync 3건 + 코드 주석 교정 1건 + plan 완료 이동 4건 + consistency review artifacts

---

## 발견사항

### [INFO] 파일 1: `resume-turn-dispatch.ts` JSDoc 교정 (I3) — spec fidelity 정합

- 위치: `codebase/backend/src/modules/execution-engine/resume-turn-dispatch.ts` line 37 (diff -1/+1)
- 상세: `§6.2(중첩 재개)` → `§7.5(rehydration · 중첩 sub-workflow 재개)` 교정. 실측 결과 `spec/5-system/4-execution-engine.md §6.2` 섹션 제목은 "6.2 저장 전략"(영속화 정책)이고, 중첩 재개 서술은 §7.5 하위에 위치한다(L935 "중첩 sub-workflow 재개 — resume_call_stack frame-by-frame 재진입"). 새 JSDoc 표기 `§7.5(rehydration · 중첩 sub-workflow 재개)` 가 spec 본문 명칭과 정확히 일치한다. 괄호 내 `§6.2 는 영속화 정책`도 spec §6.2 제목과 일치. 기능 변경 없음, 코드 동작 불변.
- 제안: 없음. 교정이 spec 과 정합.

---

### [INFO] 파일 15: `interaction-type-registry.md` 변경 (W2) — spec fidelity 정합

- 위치: `spec/conventions/interaction-type-registry.md` frontmatter `code:` + §1.2 규칙 블록 하단 note
- 상세: frontmatter `code:` 에 `resume-turn-dispatch.ts` 등재. §1.2 매트릭스 하단에 재개 turn 라우팅 진입점 note 추가. 실측 결과 `spec/5-system/4-execution-engine.md §7.5` L925-L926 에 `dispatchResumeTurn(ordered resumeTurnRegistry, resume-turn-dispatch.ts)` 가 이미 기술돼 있고, 추가된 note 내용("form→buttons→ai_conversation, first-match-wins, SoT: execution-engine §7.5")이 해당 spec 서술과 일치한다. WaitingInteractionType 4값 불변 — enum 값 추가 아님. §1.1 단일 진실 위치 표(enum 타입 선언처 전용)에 dispatch 파일을 넣지 않고 §1.2 note + frontmatter 로만 처리한 의도는 plan 에 명시됨.
- 제안: 없음.

---

### [INFO] 파일 2: `plan/complete/spec-sync-resume-dispatch-registry.md` — plan 완료 이동 정합

- 위치: `plan/complete/spec-sync-resume-dispatch-registry.md` (신규 생성)
- 상세: W1(2026-06-10 완료), W2(2026-06-13 이번 batch 완료), I3(2026-06-13 완료), I4(이미 반영) 모두 `[x]` 체크 상태로 종결 기술. 파일은 `plan/complete/` 로 이동됐다. 워크트리 spec 파일 실측 결과: interaction-type-registry.md 의 W2 변경이 실제로 적용돼 있음(frontmatter + §1.2 note). resume-turn-dispatch.ts 의 I3 변경도 실제 적용됨. 체크박스와 실제 상태 일치.
- 제안: 없음.

---

### [INFO] 파일 3: `plan/complete/spec-update-doc-style.md` — plan 완료 이동 정합

- 위치: `plan/complete/spec-update-doc-style.md` (신규 생성)
- 상세: W10 적용(§1.3 note Rationale 참조 형태로 압축), W9 no-op(이미 준수)로 종결. 워크트리 `spec/data-flow/7-llm-usage.md §1.3` 실측 결과: attribution 갭 note 가 "원인·증상·결정 상태 상세는 §Rationale … 단일 진실" 형태로 압축돼 있고, 결정 대기 상태가 보존됨. plan 의 완료 서술과 실제 spec 상태 일치.
- 제안: 없음.

---

### [INFO] 파일 4: `plan/complete/spec-update-pr2-embedding.md` — 후속 supersede 처리

- 위치: `plan/complete/spec-update-pr2-embedding.md` (신규 생성)
- 상세: PR4b/Unified Model Management 에 의해 모든 항목이 이미 충족(또는 의도적 supersede)됐다고 기술. INFO-1(embedding_model_config_id 등재), INFO-2(폴백 체인 §5.5), INFO-3(frontmatter code: 갱신) 모두 후속 작업에서 처리됨. legacy 컬럼 태깅 부적용 이유(V093/V094 이미 제거)도 명시됨. plan 의 "3-step 폴백 체인" 초안이 현행 "2-step 체인"(더 발전된 상태)으로 supersede 됐다는 설명이 논리적으로 정합. spec 추가 편집 없이 종결 처리가 적절함.
- 제안: 없음.

---

### [INFO] 파일 5: `plan/complete/spec-update-sse-single-instance-rationale.md` — plan 완료 이동 정합

- 위치: `plan/complete/spec-update-sse-single-instance-rationale.md` (신규 생성)
- 상세: Rationale 섹션에 SSE single-instance 블록 추가 완료로 기술. 워크트리 `spec/data-flow/15-external-interaction.md` 실측: L333 "SSE 버퍼 single-instance 한정 이유와 이관 방향" 블록 존재 확인. plan 의 완료 서술과 실제 spec 상태 일치.
- 제안: 없음.

---

### [INFO] 파일 6: `plan/in-progress/spec-update-gap-callout-plan-links.md` 변경 — heads-up note

- 위치: `plan/in-progress/spec-update-gap-callout-plan-links.md` 하단 추가 (diff 5줄)
- 상세: `spec/data-flow/7-llm-usage.md §1.3` note 가 이번 batch 에서 압축됐음을 후행 작업자에게 알리는 heads-up. "구 텍스트 기준으로 작성 금지" 주의 사항 포함. 목적에 충실하며, 압축된 실제 note 형태(`> **attribution 갭**: … [§Rationale](#rationale) … 단일 진실.`)가 정확하게 인용됨. 기능 변경 없는 메타 note.
- 제안: 없음.

---

### [INFO] consistency review artifacts (파일 7-14) — 적절한 산출물

- 위치: `review/consistency/2026/06/13/23_47_46/` 하위 파일들
- 상세: SUMMARY.md BLOCK:NO, 전체 위험도 LOW. _retry_state.json 은 orchestrator 상태 파일로 agents_pending/success/fatal 구조 확인. 5개 checker 결과 모두 존재. naming_collision/rationale_continuity/cross_spec 위험도 NONE, convention_compliance/plan_coherence LOW. consistency check 선행 절차가 이행됐음을 나타냄.
- 제안: 없음.

---

### [WARNING] `interaction-type-registry.md §1.2` note — `ai_form_render` 경로 명시 누락

- 위치: `spec/conventions/interaction-type-registry.md §1.2` 추가 note (diff L733)
- 상세: 추가된 note 는 재개 turn 라우팅을 "form → buttons → ai_conversation, first-match-wins" 로 기술한다. 그런데 `spec/5-system/4-execution-engine.md §7.5 L945` 에는 "AI → `handleAiResumeTurn` 경유 `processAiResumeTurn`" 으로 기술돼 있고, `WaitingInteractionType` 중 `ai_form_render` 도 AI 범주에 속한다. note 의 "ai_conversation" 표기가 `ai_conversation` 값만을 가리키는지, 또는 `ai_conversation | ai_form_render` 양쪽 모두를 포괄하는 AI 분기 레이블인지 명확하지 않다. `ResumeTurnDispatch` 의 `isAiConversation` 필드 설명에는 "ai_conversation / ai_form_render 여부"가 포함돼 있어 ai_form_render 도 AI 재개 경로를 탄다. note 만 보면 `ai_form_render` 재개 경로가 누락된 것처럼 읽힐 수 있다.
- 제안: note 내 "ai_conversation" 를 "ai_conversation / ai_form_render (isAiConversation)" 또는 "AI 재개(`ai_conversation`·`ai_form_render`)" 형태로 명확화하거나, 현행 `exec-park §7.5 L945` 의 "AI →" 표기처럼 AI 범주 포괄 의미임을 한 줄 주석으로 추가. 동작은 정확하나 spec 가독성 개선 필요.

---

### [INFO] `spec-update-gap-callout-plan-links.md` — §1.3 plan 링크 삽입 위치 갱신은 아직 미완

- 위치: `plan/in-progress/spec-update-gap-callout-plan-links.md`
- 상세: 이번 batch 가 §1.3 note 를 압축했으나, gap-callout-plan-links 의 §1.3 plan 링크 삽입 자체는 여전히 미착수(해당 plan 은 in-progress 상태). heads-up note 가 올바르게 추가됐고 consistency-check SUMMARY W4 에서도 지적됨. 착수 전 새 note 형태에 맞게 문안을 조정해야 한다는 사실이 문서화됨. 현 시점에서 미완 상태는 예상 범위 내.
- 제안: 없음. 추적이 heads-up note 와 consistency W4 에서 이미 이루어짐.

---

## 요약

이번 변경은 spec-sync-s-batch 의 spec doc-sync 3건(interaction-type-registry §1.2 note/frontmatter, llm-usage §1.3 압축, external-interaction Rationale SSE 블록 신설)과 코드 주석 교정 1건(resume-turn-dispatch.ts JSDoc §6.2→§7.5) 및 관련 plan 완료 이동 4건이다. 실측 결과 모든 spec 변경이 워크트리에 정확히 적용됐으며, plan 체크박스 상태와 실제 적용 상태가 일치한다. spec/5-system/4-execution-engine.md §7.5 와 §6.2 의 실제 섹션명·서술과 코드·spec 변경이 line-level 로 정합된다. 단 하나의 WARNING 은 §1.2 추가 note 에서 `ai_form_render` 가 `ai_conversation` 과 함께 AI 재개 경로를 타는 사실이 문맥상 불명확하다는 가독성 이슈로, 동작 오류는 아니다. consistency-check 가 선행돼 BLOCK:NO 판정을 받은 상태이며, 비차단 plan 정합 WARNING 4건(체크박스 갱신·중복 적용 주의)도 계획된 완료 이동으로 해소됐다.

## 위험도

LOW

---

STATUS: OK
