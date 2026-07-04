# 신규 식별자 충돌 검토 — naming_collision

## 사전 확인: payload 스코프 이상 (재확인)

`_prompts/naming_collision.md`(3,463줄)는 검토 모드를 `--impl-done`(scope=`spec/5-system/`,
diff-base=`origin/main`)로 선언하고, 헤더는 "`## 구현 변경 사항` 의 diff 를 1차 근거로 삼으라" 고
지시한다. 그러나 실제로 번들된 내용은 `spec/5-system/1-auth.md` · `spec/5-system/10-graph-rag.md`
및 `spec/2-navigation/*`, `spec/1-data-model.md`, `spec/conventions/cafe24-api-catalog/**` 등
이번 작업과 무관한 대량 spec 텍스트뿐이며:

- `## 구현 변경 사항` 이라는 섹션 헤더 자체가 파일 어디에도 존재하지 않는다 (```diff 블록도 없음).
- `resolveExecutionRunWorkerConcurrency`, `execution-limits`, `EXEC_RUN_WORKER_CONCURRENCY` 등
  이번 target 식별자 문자열이 payload 전체에 **0건** 검색됨.
- 실제 SoT 문서인 `spec/5-system/4-execution-engine.md`(§8·§11)도 번들에 없음.

이는 memory 에 기록된 "impl-done spec 번들 버그"(prompt 가 target 코드/spec 본문을 못 실어 오탐
유발)와 동일한 payload 구성 결함이며, 동일 스코프의 이전 회차 검토
(`review/consistency/2026/07/04/23_21_53/naming_collision.md`, `--impl-prep` 단계)에서도 동일하게
지적된 바 있다. 지시에 따라 payload 를 신뢰하지 않고 **실제 워킹트리를 절대경로로 직접 확인**했다.

## 실제 레포 확인 내역 (절대경로 기반)

- `codebase/backend/src/modules/execution-engine/execution-limits.ts` (현재, HEAD):
  - 기존 5개 export 유지: `DEFAULT_MAX_ACTIVE_RUNNING_MS`, `resolveMaxActiveRunningMs`,
    `DEFAULT_WORKSPACE_MAX_CONCURRENT_EXECUTIONS`, `DEFAULT_WORKFLOW_MAX_CONCURRENT_EXECUTIONS`,
    `resolveConcurrencyCap`, `DEFAULT_QUEUE_WAIT_TIMEOUT_MS`, `EXECUTION_ADMISSION_RETRY_DELAY_MS`,
    `resolveQueueWaitTimeoutMs`
  - 신규 도착(이동) 2개: `DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY`(L102),
    `resolveExecutionRunWorkerConcurrency`(L111) — **이름 변경 없이** 그대로 이동
- `git diff origin/main -- codebase/backend/src/modules/execution-engine/` 확인 결과:
  - `execution-run.queue.ts`: 위 두 식별자의 정의(함수 본문 포함 23줄)가 **삭제**되고 주석 1줄로 대체
    (`이관됐다(ARCH#4)`)
  - `execution-run.processor.ts`: import 출처만 `./execution-run.queue` → `../execution-limits` 로 갱신
  - `execution-run.queue.spec.ts`: 해당 테스트 45줄 삭제 (→ `execution-limits.spec.ts` 로 이관, grep
    으로 잔존 0건 확인)
  - `execution-limits.spec.ts`: 신규 46줄 추가 (이관된 테스트)
  - 순수 파일 간 이동(move) — 함수 시그니처·동작·이름 어느 것도 변경되지 않음
- 정의 중복 여부: `git grep -n "export function resolveExecutionRunWorkerConcurrency\|export const DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY"` 결과 **`execution-limits.ts` 단 1곳**에서만 정의됨
  (`execution-run.queue.ts` 에는 더 이상 정의 없음 — 이관 후 원본 위치엔 잔존 정의 없음, 진짜 move 확인)
- import 갱신 확인: `execution-run.processor.ts`, `system-status.constants.ts` 모두
  `from '../execution-limits'` 로 최신화되어 있고, `execution-run.queue.ts` 를 여전히 import 하는
  다른 파일(`execution-engine.module.ts`, `execution-run-dlq-monitor.service.ts` 등)은 `EXECUTION_RUN_QUEUE`
  등 이번 이동과 무관한 다른 식별자만 참조 — 깨진 참조 없음
- `resolveContinuationWorkerConcurrency` / `DEFAULT_CONTINUATION_WORKER_CONCURRENCY`
  (`continuation-execution.queue.ts`)는 **이동 대상이 아니며 원위치 그대로 유지**, `execution-limits.ts`
  는 이를 import 하지 않고 JSDoc 주석에서 "동일 규약" 으로만 언급 — 재정의·재수출 없음, 충돌 여지 없음
- spec SoT 재확인: `spec/5-system/4-execution-engine.md` §11 ENV 표(L1245-1246)에 `EXECUTION_RUN_WORKER_CONCURRENCY`,
  `CONTINUATION_WORKER_CONCURRENCY` 가 이미 등재되어 있고 함수명 `resolveExecutionRunWorkerConcurrency`
  도 표 설명 안에서 이미 언급됨 — 이번 커밋이 새 ENV var·새 함수명을 도입한 것이 아니라, **기존에 이미
  spec 에 등록된 이름을 코드 상 다른 파일로 재배치**한 것임을 확인

## 발견사항

- **[INFO]** 신규 식별자 없음 — 순수 파일 간 relocate, rename 無
  - target 신규 식별자: 없음. `resolveExecutionRunWorkerConcurrency`, `DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY`
    는 `execution-run.queue.ts` → `execution-limits.ts` 로 위치만 바뀌었고 이름·시그니처·동작 불변
  - 기존 사용처: 이동 전 정의 — `execution-run.queue.ts` (diff 상 삭제됨, `git show origin/main:...` 로
    이전 존재 확인 가능). 이동 후 정의 — `execution-limits.ts` L102/L111 (신규 사용처는 없음, 정의 위치
    변경뿐)
  - 상세: `execution-limits.ts` 기존 5개 export 의 명명 패턴(`resolve*` 함수 / `DEFAULT_*`, `*_MS` 상수)과
    이동해 온 2개 식별자의 패턴이 완전히 일치해 시각적·의미적 충돌이 없다. `resolveContinuationWorkerConcurrency`
    는 별도 파일에 그대로 남아 재정의되지 않았으므로 이 역시 충돌 없음. 코드 grep 으로 정의가 정확히
    1곳에만 존재함을 확인해 "이동 후 원본 위치에 잔존 정의가 남아 이중 정의" 시나리오도 배제됨
  - 제안: 없음(충돌 없음, 조치 불요)

- **[INFO]** payload mis-scope (프로세스 이슈, 이번 발견의 결론에는 영향 없음)
  - target 신규 식별자: 해당 없음
  - 기존 사용처: `_prompts/naming_collision.md` 자체 — `--impl-done` 모드임에도 `## 구현 변경 사항` diff
    섹션이 부재하고 target 코드/SoT spec 문서(`4-execution-engine.md`)가 번들에서 누락됨
  - 상세: 동일 세션의 이전 `--impl-prep` 회차(`review/consistency/2026/07/04/23_21_53/naming_collision.md`)
    에서 이미 동일한 payload 결함이 보고되었음에도, `--impl-done` 회차에서도 동일 결함이 반복됨 — orchestrator
    prompt 번들링 로직의 재발성 이슈로 추정
  - 제안: 이번 건은 실제 워킹트리 직접 조회(git diff origin/main, git grep)로 대체 검증을 완료했으므로
    차단 사유 아님. payload 생성 스크립트가 diff 섹션 존재 여부·target 코드 파일 포함 여부를 자체
    검증하도록 보강 권장(orchestrator 개선 사항, checker 산출물 범위 밖)

## 요약

이번 커밋은 `resolveExecutionRunWorkerConcurrency`/`DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY` 를
이름 변경 없이 `execution-run.queue.ts` 에서 `execution-limits.ts` 로 옮긴 순수 relocate 이며,
`resolveContinuationWorkerConcurrency` 는 원위치에 그대로 두고 재사용(참조)만 한다. `git diff
origin/main`·`git grep` 로 (1) 이동 대상 정의가 원본 파일에서 삭제되고 목적 파일에 정확히 1곳만
존재함, (2) 기존 5개 export 와 이름 충돌 없음, (3) import 경로가 모든 소비처(`execution-run.processor.ts`,
`system-status.constants.ts`)에서 일관되게 갱신됨, (4) spec §11 ENV 표에 이미 등재된 기존 이름이라
신규 요구사항 ID/식별자 도입이 아님을 직접 확인했다. payload 자체는 diff 섹션 부재 + 무관한 spec 대량
덤프로 mis-scope 되어 있었으나(이전 회차와 동일 결함 반복), 실 레포 직접 조회로 결론에 영향 없이
검증을 완료했다. 신규 식별자 충돌 관점에서 문제 없음.

## 위험도

NONE

BLOCK: NO
STATUS: SUCCESS
