# Performance Review — M-3 3단계: AssistantTurnPersistenceService 분리

## 발견사항

- **[INFO]** `makeResumeMeta` 는 순수 분기 함수이나 매 호출마다 새 객체 리터럴을 반환
  - 위치: `/codebase/backend/src/modules/workflow-assistant/tools/assistant-turn-persistence.service.ts` L488-505
  - 상세: `stallRounds <= 0` 분기의 반환값 `{ autoResumed: false, autoResumeReason: null, autoResumeAttempt: null }` 는 항등 객체이므로 모듈 상수로 한 번만 할당 가능. 실제로는 한 턴에 최대 수회(4개 persist 호출부 중 기본값 경로) 실행되며, GC 압력은 매우 낮아 측정 가능한 영향은 없음.
  - 제안: 성능 개선이 필요하다면 `const DEFAULT_RESUME_META = { autoResumed: false, autoResumeReason: null, autoResumeAttempt: null } as const;` 를 모듈 상수로 추출하고 `stallRounds <= 0` 경로에서 재사용. 현재 규모에서는 필수 아님.

- **[INFO]** `persistUserTurn` 내 `content.trim().slice(0, 40)` — trim() 이 전체 content 길이에 비례
  - 위치: `/codebase/backend/src/modules/workflow-assistant/tools/assistant-turn-persistence.service.ts` L542
  - 상세: `trim()` 은 O(n) 으로 전체 문자열을 스캔한다. user content 가 수십 KB 에 달하는 경우(장문 붙여넣기 등) 불필요한 full-scan 발생. title derive 는 앞 40자만 필요하므로 `content.slice(0, 40).trim()` 순서가 더 효율적 — slice 먼저 해 40자 이내로 잘라낸 뒤 trim 하면 trim 대상이 항상 ≤40자.
  - 제안: `const derived = content.slice(0, 40).trim();` 로 순서 변경. 의미적으로 동일하지 않을 수 있음(선행 공백이 많으면 40자 이내 유효 내용이 줄어들 수 있음) — 현재 동작을 유지하되 성능을 우선한다면 변경 가능, 아니라면 유지.

- **[INFO]** `persistAssistantTurn` 의 `resumeMeta` 기본값으로 `makeResumeMeta(0)` 호출 — 매 호출 시 실행
  - 위치: `/codebase/backend/src/modules/workflow-assistant/tools/assistant-turn-persistence.service.ts` L572
  - 상세: TypeScript default parameter expression `resumeMeta = makeResumeMeta(0)` 는 인수 미전달 시 매 호출마다 평가된다. 함수 비용 자체는 무시 가능하나, 위 INFO-1 의 개선과 함께 상수화하면 완전히 제거 가능.
  - 제안: INFO-1 에서 제안한 `DEFAULT_RESUME_META` 상수를 기본값으로 사용: `resumeMeta = DEFAULT_RESUME_META`.

- **[INFO]** `streamMessage` 내 `history.slice(-MAX_HISTORY_TURNS * 3)` — 전체 히스토리 로드 후 잘라냄
  - 위치: `/codebase/backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts` L1300
  - 상세: `loadMessages` 가 전체 히스토리를 적재한 뒤 `slice` 로 최근 90개 메시지만 사용. 세션이 수백 턴 이상으로 길어지면 DB에서 전체 메시지를 가져와 메모리에 올린 뒤 버리는 구조. 이 변경 자체가 도입한 문제는 아니며 기존 코드 그대로지만, 성능 관점 언급 가치가 있음.
  - 제안: `loadMessages(sessionId, { limit: MAX_HISTORY_TURNS * 3, order: 'DESC' })` 처럼 DB 쿼리 레벨에서 최신 N개만 조회하도록 `WorkflowAssistantSessionService` 를 수정하는 것이 장기적 개선. 본 PR 범위 밖.

## 요약

이번 변경은 `WorkflowAssistantStreamService` 에서 persist 로직을 `AssistantTurnPersistenceService` 로 추출하는 behavior-preserving 리팩터링이다. 새로 도입된 코드(`makeResumeMeta`, `persistUserTurn`, `persistAssistantTurn`)는 DB append 를 위임하는 thin wrapper 이며, 반복 호출 내 새로운 루프, N+1 쿼리, 불필요한 캐싱 제거 기회, 블로킹 I/O 패턴 등 주목할 만한 성능 열화 요인은 발견되지 않았다. 언급된 발견사항은 모두 미시적 수준(매 호출 객체 리터럴 할당, `trim` 순서)이며 현재 운영 규모에서 측정 가능한 영향을 주지 않는다. 분리 자체는 클래스 인스턴스 하나 추가(NestJS 싱글턴)에 그치므로 메모리 영향도 무시 가능하다.

## 위험도

NONE
