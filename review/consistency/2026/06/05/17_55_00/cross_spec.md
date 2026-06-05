# Cross-Spec 일관성 검토 — memory-tokenizer-exact (A4 lite)

**검토 범위**: `git diff cbfbfbb9..HEAD` 내 변경 파일만.  
**변경 파일**: `spec/4-nodes/3-ai/1-ai-agent.md` · `spec/conventions/conversation-thread.md` · `spec/5-system/17-agent-memory.md` · `codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.ts` · `agent-memory-injection.spec.ts` · `plan/complete/memory-token-estimate-lite.md`

---

## 발견사항

### INFO: 17-agent-memory.md 의 §12.10 앵커 링크 비정확 (비치명)

- **target 위치**: `spec/5-system/17-agent-memory.md` line 20 — `[Spec AI Agent §6.1·§12.10](../4-nodes/3-ai/1-ai-agent.md#6-실행-로직)`
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md` line 1267 — `### 12.10 conversation-thread v1/v2 경계 번복의 근거`
- **상세**: 표시 텍스트에 `§6.1·§12.10` 두 섹션을 함께 인용하지만 하이퍼링크 앵커는 `#6-실행-로직` 하나만 가리킨다. `§12.10`의 실제 앵커는 `#1210-conversation-thread-v1v2-경계-번복의-근거` 이며 Rationale 섹션(§12)에 위치한다. 독자가 §12.10으로 직접 이동할 수 없다.
- **제안**: 링크를 `[Spec AI Agent §6.1](../4-nodes/3-ai/1-ai-agent.md#6-실행-로직) · [§12.10](../4-nodes/3-ai/1-ai-agent.md#1210-conversation-thread-v1v2-경계-번복의-근거)` 처럼 분리하거나, 단순히 §6.1 만 링크하고 §12.10 표기는 괄호 텍스트로만 유지. 기능 정확성에는 무영향 — 열람 편의 이슈.

---

### INFO: 구현 경로 분리 명시 (spec ↔ 코드 일치 확인)

- **target 위치**: `codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.ts` — `estimateTokens` import 제거, `estimateTokensLanguageAware` 신설
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 line 360, §12.10 line 1273 — "KB 청킹의 char/3 추정(`text-chunker`)과는 별개 경로"
- **상세**: spec 이 "메모리 예산 경로 한정, KB 청킹·thread char-cap 은 무변경" 을 명시하고, 구현도 `text-chunker` import 를 제거해 두 경로를 물리적으로 분리했다. 테스트에서 `kbEstimateTokens` 가 여전히 uniform `ceil(len/3)` 임을 별도 검증한다. spec ↔ 코드 일치.

---

### INFO: conversation-thread §5.3 char-cap 무변경 일관성 확인

- **target 위치**: `spec/conventions/conversation-thread.md` §7 line 289
- **충돌 대상**: `spec/conventions/conversation-thread.md` §5.3 (변경 없음)
- **상세**: §7 에 "§5.3 char-cap 자체는 무변경" 이 명기됐고, §5.3 본문(`MAX_INJECTED_TURNS` / `MAX_TURN_TEXT_CHARS` / `MAX_INJECTED_CHARS`)은 이 PR diff 에 포함되지 않는다. `memoryStrategy: manual` 경로와 `summary_buffer/persistent` 경로의 메커니즘 상호 배타도 §5.3 callout 에서 선행 PR 에서 이미 기술됐고 이번에 변경 없다. 일관성 유지.

---

### INFO: provider tokenizer-exact v3 로드맵 기술 일관성

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 line 360 및 §12.10 line 1272–1273
- **충돌 대상**: `spec/conventions/conversation-thread.md` §7 line 289
- **상세**: 세 문서 모두 "provider tokenizer-exact 는 v3 로드맵 잔존, 현재는 근사" 로 기술. 정밀도 기술이 "균일 char/3 근사" → "language-aware 근사(여전히 근사)" 로 업데이트됐고 세 문서 간 기술이 일치한다. 모순 없음.

---

## 요약

PR 이 변경한 세 spec 파일(`1-ai-agent.md §6.1/§12.10`, `conversation-thread.md §7`, `17-agent-memory.md Overview`)의 토큰 추정 기술은 상호 일관된다. 메모리 예산 경로가 균일 `char/3` 에서 language-aware 휴리스틱(Latin ~4, CJK ~1.7, 그 외 ~3)으로 변경됐음을, 여전히 근사이며 provider tokenizer-exact(v3 로드맵)가 아님을, KB 청킹·thread char-cap 은 무변경임을, 세 문서가 동일하게 기술한다. 구현도 `text-chunker` 의존을 제거해 경로를 물리 분리했고 테스트로 분리를 증명한다. CRITICAL/WARNING 발견사항 없음. INFO 1건(§12.10 앵커 링크 단일화로 §6.1 만 링크)은 가독성 이슈이며 기능·정합성에 영향 없다.

## 위험도

LOW

---

BLOCK: NO
