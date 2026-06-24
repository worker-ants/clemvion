# Rationale 연속성 검토 결과

검토 범위: `system-prompt.ts` Self-review skip 안내 코드 정합 (커밋 86cd2a97)
대상 spec: `spec/3-workflow-editor/4-ai-assistant.md`
diff-base: origin/main

---

## 발견사항

### [INFO] finishBlockCount skip 조건 제거 — Rationale 에 기록된 결정과 정합

- **target 위치**: `system-prompt.ts` line 382 (변경 후 문장); `system-prompt.spec.ts` lines 37-44 (신규 regression 단언)
- **과거 결정 출처**: `spec/3-workflow-editor/4-ai-assistant.md § "5. Review guard 항상 발동"` (line 1072-1088) + `## Rationale § "Workflow Assistant — 프로바이더 이상동작 대응 + review 항상 발동"` 동일 섹션
- **상세**: spec Rationale §5 (line 1072-1088) 는 `finishBlockCount > 0` skip 조건 제거를 이미 명시적으로 채택한 결정으로 기록하고 있다 — "두 가드는 독립 계층으로 운영", "PLAN_NOT_COMPLETE — plan 체크박스 충족성 / WORKFLOW_REVIEW_REQUIRED — 워크플로우 품질" 분리, "두 가드 모두 fire 하는 3~4 round 시나리오가 현실적 정상 경로". 이번 target diff 는 바로 그 Rationale 결정을 system-prompt.ts 문구에 뒤늦게 반영한 것이다. 번복이나 기각 대안 재도입이 아니라, 기존 Rationale 과의 drift 를 닫는 동기화다.
- **제안**: 특별한 조치 불필요. spec §10 line 958 의 body 텍스트 (`state.finishBlockCount > 0 — PLAN_NOT_COMPLETE 가 이미 발동했다면 LLM 은 한 라운드 feedback 을 받았으므로 review 는 중복`) 는 sibling PR #685(planner) 처리 예정이라고 plan 에서 명시됐으므로, 본 PR 범위에서 그 라인을 건드리지 않는 것이 맞다. 다만 §10 line 958 과 §5/Rationale §5 의 내용이 현재 모순된 상태이므로 PR #685 가 완료되기 전까지는 spec 본체와 시스템 프롬프트 사이의 일시적 불일치가 존재한다는 점을 유지보수 체크리스트(§ 유지보수 체크리스트, line 992) 에서 이미 규정한 "Review skip 조건 변경 시 system-prompt.ts 동기화" 요건을 이번 PR 이 이행했음을 명확히 하면 충분하다.

### [INFO] 기존 합의 원칙 준수 확인

- **target 위치**: `system-prompt.ts` line 382; `system-prompt.spec.ts` lines 38-44
- **과거 결정 출처**: `spec/3-workflow-editor/4-ai-assistant.md § 유지보수 체크리스트` (line 992): "Review skip 조건 변경 시: `prompts/system-prompt.ts` Self-review 섹션 문구 동기화 (테스트 `system-prompt.spec.ts` "teaches the 2-stage finish self-review routine..." 가 고정)."
- **상세**: 이번 diff 는 정확히 이 유지보수 체크리스트 요건을 이행한다 — spec 의 skip 조건 결정(finishBlockCount 제거)을 프롬프트 문구에 반영하고, spec.ts 에 regression 단언 2건을 추가했다. 합의된 원칙을 위반하지 않고 오히려 준수했다.
- **제안**: 없음.

---

## 요약

이번 target diff(`system-prompt.ts` + `system-prompt.spec.ts`)는 `spec/3-workflow-editor/4-ai-assistant.md` Rationale §5 ("Review guard 항상 발동") 에서 이미 합의·기록된 `finishBlockCount > 0` skip 조건 제거 결정을 시스템 프롬프트 문구에 동기화한 것이다. 기각된 대안의 재도입이나 합의된 invariant 위반은 발견되지 않았다. spec §10 line 958 본체 텍스트가 아직 구 skip 조건 설명을 담고 있지만 이는 sibling PR #685 범위로 명시됐으며, 유지보수 체크리스트(line 992)가 요구하는 "skip 조건 변경 시 프롬프트 동기화" 의무를 이번 PR 이 정확히 이행했다. Rationale 연속성 관점에서 별도 수정이나 Rationale 갱신이 필요한 사항은 없다.

---

## 위험도

NONE
