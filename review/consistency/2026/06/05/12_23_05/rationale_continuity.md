# Rationale 연속성 검토 결과

검토 모드: `--impl-done` (구현 완료 후 검토)  
검토 범위: `spec/5-system/` (diff-base: origin/main)  
실제 변경 파일: `spec/5-system/4-execution-engine.md`, `spec/5-system/17-agent-memory.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/4-nodes/3-ai/3-information-extractor.md`, `spec/conventions/conversation-thread.md`, `spec/2-navigation/16-agent-memory.md`(삭제)

---

## 발견사항

- **[INFO]** `information_extractor` checkpoint 지원 확장 — 기각된 대안이 아닌 명시 후속 작업 실현
  - target 위치: `spec/5-system/4-execution-engine.md` §1.3 `_resumeCheckpoint` 적용 범위 + §Rationale "Multi-turn 재시작 재개" 마지막 bullet
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §Rationale "Multi-turn 재시작 재개 — `_resumeCheckpoint` 보존" 의 `ai_agent` 한정 bullet — "일반화는 후속 작업"으로 명시적으로 **유예(deferred)**했으며 기각이 아니었다
  - 상세: 과거 Rationale 는 `information_extractor` 를 "checkpoint 미영속 → graceful reset" 으로 정의하면서 명시적으로 "회귀가 아니다 / 일반화는 후속 작업"이라 기술했다. 이번 변경은 그 후속 작업을 실현한다. 새 Rationale bullet (`ai_agent + information_extractor 지원 — 초기 ai_agent 한정에서 확장`)이 §Rationale 내 동일 섹션에 추가되어 번복 근거 (a)/(b)/(c) 세 항목을 명시한다. 형식 요건(`결정의 무근거 번복` 관점)은 충족.
  - 제안: 현재 처리가 적절하다. 다만 §Rationale 의 기존 "`ai_agent` 한정" bullet 이 그대로 남아 있으므로, 독자가 두 bullet 을 함께 읽을 때 혼동 가능성이 낮지 않다. 명확성을 위해 과거 bullet 에 "(A2b 에서 확장됨 — 아래 항목 참조)" 단서를 추가하거나, 두 bullet 을 하나로 통합하는 편집을 권장한다.

- **[INFO]** `spec/5-system/17-agent-memory.md` §6 삭제 + `spec/2-navigation/16-agent-memory.md` 파일 삭제 — 완료 표기에서 미완료 로드맵으로 강등
  - target 위치: `spec/5-system/17-agent-memory.md` §6(메모리 관리 API), v2 로드맵의 "메모리 가시화 UI" 항목
  - 과거 결정 출처: `spec/5-system/17-agent-memory.md` §6 (AGM-12/13 요구사항 정의), v2 "실현됨" 체크리스트에서 `~~메모리 가시화 UI~~: ✅ 완료`
  - 상세: 이전 spec 은 §6 를 API 정의(AGM-12/13 요구사항 포함)로 두고 v2 로드맵에서 "실현됨" 으로 표시했다. 이번 변경은 §6 전체를 삭제하고 "메모리 가시화 UI" 를 "남은 로드맵" 으로 강등했다. 이는 "구현 완료" 였던 항목을 "미완료"로 되돌리는 역전이다. `spec/2-navigation/16-agent-memory.md` 파일 전체도 삭제됐다.  
  그러나 `plan/in-progress/agent-memory-admin-ui.md` 및 코드베이스 변경(`codebase/backend/src/modules/agent-memory/**`, `codebase/frontend/src/app/(main)/agent-memory/page.tsx`)이 이번 브랜치에 포함되어 실제 구현은 존재한다. 즉 spec 삭제가 "기능 철회"가 아니라 "이 plan/spec 영역 밖으로 이동"임을 시사하지만, Rationale 에 그 판단(왜 이 변경에서 spec §6 를 제거했는가)이 기록되지 않았다.
  - 제안: `spec/5-system/17-agent-memory.md §Rationale` 또는 PR 설명에 "AGM-12/13 의 API·UI 정의는 `plan/in-progress/agent-memory-admin-ui.md` 로 이관되어 별도 spec 문서(`spec/2-navigation/16-agent-memory.md`)로 관리되며, 본 spec 에서는 API 계약을 비포함"임을 명시하는 한 줄 주석 추가 권장. 또는 §6 를 삭제하는 대신 `plan/in-progress/agent-memory-admin-ui.md` 로의 참조를 남기는 방식.

---

## 요약

이번 변경의 핵심은 두 가지다. (1) `information_extractor` 를 `_resumeCheckpoint` 지원 범위에 포함하는 확장 — 이는 과거 Rationale 이 "일반화는 후속 작업"으로 명시 유예했던 사항을 실현한 것이며, 번복 근거가 §Rationale 동일 섹션에 새 bullet 으로 기록돼 있어 Rationale 연속성 요건을 충족한다. (2) `spec/5-system/17-agent-memory.md` §6 및 `spec/2-navigation/16-agent-memory.md` 삭제 — "완료" 항목을 "미완료 로드맵"으로 되돌리는 역전이 발생했으나 그 판단 근거가 Rationale 에 명시되지 않았다. 두 번째 항목은 실제로는 별도 plan으로 이관하는 리팩터링으로 보이지만 spec 단독으로는 이유를 알 수 없어 독자 혼란 가능성이 있다. 전반적으로 심각한 합의 원칙 위반이나 기각된 대안의 재도입은 발견되지 않았다.

---

## 위험도

LOW
