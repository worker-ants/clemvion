# Cross-Spec 일관성 검토 결과

## 발견사항

- **[WARNING]** `spec/3-workflow-editor/4-ai-assistant.md` 내 `shouldSkipReview` 목록과 Rationale 섹션이 상호 모순
  - target 위치: `prompts/system-prompt.ts` line 382 — `PLAN_NOT_COMPLETE already fired this turn` skip 절 제거
  - 충돌 대상: `spec/3-workflow-editor/4-ai-assistant.md` §10 "review skip 조건" (line 958) vs 동 파일 §5 "Review guard 항상 발동" (lines 1072–1098)
  - 상세: 구현 변경(`shouldSkipReview` 에서 `finishBlockCount > 0` 제거)과 system-prompt 문구 정합화는 §5 Rationale 결정(lines 1078–1088)과 일치한다. 그러나 spec 의 **canonical skip 조건 목록** (§10, line 958) 은 아직 `state.finishBlockCount > 0 — PLAN_NOT_COMPLETE 가 이미 발동했다면 review 는 중복` 항목을 그대로 나열하고 있다. §10 의 목록과 §5 의 "남은 skip 조건" 목록이 서로 다른 상태를 기술해 스펙 내부 단일 진실이 깨진 상태다. `spec` 문서가 line 954 에서 "시스템 프롬프트의 Self-review 섹션 설명과 반드시 동기화 유지" 를 명시하고 있으므로, 이번 system-prompt 수정과 동시에 spec §10 목록도 갱신해야 한다.
  - 제안: `spec/3-workflow-editor/4-ai-assistant.md` §10 "review skip 조건" (line 958) 에서 `state.finishBlockCount > 0` 불릿을 삭제하고, §5 의 "남은 skip 조건" 목록(lines 1084–1088)과 동기화. 두 섹션 중 §10 이 canonical 이므로 §10 을 수정하고 §5 는 "§10 참조" 식으로 단순화하거나 동일하게 맞춘다.

- **[INFO]** `spec/3-workflow-editor/4-ai-assistant.md` §10 유지보수 체크리스트 (line 992) 는 "Review skip 조건 변경 시: `prompts/system-prompt.ts` Self-review 섹션 문구 동기화" 를 명시한다. 이번 변경은 반대 방향(system-prompt → spec) 이지만 동일 체크리스트가 적용된다. 별도 Action 불필요 — WARNING 항목 처리 시 자연히 해소.

---

## 요약

이번 target 변경(system-prompt.ts 에서 `PLAN_NOT_COMPLETE already fired this turn` skip 절 제거)은 `spec/3-workflow-editor/4-ai-assistant.md` §5 "Review guard 항상 발동" 결정과 일치하며 다른 영역 spec(데이터 모델·API 계약·RBAC·상태 머신·계층 책임) 과의 교차 충돌은 없다. 유일한 문제는 같은 spec 파일 내 §10 canonical skip 조건 목록이 §5 Rationale 와 이미 어긋나 있다는 점으로, 이번 구현 착수 전 spec §10 을 §5 결정에 맞게 동기화해야 한다. Critical 충돌 없음.

---

## 위험도

LOW
