# Code Review 통합 보고서

리뷰 대상: PR-A3 — user-defined variables durable park 영속 + rehydration 복원
커밋: `18fc07f7b2ec5afea3d0635f396e0b088b3c47e7`
리뷰 일시: 2026-06-05

---

## 전체 위험도

**LOW** — Critical 발견사항 없음. 3건의 WARNING(테스트 커버리지 갭)이 존재하나 기능 정확성 위험은 낮음. 보안·데이터베이스·범위·부작용·요구사항·문서화 모두 NONE 또는 INFO 수준.

---

## Critical 발견사항

_없음_

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | park 통합 경로에서 `userVariables` 가 DB save 인자에 포함되는지 assert 없음 — `stageDurableResumeSnapshot` 단위 테스트는 private 메서드 직접 호출이라 실제 park 흐름(form/button/AI) → `updateExecutionStatus` 트랜잭션 경로를 커버하지 못함 | `execution-engine.service.spec.ts` L3049, L3582, L3761 기존 park 통합 테스트 | form park 통합 테스트 중 한 곳에 `mockExecutionRepo.save` 호출 시 `userVariables` 필드 포함 여부 검증 assertion 추가. 예: `expect(saveCalls).toEqual(expect.arrayContaining([expect.objectContaining({ userVariables: expect.any(Object) })]))` |
| 2 | Testing | rehydration 통합 시나리오(Phase 2.7)에서 `userVariables` 미설정 — park 이전 변수가 resume 후 downstream 노드에 올바르게 전달되는지 end-to-end 검증 없음 | `execution-engine.service.spec.ts` L3275 "Phase 2.7 — rehydration" 통합 테스트, mock Execution 의 `userVariables` 미포함 | Phase 2.7 통합 테스트 mock Execution 에 `userVariables: { counter: 5 }` 설정 후 resume 시 downstream 노드 핸들러가 `context.variables.counter === 5` 를 수신하는지 검증하는 variant 추가 |
| 3 | Testing | `stageDurableResumeSnapshot` 테스트에 배열 값(`tags: ['a','b']`)·null 값(`active: null`)이 있는 `context.variables` 케이스 미포함 — `Object.entries` 기반 shallow copy 의 mutability 동작 미검증 | `execution-engine.service.spec.ts` L9149 `stageDurableResumeSnapshot` 테스트 | `{ tags: ['a', 'b'], score: null }` 케이스 추가 + 원본 배열과 레퍼런스 독립 여부(또는 의도적 shallow임을 문서화) 확인 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | JSONB 컬럼에 사용자 정의 변수 크기 상한 없음 — 거대 변수 셋 반복 park 시 DB 행 크기 무제한 증가 가능 | `V085__execution_user_variables.sql` L79, `execution-engine.service.ts` `stageDurableResumeSnapshot` | park 시 `context.variables` 키 수 및/또는 직렬화 바이트 수에 상한 추가(앱 레이어 가드 또는 PostgreSQL CHECK 제약) |
| 2 | Security | `userVariables` 컬럼이 API 응답 DTO 에서 배제됨을 주석만으로 표명 — 실제 배제 여부 미검증 | `execution.entity.ts` L460–461 주석, `ExecutionResponseDto` | `ExecutionResponseDto` 및 관련 직렬화 경로에서 `userVariables` 가 `@Exclude()` 또는 명시적 생략으로 실제 배제됨을 확인 |
| 3 | Security | `__` prefix 변수명 생성 방지 입력 검증 미확인 — 사용자가 `__custom_var` 형태 변수를 선언하면 park 시 해당 변수가 제외되어 데이터 손실 | `execution-engine.service.ts` L380, L395 `__` prefix 필터 | Variable Declaration/Modification 노드에서 `__` prefix 변수명 거부 가드 존재 여부 확인; 없다면 추가 |
| 4 | Maintainability | `stageDurableResumeSnapshot` 과 `rehydrateUserVariables` 가 `__` prefix 필터 로직을 독립 구현 — 필터 기준 변경 시 두 곳 동시 수정 필요 | `execution-engine.service.ts` `stageDurableResumeSnapshot` (lines 378–382) 및 `rehydrateUserVariables` (lines 392–397) | `filterUserVariables(vars: Record<string, unknown>): Record<string, unknown>` private 헬퍼 추출 후 두 메서드가 공유 |
| 5 | Maintainability | `rehydrateUserVariables` 의 방어 가드에 `Array.isArray` 체크 없음 — 배열 입력 시 숫자 인덱스 키가 사용자 변수로 복원될 가능성 | `execution-engine.service.ts` `rehydrateUserVariables` L394 | `if (!raw \|\| typeof raw !== 'object' \|\| Array.isArray(raw)) return {};` 로 강화 |
| 6 | Maintainability | 테스트 파일의 이중 타입 단언(`as unknown` 후 재단언) | `execution-engine.service.spec.ts` `stageDurableResumeSnapshot` 테스트 블록 L222–248 | 처음부터 명시적 타입으로 선언하거나 단일 단언으로 통합 |
| 7 | Maintainability | `stageDurableResumeSnapshot` 이 두 필드(`conversationThread`, `userVariables`) 동시 변경 — 향후 세 번째 필드 추가 시 함수 비대화 위험 | `execution-engine.service.ts` `stageDurableResumeSnapshot` | 현재 규모에서는 허용 가능. 세 번째 필드 추가 시점에 각 필드 스냅샷을 개별 private 메서드로 분리 또는 `DurableResumeSnapshot` 빌더 패턴 고려 |
| 8 | Testing | `stageDurableResumeSnapshot` 테스트에 시스템 변수만 있는 케이스(빈 사용자 변수) 미포함 — `userVariables === {}` 검증 없음 | `execution-engine.service.spec.ts` L9149 | 시스템 변수만 있는 케이스 추가 및 `userVariables` 가 빈 객체임을 검증 |
| 9 | Testing | `rehydrateContext` fast-path(context 캐시 히트)에서 user variables 별도 적용 안 됨을 검증하는 테스트 없음 | `execution-engine.service.spec.ts` 추가 테스트 블록 | 설계 의도(fast-path 는 기존 context 반환)를 명시하는 주석으로 대체 가능 |
| 10 | Side-Effect | `rehydrateContext` 의 `initialVariables` spread 순서에 암묵적 제약 — 향후 시스템 변수 추가 시 잘못된 위치 배치로 override 실패 가능 | `execution-engine.service.ts` `rehydrateContext` L~1254 | "user vars 먼저, 시스템 `__*` 나중" 순서를 강제하는 주석 추가 또는 별도 헬퍼 함수로 분리 |
| 11 | Side-Effect | 향후 4번째 park 지점 추가 시 `stageDurableResumeSnapshot` 호출 누락으로 부분적 park 상태 위험 | 현재 3개 호출 지점(L~3502, ~5112, ~6089) | JSDoc 에 "호출 후 즉시 `updateExecutionStatus` 와 쌍으로 사용" 및 "모든 park 진입점 필수 호출" 명시 |
| 12 | Documentation | `rehydrateContext` 함수 JSDoc 에 반환 shape 변화(`variables` 필드 추가) 미반영 | `execution-engine.service.ts` `rehydrateContext` 함수 JSDoc | 기존 JSDoc 에 "반환 컨텍스트의 `variables` 에 `user_variables` 스냅샷이 merge 됨" 한 줄 추가 |
| 13 | Documentation | `stageDurableResumeSnapshot` JSDoc 에 3개 호출 지점 언급 없음 | `execution-engine.service.ts` `stageDurableResumeSnapshot` JSDoc | `@remarks 호출처: 3개 park 진입 지점 모두에서 updateExecutionStatus 직전 호출` 한 줄 추가 |
| 14 | Requirement | `rehydrateUserVariables` 에 Array 입력(`[]`) 방어 없음 — `typeof [] === 'object'` 로 통과 시 인덱스 키 유출 가능 (운영 위험 낮음) | `execution-engine.service.ts` L8625–8630 | `Array.isArray(raw)` 체크 추가해 배열을 명시적으로 `{}` 로 분기 |
| 15 | Database | JSONB 컬럼 크기 상한 없음 — 대형 변수 셋 TOAST 처리 이후에도 성능 영향 가능 (현재 NONE 수준) | `stageDurableResumeSnapshot`, `rehydrateUserVariables` | 운영 중 `user_variables` 크기 이슈 발생 시 저장 전 size-cap 검사 추가 고려 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | JSONB 크기 상한 없음, DTO 배제 미검증, `__` prefix 변수명 생성 방지 미확인 (모두 INFO) |
| requirement | NONE | spec §6.1/§6.2/§7.5, §2.13 완전 일치. 구현·spec 불일치 없음 |
| scope | NONE | 선언된 범위 정확히 이행. 무관 변경·불필요 리팩터링 없음 |
| side_effect | NONE | 공개 API 변경 없음. nullable 마이그레이션 무회귀. 부작용 의도된 범위 내 |
| maintainability | LOW | `__` 필터 로직 중복, Array guard 누락, 이중 타입 단언 (모두 INFO) |
| testing | LOW | park 통합 경로 DB save assert 없음(WARNING), rehydration e2e 경로 미커버(WARNING), 배열/null 값 케이스 미테스트(WARNING) |
| documentation | NONE | 문서화 전반 우수. JSDoc 보완 사항 3건 (모두 선택적 INFO) |
| database | NONE | nullable ADD COLUMN 무중단 배포 안전. 트랜잭션 원자성 보장. SQL 인젝션 없음 |

---

## 발견 없는 에이전트

없음 (전체 8개 에이전트 모두 발견사항 보고).

---

## 권장 조치사항

1. **[Testing / WARNING-1]** form/button/AI park 통합 테스트 중 한 곳에 `mockExecutionRepo.save` 호출 시 `userVariables` 필드 포함 assertion 추가 — "변수가 실제로 DB에 영속되는가"를 통합 레벨에서 검증.
2. **[Testing / WARNING-2]** Phase 2.7 rehydration 통합 테스트의 mock Execution 에 `userVariables: { counter: 5 }` 설정 후 resume 시 downstream 노드가 해당 값을 수신하는지 검증 — 변수 복원 end-to-end 경로 커버.
3. **[Testing / WARNING-3]** `stageDurableResumeSnapshot` 또는 `rehydrateUserVariables` 테스트에 `{ tags: ['a', 'b'], score: null }` 케이스 추가 — shallow copy 동작 및 mutability 의도 명시.
4. **[Maintainability / INFO-4]** `filterUserVariables` private 헬퍼 추출해 `stageDurableResumeSnapshot` 과 `rehydrateUserVariables` 공유 — `__` 필터 로직 단일 출처 관리.
5. **[Maintainability / INFO-5]** `rehydrateUserVariables` 방어 가드에 `Array.isArray(raw)` 체크 추가 — `if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};`.
6. **[Security / INFO-3]** Variable Declaration/Modification 노드에서 `__` prefix 변수명 거부 가드 존재 여부 확인; 없다면 추가.
7. **[Security / INFO-2]** `ExecutionResponseDto` 및 관련 직렬화 경로에서 `userVariables` 실제 배제 확인 (`@Exclude()` 또는 명시적 매핑 생략).
8. **[Security / INFO-1]** park 시 `context.variables` 키 수 및/또는 직렬화 바이트 수에 상한 설정(앱 레이어 가드 또는 PostgreSQL CHECK 제약) 검토.

---

## 라우터 결정

라우터가 선별(`routing_status=done`):

- **실행** (강제 포함 8명): `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `database`
- **강제 포함(router_safety)**: 위 8개 전원 — `database`, `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | router 제외 |
| architecture | router 제외 |
| dependency | router 제외 |
| concurrency | router 제외 |
| api_contract | router 제외 |
| user_guide_sync | router 제외 |