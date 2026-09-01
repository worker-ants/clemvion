# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위와 방법

- 검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`.
- `spec/conventions/` 델타는 0개 파일(이 브랜치는 spec 을 바꾸지 않았다) — 정상. 실제 변경은
  구현 diff 8개 파일 / 719줄(`codebase/backend/src/nodes/core/error-codes.ts` 신설
  `EngineErrorCode` const + 5지점 리다이렉트 + 신규 AST 가드 2파일 + 픽스처 1파일).
- "신규 식별자" 판정은 코드 diff 의 `+` 라인과, 워킹트리
  (`/Volumes/project/private/clemvion/.claude/worktrees/error-codes-layer-split-6aae00`)에 대한
  `git grep` 실측으로 확인했다(CWD 가 아니라 워크트리를 명시 대상으로 함).

## 발견사항

### 결론: CRITICAL/WARNING 없음

이번 변경이 실제로 새로 만드는 식별자는 TypeScript const/type 이름
(`EngineErrorCode`, `EngineErrorCodeValue`)과 신규 repo-guard 3파일
(`engine-error-code-anchor-guard.ts` / `.spec.ts` / `-fixture.ts`)의 내부 export 뿐이다.
문자열 값 자체(`EXECUTION_QUEUE_WAIT_TIMEOUT` · `WORKER_HEARTBEAT_TIMEOUT` ·
`SERVER_INTERRUPTED` · `WEBCHAT_IDLE_TIMEOUT`)는 이번 PR 이 새로 붙이는 이름이 아니라
**이미 맨 문자열로 존재하고 `spec/conventions/error-codes.md` §3·§4, `5-system/3-error-handling.md`,
`5-system/4-execution-engine.md`, `5-system/14-external-interaction-api.md`,
`data-flow/3-execution.md` 등에 문서화돼 있던 값**을 상수 참조로 리다이렉트한 것이다
(`git grep` 실측: 4개 코드 모두 diff 이전부터 spec 각 파일에 등장).

점검 관점별 확인 결과:

1. **요구사항 ID 충돌** — 해당 없음. 이번 diff 는 어떤 요구사항 ID(`EIA-RL-*`, `R-CC-*` 등)도
   신규 부여하지 않는다.
2. **엔티티/타입명 충돌** — `EngineErrorCode` / `EngineErrorCodeValue` 는 저장소 전체에서 유일하게
   `codebase/backend/src/nodes/core/error-codes.ts` 만 선언한다(`git grep` 확인, 중복 선언 없음).
   인접 이름들(`WsErrorCode`/`WsErrorCodeValue`, `McpErrorCode`, `RetryLastTurnErrorCode`,
   `ShadowErrorCode`, `IntegrationLocalizedErrorCode`)과도 접두/접미가 겹치지 않는다. `ErrorCode` 와의
   관계는 같은 파일 안에 **의도적으로 분리**돼 있고(docstring 이 이유를 명시), `error-codes.spec.ts`
   가 `EngineErrorCode`·`ErrorCode` 키 집합이 서로 겹치지 않음을 런타임에 단언한다
   (`shares no code with ErrorCode` 테스트) — 값 레벨 충돌도 자체 회귀 가드로 닫혀 있다.
3. **API endpoint 충돌** — 해당 없음. 이번 diff 는 controller/route 를 추가하지 않는다.
4. **이벤트/메시지명 충돌** — 해당 없음. 신규 webhook·queue·SSE 이벤트 이름 도입 없음(기존
   `Execution.error`/`NodeExecution.error` 봉투 값 리다이렉트일 뿐, 이벤트 자체는 불변).
5. **환경변수·설정키 충돌** — 해당 없음. 이번 diff 는 `.env.example` 을 건드리지 않는다.
   코드 주석이 참조하는 `EXECUTION_QUEUE_WAIT_TIMEOUT_MS`/`WEBCHAT_IDLE_REAP_GRACE_MS` 는 기존 env var
   그대로다(`git grep` 확인, 신규 env var 없음).
6. **파일 경로 충돌** — 신규 파일 3개(`repo-guards/__tests__/engine-error-code-anchor-guard.ts` ·
   `-fixture.ts` · `engine-error-code-anchor.spec.ts`)는 동일 디렉토리의 기존 가드 명명 컨벤션
   (`<name>-guard.ts` + `<name>.spec.ts`, 예: `redis-fail-open-catalog-guard.ts` /
   `redis-fail-open-catalog.spec.ts`)을 그대로 따르며 기존 파일과 이름이 겹치지 않는다
   (`ls codebase/backend/src/repo-guards/__tests__/` 로 확인).

### INFO — `spec/conventions/error-codes.md` §"적용 범위" 가 신설 `EngineErrorCode` 를 아직 언급하지 않음

- target 신규 식별자: `EngineErrorCode` (const, `codebase/backend/src/nodes/core/error-codes.ts:147`).
- 기존 사용처: `spec/conventions/error-codes.md` "적용 범위" 문단(파일 12~27행)은 "본 규율은 `code:` 의
  `ErrorCode` enum(...) — 명명이 중앙화된 **대표 surface**" 라고만 적고 있어, 같은 파일에 신설된
  두 번째 const `EngineErrorCode` 를 아직 명시하지 않는다.
- 상세: 이름 충돌은 아니다 — `frontmatter code:` 가 가리키는 파일 경로 자체는 그대로이고
  (`error-codes.ts` 한 파일), §3 historical-artifact 레지스트리도 `WORKER_HEARTBEAT_TIMEOUT` 을
  이미 올바르게 등재하고 있다. 다만 "명명이 중앙화된 대표 surface" 라는 문구가 이제 두 const 중
  `ErrorCode` 만 가리키는 것처럼 읽혀, 다음 사람이 "엔진 레이어 코드는 이 규약 대상이 아니다" 로
  오독할 여지가 생긴다. 이는 신규 식별자가 기존 의미와 충돌하는 문제가 아니라 **spec 서술 범위가
  구현을 따라잡지 못한 것**(spec-drift)에 가깝다 — 본 checker 의 CRITICAL/WARNING 기준(동일 식별자의
  의미 충돌)에는 해당하지 않는다.
- 제안: `spec/conventions/error-codes.md` "적용 범위" 문단에 `EngineErrorCode` 를 대표 surface 로
  1줄 추가하는 정정을 후속 planner 턴에서 권고. (naming_collision 관점의 필수 조치는 아님 —
  참고용 INFO.)

## 요약

이번 diff 가 실제로 신설하는 식별자는 `EngineErrorCode`/`EngineErrorCodeValue` const·type 과 신규
repo-guard 3파일뿐이며, 저장소 전체 `git grep` 실측 결과 어느 것도 기존 사용처와 이름이 겹치지
않는다. 리다이렉트 대상 4개 코드 값(`EXECUTION_QUEUE_WAIT_TIMEOUT`·`WORKER_HEARTBEAT_TIMEOUT`·
`SERVER_INTERRUPTED`·`WEBCHAT_IDLE_TIMEOUT`)은 새로 부여되는 의미가 아니라 이미 spec 전역에
문서화된 기존 값을 상수로 앵커링한 것이라 "신규 식별자 충돌"의 대상이 아니다. `EngineErrorCode` ↔
`ErrorCode` 키 중복 부재는 코드 자체의 회귀 테스트가 런타임으로 보증한다. 유일한 잔여 사항은
convention 문서 서술이 신설 const 를 아직 명시적으로 언급하지 않는다는 INFO 수준 spec-drift이며,
식별자 의미 충돌이 아니다.

## 위험도

NONE
