# Code Review 통합 보고서

## 전체 위험도
**LOW** — 순수 리팩터링(동작 보존 추출)으로 Critical 발견사항 없음. Warning 7건은 테스트 커버리지 갭·문서 누락·아키텍처 결합도 경고·spec 드리프트로 차단 수준 아님.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `dispatchResumeTurn` + `resumeTurnRegistry` 도입으로 spec §7.5 다이어그램(driveResumeAwaited/driveResumeFrame 직접 분기 서술)이 낡아짐. 코드가 올바르고 spec 서술이 구버전 | `spec/5-system/4-execution-engine.md §7.5` rehydration 다이어그램 | 코드 유지. spec §7.5 다이어그램에 `dispatchResumeTurn`(registry 위임) 주석 추가 및 직접 분기 서술 갱신 |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] `ResumeTurnSelector.blockingInteraction` 필드(form 노드를 handler metadata kind=blocking, interaction=form 으로 식별)가 spec §7.5/§5.5 에 미등장 | `resume-turn-dispatch.ts` `ResumeTurnSelector` 인터페이스 | 코드 유지. spec §7.5 또는 §5.5 에 "form 노드는 handler metadata kind=blocking, interaction=form 으로 식별" 설명 추가 |
| 3 | Testing | `handleAiResumeTurn` 추출 메서드의 독립 단위 테스트 없음. `dispatchResumeTurn` 테스트의 ai 케이스 3개 모두 `handleAiResumeTurn`을 spy 대체하고 있어, 내부 로직(`buildRetryReentryState` 실패 시 `RESUME_INCOMPATIBLE_STATE` throw, `contextService.setNodeOutput` 호출)이 어떤 테스트도 직접 통과하지 않음 | `execution-engine.service.ts` `handleAiResumeTurn` (diff L1093~1132), `execution-engine.service.spec.ts` | describe 블록 추가: (1) `buildRetryReentryState` throw → `RESUME_INCOMPATIBLE_STATE` 전파, (2) 정상 경로 `setNodeOutput` 호출 + `processAiResumeTurn` 결과 전달 |
| 4 | Testing | `resumeTurnRegistry` lazy init의 `afterEach` 리셋 부재. `jest.restoreAllMocks()`가 spy는 복원하지만 `_resumeTurnRegistry` 캐시는 유지되어 향후 registry 항목 추가·순서 테스트 시 상태 누수 위험 | `execution-engine.service.spec.ts` `dispatchResumeTurn` describe 블록 `afterEach` | `afterEach`에 `(service as any)._resumeTurnRegistry = undefined;` 추가해 각 테스트마다 registry 강제 재구성 |
| 5 | Documentation | `dispatchResumeTurn` private 메서드 JSDoc에 `@throws` 태그 누락. 매칭 처리기 없을 때 `RehydrationError('RESUME_CHECKPOINT_MISSING')`, AI handler 재구성 실패 시 `RehydrationError('RESUME_INCOMPATIBLE_STATE')` 두 에러가 호출측 에러 처리 설계에서 중요한 계약 | `execution-engine.service.ts` `dispatchResumeTurn` JSDoc | `@throws {RehydrationError} code='RESUME_CHECKPOINT_MISSING'` 및 `@throws {RehydrationError} code='RESUME_INCOMPATIBLE_STATE'` 태그 추가 |
| 6 | Architecture | `resumeTurnRegistry` getter 내 ai_conversation 항목의 `selects` 클로저가 `this.isCheckpointEligibleNodeType`을 직접 캡처해 registry 항목이 서비스 인스턴스에 묵시적으로 결합됨. 현재 `private`으로 제어되나 인터페이스 독립성 부분 훼손 | `execution-engine.service.ts` `resumeTurnRegistry` getter, ai_conversation 항목 `selects` 함수 | `isCheckpointEligibleNodeType`을 selector 빌드 시 미리 평가해 `hasCheckpointEligibleType: boolean`으로 selector에 포함, 또는 JSDoc에 주의사항 명시 |
| 7 | Security | plan 문서(`exec-park-b2a-followup.md`)에 `InteractionTokenService` fallback 리터럴 제거 및 production fail-closed 가드 추가가 "완료"로 기록. 실제 코드 반영 여부 별도 확인 권장 | `plan/complete/exec-park-b2a-followup.md` §②, `exec-park-polish.md B2` | `InteractionTokenService`의 production fail-closed 가드 구현이 코드에 반영됐는지 확인 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | `PARK_RELEASED`/`ParkSignal`/`ProcessTurnResult` shared 레이어 이관 — 긍정적 변경. 단일 진실 원칙 준수 | `shared/execution-resume/process-turn-result.ts` (신규) | 없음 |
| 2 | Architecture | `ResumeTurnDispatch`/`ResumeTurnSelector`/`ResumeTurnContext` 인터페이스 분리로 OCP·ISP 개선. 신규 blocking 타입 추가 시 registry 항목 1개 추가로 충분 | `resume-turn-dispatch.ts` | 없음 |
| 3 | Architecture | `payload: unknown` 타입 — 현 규모에서 수용 가능. 향후 discriminated union 또는 generic `ResumeTurnContext<P>` 타입화 고려 여지 | `resume-turn-dispatch.ts` `ResumeTurnContext.payload` | 즉각 수정 불필요. 확장 시 union 고려 |
| 4 | Architecture | 순환 의존성 없음. `shared/` → `modules/` 방향 import 없어 단방향 의존성 유지 | 전체 변경 파일 | 없음 |
| 5 | Requirement | `ai_form_render` interaction type이 `ai_conversation` 분기(`handleAiResumeTurn`)로 흡수됨. 의도된 설계인지 spec에 명시 없으나 동작 회귀 없음 | `resumeTurnRegistry` getter, `ResumeTurnContext.isAiConversation` 주석 | 명시적 분기 또는 주석으로 의도 확인 |
| 6 | Requirement | `PARK_RELEASED` Symbol 이관 후 모듈 캐시 단위 싱글톤 동일성 보장 확인 완료 | `process-turn-result.ts`, `execution-engine.service.ts` | CI에서 `grep "Symbol('park_released')" execution-engine.service.ts` 가 0건임 확인 권장 |
| 7 | Maintainability | 테스트에서 `svc`를 `service as unknown as DispatchSubject`로 7개 it 블록에서 반복 캐스팅 | `execution-engine.service.spec.ts` it 블록들 | describe 상단에 `let svc: DispatchSubject` 선언 후 `beforeEach`에서 한 번 캐스팅 할당 |
| 8 | Maintainability | `_resumeTurnRegistry` backing field 접두사 `_`가 파일 내 영속 체크포인트 필드와 혼동 가능 | `execution-engine.service.ts` private `_resumeTurnRegistry` | 다른 접두사 사용 또는 주석으로 역할 구분 |
| 9 | Maintainability | `ResumeTurnContext.nodeExec` 필드가 `| null` 사용, 다른 optional 필드는 `| undefined` — null vs undefined 혼재 | `resume-turn-dispatch.ts` `readonly nodeExec: NodeExecution \| null` | 주석("중첩 frame 진입 시 미상이면 null")이 의도 명확히 설명. 프로젝트 컨벤션 확인 후 수용 |
| 10 | Maintainability | `ParkSignal` 타입 export가 외부에서 직접 필요한지 불명확. 불필요 export는 API surface 확대 | `process-turn-result.ts` `export type ParkSignal` | 사용처 확인 후 내부 only면 export 제거 고려 |
| 11 | Security | `RehydrationError` 에러 메시지에 `node.type`, `persistedInteractionType`, 내부 오류 메시지 포함. 추출 전 코드와 동일 수준 — 신규 위험 아님 | `execution-engine.service.ts` `dispatchResumeTurn()`, `handleAiResumeTurn()` | upstream 핸들러에서 외부 응답 시 내부 메시지 제거 여부 확인 |
| 12 | Security | `persistedInteractionType`이 DB에서 오는 신뢰 경계 값으로 dispatch 분기 결정. 기존 설계 특성이며 신규 악화 없음 | `ResumeTurnSelector.persistedInteractionType` | 허용 값 집합을 리터럴 유니온 타입으로 강제하면 컴파일 타임 가드 추가 가능 |
| 13 | Documentation | `process-turn-result.ts`와 `park-release-signal.ts` 간 역방향 참조 없어 `park-release-signal.ts` 먼저 읽는 독자가 맥락 놓칠 수 있음 | `codebase/backend/src/shared/execution-resume/park-release-signal.ts` | "return 기반 park sentinel은 `process-turn-result.ts` 참조" 한 줄 역방향 참조 추가 |
| 14 | Documentation | `plan/complete/exec-park-b2a-followup.md` 의 "후속(비차단)" 항목에 `exec-park-polish.md` 명시적 참조 없음 | `plan/complete/exec-park-b2a-followup.md` 마지막 절 | "→ exec-park-polish.md" 참조 추가 (이미 완료된 plan이라 실질 영향 낮음) |
| 15 | Testing | `driveResumeFrame(isInnermost=true)` → `dispatchResumeTurn` 경로의 중첩 통합 테스트 기존 커버 여부 확인 필요(파일 truncated으로 미확인) | `execution-engine.service.spec.ts` 중첩 재개 describe 블록 | CI 실행 결과로 확인. 중첩 AI park → rehydration 경로 통합 테스트 없으면 추가 권장 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 에러 메시지 내부 구조 노출(기존 동일 수준), persistedInteractionType DB 신뢰 경계(기존 설계 특성), InteractionTokenService fail-closed 코드 반영 확인 권장(WARNING) |
| architecture | LOW | ai_conversation registry 항목 selects 클로저의 this 캡처로 인터페이스 독립성 부분 훼손(WARNING). 전반적으로 OCP·SRP·ISP 개선 |
| requirement | NONE | 모든 동작 계약 보존 확인. SPEC-DRIFT: spec §7.5 다이어그램·blockingInteraction 필드 갱신 권장(2건) |
| scope | NONE | 전체 변경이 exec-park B-1 권고 범위 내. 범위 이탈 없음 |
| side_effect | NONE | 공개 API 변경 없음. 전역 상태 도입 없음. 동작 보존 확인 |
| maintainability | LOW | 테스트 반복 캐스팅 패턴, backing field 네이밍 혼동 가능성, selects this 캡처 주의사항 미문서화. 전반적으로 유지보수성 향상 |
| testing | LOW | handleAiResumeTurn 내부 로직 커버리지 갭(WARNING), registry lazy init afterEach 리셋 부재(WARNING). 신규 7개 테스트는 라우팅 계약 충분히 검증 |
| documentation | LOW | `dispatchResumeTurn` JSDoc @throws 태그 누락(WARNING). 신규 파일 문서화 품질 양호 |

---

## 발견 없는 에이전트

없음 — 모든 에이전트가 발견사항을 기록했으나 requirement·scope·side_effect 에이전트는 NONE 위험도(실질 문제 없음).

---

## 권장 조치사항

1. **[WARNING-3 · Testing]** `handleAiResumeTurn` 독립 단위 테스트 추가: `buildRetryReentryState` 실패 경로(`RESUME_INCOMPATIBLE_STATE`) 및 정상 경로(`setNodeOutput` 호출·`processAiResumeTurn` 결과) 커버
2. **[WARNING-4 · Testing]** `dispatchResumeTurn` describe 블록 `afterEach`에 `(service as any)._resumeTurnRegistry = undefined;` 추가 — 테스트 격리 강화
3. **[WARNING-5 · Documentation]** `dispatchResumeTurn` JSDoc에 `@throws {RehydrationError} code='RESUME_CHECKPOINT_MISSING'` 및 `@throws {RehydrationError} code='RESUME_INCOMPATIBLE_STATE'` 추가
4. **[WARNING-1/2 · SPEC-DRIFT]** spec §7.5 다이어그램 갱신: 직접 분기 서술 → `dispatchResumeTurn` registry 위임 서술 교체. spec §7.5/§5.5에 form 노드 handler metadata 식별 방법(`kind=blocking, interaction=form`) 추가
5. **[WARNING-6 · Architecture]** `resumeTurnRegistry` ai_conversation 항목 JSDoc에 "`this` 캡처로 service 인스턴스 의존" 주의사항 명시 (또는 selector 빌드 시 `hasCheckpointEligibleType` 미리 평가로 의존 제거)
6. **[WARNING-7 · Security]** `InteractionTokenService` production fail-closed 가드 코드 반영 여부 확인
7. **[INFO-7 · Maintainability]** 테스트 반복 캐스팅 패턴 개선: describe 상단 `let svc: DispatchSubject` + `beforeEach` 단일 할당으로 정리
8. **[INFO-13 · Documentation]** `park-release-signal.ts`에 `process-turn-result.ts` 역방향 참조 한 줄 추가

---

## 라우터 결정

라우터가 선별 실행함 (`routing_status=done`).

- **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (8명)
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (전체 실행 목록과 동일 — 전원 강제 포함)
- **제외**: `performance`, `dependency`, `database`, `concurrency`, `api_contract`, `user_guide_sync` (6명)

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 순수 리팩터링(동작 보존 추출)으로 성능 관련 신규 코드 없음 |
| dependency | 외부 라이브러리 의존성 변경 없음 |
| database | DB 스키마·쿼리·마이그레이션 변경 없음 |
| concurrency | 동시성 패턴 신규 도입 없음 |
| api_contract | 공개 API 시그니처 변경 없음 |
| user_guide_sync | 사용자 문서 영향 없음 |