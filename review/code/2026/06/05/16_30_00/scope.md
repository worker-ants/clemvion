# Scope Review — memory-strategy-extend-ie

**대상**: `git diff 21fa8194..HEAD` (5 commits)
**확정 범위**: information_extractor 한정 persistent (recall+extract) + multi-turn thread push 해소

---

## CRITICAL

없음.

---

## WARNING

### W-1 spec §7 하위 섹션 번호 불일치
- **위치**: `spec/4-nodes/3-ai/3-information-extractor.md` L673–L715
- **상세**: `## 7. Persistent 메모리` 아래 하위 섹션이 `### 9.1` / `### 9.2` / `### 9.3` (Rationale 절도 동일)로 붙어 있다. 상위 섹션 번호(7)와 하위 섹션 번호(9.x)가 불일치한다. 기능 오류는 없으나 spec 문서 내비게이션이 혼란스럽고, 앵커 링크(`#91-회수`)가 다른 문서에서 참조되면 오작동한다.
- **제안**: 하위 섹션을 `### 7.1` / `### 7.2` / `### 7.3`으로 정정, Rationale 절(현 `## 9`)도 `## 10`으로 번호 재조정.

---

## INFO

### I-1 text_classifier — 변경 없음 (정상)
- **위치**: `codebase/backend/src/nodes/ai/text-classifier/` 변경 파일 없음.
- **상세**: 범위 밖 노드다. spec/0-common.md·conversation-thread.md의 설명 갱신(text_classifier 는 항상 manual) 은 기존 동작 기술이며 구현 변경 없다. 의도에 부합.

### I-2 summary_buffer — IE에 미도입 (정상)
- **위치**: `information-extractor.schema.ts` L876 (enum `['manual', 'persistent']`)
- **상세**: schema enum에 `summary_buffer` 없음. `injectRecallPrefix` 내부 주석에도 "summary_buffer 없음" 명시. 설계 의도대로 제외.

### I-3 ai_agent 동작 변경 없음 (정상)
- **위치**: `codebase/backend/src/nodes/ai/ai-agent/` 변경 없음.
- **상세**: IE handler가 `buildRecallBlock` / `appendStablePrefix` / `DEFAULT_MEMORY_TOP_K` / `DEFAULT_MEMORY_THRESHOLD` 를 ai_agent 모듈에서 **import** 만 한다. ai_agent 소스 자체는 수정되지 않았다.

### I-4 multi-turn thread push — 범위 내 필수 선행 작업 (정상)
- **위치**: `information-extractor.handler.ts` L1201–L1208 (`buildMultiTurnFinalOutput` 종결 push 블록)
- **상세**: multi-turn 종결 경로 thread push는 persistent 추출의 source를 제공하는 전제 조건이다. 이 변경 없이는 persistent extraction이 빈 thread를 snapshot한다. `manual` 모드에서는 `conversationThreadRef`가 stateBase에 실리지 않아 `target === undefined` → push·extraction 모두 no-op (회귀 불변식 유지). 과도한 리팩토링이 아닌 최소 필수 구현이다.

### I-5 pushExtractorTurn → pushExtractorTurnTo 리팩토링 — 최소 범위 (정상)
- **위치**: `information-extractor.handler.ts` L107–L140
- **상세**: 기존 `pushExtractorTurn(context, config, extracted)` 는 wrapper로만 유지되고, 실 로직을 `pushExtractorTurnTo(target, nodeId, config, extracted)`로 분리한 것이다. single-turn 경로는 그대로 wrapper를 통하고, multi-turn 종결 경로만 직접 `pushExtractorTurnTo`를 호출한다. 범위 내 최소 리팩토링.

### I-6 spec 변경 — 기능에 비례 (정상)
- **위치**: `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/3-ai/3-information-extractor.md`, `spec/5-system/17-agent-memory.md`, `spec/conventions/conversation-thread.md`
- **상세**: 4개 spec 파일 모두 IE persistent 추가·multi-turn push 해소·text_classifier 영구 제외의 직접 설명 갱신이다. 기능 범위에 비례하며 로드맵 항목(`~~`→채택완료) 업데이트도 적절하다. 불필요한 섹션 추가나 무관 spec 수정 없음.

### I-7 frontend i18n — 최소 추가 (정상)
- **위치**: `codebase/frontend/src/lib/i18n/backend-labels.ts` L225–L351
- **상세**: 새 hint 문자열("manual = manage context with the fields below. persistent = cross-session recall + extraction.") 및 option label("Persistent — cross-session memory recall + extraction") 2건만 추가됐다. 기존 ai_agent 라벨 수정 없음.

---

## 요약

변경 범위는 확정 범위(information_extractor 한정 persistent recall+extract + multi-turn thread push)에 정확히 수렴한다. text_classifier 코드 변경 없음, summary_buffer IE 미도입, ai_agent 동작 미변경 모두 확인됐다. multi-turn thread push는 persistent 추출의 필수 전제이며 manual 모드에서는 완전 no-op(conversationThreadRef 미전달)로 회귀 안전하다. 경미한 spec 섹션 번호 오류(W-1: §7 하위를 `### 9.x`로 붙임)가 있으나 기능적 차단 사유는 아니다.

## 위험도

LOW

BLOCK: NO
