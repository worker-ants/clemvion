# Code Review 통합 — IE persistent 메모리 (memoryStrategy v2)

**BLOCK: YES** (fix 전) — requirement C-1 1건. 8 code reviewer.
대상(merge-base 21fa8194..HEAD): IE recall+extract+multi-turn push. 게이트 lint/build/e2e(174) PASS.

## Critical / BLOCK
| # | reviewer | 발견 | 조치 |
|---|---|---|---|
| C1 | requirement(BLOCK:YES) | spec §4.2·conversation-thread §2.3 은 multi-turn 종결 push 를 memoryStrategy 무관 선언("v2 limitation 해소")하나, 코드는 `conversationThreadRef` 를 persistent 일 때만 stateBase 에 실어 **manual multi-turn 은 미push** → spec-코드 불일치 | **push 를 전 전략 공통**으로(manual 포함, endReason≠error). extraction(scheduleMemoryExtraction)만 persistent. manual 회귀 테스트를 "push O, recall/extract 미호출" 로 갱신 |

## Warning (조치)
| # | reviewer | 발견 | 조치 |
|---|---|---|---|
| F2 | requirement/scope | spec `3-IE.md §7` 하위절이 `### 9.1/9.2/9.3` 로 오번호(§9 Rationale 앵커 충돌) | `### 7.1/7.2/7.3` 정정 |
| F3 | concurrency/side-effect | multi-turn fire-and-forget `.catch(()=>undefined)` 에러 무음 | `.catch((err)=>logger.warn(...))` |
| F4 | testing(W2) | single-turn `await scheduleMemoryExtraction` 에 catch 없음 → reject 시 응답 실패 + 테스트 없음 | single-turn extraction graceful(try/catch 또는 .catch) + reject 시 out 단언 테스트 |
| F5 | testing(W3) | manual single-turn thread push 계약 미검증 | manual single-turn `turns.length===1` 단언(전략무관 push) |
| F6 | testing(W1)/concurrency(W2) | watermark(`lastExtractionTurnSeq`) resume 운반 미단언 + "종결1회라 미전진" 불명 | resume 핀 추가 + "종결 1회 push 구조 — watermark forward-looking" 주석 |
| F7 | side-effect(W1) | `conversation-context-schema.ts` JSDoc "IE 는 memoryStrategy 없음" stale(이제 있음) | 주석 갱신 |

## 보류 (backlog — followup-v2)
- architecture W1/W2 + maintainability W1/W2/W4: shared memory-util 추출(`resolveMemoryTtlDays`·`scheduleMemoryExtraction` 중복, `agent-memory-injection` 모듈경계, `memoryConfig` 타이핑) — 후속 리팩토링.
- security: `memoryTopK` 상한 cap·instruction 필터 다국어 — ai_agent 와 공유 결함, 두 노드 함께.
- architecture I-3: persistent+contextScope 공존 ordering(UI 로 불가, 방어만).

## 확인(정상)
- side-effect/scope: manual 무영향(C1 fix 후 push 는 추가되나 recall/extract 0), ai_agent·text_classifier 무변경, summary_buffer IE 미도입.
- security: workspace_id 격리·scope sanitize·data-fence(wrapMemoryContent) ai_agent 동형 재사용. 신규 취약점 0.
- architecture: IE 가 AgentMemoryService 직접 호출(injectMemoryContext 전체 추출 안 함)은 결합도상 적절.

## reviewer별 BLOCK: requirement YES(C1) · 나머지 7 NO
