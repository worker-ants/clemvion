# 문서화(Documentation) Review — execution-context.service.ts / execution-engine.service.ts JSDoc 정정 검증

## 리뷰 대상

1. `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts` — `ExecutionContextService` 클래스 주석 정정
2. `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `segmentStartMs` 필드 주석 정정 (PR3/PR4 재스코핑 반영)
3. `plan/in-progress/exec-intake-queue-impl.md` — PR4 항목에 세그먼트-start 영속 candidate 이관 note 추가

## 검증 방법

- `spec/5-system/4-execution-engine.md` §6.2(저장 전략 표)·§9.2(Redis 키 표)·§Rationale "Graceful Shutdown … under-count 허용"·§Rationale "실행 컨텍스트 in-memory + DB durable — Redis context store 미채택" 원문 대조.
- `spec/conventions/execution-context.md` 원칙 4·§Rationale ( `_contextKey` 관련 근거) 대조.
- `plan/in-progress/spec-draft-c3-context-drift.md` (이번 정정을 설계한 draft) 의 Δ4/Δ5/Rationale 대조 — 코드 주석 변경이 이 draft 가 명시한 의도와 정확히 일치하는지.
- `plan/in-progress/refactor/06-concurrency.md` C-3 항목 (완료 기록 + stale 가정 정정 기록) 대조.

## 발견사항

### 검증 결과: 두 JSDoc 정정 모두 spec 과 정확히 일치, stale 표현 없음

- **[INFO]** `execution-context.service.ts` 클래스 주석 — spec 대조 결과 정확
  - 위치: `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts:107-123`
  - 상세: 신규 주석의 핵심 주장 4가지 — (1) 세그먼트-로컬 in-memory Map, (2) park/완료 시 소멸, (3) durable 컬럼 목록(`Execution.conversation_thread`/`user_variables`/`resume_call_stack`, `NodeExecution.outputData`, `execution_node_log`), (4) Redis context store 미채택 근거(park-release 이중화 위험 + §4.2 jobId dedup/§7.4·§7.5 rehydration 로 cross-instance 기해소) — 모두 `spec/5-system/4-execution-engine.md` §6.2 표(라인 777/780)·§Rationale "실행 컨텍스트 in-memory + DB durable"(라인 1417-1424) 원문과 표현·근거 순서까지 일치한다. `SoT: spec/5-system/4-execution-engine.md §6.2/§9.2/§Rationale ... , conventions/execution-context.md` 인용도 유효한 앵커(§6.2/§9.2/§Rationale 섹션이 실존, conventions 문서도 원칙 4 로 `_contextKey` 근거를 별도 보유)다.
  - 상세(추가): 기존 주석의 "In production, this would be backed by Redis." 는 미구현·미채택으로 확정된 Phase-1 설계를 여전히 "향후 계획"인 것처럼 서술해 실제로 stale 했던 부분 — 이번 정정으로 해소됨. 오탐 아님, 실제 발견된 개선.
  - 제안: 없음 (수정 자체가 이미 올바름).

- **[INFO]** `execution-engine.service.ts` `segmentStartMs` 주석 — PR3/PR4 재스코핑 반영 정확
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:476-357` 부근 (`maxActiveRunningMs`/`segmentStartMs` 필드 JSDoc)
  - 상세: 이전 주석 "PR3 stalled-job 재배달 구현 시 세그먼트 flush 훅 추가를 검토한다" 는 PR3 가 "크래시 RUNNING checkpoint 재개"로 재스코핑(`exec-park-durable-resume.md`, 2026-07-04 완료)되며 stalled-job 재배달 자체가 PR4 로 남아 stale 해졌다. 신규 주석은 "**PR4** stalled-job 재배달 + 세그먼트-start 영속 구현 시 flush 훅 추가를 검토한다 (PR3 제어된 re-drive 는 세그먼트-start 를 영속하지 않아 under-count 미해소 — spec §Rationale 'Graceful Shutdown … under-count 허용' 2026-07-04 정정)" 으로 정정 — spec 본문 `spec/5-system/4-execution-engine.md` 라인 1415 `> **정정 (PR3, 2026-07-04)**: 이전 서술은 이 under-count 를 "PR3 에서 자연 해소" 로 예고했으나, PR3 의 제어된 re-drive 는 세그먼트-start 를 영속하지 않으므로 under-count 를 해소하지 않는다` 와 문구·날짜·귀결 모두 정확히 일치한다.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/exec-intake-queue-impl.md` PR4 note 추가 — 3개 문서(spec/코드주석/plan) 간 일관성 확인
  - 위치: `plan/in-progress/exec-intake-queue-impl.md:380`
  - 상세: PR4 항목에 추가된 "후속 candidate(미확정): 세그먼트-start 영속(`segmentStartMs` in-memory → Redis/DB) … PR3(#795)는 이를 해소하지 않음(re-scoped=크래시 re-drive). refactor 06 C-3 정직화(2026-07-04)가 이 candidate 를 여기로 이관." 은 `plan/in-progress/refactor/06-concurrency.md` C-3 완료 기록(라인 69-70, "코드 주석 정정 … PR3(#795)는 크래시 RUNNING re-drive 로 re-scoped 됐고 세그먼트-start 를 영속하지 않는다") 및 `plan/in-progress/spec-draft-c3-context-drift.md` Rationale ("segmentStartMs 영속 = 미확정 후속 … 옛 06-concurrency C-3 plan 의 'PR3 에서 자연 해소' 는 stale … plan hygiene 으로 06-concurrency C-3 + exec-intake PR4 candidate note 를 함께 갱신한다")과 완전히 정합한다. 3개 문서(spec §Rationale, 코드 주석 2건, plan 2건)가 동일한 사실(PR3 는 세그먼트-start 미영속, candidate 는 PR4 로 이관)을 일관되게 기술 — 문서 드리프트 없음.
  - 제안: 없음.

- **[INFO]** 잔여 stale 표현 전체 검색 — 발견 없음
  - 위치: `codebase/backend/src`, `spec/5-system/4-execution-engine.md`, `plan/in-progress/*.md` 전체
  - 상세: `grep -rn "PR3 재개\|PR3.*자연 해소\|PR3 stalled-job 재배달 구현 시"` 실행 결과, 이번에 정정된 두 지점 외에는 옛 "PR3 에서 자연 해소" 표현이 코드·spec 본문에 잔존하지 않음. 유일하게 매치된 곳은 `plan/in-progress/spec-draft-c3-context-drift.md`(이번 정정을 설계한 draft 문서 자체, "stale 였다"를 서술하는 맥락)와 spec 본문의 "정정 (PR3, 2026-07-04)" 배너(의도적으로 이전 서술을 인용해 정정하는 배너)뿐이다.
  - 제안: 없음.

## 요약

`execution-context.service.ts` 클래스 주석과 `execution-engine.service.ts` `segmentStartMs` 필드 주석 두 곳 모두 spec 본문(`spec/5-system/4-execution-engine.md` §6.2/§9.2/§Rationale) 및 관련 plan 문서(`spec-draft-c3-context-drift.md`, `refactor/06-concurrency.md`, `exec-intake-queue-impl.md`)와 문구·날짜·귀결이 정확히 일치하며, 기존에 실제로 stale 했던 서술("Redis 로 백업될 예정", "PR3 에서 자연 해소")을 올바르게 교정했다. 3개 파일(spec, 코드 주석 2건, plan 2건) 간 교차 검증 결과 드리프트나 모순이 발견되지 않았고, 인용된 spec 섹션 앵커(§6.2/§9.2/§Rationale, conventions 원칙 4)도 모두 실존해 유효하다. 추가 조치가 필요한 문서화 이슈는 없다.

## 위험도

NONE
