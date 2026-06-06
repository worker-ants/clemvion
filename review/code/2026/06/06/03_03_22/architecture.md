# 아키텍처(Architecture) 코드 리뷰

**대상**: exec-park-durable-resume PR-B2 준비 커밋 (V087 마이그레이션 + ResumeCallStack 타입 + 엔티티 컬럼 + 플랜/리뷰 문서)
**날짜**: 2026-06-06

---

## 발견사항

### [INFO] ResumeCallStack 타입 모듈 위치 — 정합성 및 확장성 양호

- 위치: `/codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts`
- 상세: `shared/execution-resume/` 라는 독립 모듈로 타입을 격리한 것은 `shared/conversation-thread/`(V084)와 동일한 패턴을 따른다. 두 durable-park 스냅샷 타입(`ConversationThread`, `ResumeCallStack`)이 같은 공유 레이어에 놓여 모듈 경계가 일관되고, 향후 `shared/execution-resume/` 아래에 관련 헬퍼·검증 함수를 추가할 수 있는 확장 지점이 열려 있다. 단일 책임 원칙(SRP) 관점에서 타입 정의가 엔티티/서비스와 분리된 것은 긍정적이다.
- 제안: 현행 유지. 추후 PR-B2 구현 시 `resume-call-stack.types.ts`와 함께 유효성 검증 함수(`isValidResumeCallStack`)나 버전 상수(`CALL_STACK_SCHEMA_VERSION`)를 같은 모듈 디렉터리에 두면 모듈 응집도가 더 높아진다.

---

### [WARNING] CALL_STACK_SCHEMA_VERSION 상수가 타입 파일에 선언되지 않고 서비스에 의존 — 추상화 일관성 갭

- 위치: `/codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts` L31-33 주석 및 `execution-engine.service.ts` L284 (`CHECKPOINT_SCHEMA_VERSION` 선언 패턴 참조)
- 상세: `ResumeCallStack.version` 필드는 주석에서 "`CALL_STACK_SCHEMA_VERSION`(execution-engine.service.ts)"를 참조한다고 명시하지만, 현재 커밋에서 `CALL_STACK_SCHEMA_VERSION` 상수 자체는 `execution-engine.service.ts`에 아직 선언되어 있지 않다(grep 결과 미발견). `CHECKPOINT_SCHEMA_VERSION`은 서비스 내부 `const`로 선언돼 타입 모듈과 물리적으로 분리되어 있다. 이 패턴이 반복되면 타입 인터페이스(`ResumeCallStack`)가 정의하는 `version: number`의 허용 범위/의미를 소비자가 직접 찾아야 한다. 의존성 역전(DIP) 관점에서, 공유 타입 모듈이 소비자 서비스의 내부 상수를 주석으로만 역참조하는 것은 추상화 레이어가 역전된 형태다.
- 제안: `CALL_STACK_SCHEMA_VERSION` 상수를 `shared/execution-resume/resume-call-stack.types.ts`(또는 같은 디렉터리의 `resume-call-stack.constants.ts`)에 export하고, `execution-engine.service.ts`가 이를 import해서 사용하도록 한다. `CHECKPOINT_SCHEMA_VERSION`도 동일하게 `shared/execution-resume/`로 이전하거나, 최소한 `resume-call-stack.types.ts`에서 명시적으로 상수를 정의해 주석 역참조를 코드 종속성으로 격상시킨다.

---

### [INFO] ResumeCallStack 스키마 — 선형 스택 가정이 타입으로 강제되지 않음

- 위치: `/codebase/backend/src/shared/execution-resume/resume-call-stack.types.ts` L117-141
- 상세: 주석에서 "컨테이너(Loop/ForEach/Map/Parallel) body의 blocking은 §3.2로 금지 → 선형 스택만"이라고 명시하지만, 타입 자체는 `frames: ResumeCallStackFrame[]`로 순서 이외의 제약이 없다. `recursionDepth`가 각 프레임에 있어 단조 증가를 기대하지만 타입 시스템으로 보장되지 않는다. 이는 개방-폐쇄 원칙(OCP) 관점에서 "현재 spec 제약이 느슨한 타입으로 표현되어 future invalid state가 런타임까지 미탐지"될 수 있음을 의미한다.
- 제안: 현재 단계(타입 정의만)에서는 허용 가능하다. PR-B2 구현 시 `stageResumeCallStack` 헬퍼 함수에서 `recursionDepth` 단조 증가 검증과 최대 깊이 가드를 추가하고, 그 제약을 주석이 아닌 런타임 assert로 문서화한다.

---

### [INFO] Execution 엔티티의 durable 스냅샷 컬럼 군집화 — 응집도 적절, 레이어 책임 명확

- 위치: `/codebase/backend/src/modules/executions/entities/execution.entity.ts` L81-139
- 상세: `conversation_thread`(V084) → `user_variables`(V085) → `resume_call_stack`(V087) 세 JSONB 컬럼이 "durable park 스냅샷" 역할로 엔티티에 일관되게 추가됐다. 컬럼 배치 순서가 도입 순서와 일치하고, 각 컬럼 주석이 V번호·spec 섹션·소비처(`§7.5 rehydration`)를 명시해 데이터 레이어 책임이 명확하다. API DTO 화이트리스트 배제가 주석으로 명시된 것도 긍정적(프레젠테이션 레이어 누출 방지). 엔티티 자체가 `ResumeCallStack` 타입을 `import type`으로 가져오는 것은 데이터 레이어가 공유 타입 레이어에만 의존하게 하여 순환 참조를 방지한다.
- 제안: 현행 유지.

---

### [WARNING] ExecutionEngineService 내 fast-path와 slow-path 공존 — 과도기 이중 경로가 아키텍처 복잡도 유발

- 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L732-798 (`pendingContinuations`, `firstSegmentBarriers`), L1022-1029 (`applyContinuation` 분기), L1037-1049 (`applyCancellation` 분기)
- 상세: 현재 `applyContinuation`은 `pendingContinuations.has(executionId)`로 fast-path(in-memory 코루틴 직접 resolve)와 slow-path(rehydration) 중 하나를 선택한다. 이 이중 경로는 PR-B2에서 제거 예정(B3)이지만, 현재 커밋은 slow-path용 `resume_call_stack` 컬럼을 추가하면서 fast-path 코드를 그대로 유지한다. 아키텍처 관점에서 한 서비스가 두 재개 전략(코루틴 기반 / durable rehydration)을 동시에 관리하는 것은 단일 책임 원칙(SRP)에서 벗어나며, `PARK_RELEASED` sentinel, `firstSegmentBarriers`, `pendingContinuations` Map의 생명주기가 서비스 전반에 분산돼 있어 이해 부담이 크다. 이는 설계상 의도된 점진적 마이그레이션이므로 Critical은 아니지만, PR-B2(B3)에서의 완전 제거가 이 복잡도를 해소한다.
- 제안: PR-B2 착수 시 `pendingContinuations`, `firstSegmentBarriers`, `resolvePending`, `rejectPending`, `armFirstSegmentBarrier`, `settleFirstSegment`, `signalParkBarrier` 제거를 단일 커밋으로 묶어 fast-path 잔류 코드가 durable 컬럼 추가 후에도 남아있는 기간을 최소화한다. `resumeFromCheckpoint`의 setImmediate 폴링 메커니즘(L1832 주석 "PR-B2 에서 삭제") 도 함께 제거해야 한다.

---

### [INFO] V087 마이그레이션 — 역방향 호환성 설계 적절

- 위치: `/codebase/backend/migrations/V087__execution_resume_call_stack.sql`
- 상세: `resume_call_stack JSONB NULL`로 선언하고, NULL을 "top-level park / park 미경험 / 배포 이전 row"로 명시적으로 정의한 것은 V084/V085의 `conversation_thread`/`user_variables`와 동일한 패턴이다. 기존 row를 수정하지 않으므로 zero-downtime 배포 시나리오에서 rehydration이 NULL을 받아 단일 레벨로 재개하는 폴백이 자연스럽게 성립한다. 데이터 레이어 변경이 비즈니스 레이어와 독립적으로 배포 가능한 구조다.
- 제안: 현행 유지. `COMMENT ON COLUMN` 사용은 DB 스키마 자기 문서화 관점에서 권장된다.

---

### [INFO] shared/execution-resume 모듈 공개 인터페이스 미정의 (index.ts 부재)

- 위치: `/codebase/backend/src/shared/execution-resume/`
- 상세: `conversation-thread/` 모듈 구조를 확인하면 barrel export(`index.ts` 또는 유사)가 있는지 알 수 없으나, `execution-resume/` 디렉터리에는 현재 타입 파일 하나만 있다. 소비자(`execution.entity.ts`)가 내부 경로를 직접 참조한다(`shared/execution-resume/resume-call-stack.types`). 모듈 인터페이스 분리 원칙(ISP) 관점에서 모듈 경계가 느슨하다.
- 제안: PR-B2 구현 시 `shared/execution-resume/index.ts`를 추가해 공개 API를 명시적으로 정의한다. 이는 `shared/conversation-thread/`가 이미 따르고 있을 패턴과 일치시키는 것이다.

---

### [INFO] 순환 의존성 — 없음 확인

- 위치: `shared/execution-resume/` → `executions/entities/execution.entity.ts` → `execution-engine.service.ts`
- 상세: 현재 변경 범위에서 `shared/execution-resume/`는 어떤 모듈도 역참조하지 않는다(`import type`만 export). `execution.entity.ts`는 `shared/execution-resume/`를 `import type`으로 소비하며, `execution-engine.service.ts`는 `ResumeCallStack` 타입을 아직 직접 참조하지 않는다(PR-B2에서 추가 예정). 순환 의존성 없음.
- 제안: PR-B2 구현 시 `execution-engine.service.ts`가 `CALL_STACK_SCHEMA_VERSION`을 `shared/execution-resume/`에서 가져오도록 하면 위 WARNING(상수 역참조)와 함께 해소된다.

---

## 요약

이번 변경은 중첩 sub-workflow durable resume을 위한 `resume_call_stack` JSONB 컬럼(V087), TypeScript 타입(`ResumeCallStack`/`ResumeCallStackFrame`), 엔티티 컬럼 선언으로 구성된다. 아키텍처 관점에서 V084/V085가 확립한 "durable park 스냅샷 = shared 타입 모듈 + JSONB nullable 컬럼 + NULL 폴백" 패턴을 충실히 따르고 있어 모듈 일관성과 역방향 호환성이 양호하다. 핵심 경고는 `CALL_STACK_SCHEMA_VERSION` 상수가 타입 모듈에 정의되지 않고 소비자 서비스를 주석으로만 역참조해 의존성 방향이 반전된 점이며, PR-B2에서 상수를 `shared/execution-resume/`에 선언해 해소할 것을 권장한다. 더 구조적인 경고는 `ExecutionEngineService` 내 fast-path(`pendingContinuations`) + slow-path(rehydration) 이중 재개 경로의 공존인데, 이는 PR-B2(B3) 제거로 해소되므로 현재 과도기 상태에서 수용 가능하다. 전체적으로 점진적 마이그레이션 전략이 레이어 책임 분리를 유지하며 진행되고 있다.

## 위험도

LOW

STATUS: DONE
