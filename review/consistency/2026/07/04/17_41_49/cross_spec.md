# Cross-Spec 일관성 Check — PR2b 동시성 cap enforcement (impl-done)

## 메타
- 검토 모드: --impl-done
- diff-base: origin/main (payload 가 `spec/5-system/1-auth.md` 로 mis-scope 되어 있어, 계약대로 `git -C <worktree> diff origin/main` 로 실제 변경분 재산출)
- HEAD: `impl-concurrency-cap-enforce-54f29a` (commits `009022ebb`..`5c3f7980b`)
- 대상 spec: `spec/5-system/4-execution-engine.md` §8, `spec/1-data-model.md` §2.13/§2.2/§2.4, `spec/5-system/3-error-handling.md` §1.4/§1.5, `spec/5-system/6-websocket-protocol.md` §4.1

## payload 스코프 참고
전달된 payload 는 `spec/5-system/1-auth.md`(인증/RBAC 문서) 본문을 그대로 실어 target 을 잘못 지목했다. 실제 검토 대상(PR2b 동시성 cap enforcement)과 무관한 내용이라, 계약에 따라 `git diff origin/main` 으로 실제 diff·관련 spec 섹션을 직접 확인해 검토를 진행했다.

## 발견사항

- **[WARNING]** `3-error-handling.md` §1.4 큐 대기초과 서술이 "PR2b 구현 완료"로 갱신된 §8 과 불일치(stale)
  - target 위치: 이번 PR diff `spec/5-system/4-execution-engine.md` §8 (line ~1069: "**PR2b 구현 완료**" 로 갱신됨) 및 admission gate 절
  - 충돌 대상: `spec/5-system/3-error-handling.md` line 104 — `**PR2b(정책 정의, enforcement 후속)**` 그대로 잔존 (이번 PR 의 diff 대상에서 빠짐, `git diff origin/main -- spec/5-system/3-error-handling.md` 무변경 확인)
  - 상세: 두 문서가 동일 사실(`EXECUTION_QUEUE_WAIT_TIMEOUT` 취소 경로)의 구현 상태를 서로 다르게 서술한다 — `4-execution-engine.md` 는 "구현 완료", `3-error-handling.md` 는 "enforcement 후속"(미구현 뉘앙스). 두 문서 모두 서로를 포인터로 참조하므로(`3-error-handling.md` → `4-execution-engine.md §8`, 역방향 없음), 이 문서만 단독으로 읽는 독자는 여전히 미구현이라고 오인할 수 있다.
  - 제안: `3-error-handling.md` line 104 의 "**PR2b(정책 정의, enforcement 후속)**" 를 "**PR2b 구현 완료**" 로 동기화. 사소한 문서 갱신이라 developer 가 같은 PR 에서 처리 가능 (별도 project-planner 위임 불요).

- **[INFO]** `plan/in-progress/exec-intake-queue-impl.md` 의 PR2b 체크박스가 미체크 상태로 남음
  - target 위치: 이번 PR diff — `plan/` 하위 변경 없음 (`git diff origin/main --stat -- plan/` 결과 없음)
  - 충돌 대상: `plan/in-progress/exec-intake-queue-impl.md` line 46 — `- [ ] **PR2b — 동시성 cap**` (미체크)
  - 상세: spec §8 은 "PR2b 구현 완료"로 갱신됐고 코드(admission gate·queued_at·workspace settings API·e2e)도 구현됐으나, plan 파일의 대응 체크박스는 갱신되지 않았다. CLAUDE.md 의 "plan 체크박스 = 실제 상태" 원칙과 어긋난다.
  - 제안: PR 커밋에 `plan/in-progress/exec-intake-queue-impl.md` 의 PR2b 항목 체크 + 완료 근거(커밋/PR 링크) 갱신을 포함. plan-lifecycle 규칙상 완료 후 `plan/complete/` 이동 여부는 잔여 항목(priority 3-tier 등) 유무에 따라 별도 판단.

## 검증된 정합 항목 (문제 없음 — 기록용)

- **admission gate 원자성**: `execution-engine.service.ts::admitExecutionOrDefer` 가 `pg_advisory_xact_lock(hashtext(lockKey))` 로 per-workspace 직렬화 후 조건부 `UPDATE ... RETURNING` 을 수행 — spec §8 Rationale "TOCTOU 원자화" 서술("조건부 UPDATE 단독 불충분 → advisory lock 필수")과 정확히 일치. 코드 리뷰 산출물(`review/code/2026/07/04/17_26_57/SUMMARY.md`)이 실 Postgres 로 race 제거를 재확인함.
- **`queued_at` 컬럼**: `spec/1-data-model.md` §2.13 (line 463, origin/main 에 이미 존재 — spec-first 선언)과 `execution.entity.ts` 신규 `queuedAt` 컬럼 + `V104__execution_queued_at.sql` 마이그레이션이 정합. `started_at` 재사용 회피 근거(recoverStuckExecutions stale 판정과 충돌)도 spec Rationale 과 동일하게 서술됨.
- **`EXECUTION_QUEUE_WAIT_TIMEOUT` / `cancelledBy='timeout'`**: 코드(`markQueueWaitTimeout`)가 `ExecutionStatus.CANCELLED` + `error.code='EXECUTION_QUEUE_WAIT_TIMEOUT'` + `result.cancelledBy='timeout'` 를 사용 — spec §8·`6-websocket-protocol.md §4.1`(`cancelledBy: 'user'|'system'|'timeout'`, 기존 미사용 값의 첫 실사용)과 일치. `pending → cancelled` 전이는 `4-execution-engine.md` §1 상태 머신 표(line 70, "큐 대기 중 취소")에 명시적으로 존재하는 유효 전이.
- **settings 키·엔드포인트**: `Workspace.settings.maxConcurrentExecutions`(Admin+, `PATCH /api/workspaces/:id/settings`)와 `Workflow.settings.maxConcurrentExecutions`(Editor+, `PATCH /api/workflows/:id`)가 `spec/1-data-model.md` §2.2/§2.4 및 `4-execution-engine.md` §8 표와 일치. Workflow 측은 기존 unvalidated generic `settings: Record<string, unknown>` passthrough 메커니즘을 그대로 재사용(신규 코드 불필요) — spec 이 요구하는 "Editor+ PATCH" 요건은 이미 충족. Workspace 측만 신규 validated DTO(`IsInt`, `Min(1)`)를 추가했으며 이는 code review 에서 "워크플로우 측 DTO 검증 부재"로 식별돼 명시적으로 후속 defer 처리됨(`RESOLUTION.md` #8) — spec 위반은 아님(방어적 fallback 이 이미 `resolveConcurrencyCap` 에 있어 hard-break 없음).
- **RBAC**: 두 엔드포인트 모두 기존 가드 패턴(서비스 레벨 role 체크/`@Roles('editor')`)을 그대로 사용해 신규 권한 구조를 도입하지 않음 — 기존 RBAC 매트릭스(`spec/5-system/1-auth.md` §3.2)와 충돌 없음.
- **이벤트 payload 형태**: `markQueueWaitTimeout` 의 `EXECUTION_CANCELLED` emit payload(`{ status, result: { cancelledBy }, error }`)는 기존 `'system'` cancel 경로(§7.5 rehydration 실패)와 동일 shape — 신규 이상 없음.

## 요약
이번 PR2b 는 spec §8·§2.13·§3-error-handling §1.5 가 요구하는 advisory-lock 기반 admission gate, `queued_at` 컬럼, `EXECUTION_QUEUE_WAIT_TIMEOUT` cancel 경로, workspace/workflow settings 키를 정합성 있게 구현했으며 핵심 데이터모델·API 계약·상태전이·RBAC 항목에서 다른 spec 영역과의 직접 모순은 발견되지 않았다. 유일한 문제는 이번 PR 이 `4-execution-engine.md` §8 의 구현 상태 주석만 갱신하고 동일 사실을 서술하는 `3-error-handling.md` §1.4 의 거울 문장을 갱신하지 않아 발생한 문서 간 상태 불일치(WARNING)이며, 부수적으로 plan 체크박스 미갱신(INFO)이 있다. 둘 다 코드 로직에는 영향이 없는 문서 동기화 이슈로, 병합을 막을 사유는 아니다.

## 위험도
LOW

---
BLOCK: NO
Critical: 0
Warning: 1 — `spec/5-system/3-error-handling.md` §1.4 "PR2b(정책 정의, enforcement 후속)" 이 갱신된 §8 상태("PR2b 구현 완료")와 불일치, 동기화 필요.
Info: 1 — `plan/in-progress/exec-intake-queue-impl.md` PR2b 체크박스 미갱신.

STATUS: SUCCESS
