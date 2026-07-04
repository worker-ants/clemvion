# 테스트(Testing) 리뷰 — exec-limits 리팩터 (ARCH#4·ARCH#6·MAINT#9)

## 검토 방법

payload 는 mis-scope 없이 실제 변경 대상(6개 코드 파일 + plan/consistency 산출물)을 정확히 담고 있어
`git diff origin/main...HEAD` 대조가 불필요했다(파일 목록·diff 가 payload 와 완전 일치, `git diff
origin/main...HEAD --stat` 로 재확인). 추가로 다음을 직접 실행/열람해 검증했다:

- `npx jest execution-limits.spec.ts execution-run.queue.spec.ts continuation-execution.queue.spec.ts system-status.constants.spec.ts` → 4 suites / 39 tests 전부 통과.
- `resolveContinuationWorkerConcurrency` 의 own-spec(`continuation-execution.queue.spec.ts`)을 직접 열람해 strict-parsing 커버리지(빈 문자열·공백·음수/소수/공학표기·패딩된 유효값) 확인.
- `system-status.constants.spec.ts` 열람 — 레지스트리 멤버십/그룹/중복 검증만 하며, concurrency 파싱 값 자체는 원래도 지금도 테스트 대상이 아님(회귀 아님, pre-existing 갭).
- 이관 후 `execution-run.queue.ts`/`execution-run.queue.spec.ts` 에 `resolveExecutionRunWorkerConcurrency` 잔여 참조 없음(grep 확인) — 단일 comment 포인터만 남음. 중복 describe 없음(전체 repo grep, 1건만 존재).

## 발견사항

- **[INFO]** MAINT#9(continuation strict 파싱 통일)의 회귀 커버리지는 위임(delegate)이 정당하나, `system-status.constants.ts` 자체에는 이 통일을 직접 검증하는 테스트가 없음
  - 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts` L44(`continuationConcurrency = resolveContinuationWorkerConcurrency()`), `system-status.constants.spec.ts`
  - 상세: `resolveContinuationWorkerConcurrency` 의 strict 파싱(빈 문자열/공백/음수/소수/공학표기 → 1 fallback)은 own-spec(`continuation-execution.queue.spec.ts`)이 충실히 커버하므로 순수 위임 함수 재사용에 대해 중복 테스트를 또 추가할 필요는 없다는 판단(plan 체크리스트의 "delegate" 근거)은 타당하다. 다만 `system-status.constants.spec.ts` 는 `MONITORED_QUEUES` 의 `concurrency` 필드 값 자체(예: `continuationConcurrency`/`executionRunConcurrency` 가 실제로 resolver 반환값을 그대로 반영하는지, 즉 "배선(wiring)이 맞는지")는 애초부터 검증하지 않는다 — 이는 이번 리팩터로 생긴 갭이 아니라 pre-existing 갭이며 회귀는 아니다.
  - 제안: 필수 아님(스코프 밖 개선 제안). 원한다면 `system-status.constants.spec.ts` 에 "loose `Number()||1` → canonical resolver 교체"가 `MONITORED_QUEUES` 의 해당 엔트리 concurrency 값에 실제로 반영됐는지 확인하는 배선 테스트 1개(예: env override 시나리오)를 추가하면 향후 유사 drift(코드가 resolver 호출을 빠뜨리는 실수)를 잡을 수 있다.

- **[INFO]** 테스트 이관(ARCH#4) 자체는 완전하고 깨끗함 — 내용·이름·엣지 케이스 전부 보존
  - 위치: `execution-limits.spec.ts` (신규 describe), `execution-run.queue.spec.ts` (삭제된 describe)
  - 상세: `resolveExecutionRunWorkerConcurrency` describe 블록(5개 테스트: 기본값, 양의 정수, bad-value 루프, 공백 전용, `Number.MAX_SAFE_INTEGER`)이 문자 그대로 이관되었고, import 정리도 정확(`execution-run.queue.spec.ts` 에서 관련 import·describe 제거, `execution-limits.spec.ts` 에 신규 import 추가). 소스 이관과 위치가 논리적으로 일치(테스트가 실제 구현 위치를 따라감). 이관 전후 커버리지 diff 없음(테스트 내용 무변경, 위치만 이동).

## 요약

이번 변경은 순수 이관/문서화/파서 통일이며 프로덕션 로직·값은 무변경이다. `resolveExecutionRunWorkerConcurrency` 테스트는 `execution-run.queue.spec.ts` → `execution-limits.spec.ts` 로 5개 테스트가 그대로(내용·의도·엣지 케이스 무변화) 이관되었고, 소스 이동과 정확히 대응하며 orphan/중복이 없음을 grep 과 jest 실행으로 직접 확인했다. MAINT#9(continuation concurrency loose→strict 통일)는 신규 테스트를 추가하지 않았지만 `resolveContinuationWorkerConcurrency` own-spec 이 이미 필요한 strict-parsing 엣지 케이스(빈 문자열·공백·음수·소수·공학표기)를 전부 커버하고 있어 위임(delegate) 판단이 타당함을 직접 spec 파일을 열람해 검증했다. 유일한 잔여 갭은 `system-status.constants.ts` 의 "배선"(resolver 반환값이 실제 레지스트리 엔트리에 반영되는지) 자체를 검증하는 테스트가 없다는 점인데, 이는 이번 리팩터가 만든 회귀가 아니라 이전부터 존재하던 낮은 우선순위 커버리지 갭이다. 4개 관련 spec suite(39 테스트) 전부 통과 확인.

## 위험도

NONE

STATUS: SUCCESS
