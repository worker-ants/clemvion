# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 주요 기능은 정상 동작하나, abort 경로의 streaming 상태 미확정 버그와 planPersisted의 핵심 불변식 테스트 누락이 프로덕션에서 재현 가능한 결함으로 이어질 수 있음

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | **버그 · 요구사항** | **abort 경로에서 stall-recovery 버블 streaming 미확정**: `applyAutoResumeEvent`로 생성된 새 버블(`nextId`)은 abort 시 catch 블록이 `return;`으로 조기 종료하여 안전망 스캔이 실행되지 않고 `streaming: true`로 잔류함 | `assistant-store.ts` catch 블록 abort 분기 | abort 분기 내에서도 `m.streaming → false` 스캔을 포함하거나, 안전망 set 블록으로 통합 처리 |
| 2 | **버그 · 요구사항** | **복구 라운드 중 신규 `propose_plan` 발행 시 plan DB 미저장**: 중간 row persist 후 `planPersisted = true`가 세팅되면, 이후 복구 라운드에서 LLM이 새 plan을 발행해도 최종 persist가 `planPersisted ? null : planForTurn` → `null`을 저장함 | `workflow-assistant-stream.service.ts` stall 복구 블록 | `planPersisted`를 plan ID 기반으로 추적하거나, `planForTurn`이 교체될 경우 플래그를 리셋하는 로직 추가 |
| 3 | **동시성 · 버그** | **`sendMessage` 종료 시 스트리밍 정리 범위 확장으로 인한 경쟁 조건**: `m.id === assistantId` 단건 핀에서 `m.streaming` 전체 스캔으로 변경됨. `await refreshSessions()` 이벤트 루프 양보 구간에서 두 번째 스트림이 시작되면, 첫 번째 cleanup이 진행 중인 두 번째 스트림 버블을 강제 종료할 수 있음 | `assistant-store.ts` `sendMessage` 마지막 `set` 블록 | 해당 턴에서 생성된 ID 집합(`ownedIds`)을 클로저로 유지해 해당 ID들만 finalize |
| 4 | **동시성 · 버그** | **에러 경로에서 `assistantId`(원본)와 `currentAssistantId`(갱신값) 불일치**: stall 복구 1회 이상 후 에러 발생 시 catch 블록이 원본 `assistantId`를 기준으로 `streaming: false`를 설정하나, 원본 버블은 이미 확정되어 no-op이고 새 버블이 streaming 상태로 남음. 이후 안전망이 처리하나 의도와 실제 동작이 어긋남 | `assistant-store.ts` catch 블록 `~line 358` | `currentAssistantId`를 try 바깥에서 선언하거나, catch 내 cleanup도 `m.streaming` 전체 스캔으로 통일 |
| 5 | **테스트 · 유지보수** | **`planPersisted` 로직에 대한 어서션 누락**: 같은 턴에서 plan이 중간 row에만 실리고 이후 row에는 `plan=null`이 되도록 방지하는 핵심 가드이나, 두 persist 테스트에서 `.plan` 필드를 전혀 검증하지 않음 | `workflow-assistant-stream.service.spec.ts` | `expect(persistCalls[0].plan).not.toBeNull()` 및 `expect(persistCalls[1].plan).toBeNull()` 추가 |
| 6 | **테스트** | **`hydrateMessage` rehydrate 경로 미테스트**: `autoResumed=true` 서버 응답을 `hydrateMessage`가 `autoResume` 메타로 변환하는 경로가 테스트되지 않음. SSE 실시간 경로만 커버되고 세션 재로드 시 divider 복원 경로는 검증 불가 | `frontend/src/lib/stores/__tests__/assistant-store.test.ts` | `autoResumed: true, autoResumeAttempt: 1` 입력 시 `autoResume` 메타 변환 및 `max` 폴백 검증 추가 |
| 7 | **테스트** | **에러 경로 `consecutiveStallRounds > 0` 분기 미테스트**: stall 복구 1회 이상 후 에러 발생 시 에러 row에 `autoResumed: true` 메타가 실리는 분기가 미커버 | `workflow-assistant-stream.service.spec.ts` | "stall 1회 후 에러 발생" 시나리오 추가, 에러 row의 `autoResumed=true`, `autoResumeAttempt=1` 검증 |
| 8 | **테스트** | **`pendingToolCalls` 리셋 경계 미검증**: stall 직전 tool call이 있는 시나리오가 테스트에 없어, 중간 row에 tool call 포함·이후 row는 빈 배열인지 검증 불가 | `workflow-assistant-stream.service.spec.ts` | stall 발동 전 tool call이 있는 시나리오 추가, `persistCalls[0].toolCalls` 및 `persistCalls[1].toolCalls` 검증 |
| 9 | **테스트** | **`applyAutoResumeEvent` `currentAssistantId` 미매칭 엣지 케이스 미테스트**: race condition 또는 이벤트 지연 도착 시 동작 미검증 | `assistant-store.ts` `applyAutoResumeEvent` | `messages` 비어있거나 `currentAssistantId` 없는 상태에서 호출 시 동작 검증 추가 |
| 10 | **유지보수 · 정합성** | **`STALL_MAX_ATTEMPTS` 상수 이중 관리**: 백엔드 `MAX_STALL_ROUNDS=2`와 동일한 값을 프론트가 별도 상수로 복제. rehydrate 경로는 이 상수에 의존해 서버 값 변경 시 divider의 "N/M" 표기가 오표시됨 (실시간 스트림 경로는 SSE `max` 필드로 정확함) | `assistant-store.ts:67`, `hydrateMessage` | `autoResumeMax`를 DB 컬럼으로 persist하거나 REST 응답에 포함하여 rehydrate 시 상수 의존 제거 |
| 11 | **유지보수** | **`resumeMeta` literal object 3-중복**: `consecutiveStallRounds > 0 ? { autoResumed: true, ... } : { autoResumed: false, ... }` 삼항 패턴이 서비스 코드 3곳에 그대로 복붙됨 | `workflow-assistant-stream.service.ts:386, 780, 1045` | `makeResumeMeta(stallRounds: number)` 헬퍼로 추출 |
| 12 | **아키텍처** | **`'auto_resume_pending'` 매직 스트링 — 상수 미정의**: DB 마커로 사용되는 `finishReason` 값이 서비스 코드에 리터럴로 직접 삽입되어 오타·rename 시 불일치 발생 | `workflow-assistant-stream.service.ts` stall 복구 블록 | `export const FINISH_REASON_AUTO_RESUME_PENDING = 'auto_resume_pending'` 상수를 entity 또는 shared constants 모듈에 선언 후 참조 |
| 13 | **타입 안전성** | **`autoResumeReason` 타입 캐스트 silent fail**: `msg.autoResumeReason as "stall_pending_steps"`는 런타임 검증 없는 컴파일 타임 캐스트. DB에 예상 외 값 저장 시 타입 시스템이 틀린 보장을 제공하며, 향후 분기 로직 사용 시 문제 발생 | `assistant-store.ts:155/160`, `hydrateMessage` | `const VALID_RESUME_REASONS = ['stall_pending_steps'] as const;` 화이트리스트 검증 후 캐스트 |
| 14 | **동시성 · 데이터 무결성** | **중간 persist 실패 시 text/toolCalls 중복 저장**: 스톨 복구 블록에서 `persistAssistantTurn`이 예외를 throw하면 커서 리셋(`assistantText = ''; pendingToolCalls = []`)이 실행되지 않아 에러 경로 persist에서 중간 row에 이미 포함된 내용이 다시 실릴 수 있음 | `workflow-assistant-stream.service.ts` stall 복구 블록 | 중간 persist 성공 여부를 별도 플래그(`midRowPersisted`)로 구분하거나 `try/finally`로 커서 리셋 보장 |
| 15 | **데이터 무결성** | **중간 row persist 후 연결 실패 시 dangling row**: `finishReason='auto_resume_pending'`인 고아 row가 남아 rehydrate 시 단독 버블로 렌더되고 스트리밍 중 끊김으로 오인될 수 있음 (트랜잭션으로 해결 불가한 구조적 제약) | `workflow-assistant-stream.service.ts` stall 복구 → persist → SSE yield 순서 | rehydrate 시 `finishReason='auto_resume_pending'`인 row가 마지막 row이면 "중단된 세션" 표시 가드 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | SSE `auto_resume` 이벤트의 `attempt`/`max` 범위 검증 없음. 스트림 조작 시 `Infinity`, `NaN` 등이 UI에 표시될 수 있음 | `assistant-store.ts` `applyAutoResumeEvent` 진입부 | `typeof attempt !== 'number' \|\| attempt < 1` 경계 검사 추가 |
| 2 | 타입·API | `autoResumed?: boolean` 옵셔널 선언이지만 DB는 `NOT NULL DEFAULT FALSE`로 항상 존재. 소비자 혼동 소지 | `assistant.ts:33` | `autoResumed: boolean`으로 non-optional 선언 권장 |
| 3 | 타입·API | `finishReason`에 `'auto_resume_pending'` 추가가 entity/DTO에 리터럴 유니온으로 미반영. 타입 시스템에서 계약이 불명확 | `workflow-assistant-message.entity.ts` | `'stop' \| 'tool_calls' \| 'error' \| 'auto_resume_pending' \| null` 유니온 타입 명시 |
| 4 | 문서화 | `finishReason` 필드에 가능한 값 목록 미문서화. `'auto_resume_pending'` 마커 의미를 필드 선언부에서 추론 불가 | `workflow-assistant-message.entity.ts:125` | 필드 주석에 가능한 값 목록 한 줄 추가 |
| 5 | 문서화 | `handleSseEvent`가 `auto_resume`을 처리하지 않는다는 사실이 명시되지 않아, 향후 기여자가 이중 처리 또는 누락을 만들 수 있음 | `assistant-store.ts` `handleSseEvent` | JSDoc에 "`auto_resume`은 처리하지 않음 — `applyAutoResumeEvent` 참조" 명시 |
| 6 | 테스트 | max-stall 테스트에서 `autoResumeReason` 미검증. 향후 reason 추가 시 회귀 포착 지연 | `workflow-assistant-stream.service.spec.ts` "gives up after MAX_STALL_ROUNDS" | `expect(persistCalls[2].autoResumeReason).toBe('stall_pending_steps')` 추가 |
| 7 | 테스트 | `assistant-message.tsx` divider 렌더링 컴포넌트 테스트 부재. i18n 포맷, aria-label 검증 불가 | `assistant-message.tsx` auto-resume divider 블록 | `autoResume` 유/무 두 케이스에 대한 컴포넌트 테스트 추가 |
| 8 | 성능 | `t()` 번역 함수가 `aria-label`과 `<span>` 렌더에서 동일 인자로 이중 호출 | `assistant-message.tsx` auto-resume divider 블록 | 변수에 한 번만 평가하여 재사용 |
| 9 | 데이터 무결성 | `auto_resumed=TRUE` 시 `auto_resume_reason`·`auto_resume_attempt`가 반드시 non-null이어야 한다는 불변식이 DB 레벨에 없음 | `V020__assistant_message_auto_resume.sql` | 선택적으로 `CHECK` 제약 추가 가능 |
| 10 | 스펙 | `auto_resume` SSE 예시가 tool_call 뒤에 배치되어 있으나, 실제 stall은 text-only 후 발행됨 | `spec/3-workflow-editor/4-ai-assistant.md` §5 SSE 예시 | 예시를 tool_call 없는 stall 시나리오로 수정하거나 주석 보강 |
| 11 | 유지보수 | `reason: 'stall_pending_steps'` 리터럴이 백엔드 union 타입·프론트 API 타입·스토어 타입에 분산. 신규 reason 추가 시 3개 파일 동시 수정 필요 | `assistant-store.ts:54`, `assistant.ts:175`, `workflow-assistant-stream.service.ts:145` | 메모리 문서에 "reason 추가 시 수정 파일 목록" 항목으로 관리 |
| 12 | 유지보수 | `...(autoResume ? { autoResume } : {})` 빈 객체 스프레드 패턴이 의도 불명확 | `assistant-store.ts:161` `hydrateMessage` | `...(autoResume && { autoResume })`로 교체 |
| 13 | 아키텍처 | 스트리밍 루프의 mutable 상태 변수가 8개(`assistantText`, `pendingToolCalls`, `planForTurn`, `planPersisted`, `consecutiveStallRounds` 등)로 증가. 암묵적 상태 기계로 발전 중 | `workflow-assistant-stream.service.ts:325–350` | 단기: 관련 변수를 객체(`turnState`)로 묶어 리셋 로직 캡슐화 |
| 14 | 데이터 | 완전히 빈 intermediate row 생성 가능성 (`assistantText=''`, `pendingToolCalls=[]`인 채로 persist) | `workflow-assistant-stream.service.ts` stall 복구 블록 | persist 전 `assistantText.trim() \|\| pendingToolCalls.length > 0` 가드 추가 검토 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Requirement | **MEDIUM** | abort 경로 streaming 미확정 버그, 복구 중 신규 plan 유실 edge case |
| Testing | **MEDIUM** | planPersisted·hydrateMessage·에러 경로 등 핵심 불변식 미테스트 |
| Architecture | **LOW** | `auto_resume_pending` 매직 스트링 미정의, 루프 상태 변수 누적 |
| Concurrency | **LOW** | streaming 정리 범위 확장으로 인한 경쟁 조건, 중간 persist 실패 시 텍스트 중복 |
| Side Effect | **LOW** | STALL_MAX_ATTEMPTS 동기화 미보장, streaming 일괄 정리 범위 확장 |
| API Contract | **LOW** | STALL_MAX_ATTEMPTS 하드코딩, autoResumeReason silent type cast, 에러 경로 ID 불일치 |
| Maintainability | **LOW** | resumeMeta 3-중복, 상수 이중 관리, reason 리터럴 분산 |
| Database | **LOW** | 고아 row 발생 가능성, auto_resumed 3-필드 co-presence 제약 없음 |
| Security | **LOW** | SSE 페이로드 범위 검증 없음, autoResumeReason 타입 캐스트 |
| Documentation | **LOW** | finishReason 가능 값 미문서화, STALL_MAX_ATTEMPTS 이중 소스 미설명 |
| Performance | **LOW** | t() 이중 호출, resumeMeta 인라인 중복 |
| Dependency | **LOW** | STALL_MAX_ATTEMPTS 수동 동기화 의존, SSE 스키마 이중 선언 |
| Scope | **NONE** | 기능 범위 내 변경으로 문제 없음 |

---

## 발견 없는 에이전트

- **Scope** — 12개 파일 전체가 단일 기능 범위에 집중되어 있으며 범위 이탈 없음

---

## 권장 조치사항

1. **[즉시] abort 경로 streaming 미확정 버그 수정** — `assistant-store.ts` catch 블록 abort 분기에서 stall-recovery 버블의 `streaming: true` 잔류 해소 (W-1)
2. **[즉시] `sendMessage` cleanup 경쟁 조건 해소** — `m.streaming` 전체 스캔을 현재 턴의 `ownedIds` 집합으로 스코프 제한 (W-3)
3. **[단기] 핵심 테스트 추가** — `planPersisted` plan 분리 어서션(W-5), `hydrateMessage` rehydrate 경로(W-6), 에러 경로 `consecutiveStallRounds > 0`(W-7), `pendingToolCalls` 리셋 경계(W-8) 4개 케이스 추가
4. **[단기] `resumeMeta` 헬퍼 함수 추출** — 서비스 코드 3곳의 literal object 중복 제거 (W-11)
5. **[단기] `'auto_resume_pending'` 상수 선언** — 매직 스트링을 entity 또는 shared constants 모듈에 정의 (W-12)
6. **[단기] `autoResumeReason` 런타임 검증** — 화이트리스트 기반 캐스트로 silent fail 방지 (W-13)
7. **[중기] rehydrate 경로의 `STALL_MAX_ATTEMPTS` 의존 제거** — `autoResumeMax`를 DB 컬럼으로 persist하거나 REST 응답에 포함하여 상수 이중 관리 해소 (W-10)
8. **[중기] `finishReason` 리터럴 유니온 타입 명시** — entity/DTO에 가능한 값 전체를 타입으로 선언 (I-3)
9. **[중기] stall 복구 중 신규 plan 발행 시나리오 방어** — `planPersisted` 플래그를 plan ID 기반으로 추적하여 복구 라운드 신규 plan 유실 방지 (W-2)
10. **[장기] 스트리밍 루프 상태 변수 캡슐화** — `turnState` 객체로 묶어 암묵적 상태 기계를 명시적으로 관리 (I-13)