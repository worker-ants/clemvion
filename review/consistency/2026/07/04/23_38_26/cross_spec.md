# Cross-Spec 일관성 검토 — exec-limits-refactor

## 검토 메모 (payload 이상 및 fallback 적용)

전달된 `_prompts/cross_spec.md` payload 는 `spec/5-system/1-auth.md`, `10-graph-rag.md`,
`0-overview.md`, `1-data-model.md` 등 본 작업과 무관한 영역 본문만 담고 있고, 실제 target
인 `spec/5-system/4-execution-engine.md` §11 / `16-system-status-api.md`, 그리고 "## 구현
변경 사항" diff 섹션이 전혀 포함되어 있지 않음을 확인했다(grep 으로 `execution-limits`,
`resolveExecutionRunWorkerConcurrency`, `MAINT#9`, `diff --git` 등 핵심 식별자 0건). 이는
mis-scoped payload 로 판단해 지시된 fallback 절차에 따라
`git -C <worktree> diff origin/main...HEAD` 를 직접 사용해 분석했다.

## 실제 변경 내역 (git diff origin/main...HEAD 기준)

- `codebase/backend/src/modules/execution-engine/execution-limits.ts`
  - `resolveExecutionRunWorkerConcurrency` + `DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY` 를
    `execution-run.queue.ts` 에서 이관. 모듈 JSDoc 을 "§8 전용" → "§8 + §11 동시성·실행
    한도 파서 응집 모듈" 로 확장.
- `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts`
  - 위 함수·상수 제거, 이관 안내 주석(`ARCH#4`)만 남김. re-export 없음 — import 지점을
    `../execution-limits` 로 전환(processor·system-status.constants 모두 갱신 확인).
- `codebase/backend/src/modules/execution-engine/queues/execution-run.processor.ts`
  - import 경로만 변경, 동작 변경 없음.
- `codebase/backend/src/modules/system-status/system-status.constants.ts`
  - continuation 큐 concurrency 계산을 inline `Number(env) || 1` (loose) 에서
    `resolveContinuationWorkerConcurrency()` (canonical resolver, strict 정규식 선검증)
    로 교체. execution-run 쪽은 기존과 동일하게 `resolveExecutionRunWorkerConcurrency()`
    재사용(이관된 새 경로로 import).
- 그 외 plan 문서·이전 리뷰 산출물(`review/consistency/2026/07/04/23_21_53/**`) 변경 —
  cross-spec 관점 무관.
- **spec/** 파일 변경 없음** (diff --stat 확인, `spec/` 경로 0건).

## 발견사항

- **[INFO]** §11 canonical resolver 재사용은 이미 spec 이 요구하던 계약의 사후 정합화
  - target 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts` (continuationConcurrency 계산)
  - 충돌 대상: `spec/5-system/4-execution-engine.md` §7.4/§11(라인 892, 1245), `spec/5-system/16-system-status-api.md` (큐 카탈로그 표, 라인 22/24)
  - 상세: spec §11 은 `CONTINUATION_WORKER_CONCURRENCY` 에 대해 "비양수·비정수·비숫자 입력은 1 로 fallback" 을 명시적으로 문서화하고 있다. 리팩터 이전 `system-status.constants.ts` 는 `Number(process.env.CONTINUATION_WORKER_CONCURRENCY) || 1` 이라는 loose 파싱을 썼는데, 이는 소수(`1.5`→`1.5`), 공학표기(`1e2`→`100`), 문자열 결합 등 spec 이 fallback 대상으로 규정한 입력을 그대로 통과시켜 spec §11 계약과 실제로 어긋나 있었다(spec-code drift, 이번 diff 로 정정됨). 즉 이번 변경은 새로운 충돌을 만드는 것이 아니라, 기존에 존재하던 spec-vs-코드 불일치(system-status 쪽만 loose)를 canonical resolver 재사용으로 해소한 것이다. cross-spec 관점에서 두 spec 문서(`4-execution-engine.md` §11, `16-system-status-api.md` 큐 카탈로그) 사이에는 여전히 모순이 없다 — 값(`env var` 이름, 기본값 1, fallback 정책)이 두 문서에서 일치한다.
  - 제안: spec 수정 불요. 참고로만 남김 — 이 INFO 는 코드가 spec 을 "더 정확히" 따르게 된 사례이지, spec 문서 간 불일치가 아니다.

- **[INFO]** 함수 이관에 따른 파일 소유권 변경이 spec 파일 경로 힌트와 어긋나지 않는지
  - target 위치: `execution-limits.ts` 신규 JSDoc ("SoT: spec/5-system/4-execution-engine.md §8 · §11")
  - 충돌 대상: 없음 (spec 문서 자체는 특정 소스 파일 경로를 breaking 하게 못박지 않음)
  - 상세: `spec/5-system/4-execution-engine.md` 는 §11 리소스 경로를 함수명(`resolveExecutionRunWorkerConcurrency`)으로만 참조하고 파일 경로(`execution-limits.ts` vs `execution-run.queue.ts`)를 규정하지 않는다. 따라서 파일 이관은 spec 계약 위반이 아니다. 다만 `spec/5-system/4-execution-engine.md` 프론트매터의 `code:` 목록(있다면)이 옛 파일 경로만 가리키고 있는지 별도 확인이 유효하나, 이는 cross-spec 충돌이 아니라 spec-impl evidence 경로 정합성 문제이므로 spec-coverage 도구 영역이다.
  - 제안: 필요 시 `/spec-coverage` 로 `code:` frontmatter 경로 최신화 여부만 별도 확인 (본 리뷰의 CRITICAL/WARNING 대상 아님).

## 요약

이번 diff 는 동작 보존 리팩터(함수 위치 이동 + 모듈 JSDoc 범위 확장)와, `system-status.constants.ts` 의 continuation-concurrency 파싱을 기존 loose 방식에서 이미 spec §11 이 문서화한 strict 계약(canonical `resolveContinuationWorkerConcurrency` 재사용)으로 맞추는 정합화(MAINT#9)로 구성된다. `spec/**` 파일 변경이 전혀 없고, 새 엔티티·API·요구사항 ID·상태 전이·RBAC·계층 책임 정의도 도입되지 않았다. 두 개의 관련 spec 문서(`4-execution-engine.md` §11, `16-system-status-api.md` 큐 카탈로그)는 env 변수명·기본값·fallback 정책에서 서로 일치하며, 이번 코드 변경은 오히려 그 일치를 코드 레벨에서 강화한다. Cross-spec 충돌 없음.

## 위험도

NONE

BLOCK: NO

STATUS: SUCCESS
