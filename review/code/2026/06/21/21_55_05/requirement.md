# 요구사항(Requirement) 리뷰 — ai-review 2026/06/21 21_55_05

> 대상 커밋: 960968b4 — M-1 2단계 fresh review WARNING 해소 (AiMemoryManager 테스트 커버리지 보강)
> 리뷰어: requirement-reviewer

---

## 발견사항

### [INFO] 테스트 #1: memoryKey 미설정 → resolveScopeKey 변환값 전달 검증
- **위치**: `ai-memory-manager.spec.ts` lines 61–78 (신규), 전체 컨텍스트 lines 467–484
- **상세**: `agentMemFake()` 의 `resolveScopeKey` mock 은 `(key, execId) => key ?? \`exec:\${execId}\`` 로 정의돼, `memoryKey` 가 `undefined` 이면 `'exec:exec-1'` 을 반환한다. 테스트는 `expect(am.resolveScopeKey).toHaveBeenCalledWith(undefined, 'exec-1')` 와 `expect(am.recall.mock.calls[0][1]).toBe('exec:exec-1')` 를 동시에 검증해, 입력 원시값이 아닌 변환된 scopeKey 가 `recall` 에 흘러야 한다는 불변식을 직접 고정한다. 구현(`ai-memory-manager.ts` lines 162–169)과 정확히 일치한다.
- **spec fidelity**: spec `§1` `memoryKey` 필드 정의("미설정 시 `execution_id` 로 fallback") 및 `spec/5-system/17-agent-memory.md §2` ("AGM-03 — `memoryKey ?? execution_id`")와 일치. 테스트가 그 규칙을 구체적으로 검증한다.
- **판정**: 기능 완전성 충족. 이전 WARNING 해소 확인.

### [INFO] 테스트 #2: contextInjectionMode=system_text 분기 검증
- **위치**: `ai-memory-manager.spec.ts` lines 80–111 (신규), 전체 컨텍스트 lines 486–517
- **상세**: `config: { contextInjectionMode: 'system_text' }` 와 `tailMode: 'prepend'` 를 조합해 꼬리를 별도 메시지로 splice 하지 않고 system 메시지에 접는 경로를 커버한다. 테스트는 `res.messages` 길이가 2 로 유지되고(`toHaveLength(2)`), 마지막 메시지가 `{role:'user', content:'now'}` 임을 검증한다. 구현(`ai-memory-manager.ts` lines 321–335)의 `mode === 'system_text'` 분기와 일치한다.
- **spec fidelity**: spec `§1` `contextInjectionMode` 필드 정의("messages / system_text") + `§6.1 1.5` ("최근 원문 turn 만 휘발성 꼬리로 둔다 — messages 모드면 prepend, system_text 모드면 systemPrompt 뒤")와 동작이 일치한다. 단 `tailMode` 파라미터 자체와 `keepUserExchanges` 도출 메커니즘은 spec 본문(`§6.2 d.5`)에 명시되지 않은 구현 정교화로, 이전 review 에서 이미 `[SPEC-DRIFT]` 로 분류돼 planner 위임 중이다 — 해당 drift 는 본 테스트의 새로운 결함이 아니라 기존 추적 항목이다.
- **판정**: 기능 완전성 충족. 이전 WARNING 해소 확인.

### [INFO] 테스트 #3: summaryModelConfigId → resolveConfig 호출 검증
- **위치**: `ai-memory-manager.spec.ts` lines 113–130 (신규), 전체 컨텍스트 lines 519–536
- **상세**: 전용 `llm` mock 에 `resolveConfig: jest.fn().mockResolvedValue({ defaultModel: 'sum-model' })` 를 주입하고, `summaryModelConfigId: 'sum-cfg'` 설정 후 `resolveConfig` 가 `('sum-cfg', 'ws-1')` 로 1회 호출됨을 검증한다. 구현(`ai-memory-manager.ts` lines 220–225)의 `if (args.summaryModelConfigId) { summaryLlmConfig = await this.llmService.resolveConfig(args.summaryModelConfigId, args.workspaceId); }` 와 정확히 일치한다.
- **spec fidelity**: spec `§1` `summaryModelConfigId` 필드 정의("set 시 그 config 자신의 provider/credential/defaultModel 로 직접 호출") + `§6.1 1.5` ("요약 LLM 콜은 `summaryModelConfigId` 가 가리키는 ModelConfig … set 시 그 config 자신의 provider/credential/defaultModel 로 직접 호출, §12.12")와 일치한다. `resolveConfig(configId, workspaceId)` 시그니처도 구현과 동일하다.
- **판정**: 기능 완전성 충족. 이전 WARNING 해소 확인.

### [INFO] SPEC-DRIFT — tailMode/keepUserExchanges/queryText 폴백 미명시 (기존 잔존)
- **위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §6.2 d.5, §6.1 단계 1.3
- **상세**: `injectMemoryContext` 의 `tailMode: 'prepend' | 'system-only'` 파라미터, `keepUserExchanges` 도출 메커니즘, `queryText` 공백 시 `finalSystemPrompt` 폴백 동작이 spec 본문에 미명시. 구현은 합리적이고 의도적이며 되돌리는 것이 오답. 이미 직전 review 세션(21_43_55 SUMMARY.md SPEC-DRIFT #1·#2) 에서 분류돼 planner 위임 중인 항목 — 본 커밋이 이를 추가로 악화시키지 않는다.
- **제안**: 코드 유지 + planner 위임 (기존 RESOLUTION.md 에 동일하게 명시돼 있음). 갱신 대상: `spec/4-nodes/3-ai/1-ai-agent.md` §6.2 d.5 (`tailMode` 분기 + `keepUserExchanges` 메커니즘), §6.1 단계 1.3 또는 §12 Rationale (queryText 공백 폴백 정책).

### [INFO] spec frontmatter code: 미등재 (기존 잔존, planner 도메인)
- **위치**: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 목록
- **상세**: `ai-memory-manager.ts`, `ai-condition-evaluator.ts` 가 frontmatter `code:` 에 미등재. 이미 #665(M-1 1단계)와 동일하게 비차단 SPEC-DRIFT 로 추적 중. 본 커밋은 test-only 변경이라 production 무변경, frontmatter 갱신 필요성은 M-1 전체 완료 후 planner 일괄 처리 예정.
- **제안**: developer 해소 불가(spec 쓰기 권한 없음) — planner 위임 유지.

---

## 요약

이번 변경(커밋 960968b4)은 test-only 커밋으로, 직전 review(21_43_55)에서 제기된 WARNING #1·#2·#3 (recall scopeKey 변환 검증 미흡, `system_text` 분기 미커버, `summaryModelConfigId` resolveConfig 경로 미커버) 세 건을 신규 테스트 케이스로 정확히 해소한다. 각 테스트는 `agentMemFake` mock 의 동작 정의와 production 구현(`ai-memory-manager.ts`)의 실제 콜 패턴이 일치하며, spec `§1` 필드 정의 및 `§6.1` 실행 단계 명세와도 line-level 로 일치한다. 비즈니스 규칙(memoryKey 미설정 시 execution_id fallback → `exec:<id>` 형식; AGM-03)과 분기 동작(contextInjectionMode=system_text → messages 길이 불변; summaryModelConfigId → resolveConfig 경유)이 테스트에 정확히 반영됐다. 잔존 WARNING #4(spec frontmatter)와 SPEC-DRIFT 2건은 developer 영역 밖의 planner 위임 사항이며 본 커밋에서 추가 악화는 없다. production 로직 무변경이므로 요구사항 충족 관점에서 신규 결함 없음.

---

## 위험도

NONE
