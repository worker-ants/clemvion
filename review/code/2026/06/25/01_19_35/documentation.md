# Documentation Review

## 발견사항

### [INFO] MultiTurnMemoryMeta 타입이 파일 내 중복 선언됨
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — diff 기준 신규 추가 위치(+61~+75, class 정의 직전)와 전체 파일 컨텍스트 ~1741~1755행 (class 정의 직전 다시 등장)
- 상세: `MultiTurnMemoryMeta` 타입이 동일 파일에 두 번 선언된다. 리팩터링 과정에서 인라인 익명 타입을 named type 으로 추출하면서 class 상단 직전 블록에 추가했으나, 전체 파일 컨텍스트를 보면 같은 내용이 ~1741행에도 잔류한다. tsc 가 통과하므로 런타임 영향은 없으나, 독자가 어느 선언이 SoT 인지 혼란스럽고 향후 수정 시 한 쪽만 변경하는 실수를 유발할 수 있다.
- 제안: 중복 선언 중 하나를 삭제하고 `export type MultiTurnMemoryMeta = …` 로 단일 위치에만 유지한다.

### [INFO] `handleSingleTurnConditionRoute` args 필드별 인라인 주석 부재
- 위치: `private handleSingleTurnConditionRoute` JSDoc (diff +179~+208)
- 상세: 메서드 목적·caller 위치·반환 계약 설명은 충실하나, args 객체의 다수 필드(특히 `rawConfig`, `llmConfig`, `singleTurnStartedAt`)에 대한 출처/의미 주석이 없다. 동일 파일의 `applyMultiTurnTurnMemory` 에서는 `multiTurnMemoryStrategy` 필드 narrowing 이유를 인라인 주석으로 명시하고 있어 일관성이 부족하다.
- 제안: 핵심 필드(특히 `rawConfig`, `singleTurnStartedAt`)에 출처나 nullable 이유를 간단한 인라인 주석으로 보충한다.

### [INFO] single-turn / multi-turn condition toolCallCount 비대칭이 한 방향에서만 상호 참조됨
- 위치: `recordSingleTurnNonProviderToolResults` JSDoc (diff +85~+93) vs `recordMultiTurnNonProviderToolResults` JSDoc (diff +510~+517)
- 상세: single-turn JSDoc 에는 "multi-turn 과 의도적으로 다른 동작 — §3.f-g" 라고 명시되어 있다. multi-turn JSDoc 에는 condition 이 `toolCallCount++` 임을 표기하나, "single-turn 과 의도적으로 다름" 이라는 역방향 참조가 없다. 두 메서드 중 어느 하나만 읽어서는 비대칭이 의도적임을 즉시 파악하기 어렵다.
- 제안: multi-turn JSDoc 에도 "single-turn 은 condition 미합산(§3.f-g)과 의도적으로 다름" 문구를 추가해 양방향 상호 참조를 완성한다.

### [INFO] `handleMultiTurnUserMessageEntry` — `options` undefined 시 기본값 JSDoc 미기재
- 위치: `private handleMultiTurnUserMessageEntry` (diff +873~+878)
- 상세: `options: ResumableMessageOptions | undefined` 를 받으나, undefined 일 때 `source` 가 `'ai_message'` 로 폴백됨이 JSDoc 에 언급되지 않는다. 호출자가 undefined 전달의 안전성을 확인하려면 구현부를 직접 읽어야 한다.
- 제안: JSDoc 에 "options 미전달 시 source 기본값 `'ai_message'`" 를 한 줄로 명시한다.

### [INFO] README / CHANGELOG / spec 업데이트 불필요
- 상세: 본 변경은 behavior-preserving 내부 리팩터링(god-method 분해)이며 공개 API·환경변수·설정 변경이 없다. `spec/4-nodes/3-ai/1-ai-agent.md` 의 내용도 변경되지 않으므로 spec, README, CHANGELOG 갱신 의무 없음.

---

## 요약

`processMultiTurnMessage`(768→459줄)·`executeSingleTurn`(545→395줄)의 god-method 를 6개 private helper 로 분해한 behavior-preserving 리팩터링이다. 새로 추출된 모든 메서드에 spec 섹션 참조(§6.1·§6.2·§3.f-g)를 포함한 JSDoc 이 작성되어 있어 문서화 수준은 양호하다. 공개 API·환경변수·설정 변경이 없으므로 README/CHANGELOG/spec 갱신은 불필요하다. 발견된 사항은 모두 INFO 등급으로, `MultiTurnMemoryMeta` 중복 선언 정리와 single-turn/multi-turn condition 카운트 비대칭의 양방향 상호 참조 보완이 주요 개선 포인트다.

## 위험도
LOW
