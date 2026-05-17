# Rationale 연속성 검토 결과

검토 범위: `spec/4-nodes/3-ai/` (0-common.md · 1-ai-agent.md · 2-text-classifier.md · 3-information-extractor.md)
검토 모드: 구현 착수 전 (--impl-prep)

---

### 발견사항

- **[INFO]** `1-ai-agent.md §7.4` waiting 첫 진입 시 `turnCount: 0` vs `output.result.turnCount` 기술 일관성
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §7.4` 출력 구조 예시 및 §6.2 1단계 b
  - 과거 결정 출처: `1-ai-agent.md §12.1` Rationale (Conversation Thread 도입 결정) + §6.2 본문 "즉시 `status: 'waiting_for_input'` 으로 진입 — 첫 턴 LLM 호출은 사용자 메시지 수신 후로 미룬다" + §7.4 필드 설명표 `output.result.turnCount: 첫 진입 시 0`
  - 상세: §7.4 예시 JSON 에서 `output.result.message: ""`, `output.result.turnCount: 1`로 기재되어 있으나, 필드 설명표에는 `첫 진입 시 0`으로 명시되어 있다. 첫 진입 시 LLM 호출이 없으므로 예시의 `turnCount: 1`은 필드 설명표와 불일치한다. 또한 `meta.turnDebug`에 `"turnIndex": 1`이 있는데 첫 진입에서 LLM 호출이 없으면 빈 배열이어야 하는지도 모호하다.
  - 제안: §7.4 예시 JSON의 `output.result.turnCount`를 `0`으로 수정하고, `output.result.message`가 `""`인 경우의 `meta.turnDebug`가 빈 배열인지 1항목인지를 §6.2 기술과 정합하게 명시한다.

- **[INFO]** `1-ai-agent.md §5.2 조건 도구 호출 감지` — 분류 로직과 §6.1 3단계 분류 기술의 경미한 불일치
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §5.2` 1항 "조건의 `id` 목록과 대조" vs §6.1 3단계 a "provider 의 `matches()` 가 우선 판정"
  - 과거 결정 출처: `1-ai-agent.md §6.1` 의 실행 로직 (provider matches() 우선) 및 §5.2 의 조건 감지 기술
  - 상세: §5.2 는 "조건의 `id` 목록과 대조"로 분류한다고 하고, §6.1 3단계 a 에서는 "provider 의 `matches()` 가 우선 판정, 어디에도 매칭 안 되면 일반 도구로 분류"라고 한다. 두 기술이 분류 방식에서 미세한 표현 차이가 있어 구현 시 어느 쪽을 따라야 하는지 모호할 수 있다.
  - 제안: §5.2 에 "상세 분류 우선순위는 §6.1 3단계 참조" 교차 참조를 추가하거나, §6.1 이 단일 진실임을 명시한다.

- **[INFO]** `3-information-extractor.md §5.1` config echo 의 `outputSchema` vs `schema` 키 불일치
  - target 위치: `spec/4-nodes/3-ai/3-information-extractor.md §5.1` 예시 JSON의 `config.schema` + 필드 설명표 `config.schema (= raw outputSchema)`
  - 과거 결정 출처: `3-information-extractor.md §1` 설정 표의 필드명 `outputSchema`, CONVENTIONS Principle 7 config echo (raw 값 보존)
  - 상세: §1 설정 표에서 필드명은 `outputSchema`이나, §5.1 config echo 예시 JSON 과 설명표에서는 `config.schema`로 표기한다. Principle 7의 "사용자가 입력한 raw 값을 echo"라면 키 이름도 `outputSchema`를 그대로 써야 한다. 한편 §5의 헤더 노트에서 `config.schema (= raw outputSchema)`라고 설명하므로 의도적인 리맵임을 암시하지만, 이 리맵이 Rationale 없이 도입되어 있다.
  - 제안: 두 가지 중 하나를 선택한다. (a) config echo 키를 `outputSchema`로 통일하거나, (b) `schema`로의 리맵이 의도적이라면 §5 의 노트나 Rationale에 "config echo 시 `outputSchema` → `schema` 로 노출"임을 명시한다.

- **[INFO]** `1-ai-agent.md §4 Tool Area 연동` — 기각·제거 상태 섹션이 본문에 남아 있으나 Rationale 부재
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §4 Tool Area 연동` (전체 섹션이 "재작성 예정 (현재 제거됨)" 경고로 시작)
  - 과거 결정 출처: `1-ai-agent.md §1` 의 `toolNodeIds`/`toolOverrides` 필드 제거 경고 노트 (`plan/complete/ai-agent-tool-connection-rewrite.md` 사유 참조)
  - 상세: §4 전체가 비활성 상태이고 경고 배너도 있으나, "왜 제거되었고 어떤 새 설계가 들어올 것인지"의 Rationale이 spec 본문의 `## Rationale` 섹션에 없다. `plan/complete/ai-agent-tool-connection-rewrite.md`로 위임되어 있어 spec 자체에서 결정의 배경을 찾기 어렵다.
  - 제안: `## Rationale` 섹션에 "§4 Tool Area 연동 비활성화 사유" 항을 추가하여 `toolNodeIds`/`toolOverrides` 제거 결정과 복원 조건을 간략히 기록한다.

- **[INFO]** `0-common.md §4 Multi-turn 차단 모드` — `status: 'resumed'` emit 관련 CONVENTIONS §4.5 참조가 target 내 문서 기술과 완전 일치하는지 확인 필요
  - target 위치: `spec/4-nodes/3-ai/0-common.md §4` 마지막 bullet "Stage 2 의 공통 resume 컨트랙트에서 `status: 'resumed'` + `output.interaction.{type, data, receivedAt}` 스냅샷이 한 차례 emit 된다 (CONVENTIONS §4.5)"
  - 과거 결정 출처: `1-ai-agent.md §7.5` D6 결정 (2026-05-17) — `output.interaction.*` 페이로드는 의미 분리 유지. `3-information-extractor.md §4.2` 6단계 — `status: 'resumed'` + `output.interaction.{type, data, receivedAt}` 스냅샷 1회 emit
  - 상세: 0-common.md §4 의 기술은 두 노드 모두에 적용되는 공통 규약으로 선언됐다. 두 노드 spec 모두 이를 따르고 있어 충돌은 없다. 다만 `CONVENTIONS §4.5`의 참조 앵커가 실제 `spec/conventions/node-output.md` 의 섹션 번호와 일치하는지는 외부 파일 검토가 필요하다 (본 검토 범위 내 파일에서 직접 확인 불가).
  - 제안: 구현 착수 전 `spec/conventions/node-output.md §4.5` 앵커가 존재하고 정확한 내용을 담고 있는지 확인한다.

---

### 요약

`spec/4-nodes/3-ai/` 의 4개 문서는 전반적으로 Rationale 에서 확립된 결정들 — Conversation Thread 1급 객체화, `conversationHistory` 제거, D6 `output.result.*` 단일 경로 통일, `_resumeState` expression 비노출, `toolNodeIds`/`toolOverrides` 비활성화, DB Enum 비확장 원칙 — 을 올바르게 반영하고 있다. 명시적으로 기각된 대안이 재도입된 사례나 합의 원칙을 직접 위반하는 내용은 발견되지 않았다. 다만 세부 수준에서 (a) §7.4 첫 진입 `turnCount` 예시값과 필드 설명표의 불일치, (b) `3-information-extractor.md` 의 `outputSchema` vs `schema` 키 리맵에 대한 Rationale 부재, (c) `§4 Tool Area 연동` 비활성화 결정의 spec 본문 내 Rationale 누락 등 INFO 수준의 정합 보완 포인트가 4건 존재한다. 이 항목들은 구현 시 오해를 유발할 수 있는 수준이므로 착수 전 정리를 권장하나 구현 차단 사유는 아니다.

### 위험도

LOW
