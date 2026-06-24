# 요구사항(Requirement) 리뷰 — M-3 3단계: AssistantTurnPersistenceService 분리

리뷰 대상 커밋: `813a4829`  
리뷰어: requirement  
리뷰 일시: 2026-06-24

---

## 발견사항

### [INFO] makeResumeMeta 음수 입력 방어 처리 — 의도적 방어 코드, 테스트 커버 있음
- 위치: `assistant-turn-persistence.service.ts` L27 / `.spec.ts` L105-109
- 상세: `stallRounds <= 0` 조건이 음수도 정상 턴으로 처리한다. 음수 stallRounds 가 실제 호출 경로에서 발생하지 않으므로 방어적 처리다. 단위 테스트에서 `makeResumeMeta(-1)` 케이스를 명시적으로 커버하고 있다. 기능 요건 상 문제 없음.
- 제안: 없음 (의도적 방어 처리, 테스트 커버됨).

### [INFO] persistUserTurn — appendMessage 실패 후 setTitleIfEmpty 호출 경로
- 위치: `assistant-turn-persistence.service.ts` L71-79
- 상세: `appendMessage` 가 예외를 던지면 `setTitleIfEmpty` 는 호출되지 않는다. 이는 명시적 `await` 체이닝의 자연스러운 결과이며, append 실패 시 title 도 설정하지 않는 것이 논리적으로 타당하다. 에러 전파는 호출자(`streamMessage`)의 try/catch 에 위임되므로 서비스 자체는 에러 흡수 없이 올바르게 동작한다.
- 제안: 없음.

### [INFO] [SPEC-DRIFT] spec §9 의사코드가 분리 전 직접 호출 방식을 기술
- 위치: `spec/3-workflow-editor/4-ai-assistant.md` §9 및 §10 Rationale 블록 (L1290-1308)
- 상세: spec §10 Rationale 의사코드(`await this.persistAssistantTurn(...)`)가 `WorkflowAssistantStreamService` 의 메서드 직접 호출로 기술되어 있으나, 실제 구현은 `this.turnPersistence.persistAssistantTurn(...)` 위임 경로다. 이는 M-3 3단계의 의도적 분리 결과이며 동작 계약 자체는 변경 없이 유지된다. 외부 API·SSE·DB 스키마는 동일.
- 제안: 코드 유지 + spec 반영. 대상: `spec/3-workflow-editor/4-ai-assistant.md` §10 Rationale 의사코드 블록 내 `this.persistAssistantTurn(...)` → `this.turnPersistence.persistAssistantTurn(...)` 로 갱신. M-3 완료 후 일괄 반영 (consistency 리뷰 INFO-2 동일 지적).

### [INFO] [SPEC-DRIFT] spec §10 최종 row 판정 기준 — consecutiveStallRounds vs totalStallCount
- 위치: `spec/3-workflow-editor/4-ai-assistant.md` §10 L1304
- 상세: spec은 "턴 종료 시점의 최종 persist 에는 `autoResumed: consecutiveStallRounds > 0` 를 전달" 이라 기술하나, 실제 구현은 `makeResumeMeta(totalStallCount)` 를 사용한다. `totalStallCount` 는 진척 라운드로 리셋되지 않는 누적 카운터이므로 "이번 턴 전체에서 stall 이 한 번이라도 있었는지" 를 정확히 표현한다. `consecutiveStallRounds` 는 진척이 생기면 0 으로 리셋되어, 복구 성공 후 정상 완료한 경우 `autoResumed=false` 로 잘못 찍힐 수 있다. 코드가 spec 보다 정확하게 구현되어 있으며, 이는 구현 중 버그를 발견해 의도적으로 수정한 결과로 판단된다. 스트림 서비스 주석(`let totalStallCount = 0`) 에도 이 구분이 명확히 기술되어 있다.
- 제안: 코드 유지 + spec 반영. 대상: `spec/3-workflow-editor/4-ai-assistant.md` §10 L1304 `consecutiveStallRounds > 0` → `totalStallCount > 0` (또는 `makeResumeMeta(totalStallCount)` 패턴) 으로 갱신. 코드를 되돌리는 것은 stall-then-progress 시나리오에서 autoResumed 가 false 로 잘못 찍히는 버그를 재도입하므로 오답.

### [INFO] 단위 테스트 — persistUserTurn appendMessage 인자에 role 검증 완전성
- 위치: `assistant-turn-persistence.service.spec.ts` L130-134
- 상세: `appendMessage` 호출 시 `{ role: 'user', content: 'hello world' }` 정확히 명시되어 있다. `role` 필드를 명시적으로 검증함으로써 오입력 방어가 단언 수준에서 커버된다.
- 제안: 없음.

### [INFO] 단위 테스트 커버리지 — whitespace-only content 에 대한 appendMessage 호출 여부 미검증
- 위치: `assistant-turn-persistence.service.spec.ts` L155-159
- 상세: "whitespace-only content 일 때 setTitleIfEmpty 미호출" 케이스가 `appendMessage` 자체는 여전히 호출됨을 단언하지 않는다. 위 케이스는 title 동작만 검증하고 message append 는 암묵적으로 가정한다. 기능 결함은 아니나 테스트 의도를 명확히 하기 위해 `appendMessage` 호출 여부를 함께 단언하면 더 견고해진다.
- 제안: 해당 `it` 블록 끝에 `expect(sessionService.appendMessage).toHaveBeenCalledTimes(1);` 를 선택적으로 추가.

---

## 요구사항 충족 관점 전체 평가

M-3 3단계의 핵심 요구사항 — `persistAssistantTurn`, `makeResumeMeta`, user 메시지 append 로직을 무상태 collaborator `AssistantTurnPersistenceService` 로 분리하되 behavior를 verbatim 보존한다 — 는 완전히 충족된다. `makeResumeMeta` 의 stall/non-stall 경계 로직, `persistUserTurn` 의 40자 title derive 규칙, `persistAssistantTurn` 의 content/toolCalls null 정규화 및 resumeMeta 전달 모두 spec §6.2·§10 요건과 일치한다. 4개 persistAssistantTurn 호출부의 위임 전환, 모듈 provider 등록, 통합 테스트 fixture 갱신도 누락 없이 완료됐다. SPEC-DRIFT 2건(spec §10 의사코드 직접 호출 기술 / `consecutiveStallRounds` vs `totalStallCount`)은 코드 결함이 아니라 구현이 spec 보다 정확하거나 더 최신화된 경우이며, spec 갱신이 필요한 항목이다. TODO/FIXME 없음. 에러 전파 경로 정상. 전체적으로 기능 완전성 HIGH, Critical/Warning 0건.

---

## 위험도

NONE
