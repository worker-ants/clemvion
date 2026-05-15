## 발견사항

### [INFO] 테스트 파일 8종 — 범위 적절, 최소 변경
- **위치**: `buttons.spec.ts`, `chart.handler.spec.ts`, `form.handler.spec.ts` 등 8개
- **상세**: `ExecutionContext` 인터페이스에 추가된 `conversationThread` 필드를 Mock 객체에 보충하는 필수 변경. 모든 파일에서 동일한 패턴(`createEmptyConversationThread()`)을 일관되게 적용하고, import도 실제 사용처에만 추가됨.
- **제안**: 없음 — 범위 내 변경.

---

### [WARNING] `spec/conventions/node-output.md` Principle 8.2 — ConversationThread 무관 기존 불일치 수정 포함
- **위치**: `spec/conventions/node-output.md` L314, "프레젠테이션 뷰" 행 교체
- **상세**: `output.view (Principle 4 참고)` → 노드별 실제 필드 목록(`output.items / output.rows / output.data / output.rendered`)으로 교체하는 변경은 Principle 4.2에서 이미 폐기된 `output.view` 래퍼가 Principle 8.2에 잔존하던 **기존 불일치 수정**이다. ConversationThread 기능과 직접 관련이 없으나 consistency review(2026-05-14_17-19-21, rationale_continuity WARNING)에서 "구현 착수 전 수정 권장"으로 명시적 승인이 있었다. 범위 확장이지만 사전 검토에 의해 정당화된 케이스.
- **제안**: 해당 수정이 consistency check를 통해 승인된 후 이루어진 것임을 PR/commit 메시지에 명시해 향후 히스토리 추적을 돕도록 권장.

---

### [WARNING] `spec/1-data-model.md` — `form_submit` → `form_submitted` 수정 포함
- **위치**: `spec/1-data-model.md` L449
- **상세**: `interactionType: "form_submit"` → `"form_submitted"` 수정은 node-output.md와 execution-engine.md가 이미 `form_submitted`를 사용하고 있던 기존 불일치를 해소하는 것이다. ConversationThread 기능 자체와는 독립적인 data model 버그픽스. consistency review(2026-05-14_17-02-11, naming_collision INFO)에서 "구현 시 DB row 마이그레이션 필요 여부 확인" 을 follow-up으로 남겼으나, 해당 확인 여부가 이 diff에서는 확인되지 않는다.
- **제안**: 백엔드 코드에서 `interaction_data.interactionType` 저장 로직을 grep해 실제로 어느 값을 쓰는지 확인. DB에 `"form_submit"` 값이 기존 row에 존재한다면 one-off 마이그레이션 스크립트가 필요하다.

---

### [INFO] `spec/4-nodes/3-ai/0-common.md` — §10 CHANGELOG → §11 renumber 앵커 깨짐 미검증
- **위치**: `spec/4-nodes/3-ai/0-common.md`, 기존 §10 → §11
- **상세**: consistency review(2026-05-14_16-55-14, naming_collision INFO #8)에서 `grep -r "0-common.md#10" spec/` 점검을 권장했다. 해당 grep 수행 여부가 이 diff에서 확인되지 않는다. 다른 spec 문서에서 `0-common.md#10-changelog`로 링크를 걸고 있었다면 이 변경으로 링크가 조용히 깨진다.
- **제안**: `grep -r "0-common.md#10" spec/`를 실행해 깨진 링크 유무를 확인할 것.

---

### [INFO] plan 파일 2종 — 적절한 의존성 문서화
- **위치**: `ai-agent-tool-connection-rewrite.md`, `background-monitoring-api.md`
- **상세**: 두 plan에 순서 의존성 메모를 추가하는 것은 consistency review(2026-05-14_17-02-11, plan_coherence WARNING)에서 명시적으로 권고된 사항이다. 범위 내 변경.
- **제안**: 없음.

---

### [INFO] review/consistency 산출물 4세션 — 정상 워크플로 산출물
- **위치**: `review/consistency/2026-05-14_*/`
- **상세**: CLAUDE.md 규약에 따라 consistency checker 실행 결과를 `review/consistency/<timestamp>/`에 저장하는 것은 의도된 동작이다. 4세션은 각각 spec draft 1차 검토 → CRITICAL 해소 후 재검토 → impl-prep 검토 → follow-up spec draft 검토로 자연스러운 반복 흐름이다.
- **제안**: 없음.

---

## 요약

변경 범위는 전반적으로 ConversationThread 기능 도입에 잘 집중되어 있다. 테스트 파일 8종의 `ExecutionContext` Mock 보충은 최소·필수 변경이고, spec 파일들은 대부분 직접 관련 변경이다. 다만 `node-output.md` Principle 8.2 수정과 `data-model.md`의 `form_submit → form_submitted` 정정은 기존 불일치 해소 목적의 **범위 외 버그픽스**가 함께 포함된 케이스로, consistency review에서 사전 승인된 변경이므로 실질적 위험은 낮다. 유일한 실질적 리스크는 `0-common.md` §10 앵커 renumber 후 깨진 링크 여부가 미검증된 점이다.

## 위험도

**LOW**