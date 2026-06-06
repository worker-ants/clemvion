# Code Review 통합 보고서

> 대상: exec-park D6 full B3 — in-memory continuation 머신 완전 제거 + §7.5 rehydration 단일 경로 일원화
> 생성일: 2026-06-06

---

## 전체 위험도

**MEDIUM** — 핵심 비즈니스 로직 변경은 안전하고 설계 방향이 올바르다. 신규 핵심 메서드(`processFormResumeTurn`, `driveCallStackResume`, `driveResumeFrame`)의 단위 테스트 부재 + 예외 전파 경로 방어 부족이 결합되면 운영 중 무음 실패(silent failure) 또는 BullMQ 이중 재시도 위험이 있다.

---

## Critical 발견사항

없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `processFormResumeTurn` 신규 메서드 — 단위 테스트 부재. sentinel unwrap·상태 분기·nodeExec null 경로 등 핵심 분기가 직접 커버되지 않음 | `execution-engine.service.ts` `processFormResumeTurn` / `execution-engine.service.spec.ts` | 4개 경로 직접 단위 테스트 추가: (a) sentinel 정상, (b) non-sentinel warn 폴백, (c) `status === RUNNING` vs `!== RUNNING` 분기, (d) `nodeExec` null 스킵 |
| 2 | Testing | `driveCallStackResume` / `driveResumeFrame` — 단위 테스트 부재. 버전 가드·frames=0·bubble-up 도중 re-park 등 엣지 케이스가 e2e 레벨에서 커버 불가 | `execution-engine.service.ts` `driveCallStackResume`, `driveResumeFrame` | private 직접 접근(`as unknown as`) 방식으로 describe 블록 추가; 버전 가드·단일/다중 프레임·중간 re-park 포함 |
| 3 | Testing | `driveCallStackResume` 중 AI re-park → bubble-up 경로 미검증. spec §7.5 step 2-a의 "PARK_RELEASED 시 외곽 frame forward 없이 세그먼트 종료" 가 단독 검증되지 않음 | `execution-engine.service.ts` `driveCallStackResume` AI 분기 | 중첩 AI 노드 케이스 추가; `processAiResumeTurn` PARK_RELEASED 반환 시 `runNodeDispatchLoop` 미호출 assert |
| 4 | Testing | `applyCancellation` 의미 변경 후 `affected: 0` graceful no-op 경로가 명시적으로 검증되지 않음 | `execution-engine.service.spec.ts` ~line 1248 | (a) `affected: 0` 시 예외 없이 완료 확인 테스트, (b) `affected: 1` 시 NodeExecution 상태 갱신 확인 테스트 추가 |
| 5 | Testing | `runExecutionFromQueue` setup throw → `failFirstSegmentSetup` 호출 경로 커버리지 부재 | `execution-engine.service.ts` `runExecutionFromQueue` try/catch | `runExecution` spy `mockRejectedValueOnce` 로 `failFirstSegmentSetup` 호출 검증 테스트 추가 |
| 6 | Side Effect | `driveCallStackResume` / `driveResumeDetached` 의 `.catch` 핸들러 제거로 극단 케이스(DB save 실패 등)에서 예외가 BullMQ worker 로 전파 — 동일 continuation 재시도(이중 실행) 위험 | `execution-engine.service.ts` `resumeFromCheckpoint` | `rehydrateAndResume` / `applyContinuation` 에서 최종 catch 가드 유지, 또는 `driveResumeDetached`·`driveCallStackResume` 가 예외를 완전 흡수함을 단위 테스트로 명시적 커버 |
| 7 | Side Effect | `runExecutionFromQueue` catch 블록 내 `await failFirstSegmentSetup` 이 예외 throw 시 worker `process()` 까지 전파 → job fail/retry 유발 가능 | `execution-engine.service.ts` `runExecutionFromQueue` | catch 블록 내 `failFirstSegmentSetup` 에 `.catch(e => logger.error(...))` 부착, 또는 함수 내부 완전 흡수 확인 |
| 8 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/4-execution-engine.md §7.5` 흐름도(lines 893-896)가 옛 `waitForX() invoke + in-memory resolver 등록` 모델을 기술 — full B3 이후 `driveResumeDetached` 직접 처리기 경로와 불일치 | `spec/5-system/4-execution-engine.md §7.5` lines 893-896 | 코드 유지 + spec 갱신: 흐름도 두 단계를 `driveResumeDetached`→`processFormResumeTurn`/`processButtonResumeTurn`/`processAiResumeTurn` 직접 호출 경로로 대체. `project-planner` 위임 |
| 9 | SPEC-DRIFT | [SPEC-DRIFT] spec 상태 전이표·§12.2의 "replay 중 cancel → CANCELLED" 서술이 full B3 이후 동작(RUNNING 중 cancel = graceful no-op, 다음 park 시점에 효력)과 불일치 | `spec/5-system/4-execution-engine.md` line 64 상태 전이표, line 1202 §12.2 | 코드 유지 + spec 갱신: 두 위치를 full B3 동작으로 갱신. `project-planner` 위임 |
| 10 | Requirement | stale 주석 — `rehydrateAndResume` 내 "drive detached"·`pendingContinuations` 잔류 언급이 현행 구현(await 전환, Map 제거)과 불일치 | `execution-engine.service.ts` lines 1171-1178, 1183 | "drive detached" → "drive awaited" 정정, `pendingContinuations` 언급 제거, 로그 메시지 `"Rehydration launched"` 로 수정 |
| 11 | Architecture | 처리기(`processFormResumeTurn` 등) 반환 타입이 `void \| ParkSignal` 혼용으로 명시적 discriminated union 없음 — 처리기 추가 시 컴파일 타임 계약 위반 탐지 불가 | `execution-engine.service.ts` 처리기 3종 시그니처 | `ProcessTurnResult = void \| ParkSignal` named type alias 분리 후 세 처리기에 `Promise<ProcessTurnResult>` 명시 반환 통일 |
| 12 | Architecture | `processFormResumeTurn` 내 `savedExecution.status === RUNNING` 분기가 caller-side 사전조건에 의존하는 암묵적 결합 — `finalizeAiNode` 에도 대칭 가드 복제(DRY 위반) | `execution-engine.service.ts` `processFormResumeTurn` 상태 전이 분기 | `updateExecutionStatus` 에 "이미 target 상태면 no-op" 멱등 가드 추가, 또는 `alreadyRunning: boolean` 명시 파라미터로 내부 분기 지식 제거 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `processFormResumeTurn` sentinel 없는 폴백 분기에서 payload 원본이 formData로 전달되며 warn만 기록 — 방어적이지 않으나 실질 공격 벡터(BullMQ 큐 접근)는 제한적 | `execution-engine.service.ts` `processFormResumeTurn` 폴백 분기 | 폴백 분기에서 payload 완전 reject(빈 formData 또는 조기 return) 고려 |
| 2 | Performance | 모든 성능 개선 완료: `pendingContinuations` Map 제거(bounded-memory), `firePayload` setTimeout 폴링 제거(재개 latency 즉각화), `runAiConversationLoop` 장수 루프 제거(worker 슬롯 deadlock 해소) | 전반 | 해당 없음 |
| 3 | Architecture | `driveResumeDetached` 메서드명이 "Detached" 포함하지만 이제 await 됨 — 기술 부채 | 메서드명 | 장기적으로 `driveResumeAwaited` 등으로 rename 고려 |
| 4 | Architecture | 테스트 내 `rehydrateAndResume` spyOn 시 `as unknown as` 타입 캐스팅 4회 반복 | `execution-engine.service.spec.ts` W5 블록 등 | `spyRehydrate(service)` 헬퍼 단일 추출 |
| 5 | Concurrency | RUNNING 중 cancel이 `cancelParkedExecution` WAITING 가드에 막혀 no-op — "cancel 보냈는데 COMPLETED 로 끝남" 운영 가시성 부재 | `execution-engine.service.ts` `applyCancellation` | 운영 알림/audit log에 "cancel received during RUNNING — no-op" 패턴 명시 |
| 6 | Documentation | `spec/5-system/4-execution-engine.md §7.4` 라우팅 원칙 셀에 `pendingContinuations` 현재 시제 잔류 | `spec/5-system/4-execution-engine.md §7.4` | 해당 조건 삭제 또는 "full B3 제거됨" 명시 갱신 |
| 7 | Documentation | `processButtonResumeTurn` 에 `processFormResumeTurn` 대비 JSDoc 미확인 — 비대칭 | `execution-engine.service.ts` `processButtonResumeTurn` | 동일 수준 JSDoc 추가 |
| 8 | Documentation | e2e describe 블록 제목이 `(e2e, PR-B1)` 고정 — PR-B2b 신규 테스트 목적 오인 가능 | `execution-park-resume.e2e-spec.ts` describe 헤더 | `(e2e, PR-B1 / PR-B2b)` 로 갱신 또는 별도 describe 블록 분리 |
| 9 | Scope | `plan/in-progress/spec-update-exec-park-d6-rehydration-step2.md` 가 `plan/complete/` 이동 없이 직접 삭제됨 (라이프사이클 규약 미준수) | 삭제된 plan 파일 | 향후 완료 plan은 `plan/complete/` 이동 원칙 준수 |
| 10 | Scope | spec 파일 3개 수정이 `developer` 역할 범위 외 (`spec/` 는 `project-planner` 전용) — resolution-applier 지시에 따른 것으로 실질 위반보다 프로세스 편의 | `spec/1-data-model.md` 외 | 향후 spec 변경은 별도 커밋 또는 project-planner 경유 분리 |
| 11 | Maintainability | e2e 타임아웃 90s 매직 넘버 — 기존 60s와 차이 이유 미설명 | `execution-park-resume.e2e-spec.ts` 2193행 | 파일 상단에 `const NESTED_E2E_TIMEOUT_MS = 90_000; // 중첩 rehydration 경로 ...` 이름 상수 도입 |
| 12 | Requirement | `driveResumeDetached` 가 이제 await 됨으로 내부 catch에서 throw 시 outer catch 도달 — 기존 fire-and-forget 대비 실제로 더 안전한 동작 | `execution-engine.service.ts` `resumeFromCheckpoint` | 해당 없음(개선 완료) |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | MEDIUM | 신규 핵심 메서드 5건 단위 테스트 부재 |
| security | LOW | sentinel 폴백 분기 방어성 부족(INFO) |
| performance | NONE | 전체 개선 — in-memory 머신 제거 효과 |
| architecture | LOW | 처리기 반환 타입 미명시화, RUNNING 가드 DRY 위반(WARNING 2건) |
| requirement | LOW | SPEC-DRIFT 2건(spec 갱신 필요), stale 주석 1건 |
| scope | LOW | plan 직접 삭제, developer-spec 쓰기 |
| side_effect | LOW | `.catch` 제거 후 예외 전파 경로 방어 부족(WARNING 2건) |
| maintainability | LOW | 전부 INFO 수준 중복·가독성 개선 |
| documentation | LOW | 전부 INFO 수준 갱신 누락 |
| concurrency | LOW | await 전환 후 극단 예외 전파 가능성(INFO) |
| api_contract | NONE | 외부 API 계약 변경 없음 |
| user_guide_sync | NONE | 동반 갱신 누락 0건 |

---

## 발견 없는 에이전트

- **api_contract** — 외부 REST API 계약 breaking change 없음, 내부 private 메서드 시그니처 변경만
- **user_guide_sync** — 매트릭스 19개 trigger 중 유저 가이드 동반 갱신 해당 없음(내부 아키텍처 리팩터링)
- **performance** — 전체 변경이 성능 순개선 (메모리·latency·deadlock 모두 개선)

---

## 권장 조치사항

1. **[즉시] 예외 전파 방어 보강** (WARNING 6, 7): `driveResumeDetached`/`driveCallStackResume` 호출부에 최종 catch 가드 추가, 또는 두 메서드가 예외를 완전 흡수함을 단위 테스트로 명시 커버. `runExecutionFromQueue` catch 블록 내 `failFirstSegmentSetup` 호출에도 `.catch(e => logger.error)` 부착.
2. **[즉시] 핵심 신규 메서드 단위 테스트 추가** (WARNING 1-5): `processFormResumeTurn` 4개 경로, `driveCallStackResume`/`driveResumeFrame` 버전 가드·다중 프레임·re-park 케이스, `applyCancellation` affected:0/1 양쪽, `runExecutionFromQueue` setup throw 경로.
3. **[즉시] stale 주석 정정** (WARNING 10): `execution-engine.service.ts` lines 1171-1178, 1183의 "detach"·`pendingContinuations` 잔류 주석 수정.
4. **[project-planner 위임] SPEC-DRIFT 해소** (WARNING 8, 9): `spec/5-system/4-execution-engine.md §7.5` 흐름도(lines 893-896) + 상태 전이표(line 64)·§12.2(line 1202) 갱신.
5. **[단기] 처리기 반환 타입 명시화** (WARNING 11): `ProcessTurnResult` named type alias 도입 후 세 처리기에 통일.
6. **[단기] 상태 전이 DRY 위반 해소** (WARNING 12): `updateExecutionStatus` 멱등 가드 추가 또는 `alreadyRunning` 명시 파라미터 전달.
7. **[선택] 문서화 INFO 정리**: `spec §7.4` 라우팅 원칙 셀 `pendingContinuations` 잔류 제거, `processButtonResumeTurn` JSDoc 추가, e2e describe 헤더 갱신.

---

## 라우터 결정

라우터가 선별 실행 (`routing_status=done`):

- **실행** (12명): security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, api_contract, user_guide_sync
- **제외** (2명):

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터 선별 제외 |
  | database | 라우터 선별 제외 |

- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명)