# Rationale 연속성 검토

검토 모드: `--impl-done`, scope=`spec/4-nodes/3-ai`, diff-base=`origin/main`
검토 대상 구현: `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts` (M-1 2단계 AiMemoryManager 추출)

---

## 발견사항

### [INFO] AiMemoryManager 내 이중 thread 조회 — 기각된 대안 아니나 후속 TODO 정합
- target 위치: `ai-memory-manager.ts` lines 150–153 (`getThreadExcludingNode`) + lines 275–281 (`getThread`)
- 과거 결정 출처: `plan/in-progress/ai-context-memory-followup-v2.md` v2 코드 리뷰 도출 백로그 항목 "injectMemoryContext 의 getThread/getThreadExcludingNode 이중 쿼리 단일화(I/O-backed 전환 대비, W-8)"
- 상세: `injectMemoryContext` 가 `getThreadExcludingNode`(요약·꼬리용)와 `getThread`(물리 압축 경계 도출용)를 순차 두 번 호출한다. 현재 두 호출 모두 in-memory 반환이라 I/O 부하는 없지만, 향후 I/O-backed 전환 시 비용이 두 배가 된다. 구현 주석(line 263–287)이 "두 호출은 목적이 다르다"고 이유를 명시하고 있고, `ai-context-memory-followup-v2.md` 백로그에도 이미 등재되어 있어 **기각된 대안이 아닌 알려진 미결 후속 과제**다. 기존 Rationale 어디도 "이 두 조회를 하나로 합쳐야 한다"는 결정을 내리지 않았으므로 계속성 위반은 아니다.
- 제안: 현재 `ai-context-memory-followup-v2.md` 백로그에 이미 추적 중이므로 추가 대응 불필요. 본 PR 범위(behavior-preserving 추출) 내에서는 비차단.

### [INFO] `contextInjectionMode` 읽기 위치 — `manual` 전략 경로와의 경계 확인
- target 위치: `ai-memory-manager.ts` line 290 (`const mode = (args.config.contextInjectionMode as 'messages' | 'system_text') ?? 'messages'`)
- 과거 결정 출처: `spec/4-nodes/3-ai/0-common.md §10`, `spec/4-nodes/3-ai/1-ai-agent.md §1` — "`memoryStrategy ≠ manual` 시 contextScope 계열 5필드 무효 (자동 전략이 대체)"; 단 `contextInjectionMode` 는 자동 전략에서도 **최근 원문 turn 의 주입 형식**으로만 의미를 가진다는 §1 배열 비고.
- 상세: `injectMemoryContext` 는 오직 `summary_buffer` / `persistent` 전략에서만 호출된다(`manual` 은 핸들러가 이 메서드를 건너뜀). 따라서 본 메서드 안에서 `contextInjectionMode` 를 읽어 `'messages'` / `'system_text'` 분기를 내리는 것은 spec §1 의 "자동 전략에서 contextInjectionMode 는 최근 원문 turn 주입 형식으로만 의미"라는 문구와 정확히 부합한다. Rationale 위반 없음.
- 제안: 현행 유지 가능. 코드 주석(line 336 근방)에 "spec §1 비고: 자동 전략에서 contextInjectionMode 는 휘발성 꼬리 주입 형식 전용" 한 줄을 추가하면 이후 독자에게 spec 정합 의도가 더 명료해진다.

### [INFO] `summaryModelConfigId` 미처리 경로(extractionModelConfigId) — AiMemoryManager 범위 밖
- target 위치: `ai-memory-manager.ts` `scheduleMemoryExtraction` (lines 370–401) — `extractionModelConfigId` 를 직접 읽지 않고 `sharedScheduleMemoryExtraction` 에 `config` 전체를 위임
- 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md §12.12 재번복 결정` — `extractionModelConfigId` (config.id 저장, provider 디커플) 를 persistent 추출 LLM 콜에 사용.
- 상세: 추출 LLM 콜 내부에서 `extractionModelConfigId` 를 읽는 로직은 `shared/agent-memory-injection.ts` 의 `sharedScheduleMemoryExtraction` / processor 경로에 있다. `AiMemoryManager.scheduleMemoryExtraction` 은 단순 위임 래퍼이므로, Rationale §12.12 결정(재번복)이 processor 내부에서 구현되어 있는 한 continuity 위반은 없다. 현재 구조는 "producer(enqueue 까지 await) vs processor(실제 LLM 콜)" 분리라는 §6.1 2.7 의 hot-path 비차단 invariant 를 그대로 보존하고 있다.
- 제안: 현행 유지 가능. processor 경로가 `extractionModelConfigId` 를 올바르게 사용하는지는 별도 단위 테스트(`ai-memory-manager.spec.ts`)의 mock 검증 범위 내.

---

## 요약

본 검토 범위(`spec/4-nodes/3-ai` 문서군 + 구현 `ai-memory-manager.ts`)에서 과거 Rationale 에서 명시적으로 기각된 대안의 재도입이나 합의된 invariant 의 직접 위반은 발견되지 않았다. `AiMemoryManager` 추출은 `02-architecture §M-1` plan 이 `§12.9~12.14 Rationale 을 동작 보존 체크리스트`로 지정한 대로 진행되었으며, manual 전략 경로 완전 무변경(하위호환 핵심 불변식 §12.9), 요약 갱신 임계치 도달 시에만 수행(캐시 보호 §12.11), 안정 프리픽스 [5a]/[5b] → 휘발성 꼬리 [6] ordering(§11.4), persistent 회수 graceful degrade, 비동기 추출 hot-path 비차단(§6.1 2.7) 등 핵심 invariant 가 모두 보존되어 있다. 발견된 3건은 모두 INFO 등급으로, 이미 백로그에 추적 중이거나 spec 정합을 추가로 명료화하는 수준이다.

---

## 위험도

NONE
