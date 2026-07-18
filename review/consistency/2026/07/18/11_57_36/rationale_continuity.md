### 사전 확인 사항 (검토 방법론)

- `git diff origin/main --stat -- spec/4-nodes/3-ai/` 결과 **변경 없음** — 이번 브랜치는 `spec/4-nodes/3-ai/*.md` 를 건드리지 않았다 (변경분은 `spec/conventions/interaction-type-registry.md` 12줄 + `plan/**` + `review/**` 뿐, 별건 리뷰 대상). 따라서 본 검토는 diff 기반이 아니라 **target 영역(0-common.md·1-ai-agent.md·2-text-classifier.md·3-information-extractor.md) 현재 상태 전체에 대한 holistic 정합성 검토**로 수행했다.
- 전달받은 prompt payload 의 "관련 Rationale 발췌" 코퍼스는 spec 알파벳 순으로 수집되다 `spec/2-navigation/4-integration.md` 부근에서 크기 제한으로 잘려, 실제로 3-ai 가 참조하는 `spec/5-system/9-rag-search.md`·`10-graph-rag.md`·`11-mcp-client.md`·`17-agent-memory.md`·`spec/conventions/conversation-thread.md`·`node-output.md`·`spec/4-nodes/6-presentation/0-common.md` 등은 코퍼스에 **포함되지 않았다**. 이 갭은 target 결함이 아니라 페이로드 구성 이슈이므로, 해당 파일들은 워크트리에서 직접 절대경로로 다시 읽어 대조했다.

### 발견사항

- **[INFO]** 노드별 기본 타임아웃 표 행이 AI Agent 의 신규 LLM 콜 타임아웃 정책과 cross-reference 없이 병존
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` §12.16 (`AI_AGENT_LLM_CALL_TIMEOUT_MS`, 기본 600000ms=10분)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §8 표 "노드별 기본 타임아웃 | 30초 | Node.config" (근거·비고 없음, cross-link 없음)
  - 상세: execution-engine.md §8 표는 "노드별 기본 타임아웃" 을 30초 하나로 제시하지만, 실제로는 노드마다 서로 다른 기본값이 이미 존재한다 (Code 노드 30초, Background 노드 5분/300000ms, 이번 AI Agent LLM 콜 10분/600000ms). AI Agent §12.16 은 10분 기본값의 근거(단일 LLM turn 이 정상적으로 10분을 넘는 경우가 드묾, 주요 provider SDK 기본 request timeout 과 정합)를 상세히 서술하지만 execution-engine.md §8 표의 "30초" 항목을 인지·참조하지 않는다. 이것이 "기각된 대안의 재도입"이나 "invariant 위반"은 아니다 — Background 노드가 이미 300초로 30초 규칙에서 벗어난 선례가 있어 "노드별 기본 타임아웃 = 항상 30초"가 실제 강제되는 invariant는 아닌 것으로 보인다. 다만 execution-engine.md §8 표 자체가 stale(단일 예시값을 마치 시스템 전역 기본값처럼 제시)하여, 향후 독자가 이 표만 보고 "AI Agent 의 10분 기본값이 시스템 규약 위반"이라 오판할 여지가 있다.
  - 제안: execution-engine.md §8 표의 "노드별 기본 타임아웃" 행에 "노드 타입별로 상이 — Code §example, Background §example, AI Agent §example 참조" 식의 각주를 달거나, 표 자체를 "예시(Code 노드)"로 명확히 하는 정정을 project-planner 트랙으로 제안한다. AI Agent 문서 쪽 수정은 불필요.

### 요약

`spec/4-nodes/3-ai` 는 이번 브랜치에서 변경되지 않았으므로(diff 없음) target 현재 상태 전체를 대상으로 자체 정합성 + 교차 문서 정합성을 점검했다. 이 영역은 Rationale 연속성 관점에서 매우 높은 성숙도를 보인다 — `1-ai-agent.md` §12 는 §12.9(memoryStrategy 를 enum 확장이 아닌 별도 필드로), §12.10(conversation-thread v1/v2 경계 "번복"), §12.12(요약/추출 모델 옵션의 "번복 → 재번복" 3단계 이력)처럼 과거 결정의 번복을 **번복임을 명시하고 매번 새 근거를 첨부**하는 패턴을 일관되게 지키며, §12.6 은 기각된 대안(`rendered:false`, 중복 `status` 필드)까지 명문화해 본문에 재도입되지 않았음을 직접 확인했다(그렙 검증 완료). `conversation-thread.md` §8 도 "번복 아님" 태그와 drift 정리 기록을 갖춘 동일 수준의 규율을 보인다. `2-text-classifier.md`·`3-information-extractor.md` 의 Rationale 도 0-common.md 로 SoT 를 명확히 위임하며 자체 결정과 충돌하지 않는다. `agent-memory.md`·`mcp-client.md` 등 인접 시스템 문서의 Rationale(회수 임계 0.7 vs dedup 0.85, capabilities 캐시 won't-do 등)과도 대조했으나 target 이 이를 위반하는 지점은 발견하지 못했다. 유일하게 표시할 만한 사항은 execution-engine.md §8 의 "노드별 기본 타임아웃 30초" 표 행이 실제 노드별 상이한 기본값(Code/Background/AI Agent)과 cross-reference 없이 stale 하게 병존한다는 INFO 수준 관찰이며, 이는 target 자체의 결함이 아니라 인접 문서의 표 정합 보완 제안이다.

### 위험도
NONE
