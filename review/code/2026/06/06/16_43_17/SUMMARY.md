# Code Review 통합 보고서

**일시**: 2026/06/06 16:43:17
**대상**: exec-park durable resume (PR-B2b) — 단위 테스트 보강 + `failFirstSegmentSetup` catch 추가 + plan 갱신

---

## 전체 위험도

**MEDIUM** — 프로덕션 코드 변경은 소규모이고 의도가 명확하나, 테스트 모듈 setup 코드의 대규모 중복·숫자 접미어 네이밍·암묵적 beforeEach 공유 등 유지보수 부담이 누적되었고, spec 문서 두 곳에 "미구현/미적용" 메모가 완료된 구현과 불일치하는 SPEC-DRIFT 2건이 있다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| — | — | Critical 발견사항 없음 | — | — |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/4-execution-engine.md` L914 의 `resume_call_stack` 구현 상태 메모가 "PR-B2 후속 커밋에서 구현" 미완료 상태로 잔류하나, `driveCallStackResume` 가 실제로 구현 완료됨 (full B3 commit `2dbb31b6` + `247f5cb5`). spec 갱신 누락. | `spec/5-system/4-execution-engine.md` L910–914 | 코드 revert 아님. `project-planner` 위임으로 L910–914 구현 상태 주석을 "구현 완료 (PR-B2b `2dbb31b6`+`247f5cb5`)" 로 갱신. |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/4-execution-engine.md` L415, L417 의 "PR-B2b(중첩 sub-workflow D6 + full B3) 미적용" 상태 메모가 잔류. full B3 제거(`pendingContinuations`·`firstSegmentBarriers`·`firePayload` 제거, `runExecutionFromQueue` → `await runExecution` 직접 호출)가 완료됐으므로 낡은 과도기 메모. | `spec/5-system/4-execution-engine.md` L415, L417 | 코드 revert 아님. `project-planner` 위임으로 과도기 메모를 완료형으로 flip. |
| 3 | Maintainability | 테스트 모듈 setup 코드 대규모 중복 — `processFormResumeTurn` describe와 `SUMMARY W3/W5/W6/W7` describe가 각각 20여 개 provider를 포함한 `Test.createTestingModule` 블록을 전량 복사. provider 추가·삭제 시 두 곳을 동시에 갱신해야 하는 드리프트 위험. | `execution-engine.service.spec.ts` lines 56–208, 495–625 | `buildTestModule(overrides?)` 헬퍼 팩토리를 spec 파일 상단 또는 `__test__/`에 추출해 공통 provider 목록을 일원 관리. |
| 4 | Maintainability | `service2`·`service3` 숫자 접미어 네이밍 — 각 describe가 왜 별도 인스턴스를 필요로 하는지 드러내지 못함. | `execution-engine.service.spec.ts` lines 44, 493 | `formResumeService`·`callStackResumeService` 등 시나리오를 표현하는 이름 사용. 또는 헬퍼 팩토리 추출 후 각 describe 내부 스코프에서 `service`로 선언. |
| 5 | Maintainability | `as unknown as SomeType` 캐스트 타입이 각 describe에 분산 선언 — `FormResumeSubject`·`DriveW3Subject`·`W5Subject`·`W6Subject`·`W7Subject` 가 인라인 타입 리터럴로 각각 따로 정의. 시그니처 변경 시 여러 타입 선언을 동시 수정 필요. | `execution-engine.service.spec.ts` lines 236–252, 467–491, 693–700, 729–743, 795–799 | 파일 상단에 단일 `ExecutionEngineServicePrivate` 통합 타입 선언 후 공유. |
| 6 | Requirement | (b) non-sentinel warn 폴백 테스트가 한국어 경고 메시지 하위 문자열(`'sentinel 없는 폴백'`)에 직접 의존 — 메시지 개선 시 테스트 파손. spec §10.9 는 특정 문자열을 강제하지 않음. | `execution-engine.service.spec.ts` lines 344–347 | 안정적인 error code 또는 영문 키워드(`sentinel fallback` 등)를 구현과 테스트 양쪽에 고정해 언어 독립성 확보. |
| 7 | Requirement | W7 테스트가 구현 로그 메시지 문자열(`'secondary error'`)에 직접 의존 — spec은 logger.error 흡수 행동만 요구하고 특정 메시지 형식을 강제하지 않음. | `execution-engine.service.spec.ts` lines 827–829 | 안정적 식별자(오류 코드 등)로 교체하거나 call index 지정 방식 사용. |
| 8 | Requirement | W3 테스트의 `driveCallStackResume` callStack 타입이 `{ version: number; frames: unknown[] }`로 정의되나 실제 구현 `ResumeCallStack` 타입은 `{ version: number; frames: ResumeCallFrame[] }`. 시그니처 변경 시 silent type mismatch 발생 가능. | `execution-engine.service.spec.ts` lines 468–492 (`DriveW3Subject`) | 공개 타입 `ResumeCallStack` import 해 `DriveW3Subject`에 적용. |
| 9 | Side Effect | W5·W6·W7 테스트가 `svc.executionRepository.findOneBy` 등 레포지토리 필드를 `jest.spyOn` 대신 직접 프로퍼티 재할당(`=`)으로 교체 — `jest.restoreAllMocks()` 자동 복원 범위 밖임. 현재 순서에서는 오염 없으나 테스트 순서 변경·병렬 실행 시 오염 가능성. | `execution-engine.service.spec.ts` lines 703–710, 749–781, 803–811 | `jest.spyOn(svc.executionRepository, 'findOneBy').mockResolvedValueOnce(...)` 패턴으로 교체. |
| 10 | Side Effect | `failFirstSegmentSetup` 2차 오류를 `.catch(logger.error)`로 흡수하는 변경으로 `failFirstSegmentSetup` 실패 시 Execution row가 FAILED로 마킹되지 않고 PENDING/RUNNING 상태로 잔류 가능. 기존 `recoverStuckExecutions`(30분 heartbeat)가 수습하나 관측성 약화. | `execution-engine.service.ts` diff +2903–+2913 | 현 설계 수용. `failFirstSegmentSetup` 이중 실패 빈도를 메트릭으로 관측하고, 가능하다면 이차 실패 시 best-effort DB UPDATE(execution status → FAILED) 고려. |
| 11 | Documentation | `driveResumeDetached` 메서드명이 "detached(비동기 분리)" 의미를 함의하나 D6 full B3 이후 실제로는 caller가 await하는 동작으로 변경됨 — 메서드명과 동작 불일치. | `execution-engine.service.ts` 및 관련 JSDoc | plan의 "잔여 doc polish" 항목에 이미 추적됨. 즉각 필수 아님. `driveResumeDetached` JSDoc에 `@deprecated name` 한 줄 추가 또는 plan 추적 유지. |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `as unknown as` 캐스팅으로 private 메서드 접근 — 테스트 관용구로 수용 가능. 보안 취약점 아님. | `execution-engine.service.spec.ts` 전반 | 허용. `FormResumeSubject` 등 헬퍼 타입 분리 시 캐스팅 오류 가능성 감소. |
| 2 | Security | 에러 메시지에 `executionId`·에러 메시지 포함 — 서버사이드 로그에만 기록, 사용자 노출 없음. | `execution-engine.service.ts` catch 블록 | 현재 패턴 적절. 향후 에러 메시지에 PII 포함 가능 경로 주의. |
| 3 | Security | plan 문서의 `e2e ENCRYPTION_KEY` follow-up 언급 — 실제 키 값 없는 TODO 항목. | `plan/in-progress/exec-park-durable-resume.md` | follow-up 완료 시 ENCRYPTION_KEY를 코드·문서에 평문 기록 금지. |
| 4 | Requirement | `driveCallStackResume` 빈 frames 경계값 케이스 (`frames.length === 0`) 테스트 미커버 — `RESUME_CHECKPOINT_MISSING` throw 검증 없음. | `execution-engine.service.spec.ts` W3 블록 | W3에 `frames: []` 케이스 추가 권장. |
| 5 | Requirement | spec §7.5 `driveResumeDetached` JSDoc "void 로(detach) 호출" 잔존 — plan의 "잔여 doc polish" 비차단 항목으로 이미 분리됨. | spec 및 서비스 파일 L1815 JSDoc | 후속 PR에서 일괄 처리 예정. |
| 6 | Testing | `processButtonResumeTurn` 전용 4-branch 단위 테스트 부재 — `processFormResumeTurn`과 대칭하는 버튼 전용 isolated describe 블록 없음. 현재 통합 slow-path 테스트로만 커버. | `execution-engine.service.spec.ts` 전반 | `processButtonResumeTurn — 4 branches` describe 블록 추가 권장. |
| 7 | Testing | 화이트리스트 필터링 로직 검증 누락 — 케이스 (a)에서 허용되지 않은 키가 `interactionData`에서 제거되는지 검증하는 케이스 없음. | `execution-engine.service.spec.ts` lines 282–310 | `formData: { answer: 'yes', injected: '<script>' }` 전달 후 `injected` 키 부재 assert 케이스 추가. |
| 8 | Testing | W6 outer catch 흡수 검증이 `resumeFromCheckpoint` mock으로만 이루어져 pre-drive 단계(rehydrateContext, nodeRepository null) 실패 경로 미커버. | `execution-engine.service.spec.ts` lines 729–791 | `nodeRepository.findOneBy → null` 시나리오 추가 권장. |
| 9 | Testing | W5/W6/W7 테스트가 W3 describe의 `beforeEach`가 만든 `service3`을 암묵적으로 공유 — W3 setup 변경 시 W5~W7 함께 영향. | `execution-engine.service.spec.ts` lines 691, 729, 801 | W5/W6/W7을 독립 describe 블록으로 분리하거나 명시적 공통 헬퍼 사용. |
| 10 | Testing | 매직 문자열 `'waiting_for_input'`·`'form_node'`·`'ai_agent'` 등을 enum 대신 string 리터럴로 사용 — 타입 시스템 보호 없음. | `execution-engine.service.spec.ts` lines 221, 257–258, 669, 766 등 | `NodeExecutionStatus.*`·`ExecutionStatus.*` enum 상수 사용으로 교체. |
| 11 | Side Effect | W7에서 `errorSpy.mockRestore()` 수동 호출 — `afterEach`의 `jest.restoreAllMocks()`와 중복. 무해하나 스타일 불일치. | `execution-engine.service.spec.ts` lines 831–832 | 중복 제거 또는 현행 유지 (무해). |
| 12 | Side Effect | 로그 메시지 `"Rehydration launched (drive detached)"` → `"Rehydration completed (drive awaited)"` 변경 — 운영 모니터링·알람 시스템이 이 문자열을 키로 사용한다면 알람 누락 가능. | `execution-engine.service.ts` line 1881 | 운영 로그 쿼리(Datadog/CloudWatch 등)에서 해당 문자열 패턴 사용 여부 확인 후 필요 시 업데이트. |
| 13 | Documentation | W3/W5/W6/W7 Subject 타입 선언에 `FormResumeSubject`와 달리 `as-unknown-as` 사용 이유 설명 주석 없음. | `execution-engine.service.spec.ts` lines 467–491 등 | 각 Subject 타입 선언 위에 `// Private access via as-unknown-as — 실서비스 타입이 아님.` 한 줄 추가. |
| 14 | Scope | 복수의 SUMMARY 경고 항목(W1·W3·W5·W6·W7)을 단일 커밋에 일괄 처리 — 의도된 warning fix 배치 작업으로 수용 가능. | `execution-engine.service.spec.ts` diff 전체 | 수용. plan 문서 대조로 이번 작업 범위 확인 완료. |
| 15 | Concurrency | 추가된 테스트 코드 전부 Jest 단위 테스트로 동시성 위험 없음. | `execution-engine.service.spec.ts` 전반 | 해당 없음. |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 하드코딩 시크릿·OWASP 취약점 없음. `as unknown as` 캐스팅은 테스트 관용구로 수용. |
| requirement | LOW | SPEC-DRIFT 2건(spec 미구현 메모 잔류), 테스트 메시지 하드코딩 3건(WARNING). |
| scope | NONE | 순수 추가 변경, 기존 코드 수정 없음. |
| side_effect | LOW | `failFirstSegmentSetup` catch 추가로 Execution row FAILED 마킹 누락 가능성(허용 수준). 직접 프로퍼티 재할당 패턴 cleanup 권장. |
| maintainability | MEDIUM | 테스트 모듈 setup 대규모 중복, 숫자 접미어 네이밍, 분산 private-access 타입 선언. |
| testing | LOW | 화이트리스트 필터링 검증 누락, `processButtonResumeTurn` 4-branch 미커버, 빈 frames 엣지케이스 미검증. |
| documentation | LOW | `driveResumeDetached` 메서드명-동작 불일치(plan 추적 중), 운영 로그 문자열 변경 안내 필요. |
| concurrency | NONE | 해당 없음 — 순수 테스트 코드, 런타임 동시성 위험 없음. |

---

## 발견 없는 에이전트

- **scope**: 순수 추가 변경 확인. 기존 코드 수정·범위 일탈 없음.
- **concurrency**: 추가된 코드 전부 Jest 단위 테스트. 동시성 관련 요소 없음.

---

## 권장 조치사항

1. **[SPEC-DRIFT × 2 — project-planner 위임]** `spec/5-system/4-execution-engine.md` L910–914(resume_call_stack 구현 상태 메모) 및 L415/L417(PR-B2b 미적용 메모)을 완료형으로 갱신. 코드 revert 불필요 — spec 갱신만.
2. **[WARNING × 2 — 메시지 하드코딩 취약 결합]** 테스트 케이스 (b)와 W7의 한국어/영문 로그 메시지 의존 assert를 안정적인 error code 또는 구조화 필드 검증으로 교체.
3. **[WARNING — 타입 안전성]** W3 `DriveW3Subject.driveCallStackResume` callStack 타입을 실제 `ResumeCallStack` 타입으로 교체해 silent type mismatch 방지.
4. **[WARNING — 테스트 정리]** W5/W6/W7의 레포지토리 직접 프로퍼티 재할당(`=`)을 `jest.spyOn + afterEach mockRestore` 패턴으로 교체.
5. **[WARNING — 유지보수]** `buildTestModule(overrides?)` 헬퍼 팩토리 추출 및 `ExecutionEngineServicePrivate` 통합 타입 선언 — 테스트 setup 중복 해소. `service2`/`service3` 네이밍 개선.
6. **[INFO — 관측성]** 운영 로그 쿼리에서 `"Rehydration launched (drive detached)"` 패턴 사용 여부 확인 및 필요 시 업데이트.
7. **[INFO — 테스트 보완]** W3 빈 frames 케이스, 화이트리스트 필터링 검증, `processButtonResumeTurn` 4-branch describe 블록 순차 추가.
8. **[INFO — doc polish]** plan의 "잔여 doc polish" 항목(`driveResumeDetached` JSDoc, frontmatter `code:` 등)은 이미 추적 중 — 후속 PR에서 일괄 처리.

---

## 라우터 결정

`routing_status=done` — 모든 reviewer 가 `router_safety` 강제 포함됨.

- **실행(forced)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`, `concurrency` (8명)
- **제외**: 없음
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`