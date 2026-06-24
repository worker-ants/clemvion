# 요구사항(Requirement) 리뷰 — M-3 3단계: AssistantTurnPersistenceService 분리

리뷰 대상: M-3 3단계 커밋 (AssistantTurnPersistenceService 분리)
리뷰어: requirement
리뷰 일시: 2026-06-24

---

## 발견사항

### [INFO] 기능 완전성 — 4개 persist 호출부 위임 전환 모두 완료
- 위치: `workflow-assistant-stream.service.ts` diff 전체
- 상세: `WorkflowAssistantStreamService` 내의 `persistAssistantTurn` 4개 호출부(라운드 한도 초과 / 에러 / stall 중간 row / 최종 row) 모두 `this.turnPersistence.persistAssistantTurn(...)` 위임으로 교체됐다. user 메시지 append + title derive 블록도 `this.turnPersistence.persistUserTurn(...)` 으로 완전히 이동됐다. 누락 없음.
- 제안: 없음.

### [INFO] 기능 완전성 — NestJS 모듈 등록 완료
- 위치: `workflow-assistant.module.ts` providers 배열 L52–54
- 상세: `AssistantTurnPersistenceService` 가 providers 에 등록됐고 `WorkflowAssistantSessionService` 도 같은 배열에 선행 등록되어 DI 그래프가 완전히 구성된다. exports 배열에 추가할 필요는 없음 (모듈 내부 소비만).
- 제안: 없음.

### [INFO] 엣지 케이스 — makeResumeMeta 음수 입력 방어 처리
- 위치: `assistant-turn-persistence.service.ts` L311 / `.spec.ts` L71–75
- 상세: `stallRounds <= 0` 분기가 음수도 "정상 턴"으로 처리한다. 실제 호출 경로에서 음수가 발생하지 않으므로 방어적 처리이며, 단위 테스트 `makeResumeMeta(-1)` 케이스가 명시적으로 커버한다.
- 제안: 없음.

### [INFO] 엣지 케이스 — whitespace-only content 시 title 미설정 + 원문 저장
- 위치: `assistant-turn-persistence.service.ts` L359–363 / `.spec.ts` L121–130
- 상세: `content.trim()` 이 빈 문자열이면 `setTitleIfEmpty` 를 호출하지 않는다. 단, `appendMessage` 는 원문(공백) 그대로 저장한다. 테스트 L121 케이스는 `setTitleIfEmpty` 미호출은 확인하나 `appendMessage` 호출에 대한 단언이 추가되어(L126–130) 구현 의도가 명확히 검증된다.
- 제안: 없음 (테스트 커버 충분).

### [INFO] 반환값 — 모든 경로에서 void 반환
- 위치: `assistant-turn-persistence.service.ts` — `persistUserTurn` L350, `persistAssistantTurn` L379
- 상세: 두 메서드 모두 `Promise<void>` 로 선언하고 실제로 값을 반환하지 않는다. `appendMessage` 예외 시 에러가 호출자로 전파되어 `streamMessage` 의 try/catch 에서 처리된다. 모든 에러 경로에서 흡수 없이 전파됨.
- 제안: 없음.

### [INFO] 비즈니스 로직 — content/toolCalls null 정규화
- 위치: `assistant-turn-persistence.service.ts` L390–391
- 상세: `content: content || null`, `toolCalls: toolCalls.length ? toolCalls : null` 정규화가 spec §6 응답 필드 스키마("빈 문자열이 아닌 null", "빈 배열이 아닌 null")와 일치한다.
- 제안: 없음.

### [INFO] 비즈니스 로직 — title derive 40자 slice
- 위치: `assistant-turn-persistence.service.ts` L360
- 상세: `content.trim().slice(0, 40)` 으로 세션 title 을 생성한다. spec 에는 40자 상한이 명시적으로 기술되어 있지 않으나, 이번 변경은 기존 `streamMessage` 내 `dto.content.trim().slice(0, 40)` 코드를 verbatim 이동한 것이므로 동작 계약에 변화 없음. trim → slice 순서가 leading whitespace 처리에서 slice → trim 과 의미가 다르지만 현 동작이 의도된 것임이 테스트에서 확인된다.
- 제안: 없음.

### [INFO] [SPEC-DRIFT] spec §10 의사코드 직접 호출 경로 vs 위임 경로
- 위치: `spec/3-workflow-editor/4-ai-assistant.md` §10 L1293–1295
- 상세: spec §10 Rationale 블록의 의사코드가 `await this.persistAssistantTurn(sessionId, ...)` 로 `WorkflowAssistantStreamService` 의 private 메서드를 직접 호출하는 방식으로 기술되어 있으나, M-3 3단계 이후 실제 구현은 `await this.turnPersistence.persistAssistantTurn(...)` 위임 경로다. 이는 M-3 3단계의 의도적 분리 결과이며 외부 동작 계약(SSE 순서, DB write 내용, 파라미터 구조)은 동일하게 유지된다. 코드가 더 최신이고 옳으며, spec 의사코드가 낡은 상태다.
- 제안: 코드 유지 + spec 반영. `spec/3-workflow-editor/4-ai-assistant.md` §10 L1293 의사코드를 `await this.turnPersistence.persistAssistantTurn(...)` 로 갱신 (planner 위임, M-3 전체 완료 후 일괄).

### [INFO] [SPEC-DRIFT] spec §10 최종 row 판정 기준 — consecutiveStallRounds vs totalStallCount
- 위치: `spec/3-workflow-editor/4-ai-assistant.md` §10 L1304
- 상세: spec 은 "턴 종료 시점의 최종 persist 에는 `autoResumed: consecutiveStallRounds > 0` 를 전달" 이라 기술한다. 그러나 실제 구현은 `makeResumeMeta(totalStallCount)` 를 사용하며 `totalStallCount` 는 진척 라운드에서 0 으로 리셋되지 않는 누적 카운터다. `consecutiveStallRounds` 는 진척이 생기면 리셋되어 stall-then-progress 시나리오에서 `autoResumed=false` 로 잘못 찍힐 수 있다. 코드가 spec 보다 정확히 구현되어 있으며 의도적 수정으로 판단된다.
- 제안: 코드 유지 + spec 반영. `spec/3-workflow-editor/4-ai-assistant.md` §10 L1304 `consecutiveStallRounds > 0` → `totalStallCount > 0` (또는 `makeResumeMeta(totalStallCount)` 패턴)으로 갱신 (planner 위임). 코드 되돌리기는 stall-then-progress 시나리오에서 버그를 재도입하므로 오답.

### [INFO] 데이터 유효성 — resumeMeta 기본값 경로
- 위치: `assistant-turn-persistence.service.ts` L386 `resumeMeta: ResumeMeta = makeResumeMeta(0)`
- 상세: `resumeMeta` 를 생략하면 `makeResumeMeta(0)` 이 호출되어 `{autoResumed: false, autoResumeReason: null, autoResumeAttempt: null}` 이 기본값이 된다. 이는 spec §6 `autoResumed` 기본값 `false`, 나머지 `null` 과 일치한다. 통합 테스트 `appends an assistant row with the default (non-resumed) meta` 가 resumeMeta 인자 생략 경로를 간접 커버한다.
- 제안: 없음.

### [INFO] 의도와 구현 간 괴리 — UsageSnapshot / ResumeMeta 인터페이스 명명
- 위치: `assistant-turn-persistence.service.ts` L279–295
- 상세: `UsageSnapshot` 과 `ResumeMeta` 인터페이스가 이번 변경에서 추출되어 export 됐다. 이전 리뷰(09_51_30)에서 이 두 인터페이스 추가가 INFO 개선 항목으로 지적됐고 RESOLUTION.md 에서 적용이 기록됐다. 인터페이스 명칭이 JSDoc 및 함수 시그니처와 일관되게 사용됐다.
- 제안: 없음.

### [INFO] TODO/FIXME 없음
- 위치: 전체 변경 파일
- 상세: 미완성 작업을 시사하는 TODO, FIXME, HACK, XXX 주석이 없다.
- 제안: 없음.

---

## 요약

M-3 3단계의 핵심 요구사항 — `persistAssistantTurn`, `makeResumeMeta`, user 메시지 append + title derive 로직을 무상태 collaborator `AssistantTurnPersistenceService` 로 분리하되 behavior 를 verbatim 보존한다 — 는 완전히 충족된다. `makeResumeMeta` 의 stall/non-stall 경계 로직, `persistUserTurn` 의 40자 title derive 규칙, `persistAssistantTurn` 의 content/toolCalls null 정규화 및 resumeMeta 기본값 전달, `UsageSnapshot`/`ResumeMeta` 인터페이스 추출, `@param resumeMeta` JSDoc 추가, thinkingTokens·length finishReason 테스트 신규 추가(09_51_30 RESOLUTION 적용 사항)가 모두 구현에 반영되어 있다. 4개 `persistAssistantTurn` 호출부의 위임 전환, 모듈 provider 등록, 통합 테스트 fixture 갱신도 누락 없이 완료됐다. SPEC-DRIFT 2건(spec §10 의사코드 직접 호출 기술 / `consecutiveStallRounds` vs `totalStallCount`)은 코드 결함이 아니라 구현이 spec 보다 더 정확하거나 최신화된 경우이며, spec 갱신이 필요한 항목이다. TODO/FIXME 없음. 에러 전파 경로 정상. Critical 0건, Warning 0건.

---

## 위험도

NONE

STATUS: SUCCESS
