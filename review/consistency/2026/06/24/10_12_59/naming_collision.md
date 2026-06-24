# 신규 식별자 충돌 검토 결과

검토 범위: M-3 3단계 — AssistantTurnPersistenceService 분리 (diff-base: origin/main)
검토 일시: 2026-06-24

## 발견사항

충돌로 간주할 사항이 발견되지 않았다.

### INFO: UsageSnapshot — 동일 모듈 내 SSE 이벤트 data shape 와 동형
- target 신규 식별자: `UsageSnapshot` (`assistant-turn-persistence.service.ts` L14)
- 기존 사용처: `AssistantStreamEvent` 의 `event: 'usage'` data 필드 (`workflow-assistant-stream.service.ts` L88-96). 동일 필드명·타입 구조를 갖는 인라인 객체 리터럴 타입.
- 상세: `UsageSnapshot` 은 기존에 어느 파일에서도 독립된 명명 타입으로 선언된 바 없다. `AssistantStreamEvent['usage'].data` 와 구조적으로 동형이며, JSDoc 에서도 이 관계를 명시하고 있다. 다른 모듈(agent-memory, metrics, frontend)의 `*Snapshot` 타입과는 의미가 겹치지 않는다.
- 제안: 현재 정의는 명확하고 독립적이다. 필요 시 `AssistantStreamEvent` 의 `usage.data` 타입과 공식 타입 alias 를 공유하도록 리팩터링할 수 있으나, 그 결정은 본 리뷰의 범위를 벗어난다. 식별자 충돌 관점에서는 문제없다.

---

검토 대상 식별자 전체 목록 및 판정:

| 신규 식별자 | 종류 | 기존 충돌 여부 | 판정 |
|---|---|---|---|
| `AssistantTurnPersistenceService` | 클래스 | 없음 (유일) | NONE |
| `UsageSnapshot` | 인터페이스 | 없음 (유일, SSE shape 와 동형이나 별도 선언 없었음) | INFO |
| `ResumeMeta` | 인터페이스 | 없음 (유일) | NONE |
| `makeResumeMeta` | 함수 | 기존 `workflow-assistant-stream.service.ts` 내 private 함수였으나 삭제 후 이동 — 충돌 아님 | NONE |
| `persistUserTurn` | 메서드 | 없음 | NONE |
| `persistAssistantTurn` | 메서드 | 없음 | NONE |
| `turnPersistence` | 프로퍼티 | 없음 | NONE |
| `assistant-turn-persistence.service.ts` | 파일 경로 | 없음. `tools/` 하위 `assistant-{role}.service.ts` 패턴(assistant-tool-router, assistant-finish-guard)과 일치 | NONE |

## 요약

M-3 3단계가 도입하는 신규 식별자(`AssistantTurnPersistenceService`, `UsageSnapshot`, `ResumeMeta`, `makeResumeMeta`, `persistUserTurn`, `persistAssistantTurn`)는 코드베이스 전체에서 기존에 다른 의미로 사용 중인 동일 이름이 없다. `makeResumeMeta` 는 이전에 `workflow-assistant-stream.service.ts` 의 private 함수로 존재했으나 이번 변경에서 삭제·이동되었으므로 이중 정의가 생기지 않는다. `UsageSnapshot` 은 SSE 이벤트 data shape 와 동형이지만, 기존에 동명 타입이 선언된 파일이 없어 충돌이 아닌 추가 선언이다. 파일 경로도 `tools/` 하위 기존 `assistant-*.service.ts` 패턴에 부합한다.

## 위험도

NONE
