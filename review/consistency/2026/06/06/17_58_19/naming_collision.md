# 신규 식별자 충돌 검토 결과

검토 대상: `spec/5-system/4-execution-engine.md`
검토 모드: `--impl-prep` (구현 착수 전)
검토 일시: 2026-06-06

---

## 발견사항

### 발견사항 1
- **[WARNING]** `exec-park D6` 레이블이 두 별개 결정에 동시 사용됨

  - target 신규 식별자: `exec-park D6` — `spec/5-system/4-execution-engine.md §7.5` 의 "중첩 sub-workflow blocking durable 영속(call stack 영속화)" 결정 레이블
  - 기존 사용처:
    - `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-polish-080a4d/spec/4-nodes/3-ai/1-ai-agent.md` L750: `D6` 결정 = AI Agent 노드 output 경로 단일화("waiting/resumed messages 를 종결 시점 `output.result.*` 와 단일 경로로 통일")
    - `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-polish-080a4d/spec/4-nodes/3-ai/3-information-extractor.md` L334, L370, L386, L430: 동일 `D6` 레이블로 AI output 단일 경로 결정 참조
    - `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-polish-080a4d/spec/4-nodes/3-ai/2-text-classifier.md` L340, L350: 동일 AI output 단일화 `D6` 참조
  - 상세: `spec/5-system/4-execution-engine.md` 는 §7.5 와 §Rationale 에서 중첩 call stack 영속 결정을 `exec-park D6` 로 표기하면서, 해당 문서 자체가 "(레이블 주의: 본 절의 `exec-park D6` 는 `exec-park-durable-resume` plan 의 결정 D6(중첩 call stack 영속)이며, AI 노드 spec(`1-ai-agent.md` 등)의 동명 `D6`(AI 노드 output 경로 단일화)와 무관하다)"라는 주의 문구를 포함하고 있다. 즉 충돌은 이미 인지된 상태로 spec 에 주석으로 방어됐으나, AI 노드 3개 파일에서 `D6` 가 다른 의미로 다수 사용 중이라 혼동 위험이 실존한다.
  - 제안: AI 노드 spec(`1-ai-agent.md`, `3-information-extractor.md`, `2-text-classifier.md`)의 `D6` 레이블을 `ND-D6` (Node output Decision 6)로 rename 하거나, 실행 엔진의 `exec-park D6` 를 `exec-park D6-stack`(call-stack 영속)처럼 세분화해 양 영역 레이블이 충돌하지 않도록 한다. 현재의 인라인 주의 문구로도 독자 혼동을 차단하기 어렵다.

---

### 발견사항 2
- **[INFO]** `CONTINUATION_SEQ_TTL_SECONDS` — 타 spec 에 미선언, 단일 파일 정의

  - target 신규 식별자: `CONTINUATION_SEQ_TTL_SECONDS` (기본 86400초, §9.2 `exec:cont:seq` TTL)
  - 기존 사용처: 해당 ENV var 는 `spec/5-system/4-execution-engine.md §9.2` 에만 등장. `spec/5-system/16-system-status-api.md`, `spec/5-system/3-error-handling.md`, `.env.example` 등 다른 spec·파일에 선언 없음.
  - 상세: 충돌은 아니나, `CONTINUATION_DLQ_*` 4개 환경변수는 §11 테이블에도 정리돼 있는 반면 `CONTINUATION_SEQ_TTL_SECONDS` 는 §9.2 테이블에만 있고 §11 환경변수 일람에 누락됐다. 미관리 환경변수로 운영 혼선 가능.
  - 제안: `CONTINUATION_SEQ_TTL_SECONDS` 를 §11 환경변수 테이블에 추가해 다른 ENV var 와 동일한 가시성을 부여한다.

---

### 발견사항 3
- **[INFO]** `exec:run:seq` 키 패턴 — "PR1 미사용" 이지만 §9.2 테이블에 열거

  - target 신규 식별자: `exec:run:seq:<executionId>` Redis 키 패턴 (§9.2, PR3/PR4 활성화 예정)
  - 기존 사용처: 타 spec 파일 내 중복 선언 없음. 충돌 없음.
  - 상세: 현재 PR1 은 이 키를 사용하지 않으나, §9.2 테이블에 기재돼 있어 구현자가 "현재 사용 중"으로 오인할 가능성이 있다. `CONTINUATION_SEQ_TTL_SECONDS` 준용이라고만 적혀 있고 구체 기본값은 "구현 시 결정"으로 비어 있다.
  - 제안: 해당 행에 `(Planned, PR3/PR4)` 태그를 명시하거나 별도 "미래 예약 키" 섹션으로 분리해 현행 키와 구분한다. 현재도 `(PR3/PR4 활성화)` 표시가 있어 낮은 위험이나, 구현 시 혼동 최소화를 위해 명시 강화를 권장한다.

---

### 발견사항 4
- **[INFO]** `EXECUTION_RUN_WORKER_CONCURRENCY` — `spec/5-system/16-system-status-api.md` 와 `spec/5-system/4-execution-engine.md §11` 양쪽에 언급, 일관성 확인 필요

  - target 신규 식별자: `EXECUTION_RUN_WORKER_CONCURRENCY` (§4.3, §11)
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-polish-080a4d/spec/5-system/16-system-status-api.md` L22: "1 (env `EXECUTION_RUN_WORKER_CONCURRENCY`)" 로 참조
  - 상세: 두 파일이 동일 식별자를 동일 의미로 사용하고 있어 충돌 없음. 단, `16-system-status-api.md` 가 기본값을 "1"로 고정 표기한 반면, `4-execution-engine.md §11` 도 기본 1로 정의하여 현재 일치한다. 향후 기본값 변경 시 두 파일이 drift 할 수 있다.
  - 제안: `16-system-status-api.md` 의 기본값 표기를 하드코딩 `1` 에서 "env 기본값(§4.3 참조)"처럼 cross-link 방식으로 변경하면 drift 위험을 줄일 수 있다. 현재 충돌은 없으므로 낮은 우선순위.

---

## 요약

`spec/5-system/4-execution-engine.md` 가 도입하는 신규 식별자들(DB 컬럼 `resume_call_stack`/`conversation_thread`/`user_variables`, 함수명 `driveCallStackResume`/`driveResumeFrame`/`processAiResumeTurn`, 환경변수 `EXECUTION_MAX_ACTIVE_RUNNING_MS`/`EXECUTION_RUN_WORKER_CONCURRENCY`/`CONTINUATION_DLQ_*`, 에러코드 `EXECUTION_TIME_LIMIT_EXCEEDED`, Redis 키 `exec:cont:seq`/`exec:run:seq`, BullMQ 큐 `execution-run`/`execution-continuation`, 상수 `CALL_STACK_SCHEMA_VERSION`/`PARK_RELEASED`/`ParkReleaseSignal`) 중 타 spec 파일과 충돌하는 항목은 없다. 에러코드·ENV var·API endpoint·이벤트명 측면에서 CRITICAL 또는 실질 WARNING 수준 충돌은 발견되지 않았다. 유일한 주의사항은 `exec-park D6` 레이블이 AI 노드 spec(`1-ai-agent.md` 등) 의 `D6`(output 단일화 결정)와 동일 이름을 공유하는 점으로, 대상 문서 자체가 인라인 주의 문구를 두었으나 혼동 리스크가 낮지 않아 개선을 권장한다.

## 위험도

LOW
