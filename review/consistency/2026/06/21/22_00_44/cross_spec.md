# Cross-Spec 일관성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/4-nodes/3-ai, diff-base=origin/main)
Target: `spec/4-nodes/3-ai` (0-common.md / 1-ai-agent.md / 2-text-classifier.md / 3-information-extractor.md)
검토 대상 구현 변경: M-1 2단계 — `AiMemoryManager` 추출 (`codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts` 신설 + `ai-agent.handler.ts` 리팩터)

---

## 발견사항

- **[INFO]** spec frontmatter `code:` 미등재 — 신규 파일 누락
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 목록 (lines 4–13)
  - 충돌 대상: 실제 구현 파일 `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts` (신설) 및 `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` (M-1 1단계, commit `24ca3340`)
  - 상세: spec `1-ai-agent.md` frontmatter `code:` 에는 `ai-agent.handler.ts` / `ai-agent.schema.ts` / `ai-agent.component.ts` / `tool-providers/*.ts` / `shared/agent-memory-injection.ts` / `shared/agent-memory-schema.ts` 등이 열거되어 있으나, M-1 1단계에서 신설된 `ai-condition-evaluator.ts`와 M-1 2단계에서 신설된 `ai-memory-manager.ts` 두 파일이 등재되어 있지 않다. spec `code:` 필드는 해당 spec을 구현하는 파일의 단일 진실 색인이므로 drift 상태다. 이 사항은 `02-architecture.md` plan 의 `planner 후속(비차단 SPEC-DRIFT)` 항목(line 129)에 이미 인지되어 있다.
  - 제안: `project-planner` 가 `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter 에 `codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts` 와 `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts` 를 추가. M-1 1단계 plan 잔여 후속으로 묶어 처리 가능 (비차단 backlog).

- **[INFO]** `information-extractor` 핸들러가 `AiMemoryManager` 를 공유하지 않아 유사 로직 중복 존재
  - target 위치: `spec/4-nodes/3-ai/0-common.md §10` / `spec/4-nodes/3-ai/3-information-extractor.md §7`
  - 충돌 대상: `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts` (신설, ai_agent 전용) vs `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` (`injectPersistentMemory` / `scheduleMemoryExtraction` 내부 메서드 — lines 271–355)
  - 상세: `AiMemoryManager.injectMemoryContext` 의 [5a] persistent 회수 로직(buildRecallBlock + appendStablePrefix + agentMemoryService.recall 호출)과 IE 핸들러 내 `injectPersistentMemory` 가 동일한 `shared/agent-memory-injection.ts` 헬퍼를 공유해 빌드하고 있다. 두 경로가 같은 helper 를 써 동작은 동치이나, `AiMemoryManager` 클래스 안으로 통합되지 않고 IE 핸들러가 별도로 구현을 보유한다. 이는 `02-architecture.md §M-1` Option B ("ai/shared/ 즉시 승격 — 실공유 미확인 상태의 추측성 일반화 위험") 를 의도적으로 미채택한 결과이므로 설계 결정 위반이 아니다. 다만 향후 `AiMemoryManager` 의 [5a] 로직이 변경되면 IE 핸들러의 동일 경로도 별도 갱신해야 한다는 drift 위험이 상존한다.
  - 제안: 현시점은 비차단. M-1 3단계 또는 별도 리팩터에서 `AiMemoryManager.injectPersistentRecall([5a] 단독)` 을 `ai/shared/` 로 이전하거나 IE 가 `AiMemoryManager` 를 주입받는 방향을 검토할 수 있다. `02-architecture.md §M-1` plan 의 Option B 미채택 이유(실공유 미확인)가 이 시점에는 해소됐으므로 그 결정을 재평가하는 것이 적절하다.

- **[INFO]** `spec/4-nodes/3-ai/1-ai-agent.md §6.1` 구현 참조 문구가 리팩터 이전 위치를 가리킴
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §6.1` 단계 1.3 / 1.5 / 2.7 서술 — `ai-agent.handler.ts` 의 특정 단계를 직접 핸들러 책임으로 기술
  - 충돌 대상: `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts` (신설 — 해당 로직의 실제 구현 위치)
  - 상세: spec §6.1 단계 1.3 ("persistent 메모리 회수 — `memoryTopK` / `memoryThreshold` 를 동기 수행"), 1.5 ("컨텍스트 메모리 주입"), 2.7 ("persistent 메모리 추출 비동기") 의 구현이 `ai-agent.handler.ts` 에서 `AiMemoryManager` 로 이전됐다. spec 본문은 "핸들러가 N을 한다"는 행위 주체를 기술하지 않고 "단계 N에서 X가 일어난다"는 형태라 직접 모순은 없으나, 구현 파일 참조 관점에서는 drift 로 읽힐 수 있다. 실질 동작 계약(타이밍·ordering·spec §11.4)은 `AiMemoryManager` 가 그대로 보존했음이 코드에서 확인된다.
  - 제안: 비차단. `02-architecture.md §M-1` planner 후속 항목(line 129)에 이미 기록됐고, spec §6.1 본문은 행위 주체가 아닌 단계 기술 형식이라 기능 계약 변경 없음. 필요 시 spec §6.1 서술에 "(`AiMemoryManager` 위임)" 같은 구현 주체 주석을 추가할 수 있으나 의무 아님.

---

## 요약

M-1 2단계 `AiMemoryManager` 추출은 기존 `spec/4-nodes/3-ai` 영역의 어떤 데이터 모델·API 계약·상태 전이·RBAC 규칙·계층 책임 정의와도 **직접 모순이 없다**. 추출 대상 로직(`injectMemoryContext` / `scheduleMemoryExtraction` / `resolveMemoryStrategy`)이 기존 spec §6.1·§11.4·`17-agent-memory.md` 규약을 그대로 보존하는 behavior-preserving 리팩터임이 코드와 plan 에서 확인된다. 발견 사항 3건은 모두 INFO 등급으로, ① spec frontmatter `code:` 누락(이미 plan backlog 에 등재), ② IE 핸들러와의 유사 로직 중복(의도적 Option B 미채택 결과), ③ spec §6.1 구현 주체 표기 drift — 세 사항 모두 `02-architecture.md §M-1 planner 후속` 에 이미 인지된 범위 내다. CRITICAL 및 WARNING 발견사항 없음.

---

## 위험도

LOW
