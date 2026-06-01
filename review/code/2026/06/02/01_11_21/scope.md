# 변경 범위(Scope) 리뷰

## 작업 의도

`continuation worker concurrency` 를 env 변수(`CONTINUATION_WORKER_CONCURRENCY`)로 설정 가능하게 하는 것.
구체적으로: `resolveContinuationWorkerConcurrency()` 파서 함수 추가 + `@Processor` 데코레이터 주입 + spec/env.example 등록 + 단위 테스트 추가.

---

## 발견사항

### 파일 1: `codebase/backend/.env.example`

- **[INFO]** 범위 내 변경.
  - 위치: 라인 35–41 (신규 블록)
  - 상세: `CONTINUATION_WORKER_CONCURRENCY` 항목 추가. 작업 의도와 정확히 일치하며, 기존 `# Execution Engine` 섹션 내 자연스러운 위치(SIGTERM_GRACE_MS 바로 다음)에 삽입.
  - 포맷팅·주석 변경 없음. 주변 기존 내용 불변.

---

### 파일 2: `continuation-execution.processor.ts`

- **[INFO]** `@Processor` 데코레이터 변경 — 범위 내.
  - 위치: 라인 41–43 (데코레이터 options 추가)
  - 상세: `concurrency: resolveContinuationWorkerConcurrency()` 주입. 작업 의도의 핵심 변경.

- **[INFO]** 주석 변경 — 범위 내.
  - 위치: 라인 303 ("단일 consumer" → "consumer"), 라인 306–308 (동시성 설명 2행 추가)
  - 상세: "단일 consumer" 표현을 "consumer" 로 수정한 것과 동시성 설명 추가는 데코레이터 변경의 직접적 설명이므로 범위 내.
  - 의미 없는 포맷팅 변경 없음.

- **[INFO]** 임포트 변경 — 범위 내.
  - 위치: 라인 294
  - 상세: `resolveContinuationWorkerConcurrency` 추가 임포트. 신규 사용처에 대한 필수 임포트.

---

### 파일 3: `continuation-execution.queue.ts`

- **[INFO]** `DEFAULT_CONTINUATION_WORKER_CONCURRENCY` 상수 추가 — 범위 내.
  - 위치: 라인 515
  - 상세: 기본값 상수를 별도 export 로 선언. 테스트 파일에서 단언에 사용(값 중복 방지 목적). 작업 의도에 명시된 구현 패턴과 일치.

- **[INFO]** `resolveContinuationWorkerConcurrency` 함수 추가 — 범위 내.
  - 위치: 라인 528–539
  - 상세: 작업 의도의 핵심 구현. DLQ config 의 정규식 선검증 규약과 동일 패턴 — 기존 코드베이스 관행을 따른 것으로 불필요한 리팩토링 없음.

- **[INFO]** 기존 코드 무변경 확인.
  - `buildContinuationJobId`, `CONTINUATION_QUEUE_DEFAULT_OPTS`, `ContinuationPayload`, `RetryLastTurnContinuationPayload`, `ContinuationJob` 타입 및 상수 — 전혀 수정 없음.

---

### 파일 4: `plan/in-progress/continuation-resume-optional-followups.md`

- **[INFO]** 범위 내 변경.
  - 위치: frontmatter (`worktree`, `branch`, `status`) + 해당 항목 체크박스 상태 변경
  - 상세: backlog → in-progress 승격 + 완료 항목([x]) 으로 표시. CLAUDE.md plan 라이프사이클 규약에 따른 정상 업데이트. 완료되지 않은 하위 항목("멀티 인스턴스 double-drive optimistic lock")은 그대로 [ ] 유지 — 범위 외 작업을 완료 표시하지 않음.

---

### 파일 5: `spec/5-system/4-execution-engine.md`

- **[INFO]** §7.4 표 신규 행 추가 — 범위 내.
  - 위치: 라인 781
  - 상세: `| Worker 동시성 | CONTINUATION_WORKER_CONCURRENCY ...` 행. 작업 의도의 "spec §7.4 등록" 항목과 일치.

- **[INFO]** §11 config 표 신규 행 추가 — 범위 내.
  - 위치: 라인 789
  - 상세: `| CONTINUATION_WORKER_CONCURRENCY | 1 | ...` 행. 작업 의도의 "spec §11 config 표 등록" 항목과 일치.

- **[INFO]** 기존 spec 내용 무변경 확인.
  - 변경된 두 행 외 나머지 spec 전체 — 수정 없음. 불필요한 리팩토링, 포맷팅 정리 없음.

---

### 파일 6: `continuation-execution.queue.spec.ts` (신규)

- **[INFO]** 신규 테스트 파일 — 범위 내.
  - 위치: 파일 전체
  - 상세: `resolveContinuationWorkerConcurrency` 에 대한 단위 테스트. 작업 의도의 "테스트" 항목에 명시된 케이스(양수 / 미설정 / 빈값 / 비숫자·0·음수·소수·공학표기 fallback / trim)를 빠짐없이 커버.
  - 테스트 범위가 신규 함수에만 집중. 기존 함수(`buildContinuationJobId` 등) 는 건드리지 않음.

---

## 요약

6개 파일 전체에 걸쳐 변경이 작업 의도(`continuation worker concurrency env 설정화`)의 경계 안에 정확히 위치한다. 핵심 구현(파서 함수 + 데코레이터 주입), spec 두 섹션 등록, env.example 등록, 단위 테스트, plan 상태 갱신 — 모두 plan 문서에 명시된 항목과 1:1 대응된다. 의도하지 않은 리팩토링, 포맷팅 변경, 무관 기능 추가, 관련 없는 파일 수정은 발견되지 않았다.

## 위험도

NONE
