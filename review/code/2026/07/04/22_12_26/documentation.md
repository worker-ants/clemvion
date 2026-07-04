# 문서화(Documentation) Review — orphan pending backstop

세션: `review/code/2026/07/04/22_12_26` · 대상: `recoverOrphanPendingExecutions` 도입 (orphan `pending` backstop, spec §8/§7.1/§7.4 + data-flow §3.1/§3.3)

payload 는 실제 코드·spec diff 14개 파일을 모두 포함(mis-scope 아님, `git diff origin/main...HEAD` 로 교차검증 완료 — 14 files 일치).

## 발견사항

- **[WARNING]** `recoverStuckExecutions` JSDoc 헤더가 신규 orphan-pending 책임을 반영하지 못해 stale
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2780-2805` (`recoverStuckExecutions` 바로 위 docstring)
  - 상세: 이번 diff 는 함수 본문에 `(c) orphan pending backstop (§8)` 인라인 주석과 `recoverOrphanPendingExecutions()` 호출을 추가했지만, 그 함수의 대표 JSDoc(첫 줄 "On server restart, **re-drive** RUNNING executions…", 마지막 줄 `SoT: spec/5-system/4-execution-engine.md §7.1 / §7.2 / §7.4 / §7.5.`)은 그대로다. 이 함수는 이제 RUNNING re-drive 뿐 아니라 PENDING cancel 도 수행하므로, 헤더만 읽는 독자는 이 부수 효과를 놓친다. 반대로 신설한 `recoverOrphanPendingExecutions` 자체 JSDoc(2888-2905행)은 상세하고 정확하다 — 누락은 상위 wrapper 쪽에만 있다.
  - 제안: `recoverStuckExecutions` JSDoc 첫 줄/요약에 "RUNNING re-drive + orphan PENDING cancel(§8, 2026-07-04)" 한 줄과 SoT 목록에 `§8` 을 추가.

- **[WARNING]** `runStuckRecoveryScan` (테스트훅 트리거) JSDoc 도 동일하게 stale
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:753-762`
  - 상세: "§7.1/§7.5 case B 재구동을 on-demand 로 1회 스캔 트리거한다"만 서술한다. 그러나 이번 PR 의 신규 e2e 테스트 2건(`execution-concurrency-cap.e2e-spec.ts` 619-650행)이 바로 이 경로(`POST /_test/recover-stuck-executions` → `runStuckRecoveryScan` → `recoverStuckExecutions`)로 orphan-pending cancel 을 검증한다 — 즉 이 wrapper 의 실제 동작 범위가 넓어졌는데 docstring 은 안 바뀌었다.
  - 제안: 위 항목과 함께 "orphan pending cancel(§8)도 함께 트리거"를 한 줄 추가.

- **[INFO]** e2e 스펙 파일 헤더 docstring 이 신규 시나리오를 목록에 반영하지 않음
  - 위치: `codebase/backend/test/execution-concurrency-cap.e2e-spec.ts:8-21` (파일 상단 시나리오 설명 블록)
  - 상세: 헤더는 시나리오 (1)/(2-A)/(2-B) 만 나열하는데, 이번 diff 로 추가된 두 개 `it` (orphan pending → cancelled, threshold 가드 — 619~650행)은 각각 인라인 주석은 있으나 파일 헤더의 "시나리오" 목록에는 없다. 파일을 훑어보는 개발자가 전체 커버리지를 헤더만으로 파악하기 어렵다.
  - 제안: 헤더에 "(3) orphan pending(job 소실) → 부팅 backstop 이 wait-timeout cancel / threshold 이내는 무시" 한 줄 추가.

- **[WARNING]** CHANGELOG.md 미갱신
  - 위치: `CHANGELOG.md` (diff 미포함)
  - 상세: 본 리포는 `CHANGELOG.md` 에 "Unreleased — <기능>" 섹션을 관측 가능한 동작 변경마다 추가하는 확립된 관행이 있다(직전 커밋들: `#805` workflow cap DTO, `#762` webhook body 게이트, `#757` error.details 등 모두 항목 보유). 이번 변경은 운영자가 관측 가능한 새 동작 — "부팅 재시작 시 5분 이상 대기 중이던 pending 실행이 자동으로 cancelled 될 수 있다" — 을 도입하지만 diff 에 CHANGELOG.md 항목이 없다.
  - 제안: 병합 전 "Unreleased — orphan pending backstop (부팅 시 대기초과 pending 자동 cancel)" 섹션을 CHANGELOG.md 에 추가하고 SoT(`spec/5-system/4-execution-engine.md §8`)를 인용.

## 검증된 항목 (문제 없음)

- **spec §8 line 1088 flip**: "본 PR 스코프 아님(낮은 확률 엣지, best-effort)" → "`recoverStuckExecutions`(§7.4) 부팅 backstop 이 담당한다 — 구현 완료(2026-07-04)"로 정확히 갱신됨. repo 전체(`spec/`, `plan/`) 재검색 결과 "orphan pending 회수는 후속/본 PR 스코프 아님" 류의 stale 잔존 문구 없음.
- **§7.1 boot-backstop 서술 + 표 행**: 부팅 backstop 절 본문과 표(`부팅 backstop 재개 (PR3 구현)` 행) 모두 "같은 스캔이 orphan `pending` 도 회수한다(2026-07-04)"를 정확히 추가.
- **§7.4 "Stale 대상" 문구**: "Stale 대상 한정: status='running'…" → "Stale 대상 = RUNNING(re-drive) + orphan PENDING(cancel)"로 갱신되고, 상태별 임계값(RUNNING `STUCK_RECOVERY_STALE_MS`/`started_at`, PENDING `EXECUTION_QUEUE_WAIT_TIMEOUT_MS`/`queued_at`)을 명확히 구분해 서술 — 정확.
- **신규 Rationale 서브섹션** ("orphan pending backstop — recoverStuckExecutions 재사용 + PENDING cancel (2026-07-04)"): 같은 함수·트리거 재사용 근거, PENDING=cancel vs RUNNING=re-drive 근거, 멱등·race 안전성, 한도 이내 orphan 처리를 모두 포함 — 코드·plan 설계 결정과 정합.
- **`data-flow/3-execution.md`**: §3.1 mermaid `pending --> cancelled` 전이에 `(b) 큐 대기 5분 초과 … 또는 orphan pending backstop` 분기 추가됨. §3.3 recovery-source 표의 `recoverStuckExecutions` 행이 "(i) RUNNING stale (ii) orphan pending" 대상과 "RUNNING → re-drive / orphan PENDING → markQueueWaitTimeout cancel" 동작을 모두 반영 — 코드(`recoverOrphanPendingExecutions`)·spec 본문과 일치.
- **`recoverOrphanPendingExecutions` JSDoc** (신규 메서드 자체, 2888-2905행): 목적, 액션(cancel vs re-enqueue 근거), 멱등성, `queued_at IS NULL` 레거시 제외 이유, SoT 인용까지 모두 정확하고 diff 와 실제 소스가 일치.
- **단위 테스트 신규 describe 블록 주석** (`execution-engine.service.spec.ts` 35-36행): "§8 orphan pending backstop … recoverStuckExecutions 부팅 스캔이 wait-timeout cancel" — 코드 동작과 일치.
- **e2e 신규 테스트 인라인 주석**: `insertPending`/`recoverStuck` 헬퍼와 두 신규 `it` 모두 목적을 정확히 설명.
- **에러 코드/API 문서**: 신규 엔드포인트·신규 에러 코드 없음(기존 `EXECUTION_QUEUE_WAIT_TIMEOUT`·`markQueueWaitTimeout`·`_test/recover-stuck-executions` 재사용) — API 문서 갱신 불요.
- **환경변수/설정**: 신규 env·migration 없음(`EXECUTION_QUEUE_WAIT_TIMEOUT_MS` 기존 값 재사용) — 설정 문서 갱신 불요.

## 요약

이번 PR 의 spec 문서 편집(§8/§7.1/§7.4/신규 Rationale/data-flow mermaid+표)은 사용자 요청 5개 항목 모두 정확하고 완결적으로 반영되었으며, repo 전역에 "orphan pending 후속/스코프 아님" 류의 stale 잔존 문구는 없다. 신설 메서드 `recoverOrphanPendingExecutions` 자체의 JSDoc 도 상세하고 정확하다. 다만 이 메서드를 감싸는 두 개의 기존 wrapper(`recoverStuckExecutions`, `runStuckRecoveryScan`)의 대표 JSDoc 헤더는 새 orphan-pending 책임을 반영하지 못해 상대적으로 stale해졌고(WARNING 2건), 관측 가능한 신규 운영 동작(부팅 시 대기초과 pending 자동 cancel)임에도 이 리포의 확립된 관행인 CHANGELOG.md 항목이 누락되었다(WARNING 1건). e2e 파일 헤더의 시나리오 목록 미갱신은 INFO 수준이다. 모두 병합을 막을 CRITICAL 은 아니며, 문서 완결성을 위한 소규모 보완 권고다.

## 위험도

LOW

STATUS: SUCCESS
