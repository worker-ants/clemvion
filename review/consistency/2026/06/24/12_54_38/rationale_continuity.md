# Rationale 연속성 검토 결과

검토 모드: spec draft 검토 (--spec)
Target: `plan/in-progress/spec-draft-m3-m1-ai-assistant-sync.md`

---

## 발견사항

### [INFO] 1-D 편집 — spec body 의 `finishBlockCount > 0` 잔류는 이미 결정된 Rationale 와 불일치 (편집이 올바르게 수정)

- target 위치: 편집 1-D (`spec/3-workflow-editor/4-ai-assistant.md` L958 기존 라인 제거)
- 과거 결정 출처: 동 spec `## Rationale` → "### Workflow Assistant — 프로바이더 이상동작 대응 + review 항상 발동" → "#### 5. Review guard 항상 발동 (사용자 요구 반영)" (L1072-1088)
- 상세: Rationale §5(L1078)는 "shouldSkipReview 에서 `finishBlockCount > 0` 체크를 **제거**" 하고 두 가드를 독립 계층으로 운영한다고 명시 결정했다. 그러나 현재 spec body L958 에는 `state.finishBlockCount > 0` 이 skip 조건으로 여전히 남아 있어 Rationale 이미 확정된 결정과 body 가 모순 상태다. 이 모순을 해소하는 것이 편집 1-D 이며, 이는 **기각된 대안을 재도입하는 것이 아니라** 이미 결정·서술된 Rationale 에 맞게 body 를 동기화하는 올바른 방향이다.
- 제안: 편집 방향 자체는 정확하다. 단, 편집 후 유지보수 체크리스트(L992)에 "Review skip 조건 변경 시 `system-prompt.ts` Self-review 섹션 동기화" 의무가 명시돼 있으므로, 이 편집 PR 에서 시스템 프롬프트 동기화가 함께 이뤄졌는지 확인 필요(코드 수준 — spec 범위 밖이지만 Rationale 에 기록된 유지보수 invariant 임).

---

### [INFO] 1-B / 1-C 편집 — `MIN_EDITS_FOR_VERIFY` 상수명 보정은 어떤 Rationale 결정도 번복하지 않음

- target 위치: 편집 1-B (L680), 1-C (L945) — 상수명 교체
- 과거 결정 출처: 동 spec `## Rationale` → "Part B — 2-stage finish" (L937-950)
- 상세: Part B Rationale 는 verify 게이트를 "성공 edit 이 일정 수 이상이고 non-trigger 노드 ≥ 3" 조건으로 기술했으나 상수명을 `MIN_EDITS_FOR_VERIFY` 로 박았다. 편집 1-B/1-C 는 실제 코드의 단일 게이트 `MIN_NONTRIGGER_NODES_FOR_VERIFY`(=3) 로 교체하면서, "성공 edit 이 있어야 한다"는 조건은 §review skip 에서 이미 보장된다고 재서술한다. Rationale 에서 기각된 대안을 재도입하는 것이 아니며, verify 게이트의 논리 자체(non-trivial 턴 한정 발동)는 보존된다.
- 제안: 이슈 없음. 단, Phase 2 의 "성공 edit 이 1건 이상" 조건이 `evaluateVerifyGuard` 에서 직접 체크가 아닌 `shouldSkipReview` 를 통해 간접 보장된다는 점이 spec 상 명확히 드러나도록 편집 1-B 의 new_string 이 기술하고 있어 적절하다.

---

### [INFO] 1-F 편집 — `consecutiveStallRounds > 0` → `totalStallCount > 0` 보정: Rationale §7 의사코드와 일부 불일치하나 의미 충돌 없음

- target 위치: 편집 1-F (`spec/3-workflow-editor/4-ai-assistant.md` L1304 수정)
- 과거 결정 출처: 동 spec `## Rationale` → "#### 7. Stall 자동 복구 (gpt-oss-120b 임의 중단)" (L1135-1171) 및 "#### 10. Stall 자동 복구 UX" (L1269-1344)
- 상세: Rationale §7(L1156-1169) 의사코드는 stall 루프 내에서 `consecutiveStallRounds` 를 카운터로 쓰고 "진척이 있는 라운드는 `consecutiveStallRounds = 0` 으로 리셋" 한다고 서술한다. L1304 에는 최종 persist 의 `autoResumed` 판정이 `consecutiveStallRounds > 0` 으로 돼 있다. 편집 1-F 는 이를 `totalStallCount > 0` 으로 교정하면서 이유를 명시(`consecutiveStallRounds` 는 진척 라운드에 리셋되므로 누적 판정에 부적합)한다. 이 보정은 코드 현실에 맞추는 것이며, Rationale §7 의사코드가 루프 내 `consecutiveStallRounds` 사용을 정의한 것과 충돌하지 않는다 — 루프 내 bound 체크(`consecutiveStallRounds < MAX_STALL_ROUNDS`)는 여전히 `consecutiveStallRounds` 로 유지되고, **최종 persist 의 `autoResumed` 판정만** 별도 누적 카운터(`totalStallCount`)를 쓴다는 분리가 새로 명시된다.
- 제안: 이슈 없음. 다만 편집 이후 Rationale §7 의사코드(L1156-1169)에 `totalStallCount` 카운터가 전혀 언급되지 않아 `consecutiveStallRounds` 와 `totalStallCount` 의 역할 분리가 §10(L1269~) 에서 추론해야 하는 상황이다. 명확성 향상을 위해 §7 의사코드 뒤에 `totalStallCount`(누적, 0 리셋 없음) vs `consecutiveStallRounds`(루프 bound 용) 역할 분리를 한 줄로 추가하는 것을 권장.

---

### [INFO] 1-H 편집 — M-3 Rationale 추가는 기존 결정과 충돌 없는 additive 변경

- target 위치: 편집 1-H (`spec/3-workflow-editor/4-ai-assistant.md` Rationale 에 새 섹션 삽입)
- 과거 결정 출처: 해당 spec `## Rationale` 전체 (설계 원칙: Rationale 에 "왜 이 선택인가 / 어떤 대안을 기각했는가" 를 누적 기록)
- 상세: 삽입 텍스트는 M-3 collaborator 분리(AssistantFinishGuard / AssistantTurnPersistenceService / AssistantToolRouter)의 사실과 설계 경계를 기록하며, 기존 Rationale 의 어떤 항목과도 충돌하지 않는다. "`streamMessage` 가 SSE·tool-loop·turn-scoped 상태를 소유하고 가드/영속/라우팅은 무상태 collaborator" 라는 설계 원칙은 Part B 의 "가드는 판정만, 상태는 호출부 소유" 기술과 일치한다.
- 제안: 이슈 없음.

---

### [INFO] 2-C 편집 — ai-agent.md `## Rationale` 부재 상태에서 추가 제안

- target 위치: 편집 2-C (`spec/4-nodes/3-ai/1-ai-agent.md` Rationale 섹션에 M-1 분할 메모 추가)
- 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md` — 실제 `## Rationale` 헤더 미존재 (grep 0건 확인)
- 상세: `1-ai-agent.md` 에는 현재 `## Rationale` 헤더가 없다. 하위 섹션(§12.x) 의 결정 이유 서술이 본문 안에 인라인으로 존재하나, 형식적 `## Rationale` 절이 없다. target 편집 2-C 는 "확인 필요 — 정확한 라인 grep 후 확정" 으로 기술하며 위치 미확정 상태다. 이 상태에서 Rationale 섹션을 신설하면서 M-1 분할 메모를 추가하는 것은 기존 결정을 번복하는 것이 아니나, 위치가 확정되지 않은 채 편집을 적용하면 문서 구조가 불일치할 수 있다.
- 제안: 2-C 적용 전, `spec/4-nodes/3-ai/1-ai-agent.md` 파일 끝에 `## Rationale` 헤더를 신설하고 M-1 분할 메모를 첫 항목으로 삽입하는 방식을 권장. target 의 "위치 확인 필요" 항목이 적용 단계에서 해소돼야 한다.

---

### [INFO] 3-A 편집 — 행위자 위임 표기 변경은 llm-usage.md 내 기존 Rationale 와 무충돌

- target 위치: 편집 3-A (`spec/data-flow/7-llm-usage.md` L108 표 셀 수정)
- 과거 결정 출처: 동 spec `## Rationale` (해당 섹션에서 usage 적재 흐름·context 필드 결정이 명시돼 있으면 일치 여부 점검 필요)
- 상세: 편집은 `persistAssistantTurn` 의 소유 서비스 표기만 바꾼다 — 실제 usage 적재 흐름(assistant message row + usage_log 양쪽), context 필드(`workflow_id` 만), 적재 방법은 모두 불변. Rationale 에 기각된 대안(예: usage 를 usage_log 에만 적재하거나 context 에 `node_id` 를 추가하는 안)이 있다면 그와 충돌하지 않는다.
- 제안: 이슈 없음.

---

## 요약

target 문서(`spec-draft-m3-m1-ai-assistant-sync.md`)의 모든 편집쌍은 behavior-invariant doc-sync 를 일관되게 선언하고 있으며, 검토한 범위에서 기존 Rationale 에 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 위반하는 항목은 발견되지 않았다. 가장 중요한 편집(1-D, `finishBlockCount > 0` 제거)은 오히려 이미 Rationale §5 에 결정·서술돼 있으나 body 에 반영되지 않은 모순을 해소하는 방향이다. `consecutiveStallRounds` vs `totalStallCount` 의 역할 분리(1-F)는 Rationale §7 의사코드에 선행 언급이 없어 추후 §7 에 한 줄 보완이 바람직하지만 결정 번복은 아니다. `2-C`(ai-agent Rationale 신설) 는 위치 미확정 상태이므로 적용 단계에서 파일 끝 `## Rationale` 헤더 신설로 해소해야 한다.

## 위험도

LOW
