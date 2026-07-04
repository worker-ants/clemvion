# 신규 식별자 충돌 검토 — spec/5-system/4-execution-engine.md (impl-done, C-3 후속 정정)

## 검토 대상
- target: `spec/5-system/4-execution-engine.md` (scope), diff-base `origin/main`
- 실 diff 범위 (`git diff origin/main...HEAD`):
  - `spec/5-system/4-execution-engine.md` — §Rationale "Graceful Shutdown … under-count 허용" 절에 1개 정정 문단 추가("PR3 의 제어된 re-drive는 세그먼트-start 를 영속하지 않아 under-count 를 해소하지 않는다", 2026-07-04 정정)
  - `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts` — 클래스 JSDoc 주석 재작성 (Redis 미채택 설계 의도 명문화)
  - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `segmentStartMs` 필드 주석에서 "PR3 stalled-job 재배달 구현 시 flush 훅 검토" → "**PR4** stalled-job 재배달 + 세그먼트-start 영속 구현 시 flush 훅 검토" 로 정정
  - `plan/in-progress/exec-intake-queue-impl.md`, `plan/in-progress/refactor/06-concurrency.md` — 대응 plan 서술 정정(체크박스·stale 가정 각주)
- 본 검토 직전 라운드(`review/consistency/2026/07/04/09_27_49/naming_collision.md`, 위험도 NONE)에서 이미 같은 target 의 넓은 diff(§6.2/§7.5/§9.1/§9.2 Redis 키 제거 + Rationale 신설)를 검토 완료. 금번 라운드는 그 후속 **1문단 정정 + 코드 주석 2건**만 추가된 것으로, 신규 식별자 도입 범위가 이전 라운드보다 더 좁다.

## 발견사항

없음.

검토 근거:

1. **요구사항 ID 충돌** — 해당 없음. 금번 diff 는 신규 요구사항 ID 를 전혀 부여하지 않는다. "PR3"/"PR4" 는 요구사항 ID 가 아니라 `plan/in-progress/exec-intake-queue-impl.md` 내부의 작업 단계 라벨(PR1~PR4)이며, 금번 변경은 이 기존 라벨 체계를 그대로 재사용해 "PR3 담당 범위가 아니라 PR4 candidate" 로 **재배치**할 뿐 새 라벨을 만들지 않는다. `git -C <worktree> grep -n "PR4"` 결과 spec 본문·plan 파일 전역에서 PR4 는 시종 "stalled-job 일원화 + 관측성 (미착수)" 의미로만 쓰이고 있어 의미 충돌이 없다.

2. **엔티티/타입명 충돌** — 해당 없음. 금번에 언급되는 식별자(`ExecutionContextService`, `segmentStartMs`, `recoverStuckExecutions`, `maxActiveRunningMs`)는 모두 코드에 이미 존재하는 기존 심볼이며 (`codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의 `private readonly segmentStartMs = new Map<string, number>();`), 주석 문구만 정정됐다. 새 클래스·DTO·인터페이스 명 도입 없음.

3. **API endpoint 충돌** — 해당 없음. 금번 diff 에 신규 endpoint 정의가 없다.

4. **이벤트/메시지명 충돌** — 해당 없음. 신규 webhook/queue/SSE 이벤트명 도입 없음. `exec:run:seq:<executionId>` 등 Redis 키·큐 이름은 이전 라운드(09_27_49)에서 이미 검토된 기존 식별자 그대로이며 금번 diff 는 이를 재언급만 한다.

5. **환경변수·설정키 충돌** — 해당 없음. `WORKER_HEARTBEAT_TIMEOUT`, `EXECUTION_MAX_ACTIVE_RUNNING_MS` 등은 기존 ENV/에러코드이며 금번 diff 가 신규로 도입하지 않는다. `git -C <worktree> grep -n "WORKER_HEARTBEAT_TIMEOUT"` 확인 결과 §7.1/§7.2/§2.13 기존 서술과 일관.

6. **파일 경로 충돌** — 해당 없음. 금번 diff 는 기존 파일(`spec/5-system/4-execution-engine.md`, 두 개 `.service.ts`, 두 개 plan `.md`)만 수정하며 신규 spec 파일을 생성하지 않는다.

부가 확인: 금번 diff 의 핵심 문장 — "PR3(#795)의 제어된 re-drive 는 세그먼트-start 를 영속하지 않아 under-count 를 해소하지 않는다" — 은 `plan/in-progress/exec-intake-queue-impl.md` 의 "PR3 — 크래시 RUNNING checkpoint 재개: 완료(2026-07-04, `exec-park-durable-resume` 로 이관)" 항목 및 `plan/in-progress/refactor/06-concurrency.md` 의 "stale 가정 정정" 각주와 PR 번호(#795)·날짜(2026-07-04)·의미 모두 일치한다. 새로 도입되는 개념("세그먼트-start 영속" candidate)도 기존 §Rationale "Graceful Shutdown … under-count 허용" 절이 이미 다루던 "수용된 trade-off" 를 구체화한 것으로, PR4 항목 아래 "후속 candidate(미확정)" 로 명시적으로 종속시켜 두어 신규 독립 식별자로 오인될 여지가 없다.

## 요약
금번 diff 는 직전 라운드(09_27_49, 위험도 NONE)에서 검토된 광범위한 Redis-context-store 드리프트 정정의 **후속 1문단 보정**과 코드 주석 2건("PR3"→"PR4" 라벨 정정)에 불과하다. 신규 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·환경변수·spec 파일 경로 어느 관점에서도 새로 도입되는 식별자가 없고, 재사용되는 PR3/PR4/segmentStartMs 등 기존 라벨·심볼은 코퍼스 전역에서 일관된 의미로 유지된다. 충돌 후보 자체가 존재하지 않는다.

## 위험도
NONE
