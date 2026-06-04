# 요구사항(Requirement) Review — AI Context Memory (Phase A: Spec 작성)

리뷰 일시: 2026-06-03  
대상 파일: 14개 (review 산출물 6개 + spec 변경 8개)  
검토 범위: `spec/4-nodes/3-ai/` 신규 섹션(§10 memoryStrategy 확장, §11 System Context Prefix), `spec/5-system/17-agent-memory.md` 신규, `spec/1-data-model.md §2.23`, `spec/conventions/conversation-thread.md` 갱신, PRD 2개 갱신

---

## 발견사항

### [CRITICAL] `spec/5-system/17-agent-memory.md` — `pending_plans` 참조 파일 `ai-context-memory-followup-v2.md` 실존 확인 필요
- 위치: `spec/5-system/17-agent-memory.md` frontmatter `pending_plans`
- 상세: 파일에 `pending_plans: [plan/in-progress/ai-context-memory-followup-v2.md]` 가 선언되어 있다. 실존 확인 결과 `/Volumes/project/private/clemvion/.claude/worktrees/ai-context-memory-9c7e6e/plan/in-progress/ai-context-memory-followup-v2.md` 가 실존한다. 규약 준수 상태. **CRITICAL 아님 — 해소됨.**

### [WARNING] `spec/4-nodes/3-ai/0-common.md §10` — v1/v2 push 경계 서술 부정확
- 위치: `spec/4-nodes/3-ai/0-common.md` §10 첫 단락 (line ~1163 전체 파일 컨텍스트 기준)
- 상세: `0-common.md §10` 첫 단락이 "v1 은 `ai_agent` 만 push + 자동 주입을 구현하고, `text_classifier` / `information_extractor` 는 동일 인터페이스로 v2 에 push hook (final assistant turn) + 자동 주입이 함께 추가된다" 고 서술한다. 그러나 `spec/conventions/conversation-thread.md §7 v2 로드맵` 은 "push 는 이미 출하됐다 (`pushClassifierTurn` / `pushExtractorTurn` 가 `appendAiAssistantMessage` 호출)" 을 명시하고 있다. v1 에서 세 노드 모두 push 가 이미 출하된 상태인데, 상위 요약 단락이 "v1 은 ai_agent 만 push" 처럼 읽히므로 구현자가 오독할 경우 text_classifier / information_extractor push 를 제거하거나 건드릴 위험이 있다.
- 제안: `0-common.md §10` 첫 단락을 "v1 은 세 노드 모두 push 가 출하된 상태. `ai_agent` 만 자동 주입(inject/contextScope 계열 5필드) 을 구현하며, `text_classifier` / `information_extractor` 는 동일 인터페이스로 v2 에 자동 주입이 추가된다." 로 수정. `conversation-thread.md §2.3·§7` 과 정합 필요.

### [WARNING] `spec/4-nodes/3-ai/1-ai-agent.md §6.1` — `memoryStrategy ∈ {summary_buffer, persistent}` 시 `contextScope` 5필드의 무효 처리 경로가 step 번호 재배치로 인한 공백을 남김
- 위치: `spec/4-nodes/3-ai/1-ai-agent.md §6.1` — diff 에서 기존 `1.5. Conversation Thread 주입` 이 `1.5. 컨텍스트 메모리 주입` 으로 대체되면서 `1.3.` 이 새로 추가됨
- 상세: 실행 단계가 `1 → 1.3 → 1.5 → 1.7 → 2 → 2.5 → 2.7 → 3` 으로 재구성됐다. `d.5. 컨텍스트 메모리 재주입 (매 turn)` 에서 `memoryStrategy ∈ {summary_buffer, persistent}` 이면 "§6.1 의 1.3·1.5 를 매 turn LLM 호출 전 동일하게 적용하고, 턴 경계에서 §6.1 의 2.7(persistent 비동기 추출) 을 수행한다" 고 기술한다. 그러나 **단일 턴 경로 vs 멀티 턴 경로에서 1.3(persistent 회수)과 2.7(비동기 추출) 이 `summary_buffer` 전략에는 적용되지 않아야 하는데**, 단계 설명이 "1.3 persistent 회수" 를 `memoryStrategy='persistent' 시` 로 명시하나 `d.5` 는 "1.3·1.5 를 매 turn 적용" 이라고 뭉뚱그려 기술해 summary_buffer 에서도 1.3(persistent 회수) 이 호출되는 것으로 오독될 수 있다.
- 제안: `d.5` 의 기술을 "`memoryStrategy = summary_buffer` 이면 1.5(자동: 토큰예산 롤링 요약 압축) 만 적용하고 2.7 은 미적용. `persistent` 이면 1.3(persistent 회수) + 1.5(자동) + 2.7(비동기 추출) 모두 적용" 으로 분기를 명시적으로 기술.

### [WARNING] `spec/1-data-model.md §2.23 AgentMemory` — SoT 링크 dangling 가능성 해소 필요 확인
- 위치: `spec/1-data-model.md §2.23 AgentMemory` (추가된 내용)
- 상세: `§2.23` 은 `SoT: [Spec Agent Memory](./5-system/17-agent-memory.md)` 를 참조한다. `spec/5-system/17-agent-memory.md` 가 이번 변경에서 신규 추가되었으므로 링크가 실존한다. 이번 commit 에서 두 파일이 동시에 추가됐으므로 SoT 링크는 유효하다. **단** `spec/1-data-model.md` 는 spec-impl-evidence.md §1 의 frontmatter 의무 적용 제외 대상(`spec/1-data-model.md` — "단순 overview 성격") 이므로 frontmatter 가드가 걸리지 않는다. 이 파일의 §2.23 이 참조하는 `17-agent-memory.md` 가 삭제 또는 이름 변경 시 dangling 링크가 가드에 걸리지 않을 위험이 있다.
- 제안: INFO 수준이나, 향후 `17-agent-memory.md` 경로 변경 시 `spec/1-data-model.md` 의 링크도 함께 갱신해야 함을 `1-data-model.md` 내 주석으로 명시하거나, spec-code-paths 가드 예외 문서에 기록.

### [WARNING] `spec/conventions/conversation-thread.md §5.3` — 섹션 제목 변경으로 기존 앵커 링크 무효화 가능성
- 위치: `spec/conventions/conversation-thread.md §5.3` 제목 변경 (`Cap (v1 — char 기반)` → `Cap (v1)`)
- 상세: diff 에서 `### 5.3 Cap (v1 — char 기반)` 이 `### 5.3 Cap (v1)` 으로 변경됐다. `spec/4-nodes/3-ai/1-ai-agent.md §1` 의 `memoryTokenBudget` 설명 등 여러 곳에서 `[conversation-thread §5.3](../../conventions/conversation-thread.md#53-cap-v1--char-기반)` 앵커로 연결하고 있다. 제목 변경으로 앵커가 `#53-cap-v1` 로 바뀌면 기존 `#53-cap-v1--char-기반` 앵커 링크가 404 처리된다. GitHub markdown 렌더러는 앵커를 title 기반으로 생성한다.
- 제안: 기존 참조 앵커를 `#53-cap-v1` 로 일괄 갱신하거나, 제목을 되돌린다. 현재 diff 범위에서 `spec/4-nodes/3-ai/1-ai-agent.md §1 memoryTokenBudget` 의 링크 `[conversation-thread §5.3](../../conventions/conversation-thread.md#53-cap-v1--char-기반)` 는 그대로 남아있어 불일치 상태다.

### [INFO] `spec/5-system/17-agent-memory.md` — 추출 트리거 조건(정확히 몇 건/얼마나 자주 추출하는지) 미명세
- 위치: `spec/5-system/17-agent-memory.md §3 추출 파이프라인`
- 상세: "턴 경계마다 비동기 background 로 직전 turn(들)에서 추출" 이라 기술되어 있으나, 추출이 "모든 turn" 마다 발생하는지, 아니면 "일정 조건(예: n 턴마다, 또는 context 길이 임계치 도달 시)" 에만 발생하는지 명시되지 않았다. 비용(추출 LLM 콜) 과 빈도의 관계가 불명확해 구현 시 "매 턴 추출" 과 "조건 추출" 이 분기될 수 있다. §6.1 의 "비동기 background" 설명도 동일.
- 제안: `spec/5-system/17-agent-memory.md §3` 에 추출 트리거 정책 명시 — "v1 은 매 ai_assistant turn 마다 추출 시도. 최소 의미 있는 turn 길이 하한(예: N chars 미만은 skip) 은 구현 재량" 과 같이 범위 표기.

### [INFO] `spec/4-nodes/3-ai/1-ai-agent.md §6.1` — `summary_buffer` 전략에서 요약 LLM 콜 prompt 내용 미명세
- 위치: `spec/4-nodes/3-ai/1-ai-agent.md §6.1 step 1.5 자동 분기`
- 상세: "오래된 turn 부터 롤링 요약으로 압축한다 — 요약 블록은 system_text 안정 프리픽스에 배치하고 …요약 LLM 콜은 노드 `model`/`llmConfigId` 를 재사용한다" 라고 기술하나, 요약 LLM 콜의 프롬프트 템플릿(무엇을 요약하라고 지시하는지)이 명세되지 않았다. 구현자가 임의 프롬프트를 사용할 수 있어 요약 품질·재현성이 보장되지 않는다.
- 제안: `spec/5-system/17-agent-memory.md §3` 또는 `1-ai-agent.md §6.1` 에 요약 프롬프트 기본 템플릿 또는 "구현 시 결정 — 본 spec 에서 강제하지 않으나 `SUMMARIZE_PROMPT` 상수로 하드코딩" 수준의 단서 제공.

### [INFO] `spec/4-nodes/3-ai/1-ai-agent.md §7` — `meta.memory` 가 `memoryStrategy: 'manual'` 시 완전히 미포함인지 vs null/빈 객체인지 불명확
- 위치: `spec/4-nodes/3-ai/1-ai-agent.md §7.1` (추가된 `meta.memory` 행)
- 상세: "`meta.memory` — `memoryStrategy ≠ 'manual'` 시에만 echo" 로 명시되어 있다. "시에만" 이 구체적으로 (a) 필드 자체를 output 에서 제거, (b) `undefined`/`null`, (c) 빈 객체 중 어느 동작인지 spec 에서 명시하지 않는다. CONVENTIONS Principle 2 (meta = 런타임 측정값) 에서 "echo" 패턴을 따른다고 언급되어 있으나 "omit vs null" 은 서로 다른 직렬화 동작이다.
- 제안: `§7.1` 의 `meta.memory` 행 설명에 "미포함(`undefined` — output JSON 에서 키 자체 생략)" 을 명시적으로 표기.

### [INFO] `spec/4-nodes/3-ai/_product-overview.md` — ND-AG-25 ID 갭
- 위치: `spec/4-nodes/3-ai/_product-overview.md §3.2` 요구사항 표
- 상세: 기존 표에는 ND-AG-24 다음에 ND-AG-26 이 있고 ND-AG-25 가 없다 (표 자체가 ND-AG-25 를 건너뛴다). 이번 변경으로 ND-AG-27~30 이 추가됐다. ND-AG-25 의 부재는 이번 변경 전부터 존재하는 기존 이슈이며, 이번 변경과 직접 관련은 없다. 주목할 점은 상위 PRD `spec/4-nodes/_product-overview.md` 에는 ND-AG-25 가 존재한다(색상 구분 요구사항). 하위 `3-ai/_product-overview.md` 에서 ND-AG-25 를 누락한 것이 이번 변경으로 더 눈에 띄게 됐다.
- 제안: INFO 수준 — 기존 이슈로 이번 변경 범위 아님. 추후 `3-ai/_product-overview.md` 에 ND-AG-25 를 추가해 두 PRD 간 일관성 복원 권장.

### [INFO] [SPEC-DRIFT] `spec/conventions/conversation-thread.md §7 v2 로드맵` — Token-aware cap 항목이 "부분 실현" 으로 갱신됨
- 위치: `spec/conventions/conversation-thread.md §7` (diff 에서 Token-aware cap 항목 변경)
- 상세: 기존 §7 의 "Token-aware cap: char-based cap 을 provider tokenizer 기반으로" 항목이 "summary_buffer/persistent 의 token-budget 근사 방식으로 부분 실현됐다" 고 갱신됐다. 이는 코드 구현 변경이 아닌 spec 자체의 갱신이며, 이번 Phase A 작업에서 의도적으로 spec 로드맵을 현행화한 것으로 보인다. 코드 변경이 옳고 spec 반영이 이번 diff 에서 함께 이루어진 경우로 SPEC-DRIFT 가 아닌 정상 갱신이다. 단, "provider tokenizer-exact 방식은 v3 로 잔존" 이라는 신규 기술이 `spec/4-nodes/3-ai/1-ai-agent.md §12.10` 에만 있고, conversation-thread §7 에는 "v3 로 잔존" 표현이 없다 — 두 문서의 v2/v3 경계 표기가 일치하지 않는다.
- 제안: `[SPEC-DRIFT]` — 코드 유지 + spec 반영. `conversation-thread §7` 의 Token-aware cap 항목에 "provider tokenizer-exact 방식은 v3 로 잔존 (현재는 근사 추정)" 문구를 추가해 `1-ai-agent.md §12.10` 과 정합.

---

## 요약

이번 변경은 AI Agent 노드에 `memoryStrategy` (`manual`/`summary_buffer`/`persistent`) 와 관련 설정 필드를 추가하고, `spec/5-system/17-agent-memory.md` (신규), `spec/1-data-model.md §2.23`, `spec/conventions/conversation-thread.md` 갱신을 포함하는 대규모 spec 작성(Phase A) 이다. 기능 완전성과 비즈니스 로직 측면에서 memoryStrategy 의 세 전략(manual/summary_buffer/persistent)이 각 동작을 상세 기술했고, AgentMemory 데이터 모델·스코프 키·추출/회수/forgetting 파이프라인이 명세됐다. 주요 미비점은 (1) `0-common.md §10` v1/v2 push 경계 서술이 conversation-thread §7 의 "push 이미 출하" 사실과 충돌해 구현자 오독 위험이 있고 (WARNING), (2) `1-ai-agent.md §6.1 d.5` 의 멀티턴 재주입 설명이 summary_buffer 와 persistent 를 "1.3·1.5 를 매 turn 적용" 으로 뭉뚱그려 기술해 summary_buffer 에서 persistent 회수(1.3)가 호출된다는 오독을 낳을 수 있으며 (WARNING), (3) `conversation-thread.md §5.3` 제목 변경으로 기존 앵커 링크가 무효화될 가능성이 있다 (WARNING). spec/5-system/17-agent-memory.md 가 이번 변경에서 신규 작성됨으로써 cross_spec.md 에서 지적된 CRITICAL(파일 부재) 이 해소됐다. 나머지 INFO 발견사항은 구현 품질·spec 명확도 보완 제안이다.

## 위험도

MEDIUM

> (근거: `0-common.md §10` v1/v2 push 서술 충돌(WARNING) 이 구현자를 오도할 경우 text_classifier/information_extractor 의 기존 push 동작을 잘못 변경할 수 있다. `d.5` 의 summary_buffer/persistent 분기 기술 모호성(WARNING) 이 persistent 회수를 summary_buffer 에서 중복 호출하는 구현 실수로 이어질 수 있다. 두 WARNING 이 복합될 경우 MEDIUM → HIGH 로 상승 가능. `conversation-thread §5.3` 앵커 링크 무효화(WARNING)는 기능 버그가 아닌 문서 품질 이슈.)
