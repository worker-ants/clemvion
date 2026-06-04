# Rationale 연속성 검토 결과

검토 대상: `spec/4-nodes/3-ai/` (diff-base: origin/main)
검토 모드: --impl-done

---

## 발견사항

### [INFO] §12.10 의 v1/v2 경계 번복 — Rationale 갱신됨 (정합)

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §12.10 (신규 추가)
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md` §12.1 (main branch) — "v2: token-aware cap, `text_classifier`/`information_extractor` 도 주입"
- **상세**: main branch §12.1 은 "token-aware cap" 을 v2 로 명시 유보했다. target 은 `memoryStrategy: summary_buffer/persistent` 를 통해 `memoryTokenBudget` (토큰 예산 압축) 을 v1 AI Agent 에 도입한다. 외형상 합의된 v2 유보를 번복하는 것처럼 보인다. 그러나 §12.10 이 이를 명시적으로 인식하고 다음 근거를 기술했다: (a) 도입된 방식은 "token-budget 근사(`memoryTokenBudget`)" 이고 "provider tokenizer-exact 방식" 은 여전히 v3 로드맵 잔존이므로 §7 v2 항목 "Token-aware cap" 의 부분 실현이지 완전 번복이 아님, (b) `runningSummary`/`summarizedUpToSeq` 는 Redis ExecutionContext 직렬화에만 보관하고 신규 DB 컬럼 없음 — §12.1 의 "v1 신규 DB 컬럼 없음" 조항 유지, (c) `agent_memory` 는 별도 테이블이라 `Execution.conversation_thread jsonb` 신설이 아님.
- **제안**: 현재 §12.10 에서 충분히 설명하고 있다. 다만 `spec/conventions/conversation-thread.md §7 v2 로드맵` 의 "Token-aware cap" 항목 옆에 "token-budget 근사는 §12.10 에서 부분 실현 — 여전히 tokenizer-exact 는 v3 잔존" 한 줄 크로스레퍼런스를 추가하면 독자가 §7 만 읽을 때 번복처럼 오독하는 위험을 제거할 수 있다.

---

### [INFO] §12.1 v1/v2 경계표 — `text_classifier`/`information_extractor` push 완료 사실 반영

- **target 위치**: `spec/4-nodes/3-ai/0-common.md` §10 (변경됨)
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md` §12.1 (main branch) — "v1: push 는 3 AI 노드 모두", `spec/4-nodes/3-ai/0-common.md` §10 (main branch) — "`text_classifier`/`information_extractor` 는 v2 에 push hook + 자동 주입"
- **상세**: main branch §10 은 두 노드의 push 를 v2 로드맵으로 기술했다. 그러나 main branch §12.1 은 이미 "push 는 3 AI 노드 모두" 를 v1 완료로 선언하고 있어, §10 의 기술이 §12.1 과 이미 어긋났었다. target 은 §10 을 "v1 출하 완료 (push) + v2 예정 (inject)" 로 정정해 §12.1 과 정합시켰다. 이는 기각된 대안 재도입이 아니라 구현 현실 반영이며 `conversation-thread.md §2.3` (worktree 버전) 의 기술과도 일치한다. Rationale 갱신 없이 본문이 수정됐으나, §12.1 + `conversation-thread.md §2.3` 가 이미 이 사실을 기록하고 있다.
- **제안**: 0-common.md §10 에 "(§12.1 구현 상태 반영)" 한 줄 주석 또는 §12.1 링크를 추가하면 사후에 왜 바뀌었는지 추적이 용이해진다.

---

### [INFO] `memoryStrategy` 와 `contextScope` 두 축 분리 — Rationale 신규 제공됨 (정합)

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §12.9 (신규), `spec/4-nodes/3-ai/0-common.md` §10 `memoryStrategy` 행 추가
- **과거 결정 출처**: main branch 에 `memoryStrategy` 필드 없음 (contextScope/contextScopeN/contextInjectionMode 3필드 체계만 존재)
- **상세**: target 은 `memoryStrategy` 를 신설한다. §12.9 에서 "`contextScope` enum 확장 (`auto` 추가)" 를 기각된 대안으로 명시하고 별도 1급 필드를 선택한 이유 (의미 축 분리, 하위호환 0 리스크, `visibleWhen` 단순화) 를 기술한다. 이는 신규 결정이라 기존 Rationale 와 충돌하는 사항이 없고 새 Rationale 가 함께 작성돼 있다.
- **제안**: 정합. 이의 없음.

---

### [INFO] `§11.4` ordering 확장 — [5] 를 [5a]/[5b]/[5c]/[6] 으로 세분화

- **target 위치**: `spec/4-nodes/3-ai/0-common.md` §11.4 ordering 표 (변경됨)
- **과거 결정 출처**: main branch `0-common.md` §11.4 — "[5] Thread injection (contextScope ≠ 'none' + contextInjectionMode='system_text' 때만)" 단일 항목
- **상세**: target 은 [5] 를 "[5a] persistent 회수 블록 / [5b] 롤링 요약 블록 / [5c] manual thread injection" + "[6] 휘발성 꼬리" 로 세분화한다. 기존 [5] 의 `system_text`·manual 분기는 [5c] 로 정확히 보존된다. §12.11 에서 안정 프리픽스 배치 근거가 기술돼 있다. 기존 ordering 원칙 (prefix → systemPrompt → suffix → thread) 을 위반하지 않으며 새 memory 블록을 thread injection 단계 내 하위 순서로 삽입한 것이다.
- **제안**: 정합. 이의 없음.

---

### [WARNING] `text_classifier` 의 `retryable` 필드 — 기존 spec 에서 "필수 (구현됨)" 로 명시했으나 target 이 "미구현" 으로 번복

- **target 위치**: `spec/4-nodes/3-ai/2-text-classifier.md` §5.3 에러 출력 표 (`output.error.details.retryable` 행)
- **과거 결정 출처**: main branch `spec/4-nodes/3-ai/2-text-classifier.md` §5.3 — "`details.retryable`: [CONVENTIONS Principle 3.2.1] 에 따라 핸들러가 채운다: `LLM_CALL_FAILED`/`LLM_RATE_LIMIT` → `true`, auth → `false`" (구현됨으로 기술)
- **상세**: target 은 같은 행에 "🚧 **미구현 (Planned)** — … 현재 핸들러 catch 블록은 `details` 에 `originalInput` 만 set 하고 `retryable` 은 넣지 않는다" 로 번경했다. 이는 구현 현실 반영이지만, CONVENTIONS Principle 3.2.1 이 LLM 계열 노드에 `retryable` 을 **필수**로 규정한 인바리언트를 침해하는 사실을 spec 에 명시하는 것이다. 정정 이유 (코드 현실 반영) 가 본문에 적혀 있으나 Rationale 항목으로 분리되지 않았다.
- **제안**: `text-classifier.md §8 Rationale` 또는 pending_plan 인 `spec-sync-text-classifier-gaps.md` 에 "CONVENTIONS Principle 3.2.1 필수 필드 미구현 — 코드 정합 후 본 미구현 마커 제거" 한 항을 Rationale 로 추가해 번복의 context 를 명시한다. 현재는 Planned 마커만 있어 왜 이 상태가 허용됐는지 추적이 어렵다.

---

### [WARNING] `information_extractor` 의 `retryable` 필드 — 동일 패턴

- **target 위치**: `spec/4-nodes/3-ai/3-information-extractor.md` §5.3 에러 출력 표 (`output.error.details.retryable` 행)
- **과거 결정 출처**: main branch `spec/4-nodes/3-ai/3-information-extractor.md` §5.3 — "CONVENTIONS Principle 3.2.1 에 따라 handler 의 모든 error 경로가 `retryabilityDetails` 헬퍼로 채운다 ([handler] `buildErrorOutput`)" (구현됨으로 기술)
- **상세**: target 은 같은 행을 "**미구현 (Planned)** — … 현재 handler 의 모든 error 경로가 `details` 에 `retryable` 을 채우지 않는다" 로 번경했다. text-classifier 와 동일 패턴으로 Rationale 항목 부재.
- **제안**: text-classifier 와 동일 — `information-extractor.md` Rationale 또는 pending_plan 에 번복 근거 명시.

---

## 요약

`spec/4-nodes/3-ai/` 전체의 변경은 Rationale 연속성 관점에서 대체로 정합하다. 가장 중요한 번복인 v1/v2 경계 (token-aware cap) 는 §12.10 에서 "부분 실현 + tokenizer-exact 는 v3 잔존" 으로 충분히 근거가 기술됐고, `memoryStrategy` 신설은 §12.9 에서 기각된 대안 포함 상세 Rationale 가 작성됐다. `§11.4 ordering` 확장도 §12.11 로 뒷받침된다. 다만 `text_classifier`/`information_extractor` 의 `output.error.details.retryable` 이 CONVENTIONS Principle 3.2.1 의 필수 invariant 임에도 "미구현" 으로 번복된 부분은 Rationale 항목 없이 Planned 마커만 남겨져 있어, 해당 번복이 의도된 기술 부채인지 단순 누락인지 추적이 어렵다. `text_classifier`·`information_extractor` 의 push 완료 상태 반영도 §12.1 과의 정합을 위한 사실 정정이나 0-common §10 에 근거 링크가 없다.

## 위험도

LOW

---

STATUS: SUCCESS
