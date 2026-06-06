# Code Review 통합 보고서

**PR**: exec-park-durable-resume (PR-B1 form/button park 즉시 해제 + slow-path 일원화 / PR-B2a top-level 멀티턴 AI turn-park)
**리뷰 일시**: 2026-06-06 10:26
**리뷰어**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync (13명)

---

## 전체 위험도

**HIGH** — CRITICAL 1건(eia-client 봉투 미언랩 재발, 웹챗 위젯 전체 동작 불가), WARNING 19건(아키텍처 구조·동시성·유지보수성·테스트 커버리지·API 계약·유저 가이드 갭). 백엔드 실행 엔진 변경 자체는 양호하나, `eia-client.ts` 의 핫픽스 소실이 머지 블로커.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| C1 | API 계약 | `eia-client.ts` — `unwrapEnvelope` 제거로 `{ data }` 봉투 미언랩 재발. 이 브랜치는 `fix-webchat-envelope-unwrap` 핫픽스(main `733721dc`)보다 이전에 분기됐고, `startConversation`/`getStatus`/`refreshToken` 의 봉투 언랩 코드 전체 미포함. 백엔드 `TransformInterceptor` 가 여전히 모든 성공 응답을 `{ data: ... }` 로 래핑하므로, 현재 상태로 main 머지 시 SSE 미개시 버그 재발 → 웹챗 위젯 전체 동작 불가 | `codebase/channel-web-chat/src/lib/eia-client.ts` | 머지 전 `origin/main`(`733721dc` 이후) 으로 rebase 하거나 `unwrapEnvelope` 함수와 세 메서드의 언랩 호출을 복원 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | 아키텍처(OCP) | `waitForX` 메서드가 `parkMode: 'release' \| 'await'` 파라미터로 두 직교 동작을 혼재. 새 interaction type 추가 시 각 `waitForX` 의 두 분기 모두 수정해야 하는 shotgun surgery 발생 | `waitForFormSubmission`(L3652), `waitForButtonInteraction`, `waitForAiConversation` | `ParkStrategy` 인터페이스 또는 `parkFresh`/`parkResume` 두 함수 분리 |
| W2 | 아키텍처(타입 안전) | `PARK_RELEASED` Symbol sentinel 반환·비교가 콜사이트 11곳 이상에 반복. 호출자가 추상화 내부 세부사항에 의존, 모듈 경계를 넘으면 타입 안전성 깨짐 | L1682, L1692, L1704, L2040, L3451, L3461, L3473, L5028, L5348, L5360, L5372 등 | `type ParkResult = { released: true } \| { released: false; data: unknown }` discriminated union 으로 대체, sentinel 비교를 `waitForX` 계층 내부로 캡슐화 |
| W3 | 아키텍처(레이어) | 비즈니스 레이어(`ExecutionEngineService`)가 WebSocket 이벤트 프레임 구조 조립까지 직접 수행. WS emit 구조 변경 시 비즈니스 코드 동시 수정 필요 | `this.eventEmitter.emitExecution(...)` 다수 | 도메인 이벤트(`ExecutionParkedEvent` 등) 발행 후 `ExecutionEventEmitter` 가 WS 포맷 변환하는 어댑터 역할로 책임 이동 |
| W4 | 아키텍처(코드 중복) | `resumeFromCheckpoint` / `resumeGraphAfterRetry` 의 graph rebuild + reachability seed + completion finalize 단계 중복. 코드 자체도 "후속 plan 으로 분리" 주석 인정 | `resumeFromCheckpoint`(L1748), `resumeGraphAfterRetry`(L4614) | 공통 `ExecutionRunner.run(seed, opts)` 형태로 추출 |
| W5 | 아키텍처(모듈 위치) | `buildConversationMetaFromResumeState` 등 3개 `@internal` 함수가 서비스 파일에 `export` 선언되어 테스트가 프로덕션 내부 구현에 의존(화이트박스 결합) | `execution-engine.service.ts` L366, L428, L490 | `conversation-meta.helpers.ts` 별도 파일로 추출, `ExecutionEngineService` 공개 API 에서 제거 |
| W6 | 아키텍처(상태 관리) | `firstSegmentBarriers`/`pendingContinuations`/`segmentStartMs` 세 in-memory Map 이 "park session state" 를 사실상 구성하나 별도 추상화 없이 산재 | L764, L776, L794 | `ParkSessionStore` 인터페이스로 추출, in-memory ↔ distributed 교체 가능하게 DIP 적용 |
| W7 | 동시성 | `isAiConversation === true` 분기에서 `firePayload` skip → `ai_form_render` 경로에서 `driveResumeDetached` 가 `waitForFormSubmission` 호출 시 pending resolver 가 영구 fire 안 되어 hang 가능 | `resumeFromCheckpoint` L1868–1870 | `ai_form_render` 를 `isAiConversation` skip 조건에서 분리하거나, `waitForFormSubmission` 호출 전 `firePayload` 스케줄 내부 hook 신설 |
| W8 | 동시성 | `firstSegmentBarriers` 덮어쓰기: `settleFirstSegment` → `Map.delete` → `barrier.resolve()` → `Map.set` 순서에 암묵적 의존. 리팩토링 시 버그화 위험(현재는 실제 위험 낮음) | `armFirstSegmentBarrier`(~L776), `runExecutionFromQueue`(~L2629) | 순서 안전 이유를 인라인 주석으로 명시, 또는 `version` 필드 추가로 명시적 추적 |
| W9 | 동시성 | `rehydrateAndResume` outer catch 의 `finalizeRehydrationCleanup` 호출과 `driveResumeDetached` fire-and-forget 사이의 cleanup 경쟁. 현재는 `driveResumeDetached` 호출이 마지막 문장이라 안전하지만 향후 코드 추가 시 실제화 위험 | `rehydrateAndResume`(~L1175), `resumeFromCheckpoint` | `driveResumeDetached` 호출 후 state-mutating 코드 추가 금지 주석 명시, 또는 setup/launch 단계 함수 분리 |
| W10 | 유지보수성 | `processAiResumeTurn` 의 `payload: unknown` → `as ContinuationPayload` 강제 캐스트 — null/undefined 시 `action.type` 접근 런타임 오류 → `driveResumeDetached` catch 가 FAILED 처리. 새 진입점으로의 방어 부재 | `execution-engine.service.ts` L5293 | `if (!payload \|\| typeof payload !== 'object')` null guard 추가, 또는 `isValidContinuationPayload(payload)` 타입 가드 함수 추출 |
| W11 | 유지보수성 | `driveResumeDetached` opts 에 `payload: unknown` 이 non-optional 로 추가됨. form/button 재개 경로에서 미사용 필드가 필수화되어 의미 없는 포워딩 코드 발생, 오해 유발 | `execution-engine.service.ts` L1941–1942 | `payload?: unknown` 옵셔널화, 또는 AI 특화 `AiResumeOpts` discriminated union 분리 |
| W12 | 유지보수성 | `finalizeAiNode` 내 `savedExecution.status === RUNNING` 분기가 외부 흐름에 전적으로 의존. 단일 함수가 두 가지 다른 책임(WAITING→RUNNING 전이 + 이미 RUNNING 이면 NodeExecution 만 저장) 보유 | `execution-engine.service.ts` L6355–6380 | boolean 파라미터 `skipExecutionTransition` 또는 별도 메서드 `finalizeAiNodeInRunning` 으로 명시화 |
| W13 | 테스트 | `reparkAiResumeTurn` 이 WAITING_FOR_INPUT 으로 실제 전이되는지 DB 상태 단언 부재. 전이 실패 시 다음 slow-path rehydration invariant 검증 실패로 RESUME_INCOMPATIBLE_STATE 조용히 발생 | `execution-engine.service.spec.ts` W12/button_click re-park 테스트 | `updateExecutionStatus` spy assertion 또는 `status: 'waiting_for_input'` QueryBuilder 호출 검증 추가 |
| W14 | 테스트 | `finalizeAiNode` 의 RUNNING 단락(skip transition) 분기에 전용 단위 테스트 부재. 분기 로직 변경 시 기존 테스트 통과 가능 | `execution-engine.service.ts` L6369–6380 | `finalizeAiNode` 직접 단위 케이스 추가 또는 end-ai-conversation COMPLETED slow-path 테스트에 `updateExecutionStatus` 미호출 assertion 보강 |
| W15 | 테스트 | `flushResumeDrive(200ms)` 실제 타이머 의존 — button_click × 22 = 880ms, W4 인터리빙 = 800ms 등 누적이 jest 기본 5000ms 타임아웃에 근접, CI 고부하 시 flaky 위험 | `execution-engine.service.spec.ts` L84–86, L5159 | `jest.config.ts` 에 `testTimeout: 15000` 추가 또는 해당 describe 블록 `jest.setTimeout(15000)` 선언 |
| W16 | 유저 가이드 | park/durable-resume 실패 케이스(서버 재시작, checkpoint 누락 등) 및 RESUME_* 에러 코드 한국어 매핑 3건 누락(`RESUME_CHECKPOINT_MISSING`, `RESUME_FAILED`, `RESUME_INCOMPATIBLE_STATE`) | `codebase/frontend/src/content/docs/05-run-and-debug/`, `codebase/frontend/src/lib/i18n/backend-labels.ts` | `05-run-and-debug/` 유저 가이드 실행 재개 실패 안내 추가(한/영); `backend-labels.ts` `ERROR_KO` 에 3개 코드 한국어 설명 등록 |
| W17 | API 계약 | `getStatus()` 반환 타입이 `ExecutionStatus` → `Record<string, unknown>` 으로 약화, `ExecutionStatus` 인터페이스 삭제됨. EIA §5.3 계약이 코드 레벨에서 소실 | `codebase/channel-web-chat/src/lib/eia-client.ts` | `ExecutionStatus` 인터페이스 복원 또는 EIA §5.3 필드 기반 구체 타입 별도 정의 |
| W18 | API 계약 | `eia-client.test.ts` 에서 `refreshToken` 401/403/500, `getStatus` 410/500/401 에러 케이스 등 오류 응답 테스트 대거 삭제 — 회귀 감지 불가 | `codebase/channel-web-chat/src/lib/eia-client.test.ts` | 삭제된 에러 케이스 테스트 복원 (최소: refreshToken 401/403, getStatus 410) |
| W19 | 문서화(spec) | `spec/5-system/4-execution-engine.md §7.5` 및 §Rationale D6 의 "미구현" 표식 가시성 불충분. 독자가 완료형 서술을 보고 구현 완료로 오해할 위험 | `spec/5-system/4-execution-engine.md §7.5`, `§Rationale D6` | §7.5 섹션 헤더 직후 `> **구현 상태**: 설계 확정·미구현 — PR-B2 후속 커밋에서 구현 예정` 블록쿼트 배너 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/4-execution-engine.md` §4.x 배너 두 곳이 "PR-B2(멀티턴 AI) 미적용"으로 기재돼 있으나 코드는 PR-B2a 구현 완료. 독자 오도 | spec §4.x L406–408 | spec 갱신(project-planner): "PR-B2a 완료, PR-B2b 미적용"으로 업데이트 |
| I2 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/4-execution-engine.md §Rationale` L1271 단계적 롤아웃 노트가 PR-B2 = B3 일괄 수행처럼 기술. 실제는 PR-B2a/B2b 2분할 | spec §Rationale L1271 | spec 갱신(project-planner): PR-B2a/B2b 2분할 내용 반영 |
| I3 | 보안 | `allowedFieldNames.size === 0` 시 제출 키 전체 통과(fail-open). 빈 config 폼과 공격자 주입 폼을 구분 불가 | `waitForFormSubmission` L3780–3790 | `size === 0` 시 `{}` 반환 fail-closed 정책 검토 또는 최대 키 수/값 크기 상한 추가 |
| I4 | 보안 | `assertSameWorkspace` — `callerWorkspaceId` 미정의 시 경고 로그만 남기고 허용(fail-open). 레거시 호출자 workspace 격리 우회 가능 | `execution-engine.service.ts` L877–893 | 레거시 호출자 마이그레이션 완료 후 fail-closed(`throw`) 전환 일정 plan 명기 |
| I5 | 보안 | `mcpServers` allow-list 포함 — 향후 shape 변경 시 평문 token 이 DB 영속될 위험. 자동화 검증 없음 | `buildResumeCheckpoint` L4566–4577 | `mcpServers` 포함 시 secret 필드 없음 canary 단위 테스트 추가 |
| I6 | 보안 | `InvalidExecutionStateError`/`RehydrationError` 메시지에 executionId/nodeId 포함 — 전역 ExceptionFilter 클라이언트 전달 차단 여부 확인 필요 | L4943–4953, L1780–1795 | 전역 `ExceptionFilter` 에서 해당 예외 타입 message 미전달 명시적 처리 확인 |
| I7 | 성능 | `rehydrateContext` 내 N+1 DB 쿼리 — 완료 노드 N 개 시 N+1 DB 왕복. PR-B2 slow-path 빈도 증가로 영향도 상승(기존 코드 유래) | `execution-engine.service.ts` L1392–1419 | `nodeExecutionRepository.find({ where: { nodeId: In(uniqueNodeIds) } })` 배치 쿼리로 1+1 축소 |
| I8 | 성능 | `reparkAiResumeTurn` 마다 `cloneThread` 딥 클론 + `Execution` DB save. 긴 대화에서 선형 비용 증가 | L5387–5397 | 단기 허용 수준. 향후 dirty flag 로 불변 re-park 시 save 생략 검토 |
| I9 | 아키텍처(SRP) | `ExecutionEngineService` 9,098줄, 최소 8개 책임 혼재(God Service). 서비스 자신도 "PR-H/I 에서 분해 예정" 주석 인정 | `execution-engine.service.ts` 전체 | 최소 `ExecutionGraphService`, `ExecutionParkService`, `ExecutionLifecycleService` 3개로 추출 (중기 과제) |
| I10 | 아키텍처(상수) | `CHECKPOINT_SCHEMA_VERSION` 이 서비스 파일 최상단 위치, `CALL_STACK_SCHEMA_VERSION` 은 shared 레이어 — 위치 비대칭 | `execution-engine.service.ts` L284 vs `shared/execution-resume/resume-call-stack.types.ts` L48 | `shared/execution-resume/resume-checkpoint.types.ts` 신설 후 이동 |
| I11 | 아키텍처(레이어) | `cancelParkedExecution` 이 `createQueryBuilder` 레벨까지 직접 수행 — service 가 query building 책임 보유 | `cancelParkedExecution` L1072 | `ExecutionRepository` 확장 또는 `ExecutionDataAccess` 서비스로 복잡 쿼리 분리 |
| I12 | 부작용 | `reparkAiResumeTurn` 에서 `emitAiWaitingForInput` 미호출 → 계속 turn 에서 `EXECUTION_WAITING_FOR_INPUT` WS 이벤트 미발행. 채널 어댑터 보완 메커니즘 확인 필요 | `execution-engine.service.ts` L5387–5398 | 채널 어댑터가 `AI_MESSAGE` 이벤트만으로 다음 입력 대기 상태 전환하는지 검증 |
| I13 | 부작용 | `finalizeAiNode` RUNNING 바이패스 경로에서 `segmentStartMs` flush 미수행 — 다음 상태 전이 실패 시 타이머 엔트리 잔류 가능 | `execution-engine.service.ts` L6369–6380 | 해당 경로 `activeRunningMs` 누산 검증 단위 테스트 추가 또는 `segmentStartMs` 직접 flush |
| I14 | 부작용 | `waitForAiConversation` `executeInline` 호출 지점(L2968)이 `parkMode` 묵시적 기본값 의존 — 미래 변경 시 반환값 silent miss | `execution-engine.service.ts` L2968 | `parkMode='await'` 명시적 인자로 전달해 의도 고정 |
| I15 | 테스트 | `void pendings` lint 우회 패턴 — 변수 선언 후 `void` 연산자로만 소비 | `execution-engine.service.spec.ts` L5322 | `pendings` 변수 제거(직접 `getPendings` 호출)하거나 실제 검증에 사용 |
| I16 | 테스트 | `isAiConversation` 조건부 `firePayload` 스킵 분기 — AI 케이스에서 `setTimeout` 미호출 명시적 가드 없음. 분기 제거 시 silent degradation | `execution-engine.service.ts` L1868–1870 | AI resume 테스트에 `firePayload warn 문자열 부재` 또는 `setTimeout` 미호출 assertion 추가 |
| I17 | 테스트 | `resume-call-stack.types.spec.ts` 미존재 (이전 리뷰 W4 이월 지속) | `shared/execution-resume/resume-call-stack.types.ts` | PR-B2 행위 구현 완료 커밋에서 추가 |
| I18 | 테스트 | `executions.service.spec.ts` mock execution 에 `resumeCallStack: null` 미반영 (이전 리뷰 W5 이월 지속) | `executions.service.spec.ts` | mock execution 헬퍼에 `resumeCallStack: null` 추가 |
| I19 | 문서화 | `cancelParkedExecution` JSDoc 없음 (복합 로직임에도 헤더 미존재) | `execution-engine.service.ts` L1072 | park된 Execution 취소 동작·멱등 no-op·emit 흡수 설명 JSDoc 추가 |
| I20 | 문서화 | `spec/data-flow/3-execution.md §2.1` Schema 매핑 표에 `conversation_thread`·`user_variables`·`resume_call_stack` 3컬럼 미반영 | `spec/data-flow/3-execution.md §2.1` | 세 컬럼 추가 또는 park 전용 행 신설 |
| I21 | 문서화 | `spec/5-system/1-auth.md §5` API 표에 `POST /auth/resend-verification` 누락(본문 §1.1 에는 기술) | `spec/5-system/1-auth.md §5` | `POST /api/auth/resend-verification` 행 추가 (throttle 5/min, 인증 불요) |
| I22 | 데이터베이스 | `cancelParkedExecution` 두 UPDATE 사이 트랜잭션 없음. 경합 가드로 양방향 안전하나 명시적 원자성 부재 | `execution-engine.service.ts` L1074–1099 | 필수 아님. 향후 경합 케이스 추가 시 `dataSource.transaction` 권장 |
| I23 | 범위 | `spec §7.5` D6 절이 PR-B2a 범위를 일부 초과하나 "미구현" 표식 명확하고 V087 컬럼이 이 PR 포함 — 합리적 선행 기재 | `spec/5-system/4-execution-engine.md §7.5` | PR-B2b 착수 시 "구현 예정" → 완료형 전환을 checklist 명기 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| api_contract | HIGH | CRITICAL: eia-client 봉투 미언랩 재발(머지 블로커); WARNING: getStatus 반환 타입 약화, 에러 테스트 대거 삭제 |
| architecture | HIGH | God Service(9,098줄 SRP 위반), waitForX 이중 동작(OCP), sentinel 반복 비교, WS emit 레이어 혼재, resumeFromCheckpoint 코드 중복 |
| concurrency | MEDIUM | ai_form_render 경로 firePayload skip → waitForFormSubmission 영구 hang 위험; firstSegmentBarriers 덮어쓰기 순서 의존; cleanup 경쟁 구조 취약 |
| maintainability | MEDIUM | payload 강제 캐스트 방어 부재, driveResumeDetached opts 필수화, 7파라미터 목록, finalizeAiNode 조건부 책임 분기 |
| user_guide_sync | MEDIUM | 05-run-and-debug 유저 가이드 park/resume 실패 안내 누락; RESUME_* 에러 코드 ko 매핑 3건 누락 |
| testing | LOW | reparkAiResumeTurn DB 상태 단언 부재, finalizeAiNode RUNNING 분기 단위 테스트 부재, 200ms 실타이머 누적 flaky 위험 |
| documentation | LOW | spec/data-flow 컬럼 동기화 갭, cancelParkedExecution JSDoc 부재, §7.5 미구현 배너 가시성 |
| side_effect | LOW | finalizeAiNode segmentStartMs flush 미보장, waitForAiConversation 반환 타입 확장의 묵시적 무시, reparkAiResumeTurn WS 이벤트 미발행 설계 확인 필요 |
| security | LOW | allowedFieldNames fail-open, assertSameWorkspace fail-open, mcpServers canary 테스트 미비, 에러 메시지 ID 노출 범위 |
| performance | LOW | rehydrateContext N+1 쿼리(기존 코드, slow-path 빈도 증가로 영향도 다소 상승), cloneThread 딥 클론 선형 비용 |
| requirement | LOW | SPEC-DRIFT 2건(spec 배너·Rationale 롤아웃 노트 미갱신); WARNING 2건(payload null 처리, reparkAiResumeTurn 주석 보강) |
| database | LOW | cancelParkedExecution 트랜잭션 미묶음(경합 가드로 안전), V087 무중단 배포 안전 |
| scope | NONE | 머지베이스 기준 변경 파일 집중적, D6 선행 기재는 합리적 |

---

## 발견 없는 에이전트

- **scope**: 범위 이탈 없음 (NONE)
- **database**: Critical/Warning 없음 (INFO 4건만, 설계 전반 적절)

---

## 권장 조치사항

1. **[즉시 필수, 머지 블로커] C1 — eia-client 봉투 언랩 복원**: `origin/main`(`733721dc` 이후) 으로 rebase 또는 `unwrapEnvelope` + 세 메서드 언랩 코드 직접 복원. `eia-client.test.ts` 삭제된 에러 케이스 테스트(W18)도 동시 복원.
2. **[높은 우선순위] W7 — ai_form_render firePayload skip 검토**: `ai_form_render` 경로가 `isAiConversation` skip 조건에 포함됐을 때 `waitForFormSubmission` hang 여부 실제 검증 후 분기 분리 또는 내부 hook 신설.
3. **[높은 우선순위] W16 — RESUME_* 에러 코드 ko 매핑 + 유저 가이드 갱신**: `backend-labels.ts` `ERROR_KO` 에 3개 코드 한국어 설명 등록; `05-run-and-debug/` 실행 재개 실패 케이스 안내 추가(한/영).
4. **[높은 우선순위] W17 — getStatus 반환 타입 복원**: `ExecutionStatus` 인터페이스 복원 또는 EIA §5.3 기반 구체 타입 정의.
5. **[중간 우선순위] W13·W14 — reparkAiResumeTurn / finalizeAiNode 테스트 보강**: DB 상태 전이 assertion 및 RUNNING skip 분기 단위 테스트 추가.
6. **[중간 우선순위] W15 — jest testTimeout 상향**: `jest.config.ts` 에 `testTimeout: 15000` 추가하여 실타이머 기반 테스트 flaky 방지.
7. **[중간 우선순위] W10·W11 — payload 타입 안전 강화**: `processAiResumeTurn` null guard 추가; `driveResumeDetached` opts `payload` 옵셔널화.
8. **[중간 우선순위] I1·I2 SPEC-DRIFT — spec 배너/Rationale 갱신**: project-planner 위임으로 `spec/5-system/4-execution-engine.md` PR-B2a 완료 반영 및 §Rationale 2분할 설명 추가.
9. **[낮은 우선순위] W1·W2·W3·W4 — 아키텍처 리팩토링 계획화**: `ParkStrategy` 분리, sentinel → discriminated union, 도메인 이벤트 어댑터, 공통 `ExecutionRunner` 추출을 PR-H/I plan 에 명시적 task 로 등록.
10. **[낮은 우선순위] I20·I21 — spec/data-flow·auth 문서 동기화**: `spec/data-flow/3-execution.md §2.1` 에 3컬럼 추가; `spec/5-system/1-auth.md §5` 에 resend-verification 엔드포인트 행 추가.

---

## 라우터 결정

- **routing_status**: done (router 가 선별)
- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync (13명)
- **제외**: dependency (1명)
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명)

| 제외된 reviewer | 이유 |
|------------------|------|
| dependency | router 에 의해 생략 (의존성 변경 없음으로 판단) |