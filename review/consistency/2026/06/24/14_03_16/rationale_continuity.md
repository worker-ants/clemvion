# Rationale 연속성 검토 결과

검토 모드: impl-prep (구현 착수 전 검토)
대상 변경: `prompts/system-prompt.ts` 의 `'Review/verify is skipped ... when PLAN_NOT_COMPLETE already fired this turn'` clause 제거

---

## 발견사항

### [INFO] spec 본문 §10 `shouldSkipReview` 목록이 §5 결정(finishBlockCount 제거)과 미동기화 상태

- **target 위치**: `spec/3-workflow-editor/4-ai-assistant.md` §10 "review skip 조건 (`shouldSkipReview`)" 목록 (line 958)
- **과거 결정 출처**: 동 spec `## Rationale` > "프로바이더 이상동작 대응 + review 항상 발동" > §5 "Review guard 항상 발동" (lines 1072–1088)
- **상세**:
  - §5 결정은 `evaluateReviewGuard` 의 `shouldSkipReview` 에서 `finishBlockCount > 0` 조건을 **제거**하도록 명시했다.
  - 그러나 §10 의 "review skip 조건" 목록 (line 958) 에는 `state.finishBlockCount > 0 — PLAN_NOT_COMPLETE 가 이미 발동했다면 LLM 은 한 라운드 feedback 을 받았으므로 review 는 중복` 항목이 **여전히 잔존**한다.
  - `codebase/.../prompts/system-prompt.ts` line 382 는 이미 올바르게 반영되어 있다(`Note: a prior PLAN_NOT_COMPLETE this turn does NOT skip review`).
  - 즉 코드·프롬프트는 §5 결정 기준으로 갱신되었으나, spec §10 본문은 아직 구 결정(finishBlockCount skip 포함)을 서술 중이다. 이는 spec 내부 자기모순 상태다.
- **제안**: spec §10 "review skip 조건" 목록에서 `state.finishBlockCount > 0` 항목을 제거하고, 해당 줄 삭제를 §5 의 "남은 skip 조건 (최소 안전망)" 목록(lines 1084–1088)과 동기화한다.

---

### [INFO] 대상 변경 자체(system-prompt.ts 문구 제거)는 이미 반영 완료

- **target 위치**: `codebase/backend/src/modules/workflow-assistant/prompts/system-prompt.ts` line 382
- **과거 결정 출처**: `spec/3-workflow-editor/4-ai-assistant.md` §5 "Review guard 항상 발동" (Rationale §에 통합된 결정)
- **상세**:
  - 제거 대상인 `'Review/verify is skipped ... when PLAN_NOT_COMPLETE already fired this turn'` 절은 현재 코드에 존재하지 않는다.
  - line 382 는 반대 진술("does NOT skip review")로 이미 교정되어 있어, 해당 impl-prep 변경의 코드 측은 사전에 완료된 상태다.
  - 이번 impl-prep 가 수행해야 할 실질 작업은 spec §10 본문의 동기화(위 INFO 항목)다.
- **제안**: 별도 작업 불필요. 위 INFO 항목(spec §10 갱신)을 수행하면 된다.

---

## 요약

`system-prompt.ts` 의 PLAN_NOT_COMPLETE skip 안내 정합화 변경은 Rationale 연속성 관점에서 기각된 대안의 재도입이나 합의 원칙 위반에 해당하지 않는다. §5 "Review guard 항상 발동" 결정은 `finishBlockCount > 0` skip 조건을 공식 제거했고, `system-prompt.ts` 는 이미 해당 결정에 맞게 수정되어 있다. 다만 spec 본문 §10 의 `shouldSkipReview` 목록이 §5 결정과 아직 동기화되지 않은 내부 불일치가 남아있다. 이는 구현을 차단하는 결정 번복이 아니라 spec 문서 정합 보완 사항이다.

## 위험도

LOW
