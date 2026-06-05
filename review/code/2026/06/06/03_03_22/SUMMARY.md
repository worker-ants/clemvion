# Code Review 통합 보고서

**대상**: exec-park-durable-resume PR-B2 prep — V087 마이그레이션 + ResumeCallStack 타입 + 엔티티 컬럼 + 플랜/스펙/리뷰 문서
**날짜**: 2026-06-06
**세션**: review/code/2026/06/06/03_03_22

---

## 전체 위험도

**MEDIUM** — Critical 2건(spec §2.13/§6.2/§7.5 미갱신으로 spec 단일 진실 원칙 위반), Warning 8건. 코드 인프라 자체는 안전하나 spec 동기화 의무가 미이행된 상태.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| C1 | 요구사항 | `resume_call_stack` 컬럼이 `spec/1-data-model.md §2.13 Execution` 컬럼 표에 누락. `conversation_thread`(V084)·`user_variables`(V085)는 등재됐으나 V087은 미등재. spec-draft C1이 "동반 적용 필수"로 명시했으나 미이행. | `spec/1-data-model.md §2.13` | §2.13 표에 `resume_call_stack | JSONB? | NULL 허용(V087). 중첩 sub-workflow(executeInline) blocking 노드 park 시 호출 체인 durable commit 매체...` 행 추가 |
| C2 | 요구사항 | spec §6.2 저장 전략 표에 `resume_call_stack` 영속 항목 누락, §7.5 rehydration 절차에 "resume_call_stack IS NOT NULL → 재귀 프레임 재진입" 단계 미기재. spec-draft C1("§6.2 저장 전략")·C3("§7.5 rehydration 절차")이 이번 PR에서 동반 적용을 요구했으나 미이행. | `spec/5-system/4-execution-engine.md §6.2, §7.5` | §6.2 저장 표에 `resume_call_stack` 항목 추가, §7.5에 재귀 call-stack 재진입 절차 단계 추가 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | 아키텍처 / 요구사항 / 부작용 | `CALL_STACK_SCHEMA_VERSION` 상수가 타입 파일에 선언되지 않고 `execution-engine.service.ts`에도 미정의. 타입 JSDoc이 "execution-engine.service.ts에 정의될 예정"이라고 역참조하나 실제 상수 없음. 의존성 방향이 반전된 형태이며 향후 구현자를 혼동시킴. | `shared/execution-resume/resume-call-stack.types.ts` L32-33 / `execution-engine.service.ts` | `CALL_STACK_SCHEMA_VERSION = 1`을 `shared/execution-resume/resume-call-stack.types.ts`(또는 동 디렉터리 constants 파일)에 export하고 서비스가 import하도록 역전. `CHECKPOINT_SCHEMA_VERSION`도 동일 모듈로 이전 검토. |
| W2 | 아키텍처 | `ExecutionEngineService` 내 fast-path(`pendingContinuations`) + slow-path(rehydration) 이중 재개 경로 공존. `pendingContinuations`, `firstSegmentBarriers`, `PARK_RELEASED` sentinel 생명주기가 서비스 전반에 분산되어 이해 부담이 큼. PR-B3 제거 예정이나 V087 인프라 추가 후에도 기간이 지속됨. | `execution-engine.service.ts` L732-798, L1022-1049 | PR-B2 착수 시 fast-path 잔류 코드(`pendingContinuations`, `firstSegmentBarriers`, `resolvePending`, `rejectPending`, `armFirstSegmentBarrier`, `settleFirstSegment`, `signalParkBarrier`, setImmediate 폴링) 제거를 단일 커밋으로 묶어 과도기 기간 최소화 |
| W3 | 요구사항 | `driveResumeDetached`/`resumeFromCheckpoint`에 `execution.resumeCallStack`을 읽어 재귀 재진입하는 로직 부재. 현재 중첩 sub-workflow park 후 continuation 도착 시 resumeCallStack을 무시하고 flat 재개 시도. plan에 "인프라 선행, 로직은 PR-B2 구현 단계"가 명시되면 WARNING 유지. | `execution-engine.service.ts` `driveResumeDetached`(L~1912), `resumeFromCheckpoint`(L~1744) | `driveResumeDetached` 상단에 `TODO: PR-B2 call-stack 재귀 재진입 구현 필요` 주석 추가. plan에 명시적으로 범위 기재 |
| W4 | 테스트 | `ResumeCallStack`/`resume_call_stack` 전용 단위 테스트 부재. `conversation-thread.types.spec.ts`에는 null/undefined·손상 데이터·경계값·배열 참조 분리 검증이 있으나, `resume-call-stack.types.spec.ts` 미생성. rehydration 로직 추가 시 미테스트 경로 위험. | `shared/execution-resume/` (테스트 파일 없음) | PR-B2 구현 시 `resume-call-stack.types.spec.ts` 추가: (a) null 입력→기본값, (b) 손상 JSON(frames 배열 아닌 경우, version 없는 경우), (c) frames lossless 복원, (d) 참조 분리 커버 |
| W5 | 테스트 | `executions.service.spec.ts` mock `Execution` 객체에 신규 `resumeCallStack` 필드 미반영. `userVariables`·`conversationThread`와 달리 `resumeCallStack: null` 초기화 누락. 향후 rehydration 로직 추가 시 mock-실제 괴리로 silent bug 가능. | `executions.service.spec.ts` (Execution mock 생성 경로) | mock 객체에 `resumeCallStack: null` 추가해 엔티티 형태와 일치시킴 |
| W6 | 테스트 | V087 마이그레이션(`ALTER TABLE execution ADD COLUMN resume_call_stack JSONB NULL`) 에 대한 e2e/통합 테스트 미비. JSONB nullable 컬럼은 TypeORM의 null vs undefined 처리 차이로 런타임 예기치 않은 동작 가능. | `V087__execution_resume_call_stack.sql` | e2e 테스트: (a) 마이그레이션 후 기존 row `resume_call_stack IS NULL` 확인, (b) `{version:1, frames:[...]}` write-read JSONB round-trip lossless 확인 (V084/V085 패턴 참조) |
| W7 | 유지보수성 | `ResumeCallStack.version` 필드명이 기존 `_resumeCheckpoint.schemaVersion`과 달라 두 독립 버전 상수-필드 대응을 독자가 매번 추론해야 함. | `resume-call-stack.types.ts` L37 | `version` → `schemaVersion`으로 통일(기존 패턴 채택), 또는 JSDoc에 `_resumeCheckpoint.schemaVersion`과 독립임을 명시하고 두 상수를 인접 선언 |
| W8 | 문서화 / 유지보수성 | `plan/in-progress/spec-draft-exec-park-b2-durable.md` frontmatter 누락 가능성(`worktree`/`started`/`owner` 3필드). `plan-frontmatter.test.ts` build guard 위반. consistency-check 02_33_35에서 CRITICAL로 분류됐으나 미해소 여부 상충(requirement reviewer: 해소 확인, documentation/maintainability reviewer: diff 기준 미포함). 실제 파일 상태 직접 재확인 필요. | `plan/in-progress/spec-draft-exec-park-b2-durable.md` 최상단 | 실제 파일 확인 후 미포함이면 frontmatter 추가: `worktree: exec-park-durable-resume`, `started: 2026-06-06`, `owner: planner` |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | 보안 | `resumeCallStack`이 API DTO whitelist 매핑으로 자동 배제. 내부 체인 위상 정보 미노출 확인. NestJS Serialization Interceptor 미적용 경로 잔존 가능성 인식 필요. | `execution-response.dto.ts`, `execution.entity.ts` L88-90 | entity 직렬화 경로 전반을 `@Exclude()` 또는 classTransformer로 커버 보증 (현재 INFO 수준) |
| I2 | 보안 | `ResumeCallStack` 역직렬화 시 런타임 스키마 검증 미구현. DB raw JSONB 단순 캐스팅 시 손상/변조 프레임 처리 위험. `recursionDepth` MAX 가드는 있으나 `workflowId`/`invokerNodeId` 유효성 미확인. | `resume-call-stack.types.ts`, `resumeFromCheckpoint` | park/rehydration 구현 시 Zod 또는 class-validator로 `version` 범위, `frames` 배열 최대 길이, 각 필드 타입 명시 검증 추가 |
| I3 | 보안 | `CALL_STACK_SCHEMA_VERSION` 상수 미구현으로 버전 가드 부재. 미래 버전 불일치 시 `RESUME_INCOMPATIBLE_STATE` 수준 안전 처리 필요. | `resume-call-stack.types.ts` L37, `execution-engine.service.ts` | park 시 버전 스탬프, rehydration 시 버전 초과 시 안전 종결 가드 구현 (`CHECKPOINT_SCHEMA_VERSION` 동일 패턴) |
| I4 | 아키텍처 | `shared/execution-resume/index.ts` barrel export 미생성. 소비자가 내부 경로 직접 참조. `conversation-thread/` 패턴과 불일치. | `shared/execution-resume/` | PR-B2 구현 시 `index.ts` 추가로 공개 API 명시 |
| I5 | 아키텍처 | `ResumeCallStack` 타입이 선형 스택 제약을 타입 시스템으로 강제하지 않음. 주석 서술에만 의존. | `resume-call-stack.types.ts` L117-141 | PR-B2 `stageResumeCallStack` 헬퍼에서 `recursionDepth` 단조 증가·최대 깊이 가드를 런타임 assert로 추가 |
| I6 | 아키텍처 | V087: `JSONB NULL` + NULL fallback 패턴이 V084/V085와 완전히 일관. zero-downtime 배포 안전. | `V087__execution_resume_call_stack.sql` | 현행 유지 |
| I7 | 범위 | `spec/5-system/4-execution-engine.md` §4.3 구현 메모가 "Phase B 완료형"에서 "PR-B2 미적용 과도기"로 되돌려짐. "정직화" 수정이 PR-B2 diff에 혼합됨. | `spec/5-system/4-execution-engine.md` L221, L224 | 이 변경이 "PR-B1 spec 정직화"임을 커밋 메시지·plan에 명기했는지 확인 |
| I8 | 부작용 | `stageDurableResumeSnapshot`이 `resumeCallStack`을 세트하지 않아 중첩 blocking park 시 NULL 유지. PR-B1 이전과 동일 행동, 회귀 없음. | `execution-engine.service.ts` L8819-8825 | PR-B2 구현 시 `stageDurableResumeSnapshot`에 `resumeCallStack` 쓰기 추가 |
| I9 | 유지보수성 | entity 인라인 주석(12줄)이 타입 파일 JSDoc(9줄)과 내용 중복. 타입 설명 변경 시 두 곳 동기화 필요. 코드베이스 기존 관행. | `execution.entity.ts` L128-138 | entity 주석은 핵심 항목만, 세부는 타입 JSDoc으로 위임 고려 |
| I10 | 유지보수성 | `ResumeCallStackFrame.recursionDepth` JSDoc이 "왜 별도 저장인가?" 의문을 남김. "재개 시 복원" 목적이 첫 줄에 없음. | `resume-call-stack.types.ts` L22-27 | "재개 시 프레임별 recursionDepth 복원에 쓴다" 문장을 JSDoc 첫 줄로 올리고 동명 필드 관계 설명은 부연으로 유지 |
| I11 | 테스트 / 문서화 | frontmatter 존재 여부에 대해 reviewer 간 상충. requirement: "존재 확인", maintainability/documentation: "diff 기준 미포함". 실제 파일 상태 직접 재확인 필요. | `plan/in-progress/spec-draft-exec-park-b2-durable.md` | W8과 함께 처리 |
| I12 | 동시성 | 이번 변경에 런타임 동시성 코드 없음. DDL + 엔티티 데코레이터 + 순수 타입. park/rehydration 구현 시 별도 동시성 리뷰 필요. | 전체 diff | PR-B2: 트랜잭션 원자성, call-stack 재귀 재진입과 pendingContinuations fast-path 경합, 버전 미스매치 처리 등 별도 리뷰 |
| I13 | 사용자 가이드 | `resumeCallStack` DTO 미노출, 실행 흐름 변경 이번 범위 밖. `05-run-and-debug/` 문서 동반 갱신 의무 즉시 없음. | `codebase/frontend/src/content/docs/05-run-and-debug/` | PR-B2(turn-park + barrier 제거) 완료 시점에 재검토 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | HIGH | C1(spec §2.13 미갱신), C2(spec §6.2/§7.5 미갱신) — spec 단일 진실 원칙 위반 |
| testing | MEDIUM | W4(rehydration 단위 테스트 미생성), W5(mock 미반영), W6(마이그레이션 e2e 미비) |
| architecture | LOW | W2(fast/slow-path 이중 경로 공존), W1(`CALL_STACK_SCHEMA_VERSION` 추상화 역전) |
| security | LOW | I2(역직렬화 런타임 검증 미구현), I3(버전 가드 미구현) — 실질 위험 낮음 |
| maintainability | LOW | W7(`version` vs `schemaVersion` 혼재), W8(frontmatter 누락 가능성) |
| documentation | LOW | W8(frontmatter 누락 가능성), 핵심 코드 3종 문서화 품질 우수 |
| scope | LOW | I7(§4.3 spec 정직화 수정이 PR-B2 diff 혼합) |

---

## 발견 없는 에이전트

| 에이전트 | 판정 | 비고 |
|----------|------|------|
| database | NONE | JSONB NULL 컬럼 추가 — lock-free, 역방향 호환, 설계 적절 |
| concurrency | NONE | 런타임 동시성 코드 없음 (DDL + 타입 + 엔티티 데코레이터만) |
| side_effect | NONE | 기존 park 경로 변경 없음, DTO 미노출 확인, 순수 인프라 추가 |
| user_guide_sync | NONE | 사용자 가시 API/UI 변경 없음, 실행 흐름 변경은 이번 범위 밖 |

---

## 권장 조치사항

1. **[즉시 — C1]** `spec/1-data-model.md §2.13 Execution` 컬럼 표에 `resume_call_stack` 행 추가 (conversation_thread·user_variables 바로 다음)
2. **[즉시 — C2]** `spec/5-system/4-execution-engine.md §6.2` 저장 전략 표에 `resume_call_stack` 영속 항목 추가, §7.5 rehydration 절차에 재귀 call-stack 재진입 단계 추가
3. **[즉시 — W8]** `plan/in-progress/spec-draft-exec-park-b2-durable.md` 실제 파일 상태 확인 후 frontmatter 미포함이면 추가 (`worktree`, `started`, `owner` 3필드)
4. **[PR-B2 착수 전 — W1]** `CALL_STACK_SCHEMA_VERSION = 1` 상수를 `shared/execution-resume/` 모듈에 export 선언하고 서비스가 import하도록 변경
5. **[PR-B2 착수 전 — W5]** `executions.service.spec.ts` mock Execution 객체에 `resumeCallStack: null` 추가
6. **[PR-B2 구현 시 — W4]** `resume-call-stack.types.spec.ts` 생성: null/손상/정상/참조 분리 4가지 케이스 (`conversation-thread.types.spec.ts` 패턴 준용)
7. **[PR-B2 구현 시 — W6]** e2e 테스트: 마이그레이션 후 기존 row NULL 확인 + JSONB round-trip lossless 확인
8. **[PR-B2 구현 시 — W3]** `driveResumeDetached`/`resumeFromCheckpoint`에 call-stack 재귀 재진입 로직 구현
9. **[PR-B2 구현 시 — I3]** park 시 버전 스탬프, rehydration 시 버전 불일치 안전 종결 가드 구현
10. **[PR-B2/B3 — W2]** fast-path(`pendingContinuations`, `firstSegmentBarriers` 등) 제거를 단일 커밋으로 묶어 이중 경로 공존 기간 최소화

---

## 라우터 결정

라우터 사용됨 (`routing=done`).

**실행** (11명): security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, user_guide_sync

**강제 포함(router_safety)** (8명): database, documentation, maintainability, requirement, scope, security, side_effect, testing

**제외** (3명):

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 해당 없음 (DDL + 타입 추가, 런타임 성능 변경 없음) |
| dependency | 해당 없음 (신규 외부 라이브러리 없음) |
| api_contract | 해당 없음 (외부 API 엔드포인트 변경 없음, resumeCallStack DTO 미노출) |