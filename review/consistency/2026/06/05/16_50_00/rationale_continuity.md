---
reviewer: rationale-continuity
worktree: memory-strategy-extend-ad5987
merge_base: 21fa8194
date: 2026-06-05T16:50:00
---

# Rationale 연속성 검토 (--impl-done)

검토 범위: `git diff 21fa8194..HEAD` — spec 변경 파일 한정.

---

## CRITICAL

### [CRITICAL] `summaryModel`/`extractionModel` — 명시 번복된 결정을 Rationale 없이 재역전

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §12.12` + §1 config 표 + §6.1 1.5/2.7 실행 로직
- **과거 결정 출처**: 동일 파일 `21fa8194` 버전 `§12.12 요약·추출 전용 LLM 모델 옵션 (summaryModel / extractionModel)`
- **상세**:
  머지-베이스(`21fa8194`) 시점에는 §12.12 에 "과거 결정(v1 scope-freeze) → 현 결정(번복 — 전용 필드 도입)" 구조가 있었다. 번복 근거로 (1) 비용 절감, (2) 품질 요구 분리의 정당성, (3) 하위호환 fallback 체인의 세 가지가 상세히 서술됐고, `summaryModel`/`extractionModel` 두 필드가 §1 config 표에 포함돼 있었다.

  이번 diff 는 이 두 필드를 완전 삭제하고 §12.12 제목을 "요약·추출 LLM 콜이 노드 model 을 재사용하는 근거"로 변경하여, 원래 v1 기각 결정을 되살리는 방향으로 spec 을 재작성했다. 그러나 재역전의 근거가 §12.12 본문에 명시되지 않았다 — 새 §12.12 는 "기각 대안은 summaryModel 별도 필드 도입이다 … v2 로드맵으로 유보한다"고 서술하나, 바로 전 커밋에서 이미 번복 결정을 내렸던 사실을 인식하고 그것을 다시 뒤집는 이유를 밝히지 않는다.

  결과적으로 conversation-thread §7 v2 로드맵에서도 "요약/추출 전용 저비용 모델" 항목이 "채택 완료" 취소선 상태에서 다시 미완료 로드맵으로 복원됐다.

- **제안**:
  §12.12 에 다음 구조를 명시해야 한다 — (a) 직전 PR 에서 채택됐던 번복 결정을 명시하고, (b) 이번 재역전 이유(예: scope-freeze 재강화, 구현 비용, 혹은 합의 미흡 등)를 Rationale 에 기록한다. 그렇지 않으면 독자가 두 커밋의 §12.12 를 비교할 때 어느 것이 의도된 최종 결정인지 알 수 없다. 구체적으로: "이전 채택 결정 번복: … / 재역전 근거: …" 형태로 추가.

---

### [CRITICAL] `contextScope` 자동 주입 — "세 노드 공통 출하 완료" 결정을 Rationale 없이 철회

- **target 위치**: `spec/conventions/conversation-thread.md §2.3 표/주석`, §5 섹션 제목, §7 v2 로드맵; `spec/4-nodes/3-ai/0-common.md §10`
- **과거 결정 출처**: `21fa8194` 시점의 `conversation-thread.md §2.3` 주석 (자동 inject 세 노드 공통 출하) + `0-common.md §10` 본문 (세 노드 공통 규약)
- **상세**:
  머지-베이스에서 conversation-thread §2.3 주석은 "자동 inject (`contextScope`) 도 공유 유틸 `injectConversationContext()` 로 추출해 세 노드 공통 출하됐다"라고 구현 완료를 선언했다. §5 섹션 제목도 "contextScope 자동 주입 (세 AI 노드 공통)"이었고, §7 로드맵에서 해당 항목은 "~~채택 완료~~ (A2)"로 취소선 처리됐다. 0-common §10 본문도 "세 노드 모두 push 와 contextScope 기반 자동 주입을 구현"이었다.

  이번 diff 는 이를 전면 철회하여 §2.3 표를 "자동 주입 (inject) — `ai_agent` 만 (text_classifier / information_extractor 도 동일 인터페이스 적용 — 현재 ai_agent 한정)"으로 변경하고, §5 섹션 제목을 "AI Agent 자동 주입"으로 축소하며, §7 로드맵을 다시 미완료 항목으로 되살렸다. 공유 유틸 파일 `shared/conversation-context-injection.ts`와 `shared/conversation-context-schema.ts`가 spec code frontmatter 에서도 삭제됐다.

  이 변경은 "구현 완료"로 표시된 기능 범위를 축소하는 것으로, §2.3 의 과거 서술이 잘못 작성된 것인지 아니면 이번 PR 에서 코드를 실제로 되돌린 것인지에 대한 Rationale 이 전혀 없다. 기각된 대안(inject 미구현 상태)을 재채택하는 것이나 마찬가지다.

- **제안**:
  (a) 해당 공유 유틸이 실제로 코드에서 제거됐는지 확인하고, (b) 철회 이유("A2 구현이 이번 scope 에서 제외됐다" 또는 "A2 는 전 PR 의 과오였다" 등)를 conversation-thread §8 혹은 신규 §Rationale 항목에 명시한다.

---

## WARNING

### [WARNING] `Execution.conversation_thread` 컬럼 채택 결정의 무근거 역전

- **target 위치**: `spec/conventions/conversation-thread.md §4 영속화 표`, §7 v2 로드맵, §8.4 섹션 삭제
- **과거 결정 출처**: `21fa8194` 시점의 `conversation-thread.md §8.4 Execution.conversation_thread 컬럼 채택 — durable park resume`
- **상세**:
  머지-베이스에서 §8.4 는 "신규 DB 컬럼 없음" 원칙을 durable park resume 한정으로 전환하여 `Execution.conversation_thread jsonb NULL` 컬럼을 채택하고, derived-view 재구성 대안 기각 근거까지 명시했다. 기각 근거로는 "runningSummary/summarizedUpToSeq 같은 thread 메타는 per-node output 에 분산 저장되지 않아 재구성으로 무손실 복원이 불가능"이 핵심이었다.

  이번 diff 는 §8.4 전체를 삭제하고, §4 표를 "v1 은 ConversationThread 본문에 신규 DB 컬럼 도입 없음"으로 되돌렸다. 과거 §8.4 에서 기각됐던 "derived-view 재구성(컬럼 없이)" 대안이 이번 변경으로 사실상 재채택된 것이나, 그 근거가 어디에도 없다.

- **제안**:
  §8 (또는 새 §8.4)에 재역전 근거를 기록한다 — 예: "§8.4 결정을 번복한다. 근거: 이번 scope 에서 migration V084 를 출하하지 않으므로 / derived-view 재구성 대안을 재검토하므로." conversation-thread §4 의 "신규 컬럼 없음" 선언이 §8.4 기각 근거(runningSummary 무손실 불가)와 어떻게 정합하는지 설명 필요.

---

### [WARNING] `information_extractor` `_resumeCheckpoint` 지원 — 채택 완료에서 미지원으로 역전

- **target 위치**: `spec/4-nodes/3-ai/3-information-extractor.md §15 _resumeState 표`; `spec/5-system/4-execution-engine.md §1.3 보존 예외`
- **과거 결정 출처**: `21fa8194` 시점의 `execution-engine.md §1.3` "ai_agent · information_extractor 멀티턴 노드" 공동 적용 + §Rationale §740 행
- **상세**:
  머지-베이스의 execution-engine §1.3 은 "적용 범위: `ai_agent` 와 `information_extractor` 의 multi-turn"으로 명시하고, IE 고유 state(`partialResult`/`collectionRetryCount`) 가 allow-list 에 포함된다고 서술했다. Rationale §740 에는 "IE 고유 runtime state 는 credential-free·소형이라 allow-list 합집합에 추가하는 비용이 낮다 — IE 도 restart/타 인스턴스 재개를 무손실 지원하고 graceful-reset 갭을 제거한다"는 채택 근거가 있었다.

  이번 diff 는 이를 "ai_agent 한정"으로 축소하고, §Rationale §741(+) 을 "ai_agent 한정: checkpoint allow-list 와 재구성기가 ai_agent 의 _resumeState shape 전용이다. information_extractor 등 고유 state 필드를 갖는 다른 ai_conversation 핸들러는 checkpoint 를 영속하지 않고 재개 시 graceful reset — 번복 이전과 동일 동작이므로 회귀가 아니다. 일반화는 후속 작업"으로 교체했다.

  "번복 이전과 동일 동작이므로 회귀가 아니다"라는 서술은 있으나, 이전 PR 에서 이미 확장 채택을 명시했던 사실을 인정하고 그것을 되돌리는 이유가 없다. 이것이 의도된 scope 축소라면 Rationale 에 "이전 채택 결정 번복" 명시가 필요하다.

- **제안**:
  execution-engine Rationale 의 "ai_agent 한정" 설명에 "직전 PR(21fa8194)에서 채택됐던 IE 지원 확장 결정을 이번 scope 에서 제외한다. 이유: …"를 추가한다.

---

### [WARNING] execution-engine Phase B (park 즉시 해제 + slow-path 일원화) — 확정 결정이 "검토 대상"으로 후퇴

- **target 위치**: `spec/5-system/4-execution-engine.md §4.x 구현 메모`, §7.4 Worker 동작 표
- **과거 결정 출처**: `21fa8194` 시점의 `execution-engine.md §Rationale "park 즉시 해제 + slow-path 일원화 (Phase B)"` + §4.x "park = 세그먼트 종료 (Phase B)" 메모
- **상세**:
  머지-베이스에서 §Rationale 의 "park 즉시 해제 + slow-path 일원화 (Phase B)" 섹션은 확정 결정으로 기록됐고, §4.x 메모는 "Phase B: park 시 runExecution 세그먼트가 즉시 반환 … 모든 재개는 §7.5 rehydration 단일 경로"로 완료 상태를 선언했다. §7.4 Worker 동작 표도 "항상 §7.5 rehydration 경로"가 확정이었으며, `firstSegmentBarriers`/`pendingContinuations` 제거 완료가 서술됐다.

  이번 diff 는 §4.x 메모를 "현재 재개 경로와 알려진 한계"로 교체하여 "park 즉시 코루틴 해제 + slow-path 일원화로의 전환이 검토 대상이다(추적: plan/in-progress/...)"로 서술하며, `firstSegmentBarriers`/`signalParkBarrier` 구현 메모를 복원했다. Phase B Rationale 섹션은 삭제됐다. 즉 완료된 아키텍처 결정이 미결 검토 사안으로 역전됐다.

- **제안**:
  §Rationale 에 "Phase B 상태 (2026-06-05 기준 — 과도기)" 항목을 추가하거나, 기존 "park 즉시 해제" 항목 앞에 "PR-B2 미완료 — 현재는 AI 멀티턴에서 in-memory 코루틴 잔존" 표시를 명시한다. 현재 §4.x 메모가 Phase B 완료 시 목표 상태와 현 과도기 상태를 구분하지 않아 Rationale 연속성이 훼손됐다.

---

## INFO

### [INFO] `0-common.md §10` — inject v2 범위 변경에 대한 내부 설명 보완 권고

- **target 위치**: `spec/4-nodes/3-ai/0-common.md §10` 본문
- **상세**:
  이번 변경 후 §10 본문에는 "v1 은 ai_agent 의 push + 자동 주입을 구현"으로 축소됐으나, 표 후 노트 블록들은 여전히 ai_agent 기준 서술이 남아 있다. inject 범위 축소 이유를 §10 내부에서 brief 하게라도 설명하면 독자 혼란이 줄어든다.
- **제안**: §10 서두에 "v1 inject 는 ai_agent 한정. text_classifier/information_extractor 의 inject 는 v2 로드맵 — 이전 PR 에서 세 노드 공통 출하 결정을 번복함" 한 줄 명시.

---

### [INFO] conversation-thread §7 로드맵 부활 항목 추적성

- **target 위치**: `spec/conventions/conversation-thread.md §7`
- **상세**:
  "DB 컬럼 신설"과 "text_classifier/information_extractor 자동 주입" 두 항목이 취소선("채택 완료")에서 다시 미완료 항목으로 부활했다. 이 자체는 운영상 문제가 없으나, 직전 PR 에서 완료 표시 후 이번 PR 에서 미완료로 되돌리는 것은 로드맵 추적성을 혼탁하게 한다.
- **제안**: §7 부활 항목 옆에 "(이전 PR 채택 결정 번복 — 근거 §8.x 참조)" 또는 해당 Rationale 링크 추가.

---

## 요약

이번 PR 의 spec 변경에서 머지-베이스(`21fa8194`) 시점에 확정됐던 다섯 가지 결정이 Rationale 없이 역전됐다. (1) `summaryModel`/`extractionModel` 전용 필드: 직전 커밋에서 "의도적 번복"으로 명시 채택한 결정을 이번 diff 에서 다시 제거하면서 재역전 이유가 §12.12 어디에도 없다 — 가장 심각한 CRITICAL. (2) contextScope inject "세 노드 공통 출하 완료" 선언: AI Agent 한정으로 범위 축소하면서 철회 근거가 없다 — CRITICAL. (3) `Execution.conversation_thread` 컬럼 채택(§8.4): 섹션 삭제와 함께 기각됐던 derived-view 대안이 재채택됐으나 근거 없음 — WARNING. (4) IE `_resumeCheckpoint` 지원: 채택 완료에서 미지원으로 역전됐으나 "번복 이전과 동일"이라는 불충분한 설명만 있음 — WARNING. (5) Phase B park 즉시 해제: 완료 결정이 "검토 대상"으로 후퇴하고 Rationale 섹션이 삭제됨 — WARNING. 이들 변경이 의도된 scope 축소라면 각 항목에 "번복 근거" 단락을 Rationale 에 추가해야 Rationale 연속성이 유지된다.

---

## 위험도

HIGH

BLOCK: NO
