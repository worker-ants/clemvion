# Cross-Spec 일관성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=8c5fdf257c7d4a49e5d715e5414ccf643cfdc9f6)

---

## 발견사항

### [WARNING] `meta.memory` shape 의 `tokenBudgetUsed` / `summarized` 가 `information_extractor` 에 무정의

- **target 위치**: `spec/conventions/node-output.md` §LLM 계열 행 — `meta.memory?` 설명에 `ai_agent / information_extractor` 양쪽 적용 명시, shape `{ strategy, summarized, recalledCount, tokenBudgetUsed, compactedMessages? }`
- **충돌 대상**: `spec/4-nodes/3-ai/3-information-extractor.md §7` (Persistent 메모리 recall + extraction)
- **상세**:
  - `ai_agent.md §7.1` 에서 `tokenBudgetUsed` 는 "working-memory 토큰 추정 사용량" — `memoryTokenBudget` config 에 의존하는 개념이다. `information_extractor` 는 `summary_buffer` (working-memory 압축)을 지원하지 않고 `memoryTokenBudget` config 도 없다 (IE spec §7 / §9.1 "summary_buffer X" 명시).
  - `summarized` 는 "롤링 요약 압축이 발생했는지 Boolean" — IE 에서는 항상 `false` 이지만 IE spec §7 이 이 값을 명시적으로 정의하지 않는다.
  - `compactedMessages?` 는 "d.6 멀티턴 누적 messages 물리 압축 제거 메시지 수" — `summary_buffer`/`persistent` ai_agent 한정 동작이며, IE 에서는 절대 발생하지 않는다 (`information_extractor` 는 `summary_buffer` 경로 없음). 항상 `undefined`/absent 이지만 IE spec §7 이 이를 명시하지 않는다.
  - IE spec §7 은 `meta.memory.recalledCount` 만 언급하며 나머지 필드의 IE-specific 의미(0 고정 vs absent)를 정의하지 않는다. `node-output.md` 의 단일 shape 선언으로는 구현자가 IE `persistent` 경로에서 `tokenBudgetUsed` / `summarized` 를 어떤 값으로 채워야 하는지 알 수 없다.
- **제안**: `spec/4-nodes/3-ai/3-information-extractor.md §7` 에 `meta.memory` 출력 형식 주석 추가: persistent 전략 시 `summarized: false`, `tokenBudgetUsed: 0`, `compactedMessages?` absent 로 고정됨을 명시. 또는 `node-output.md` LLM 계열 행에서 `ai_agent`/`information_extractor` 별 필드 의미 차이를 괄호 주석으로 구분.

---

### [INFO] `node-output.md` `meta.memory?` SoT 링크가 필드 정의 문서를 가리키지 않음

- **target 위치**: `spec/conventions/node-output.md` §LLM 계열 행 — `meta.memory?` 상세 링크 `[Spec Agent Memory](../5-system/17-agent-memory.md)`
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md §7.1` — `meta.memory` 필드별 의미(`strategy`, `summarized`, `recalledCount`, `tokenBudgetUsed`, `compactedMessages?`)의 실제 단일 SoT
- **상세**: `17-agent-memory.md` 는 저장소·스코프·추출·회수 동작의 SoT 이지만 `meta.memory` 출력 shape 의 필드별 의미는 정의하지 않는다. 필드 정의는 `ai-agent.md §7.1` 에 있다. 현재 링크가 소비자를 잘못된 문서로 안내할 가능성이 있다.
- **제안**: `node-output.md` 링크를 `ai-agent.md#71-single-turn-모드--정상-완료-out-포트` 로 교정하거나, `17-agent-memory.md` 에 `meta.memory` shape 테이블을 단일 SoT 로 이동하는 방식 중 하나를 선택해 동기화.

---

### [INFO] `spec/5-system/2-api-convention.md` 페이지네이션 주석 — `spec/conventions/swagger.md §2-5` 와 동치(중복 아님)

- **target 위치**: `spec/5-system/2-api-convention.md §5.2` — `data`·`pagination` top-level 형제 설명 주석 추가
- **충돌 대상**: `spec/conventions/swagger.md §2-5` (응답 wrapping, `PaginatedResponseDto` single-wrap 상세)
- **상세**: 두 문서의 내용이 일치한다(`PaginatedResponseDto`, `pass-through`, `data·pagination top-level`). 충돌 없음. `2-api-convention.md` 추가 주석은 `swagger.md §2-5` 를 참조 링크로 두어 중복을 최소화한 상태다. 동기화 불필요.

---

## 요약

이번 diff(spec/5-system/2-api-convention.md 페이지네이션 주석, node-output.md meta.memory 확장, 4-nodes AI 요구사항 ND-AG-30 갱신, Cafe24 미문서화 seed 9개 제거, channel-web-chat 6문서 status implemented 갱신)는 대부분 일관성을 유지한다. 주요 충돌 위험은 `node-output.md` 가 `information_extractor` 를 `meta.memory?` 대상 노드로 명시했으나, IE spec §7 이 `tokenBudgetUsed`·`summarized`·`compactedMessages?` 세 필드의 IE-specific 값(상시 0/false/absent)을 정의하지 않아 구현 시 모호성이 발생하는 WARNING 1건이다. Cafe24 endpoint 제거는 카탈로그·메타데이터·예시 코드가 일관되게 갱신됐고, 나머지 spec 에서 제거된 operation id 의 잔류 참조가 발견되지 않았다. channel-web-chat status 변경과 spec/0-overview.md 기재도 정합한다.

---

## 위험도

LOW
