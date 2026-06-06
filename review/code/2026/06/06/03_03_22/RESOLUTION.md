# RESOLUTION — PR-B2 기반 슬라이스 리뷰 (03_03_22)

**대상**: V087 `resume_call_stack` 컬럼 + `ResumeCallStack` 타입 + 엔티티 컬럼 (PR-B2 full durable, D6 의 기반 슬라이스).
**리뷰 결과**: MEDIUM, Critical 2 / Warning 8 / Info 13.
**처리 방침**: 이 커밋은 **더 큰 단일 PR-B2 의 기반 슬라이스**다. 행위 구현(turn-park·중첩 재귀 rehydration·full B3 제거)은 같은 PR 의 후속 커밋으로 이어진다. 따라서 (1) 즉시 정합화가 옳은 것(spec 동기화·상수·명명)은 **지금 fix**, (2) 행위 코드와 함께 와야 하는 것(테스트·e2e·mock·barrel·TODO·§4.x 완료형 flip)은 **같은 PR 내 후속 커밋으로 이월**(deferred-within-PR)하고 plan 에 추적한다.

---

## Critical — 모두 해소 (spec 동기화)

| # | 발견 | 처리 |
|---|------|------|
| C1 | `resume_call_stack` 가 `spec/1-data-model.md §2.13` 미등재 | **fix** — §2.13 Execution 컬럼 표에 `resume_call_stack jsonb NULL`(V087) 행 추가. conversation_thread(V084)/user_variables(V085) 동일 패턴 서술 + D6 목적·NULL 의미·선형 스택 제약 명시. |
| C2 | §6.2 저장 전략·§7.5 rehydration 절차 미반영 | **fix** — (a) §6.2 "waiting_for_input 진입 시" 행에 (e) `resume_call_stack` durable commit 항목 추가, (b) §7.5 에 "중첩 sub-workflow 재개 — resume_call_stack 재귀 재진입(D6)" 절차(버전 가드→outermost→innermost executeInline 재귀→최내층 payload 전달, 완료노드 seed 멱등) 추가, (c) §Rationale 에 D6 항목 추가(`_continuationCheckpoint` 기각·per-node 기각과의 범주 구분, 현 gap 동반 수정). |

---

## Warning

| # | 발견 | 처리 |
|---|------|------|
| W1 | `CALL_STACK_SCHEMA_VERSION` 상수 미정의 + 타입 JSDoc 이 서비스로 forward-ref(의존성 반전) | **fix** — `CALL_STACK_SCHEMA_VERSION = 1` 을 `resume-call-stack.types.ts` 에 export, JSDoc forward-ref 제거(상수가 타입 모듈 소유, 서비스가 import). |
| W2 | fast-path(pendingContinuations)+barrier 이중 경로 잔존 — B3 제거 단일 커밋 권고 | **이월(deferred-within-PR)** — full B3 제거(pendingContinuations/firstSegmentBarriers/firePayload/detached/resolvePending/rejectPending)는 turn-park 전환과 한 덩어리로 후속 커밋. plan PR-B2 설계 6번. |
| W3 | `driveResumeDetached`/`resumeFromCheckpoint` 에 call-stack 재귀 재진입 로직 부재(+TODO 권고) | **이월** — 행위 구현(plan PR-B2 설계 8c). 현재 컬럼은 미사용·NULL 유지라 회귀 없음(I8). gap 은 plan + §Rationale D6 "현 gap 동반 수정"에 명시. |
| W4 | `resume-call-stack.types.spec.ts` 부재 | **이월** — 타입 단위테스트(null/손상/round-trip/참조분리)는 stage/rehydrate 로직과 함께 추가. plan 테스트 항목. |
| W5 | `executions.service.spec.ts` mock 에 `resumeCallStack: null` 미반영 | **이월** — mock 정합은 rehydration 로직 추가 커밋과 함께(그때 silent-bug 위험이 실제화). 현재 미사용이라 무영향. |
| W6 | V087 JSONB round-trip e2e 미비 | **이월** — dockerized e2e(중첩 park→kill→재개 + JSONB round-trip)는 행위 구현과 함께. plan Phase 3. |
| W7 | `version` vs `_resumeCheckpoint.schemaVersion` 명명 불일치 | **의도된 설계(무변경)** — consistency-check 2026-06-06 W6 결정: 두 스키마가 독립 진화하도록 **별도 상수 `CALL_STACK_SCHEMA_VERSION` + 필드 `version`** 으로 의도적 구분(동명 `schemaVersion` 의 우연한 coupling 방지). JSDoc 에 독립성 명시함. |
| W8 | spec-draft frontmatter 누락 의심 | **이미 해소** — `spec-draft-exec-park-b2-durable.md` 에 `worktree/started/owner` frontmatter 존재(consistency 2차 C1 에서 추가, commit 6cf89845). |

---

## Info (선별 처리)

- **I3/I2**: 버전 가드·런타임 스키마 검증 → 이월(stage/rehydrate 구현 시 버전 가드 + frames 유효성 검증). §Rationale/§7.5 에 버전 가드 설계 명시함.
- **I4**: barrel `index.ts` → 이월(소비자 생기는 구현 커밋과 함께).
- **I5**: 선형 스택 런타임 assert → 이월(`stageResumeCallStack` 헬퍼에 `recursionDepth` 단조·깊이 cap assert).
- **I7**: §4.x 배너가 "PR-B2 미적용"(turn-park 기준)으로 interim 유지 — **의도**. turn-park 행위 구현 커밋에서 완료형 flip(현재는 컬럼만이라 over-claim 방지). 이는 PR-B1 정직화(doc PR #486)와 일관.
- **I8**: `stageDurableResumeSnapshot` 가 resumeCallStack 미세트(현재 NULL) — 회귀 없음 확인. 구현 시 중첩 깊이>0 분기 추가.
- **I9/I13**: 동시성·유저가이드 리뷰 → 행위 구현(turn-park/barrier 제거) 완료 시점 재검토.

---

## 빌드/테스트
- `nest build`(tsconfig.build.json) **통과** — 기반 슬라이스(컬럼+타입+상수) src 클린 컴파일.
- 기존 `*.spec.ts` 의 tsc 에러(alerts/auth/slack 등)는 **본 변경과 무관한 기존 테스트 부채**(symlink node_modules 6/3 vs source 6/6, `tsc -p tsconfig.json` 이 spec 포함 시 노출). 본 슬라이스 파일을 언급하는 에러 0건.
- TEST WORKFLOW(jest)·dockerized e2e 는 행위 구현 커밋과 함께 수행(이월) — 현재 슬라이스는 런타임 코드 없음(DDL+데코레이터+순수 타입+상수).

## 추적
plan `exec-park-durable-resume.md` PR-B2 설계(1~8) + Phase 3 가 이월 항목(W2~W6, I2~I5, §4.x flip)을 같은 PR 내 후속 커밋으로 추적한다.
