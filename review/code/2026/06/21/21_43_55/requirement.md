# 요구사항(Requirement) 리뷰 — M-1 2단계 AiMemoryManager 단위 테스트 + 주석

## 발견사항

### 기능 완전성

- **[INFO]** 14개 테스트 케이스가 RESOLUTION.md 에 열거된 WARNING #3 해소 항목을 빠짐없이 커버한다: `resolveMemoryStrategy` 3종 값 + 미지 폴백 + 키 부재, `scheduleMemoryExtraction` gating(manual/summary_buffer)/graceful no-op/enqueue 수락 watermark 전진/dedup drop 시 watermark 유지(AGM-08), `injectMemoryContext` graceful/recall degrade/recall 인자/queryText 폴백/tailMode=system-only/no-system insertAt 0. 커밋 메시지의 "14 케이스" 와 테스트 파일 내 실제 it() 수가 일치한다.

- **[INFO]** production 로직 변경 없음 — `ai-memory-manager.ts` 의 변경은 `// ── [keepUserExchanges 도출] ──` 섹션 주석 4줄 추가뿐이며 동작 코드는 무변경이다.

### 엣지 케이스

- **[INFO]** `resolveMemoryStrategy` 폴백 경로: 미지 문자열(`'auto'`) + 키 부재(`{}`) + undefined 값 모두 `'manual'` 반환을 테스트로 확인. 경계값 완비.

- **[INFO]** `scheduleMemoryExtraction` 에서 `lastExtractionTurnSeq = undefined` (single-turn/첫 추출) 케이스를 테스트하며, 공유 헬퍼(`agent-memory-injection.ts:628`)의 `prevWatermark === undefined → fullThread.turns 전체` 분기를 간접 커버한다.

- **[WARNING]** `injectMemoryContext` 에서 `queryText = ''` (빈 문자열, `trim() = ''`) 폴백 케이스는 테스트하지만, `queryText = null` / `queryText = undefined` 인 경우는 커버하지 않는다.
  - 위치: `ai-memory-manager.ts:179` — `args.queryText?.trim()` 는 `null`/`undefined` 에도 옵셔널 체이닝으로 안전하나, 테스트 픽스처(`baseInject`)에서 `queryText` 는 항상 string 으로 제공된다. `InjectArgs` 타입 상 `queryText: string` 이므로 런타임에서 null/undefined 가 유입될 가능성이 낮다. 그러나 테스트 완성도 관점에서 공백 외 케이스 커버가 없다.
  - 제안: `queryText: ''` 케이스 추가 (현재 `'   '`(공백 전용)만 있음). 또는 타입이 string-only 임을 주석으로 명시해 의도를 명문화. 비차단.

### TODO/FIXME

- **[INFO]** 테스트 파일 및 변경된 `ai-memory-manager.ts` 에 TODO/FIXME/HACK/XXX 주석 없음.

### 의도와 구현 간 괴리

- **[INFO]** 주석 변경 (`keepUserExchanges 도출` 섹션)은 기존 코드의 의도를 명문화하는 것으로, 실제 구현과 완전히 일치한다. `getThreadExcludingNode`(요약·꼬리) vs `getThread`(물리 압축 경계) 두 호출의 목적 차이가 명확히 설명된다.

- **[INFO]** `threadFake` 의 첫 번째 인자가 `getThreadExcludingNode` 에, 두 번째가 `getThread` 에 대응하는 구조가 직관적이지 않을 수 있으나, 파라미터명과 mock 배선이 일치하고 JSDoc 은 없지만 사용 맥락에서 명확하다.

### 에러 시나리오

- **[INFO]** `recall` throw 시 graceful degrade (`recalledCount = 0`, throw 없음) 테스트 완비.
- **[INFO]** `agentMemoryService` / `conversationThreadService` 미주입 시 graceful no-op 테스트 완비.
- **[INFO]** enqueue dedup drop(`scheduleExtraction → false`) 시 watermark 불전진 테스트 완비 (AGM-08).

### 데이터 유효성

- **[INFO]** 테스트는 입력 픽스처를 `baseInject`/`baseSched` factory 로 단일화해 파라미터 조합 오류를 방지한다. Partial override 패턴으로 필요한 필드만 재정의한다.

- **[WARNING]** `recall` 호출 인자 검증 테스트(line 242-248)에서 두 번째 인자로 `'k1'`(원시 memoryKey)을 직접 기대하는데, 실제 코드 경로는 `resolveScopeKey('k1', 'exec-1')` 의 반환값을 사용한다.
  - 위치: `ai-memory-manager.spec.ts:242-248`
  - 상세: `agentMemFake` 의 `resolveScopeKey` mock은 `key ?? 'exec:${execId}'` 를 반환하므로 `key = 'k1'` 일 때 `'k1'` 을 반환한다(line 36-38). 따라서 `recall` 의 두 번째 인자로 `'k1'` 을 기대하는 것이 맞다. 단, 이 테스트가 암묵적으로 "resolveScopeKey 의 반환값 = memoryKey" 를 가정하고 있어, `resolveScopeKey` 가 다른 값을 반환하는 경우(예: prefix 추가 등)를 감지하지 못한다.
  - 제안: `expect(am.recall).toHaveBeenCalledWith('ws-1', expect.stringContaining('k1'), ...)` 보다는 현행처럼 `resolveScopeKey` 반환값을 캡처해 검증하거나, `resolveScopeKey` 호출 확인 + `recall` 의 두 번째 인자가 그 반환값인지 분리 검증하는 것이 더 robust하다. 현재 mock 구현상 동작은 정확하며 비차단.

### 비즈니스 로직

- **[INFO]** AGM-08 증분 추출 watermark 정책: spec(`5-system/17-agent-memory.md:80` 및 `§Rationale 증분 추출 watermark`)은 "enqueue 가 실제 수락된 경우에만 watermark 전진, dedup-drop 시 watermark 유지" 를 요구한다. 테스트(line 219-235)가 이 정책을 정확히 검증한다.

- **[INFO]** `tailMode = 'system-only'` 에서 꼬리 재prepend 금지(spec §6.2 d.5 "컨텍스트 메모리 재주입 — 매 turn"): 테스트(line 272-300)가 `messages` 길이가 3으로 유지되고 기존 user/assistant 메시지가 보존됨을 검증한다.

- **[INFO]** `summary_buffer` 전략이 `scheduleMemoryExtraction` 에서 enqueue 하지 않음(spec §6.1 2.7 "summary_buffer 는 세션 간 추출이 없으므로 본 단계 미적용") 을 테스트가 정확히 커버한다.

- **[INFO]** `resolveMemoryStrategy` 에서 미지 전략 → `'manual'` 폴백(spec `§1 memoryStrategy` 필드: 허용값 `manual`/`summary_buffer`/`persistent` 외 미지정 → 하위호환) 은 spec 이 명시적 폴백 동작을 정의하지는 않으나 코드 주석("Unknown / missing → manual")과 테스트가 일치한다.

### 반환값

- **[INFO]** `injectMemoryContext` 반환 shape(`messages`, `finalSystemPrompt`, `memory`, `keepUserExchanges`)를 graceful 케이스 테스트(line 183-198)에서 모두 검증한다. `memory.tokenBudgetUsed` 는 `expect.any(Number)` 로 타입만 확인하며 값 범위는 미검증이나, 이는 내부 토큰 추정 헬퍼 단위에서 다룰 영역이다.

- **[INFO]** `scheduleMemoryExtraction` 이 `Promise<number | undefined>` 를 반환하는 모든 분기(manual 반환 watermark, summary_buffer undefined, persistent 없음 no-op, persistent enqueue 수락 maxSeq, persistent dedup drop 유지)를 테스트가 커버한다.

### 관련 spec 본문 일치 여부 (spec fidelity)

관련 spec: `spec/4-nodes/3-ai/1-ai-agent.md` (§1 config 표, §6.1, §6.2 d.5/d.6, §7, §12.9-12.14), `spec/5-system/17-agent-memory.md` (§3 AGM-08, §4 AGM-04/AGM-09).

- **[INFO]** `scheduleMemoryExtraction` dedup-drop → watermark 불전진: spec `17-agent-memory.md:84` 의 "dedup-drop 시 `scheduleExtraction` 은 `false` 를 반환해 watermark를 전진시키지 않는다 — drop 된 turn 들은 다음 턴 경계 추출로 이월돼 유실되지 않는다 (enqueue-acceptance 반환 계약, M1)" 과 테스트가 정확히 일치한다.

- **[INFO] [SPEC-DRIFT]** `tailMode` / `system-only` / `keepUserExchanges` 파라미터가 `injectMemoryContext` 시그니처에 포함되어 있으나, `spec/4-nodes/3-ai/1-ai-agent.md` §6.2 d.5 본문에서는 이 파라미터들의 명칭(`tailMode`, `keepUserExchanges`, `insertAt`)을 명시하지 않는다. 구현이 합리적이고 d.5 동작의 내부 메커니즘을 구체화한 것이며, 되돌리는 것이 오답이다.
  - 갱신 대상: `spec/4-nodes/3-ai/1-ai-agent.md` §6.2 d.5 — `tailMode: 'system-only'` / `'prepend'` 분기와 `keepUserExchanges` 도출 메커니즘을 구현 참조로 기술. (코드 유지 + spec 반영 대상)

- **[INFO] [SPEC-DRIFT]** `injectMemoryContext` 의 `queryText` 빈 값 → `finalSystemPrompt` 폴백 동작이 spec 에 명시되어 있지 않다. `ai-memory-manager.ts:175-181` 주석(M2 라벨)에 근거가 설명되어 있으며 코드가 합리적이다.
  - 갱신 대상: `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 단계 1.3 또는 §12 Rationale — queryText 공백 시 finalSystemPrompt 폴백 정책 명시. (코드 유지 + spec 반영 대상)

- **[INFO]** spec `1-ai-agent.md:523` 의 `meta.memory` shape(`{ strategy, summarized, recalledCount, tokenBudgetUsed, compactedMessages? }`)와 `memoryMeta` 객체(`ai-memory-manager.ts:299-304`)가 일치한다. `compactedMessages?` 는 핸들러 레이어에서 부착하는 필드로 본 매니저 반환에 없는 것이 정상이다.

---

## 요약

이번 변경은 production 로직 무변경(주석 4줄 추가 + 신규 테스트 파일 신설)이며, 기능 결함·보안 취약점은 없다. 14개 단위 테스트가 RESOLUTION.md 에 열거된 WARNING #3 해소 항목을 빠짐없이 커버하고, 각 테스트의 mock 배선과 기대값이 `ai-memory-manager.ts` 실제 구현 경로 및 spec 요구사항(AGM-08 watermark, §6.2 d.5 tailMode, §6.1 1.3 recall, §6.1 2.7 enqueue)과 일치한다. 발견된 WARNING 2건은 모두 테스트 커버리지 미세 개선 관련이며 비차단 수준이다. SPEC-DRIFT 2건은 코드 구현이 spec 보다 구체적인 정보를 담고 있어 spec 갱신이 필요한 항목으로, 코드 변경이 아닌 planner 위임 대상이다.

## 위험도

LOW
