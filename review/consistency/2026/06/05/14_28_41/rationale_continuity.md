---
STATUS: DONE
reviewer: rationale-continuity
worktree: memory-autoinject-extend-e102af
diff_range: 9e65f853..HEAD
date: 2026-06-05T14:28:41
---

# Rationale 연속성 검토 — memory-autoinject-extend-e102af

## 검토 범위

`git diff 9e65f853..HEAD` 의 spec 변경 전체. 핵심 질문:

1. `contextScope inject` 가 `ai_agent` 한정이라는 과거 결정이 **확정 결정**이었는지 vs **v2 로드맵(유보)**이었는지
2. 이번에 추가한 Rationale(contextScope 는 stateless 라 노드 무관 확장 가능, memoryStrategy 는 상태누적이라 ai_agent 유지)이 과거 합의와 모순 없는지
3. 기각 대안 재도입·합의 위반 여부

---

## 발견사항

### [WARNING] `summaryModel`/`extractionModel` 필드 기각 번복을 재번복 — 새 Rationale 존재하나 이력 단절

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §12.12`
- **과거 결정 출처**: 직전 커밋(`9e65f853` 직전 커밋)의 `spec/4-nodes/3-ai/1-ai-agent.md §12.12` 및 `spec/conventions/conversation-thread.md §7` v2 로드맵

- **상세**:
  이번 diff 에서 `summaryModel`/`extractionModel` 두 필드가 **삭제**됐다. diff 에서 직전 커밋 §12.12 는 "과거 v1 에서 두 필드 도입을 기각했고, 이를 의도적으로 번복해 도입한다"는 구조였다 (이전 PR #467 에서 채택). 이번 diff 는 그 "번복" 자체를 다시 되돌려 **"별도 모델 필드 신설 없음 — scope-freeze"** 로 환원했다.

  `conversation-thread.md §7` 의 `~~요약/추출 전용 저비용 모델(summaryModel/extractionModel): 채택 완료~~` 라인이 삭제되고, v2 로드맵 항목 자체도 제거됐다.

  새로운 §12.12 에는 "기각 대안: summaryModel 별도 필드 도입" 이라는 Rationale 이 작성돼 있어 현재 결정의 근거는 있다. 그러나 **"한 번 채택됐다가 철회됐다"는 이력**이 spec 어디에도 남지 않아, 향후 같은 제안이 반복될 때 "이미 검토해서 다시 기각한 이유"를 추적하기 어렵다.

- **제안**:
  §12.12 에 "직전 PR(#467)에서 도입했다가 scope-freeze 원칙 재적용으로 본 PR 에서 철회함" 을 한 줄 추가하거나, `conversation-thread.md §7` v2 로드맵에 "요약/추출 전용 저비용 모델 — v1 도입 후 재기각, v2 유보" 항목을 복원해 이력을 보존한다.

---

### [WARNING] `Execution.conversation_thread` 컬럼 채택 결정(§8.4) 삭제 — 마이그레이션 파일과 역방향 정합

- **target 위치**: `spec/conventions/conversation-thread.md §4` 영속화, `§7` v2 로드맵, `§8.4` (삭제됨)
- **과거 결정 출처**: 직전 커밋의 `conversation-thread.md §8.4` ("Execution.conversation_thread 컬럼 채택 — durable park resume") 및 `§4` 영속화 표의 "waiting_for_input park 진입 시" 행, `spec/1-data-model.md §2.x conversation_thread JSONB? 컬럼`, `spec/5-system/4-execution-engine.md §6.2 waiting_for_input 진입 시` 행

- **상세**:
  직전 커밋에 §8.4 가 존재해 "신규 DB 컬럼 없음" 원칙을 durable park resume 한정으로 전환한 이유, 기각 대안(derived-view 재구성), "신규 컬럼 없음"과의 정합을 명시했다. 이번 diff 는 §8.4 전체를 삭제하고 §4 영속화 표에서도 `Execution.conversation_thread` 관련 행을 제거해, **"v1 신규 DB 컬럼 없음"** 상태로 되돌렸다.

  그러나 **실제 코드 diff** 에는 `codebase/backend/migrations/V084__execution_conversation_thread.sql` 과 `V085__execution_user_variables.sql` 이 **신규 파일로 존재**한다. spec 은 컬럼이 없다고 하지만 구현에서는 컬럼을 만드는 마이그레이션이 추가됐다. 이는 spec-구현 역방향 정합 상태다.

  `spec/5-system/4-execution-engine.md` 에서도 "V084 durable commit" 참조들이 제거되고 durable resume 경로가 "durable checkpoint 한도 내에서만 복원"으로 축소 기술됐는데, V084 컬럼이 존재한다면 이 기술은 사실과 다르다.

  `spec/1-data-model.md` 에서도 `conversation_thread JSONB?` 와 `user_variables JSONB?` 컬럼 설명이 삭제됐고, `active_running_ms` 도 삭제됐다. 마이그레이션 V083(active_running_ms), V084(conversation_thread), V085(user_variables) 세 파일이 모두 이번 diff 에 코드 변경으로 추가됐으나 spec 에서는 모두 제거됐다.

- **제안**:
  두 가지 중 하나를 선택해야 한다:
  (a) V083/V084/V085 마이그레이션이 이번 PR 에 **포함**된 신규 구현이라면 spec 도 동일하게 복원해야 한다. `conversation-thread.md §4` 영속화 표 park 행 복원, §8.4 Rationale 복원, `data-model.md` 컬럼 기술 복원, `execution-engine.md` durable commit 경로 복원.
  (b) V083/V084/V085 가 **이전 PR 에서 이미 도입된 컬럼**이고 이번 spec 변경이 "그 컬럼을 롤백"하는 의도라면 롤백 마이그레이션 파일(V08x__drop_...)이 필요하다.
  현재 상태는 어느 쪽도 아닌 중간 상태로 Rationale 연속성의 직접 위반 수준이다.

---

### [INFO] `contextScope inject` 의 `ai_agent` 한정 — 로드맵 유보의 연속, Rationale 정합

- **target 위치**: `spec/4-nodes/3-ai/0-common.md §10`, `spec/conventions/conversation-thread.md §2.3, §7`
- **과거 결정 출처**: `0-common.md §10` 의 `memoryStrategy` 행 주석 "AI Agent 한정 (text_classifier/information_extractor 는 v2)", `conversation-thread.md §2.3` 표 "inject 는 ai_agent 한정, 로드맵"

- **상세**:
  `0-common.md §10` 에서 `contextScope inject 는 ai_agent 한정` 기술이 **이번 diff 에서 변경되지 않았다**. 기존 spec 은 `"AI Agent 한정 (text_classifier/information_extractor 는 v2)"` 로 기술해왔고, `conversation-thread.md §2.3` push vs inject 구분 표의 "로드맵" 열에도 동일 내용이 유지됐다. 따라서 이것은 **확정 기각이 아니라 v2 로드맵 유보**였으며, 이번 작업이 그것을 무근거로 번복하는 것은 아니다.

  다만 이번 PR 제목에서 언급한 "contextScope 는 stateless 라 노드 무관 확장 가능, memoryStrategy 는 상태누적이라 ai_agent 유지"라는 새 Rationale 은 이번 diff 의 spec 에서 확인되지 않는다. `0-common.md` 가 이번 diff 대상이 아니어서 해당 Rationale 이 추가됐는지 알 수 없다.

- **제안**:
  `0-common.md §10` 의 `memoryStrategy` 행 비고 또는 Rationale 절에 "contextScope(stateless, 노드 무관 확장 가능)와 memoryStrategy(상태누적, ai_agent 한정 유지)의 적용 범위 구분 근거"를 명시하는 것을 권장한다. 현재 기술은 이 구분을 설명하지 않는다.

---

### [INFO] `information_extractor _resumeCheckpoint` 지원 범위 번복 — 사유 Rationale 부재

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §7.5 resume 필드 표`
- **과거 결정 출처**: 직전 커밋 `1-ai-agent.md §7.5` 표의 `_resumeCheckpoint` 행: "ai_agent · information_extractor 모두 적용, IE 는 partialResult/collectionRetryCount 추가"

- **상세**:
  직전 커밋에서 `_resumeCheckpoint` 가 ai_agent 와 information_extractor 둘 다에 적용된다고 명시됐다. 이번 diff 는 이를 **"ai_agent 한정, information_extractor 는 미적용·graceful reset"** 으로 변경했다. 변경 사유(구현 미완? 범위 의도적 축소? IE 고유 state 로 인한 재사용 불가?)가 target 어디에도 Rationale 로 기술되지 않았다.

- **제안**:
  `1-ai-agent.md §7.5` 또는 `3-information-extractor.md` Rationale 절에 "IE 의 _resumeCheckpoint 지원을 ai_agent 한정으로 되돌린 이유"를 한 문단 추가한다.

---

## 요약

이번 diff 의 spec 변경에서 **`contextScope inject 의 ai_agent 한정`** 은 기존 spec 에서도 "확정 기각"이 아닌 **v2 로드맵 유보** 형태였으므로, 그것을 확장하는 것은 무근거 번복이 아니다. 이와 함께 추가한 "contextScope 는 stateless, memoryStrategy 는 상태누적" 구분 Rationale 이 `0-common.md` 에 실제로 추가됐는지는 이번 diff 범위(0-common.md 미변경) 내에서 확인되지 않는다. 더 심각한 문제는 두 WARNING 이다: (1) `summaryModel`/`extractionModel` 필드가 도입됐다 재취소되는 이력이 spec 에서 불투명하게 처리됐고, (2) **V083/V084/V085 마이그레이션 파일이 코드 diff 에 추가됐음에도 spec 의 영속화 표·데이터 모델·Rationale 에서는 제거되어** 구현과 역방향 정합 상태가 됐다. 후자는 단순 Rationale 문제를 넘어 spec-구현 정합성 직접 위반이며 별도 수정이 필요하다.

## 위험도

MEDIUM

## BLOCK: NO
