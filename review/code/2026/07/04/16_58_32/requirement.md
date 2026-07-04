# 요구사항(Requirement) Review — PR2b 동시성 cap admission gate (spec §8)

대상: codebase/backend/.env.example, migrations/V104__execution_queued_at.sql,
execution-engine.service.ts(+spec), execution-limits.ts(+spec),
execution.entity.ts, workspaces DTO/service, execution-concurrency-cap.e2e-spec.ts,
docker-compose.e2e.yml, spec/5-system/4-execution-engine.md

## 발견사항

- **[CRITICAL]** admission gate 로 admitted 된 실행은 PR2a §8 active-running 누적 타임아웃 추적이 첫 세그먼트 내내 무력화된다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `admitExecutionOrDefer()` (약 L2609-2672, 특히 L2650-2658 admitted 분기) / `runExecution()` L3906-3932 (`alreadyRunning` 분기) / `assertActiveTimeWithinLimit()` L7301-7317 / `recordRunningSegmentStart()` L7401-7403
  - 상세: `admitExecutionOrDefer` 의 `'admitted'` 분기는 raw SQL(`UPDATE execution SET status='running', started_at=NOW() … RETURNING id`)로 DB 를 직접 전이시키고, in-memory `execution.status = RUNNING` 만 세팅한 뒤 반환한다. 이후 `runExecutionFromQueue` → `runExecution(execution, input, true)` 호출에서 `alreadyRunning=true` 이므로 `updateExecutionStatus(savedExecution, RUNNING)` 호출이 **스킵**된다(L3922 `if (!alreadyRunning)`). 그런데 PR2a 의 세그먼트 시각 기록(`recordRunningSegmentStart` → `segmentStartMs.set`)은 **오직 `updateExecutionStatus` 내부**(L7428-7429, RUNNING 진입 시)와 stalled 재배달 arm(L3294, 명시적 별도 호출)에서만 일어난다. `admitExecutionOrDefer` 는 이 헬퍼를 호출하지 않는다. 결과: 큐 경로(=`execute()` 로 시작하는 모든 top-level 실행, sub-workflow 제외)로 admitted 된 실행은 `segmentStartMs` 에 항목이 없는 채로 dispatch loop 에 진입한다. `assertActiveTimeWithinLimit`(L7301-7317, 노드마다 호출)은 `segStart === undefined` → `inProgress = 0` 으로 계산해 첫 세그먼트 경과 시간을 항상 0 으로 간주한다. 세그먼트가 park(WAITING_FOR_INPUT) 없이 한 번에 끝나면 `updateExecutionStatus` 의 "RUNNING 이탈" 분기(L7430-7439)도 `segStart === undefined` 라 `activeRunningMs` 누적을 건너뛴다 — 즉 **단일 세그먼트로 끝나는 일반적인 실행은 `EXECUTION_MAX_ACTIVE_RUNNING_MS` 한도가 사실상 절대 걸리지 않는다** (PR2a 가 이미 구현 완료라고 선언한 §8 기능의 회귀).
  - 제안: `admitExecutionOrDefer` 의 admitted 분기(L2650-2658)에서 `execution.status = RUNNING` 세팅 직후 `this.recordRunningSegmentStart(executionId)` 를 명시적으로 호출한다 (stalled 재배달 arm 이 L3294 에서 이미 이렇게 하는 것과 동일 패턴 — 헤더 주석 L7397-7399 이 "두 경로에서 독립 drift 하지 않도록" 명시한 불변식을 admission gate 경로가 어긴 상태). 유닛 테스트에 admitted 케이스에서 `segmentStartMs.has(executionId)` 를 검증하는 assertion 추가 필요.

- **[WARNING]** `Workflow.settings.maxConcurrentExecutions` 쓰기 경로에 유효성 검증 부재 — spec 표가 암시하는 "Editor+ 검증된 설정"과 불일치
  - 위치: `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts` (`settings?: Record<string, unknown>`, `@IsObject()` 만 존재) / `workflows.service.ts` `update()` L172-180 (`Object.assign(workflow, dto)` 전체 교체) / spec `spec/5-system/4-execution-engine.md` §8 표 ("`Workflow.settings.maxConcurrentExecutions` (Editor+ — `PATCH /api/workflows/:id`)")
  - 상세: 워크스페이스 cap 은 전용 DTO 필드(`UpdateWorkspaceSettingsDto.maxConcurrentExecutions`, `@IsInt @Min(1)`)로 검증되지만, 워크플로우 cap 은 `settings` 가 임의 `Record<string,unknown>` 통과 필드라 `maxConcurrentExecutions: -5` 나 `"abc"` 등 어떤 값도 그대로 저장 가능하다(추가로 `Object.assign` 전체 교체라 기존 `settings` 의 다른 키도 클라이언트가 안 보낸 것과 무관하게 요청 body 그대로 대체될 위험 — cap 전용 논의는 아니지만 병합 방식 자체가 workspace 쪽과 다르다). 다행히 `resolveConcurrencyCap`(execution-limits.ts)가 방어적으로 non-positive-integer 를 defaultCap 으로 fallback 하므로 실제 admission 로직이 깨지지는 않으나, spec 표가 명시한 API 계약(검증된 Editor+ 설정 경로)과 실제 구현(무검증 passthrough) 사이에 괴리가 있다.
  - 제안: 워크플로우 전용 cap 필드를 `UpdateWorkflowDto` 에 추가하거나(workspace DTO 와 동일 패턴), 최소한 `settings` merge 를 workspace 와 동일하게 부분 병합(`{ ...workflow.settings, ...dto.settings }`)으로 바꿔 unrelated 키 유실을 막는다. e2e 테스트가 "settings write API 는 별도 테스트 범위" 라 주석 처리(L2931-2932)했는데, 그 API 자체가 검증 없이 존재한다는 점은 이번 PR 스코프 내에서 명확히 해야 한다.

- **[INFO]** 워크스페이스 `maxConcurrentExecutions` 를 시스템 기본값으로 되돌리는(unset) API 경로 없음
  - 위치: `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts` (`@IsInt @Min(1)`, unset 규약 없음) — 동일 DTO 의 `timezone` 필드는 빈 문자열로 명시적 unset 규약(L2065 설명, `workspaces.service.ts` L338-352)을 갖는다.
  - 상세: `maxConcurrentExecutions` 는 한 번 설정하면 `0`/음수/빈 값으로 되돌릴 수 없다(`@Min(1)` 이 막음). spec §8 은 unset 방법을 명시하지 않아 회색지대이나, 같은 DTO 내 다른 필드와의 UX 일관성 관점에서 기록.
  - 제안(옵션): 필요 시 `null` 을 명시적 "기본값 복귀" sentinel 로 별도 처리하는 방안을 project-planner 와 논의(코드 버그 아님, 정책 미결정 영역).

- **[INFO]** spec §8 이 이 PR 을 아직 "enforcement 구현 후속" 으로 기술 — 문서 갱신 필요(코드 완료 후 후속 처리 사항, spec 오류 아님)
  - 위치: `spec/5-system/4-execution-engine.md` §8 본문 ("— **PR2b(정책 정의 완료, enforcement 구현 후속)**" 문구가 두 항목에 잔존) / Rationale 절 "동시성 cap admission gate — consumer-side + cancelled(timeout) (PR2b, 2026-07-04)"
  - 상세: 이번 diff 가 정확히 그 "enforcement 구현" 이므로, 병합 후 spec 의 "구현 상태" 안내문(§8 상단 안내 + 두 bullet 의 PR2b 상태 태그)을 "구현 완료"로 갱신해야 문서-코드 정합이 유지된다. 이는 코드 결함이 아니라 리뷰 시점의 스냅샷상 자연스러운 지연이며, 병합/plan lifecycle 처리 시 project-planner 가 정리할 사항.
  - 제안: 코드 변경 불필요. plan lifecycle 절차(spec_impact 갱신)로 처리.

## 요약

핵심 기능(§8 워크스페이스/워크플로우 동시성 cap 원자 admission gate, 5분 큐 대기 cancel, admission-time 트리거)은 spec §8·§2.13·§3-error-handling·Rationale 절과 line-level 로 정확히 일치하며, TOCTOU-safe 원자 UPDATE·PENDING→RUNNING 최초 진입 전용 적용·stalled/재개 경로 재심사 제외·`cancelledBy='timeout'` 기존 미사용 값 첫 실사용 등 설계 의도가 코드에 충실히 반영되어 있고 unit/e2e 커버리지도 견고하다(순수 헬퍼 엣지케이스 전수, e2e 로 cap 초과→deferred→admitted 및 5분 cancel 동작을 실증). 다만 admission gate 의 raw SQL 전이가 PR2a 의 세그먼트 시각 추적(`recordRunningSegmentStart`) 호출을 빠뜨려, 이 PR 이후 사실상 모든 top-level 실행에서 §8 active-running 누적 타임아웃(`EXECUTION_MAX_ACTIVE_RUNNING_MS`) enforcement 가 무력화되는 심각한 회귀가 있다 — 이는 기존에 이미 구현 완료였던 다른 §8 항목을 이번 변경이 깨뜨린 것이므로 CRITICAL 로 분류한다. 추가로 워크플로우 레벨 cap 설정 API 가 워크스페이스 레벨과 달리 검증 없이 통과되는 비일관성이 있다.

## 위험도

HIGH
