# Cross-Spec 일관성 검토 결과

검토 대상: `spec/4-nodes/3-ai/` (0-common.md, 1-ai-agent.md)
검토 모드: 구현 완료 후 (--impl-done, scope=spec/4-nodes/3-ai/, diff-base=origin/main)
검토 일시: 2026-06-04

---

## 발견사항

### [INFO] `0-common.md §10` 의 `text_classifier` / `information_extractor` inject v2 로드맵 — `conversation-thread.md §7` 와 표현 정합
- target 위치: `spec/4-nodes/3-ai/0-common.md §10` 본문 마지막 단락
- 충돌 대상: `spec/conventions/conversation-thread.md §2.3` 및 `§7`
- 상세: `0-common.md §10` 는 "push 완료 vs inject 미완" 을 구분하고, `text_classifier` / `information_extractor` 의 final assistant push 가 v1 출하됐음을 명시한다. `conversation-thread.md §2.3` 과 §7 로드맵이 동일 내용을 반복 기술하고 있어 두 곳이 항상 동기화되어야 하는 명시적 coupling이 존재한다. 현재 양쪽 내용은 일치하나, 한쪽이 업데이트될 때 다른 쪽 누락 위험이 있다.
- 제안: `0-common.md §10` 에 "단일 진실은 `conversation-thread.md §2.3·§7`" 주석을 추가하거나, `conversation-thread.md §2.3` 에 "0-common.md §10 참조" 역링크를 강화해 drift 차단.

---

### [INFO] `0-common.md §11.4` systemPrompt build ordering SoT 선언과 `conversation-thread.md §5` 의 ordering 언급
- target 위치: `spec/4-nodes/3-ai/0-common.md §11.4` ("본 ordering 의 단일 SoT 는 본 §11.4")
- 충돌 대상: `spec/conventions/conversation-thread.md §5` (주입 위치 ordering 서술)
- 상세: `0-common.md §11.4` 가 ordering ([1]~[6]) 의 단일 진실임을 명시하고, `conversation-thread.md §5` 는 thread injection 단계만 다룬다고 명시한다. 실제로 두 문서는 충돌하지 않고 역할이 분리되어 있다. 다만 `conversation-thread.md §5` 의 "ordering 의 단일 SoT 는 §11.4" 역참조가 명문화되어 있어 현재는 일관적이다.
- 제안: 현행 유지. 향후 ordering 변경 시 `0-common.md §11.4` 만 수정하면 됨을 양쪽 문서에서 확인할 수 있도록 현 교차 참조 패턴을 유지.

---

### [INFO] `1-ai-agent.md §1` 의 `memoryStrategy` 필드 — `spec/conventions/conversation-thread.md §5.3` cap 메커니즘 상호 배타 정책
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §1` (`memoryStrategy`, `memoryTokenBudget` 필드 설명)
- 충돌 대상: `spec/conventions/conversation-thread.md §5.3` ("memoryStrategy 별 cap 메커니즘" 주석)
- 상세: `1-ai-agent.md §1` 은 `memoryStrategy ∈ {summary_buffer, persistent}` 일 때 `contextScope` 계열 5필드가 무효라고 명시한다. `conversation-thread.md §5.3` 도 "manual=char-cap, 자동=token-budget 상호 배타" 를 명시한다. 두 곳이 동일 규칙을 기술하며 현재 일치한다.
- 제안: 현행 유지. 두 문서가 각자의 SoT 영역(노드 설정 vs conversation thread cap)을 분리해 기술하고 있어 정합.

---

### [INFO] `1-ai-agent.md §7` config echo 에서 `includeSystemContext` / `systemContextSections` 의 "default 값과 일치하면 생략" 규칙 — `0-common.md §11.7` SoT 선언과 일치
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §7` (Config echo 정책 블록)
- 충돌 대상: `spec/4-nodes/3-ai/0-common.md §11.7`
- 상세: `1-ai-agent.md §7` 에서 두 필드의 default 일치 시 echo 생략 정책을 기술하고, `0-common.md §11.7` 을 SoT로 교차 참조하고 있다. 현재 일치.
- 제안: 현행 유지.

---

### [INFO] `1-ai-agent.md §7.4` `_resumeState` 생명주기 표 — `spec/conventions/node-output.md Principle 4.2 / 4.2.1` 와의 교차 참조
- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §7.4` (`_resumeState` / `_resumeCheckpoint` / `_retryState` 생명주기 비교표)
- 충돌 대상: `spec/conventions/node-output.md` Principle 4.2 / 4.2.1
- 상세: 비교표의 내용이 node-output CONVENTIONS Principle 4.2.1 을 SoT로 명시하며 세 필드의 책임 분리가 명확히 기술되어 있다. 현재 일치.
- 제안: 현행 유지.

---

### [INFO] `spec/1-data-model.md §2.23 AgentMemory` — `spec/5-system/17-agent-memory.md §1` 데이터 모델 컬럼 목록 중복 기술
- target 위치: 참조 대상 — `spec/4-nodes/3-ai/0-common.md §10`, `spec/4-nodes/3-ai/1-ai-agent.md §1` (Agent Memory 참조)
- 충돌 대상: `spec/1-data-model.md §2.23`, `spec/5-system/17-agent-memory.md §1`
- 상세: `1-data-model.md §2.23` 과 `17-agent-memory.md §1` 이 `agent_memory` 테이블 컬럼을 각각 기술한다. `17-agent-memory.md §1` 은 "SoT 는 데이터 모델 §2.23" 이라고 명시하지 않고 "데이터 모델 §2.23 단일 진실" 을 링크하며 같은 컬럼 표를 다시 열거한다. target 문서(`0-common.md`, `1-ai-agent.md`)는 두 SoT 중 `17-agent-memory.md` 를 단일 진실로 교차 참조하고 있다. 실제 컬럼 목록은 두 곳이 일치하나 이중 기술 구조.
- 제안: `17-agent-memory.md §1` 에서 컬럼 표 반복 기술 대신 "컬럼 상세는 `1-data-model.md §2.23` 참조" 로 단일화하거나, 두 문서 모두 현재 일치를 유지하는 경우 향후 컬럼 변경 시 두 곳을 동시에 갱신해야 함을 명시적 주석으로 남기는 것을 권장.

---

## 요약

`spec/4-nodes/3-ai/` (0-common.md, 1-ai-agent.md) 의 신규 내용 — §10 Conversation Context 자동 주입 (`contextScope` / `memoryStrategy`), §11 System Context Prefix, Agent Memory (`memoryStrategy: 'persistent'`) — 은 `spec/conventions/conversation-thread.md`, `spec/conventions/node-output.md`, `spec/5-system/17-agent-memory.md`, `spec/1-data-model.md §2.23` 과 직접 모순되는 정의 충돌이 없다. 각 cross-ref 가 명시적 SoT 선언과 함께 교차 참조되어 있고 실제 내용도 일치한다. 다만 `agent_memory` 테이블 컬럼 이중 기술(`1-data-model.md §2.23` vs `17-agent-memory.md §1`)과 push/inject 로드맵 기술이 `0-common.md §10` 와 `conversation-thread.md §2.3·§7` 양쪽에 산재되어 향후 drift 잠재성이 존재한다. 이는 모두 INFO 수준이며 즉각 차단이 필요한 CRITICAL/WARNING 발견사항은 없다.

## 위험도

LOW
