# Cross-Spec 일관성 검토 — memory-strategy-extend-ie

- 검토 일시: 2026-06-05 16:50
- 검토 대상 diff: `git diff 21fa8194..HEAD`
- 변경 spec: `spec/4-nodes/3-ai/0-common.md §10`, `spec/4-nodes/3-ai/3-information-extractor.md §7`, `spec/5-system/17-agent-memory.md`, `spec/conventions/conversation-thread.md §2.3`

---

## 발견사항

### INFO: 0-common.md §10의 `memoryStrategy ∈ {summary_buffer, persistent}` 조건 표현이 IE에 적용되는 것처럼 읽힐 수 있음

- target 위치: `spec/4-nodes/3-ai/0-common.md §10` `memoryStrategy와의 관계` callout — `"memoryStrategy ∈ {summary_buffer, persistent} (관리 축) 이면 자동 전략이 컨텍스트 구성을 대체"`
- 충돌 대상: 동일 §10 `memoryStrategy` 테이블 행 — `information_extractor` 는 `manual`/`persistent` 2값만 갖고 `summary_buffer` 없음
- 상세: callout 본문은 `memoryStrategy ∈ {summary_buffer, persistent}` 라는 집합 표현을 공통 규약처럼 기술한다. 이 callout 이 §10 전체 공통 본문에 위치하므로, IE 에서도 `summary_buffer` 가 유효한 값처럼 읽히는 모호함이 있다. 테이블 행 자체는 노드별 값을 명확히 구분하나, 아래 callout은 ai_agent 관점만 반영한다.
- 제안: callout 본문을 `"ai_agent 의 memoryStrategy ∈ {summary_buffer, persistent} 또는 information_extractor 의 memoryStrategy = persistent 이면 자동 전략이 컨텍스트 구성을 대체"`로 정밀화하거나, 각 노드별 적용 callout 으로 분리하면 명확하다. 단, 기존 §6.1 참조와 같이 ai_agent 중심 서술임을 전제한 곳이 많아 동기화 범위가 넓어질 수 있으므로 우선순위는 낮다.

---

### INFO: IE spec §5.1·§5.6 출력 구조 테이블에 `meta.memory` 항목 없음 — ai_agent 와 echo 계약 비대칭

- target 위치: `spec/4-nodes/3-ai/3-information-extractor.md §5.1` (line 238–256), `§5.6` (line 622–639)
- 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md` — `meta.memory | object? | handler return | memoryStrategy ≠ 'manual' 시에만 echo. { strategy, summarized, recalledCount, ... }`
- 상세: ai_agent spec §5 출력 구조 테이블에는 `meta.memory` 행이 명시적으로 정의되어 있다. IE spec §5.1 / §5.6 출력 테이블에는 `meta.contextInjection` 은 정의됐으나, IE 가 `persistent` 일 때 회수 건수(`recalledCount`)를 `meta.memory` 로 에코하는지 여부가 spec 에 기술되지 않았다. 구현 코드(`information-extractor.handler.ts`)를 보면 `recalledCount` 를 반환하지만 `meta.memory` 객체로 래핑하지 않고 단독 변수로 관리하며 최종 `meta` 객체에 포함하지 않는다 — 즉 `meta.memory` echo 가 없다. 이것이 의도된 차이인지(IE는 summary_buffer 없어 strategy/summarized/tokenBudgetUsed 가 무의미하여 제외), 아니면 누락인지 spec에 명시되지 않았다.
- 제안: §5.1 / §5.6 `meta` 테이블에 `meta.memory` 행을 추가하고 IE 가 `persistent` 시 어떤 필드를 에코하는지(예: `{ strategy: 'persistent', recalledCount }`) 또는 명시적으로 "IE 는 `meta.memory` echo 없음 — `recalledCount` 는 내부 로깅에만 사용" 을 기술하여 소비자가 `$node["X"].meta.memory` 에 접근할 때 혼동을 방지한다. 구현과 spec 간 갭 해소.

---

### INFO: `17-agent-memory.md` Overview 절 — `persistent` 는 `summary_buffer` superset 정의가 IE 문맥에서 약간 혼동 가능

- target 위치: `spec/5-system/17-agent-memory.md` Overview 둘째 문단 — `"summary_buffer (단일 실행 내 토큰예산 롤링 요약) 가 working-memory 압축이라면, persistent 는 그 working-memory 동작을 포함(superset)하면서 세션 간 추출 메모리 레이어를 추가한다"`
- 충돌 대상: 새로 추가된 IE producer/consumer callout (`17-agent-memory.md §Overview` 신규 callout) — `"IE 는 summary_buffer(working-memory 압축)를 쓰지 않으므로 본 문서의 회수+추출 레이어만 적용"`
- 상세: Overview 기존 기술은 "persistent = summary_buffer 의 superset" 이다. IE 는 persistent 를 쓰되 summary_buffer 를 쓰지 않는다. 이는 모순이 아니라 AI Agent 관점의 정의이고, 신규 callout 에서 IE 적용 범위를 한정했으므로 공식적으로 충돌은 없다. 그러나 Overview 를 읽는 개발자 입장에서 "persistent 를 쓰면 summary_buffer 도 자동 포함"이라는 인상을 주어 IE 구현 시 불필요한 summary_buffer 코드 추가를 유발할 수 있다.
- 제안: Overview 둘째 문단에 `"(AI Agent 에서는 superset; information_extractor 는 회수+추출 레이어만 적용 — 아래 callout 참조)"` 를 괄호 주석으로 추가하면 명확하다. 현재도 callout 이 있어 크리티컬 수준은 아님.

---

## 검토 결과 요약

네 spec(`3-information-extractor.md §7`, `0-common.md §10`, `conversation-thread.md §2.3`, `17-agent-memory.md`)이 기술하는 IE persistent 메모리(recall+extraction), multi-turn 종결 thread push, text_classifier 제외 규칙은 상호 간 직접 모순이 없다. 데이터 모델(동일 `agent_memory` 테이블·scope key), API 계약(동일 `AgentMemoryService.recall` / `scheduleExtraction` 인터페이스), 상태 전이(multi-turn 종결 = completed/max_turns/user_ended push, error/waiting 은 push 안 함), RBAC(workspace_id 격리), 요구사항 ID(새 ID 없음, §AGM 계열 기존 ID 재사용) 모두 일관한다. 발견된 세 항목은 모두 INFO 등급으로, spec 표현의 ai_agent-중심 일반화 문장이 IE 적용 범위에서 미세한 모호성을 남기는 것이다. 구현과 spec 사이에서 `meta.memory` echo 정의 누락이 가장 실질적인 동기화 필요 사항이나, 이는 소비자 문서 갭이며 런타임 동작 충돌이 아니다.

---

## 위험도

LOW

---

BLOCK: NO
