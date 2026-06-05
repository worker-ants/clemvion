# Code Review 통합 보고서

**대상 커밋**: b8f2f18 — feat(execution-engine): PR-A1 conversationThread durable park 영속 + rehydration 무손실 복원
**리뷰 일시**: 2026-06-05
**리뷰어**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync

---

## 전체 위험도

**LOW** — 기능 정확성·원자성·보안 인젝션 위험은 없으며, 경미한 입력 검증 보강과 테스트 코드 리팩터링이 권장됨

---

## Critical 발견사항

_없음_

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Validation | JSONB 역직렬화 시 `ConversationTurn` 개별 요소(`seq`, `source`, `text` 길이 등)에 대한 타입·범위 검증 없이 `as ConversationTurn[]` 캐스트 후 사용 — 손상된 DB row 가 AI 프롬프트 구성에 오염 데이터 전달 가능 | `conversation-thread.types.ts` `rehydrateConversationThread` (~L1002) | turn 단위 최소 검증(seq 범위, source enum, text 상한) 추가; 손상 turn은 skip 또는 전체 리셋 |
| 2 | Security / Validation | `runningSummary` 복원 시 길이 상한 없음 — 비정상적으로 큰 값이 AI 프롬프트에 삽입되어 DoS성 토큰 과소비 또는 프롬프트 인젝션 위험 | `conversation-thread.types.ts` `rehydrateConversationThread` (~L1020-1022) | `MAX_SUMMARY_CHARS` 또는 합리적 상수로 복원 시 trim/경고 로그 후 빈 summary 폴백 |
| 3 | Maintainability | 동일한 3-라인 park 주석 블록(`§7.5 rehydration 복원원`)이 3개 park 지점에 복사되어 오타(`복원원`)도 3곳 동일하게 반복됨 | `execution-engine.service.ts` L3419-3421, L4954-4956, L5931-5933 | `복원원` → `복원처` 또는 `복원 출처`로 3곳 일괄 수정 |
| 4 | Maintainability | 테스트에서 private API 접근을 위한 이중 `unknown` 캐스팅이 다양한 형태로 반복됨 — 메서드 시그니처 변경 시 런타임에야 실패 가능 | `execution-engine.service.spec.ts` L342-343, 451, 454-458 | describe 블록 상단에 단일 타입 별칭(`type TestedPrivates = { stageConversationThreadSnapshot: ... }`) 정의 후 일원화 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `conversationThread` 옵션이 caller 신뢰에 의존 — 인터페이스 레벨에서 임의 thread 주입 가능, 향후 실수로 외부 유래 thread 주입 위험 | `execution-context.service.ts` `CreateContextOptions` | `@internal` 주석 추가 또는 rehydration 전용 팩토리 메서드 분리 고려 |
| 2 | Security | `stageConversationThreadSnapshot` 에서 `cloneThread` 실패 시 에러 전파 보장이 주석 수준 명시 없음 | `execution-engine.service.ts` `stageConversationThreadSnapshot` | "예외 시 상위 전파 → park 트랜잭션 차단" 동작 보장 주석 추가 또는 명시적 try-catch |
| 3 | Security / API | `Execution.conversationThread` 컬럼이 REST API 응답 DTO에 노출되지 않음 확인됨 — 의도적 제외임을 entity 주석에 명시 권장 | `execution.entity.ts`, `execution-response.dto.ts` | entity 필드 주석에 "API 응답 DTO 미포함 — 내부 rehydration 전용" 한 줄 추가 |
| 4 | Architecture | `conversation-thread.types.ts`에 타입+팩토리+정규화 로직이 혼재 — SRP 경계 모호화 | `conversation-thread.types.ts` | 현 규모에서는 허용; 향후 `conversation-thread.normalizer.ts` 분리 고려 |
| 5 | Architecture | `stageConversationThreadSnapshot → updateExecutionStatus` 2-line 패턴이 3곳 반복, 불변식이 코드 수준에서 강제되지 않음 | `execution-engine.service.ts` 각 park 지점 | 향후 park 지점 추가 시 `parkWithThread` 합성 메서드 고려 |
| 6 | Architecture | `ExecutionEngineService` 책임 집중 심화 — park/resume 로직 누적 중 | `execution-engine.service.ts` | Phase B 이후 `ParkResumeService` 분리 리팩터링 검토 |
| 7 | Requirement | `cloneThread` shallow-clone — turn 불변 계약 전제; 미래 turn mutation 경로 추가 시 스냅샷 오염 가능 | `thread-renderer.ts:14-16`, `execution-engine.service.ts:8424` | 현재 수정 불필요; turn mutation 추가 시 deep-clone 교체 또는 mutation 금지 가드 추가 |
| 8 | Requirement | retry re-entry + in-memory context 공존 시 `rehydrateContext` early-return 동작(DB 스냅샷 무시)에 대한 테스트/주석 없음 | `execution-engine.service.ts:1182-1183` | 의도 명확화 주석 추가 또는 향후 테스트 보강 |
| 9 | Testing | `rehydrateConversationThread` — turns 내 개별 아이템 손상(text null/undefined) 케이스 테스트 부재 | `conversation-thread.types.spec.ts` | `turns: [{ seq: 0, text: null }, { seq: 1 }]` 케이스 추가해 `totalChars` 0 검증 |
| 10 | Testing | `rehydrateContext` early-return 경로(기존 in-memory context 유지) 명시적 단언 없음 | `execution-engine.service.spec.ts` | deleteContext 없이 rehydrateContext 호출 시 기존 thread 유지 케이스 추가 |
| 11 | Testing | 3개 park 지점에서 `stageConversationThreadSnapshot → updateExecutionStatus` 순서 통합 검증 없음 | `execution-engine.service.spec.ts` | park 시나리오별로 `updateExecutionStatus` 호출 시점에 스냅샷 스테이징 완료 여부 단언 추가 |
| 12 | Testing | 마이그레이션 V083 — `ADD COLUMN` idempotency(`IF NOT EXISTS`) 검증 없음 | `V083__execution_conversation_thread.sql` | CI migration-guard 통과 확인; 없다면 `IF NOT EXISTS` 조건 추가 고려 |
| 13 | Documentation | `rehydrateConversationThread` TSDoc에 eviction-aware nextSeq 보존 vs 손상 재유도 핵심 invariant 누락 | `conversation-thread.types.ts` TSDoc | "eviction 후 `nextSeq > turns.length`이면 저장값 보존; 미만(손상)이면 재유도" 명시 |
| 14 | Documentation | `stageConversationThreadSnapshot` TSDoc 블록이 바로 위 메서드 주석과 빈 줄 없이 연속 배치 — 시각적 오해 가능 | `execution-engine.service.ts` L600-614 | 두 TSDoc 블록 사이 빈 줄 삽입 |
| 15 | Documentation | spec `4-execution-engine.md` 다이어그램 내 "thread 는 위 컬럼이 복원원" 표현 어색 | `spec/5-system/4-execution-engine.md` 다이어그램 | "thread 는 위 컬럼에서 복원됨" 으로 수정 |
| 16 | Side Effect | `stageConversationThreadSnapshot` in-place Execution 객체 변이 패턴 — 향후 park 경로 추가 시 `updateExecutionStatus` 쌍 호출 누락 위험 | `execution-engine.service.ts` `stageConversationThreadSnapshot` | JSDoc에 `@seeAlso updateExecutionStatus` 또는 "반드시 쌍으로 호출" 명시 |
| 17 | User Guide | 실행 재개 시 conversationThread 보존 내용이 `05-run-and-debug/` docs에 미반영 — 기존 docs가 틀린 것은 아님 | `codebase/frontend/src/content/docs/05-run-and-debug/` | 선택적: `run-results.mdx`에 "서버 재시작 후 form/button 대기 실행의 대화 맥락 보존" 한 줄 추가 (강제 아님) |
| 18 | SPEC-DRIFT | [SPEC-DRIFT] spec §7.5 "채워지지 않는 항목" 절의 stale conversationThread 관련 문구 잔존 여부 확인 — 코드에서는 이미 제거됨, spec 측 대응 절 확인 필요 | `spec/5-system/4-execution-engine.md §7.5` | spec §7.5에서 "conversationThread — 본 phase 에서는 빈 thread 로 시작" 문구 잔존 여부 확인 후 제거 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | ConversationTurn 개별 필드 검증 미흡(WARNING), runningSummary 크기 상한 없음(WARNING) |
| architecture | LOW | rehydrateConversationThread 위치 SRP 모호, stageConversationThreadSnapshot 암묵적 호출 계약, ExecutionEngineService 책임 집중 (모두 INFO) |
| requirement | LOW | cloneThread shallow-clone 전제, rehydrateContext early-return 주석 누락 (모두 INFO) |
| scope | NONE | 주석 typo 1건(INFO); 범위 벗어난 변경 없음 |
| side_effect | LOW | conversationThread DTO 노출 확인 권장(INFO), stage+commit 패턴 암묵적 의존(INFO) |
| maintainability | LOW | park 주석 오타 3곳 복제(WARNING), 테스트 이중 캐스팅 반복(WARNING) |
| testing | LOW | turns 개별 손상 케이스 누락, early-return 분기 미단언, 3 park 지점 통합 snapshot 검증 없음 (모두 INFO) |
| documentation | NONE | TSDoc 보완 사항 다수(INFO); CHANGELOG 정책 확인 권장 |
| database | NONE | 마이그레이션 안전성 양호; 트랜잭션 원자성 보장; 인덱스·SQL 인젝션 문제 없음 |
| concurrency | NONE | Node.js 단일 이벤트루프 특성상 경쟁 없음; cloneThread 참조 오염 방지 확인 |
| api_contract | NONE | 공개 API 응답 DTO 변경 없음; breaking change 없음 |
| user_guide_sync | NONE | 18개 trigger 중 매칭 없음; run-debug 흐름 1건 회색지대(INFO) |

---

## 발견 없는 에이전트

- **database**: Critical/Warning 없음 — 마이그레이션 안전성, 트랜잭션 원자성, SQL 인젝션 위험 없음
- **concurrency**: Critical/Warning 없음 — 동시성 위험 없음, 순수 동기 함수 확인
- **api_contract**: Critical/Warning 없음 — 공개 API 계약 변경 없음
- **user_guide_sync**: Critical/Warning 없음 — 사용자 가이드 강제 갱신 트리거 없음
- **scope**: Critical/Warning 없음 — 범위 내 변경만 확인

---

## 권장 조치사항

1. **(WARNING 우선)** `rehydrateConversationThread`에서 `ConversationTurn` 개별 필드 최소 검증 추가 (`seq` 범위, `source` enum, `text` 길이 상한) — 손상 row로부터 AI 프롬프트 오염 방지
2. **(WARNING 우선)** `runningSummary` 복원 시 `MAX_SUMMARY_CHARS` 상한 적용 — DoS성 토큰 과소비 방지
3. **(WARNING)** `execution-engine.service.ts` 3개 park 지점 주석 오타(`복원원`) 일괄 수정
4. **(WARNING)** `execution-engine.service.spec.ts` private API 이중 캐스팅을 단일 타입 별칭으로 일원화
5. **(INFO — 권장)** `Execution.conversationThread` entity 필드 주석에 "API 응답 DTO 미포함 — 내부 rehydration 전용" 명시
6. **(INFO — 권장)** `rehydrateConversationThread` TSDoc에 eviction-aware nextSeq invariant 설명 추가
7. **(INFO — 선택)** spec `4-execution-engine.md` 다이어그램 "복원원" 표현 교정
8. **(INFO — 선택)** `05-run-and-debug/run-results.mdx`에 conversationThread 보존 한 줄 추가 (후속 작업 가능)
9. **(SPEC-DRIFT — 확인)** spec §7.5 "채워지지 않는 항목" 절의 stale conversationThread 관련 문구 잔존 여부 확인 후 제거

---

## 라우터 결정

- **실행** (12명): security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync
- **제외** (2명):

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 선별 제외 |
  | dependency | router 선별 제외 |

- **강제 포함(router_safety)** (8명): database, documentation, maintainability, requirement, scope, security, side_effect, testing