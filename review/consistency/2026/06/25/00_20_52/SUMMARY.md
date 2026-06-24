# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — WARNING 1건(동명 private 메서드 혼동 위험). 런타임 충돌 없음. INFO 수준 표기 불일치 다수.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Naming Collision | `buildSingleTurnSystemPrompt` 동명 private 메서드가 동일 AI 노드 카테고리 내 인접 파일에 이미 존재. 시그니처·의미가 다름. 런타임 충돌은 없으나 IDE 전역 검색·리뷰 혼동 위험. | `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (신규 private 메서드) | `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:1554` (`InformationExtractorHandler.buildSingleTurnSystemPrompt`) | `AiTurnExecutor` 측 메서드를 `buildAgentSingleTurnSystemPrompt` 또는 `buildSingleTurnAgentSystemPrompt` 로 rename. 동일 파일 내 정의 1곳 + 호출 1곳(`executeSingleTurn`) + spec 파일 주석 반영. public API 영향 없음. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec / Rationale | spec §6.1 단계 열거 순서(1.3→1.5→1.7)와 구현 호출 순서(1.7 먼저, 1.3/1.5 뒤)의 불일치가 코드 주석으로만 정당화됨. 행위 동등성은 보장(getThreadExcludingNode self-node 제외 불변식). | `ai-turn-executor.ts` `executeSingleTurn` 주석 | 차후 spec-sync PR 시 `spec/4-nodes/3-ai/1-ai-agent.md §6.1` 1.7 항에 "구현상 1.7이 1.3/1.5보다 먼저 호출되나 self-node 제외로 행위 동등" 한 줄 주석 추가 권장. 이번 슬라이스 scope 밖. |
| 2 | Cross-Spec | `buildSingleTurnSystemPrompt` JSDoc 의 [1]~[4] 번호가 spec §11.4 내부 ordering 번호이며 §6.1 단계 번호가 아닌 점. JSDoc 에 `spec/4-nodes/3-ai/0-common.md §11.4` 링크가 있어 맥락 파악 가능. | `ai-turn-executor.ts` `buildSingleTurnSystemPrompt` JSDoc | 코드 주석 표기 정리 정도로 충분. spec 갱신 불요. |
| 3 | Convention Compliance | `applySingleTurnMemoryInjection` 9개 파라미터를 args 객체로 묶는 패턴 — 기존 클래스 내 다른 helper 와 동형. `executeSingleTurn` public 시그니처 원본 동일 유지 확인. | `ai-turn-executor.ts` L1011 | 이행 적합. 추가 조치 불요. |
| 4 | Convention Compliance | 테스트가 `sys!.indexOf(...)` 비교로 §11.4 prompt 순서를 직접 고정. conventions 테스트 방식 제한 규칙 없음. | `ai-turn-executor.spec.ts` L42–78 | 이행 적합. 추가 조치 불요. |
| 5 | Convention Compliance | `Principle 7` 주석(`// CONVENTIONS Principle 7`) 이 원본 위치에서 이동 후에도 동일 블록에 유지됨. 위반 없음. | `ai-turn-executor.ts` diff 주석 | 이행 적합. |
| 6 | Convention Compliance | `buildSingleTurnMessages` 로 추출 후 `ai_user` push 가 LLM 호출 전 동일 지점 유지 — spec/conventions/conversation-thread.md §2.2 ordering invariant 보존 확인. | `ai-turn-executor.ts` L989 주석 | 이행 적합. |
| 7 | Rationale Continuity | plan C-2 합의 원칙("ragAcc, mcpDiagnosticsAcc 등 공유 accumulator caller scope 유지, memoryStrategy caller 에서 1회 resolve")이 diff 에서 그대로 이행됨. | `ai-turn-executor.ts` `applySingleTurnMemoryInjection` 파라미터 설계 | 이행 적합. 추가 조치 불요. |
| 8 | Rationale Continuity | `buildSingleTurnSystemPrompt` 순수 함수 설계 — spec §11.4 [1]~[4] 조립과 [5] thread 주입의 분리 원칙을 정확히 구현. | `ai-turn-executor.ts` `buildSingleTurnSystemPrompt` 반환 타입 | 이행 적합. |
| 9 | Naming Collision | `buildSingleTurnMessages` — 전체 코드베이스 유일, 충돌 없음. | `ai-turn-executor.ts` | 추가 조치 불요. |
| 10 | Naming Collision | `applySingleTurnMemoryInjection` — 전체 코드베이스 유일, 충돌 없음. | `ai-turn-executor.ts` | 추가 조치 불요. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | spec §6.1 단계 번호 표기 혼동 가능성(INFO 2건). 직접 모순 없음. |
| Rationale Continuity | LOW | 단계 호출 역전이 코드 주석으로만 정당화됨. spec Rationale 미기록이나 행위 동등 보장됨. |
| Convention Compliance | NONE | 공개 API 시그니처·규약(Principle 0/7, §2.2, §11.4) 전항목 이행. |
| Plan Coherence | NONE | plan C-2 권장안 A 1차 슬라이스 정확히 이행. 미결 조건·후속 누락 없음. |
| Naming Collision | LOW | `buildSingleTurnSystemPrompt` 동명 메서드 인접 파일 공존(WARNING 1건). 나머지 2개 식별자 충돌 없음. |

## 권장 조치사항

1. **(WARNING 해소)** `AiTurnExecutor.buildSingleTurnSystemPrompt` 를 `buildAgentSingleTurnSystemPrompt` 로 rename. `/Volumes/project/private/clemvion/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 내 정의 1곳 + `executeSingleTurn` 내 호출 1곳 + `ai-turn-executor.spec.ts` 주석 수정. public API 영향 없음. 차단 사유는 아니지만 같은 AI 노드 카테고리 내 혼동 방지를 위해 이번 PR 내 수정 권장.
2. **(INFO — 차기 spec-sync 시)** `spec/4-nodes/3-ai/1-ai-agent.md §6.1` 1.7 항에 "구현상 1.7(ai_user push)이 1.3/1.5(memory injection)보다 먼저 실행되나 getThreadExcludingNode self-node 제외 불변식으로 행위 동등" 한 줄 주석 추가. 이번 슬라이스 scope 밖.