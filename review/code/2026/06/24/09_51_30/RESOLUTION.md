# RESOLUTION — M-3 3단계 ai-review (review/code/2026/06/24/09_51_30)

대상 커밋: `813a4829` (refactor: M-3 3단계 — AssistantTurnPersistenceService 분리)
위험도: **LOW** · Critical 0 · Warning 1 · INFO 15

## Critical
해당 없음.

## WARNING

### W#1 — `finishReason: string` 파라미터 타입 과넓음 → **deliberate defer (현행 유지)**

- **판정 근거 (코드 전수 확인)**:
  - entity 컬럼 자체가 `finishReason: string | null` (`workflow-assistant-message.entity.ts:150`).
  - persistAssistantTurn 최종 호출부(`workflow-assistant-stream.service.ts`)는 `finishReason = ev.finishReason` 로 **LLM 스트림의 provider 원본** 값을 그대로 전달한다. 스트림 타입은 `'stop' | 'tool_calls' | 'length' | 'content_filter'`(+`'aborted'`) — reviewer 가 제안한 strict union `'stop'|'tool_calls'|'error'|'auto_resume_pending'` 은 `'length'`/`'content_filter'`/`'aborted'` 를 **배제해 오히려 타입 오류**를 만든다.
  - 본 시그니처는 분리 전 `persistAssistantTurn` 에서 **verbatim 이동**한 pre-existing 계약 — M-3 3단계가 도입한 결함 아님.
- **조치**: 타입 narrowing 은 정확성 위험이라 채택하지 않고, 시그니처에 **의도를 명시하는 JSDoc** 추가(provider 원본 + 합성 마커 + entity `string|null` 근거). 별건 spec-aligned 타입 정련은 추후 위임.
- **회귀 방지 테스트 추가**: `passes through provider-opaque finishReason values (e.g. length) unchanged`.

## INFO — 적용

| # | 항목 | 조치 |
|---|------|------|
| 3 | `usage` 인라인 타입 중복 → diverge 위험 | `UsageSnapshot` 인터페이스 export 추출, persistAssistantTurn 시그니처가 참조 |
| 7 | whitespace-only content 에서 `appendMessage` 단언 부재 | 해당 테스트에 `appendMessage(role:user, content 원문)` 단언 추가 |
| 8 | `usage.thinkingTokens` optional 커버리지 없음 | `thinkingTokens: 5` 포함 usage 케이스 추가 |
| 10 | `persistAssistantTurn` 메서드 JSDoc 없음 | `@param resumeMeta` 포함 메서드 JSDoc + finishReason 의도 주석 추가 |
| 11 | `makeResumeMeta` 반환 타입 인라인 리터럴 중복 | `ResumeMeta` 인터페이스 export 추출, 반환·param 타입이 참조 |

## INFO — 적용 불요 / defer (근거)

| # | 항목 | 판정 |
|---|------|------|
| 1, 2, 12 | SPEC-DRIFT (§10 의사코드 위임 경로 / `consecutiveStallRounds`→`totalStallCount` / collaborator 목록) | **planner 위임** — developer 는 spec semantic 미수정. 코드가 더 정확(특히 #2 는 revert 시 stall-then-progress 버그 재도입). M-3 전체 완료 후 일괄 spec-sync 백로그. |
| 4 | positional 파라미터 7개 → options object | **defer** — verbatim 이동 시그니처 보존이 본 단계 원칙. options 화는 호출부 4곳 동시 변경 유발(behavior-preserving 범위 초과). 중기 개선. |
| 5 | `makeResumeMeta` 캡슐화 경계 관통 import | **현행 유지 + 의도 주석 명시** — streamMessage 가 turn-scoped stall 카운터를 소유하므로 메타 derive 가 호출부에 있는 게 1·2단계 무상태 collaborator 패턴과 정합. import 블록에 근거 주석 추가. |
| 6 | 테스트 `as never` 단언 | **defer (선택적)** — 기존 통합 spec 전반의 관행과 일치. mock 형태 변경 위험은 낮고 별건 테스트 하드닝 사안. |
| 9 | resumeMeta 기본값 경로 명시 단언 | **이미 충족** — `appends an assistant row with the default (non-resumed) meta` 가 resumeMeta 인자 생략 호출 후 `autoResumed:false` 단언. |
| 13 | `makeResumeMeta` stallRounds 상한 미검증 | **defer** — 유일 호출자가 `MAX_STALL_ROUNDS=2` 로 방어. 방어적 clamp 는 현 시점 불요(YAGNI). |
| 14 | `trim().slice` 순서 | **무변경** — `slice(0,40).trim()` 은 40자 경계에 걸친 공백 처리에서 **의미가 달라짐**(현행이 의도된 동작). 미세 perf 차이는 제목 derive 1회뿐이라 무의미. |
| 15 | `appendMessage`→`setTitleIfEmpty` 비원자 | **무변경** — pre-existing, idempotent 설계로 충분(setTitleIfEmpty). 트랜잭션 래핑은 과설계. |

## 검증
- lint·build PASS
- 타깃 unit: `assistant-turn-persistence.service.spec.ts` + `workflow-assistant-stream.service.spec.ts` 2 suites / **87 PASS** (+2 신규 케이스: thinkingTokens·length finishReason)
- e2e 214 PASS (resolution 은 타입 alias·JSDoc·주석·테스트만 — 런타임/DI 그래프 무변경)
