### 발견사항

검토 없음 — 신규 식별자 충돌 후보를 찾지 못했다.

**실측 근거** (워크트리 `/Volumes/project/private/clemvion/.claude/worktrees/node-cancel-signal-b4d1`, `git diff origin/main --name-status`):

- `spec/conventions/` 하위 `.md` 파일은 이번 변경에서 **단 한 건도 수정되지 않았다** (`git diff origin/main --stat -- spec/conventions/` → 빈 출력). 프롬프트의 "Target 문서 경로: spec/conventions/" 절에 실린 방대한 덤프(`audit-actions.md`, `cafe24-api-catalog/**` 등)는 전부 **기존(unchanged) 콘텐츠** — 신규 식별자 후보가 아니라 대조용 코퍼스다.
- 실제 diff는 `codebase/backend/src/nodes/integration/{cafe24,makeshop}/{*-api.client.ts,*.handler.ts}` (기존 파일 수정, 신규 파일 아님) + `plan/in-progress/node-cancellation-residual-signal-propagation.md`(수정) + `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`(신규 plan, `spec/` 자체 아님)뿐이다.

**코드에서 도입된 유일한 신규 식별자**: `Cafe24CallOptions.signal?: AbortSignal`, `MakeshopCallOptions.signal?: AbortSignal` (각 `cafe24-api.client.ts:68-71`, `makeshop-api.client.ts:62-65` 부근).

- 기존 사용처 대조: `spec/conventions/node-cancellation.md §4` 가 이미 `fetchOptions.signal = controller.signal` / `upstream = context.abortSignal` 패턴을 정의하고 있고, `http-request.handler.ts`·`database-query.handler.ts`·`ai-agent.handler.ts`(`options?.signal`) 등 기존 핸들러가 전부 동일한 `signal` 필드명·`AbortSignal` 타입을 이미 쓰고 있다. `Cafe24CallOptions`/`MakeshopCallOptions` 는 원래 존재하던 인터페이스이며 이번엔 필드 하나만 추가됐다 — **기존 확립된 명명을 재사용**한 것이지 다른 의미의 새 이름이 아니다. `grep -rn "signal:" codebase/backend/src/nodes/` 로 대조한 결과 모든 사용처가 동일하게 `AbortSignal` cascade 의미다 (다른 도메인의 "signal" 개념과 충돌 없음).
- `Cafe24CallOptions`/`MakeshopCallOptions` 자체 인터페이스명은 `spec/4-nodes/4-integration/4-cafe24.md:593` 에서 이미 참조되는 기존 이름이라 신규 충돌 없음.

**plan 문서가 언급하는 기존 식별자 재확인** (신규 아님, 충돌 아님): `spec-update-node-cancellation-shutdown-classification.md` 가 인용하는 `SERVER_INTERRUPTED` 는 `spec/1-data-model.md:473`, `spec/5-system/4-execution-engine.md:1279`, `spec/data-flow/3-execution.md:267,299` 에 이미 등재된 기존 에러 코드이고, 해당 plan 은 그 기존 계약을 그대로 인용해 "cancelled vs failed" 분류 결정을 요청하는 것이지 새 코드/새 상태값을 만들지 않는다. 두 옵션(a: 기존 `failed` 유지, b: `cancelled` 로 재정의)은 모두 이미 존재하는 상태값 중 선택이라 신규 식별자 충돌 관점의 대상이 아니다.

새 요구사항 ID, 새 엔티티/DTO명, 새 API endpoint, 새 이벤트/큐 이름, 새 ENV var·config key, 새 spec 파일 경로 — 위 diff 범위 안에서는 전부 발견되지 않았다.

### 요약
이번 변경(diff-base `origin/main`)은 `spec/conventions/` 자체를 전혀 수정하지 않았고, 실제 코드 변경은 `Cafe24CallOptions.signal`/`MakeshopCallOptions.signal` 필드 추가뿐이다. 이 필드명은 `node-cancellation.md §4` 가 이미 정의한 `signal`/`AbortSignal` cascade 관례를 그대로 재사용한 것으로 확인되며, 다른 도메인에서 다른 의미로 쓰이는 `signal` 사례는 발견되지 않았다. 함께 포함된 두 plan 문서(`node-cancellation-residual-signal-propagation.md` 갱신, `spec-update-node-cancellation-shutdown-classification.md` 신설)도 기존에 등재된 상태값(`cancelled`/`failed`)·에러 코드(`SERVER_INTERRUPTED`)를 인용해 결정을 요청할 뿐 새 식별자를 발명하지 않는다. 신규 식별자 충돌 관점에서 이번 target 에 대해 보고할 CRITICAL/WARNING 은 없다.

### 위험도
NONE
