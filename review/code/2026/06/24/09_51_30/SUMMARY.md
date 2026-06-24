# Code Review 통합 보고서

## 전체 위험도
**LOW** — M-3 3단계(`AssistantTurnPersistenceService` 분리) 는 behavior-preserving 순수 리팩토링이다. Critical 발견 없음. Warning 1건(타입 안전성), SPEC-DRIFT 2건(spec 갱신 필요).

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 타입 안전성 | `finishReason` 파라미터 타입이 `string` 으로 너무 넓어 컴파일 타임에 오타를 차단하지 못함 | `assistant-turn-persistence.service.ts` `persistAssistantTurn` 시그니처 | `FinishReason` union 타입(`'stop' \| 'tool_calls' \| 'error' \| 'auto_resume_pending'`)을 export 해 파라미터에 적용; 최소한 `'stop' \| 'tool_calls' \| string` narrowing hint 라도 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | spec §10 Rationale 의사코드가 분리 전 직접 호출(`this.persistAssistantTurn(...)`) 방식으로 기술되어 있으나 실제 구현은 `this.turnPersistence.persistAssistantTurn(...)` 위임 경로 | `spec/3-workflow-editor/4-ai-assistant.md` §10 Rationale 블록 | 코드 유지 + spec 의사코드 갱신(M-3 완료 후 일괄, planner) |
| 2 | SPEC-DRIFT | spec §10 최종 persist 의 `autoResumed` 판정 기준이 `consecutiveStallRounds > 0` 으로 기술되어 있으나 실제 구현은 `totalStallCount > 0` (누적 카운터). 코드가 더 정확하며 revert 는 stall-then-progress 시나리오에서 버그를 재도입 | `spec/3-workflow-editor/4-ai-assistant.md` §10 | 코드 유지 + spec 갱신: `consecutiveStallRounds > 0` → `totalStallCount > 0` (planner) |
| 3 | 아키텍처 | `usage` 파라미터 인라인 타입이 `AssistantStreamEvent` 의 `'usage'` shape 와 중복될 가능성 있어 diverge 위험 | `assistant-turn-persistence.service.ts` | `UsageSnapshot` 인터페이스를 별도 선언해 양쪽에서 참조 |
| 4 | 유지보수성 | `persistAssistantTurn` 이 7개 positional 파라미터를 받아 호출부 4곳에서 `null` 나열이 가독성 저하 | `assistant-turn-persistence.service.ts` 및 호출부 | `AssistantPersistParams` options object 타입 도입 (중기 개선) |
| 5 | 유지보수성 | `makeResumeMeta` 가 `stream.service.ts` 에서도 import 되어 캡슐화 경계를 관통; stall count 변환 책임이 분산됨 | `workflow-assistant-stream.service.ts` import 블록 | `persistAssistantTurn` 에 `stallRounds: number` 오버로드 추가하거나 현행 유지 + 의도적 import 주석 명시 |
| 6 | 유지보수성 | 테스트에서 `as never` 타입 단언 반복 사용으로 mock 형태 변경 시 컴파일 오류 미검출 | spec 파일들 | `as Pick<WorkflowAssistantSessionService, 'appendMessage' \| 'setTitleIfEmpty'>` 로 교체 (선택적) |
| 7 | 테스트 | whitespace-only content 케이스에서 `appendMessage` 호출 여부를 단언하지 않아 실제 저장 동작이 암묵적으로만 가정됨 | `assistant-turn-persistence.service.spec.ts` | `appendMessage` 호출 단언 추가 |
| 8 | 테스트 | `usage.thinkingTokens` optional 필드 커버리지 없음 | `assistant-turn-persistence.service.spec.ts` | `thinkingTokens` 포함 usage 케이스 추가 |
| 9 | 테스트 | `resumeMeta` 기본값 인자 생략 경로를 명시적으로 단언하는 케이스 없음 | `assistant-turn-persistence.service.spec.ts` | 기본값 경로 단언 추가 |
| 10 | 문서화 | `persistAssistantTurn` 메서드 수준 JSDoc 없음(`persistUserTurn` 은 있어 일관성 깨짐) | `assistant-turn-persistence.service.ts` | JSDoc 추가 |
| 11 | 문서화 | `makeResumeMeta` 반환 타입이 인라인 리터럴로 반복 선언되어 `resumeMeta` 파라미터 타입과 중복 | `assistant-turn-persistence.service.ts` | `ResumeMeta` 타입 alias 추출 |
| 12 | 문서화 | spec 문서 내 `WorkflowAssistantStreamService` collaborator 목록(3종)이 갱신되었는지 미확인 | `spec/3-workflow-editor/4-ai-assistant.md` | spec에서 신규 collaborator 3종 반영 여부 검토 (planner) |
| 13 | 보안 | `makeResumeMeta` 내 `stallRounds` 범위 상한 검증 없음 — 현 호출자(`MAX_STALL_ROUNDS=2`)가 방어하지만 향후 다른 호출자 생길 경우 위험 | `assistant-turn-persistence.service.ts` | 방어적 `Math.min` 고려 (필수 아님) |
| 14 | 성능 | `content.trim().slice(0, 40)` 순서 — trim() 이 전체 문자열 스캔 후 slice | `assistant-turn-persistence.service.ts` | 미세 — 의미 차이 주의 |
| 15 | 동시성 | `appendMessage` → `setTitleIfEmpty` 비원자 순서(pre-existing); 장애 시 title 미갱신 가능 | `assistant-turn-persistence.service.ts` | idempotent 설계로 충분 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 취약점 없음; 순수 리팩토링, OWASP Top 10 해당 없음 |
| performance | NONE | 미시적 수준 이슈만(trim 순서, 객체 재사용); 측정 가능한 열화 없음 |
| architecture | LOW | `finishReason: string` 타입 과넓음(WARNING), `usage` 인라인 타입 중복 가능성 |
| requirement | NONE | 기능 요건 완전 충족; SPEC-DRIFT 2건은 spec 갱신 필요(코드 결함 아님) |
| scope | NONE | 선언 범위 정확히 준수; 파일 2개 신규 + 3개 수정만 |
| side_effect | NONE | 의도치 않은 부작용 없음; public API·SSE·DB write 순서 변화 없음 |
| maintainability | LOW | positional 파라미터 과다, makeResumeMeta 결합도, as never 패턴 — 모두 INFO |
| testing | LOW | whitespace content 단언 미명시, thinkingTokens 옵셔널 케이스 미테스트, resumeMeta 기본값 경로 명시 부재 — 모두 INFO |
| documentation | LOW | persistAssistantTurn JSDoc 없음, ResumeMeta 타입 중복, spec collaborator 목록 미확인 |
| concurrency | NONE | 신규 공유 가변 상태·경쟁 조건 없음; pre-existing 비원자 순서 위험도 낮음 |
| api_contract | NONE | HTTP API 계약 변경 없음; breaking change 없음 |

## 라우터 결정

라우터 사용됨 (`routing=done`).

- **실행** (11명): `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `concurrency`, `api_contract`
- **강제 포함(router_safety)** (7명): `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`
- **제외** (3명): `dependency`(신규 외부 의존성 없음), `database`(DB 스키마·마이그레이션 변경 없음), `user_guide_sync`(사용자 대면 기능 변경 없음)

## 권장 조치사항

1. **(WARNING)** `finishReason` 파라미터 타입 — **deliberate defer**: verbatim 이동된 pre-existing 시그니처이며, 최종 persist 호출부가 LLM 스트림의 provider-opaque `finishReason`(임의 string)을 전달하므로 strict union 으로 좁히면 오히려 mistype. 엔티티 컬럼도 `string`. 별건 spec-aligned 타입 정련 위임.
2. **(SPEC-DRIFT)** §10 Rationale 의사코드 위임 경로 갱신 — planner 후속.
3. **(SPEC-DRIFT)** §10 `consecutiveStallRounds > 0` → `totalStallCount > 0` 갱신(코드 revert 금지) — planner 후속.
4. **(INFO 적용)** `ResumeMeta`/`UsageSnapshot` 타입 alias 추출 + `persistAssistantTurn` JSDoc 추가 + 테스트 3건 보완(whitespace appendMessage 단언·thinkingTokens·기본값 경로).
