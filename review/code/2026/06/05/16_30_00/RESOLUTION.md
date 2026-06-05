# RESOLUTION — IE persistent 메모리 리뷰 반영 (C1 · F2~F7)

대상 SUMMARY: `review/code/2026/06/05/16_30_00/SUMMARY.md`. 적용 범위 = **C1 + F2~F7**. 보류(backlog) 항목은 손대지 않음.

## 발견 → 조치

| # | 심각도 | 발견 | 조치 |
|---|---|---|---|
| C1 | BLOCK | `conversationThreadRef`/`nodeId`/`executionId` 를 `memoryStrategy === 'persistent'` 일 때만 stateBase 에 실어 **manual multi-turn 종결이 thread 에 미등록** → spec §4.2 + conversation-thread §2.3("multi-turn 종결 등록은 전략 무관, v2 limitation 해소")와 불일치 | `conversationThreadRef`/`nodeId`/`executionId` 를 **전략 무관**하게 stateBase 운반. `memoryConfig`(추출 scope/모델 폴백 전용)만 persistent-only 유지. `buildMultiTurnFinalOutput` 종결 push 는 이미 `endReason !== 'error' && target` 만 가드(전략 무관) — 코드를 spec 에 정렬. **extraction(`scheduleMemoryExtraction`)은 persistent 일 때만**(현행 유지), recall/memoryConfig 운반도 persistent 전용 유지 |
| F2 | Warning | spec `3-information-extractor.md §7` 하위절이 `### 9.1/9.2/9.3` 오번호(§9 Rationale 앵커 충돌) | `### 7.1 회수`/`### 7.2 추출`/`### 7.3 manual 회귀 불변식` 로 정정. 타 문서의 이 앵커(`#91-`/`#92-`/`#93-`) 참조 없음 확인(`git grep` — 모두 `#7-persistent-…` heading 또는 타 문서 §9.x 참조) |
| F3 | Warning | multi-turn fire-and-forget `.catch(() => undefined)` 에러 무음 | `.catch((err) => this.logger.warn('IE multi-turn memory extraction enqueue 실패', …))` |
| F4 | Warning | single-turn `await scheduleMemoryExtraction` reject 시 응답 전체 실패 + 테스트 없음 | `.catch((err) => { this.logger.warn('IE single-turn memory extraction enqueue 실패', …); return undefined; })` 로 hot-path 보호. **테스트 추가**: `scheduleExtraction` reject 시 single-turn 이 정상 `out` 반환 단언 |
| F5 | Warning | manual single-turn thread push 계약 미검증 | manual single-turn 성공 케이스에 `expect(thread.getThread(context).turns).toHaveLength(1)` 추가(전략무관 push 핀) |
| F6 | Warning | watermark resume 운반 미단언 + "종결 1회라 미전진" 불명 | `_resumeState` 단언 블록에 `nodeId` 핀 + watermark 운반 핀(`lastExtractionTurnSeq === undefined || typeof === 'number'`) 추가. handler `lastExtractionTurnSeq` JSDoc 에 "종결 1회 추출 구조 — watermark 현재 미전진, forward-looking 운반 슬롯" 주석 |
| F7 | Warning | `conversation-context-schema.ts` JSDoc "text_classifier / information_extractor 는 memoryStrategy 없음" stale | "information_extractor 는 memoryStrategy(manual\|persistent) 를 가지므로 `gateOnManualMemoryStrategy: true` 로 호출. text_classifier 만 가드 없음" 으로 갱신(JSDoc 2곳) |

### 부수 갱신
- handler `conversationThreadRef`/`executionId`/`nodeId` 필드 JSDoc 을 "전략 무관 운반" 으로 정정(C1 정합).
- manual multi-turn 회귀 테스트를 "thread 등록 발생(turns.length===1) + recall/extract 미호출 + `[memory]` 미포함" 으로 갱신(기존 turns.length===0 → 1).

## 보류 (backlog — followup-v2, 본 작업 범위 외)
- shared memory-util 추출(`resolveMemoryTtlDays`·`scheduleMemoryExtraction` 중복, `agent-memory-injection` 모듈경계, `memoryConfig` 타이핑).
- `memoryTopK` 상한 cap · instruction 필터 다국어(ai_agent 공유 결함, 두 노드 함께).
- persistent + contextScope 공존 ordering(UI 로 불가, 방어만).

## TEST 결과 (GREEN)
- **lint**: PASS (33s)
- **unit**: 백엔드 320 suites / 6215 tests 전부 PASS. IE 한정(memory+thread+handler) 51 tests PASS. 프론트 `schedules-page.test.tsx` RBAC 1건 FAIL 은 **본 변경 무관 pre-existing 테스트 격리 flaky** — 단독 실행 시 10/10 PASS 확인(전체 suite 동시 실행 시 DOM 누수). 백엔드 IE 변경과 무관.
- **build**: PASS (41s)
- **e2e (docker)**: PASS — 174 tests passed (58s)
