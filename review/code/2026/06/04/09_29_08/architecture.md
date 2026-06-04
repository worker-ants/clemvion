# Architecture Review

## 발견사항

### [INFO] TTL 값 파싱이 서비스 레이어가 아닌 핸들러 레이어에 위치
- 위치: `ai-agent.handler.ts` — `resolveMemoryTtlDays()` private 메서드
- 상세: `memoryTtlDays` 의 타입 강제(number/string → 양의 정수) 로직이 `AiAgentHandler` 안에 있다. 이 로직은 도메인 규칙(0 이하 = 무만료, floor 처리)이므로 `AgentMemoryService` 나 별도 값 객체에 두는 것이 SRP 관점에서 더 자연스럽다. 현재 구조에서는 다른 진입점(예: 미래의 API 직접 호출)이 같은 sanitization 을 재구현해야 할 위험이 있다.
- 제안: 이 변환 로직을 `AgentMemoryService.saveMemories` 의 `ttlDays` 인자 처리 내부로 옮기거나, 별도 `resolveMemoryTtl(raw: unknown): number | undefined` 유틸 함수로 추출해 queue payload 생성 시점에 적용한다. 현 규모에서는 큰 위험은 아니다.

### [INFO] `saveMemories` 시그니처 arity 확장 — 포지셔널 파라미터 5개
- 위치: `agent-memory.service.ts` — `saveMemories(workspaceId, scopeKey, items, embedCfgSource, ttlDays?)`
- 상세: `ttlDays` 가 5번째 포지셔널 인자로 추가되었다. 현재 5개로 아직 관리 가능하지만, 향후 `recallFilter`, `dedup 정책` 등이 추가될 경우 인자 수가 빠르게 증가할 수 있다. 테스트(`callArgs[4]`)에서 인덱스로 접근하는 패턴이 이미 fragile 하다.
- 제안: 선택적 파라미터가 더 추가될 가능성이 있으면 옵션 객체(`SaveMemoriesOptions`)로 묶는 리팩토링을 미리 고려한다. 즉각적 변경을 요구하는 수준은 아니다.

### [INFO] `expiresAtSql` — SQL 리터럴 인터폴레이션 패턴의 범위 제한
- 위치: `agent-memory.service.ts` — `insertMemory`, `updateMemory` 내 `${expiresAtSql ?? 'NULL'}` 인터폴레이션
- 상세: `ttlDays` 는 이미 `resolveMemoryTtlDays` 에서 양의 정수로 강제되고, 그 값이 SQL 에 `INTERVAL '${ttlDays} days'` 형태로 삽입된다. 정수 검증이 핸들러 레이어에서 이루어지므로 현 흐름에서 SQL injection 위험은 없다. 단, `expiresAtSql` 문자열 생성 지점(service layer)은 외부 입력이 `ttlDays` 숫자 타입으로 이미 변환된 후이므로 안전하다. 다만 이 패턴은 파라미터 바인딩 관례에서 벗어나 미래 유지보수자가 혼란스러울 수 있다.
- 제안: PostgreSQL 의 `now() + ($1 * INTERVAL '1 day')` 패턴으로 파라미터 바인딩 방식을 통일하면 일관성이 높아진다. 보안상 즉각적 위험은 없으므로 선택적 개선이다.

### [INFO] 증분 추출 watermark (`lastExtractionTurnSeq`) 가 `_resumeState` 에 flat merge
- 위치: `ai-agent.handler.ts` — `_resumeState` spread 에 `lastExtractionTurnSeq` 추가
- 상세: `_resumeState` 객체에 메모리 watermark 가 직접 추가되는 방식은 기존 `_resumeState` 의 모든 필드와 같은 네임스페이스를 공유한다. `_resumeState` 는 이미 다수의 cross-cutting 필드를 담는 구조이므로 응집도 측면에서 이 패턴 자체는 pre-existing 이다. 이 PR 에서 새로 도입된 것이 아니라 기존 패턴의 연장이므로 정보 수준으로 기록한다.
- 제안: `_resumeState` 내에 `memoryState: { lastExtractionTurnSeq, ... }` 같은 sub-namespace 를 두면 향후 메모리 관련 상태 필드 추가 시 구조가 명확해진다. 중장기 개선 항목.

### [INFO] `findSimilarFact` 와 `recall` 의 SQL 중복 — 추상화 기회
- 위치: `agent-memory.service.ts` — `findSimilarFact` private 메서드 (lines ~444–457)
- 상세: `findSimilarFact` 의 cosine SQL 은 `recall` 의 SQL 과 구조가 거의 동일하다 (코드 주석에서도 "recall cosine SQL 재사용"으로 설명). 그러나 실제 구현은 분리된 별도 쿼리로 작성되어 있어 두 곳에서 스키마 변경(예: 새 컬럼 추가, expires_at 필터 변경) 시 양쪽 동기화가 필요하다.
- 제안: 공통 cosine 쿼리 빌더를 추출해 `recall` 과 `findSimilarFact` 가 재사용하면 향후 유지보수 부담이 줄어든다. 현재는 두 곳뿐이고 차이(LIMIT/반환 컬럼)가 명확하므로 즉시 강제할 수준은 아니다.

### [INFO] `batchSeen` 누적 방식 — UPDATE 경로가 batchSeen 에 추가되지 않음
- 위치: `agent-memory.service.ts` — `saveMemories` 루프 내 UPDATE 경로 (lines ~376~384)
- 상세: batch 내 중복으로 UPDATE 가 발생한 경우(`batchMatch` 분기), 해당 id/embedding 은 `batchSeen` 에 추가되지 않는다. 이로 인해 동일 batch 의 3번째 항목이 1번째 항목과 유사할 경우, 2번째 항목이 1번째를 UPDATE 했어도 3번째는 `batchSeen` 에서 1번째를 찾지 못하고 DB round-trip(`findSimilarFact`)으로 넘어간다. 동작 정확성(결국 DB에서 찾거나 INSERT)은 보존되지만 불필요한 DB round-trip 이 발생할 수 있다.
- 제안: `batchMatch` 경로에서도 `batchSeen.push({ id: batchMatch, embedding })` 을 추가하는 것을 검토한다. 기능 정확성에는 영향이 없으나 효율 개선이다.

## 요약

이번 변경은 AI Agent persistent 메모리에 TTL 만료(AGM-10), 의미기반 dedup/갱신(AGM-09), 증분 추출 watermark(AGM-08), 추출 항목 분류(AGM-11) 의 네 가지 기능을 추가한다. 아키텍처 관점에서 레이어 책임 분리는 전반적으로 잘 유지되어 있다 — 추출 파이프라인(queue/processor), 서비스 레이어(AgentMemoryService), 핸들러(AiAgentHandler), 데이터 레이어(migration) 의 경계가 명확하고 순환 의존성도 없다. `parseExtractionResponse` 의 하위호환 처리, graceful fallback 패턴, partial index 선택 등 세부 설계도 적절하다. 발견된 항목들은 모두 INFO 수준으로, TTL 파싱 위치·포지셔널 파라미터 arity·SQL 인터폴레이션 관례·watermark 네임스페이스·cosine SQL 중복 등 향후 확장성을 고려한 개선 제안이며 즉각적 차단 사유는 없다.

## 위험도

LOW
