# 요구사항(Requirement) Review

## 대상

- `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts` — 클래스 JSDoc 주석 교체 (comment-only)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `segmentStartMs` 필드 JSDoc 주석 중 1줄 정정 (comment-only)
- `plan/in-progress/exec-intake-queue-impl.md` — PR4 항목에 "후속 candidate(미확정)" 메모 추가 (plan hygiene)

세 파일 모두 실행 코드 변경 없음(순수 문서/주석 정정). 목적은 spec 이 서술하던 미구현 Phase-1 Redis 실행상태 모델("허구") 을 실제 아키텍처(in-memory segment-local + PostgreSQL durable + §7.5 rehydration) 로 코드 주석을 정합화하는 것.

## 검증 방법

1. `spec/5-system/4-execution-engine.md` 를 Grep/Read 하여 §6.2 저장 전략 표, §9.2 Redis 키 표, §Rationale "실행 컨텍스트 in-memory + DB durable — Redis context store 미채택" (line 1417-1424), §Rationale "Graceful Shutdown … under-count 허용" + 2026-07-04 정정 문단 (line 1407-1415) 을 원문 대조.
2. `spec/conventions/execution-context.md` 원칙 4 (`_contextKey`) 대조.
3. 동일 세션에서 만들어진 spec-drift 커밋 `47307a5d7`(`docs(spec): 04 execution-engine — C-3 실행 컨텍스트 in-memory 정직화`) 의 diff 를 확인 — 이 리뷰 대상 diff 와 완전히 동일한 변경 집합(spec 본문 + 코드 주석 2곳 + plan hygiene)임을 확인.
4. `plan/in-progress/refactor/06-concurrency.md` C-3 항목과 `plan/in-progress/exec-intake-queue-impl.md` PR3/PR4 항목이 spec 서술과 모순 없이 정합함을 확인.

## 발견사항

### 파일 1 — execution-context.service.ts 클래스 주석

- **[INFO]** spec 본문과 line-level 완전 일치
  - 위치: `execution-context.service.ts:108-124` (신규 JSDoc)
  - 상세: 주석의 각 주장이 spec 원문과 1:1 대응한다 — "인스턴스-로컬 Map" ↔ spec §6.2 표 "인스턴스-로컬 in-memory `Map<contextKey, ExecutionContext>`" (line 777); "park(=세그먼트 종료, full B3)·완료 시 소멸" ↔ 동일 표 문구; "durable commit 된 PostgreSQL 컬럼(`Execution.conversation_thread`/`user_variables`/`resume_call_stack`, `NodeExecution.outputData`, `execution_node_log`)" ↔ spec §6.2 표 "waiting_for_input 진입 시" 행(line 780) 열거와 정확히 일치(5개 항목 모두 대응); "§7.5 rehydration 이 재구성" ↔ 동일 표 문구; "Redis context store 를 두지 않는다 — park-release 모델과 이중화(진실 갈림) 위험, cross-instance 는 §4.2 jobId dedup + §7.4/§7.5 rehydration 으로 이미 해소" ↔ spec §Rationale (line 1421) "(a) park-release 모델과 이중화 … (b) cross-instance 는 이미 아키텍처로 해소 — §4.2 jobId=executionId dedup … §7.4/§7.5" 문구와 표현까지 거의 동일. SoT 각주(`spec/5-system/4-execution-engine.md §6.2/§9.2/§Rationale`, `conventions/execution-context.md`)도 실제로 해당 문서·섹션에 정확히 존재.
  - 상세(부가): §9.2 "실행 상태는 Redis 키가 아니다 (Phase-1 설계 대체)" 배너(line 1120)도 동일 주장을 재확인 — 이전 주석의 "In production, this would be backed by Redis." 는 §9.2 가 명시하는 "구현되지 않았고 코드에 존재하지 않는" 옛 설계였음을 spec 이 이제 명확히 정정한 상태이며, 코드 주석이 그 정정을 정확히 반영.

### 파일 2 — execution-engine.service.ts segmentStartMs 주석

- **[INFO]** spec §Rationale 정정 문단과 line-level 일치
  - 위치: `execution-engine.service.ts:354-357`
  - 상세: "PR4 stalled-job 재배달 + 세그먼트-start 영속 구현 시 flush 훅 추가를 검토한다 (PR3 제어된 re-drive 는 세그먼트-start 를 영속하지 않아 under-count 미해소 — spec §Rationale … 2026-07-04 정정)" 은 spec `4-execution-engine.md` line 1415 "정정 (PR3, 2026-07-04): 이전 서술은 이 under-count 를 'PR3 에서 자연 해소' 로 예고했으나, PR3 의 제어된 re-drive 는 세그먼트-start 를 영속하지 않으므로 under-count 를 해소하지 않는다" 및 line 1413 "세그먼트-start 영속이 도입되는 PR4(BullMQ stalled 재배달 + 관측성)에서 해소 예정" 과 정확히 대응. 이전 주석("PR3 stalled-job 재배달 구현 시 세그먼트 flush 훅 추가를 검토한다")은 PR3 실제 스코프(크래시 재개, stalled 재배달 아님)와 어긋나는 stale 서술이었고, 신규 주석이 이를 올바르게 PR4 로 재귀속시킴 — 함수/필드명·주석 의도가 실제 구현(§7.1 PR4 target 표, line 823-827)과 일치.

### 파일 3 — exec-intake-queue-impl.md PR4 후속 candidate 메모

- **[INFO]** plan hygiene 갱신이 spec 정정과 정합
  - 위치: `plan/in-progress/exec-intake-queue-impl.md:381`
  - 상세: 추가된 "후속 candidate(미확정): 세그먼트-start 영속(`segmentStartMs` in-memory → Redis/DB) … PR3(#795)는 이를 해소하지 않음(re-scoped=크래시 re-drive). refactor 06 C-3 정직화(2026-07-04)가 이 candidate 를 여기로 이관." 은 spec line 1424 "세그먼트-start 영속은 미확정 후속 candidate(PR4 stalled 재배달 인프라와 함께 검토 …)" 및 `plan/in-progress/refactor/06-concurrency.md` C-3 항목(line 69, 72)의 완료 기록과 상호 참조가 정확하다. 3파일(spec 본문·두 코드 주석·plan hygiene)이 서로 모순 없이 동일한 사실(“PR3 는 under-count 미해소, PR4 candidate”)을 반복 서술.

### 회귀·기능 관련 검증

- **[INFO]** 실행 코드 변경 없음 — 회귀 위험 0
  - 상세: 두 `.ts` 파일의 diff 는 모두 `/** ... */` JSDoc 블록 내부이며 `@Injectable()` 클래스 바디, 메서드 시그니처, 로직 분기, 반환값 등 실행 가능 코드는 diff 범위 밖에서 전혀 변경되지 않았다. `createContext`/`setNodeOutput`/`deleteContext` 등 기존 동작(엣지 케이스 처리, 에러 throw, no-op 정책)은 그대로 유지.
  - TODO/FIXME 스캔: 두 파일 전체에서 신규 TODO/FIXME/HACK/XXX 도입 없음. 기존 `execution-engine.service.ts:3008` 의 `TODO(PR2): trigger type threading` 은 이번 diff 범위 밖의 pre-existing 항목.

## 요약

세 파일 모두 실행 로직 변경이 없는 순수 문서/주석 정정(spec-drift cleanup)이며, 세션 내 별도 커밋(`47307a5d7`, `docs(spec): 04 execution-engine — C-3 실행 컨텍스트 in-memory 정직화`)으로 이미 갱신된 spec 본문(§6.2 저장 전략 표, §9.2 Redis 키 표, 신규 §Rationale "실행 컨텍스트 in-memory + DB durable — Redis context store 미채택", "Graceful Shutdown … under-count 허용" 정정 문단)과 line-level 로 완전히 일치한다. 이전 주석이 서술하던 "Phase 1, production 은 Redis 로 백업" 및 "PR3 stalled-job 재배달"은 spec 이 이미 허구/오기로 판정한 서술이었고, 신규 주석은 그 정정된 사실(in-memory segment-local + DB durable + §7.5 rehydration, PR4 세그먼트-start 영속 candidate)을 정확히 반영한다. plan hygiene 항목도 spec·plan 간 교차 참조가 모순 없이 성립한다. Critical/Warning 급 이슈 없음.

## 위험도

NONE
