# Cross-Spec 일관성 검토 결과

## 발견사항

### INFO-1: `spec/5-system/7-llm-client.md §3.3` — LLMClient 인터페이스 vs LlmService 서비스 레이어 시그니처 혼동
- **target 위치**: plan draft "제안 변경 > spec/5-system/7-llm-client.md §3.3" 도입부 NOTE
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/embedding-model-ux-c40698/spec/5-system/7-llm-client.md` §3.1 (`LLMClient` 인터페이스 embed) vs §8.3 (`LlmService` 서비스 레이어)
- **상세**: target draft 는 SPEC-DRIFT 발견사항이 원래 "§3.3" 을 지목했지만, NOTE 에서 "LlmService.embed 의 opts 파라미터는 §8.3 service layer 기술에 추가한다"고 스스로 교정한다. 이 교정은 정확하다. §3.3 은 `LLMClient` 인터페이스(provider 구현체가 준수하는 저수준 시그니처)이고, §8.3 은 `LlmService`(서비스 레이어, config + opts 포함)다. target 이 `§8.3` 에만 변경을 적용하는 것은 올바른 범위 판단이며, 두 섹션이 다른 계층을 기술하는 것은 의도된 설계다. 충돌 없음.
- **제안**: 해당 NOTE 를 그대로 유지. §3.1 `LLMClient.embed` 인터페이스는 변경 대상이 아님을 명시.

---

### WARNING-1: `spec/5-system/8-embedding-pipeline.md §5.4` — SoT 링크가 §3.3(LLMClient 인터페이스)을 가리키지만 실제 SoT 는 §8.3(LlmService)이어야 함
- **target 위치**: plan draft "제안 변경 > spec/5-system/8-embedding-pipeline.md §5.4" After 텍스트
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/embedding-model-ux-c40698/spec/5-system/8-embedding-pipeline.md` §5.4 현재 본문 — "시그니처 정의는 `7-llm-client.md §3.3`"
- **상세**: `8-embedding-pipeline.md §5.4` 는 현재 "시그니처 정의는 `7-llm-client.md §3.3`"이라고 시그니처 SoT 를 §3.3 으로 명시한다. target draft 가 §5.4 의 시그니처 인라인 표기를 `(texts, model, opts, inputType)` → `(config, texts, model?, opts?, inputType)` 로 교정할 때, SoT 가 §3.3 을 가리키는 주석이 그대로 남으면 독자가 §3.3(`LLMClient.embed — config 인자 없음`)을 조회하고 혼동한다. 실제 SoT 는 §8.3(`LlmService` 서비스 레이어, `config` 첫 인자 포함)이어야 한다.
- **제안**: target draft 의 "After" 텍스트에 "시그니처 정의는 `7-llm-client.md §3.3`" → "시그니처 정의는 `7-llm-client.md §8.3`" 링크 교정을 함께 포함해야 한다.

---

### WARNING-2: `spec/5-system/17-agent-memory.md` — `LlmService.embed(...)` 생략 표기가 `config` 인자를 암묵적으로 제외할 위험
- **target 위치**: plan draft "제안 변경 > spec/5-system/8-embedding-pipeline.md §5.4" (간접 연관)
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/embedding-model-ux-c40698/spec/5-system/17-agent-memory.md` 87번째 줄 — `LlmService.embed(..., inputType:'query')` 생략 표기
- **상세**: `17-agent-memory.md §87` 은 `LlmService.embed(..., inputType:'query')` 와 같이 `...` 로 앞 인자들을 생략한다. target draft 적용 후 실제 시그니처가 `(config, texts, model?, opts?, inputType)` 임이 spec 에 명문화되면, `...` 로 `config` 를 포함한 모든 앞 인자를 묵시적으로 처리하므로 기술적 모순은 없다. 그러나 `config` 가 첫 번째 필수 인자임에도 `...` 가 이를 가려 호출자가 `config` 없이 `embed(texts, 'query')` 형태로 잘못 이해할 위험이 있다.
- **제안**: `17-agent-memory.md §87` 의 생략 표기를 전체 시그니처 또는 최소한 `LlmService.embed(config, texts, ..., inputType:'query')` 형태로 갱신하거나, "완전한 시그니처는 §8.3 참조" 주석을 추가한다. target draft 범위에 포함하거나 후속 정비로 남길 수 있다.

---

### INFO-2: `spec/5-system/7-llm-client.md §3.3` — 제목이 계층 구분 없이 범용으로 읽힘
- **target 위치**: 기존 spec `/Volumes/project/private/clemvion/.claude/worktrees/embedding-model-ux-c40698/spec/5-system/7-llm-client.md` §3.3 제목 "embed 시그니처"
- **충돌 대상**: target draft 가 §8.3 에 `LlmService.embed` 전체 시그니처를 추가한 후 문서 내에 embed 시그니처가 §3.3(`LLMClient`, config 없음)과 §8.3(`LlmService`, config 포함) 두 곳에 존재하게 됨
- **상세**: §3.3 제목이 "embed 시그니처"로만 되어 있으면 이것이 인터페이스 계층인지 서비스 계층인지 구분이 안 된다. target draft 적용 후 독자가 §3.3 과 §8.3 을 조회할 때 혼동 가능성이 증가한다.
- **제안**: §3.3 제목을 "embed 시그니처 (LLMClient 인터페이스)" 또는 도입부에 "이하는 LLMClient 인터페이스 계층의 시그니처. LlmService 서비스 레이어(config·opts 포함)는 §8.3 참조" 문구 추가. 충돌 차단에 필수는 아니지만 독자 경험 개선 차원에서 권장.

---

## 요약

target draft(`plan/in-progress/spec-update-llm-embed-signature.md`)가 제안하는 두 가지 변경 — `spec/5-system/7-llm-client.md §8.3` 에 `LlmService.embed` 전체 시그니처 추가, `spec/5-system/8-embedding-pipeline.md §5.4` 의 인자 표기 교정 — 은 기존 spec 의 다른 영역과 직접 모순되지 않는다. 실제 코드(`llm.service.ts:203`)의 `embed(config, texts, model?, opts?, inputType)` 시그니처와 정확히 일치한다. 단 두 가지 WARNING 이 있다: (1) `8-embedding-pipeline.md §5.4` 의 "시그니처 정의는 §3.3" SoT 링크를 §8.3 으로 함께 교정하지 않으면 독자가 `config` 없는 인터페이스 계층 시그니처를 서비스 레이어 SoT 로 오인할 수 있다(WARNING-1); (2) `17-agent-memory.md §87` 의 `LlmService.embed(...)` 생략 표기가 필수 `config` 인자를 가려 오용 위험이 있다(WARNING-2). CRITICAL/BLOCKING 이슈는 없다.

## 위험도

LOW
